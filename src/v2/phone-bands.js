import {rememberMergedBounds} from './draw-bounds.js';
// The walk draws each opaque or faint glass material of the deck bands once, not once per band: a phone's frame was
// mostly the CPU's cost of thousands of draws (3,200 in the arrival hall, from about 240 materials; PHONE_WALK.md), and so
// was a desktop's (2,700 at the open atrium, 13 ms a frame on an RTX 3090, 8.4 ms merged; its GPU time fell too).
// Every opaque mesh low-deck batching would take from a deck band (Walk_band_*), and faint glass, is copied into one
// plain mesh per material, its triangles ordered by band, and hidden for good. After showBands, each copy draws the runs
// of the bands showBands shows, one draw per unbroken run (usually one: the bands a view span shows mostly sit together
// in band order). Plain draws only: no multi-draw, no draw list that changes from frame to frame (src/v2/facade.js has
// why that matters on a Galaxy S9).
import * as T from 'three';
import {compactRenderGeometry} from './facade.js';
import {yieldEvery} from './yield-to-page.js';

const IDENTITY=new T.Matrix4(),release=function(){this.array=null;};

// Faint glass that writes no depth merges too (most of the bands' draws are two such glass materials, 18-23% opaque):
// no pane can hide another, and two such panes blended in the other order differ by the square of their opacity times
// their difference (about 5%). Against other transparent things the merged glass sorts by the centre of its bounds, as
// each 50-150 m chunk of it did before, so mostly behind them as before.
const faint=m=>m.transparent&&!m.depthWrite&&m.blending===T.NormalBlending&&m.opacity<=.35;
// Deck menus are left to phase4-culling's room culling unless `menus` (their sources are marked bandMerged).
const eligible=(o,menus)=>{const m=o.material,g=o.geometry;
 return o.isMesh&&!o.isInstancedMesh&&!o.isBatchedMesh&&!o.isSkinnedMesh&&o.visible&&g?.attributes.position&&!Array.isArray(m)&&(!m.transparent&&m.opacity>=1||faint(m))&&!m.isShaderMaterial&&(menus||!m.name.startsWith('P4_menu_deck_'))
  &&!Object.keys(g.morphAttributes).length&&g.drawRange.start===0&&g.drawRange.count===Infinity
  &&!Object.values(g.attributes).some(a=>a.isInterleavedBufferAttribute)&&!(g.attributes.tangent&&!o.matrixWorld.equals(IDENTITY));};
// The bake makes a copy of some plain materials per chunk (48 of Area_light_polished): an opaque material without
// textures or shader hooks merges with any other of the same type and settings (userData included; one that can't be
// written out stays apart).
const settingsOf=m=>{
 if(m.transparent||Object.hasOwn(m,'onBeforeCompile')||Object.hasOwn(m,'customProgramCacheKey'))return null;
 const parts=[m.type];
 try{
  for(const k of Object.keys(m).sort()){if(k==='uuid'||k==='id'||k==='version'||k==='_listeners')continue;const v=m[k];
   if(v?.isTexture||typeof v==='function')return null;
   parts.push(k+'='+(v?.isColor?v.getHex():typeof v?.toArray==='function'?v.toArray().join(','):v!==null&&typeof v==='object'?JSON.stringify(v):String(v)));}
 }catch{return null;}
 return parts.join('|');
};
const layoutOf=g=>Object.entries(g.attributes).map(([k,a])=>k+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name).sort().join(',');
// Whether o's subtree draws something and every drawable in it was copied into a merge.
const allCopied=o=>{let any=false,all=true;o.traverse(c=>{if(!(c.isMesh||c.isLine||c.isPoints||c.isSprite))return;any=true;if(!c.userData.bandMerged)all=false;});return any&&all;};

