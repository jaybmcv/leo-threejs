import * as T from 'three';
import {compactRenderGeometry} from './facade.js';
import {createKind,lookNow,texelGeometry} from './look-kinds.js';

// Room furnishings draw one instanced mesh per kind (phone-furnishing.js), and most kinds are rare: a lectern, a stage
// platform, a display wall, one to a few on the whole ship. The open atrium drew 128 kinds a frame, 95 of them with 16
// instances or fewer, mostly 12-triangle boxes, each its own draw. The rare kinds share about twenty materials, so each
// material's rare kinds become one BatchedMesh: one multi-draw, one sub-draw per shown instance. Common kinds stay
// instanced, since a batch would draw each of their instances on its own. Room culling (phase4-culling.js) still
// chooses the instances: for a batched kind it hands its choice to userData.furnishingBatch instead of compacting the
// mesh, which stays hidden. Only with WEBGL_multi_draw (desktops); without it a batch's sub-draws are draws again.
//
// With `kinds`, rare kinds whose materials differ only in colour, glow, roughness and metalness share one batch as well
// (look-kinds.js): its material reads each one's values from tiny float textures, each furnishing's vertices at its own
// material's texel. Its furnishings draw in the order their materials' batches did (the order they were met, each batch
// a material made in turn). A look of one material batches as before. `alone(material)`: a material that stays apart
// (one corner-shade.js leaves alone, or that a batch named after it would make so). The kinds' texels follow their
// materials: call follow() before the main render. A material that stops matching its kind is counted in proof.drift
// and warned of once (its furnishings keep the kind's look: they are drawn by the batch alone).
const RARE=16;
const attributesOf=(g,kind)=>Object.entries(g.attributes).filter(([k])=>!kind||k!=='uv').map(([k,a])=>k+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name).sort().join(',');
export function batchFurnishing(root,renderer,{kinds=false,alone=null}={}){
 if(!renderer.extensions.has('WEBGL_multi_draw'))return null;
 const buckets=new Map(),identity=new T.Matrix4(),matrix=new T.Matrix4();
 root.traverse(o=>{
  const m=o.material,g=o.geometry;
  if(!o.isInstancedMesh||!o.userData.phase4||o.userData.phase6ArchitectureSource||o.instanceMatrix.count>RARE||o.instanceColor||Array.isArray(m)||m.transparent||!g.index||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.morphAttributes).length)return;
  // Instances are placed in world space; every furnishing mesh sits at the origin.
  o.updateWorldMatrix(true,false);if(!o.matrixWorld.equals(identity))return;
  const look=kinds&&!alone?.(m)?lookNow(m,true):null;
  const key=(look===null?m.uuid:'kind '+look)+'|'+o.renderOrder+'|'+o.layers.mask+'|'+attributesOf(g,look!==null);
  let bucket=buckets.get(key);if(!bucket)buckets.set(key,bucket={look,list:[]});bucket.list.push(o);
 });
 // A look of one material batches as before: by its whole geometry, uv included.
 const sets=[];
 for(const {look,list} of buckets.values()){
  const materials=look===null?null:[...new Set(list.map(o=>o.material))];
  if(materials?.length>1){const at=new Map(materials.map((m,i)=>[m,i]));list.sort((a,b)=>at.get(a.material)-at.get(b.material));sets.push({list,materials});continue;}
  if(!materials){sets.push({list});continue;}
  const split=new Map();for(const o of list){const k=attributesOf(o.geometry,false);if(!split.has(k))split.set(k,[]);split.get(k).push(o);}
  for(const part of split.values())sets.push({list:part});
 }
 const proof={batches:0,kinds:0,instances:0,looks:0,lookMaterials:0,drift:0},looks=[];
 for(const {list,materials} of sets){
  if(list.length<2)continue;
  const kind=materials?createKind(materials,{name:'V2_furnishing_kind_'+looks.length}):null;
  const compact=list.map(o=>compactRenderGeometry(o.geometry));
  const shapes=kind?list.map((o,k)=>texelGeometry(compact[k],kind.index.get(o.material),materials.length)):compact,source=list[0].material;
  const instances=list.reduce((s,o)=>s+o.instanceMatrix.count,0),vertices=compact.reduce((s,g)=>s+g.attributes.position.count,0),indices=compact.reduce((s,g)=>s+g.index.count,0);
  // Its own copy of the material: a BatchedMesh needs its own shader variant (see batchLowDeckDraws).
  let material;
  if(kind)material=kind.material;
  else{material=source.clone();material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;}
  const batch=new T.BatchedMesh(instances,vertices,indices,material);batch.name=kind?'V2_furnishing_batch_kind_'+looks.length:'V2_furnishing_batch_'+source.name;
  // Room culling has already culled by frustum and size; the batch rebuilds its draw list only when that choice changes.
  batch.sortObjects=false;batch.perObjectFrustumCulled=false;batch.frustumCulled=false;batch.renderOrder=list[0].renderOrder;batch.layers.mask=list[0].layers.mask;batch.visible=false;
  batch.userData={noCollide:true,renderOnly:true,phase4Batch:true,sources:list.map(o=>o.uuid)};
  let shown=0;
  list.forEach((o,k)=>{
   const geometry=batch.addGeometry(shapes[k]),ids=[];compact[k].dispose();
   for(let i=0;i<o.instanceMatrix.count;i++){const id=batch.addInstance(geometry);batch.setVisibleAt(id,false);ids.push(id);}
   // `selected` indexes room culling's full instance list `all`, as its compaction does.
   let current=[];
   o.userData.furnishingBatch=(selected,all)=>{
    for(const i of current)batch.setVisibleAt(ids[i],false);
    for(const i of selected){batch.setMatrixAt(ids[i],matrix.fromArray(all,i*16));batch.setVisibleAt(ids[i],true);}
    shown+=selected.length-current.length;current=selected;batch.visible=shown>0;
   };
   o.visible=false;
  });
  root.add(batch);proof.batches++;proof.kinds+=list.length;proof.instances+=instances;
  if(kind){looks.push(kind);proof.looks++;proof.lookMaterials+=materials.length;}
 }
 let calls=0;const drifted=new WeakSet();
 proof.follow=()=>{
  const check=++calls%60===0;
  for(const K of looks){K.follow();if(!check)continue;
   for(const m of K.materials)if(!drifted.has(m)&&!K.fits(m,true)){drifted.add(m);proof.drift++;console.warn('Furnishing kind: '+m.name+' no longer matches '+K.material.name+': it keeps drawing with the kind look.');}
   if(!drifted.has(K.material)&&!K.usable()){drifted.add(K.material);proof.drift++;console.warn('Furnishing kind: '+K.material.name+' has its own values changed: they multiply every texel.');}}
 };
 proof.looksList=looks;
 return proof;
}
