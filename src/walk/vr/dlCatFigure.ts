import { DLCatShoeContact } from './dlCatShoeContact.js';
import { cosmoRunPose, cosmoRunBlend, COSMO_RUN_DURATION } from './cosmoRunCycle.js';
import { EcctrlLocomotion, ecctrlRunBlend, loadEcctrlLocomotionData, type EcctrlAnimationData, type EmoteAnimationData } from './ecctrlLocomotion.js';
import { COSMO_EMOTES, emoteParts, loadCosmoEmoteData } from './cosmoEmotes.js';
import { applySeatedContacts, orientSeatedPalm } from "./seatedContacts.js";
import { DLCatTurning } from './dlCatTurning.js';
import { crawlArm, crawlStroke } from './dlCatCrawl.js';
import { LandingEnvelope, movingLandingBlend } from './dlCatLanding.js';
import { airborneLegs } from './dlCatAirborne.js';
import { TailSpring } from './dlCatTailSpring.js';
import { ContactProbe } from './contactProbe.js';
import { LazyWorld, eulerOnDemand } from './lazyWorld.js';
import * as T from 'three';
import { applyCelOnlyTree } from './style.js';
import { currentCharacterStyle } from './style.js';
import { applyOilCharacterTree } from './style.js';
import { DLCAT_EYES, applyStylProportions } from './style.js';
import { GRAVITY } from './worldCore.js';
import { DEFAULT_DLCAT_TUNING, getDLCatTuning, type DLCatTuning } from './dlCatTuning.js';
import { tunedJointPose } from './dlCatJointPose.js';
import { DLCatLocomotion } from './dlCatLocomotion.js';
import type { AvatarPose } from './avatar.js';
import type { DLCatAsset } from './dlcat/DLCat.js';
import { Poser, VisualJumpClock, seatedPose, seatedSway, landingPose, movementPose } from './gait.js';

// How far each mesh reaches from the pelvis in the bind pose, in its own
// units: measured once for each geometry, which every copy of the cat shares.
const bindReach=new WeakMap<T.BufferGeometry,number>();
// A culling sphere's radius over that reach. The farthest any pose puts a
// vertex from the pelvis measured 1.29 times it (a seat reaching for
// controls out of reach; the kneeling "fix" emote 1.28, idle 1.05), so this
// leaves a sixth to spare. dlCatCulling.test.ts measures every stance, jump,
// swim, seat and emote against it.
export const CULL_REACH=1.5;
// how far past the skin the realistic style's longest lock can reach (m)
const HAIR_REACH=0.3;

/** The supplied Rigify cat has a bind pose only. Drive its measured segments
 * with the game's gait channels; retain its own mesh, weights and proportions. */
export class DLCatFigure {
  readonly root=new T.Group();
  readonly bones=new Map<string,T.Bone>();
  private readonly rest=new Map<string,{p:T.Vector3;q:T.Quaternion}>();
  private readonly previous=new Map<string,T.Quaternion>();
  private readonly animated=new Map<string,T.Quaternion>();
  private readonly jointAngles=new Map<string,T.Vector3>();
  private tuning:DLCatTuning|null=null;
  private scrubbed=false;
  private readonly feet=new Map<string,T.Quaternion>();
  private readonly headForward=new T.Vector3(0,0,1);
  private readonly poser=new Poser();
  private readonly turning=new DLCatTurning();
  private readonly landing=new LandingEnvelope();
  private readonly jumpClock=new VisualJumpClock();
  // the figure's lowest point each frame, without skinning it (contactProbe.ts)
  private readonly probe:ContactProbe;
  private readonly shoeContact:DLCatShoeContact;
  private readonly locomotion=new DLCatLocomotion();
  private readonly authored:EcctrlLocomotion|null;
  authoredLocomotion=true;
  // the Stylised 3D style's size-up of the head, hands and feet (stylisedCharacter.ts); the far crowd's bake turns it off, so a bake is the same cat in every style
  stylProportions=true;
  // the emote showing (or fading out), how long it has run, how far it is
  // blended in, and whether its clips are on the donor yet (cosmoEmotes.ts)
  private emoteName:string|null=null;
  private emoteTime=0;
  private emoteBlend=0;
  private emotesReady=false;
  private emotesRequested=false;
  // What an emote does not stand on: the tail, which hangs wherever the
  // body's back puts it and props a cat playing dead half a metre up (the
  // ground hides what dips below it), and the neutral bone the model hangs a
  // few shorts vertices off, which stays where the root is.
  private readonly emoteFloorSkip=new Set<T.Bone>();
  private readonly legLengths: readonly [number,number];
  private clock=0;
  private swimPhase=0;
  private tailPhase=0;
  private tailTurn=0;
  private readonly tailSpring=new TailSpring();
  private tailPreviousLean=0;
  private tailPreviousRise=0;
  private onFeetAge=0;
  private crouchBlend=0;
  private proneBlend=0;
  private swimActive=false;
  private swimTransition=1;
  private swimFromY=0;
  private readonly swimFrom=new Map<string,T.Quaternion>();
  private slideActive=false;
  private slideTime=Infinity;
  private slideFrom:ReturnType<typeof movementPose>|null=null;
  private lastFrame:ReturnType<typeof movementPose>|null=null;
  private crawlPhase=0;
  private crawlSpeed=0;
  private readonly armLengths:readonly [number,number];
  private bank=0;
  private disposed=false;
  private initialized=false;
  private readonly restOffset:number;
  private readonly uniqueSkeletons:T.Skeleton[];
  private readonly blendTarget=new T.Quaternion();
  private readonly runFrom=new Map<string,T.Quaternion>();
  private readonly runBones:string[]=[];
  private readonly runBoneSet=new Set<string>();
  private cacheQuaternion(map:Map<string,T.Quaternion>,name:string,value:T.Quaternion){const cached=map.get(name);if(cached)cached.copy(value);else map.set(name,value.clone());}

