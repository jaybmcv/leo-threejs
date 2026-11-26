// The owner bake's view of a built walk scene (bundled into the bake page by scripts/walk-owner-bake.mjs): the occluders
// the proof may use, with the condition each depends on, and the parts it may hide, with their boxes and identities.
import {geometryKept} from '../src/v2/shader-hooks.js';
import * as T from 'three';
import {ownerPath,ownerPrint,printNow} from '../src/v2/owner-hiding.js';

// Parts that move, ride or animate: never hidden, never occluders.
export const MOVING=/pool_ball|door|drape|curtain|yarn|ball_|swing|fan_|rotor|wheel|car_|lift|gate|shutter|lever/i;
const LIFT=/^Walk_lift_|^Lift_|^Car_/;
// Plain opaque materials only: anything transparent, cut out, refracting or shaded by custom code may let sight through.
// The depth test three uses by default (or Less) and no stencil: another depth function can draw a part through walls or
// a wall nowhere, and a stencil test can leave a wall uncovered.
const usualDepth=m=>m.depthTest!==false&&(m.depthFunc===T.LessEqualDepth||m.depthFunc===T.LessDepth)&&!m.stencilWrite&&(m.stencilFunc===undefined||m.stencilFunc===T.AlwaysStencilFunc);
// Normal blending only: an additive or multiplied surface adds to what is behind it rather than covering it.
const plainOpaque=(m,empty)=>!!m&&m.visible!==false&&!m.transparent&&(m.blending===T.NormalBlending||m.blending===T.NoBlending)&&usualDepth(m)&&(m.opacity??1)>=1&&!(m.alphaTest>0)&&!m.alphaToCoverage&&!m.alphaHash&&!m.alphaMap&&!(m.transmission>0)&&m.colorWrite!==false&&m.depthWrite!==false&&m.depthTest!==false&&!m.wireframe&&!m.isShaderMaterial&&!m.isRawShaderMaterial
 &&(m.isMeshStandardMaterial||m.isMeshBasicMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial||m.isMeshPhysicalMaterial||m.isMeshToonMaterial||m.isMeshMatcapMaterial)
 // drawn where its geometry says (no vertex-moving or discarding shader hook), and not clipped away
 &&geometryKept(m,empty)&&!m.clippingPlanes?.length;
// Morph targets move vertices at draw time.
const morphs=g=>Object.keys(g?.morphAttributes||{}).length>0;
// A growing typed array: the soup runs to tens of millions of numbers, past what a plain array can hold.
class Grow{constructor(Type,size=1<<20){this.Type=Type;this.a=new Type(size);this.n=0;}push(...v){if(this.n+v.length>this.a.length){const b=new this.Type(Math.max(this.a.length*2,this.n+v.length));b.set(this.a.subarray(0,this.n));this.a=b;}for(const x of v)this.a[this.n++]=x;}get values(){return this.a.slice(0,this.n);}}
// A merge source: copied into a merged deck mesh and never drawn itself (it counts through that mesh).
const copied=o=>{if(o.userData.bandMerged)return true;for(let p=o.parent;p;p=p.parent)if(p.userData?.mergedSources)return true;return false;};
const moving=o=>{for(let q=o;q;q=q.parent)if(MOVING.test(q.name||''))return true;return false;};
// The band a merge source belongs to: what must be shown for its triangles to be drawn (through a merged piece).
const bandOf=q=>{for(let p=q.parent;p;p=p.parent){if(p.userData?.mergedSources)return p.parent;if(/^Walk_band_\d+$/.test(p.name||''))return p;}return null;};

/** Occluder soup: {positions (Float32Array, 9 per triangle), sides, conds (indices into `conditions`), conditions
 * ([path, print] of what must be drawn: a merge source's band group, or the mesh itself), bandConds (the band ones),
 * mergeRoot (the merged pieces' group, which every band condition also needs), stats}. Merged deck meshes
 * contribute through their sources, which keep their arrays in a bake page (?ownerBake). `emptyHook`: three's empty
 * onBeforeCompile as the walk's three has it (src/v2/shader-hooks.js). */