// A desktop splits each big material merge into pieces of nearby triangles, one mesh each, bounded by the bands it
// shows, so three leaves out the pieces beside and behind the view. One mesh per material drew every triangle of the
// shown bands wherever the camera looked: at the open atrium 6.8 million, of which about 2 million face the view, and an
// M5 MacBook Air's GPU spent 51 ms on its 11 million a frame. Each draw costs the processor too (about 10 us on an
// RTX PC's Chrome, 6.5 us on the M5): fixed 48 m squares drew 3.2 million there but took 950 draws, and 1,000 in the
// arrival hall, where nearly everything is in view (144 fps fell to 57 on the RTX PC). Pieces of up to `piece`
// triangles go where the triangles are: at 100,000 the atrium draws about 4.4 million in 155 draws instead of 77, the
// arrival hall 156 instead of 60, Deck 2's hangar 1.1 of 2.8 million. A phone keeps one mesh per material (piece 0): the
// Galaxy S9's processor is what limits it.
// Splitting: halve the ship's plan (x, z) across its longer side at about the median triangle centre, until a piece holds
// at most `most` triangles or spans under MIN_SPAN metres. Each triangle keeps its order, so a piece's bands still run
// in band order, and each run of a band in a piece keeps its bounds (box).
const MIN_SPAN=8;
async function splitPieces(attributes,layout,index,runs,most,yieldWork,shared=false){
 const p=attributes.position,vertices=p.length/3,count=index.length/3,cx=new Float32Array(count),cz=new Float32Array(count),runOf=new Uint32Array(count);
 runs.forEach((r,n)=>{for(let t=r.start/3,end=(r.start+r.count)/3;t<end;t++){const a=index[t*3]*3,b=index[t*3+1]*3,c=index[t*3+2]*3;
  cx[t]=(p[a]+p[b]+p[c])/3;cz[t]=(p[a+2]+p[b+2]+p[c+2])/3;runOf[t]=n;}});
 const all=new Uint32Array(count);for(let t=0;t<count;t++)all[t]=t;
 const leaves=[],todo=[all],bins=new Uint32Array(256);
 while(todo.length){const list=todo.pop();if(list.length<=most){leaves.push(list);continue;}
  let lx=Infinity,hx=-Infinity,lz=Infinity,hz=-Infinity;
  for(const t of list){const x=cx[t],z=cz[t];if(x<lx)lx=x;if(x>hx)hx=x;if(z<lz)lz=z;if(z>hz)hz=z;}
  const alongX=hx-lx>=hz-lz,c=alongX?cx:cz,lo=alongX?lx:lz,span=alongX?hx-lx:hz-lz;
  if(span<MIN_SPAN){leaves.push(list);continue;}
  // The median by a 256-bin histogram: the halves need only be about even. Both keep the list's order, and neither is
  // empty (the lowest and highest bins both hold a triangle).
  const bin=t=>Math.min(255,Math.floor((c[t]-lo)/span*256));bins.fill(0);for(const t of list)bins[bin(t)]++;
  let k=0,below=0;while(below+bins[k]<list.length/2)below+=bins[k++];const last=Math.min(k,254);
  const a=new Uint32Array(list.length),b=new Uint32Array(list.length);let na=0,nb=0;
  for(const t of list)if(bin(t)<=last)a[na++]=t;else b[nb++]=t;
  todo.push(a.subarray(0,na),b.subarray(0,nb));await yieldWork();
 }
 const remap=new Int32Array(vertices).fill(-1),pieces=[];
 if(shared)return writeShared(attributes,layout,index,runs,leaves,remap,p,runOf,yieldWork);
 for(const tris of leaves){
  const used=[],pieceRuns=[];let r=null,start=0;
  for(const t of tris){const run=runs[runOf[t]];
   if(r?.group!==run.group){if(r)start+=r.count;pieceRuns.push(r={group:run.group,start,count:0,box:new T.Box3()});}
   r.count+=3;const {min,max}=r.box;
   for(let j=0;j<3;j++){const v=index[t*3+j],i=v*3,x=p[i],y=p[i+1],z=p[i+2];if(remap[v]<0){remap[v]=used.length;used.push(v);}
    if(x<min.x)min.x=x;if(x>max.x)max.x=x;if(y<min.y)min.y=y;if(y>max.y)max.y=y;if(z<min.z)min.z=z;if(z>max.z)max.z=z;}}
  const ix=used.length<=65536?new Uint16Array(tris.length*3):new Uint32Array(tris.length*3);
  for(let n=0;n<tris.length;n++)for(let j=0;j<3;j++)ix[n*3+j]=remap[index[tris[n]*3+j]];
  const out={};
  for(const [name,a] of Object.entries(layout)){const n=a.itemSize,from=attributes[name],to=new from.constructor(used.length*n);
   for(let u=0;u<used.length;u++){const s=used[u]*n,d=u*n;for(let q=0;q<n;q++)to[d+q]=from[s+q];}out[name]=to;}
  for(const v of used)remap[v]=-1;
  pieces.push({attributes:out,index:ix,runs:pieceRuns});await yieldWork();
 }
 return pieces;
}

