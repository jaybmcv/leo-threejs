import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {PreparedWriter} from '../src/v2/prepared-codec.js';

// `additions` and `groundAdditions` (static band -> {positions, flags, spans}) follow the kept triangles, as a full build
// commits a dressing created after collision (fast-dressing-v2.mjs); lane B passes none.
export async function removeOwnedSpans(manifest,patch,read,owners,additions=new Map(),groundAdditions=new Map()){
 let renderTriangles=0,collisionTriangles=0;
 for(const [,graph]of manifest.bands)for(const node of graph.nodes){
  if(node.geometry===undefined)continue;
  const original=manifest.geometries[node.geometry],ranges=original.userData?.preparedRanges||[];
  if(!ranges.some(r=>owners.has(r.patchOwner===undefined?r.owner:r.patchOwner)))continue;
  const index=await read(original.index),keep=[],nextRanges=[];
  const remove=new Uint8Array(index.length/3);
  for(const r of ranges)if(owners.has(r.patchOwner===undefined?r.owner:r.patchOwner))remove.fill(1,r.start,r.start+r.count);
  const remap=new Uint32Array(remove.length);for(let i=0;i<remove.length;i++){remap[i]=keep.length/3;if(remove[i])renderTriangles++;else keep.push(index[i*3],index[i*3+1],index[i*3+2]);}
  for(const r of ranges)if(!owners.has(r.patchOwner===undefined?r.owner:r.patchOwner))nextRanges.push({...r,start:remap[r.start]});
  const geometry=structuredClone(original);geometry.index=patch.array(new index.constructor(keep));geometry.userData.preparedRanges=nextRanges;
  node.geometry=manifest.geometries.length;manifest.geometries.push(geometry);
 }
 const band=(key,kept,keptFlags,keptSpans)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(kept),3));const bvh=new MeshBVH(g,{targetLeafSize:8,indirect:true});bvh.leoWindowFlags=new Uint8Array(keptFlags);bvh.leoOwnerSpans=keptSpans;
  const writer=new PreparedWriter(),r=writer.bvh(bvh),relocate=patch.absorb(writer);return relocate.colliders({bands:[[key,r]],groups:[],movers:[],ground:null}).bands[0][1];};
 const append=(extra,kept,keptFlags,keptSpans)=>{const offset=kept.length/9;for(const s of extra.spans){const start=s.start+offset,previous=keptSpans.at(-1);if(previous&&previous.owner===s.owner&&previous.start+previous.count===start)previous.count+=s.count;else keptSpans.push({owner:s.owner,start,count:s.count});}for(const v of extra.positions)kept.push(v);for(const f of extra.flags)keptFlags.push(f);};
 const filter=async(col,adds)=>{
  for(const row of col.bands){const record=row[1],ranges=record.ownerSpans||[],extra=adds.get(row[0]);if(!ranges.some(r=>owners.has(r.owner))&&!extra)continue;
   const geometry=manifest.geometries[record.geometry],positions=await read(geometry.attributes.position.array),flags=record.windowFlags==null?null:await read(record.windowFlags);
   // Owner spans follow triangle index order, including the full-build
   // collision pack permutation. Vertices can remain shared or reordered.
   const index=geometry.index==null?null:await read(geometry.index),count=(index?.length??positions.length/3)/3,remove=new Uint8Array(count),kept=[],keptFlags=[],keptSpans=[];
   for(const r of ranges)if(owners.has(r.owner))remove.fill(1,r.start,r.start+r.count);
   const ownerAt=new Array(count);for(const r of ranges)for(let i=r.start;i<r.start+r.count;i++)ownerAt[i]=r.owner;
   for(let i=0;i<count;i++){if(remove[i]){collisionTriangles++;continue;}const start=kept.length/9,owner=ownerAt[i]??null,previous=keptSpans.at(-1);if(previous&&previous.owner===owner)previous.count++;else keptSpans.push({owner,start,count:1});for(let k=0;k<3;k++){const vertex=index?index[i*3+k]:i*3+k;for(let axis=0;axis<3;axis++)kept.push(positions[vertex*3+axis]);}keptFlags.push(flags?.[i]||0);}
   if(extra)append(extra,kept,keptFlags,keptSpans);
   if(!kept.length){row[1]=null;continue;}
   row[1]=band(row[0],kept,keptFlags,keptSpans);
  }
  for(const [key,extra]of adds)if(!col.bands.some(([k])=>k===key)){const kept=[],keptFlags=[],keptSpans=[];append(extra,kept,keptFlags,keptSpans);col.bands.push([key,band(key,kept,keptFlags,keptSpans)]);}
  col.bands=col.bands.filter(([,r])=>r);if(col.ground)await filter(col.ground,groundAdditions);
 };await filter(manifest.colliders,additions);
 return {renderTriangles,collisionTriangles};
}