export function collectOccluders(scene,{emptyHook}={}){
 const byUuid=new Map();scene.traverse(q=>byUuid.set(q.uuid,q));
 const conditions=[],index=new Map(),condOf=o=>{let i=index.get(o);if(i===undefined){i=conditions.length;conditions.push([ownerPath(o,scene),ownerPrint(o)]);index.set(o,i);}return i;};
 const positions=new Grow(Float32Array),sides=new Grow(Uint8Array),conds=new Grow(Uint32Array),bandConds=new Set(),stats={meshes:0,sources:0,triangles:0,skippedMaterials:0,noArrays:0};let mergeRoot=null;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),added=new Set();// every piece of a split merge lists all its sources
 const add=(o,condOf)=>{let cond=null;const g=o.geometry,p=g?.attributes?.position,ix=g?.index;if(!p?.array||ix&&!ix.array){stats.noArrays++;return;}if(morphs(g))return;
  const mats=[o.material].flat(),flip=o.matrixWorld.determinant()<0,total=ix?ix.count:p.count,dr=g.drawRange,end=Math.min(total,dr.start+dr.count);
  // three ignores geometry groups unless the material is an array.
  const groups=Array.isArray(o.material)&&g.groups?.length?g.groups:[{start:0,count:total,materialIndex:0}];
  for(const gr of groups){const m=mats[gr.materialIndex??0];if(!plainOpaque(m,emptyHook)){stats.skippedMaterials++;continue;}const side=m.side===T.DoubleSide?2:m.side===T.BackSide?1:0;
   for(let i=Math.max(gr.start,dr.start);i+2<Math.min(gr.start+gr.count,end);i+=3){
    a.fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,ix?ix.getX(i+1):i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,ix?ix.getX(i+2):i+2).applyMatrix4(o.matrixWorld);
    // Stored counter-clockwise as drawn: a mirrored object's front face flips with its determinant.
    if(cond===null)cond=condOf();const [B,C]=flip?[c,b]:[b,c];positions.push(a.x,a.y,a.z,B.x,B.y,B.z,C.x,C.y,C.z);sides.push(side);conds.push(cond);stats.triangles++;}}};
 scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||o.isBatchedMesh||moving(o))return;
  if(o.userData.sources?.length){if(o.parent&&mergeRoot===null)mergeRoot=condOf(o.parent);for(const id of o.userData.sources){if(added.has(id))continue;added.add(id);const q=byUuid.get(id),band=q&&bandOf(q);if(!band)continue;q.updateWorldMatrix(true,false);add(q,()=>{const k=condOf(band);bandConds.add(k);return k;});stats.sources++;}return;}
  // Whatever is drawn now or not: the walk shows decks as the walker moves, and each triangle's condition says when it counts.
  if(copied(o))return;add(o,()=>condOf(o));stats.meshes++;});
 return {positions:positions.values,sides:sides.values,conds:conds.values,conditions,bandConds,mergeRoot,stats};
}

const CLUSTER=4;
// A big mesh's triangles grouped into 4 m clusters, each with its own box (a far wall's box would cover the whole deck).
function clusters(o,box){
 const g=o.geometry,p=g.attributes.position,ix=g.index,s=box.getSize(new T.Vector3());
 if(Math.max(s.x,s.y,s.z)<=CLUSTER*1.5||!p?.array||ix&&!ix.array)return [box];
 const m=new Map(),v=[new T.Vector3(),new T.Vector3(),new T.Vector3()],n=(ix?ix.count:p.count)/3;
 for(let f=0;f<n;f++){for(let k=0;k<3;k++)v[k].fromBufferAttribute(p,ix?ix.getX(f*3+k):f*3+k).applyMatrix4(o.matrixWorld);
  const key=[0,1,2].map(a=>Math.floor((v[0].getComponent(a)+v[1].getComponent(a)+v[2].getComponent(a))/3/CLUSTER)).join(',');let bb=m.get(key);if(!bb)m.set(key,bb=new T.Box3());bb.expandByPoint(v[0]).expandByPoint(v[1]).expandByPoint(v[2]);}
 return [...m.values()];
}