  constructor(readonly asset:DLCatAsset, private readonly readTuning:()=>DLCatTuning=getDLCatTuning, authoredData?:EcctrlAnimationData){
    this.uniqueSkeletons=[...new Set(asset.meshes.map(m=>m.skeleton))];
    this.root.name='DLCatFigure';this.root.add(asset.root);this.lazy=new LazyWorld(this.root);
    // blocks in the Minecraft setting (placementStyle.ts), before anything measures the meshes
    currentCharacterStyle()?.meshes(asset.meshes);
    // plain lit in the painterly style, two-toned in the cel one
    applyCelOnlyTree(asset.model, { character: true, eyes: DLCAT_EYES });
    // and painted in the Painterly style, its face kept fine (scene/oilCharacter.ts)
    applyOilCharacterTree(asset.model);
    asset.model.traverse(o=>{if((o as T.Bone).isBone){const name=String(o.userData.originalName??o.name);this.bones.set(name,o as T.Bone);this.rest.set(name,{p:o.position.clone(),q:o.quaternion.clone()});}});
    this.runBones.push(...[...this.bones.keys()].filter(n=>/^spine(?:\.|$)|^shoulder\.|^(upper_arm|forearm|hand|thigh|shin|foot|toe)\./.test(n)));
    for(const name of this.runBones)this.runBoneSet.add(name);
    for(const name of this.bones.keys())if(/^(f_index|f_middle|f_ring|f_pinky|thumb)\.0[123]\.[LR]$/.test(name))this.runBoneSet.add(name);
    for(let i=1;i<=5;i++)this.runBoneSet.add('Tail_springBone_'+i);
    for(const name of ['spine','spine.003','spine.006','thigh.L','thigh.R','shin.L','shin.R','foot.L','foot.R','upper_arm.L','upper_arm.R','forearm.L','forearm.R','hand.L','hand.R'])if(!this.bones.has(name))throw new Error('DLCat missing required bone: '+name);
    for(const bone of this.bones.values())eulerOnDemand(bone);
    this.root.updateMatrixWorld(true);
    const at=(name:string)=>this.bones.get(name)!.getWorldPosition(new T.Vector3());
    this.armLengths=[at('upper_arm.L').distanceTo(at('forearm.L')),at('forearm.L').distanceTo(at('hand.L'))];
    this.legLengths=[at('thigh.L').distanceTo(at('shin.L')),at('shin.L').distanceTo(at('foot.L'))];
    this.restOffset=-new T.Box3().setFromObject(asset.root,true).min.y;
    // measured from the model as it stands, once: a changed cat measures itself again
    this.uniqueSkeletons.forEach(s=>s.update());this.probe=new ContactProbe(asset.meshes);this.shoeContact=new DLCatShoeContact(asset.meshes);
    this.cullAroundPelvis();
    for(const side of ['L','R'])this.feet.set(side,this.bones.get('foot.'+side)!.getWorldQuaternion(new T.Quaternion()));
    this.headForward.applyQuaternion(this.bones.get('spine.006')!.getWorldQuaternion(new T.Quaternion()).invert());
    this.authored=authoredData?new EcctrlLocomotion(authoredData,this.root,this.bones,this.lazy):null;
    for(const [name,bone] of this.bones)if(/^Tail_springBone|^neutral_bone$/.test(name))this.emoteFloorSkip.add(bone);
    asset.root.position.y=this.restOffset;
  }

  // THE CULLING SPHERE. A skinned mesh's own bounds are one pose's, so these
  // meshes were never culled, and a cat behind the camera cost as much to draw
  // as one in front (MEASUREMENTS.md, "Other cats, drawn"). The pelvis never
  // moves against the mesh: the solve only turns bones, and the grounding and
  // a seat move asset.root, which carries both. So each mesh's sphere is set
  // once, round the pelvis, wide enough for any pose. The shadow pass culls
  // against the light, not the camera, so a cat out of view still casts its
  // shadow into it.
  private cullAroundPelvis(){
    const pelvis=this.bones.get('spine')!,vertex=new T.Vector3();
    for(const mesh of this.asset.meshes){
      const centre=new T.Vector3().setFromMatrixPosition(pelvis.matrixWorld).applyMatrix4(new T.Matrix4().copy(mesh.matrixWorld).invert());
      let reach=bindReach.get(mesh.geometry);
      if(reach===undefined){
        reach=0;
        for(let i=0,n=mesh.geometry.getAttribute('position').count;i<n;i++)reach=Math.max(reach,mesh.getVertexPosition(i,vertex).distanceTo(centre));
        bindReach.set(mesh.geometry,reach);
      }
      mesh.boundingSphere=new T.Sphere(centre,reach*CULL_REACH);
      mesh.frustumCulled=true;
    }
    // The realistic style's hair (realistic/catFur.ts) is drawn over the body
    // and tail but kept out of the meshes: the widest of their spheres (all
    // round the pelvis, in the one frame they share), out as far again as the
    // longest lock. Left to itself each clone's hair would take one pose's
    // bounds the first time it drew, and cost a sweep of its vertices then.
    const widest=this.asset.meshes.reduce<T.Sphere|null>((w,m)=>!w||(m.boundingSphere&&m.boundingSphere.radius>w.radius)?m.boundingSphere:w,null);
    if(widest)this.asset.root.traverse(o=>{if(!o.userData.furShell)return;const hair=o as T.SkinnedMesh;hair.boundingSphere=new T.Sphere(widest.center.clone(),widest.radius+HAIR_REACH);hair.frustumCulled=true});
  }

  /** Cosmo's emote clips, onto the walk's donor skeleton. Without authored locomotion there is no donor, and no emotes. */
  attachEmotes(data:EmoteAnimationData){
    if(this.disposed||!this.authored)return;
    this.authored.addClips(data);
    this.emotesReady=true;
  }

  // Standing still, an emote takes the body over: in over a quarter second,
  // out over a fifth once the pose drops it or the body moves. Its clips are
  // fetched the first time one is asked for, and it starts from its beginning
  // once they are here. Crouched, prone, seated, swimming or in the air, the
  // body's own pose wins and the emote waits.
  private applyEmote(pose:AvatarPose,onFeet:boolean,dt:number){
    const spec=pose.emote?COSMO_EMOTES[pose.emote]:undefined;
    if(spec&&!this.emotesRequested&&!this.emotesReady){
      this.emotesRequested=true;
      void loadCosmoEmoteData().then(data=>{if(data)this.attachEmotes(data);});
    }
    if(!this.emotesReady||!this.authored)return;
    const wanted=spec&&onFeet&&(pose.stance??'stand')==='stand'?pose.emote!:null;
    if(wanted&&wanted!==this.emoteName){this.emoteName=wanted;this.emoteTime=0;}
    this.emoteBlend=T.MathUtils.clamp(this.emoteBlend+(wanted?dt/.25:-dt/.2),0,1);
    if(!this.emoteName)return;
    if(!wanted&&this.emoteBlend===0){this.emoteName=null;return;}
    this.emoteTime+=dt;
    const weight=T.MathUtils.smoothstep(this.emoteBlend,0,1)*(1-T.MathUtils.smoothstep(this.locomotion.currentSpeed,.05,.8));
    const parts=emoteParts(COSMO_EMOTES[this.emoteName]!,name=>this.authored!.clipDuration(name),this.emoteTime);
    this.authored.applyClips(parts,weight);
  }

  getJointRestPosition(name:string){return this.rest.get(name)?.p.clone();}
  getJointRest(name:string){return this.rest.get(name)?.q.clone();}
  setLocomotionPhase(phase:number){this.locomotion.setPhase(phase);this.authored?.setPhase(phase);this.scrubbed=true;}
  get animationState(){return {...this.locomotion.state,...(this.authored&&this.authoredLocomotion?this.authored.state:{}),...(this.authoredLocomotion&&cosmoRunBlend(this.locomotion.currentSpeed)>0?{runSource:'Cosmo / supplied run-video reconstruction',runCycleSeconds:COSMO_RUN_DURATION}:{})};}

