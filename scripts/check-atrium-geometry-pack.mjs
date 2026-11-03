import assert from 'node:assert/strict';
import * as T from 'three';
import {buildAtriumGeometryPack,hydrateAtriumGeometryPack,hydrateAtriumGeometryPackAsync} from '../src/v2/atrium-geometry-pack.js';
import {getAtriumGeometryState} from '../src/v2/atrium-geometry-quality.js';
import {rememberPreparedStatic,settlePreparedStatic} from '../src/v2/prepared-static.js';

let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
function ring(){
 const g=new T.PlaneGeometry(10,10,24,24),p=g.attributes.position,indices=[];
 for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(k=>g.index.getX(i+k)),x=ids.reduce((s,j)=>s+p.getX(j),0)/3,y=ids.reduce((s,j)=>s+p.getY(j),0)/3;if(Math.abs(x)<1.7&&Math.abs(y)<1.7)continue;indices.push(...ids);}
 g.setIndex(indices);const color=new Uint16Array(p.count*3);color.fill(45000);g.setAttribute('color',new T.BufferAttribute(color,3,true));g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function fixture(){
 const group=new T.Group();group.userData={band:6,top:9};const material=new T.MeshStandardMaterial({name:'Walk_finish_pack',vertexColors:true}),originals=[];
 for(let i=0;i<3;i++){
  const geometry=ring();
  if(i===2){
   // Prepared chunks reference shared pools: unused vertices and nonzero source
   // index offsets must survive hydration without duplicating the whole pool.
   for(const[name,a]of Object.entries(geometry.attributes)){const values=new a.array.constructor(a.array.length+17*a.itemSize);values.fill(123);values.set(a.array,17*a.itemSize);geometry.setAttribute(name,new T.BufferAttribute(values,a.itemSize,a.normalized));}
   geometry.setIndex(new T.BufferAttribute(Uint32Array.from(geometry.index.array,id=>id+17),1));
  }
  const mesh=new T.Mesh(geometry,material);mesh.name='Walk_merged_pack_'+i;mesh.position.set(i===2?320:i*12,2,0);mesh.rotation.z=.03*i;group.add(mesh);originals.push(mesh);
 }
 group.updateMatrixWorld(true);return {group,originals,baked:{bands:new Map([['6:9',group]])}};
}
function boundary(g){
 const count=new Map(),p=g.attributes.position;
 for(let i=0;i<g.index.count;i+=3)for(let k=0;k<3;k++){const key=[g.index.getX(i+k),g.index.getX(i+(k+1)%3)].map(id=>[p.getX(id),p.getY(id),p.getZ(id)].join(',')).sort().join('|');count.set(key,(count.get(key)||0)+1);}
 return [...count].filter(([,n])=>n===1).map(([key])=>key).sort();
}
const artifact='prepared-fixture-sha256',source=fixture(),geometry=source.originals.map(o=>o.geometry);
const packed=await buildAtriumGeometryPack(source.baked,{sourceArtifact:artifact,variant:'desktop',memoryBudgetBytes:8*1024*1024});
assert(source.originals.every((o,i)=>o.visible&&o.geometry===geometry[i]));assert.equal(source.group.children.length,3);assert.equal(packed.manifest.entries.length,2);assert(packed.manifest.stats.lodGeometries>=2);pass('offline generation restores originals and includes merged plus standalone LOD entries');
const manifest=JSON.parse(JSON.stringify(packed.manifest)),binary=packed.binary.slice();
assert(source.originals.every(o=>!JSON.stringify(manifest).includes(o.uuid)));assert(manifest.arrays.every(a=>a.offset%8===0));assert(binary.byteLength<=manifest.stats.memoryBytes);pass('serialized pack uses stable child bindings, aligned typed arrays and bounded owned memory');

