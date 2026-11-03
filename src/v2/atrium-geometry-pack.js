import * as T from 'three';
import {createAtriumGeometryController,eligibleAtriumMesh,getAtriumGeometryState} from './atrium-geometry-quality.js';

// Pack storage contains only newly owned buffers. Original prepared attributes
// stay in the prepared world; every reduced level shares its full-level attrs.
// Transport handles compression and cryptographic checksums outside this codec.
export const ATRIUM_GEOMETRY_PACK_VERSION=1;
const TYPES={Float32Array,Float64Array,Uint32Array,Int32Array,Uint16Array,Int16Array,Uint8Array,Int8Array,Uint8ClampedArray};
const MAPS=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','aoMap','bumpMap','displacementMap'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const finiteArray=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
const requirePack=(test,message)=>{if(!test)throw Error('Atrium geometry pack: '+message);};
const bounds=g=>({box:g.boundingBox?[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()]:null,sphere:g.boundingSphere?[g.boundingSphere.center.toArray(),g.boundingSphere.radius]:null});
const renderFlags=o=>[o.renderOrder,o.layers.mask,o.castShadow,o.receiveShadow,o.frustumCulled];
const materialGuard=m=>[m.name,m.type,m.transparent,m.opacity,m.side,m.vertexColors,m.flatShading,MAPS.map(k=>!!m[k])];
const rawArray=a=>a.isInterleavedBufferAttribute?a.data.array:a.array;
const INSTALL=Symbol('validated-install');
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
function drain(steps){let step;do{step=steps.next();}while(!step.done);return step.value;}

function attributeSample(a){
 const array=rawArray(a),bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
 let hash=2166136261;
 for(let i=0;i<Math.min(bytes.length,128);i++)hash=Math.imul(hash^bytes[Math.floor(i*(bytes.length-1)/Math.max(1,Math.min(bytes.length,128)-1))],16777619);
 return hash>>>0;
}
function* geometryGuardSteps(g){
 let indexHash=2166136261;
 if(g.index)for(let start=0;start<g.index.count;start+=32768){const end=Math.min(g.index.count,start+32768);for(let i=start;i<end;i++)indexHash=Math.imul(indexHash^g.index.getX(i),16777619);yield;}
 return {name:g.name,type:g.type,attributes:Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([name,a])=>[name,rawArray(a).constructor.name,a.itemSize,a.count,a.normalized,a.gpuType,a.isInterleavedBufferAttribute?[a.data.stride,a.offset]:null,attributeSample(a)]),index:g.index?[g.index.array.constructor.name,g.index.count,indexHash>>>0]:null,range:[g.drawRange.start,Number.isFinite(g.drawRange.count)?g.drawRange.count:null],groups:g.groups,...bounds(g)};
}
const geometryGuard=g=>drain(geometryGuardSteps(g));
function bindingGuard(row,cache){
 let geometry=cache.get(row.original);if(!geometry){geometry=geometryGuard(row.original);cache.set(row.original,geometry);}
 return {name:row.o.name,geometry,matrix:row.matrix.toArray(),visible:row.visible,flags:renderFlags(row.o),material:materialGuard(row.o.material),band:[row.group.userData.band,row.group.userData.top??row.group.userData.band]};
}

export function exportAtriumGeometryPack(controller,{sourceArtifact,variant='desktop'}={}){
 const state=getAtriumGeometryState(controller);
 requirePack(state?.stats.ready,'optimizer is not ready');
 requirePack(typeof sourceArtifact==='string'&&sourceArtifact.length>0,'source artifact identity required');
 const arrays=[],payload=[],byBuffer=new WeakMap(),bindings=[],geometryCache=new WeakMap();let byteLength=0;
 const arrayRef=array=>{
  let views=byBuffer.get(array.buffer);if(!views)byBuffer.set(array.buffer,views=new Map());
  const key=[array.byteOffset,array.byteLength,array.constructor.name].join(':');if(views.has(key))return views.get(key);
  requirePack(Object.hasOwn(TYPES,array.constructor.name),'unsupported array type');
  byteLength=Math.ceil(byteLength/8)*8;const id=arrays.length;
  arrays.push({type:array.constructor.name,offset:byteLength,length:array.length,bytes:array.byteLength});payload.push(array);byteLength+=array.byteLength;views.set(key,id);return id;
 };
 const fullGeometry=g=>({attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>{requirePack(!a.isInterleavedBufferAttribute,'merged attributes must be compact');return[name,{array:arrayRef(a.array),itemSize:a.itemSize,normalized:a.normalized,gpuType:a.gpuType}];})),index:arrayRef(g.index.array),...bounds(g)});
 const entries=state.entries.map(entry=>({
  merged:entry.merged,
  sources:entry.rows.map(row=>{const id=bindings.length;bindings.push({bandKey:row.bandKey,childIndex:row.childIndex,guard:bindingGuard(row,geometryCache)});return id;}),
  full:entry.merged?fullGeometry(entry.full):null,
  localSphere:entry.localSphere?[entry.localSphere.center.toArray(),entry.localSphere.radius]:null,
  levels:entry.levels.map((level,i)=>({error:level.error,triangles:level.triangles,...(i?{index:arrayRef(level.geometry.index.array),...bounds(level.geometry)}:{})})),
 }));
 const binary=new Uint8Array(byteLength);for(let i=0;i<arrays.length;i++)binary.set(new Uint8Array(payload[i].buffer,payload[i].byteOffset,payload[i].byteLength),arrays[i].offset);
 return {manifest:{version:ATRIUM_GEOMETRY_PACK_VERSION,sourceArtifact,variant,binaryBytes:byteLength,arrays,bindings,entries,stats:{...state.stats}},binary};
}