  private get animationPhase(){return this.authored&&this.authoredLocomotion?this.authored.currentPhase:this.locomotion.currentPhase;}

  private readonly solvePosition=new T.Vector3();
  private readonly solveScale=new T.Vector3();
  private readonly solveFrom=new T.Vector3();
  private readonly solveOrigin=new T.Vector3();
  private readonly solveRotation=new T.Quaternion();
  private readonly solveCurrent=new T.Quaternion();
  private readonly solveParent=new T.Quaternion();
  // apply refreshes the hierarchy before solving. An edit below only notes its
  // bone, and a read makes just the path down to what it reads current
  // (lazyWorld.ts): the same matrices, without redoing a subtree per edit.
  // decompose matches getWorldQuaternion even when the figure has a scaled parent.
  private readonly lazy:LazyWorld;
  private readRotation(object:T.Object3D,target:T.Quaternion){this.lazy.world(object).decompose(this.solvePosition,target,this.solveScale);return target;}
  private worldPosition(object:T.Object3D,target:T.Vector3){return target.setFromMatrixPosition(this.lazy.world(object));}
  private world(name:string,q:T.Quaternion){const b=this.bones.get(name)!;const parent=this.readRotation(b.parent!,this.solveParent);b.quaternion.copy(parent.invert().multiply(q));this.lazy.edited(b);}
  private aim(name:string,tip:string,direction:T.Vector3){const b=this.bones.get(name)!,end=this.bones.get(tip)!;const from=this.worldPosition(end,this.solveFrom).sub(this.worldPosition(b,this.solveOrigin)).normalize();this.world(name,this.solveRotation.setFromUnitVectors(from,direction.normalize()).multiply(this.readRotation(b,this.solveCurrent)));}
  private rotate(name:string,axis:T.Vector3,angle:number){if(angle===0)return;const b=this.bones.get(name);if(b)this.world(name,this.solveRotation.setFromAxisAngle(axis,angle).multiply(this.readRotation(b,this.solveCurrent)));}