const target=fixture(),ship={v2PreparedBake:target.baked};rememberPreparedStatic(ship);settlePreparedStatic(ship);
const live=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());live.name='Live appended after preparation';target.group.add(live);
const scene=new T.Scene();scene.position.set(7,0,0);scene.add(target.group);scene.updateWorldMatrix(true,true);
let quality='high';const controller=hydrateAtriumGeometryPack(target.baked,{manifest,binary},{expectedSourceArtifact:artifact,getQuality:()=>quality,memoryBudgetBytes:8*1024*1024}),state=getAtriumGeometryState(controller),merged=state.entries.find(e=>e.merged),standalone=state.entries.find(e=>!e.merged);
assert(merged&&standalone);assert.equal(merged.mesh.parent,target.group);assert.equal(live.parent,target.group);assert.equal(live.visible,true);assert.equal(merged.mesh.matrixWorld.elements[12],7);assert(controller.stats.precomputed);assert.equal(controller.stats.buildMs,0);pass('fresh UUIDs, settled static sources, parent transforms and appended live children hydrate safely');
assert.equal(merged.full.attributes.color.array.constructor,Uint16Array);assert.equal(merged.full.attributes.color.normalized,true);assert.equal(merged.full.attributes.position.array.buffer,binary.buffer);
for(const entry of state.entries)for(const level of entry.levels.slice(1)){assert.equal(level.geometry.attributes.position,entry.full.attributes.position);assert.equal(level.geometry.attributes.color,entry.full.attributes.color);assert.deepEqual(boundary(level.geometry),boundary(entry.full));}
assert.equal(standalone.full,target.originals[2].geometry);pass('zero-copy typed buffers retain normalized color and reuse exact prepared/merged attributes across LODs while preserving holes');
assert(standalone.levels.slice(1).every(level=>level.geometry.index.array.every(id=>id>=17)));pass('standalone LOD preserves original pooled vertex indices without serializing prepared attributes');
const camera=new T.PerspectiveCamera(60,16/9,.1,2000);camera.position.set(12,2,700);camera.lookAt(12,2,0);controller.update(camera,1080);assert.equal(controller.stats.lodInstances,0);
quality='performance';controller.update(camera,1080);assert(controller.stats.lodInstances>0);assert(controller.stats.selectedTriangles<controller.stats.fullTriangles);
quality='high';controller.update(camera,1080);assert(state.entries.every(e=>e.mesh.geometry===e.full));controller.setEnabled(false);assert(target.originals.every(o=>o.visible));controller.setEnabled(true);assert(!target.originals[0].visible);pass('hydrated controller switches geometric quality and restores full visibility on disable');
let disposedLOD=0;for(const entry of state.entries)for(const level of entry.levels.slice(1))level.geometry.addEventListener('dispose',()=>{assert.deepEqual(Object.keys(level.geometry.attributes),[]);disposedLOD++;});
const originalAttributes=target.originals.map(o=>o.geometry.attributes.position);controller.dispose();controller.dispose();assert.equal(disposedLOD,manifest.stats.lodGeometries);assert(target.originals.every((o,i)=>o.visible&&o.geometry.attributes.position===originalAttributes[i]));assert.equal(target.group.children.length,4);pass('disposal detaches shared attributes, frees each owned LOD once and leaves original/live geometry intact');

