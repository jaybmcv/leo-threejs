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
/** Merge fixed siblings in their parent frame. With tint, the authored materials share
 * every shading property except diffuse color, which is carried per vertex. */
export function mergeMeshes(list, tint=false){
 const indexed=list.every(o=>o.geometry.index);
 const parts=list.map(o=>{
  o.updateMatrix();
  const source=o.geometry;
  const g=!indexed&&source.index?source.toNonIndexed():source.clone();
  g.applyMatrix4(o.matrix);
  if(tint){
   const colors=new Float32Array(g.attributes.position.count*3);
   for(let i=0;i<colors.length;i+=3)o.material.color.toArray(colors,i);
   g.setAttribute('color',new T.BufferAttribute(colors,3));
  }
  return o.matrix.determinant()<0?unmirror(g):g;
 });
 const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)return null;
 const first=list[0],material=tint?first.material.clone():first.material;
 if(tint){material.color.setRGB(1,1,1);material.vertexColors=true;}
 const mesh=new T.Mesh(geometry,material);
 mesh.name=first.name;mesh.renderOrder=first.renderOrder;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.layers.mask=first.layers.mask;mesh.frustumCulled=first.frustumCulled;
 return mesh;
}
function unmirror(g){
 if(g.index){const a=g.index.array;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}return g;}
 for(const a of Object.values(g.attributes)){const n=a.itemSize,v=a.array;for(let i=0;i+2<a.count;i+=3)for(let c=0;c<n;c++){const p=(i+1)*n+c,q=(i+2)*n+c,t=v[p];v[p]=v[q];v[q]=t;}}
 return g;
}
