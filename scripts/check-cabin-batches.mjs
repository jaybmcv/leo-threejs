// The cabin batches (src/v2/cabin-batches.js) on a small scene: which parts a main pass folds into a batch, what it leaves
// to draw as before, the instanced multi-draw it asks for, matrices following re-ranks, and the batch material following
// the parts' own. node scripts/check-cabin-batches.mjs
import assert from 'node:assert/strict';
import * as T from 'three';
import {createCabinBatches} from '../src/v2/cabin-batches.js';

const calls={plain:[],instanced:[]};
const ext={multiDrawElementsWEBGL(...a){calls.plain.push(a);},multiDrawElementsInstancedWEBGL(...a){calls.instanced.push(a);}};
const renderer={extensions:{has:n=>n==='WEBGL_multi_draw',get:()=>ext},info:{render:{triangles:0}},shadowMap:{enabled:false},domElement:new EventTarget()};
const scene=new T.Scene(),live=new T.Group(),shells=new T.Group(),fitX=new T.Group(),fitY=new T.Group();
shells.name='V2_cabin_shells';fitX.name='V2_fit_x';fitY.name='V2_fit_y';scene.add(live);live.add(shells,fitX,fitY);
const lining=new T.MeshStandardMaterial({name:'lining'}),brass=new T.MeshStandardMaterial({name:'brass'}),oak=new T.MeshStandardMaterial({name:'oak'});
const box=new T.BoxGeometry(1,1,1),plank=new T.BoxGeometry(2,.1,1);box.clearGroups();plank.clearGroups();
const at=(x,z)=>new T.Matrix4().makeTranslation(x,0,z);
function partOf(parent,name,geometry,material,matrices,{walls=false,near=false}={}){
 const o=new T.InstancedMesh(geometry,material,matrices.length);o.name=name;matrices.forEach((m,i)=>o.setMatrixAt(i,m));
 o.userData={cabins:true,cabinWalls:walls,boat:false,cabinIds:matrices.map((_,i)=>name+i)};
 if(near)o.userData.near={all:matrices.map(m=>m.clone())};parent.add(o);return o;
}
const wallA=partOf(shells,'Cabin_v2_shell_lining_a',box,lining,[at(-4,-10),at(0,-10),at(4,-10)],{walls:true});
const wallB=partOf(shells,'Cabin_v2_shell_lining_b',plank,lining,[at(-2,-12),at(2,-12)],{walls:true});
const wallC=partOf(shells,'Cabin_v2_shell_oak',plank,oak,[at(0,-14)],{walls:true});
const fitXa=partOf(fitX,'bed',box,lining,[at(-3,-9),at(3,-9)],{near:true}),fitXb=partOf(fitX,'lamp',plank,brass,[at(-3,-8),at(3,-8)],{near:true});
const fitYa=partOf(fitY,'bed',box,lining,[at(-1,-9)],{near:true}),fitYb=partOf(fitY,'lamp',plank,brass,[at(-1,-8)],{near:true});
const glass=partOf(shells,'Cabin_v2_shell_glass',box,new T.MeshStandardMaterial({transparent:true,opacity:.5}),[at(0,-11),at(1,-11)],{walls:true});
const boat=partOf(fitY,'seat',box,lining,[at(0,-9)],{near:true});boat.userData.boat=true;
const parts=[wallA,wallB,wallC,fitXa,fitXb,fitYa,fitYb,glass,boat];
const camera=new T.PerspectiveCamera(60,1,.1,100);
let skipped=new Set();
const batches=await createCabinBatches(scene,renderer,parts,{nearSlots:4,skip:o=>skipped.has(o)});
assert(batches,'batches made');
assert.equal(batches.stats.batches,2,'lining (4 parts) and brass (2 parts); oak alone, glass and lifeboat seats not batched');
const batchOf=name=>scene.children.find(o=>o.isBatchedMesh&&o.name==='V2_cabin_batch '+name);
const L=batchOf('lining'),B=batchOf('brass');assert(L&&B&&!batchOf('oak'));
assert.equal(L.material.id,lining.id,'the batch sorts where its parts did');assert.notEqual(L.material,lining);
function pass(inspect){
 scene.updateMatrixWorld(true);camera.updateMatrixWorld();
 const prior=parts.map(o=>o.visible);
 batches.around(camera,()=>{scene.onBeforeRender(renderer,scene,camera,null);inspect?.();});
 assert.deepEqual(parts.map(o=>o.visible),prior,'parts put back after the pass');assert(!L.visible&&!B.visible,'batches hidden outside the pass');
}
const heads=batch=>Array.from(batch._indirectTexture.image.data.subarray(0,batch._multiDrawCount));
const rowOf=(batch,o)=>{const d=batch._matricesTexture.image.data;for(let h=0;h<64;h++)if(d.subarray(h*16,h*16+o.count*16).every((v,i)=>v===o.instanceMatrix.array[i])&&o.count)return h;return -1;};

