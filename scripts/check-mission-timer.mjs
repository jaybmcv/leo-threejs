import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {contains} from '../src/plan/geometry-v2.js';
import {LOWER_AFT_AREAS,createLowerAftArea} from '../src/lower-aft.js';
import {applyRoomFitoutOverrides} from '../src/v2/room-fitout-overrides.js';
import {fitoutGeometry,material} from '../src/v2/phase4-mesh-kit.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {createMissionTimer,missionElapsed,MISSION_START} from '../src/walk/mission-timer.js';

assert.equal(MISSION_START,Date.parse('2026-10-22T23:00:00Z'));
assert.equal(MISSION_START,Date.parse('2026-10-22T18:00:00-05:00'));
assert.equal(MISSION_START,Date.parse('2026-10-22T19:00:00-04:00'));
for(const [offset,expected]of [[-1,[0,0,0,0]],[0,[0,0,0,0]],[999,[0,0,0,0]],[1000,[0,0,0,1]],[59999,[0,0,0,59]],[60000,[0,0,1,0]],[3600000,[0,1,0,0]],[86400000,[1,0,0,0]],[100*86400000+3661000,[100,1,1,1]]])assert.deepEqual(missionElapsed(MISSION_START+offset),expected);
assert.deepEqual(missionElapsed(Date.parse('2026-11-02T18:00:00-05:00')),[11,0,0,0],'DST must not shift elapsed time');

const id='d02-maintenance-aft',area=LOWER_AFT_AREAS.find(r=>r.id===id),room=layout.rooms.find(r=>r.id===id),root=new T.Group();
const legacy=createLowerAftArea(area);root.add(legacy.root);root.updateMatrixWorld(true);
assert(!root.getObjectByName('Removable_equipment'));assert(!root.getObjectByName('Equipment_cradle'));
assert(root.getObjectByName('Worktop'),'Keep the workshop benches');
const data=applyRoomFitoutOverrides({parts:[],rests:[],rooms:[]},layout),parts=data.parts.filter(p=>p.room===id),physical=new T.Group();
assert.equal(parts.length,8);
for(const p of parts){
 const mesh=new T.Mesh(fitoutGeometry(p),material(p.mat));mesh.position.set(...p.at);mesh.rotation.y=p.yaw;physical.add(mesh);
 for(const dx of [-1,1])for(const dz of [-1,1])assert(contains(room.polygon,[p.at[0]+dx*p.size[0]/2,p.at[2]+dz*p.size[2]/2]),'Fitting leaves the workshop');
}
const bounds=new T.Box3().setFromObject(physical,true),top=bounds.max.y-room.y;
assert(top<=3.35&&top>=3.3,'Keep the machine below the ceiling');
const rug=parts.find(p=>p.part==='mission_timer_rug'),base=parts.find(p=>p.part==='mission_timer_plinth');
assert(rug.size[0]>base.size[0]&&rug.size[2]>base.size[2]);assert(rug.noCollide,'Rug stays flush and walkable');
assert(Math.abs(base.at[0]-room.door.center[0])-base.size[0]/2>10,'Keep the entrance approach clear');
const housing=parts.find(p=>p.part==='mission_engine_housing');
assert(Math.abs(housing.at[0]-room.door.center[0])-housing.size[0]/2>50,'Engine stays on the wall opposite the v2 doorway');

installWalkCanvas(createCanvas);
const originalNow=Date.now;let now=MISSION_START+1000;Date.now=()=>now;
try{
 const timer=createMissionTimer({root},{still:true}),face=timer.group.getObjectByName('Mission_timer_readout'),near=timer.group.position.clone();
 const valve=timer.group.getObjectByName('Mission_engine_valve'),flow=timer.group.getObjectByName('Mission_engine_flow');
 const frozen=valve.rotation.z,positions=flow.instanceMatrix.array.slice();
 const digest=()=>createHash('sha256').update(face.material.map.image.getContext('2d').getImageData(0,0,2048,360).data).digest('hex');
 const first=digest();now+=1000;timer.update(.016,near);assert.notEqual(digest(),first,'Reduced motion still updates seconds');
 now+=86400000;timer.update(.016,near.clone().addScalar(200));const away=digest();
 timer.update(.016,near);assert.notEqual(digest(),away,'Returning catches up to wall time');
 assert.equal(valve.rotation.z,frozen);assert.deepEqual(flow.instanceMatrix.array,positions,'Reduced motion freezes engine flow');
 const normal=new T.Vector3(0,0,1).applyQuaternion(face.quaternion);assert(normal.x*room.door.outward[0]>.99,'Display faces the main entrance');
 assert(timer.group.getObjectByName('Mission_timer_forward_readout'),'Keep the original approach readable too');
 const animated=createMissionTimer({root}),before=animated.group.children.map(o=>o.rotation.y);
 animated.update(.1,near);animated.group.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));});
 const engine=animated.group.getObjectByName('Mission_timer_engine'),wheel=engine.getObjectByName('Mission_engine_valve');
 assert(Math.abs(wheel.rotation.z)>0&&Math.abs(wheel.rotation.z)<=.045,'Valve movement is subtle');
 const paused=wheel.rotation.z;animated.update(.1,near.clone().addScalar(200));assert.equal(wheel.rotation.z,paused,'Engine pauses away from the room');
 let draws=0,triangles=0;
 engine.traverse(o=>{if(!o.isMesh)return;draws++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
 assert(draws<=16&&triangles<16000,'Bound engine geometry and draw calls');
 const localBounds=new T.Box3().setFromObject(engine,true);localBounds.translate(near.clone().negate());
 assert(localBounds.min.y>=.3&&localBounds.max.y<3.3,'Engine dressing stays below the ceiling');
 const hoses=engine.getObjectByName('Mission_engine_feeds').children;assert(hoses.length);
 for(const hose of hoses){const p=hose.geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getX(i)>1&&p.getX(i)<26)assert(p.getY(i)>2.9,'Feed hoses keep full walking headroom');}
 assert(animated.group.children.some((o,i)=>o.rotation.y!==before[i]||o.children.some(c=>c.rotation.y!==0)),'Holograms animate');
}finally{Date.now=originalNow;}
console.log('PASS: mission clock, engine motion/reduced motion/culling, geometry budget, overhead feeds, footprint, ceiling and entrance clearance');
