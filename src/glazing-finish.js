import * as T from 'three';

// Two opposed, single-sided surfaces keep the art-directed tint in exported
// glTF as well as in the viewer. This is a visual treatment, not optical physics.
export const GLASS_TINT={outsideOpacity:.88,insideOpacity:.12};
const outside=new T.MeshPhysicalMaterial({name:'LEO_glass_exterior_tint',color:0x163b50,roughness:.12,metalness:.3,clearcoat:1,clearcoatRoughness:.09,transparent:true,opacity:GLASS_TINT.outsideOpacity,side:T.FrontSide,depthWrite:false});
const inside=new T.MeshPhysicalMaterial({name:'LEO_glass_interior_clear',color:0x92bec9,roughness:.08,metalness:0,transparent:true,opacity:GLASS_TINT.insideOpacity,side:T.FrontSide,depthWrite:false});
const contextDefaults=new WeakMap();
export function applyContextOpacity(root,value){root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!contextDefaults.has(m))contextDefaults.set(m,{transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite});const base=contextDefaults.get(m),transparent=base.transparent||value<1;if(m.transparent!==transparent)m.needsUpdate=true;m.transparent=transparent;m.opacity=base.opacity*value;m.depthWrite=base.depthWrite&&value===1;}});}

// outward is expressed in mesh-local coordinates, evaluated per triangle.
export function tintWindow(mesh,outward){
 if(mesh.userData.directionalGlazing)return mesh;
 const src=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),p=src.attributes.position;
 const positions=[],normals=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),center=new T.Vector3();
 for(let i=0;i<p.count;i+=3){
  a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
  center.copy(a).add(b).add(c).multiplyScalar(1/3);n.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
  const sign=n.dot(outward(center))<0?-1:1;if(sign<0){const swap=b.clone();b.copy(c);c.copy(swap);n.negate();}
  positions.push(...a.toArray(),...b.toArray(),...c.toArray());for(let j=0;j<3;j++)normals.push(...n.toArray());
 }
 const count=positions.length/3;
 for(let i=0;i<count;i+=3)for(const j of [2,1,0]){const k=(i+j)*3;positions.push(positions[k],positions[k+1],positions[k+2]);normals.push(-normals[k],-normals[k+1],-normals[k+2]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.addGroup(0,count,0);g.addGroup(count,count,1);src.dispose();mesh.geometry=g;mesh.material=[outside,inside];mesh.castShadow=false;mesh.receiveShadow=false;
 mesh.userData.directionalGlazing={...GLASS_TINT,outwardTriangles:count/3};return mesh;
}

export function tintBoxWindow(mesh,axis='z',sign=1){
 mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox,s=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
 const g=new T.PlaneGeometry(axis==='x'?s.z:s.x,axis==='y'?s.z:s.y);if(axis==='x')g.rotateY(Math.PI/2);if(axis==='y')g.rotateX(-Math.PI/2);g.translate(c.x,c.y,c.z);mesh.geometry=g;
 return tintWindow(mesh,()=>new T.Vector3(axis==='x'?sign:0,axis==='y'?sign:0,axis==='z'?sign:0));
}

export function tintWorldWindow(mesh,outward){
 mesh.updateWorldMatrix(true,false);const invNormal=new T.Matrix3().getNormalMatrix(mesh.matrixWorld).invert();
 return tintWindow(mesh,c=>outward(c.clone().applyMatrix4(mesh.matrixWorld)).applyMatrix3(invNormal));
}
