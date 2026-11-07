import * as T from 'three';

// Indoors the fog is solid at scene.fog.far (148 m): a part wholly beyond it draws as fog colour, the same as the fogged
// walls and floors behind it (the merged deck bands, which always draw), so it need not draw at all. Looking down the
// ship from a Deck 3 lobby drew about 1,700 parts out to the 450 m far plane. Three fogs by depth along the view, not by
// distance, so a part is left out only when it is beyond the fog wherever it could be on screen: its distance times the
// cosine of the half-diagonal field of view, less its radius. It moves to a layer the camera does not draw (other code
// owns `visible`), and back once nearer. Parts whose materials ignore fog, are transparent, skinned or never frustum-cull,
// and those riding the lifts (keepLive), always stay. With the atrium's long fog (beyond the far plane) nothing is left
// out. update() after the camera has moved; it rechecks after `step` metres, a fog or view change, or a rebuild of the
// part list (every `every` ms: later details join).
const HIDDEN_LAYER=31;
export function createFogCull(scene,camera,{every=3000,step=.5,margin=1}={}){
 const stats={parts:0,culled:0,updates:0};let parts=[],built=-Infinity,lastFar=NaN,lastCos=NaN;
 const eye=new T.Vector3(),last=new T.Vector3(NaN,NaN,NaN),centre=new T.Vector3(),hidden=1<<HIDDEN_LAYER;
 const fogged=m=>m&&m.fog!==false&&!m.transparent;
 const live=o=>{for(let n=o;n;n=n.parent)if(n.userData?.keepLive)return true;return false;};
 const restore=()=>{for(const p of parts)if(p.out){p.o.layers.mask=p.mask;p.out=false;}stats.culled=0;};
 const rebuild=()=>{
  restore();parts=[];
  scene.traverse(o=>{
   if(!(o.isMesh||o.isInstancedMesh)||o.isSkinnedMesh||!o.frustumCulled||o.layers.mask!==1)return;
   if(![].concat(o.material).every(fogged)||live(o))return;
   if(o.isInstancedMesh){if(!o.boundingSphere)o.computeBoundingSphere();}else if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
   parts.push({o,mask:o.layers.mask,out:false});
  });
  stats.parts=parts.length;
 };
 return {stats,update(now){
  const fog=scene.fog;
  if(!fog?.isFog||fog.far>=camera.far){if(stats.culled)restore();lastFar=NaN;return;}
  let force=false;if(now-built>=every){rebuild();built=now;force=true;}
  camera.getWorldPosition(eye);
  const tanV=Math.tan(T.MathUtils.degToRad(camera.fov)/2),tanD=Math.hypot(tanV,tanV*camera.aspect),cos=1/Math.sqrt(1+tanD*tanD);
  if(!force&&eye.distanceToSquared(last)<step*step&&fog.far===lastFar&&cos===lastCos)return;
  last.copy(eye);lastFar=fog.far;lastCos=cos;stats.updates++;let culled=0;
  for(const p of parts){
   const o=p.o,sphere=o.isInstancedMesh?o.boundingSphere:o.geometry.boundingSphere;
   centre.copy(sphere.center).applyMatrix4(o.matrixWorld);const r=sphere.radius*o.matrixWorld.getMaxScaleOnAxis();
   const beyond=eye.distanceTo(centre)*cos-r>fog.far+margin;
   if(beyond!==p.out){p.out=beyond;o.layers.mask=beyond?hidden:p.mask;}
   if(beyond)culled++;
  }
  stats.culled=culled;
 }};
}