function rejects(label,mutate,{expectedSourceArtifact=artifact,memoryBudgetBytes=8*1024*1024}={}){
 const f=fixture(),m=JSON.parse(JSON.stringify(manifest)),b=binary.slice();mutate?.(f,m,b);
 const children=[...f.group.children],original=f.originals.map(o=>({geometry:o.geometry,visible:o.visible,position:o.geometry.attributes.position,index:o.geometry.index}));
 assert.throws(()=>hydrateAtriumGeometryPack(f.baked,{manifest:m,binary:b},{expectedSourceArtifact,memoryBudgetBytes}),/Atrium geometry pack/);
 assert.deepEqual(f.group.children,children);assert(f.originals.every((o,i)=>o.geometry===original[i].geometry&&o.visible===original[i].visible&&o.geometry.attributes.position===original[i].position&&o.geometry.index===original[i].index));pass(label);
}
rejects('wrong prepared artifact fails before installation',null,{expectedSourceArtifact:'other-artifact'});
rejects('late source name mismatch leaves every earlier source unchanged',f=>{f.originals[2].name+='changed';});
rejects('source index content mutation is detected despite unchanged index count',f=>{const a=f.originals[2].geometry.index;a.setX(Math.floor(a.count/2),a.getX(Math.floor(a.count/2))+1);});
rejects('source local transform changes are rejected',f=>{f.originals[2].position.x++;});
rejects('child order changes are rejected',f=>{[f.group.children[0],f.group.children[1]]=[f.group.children[1],f.group.children[0]];});
rejects('new live ownership is rejected',f=>{f.group.userData.keepLive=true;});
rejects('memory cap is checked before hiding sources',null,{memoryBudgetBytes:0});
rejects('invalid array ranges leave all source and shared geometry unchanged',(_f,m)=>{m.arrays.at(-1).offset++;});
rejects('invalid late LOD indices roll back allocated geometry without changing sources',(_f,m,b)=>{const level=m.entries.at(-1).levels.at(-1),a=m.arrays[level.index],Type=globalThis[a.type],indices=new Type(b.buffer,a.offset,a.length);indices[0]=Type===Uint16Array?65535:0xffffffff;});
rejects('duplicate entry ownership fails safely',(_f,m)=>{m.entries.at(-1).sources=[m.entries[0].sources[0]];});
rejects('invalid packed bounds fail safely',(_f,m)=>{m.entries[0].full.box[0][0]=Infinity;});
const empty=fixture(),zero=await buildAtriumGeometryPack(empty.baked,{sourceArtifact:artifact,memoryBudgetBytes:0});const noOp=hydrateAtriumGeometryPack(empty.baked,zero,{expectedSourceArtifact:artifact});assert.equal(noOp.stats.sources,0);noOp.dispose();assert(empty.originals.every(o=>o.visible));pass('empty budget produces a valid no-op pack');
const sliced=fixture(),slicedOriginals=sliced.originals.map(o=>o.geometry);let yields=0;
const slicedController=await hydrateAtriumGeometryPackAsync(sliced.baked,{manifest,binary},{expectedSourceArtifact:artifact,yieldBudgetMs:0,yieldControl:async()=>{
 yields++;assert.equal(sliced.group.children.length,3);assert(sliced.originals.every((o,i)=>o.visible&&o.geometry===slicedOriginals[i]));sliced.group.visible=false;
}});
assert(yields>manifest.bindings.length+manifest.arrays.length);assert.equal(slicedController.stats.fullTriangles,manifest.stats.fullTriangles);assert.equal(slicedController.stats.lodGeometries,manifest.stats.lodGeometries);assert.equal(slicedController.stats.hydrationYieldCount,yields);assert.equal(sliced.group.visible,false);assert(slicedController.stats.hydrationInstallMs>=0);slicedController.dispose();pass('async preparation yields throughout validation/construction, keeps originals intact and tolerates band culling before atomic installation');
const raced=fixture();let raceYields=0;const replacement=new T.BoxGeometry();
await assert.rejects(hydrateAtriumGeometryPackAsync(raced.baked,{manifest,binary},{expectedSourceArtifact:artifact,yieldBudgetMs:0,yieldControl:async()=>{if(++raceYields===yields){raced.originals[0].geometry=replacement;raced.originals[0].visible=false;}}}),/source changed during preparation/);
assert.equal(raced.originals[0].geometry,replacement);assert.equal(raced.originals[0].visible,false);assert(raced.originals.slice(1).every(o=>o.visible));assert.equal(raced.group.children.length,3);pass('async commit fence rejects changed sources without reverting the newer external state');
const interrupted=fixture(),interruptedGeometry=interrupted.originals.map(o=>o.geometry);let interruptionYields=0;
await assert.rejects(hydrateAtriumGeometryPackAsync(interrupted.baked,{manifest,binary},{expectedSourceArtifact:artifact,yieldBudgetMs:0,yieldControl:async()=>{if(++interruptionYields===yields-1)throw Error('scheduler interrupted');}}),/scheduler interrupted/);
assert.equal(interrupted.group.children.length,3);assert(interrupted.originals.every((o,i)=>o.visible&&o.geometry===interruptedGeometry[i]&&o.geometry.attributes.position));pass('scheduler failure releases uninstalled geometry without touching shared source attributes');
const responsive=fixture();let heartbeat=false;setTimeout(()=>{heartbeat=true;},0);
const responsiveController=await hydrateAtriumGeometryPackAsync(responsive.baked,{manifest,binary},{expectedSourceArtifact:artifact});assert(heartbeat);assert(responsiveController.stats.hydrationYieldCount>0);responsiveController.dispose();pass('default asynchronous scheduler lets queued browser-style tasks run before final installation');
console.log(JSON.stringify({status:'PASS',checks,binaryBytes:binary.byteLength,entries:manifest.entries.length,hydrationMs:controller.stats.hydrationMs,asyncYields:yields,asyncMaxSliceMs:slicedController.stats.hydrationMaxSliceMs,asyncInstallMs:slicedController.stats.hydrationInstallMs}));
