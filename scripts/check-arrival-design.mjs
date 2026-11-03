import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {finishArrivalDesign,arrivalEnvelopeMaterial} from '../src/v2/arrival-design.js';
import {polygonGeometry} from '../src/v2/geometry.js';

installWalkCanvas(createCanvas);
const root=new T.Group(),inside=new T.Group();root.add(inside);
const hall=new T.Group();hall.name='Area_d02-arrival-1';inside.add(hall);
const shell=new T.Group();shell.name='V2_shell_d02-arrival-1';inside.add(shell);
const shared=new T.MeshStandardMaterial({name:'V2_lining',color:0xabcdef});
for(const name of ['V2_room_floor','V2_room_ceiling','V2_wall']){const o=new T.Mesh(new T.BoxGeometry(1,1,1),shared);o.name=name;shell.add(o);}
for(const [name,mat]of [['Atrium_curved_seat','Atrium_cream'],['Atrium_curved_back','Atrium_sage'],['Atrium_seat_base','Atrium_wood'],['Atrium_ceiling_seam','Atrium_ceiling_slat']]){const o=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({name:mat}));o.name=name;hall.add(o);}
hall.children.at(-1).material.side=T.DoubleSide;
const lounge=new T.Mesh(new T.BoxGeometry(),shared),exterior=new T.Mesh(new T.BoxGeometry(),shared);inside.add(lounge);root.add(exterior);
const before=hall.children.map(o=>({o,g:o.geometry,p:Array.from(o.geometry.attributes.position.array)}));
const report=finishArrivalDesign({root,inside});
assert.equal(report.materials,7);assert.equal(report.trimMeshes,4);
assert.equal(shared.color.getHex(),0xabcdef);assert.equal(lounge.material,shared);assert.equal(exterior.material,shared);
assert.equal(hall.getObjectByName('Atrium_ceiling_seam').material.side,T.DoubleSide);
assert.equal(hall.getObjectByName('Atrium_seat_base').material.name,'Arrival_Retro_warm_porcelain');
for(const {o,g,p}of before){assert.equal(o.geometry,g);assert.deepEqual(Array.from(o.geometry.attributes.position.array),p);}
const trim=hall.getObjectByName('Arrival_Retro_visual_trim');let triangles=0;trim.traverse(o=>{if(o.isMesh){assert.equal(o.userData.noCollide,true);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
assert.equal(finishArrivalDesign({root,inside}),null);
console.log('PASS Arrival material isolation, original seat geometry, idempotence; decorative triangles:',triangles);

// The same slab geometry factory used by the room build, with indexed faces
// and ownership attributes, verifies the pre-batch finish cannot move surfaces.
const envelope=polygonGeometry([[-141,-80],[-89,-80],[-89,-70],[-141,-70]],[],-35.7,.14);
envelope.setIndex(Array.from({length:envelope.attributes.position.count},(_,i)=>i));
envelope.setAttribute('_leo_owner',new T.Uint16BufferAttribute(new Uint16Array(envelope.attributes.position.count).fill(2),1));
envelope.setAttribute('_leo_finish',new T.Uint16BufferAttribute(new Uint16Array(envelope.attributes.position.count).fill(1),1));
envelope.userData.finishParts=[{start:0,count:envelope.attributes.position.count,name:'V2_hull_room_floor',room:'d02-arrival-1'}];
const original=new T.MeshStandardMaterial({name:'Unchanged_shared_lining',color:0xdce1db,side:T.DoubleSide});
const attributes=Object.fromEntries(Object.entries(envelope.attributes).map(([k,a])=>[k,{reference:a,array:Array.from(a.array)}])),index=envelope.index,indices=Array.from(index.array),metadata=JSON.stringify(envelope.userData);
for(const room of ['commons-1','observation-lounge','d02-arrival-6','exterior']){
 assert.equal(arrivalEnvelopeMaterial(room,'floor',envelope,original),original);
 assert.equal(envelope.attributes.uv,undefined);
}
for(const kind of ['glass_collision','window_reveal','exterior'])assert.equal(arrivalEnvelopeMaterial('d02-arrival-1',kind,envelope,original),original);
const floorFinish=arrivalEnvelopeMaterial('d02-arrival-1','floor',envelope,original);
assert.equal(floorFinish.name,'Arrival_Retro_terrazzo_side_2');assert.equal(floorFinish.side,T.DoubleSide);assert.ok(floorFinish.map);
assert.equal(arrivalEnvelopeMaterial('d02-arrival-1','floor',envelope,original),floorFinish,'Repeated owners reuse material and texture');
for(const [name,{reference,array}]of Object.entries(attributes)){assert.equal(envelope.attributes[name],reference);assert.deepEqual(Array.from(reference.array),array);}
assert.equal(envelope.index,index);assert.deepEqual(Array.from(index.array),indices);assert.equal(JSON.stringify(envelope.userData),metadata);
for(let i=0;i<envelope.attributes.position.count;i++){assert.equal(envelope.attributes.uv.getX(i),envelope.attributes.position.getX(i)/2);assert.equal(envelope.attributes.uv.getY(i),envelope.attributes.position.getZ(i)/2);}
assert.equal(original.color.getHex(),0xdce1db);assert.equal(original.map,null);
assert.equal(arrivalEnvelopeMaterial('d02-arrival-1','ceiling',envelope,original).color.getHex(),0x67747c);
assert.equal(arrivalEnvelopeMaterial('d02-arrival-1','hull_wall',envelope,original).color.getHex(),0xe8deca);
console.log('PASS pre-batch exact-owner material/UV isolation; indexed slab positions, normals, indices, ownership and metadata unchanged');

if(!existsSync('output/leo-interior-v02/layout.json')){
 console.log('SKIP frame-based lighting check: build the v2 layout first');
}else{
 const {createArrivalMood}=await import('../src/walk/arrival-mood.js');
 const {toWorld}=await import('../src/plan/rooms.js');
 const scene=new T.Scene(),hemi=new T.HemisphereLight(0xfff6e6,0x5d6b75,1.05),fill=new T.DirectionalLight(0xfff1dc,.55);
 scene.environmentIntensity=.85;scene.add(hemi,fill);
 const snapshot=()=>[hemi.intensity,fill.intensity,scene.environmentIntensity,...hemi.color.toArray(),...hemi.groundColor.toArray()];
 const baseline=snapshot(),mood=createArrivalMood({root,inside},{hemi,fill,scene});
 const eye=p=>new T.Vector3(...toWorld('d02-arrival-1',p));
 for(let i=0;i<120;i++)mood.update(1/60,eye([0,1.65,0]));
 assert.equal(mood.active,true);assert.ok(hemi.intensity<baseline[0]*.6);
 assert.equal(scene.getObjectByName('Arrival_practical_lights').visible,true);
 // A normal doorway exit, vertical departure, and a distant teleport each
 // restore every changed value in the same frame, not over a lingering fade.
 for(const p of [[26.5,1.65,0],[0,5,0],[1000,1.65,1000]]){
  mood.update(1/60,eye([0,1.65,0]));mood.update(1/60,eye(p));
  assert.equal(mood.active,false);assert.deepEqual(snapshot(),baseline);
  assert.equal(scene.getObjectByName('Arrival_practical_lights').visible,false);
 }
 // The fitted hull extends beyond the legacy rectangular furnishing footprint.
 mood.update(1/60,eye([0,1.65,-20]));assert.equal(mood.active,true,'window-side extension belongs to Arrival');
 mood.update(1/60,eye([0,1.65,-40]));assert.equal(mood.active,false,'outside fitted hull must restore lighting');assert.deepEqual(snapshot(),baseline);
 mood.update(1/60,eye([0,3.4,0]));assert.equal(mood.active,true,'selected 3.5m room height is covered');
 mood.update(1/60,eye([0,3.51,0]));assert.equal(mood.active,false,'room above keeps its lighting');assert.deepEqual(snapshot(),baseline);
 // While outside, Arrival must not overwrite another room's mood controller.
 hemi.intensity=.123;mood.update(1/60,eye([1000,1.65,1000]));assert.equal(hemi.intensity,.123);
 mood.dispose();assert.equal(scene.getObjectByName('Arrival_practical_lights'),undefined);
 console.log('PASS Arrival real-frame entry, doorway exit, vertical exit, teleport restore and other-room non-interference');

 // Exercise the actual neighboring mood implementation in main's order:
 // update Arrival, update the outgoing room, then reapply active Arrival.
 const {createRecoveryMood}=await import('../src/walk/recovery.js');
 const recoveryRoom=new T.Group();recoveryRoom.name='Area_d20-recovery-aft';root.add(recoveryRoom);
 hemi.intensity=baseline[0];
 const arrival=createArrivalMood({root,inside},{hemi,fill,scene}),recovery=createRecoveryMood({root},{hemi,fill,scene});
 const recEye=new T.Vector3(...toWorld('d20-recovery-aft',[10,1.65,0])),arrivalEye=eye([0,1.65,0]),dt=1/60;
 const tick=p=>{arrival.update(dt,p);recovery.update(dt,p);arrival.apply();};
 for(let i=0;i<180;i++)tick(recEye);
 assert.ok(hemi.intensity<baseline[0]*.41);
 for(let i=0;i<180;i++){
  tick(arrivalEye);const amount=1-Math.exp(-3*dt*(i+1));
  assert.ok(Math.abs(hemi.intensity-T.MathUtils.lerp(baseline[0],baseline[0]*.55,amount))<1e-10,'outgoing Recovery fade overwrote Arrival');
 }
 arrival.update(dt,recEye);recovery.update(dt,recEye);const recoveryOwns=snapshot();arrival.apply();assert.deepEqual(snapshot(),recoveryOwns);
 assert.equal(arrival.active,false);arrival.dispose();
 console.log('PASS actual Recovery → Arrival cross-fade and Arrival → Recovery ownership sequence');
}
