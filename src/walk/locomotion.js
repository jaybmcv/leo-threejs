import * as T from 'three';

// Cosmo's walk, jog and jump, as Voyager's Reach plays them (packages/client/src/play/ecctrlLocomotion.ts): authored
// clips from the Quaternius Universal Animation Library (CC0, via pmndrs/ecctrl) drive a hidden donor skeleton, and
// their world-space rotations are retargeted onto Cosmo's bones. The phase follows the walker's speed, so the feet
// keep pace with the ground; translation stays with the controller.
const MAPPING=[
 ['spine','DEF-hips'],['spine.001','DEF-spine.001'],['spine.002','DEF-spine.002'],['spine.003','DEF-spine.003'],
 ['spine.005','DEF-neck'],['spine.006','DEF-head'],
 ...['L','R'].flatMap(s=>[
  [`shoulder.${s}`,`DEF-shoulder.${s}`],
  [`upper_arm.${s}`,`DEF-upper_arm.${s}`,`forearm.${s}`],
  [`forearm.${s}`,`DEF-forearm.${s}`,`hand.${s}`],
  [`hand.${s}`,`DEF-hand.${s}`,`f_middle.01.${s}`],
  [`thigh.${s}`,`DEF-thigh.${s}`,`shin.${s}`],
  [`shin.${s}`,`DEF-shin.${s}`,`foot.${s}`],
  [`foot.${s}`,`DEF-foot.${s}`,`toe.${s}`],
 ]),
];
const CLIPS=['Walk_Loop','Jog_Fwd_Loop','Jump_Start','Jump_Loop','Jump_Land'];
const CADENCE=1.14;
export const movingLandingBlend=speed=>T.MathUtils.smoothstep(Math.abs(speed),.15,1.5);

