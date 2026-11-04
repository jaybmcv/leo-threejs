import * as T from 'three';
import {opaqueRayHit} from './opaque-ray.js';

// Exact boolean sight query. Glass does not hide what is behind it, but a
// subsequent opaque triangle in the same BVH still can.
export function opaqueBlocked(query,ray,far,scratch){
 const {box,point,local,stats}=scratch;
 stats.rays++;box.setFromPoints([ray.origin,ray.at(far,point)]).expandByScalar(.01);
 for(const[bvh,inverse]of query.near(box,ray)){
  local.copy(ray);if(inverse)local.applyMatrix4(inverse);
  if(opaqueRayHit(bvh,local,.05,far,scratch.hit??=new T.Vector3())){stats.firstHits++;return true;}
 }
 return false;
}
