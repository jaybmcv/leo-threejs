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
assert(L.material.onBeforeCompile.cornerShade,'corner shading leaves it to the original');
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

// Cabin kinds (`kinds`): parts whose materials differ only in colour, glow, roughness and metalness share one batch with
// the members' lowest material id, read their values from texels, and draw by material id, then depth; a part whose
// material changed look or shader, or one left alone, draws as before; texels follow every pass.
{
 const renderer={extensions:{has:n=>n==='WEBGL_multi_draw',get:()=>ext},info:{render:{triangles:0}},shadowMap:{enabled:false},domElement:new EventTarget()};
 const scene=new T.Scene(),shells=new T.Group();scene.add(shells);
 const look=(name,color,roughness=.5,metalness=0)=>new T.MeshStandardMaterial({name,color,roughness,metalness});
 const warm=look('Residential_warm_floor',0xb08060,.7),oak=look('Residential_oak',0x8a5a2b,.4),brass=look('Residential_brass',0xc8a040,.3,.9),apart=look('Residential_apart',0x445566);
 const box=new T.BoxGeometry(1,1,1),plank=new T.BoxGeometry(2,.1,1);box.clearGroups();plank.clearGroups();
 const at=(x,z)=>new T.Matrix4().makeTranslation(x,0,z);
 const partOf=(name,geometry,material,matrices)=>{const o=new T.InstancedMesh(geometry,material,matrices.length);o.name=name;matrices.forEach((m,i)=>o.setMatrixAt(i,m));
  o.userData={cabins:true,cabinWalls:true,boat:false,cabinIds:matrices.map((_,i)=>name+i)};shells.add(o);return o;};
 // Brass nearest, then oak, warm furthest: three would draw warm's part first all the same (lowest id), then oak's, then brass's.
 const pWarm=partOf('floor',box,warm,[at(0,-20),at(2,-20)]),pOak=partOf('desk',plank,oak,[at(0,-12)]),pOak2=partOf('shelf',box,oak,[at(1,-14)]),pBrass=partOf('lamp',box,brass,[at(0,-8)]);
 const pApart=partOf('bed',box,apart,[at(3,-9)]),pApart2=partOf('bed2',plank,apart,[at(4,-9)]);
 const parts=[pWarm,pOak,pOak2,pBrass,pApart,pApart2],camera=new T.PerspectiveCamera(60,1,.1,100);
 const kb=await createCabinBatches(scene,renderer,parts,{kinds:true,alone:m=>m===apart});
 assert.equal(kb.stats.batches,2,'one kind (warm, oak, brass) and apart by its own material');assert.equal(kb.stats.kinds,1);assert.equal(kb.stats.kindMaterials,3);
 const K=scene.children.find(o=>o.isBatchedMesh&&o.name==='V2_cabin_batch kind_0'),A=scene.children.find(o=>o.isBatchedMesh&&o.name==='V2_cabin_batch Residential_apart');assert(K&&A);
 assert.equal(K.material.id,Math.min(warm.id,oak.id,brass.id),'the kind sorts where its first member did');assert.equal(A.material.id,apart.id);
 assert(K.material.map&&K.material.roughnessMap&&K.material.emissiveMap&&K.material.color.getHex()===0xffffff&&K.material.roughness===1,'the kind reads its values from its maps');
 assert(K.geometry.attributes.uv,'its parts carry their texels');
 const pass=inspect=>{scene.updateMatrixWorld(true);camera.updateMatrixWorld();kb.around(camera,()=>{scene.onBeforeRender(renderer,scene,camera,null);inspect?.();});};
 const order=()=>{const heads=Array.from(K._indirectTexture.image.data.subarray(0,K._multiDrawCount)),d=K._matricesTexture.image.data;
  return heads.map(h=>parts.find(o=>o.count&&d.subarray(h*16,h*16+16).every((v,i)=>v===o.instanceMatrix.array[i]))?.name);};
 pass(()=>{assert.equal(K._multiDrawCount,4);assert.deepEqual(order(),['floor','desk','shelf','lamp'],'by material id, then depth (the desk nearer than the shelf)');
  for(const o of [pWarm,pOak,pOak2,pBrass])assert(!o.visible,o.name+' folded');assert(!pApart.visible&&!pApart2.visible,'apart batched by its material');});
 const near=(x,y)=>Math.abs(x-y)<1e-6,C=K.material.map.image.data,L=K.material.roughnessMap.image.data;
 [warm,oak,brass].forEach((m,k)=>{assert(near(C[k*4],m.color.r)&&near(C[k*4+2],m.color.b),m.name+' colour');assert(near(L[k*4+1],m.roughness)&&near(L[k*4+2],m.metalness),m.name+' roughness, metalness');});
 // Colour changed: its texel the next pass.
 oak.color.set(0x102030);pass();assert(near(C[4],oak.color.r)&&near(C[6],oak.color.b));
 // A member's look changed: it draws itself; its first member's changed: the others do (the copy follows the first).
 oak.side=T.DoubleSide;oak.needsUpdate=true;pass(()=>{assert(pOak.visible&&pOak2.visible);assert.equal(K._multiDrawCount,2);});oak.side=T.FrontSide;oak.needsUpdate=true;
 warm.side=T.DoubleSide;warm.needsUpdate=true;pass(()=>{assert(pWarm.visible&&pOak.visible&&pBrass.visible&&!K.visible,'the others leave the first: each draws itself');});warm.side=T.FrontSide;warm.needsUpdate=true;
 pass(()=>assert.equal(K._multiDrawCount,4));
 // Another shader (program key): draws itself; one key with closures of their own: folds.
 const hook=()=>{const f=function(s){s.fragmentShader+='//c';};f.cornerShade=true;f.keepsGeometry=true;return f;},key=function(){return 'corner';};
 for(const m of [warm,oak,brass]){m.onBeforeCompile=hook();m.customProgramCacheKey=key;m.needsUpdate=true;}
 pass(()=>assert.equal(K._multiDrawCount,4,'own closures, one key'));
 brass.customProgramCacheKey=function(){return 'other';};brass.needsUpdate=true;pass(()=>{assert(pBrass.visible);assert.equal(K._multiDrawCount,3);});
 brass.customProgramCacheKey=key;brass.needsUpdate=true;
 // Each part's sub-draw reads its own material's texel (Uint16 normalized u at its first index).
 const uvAt=i=>{const ix=K.geometry.index.array,v=ix[K._multiDrawStarts[i]/ix.BYTES_PER_ELEMENT];return K.geometry.attributes.uv.array[v*2];},texel=k=>Math.round(65535*(k+.5)/3);
 pass(()=>{assert.equal(K._multiDrawCount,4);assert.deepEqual([0,1,2,3].map(uvAt),[texel(0),texel(1),texel(1),texel(2)],'warm, oak, oak, brass texels');});
 // The copy has a name of its own (the moods find materials by name) and stays shown.
 assert.equal(K.material.name,'V2_cabin_kind_0');assert(K.material.visible);
 // A value written into the copy: its parts draw themselves until it is put back.
 K.material.emissiveIntensity=4;pass(()=>assert(pWarm.visible&&pOak.visible&&!K.visible));K.material.emissiveIntensity=1;pass(()=>assert.equal(K._multiDrawCount,4));
 // The first material hidden: the copy stays shown, the others still fold, its own part is left to three.
 warm.visible=false;pass(()=>{assert(K.material.visible&&K.visible);assert.equal(K._multiDrawCount,3);assert(pWarm.visible);});warm.visible=true;
 // The first material given a texture (no look any more): nothing folds with it.
 warm.map=new T.Texture();warm.needsUpdate=true;pass(()=>assert(!K.visible&&pOak.visible));warm.map=null;warm.needsUpdate=true;pass(()=>assert.equal(K._multiDrawCount,4));
 // Without kinds: by material, as before.
 const s2=new T.Scene();const copies=parts.map(o=>{const c=o.clone();c.userData={...o.userData};s2.add(c);return c;});
 const pb=await createCabinBatches(s2,renderer,copies);assert.equal(pb.stats.batches,2,'oak (two parts) and apart');assert.equal(pb.stats.kinds,0);
 console.log('check-cabin-batches: kinds ok');
}
