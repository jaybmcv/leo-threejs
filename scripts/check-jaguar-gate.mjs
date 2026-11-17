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
assert(hp.getY(48*14+10)>3.4,'The skull dome must rise above the brow between the ears');
assert.equal(head.material[1].emissive.getHex(),0xff7628,'The inner mouth emits warm orange');
assert(head.material[1].emissiveIntensity>=.7&&!head.material[1].toneMapped,'The lining must visibly glow without relying on hidden roof tubes');
const glow=head.material[1].emissiveMap,depthUV=head.geometry.attributes.uv1;
assert(glow&&glow.channel===1&&depthUV,'The mouth glow uses a separate depth UV');
const glowAt=u=>glow.image.data[Math.round(u*(glow.image.width-1))*4]/255;
assert(glowAt(1)>.9&&glowAt(0)<.04&&glowAt(.5)<.06,'Orange fades from a bright lip to a dark throat instead of a flat panel');
assert(group.getObjectByName('Jaguar_neon_wash_glow').material.opacity<.2,'Throat accents must preserve the view into the lounge');
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
 assert(depthUV.getX(i*M)===1&&depthUV.getX(i*M+12)===0&&depthUV.getX(i*M+13)===.5,'The glow must fade along the inner wall depth');
 for(let r=0;r<M;r++){const j=i*M+r,mirror=(96-i)*M+r;
  assert(Math.abs(hp.getX(j)+hp.getX(mirror))<1e-6&&hp.getY(j)===hp.getY(mirror)&&hp.getZ(j)===hp.getZ(mirror),'The sculpted skin must be exactly mirrored');
 }
}
const eyes=group.getObjectByName('Jaguar_eyes');
assert(eyes.material[0].emissiveIntensity>0,'Yellow eyes use an emissive material');
assert(eyes.geometry.groups[1].count>0,'Both inset eyes include dark pupils');
const eyePoints=Array.from(eyes.geometry.index.array).map(i=>new T.Vector3().fromBufferAttribute(eyes.geometry.attributes.position,i));
for(const side of [-1,1]){
 const box=new T.Box3().setFromPoints(eyePoints.filter(p=>p.x*side>0)),size=box.getSize(new T.Vector3());
 assert(size.x>.5&&size.x<.6&&size.y>.2&&size.y<.3,'Eyes retain their almond proportions');
 assert(box.max.y<3.18&&box.min.y>2.82,'Eyes sit on the face below the ears');
}
assert(hp.getY(48*M+10)>3.4,'The skull has a full central dome above the muzzle');
assert(head.material[0].emissiveIntensity<.04,'The outer head stays dark obsidian');
assert.equal(group.getObjectByName('Jaguar_neon_glow').material.emissive.getHex(),0xff7628,'Throat glow is warm orange');
const inverse=group.matrixWorld.clone().invert(),world=p=>new T.Vector3(...p).applyMatrix4(group.matrixWorld);
// The entrance plaque is now suppressed; the head and its sightlines stay intact.
const guide=guideSchedule(layout).find(r=>r.id==='commons-1');assert.equal(guide.plaque,false);
const scene=new T.Group();scene.add(group);scene.updateMatrixWorld(true);
const material=h=>Array.isArray(h.object.material)?h.object.material[h.face.materialIndex]:h.object.material;
const first=(from,to)=>new T.Raycaster(from,to.clone().sub(from).normalize()).intersectObject(scene,true).find(h=>!material(h).transparent);
const cameras=[[[-110.10,24.31,-21.57],-848,-8],[[-112.5,24.3,-17.3],180,0],[[-108.34,24.31,-19.62],226,0]].map(([at,yaw,pitch])=>{
 const camera=new T.PerspectiveCamera(62,1280/720,.05,1000),follow=new FollowCamera(camera,{raycast:()=>null});
 follow.mode=at[0]===-110.10?'third':'first';follow.yaw=yaw*Math.PI/180;follow.pitch=pitch*Math.PI/180;follow.update(0,new T.Vector3(...at),COSMO_HEIGHT);camera.updateMatrixWorld(true);return camera;
});
for(const camera of cameras){const from=camera.position;
 for(const side of [-1,1]){
  const ep=eyes.geometry.attributes.position,iris=eyes.geometry.groups[0];
  const id=Array.from(eyes.geometry.index.array.slice(iris.start,iris.start+iris.count)).sort((a,b)=>Math.hypot(ep.getX(a)-side*1.3,ep.getY(a)-3)-Math.hypot(ep.getX(b)-side*1.3,ep.getY(b)-3))[0];
  const target=new T.Vector3().fromBufferAttribute(ep,id).applyMatrix4(eyes.matrixWorld),hit=first(from,target),screen=target.clone().project(camera);
  assert(hit&&/Jaguar_eye/.test(material(hit).name),'Both yellow eyes must remain visible from each capture: '+JSON.stringify({from:from.toArray(),side,hit:hit&&material(hit).name,target:target.toArray()}));
  assert(Math.abs(screen.x)<.96&&screen.y<.84&&screen.y>-.95,'Keep both eyes inside the capture below the toolbar');
 }
 const pad=head.geometry.groups[2],index=head.geometry.index;
 const noseTargets=[];for(let i=pad.start;i<pad.start+pad.count;i+=3){const p=new T.Vector3();for(let j=0;j<3;j++)p.add(new T.Vector3().fromBufferAttribute(hp,index.getX(i+j)));noseTargets.push(p.multiplyScalar(1/3));}
 noseTargets.sort((a,b)=>Math.hypot(a.x,a.y-2.78)-Math.hypot(b.x,b.y-2.78));
 assert.equal(material(first(from,noseTargets[0].clone().applyMatrix4(head.matrixWorld))).name,'Jaguar_nose','The projecting nose must remain visible');
 // Visible lining must cover an area inside the arch, rather than just a hidden orange tube.
 const lining=head.geometry.groups[1];let area=0;
 for(let i=lining.start;i<lining.start+lining.count;i+=3){
  const points=Array.from({length:3},(_,j)=>new T.Vector3().fromBufferAttribute(hp,index.getX(i+j)).applyMatrix4(head.matrixWorld));
  const target=points.reduce((p,v)=>p.add(v),new T.Vector3()).multiplyScalar(1/3),hit=first(from,target),screen=target.clone().project(camera);
  if(!hit||material(hit)!==head.material[1]||glowAt(hit.uv1.x)<.1||Math.abs(screen.x)>.96||Math.abs(screen.y)>.95||screen.z< -1||screen.z>1)continue;
  const [a,b,c]=points.map(p=>p.project(camera));area+=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*1280*720/8;
 }
 assert(area>100,'The orange inner mouth must be exposed in each proof view: '+area+' square pixels');
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
console.log('PASS visible eyes, nose and orange lining, ceiling, triangle budget and three standing routes in both directions');