  private applyReferenceRun(phase:number,weight:number,basis:T.Quaternion){
    if(weight<=0)return;
    const run=cosmoRunPose(phase);
    const names=this.runBones;
    for(const name of names){const bone=this.bones.get(name)!;this.cacheQuaternion(this.runFrom,name,bone.quaternion);bone.quaternion.copy(this.rest.get(name)!.q);this.lazy.edited(bone);}
    const axis=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyQuaternion(basis);
    this.rotate('spine',axis(1,0,0),run.pelvisPitch);
    this.rotate('spine.001',axis(1,0,0),run.torsoPitch);
    this.rotate('spine',axis(0,1,0),run.twist);
    this.rotate('spine',axis(0,0,1),run.bank);
    this.rotate('spine.003',axis(0,1,0),run.chestYaw-run.twist);
    this.rotate('spine.004',axis(1,0,0),run.neckPitch);
    this.rotate('spine.006',axis(1,0,0),run.headPitch-run.neckPitch);
    this.rotate('spine.006',axis(0,1,0),-run.chestYaw);
    // Correct the final gaze, after the rotating torso and neck have carried
    // the head. Filtering its local angle alone leaves the inherited nod.
    const forward=this.headForward.clone().applyQuaternion(this.readRotation(this.bones.get('spine.006')!,this.solveCurrent)).applyQuaternion(basis.clone().invert());
    this.rotate('spine.006',axis(1,0,0),run.gazePitch-Math.atan2(-forward.y,forward.z));
    const direction=(lateral:number,angle:number)=>new T.Vector3(lateral,-Math.cos(angle),Math.sin(angle)).applyQuaternion(basis);
    for(const side of ['L','R'] as const){
      const leg=side==='L'?run.left:run.right,sign=side==='L'?1:-1;
      this.rotate('shoulder.'+side,axis(0,1,0),sign*run.shoulderYaw);
      this.aim('thigh.'+side,'shin.'+side,direction(sign*.015,leg.thigh));
      this.aim('shin.'+side,'foot.'+side,direction(0,leg.shin));
      this.world('foot.'+side,basis.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(leg.foot,sign*leg.footYaw,sign*leg.footRoll,'YXZ'))).multiply(this.feet.get(side)!));
      this.aim('upper_arm.'+side,'forearm.'+side,direction(sign*run.armSpread,leg.arm));
      this.aim('forearm.'+side,'hand.'+side,direction(sign*run.forearmSpread,leg.forearm));
      this.aim('hand.'+side,'f_middle.01.'+side,direction(0,Math.min(leg.forearm,Math.PI/2)+.03));
      // The visible forward glove opens; the opposite glove remains curled.
      const curl=side==='L'?run.leftHandCurl:run.rightHandCurl;
      for(const digit of ['f_index','f_middle','f_ring','f_pinky','thumb'])for(let segment=1;segment<=3;segment++){
        const name=`${digit}.0${segment}.${side}`,bone=this.bones.get(name);if(!bone)continue;
        this.cacheQuaternion(this.runFrom,name,bone.quaternion);
        bone.quaternion.copy(this.rest.get(name)!.q).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),curl*(segment===1?1:1.6)*(digit==='thumb'?.45:1)));
        bone.quaternion.slerpQuaternions(this.runFrom.get(name)!,bone.quaternion.clone(),weight);this.lazy.edited(bone);
      }
    }
    for(const name of names){const bone=this.bones.get(name)!;bone.quaternion.slerpQuaternions(this.runFrom.get(name)!,bone.quaternion.clone(),weight);this.lazy.edited(bone);}
  }

  private applyReferenceRunTail(phase:number,weight:number,basis:T.Quaternion,tuning:DLCatTuning['locomotion']){
    if(weight<=0)return;
    const names=Array.from({length:5},(_,i)=>'Tail_springBone_'+(i+1));
    for(const name of names){const bone=this.bones.get(name)!;this.cacheQuaternion(this.runFrom,name,bone.quaternion);bone.quaternion.copy(this.rest.get(name)!.q);this.lazy.edited(bone);}
    // The video carries the tail upright, with a soft backward curl at its tip.
    const tailAngles=[-40.5,2.84,22.89,.47,-35.13] as const;
    for(let i=0;i<tailAngles.length;i++){
      const angle=T.MathUtils.degToRad(tailAngles[i]!),up=Math.cos(angle),forward=Math.sin(angle);
      this.aim('Tail_springBone_'+(i+1),i===4?'Tail_springBone_end':'Tail_springBone_'+(i+2),new T.Vector3(Math.sin(phase*Math.PI*2-i*.2)*.00375*tuning.tailSway/DEFAULT_DLCAT_TUNING.locomotion.tailSway,up,forward).applyQuaternion(basis));
    }
    this.rotate(names[0]!,new T.Vector3(1,0,0).applyQuaternion(basis),T.MathUtils.degToRad(tuning.tailLift-DEFAULT_DLCAT_TUNING.locomotion.tailLift));
    for(const name of names){const bone=this.bones.get(name)!;bone.quaternion.slerpQuaternions(this.runFrom.get(name)!,bone.quaternion.clone(),weight);this.lazy.edited(bone);}
  }

  apply(pose:AvatarPose,delta:number):void{
    if(this.disposed)return;const stepMax=pose.stepMax??.05,dt=T.MathUtils.clamp(Number.isFinite(delta)?delta:0,0,stepMax);this.clock+=dt;
    const tuning=this.readTuning(),edited=tuning!==this.tuning;this.tuning=tuning;
    const swimming=pose.swimming&&!pose.seated;
    if(swimming!==this.swimActive){
      this.swimFrom.clear();
      if(this.initialized&&(swimming||pose.grounded)&&!pose.seated){
        for(const [name,b] of this.bones)this.swimFrom.set(name,(this.animated.get(name)??b.quaternion).clone());
        this.swimFromY=this.asset.root.position.y;this.swimTransition=0;
      }
      this.swimActive=swimming;
    }
    if(pose.seated||(!pose.grounded&&!swimming)){this.swimTransition=1;this.swimFrom.clear();}
    this.swimTransition=Math.min(1,this.swimTransition+dt/(swimming?tuning.locomotion.swimEntry:tuning.locomotion.swimRecovery));
    for(const [name,b] of this.bones){if(this.initialized)this.cacheQuaternion(this.previous,name,this.animated.get(name)??b.quaternion);const rest=this.rest.get(name)!;b.position.copy(rest.p);b.quaternion.copy(rest.q);}
    // (the Stylised 3D style gives the head, hands and feet a size up: stylisedCharacter.ts)
    if(this.stylProportions)applyStylProportions(this.bones);
    this.asset.root.position.set(0,this.restOffset,0);this.asset.root.rotation.set(0,0,0);
    // The avatar's parent may have moved since rendering the previous frame.
    this.root.updateWorldMatrix(true,true);this.lazy.settle();
    const age=this.jumpClock.step(!pose.grounded&&!pose.swimming&&!pose.seated,pose.jumpCount??1,pose.jumpS,dt);
    let f=this.poser.step({speedMs:pose.speedMs,grounded:pose.grounded,swimming:pose.swimming,submerged:pose.submerged,seated:!!pose.seated,seatedVariant:pose.seatedVariant??"car",stance:pose.stance??"stand",jumpCount:pose.jumpCount??1,jumpS:age,dip:pose.dip??0,turnRate:pose.turnRate??0,accelMs2:pose.accelMs2??0,riseMs:pose.riseMs??0,dt,...(pose.stepMax!==undefined?{stepMax:pose.stepMax}:{})});
    if(pose.seated) Object.assign(f,seatedPose(pose.seatedVariant??"car").frame);
    if(pose.swimming){
      this.swimPhase+=dt*3.4*tuning.locomotion.swimPace;
      const cycle=this.swimPhase,kick=Math.sin(cycle*2)*tuning.locomotion.swimKick;
      f.lean=Math.PI/2;f.spinePitch=0;f.spineTurn=Math.sin(cycle)*.06;
      f.hipL=1.55+kick*.08;f.hipR=1.55-kick*.08;
      f.kneeL=.12+Math.max(0,kick)*.18;f.kneeR=.12+Math.max(0,-kick)*.18;
      f.legSpread=.04;f.armL=cycle;f.armR=cycle+Math.PI;
      f.elbowL=.25+Math.max(0,-Math.cos(cycle))*.75;
      f.elbowR=.25+Math.max(0,Math.cos(cycle))*.75;
      f.armSpreadL=f.armSpreadR=.18;
    }
    const onFeet=pose.grounded&&!pose.swimming&&!pose.seated&&(pose.stance??'stand')==='stand';
    this.onFeetAge=onFeet?this.onFeetAge+dt:0;
    const fallbackRunRate=this.authoredLocomotion&&!this.authored?1/COSMO_RUN_DURATION*tuning.locomotion.cadenceScale/DEFAULT_DLCAT_TUNING.locomotion.cadenceScale:undefined;
    const stride=this.locomotion.step(pose.speedMs,onFeet,dt,...this.legLengths,tuning.locomotion,stepMax,fallbackRunRate);
        const idle=onFeet?1-T.MathUtils.smoothstep(this.locomotion.currentSpeed,.05,1):0;
    const breathing=Math.sin(this.clock*1.45)*.014*idle*tuning.locomotion.idleBreathing;
    const idleShift=Math.sin(this.clock*.65)*.012*idle*tuning.locomotion.idleShift;
    const turn=this.turning.step(pose.turnRate??0,this.locomotion.currentSpeed,onFeet,dt,tuning.locomotion.turnLean,tuning.locomotion.turnFollow,stepMax);
    if(onFeet){
      Object.assign(f,stride);
      f.bank=turn.bank;f.hipTurn+=turn.hip;f.spineTurn+=turn.chest;
      f.headTurn=turn.head-turn.hip-turn.chest;
      f.spinePitch+=breathing;f.headPitch-=breathing*.8;
      const relax=idle*tuning.locomotion.idleRelax;
      f.armL+=relax*(.035+Math.sin(this.clock*1.45-.4)*.014);
      f.armR+=relax*(.02+Math.sin(this.clock*1.45-.7)*.014);
      f.elbowL+=relax*(.10+Math.sin(this.clock*.8)*.025);
      f.elbowR+=relax*(.07+Math.sin(this.clock*.8+.8)*.025);
    }
    const movingLanding=movingLandingBlend(pose.speedMs);
    const impact=this.landing.step(!pose.grounded&&!pose.swimming&&!pose.seated,onFeet,dt,T.MathUtils.lerp(tuning.locomotion.landingRecovery,.08,movingLanding))*T.MathUtils.lerp(1,.3,movingLanding);
    if(impact>0){
      const target=landingPose(1),weight=Math.min(1,impact*tuning.locomotion.landingDepth);
      // Keep the locomotion phase running underneath recovery, including a running landing.
      for(const key of ['hipL','hipR','kneeL','kneeR','lean','headPitch','armL','armR','elbowL','elbowR'] as const){
        const depth=key==='kneeL'||key==='kneeR'||key==='hipL'||key==='hipR'?Math.max(1,tuning.locomotion.landingDepth):1;
        f[key]=T.MathUtils.lerp(f[key],target[key]*depth,weight);
      }
      f.kneeL=Math.min(2.6,f.kneeL);f.kneeR=Math.min(2.6,f.kneeR);
    }
    const stanceEligible=pose.grounded&&!pose.seated&&!pose.swimming&&['stand','crouch','prone'].includes(pose.stance??'stand');
    if(stanceEligible){
      const proneTarget=pose.stance==='prone'?1:0;
      const proneChange=dt/tuning.locomotion.proneDuration;
      this.proneBlend=this.initialized?T.MathUtils.clamp(proneTarget,this.proneBlend-proneChange,this.proneBlend+proneChange):proneTarget;
      const target=pose.stance==='crouch'||pose.stance==='prone'||this.proneBlend>0?1:0;
      const change=dt/tuning.locomotion.stanceDuration;
      this.crouchBlend=this.initialized?T.MathUtils.clamp(target,this.crouchBlend-change,this.crouchBlend+change):target;
      const weight=T.MathUtils.smoothstep(this.crouchBlend,0,1);
      if(!onFeet)Object.assign(f,stride);
      const step=Math.sin(this.clock*4)*Math.min(1,pose.speedMs)*.07;
      const depth=tuning.locomotion.crouchDepth,torso=tuning.locomotion.crouchTorso;
      const crouch={hipL:-1.05*depth+step,hipR:-1.05*depth-step,kneeL:1.4*depth+step,kneeR:1.4*depth-step,
        lean:.80*torso,spinePitch:.24*torso,legSpread:.1,armL:.08-step,armR:.08+step,elbowL:.28,elbowR:.28,
        armSpreadL:.18,armSpreadR:.18,headPitch:-.96*torso};
      for(const key of Object.keys(crouch) as Array<keyof typeof crouch>)f[key]=T.MathUtils.lerp(f[key],crouch[key],weight);
      if(this.proneBlend>0){
        const pronePose=movementPose('prone',this.clock*.65,Math.min(1,pose.speedMs));
        // Elbows support the chest; forearms reach along the floor instead of flying forward.
        const targetSpeed=pose.stance==='prone'?Math.max(0,pose.speedMs):0;
        this.crawlSpeed+=(targetSpeed-this.crawlSpeed)*(1-Math.exp(-dt*10));
        // A 24 cm pull occupies 68% of the cycle: match its pace to movement.
        this.crawlPhase=(this.crawlPhase+dt*this.crawlSpeed*.68/.24*tuning.locomotion.crawlPace)%1;
        const amount=T.MathUtils.smoothstep(this.crawlSpeed,0,.25);
        const left=crawlArm(this.crawlPhase,...this.armLengths),right=crawlArm(this.crawlPhase+.5,...this.armLengths);
        const pushL=crawlStroke(this.crawlPhase+.5).push*amount,pushR=crawlStroke(this.crawlPhase).push*amount;
        Object.assign(pronePose,{lean:1.57,spinePitch:0,
          armL:T.MathUtils.lerp(.12,left.arm,amount),armR:T.MathUtils.lerp(.12,right.arm,amount),
          elbowL:T.MathUtils.lerp(1.26,left.elbow-.20,amount),elbowR:T.MathUtils.lerp(1.26,right.elbow-.20,amount),
          armSpreadL:.28,armSpreadR:.28,
          hipL:1.36-pushL*.45*tuning.locomotion.crawlHipFlexion,hipR:1.36-pushR*.45*tuning.locomotion.crawlHipFlexion,
          kneeL:.10+pushL*1.15*tuning.locomotion.crawlKneeTuck,kneeR:.10+pushR*1.15*tuning.locomotion.crawlKneeTuck,legSpread:.18});
        const arms=T.MathUtils.smoothstep(this.proneBlend,0,.65);
        const body=T.MathUtils.smoothstep(this.proneBlend,.15,1);
        const legs=T.MathUtils.smoothstep(this.proneBlend,.35,1);
        for(const key of Object.keys(crouch) as Array<keyof typeof crouch>){
          const amount=/^(arm|elbow)/.test(key)?arms:/^(hip|knee|leg)/.test(key)?legs:body;
          f[key]=T.MathUtils.lerp(f[key],pronePose[key],amount);
        }
        // Reach downward during the transfer, then extend forward on the floor.
        const handSupport=Math.sin(Math.PI*this.proneBlend)*.75;
        f.armL+=handSupport;f.armR+=handSupport;
        f.headPitch=.08-f.lean-f.spinePitch;
      }
    }else{this.crouchBlend=0;this.proneBlend=0;this.crawlSpeed=0;}
    if(!pose.grounded&&!pose.swimming&&!pose.seated){
      Object.assign(f,airborneLegs(age,pose.riseMs??0,pose.jumpCount??1,tuning.locomotion.airborneTuck,tuning.locomotion.airborneExtension));
    }
    const takeoff=!pose.grounded&&!pose.swimming&&!pose.seated&&(pose.jumpCount??1)===1&&age<tuning.locomotion.takeoffDuration&&(pose.riseMs??0)>0;
    if(takeoff){
      const t=age/tuning.locomotion.takeoffDuration;
      const push=T.MathUtils.smoothstep(t,.35,1);
      const compression=T.MathUtils.lerp(.25,1,T.MathUtils.smoothstep(t,0,.35))*tuning.locomotion.takeoffDepth;
      f.hipL=f.hipR=T.MathUtils.lerp(-.9*compression,-.12,push);
      f.kneeL=f.kneeR=T.MathUtils.lerp(1.35*compression,.2,push);
      f.armL=f.armR=T.MathUtils.lerp(.45,-1.4,push);
      f.elbowL=f.elbowR=T.MathUtils.lerp(.5,.25,push);
      f.lean=T.MathUtils.lerp(.28*compression,.06,push);
    }
    const sliding=pose.grounded&&!pose.swimming&&!pose.seated&&pose.stance==='slide';
    const canSlideBlend=pose.grounded&&!pose.swimming&&!pose.seated&&['stand','crouch','slide'].includes(pose.stance??'stand');
    if(sliding!==this.slideActive){
      this.slideFrom=this.lastFrame?{...this.lastFrame}:null;this.slideTime=0;this.slideActive=sliding;
    }
    if(!canSlideBlend){this.slideFrom=null;this.slideTime=Infinity;}
    if(this.slideFrom){
      this.slideTime+=dt;
      const duration=sliding?tuning.locomotion.slideEntry:tuning.locomotion.slideRecovery;
      const t=T.MathUtils.clamp(this.slideTime/duration,0,1);
      const gather={...movementPose('crouch'),hipL:-1.05,hipR:-1.05,kneeL:1.4,kneeR:1.4,lean:.8,spinePitch:.24,headPitch:-.96};
      for(const key of Object.keys(gather) as Array<keyof typeof gather>){
        // Pass through a gathered stance before extending into the slide or rising out.
        const mid=gather[key];
        f[key]=t<.4?T.MathUtils.lerp(this.slideFrom[key],mid,T.MathUtils.smoothstep(t,0,.4)):
          T.MathUtils.lerp(mid,f[key],T.MathUtils.smoothstep(t,.4,1));
      }
      if(t===1)this.slideFrom=null;
    }
    this.lastFrame={...f};
    const basis=this.root.getWorldQuaternion(new T.Quaternion()),x=new T.Vector3(1,0,0).applyQuaternion(basis),y=new T.Vector3(0,1,0).applyQuaternion(basis),z=new T.Vector3(0,0,1).applyQuaternion(basis);
    if(pose.seated&&pose.seatPosture==='upright'){f.lean=.15;f.headPitch=-.1;f.legSpread=.08;}
    this.rotate('spine',x,f.lean);this.rotate('spine',y,f.hipTurn);this.rotate('spine',z,f.hipRoll+f.bank);
    for(const [name,weight] of [['spine.001',.3],['spine.002',.35],['spine.003',.35]] as const){this.rotate(name,x,f.spinePitch*weight);this.rotate(name,y,f.spineTurn*weight);}
    // Shift the upper-body balance without rotating the pelvis or moving foot anchors.
    this.rotate('spine.002',z,idleShift);
    this.rotate('spine.006',z,-idleShift*.7);
    const lowPose = pose.stance === 'slide';
    if ((lowPose || pose.swimming) && !pose.seated) {
      // The shared head channel also compensates for lean. This rig needs a
      // world-relative gaze instead, so a slide does not tuck its face into
      // the chest and a crawl does not throw the face toward the sky.
      const gazePitch = pose.stance === 'prone' ? 0.08 : 0.04;
      const neckPitch = gazePitch - f.lean - f.spinePitch;
      this.rotate('spine.004', x, neckPitch * 0.2);
      this.rotate('spine.005', x, neckPitch * 0.35);
      this.rotate('spine.006', x, neckPitch * 0.45);
    } else {
      this.rotate('spine.006', x, f.headPitch);
    }
    this.rotate('spine.006', y, f.headTurn);
    const prone=pose.stance==='prone'||pose.swimming;
    // The rigid oversized shoes rock the whole body upward when grounded by
    // their lowest vertex. Keep walking soles almost level; ease the full
    // a little more roll in at running speed, using the same filtered speed as the gait.
    const soleRoll=T.MathUtils.lerp(.08,.15,T.MathUtils.smoothstep(this.locomotion.currentSpeed,4.5,7.5));
    for(const side of ['L','R'] as const){
      const left=side==='L',sign=left?1:-1,thigh=-(left?f.hipL:f.hipR),calf=thigh-(left?f.kneeL:f.kneeR),arm=-(left?f.armL:f.armR);
      const forearm = arm + (left ? f.elbowL : f.elbowR);
      const direction=(lateral:number,angle:number)=>new T.Vector3(lateral,-Math.cos(angle),Math.sin(angle)).applyQuaternion(basis);
      this.aim('thigh.'+side,'shin.'+side,direction(sign*f.legSpread,thigh));this.aim('shin.'+side,'foot.'+side,direction(0,calf));
      if(this.proneBlend>0&&!pose.swimming)this.world('foot.'+side,basis.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2*T.MathUtils.smoothstep(this.proneBlend,.35,1))).multiply(this.feet.get(side)!));else if(prone)this.aim('foot.'+side,'toe.'+side,direction(0,calf));else this.world('foot.'+side,basis.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),onFeet?(left?f.ankleL:f.ankleR)*soleRoll+(left?stride.heelL:stride.heelR)+T.MathUtils.degToRad(tuning.locomotion.footAngle):pose.grounded&&pose.stance!=="slide"?0:-calf+.18+(left?f.ankleL:f.ankleR))).multiply(this.feet.get(side)!));
            const baseSpread=Math.max(.12,left?f.armSpreadL:f.armSpreadR);
      // Adjust arm clearance without resizing the shoulders or changing limb lengths.
      const spread=onFeet?Math.tan(T.MathUtils.clamp(Math.atan(baseSpread)+T.MathUtils.degToRad(tuning.locomotion.armSpacing),-Math.PI*4/9,Math.PI*4/9)):baseSpread;
      this.aim('upper_arm.'+side,'forearm.'+side,direction(sign*spread,arm));this.aim('forearm.'+side,'hand.'+side,direction(0,forearm));
      this.aim('hand.'+side,'f_middle.01.'+side,this.proneBlend>0?direction(0,forearm).lerp(new T.Vector3(0,-.08,1).applyQuaternion(basis),T.MathUtils.smoothstep(this.proneBlend,0,.65)):direction(0,forearm+(onFeet?(1-idle)*Math.sin(this.animationPhase*Math.PI*2+(left?0:Math.PI)-.12*tuning.locomotion.armLooseness-.55*tuning.locomotion.elbowLag-.3)*.09*tuning.locomotion.wristFollow+idle*tuning.locomotion.idleRelax*(.035+Math.sin(this.clock*1.1+(left?0:.6))*.018):0)));
    }
    // Authored locomotion replaces only standing walk/run. Existing stance,
    // airborne, swim and seated solvers retain ownership of their poses.
    const authoredWeight=this.authored&&this.authoredLocomotion&&onFeet?(1-T.MathUtils.smoothstep(this.crouchBlend,0,1))*T.MathUtils.smoothstep(this.locomotion.currentSpeed,.05,.8)*(1-impact):0;
    this.authored?.apply(this.locomotion.currentSpeed,this.scrubbed?0:dt,authoredWeight,tuning.locomotion);
    const referenceRunWeight=onFeet&&this.authoredLocomotion?cosmoRunBlend(this.locomotion.currentSpeed)*(1-T.MathUtils.smoothstep(this.crouchBlend,0,1))*(1-impact):0;
    this.applyReferenceRun(this.animationPhase,referenceRunWeight,basis);
    if(this.authoredLocomotion)this.authored?.applyJump(!pose.grounded,!pose.swimming&&!pose.seated&&(pose.stance??'stand')==='stand',age,this.scrubbed?0:dt,pose.speedMs);
    this.applyEmote(pose,onFeet,this.scrubbed?0:dt);
    if(authoredWeight>0||referenceRunWeight>0){
      const lt=tuning.locomotion,defaults=DEFAULT_DLCAT_TUNING.locomotion,poseWeight=Math.max(authoredWeight,referenceRunWeight);
      const run=ecctrlRunBlend(this.locomotion.currentSpeed);
      const armGain=lt.armSwingScale/defaults.armSwingScale*T.MathUtils.lerp(lt.walkArmDrive/defaults.walkArmDrive,lt.runArmDrive/defaults.runArmDrive,run);
      const elbowGain=lt.elbowBendScale/defaults.elbowBendScale*T.MathUtils.lerp(lt.walkElbowBend/defaults.walkElbowBend,lt.runElbowBend/defaults.runElbowBend,run);
      for(const side of ['L','R'] as const){
        const upper=this.bones.get('upper_arm.'+side)!,lower=this.bones.get('forearm.'+side)!,hand=this.bones.get('hand.'+side)!;
        const direction=this.worldPosition(lower,new T.Vector3()).sub(this.worldPosition(upper,new T.Vector3())).applyQuaternion(basis.clone().invert());
        this.rotate('upper_arm.'+side,x,Math.atan2(direction.z,-direction.y)*(1-armGain)*poseWeight);
        this.rotate('upper_arm.'+side,z,T.MathUtils.degToRad(lt.armSpacing-defaults.armSpacing)*(side==='L'?1:-1)*poseWeight);
        const a=this.worldPosition(lower,new T.Vector3()).sub(this.worldPosition(upper,new T.Vector3())).normalize();
        const b=this.worldPosition(hand,new T.Vector3()).sub(this.worldPosition(lower,new T.Vector3())).normalize();
        const axis=a.clone().cross(b);
        if(axis.lengthSq()>1e-6)this.rotate('forearm.'+side,axis.normalize(),T.MathUtils.clamp(a.angleTo(b)*(elbowGain-1),-1.3,1.3)*poseWeight);
        this.rotate('foot.'+side,x,T.MathUtils.degToRad(lt.footAngle-defaults.footAngle)*poseWeight);
      }
      this.rotate('spine',x,T.MathUtils.degToRad(lt.pelvisTilt-defaults.pelvisTilt)*poseWeight);
      this.rotate('spine.002',x,T.MathUtils.degToRad(lt.torsoBend-defaults.torsoBend)*poseWeight);
      this.rotate('spine',z,turn.bank*poseWeight);
      this.rotate('spine',y,turn.hip*poseWeight);this.rotate('spine.003',y,turn.chest*poseWeight);
      this.rotate('spine.006',y,(turn.head-turn.hip-turn.chest)*poseWeight);
    }
    // Twist the whole solved arm about shoulder-to-elbow, carrying the bent
    // forearm and hand with it. Apply before the independent palm correction.
    if(onFeet&&idle<1)for(const side of ['L','R'] as const){
      const shoulder=this.bones.get('upper_arm.'+side)!,elbow=this.bones.get('forearm.'+side)!;
      const axis=this.worldPosition(elbow,new T.Vector3()).sub(this.worldPosition(shoulder,new T.Vector3())).normalize();
      this.rotate('upper_arm.'+side,axis,T.MathUtils.degToRad(tuning.locomotion.shoulderRotation-DEFAULT_DLCAT_TUNING.locomotion.shoulderRotation*referenceRunWeight)*(side==='L'?1:-1)*(1-idle));
    }
    // Roll each palm around its own wrist-to-finger axis, mirrored across sides.
    // Keep the wrist bend and finger direction from the arm solve intact.
    if(onFeet&&idle<1)for(const side of ['L','R'] as const){
      const hand=this.bones.get('hand.'+side)!,finger=this.bones.get('f_middle.01.'+side)!;
      const axis=this.worldPosition(finger,new T.Vector3()).sub(this.worldPosition(hand,new T.Vector3())).normalize();
      this.rotate('hand.'+side,axis,T.MathUtils.degToRad(tuning.locomotion.palmRotation-DEFAULT_DLCAT_TUNING.locomotion.palmRotation*referenceRunWeight)*(side==='L'?1:-1)*(1-idle));
    }
    const swayVariant=pose.seated&&pose.seatedVariant!=='bike'?(pose.seatedVariant??'car'):null;
    this.bank=seatedSway(swayVariant,pose.turnRate??0,this.bank,dt);
    if(pose.seated){this.rotate('spine.001',z,this.bank);this.rotate('spine.006',z,-this.bank*.4);}
    // Integrating phase avoids a jump when sway speed changes.
    const tail=tuning.locomotion;
    this.tailPhase=(this.tailPhase+dt*2*tail.tailSpeed)%(Math.PI*2);
    const turnTarget=T.MathUtils.clamp(pose.turnRate??0,-2,2)*tail.tailTurnResponse;
    this.tailTurn+=(turnTarget-this.tailTurn)*(1-Math.exp(-dt*6));
    const leanRate=this.initialized&&dt>0?T.MathUtils.clamp((f.lean-this.tailPreviousLean)/dt,-4,4):0;
    const rise=pose.riseMs??0;
    const verticalAccel=this.initialized&&dt>0?T.MathUtils.clamp((rise-this.tailPreviousRise)/dt,-20,20):0;
    this.tailPreviousLean=f.lean;this.tailPreviousRise=rise;
    const lowTail=pose.stance==='slide'?1:pose.stance==='prone'?.55:pose.stance==='crouch'?.2:pose.swimming?.35:0;
    const targets=Array.from({length:5},(_,i)=>{
      const bend=tail.tailInfluence*(leanRate*.045-verticalAccel*.006-(pose.accelMs2??0)*.008);
      return [f.tailLift*.06+T.MathUtils.degToRad(tail.tailLift)/5+T.MathUtils.degToRad(tail.tailCurl)*(i+1)/15+(i===0?lowTail:0)+bend/(1+i*.3),
        Math.sin(this.tailPhase-(i+1)*.55*tail.tailLag)*.045*tail.tailSway+f.tailTurn*.12*tail.tailTurnResponse-this.tailTurn*.04];
    });
    const spring=this.tailSpring.step(targets,dt,tail.tailStiffness,tail.tailDamping,this.scrubbed,stepMax);
    for(let i=0;i<5;i++){
      const name='Tail_springBone_'+(i+1);
      // Low poses impose immediate base clearance while the tip settles.
      this.rotate(name,x,i===0?Math.max(lowTail,spring[i]![0]!):spring[i]![0]!);
      this.rotate(name,y,spring[i]![1]!);
    }
    this.applyReferenceRunTail(this.animationPhase,referenceRunWeight,basis,tuning.locomotion);
    const blend=this.initialized&&!edited&&!this.scrubbed?1-Math.exp(-dt*(takeoff?45:onFeet?24:15)):1;
    // The mixer already blends gait speed. Filtering the solved leg joints a
    // second time breaks boot clearance; retain that filter only on entry.
    if(blend<1)for(const [name,b] of this.bones){
      let jointBlend=onFeet&&/^(thigh|shin|foot|toe)\./.test(name)?T.MathUtils.lerp(blend,1,T.MathUtils.smoothstep(this.onFeetAge,0,.3)):blend;
      if(this.runBoneSet.has(name))jointBlend=T.MathUtils.lerp(jointBlend,1,referenceRunWeight*T.MathUtils.smoothstep(this.onFeetAge,0,.3));
      b.quaternion.slerpQuaternions(this.previous.get(name)!,this.blendTarget.copy(b.quaternion),jointBlend);
    }
    if(this.swimTransition<1){
      const weight=T.MathUtils.smoothstep(this.swimTransition,0,1);
      for(const [name,b] of this.bones){
        const from=this.swimFrom.get(name);
        if(from)b.quaternion.slerpQuaternions(from,this.blendTarget.copy(b.quaternion),weight);
      }
    }else this.swimFrom.clear();
    for(const [name,b] of this.bones){
      this.cacheQuaternion(this.animated,name,b.quaternion);
      const edit=tuning.joints[name];
      if(edit){const next=tunedJointPose(this.rest.get(name)!.q,b.quaternion,edit,this.jointAngles.get(name));b.quaternion.copy(next.quaternion);this.jointAngles.set(name,next.angles);}
      else this.jointAngles.delete(name);
    }
    this.scrubbed=false;this.initialized=true;this.root.updateMatrixWorld(true);this.lazy.settle();this.uniqueSkeletons.forEach(s=>s.update());
    if(authoredWeight>0&&this.authored){
      // A long swing boot must not become the floor anchor and lift the planted
      // foot. Bend the swing leg just enough to clear the support sole instead.
      const phase=this.authored.currentPhase;
      const side=phase<.5?'R':'L';
      const stancePhase=phase%.5;
      const contact=T.MathUtils.smoothstep(stancePhase,0,.10)*(1-T.MathUtils.smoothstep(stancePhase,.36,.5));
      const support=this.shoeContact.lowestY(side==='L'?'R':'L');
      const lift=Math.max(0,support+.015-this.shoeContact.lowestY(side))*contact*authoredWeight*(1-cosmoRunBlend(this.locomotion.currentSpeed));
      if(lift>1e-5){
        const thigh=this.bones.get('thigh.'+side)!,shin=this.bones.get('shin.'+side)!,foot=this.bones.get('foot.'+side)!;
        const hip=this.worldPosition(thigh,new T.Vector3()),knee=this.worldPosition(shin,new T.Vector3()),ankle=this.worldPosition(foot,new T.Vector3());
        const rotation=this.readRotation(foot,new T.Quaternion());
        const upper=hip.distanceTo(knee),lower=knee.distanceTo(ankle);
        ankle.y+=lift;
        const line=ankle.clone().sub(hip),distance=T.MathUtils.clamp(line.length(),Math.abs(upper-lower)+.001,upper+lower-.001);line.normalize();
        const pole=knee.clone().sub(hip);pole.addScaledVector(line,-pole.dot(line));
        if(pole.lengthSq()<1e-8)pole.set(0,0,1).applyQuaternion(basis);
        pole.normalize();
        const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
        const solvedKnee=hip.clone().addScaledVector(line,along).addScaledVector(pole,Math.sqrt(Math.max(0,upper*upper-along*along)));
        this.aim('thigh.'+side,'shin.'+side,solvedKnee.sub(hip));
        this.aim('shin.'+side,'foot.'+side,ankle.sub(this.worldPosition(shin,new T.Vector3())));
        this.world('foot.'+side,rotation);this.lazy.flush();this.uniqueSkeletons.forEach(s=>s.update());
      }
    }
    // Nothing below reads through this.lazy, and nothing below tells it of an
    // edit: the grounding moves asset.root, and the seat helpers
    // (seatedContacts.ts) turn bones with three's own eager calls. A read here
    // takes three's getters; the refresh at the end makes everything current.
    if(pose.seated){
      const variant=pose.seatedVariant??'car';
      // The outer Avatar owns motorcycle bank. Other seats keep the pelvis
      // and feet fixed while the upper body follows turns gently.
      this.root.updateMatrixWorld(true);this.lazy.settle();
      const hip=this.root.worldToLocal(this.bones.get('spine')!.getWorldPosition(new T.Vector3()));
      const seat=seatedPose(variant);
      this.asset.root.position.add(new T.Vector3(-hip.x,(pose.seatHeight??seat.hipHeight)-hip.y,(pose.seatForward??seat.forward)-hip.z));
    }
    else if(pose.grounded&&!pose.swimming){const floor=this.root.getWorldPosition(new T.Vector3()).y;const shoeBottom=authoredWeight>0?this.shoeContact.lowestY():Infinity;const bottom=authoredWeight>0&&Number.isFinite(shoeBottom)?shoeBottom:this.probe.lowestY(this.emoteBlend>0?this.emoteFloorSkip:undefined);const scale=this.root.getWorldScale(new T.Vector3()).y;this.asset.root.position.y+=(floor-bottom)/scale;}
    if(takeoff){
      // Physics remains immediate. For the first impulse only, let the visual
      // legs compress against the takeoff plane before releasing into ascent.
      const release=T.MathUtils.smoothstep(age/tuning.locomotion.takeoffDuration,.35,1);
      const height=Math.max(0,(pose.riseMs??0)*age+.5*GRAVITY*age*age);
      const floor=this.root.getWorldPosition(new T.Vector3()).y-height;
      const bottom=this.probe.lowestY();
      this.asset.root.position.y+=(floor-bottom)/this.root.getWorldScale(new T.Vector3()).y*(1-release);
    }
    if(onFeet){const flight=T.MathUtils.lerp(Math.max(0,stride.flight),this.authored?.flight??0,this.authored?authoredWeight:0);this.asset.root.position.y+=T.MathUtils.lerp(flight,cosmoRunPose(this.animationPhase).flight,referenceRunWeight);}
    if(this.swimTransition<1&&swimming)this.asset.root.position.y=T.MathUtils.lerp(this.swimFromY,this.asset.root.position.y,T.MathUtils.smoothstep(this.swimTransition,0,1));
    if (pose.seated && pose.seatContacts) {
      applySeatedContacts(this.root, this.bones, 'dl', pose.seatContacts);
      for (const side of ['L', 'R'] as const) {
        if (!(side === 'L' ? pose.seatContacts.leftHand : pose.seatContacts.rightHand)) continue;
        orientSeatedPalm(this.root, this.bones.get('hand.' + side)!, side, pose.seatedVariant === 'bike');
        for (const digit of ['f_index', 'f_middle', 'f_ring', 'f_pinky', 'thumb']) for (let segment = 1; segment <= 3; segment++) {
          const name = `${digit}.0${segment}.${side}`, bone = this.bones.get(name), rest = this.rest.get(name);
          if (!bone || !rest) continue;
          const angle = (segment === 1 ? .65 : segment === 2 ? .95 : .75) * (digit === 'thumb' ? .45 : 1);
          bone.quaternion.copy(rest.q).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), angle));
        }
      }
    }
    this.root.updateMatrixWorld(true);
    this.uniqueSkeletons.forEach(s=>s.update());
  }

  dispose():void{if(this.disposed)return;this.disposed=true;this.locomotion.dispose();this.authored?.dispose();this.asset.dispose();this.root.removeFromParent();this.bones.clear();this.rest.clear();this.previous.clear();}
}
