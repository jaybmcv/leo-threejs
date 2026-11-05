import assert from 'node:assert/strict';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {Colliders} from '../src/walk/collision.js';
import {preparedManifest,preparedArrayReader} from './prepared-patch-v2.mjs';

// Exercise the encoded BVH, transforms and spatial-cell lookup only for the
// changed owners. Broad room clearance remains part of the full nightly run.
export async function checkFastPatchCollision(base='output/leo-interior-v02/prepared-walk'){
 const manifest=await preparedManifest(base),rooms=new Set(manifest.fastPatch?.rooms||[]);
 if(manifest.fastPatch?.dressings?.length)return checkDressingCollision(manifest,base);
 if(!rooms.size)return {status:'not applicable',rooms:[],items:0,probes:0};
 const read=preparedArrayReader(manifest,base),result={status:'PASS',rooms:[...rooms],items:0,probes:0};
 for(const [kind,record]of [['solid',manifest.colliders],['ground',manifest.colliders.ground]]){
  for(const group of record.groups){
   const selected=group.items.filter(i=>rooms.has(i.owner));if(!selected.length)continue;
   const spec=manifest.geometries[group.bvh.geometry],geometry=new T.BufferGeometry();
   for(const [name,a]of Object.entries(spec.attributes))geometry.setAttribute(name,new T.BufferAttribute(await read(a.array),a.itemSize,a.normalized));
   if(spec.index!==null)geometry.setIndex(new T.BufferAttribute(await read(spec.index),1));
   const positions=geometry.attributes.position;assert(positions?.count>=3,kind+' collision has no triangles');
   assert([...positions.array].every(Number.isFinite),kind+' collision has nonfinite vertices');
   const roots=await Promise.all(group.bvh.roots.map(async id=>{const a=await read(id);return a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength);}));
   const bvh=MeshBVH.deserialize({version:group.bvh.version,roots,index:group.bvh.index===null?null:await read(group.bvh.index),indirectBuffer:group.bvh.indirect===null?null:await read(group.bvh.indirect)},geometry,{setIndex:false});
   const items=group.items.map(item=>({...item,matrix:new T.Matrix4().fromArray(item.matrix.$matrix4),inverse:new T.Matrix4().fromArray(item.inverse.$matrix4),box:new T.Box3(new T.Vector3(...item.box.$box3[0]),new T.Vector3(...item.box.$box3[1]))}));
   const col=new Colliders();col.groups.push({name:group.name,bvh,items,cells:new Map(group.cells.map(([cell,ids])=>[cell,ids.map(id=>{assert(items[id],'Invalid collision cell index');return items[id];})]))});
   let triangle;
   for(let offset=0;offset<(geometry.index?.count??positions.count);offset+=3){const p=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(positions,geometry.index?.getX(offset+k)??offset+k)),normal=new T.Vector3().subVectors(p[1],p[0]).cross(new T.Vector3().subVectors(p[2],p[0]));if(normal.lengthSq()>1e-16){triangle={center:p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1/3),normal:normal.normalize()};break;}}
   assert(triangle,'Collision contains only degenerate triangles');
   for(const item of items.filter(i=>rooms.has(i.owner))){
    result.items++;assert(item.matrix.elements.every(Number.isFinite)&&item.inverse.elements.every(Number.isFinite),'Invalid collision transform');
    const identity=item.matrix.clone().multiply(item.inverse).elements;assert(identity.every((n,i)=>Math.abs(n-(i%5===0?1:0))<1e-5),'Collision inverse does not match transform');
    const at=triangle.center.clone().applyMatrix4(item.matrix),normal=triangle.normal.clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(item.matrix)).normalize();
    const hit=col.raycast(new T.Ray(at.clone().addScaledVector(normal,.05),normal.clone().negate()),.11);
    assert(hit&&Number.isFinite(hit.distance),kind+' encoded collision ray missed '+item.owner);result.probes++;
   }
   geometry.dispose();
  }
 }
 return result;
}

// A dressing patch rebuilds whole static and ground bands: decode each band it owns triangles in and ray-test one of
// them per span.
// A dressing that is never solid (the paintings) patches no band.
async function checkDressingCollision(manifest,base){
 const solid=manifest.fastPatch.collisionDressings??manifest.fastPatch.dressings;if(!solid.length)return {status:'not applicable',rooms:[],dressings:manifest.fastPatch.dressings,bands:0,probes:0};
 const read=preparedArrayReader(manifest,base),owners=new Set(solid.map(id=>'dressing:'+id)),result={status:'PASS',rooms:[],dressings:manifest.fastPatch.dressings,bands:0,probes:0};
 for(const [kind,col]of [['solid',manifest.colliders],['ground',manifest.colliders.ground]])for(const [band,record]of col.bands){
  const key=kind+' '+band,spans=(record.ownerSpans||[]).filter(r=>owners.has(r.owner));if(!spans.length)continue;result.bands++;
  const spec=manifest.geometries[record.geometry],geometry=new T.BufferGeometry();
  for(const [name,a]of Object.entries(spec.attributes))geometry.setAttribute(name,new T.BufferAttribute(await read(a.array),a.itemSize,a.normalized));
  if(spec.index!==null)geometry.setIndex(new T.BufferAttribute(await read(spec.index),1));
  const positions=geometry.attributes.position;assert([...positions.array].every(Number.isFinite),'Dressing band '+key+' has nonfinite vertices');
  const roots=await Promise.all(record.roots.map(async id=>{const a=await read(id);return a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength);}));
  const bvh=MeshBVH.deserialize({version:record.version,roots,index:record.index===null?null:await read(record.index),indirectBuffer:record.indirect===null?null:await read(record.indirect)},geometry,{setIndex:false});
  const triangles=(geometry.index?.count??positions.count)/3;assert.equal(record.windowFlags==null?triangles:(await read(record.windowFlags)).length,triangles,'Dressing band '+key+' flags do not match its triangles');
  for(const span of spans){
   assert(span.start+span.count<=triangles,'Dressing span outside band '+key);let probe=null;
   for(let t=span.start;t<span.start+span.count&&!probe;t++){const p=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(positions,geometry.index?geometry.index.getX(t*3+k):t*3+k)),normal=new T.Vector3().subVectors(p[1],p[0]).cross(new T.Vector3().subVectors(p[2],p[0]));if(normal.lengthSq()>1e-16)probe={center:p[0].add(p[1]).add(p[2]).multiplyScalar(1/3),normal:normal.normalize()};}
   assert(probe,'Dressing span has only degenerate triangles');
   const hit=bvh.raycastFirst(new T.Ray(probe.center.clone().addScaledVector(probe.normal,.05),probe.normal.clone().negate()),T.DoubleSide,0,.11);
   assert(hit&&Number.isFinite(hit.distance),'Encoded collision ray missed '+span.owner+' in band '+key);result.probes++;
  }
  geometry.dispose();
 }
 assert(result.probes>0,'Dressing patch has no encoded collision');return result;
}