// Everything in view: lining folds four parts, brass two; oak, glass and seats draw as before.
pass(()=>{
 assert(L.visible&&B.visible);assert.equal(L._multiDrawCount,4);assert.equal(B._multiDrawCount,2);
 for(const o of [wallA,wallB,fitXa,fitYa,fitXb,fitYb])assert.equal(o.visible,false,o.name+' folded');
 for(const o of [wallC,glass,boat])assert.equal(o.visible,true,o.name+' draws itself');
 assert.equal(batches.stats.folded,4);assert.equal(batches.stats.shown,2);
 // Each sub-draw's instances come from its part, at the head the indirect texture gives it.
 for(const o of [wallA,wallB,fitXa,fitYa])assert(heads(L).includes(rowOf(L,o)),o.name+' matrices at its head');
 // three's multi-draw of this batch becomes the instanced one with the parts' instance counts.
 const before=calls.instanced.length;ext.multiDrawElementsWEBGL(4,L._multiDrawCounts,0,5125,L._multiDrawStarts,0,L._multiDrawCount);
 assert.equal(calls.instanced.length,before+1);const [, , , , , ,instances]=calls.instanced.at(-1);
 assert.deepEqual(Array.from(instances.subarray(0,4)).sort(),[1,2,2,3].sort());
 const plain=calls.plain.length;ext.multiDrawElementsWEBGL(4,new Int32Array(4),0,5125,new Int32Array(4),0,4);assert.equal(calls.plain.length,plain+1,'other multi-draws untouched');
});
// Group occlusion leaving out room X's fittings: they draw (or not) as before; brass then has one part and draws it.
skipped=new Set([fitXa,fitXb]);
pass(()=>{assert.equal(L._multiDrawCount,3);assert(fitXa.visible&&fitXb.visible&&fitYb.visible);assert(!B.visible);assert.equal(batches.stats.skipped,2);});
skipped=new Set();
// A hidden room, a part on another layer, a part out of view, more instances than its slots.
fitY.visible=false;wallB.layers.set(2);pass(()=>{assert.equal(L._multiDrawCount,2);assert(wallB.visible);});
fitY.visible=true;wallB.layers.set(0);
wallA.setMatrixAt(0,at(0,500));wallA.setMatrixAt(1,at(1,500));wallA.setMatrixAt(2,at(2,500));wallA.instanceMatrix.needsUpdate=true;wallA.computeBoundingSphere();
pass(()=>assert(wallA.visible,'out of view: left to three, which culls it'));
[[-4,-10],[0,-10],[4,-10]].forEach(([x,z],i)=>wallA.setMatrixAt(i,at(x,z)));wallA.instanceMatrix.needsUpdate=true;wallA.computeBoundingSphere();
fitXa.count=1;fitXa.setMatrixAt(0,at(2,-9.5));fitXa.instanceMatrix.needsUpdate=true;fitXa.computeBoundingSphere();L._matricesTexture.clearUpdateRanges();
pass(()=>{assert(!fitXa.visible);assert(heads(L).includes(rowOf(L,fitXa)),'re-ranked matrices copied');assert(L._matricesTexture.updateRanges.length>0,'only changed rows upload');});
fitXa.count=2;fitXa.setMatrixAt(0,at(-3,-9));fitXa.setMatrixAt(1,at(3,-9));fitXa.instanceMatrix.needsUpdate=true;fitXa.computeBoundingSphere();
// The batch material follows its original.
lining.roughness=.25;pass();pass();assert.equal(L.material.roughness,.25,'a value changed without a rebuild follows within a few passes');assert.equal(L.material.color,lining.color);
L.material.onBeforeCompile=()=>{};pass();assert.notEqual(L.material.onBeforeCompile.toString(),'()=>{}','a hook put over the batch copy is replaced');
const shader={vertexShader:'a\n#include <batching_vertex>\nb',fragmentShader:'',uniforms:{}};L.material.onBeforeCompile(shader,null);
assert.match(shader.vertexShader,/getIndirectIndex\( gl_DrawID \) \+ float\( gl_InstanceID \)/);
assert(L.material.onBeforeCompile.cornerShade&&L.material.onBeforeCompile.filmLook,'corner shading and the film look leave it to the original');
assert.match(L.material.customProgramCacheKey(),/\|cabin-instanced$/);
lining.onBeforeCompile=function(s){s.vertexShader='x'+s.vertexShader;};lining.needsUpdate=true;const v=L.material.version;pass();
assert(L.material.version>v,'rebuilt when the original is');const s2={vertexShader:'#include <batching_vertex>',uniforms:{}};L.material.onBeforeCompile(s2,null);assert(s2.vertexShader.startsWith('x'),'the original hook runs first');
lining.onBeforeCompile=T.Material.prototype.onBeforeCompile;lining.needsUpdate=true;
lining.transparent=true;lining.needsUpdate=true;pass(()=>assert(!L.visible&&wallA.visible,'a material turned transparent draws part by part'));lining.transparent=false;lining.needsUpdate=true;
// Not for shadow maps, and nothing without the instanced multi-draw.
renderer.shadowMap.enabled=true;pass(()=>assert(wallA.visible&&!L.visible));renderer.shadowMap.enabled=false;
pass(()=>assert(!wallA.visible&&L.visible));
const bare={...renderer,extensions:{has:()=>true,get:()=>({multiDrawElementsWEBGL(){}})}};
assert.equal(await createCabinBatches(new T.Scene(),bare,parts),null);
// A lost context stops batching.
renderer.domElement.dispatchEvent(new Event('webglcontextlost'));pass(()=>assert(wallA.visible&&!L.visible));
console.log('check-cabin-batches: ok');
