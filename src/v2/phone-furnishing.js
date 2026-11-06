// The phone ship (PHONE_WALK.md) draws each kind of room furnishing once for the whole ship, not once per deck: the
// furnishing room culling compacts (src/v2/phase4-culling.js) came as about 1,080 instanced meshes, one per deck, part
// and size, and the arrival hall drew 509 of them a frame.
// Before room culling starts, meshes of the same part, material and shape are combined into one instanced mesh, their
// instances and owner runs one after another, and the originals leave the scene. Room culling then chooses instances
// across every deck as it did within one. Owners room culling doesn't know from the layout used to take the bounds of
// the first mesh with a run of theirs; every furnishing mesh, combined or not, carries those boxes in
// userData.ownerBoxes, so they keep them whatever mesh room culling meets first. Shapes combine only with equal
// supplied bounds too, since room culling's screen-size test reads each mesh's bounding sphere.
import * as T from 'three';

// The vertices a shape draws, in order: prepared meshes share vertex pools, so equal shapes need not share arrays.
function drawnVertices(g){
 const names=Object.keys(g.attributes).sort(),ix=g.index,n=ix?ix.count:g.attributes.position.count,out=[];
 for(let k=0;k<n;k++){const i=ix?ix.getX(k):k;for(const name of names){const a=g.attributes[name];for(let c=0;c<a.itemSize;c++)out.push(a.getComponent(i,c));}}
 return {names:names.join(','),values:Float32Array.from(out)};
}
const same=(a,b)=>a.names===b.names&&a.values.length===b.values.length&&a.values.every((v,i)=>Object.is(v,b.values[i]));
const sphereKey=g=>{const b=g.boundingSphere;return b?[b.center.x,b.center.y,b.center.z,b.radius].join(','):'none';};

/** `root` is ship.inside. Returns {meshes, sources}: combined meshes made and originals they replace. */
export function mergePhoneFurnishing(root){
 const list=[];root.traverse(o=>{if(o.isInstancedMesh&&o.userData.phase4&&!o.userData.phase6ArchitectureSource)list.push(o);});
 // Owner bounds as room culling takes them for owners outside the layout: from the first mesh, in this order.
 const ownerBoxes={};
 for(const o of list){o.updateWorldMatrix(true,false);for(const run of o.userData.ownerRuns||[])if(!(run.component in ownerBoxes)){o.computeBoundingBox();ownerBoxes[run.component]=o.boundingBox.clone().applyMatrix4(o.matrixWorld);}}
 for(const o of list)o.userData.ownerBoxes=ownerBoxes;
 const kinds=new Map();
 for(const o of list){
  const m=o.material,g=o.geometry;
  if(Array.isArray(m)||m.transparent||o.instanceColor||o.morphTexture||Object.keys(g.morphAttributes).length||!o.userData.ownerRuns)continue;
  const key=[o.name,m.uuid,o.renderOrder,!!o.userData.noCollide,o.castShadow,o.receiveShadow,o.parent?.parent?.uuid,sphereKey(g)].join('|');
  let shapes=kinds.get(key);if(!shapes)kinds.set(key,shapes=[]);
  const shape=drawnVertices(g);let entry=shapes.find(e=>same(e.shape,shape));if(!entry)shapes.push(entry={shape,meshes:[]});entry.meshes.push(o);
 }
 const meshes=[],sources=[],inverse=new T.Matrix4(),local=new T.Matrix4(),relative=new T.Matrix4();
 for(const shapes of kinds.values())for(const {meshes:group} of shapes){
  if(group.length<2)continue;
  const first=group[0],parent=first.parent.parent,total=group.reduce((s,o)=>s+o.instanceMatrix.count,0);
  parent.updateWorldMatrix(true,false);inverse.copy(parent.matrixWorld).invert();
  const o=new T.InstancedMesh(first.geometry,first.material,total),runs=[],owners=new Set();let at=0;
  for(const src of group){
   relative.multiplyMatrices(inverse,src.matrixWorld);
   for(let i=0;i<src.instanceMatrix.count;i++){src.getMatrixAt(i,local);o.setMatrixAt(at+i,local.premultiply(relative));}
   for(const run of src.userData.ownerRuns)runs.push({...run,start:run.start+at});
   for(const id of src.userData.roomOwners||[])owners.add(id);
   at+=src.instanceMatrix.count;sources.push(src);src.removeFromParent();
  }
  o.name=first.name;o.renderOrder=first.renderOrder;o.castShadow=first.castShadow;o.receiveShadow=first.receiveShadow;
  // Room culling picks the instances in view; the whole ship's bounds would never cull.
  o.frustumCulled=false;o.matrixAutoUpdate=false;
  o.userData={...first.userData,roomOwners:[...owners],ownerRuns:runs,ownerBoxes,phoneMerged:group.length};
  parent.add(o);o.updateMatrixWorld(true);meshes.push(o);
 }
 return {meshes,sources};
}
