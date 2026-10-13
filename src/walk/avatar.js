import * as T from 'three';
import {COSMO_HEIGHT,relaxPose,aim,turn,setWorldQuat} from '../cosmo-pose.js';
import {Locomotion} from './locomotion.js';

// Cosmo as the walker: the same DL Cat rig as Voyager's Reach, animated with its retargeted walk, jog and jump
// (locomotion.js), a breathing idle built on the viewer's relaxed stand, and two resting poses for seats and beds.
// `holder` is what the controller moves: its origin is between the feet and it faces +z.
const X=new T.Vector3(1,0,0);
export const WALKER={height:COSMO_HEIGHT,walk:2.25,run:5.2};

function sitPose(bone){
 for(const side of ['L','R']){
  const out=side==='L'?1:-1,feet=worldQuatOf(bone('foot.'+side));
  aim(bone('thigh.'+side),bone('shin.'+side),new T.Vector3(out*.12,-.08,1));
  aim(bone('shin.'+side),bone('foot.'+side),new T.Vector3(out*.03,-1,.12));
  setWorldQuat(bone('foot.'+side),feet);
  aim(bone('upper_arm.'+side),bone('forearm.'+side),new T.Vector3(out*.22,-1,.32));
  aim(bone('forearm.'+side),bone('hand.'+side),new T.Vector3(-out*.18,-.35,1));
 }
 turn(bone('spine.001'),X,-6);turn(bone('spine.003'),X,4);turn(bone('spine.006'),X,6);
 for(const [i,deg] of [[1,-40],[2,-30],[3,-10]])turn(bone('Tail_springBone_'+i),X,deg);
}
function liePose(bone){
 for(const side of ['L','R']){
  const out=side==='L'?1:-1;
  aim(bone('thigh.'+side),bone('shin.'+side),new T.Vector3(out*.06,-1,0));
  aim(bone('shin.'+side),bone('foot.'+side),new T.Vector3(out*.02,-1,.04));
  aim(bone('upper_arm.'+side),bone('forearm.'+side),new T.Vector3(out*.2,-1,.04));
  aim(bone('forearm.'+side),bone('hand.'+side),new T.Vector3(out*.12,-1,.28));
  turn(bone('foot.'+side),X,-20);
 }
 turn(bone('spine.006'),X,-8);
 for(const [i,deg] of [[1,-90],[2,-10]])turn(bone('Tail_springBone_'+i),X,deg);
}
const worldQuatOf=o=>o.getWorldQuaternion(new T.Quaternion());

// `createDLCat` comes from the Cosmo bundle (or src/vendor/cosmo/DLCat.js in Node); `motion` is ecctrl-locomotion.json.
export async function createWalker(createDLCat,motion){
 const cat=await createDLCat({height:COSMO_HEIGHT,castShadow:true,receiveShadow:true});
 const skeleton=cat.meshes[0].skeleton,lookup=name=>{const b=skeleton.getBoneByName(T.PropertyBinding.sanitizeNodeName(name));if(!b)throw new Error('Cosmo rig is missing '+name);return b;};
 const bones={get:lookup};
 const holder=new T.Group();holder.name='Walker';const body=new T.Group();holder.add(body);body.add(cat.root);
 cat.root.updateMatrixWorld(true);
 for(const m of cat.meshes)m.frustumCulled=false;
 const capture=()=>skeleton.bones.map(b=>b.quaternion.clone()),restore=qs=>{skeleton.bones.forEach((b,i)=>b.quaternion.copy(qs[i]));cat.root.updateMatrixWorld(true);};
 const bind=capture();
 // The retarget calibrates against the bind pose, so it is built first.
 const locomotion=motion?new Locomotion(motion,cat.root,bones,WALKER):null;
 relaxPose(cat);const idle=capture();
 restore(bind);sitPose(lookup);cat.root.updateMatrixWorld(true);const sit=capture();
 const hips=lookup('spine').getWorldPosition(new T.Vector3());
 restore(bind);liePose(lookup);cat.root.updateMatrixWorld(true);const lie=capture();
 restore(idle);
 const spine=[lookup('spine.002'),lookup('spine.003')],head=lookup('spine.006');
 let clock=0,jumpAge=0;
 return {
  holder,body,cat,locomotion,
  // The hips' height above the feet's origin; a seat lifts the body so the hips rest on it.
  hipHeight:hips.y,
  // state: {speed, airborne, rest:{kind:'sit'|'lie', weight}}
  update(dt,{speed=0,airborne=false,rest=null}={}){
   clock+=dt;jumpAge=airborne?jumpAge+dt:0;
   restore(idle);
   const moving=T.MathUtils.smoothstep(speed,.05,.7);
   if(locomotion&&!rest){locomotion.apply(speed,dt,moving);locomotion.applyJump(airborne,jumpAge,dt,speed);}
   if(rest&&rest.weight>0){const target=rest.kind==='lie'?lie:sit;skeleton.bones.forEach((b,i)=>b.quaternion.slerp(target[i],rest.weight));}
   // Breathing, strongest at rest.
   const breath=Math.sin(clock*1.45)*.012*(1-moving);
   for(const b of spine)b.rotateX(breath);head.rotateX(-breath*.8);
   cat.root.updateMatrixWorld(true);
  },
  dispose(){locomotion?.dispose();holder.removeFromParent();}
 };
}