// This entry point is called by the offline producer, never by the public walk.
export async function buildAtriumGeometryPack(baked,{sourceArtifact,variant='desktop',memoryBudgetBytes=(variant==='constrained'?48:128)*1024*1024,maxSimplifyMs=Infinity}={}){
 const {optimizeAtriumGeometry}=await import('./atrium-geometry-quality.js');
 const controller=await optimizeAtriumGeometry(baked,null,{memoryBudgetBytes,maxSimplifyMs});
 try{return exportAtriumGeometryPack(controller,{sourceArtifact,variant});}finally{controller.dispose();}
}

function applyBounds(g,descriptor){
 const box=descriptor.box,sphere=descriptor.sphere;
 requirePack(Array.isArray(box)&&box.length===2&&finiteArray(box[0],3)&&finiteArray(box[1],3)&&box[0].every((v,i)=>v<=box[1][i]),'invalid geometry bounds');
 requirePack(Array.isArray(sphere)&&sphere.length===2&&finiteArray(sphere[0],3)&&Number.isFinite(sphere[1])&&sphere[1]>=0,'invalid geometry sphere');
 g.boundingBox=new T.Box3(new T.Vector3(...box[0]),new T.Vector3(...box[1]));g.boundingSphere=new T.Sphere(new T.Vector3(...sphere[0]),sphere[1]);
}
function releaseGeometry(g){
 if(g.userData.atriumSharedAttributes)for(const name of Object.keys(g.attributes))g.deleteAttribute(name);
 g.dispose();
}

export function hydrateAtriumGeometryPack(baked,pack,options){return drain(prepareAtriumGeometryPack(baked,pack,options));}

// Public walks can keep rendering originals while validation/construction runs
// in short tasks. Both APIs execute the same checks and atomic installation.
export async function hydrateAtriumGeometryPackAsync(baked,pack,{yieldBudgetMs=8,yieldControl=yieldTask,...options}={}){
 requirePack(Number.isFinite(yieldBudgetMs)&&yieldBudgetMs>=0&&typeof yieldControl==='function','invalid hydration scheduler');
 const steps=prepareAtriumGeometryPack(baked,pack,options),started=performance.now();let checkpoint=started,workMs=0,maxSliceMs=0,yields=0;
 try{
  for(;;){
   const before=performance.now(),step=steps.next(),now=performance.now();workMs+=now-before;
   if(step.done){const stats=step.value.stats;stats.hydrationMs=now-started;stats.hydrationWorkMs=workMs;stats.hydrationYieldCount=yields;stats.hydrationMaxSliceMs=Math.max(maxSliceMs,now-checkpoint);return step.value;}
   if(step.value===INSTALL||now-checkpoint>=yieldBudgetMs){maxSliceMs=Math.max(maxSliceMs,now-checkpoint);await yieldControl();yields++;checkpoint=performance.now();}
  }
 }catch(error){try{steps.throw(error);}catch{/* Preparation cleans its uninstalled geometry. */}throw error;}
}

