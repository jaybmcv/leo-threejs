import {Box3,Frustum,Material} from 'three';
// three culls a mesh by its geometry's bounding sphere. Long, thin baked meshes (floor and glazing runs) have spheres far
// larger than they are, so many pass while every part of them is off screen: about a tenth of a frame's draws in the
// atrium views. A mesh whose sphere passes is also tested by its geometry's box in world space, against the same planes;
// a box wholly outside one plane holds no visible vertex. Only plain meshes drawn where their vertices are get the box:
// instanced, batched and skinned objects (bounds of their own), morphs, interleaved positions (their version is the
// shared buffer's) and materials that move vertices in the shader (hooks, shader materials, displacement maps) keep the
// sphere alone. The box is made from the position attribute, again whenever that attribute changes.
const boxes=new WeakMap();
const plain=m=>m.onBeforeCompile===Material.prototype.onBeforeCompile&&!m.isShaderMaterial&&!m.displacementMap;
function localBox(g){
 const p=g.attributes.position;if(!p||p.isInterleavedBufferAttribute||g.morphAttributes.position)return null;
 let b=boxes.get(g);if(b?.attribute!==p||b.version!==p.version)boxes.set(g,b={attribute:p,version:p.version,box:new Box3().setFromBufferAttribute(p)});
 return b.box.isEmpty()?null:b.box;
}
export function cullByBox(){
 const sphere=Frustum.prototype.intersectsObject;if(sphere.byBox)return;
 Frustum.prototype.intersectsObject=Object.assign(function(o){
  if(!sphere.call(this,o))return false;
  if(!o.isMesh||o.boundingSphere!==undefined||!(Array.isArray(o.material)?o.material.every(plain):plain(o.material)))return true;
  const box=localBox(o.geometry);if(!box)return true;
  const e=o.matrixWorld.elements,{min,max}=box,cx=(min.x+max.x)/2,cy=(min.y+max.y)/2,cz=(min.z+max.z)/2,hx=(max.x-min.x)/2,hy=(max.y-min.y)/2,hz=(max.z-min.z)/2;
  const x=e[0]*cx+e[4]*cy+e[8]*cz+e[12],y=e[1]*cx+e[5]*cy+e[9]*cz+e[13],z=e[2]*cx+e[6]*cy+e[10]*cz+e[14];
  const rx=Math.abs(e[0])*hx+Math.abs(e[4])*hy+Math.abs(e[8])*hz,ry=Math.abs(e[1])*hx+Math.abs(e[5])*hy+Math.abs(e[9])*hz,rz=Math.abs(e[2])*hx+Math.abs(e[6])*hy+Math.abs(e[10])*hz;
  for(const {normal:n,constant} of this.planes)if(n.x*x+n.y*y+n.z*z+constant<-(Math.abs(n.x)*rx+Math.abs(n.y)*ry+Math.abs(n.z)*rz))return false;
  return true;
 },{byBox:true});
}
