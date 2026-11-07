import * as T from 'three';
import layout from '../plan/selected-layout.js';
import {ATRIUM_PROTOTYPE} from '../plan/atrium-v2.js';
import {contains,distanceToSegment} from '../plan/geometry-v2.js';
import {createVisibilityQuery} from './visibility-query.js';
import {visibilityState} from './visibility-state.js';
import {opaqueBlocked} from './opaque-visibility.js';
import {createDetailViewGuard} from './detail-lod.js';
import {PVS_UNKNOWN,PVS_VISIBLE} from './atrium-pvs.js';

const EPS=1e-7;
// Rooms where every view was checked to see no atrium, which its rays can't prove: the arrival hall on Deck 2 and the
// farm above it, open to each other. Under them are three deck slabs of many small ceiling parts, so the rays always ran
// out, and the hall drew all 20 decks under atrium fog (1.5 fps on a Galaxy S9). Hiding every band from Deck 6 up
// changes no pixel there (output/phone-walk/hall-atrium.mjs). The eye counts within SEALED_REACH of a room, since the
// follow camera can stand behind the walker in the wall.
export const SEALED_ROOMS=['d02-arrival-1','d03-farm-1'];const SEALED_REACH=3;
const center=polygon=>polygon.reduce((p,v)=>p.add(v),new T.Vector3()).multiplyScalar(1/polygon.length);
// Clip a convex portal against a positive half-space. The small tolerance keeps
// edge-on openings conservative rather than dropping a visible sliver.
function clip(polygon,plane){
 const out=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],da=plane.distanceToPoint(a),db=plane.distanceToPoint(b);
  if(da>=-EPS)out.push(a);
  if((da>EPS&&db< -EPS)||(da< -EPS&&db>EPS))out.push(a.clone().lerp(b,da/(da-db)));
 }
 return out.length>=3?out:[];
}
function portal(points){const polygon=points.map(p=>p.isVector3?p.clone():new T.Vector3(...p));return{polygon,box:new T.Box3().setFromPoints(polygon)};}
export function hull(points){
 const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=points=>{const out=[];for(const p of points){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
 return half(sorted).slice(0,-1).concat(half(sorted.slice().reverse()).slice(0,-1));
}
let defaultGeometry;
function geometry(source=layout){
 if(defaultGeometry&&source===layout)return defaultGeometry;
 const decks=source.decks.filter(d=>d.number>=6&&d.atrium?.outline),low=decks[0].y-.3,high=ATRIUM_PROTOTYPE.skyY+.1;
 // The envelope contains every upper/lower outline. It is deliberately a
 // superset: a changing ring must never hide a glimpse into a different deck.
 const envelope=hull(decks.flatMap(d=>d.atrium.outline));
 const sides=ring=>ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return portal([[a[0],low,a[1]],[b[0],low,b[1]],[b[0],high,b[1]],[a[0],high,a[1]]]);});
 const outer=sides(envelope);
 outer.push(portal(envelope.map(([x,z])=>[x,low,z])),portal(envelope.map(([x,z])=>[x,high,z])));
 const doors=source.rooms.filter(r=>!r.aggregate).flatMap(r=>[r.door,r.fittingDoor,...(r.galleryDoors||[]),...(r.bayAccessDoors||[])].filter(d=>d?.center));
 const ownersByLevel=new Map();
 for(const room of[...(source.cabins||[]),...source.rooms.filter(r=>!r.aggregate),...(source.hullPrototypes?.prototypes||[]).map(p=>({...p,y:p.chart.origin[1],height:p.rect[3]}))]){
  if(!room.polygon?.length)continue;
  const y=room.y,height=room.height||3.4,box=new T.Box3().setFromPoints(room.polygon.flatMap(([x,z])=>[new T.Vector3(x,y,z),new T.Vector3(x,y+height,z)])),owner={room,box,portals:null};
  for(let level=Math.floor(y/4);level<=Math.floor((y+height)/4);level++){
   if(!ownersByLevel.has(level))ownersByLevel.set(level,[]);ownersByLevel.get(level).push(owner);
  }
 }
 const result={decks,low,high,envelope,outer,doors,ownersByLevel};
 if(source===layout)defaultGeometry=result;return result;
}
// The volume the rays bound the atrium by: the convex hull of every deck's outline (envelope) from low to high. An eye
// inside it sees the atrium unless a known room encloses it.
export function atriumEnvelope(source=layout){const {envelope,low,high}=geometry(source);return {envelope,low,high};}
function ownerPortals(owner){
 if(owner.portals)return owner.portals;
 const ring=owner.room.polygon,low=owner.box.min.y,high=owner.box.max.y;
 const walls=ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return portal([[a[0],low,a[1]],[b[0],low,b[1]],[b[0],high,b[1]],[a[0],high,a[1]]]);});
 for(const indices of T.ShapeUtils.triangulateShape(ring.map(([x,z])=>new T.Vector2(x,z)),[]))for(const y of[low,high])walls.push(portal(indices.map(i=>[ring[i][0],y,ring[i][1]])));
 return owner.portals=walls;
}