// A kind's pieces, written into one set of arrays (shared=true): the vertices each piece uses, piece after piece, and
// one index over them all. Each piece is then a slice of that index: its start and count, and its runs with their
// starts in the shared index. The sizes are counted first, so each vertex is copied once and no piece has arrays of its
// own.
async function writeShared(attributes,layout,index,runs,leaves,remap,p,runOf,yieldWork){
 const plan=[];let vertices=0,indices=0;
 for(const tris of leaves){
  const used=[],pieceRuns=[];let r=null,start=0;
  for(const t of tris){const run=runs[runOf[t]];
   if(r?.group!==run.group){if(r)start+=r.count;pieceRuns.push(r={group:run.group,start,count:0,box:new T.Box3()});}
   r.count+=3;const {min,max}=r.box;
   for(let j=0;j<3;j++){const v=index[t*3+j],i=v*3,x=p[i],y=p[i+1],z=p[i+2];if(remap[v]<0){remap[v]=used.length;used.push(v);}
    if(x<min.x)min.x=x;if(x>max.x)max.x=x;if(y<min.y)min.y=y;if(y>max.y)max.y=y;if(z<min.z)min.z=z;if(z>max.z)max.z=z;}}
  for(const v of used)remap[v]=-1;
  plan.push({tris,used:Uint32Array.from(used),runs:pieceRuns});vertices+=used.length;indices+=tris.length*3;await yieldWork();
 }
 const out={};for(const [name,a] of Object.entries(layout))out[name]=new attributes[name].constructor(vertices*a.itemSize);
 const ix=new Uint32Array(indices),pieces=[];let vb=0,ib=0;
 for(const {tris,used,runs:pieceRuns} of plan){
  for(const [name,a] of Object.entries(layout)){const n=a.itemSize,from=attributes[name],to=out[name];
   for(let u=0;u<used.length;u++){const s=used[u]*n,d=(vb+u)*n;for(let q=0;q<n;q++)to[d+q]=from[s+q];}}
  for(let u=0;u<used.length;u++)remap[used[u]]=vb+u;
  for(let n=0;n<tris.length;n++)for(let j=0;j<3;j++)ix[ib+n*3+j]=remap[index[tris[n]*3+j]];
  for(const v of used)remap[v]=-1;
  for(const r of pieceRuns)r.start+=ib;
  pieces.push({start:ib,count:tris.length*3,runs:pieceRuns});vb+=used.length;ib+=tris.length*3;await yieldWork();
 }
 return {attributes:out,index:ix,pieces};
}
// A run's bounds, from the arrays (an unsplit kind is one piece of all its runs).
function boundRuns(runs,p,index){
 return runs.map(r=>{const box=new T.Box3(),{min,max}=box;for(let t=r.start;t<r.start+r.count;t++){const i=index[t]*3,x=p[i],y=p[i+1],z=p[i+2];
  if(x<min.x)min.x=x;if(x>max.x)max.x=x;if(y<min.y)min.y=y;if(y>max.y)max.y=y;if(z<min.z)min.z=z;if(z>max.z)max.z=z;}return {...r,box};});
}

