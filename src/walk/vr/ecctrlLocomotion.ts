import * as T from 'three';
import { movingLandingBlend } from './dlCatLanding.js';
import { WALK_SPEED, RUN_SPEED } from './worldCore.js';
import { COSMO_RUN_DURATION, cosmoRunBlend } from './cosmoRunCycle.js';
import { DEFAULT_DLCAT_TUNING } from './dlCatTuning.js';

/** Ordinary walking must remain the donor walk, even at the game's fast travel speed. */
export function ecctrlRunBlend(speed:number){
  return T.MathUtils.smoothstep(speed,WALK_SPEED+.1,(WALK_SPEED+RUN_SPEED)/2);
}
import type { DLCatTuning } from './dlCatTuning.js';
import { eulerOnDemand, type LazyWorld } from './lazyWorld.js';

export interface EcctrlAnimationData {
  nodes: Array<{name:string;children?:number[];translation?:number[];rotation?:number[];scale?:number[]}>;
  clips: Array<{name:string;tracks:Array<{node:number;path:string;times:number[];values:number[]}>}>;
}
/** Clips for the same donor skeleton, their tracks naming a donor bone (cosmoEmotes.ts). */
export interface EmoteAnimationData {
  clips: Array<{name:string;tracks:Array<{bone:string;path:'rotation';times:number[];values:number[]}>}>;
}
const mapping: Array<[string,string,string?]> = [
  ['spine','DEF-hips'], ['spine.001','DEF-spine.001'], ['spine.002','DEF-spine.002'], ['spine.003','DEF-spine.003'],
  ['spine.005','DEF-neck'], ['spine.006','DEF-head'],
  ...(['L','R'] as const).flatMap(s=>[
    [`shoulder.${s}`,`DEF-shoulder.${s}`],
    [`upper_arm.${s}`,`DEF-upper_arm.${s}`,`forearm.${s}`],
    [`forearm.${s}`,`DEF-forearm.${s}`,`hand.${s}`],
    [`hand.${s}`,`DEF-hand.${s}`,`f_middle.01.${s}`],
    [`thigh.${s}`,`DEF-thigh.${s}`,`shin.${s}`],
    [`shin.${s}`,`DEF-shin.${s}`,`foot.${s}`],
    [`foot.${s}`,`DEF-foot.${s}`,`toe.${s}`],
  ] as Array<[string,string,string?]>),
];

/** Retarget authored world-space rotations, not Euler angles from incompatible rigs.
 * Calibrate the target limb's bind direction to the donor T pose first. This
 * permits Cosmo's A pose and differently oriented local bone axes without
 * changing any target joint positions, skin bind matrices or limb lengths. */