// Subtract the proven shadow of one opaque triangle. Three eye/edge planes
// bound the shadow cone; the triangle plane excludes everything in front of
// the occluder (including triangles crossing the target portal plane).
function shadowPlanes(eye,triangle){
 const planes=[];
 for(let i=0;i<3;i++){
  const plane=new T.Plane().setFromCoplanarPoints(eye,triangle[i],triangle[(i+1)%3]);
  if(plane.normal.lengthSq()<.99)return null;
  if(plane.distanceToPoint(triangle[(i+2)%3])<0)plane.negate();
  planes.push(plane);
 }
 const behind=new T.Plane().setFromCoplanarPoints(...triangle);
 if(behind.normal.lengthSq()<.99||Math.abs(behind.distanceToPoint(eye))<.05)return null;
 if(behind.distanceToPoint(eye)>0)behind.negate();
 planes.push(behind);
 return planes;
}
function subtract(polygon,planes){
 let inside=polygon;const outside=[];
 for(const plane of planes){
  const distances=inside.map(v=>plane.distanceToPoint(v));
  if(distances.every(d=>d>=-EPS))continue;
  if(distances.every(d=>d<=EPS)){outside.push(inside);return outside;}
  const piece=clip(inside,plane.clone().negate());if(piece.length)outside.push(piece);
  inside=clip(inside,plane);if(!inside.length)break;
 }
 return outside;
}

/** Optional fixture geometry: {portals: Vector3[][], doors, maxRays, maxFragments,
 * intervalMs, holdMs, layout, pvs}. Layout injection exercises the default envelope
 * and enclosure path in fixtures. Geometry is shared with lazy owner portals.
 * `pvs` returns the loaded atrium PVS (atrium-pvs.js) or null; its cells replace
 * the rays wherever they have data. Unresolved coverage returns visible, except in `sealed` rooms (ids; SEALED_ROOMS by
 * default), where only a clear ray is sight. */