// Deck kinds. On a desktop the floor and wall finishes (render-bake.js's Walk_finish_* materials: white, vertex-coloured,
// apart only in roughness, metalness, side and flat shading) come in about forty materials. Merged per material they drew
// about 90 times at the heavy open views on decks 15-19, nearly all in view: the count is set by triangles over the piece
// size, not by how many materials there are (stage 0's simulation, 2026-11-27). Merged by kind instead (equal but for
// roughness and metalness), each kind's pieces sit in one set of arrays, and draw-runs.js draws the pieces of a kind that
// reach the GPU in a row as one multi-draw. A kind's material reads each source material's roughness and metalness from
// a tiny float texture (G and B, as three reads its roughness and metalness maps) through a uv constant over that
// source's vertices: three's arithmetic is then the uniform path's (roughness 1 x G, metalness 1 x B). follow() keeps
// the texels to the source materials.
const KIND_OWN=new Set(['uuid','id','version','name','roughness','metalness','_listeners','onBeforeCompile','customProgramCacheKey']);
const plainHook=T.Material.prototype.onBeforeCompile;
const ids=new WeakMap();let nextId=0;
const idOf=f=>{let i=ids.get(f);if(i===undefined)ids.set(f,i=nextId++);return i;};
const describe=v=>v===null||v===undefined||typeof v!=='object'&&typeof v!=='function'?String(v):typeof v==='function'?'f'+idOf(v):v.isColor?'c'+v.getHexString():v.isTexture?'t'+v.uuid:typeof v.toArray==='function'?'['+v.toArray().join(',')+']':'o'+JSON.stringify(v);
const hookFlags=m=>{const h=m.onBeforeCompile;return (h?.cornerShade?'C':'')+(h?.filmLook?'F':'');};
// A material's own values apart from those a kind reads from its texture, its identity and its hooks.
const lookOf=m=>Object.keys(m).filter(k=>!KIND_OWN.has(k)).sort().map(k=>k+'='+describe(m[k])).join('|');
// What a source material and its meshes must share to join a kind (null: it merges per material, as before). Hooks are
// left out: corner-shade.js and film-look.js patch the sources and the kind's material alike, later on.
export function kindKey(m,o,alone=null){
 if(!/^Walk_finish_/.test(m.name||'')||!m.isMeshStandardMaterial||m.isMeshPhysicalMaterial||m.transparent||!m.visible)return null;
 if(Object.values(m).some(v=>v?.isTexture))return null;
 const h=m.onBeforeCompile;if(h!==plainHook&&!h?.cornerShade&&!h?.filmLook)return null;
 if(alone?.(m))return null;
 const layout=Object.entries(o.geometry.attributes).filter(([k])=>k!=='uv').map(([k,a])=>k+':'+a.itemSize+':'+a.normalized+':'+(a.array?.constructor.name??'?')).sort().join(',');
 return o.renderOrder+'#'+layout+'#'+lookOf(m);
}
const texel=n=>{const t=new T.DataTexture(new Float32Array(n*4),n,1,T.RGBAFormat,T.FloatType);t.magFilter=t.minFilter=T.NearestFilter;t.generateMipmaps=false;t.matrixAutoUpdate=false;t.needsUpdate=true;return t;};
// The texel coordinate of material k of n, as Uint16 normalized: nearest sampling picks texel k (the rounding is under
// half a texel for n up to several thousand).
export const kindTexel=(k,n)=>Math.round(65535*(k+.5)/n);

/** Merges the deck bands' opaque meshes per material. `hidden` is called with each source once it is copied and hidden.
 * `piece` (most triangles a piece, 0 for none) splits each bigger material merge into view-culled pieces.
 * `kinds` (with pieces only) merges the floor and wall finishes by kind instead (see above); `alone(material)`: a
 * material corner-shade.js leaves alone, which stays apart.
 * Returns {root, update, follow, kinds, proof}: add nothing (root is already in `scene`); call update() after showBands
 * and follow() just before the main render. */
