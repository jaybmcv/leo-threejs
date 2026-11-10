import * as T from 'three';

// Another visitor's Cosmo (avatar.js) is 15 skinned parts on one skeleton in four materials, so each visitor in view cost
// 15 draws. Drawn instead as one skinned mesh per material, sharing that skeleton, a visitor costs 4. The parts stay in
// place, hidden, for what reads them: the figure's floor probes and shoe contact (dlCatFigure.ts), the catnip face, the
// board's footprint. A part whose attribute is swapped later (the eyes shut in a hammock: avatar.js) is copied into its
// merged copy by sync(). Parts that cannot share a draw (another skeleton, parent, place or bind, morphs, geometry groups,
// a partial draw range, other attributes) keep drawing on their own.

// Room round the parts' bounds for limbs that reach further than at the pose they were measured in.
const REACH_M=.5;
const sameMatrix=(a,b)=>a.elements.every((v,i)=>Math.abs(v-b.elements[i])<1e-6);
const GET=['getX','getY','getZ','getW'];
// A hidden part's own matrices are read by nothing once the figure is built (its readers read the bones), yet every pass
// over the figure remade them, with a matrix inverse each for a skinned mesh: the scene's pass and the rig's own three a
// solve (dlCatFigure.ts apply). While hidden it skips them; shown again (dispose), it is made current and updates as before.
const still=p=>{const a=p.updateMatrixWorld,b=p.updateWorldMatrix;
 p.updateMatrixWorld=function(force){if(this.visible)a.call(this,force);};p.updateWorldMatrix=function(up,down){if(this.visible)b.call(this,up,down);};};

/** parts: SkinnedMeshes (a figure's asset.meshes). Returns {meshes, merged: parts drawn through them, sync(), dispose()}. */
export function mergeSkinnedParts(parts){
 const groups=new Map();
 for(const p of parts){
  if(!p.isSkinnedMesh||!p.visible||Array.isArray(p.material)||!p.parent)continue;
  const g=p.geometry;if(g.groups.length>1||Object.keys(g.morphAttributes).length||g.drawRange.start!==0||g.drawRange.count!==Infinity)continue;
  let list=groups.get(p.material);if(!list)groups.set(p.material,list=[]);list.push(p);
 }
 const meshes=[],links=[];
 for(const [material,list] of groups){
  const first=list[0],names=Object.keys(first.geometry.attributes).sort(),size=n=>first.geometry.attributes[n].itemSize;
  const fits=p=>p.skeleton===first.skeleton&&p.parent===first.parent&&p.bindMode===first.bindMode&&sameMatrix(p.matrix,first.matrix)&&sameMatrix(p.bindMatrix,first.bindMatrix)
   &&Object.keys(p.geometry.attributes).sort().join()===names.join()&&names.every(n=>p.geometry.attributes[n].itemSize===size(n));
  const ok=list.filter(fits);if(ok.length<2)continue;
  const count=ok.reduce((n,p)=>n+p.geometry.attributes.position.count,0),geometry=new T.BufferGeometry(),starts=[];
  for(const n of names){const k=size(n),out=new(n==='skinIndex'?Uint16Array:Float32Array)(count*k);let at=0;
   for(const p of ok){const a=p.geometry.attributes[n];for(let i=0;i<a.count;i++)for(let c=0;c<k;c++)out[(at+i)*k+c]=a[GET[c]](i);at+=a.count;}
   geometry.setAttribute(n,new T.BufferAttribute(out,k));}
  const indices=ok.reduce((n,p)=>n+(p.geometry.index?p.geometry.index.count:p.geometry.attributes.position.count),0),index=new(count>65535?Uint32Array:Uint16Array)(indices);
  let ii=0,base=0;for(const p of ok){const ix=p.geometry.index,n=p.geometry.attributes.position.count;starts.push(base);
   if(ix)for(let i=0;i<ix.count;i++)index[ii++]=ix.getX(i)+base;else for(let i=0;i<n;i++)index[ii++]=i+base;base+=n;}
  geometry.setIndex(new T.BufferAttribute(index,1));
  const mesh=new T.SkinnedMesh(geometry,material);mesh.name='Merged_'+(material.name||'parts');
  mesh.position.copy(first.position);mesh.quaternion.copy(first.quaternion);mesh.scale.copy(first.scale);mesh.matrixAutoUpdate=first.matrixAutoUpdate;mesh.matrix.copy(first.matrix);
  mesh.bindMode=first.bindMode;mesh.bind(first.skeleton,first.bindMatrix);
  mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;mesh.layers.mask=first.layers.mask;mesh.frustumCulled=ok.every(p=>p.frustumCulled);
  // Culled by the parts' own skinned bounds together (in their shared frame), with room for the limbs.
  const sphere=new T.Sphere();sphere.makeEmpty();for(const p of ok){if(!p.boundingSphere)p.computeBoundingSphere();sphere.union(p.boundingSphere);}
  mesh.boundingSphere=sphere.isEmpty()?null:sphere.set(sphere.center,sphere.radius+REACH_M);
  first.parent.add(mesh);meshes.push(mesh);
  ok.forEach((p,i)=>{p.visible=false;still(p);links.push({part:p,mesh,start:starts[i],count:p.geometry.attributes.position.count,attributes:{...p.geometry.attributes}});});
 }
 return {
  meshes,merged:links.length,
  // Copy into the merged copies any part attribute swapped since (a new BufferAttribute object, as avatar.js swaps uvs).
  sync(){for(const l of links)for(const n in l.attributes){const now=l.part.geometry.attributes[n];if(now===l.attributes[n])continue;l.attributes[n]=now;
   const into=l.mesh.geometry.attributes[n],k=into.itemSize;for(let i=0;i<l.count;i++)for(let c=0;c<k;c++)into.array[(l.start+i)*k+c]=now[GET[c]](i);
   into.addUpdateRange(l.start*k,l.count*k);into.needsUpdate=true;}},
  dispose(){for(const m of meshes){m.removeFromParent();m.geometry.dispose();}
   for(const l of links){const p=l.part;p.visible=true;delete p.updateMatrixWorld;delete p.updateWorldMatrix;p.updateMatrixWorld(true);}meshes.length=0;links.length=0;},
 };
}
