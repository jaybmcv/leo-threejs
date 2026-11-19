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
const rugMeshes=[];root.traverse(o=>{if(o.isMesh&&/^(Soft_seat|Meditation_cushion)$/.test(o.name)&&o.getWorldPosition(new T.Vector3()).y<25.1)rugMeshes.push(o);});
assert.equal(rugMeshes.length,13,'All seven domes and six flat cushions on the three lounge rugs are covered');
assert.equal(cushions.length,rugMeshes.length,'Every lounge rug seat uses the meditation pose');
for(const o of rugMeshes){assert.equal(o.userData.sitPose,'crossLegged');const p=o.getWorldPosition(new T.Vector3());assert.equal(cushions.filter(s=>Math.hypot(s.point.x-p.x,s.point.z-p.z)<.01).length,1,'Each cushion has exactly one pose anchor');}
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
 assert(sign*knee.x>.30&&Math.abs(knee.x)>knee.z,'Knees open sideways instead of pointing forward');
 assert(Math.abs(knee.y-w.hipHeight)<.06,'Knees stay low, roughly level with the hips');
 assert(sign*ankle.x<sign*knee.x-.12&&Math.abs(toe.x)<.09,'Shins fold inward and feet tuck toward the opposite knee');
 assert(ankle.y<w.hipHeight+.12&&toe.y<w.hipHeight+.12,'Feet stay low instead of stacking in the lap');
 assert(hand.distanceTo(knee)<.09&&Math.abs(hand.x-knee.x)<.025,'Each open hand rests on its own knee');
 for(const foot of ['foot.L','foot.R'])assert(hand.distanceTo(at(foot))>.16,'Hands stay away from both shoes');
 const palm=new T.Vector3(0,0,1).applyQuaternion(w.figure.bones.get('hand.'+side).getWorldQuaternion(new T.Quaternion()));
 assert(palm.y>.99,'Palms face up');
 for(const digit of ['f_index','f_middle','f_ring','f_pinky'])for(const joint of ['01','02','03']){
  const name=`${digit}.${joint}.${side}`;
  assert(w.figure.bones.get(name).quaternion.clone().normalize().angleTo(w.figure.rest.get(name).q.clone().normalize())<1e-5,'Fingers stay open');
 }
}
assert(at('shin.L').distanceTo(at('shin.R'))>.60,'Knees remain visibly wide from the front');
assert(Math.abs(at('toe.L').z-at('toe.R').z)>.20,'Feet stagger in depth rather than stacking vertically');
// All shoe vertices, including the rig's larger boots, clear the cushion top.
const shoeBoxes=[];
for(const mesh of w.figure.asset.meshes.filter(m=>/^shoes/.test(m.name))){
 const p=new T.Vector3(),box=new T.Box3();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);box.expandByPoint(p);assert(p.y>w.hipHeight-.06,'Shoes stay above the cushion');}shoeBoxes.push(box);
}
assert.equal(shoeBoxes.length,2);
assert(shoeBoxes[0].min.x<-.09&&shoeBoxes[1].max.x>.05,'Each shoe extends across the centre toward the opposite knee');
// Test the posed surfaces: the shoes' boxes overlap even when their diagonal shapes clear each other.
const vertices=m=>Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrixWorld));
const surface=(points,index)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flatMap(p=>p.toArray()),3));if(index)g.setIndex(index);return new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));};
const clearEdges=(shoe,points,target)=>{const idx=shoe.geometry.index,ray=new T.Raycaster();for(let i=0;i<idx.count;i+=3)for(let j=0;j<3;j++){
 const a=points[idx.getX(i+j)],d=points[idx.getX(i+(j+1)%3)].clone().sub(a);ray.set(a,d.clone().normalize());ray.far=d.length();assert.equal(ray.intersectObject(target,false).length,0,'Shoe surfaces clear the other shoe, body, thighs and hands');
}};
const shoes=w.figure.asset.meshes.filter(m=>/^shoes/.test(m.name)),shoePoints=shoes.map(vertices),surfaces=shoes.map((m,i)=>surface(shoePoints[i],m.geometry.index));
// The toe bones end inside the large boots. Measure the actual toe caps, rather than a box corner or an ankle.
const tips=shoePoints.map((points,i)=>{
 const side=i===0?'L':'R',ankle=at('foot.'+side),forward=at('toe.'+side).sub(ankle).normalize();
 const distance=p=>p.clone().sub(ankle).dot(forward),end=Math.max(...points.map(distance)),cap=points.filter(p=>distance(p)>end-.03);
 return cap.reduce((p,v)=>p.add(v),new T.Vector3()).multiplyScalar(1/cap.length);
});
assert(tips[0].x<-.05&&tips[1].x>.05,'Both boot toe caps reach across the centre toward the opposite knee');
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),left=[at('shin.L'),at('foot.L'),tips[0]],right=[at('shin.R'),at('foot.R'),tips[1]];
assert([0,1].some(i=>[0,1].some(j=>cross(left[i],left[i+1],right[j])*cross(left[i],left[i+1],right[j+1])<0&&cross(right[j],right[j+1],left[i])*cross(right[j],right[j+1],left[i+1])<0)),'The shin and boot paths cross in front view, instead of merely folding inward on their own side');
clearEdges(shoes[0],shoePoints[0],surfaces[1]);clearEdges(shoes[1],shoePoints[1],surfaces[0]);
const skin=w.figure.asset.meshes.find(m=>m.name==='body'),skinPoints=vertices(skin),a=skin.geometry.attributes,idx=skin.geometry.index;
for(let i=0;i<skinPoints.length;i++){
 let legs=0;for(let k=0;k<4;k++)if(/^(thigh|shin)[LR]$/.test(skin.skeleton.bones[a.skinIndex.getComponent(i,k)].name))legs+=a.skinWeight.getComponent(i,k);
 if(legs>.5)assert(skinPoints[i].y>w.hipHeight-.06,'Thighs and shins clear the cushion top');
}
for(let side=0;side<2;side++){
 const allowed=new RegExp('^(foot|toe|shin|heel\\d*)'+(side===0?'L':'R')+'$'),points=[];
 // The boot naturally surrounds its own ankle. Keep torso, thighs, hands and the opposite leg as obstacles.
 for(let i=0;i<idx.count;i+=3){let obstacle=false;for(let j=0;j<3;j++)for(let k=0;k<4;k++){const n=idx.getX(i+j);if(a.skinWeight.getComponent(n,k)>.5&&!allowed.test(skin.skeleton.bones[a.skinIndex.getComponent(n,k)].name))obstacle=true;}
  if(obstacle)for(let j=0;j<3;j++)points.push(skinPoints[idx.getX(i+j)]);}
 const target=surface(points);clearEdges(shoes[side],shoePoints[side],target);target.geometry.dispose();target.material.dispose();
}
for(const m of surfaces){m.geometry.dispose();m.material.dispose();}
const mount=new T.Group();w.figure.bones.get('spine.006').add(mount);w.hat={mount};step(sit);assert(mount.visible,'Sitting keeps the hat');
console.log('PASS real rig: crossed shins, tucked feet, upright pelvis, open palms, knee contacts, shoe clearance and hat');
for(const spot of cushions){
 const origin=spot.point.clone().setY(spot.height+.06-w.hipHeight);origin.z+=.04;
 w.holder.position.copy(origin);step(sit);
 assert(Math.abs(at('spine').y-spot.height-.06)<1e-5,'Hips rest at the cushion top on both dome and flat seats');
 for(const mesh of w.figure.asset.meshes.filter(m=>/^shoes/.test(m.name)))for(let i=0;i<mesh.geometry.attributes.position.count;i++)assert(mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).y>spot.height,'Every shoe clears the actual cushion top and rug');
 assert.equal(index.sitPoseAt(origin,w.hipHeight),'crossLegged');
 assert.equal(index.sitPoseAt(origin.clone().add(new T.Vector3(0,1,0)),w.hipHeight),null);
}
console.log('PASS hip contact and shoe clearance on all 13 transformed dome and flat cushions, without matching other levels');
// Use the real remote pose entry points with the existing sit state and the same seat lookup as main.
for(const Players of [RemotePlayers,AuthoringRemotes]){
 const players=new Players(scene,{sitPose:(p,h)=>index.sitPoseAt(p,h)});
 for(const spot of cushions){
 const r={walker:w,cur:{x:spot.point.x,y:spot.height+.06-w.hipHeight,z:spot.point.z+.04,yaw:0},tgt:{rest:'sit',grounded:true,stance:'stand',fur:0},rest:1,restKind:'sit',lastYaw:0,turnRate:0,speed:0,rise:0,distance:0};
 players.pose(r,1/60);assert.equal(w.sitPose,'crossLegged');
 for(const side of ['L','R'])assert(Math.abs(at('hand.'+side).x-at('shin.'+side).x)<.025,'Remote hands use the same corrected knee contacts');
 r.cur.x+=2;players.pose(r,1/60);assert.equal(w.sitPose,'passenger');
 }
}
assert.equal(crowdLoop({rest:'sit',sitPose:'crossLegged'}),'crossLegged');
assert.equal(crowdLoop({rest:'sit'}),'sit');
assert.equal(crowdLoop({rest:'tube',sitPose:'crossLegged'}),'sit');
console.log('PASS both remote renderers and the distant crowd select the cushion pose from the existing sit state');
w.holder.position.set(0,0,0);w.holder.rotation.set(0,0,0);step({...sit,sitPose:null});
assert.equal(w.sitPose,'passenger');assert(at('foot.L').y<at('shin.L').y-.1,'Ordinary seated legs still hang down');
step(null);assert.equal(w.sitPose,null);assert(at('foot.L').y<.3,'Standing restores the walking rig');
w.dispose();console.log('PASS ordinary seats and standing restore their original poses');
