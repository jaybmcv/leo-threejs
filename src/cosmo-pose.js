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


// Kitten poses for the Young explorers play zones (src/walk/kittens.js), each built on the relaxed stand. The kit bakes
// them on request and sets the lowest point on the floor, so a crouch or a sit needs no hip height of its own.
const kittenBones=cat=>{const skeleton=cat.meshes[0].skeleton;return name=>skeleton.getBoneByName(T.PropertyBinding.sanitizeNodeName(name));};
const v=(x,y,z)=>new T.Vector3(x,y,z);
function limbs(bone,part,side,[x1,y1,z1],[x2,y2,z2]){
 const s=side==='L'?1:-1,[upper,lower,end]=part.map(p=>bone(p+'.'+side));
 aim(upper,lower,v(s*x1,y1,z1));aim(lower,end,v(s*x2,y2,z2));
}
const ARMS=['upper_arm','forearm','hand'],LEGS=['thigh','shin','foot'];
export const KITTEN_POSES={
 // Sitting on its bottom, legs out in front, both paws down between its feet on a toy; the tail curls round.
 sit(cat){const bone=kittenBones(cat);
  for(const s of ['L','R']){limbs(bone,LEGS,s,[.35,.1,1],[.1,-.45,.9]);limbs(bone,ARMS,s,[.12,-1,.45],[.05,-.55,1]);}
  turn(bone('spine.001'),X,-6);turn(bone('spine.006'),X,16);
  for(const [i,deg] of [[1,-40],[2,30],[3,35],[4,35],[5,30]])turn(bone('Tail_springBone_'+i),Y,deg);
  cat.root.updateMatrixWorld(true);},
 // Crouched to pounce: haunches up, chest low, front paws reaching for something on the floor, the head up.
 pounce(cat){const bone=kittenBones(cat);
  turn(bone('spine.001'),X,40);turn(bone('spine.003'),X,22);turn(bone('spine.005'),X,-34);turn(bone('spine.006'),X,-26);
  for(const s of ['L','R']){limbs(bone,LEGS,s,[.25,-.2,1],[.04,-1,-.75]);limbs(bone,ARMS,s,[.2,-.85,.5],[.05,-.9,.35]);}
  for(const [i,deg] of [[1,30],[2,25],[3,20],[4,-25],[5,-30]])turn(bone('Tail_springBone_'+i),X,deg);
  cat.root.updateMatrixWorld(true);},
 // Up on its hind legs batting a paw high at a playmate, the other paw out in front.
 bat(cat){const bone=kittenBones(cat);
  limbs(bone,ARMS,'R',[.3,.75,.55],[.1,.9,.45]);limbs(bone,ARMS,'L',[.25,-.2,1],[.05,.25,1]);
  turn(bone('spine.003'),Z,6);turn(bone('spine.006'),X,-14);
  for(const [i,deg] of [[1,25],[2,20],[3,15]])turn(bone('Tail_springBone_'+i),X,deg);
  cat.root.updateMatrixWorld(true);},
};

// Actor poses for the Deck 16 theatre's stage (src/walk/theatre.js), each built on the relaxed stand, feet on the floor.
export const ACTOR_POSES={
 // Declaiming: the right arm flung up and out to the house, the left hand on the heart, chin up.
 declaim(cat){const bone=kittenBones(cat);
  limbs(bone,ARMS,'R',[.6,.55,.55],[.35,.8,.5]);limbs(bone,ARMS,'L',[.3,-.75,.45],[-.85,.3,.45]);
  turn(bone('spine.003'),X,-4);turn(bone('spine.006'),X,-10);turn(bone('spine.006'),Y,-8);
  cat.root.updateMatrixWorld(true);},
 // Taking a bow: bent at the waist, the right arm swept across the middle, the left out to the side behind.
 bow(cat){const bone=kittenBones(cat);
  turn(bone('spine.001'),X,20);turn(bone('spine.003'),X,12);turn(bone('spine.006'),X,8);
  limbs(bone,ARMS,'R',[.05,-.55,.8],[-.8,-.15,.55]);limbs(bone,ARMS,'L',[.85,-.4,-.3],[.75,-.35,-.4]);
  cat.root.updateMatrixWorld(true);},
};
