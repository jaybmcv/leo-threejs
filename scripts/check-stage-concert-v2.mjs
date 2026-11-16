import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {contains} from '../src/plan/geometry-v2.js';
import {addAtriumStage,stageGeometry} from '../src/v2/atrium-stage.js';
import {stageConcertParts,stageConcertFixtures,stageConcertGeometry,addStageConcertDecor} from '../src/v2/stage-concert.js';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';

const y=layout.decks[5].y,parts=[],rests=[];addAtriumStage({parts,rests,y});
assert.deepEqual(parts.find(p=>p.part==='p6_stage_platform').size,[14,.36,32]);
assert.deepEqual(parts.find(p=>p.part==='p6_stage_platform').at,[113,y+.18,30]);
assert.deepEqual(parts.find(p=>p.part==='p6_stage_backdrop').at,[119.86,y+1.91,30]);
const dressing=stageConcertParts(),bounds=new T.Box3();let triangles=0;
for(const p of dressing){
 const g=stageConcertGeometry(p),v=g.attributes.position;g.computeBoundingBox();bounds.union(g.boundingBox);triangles+=g.index.count/3;
 for(let i=0;i<v.count;i++){
  const x=v.getX(i),h=v.getY(i),z=v.getZ(i);assert([x,h,z].every(Number.isFinite));
  assert(x>=106-1e-5&&x<=120+1e-5&&z>=14-1e-5&&z<=46+1e-5,'Dressing leaves the platform');
  for(const d of layout.decks.filter(d=>d.number>=7&&d.y<=y+h+.4))assert(contains(d.atrium.outline,[x,z]),'Dressing crosses a balcony');
 }
 if(p.solid)assert(g.boundingBox.max.z<=18.801||g.boundingBox.min.z>=41.199,'Solid intrudes into the middle of the stage');
 g.dispose();
}
assert(bounds.max.y-.36<=6);assert(triangles<15000,'Keep the repeated static dressing inexpensive');
const fixtures=stageConcertFixtures();assert.equal(fixtures.length,54);assert.equal(new Set(fixtures.map(f=>f.id)).size,54);
assert(fixtures.every(f=>f.at[1]-.35>.36+2&&f.direction[1]<-.9));
// Keep the existing sign readable from both the supplied upper view and the seating floor.
const sightMat=new T.MeshBasicMaterial({side:T.DoubleSide}),sightMeshes=dressing.map(p=>new T.Mesh(stageConcertGeometry(p).translate(0,y,0),sightMat));
for(const floor of[-11.7,y+.24])for(const z of[26,28,30,32,34]){
 const eye=new T.Vector3(88.57,floor+1.75*.93,36.91),end=new T.Vector3(119.66,y+2.96,z),delta=end.clone().sub(eye),ray=new T.Raycaster(eye,delta.clone().normalize(),0,delta.length());
 assert.equal(ray.intersectObjects(sightMeshes).length,0,'Dressing obscures the back wall sign');
}
sightMeshes.forEach(o=>o.geometry.dispose());sightMat.dispose();
const rendered=[];addStageConcertDecor(rendered,y);
for(const g of rendered){assert.equal(g.attributes.color.count,g.attributes.position.count);assert(!g.index);g.dispose();}

// The actual solid factory feeds the walk's capsule solver, including both independently batched side islands.
const root=new T.Group(),mat=new T.MeshBasicMaterial(),floor=new T.Mesh(new T.BoxGeometry(60,.2,50),mat);floor.position.set(95,y-.1,30);root.add(floor);
assert.equal(new Set(parts.filter(p=>p.stageShape?.kind==='concert').map(p=>p.part)).size,2,'Both side shapes retain their own instance batch');
for(const p of parts.filter(p=>!p.noCollide)){
 const mesh=new T.Mesh(stageGeometry(p)||new T.BoxGeometry(...p.size),mat);mesh.name=p.part;mesh.position.set(...p.at);root.add(mesh);
}
const col=new Colliders();col.addStatic(root);col.commit();const cat=new Controller(col),step=(seconds,x=0,z=0)=>{for(let i=0;i<Math.round(seconds*120);i++)cat.step(1/120,new T.Vector3(x,0,z));};
cat.place(new T.Vector3(88.57,y+.24,36.91));step(.2);assert(cat.grounded);
const angle=103*Math.PI/180;step(13.7,2.25*Math.sin(angle),2.25*Math.cos(angle));
assert(cat.position.x>117.5&&cat.position.x<119.7,'Reach the back wall through the middle');assert(Math.abs(cat.position.y-y-.36)<.02);
step(8,-2.25);assert(cat.position.x<105.5&&cat.grounded,'Walk off the stage to the seating');
const stops=[];
for(const side of[-1,1]){
 cat.place(new T.Vector3(113,y+.36,30));step(7,0,side*2.25);
 const edge=side<0?19.15:40.85;assert(Math.abs(cat.position.z-edge)<.07,'Stop against the side gear');
 const stopped=cat.position.clone();step(1,0,side*2.25);assert(cat.position.distanceTo(stopped)<.03,'Cannot pass through the gear');stops.push(stopped.toArray());
 step(4.8,0,-side*2.25);assert(Math.abs(cat.position.z-30)<.5,'Return from the gear to the middle');
 step(4,-2.25);assert(cat.position.x<105.5&&cat.grounded,'Leave the front without getting trapped');
 // The corner pillars are solid above the cases, where their angled arms are exposed.
 const z=30+side*14.5,ray=new T.Ray(new T.Vector3(105,y+3,z),new T.Vector3(1,0,0));assert(col.raycast(ray,5),'Corner pillar has a collider');
}
console.log(JSON.stringify({status:'PASS',fixtures:fixtures.length,triangles,bounds:[bounds.min.toArray(),bounds.max.toArray()],sideStops:stops,walk:'audience to back wall and out; both side stacks block and release the cat'}));