function* prepareAtriumGeometryPack(baked,{manifest,binary},{getQuality=()=> 'balanced',expectedSourceArtifact,memoryBudgetBytes=128*1024*1024}={}){
 const started=performance.now();
 requirePack(manifest?.version===ATRIUM_GEOMETRY_PACK_VERSION,'unsupported version');
 requirePack(typeof expectedSourceArtifact==='string'&&expectedSourceArtifact.length>0&&manifest.sourceArtifact===expectedSourceArtifact,'prepared source identity changed');
 requirePack(binary instanceof Uint8Array||binary instanceof ArrayBuffer,'binary payload required');
 binary=binary instanceof Uint8Array?binary:new Uint8Array(binary);
 requirePack(Number.isSafeInteger(manifest.binaryBytes)&&manifest.binaryBytes===binary.byteLength&&binary.byteLength<=memoryBudgetBytes,'payload size or memory budget mismatch');
 requirePack(Number.isFinite(manifest.stats?.memoryBytes)&&manifest.stats.memoryBytes<=memoryBudgetBytes&&manifest.stats.memoryBytes>=binary.byteLength,'retained memory budget exceeded');
 requirePack(Array.isArray(manifest.bindings)&&Array.isArray(manifest.entries)&&Array.isArray(manifest.arrays)&&manifest.entries.length<=10000&&manifest.bindings.length<=10000,'invalid entry table');
 if(binary.byteOffset%8){const aligned=new Uint8Array(binary.byteLength);for(let start=0;start<binary.byteLength;start+=1048576){aligned.set(binary.subarray(start,start+1048576),start);yield;}binary=aligned;}
 const rows=[],seen=new Set(),geometryCache=new WeakMap();
 // Validate all original bindings before constructing, hiding or replacing any
 // source. Appended live children are harmless; reordering/replacing one is not.
 for(const binding of manifest.bindings){
  const group=baked.bands.get(binding.bandKey),o=group?.children[binding.childIndex];
  requirePack(Number.isSafeInteger(binding.childIndex)&&binding.childIndex>=0&&o&&eligibleAtriumMesh(o),'source binding missing or no longer static');
  requirePack(!seen.has(o),'duplicate source binding');seen.add(o);
  o.updateWorldMatrix(true,false);
  const row={o,original:o.geometry,visible:o.visible,matrix:o.matrix.clone(),material:o.material,flags:renderFlags(o),group,bandKey:binding.bandKey,childIndex:binding.childIndex};
  if(!geometryCache.has(row.original))geometryCache.set(row.original,yield* geometryGuardSteps(row.original));
  requirePack(same(binding.guard,bindingGuard(row,geometryCache)),'source geometry, index, material or transform changed');rows.push(row);yield;
 }
 let previousEnd=0;
 const arrays=[];
 for(const record of manifest.arrays){
  const Type=TYPES[record.type];
  requirePack(Object.hasOwn(TYPES,record.type)&&Number.isSafeInteger(record.offset)&&record.offset>=previousEnd&&record.offset%8===0&&Number.isSafeInteger(record.length)&&record.length>=0&&record.bytes===record.length*Type.BYTES_PER_ELEMENT&&record.offset+record.bytes<=binary.byteLength,'invalid typed array range');
  previousEnd=record.offset+record.bytes;arrays.push(new Type(binary.buffer,binary.byteOffset+record.offset,record.length));yield;
 }
 requirePack(previousEnd===binary.byteLength,'unreferenced payload tail');
 const arrayAt=id=>{requirePack(Number.isSafeInteger(id)&&id>=0&&id<arrays.length,'missing array');return arrays[id];};
 const created=[],entries=[],ownedFull=[],usedRows=new Set(),installed=[];
 const makeIndex=function*(id,vertexCount,triangles){
  const values=arrayAt(id);requirePack((values instanceof Uint16Array||values instanceof Uint32Array)&&values.length>0&&values.length%3===0&&values.length/3===triangles,'invalid triangle indices');
  for(let start=0;start<values.length;start+=32768){const end=Math.min(values.length,start+32768);for(let i=start;i<end;i++)requirePack(values[i]<vertexCount,'index outside original vertex pool');yield;}
  return new T.BufferAttribute(values,1);
 };
 try{
  for(const descriptor of manifest.entries){
   requirePack(typeof descriptor.merged==='boolean'&&Array.isArray(descriptor.sources)&&descriptor.sources.length>=(descriptor.merged?2:1)&&(!descriptor.merged?descriptor.sources.length===1:true)&&Array.isArray(descriptor.levels)&&descriptor.levels.length>=1&&descriptor.levels.length<=3,'invalid entry');
   const sources=descriptor.sources.map(id=>{requirePack(Number.isSafeInteger(id)&&id>=0&&id<rows.length&&!usedRows.has(id),'invalid or repeated entry source');usedRows.add(id);return rows[id];}),first=sources[0].o;
   requirePack(sources.every(r=>r.group===sources[0].group&&r.o.material===first.material&&same(renderFlags(r.o),renderFlags(first))),'merge ownership changed');
   let full,mesh;
   if(descriptor.merged){
    requirePack(descriptor.full&&typeof descriptor.full.attributes==='object','missing merged geometry');
    full=new T.BufferGeometry();created.push(full);ownedFull.push(full);
    for(const[name,a]of Object.entries(descriptor.full.attributes)){
     const array=arrayAt(a.array);requirePack(Number.isSafeInteger(a.itemSize)&&a.itemSize>=1&&a.itemSize<=4&&array.length%a.itemSize===0&&typeof a.normalized==='boolean','invalid merged attribute');
     const attribute=new T.BufferAttribute(array,a.itemSize,a.normalized);attribute.gpuType=a.gpuType;full.setAttribute(name,attribute);
    }
    requirePack(full.attributes.position?.itemSize===3&&full.attributes.position.count>0&&Object.values(full.attributes).every(a=>a.count===full.attributes.position.count),'attribute vertex counts differ');
    full.setIndex(yield* makeIndex(descriptor.full.index,full.attributes.position.count,descriptor.levels[0].triangles));applyBounds(full,descriptor.full);
    mesh=new T.Mesh(full,first.material);mesh.name='V2_atrium_merged_'+first.material.name;mesh.matrixAutoUpdate=false;mesh.renderOrder=first.renderOrder;mesh.layers.mask=first.layers.mask;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.frustumCulled=first.frustumCulled;
    mesh.userData={noCollide:true,renderOnly:true,atriumGeometryQuality:true,sources:sources.map(r=>r.o.uuid)};
   }else{
    requirePack(descriptor.full===null,'standalone full geometry must reference prepared source');full=sources[0].original;mesh=first;
    requirePack(descriptor.levels[0].triangles===Math.min((full.index?.count??full.attributes.position.count)-full.drawRange.start,full.drawRange.count)/3,'full triangle count changed');
   }
   const levels=[];
   for(const[i,level]of descriptor.levels.entries()){
    requirePack(Number.isFinite(level.error)&&level.error>=0&&Number.isSafeInteger(level.triangles)&&level.triangles>0&&(!i?level.error===0:level.triangles<descriptor.levels[i-1].triangles),'invalid LOD level');
    if(!i){levels.push({geometry:full,error:0,triangles:level.triangles});continue;}
    const geometry=new T.BufferGeometry();geometry.userData.atriumSharedAttributes=true;created.push(geometry);
    for(const[name,a]of Object.entries(full.attributes))geometry.setAttribute(name,a);
    geometry.setIndex(yield* makeIndex(level.index,full.attributes.position.count,level.triangles));applyBounds(geometry,level);
    levels.push({geometry,error:level.error,triangles:level.triangles});yield;
   }
   const local=descriptor.localSphere??(descriptor.merged?descriptor.full.sphere:null);
   requirePack(Array.isArray(local)&&finiteArray(local[0],3)&&Number.isFinite(local[1])&&local[1]>=0,'missing local sphere');
   entries.push({mesh,rows:sources,full,merged:descriptor.merged,levels,level:0,localSphere:new T.Sphere(new T.Vector3(...local[0]),local[1])});yield;
  }
  requirePack(usedRows.size===rows.length,'unbound source table entries');
  yield INSTALL;
  // Public preparation can span frames. Never install over a source that was
  // replaced, moved or hidden while the asynchronous work yielded.
  for(const row of rows){
   if(row.o.matrixAutoUpdate)row.o.updateMatrix();
   requirePack(row.group.children[row.childIndex]===row.o&&row.o.geometry===row.original&&row.o.visible===row.visible&&row.o.material===row.material&&same(renderFlags(row.o),row.flags)&&row.o.matrix.equals(row.matrix),'source changed during preparation');
   for(let p=row.o;p;p=p.parent)requirePack(!p.userData.keepLive,'source became live during preparation');
  }
  // All validation has succeeded. Install atomically, then freeze only the new
  // fixed meshes; the already-settled source world and its live children stay put.
  const installStarted=performance.now();
  for(const entry of entries)if(entry.merged){installed.push(entry);entry.rows[0].group.add(entry.mesh);entry.mesh.updateWorldMatrix(true,false,true);for(const r of entry.rows)r.o.visible=false;entry.mesh.matrixWorldAutoUpdate=false;entry.mesh.updateMatrixWorld=()=>{};}
  const stats={...manifest.stats,enabled:true,ready:true,precomputed:true,variant:manifest.variant,buildMs:0,offlineBuildMs:manifest.stats.buildMs,hydrationMs:performance.now()-started,selectedTriangles:manifest.stats.fullTriangles,lodInstances:0,lodSwitches:0,quality:'high'};
  const controller=createAtriumGeometryController({baked,entries,ownedFull,stats},{getQuality});stats.hydrationInstallMs=performance.now()-installStarted;stats.hydrationMs=performance.now()-started;return controller;
 }catch(error){
  for(const entry of installed){for(const row of entry.rows){row.o.visible=row.visible;row.o.geometry=row.original;}entry.mesh.removeFromParent();}
  // LOD attributes must be detached before their owned full geometry is freed.
  for(const geometry of [...created].reverse())releaseGeometry(geometry);
  throw error;
 }
}
