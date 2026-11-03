import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createDetailViewGuard} from './detail-lod.js';

// Render-only copies of fixed baked meshes. The original geometry, collision
// references, source ranges and overlapping band ownership remain authoritative.
const ART=/painting|mural|artwork|decal|logo|poster|comic|sign|screen|Lounge_/i;
const MAPS=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','aoMap','bumpMap','displacementMap'];
const yieldWork=()=>new Promise(resolve=>setTimeout(resolve,0));
const triangles=g=>(g.index?.count??g.attributes.position.count)/3;
const drawnTriangles=g=>Math.max(0,Math.min((g.index?.count??g.attributes.position.count)-g.drawRange.start,g.drawRange.count))/3;
const raw=(a,i,k)=>a.isInterleavedBufferAttribute?a.data.array[i*a.data.stride+a.offset+k]:a.array[i*a.itemSize+k];
const arrayType=a=>(a.isInterleavedBufferAttribute?a.data.array:a.array).constructor;
const signature=g=>Object.entries(g.attributes).map(([k,a])=>[k,a.itemSize,a.normalized,arrayType(a).name,a.gpuType].join(':')).sort().join('|');
const bytesPerVertex=g=>Object.values(g.attributes).reduce((sum,a)=>sum+a.itemSize*arrayType(a).BYTES_PER_ELEMENT,0);
const memory=g=>g.attributes.position.count*bytesPerVertex(g)+(g.index?.count||0)*4;
const inert=stats=>({update(){},setEnabled(){},dispose(){},stats});
const sourceVertices=new WeakMap();
const geometryStates=new WeakMap();
let MeshoptSimplifier;
// Generation is an authoring/build concern. Pack hydration never initializes WASM.
export async function initializeAtriumSimplifier(){
 if(!MeshoptSimplifier)({MeshoptSimplifier}=await import('meshoptimizer/simplifier'));
 if(!MeshoptSimplifier.supported)return false;
 await MeshoptSimplifier.ready;return true;
}
export const getAtriumGeometryState=controller=>geometryStates.get(controller);
export function atriumScaleBound(matrix){
 const e=matrix.elements,frobenius=Math.hypot(e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10]);
 const norm1=Math.max(Math.abs(e[0])+Math.abs(e[1])+Math.abs(e[2]),Math.abs(e[4])+Math.abs(e[5])+Math.abs(e[6]),Math.abs(e[8])+Math.abs(e[9])+Math.abs(e[10]));
 const normInfinity=Math.max(Math.abs(e[0])+Math.abs(e[4])+Math.abs(e[8]),Math.abs(e[1])+Math.abs(e[5])+Math.abs(e[9]),Math.abs(e[2])+Math.abs(e[6])+Math.abs(e[10]));
 return Math.min(frobenius,Math.sqrt(norm1*normInfinity));
}

export function compactAtriumGeometry(source,indices=null){
 const sourceCount=source.index?.count??source.attributes.position.count;
 const start=indices?0:Math.max(0,Math.min(sourceCount,source.drawRange.start));
 const count=indices?indices.length:Math.max(0,Math.min(sourceCount-start,source.drawRange.count));
 if(start%3||count%3)throw Error('Atrium render range must contain whole triangles');
 const ids=[],remap=new Map(),out=new Uint32Array(count);
 for(let i=0;i<count;i++){
  const id=indices?indices[i]:source.index?source.index.getX(start+i):start+i;
  let mapped=remap.get(id);if(mapped===undefined){mapped=ids.length;ids.push(id);remap.set(id,mapped);}out[i]=mapped;
 }
 const g=new T.BufferGeometry();
 for(const[name,a]of Object.entries(source.attributes)){
  const values=new (arrayType(a))(ids.length*a.itemSize);
  for(let i=0;i<ids.length;i++)for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=raw(a,ids[i],k);
  const attribute=new T.BufferAttribute(values,a.itemSize,a.normalized);attribute.gpuType=a.gpuType;g.setAttribute(name,attribute);
 }
 g.setIndex(new T.BufferAttribute(out,1));g.computeBoundingBox();g.computeBoundingSphere();sourceVertices.set(g,Uint32Array.from(ids));return g;
}

