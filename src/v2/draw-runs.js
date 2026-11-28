import * as T from 'three';
import {compactRenderGeometry} from './facade.js';
import {PLAIN_CHUNK, batchMaterial, batchable, follow, instancedMultiDraw, kept} from './cabin-batches.js';
import {HELD, floorBlocker} from './floor-occlusion.js';
import {lookNow,programKey,writeTexel} from './look-kinds.js';
import {yieldEvery} from './yield-to-page.js';

// Draws of one material that reach the GPU one after another become one draw. three sorts the opaque draws by material
// (WebGLRenderLists.js painterSortStable: group order, render order, then material id, then depth), so the draws of a
// material that survive every test of the frame (frustum, group-occlusion.js, quad-facing.js and the floors' occlusion,
// the fog cull, the owner bake's hiding) arrive in a row. At the heavy open views on decks 15-19 (2026-11-27) such rows
// were 26-30 draws a view, mostly the decks' common furnishings (the P4_* kinds with more than 16 instances, which
// furnishing-batches.js leaves instanced) and a few of the atrium facade's.
//
// Here each part that may join a row (`parts`) has a slot in a BatchedMesh of its material, holding a copy of its
// geometry. Inside the tests (installed before quad-facing.js and group-occlusion.js, so it sees only what they let
// through), renderBufferDirect holds back a part's draw while the next draw is of the same batch, and draws the row as
// one instanced multi-draw when the row ends: a sub-draw per part, in the order three submitted them, each drawing its
// own instances (cabin-batches.js's instanced multi-draw; a plain mesh is one instance, its world matrix). A row of one
// part draws itself, as before. Nothing is hidden and nothing else changes: what draws, in what order, is what three
// chose; only the number of calls drops.
//
// - Only the main camera's pass, with no render target, override material, shadows or XR. Every other camera, and a
//   part that changed what it is (another material, groups, a mirrored or sheared world matrix, instance colours), draws
//   as before.
// - The batches stay in the scene so three uploads them, and their own place in the draw lists draws nothing.
// - A marker sorted after every opaque draw ends the last row before the transparent draws begin: group-occlusion.js asks
//   its questions at the first transparent draw, against the depth the opaque draws left.
// - The batch's material is a copy of the parts' own that follows it (cabin-batches.js batchMaterial).
//
// The lift and aft-core copies in the atrium facade (atrium-architecture.js) draw sixteen opaque meshes in a row, each
// with its own material that differs only in roughness, metalness and glow, all white with vertex colours. With
// `palette` such materials share one batch: its copy reads the three values from two tiny float maps through a uv
// that is constant over each part (one texel per part, set from the part's own material when the row draws), so
// each part is shaded with its own values as before.
//
// The deck kinds (phone-bands.js `kinds`): the floor and wall finishes' pieces of one kind are slices of one set of
// arrays and share one material, so three sorts their draws together and none needs copying. A kind's batch draws from
// those very arrays (its geometry is the kind's), each piece's run of shown bands a sub-draw (the group three passes,
// clipped to the piece's own range), with no matrices (the pieces are in world space). A held piece that the floors'
// occlusion takes as a blocker is reported to it as drawn when held (HELD, quad-facing.js): it is drawn before the opaque
// draws end.
//
// With `looks`, every group's materials that differ only in colour, glow, roughness and metalness (look-kinds.js) share
// a batch the same way, colour too (a third map, `map`): three gives materials made one after another ids one after
// another, so the decks' common furnishings (P4_oak, P4_metal, P4_sage ...) and a cabin kind's parts reach the GPU in a
// row and fold, still in the order and with the survivors three chose. Each material has one texel (its parts' geometry
// copies carry it), painted from the material a row draws with; a part drawn with another material than it was offered
// with, or whose material's shader is no longer the batch's (program key, look-kinds.js), draws itself. `alone(material)`:
// a material corner shading leaves alone, which stays apart. offer(groups) adds more parts later (the atrium's reach
// cabins, made after the tests wrap the renderer).
//
// Desktop only (WEBGL_multi_draw with its instanced draw). Not on the owner bake's page. main.public.js: ?drawruns=0
// draws them one by one, ?towerpalette=0 leaves the facade's materials apart, ?drawkinds=0 keeps colour out (by material,
// the facade's palette as before), ?reachruns=0 leaves the reach cabins out.
const MAX_INDICES=200000;

