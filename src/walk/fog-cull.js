import * as T from 'three';

// Indoors the fog is solid at scene.fog.far (148 m): a part wholly beyond it draws as fog colour, the same as the fogged
// walls and floors behind it (the merged deck bands, which always draw), so it need not draw at all. Looking down the
// ship from a Deck 1 room drew 655 parts where 277 show. Three fogs by depth along the view, not by distance, so a part
// is left out only when it is beyond the fog wherever it could be on screen: its distance times the cosine of the
// half-diagonal field of view, less its radius. It moves to FOG_CULL_LAYER, which the walking camera does not draw (other
// code owns `visible`; the photo booth's camera draws that layer too), and back once nearer.
// Always drawn: parts whose materials ignore fog or are transparent, skinned and instanced meshes (cabins and lifeboats
// swap their instances as the walker moves), parts that never frustum-cull, those riding the lifts (keepLive), and the
// merged deck bands (userData.fogBackdrop: on a desktop they view-cull in squares, but they are the backdrop).
// Nothing is left out while the atrium's long fog (beyond the far plane) is on. update() each frame right after the
// render, when every world matrix is current (for the next frame): it reclassifies every part after `step` metres of
// camera movement or a fog or view change, rechecks each left-out part that has moved, and every `every` ms adds new
// parts (classified at once) and drops removed ones. guard() just before the render puts everything back when the
// atrium's fog has come on or the camera jumped (a teleport) since the last classification, so no frame misses a part.
export const FOG_CULL_LAYER=31;
export function createFogCull(scene,camera,{every=10000,step=.5,margin=1,jump=5}={}){
 const stats={parts:0,culled:0,updates:0};const parts=new Map();let built=-Infinity,lastFar=NaN,lastCos=NaN;
 const eye=new T.Vector3(),last=new T.Vector3(NaN,NaN,NaN),centre=new T.Vector3(),hidden=1<<FOG_CULL_LAYER;
 const fogged=m=>m&&m.fog!==false&&!m.transparent;
 const live=o=>{for(let n=o;n;n=n.parent)if(n.userData?.keepLive)return true;return false;};
 const eligible=o=>o.isMesh&&!o.isInstancedMesh&&!o.isSkinnedMesh&&o.frustumCulled&&!o.userData.fogBackdrop&&[].concat(o.material).every(fogged)&&!live(o);
 const put=(p,out)=>{if(out!==p.out){p.out=out;p.o.layers.mask=out?hidden:p.mask;stats.culled+=out?1:-1;}};
 const restore=()=>{for(const p of parts.values())put(p,false);};
 const rebuild=()=>{
  const seen=new Set(),added=[];
  scene.traverse(o=>{if(parts.has(o)){seen.add(o);return;}if(o.layers.mask!==1||!eligible(o))return;
   if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();const p={o,mask:o.layers.mask,out:false,at:new T.Vector3()};parts.set(o,p);seen.add(o);added.push(p);});
  for(const [o,p] of parts)if(!seen.has(o)){put(p,false);parts.delete(o);}
  stats.parts=parts.size;return added;
 };
 const beyond=(p,cos,far)=>{const o=p.o,s=o.geometry.boundingSphere;centre.copy(s.center).applyMatrix4(o.matrixWorld);p.at.setFromMatrixPosition(o.matrixWorld);
  return eye.distanceTo(centre)*cos-s.radius*o.matrixWorld.getMaxScaleOnAxis()>far+margin;};
 return {stats,guard(){
  if(!stats.culled)return;const fog=scene.fog;camera.getWorldPosition(eye);
  if(!fog?.isFog||fog.far>=camera.far||fog.far!==lastFar||eye.distanceToSquared(last)>jump*jump){restore();lastFar=NaN;}
 },update(now){
  const fog=scene.fog;
  if(!fog?.isFog||fog.far>=camera.far){if(stats.culled)restore();lastFar=NaN;return;}
  camera.getWorldPosition(eye);
  const tanV=Math.tan(T.MathUtils.degToRad(camera.fov)/2),tanD=Math.hypot(tanV,tanV*camera.aspect),cos=1/Math.sqrt(1+tanD*tanD);
  if(now-built>=every){built=now;for(const p of rebuild())put(p,beyond(p,cos,fog.far));}
  if(eye.distanceToSquared(last)>=step*step||fog.far!==lastFar||cos!==lastCos){
   last.copy(eye);lastFar=fog.far;lastCos=cos;stats.updates++;for(const p of parts.values())put(p,beyond(p,cos,fog.far));return;}
  // A left-out part that has moved (a transporter, a ball) is checked again at once.
  for(const p of parts.values())if(p.out&&p.at.distanceToSquared(centre.setFromMatrixPosition(p.o.matrixWorld))>margin*margin)put(p,beyond(p,cos,fog.far));
 }};
}