/** Parts the bake may hide, whether or not they are drawn at the moment (the walk shows decks as the walker moves), grouped
 * by owner (an instanced or merged mesh is its own owner; any other part belongs to its feature root):
 * [{root, parts:[{o, path, print, boxes, slots?}]}]. A cabin part (re-packed from userData.near.all)
 * lists its slots: [{id, centre, box}]. Left out: movers, lift parts, shadow casters, see-through parts, other instanced
 * meshes (their shown instances change and their full list is not exposed). A part with something attached to it is
 * still listed, though its boxes cover only its own triangles: the walk never hides one while it has children
 * (owner-hiding.js), and leaving it out here would make the list depend on when its children arrive, which the bake's
 * pages must agree on (walk-owner-bake.mjs refuses the bake when their tables hold different rows). */
export function collectTargets(scene,{emptyHook}={}){
 const isRoot=q=>!q.parent||q.parent===scene||/^Walk_band_\d+$|live_source|^V2_live/i.test(q.parent.name||'');
 const ownerOf=o=>{if(o.isInstancedMesh||/_merged_|^Walk_merged_/.test(o.name||''))return o;let q=o;while(!isRoot(q))q=q.parent;return q;};
 const groups=new Map(),byUuid=new Map();scene.traverse(q=>byUuid.set(q.uuid,q));
 const boxesOf=o=>{const g=o.geometry,own=!!g.attributes.position?.array&&(!g.index||!!g.index.array);
  // A merged deck piece holds every run it may draw in its own arrays (kept on the bake page): its clusters bound it
  // whichever decks show. Only without them do its merge's sources stand in.
  // From every vertex: the walk narrows a merged piece's boundingBox to the decks shown.
  if(own)return clusters(o,new T.Box3().setFromBufferAttribute(g.attributes.position).applyMatrix4(o.matrixWorld));
  if(!o.userData.sources?.length)return null;
  return o.userData.sources.flatMap(id=>{const q=byUuid.get(id),qg=q?.geometry;if(!qg)return [null];if(!qg.boundingBox){if(!qg.attributes.position?.array)return [null];qg.computeBoundingBox();}q.updateWorldMatrix(true,false);return clusters(q,qg.boundingBox.clone().applyMatrix4(q.matrixWorld));});
};
 const visit=o=>{if(o.userData?.mergedSources||copied(o))return;
  if(o.isMesh&&!o.isSkinnedMesh&&!o.isBatchedMesh&&!o.castShadow&&!morphs(o.geometry)&&[o.material].flat().every(m=>m&&!m.transparent&&m.visible!==false&&usualDepth(m)&&geometryKept(m,emptyHook))){// another depth test can draw it through walls
   const root=ownerOf(o);let lifted=false;for(let q=o;q;q=q.parent)if(LIFT.test(q.name||'')){lifted=true;break;}
   if(!lifted&&!moving(o)){let part=null;
    if(o.isInstancedMesh){const near=o.userData.near;if(near&&o.userData.cabinIds&&!o.userData.boat&&o.geometry.attributes.position?.array){const g=o.geometry,local=new T.Box3().setFromBufferAttribute(g.attributes.position);
      part={o,slots:near.all.map((m,i)=>({id:o.userData.cabinIds[i],centre:near.centres[i],box:local.clone().applyMatrix4(m.clone().premultiply(o.matrixWorld))}))};}}
    else{const boxes=boxesOf(o);if(boxes&&!boxes.includes(null))part={o,boxes};}
    if(part){part.path=ownerPath(o,scene);part.print=ownerPrint(o);if(part.print){let e=groups.get(root);if(!e)groups.set(root,e={root,parts:[]});e.parts.push(part);}}}}
  for(const c of o.children)visit(c);};
 visit(scene);return [...groups.values()];
}

