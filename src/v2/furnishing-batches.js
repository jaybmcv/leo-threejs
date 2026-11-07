import * as T from 'three';
import {compactRenderGeometry} from './facade.js';

// Room furnishings draw one instanced mesh per kind (phone-furnishing.js), and most kinds are rare: a lectern, a stage
// platform, a display wall, one to a few on the whole ship. The open atrium drew 128 kinds a frame, 95 of them with 16
// instances or fewer, mostly 12-triangle boxes, each its own draw. The rare kinds share about twenty materials, so each
// material's rare kinds become one BatchedMesh: one multi-draw, one sub-draw per shown instance. Common kinds stay
// instanced, since a batch would draw each of their instances on its own. Room culling (phase4-culling.js) still
// chooses the instances: for a batched kind it hands its choice to userData.furnishingBatch instead of compacting the
// mesh, which stays hidden. Only with WEBGL_multi_draw (desktops); without it a batch's sub-draws are draws again.
const RARE=16;
export function batchFurnishing(root,renderer){
 if(!renderer.extensions.has('WEBGL_multi_draw'))return null;
 const buckets=new Map(),identity=new T.Matrix4(),matrix=new T.Matrix4();
 root.traverse(o=>{
  const m=o.material,g=o.geometry;
  if(!o.isInstancedMesh||!o.userData.phase4||o.userData.phase6ArchitectureSource||o.instanceMatrix.count>RARE||o.instanceColor||Array.isArray(m)||m.transparent||!g.index||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.morphAttributes).length)return;
  // Instances are placed in world space; every furnishing mesh sits at the origin.
  o.updateWorldMatrix(true,false);if(!o.matrixWorld.equals(identity))return;
  const attributes=Object.entries(g.attributes).map(([k,a])=>k+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name).sort().join(',');
  const key=m.uuid+'|'+o.renderOrder+'|'+o.layers.mask+'|'+attributes;let list=buckets.get(key);if(!list)buckets.set(key,list=[]);list.push(o);
 });
 const proof={batches:0,kinds:0,instances:0};
 for(const list of buckets.values()){
  if(list.length<2)continue;
  const compact=list.map(o=>compactRenderGeometry(o.geometry)),source=list[0].material;
  const instances=list.reduce((s,o)=>s+o.instanceMatrix.count,0),vertices=compact.reduce((s,g)=>s+g.attributes.position.count,0),indices=compact.reduce((s,g)=>s+g.index.count,0);
  // Its own copy of the material: a BatchedMesh needs its own shader variant (see batchLowDeckDraws).
  const material=source.clone();material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;
  const batch=new T.BatchedMesh(instances,vertices,indices,material);batch.name='V2_furnishing_batch_'+source.name;
  // Room culling has already culled by frustum and size; the batch rebuilds its draw list only when that choice changes.
  batch.sortObjects=false;batch.perObjectFrustumCulled=false;batch.frustumCulled=false;batch.renderOrder=list[0].renderOrder;batch.layers.mask=list[0].layers.mask;batch.visible=false;
  batch.userData={noCollide:true,renderOnly:true,phase4Batch:true,sources:list.map(o=>o.uuid)};
  let shown=0;
  list.forEach((o,k)=>{
   const geometry=batch.addGeometry(compact[k]),ids=[];compact[k].dispose();
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
 }
 return proof;
}