export function eligibleAtriumMesh(o){
 const g=o.geometry,m=o.material;
 if(!o.visible||!o.isMesh||o.isInstancedMesh||o.isBatchedMesh||o.isSkinnedMesh||!g?.attributes.position?.count||Array.isArray(m)||!m||m.transparent||m.opacity<1||m.isShaderMaterial||m.name.startsWith('P4_menu_deck_'))return false;
 // Fast room patches retain empty source chunks so existing child bindings stay
 // stable. Those chunks own pooled vertices, but have no renderable triangles.
 if(!(drawnTriangles(g)>0))return false;
 if(Object.keys(g.morphAttributes||{}).length||g.attributes.skinIndex||g.attributes.skinWeight||o.onBeforeRender!==T.Object3D.prototype.onBeforeRender||o.onAfterRender!==T.Object3D.prototype.onAfterRender)return false;
 for(let p=o;p;p=p.parent)if(p.userData.keepLive)return false;
 o.updateWorldMatrix(true,false);const determinant=o.matrixWorld.determinant();if(!Number.isFinite(determinant)||determinant<=0)return false;
 return !ART.test(o.name+' '+m.name)&&!(g.userData.preparedRanges||[]).some(r=>ART.test(r.name));
}

// Attribute-aware simplification changes indices only. LockBorder preserves
// open boundaries, including holes and seams; no permissive/sloppy/prune mode.
export function simplifyAtriumGeometry(g,error,ratio=.5){
 const n=g.attributes.position.count,position=new Float32Array(n*3),channels=[];
 for(const name of ['normal','color','uv','uv1']){const a=g.attributes[name];if(a)for(let k=0;k<a.itemSize;k++)channels.push({a,k,weight:name==='normal'?.25:name==='color'?1:4});}
 for(let i=0;i<n;i++)for(let k=0;k<3;k++)position[i*3+k]=g.attributes.position.getComponent(i,k);
 const attributes=new Float32Array(n*channels.length);
 for(let i=0;i<n;i++)for(let k=0;k<channels.length;k++)attributes[i*channels.length+k]=channels[k].a.getComponent(i,channels[k].k);
 const indices=Uint32Array.from(g.index.array),target=Math.max(3,Math.floor(indices.length*ratio/3)*3),flags=['LockBorder','ErrorAbsolute'];
 const [result,actualError]=channels.length?MeshoptSimplifier.simplifyWithAttributes(indices,position,3,attributes,channels.length,channels.map(c=>c.weight),null,target,error,flags):MeshoptSimplifier.simplify(indices,position,3,target,error,flags);
 if(!result.length||result.length>=indices.length*.9||!Number.isFinite(actualError)||actualError>error*1.001)return null;
 const geometry=compactAtriumGeometry(g,result);return {geometry,error:actualError,triangles:result.length/3};
}

// LODs share immutable vertex buffers; only their index buffer is new. Detach
// shared attributes before disposal so Three does not release a source VBO.
function sharedLOD(full,analysis,reduced){
 const toAnalysis=sourceVertices.get(reduced.geometry),toSource=full===analysis?null:sourceVertices.get(analysis),indices=new Uint32Array(reduced.geometry.index.count);
 for(let i=0;i<indices.length;i++){const id=toAnalysis[reduced.geometry.index.getX(i)];indices[i]=toSource?toSource[id]:id;}
 const g=new T.BufferGeometry();for(const[name,a]of Object.entries(full.attributes))g.setAttribute(name,a);
 g.setIndex(new T.BufferAttribute(indices,1));g.boundingBox=reduced.geometry.boundingBox.clone();g.boundingSphere=reduced.geometry.boundingSphere.clone();g.userData.atriumSharedAttributes=true;
 reduced.geometry.dispose();return {...reduced,geometry:g,bytes:indices.byteLength+128};
}
function disposeLOD(g){if(g.userData.atriumSharedAttributes)for(const name of Object.keys(g.attributes))g.deleteAttribute(name);g.dispose();}

