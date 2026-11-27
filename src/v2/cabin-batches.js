import * as T from 'three';
import {compactRenderGeometry} from './facade.js';
import {keepsGeometry} from './shader-hooks.js';
import {yieldEvery} from './yield-to-page.js';

// The repeated cabins' opaque parts, one draw per material. Each cabin part is an instanced mesh per deck, cabin template
// and part (main.public.js `instanced`: the walls and doors of a deck's cabins, and the fittings of the cabins nearest the
// walker), and parts of different templates that look the same share a material (share-materials.js) but still drew
// apart: the Quiet Grove café drew about 120 of them over 24 materials. Here every material's parts become one
// BatchedMesh drawn with ONE instanced multi-draw: a sub-draw per part drawn this frame, its own instances by
// gl_InstanceID. (three's own BatchedMesh path draws one sub-draw per instance, thousands of them at a café.)
//
// The parts stay what the rest of the walk works on: cull() still shows a deck's parts and re-ranks the fittings,
// atrium-rooms.js and atrium-room-views.js, cabin-privacy.js's doors, the owner bake's hiding, the fog cull and group
// occlusion still act on them. Only the main camera's pass changes: just before it (scene.onBeforeRender) each part that
// three would draw (shown, on the camera's layers, its instances' sphere in the view, not left out by group occlusion)
// is hidden for the pass and its instances drawn by its material's batch instead; around() puts them back. A part's
// instance matrices are copied into its slots of the batch's matrix texture whenever they change (only the changed rows
// upload). Every other camera (the room views' capture, photos, the prank camera) draws the parts themselves.
//
// The batch's material is a copy of the parts' own that keeps its id, so the batch sorts exactly where the parts did and
// the frame is unchanged. It follows the original: its values are copied over when they differ (within a few frames), its shader hook
// is the original's (whatever corner shading or the film look made of it) with the batch's matrix lookup added, and it
// is rebuilt whenever the original is. (A material made with Object.create(original) followed by itself, but made every
// property three reads per draw a prototype lookup: about 7 µs more a draw.) Only for opaque materials with three's own
// shading: glass drawn in one batch would change the order it blends in.
//
// Desktop only (WEBGL_multi_draw with its instanced draw). Measured 2026-11-26 (RTX 3080, 1920x1080): the Quiet Grove
// draws 71 fewer, the Deck 6 neighbourhood café 56, the Daily Grind 33. A draw that changes material costs three about
// 10 µs and one that repeats the last material about 3 µs, and a batch is always a change, so the main pass gains only
// about 0.15-0.2 ms at the Grove.
export const CHUNK=`
#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) + float( gl_InstanceID ) );
#endif
`;
const plainHook=T.Material.prototype.onBeforeCompile,plainRender=T.Material.prototype.onBeforeRender;
// Parts with more indices than this (a deck's whole lining as one instance) draw on their own: a batch keeps its own
// copy of every part's geometry.
const MAX_INDICES=60000;
const textured=m=>Object.entries(m).some(([k,v])=>v?.isTexture&&k!=='envMap');
export function batchable(m){
 return !!m&&(m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial||m.isMeshBasicMaterial)&&!m.transparent&&!m.transmission&&!m.wireframe&&!m.displacementMap
  &&(m.blending===T.NormalBlending||m.blending===T.NoBlending)&&m.onBeforeRender===plainRender&&(m.onBeforeCompile===plainHook||m.onBeforeCompile?.keepsGeometry===true)
  &&Object.entries(m).every(([k,v])=>!v?.isTexture||k==='envMap'||(v.channel??0)===0);
}
const identity=e=>e[0]===1&&e[1]===0&&e[2]===0&&e[3]===0&&e[4]===0&&e[5]===1&&e[6]===0&&e[7]===0&&e[8]===0&&e[9]===0&&e[10]===1&&e[11]===0&&e[12]===0&&e[13]===0&&e[14]===0&&e[15]===1;
// What a part's geometry must carry for its material, in one order: one batch takes parts with the same.
export const kept=m=>['position','normal',...(textured(m)?['uv']:[]),...(m.vertexColors?['color']:[])];
function part(o){
 const g=o.geometry,m=o.material;
 if(!o.isInstancedMesh||!o.userData.cabins||o.userData.boat||Array.isArray(m)||!batchable(m)||o.instanceColor||!o.frustumCulled)return null;
 if(o.onBeforeRender!==T.Object3D.prototype.onBeforeRender||o.onAfterRender!==T.Object3D.prototype.onAfterRender)return null;
 if(!g.index?.array||g.index.count>MAX_INDICES||g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.morphAttributes).length)return null;
 const names=kept(m);
 if(!names.every(k=>g.attributes[k]?.array&&!g.attributes[k].isInterleavedBufferAttribute))return null;
 return names.map(k=>{const a=g.attributes[k];return k+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name;}).join(',');
}
// Own values of a material that its batch copy takes over (not its identity, version, listeners or shader hooks).
const OWN=new Set(['uuid','id','version','_listeners','onBeforeCompile','customProgramCacheKey']);
const ownKeys=(m,omit=null)=>Object.keys(m).filter(k=>!OWN.has(k)&&!omit?.has(k));
// `omit`: values the copy keeps as its own (a palette's maps and the values they stand in for).
export function batchMaterial(m,omit=null){
 const copy=Object.create(Object.getPrototypeOf(m));
 Object.defineProperty(copy,'id',{value:m.id});
 const keys=ownKeys(m,omit);for(const k of keys)copy[k]=m[k];
 copy.uuid=T.MathUtils.generateUUID();copy.version=0;
 // The original's hook, whatever it is when the shader is built, then the batch's lookup. Marked as corner-shaded and
 // film-looked so neither wraps it again: both reach it through the original's hook.
 const hook=function(shader,renderer){m.onBeforeCompile.call(this,shader,renderer);shader.vertexShader=shader.vertexShader.replace('#include <batching_vertex>',CHUNK);};
 hook.cornerShade=true;hook.filmLook=true;hook.keepsGeometry=keepsGeometry(m.onBeforeCompile);
 const key=function(){return m.customProgramCacheKey.call(m)+'|cabin-instanced';};
 copy.onBeforeCompile=hook;copy.customProgramCacheKey=key;
 return {m,copy,keys,hook,key,omit,version:m.version,usable:true,pass:-1};
}
// Rebuilt (and checked again) whenever the original is; its values copied over when they differ: at once after a rebuild,
// else for one material a pass, in turn (a value changed without a rebuild shows in its batch within a few frames).
export function follow(v,turn){
 const {m,copy}=v;let all=turn;
 if(m.version!==v.version){v.version=m.version;v.keys=ownKeys(m,v.omit);v.usable=batchable(m);v.hook.keepsGeometry=keepsGeometry(m.onBeforeCompile);copy.needsUpdate=true;all=true;}
 if(all)for(const k of v.keys)if(copy[k]!==m[k])copy[k]=m[k];
 if(copy.onBeforeCompile!==v.hook||copy.customProgramCacheKey!==v.key){copy.onBeforeCompile=v.hook;copy.customProgramCacheKey=v.key;copy.needsUpdate=true;}
}

