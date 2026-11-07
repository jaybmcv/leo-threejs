import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// A group's static parts that share a material draw as one mesh: each draw cost a desktop's main thread about 4 µs
// (the Great Cat Tree's distant copy drew 41 parts in 7 materials). Only plain, visible meshes without children merge;
// each part's own transform is baked in, and a mirrored part's triangles swap two corners so its faces keep facing out,
// as three did for it. Call once the group is built and before anything holds its parts. Returns how many it merged.
export function mergeByMaterial(group){
 const lists=new Map();
 for(const o of group.children){
  const g=o.geometry;
  if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||o.isBatchedMesh||Array.isArray(o.material)||o.children.length||!o.visible||Object.keys(g.morphAttributes).length)continue;
  const layout=Object.entries(g.attributes).map(([k,a])=>k+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name).sort().join(',');
  const key=[o.material.uuid,o.renderOrder,o.castShadow,o.receiveShadow,o.layers.mask,o.frustumCulled,layout].join('|');
  let list=lists.get(key);if(!list)lists.set(key,list=[]);list.push(o);
 }
 let merged=0;
 for(const list of lists.values()){
  if(list.length<2)continue;
  const mesh=mergeMeshes(list);if(!mesh)continue;
  for(const o of list)group.remove(o);group.add(mesh);merged+=list.length;
 }
 return merged;
}
/** One mesh drawing `list` (meshes of one material and attribute layout, siblings under one parent), its geometry in
 * that parent's space; or null if the geometries don't merge. The caller adds it and removes the originals. */
export function mergeMeshes(list){
 const indexed=list.every(o=>o.geometry.index);
 const parts=list.map(o=>{o.updateMatrix();const g=indexed?o.geometry.clone():o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);return o.matrix.determinant()<0?unmirror(g):g;});
 const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)return null;
 const first=list[0],mesh=new T.Mesh(geometry,first.material);
 mesh.name=first.name;mesh.renderOrder=first.renderOrder;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.layers.mask=first.layers.mask;mesh.frustumCulled=first.frustumCulled;
 return mesh;
}
function unmirror(g){
 if(g.index){const a=g.index.array;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}return g;}
 for(const a of Object.values(g.attributes)){const n=a.itemSize,v=a.array;for(let i=0;i+2<a.count;i+=3)for(let c=0;c<n;c++){const p=(i+1)*n+c,q=(i+2)*n+c,t=v[p];v[p]=v[q];v[q]=t;}}
 return g;
}