export async function optimizeAtriumGeometry(baked,renderer,{getQuality=()=> 'balanced',memoryBudgetBytes,maxSimplifyMs}={}){
 const constrained=typeof navigator!=='undefined'&&((navigator.deviceMemory||8)<=4||(navigator.hardwareConcurrency||8)<=4);
 const budget=memoryBudgetBytes??(constrained?48:128)*1024*1024,simplifyBudget=maxSimplifyMs??(constrained?800:3500);
 const stats={enabled:true,ready:false,fallback:false,strategy:'static-spatial-merge',extensionIndependent:true,batches:0,sources:0,mergedSources:0,unmergedLOD:0,lodGeometries:0,memoryBytes:0,budgetBytes:budget,fullTriangles:0,selectedTriangles:0,lodInstances:0,lodSwitches:0,skipped:0,buildMs:0,simplificationMs:0,quality:'balanced'};
 if(globalThis.__leoPreparedBuild){stats.skippedAuthoring=true;return inert(stats);}
 const started=performance.now(),clusters=[],candidates=[],entries=[],ownedFull=[];
 let checkpoint=started;
 const pause=async()=>{if(performance.now()-checkpoint>16){await yieldWork();checkpoint=performance.now();}};
 let simplifierReady=false;try{simplifierReady=await initializeAtriumSimplifier();}catch{/* Exact rendering remains available without WASM. */}
 for(const[bandKey,group]of baked.bands){
  const {band,top=band}=group.userData;if(!Number.isFinite(band)||top<5)continue;
  const buckets=new Map();
  for(const[childIndex,o]of [...group.children].entries()){
   if(!eligibleAtriumMesh(o))continue;
   const box=(o.geometry.boundingBox||new T.Box3().setFromBufferAttribute(o.geometry.attributes.position)).clone().applyMatrix4(o.matrix),center=box.getCenter(new T.Vector3());
   const row={o,original:o.geometry,visible:o.visible,matrix:o.matrix.clone(),group,bandKey,childIndex,used:false};candidates.push(row);
   if(!Number.isFinite(center.x)||!Number.isFinite(center.z))continue;
   // Independent room material tables can retain the same serialized UUID.
   // Only the actual shared material object is safe to merge.
   const key=[o.material.id,o.renderOrder,o.layers.mask,o.castShadow,o.receiveShadow,o.frustumCulled,signature(o.geometry),Math.floor(center.x/80),Math.floor(center.z/80)].join('|');
   let list=buckets.get(key);if(!list)buckets.set(key,list=[]);list.push(row);
  }
  for(const list of buckets.values())if(list.length>=2){
   for(let i=0;i<list.length;i+=32){const rows=list.slice(i,i+32);if(rows.length<2)continue;const estimate=rows.reduce((sum,r)=>sum+(r.original.index?.count??r.original.attributes.position.count)*(bytesPerVertex(r.original)+4),0);clusters.push({group,rows,estimate});}
  }
 }
 // Keep room for index-only LODs on the large chunks that cannot profitably be
 // merged. Small merges offer the most submission savings per retained byte.
 const mergeBudget=budget*.75;clusters.sort((a,b)=>(b.rows.length-1)/b.estimate-(a.rows.length-1)/a.estimate);
 for(const {group,rows,estimate}of clusters){
  if(estimate>mergeBudget-stats.memoryBytes){stats.skipped+=rows.length;continue;}
  const parts=[];let merged=null;
  try{
   for(const r of rows){const g=compactAtriumGeometry(r.original);g.applyMatrix4(r.matrix);parts.push(g);await pause();}
   merged=mergeGeometries(parts,false);if(!merged)throw Error('Incompatible static merge');merged.computeBoundingBox();merged.computeBoundingSphere();
   const bytes=memory(merged)+192;if(bytes>mergeBudget-stats.memoryBytes){merged.dispose();merged=null;continue;}
   const first=rows[0].o,mesh=new T.Mesh(merged,first.material);mesh.name='V2_atrium_merged_'+first.material.name;
   mesh.matrixAutoUpdate=false;mesh.renderOrder=first.renderOrder;mesh.layers.mask=first.layers.mask;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.frustumCulled=first.frustumCulled;
   mesh.userData={noCollide:true,renderOnly:true,atriumGeometryQuality:true,sources:rows.map(r=>r.o.uuid)};
   group.add(mesh);mesh.updateWorldMatrix(true,false,true);for(const r of rows){r.used=true;r.o.visible=false;}
   entries.push({mesh,rows,full:merged,merged:true,levels:[{geometry:merged,error:0,triangles:triangles(merged)}],level:0});ownedFull.push(merged);stats.memoryBytes+=bytes;stats.batches++;stats.mergedSources+=rows.length;
  }catch{merged?.dispose();stats.skipped+=rows.length;}
  finally{for(const p of parts)p.dispose();}
  await pause();
 }
 // Unmerged sources retain their exact high geometry. A coarser level adds an
 // index array only, reusing the prepared pool's immutable vertex attributes.
 for(const r of candidates)if(!r.used)entries.push({mesh:r.o,rows:[r],full:r.original,merged:false,levels:[{geometry:r.original,error:0,triangles:drawnTriangles(r.original)}],level:0});
 const ordered=[...entries].sort((a,b)=>b.levels[0].triangles-a.levels[0].triangles);
 for(const entry of ordered){
  const full=entry.full,count=entry.levels[0].triangles*3;
  if(!simplifierReady||MAPS.some(k=>entry.mesh.material[k])||count<600||count>600000||stats.simplificationMs>=simplifyBudget)continue;
  // Bound temporary simplifier copies as well as retained render buffers.
  if(count*(bytesPerVertex(full)+4)>budget||stats.memoryBytes+count*.25*4>budget)continue;
  let analysis;try{analysis=entry.merged?full:compactAtriumGeometry(full);entry.localSphere=analysis.boundingSphere.clone();}catch{continue;}
  try{
   for(const[error,ratio]of [[.015,.5],[.05,.25]]){
    if(stats.simplificationMs>=simplifyBudget)break;
    const t=performance.now();let reduced=null;try{reduced=simplifyAtriumGeometry(analysis,error,ratio);}catch{/* Invalid topology stays exact. */}stats.simplificationMs+=performance.now()-t;
    if(reduced){
     const bytes=reduced.geometry.index.count*4+128;
     if(reduced.triangles>=entry.levels.at(-1).triangles*.95||stats.memoryBytes+bytes>budget)reduced.geometry.dispose();
     else{const lod=sharedLOD(full,analysis,reduced);entry.levels.push(lod);stats.memoryBytes+=lod.bytes;}
    }
    await pause();
   }
  }finally{if(analysis!==full)analysis.dispose();}
 }
 for(let i=entries.length-1;i>=0;i--)if(!entries[i].merged&&entries[i].levels.length===1)entries.splice(i,1);
 stats.sources=entries.reduce((sum,e)=>sum+e.rows.length,0);stats.unmergedLOD=entries.filter(e=>!e.merged).length;stats.lodGeometries=entries.reduce((sum,e)=>sum+e.levels.length-1,0);stats.fullTriangles=entries.reduce((sum,e)=>sum+e.levels[0].triangles,0);stats.selectedTriangles=stats.fullTriangles;stats.buildMs=performance.now()-started;stats.ready=true;
 return createAtriumGeometryController({baked,entries,ownedFull,stats},{getQuality});
}