export class EcctrlLocomotion {
  private readonly source=new T.Group();
  private readonly mixer:T.AnimationMixer;
  private readonly nodes:T.Object3D[];
  private readonly byName=new Map<string,T.Object3D>();
  private readonly actions:T.AnimationAction[];
  private readonly extra=new Map<string,T.AnimationAction>();
  private readonly pairs:Array<{target:T.Bone;source:T.Object3D;correction:T.Quaternion;walkCorrection?:T.Quaternion}> = [];
  private phase=0;
  private root:T.Object3D;
  private scale=1;
  private floors:number[]=[];
  private readonly travelPerCycle:number[]=[];
  private wasAirborne=false;
  private landingAge=Infinity;
  flight=0;
  // the target figure's matrices on demand, when it keeps them so (lazyWorld.ts)
  private readonly lazy:LazyWorld|undefined;
  private readonly scratchPosition=new T.Vector3();
  private readonly scratchScale=new T.Vector3();
  constructor(data:EcctrlAnimationData,root:T.Object3D,bones:Map<string,T.Bone>,lazy?:LazyWorld){
    this.root=root;this.lazy=lazy;
    this.nodes=data.nodes.map(n=>{
      const o=new T.Object3D();o.name=n.name;
      if(n.translation)o.position.fromArray(n.translation);
      if(n.rotation)o.quaternion.fromArray(n.rotation);
      if(n.scale)o.scale.fromArray(n.scale);
      this.byName.set(n.name,o);return o;
    });
    data.nodes.forEach((n,i)=>n.children?.forEach(child=>this.nodes[i]!.add(this.nodes[child]!)));
    // the mixer writes every donor quaternion each frame; nothing reads their angles
    this.nodes.forEach(eulerOnDemand);
    this.nodes.filter(n=>!n.parent).forEach(n=>this.source.add(n));
    this.source.updateMatrixWorld(true);root.updateMatrixWorld(true);
    const footRest=new Map(['L','R'].map(side=>[side,bones.get('foot.'+side)!.getWorldQuaternion(new T.Quaternion()).premultiply(root.getWorldQuaternion(new T.Quaternion()).invert())]));
    const rootInverse=root.getWorldQuaternion(new T.Quaternion()).invert();
    for(const [name,sourceName,tip] of mapping){
      const target=bones.get(name),source=this.byName.get(sourceName);if(!target||!source)continue;
      const targetRest=target.getWorldQuaternion(new T.Quaternion()).premultiply(rootInverse);
      if(tip){
        const targetTip=bones.get(tip),sourceTip=this.byName.get('DEF-'+tip);
        if(targetTip&&sourceTip){
          const a=targetTip.getWorldPosition(new T.Vector3()).sub(target.getWorldPosition(new T.Vector3())).applyQuaternion(rootInverse).normalize();
          const b=sourceTip.getWorldPosition(new T.Vector3()).sub(source.getWorldPosition(new T.Vector3())).normalize();
          targetRest.premultiply(new T.Quaternion().setFromUnitVectors(a,b));
        }
      }
      this.pairs.push({target,source,correction:source.getWorldQuaternion(new T.Quaternion()).invert().multiply(targetRest).normalize()});
    }
    // Parent-before-child conversion is essential when the two rigs have different spine counts.
    const depth=(o:T.Object3D):number=>o.parent?depth(o.parent)+1:0;
    this.pairs.sort((a,b)=>depth(a.target)-depth(b.target));
    const length=(a:T.Object3D,b:T.Object3D)=>a.getWorldPosition(new T.Vector3()).distanceTo(b.getWorldPosition(new T.Vector3()));
    this.scale=(length(bones.get('thigh.L')!,bones.get('shin.L')!)+length(bones.get('shin.L')!,bones.get('foot.L')!)) /
      (length(this.byName.get('DEF-thigh.L')!,this.byName.get('DEF-shin.L')!)+length(this.byName.get('DEF-shin.L')!,this.byName.get('DEF-foot.L')!));
    this.mixer=new T.AnimationMixer(this.source);
    this.actions=['Walk_Loop','Jog_Fwd_Loop','Jump_Start','Jump_Loop','Jump_Land'].map(name=>{
      const clip=data.clips.find(c=>c.name===name);if(!clip)throw new Error('Missing Ecctrl locomotion clip '+name);
      const tracks=clip.tracks.map(t=>{
        const path=this.nodes[t.node]!.uuid+'.'+(t.path==='rotation'?'quaternion':'position');
        return t.path==='rotation'?new T.QuaternionKeyframeTrack(path,t.times,t.values):new T.VectorKeyframeTrack(path,t.times,t.values);
      });
      const action=this.mixer.clipAction(new T.AnimationClip(name,-1,tracks));action.play();action.paused=true;return action;
    });
    this.floors=this.actions.slice(0,2).map((action,index)=>{
      let floor=Infinity;const samples:Array<{y:number;z:number}>=[];
      this.actions.forEach((a,i)=>a.setEffectiveWeight(i===index?1:0));
      for(let i=0;i<60;i++){action.time=i/60*action.getClip().duration;this.mixer.update(0);this.source.updateMatrixWorld(true);floor=Math.min(floor,this.footHeight());const foot=this.byName.get('DEF-foot.L')!.getWorldPosition(new T.Vector3());samples.push({y:foot.y,z:foot.z});}
      const low=Math.min(...samples.map(p=>p.y));
      const velocities=samples.slice(1).flatMap((p,i)=>{const v=(samples[i]!.z-p.z)*60/action.getClip().duration;return p.y<low+.055&&v>.05?[v]:[];}).sort((a,b)=>a-b);
      const contactSpeed=velocities[Math.floor(velocities.length/2)]??1;
      this.travelPerCycle[index]=contactSpeed*action.getClip().duration*this.scale;
      return floor;
    });
    // Calibrate rigid boots to the donor's planted midstance, not its sloping
    // ankle-to-toe bind vector. Keep authored heel strike, push-off and swing.
    this.actions.forEach((a,i)=>a.setEffectiveWeight(i===0?1:0));
    for(const [side,phase] of [['L',1/6],['R',2/3]] as const){
      const walk=this.actions[0]!;walk.time=phase*walk.getClip().duration;
      this.mixer.update(0);this.source.updateMatrixWorld(true);
      const pair=this.pairs.find(p=>p.source.name==='DEF-foot.'+side)!;
      pair.walkCorrection=pair.source.getWorldQuaternion(new T.Quaternion()).invert().multiply(footRest.get(side)!);
    }
  }
  private footHeight(){return Math.min(...['DEF-foot.L','DEF-foot.R','DEF-toe.L','DEF-toe.R'].map(n=>this.byName.get(n)!.getWorldPosition(new T.Vector3()).y));}
  setPhase(phase:number){this.phase=((phase%1)+1)%1;}
  get currentPhase(){return this.phase;}
  get state(){return {engine:'Ecctrl / Quaternius authored clips',phase:this.phase,clips:this.actions.map(a=>a.getClip().name),weights:this.actions.map(a=>a.getEffectiveWeight()),travelPerCycle:[...this.travelPerCycle]};}
  apply(speed:number,dt:number,weight:number,tuning:DLCatTuning['locomotion']){
    const run=ecctrlRunBlend(speed);
    // Walking uses donor support-foot travel at Cosmo's scale. The video run
    // blends to its measured 0.6-second period; translation stays physics-owned.
    const travel=T.MathUtils.lerp(this.travelPerCycle[0]!,this.travelPerCycle[1]!,run);
    const gaitRate=Math.min(speed/Math.max(.05,travel),T.MathUtils.lerp(1.6,2.6,run))*tuning.cadenceScale*.5;
    const cycleRate=T.MathUtils.lerp(gaitRate,1/COSMO_RUN_DURATION*tuning.cadenceScale/DEFAULT_DLCAT_TUNING.locomotion.cadenceScale,cosmoRunBlend(speed));
    this.phase=(this.phase+dt*cycleRate)%1;
    this.actions.forEach((a,i)=>{a.time=this.phase*a.getClip().duration;a.setEffectiveWeight(i===0?1-run:i===1?run:0);});
    this.mixer.update(0);this.source.updateMatrixWorld(true);
    this.flight=Math.max(0,this.footHeight()-T.MathUtils.lerp(this.floors[0]!,this.floors[1]!,run))*this.scale*run*weight;
    if(weight<=0)return;
    this.retarget(weight,1-run);
  }
  private retarget(weight:number,walkWeight=0){
    // Every caller has just posed the donor and refreshed it whole, so its
    // matrices are read as they stand; a figure keeping its own on demand
    // makes just the paths it is asked for current, and an edit only notes
    // its bone. Without one, three's getters and a subtree refresh per edit.
    const lazy=this.lazy;
    const targetRotation=(o:T.Object3D,q:T.Quaternion)=>lazy?(lazy.world(o).decompose(this.scratchPosition,q,this.scratchScale),q):o.getWorldQuaternion(q);
    const donorRotation=(o:T.Object3D,q:T.Quaternion)=>lazy?(o.matrixWorld.decompose(this.scratchPosition,q,this.scratchScale),q):o.getWorldQuaternion(q);
    const basis=targetRotation(this.root,new T.Quaternion());
    for(const pair of this.pairs){
      const desired=donorRotation(pair.source,new T.Quaternion()).multiply(pair.walkCorrection?pair.correction.clone().slerp(pair.walkCorrection,walkWeight):pair.correction).premultiply(basis);
      desired.premultiply(targetRotation(pair.target.parent!,new T.Quaternion()).invert());
      pair.target.quaternion.slerp(desired.normalize(),weight).normalize();
      if(lazy)lazy.edited(pair.target);else pair.target.updateWorldMatrix(false,true);
    }
  }
  /** Sample jump phases from simulation state; root height stays physics-owned. */
  applyJump(airborne:boolean,eligible:boolean,age:number,dt:number,speed=0){
    if(!eligible){this.wasAirborne=false;this.landingAge=Infinity;return;}
    if(this.wasAirborne&&!airborne)this.landingAge=0;
    else this.landingAge+=Math.max(0,dt);
    this.wasAirborne=airborne;
    const start=this.actions[2]!,loop=this.actions[3]!,land=this.actions[4]!;
    const moving=movingLandingBlend(speed);
    const startDuration=start.getClip().duration,landDuration=T.MathUtils.lerp(land.getClip().duration,Math.min(.18,land.getClip().duration),moving);
    if(!airborne&&this.landingAge>=landDuration)return;
    this.actions.forEach(a=>a.setEffectiveWeight(0));
    let weight=1;
    if(airborne){
      this.landingAge=Infinity;
      const cross=T.MathUtils.smoothstep(age,Math.max(0,startDuration-.12),startDuration);
      start.time=Math.min(age,startDuration-1e-5);start.setEffectiveWeight(1-cross);
      loop.time=Math.max(0,age-startDuration)%loop.getClip().duration;loop.setEffectiveWeight(cross);
      weight=T.MathUtils.smoothstep(age,0,.08);
    }else{
      land.time=Math.min(this.landingAge/landDuration*land.getClip().duration,land.getClip().duration-1e-5);land.setEffectiveWeight(1);
      weight=T.MathUtils.smoothstep(this.landingAge,0,.06)*(1-T.MathUtils.smoothstep(this.landingAge,landDuration*T.MathUtils.lerp(.65,.35,moving),landDuration))*T.MathUtils.lerp(1,.3,moving);
    }
    this.mixer.update(0);this.source.updateMatrixWorld(true);this.retarget(weight);
  }
  /** More clips on the donor skeleton — Cosmo's emotes — sharing its calibrated retarget. */
  addClips(data:EmoteAnimationData){
    for(const clip of data.clips){
      if(this.extra.has(clip.name))continue;
      const tracks=clip.tracks.flatMap(t=>{const node=this.byName.get(t.bone);return node&&t.path==='rotation'?[new T.QuaternionKeyframeTrack(node.uuid+'.quaternion',t.times,t.values)]:[];});
      const action=this.mixer.clipAction(new T.AnimationClip(clip.name,-1,tracks));action.play();action.paused=true;action.setEffectiveWeight(0);
      this.extra.set(clip.name,action);
    }
  }
  clipDuration(name:string){return this.extra.get(name)?.getClip().duration??0;}
  /** Pose the donor from added clips (weights summing to one) and move the target toward it by `weight`. */
  applyClips(parts:ReadonlyArray<{clip:string;time:number;weight:number}>,weight:number){
    if(weight<=0||!parts.length||parts.some(p=>!this.extra.has(p.clip)))return;
    this.actions.forEach(a=>a.setEffectiveWeight(0));
    for(const p of parts){const a=this.extra.get(p.clip)!;a.time=Math.min(Math.max(0,p.time),a.getClip().duration-1e-5);a.setEffectiveWeight(p.weight);}
    this.mixer.update(0);this.source.updateMatrixWorld(true);this.retarget(weight);
    for(const p of parts)this.extra.get(p.clip)!.setEffectiveWeight(0);
  }
  dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.source);}
}
let dataPromise:Promise<EcctrlAnimationData|null>|undefined;
export function loadEcctrlLocomotionData(){
  if(typeof window==='undefined')return Promise.resolve(null);
  return dataPromise??=fetch('/animations/ecctrl-locomotion.json').then(r=>{if(!r.ok)throw new Error('Animation asset unavailable');return r.json() as Promise<EcctrlAnimationData>;}).catch(error=>{
    dataPromise=undefined;
    // Keep gameplay usable offline or with an older static deployment.
    console.warn('Ecctrl locomotion unavailable; using Cosmo procedural fallback.',error);return null;
  });
}

