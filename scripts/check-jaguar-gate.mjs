import '../src/model.js';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {createJaguarGate} from '../src/walk/jaguar-gate.js';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import layout from '../src/plan/selected-layout.js';
import {guideSchedule} from '../src/v2/wayfinding-guide-data.js';
import {COSMO_HEIGHT} from '../src/cosmo-pose.js';
import {FollowCamera} from '../src/walk/camera.js';

installWalkCanvas(createCanvas);
const {group,solid}=createJaguarGate(),bounds=new T.Box3().setFromObject(group,true);
let triangles=0;group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
console.log('Jaguar gate:',triangles,'triangles; bounds',bounds.min.toArray(),bounds.max.toArray());
assert(triangles<5000,'Keep the entire gate within a few thousand triangles');
const headBounds=new T.Box3().setFromObject(group.getObjectByName('Jaguar_head'),true);
assert(headBounds.max.y<28,'Head must stay below the Deck 17 ceiling');
const head=group.getObjectByName('Jaguar_head'),hp=head.geometry.attributes.position;
assert(head.material.every(m=>!m.flatShading),'The whole head must use smooth shading');
assert(head.geometry.groups[2].count>0&&head.geometry.groups[3].count>0,'The continuous skin includes the nose and hollow ear faces');
assert.equal(group.getObjectsByProperty('isLight',true).length,0,'Eyes and throat glow without real-time lights');
assert(Math.abs(group.position.x+112.5)<.001,'Gate stays on the existing doorway centre');
assert(group.position.distanceTo(new T.Vector3(-112.5,24.3,-26))<1e-9,'The doorway position stays fixed');
// Check the original mouth envelope independently of the new sculpting helper.
const M=14;
for(let i=0;i<=96;i++){
 const u=i/96,k=Math.min(u,1-u)/.3,sx=u<.5?-1:1;
 const x=k<1?sx*(1.05-.05*k):(u-.5)/.2;
 const y=k<1?1.95*k:1.95+.4*Math.max(0,1-Math.abs(x)**5)**.2;
 assert(Math.abs(hp.getX(i*M)-x)<1e-6&&Math.abs(hp.getY(i*M)-y)<1e-6,'Retain every original mouth width and height sample');
 for(let r=0;r<M;r++){const j=i*M+r,mirror=(96-i)*M+r;
  assert(Math.abs(hp.getX(j)+hp.getX(mirror))<1e-6&&hp.getY(j)===hp.getY(mirror)&&hp.getZ(j)===hp.getZ(mirror),'The sculpted skin must be exactly mirrored');
 }
}
assert(group.getObjectByName('Jaguar_eyes').material.emissiveIntensity>0,'Yellow eyes use an emissive material');
assert.equal(group.getObjectByName('Jaguar_neon_glow').material.emissive.getHex(),0xff7628,'Throat glow is warm orange');
const inverse=group.matrixWorld.clone().invert(),world=p=>new T.Vector3(...p).applyMatrix4(group.matrixWorld);
// The entrance plaque is now suppressed; the head and its sightlines stay intact.
const guide=guideSchedule(layout).find(r=>r.id==='commons-1');assert.equal(guide.plaque,false);
const scene=new T.Group();scene.add(group);scene.updateMatrixWorld(true);
const material=h=>Array.isArray(h.object.material)?h.object.material[h.face.materialIndex]:h.object.material;
const first=(from,to)=>new T.Raycaster(from,to.clone().sub(from).normalize()).intersectObject(scene,true).find(h=>!material(h).transparent);
const cameras=[[[-110.10,24.31,-21.57],-848,-8],[[-112.5,24.3,-18.5],180,0]].map(([at,yaw,pitch])=>{
 const camera=new T.PerspectiveCamera(62,1280/720,.05,1000),follow=new FollowCamera(camera,{raycast:()=>null});
 follow.mode=at[0]===-110.10?'third':'first';follow.yaw=yaw*Math.PI/180;follow.pitch=pitch*Math.PI/180;follow.update(0,new T.Vector3(...at),COSMO_HEIGHT);camera.updateMatrixWorld(true);return camera;
});
for(const camera of cameras){const from=camera.position;
 for(const side of [-1,1]){
  const eyes=group.getObjectByName('Jaguar_eyes'),ep=eyes.geometry.attributes.position;
  const id=Array.from(eyes.geometry.index.array).sort((a,b)=>Math.hypot(ep.getX(a)-side*1.22,ep.getY(a)-3.1)-Math.hypot(ep.getX(b)-side*1.22,ep.getY(b)-3.1))[0];
  const target=new T.Vector3().fromBufferAttribute(ep,id).applyMatrix4(eyes.matrixWorld),hit=first(from,target),screen=target.clone().project(camera);
  assert(hit&&/Jaguar_eye/.test(material(hit).name),'Both yellow eyes must remain visible from each capture');
  assert(Math.abs(screen.x)<.96&&screen.y<.84&&screen.y>-.95,'Keep both eyes inside the capture below the toolbar');
 }
 const pad=head.geometry.groups[2],index=head.geometry.index;
 const noseTargets=[];for(let i=pad.start;i<pad.start+pad.count;i+=3){const p=new T.Vector3();for(let j=0;j<3;j++)p.add(new T.Vector3().fromBufferAttribute(hp,index.getX(i+j)));noseTargets.push(p.multiplyScalar(1/3));}
 noseTargets.sort((a,b)=>Math.hypot(a.x,a.y-2.78)-Math.hypot(b.x,b.y-2.78));
 assert.equal(material(first(from,noseTargets[0].clone().applyMatrix4(head.matrixWorld))).name,'Jaguar_nose','The projecting nose must remain visible');
}
const col=new Colliders();col.addStatic(solid,()=>true);
const floor=new T.Mesh(new T.BoxGeometry(10,.2,16));floor.position.copy(world([0,-.1,0]));floor.updateMatrixWorld(true);col.addStatic(floor,()=>true);col.commit();
// Use the real standing capsule in both directions, including near both jambs.
for(const x of [-.55,0,.55]){
 const walker=new Controller(col);walker.place(world([x,0,3.4]));
 const step=direction=>{const wish=new T.Vector3(0,0,direction*2.25).transformDirection(group.matrixWorld).multiplyScalar(2.25);
  // The retained exit arch has a 5 cm bevel at its threshold.
  for(let i=0;i<210;i++){walker.step(1/60,wish,false);assert(Math.abs(walker.position.y-24.3)<.06,'Jaw must not lift or drop the walker: '+JSON.stringify({x,step:i,position:walker.position.toArray()}));}
 };
 step(-1);assert(walker.position.clone().applyMatrix4(inverse).z<-3.7,'Visitor must cross the mouth and throat into the lounge');
 step(1);assert(walker.position.clone().applyMatrix4(inverse).z>3.2,'Visitor must return through the mouth into the corridor');
}
console.log('PASS visible eyes and nose with entrance plaque removed, ceiling, triangle budget and three standing routes in both directions');