// The lightweight controller is shared by offline-generated packs and authoring.
export function createAtriumGeometryController(state,{getQuality=()=> 'balanced'}={}){
 const{entries,ownedFull,stats}=state;
 let enabled=true,disposed=false,last=-Infinity,lastQuality=null,lastHeight=null,force=true,viewGuard=createDetailViewGuard();
 for(const entry of entries){
  entry.mesh.updateWorldMatrix(true,false);entry.scale=atriumScaleBound(entry.mesh.matrixWorld);
  const local=entry.merged?entry.full.boundingSphere:entry.localSphere;
  entry.sphere=local.clone();entry.sphere.center.applyMatrix4(entry.mesh.matrixWorld);entry.sphere.radius*=entry.scale;
 }
 const choose=(e,camera,height,quality)=>{
  if(quality==='high'||e.levels.length===1||!Number.isFinite(height)||height<=0)return 0;
  const m=camera.matrixWorldInverse.elements,c=e.sphere.center,depth=-(m[2]*c.x+m[6]*c.y+m[10]*c.z+m[14]),near=depth-e.sphere.radius;
  if(!camera.isPerspectiveCamera||!Number.isFinite(near)||near<=camera.near||!Number.isFinite(camera.projectionMatrix.elements[5])||!camera.projectionMatrix.elements[5])return 0;
  const minDistance=quality==='performance'?30:55,pixels=quality==='performance'?1.25:.65;
  if(near<minDistance*(e.level?.9:1))return 0;
  const x=m[0]*c.x+m[4]*c.y+m[8]*c.z+m[12],y=m[1]*c.x+m[5]*c.y+m[9]*c.z+m[13],projection=height*.5*Math.abs(camera.projectionMatrix.elements[5])/near*(1+Math.hypot(x,y)/near);
  for(let i=e.levels.length-1;i>0;i--)if(e.levels[i].error*e.scale*projection<=pixels*(i<=e.level?1.15:.85))return i;
  return 0;
 };
 const controller={
  stats,
  update(camera,pixelHeight=720){
   if(disposed||!enabled)return;camera.updateMatrixWorld(true);const requested=getQuality(),quality=['high','balanced','performance'].includes(requested)?requested:'balanced',now=performance.now(),change=quality!==lastQuality||pixelHeight!==lastHeight;
   if(!force&&!change&&!viewGuard.changed(camera)&&now-last<150)return;
   last=now;lastQuality=quality;lastHeight=pixelHeight;force=false;viewGuard.commit(camera);stats.quality=quality;stats.selectedTriangles=0;stats.lodInstances=0;
   for(const e of entries){const level=choose(e,camera,pixelHeight,quality);if(level!==e.level){e.level=level;stats.lodSwitches++;e.mesh.geometry=e.levels[level].geometry;}stats.selectedTriangles+=e.levels[level].triangles;if(level)stats.lodInstances++;}
  },
  setEnabled(value){
   if(disposed||enabled===!!value)return;enabled=!!value;stats.enabled=enabled;force=true;
   for(const e of entries){if(e.merged){e.mesh.visible=enabled;for(const r of e.rows)r.o.visible=enabled?false:r.visible;}else e.mesh.geometry=enabled?e.levels[e.level].geometry:e.full;}
   stats.selectedTriangles=enabled?entries.reduce((s,e)=>s+e.levels[e.level].triangles,0):stats.fullTriangles;
  },
  dispose(){
   if(disposed)return;disposed=true;for(const e of entries){for(const r of e.rows){r.o.visible=r.visible;r.o.geometry=r.original;}if(e.merged)e.mesh.removeFromParent();for(const lod of e.levels.slice(1))disposeLOD(lod.geometry);}for(const g of ownedFull)g.dispose();stats.enabled=false;
  },
 };geometryStates.set(controller,state);return controller;
}