// Two independent 32-bit lanes over 32-bit words (FNV-1a and a murmur3 round), so a digest is 64 bits.
const fnv=(h,w)=>Math.imul(h^w,0x01000193)>>>0;
const mur=(h,k)=>{k=Math.imul(k,0xcc9e2d51);k=k<<15|k>>>17;h^=Math.imul(k,0x1b873593);h=h<<13|h>>>19;return Math.imul(h,5)+0xe6546b64>>>0;};
const hex=(a,b,n)=>a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')+'.'+n;
const words=(x,y,list)=>{for(const v of list){x=fnv(x,v);y=mur(y,v);}return [x,y];};
const textWords=t=>{const out=new Uint32Array(t.length+1);out[0]=t.length;for(let i=0;i<t.length;i++)out[i+1]=t.charCodeAt(i);return out;};
// A number's exact float64 bits.
const F64=new Float64Array(1),W64=new Uint32Array(F64.buffer);
const numberWords=list=>{const out=new Uint32Array(list.length*2);list.forEach((v,i)=>{F64[0]=v;out[i*2]=W64[0];out[i*2+1]=W64[1];});return out;};
const boxNumbers=b=>[b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z];

// A merged piece's material as far as it decides whether the piece draws its sources' triangles as walls: the wall test's
// verdict and what it reads (the bake tests the sources' materials; the walk draws the piece's).
const pieceMaterial=(m,empty)=>m?[plainOpaque(m,empty)?1:0,m.type,m.side,m.transparent,m.opacity,m.alphaTest,m.blending,m.depthTest,m.depthWrite,m.depthFunc,m.colorWrite,
 m.stencilWrite,m.stencilFunc,!!m.alphaMap,m.alphaHash,m.alphaToCoverage,m.transmission??0,m.wireframe,m.visible,m.clippingPlanes?.length??0,m.onBeforeCompile===empty?0:1].join(':'):'none';
// A typed array's bytes as 32-bit words (a view when they divide into words).
const arrayWords=a=>a.byteLength%4===0?new Uint32Array(a.buffer,a.byteOffset,a.byteLength/4):Uint32Array.from(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));

/** What each row's proofs read, as the scene is now, for carrying a bake to a later build of the same scene
 * (scripts/walk-owner-carry.mjs): {parts, conds}, Maps from a row's path to `print#digest`. A wall (condition): the
 * triangles it adds to the occluder soup with their sides, in order. A band's are its merge sources', but what draws them
 * is the merged pieces listing those sources (merged by material across bands): every such piece counts for the band, by
 * its path, print where it will be drawn (owner-hiding.js printNow: the walk leaves a hidden branch's world matrices
 * stale), its own materials as the wall test reads them (pieceMaterial), source paths, groups, draw range and geometry
 * arrays, so a piece that draws anything else drops each band it draws (a band with a piece whose arrays are gone has none). A part: the boxes the proof covered, or a cabin
 * part's slots. Rows come from collectOccluders and collectTargets themselves, so one the bake would not use now
 * (a cut-out or shader-hooked material, a shadow caster, a mover) has none; neither has a path met twice (null).
 * Prints alone are identities within one build: a vertex moved inside a wall's box, alphaTest set on its material or a
 * band's merge source moved leaves them as they were. */
