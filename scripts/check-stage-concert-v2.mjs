import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {contains} from '../src/plan/geometry-v2.js';
import {addAtriumStage,stageGeometry} from '../src/v2/atrium-stage.js';
import {stageConcertParts,stageConcertFixtures,stageConcertGeometry,addStageConcertDecor} from '../src/v2/stage-concert.js';
import {createStageBeams,stageBeamSources,stageBeamAim} from '../src/v2/stage-beams.js';
import {setAtriumView} from '../src/v2/atrium-visibility.js';
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

// Runtime beams share the authored lenses and add only three unlit, noncolliding draws.
const effects=new T.Scene(),beams=createStageBeams(effects,y),sources=stageBeamSources();
const front=sources.filter(f=>f.row==='front'),back=sources.filter(f=>f.row==='back');
const [cones,pools,lasers]=beams.group.children,matrix=new T.Matrix4(),point=new T.Vector3(),direction=new T.Vector3();
assert.equal(effects.children.length,1);assert.equal(beams.group.children.length,3);
assert.equal(cones.count,back.length);assert.equal(pools.count,back.length);assert.equal(lasers.count,front.length*5);
assert(back.length>=9&&front.length>=9);
effects.traverse(o=>{assert(!o.isLight);if(o.isMesh){assert(o.isInstancedMesh&&o.userData.noCollide);assert(o.material.isShaderMaterial&&o.material.forceSinglePass);assert.equal(o.material.blending,T.AdditiveBlending);assert.equal(o.material.depthWrite,false);assert.equal(o.material.toneMapped,false);assert(!o.castShadow&&!o.receiveShadow);}});
for(const f of sources){
 const fixture=fixtures.find(v=>v.id===f.id);assert(fixture,'Every beam has an existing fixture');
 assert.deepEqual(f.at,fixture.at);assert(Math.abs(f.origin[0]-(fixture.at[0]-.24*Math.sin(fixture.tilt)))<1e-9);assert(Math.abs(f.origin[2]-fixture.at[2])<1e-9);
 assert(Math.abs(f.origin[1]-(fixture.at[1]-.24*Math.cos(fixture.tilt)))<.02,'Beam starts on the lens face');
}
back.forEach((f,i)=>{
 cones.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert(point.distanceTo(new T.Vector3(...f.origin))<1e-5);
 direction.set(0,1,0).transformDirection(matrix);assert(direction.distanceTo(new T.Vector3(0,-1,0))<1e-6,'Rear cones point straight down');
 cones.geometry.computeBoundingBox();point.set(0,cones.geometry.boundingBox.max.y,0).applyMatrix4(matrix);assert(Math.abs(point.y-.36)<1e-5,'Rear cone reaches the stage floor');
 pools.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert(Math.abs(point.y-.378)<1e-5);assert(Math.abs(point.x-f.origin[0])<1e-5&&Math.abs(point.z-f.origin[2])<1e-5,'Pool sits under its cone');
});
const camera=new T.PerspectiveCamera(60,16/9,.1,300),audience=new T.Vector3(98.71,y+.24,29.92);
setAtriumView(audience);camera.position.copy(audience).add(new T.Vector3(0,1.63,0));camera.lookAt(113,y+2,30);camera.updateMatrixWorld(true);
beams.update(camera,0);assert(beams.group.visible,'Always visible from the seating in the open atrium');
const rearBefore=cones.instanceMatrix.array.slice(),poolsBefore=pools.instanceMatrix.array.slice(),frontBefore=lasers.instanceMatrix.array.slice();
beams.update(camera,4);assert.notDeepEqual(lasers.instanceMatrix.array,frontBefore,'Front aims change with time');
assert.deepEqual(cones.instanceMatrix.array,rearBefore,'Rear cones never move');assert.deepEqual(pools.instanceMatrix.array,poolsBefore,'Rear pools never move');
assert.equal(lasers.material.uniforms.time.value,4);assert.equal(cones.material.uniforms.time,pools.material.uniforms.time,'Cones and their pools change colour together');
const fullAtFour=lasers.instanceMatrix.array.slice();
beams.update(camera,4,true);assert.equal(lasers.count,front.length*3);
assert.deepEqual(lasers.instanceMatrix.array.slice(0,lasers.count*16),fullAtFour.slice(0,lasers.count*16),'Reduced fans keep the centre and both edges');
assert.deepEqual(cones.instanceMatrix.array,rearBefore);assert.deepEqual(pools.instanceMatrix.array,poolsBefore);
beams.update(camera,4);assert.equal(lasers.count,front.length*5);
lasers.geometry.computeBoundingBox();const length=lasers.geometry.boundingBox.max.y;assert(length<=18.01,'Outward beams end near the seating');
assert(lasers.geometry.boundingBox.max.x<=.021,'Keep the outward lasers thin');
const turns=[0,-.1,.1,-.05,.05],up=new T.Vector3(0,1,0),phase=lasers.geometry.getAttribute('beamPhase');
for(let t=0;t<=120;t+=.5){
 beams.update(camera,t);
 front.forEach((f,i)=>{
  const aim=stageBeamAim(t,i),origin=new T.Vector3(...f.origin);
  assert(aim.distanceTo(stageBeamAim(t,i+1))+stageBeamAim(t+4,i).distanceTo(stageBeamAim(t+4,i+1))>.05,'Neighbours sweep out of phase, crossing only briefly');
  assert(aim.distanceTo(stageBeamAim(t+.01,i))<.002,'Motion stays smooth');
  turns.forEach((angle,j)=>{
   const n=j*front.length+i;lasers.getMatrixAt(n,matrix);point.setFromMatrixPosition(matrix);
   assert(point.distanceTo(origin)<1e-5,'All five beams start at the fixture lens');
   assert.equal(phase.getX(n),Math.fround(i*.37),'All rays preserve the fixture colour phase');
   const ray=direction.set(0,1,0).transformDirection(matrix);
   assert(ray.distanceTo(aim.clone().applyAxisAngle(up,angle))<1e-6,'Fan angles stay fixed around the original sweep');
   assert(ray.x<-.85&&ray.y<0,'Front beams point out towards the audience below the upper decks');assert(Math.abs(ray.length()-1)<1e-6);
   const end=point.addScaledVector(ray,length);assert(end.y>3&&end.y<4,'Beam stays above the seating camera eye line and below Deck 7');
   assert(contains(layout.decks[5].atrium.outline,[end.x,end.z]),'Finite fan stays inside the atrium');
  });
 });
}
camera.lookAt(0,camera.position.y,30);camera.updateMatrixWorld(true);beams.update(camera,5);assert(!beams.group.visible,'Hide the offscreen stage');
camera.position.set(-100,y+2,30);camera.lookAt(113,y+2,30);camera.updateMatrixWorld(true);beams.update(camera,6);assert(!beams.group.visible,'Hide distant beams');
setAtriumView(new T.Vector3(0,y-4,0));camera.position.set(98.71,y+2,29.92);camera.lookAt(113,y+2,30);camera.updateMatrixWorld(true);beams.update(camera,7);assert(!beams.group.visible,'Follow the atrium visibility gate');

