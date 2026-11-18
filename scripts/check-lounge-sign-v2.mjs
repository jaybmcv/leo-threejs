import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {PreparedWriter} from '../src/v2/prepared-codec.authoring.js';
import {bakeForWalking} from '../src/walk/render-bake.js';
import {solid} from '../src/walk/collision.js';

// Exercise the artwork branch without loading an image or starting a browser.
globalThis.__HYDRO_NIP_MAIN_LOGO__='fixture';
const {createGardenCommons}=await import('../src/model.js');
const {resolveRoomFrames}=await import('../src/plan/rooms.js');
const {createLoungeSign}=await import('../src/walk/lounge.js');
globalThis.document={createElement:()=>createCanvas(1,1)};
const load=T.TextureLoader.prototype.load;
T.TextureLoader.prototype.load=()=>new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);
let garden;
try{garden=createGardenCommons(1).root;}finally{T.TextureLoader.prototype.load=load;delete globalThis.document;delete globalThis.__HYDRO_NIP_MAIN_LOGO__;}
resolveRoomFrames(garden);garden.updateMatrixWorld(true);
const root=garden.getObjectByName('Hydro_Nip_Lounge'),sign=root.getObjectByName('Hydro_Nip_Main_Sign');
const centre=sign.getWorldPosition(new T.Vector3()),initial=sign.matrixWorld.clone();
assert(centre.distanceTo(new T.Vector3(-112.5,33.05,-41))<1e-8,'Keep X/Z and lift only 15 cm');
const faces=['Front','Back'].map(side=>sign.getObjectByName('Hydro_Nip_Main_Logo_'+side));
assert(faces.every(Boolean),'Use both existing artwork faces');
assert.equal(faces[0].material,faces[1].material);
assert.equal(faces[0].material.side,T.FrontSide,'No reversed face shows through');
assert.deepEqual(faces[0].material.map.offset.toArray(),[.02,.018]);
assert.deepEqual(faces[0].material.map.repeat.toArray(),[.96,.964]);
const writer=new PreparedWriter(),graph=writer.graph(garden,{source:true});
for(const o of [sign,...faces])assert(graph.nodes.some(n=>n.uuid===o.uuid),'Prepared source retains the live disc');
for(const o of faces){const row=graph.nodes.find(n=>n.uuid===o.uuid);assert(writer.geometries[row.geometry].attributes.position,'Prepared faces retain full geometry');}
sign.traverse(o=>{if(o.isMesh)assert(!solid(o),'Animated decoration has no frozen collision');});

const fixed=root.children.filter(o=>o.isMesh).map(o=>({o,matrix:o.matrixWorld.clone()})),spin=createLoungeSign(root,24.3);
assert(!root.getObjectByName(sign.name),'Remove the disc from the static ship');
spin.group.updateMatrixWorld(true);
assert(sign.matrixWorld.elements.every((v,i)=>Math.abs(v-initial.elements[i])<1e-8),'Extraction preserves its entire transform');
const baked=bakeForWalking(spin.group);
assert.equal(baked.sources,0,'The disc never enters a static render band');
const point=new T.Vector3(),box=new T.Box3();
let minimum=Infinity;
for(let step=0;step<250;step++){
 spin.update(.1);spin.group.updateMatrixWorld(true);
 assert(sign.getWorldPosition(point).distanceTo(centre)<1e-8,'Vertical spin keeps the centre fixed');
 box.setFromObject(spin.group,true);minimum=Math.min(minimum,box.min.y);
 for(const face of faces)assert(face.matrixWorld.determinant()>.999,'Neither artwork face is mirrored');
 const normals=faces.map(o=>new T.Vector3().fromBufferAttribute(o.geometry.attributes.normal,0).transformDirection(o.matrixWorld));
 assert(normals[0].dot(normals[1])<-.999,'Readable faces remain opposed throughout the turn');
}
assert(Math.abs(Math.sin(spin.group.rotation.y))<1e-8,'A full turn takes 25 seconds');
const angle=spin.group.rotation.y;spin.update(60);
assert(Math.abs(spin.group.rotation.y-angle-Math.PI*2/250)<1e-8,'A long frame gap advances at most 100 ms');
spin.update(-1);assert.equal(spin.group.rotation.y,angle+Math.PI*2/250,'Negative elapsed time never reverses the sign');
assert(minimum>30.789&&minimum<30.791,'Disc size and lowest point stay constant');
// The solid crown reaches 30.746 m, below the complete rotating disc.
const tubeTop=24.3+new T.IcosahedronGeometry(6.5,2).attributes.position.array.reduce((top,v,i)=>i%3===1?Math.max(top,v):top,-Infinity)+.08;
assert(minimum>tubeTop+.04,'At least four centimetres clear of the dome crown');
for(const {o,matrix}of fixed)assert.deepEqual(o.matrixWorld.elements,matrix.elements,'Dome, pivot and other fittings stay still');
const helper=source=>source.slice(source.indexOf('export function createLoungeSign('),source.indexOf('export function createLounge(ship'));
const native=await fs.readFile('src/walk/lounge.js','utf8');
for(const suffix of ['authoring','prepared','public']){
 const source=await fs.readFile('src/walk/lounge.'+suffix+'.js','utf8');
 assert.equal(helper(source),helper(native),'All walk variants use the same rigid spin');
 assert(source.includes('sign?.update(dt)')&&source.includes('drawn.push(sign.group)'),'Every variant draws and updates the sign');
}
console.log('PASS live prepared artwork, rigid 25-second spin, capped gaps, readable faces, fixed pivot/dome and crown clearance in every walk variant');