export class Locomotion{
 // `bones` maps Cosmo's bone names to bones; `root` is the figure's root. `walk` and `run` are the walker's speeds.
 constructor(data,root,bones,{walk,run}){
  this.root=root;this.walk=walk;this.run=run;this.phase=0;this.wasAirborne=false;this.landingAge=Infinity;
  this.source=new T.Group();this.byName=new Map();this.pairs=[];this.travelPerCycle=[];
  this.nodes=data.nodes.map(n=>{const o=new T.Object3D();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);this.byName.set(n.name,o);return o;});
  data.nodes.forEach((n,i)=>n.children?.forEach(c=>this.nodes[i].add(this.nodes[c])));
  this.nodes.filter(n=>!n.parent).forEach(n=>this.source.add(n));
  this.source.updateMatrixWorld(true);root.updateMatrixWorld(true);
  const rootInverse=root.getWorldQuaternion(new T.Quaternion()).invert();
  const footRest=new Map(['L','R'].map(s=>[s,bones.get('foot.'+s).getWorldQuaternion(new T.Quaternion()).premultiply(rootInverse)]));
  for(const [name,sourceName,tip] of MAPPING){
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
  // Parent before child: the two rigs have different spine counts.
  const depth=o=>o.parent?depth(o.parent)+1:0;this.pairs.sort((a,b)=>depth(a.target)-depth(b.target));
  const length=(a,b)=>a.getWorldPosition(new T.Vector3()).distanceTo(b.getWorldPosition(new T.Vector3()));
  this.scale=(length(bones.get('thigh.L'),bones.get('shin.L'))+length(bones.get('shin.L'),bones.get('foot.L')))/
   (length(this.byName.get('DEF-thigh.L'),this.byName.get('DEF-shin.L'))+length(this.byName.get('DEF-shin.L'),this.byName.get('DEF-foot.L')));
  this.mixer=new T.AnimationMixer(this.source);
  this.actions=CLIPS.map(name=>{
   const clip=data.clips.find(c=>c.name===name);if(!clip)throw new Error('Missing locomotion clip '+name);
   const tracks=clip.tracks.map(t=>{const path=this.nodes[t.node].uuid+'.'+(t.path==='rotation'?'quaternion':'position');
    return t.path==='rotation'?new T.QuaternionKeyframeTrack(path,t.times,t.values):new T.VectorKeyframeTrack(path,t.times,t.values);});
   const action=this.mixer.clipAction(new T.AnimationClip(name,-1,tracks));action.play();action.paused=true;return action;
  });
  // Ground travel per cycle from the planted foot, so the cadence matches the walker's speed.
  for(const index of [0,1]){
   const action=this.actions[index],samples=[];this.actions.forEach((a,i)=>a.setEffectiveWeight(i===index?1:0));
   for(let i=0;i<60;i++){action.time=i/60*action.getClip().duration;this.mixer.update(0);this.source.updateMatrixWorld(true);const f=this.byName.get('DEF-foot.L').getWorldPosition(new T.Vector3());samples.push({y:f.y,z:f.z});}
   let low=Infinity;for(const p of samples)low=Math.min(low,p.y);
   const v=samples.slice(1).flatMap((p,i)=>{const s=(samples[i].z-p.z)*60/action.getClip().duration;return p.y<low+.055&&s>.05?[s]:[];}).sort((a,b)=>a-b);
   this.travelPerCycle[index]=(v[Math.floor(v.length/2)]??1)*action.getClip().duration*this.scale;
  }
  // Rigid boots: calibrate them to the donor's planted midstance.
  this.actions.forEach((a,i)=>a.setEffectiveWeight(i===0?1:0));
  for(const [side,phase] of [['L',1/6],['R',2/3]]){
   const walk=this.actions[0];walk.time=phase*walk.getClip().duration;this.mixer.update(0);this.source.updateMatrixWorld(true);
   const pair=this.pairs.find(p=>p.source.name==='DEF-foot.'+side);
   pair.walkCorrection=pair.source.getWorldQuaternion(new T.Quaternion()).invert().multiply(footRest.get(side));
  }
 }
 runBlend(speed){return T.MathUtils.smoothstep(speed,this.walk+.1,(this.walk+this.run)/2);}
 // Advance the gait by the walker's ground speed and pull the bones toward it by `weight`.
 apply(speed,dt,weight){
  const run=this.runBlend(speed),travel=T.MathUtils.lerp(this.travelPerCycle[0],this.travelPerCycle[1],run);
  const rate=Math.min(speed/Math.max(.05,travel),T.MathUtils.lerp(1.6,2.6,run))*CADENCE*.5;
  this.phase=(this.phase+dt*rate)%1;
  this.actions.forEach((a,i)=>{a.time=this.phase*a.getClip().duration;a.setEffectiveWeight(i===0?1-run:i===1?run:0);});
  this.mixer.update(0);this.source.updateMatrixWorld(true);
  if(weight>0)this.retarget(weight,1-run);
 }
 // Jump phases from the controller's state; the height stays with the controller.
 applyJump(airborne,age,dt,speed=0){
  if(this.wasAirborne&&!airborne)this.landingAge=0;else this.landingAge+=Math.max(0,dt);
  this.wasAirborne=airborne;
  const [,,start,loop,land]=this.actions,moving=movingLandingBlend(speed);
  const startDuration=start.getClip().duration,landDuration=T.MathUtils.lerp(land.getClip().duration,Math.min(.18,land.getClip().duration),moving);
  if(!airborne&&this.landingAge>=landDuration)return;
  this.actions.forEach(a=>a.setEffectiveWeight(0));
  let weight;
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
 retarget(weight,walkWeight=0){
  const basis=this.root.getWorldQuaternion(new T.Quaternion()),q=new T.Quaternion(),p=new T.Quaternion();
  for(const pair of this.pairs){
   const desired=pair.source.getWorldQuaternion(q).multiply(pair.walkCorrection?pair.correction.clone().slerp(pair.walkCorrection,walkWeight):pair.correction).premultiply(basis);
   desired.premultiply(pair.target.parent.getWorldQuaternion(p).invert());
   pair.target.quaternion.slerp(desired.normalize(),weight).normalize();
   pair.target.updateWorldMatrix(false,true);
  }
 }
 dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.source);}
}
