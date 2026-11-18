import assert from 'node:assert/strict';
import * as T from 'three';
import {createGardenCommons} from '../src/model.js';
import {resolveRoomFrames} from '../src/plan/rooms.js';
import {findRestSpots,spotIndex} from '../src/walk/rest.js';
import {RemotePlayers} from '../src/walk/remotes.js';
import {RemotePlayers as AuthoringRemotes} from '../src/walk/remotes.authoring.js';
import {crowdLoop} from '../src/walk/crowd-tier.js';
import {walker} from './bake-crowd-motion.mjs';

const source=createGardenCommons(1),root=new T.Group();root.add(source.root);resolveRoomFrames(root);
const spots=findRestSpots(root),cushions=spots.filter(s=>s.sitPose==='crossLegged'),index=spotIndex(spots);
assert.equal(cushions.length,2,'Both round cushions on the photo-spot rug have their pose');
assert.equal(spots.filter(s=>s.kind==='sit'&&!s.sitPose&&Math.abs(s.height-cushions[0].height)<1e-5).length,4,'The four cushions on the other entrance rugs stay ordinary');
assert(spots.some(s=>s.kind==='sit'&&!s.sitPose),'Other seats retain their pose');
const {w,scene}=await walker(),at=n=>w.figure.bones.get(n).getWorldPosition(new T.Vector3());
const state={speed:0,grounded:true,stance:'stand',jumpCount:1,jumpS:-1,turnRate:0,accel:0,rise:0};
const sit={kind:'sit',weight:1,seatHeight:w.hipHeight,sitPose:'crossLegged'};
const step=rest=>{for(let i=0;i<60;i++)w.update(1/60,{...state,rest,catnip:true});scene.updateMatrixWorld(true);};
step(sit);
assert.equal(w.sitPose,'crossLegged');
assert(Math.abs(at('spine').y-w.hipHeight)<1e-6,'Pelvis stays at the seat contact height');
for(const side of ['L','R']){
 const sign=side==='L'?1:-1,knee=at('shin.'+side),ankle=at('foot.'+side),toe=at('toe.'+side),hand=at('hand.'+side);
 assert(sign*knee.x>.18&&sign*ankle.x<0,'Shins cross between the outward knees');
 assert(sign*toe.x<-.1,'Feet tuck toward the opposite knee');
 assert(ankle.y>knee.y&&knee.y>w.hipHeight,'Legs stay above the cushion');
 assert(hand.distanceTo(knee)<.12,'Hands rest over the knees');
 const palm=new T.Vector3(0,0,1).applyQuaternion(w.figure.bones.get('hand.'+side).getWorldQuaternion(new T.Quaternion()));
 assert(palm.y>.99,'Palms face up');
 for(const digit of ['f_index','f_middle','f_ring','f_pinky'])for(const joint of ['01','02','03']){
  const name=`${digit}.${joint}.${side}`;
  assert(w.figure.bones.get(name).quaternion.clone().normalize().angleTo(w.figure.rest.get(name).q.clone().normalize())<1e-5,'Fingers stay open');
 }
}
assert(at('foot.L').distanceTo(at('foot.R'))>.06,'Crossed ankles have separation');
// All shoe vertices, including the rig's larger boots, clear the cushion top.
for(const mesh of w.figure.asset.meshes.filter(m=>/^shoes/.test(m.name))){
 const p=new T.Vector3();for(let i=0;i<mesh.geometry.attributes.position.count;i++)assert(mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld).y>w.hipHeight-.06,'Shoes stay above the cushion');
}
const mount=new T.Group();w.figure.bones.get('spine.006').add(mount);w.hat={mount};step(sit);assert(mount.visible,'Sitting keeps the hat');
console.log('PASS real rig: crossed shins, tucked feet, upright pelvis, open palms, knee contacts, shoe clearance and hat');
for(const spot of cushions){
 const origin=spot.point.clone().setY(spot.height+.06-w.hipHeight);origin.z+=.04;
 assert.equal(index.sitPoseAt(origin,w.hipHeight),'crossLegged');
 assert.equal(index.sitPoseAt(origin.clone().add(new T.Vector3(0,1,0)),w.hipHeight),null);
}
console.log('PASS pose follows both transformed seat definitions, without matching other levels');
// Use the real remote pose entry points with the existing sit state and the same seat lookup as main.
for(const Players of [RemotePlayers,AuthoringRemotes]){
 const players=new Players(scene,{sitPose:(p,h)=>index.sitPoseAt(p,h)}),spot=cushions[0];
 const r={walker:w,cur:{x:spot.point.x,y:spot.height+.06-w.hipHeight,z:spot.point.z+.04,yaw:0},tgt:{rest:'sit',grounded:true,stance:'stand',fur:0},rest:1,restKind:'sit',lastYaw:0,turnRate:0,speed:0,rise:0,distance:0};
 players.pose(r,1/60);assert.equal(w.sitPose,'crossLegged');
 r.cur.x+=2;players.pose(r,1/60);assert.equal(w.sitPose,'passenger');
}
assert.equal(crowdLoop({rest:'sit',sitPose:'crossLegged'}),'crossLegged');
assert.equal(crowdLoop({rest:'sit'}),'sit');
assert.equal(crowdLoop({rest:'tube',sitPose:'crossLegged'}),'sit');
console.log('PASS both remote renderers and the distant crowd select the cushion pose from the existing sit state');
w.holder.position.set(0,0,0);w.holder.rotation.set(0,0,0);step({...sit,sitPose:null});
assert.equal(w.sitPose,'passenger');assert(at('foot.L').y<at('shin.L').y-.1,'Ordinary seated legs still hang down');
step(null);assert.equal(w.sitPose,null);assert(at('foot.L').y<.3,'Standing restores the walking rig');
w.dispose();console.log('PASS ordinary seats and standing restore their original poses');
