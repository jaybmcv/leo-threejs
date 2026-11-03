import * as T from 'three';

// Exact boolean sight query. Glass does not hide what is behind it, but a
// subsequent opaque triangle in the same BVH still can.
export function opaqueBlocked(query,ray,far,scratch){
 const {box,point,local,stats}=scratch;
 stats.rays++;box.setFromPoints([ray.origin,ray.at(far,point)]).expandByScalar(.01);
 for(const[bvh,inverse]of query.near(box,ray)){
  local.copy(ray);if(inverse)local.applyMatrix4(inverse);
  const first=bvh.raycastFirst(local,T.DoubleSide,.05,far);if(!first)continue;
  if(!bvh.leoWindowFlags?.[first.faceIndex]){stats.firstHits++;return true;}
  stats.windowFallbacks++;
  if(bvh.raycast(local,T.DoubleSide,.05,far).some(h=>!bvh.leoWindowFlags?.[h.faceIndex]))return true;
 }
 return false;
}
