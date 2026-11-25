import assert from 'node:assert/strict';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {glossLoungeFloor,quietFloorReflections} from '../src/walk/lounge-floor.js';
import {finishLoungeEnvelopeFloor} from '../src/v2/community-finishes.js';
import {checkOwnedFloorFinish} from './phase4-floor-fixture.mjs';
import {createHydroNipLounge,LOUNGE} from '../src/hydro-nip-lounge.js';
import {bakeForWalking} from '../src/walk/render-bake.js';
import {bakeForWalking as authoringBake} from '../src/walk/render-bake.authoring.js';

installWalkCanvas(createCanvas);checkOwnedFloorFinish(glossLoungeFloor);
const inside=new T.Group(),ship={inside};inside.userData.room='commons-1';
for(const y of [24.3,28.3,32.3]){
 const o=new T.Mesh(new T.BoxGeometry(4,.12,4));o.name=y===24.3?'V2_room_floor':'V2_garden_gallery';o.position.y=y-.06;inside.add(o);
}
const rug=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial()),rugMaterial=rug.material;rug.name='Lounge_rug';inside.add(rug);
const result=glossLoungeFloor(ship);assert.equal(result.floors,3);assert.equal(rug.material,rugMaterial,'Patterned rugs keep their material');
assert.equal(glossLoungeFloor(ship).material,result.material);
const envelope=new T.Mesh(new T.BoxGeometry(4,.12,4));finishLoungeEnvelopeFloor(ship,envelope,'commons-1');assert.equal(envelope.material,result.material,'Hull-side main floor uses the same carpet');
const atrium=envelope.clone();atrium.material=rugMaterial;finishLoungeEnvelopeFloor(ship,atrium,'commons-2');assert.equal(atrium.material,rugMaterial,'Other rooms stay untouched');
const environment=new T.Texture();quietFloorReflections(inside,environment);assert.equal(result.material.envMapIntensity,.35);assert.equal(result.material.envMap,environment);result.material.envMap=null;
for(const bake of [bakeForWalking,authoringBake]){
 const root=new T.Group();root.add(envelope.clone());const baked=bake(root),materials=[];
 for(const band of baked.bands.values())band.traverse(o=>{if(o.isMesh)materials.push(o.material);});
 const carpet=materials.find(m=>m.name==='Lounge_velvet_carpet');assert(carpet?.isMeshPhysicalMaterial&&carpet.sheen>0&&carpet.bumpMap,'Walk bake preserves the velvet material and pile');
 const json=carpet.toJSON();assert.equal(json.type,'MeshPhysicalMaterial');assert.equal(json.sheen,carpet.sheen);assert.equal(json.sheenRoughness,carpet.sheenRoughness);assert(json.bumpMap&&json.map&&!json.emissiveMap,'Prepared material stores pile without neon artwork');
}
const dome=createHydroNipLounge(),{DOME,FLOOR}=LOUNGE;
// No additive plane may cover the carpet inside the dome.
dome.traverse(o=>{
 if(!o.isMesh||o.material?.name!=='Lounge_additive_glow')return;
 const p=o.geometry.attributes.position,ix=o.geometry.index;
 for(let i=0,n=ix?ix.count:p.count;i<n;i+=3){
  const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k));
  const c=v[0].clone().add(v[1]).add(v[2]).divideScalar(3);
  assert(!(v.every(q=>Math.abs(q.y-FLOOR-.03)<.001)&&Math.hypot(c.x-DOME.x,c.z-DOME.z)<DOME.r),'Dome floor glow must not cover the velvet');
 }
});
console.log('PASS: nonemissive velvet on main/envelope floors and both galleries; pile and sheen survive both walk bakes; dome floor glow removed; rugs and other rooms preserved');
await import('./check-lounge-walkway-v2.mjs');