const PALETTE=new Set(['roughness','metalness','emissive','emissiveIntensity','roughnessMap','metalnessMap','emissiveMap']);
// A palette copy keeps a name of its own (never a member's: the moods find materials by name, atrium-mood.js, and would
// write a member's values into the copy, over every texel) and the values its maps stand in for.
const PALETTE_COPY=new Set([...PALETTE,'name']),COLOURED=new Set([...PALETTE_COPY,'color','map']);
const white=c=>c.r===1&&c.g===1&&c.b===1;
let paletteCount=0;
const NOT_LOOK=new Set(['uuid','id','version','name','userData','_listeners']);
const plainBefore=T.Object3D.prototype.onBeforeRender,plainAfter=T.Object3D.prototype.onAfterRender;
const functionIds=new WeakMap();let nextFunction=0;
const identityOf=f=>{let i=functionIds.get(f);if(i===undefined)functionIds.set(f,i=nextFunction++);return i;};
const describe=v=>v===null||v===undefined||typeof v!=='object'&&typeof v!=='function'?String(v):typeof v==='function'?'f'+identityOf(v):v.isColor?'c'+v.getHexString():v.isTexture?'t'+v.uuid:typeof v.toArray==='function'?'['+v.toArray().join(',')+']':'o'+JSON.stringify(v);
// What a material looks like apart from the palette's values, or null when it cannot join a palette.
function lookKey(m){
 if(!m?.isMeshStandardMaterial||m.isMeshPhysicalMaterial||Object.values(m).some(v=>v?.isTexture))return null;
 return Object.keys(m).filter(k=>!PALETTE.has(k)&&!NOT_LOOK.has(k)).sort().map(k=>k+'='+describe(m[k])).join('|');
}
// A part's geometry groups do not matter: with one material three draws the whole geometry (no group in the call).
function part(o,maxIndices){
 const g=o.geometry,m=o.material;
 if(!o.isMesh||o.isBatchedMesh||o.isSkinnedMesh||o.userData.cabins||o.userData.boat||o.userData.near||o.userData.renderOnly||floorBlocker(o))return null;
 if(Array.isArray(m)||!batchable(m)||o.instanceColor||o.morphTexture||o.onBeforeRender!==plainBefore||o.onAfterRender!==plainAfter)return null;
 const n=g?.index?g.index.count:g?.attributes.position?.count;
 if(!n||n%3||n>maxIndices||g.isInstancedBufferGeometry||g.index&&!g.index.array||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.morphAttributes).length||g.attributes.tangent)return null;
 const names=kept(m);
 if(!names.every(k=>g.attributes[k]?.array&&!g.attributes[k].isInterleavedBufferAttribute))return null;
 return names.map(k=>{const a=g.attributes[k];return k+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name;}).join(',');
}
// A world matrix the batch can stand in for: not mirrored (three turns a mirrored mesh's faces round), and without
// shear, which the batch's normals cannot follow. Behind an instanced part it must also be a rotation with one scale:
// the instances' own matrices are multiplied into it.
function fitWorld(e,instanced){
 const ax=Math.hypot(e[0],e[1],e[2]),ay=Math.hypot(e[4],e[5],e[6]),az=Math.hypot(e[8],e[9],e[10]);
 if(!(ax>1e-9&&ay>1e-9&&az>1e-9)||e[3]||e[7]||e[11]||e[15]!==1)return false;
 const det=e[0]*(e[5]*e[10]-e[6]*e[9])-e[4]*(e[1]*e[10]-e[2]*e[9])+e[8]*(e[1]*e[6]-e[2]*e[5]);
 if(!(det>0))return false;
 const t=1e-5,xy=(e[0]*e[4]+e[1]*e[5]+e[2]*e[6])/(ax*ay),xz=(e[0]*e[8]+e[1]*e[9]+e[2]*e[10])/(ax*az),yz=(e[4]*e[8]+e[5]*e[9]+e[6]*e[10])/(ay*az);
 if(Math.abs(xy)>t||Math.abs(xz)>t||Math.abs(yz)>t)return false;
 return !instanced||Math.abs(ax-ay)<=t*ax&&Math.abs(ax-az)<=t*ax;
}
const identity=e=>e[0]===1&&e[1]===0&&e[2]===0&&e[3]===0&&e[4]===0&&e[5]===1&&e[6]===0&&e[7]===0&&e[8]===0&&e[9]===0&&e[10]===1&&e[11]===0&&e[12]===0&&e[13]===0&&e[14]===0&&e[15]===1;
function upload(t,head,count){
 // Rows of the matrix texture: three uploads each range as one row.
 const row=t.image.width*4,end=(head+count)*16;
 for(let s=head*16;s<end;){const e=Math.min(end,(Math.floor(s/row)+1)*row);t.addUpdateRange(s,e-s);s=e;}
 t.needsUpdate=true;
}
function paletteTexture(n){const t=new T.DataTexture(new Float32Array(n*4),n,1,T.RGBAFormat,T.FloatType);t.magFilter=t.minFilter=T.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;}