export async function mergePhoneBands(baked,scene,{hidden=null,menus=false,piece=0,keepArrays=false,kinds:byKind=false,alone=null}={}){
 const yieldWork=yieldEvery();
 const bands=[...baked.bands.values()].filter(g=>/^Walk_band_/.test(g.name));
 // Band order: by lowest deck, then highest, so the bands a view span shows sit together.
 bands.sort((a,b)=>a.userData.band-b.userData.band||(a.userData.top??a.userData.band)-(b.userData.top??b.userData.band));
 const bandOrder=new Map(bands.map((g,i)=>[g,i]));
 const buckets=new Map(),alike=new Map();
 // A band's direct meshes, and the meshes inside any of its groups marked userData.bandMergeParts (static, such as the
 // wayfinding guides: posts, directory backings and floor arrows share a few materials over 20 decks).
 const partsOf=group=>{const list=[];for(const o of group.children){list.push(o);if(o.userData.bandMergeParts)o.traverse(c=>{if(c!==o&&c.isMesh)list.push(c);});}return list;};
 for(const group of bands)for(const o of partsOf(group)){
  o.updateWorldMatrix(true,false);if(!eligible(o,menus))continue;
  const settings=settingsOf(o.material);let same=settings&&alike.get(settings);if(settings&&!same)alike.set(settings,same=o.material);
  const key=(same||o.material).uuid+'|'+o.renderOrder+'|'+layoutOf(o.geometry);let list=buckets.get(key);if(!list)buckets.set(key,list=[]);list.push({o,group});
 }
 const root=new T.Group();root.name='V2_phone_band_merges';root.userData={noCollide:true,renderOnly:true};root.matrixAutoUpdate=false;
 const merges=[],kinds=[],proof={meshes:0,regions:0,sources:0,vertices:0,triangles:0,kinds:0,kindMaterials:0,drift:0},m3=new T.Matrix3(),v=new T.Vector3();
 const retainDrawBounds=piece>0&&!keepArrays,scratch={remap:null};
 // What merges together: one material's bucket, as before, or the buckets of one kind. A kind takes the place of its
 // first bucket, so the merges keep their order; a kind of one bucket merges as before.
 const work=[],kindOf=new Map();
 for(const list of buckets.values()){
  if(list.length<2)continue;
  const key=byKind&&piece>0?kindKey(list[0].o.material,list[0].o,alone):null;
  if(key===null){work.push({lists:[list],kind:false});continue;}
  let w=kindOf.get(key);if(!w){kindOf.set(key,w={lists:[],kind:true});work.push(w);}w.lists.push(list);
 }
 for(const w of work)if(w.lists.length<2)w.kind=false;
 for(const {lists,kind} of work){
  const materials=lists.map(l=>l[0].o.material);
  // A kind's sources in band order (each bucket is already), each with its material's texel; within a band, in the order
  // three drew their materials (by material id, each material's own parts in order). Where two parts meet, the one drawn
  // later wins the edge's samples (the logarithmic depth is written per pixel, not per sample), so a band keeps the
  // edges it had.
  const list=kind?lists.flatMap((l,k)=>l.map((e,i)=>({...e,k,i}))).sort((a,b)=>bandOrder.get(a.group)-bandOrder.get(b.group)||materials[a.k].id-materials[b.k].id||a.k-b.k||a.i-b.i):lists[0];
  // A desktop's pieces index vertex pools they share: each is copied with only the vertices it draws (its arrays are
  // all that is read of the copy).
  for(const e of list){const g=e.o.geometry;e.g=g.index&&g.attributes.position.count>g.index.count?compactRenderGeometry(g,{scratch,bounds:false}):g;await yieldWork();}
  let vertices=0,indices=0;for(const {g} of list){vertices+=g.attributes.position.count;indices+=g.index?g.index.count:g.attributes.position.count;}
  const first=list[0].g,attributes={},layout={};
  // A kind leaves its sources' uv out (its materials have no textures) and gives every vertex its material's texel.
  for(const [name,a] of Object.entries(first.attributes)){if(kind&&name==='uv')continue;layout[name]={itemSize:a.itemSize,normalized:a.normalized};attributes[name]=new a.array.constructor(vertices*a.itemSize);}
  if(kind){layout.uv={itemSize:2,normalized:true};attributes.uv=new Uint16Array(vertices*2);}
  const index=new Uint32Array(indices),runs=[];let vo=0,io=0;
  for(const {o,g,group,k} of list){
   const count=g.attributes.position.count,ix=g.index?.array;
   const m=o.matrixWorld,identity=m.equals(IDENTITY);if(!identity)m3.getNormalMatrix(m);
   for(const name of Object.keys(layout)){if(kind&&name==='uv')continue;const a=g.attributes[name],out=attributes[name],n=a.itemSize;
    if(identity||(name!=='position'&&name!=='normal')){out.set(a.array.subarray(0,count*n),vo*n);continue;}
    // A moved part: positions take its matrix, directions its normal matrix (getX/setX keep normalized storage).
    const target=new T.BufferAttribute(out,n,a.normalized);
    for(let i=0;i<count;i++){v.fromBufferAttribute(a,i);if(name==='position')v.applyMatrix4(m);else v.applyMatrix3(m3).normalize();target.setXYZ(vo+i,v.x,v.y,v.z);if(n===4)target.setW(vo+i,a.getW(i));}
   }
   if(kind){const u=kindTexel(k,materials.length),uv=attributes.uv;for(let i=vo*2,end=(vo+count)*2;i<end;i+=2){uv[i]=u;uv[i+1]=32768;}}
   // A mirrored part flips its winding: swap two corners so its faces keep facing out.
   const flip=!identity&&m.determinant()<0,start=io;
   if(ix){for(let i=0;i<ix.length;i+=3){index[io++]=ix[i]+vo;index[io++]=ix[i+(flip?2:1)]+vo;index[io++]=ix[i+(flip?1:2)]+vo;}}
   else for(let i=0;i<count;i+=3){index[io++]=vo+i;index[io++]=vo+i+(flip?2:1);index[io++]=vo+i+(flip?1:2);}
   const last=runs.at(-1);if(last&&last.group===group)last.count+=io-start;else runs.push({group,start,count:io-start});
   vo+=count;o.visible=false;o.userData.bandMerged=true;hidden?.(o);if(g!==o.geometry)g.dispose();await yieldWork();
  }
  const sources=list.map(e=>e.o.uuid),split=piece>0&&indices/3>piece&&attributes.position instanceof Float32Array;
  if(!kind){
   const material=list[0].o.material;
   const pieces=split?await splitPieces(attributes,first.attributes,index,runs,piece,yieldWork):[{attributes,index,runs}];
   for(const piece of pieces){
    const geometry=new T.BufferGeometry();
    for(const [name,a] of Object.entries(first.attributes))geometry.setAttribute(name,new T.BufferAttribute(piece.attributes[name],a.itemSize,a.normalized));
    geometry.setIndex(new T.BufferAttribute(piece.index,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
    if(retainDrawBounds)rememberMergedBounds(geometry);
    // Drawn only: its arrays leave the page once on the GPU (groups and bounds are all three reads after), unless the
    // owner bake's page (keepArrays) needs to read them.
    if(!keepArrays)for(const a of [...Object.values(geometry.attributes),geometry.index])a.onUpload(release);
    // One material slot, drawn once per run of shown bands (geometry groups). The fog cull (fog-cull.js) never leaves one
    // out: these are the fogged walls and floors that stand behind whatever it leaves out.
    const mesh=new T.Mesh(geometry,[material]);mesh.name='V2_low_deck_merged_'+material.name;mesh.renderOrder=list[0].o.renderOrder;
    mesh.matrixAutoUpdate=false;mesh.frustumCulled=split;mesh.userData={noCollide:true,renderOnly:true,fogBackdrop:true,sources};root.add(mesh);
    merges.push({mesh,runs:piece.runs,split});proof.regions++;
   }
  }else{
   // The kind's material: the first source material's, with roughness and metalness read from the texture. Its own name
   // keeps the moods' lookups by name on the source materials, which follow() reads.
   const n=materials.length,texture=texel(n),material=new T.MeshStandardMaterial().copy(materials[0]);
   material.name='V2_band_kind_'+kinds.length;material.roughness=1;material.metalness=1;material.roughnessMap=material.metalnessMap=texture;
   const shared=split?await splitPieces(attributes,layout,index,runs,piece,yieldWork,true):{attributes,index,pieces:[{start:0,count:indices,runs:boundRuns(runs,attributes.position,index)}]};
   const geometry=new T.BufferGeometry(),objects={};
   for(const [name,a] of Object.entries(layout))geometry.setAttribute(name,objects[name]=new T.BufferAttribute(shared.attributes[name],a.itemSize,a.normalized));
   geometry.setIndex(new T.BufferAttribute(shared.index,1));
   // One bounds tree over the shared index, made while its arrays are here; the pieces find it by their index.
   if(retainDrawBounds)rememberMergedBounds(geometry);
   if(!keepArrays)for(const a of [...Object.values(geometry.attributes),geometry.index])a.onUpload(release);
   const name='V2_low_deck_merged_Walk_finish_kind_'+kinds.length,pieces=[];
   for(const p of shared.pieces){
    // Its own geometry over the kind's attributes and index (never disposed alone: that frees the kind's GPU buffers),
    // drawing its slice. Its bounds hold every run it may draw from the start (three would otherwise work them out over
    // the whole kind); update() narrows a split piece's to the runs shown, as before.
    const g=new T.BufferGeometry();for(const key of Object.keys(objects))g.setAttribute(key,objects[key]);g.setIndex(geometry.index);g.setDrawRange(p.start,p.count);
    const box=new T.Box3();for(const r of p.runs)box.union(r.box);g.boundingBox=box;g.boundingSphere=box.getBoundingSphere(new T.Sphere());
    const mesh=new T.Mesh(g,[material]);mesh.name=name;mesh.renderOrder=list[0].o.renderOrder;
    mesh.matrixAutoUpdate=false;mesh.frustumCulled=split;mesh.userData={noCollide:true,renderOnly:true,fogBackdrop:true,sources,deckKind:kinds.length};root.add(mesh);
    merges.push({mesh,runs:p.runs,split});pieces.push(mesh);proof.regions++;
   }
   // The batch geometry's bounds are never read for culling (draw-runs.js draws it by hand); set so three never works
   // them out over the arrays.
   const all=new T.Box3();for(const q of pieces)all.union(q.geometry.boundingBox);geometry.boundingBox=all;geometry.boundingSphere=all.getBoundingSphere(new T.Sphere());
   kinds.push({geometry,material,texture,materials,looks:materials.map(lookOf),pieces,runs:shared.pieces.reduce((s,p)=>s+p.runs.length,0)});
   proof.kinds++;proof.kindMaterials+=n;
  }
  proof.meshes++;proof.sources+=list.length;proof.vertices+=vertices;proof.triangles+=indices/3;await yieldWork();
 }
 // The sources copied here are hidden for good, yet three's scene walk and matrix pass still visit them in their bands
 // each frame (at the open atrium 63 range bands and 15 guide roots held about 1,070 such nodes). A band's children whose
 // every drawable was copied move into one hidden group in that band, which neither walks; they keep their names, place
 // and band for anything that looks them up. Whatever other code has hidden for now stays where it is.
 for(const group of bands){const gone=group.children.filter(allCopied);if(!gone.length)continue;
  const kept=new T.Group();kept.name=group.name+'_merged_sources';kept.visible=false;kept.userData={noCollide:true,mergedSources:true};
  for(const o of gone)kept.add(o);group.add(kept);proof.moved=(proof.moved||0)+gone.length;}
 scene.add(root);root.updateMatrixWorld(true);
 let last='';
 const update=()=>{
  let key='';for(const g of bands)key+=g.visible?'1':'0';if(key===last)return;last=key;
  for(const {mesh,runs,split} of merges){const g=mesh.geometry,groups=g.groups;groups.length=0;if(split)g.boundingBox.makeEmpty();
   for(const r of runs){if(!r.group.visible)continue;const last=groups.at(-1);if(last&&last.start+last.count===r.start)last.count+=r.count;else groups.push({start:r.start,count:r.count,materialIndex:0});
    if(split)g.boundingBox.union(r.box);}
   // A piece's bounds are those of the bands it shows, so three's view culling skips it whenever they are out of view.
   mesh.visible=groups.length>0;if(split&&mesh.visible)g.boundingBox.getBoundingSphere(g.boundingSphere);}
 };
 update();
 // The kinds' texels: each source material's roughness and metalness, rewritten only when they change. Every 60 calls each
 // source is checked against its kind again (its own values apart from roughness and metalness, and the kind material's
 // corner shading and film look): proof.drift counts the sources that no longer match, each warned once. A merged source cannot be drawn
 // apart again, so this is for the checks to see, not a way back.
 let calls=0;const drifted=new WeakSet();
 const follow=()=>{
  const check=++calls%60===0;
  for(const K of kinds){const data=K.texture.image.data;let dirty=false;
   for(let i=0;i<K.materials.length;i++){const m=K.materials[i],r=Math.fround(m.roughness),s=Math.fround(m.metalness);
    if(data[i*4+1]!==r||data[i*4+2]!==s||data[i*4+3]!==1){data[i*4+1]=r;data[i*4+2]=s;data[i*4+3]=1;dirty=true;}
    if(check&&!drifted.has(m)&&(hookFlags(m)!==hookFlags(K.material)||lookOf(m)!==K.looks[i])){drifted.add(m);proof.drift++;console.warn('Deck kind: '+m.name+' no longer matches '+K.material.name+': it keeps drawing with the kind look.');}}
   if(dirty)K.texture.needsUpdate=true;}
 };
 follow();
 return {root,update,follow,kinds,proof};
}