// three draws a batch with the extension's multiDrawElementsWEBGL (WebGLIndexedBufferRenderer); for a cabin batch's own
// lists it becomes the instanced call with the batch's instance counts. Keyed by the batch's counts array, so nothing
// else three draws is touched. Three counts each sub-draw's triangles once: the other instances are added for Stats.
const instancedLists=new WeakMap();
export function instancedMultiDraw(renderer){
 const ext=renderer.extensions.has('WEBGL_multi_draw')?renderer.extensions.get('WEBGL_multi_draw'):null;
 if(!ext||typeof ext.multiDrawElementsInstancedWEBGL!=='function')return null;
 let lists=instancedLists.get(ext);if(lists)return lists;
 lists=new WeakMap();instancedLists.set(ext,lists);
 const plain=ext.multiDrawElementsWEBGL,info=renderer.info.render;
 ext.multiDrawElementsWEBGL=function(mode,counts,countsOffset,type,offsets,offsetsOffset,drawCount){
  const instances=lists.get(counts);if(!instances)return plain.apply(this,arguments);
  ext.multiDrawElementsInstancedWEBGL(mode,counts,countsOffset,type,offsets,offsetsOffset,instances,0,drawCount);
  let more=0;for(let i=0;i<drawCount;i++)more+=counts[countsOffset+i]*(instances[i]-1);info.triangles+=more/3;
 };
 return lists;
}