/** `groups`: [{parts, palette}], the meshes and instanced meshes that may join a row. `kinds`: phone-bands.js's deck
 * kinds. Created before quad-facing.js and group-occlusion.js wrap renderBufferDirect. Returns null without the instanced
 * multi-draw, else {stats, line(), around(view, draw), enabled}. stats.folded: draws the last main pass made fewer, for
 * quad-facing.js's dense count. */
export async function createDrawRuns(scene,renderer,groups,{maxIndices=MAX_INDICES,kinds=null,looks=false,alone=null}={}){
 const lists=instancedMultiDraw(renderer);if(!lists)return null;
 const yieldWork=yieldEvery(),palettes=new WeakMap();
 const lookOf=m=>{let c=palettes.get(m);if(!c||c.version!==m.version){c={version:m.version,key:lookKey(m)};palettes.set(m,c);}return c.key;};
 const sets=[],rows=new Map(),ours=new Set(),stats={batches:0,parts:0,slots:0,runs:0,folded:0};
 async function build(groups){
  const byKey=new Map();
  for(const {parts,palette=false} of groups)for(const o of parts){
   if(rows.has(o))continue;
   const attributes=part(o,maxIndices);if(!attributes)continue;
   const m=o.material,colour=looks&&!alone?.(m)&&lookNow(m,true)!==null,look=colour?lookNow(m):palette?lookOf(m):null;
   const key=(look!==null?(colour?'look|':'palette|')+look:m.uuid)+'|'+o.renderOrder+'|'+o.layers.mask+'|'+attributes;
   let set=byKey.get(key);if(!set)byKey.set(key,set={m,palette:look!==null,colour,layers:o.layers.mask,order:o.renderOrder,rows:[],seen:new Set()});
   if(!set.seen.has(o)){set.seen.add(o);set.rows.push(o);}
  }
  for(const S of byKey.values()){
   // A palette of one material is a batch like any other.
   const materials=[...new Set(S.rows.map(o=>o.material))];
   if(S.palette&&materials.length<2)S.palette=S.colour=false;
   if(S.rows.length<2)continue;
   // One texel a material, at the same place in each map; one geometry copy a geometry and material.
   const n=S.rows.length,width=materials.length,texel=new Map(materials.map((m,k)=>[m,k]));
   const names=S.palette?[...kept(S.m),'uv']:kept(S.m),copies=new Map(),geometryOf=[];
   for(let i=0;i<n;i++){const o=S.rows[i],g=o.geometry,k=S.palette?texel.get(o.material):0;
    let byTexel=copies.get(g);if(!byTexel)copies.set(g,byTexel=new Map());let c=byTexel.get(k);
    if(!c){const view=new T.BufferGeometry();for(const a of names)if(g.attributes[a])view.setAttribute(a,g.attributes[a]);if(g.index)view.setIndex(g.index);
     c=compactRenderGeometry(view,{bounds:false});
     const count=c.attributes.position.count;
     if(!c.index){const index=new (count>65535?Uint32Array:Uint16Array)(count);for(let q=0;q<count;q++)index[q]=q;c.setIndex(new T.BufferAttribute(index,1));}
     // A palette part's texel, its material's, the same over all its vertices.
     if(S.palette){const uv=new Float32Array(count*2),u=(k+.5)/width;for(let q=0;q<count;q++){uv[q*2]=u;uv[q*2+1]=.5;}c.setAttribute('uv',new T.BufferAttribute(uv,2));}
     byTexel.set(k,c);}
    geometryOf.push(c);await yieldWork();}
   const unique=[...new Set(geometryOf)];
   const vertices=unique.reduce((s,g)=>s+g.attributes.position.count,0),indices=unique.reduce((s,g)=>s+g.index.count,0);
   let slots=0;const members=S.rows.map(o=>{const g=o.geometry,r={o,head:slots,slots:o.isInstancedMesh?o.instanceMatrix.count:1,pal:S.palette?texel.get(o.material):0,mat:o.material,world:new Float64Array(16).fill(NaN),ok:false,identity:false,dirty:true,inst:null,version:-1,count:-1,mark:-1,
    g,index:g.index,attributes:names.filter(k=>g.attributes[k]).map(k=>[k,g.attributes[k],g.attributes[k].version]),indexVersion:g.index?.version};slots+=r.slots;return r;});
   // An id of its own: the batch is never sorted (its own place in the lists draws nothing), and three skips a material's
   // uniforms when both program and id repeat, so two batches copied from one material must not share one.
   const v=batchMaterial(S.m,S.palette?(S.colour?COLOURED:PALETTE_COPY):null,new T.Material().id);
   let palette=null;
   if(S.palette){const lit=!S.m.isMeshBasicMaterial;
    palette={look:lit?paletteTexture(width):null,glow:lit?paletteTexture(width):null,colour:S.colour?paletteTexture(width):null,lookOf:S.colour?lookNow:lookOf};
    v.copy.name='V2_draw_run_palette_'+paletteCount++;
    // Its own values as its maps need them; anything else (a value written into it) would multiply every texel.
    const M=v.copy;palette.ok=()=>(!palette.colour||white(M.color))&&(!lit||M.roughness===1&&M.metalness===1&&M.emissiveIntensity===1&&white(M.emissive));
    if(lit)Object.assign(v.copy,{roughness:1,metalness:1,emissive:new T.Color(1,1,1),emissiveIntensity:1,roughnessMap:palette.look,metalnessMap:palette.look,emissiveMap:palette.glow});
    if(S.colour)Object.assign(v.copy,{color:new T.Color(1,1,1),map:palette.colour});
    v.copy.needsUpdate=true;
   }
   const batch=new T.BatchedMesh(slots,vertices,indices,v.copy);
   batch.name='V2_draw_run '+S.m.name;batch.renderOrder=S.order;batch.layers.mask=S.layers;batch.receiveShadow=S.rows[0].receiveShadow;
   batch.sortObjects=false;batch.perObjectFrustumCulled=false;batch.frustumCulled=false;batch.matrixAutoUpdate=false;
   batch.userData={noCollide:true,renderOnly:true,drawRun:true};
   const ids=new Map(unique.map(g=>[g,batch.addGeometry(g)]));
   const bytes=batch.geometry.index.array.BYTES_PER_ELEMENT;
   members.forEach((r,i)=>{const info=batch._geometryInfo[ids.get(geometryOf[i])];r.start=info.start*bytes;r.count3=info.count;});
   for(const g of unique)g.dispose();
   // The lists are written when a row draws, not by BatchedMesh from instances (it has none): sub-draw i reads its first
   // matrix at indirect[i] (a small texture of its own) and the rest after it.
   batch.onBeforeRender=()=>{};
   const old=batch._indirectTexture,iw=16,indirect=new Uint32Array(iw*Math.ceil(n/iw));
   batch._indirectTexture=new T.DataTexture(indirect,iw,indirect.length/iw,old.format,old.type);batch._indirectTexture.needsUpdate=true;old.dispose();
   const instances=new Int32Array(n);lists.set(batch._multiDrawCounts,instances);
   batch.boundingSphere=new T.Sphere(new T.Vector3(),1e6);
   const set={batch,v,members,indirect,instances,palette,serial:0};
   for(const r of members){r.set=set;rows.set(r.o,r);}
   scene.add(batch);ours.add(batch);sets.push(set);
   stats.batches++;stats.parts+=n;stats.slots+=slots;await yieldWork();
  }
 }
 await build(groups);
 // A deck kind's batch: its geometry is the kind's own (the same attribute and index objects as its pieces, never
 // copied, never disposed), its lists as long as the kind has runs, and its material a copy of the kind's with no
 // matrix lookup.
 const pieces=new Map();
 for(const K of kinds??[]){
  if(K.pieces.length<2||!batchable(K.material))continue;
  const v=batchMaterial(K.material,null,new T.Material().id,PLAIN_CHUNK),batch=new T.BatchedMesh(Math.max(1,K.runs),1,1,v.copy),first=K.pieces[0];
  batch.geometry=K.geometry;batch._geometryInitialized=true;
  batch.name='V2_draw_run '+K.material.name;batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;batch.receiveShadow=first.receiveShadow;
  batch.sortObjects=false;batch.perObjectFrustumCulled=false;batch.frustumCulled=false;batch.matrixAutoUpdate=false;
  batch.userData={noCollide:true,renderOnly:true,drawRun:true};batch.onBeforeRender=()=>{};batch.boundingSphere=new T.Sphere(new T.Vector3(),1e6);
  const set={batch,v,band:true,most:batch._multiDrawStarts.length};for(const q of K.pieces)pieces.set(q,set);
  scene.add(batch);ours.add(batch);stats.batches++;stats.parts+=K.pieces.length;
 }
 if(!sets.length&&!pieces.size)return null;
 // Ends the last row of the opaque draws: sorted after them all (group order), drawing nothing.
 const marker=new T.Mesh(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(9),3)),new T.MeshBasicMaterial());
 marker.name='V2_draw_run_end';marker.frustumCulled=false;marker.layers.enableAll();marker.userData={noCollide:true,renderOnly:true};
 // Its own hooks keep quad-facing.js's tests and the floors' occlusion off it.
 marker.material.onBeforeRender=function(){};marker.onBeforeRender=(r,world,view)=>{if(main(view,world))flush();};
 const last=new T.Group();last.name='V2_draw_run_last';last.renderOrder=1e9;last.layers.enableAll();last.userData={noCollide:true,renderOnly:true};
 last.add(marker);scene.add(last);ours.add(marker);
 let mainCamera=null,lost=false,run=null,serial=0;const held=[],calls=[],m4=new T.Matrix4();
 renderer.domElement?.addEventListener?.('webglcontextlost',()=>{lost=true;});
 const inner=renderer.renderBufferDirect;
 // The main camera's own pass: rows are held and ended only there, never in a render made inside it.
 const main=(camera,world)=>mainCamera!==null&&camera===mainCamera&&world===scene&&renderer.getRenderTarget()===null&&!scene.overrideMaterial;
 function fits(r,material){
  const o=r.o,e=o.matrixWorld.elements,w=r.world;
  for(let k=0;k<16;k++)if(e[k]!==w[k]){w.set(e);r.ok=fitWorld(e,o.isInstancedMesh);r.identity=identity(e);r.dirty=true;break;}
  if(!r.ok||o.isInstancedMesh&&(o.count<1||o.count>r.slots))return false;
  // What the batch copied at the start: the same geometry, unchanged, drawn whole, with no hooks or colours added since.
  const g=o.geometry;
  if(g!==r.g||g.index!==r.index||g.index&&g.index.version!==r.indexVersion||g.drawRange.start!==0||g.drawRange.count!==Infinity||o.instanceColor||o.morphTexture||o.onBeforeRender!==plainBefore||o.onAfterRender!==plainAfter)return false;
  for(const [k,a,version] of r.attributes)if(g.attributes[k]!==a||a.version!==version)return false;
  const {v,palette}=r.set;
  // A palette's part: drawn with the material it was offered with (its texel's), still of the batch's look and shader.
  if(!palette)return material===v.m&&v.usable;
  const look=palette.lookOf(material);
  return v.usable&&palette.ok()&&material===r.mat&&material.visible&&look!==null&&look===palette.lookOf(v.m)&&programKey(material)===programKey(v.m);
 }
 function write(r){
  const o=r.o,t=r.set.batch._matricesTexture,data=t.image.data;
  if(o.isInstancedMesh){const inst=o.instanceMatrix,c=o.count;
   if(!r.dirty&&r.inst===inst&&r.version===inst.version&&r.count===c)return;
   if(r.identity)data.set(inst.array.subarray(0,c*16),r.head*16);
   else for(let k=0;k<c;k++){m4.fromArray(inst.array,k*16).premultiply(o.matrixWorld);m4.toArray(data,(r.head+k)*16);}
   upload(t,r.head,c);r.inst=inst;r.version=inst.version;r.count=c;r.dirty=false;
  }else if(r.dirty){data.set(o.matrixWorld.elements,r.head*16);upload(t,r.head,1);r.dirty=false;}
 }
 const paint=(P,i,material)=>writeTexel({colours:P.colour,looks:P.look,glows:P.glow},i,material);
 function draw(set,camera){
  const {batch,v,indirect,instances,palette}=set,n=held.length;let moved=false;
  follow(v,true);
  for(let i=0;i<n;i++){const r=held[i];write(r);
   batch._multiDrawStarts[i]=r.start;batch._multiDrawCounts[i]=r.count3;instances[i]=r.o.isInstancedMesh?r.o.count:1;
   if(indirect[i]!==r.head){indirect[i]=r.head;moved=true;}
   if(palette)paint(palette,r.pal,calls[i][3]);}
  batch._multiDrawCount=n;if(moved)batch._indirectTexture.needsUpdate=true;
  batch.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse,batch.matrixWorld);batch.normalMatrix.getNormalMatrix(batch.modelViewMatrix);
  inner.call(renderer,camera,scene,batch.geometry,v.copy,batch,null);
  stats.runs++;stats.folded+=n-1;
 }
 // A deck kind's row: a sub-draw per held run, each clipped to its piece's own range (as three clips a group), from the
 // kind's index (Uint32: four bytes an index).
 function drawKind(set,camera){
  const {batch,v}=set,starts=batch._multiDrawStarts,counts=batch._multiDrawCounts;let k=0;
  follow(v,true);
  for(const [,,g,,,group] of calls){const r=g.drawRange,a=Math.max(group.start,r.start),b=Math.min(group.start+group.count,r.start+r.count);
   if(b<=a||k===set.most)continue;starts[k]=a*4;counts[k]=b-a;k++;}
  // In the kind's own order (piece, then band, then material), not the camera's: where two of its surfaces meet or lie a
  // hair apart, the one drawn later wins the edge (the logarithmic depth is written per pixel), so the winner stays the
  // same however the camera turns.
  for(let i=1;i<k;i++){const s=starts[i],c=counts[i];let j=i-1;while(j>=0&&starts[j]>s){starts[j+1]=starts[j];counts[j+1]=counts[j];j--;}starts[j+1]=s;counts[j+1]=c;}
  batch._multiDrawCount=k;
  batch.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse,batch.matrixWorld);batch.normalMatrix.getNormalMatrix(batch.modelViewMatrix);
  inner.call(renderer,camera,scene,batch.geometry,v.copy,batch,null);
  stats.runs++;stats.folded+=calls.length-1;
 }
 function flush(){
  if(run===null)return;const set=run;run=null;
  // A render inside the pass (another camera) may have moved a held part's view matrices since three set them.
  try{if(calls.length===1){const [camera,,,,o]=calls[0];o.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse,o.matrixWorld);o.normalMatrix.getNormalMatrix(o.modelViewMatrix);inner.apply(renderer,calls[0]);}
   else if(set.band)drawKind(set,calls[0][0]);else draw(set,calls[0][0]);}
  finally{held.length=0;calls.length=0;}
 }
 renderer.renderBufferDirect=function(camera,world,geometry,material,object,group){
  // The batches' and the marker's own places in the draw lists draw nothing.
  if(ours.has(object))return;
  if(!main(camera,world))return inner.apply(this,arguments);
  // A deck kind's piece: each of its runs joins the row (one piece may add several).
  const kind=pieces.get(object);
  if(kind){
   if(!group||geometry!==object.geometry||material!==object.material[0]||!kind.v.usable||kind.v.m!==material){flush();return inner.apply(this,arguments);}
   if(run!==kind)flush();
   if(run===null){run=kind;serial++;}
   calls.push([camera,world,geometry,material,object,group]);return HELD;
  }
  const r=rows.get(object);
  if(!r||group||geometry!==object.geometry||material!==object.material||!fits(r,material)){flush();return inner.apply(this,arguments);}
  if(run!==r.set||r.mark===serial)flush();
  if(run===null){run=r.set;serial++;}
  r.mark=serial;held.push(r);calls.push([camera,world,geometry,material,object,group]);return HELD;
 };
 // Should the opaque draws ever end in a row without the marker after them.
 const after=scene.onAfterRender;
 scene.onAfterRender=function(r,world,view){if(main(view,world))flush();return after.apply(this,arguments);};
 return {stats,enabled:true,
  /** More parts, offered later: groups as above. A part already offered is left as it is. */
  offer:build,
  line:()=>`draw runs: ${stats.runs+stats.folded} draws in ${stats.runs}`,
  around(view,draw){
   stats.runs=stats.folded=0;
   if(!this.enabled||lost||renderer.shadowMap.enabled||renderer.xr?.isPresenting)return draw();
   mainCamera=view;
   try{return draw();}finally{flush();mainCamera=null;}
  }};
}
