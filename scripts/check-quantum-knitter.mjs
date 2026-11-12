import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {contains} from '../src/plan/geometry-v2.js';
import {LOWER_AFT_AREAS,createLowerAftArea} from '../src/lower-aft.js';
import {applyRoomFitoutOverrides} from '../src/v2/room-fitout-overrides.js';
import {createQuantumKnitter,KNITTER_REACH,KNITTER_TOP,BALL_Y} from '../src/walk/quantum-knitter.js';

const id='d02-maintenance-aft',area=LOWER_AFT_AREAS.find(r=>r.id===id),room=layout.rooms.find(r=>r.id===id);
const data=applyRoomFitoutOverrides({parts:[],rests:[],rooms:[]},layout),parts=data.parts.filter(p=>p.room===id);
const plinth=parts.find(p=>p.part==='knitter_plinth');
assert(plinth&&!plinth.noCollide,'The knitter stands on a solid plinth');
const [px,py,pz]=plinth.at,floor=room.y;
assert(Math.abs(py-floor-plinth.size[1]/2)<1e-6,'The plinth sits on the floor');
assert(plinth.size[1]>=.5,'The plinth is taller than a step');

// Footprint: the plinth plus the arms' full reach, against the room's walls, benches, door and the other fittings.
const foot={minX:px-KNITTER_REACH,maxX:px+KNITTER_REACH,minZ:pz-KNITTER_REACH,maxZ:pz+KNITTER_REACH};
for(const dx of [-1,1])for(const dz of [-1,1])assert(contains(room.polygon,[px+dx*KNITTER_REACH,pz+dz*KNITTER_REACH]),'Footprint leaves the workshop');
const wallX=-213.84,wallZ=17.84;
assert(foot.minX>wallX+.4&&foot.maxZ<wallZ+.0,'Footprint stays off the aft bulkhead and side wall');
const legacy=createLowerAftArea(area),root=new T.Group();root.add(legacy.root);root.updateMatrixWorld(true);
const others=[];
root.traverse(o=>{if(!o.isMesh||/^(Finished_floor|Aisle_inlay|Aft_link_floor|Ceiling|Ceiling_light|Aft_link_ceiling|Refined_wall_trim|Service_wayfinding)$/.test(o.name))return;others.push([o.name,new T.Box3().setFromObject(o)]);});
for(const p of parts)if(p!==plinth&&!p.noCollide)others.push([p.part,new T.Box3(new T.Vector3(p.at[0]-p.size[0]/2,p.at[1]-p.size[1]/2,p.at[2]-p.size[2]/2),new T.Vector3(p.at[0]+p.size[0]/2,p.at[1]+p.size[1]/2,p.at[2]+p.size[2]/2))]);
for(const [name,b] of others){
 if(/^(Aft_bulkhead|Side_wall|Entry_wall|Entry_header|Aft_link_wall)$/.test(name))continue;
 const near=b.min.x<foot.maxX+.5&&b.max.x>foot.minX-.5&&b.min.z<foot.maxZ+.5&&b.max.z>foot.minZ-.5;
 assert(!near,name+' sits within half a metre of the knitter footprint');
}
const door=room.door.center;assert(Math.hypot(door[0]-px,door[2]-pz)>14,'The doorway stays well clear');
assert(Math.abs(pz)-KNITTER_REACH>2.73+10,'The central aisle stays clear');

// The machine: draws, triangles, reach and ceiling over a full weave cycle.
const parent=new T.Group(),knitter=createQuantumKnitter(parent,[px-room.frame.origin[0],pz-room.frame.origin[2]]);
const draws=[],names=new Set();let triangles=0;
knitter.group.traverse(o=>{if(!o.isMesh)return;draws.push(o);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
assert(draws.length<=14,'Draw calls: '+draws.length);assert(triangles<9000,'Triangles: '+triangles);
const links=knitter.group.getObjectByName('Knitter_links'),joints=knitter.group.getObjectByName('Knitter_joints'),threads=knitter.group.getObjectByName('Knitter_threads');
const pos=new T.Vector3(),m=new T.Matrix4(),tipAt=[],before=[];
const joint=(mesh,i)=>{mesh.getMatrixAt(i,m);return pos.setFromMatrixPosition(m).clone();};
let worstReach=0,lowest=9,highest=0,moved=0,minThreadGap=9;
const first=Array.from({length:12},(_,i)=>joint(joints,i));
for(let t=0;t<40;t+=.07){
 knitter.update(t);
 for(let i=0;i<12;i++){
  const p=joint(joints,i);assert([p.x,p.y,p.z].every(Number.isFinite));
  worstReach=Math.max(worstReach,Math.hypot(p.x,p.z)+(i%3===0?.09:i%3===1?.08:.06));lowest=Math.min(lowest,p.y);highest=Math.max(highest,p.y);
  if(p.distanceTo(first[i])>.3)moved|=1<<i;
 }
 // Each thread runs from its arm's tip to the ball, in two joined pieces.
 for(let a=0;a<4;a++){
  const tip=joint(joints,a*3+2);threads.getMatrixAt(a*2,m);
  const mid=pos.setFromMatrixPosition(m).clone(),ball=new T.Vector3(0,BALL_Y,0);
  assert(mid.distanceTo(ball)<.8&&mid.distanceTo(tip)<.55,'Thread mid stays between its tip and the ball');
  minThreadGap=Math.min(minThreadGap,tip.distanceTo(ball));
  assert(tip.distanceTo(ball)>.5&&tip.distanceTo(ball)<.85,'Arm tips work around the ball');
 }
}
assert(worstReach<=KNITTER_REACH,'Reach '+worstReach.toFixed(3)+' m exceeds '+KNITTER_REACH);
assert(lowest>1.4,'Arms stay above head height of the plinth edge: '+lowest.toFixed(2));
assert(BALL_Y+.4<3.3,'Ball stays under the 3.3 m ceiling');assert(highest<3.2);
for(let i=0;i<12;i++)assert.equal(!!(moved&(1<<i)),i%3!==0,'Elbows and wrists move, shoulders turn on the hub: '+i);
// Spin check: the ball's ring sets turn.
const spins=knitter.group.children.filter(o=>o.name==='Knitter_ring_set');assert.equal(spins.length,3);
knitter.update(0);const r0=spins.map(o=>o.rotation.y);knitter.update(5);assert(spins.every((o,i)=>Math.abs(o.rotation.y-r0[i])>.5),'The ball turns');
console.log('PASS: knitter footprint '+foot.minX.toFixed(2)+'..'+foot.maxX.toFixed(2)+' x '+foot.minZ.toFixed(2)+'..'+foot.maxZ.toFixed(2)+', measured reach '+worstReach.toFixed(3)+' m, joints y '+lowest.toFixed(2)+'..'+highest.toFixed(2)+' above the floor, '+draws.length+' draws, '+Math.round(triangles)+' triangles');