/** `parts`: the walk's instanced meshes (cabin parts carry userData.cabins). `skip(o)`: a part group occlusion leaves out
 * of this frame (it then draws, or not, as before). `nearSlots`: the most cabins cull() packs into a fitting.
 * Returns null without the instanced multi-draw, else {stats, around(view, draw)}. stats.folded: draws the last main pass
 * made fewer (parts batched less batches drawn), for quad-facing.js's count of what the frame would have drawn. */
export async function createCabinBatches(scene,renderer,parts,{skip=null,nearSlots=40}={}){
 const lists=instancedMultiDraw(renderer);if(!lists)return null;
 const yieldWork=yieldEvery(),byKey=new Map(),variants=new Map();
 for(const o of parts){const attributes=part(o);if(!attributes)continue;
  const key=o.material.uuid+'|'+o.renderOrder+'|'+o.layers.mask+'|'+attributes;let set=byKey.get(key);
  if(!set)byKey.set(key,set={m:o.material,order:o.renderOrder,layers:o.layers.mask,rows:[]});set.rows.push(o);}
 const batches=[],compact=new Map(),stats={batches:0,parts:0,slots:0,shown:0,folded:0,skipped:0,ms:0};
 for(const set of byKey.values()){
  if(set.rows.length<2)continue;
  const names=kept(set.m),geometries=[...new Set(set.rows.map(o=>o.geometry))];
  // Only the vertices each part's index uses (they index pools shared by many parts), only the attributes drawn.
  const copies=geometries.map(g=>{let c=compact.get(g);if(!c){const view=new T.BufferGeometry();for(const k of names)view.setAttribute(k,g.attributes[k]);view.setIndex(g.index);c=compactRenderGeometry(view,{bounds:false});compact.set(g,c);}return c;});
  let slots=0;const rows=set.rows.map(o=>{const r={o,head:slots,slots:o.userData.near?nearSlots:o.instanceMatrix.count,version:-1,count:-1};slots+=r.slots;return r;});
  const vertices=copies.reduce((s,g)=>s+g.attributes.position.count,0),indices=copies.reduce((s,g)=>s+g.index.count,0);
  let v=variants.get(set.m);if(!v)variants.set(set.m,v=batchMaterial(set.m));
  const batch=new T.BatchedMesh(slots,vertices,indices,v.copy);
  batch.name='V2_cabin_batch '+set.m.name;batch.renderOrder=set.order;batch.layers.mask=set.layers;
  batch.sortObjects=false;batch.perObjectFrustumCulled=false;batch.frustumCulled=false;batch.matrixAutoUpdate=false;batch.visible=false;
  batch.userData={noCollide:true,renderOnly:true,cabinBatch:true};
  const ids=new Map(geometries.map((g,i)=>[g,batch.addGeometry(copies[i])]));
  const bytes=batch.geometry.index.array.BYTES_PER_ELEMENT;
  for(const r of rows){const info=batch._geometryInfo[ids.get(r.o.geometry)];r.start=info.start*bytes;r.count3=info.count;}
  // The batch's lists are written here each main pass, not by BatchedMesh from instances (it has none): sub-draw i
  // reads its first matrix at indirect[i] (a small texture of its own) and the rest after it.
  batch.onBeforeRender=()=>{};
  const old=batch._indirectTexture,width=16,indirect=new Uint32Array(width*Math.ceil(rows.length/width));
  batch._indirectTexture=new T.DataTexture(indirect,width,indirect.length/width,old.format,old.type);batch._indirectTexture.needsUpdate=true;old.dispose();
  const instances=new Int32Array(rows.length);lists.set(batch._multiDrawCounts,instances);
  // For three's sort only (its parts sat at the origin too); never culled as a whole.
  batch.boundingSphere=new T.Sphere(new T.Vector3(),1e6);
  scene.add(batch);batches.push({batch,v,rows,indirect,instances,drawn:[]});
  stats.batches++;stats.parts+=rows.length;stats.slots+=slots;await yieldWork();
 }
 for(const g of compact.values())g.dispose();
 if(!batches.length)return null;
 const materialCopies=[...new Set(batches.map(B=>B.v))];
 let mainCamera=null,pass=0,lost=false;
 renderer.domElement?.addEventListener?.('webglcontextlost',()=>{lost=true;});
 const hidden=[],shownBatches=[],frustum=new T.Frustum(),viewProjection=new T.Matrix4(),ancestors=new WeakMap();
 function shown(p){
  for(;p;p=p.parent){if(p===scene)return true;let a=ancestors.get(p);if(a?.pass===pass)return a.v;const v=p.visible&&shown(p.parent);if(a){a.pass=pass;a.v=v;}else ancestors.set(p,{pass,v});return v;}
  return false;
 }
 function upload(batch,head,count){
  // Rows of the matrix texture: three uploads each range as one row.
  const t=batch._matricesTexture,row=t.image.width*4,end=(head+count)*16;
  for(let s=head*16;s<end;){const e=Math.min(end,(Math.floor(s/row)+1)*row);t.addUpdateRange(s,e-s);s=e;}
  t.needsUpdate=true;
 }
 const byDepth=(a,b)=>a.z!==b.z?a.z-b.z:a.o.id-b.o.id;
 function collect(camera){
  const t0=performance.now();pass++;stats.shown=stats.folded=stats.skipped=0;const turn=materialCopies[pass%materialCopies.length];
  viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(viewProjection,camera.coordinateSystem,camera.reversedDepth);
  for(const B of batches){
   const {batch,v,rows,indirect,instances,drawn}=B;
   if(v.pass!==pass){v.pass=pass;follow(v,v===turn);}
   if(!v.usable||!v.m.visible||!camera.layers.test(batch.layers))continue;
   drawn.length=0;
   for(const r of rows){const o=r.o;
    if(!o.visible||o.material!==v.m||o.count<1||o.count>r.slots||o.layers.mask!==batch.layers.mask||!shown(o.parent)||!identity(o.matrixWorld.elements)||!frustum.intersectsObject(o))continue;
    if(skip?.(o)){stats.skipped++;continue;}
    if(r.version!==o.instanceMatrix.version||r.count!==o.count){
     batch._matricesTexture.image.data.set(o.instanceMatrix.array.subarray(0,o.count*16),r.head*16);upload(batch,r.head,o.count);
     r.version=o.instanceMatrix.version;r.count=o.count;}
    // three's sort depth for it: the centre of its instances' sphere through the view (painterSortStable).
    const c=o.boundingSphere.center,e=viewProjection.elements;r.z=e[2]*c.x+e[6]*c.y+e[10]*c.z+e[14];drawn.push(r);
   }
   // One part alone draws itself, as before.
   const n=drawn.length;if(n<2)continue;
   // In the order three drew them (front to back, then by object), so surfaces that tie in depth end as they did.
   drawn.sort(byDepth);let changed=false;
   for(let i=0;i<n;i++){const r=drawn[i];batch._multiDrawStarts[i]=r.start;batch._multiDrawCounts[i]=r.count3;instances[i]=r.o.count;
    if(indirect[i]!==r.head){indirect[i]=r.head;changed=true;}r.o.visible=false;hidden.push(r.o);}
   batch._multiDrawCount=n;if(changed)batch._indirectTexture.needsUpdate=true;
   // It sorts where its front part did, among anything else drawn with the same material.
   batch.boundingSphere.center.copy(drawn[0].o.boundingSphere.center);
   batch.visible=true;shownBatches.push(batch);stats.shown++;stats.folded+=n-1;
  }
  stats.ms=performance.now()-t0;
 }
 const before=scene.onBeforeRender;
 scene.onBeforeRender=function(r,s,camera,target){
  before.apply(this,arguments);
  if(camera===mainCamera&&target===null)collect(camera);
 };
 return {stats,enabled:true,
  /** For the Stats readout (frame-readout.js). */
  line:()=>`cabin parts batched: ${stats.shown+stats.folded} in ${stats.shown} draws`,
  around(view,draw){
  stats.shown=stats.folded=stats.skipped=0;
  if(!this.enabled||lost||renderer.shadowMap.enabled||renderer.xr?.isPresenting||scene.overrideMaterial)return draw();
  mainCamera=view;
  try{return draw();}finally{
   mainCamera=null;for(const o of hidden)o.visible=true;hidden.length=0;
   for(const b of shownBatches)b.visible=false;shownBatches.length=0;
  }
 }};
}