// The actual solid factory feeds the walk's capsule solver, including both independently batched side islands.
const root=new T.Group(),mat=new T.MeshBasicMaterial(),floor=new T.Mesh(new T.BoxGeometry(60,.2,50),mat);floor.position.set(95,y-.1,30);root.add(floor);
assert.equal(new Set(parts.filter(p=>p.stageShape?.kind==='concert').map(p=>p.part)).size,2,'Both side shapes retain their own instance batch');
for(const p of parts.filter(p=>!p.noCollide)){
 const mesh=new T.Mesh(stageGeometry(p)||new T.BoxGeometry(...p.size),mat);mesh.name=p.part;mesh.position.set(...p.at);root.add(mesh);
}
const col=new Colliders();col.addStatic(root);col.commit();const cat=new Controller(col),step=(seconds,x=0,z=0)=>{for(let i=0;i<Math.round(seconds*120);i++)cat.step(1/120,new T.Vector3(x,0,z));};
// Adding the visual effect must never add collision, even while it is visible.
beams.group.visible=true;effects.updateMatrixWorld(true);assert.equal(col.addStatic(effects),0);col.commit();
cat.place(audience);step(.2);const suppliedYaw=88*Math.PI/180;
step(8,2.25*Math.sin(suppliedYaw),2.25*Math.cos(suppliedYaw));assert(cat.position.x>116&&cat.grounded,'Walk from the supplied seating spot across the stage under the beams');assert(Math.abs(cat.position.y-y-.36)<.02);
step(8,-2.25*Math.sin(suppliedYaw),-2.25*Math.cos(suppliedYaw));assert(Math.abs(cat.position.x-audience.x)<.4&&cat.grounded,'Return to the seating without getting stuck');
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
beams.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
console.log(JSON.stringify({status:'PASS',fixtures:fixtures.length,beams:{back:back.length,front:front.length*5,reducedFront:front.length*3,draws:3},triangles,bounds:[bounds.min.toArray(),bounds.max.toArray()],sideStops:stops,walk:'supplied seating to stage and back; audience to back wall and out; both side stacks block and release the cat'}));
