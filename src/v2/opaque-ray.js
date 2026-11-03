import {Vector3} from 'three';

// Visibility needs a boolean opaque hit, not allocated face/normal/UV results.
// Keep the same double-sided triangle test and inclusive distance limits.
export function opaqueRayHit(bvh,ray,near,far,hit=new Vector3()){
 const flags=bvh.leoWindowFlags,o=ray.origin,d=ray.direction;
 const ix=1/d.x,iy=1/d.y,iz=1/d.z,scale=1/d.length();
 // Bounds are conservative at floating-point boundaries; triangles retain the
 // exact original distance checks. Inverses are shared by the entire traversal.
 const lo=(near-1e-7)*scale,hi=(far+1e-7)*scale;
 const intersectsBounds=box=>{
  let a=((ix>=0?box.min.x:box.max.x)-o.x)*ix,b=((ix>=0?box.max.x:box.min.x)-o.x)*ix;
  const c=((iy>=0?box.min.y:box.max.y)-o.y)*iy,e=((iy>=0?box.max.y:box.min.y)-o.y)*iy;
  if(a>e||c>b)return false;if(c>a||Number.isNaN(a))a=c;if(e<b||Number.isNaN(b))b=e;
  const f=((iz>=0?box.min.z:box.max.z)-o.z)*iz,g=((iz>=0?box.max.z:box.min.z)-o.z)*iz;
  if(a>g||f>b)return false;if(f>a||Number.isNaN(a))a=f;if(g<b||Number.isNaN(b))b=g;
  return !(b<0||b<lo||a>hi);
 };
 return bvh.shapecast({intersectsBounds,intersectsTriangle:(triangle,index)=>{
  if(flags?.[index]||!ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit))return false;
  const distance=o.distanceTo(hit);return distance>=near&&distance<=far;
 }});
}
