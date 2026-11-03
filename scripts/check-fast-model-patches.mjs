import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {patchModels} from './patch-models-v2.mjs';
import {applyRoomFitoutOverrides} from '../src/v2/room-fitout-overrides.js';
globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const dir='output/fast-deploy/model-fixture';for(const name of ['base','patch','removed'])await fs.mkdir(dir+'/'+name,{recursive:true});
function group(id,deck,width){const g=new T.Group();g.name='V2_phase4_deck_'+deck;const m=new T.InstancedMesh(new T.BoxGeometry(width,.9,1),new T.MeshStandardMaterial(),1);m.name='P4_workbench';m.setMatrixAt(0,new T.Matrix4());m.userData={phase4:true,v2Deck:deck,ownerRuns:[{room:id,component:id,start:0,count:1}],roomOwners:[id]};g.add(m);return g;}
const exporter=new GLTFExporter(),A='d01-new-2',B='d05-new-4';
await fs.writeFile(dir+'/base/one.glb',Buffer.from(await exporter.parseAsync(group(A,1,3.2),{binary:true})));
await fs.writeFile(dir+'/base/two.glb',Buffer.from(await exporter.parseAsync(group(B,5,3.2),{binary:true})));
await patchModels({baseline:dir+'/base',destination:dir+'/patch',rooms:[A,B],roots:[group(A,1,3.4),group(B,5,3.6)]});
for(const [file,id]of [['one.glb',A],['two.glb',B]]){const bytes=await fs.readFile(dir+'/patch/'+file),j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),owners=new Set(j.nodes.flatMap(n=>n.extras?.ownerRuns?.map(r=>r.room)||[]));assert.deepEqual([...owners],[id],'Another changed room leaked into '+file);}
await patchModels({baseline:dir+'/base',destination:dir+'/removed',rooms:[A],roots:[]});
const bytes=await fs.readFile(dir+'/removed/one.glb'),j=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert(j.nodes.every(n=>n.mesh===undefined),'Deletion-only patch retained a mesh');
const layout={rooms:[{id:A,deck:1,frame:{origin:[0,0,0],yaw:0}}]},data=()=>({parts:[{part:'seat_cushion',size:[.6,.16,.6],at:[0,.49,0],mat:'oak',room:A,deck:1}],rests:[{room:A,point:[0,.57,0]}],rooms:[]});
assert.throws(()=>applyRoomFitoutOverrides(data(),layout,{[A]:{remove:[{part:'seat_cushion'}]}}),/rest/);
assert.equal(applyRoomFitoutOverrides(data(),layout,{[A]:{remove:[{}],rests:[]}}).rests.length,0);
const rotated={rooms:[{id:A,deck:1,fittingFrame:{origin:[100,10,20],yaw:Math.PI/2}}]},bed={add:[{part:'mattress',size:[1,0.2,2],at:[0,0.5,0],mat:'cream'}],rests:[{kind:'lie',point:[0,0.6,0],head:[0,0,1],facing:[1,0,0]}]},patched=applyRoomFitoutOverrides({parts:[],rests:[],rooms:[]},rotated,{[A]:bed});
const close=(actual,expected)=>actual.forEach((n,i)=>assert(Math.abs(n-expected[i])<1e-10));
close(patched.parts[0].at,[100,10.5,20]);close(patched.rests[0].point,[100,10.6,20]);
close(patched.rests[0].head,[1,0,0]);close(patched.rests[0].facing,[0,0,-1]);
for(const rest of [{kind:'lie',point:[0,0,0]},{kind:'lie',point:[0,0,0],head:[0,0,0]},{kind:'sit',point:[0,0,0],facing:[Infinity,0,1]}])assert.throws(()=>applyRoomFitoutOverrides({parts:[],rests:[],rooms:[]},rotated,{[A]:{rests:[rest]}}),/rest anchor/);
console.log('PASS: model owner isolation, deletion-only patches, required seat anchors, rotated bed position/directions, invalid lying anchors');