export function rowDigests(scene,{emptyHook}={}){
 const occ=collectOccluders(scene,{emptyHook}),n=occ.conditions.length,a=new Uint32Array(n).fill(0x811c9dc5),b=new Uint32Array(n).fill(0x9747b28c),count=new Uint32Array(n);
 const soup=new Uint32Array(occ.positions.buffer,occ.positions.byteOffset,occ.positions.length);
 for(let t=0;t<occ.conds.length;t++){const c=occ.conds[t];let x=a[c],y=b[c];for(let i=t*9,e=i+9;i<e;i++){x=fnv(x,soup[i]);y=mur(y,soup[i]);}a[c]=fnv(x,occ.sides[t]+1);b[c]=mur(y,occ.sides[t]+1);count[c]++;}
 const blind=new Set();
 if(occ.bandConds.size){const byUuid=new Map();scene.traverse(q=>byUuid.set(q.uuid,q));const condAt=new Map(occ.conditions.map(([path],i)=>[path,i]));
  scene.traverse(o=>{if(!o.isMesh||!o.userData.sources?.length)return;const g=o.geometry,p=g?.attributes?.position,bands=new Set();
   const sources=o.userData.sources.map(id=>{const q=byUuid.get(id),band=q&&bandOf(q),k=band&&condAt.get(ownerPath(band,scene));if(k!==undefined&&occ.bandConds.has(k))bands.add(k);return q?ownerPath(q,scene):'?';});
   if(!bands.size)return;if(!p?.array||g.index&&!g.index.array){for(const k of bands)blind.add(k);return;}
   let [x,y]=words(0x811c9dc5,0x9747b28c,textWords([ownerPath(o,scene),printNow(o),[o.material].flat().map(m=>pieceMaterial(m,emptyHook)).join(';'),sources.join(','),JSON.stringify(g.groups),g.drawRange.start,g.drawRange.count].join('|')));
   [x,y]=words(x,y,arrayWords(p.array));if(g.index)[x,y]=words(x,y,arrayWords(g.index.array));
   for(const k of bands){a[k]=fnv(fnv(a[k],x),y);b[k]=mur(mur(b[k],x),y);}});}
 const conds=new Map();occ.conditions.forEach(([path,print],i)=>conds.set(path,conds.has(path)||blind.has(i)?null:print+'#'+hex(a[i],b[i],count[i])));
 const parts=new Map();
 for(const {parts:list} of collectTargets(scene,{emptyHook}))for(const p of list){
  let x=0x811c9dc5,y=0x9747b28c,k=0;
  if(p.slots)for(const s of p.slots){[x,y]=words(x,y,textWords(String(s.id)));[x,y]=words(x,y,numberWords([...s.centre.toArray(),...boxNumbers(s.box)]));k++;}
  else for(const box of p.boxes){[x,y]=words(x,y,numberWords(boxNumbers(box)));k++;}
  parts.set(p.path,parts.has(p.path)?null:p.print+'#'+(p.slots?'s':'b')+hex(x,y,k));}
 return {parts,conds};
}
/** rowDigests for a bake's tables {parts, conds} (rows [path, print, ...]): {parts, conds}, one digest per row, null for
 * a row the scene has none for. */
export function tableDigests(scene,tables,options){
 const d=rowDigests(scene,options);
 return {parts:tables.parts.map(r=>d.parts.get(r[0])??null),conds:tables.conds.map(r=>d.conds.get(r[0])??null)};
}

// Two pages' tables ({parts, conditions}: rows [path, print, ...]): null when they hold different things (rows of other
// paths, or another count), else the rows whose prints differ: parts or walls that moved on their own between the pages.
export function tablesDiffer(a,b){
 const out={parts:[],conditions:[]};
 for(const k of ['parts','conditions']){if(a[k].length!==b[k].length)return null;
  for(let i=0;i<a[k].length;i++){if(a[k][i][0]!==b[k][i][0])return null;if(JSON.stringify(a[k][i])!==JSON.stringify(b[k][i]))out[k].push(i);}}
 return out;
}
// A block's entries ([part, [cond...], slots?]) without those relying on a moved row, as the part hidden or a wall.
export const withoutMoved=(list,moved)=>{const p=new Set(moved.parts),c=new Set(moved.conditions);return list.filter(e=>!p.has(e[0])&&!e[1].some(k=>c.has(k)));};