export function createAtriumSight(colliders,options={}){
 const query=createVisibilityQuery(colliders),changed=visibilityState(),viewGuard=createDetailViewGuard(),custom=options.portals?.map(portal),g=custom?null:geometry(options.layout);
 const sealedIds=new Set(options.sealed??SEALED_ROOMS),sealedRooms=g?(options.layout??layout).rooms.filter(r=>sealedIds.has(r.id)&&r.polygon?.length).map(r=>({polygon:r.polygon,low:r.y-.5,high:r.y+(r.height||3.4)+.5})):[];
 const maxRays=options.maxRays??24,maxFragments=options.maxFragments??256,intervalMs=options.intervalMs??150,holdMs=options.holdMs??250;
 const stats={updates:0,rays:0,firstHits:0,windowFallbacks:0,coverageRays:0,budgetFallbacks:0,cacheHits:0,pvsHits:0,pvs:PVS_UNKNOWN,portals:0,owner:null,visible:false,lastMs:0,range:null};
 const scratch={box:new T.Box3(),point:new T.Vector3(),local:new T.Ray(),stats};
 const eye=new T.Vector3(),ray=new T.Ray(),local=new T.Ray(),point=new T.Vector3(),matrix=new T.Matrix4(),frustum=new T.Frustum();
 let last=-Infinity,lastSeen=-Infinity,result=false,remaining=0,fromPvs=false;
 function test(target){
  if(remaining<=0)return null;
  point.copy(target).sub(eye);const far=point.length();if(far<.06)return{clear:true};
  remaining--;ray.set(eye,point.divideScalar(far));
  if(!opaqueBlocked(query,ray,far+.01,scratch))return{clear:true};
  // Re-read the hit only for a coverage proof. Never infer whole-portal
  // occlusion from a finite set of blocked point samples.
  stats.coverageRays++;
  for(const[bvh,inverse,world]of query.near(scratch.box,ray)){
   local.copy(ray);if(inverse)local.applyMatrix4(inverse);
   let hit=bvh.raycastFirst(local,T.DoubleSide,.05,far+.01);
   if(hit&&bvh.leoWindowFlags?.[hit.faceIndex])hit=bvh.raycast(local,T.DoubleSide,.05,far+.01).find(h=>!bvh.leoWindowFlags?.[h.faceIndex]);
   const position=bvh.geometry?.attributes?.position,index=bvh.geometry?.index;
   if(!hit||!position||!Number.isInteger(hit.faceIndex))continue;
   const triangle=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(position,index?index.getX(hit.faceIndex*3+k):hit.faceIndex*3+k));
   if(world)triangle.forEach(v=>v.applyMatrix4(world));
   else if(inverse){const worldMatrix=inverse.clone().invert();triangle.forEach(v=>v.applyMatrix4(worldMatrix));}
   if(!triangle.every(v=>[v.x,v.y,v.z].every(Number.isFinite)))continue;
   const planes=shadowPlanes(eye,triangle);if(planes)return{planes};
  }
  return null;
 }
 function detect(camera){
  camera.getWorldPosition(eye);
  // In a room checked to be closed to the atrium (SEALED_ROOMS), only a clear ray counts as sight: running out of rays or
  // fragments answers hidden there. Elsewhere an unresolved query stays visible.
  const sealed=sealedRooms.some(r=>eye.y>=r.low&&eye.y<=r.high&&(contains(r.polygon,[eye.x,eye.z])||r.polygon.some((a,i)=>distanceToSegment([eye.x,eye.z],a,r.polygon[(i+1)%r.polygon.length])<=SEALED_REACH)));
  stats.portals=0;stats.owner=null;
  frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  let candidates=custom,preferred=[];
  if(g){
   const inside=eye.y>=g.low&&eye.y<=g.high&&contains(g.envelope,[eye.x,eye.z]);
   const owner=inside&&(g.ownersByLevel.get(Math.floor(eye.y/4))||[]).find(o=>o.box.containsPoint(eye)&&contains(o.room.polygon,[eye.x,eye.z]));
   // The far atrium boundary cannot prove absence when the eye is inside it.
   // A known enclosing room provides real exit portals instead. Closed walls
   // can cover these; door/window gaps or uncertain metadata stay visible.
   if(inside&&!owner)return true;
   if(owner){candidates=ownerPortals(owner);stats.owner=owner.room.id;}
   const nearest=g.decks.reduce((a,d)=>Math.abs(d.y-eye.y)<Math.abs(a.y-eye.y)?d:a),index=g.decks.indexOf(nearest);
   if(!owner)candidates=g.outer;
   // Actual nearby ring entrances prioritize clear rays. The envelope alone
   // carries the coverage proof, avoiding thousands of overlapping portal
   // fragments from the densely sampled architectural outlines.
   for(const d of owner?[]:g.decks.slice(Math.max(0,index-1),index+2)){
    const ring=d.atrium.outline;
    for(let i=0;i<ring.length;i++){
     const a=ring[i],b=ring[(i+1)%ring.length],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
     if(Math.hypot(x-eye.x,z-eye.z)>24)continue;
     const q=new T.Vector3(x,T.MathUtils.clamp(eye.y,g.low,g.high),z);
     if(frustum.containsPoint(q))preferred.push(q);
    }
   }
   preferred.sort((a,b)=>a.distanceToSquared(eye)-b.distanceToSquared(eye));
   const separated=[];for(const q of preferred){if(separated.every(p=>p.distanceToSquared(q)>=4))separated.push(q);if(separated.length===4)break;}preferred=separated;
  }
  const possible=candidates.filter(p=>frustum.intersectsBox(p.box)).sort((a,b)=>a.box.distanceToPoint(eye)-b.box.distanceToPoint(eye));
  let pieces=[];
  for(const candidate of possible){
   let polygon=candidate.polygon;for(const plane of frustum.planes){polygon=clip(polygon,plane);if(!polygon.length)break;}
   if(polygon.length)pieces.push(polygon);
   if(pieces.length>maxFragments){stats.budgetFallbacks++;return !sealed;}
  }
  stats.portals=pieces.length;if(!pieces.length)return false;
  const cover=planes=>{const next=[];for(const polygon of pieces){next.push(...subtract(polygon,planes));if(next.length>maxFragments){stats.budgetFallbacks++;return false;}}pieces=next;return true;};
  // Door targets are tested first, then extended to the nearest portal hit.
  // This catches slits between the fixed screen/proxy samples, without treating
  // a visible door to some unrelated room as an atrium sightline.
  const doors=(options.doors??g?.doors??[]).filter(d=>Math.abs(d.center[1]+1.5-eye.y)<5&&Math.hypot(d.center[0]-eye.x,d.center[2]-eye.z)<24).sort((a,b)=>Math.hypot(a.center[0]-eye.x,a.center[2]-eye.z)-Math.hypot(b.center[0]-eye.x,b.center[2]-eye.z)).slice(0,4);
  for(const door of doors)for(const fraction of[0,-.4,.4]){
   const normal=door.outward||[1,0],q=new T.Vector3(door.center[0]+normal[1]*fraction*(door.width||1),door.center[1]+1.5,door.center[2]-normal[0]*fraction*(door.width||1));
   if(!frustum.containsPoint(q))continue;
   ray.set(eye,q.sub(eye).normalize());let target=null,distance=Infinity;
   for(const polygon of pieces)for(let i=1;i<polygon.length-1;i++){
    const hit=ray.intersectTriangle(polygon[0],polygon[i],polygon[i+1],false,new T.Vector3());
    if(hit&&hit.distanceToSquared(eye)<distance){target=hit;distance=hit.distanceToSquared(eye);}
   }
   if(target){const hit=test(target);if(hit?.clear)return true;if(hit?.planes&&!cover(hit.planes))return !sealed;}
   if(!pieces.length)return false;
  }
  for(const target of preferred){
   const hit=test(target);if(hit?.clear)return true;
   if(hit?.planes&&!cover(hit.planes))return !sealed;
   if(!pieces.length)return false;
  }
  while(pieces.length&&remaining>0){
   const hit=test(center(pieces[0]));if(hit?.clear)return true;
   if(!hit?.planes)break;
   const previous=pieces[0];if(!cover(hit.planes))return !sealed;
   if(pieces.length>maxFragments||pieces[0]===previous)break;
  }
  if(pieces.length){stats.budgetFallbacks++;return !sealed;}
  return false;
 }
 const publish=now=>{if(result)lastSeen=now;return stats.visible=result||now-lastSeen<holdMs;};
 return{stats,update(camera,p,now){
  // A precomputed cell answers at once, every frame; only cells without data pay for rays. The bake counts lift landing
  // doors as shut, so where `unbaked` says the eye is by an open one, the rays answer.
  camera.getWorldPosition(eye);const cell=options.unbaked?.(eye)?PVS_UNKNOWN:options.pvs?.()?.at(eye)??PVS_UNKNOWN;stats.pvs=cell;
  // A visible cell's heights (null: the whole atrium) stand until another visible answer, through the hold.
  if(cell!==PVS_UNKNOWN){stats.pvsHits++;result=cell===PVS_VISIBLE;if(result)stats.range=options.pvs().range?.(eye)??null;last=-Infinity;fromPvs=true;return publish(now);}
  // Snapshot collider/mover state only at the query interval, not every frame.
  if(now-last<intervalMs&&!viewGuard.changed(camera)){stats.cacheHits++;return publish(now);}
  last=now;viewGuard.commit(camera);const started=performance.now();
  // Back at the very pose the rays last answered, `result` still holds the PVS cell's answer from in between.
  const moved=changed(camera,p,0,0,colliders),cached=!moved&&!fromPvs;fromPvs=false;
  if(cached){stats.cacheHits++;return publish(now);}
  remaining=maxRays;stats.updates++;result=detect(camera);if(result)stats.range=null;
  stats.lastMs=performance.now()-started;return publish(now);
 }};
}
