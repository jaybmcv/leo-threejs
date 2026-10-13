import * as T from 'three';

// Cosmo's pose helpers and relaxed stand, shared by the Cosmo bundle (cosmo.js) and the walk page (src/walk), which
// must not import cosmo.js itself: that would pull the 2 MB rig into its own bundle.
export const COSMO_HEIGHT=1.75;

const DEG=Math.PI/180,X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const worldPos=o=>o.getWorldPosition(new T.Vector3()),worldQuat=o=>o.getWorldQuaternion(new T.Quaternion());

// Give a bone a world-space orientation, expressed in its parent's frame.
export function setWorldQuat(bone,world){
 bone.quaternion.copy(worldQuat(bone.parent).invert().multiply(world));bone.updateMatrixWorld(true);
}
// Turn a bone in world space so the segment towards `child` points along `target`.
export function aim(bone,child,target){
 const from=worldPos(child).sub(worldPos(bone)).normalize();
 setWorldQuat(bone,new T.Quaternion().setFromUnitVectors(from,target.clone().normalize()).multiply(worldQuat(bone)));
}
// Turn a bone about a world axis through its own pivot.
export function turn(bone,axis,degrees){setWorldQuat(bone,new T.Quaternion().setFromAxisAngle(axis,degrees*DEG).multiply(worldQuat(bone)));}

// A relaxed stand instead of the rig's T-pose (Cosmo faces +z; his left is +x): weight on the left leg with the right
// knee soft, elbows and fingers loosely bent, the head tipped a little and the tail hanging low.
const ARM={L:{upper:[.2,-1,-.07],fore:[.07,-1,.42],curl:1},R:{upper:[.16,-1,-.03],fore:[.05,-1,.3],curl:.8}};
const FINGER_CURL={index:16,middle:21,ring:26,pinky:30};
function relaxArms(bone){
 for(const side of ['L','R']){
  const upper=bone('upper_arm.'+side),fore=bone('forearm.'+side),hand=bone('hand.'+side),out=Math.sign(worldPos(fore).x-worldPos(upper).x)||1,pose=ARM[side];
  turn(bone('shoulder.'+side),Z,-out*5);
  aim(upper,fore,new T.Vector3(out*pose.upper[0],pose.upper[1],pose.upper[2]));aim(fore,hand,new T.Vector3(out*pose.fore[0],pose.fore[1],pose.fore[2]));
  turn(hand,Y,-out*20);
  for(const [finger,deg] of Object.entries(FINGER_CURL))for(const joint of ['01','02','03'])bone(`f_${finger}.${joint}.${side}`).rotateX(deg*pose.curl*DEG);
  for(const joint of ['02','03'])bone(`thumb.${joint}.${side}`).rotateX(12*DEG);
 }
}
function relaxLegs(bone){
 const feet=['L','R'].map(side=>[bone('foot.'+side),worldQuat(bone('foot.'+side))]);
 const thigh=bone('thigh.R'),shin=bone('shin.R'),foot=bone('foot.R');
 aim(thigh,shin,new T.Vector3(-.05,-1,.2));aim(shin,foot,new T.Vector3(-.02,-1,-.1));
 // Feet stay flat on the deck; the relaxed one turns out a touch.
 for(const [f,q] of feet)setWorldQuat(f,q);turn(foot,Y,-12);
}
function relaxSpine(bone){
 turn(bone('spine.001'),Z,2.5);turn(bone('spine.003'),Z,-2);turn(bone('spine.002'),Y,4);
 turn(bone('spine.005'),Z,-7);turn(bone('spine.006'),Y,-12);turn(bone('spine.006'),X,5);
 for(const [i,deg] of [[1,-78],[2,-22],[3,-4],[4,22],[5,34]])turn(bone('Tail_springBone_'+i),X,deg);
}
export function relaxPose(cat){
 const skeleton=cat.meshes[0].skeleton;cat.root.updateMatrixWorld(true);
 const bone=name=>{const b=skeleton.getBoneByName(T.PropertyBinding.sanitizeNodeName(name));if(!b)throw new Error('Cosmo rig is missing '+name);return b;};
 relaxLegs(bone);relaxSpine(bone);relaxArms(bone);
 // The finger curls use local rotations; refresh world matrices before the bake reads them.
 cat.root.updateMatrixWorld(true);
}

