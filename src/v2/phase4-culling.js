import {detailBounds,detailVisible,detailInFrustum,createDetailViewGuard} from './detail-lod.js';
import {ATRIUM_VIEW,isAtriumPublicOwner} from './atrium-render-policy.js';
import {visibilityState} from './visibility-state.js';
import {setAtriumView,atriumViewSpan,onePassAtriumGlass} from './atrium-visibility.js';
import {phase6Owners} from '../plan/atrium-v2.js';
import {createVisibilityQuery} from './visibility-query.js';
import {opaqueRayHit} from './opaque-ray.js';
import*as T from'three';import layout from'../plan/selected-layout.js';import{contains}from'../plan/geometry-v2.js';

// Exact boolean sight query: ignore glass and stop at the first opaque triangle.
export function opaqueBlocked(query,ray,far,scratch){
 const {box,point,local,stats}=scratch;
 stats.rays++;box.setFromPoints([ray.origin,ray.at(far,point)]).expandByScalar(.01);
 for(const[bvh,inverse]of query.near(box,ray)){
  local.copy(ray);if(inverse)local.applyMatrix4(inverse);
  if(opaqueRayHit(bvh,local,.05,far,scratch.hit??=new T.Vector3())){stats.firstHits++;return true;}
 }
 return false;
}

// Only rendering is compacted. Prepared collisions, owner runs and stable seat IDs remain complete.
export function phase4Culling(root,col){const constrained=typeof navigator!=='undefined'&&((navigator.deviceMemory||8)<=4||(navigator.hardwareConcurrency||8)<=4),intervalMs=constrained?600:220;const query=createVisibilityQuery(col),changed=visibilityState(),viewGuard=createDetailViewGuard(),batches=[],owners=new Map(),ray=new T.Ray(),point=new T.Vector3();let last=-Infinity,lastOpenAtrium=null,lastPixelHeight=null,menus=null,materialsReady=false;const stats={intervalMs,updates:0,rays:0,probed:0,deferred:0,firstHits:0,windowFallbacks:0,compactions:0,detailCulled:0,offscreenCulled:0,visibleInstances:0,samples:[]},queryBox=new T.Box3(),localRay=new T.Ray();
const scratch={box:queryBox,point:new T.Vector3(),local:localRay,stats};
function blocked(distance){return opaqueBlocked(query,ray,distance,scratch);}
// Whether any of an owner's probes is in sight depends only on the eye and the colliders, not on where the camera looks.
// Owners hidden behind walls must fail every probe, ~4,500 rays an update walking through the arrival hall (60-100 ms),
// so an update probes for at most PROBE_BUDGET_MS: owners new to the view first, then those whose verdict is oldest,
// nearest first (a room just through a door is the likeliest to change).
// The rest keep their last verdict (one new to the view counts as seen, so nothing is hidden on a guess) and the frames
// until the next update go on with them, redoing the pass only when an answer changes. Standing still, the verdicts all come from the one eye within a few frames, as one update gave them.
const PROBE_BUDGET_MS=3,sightEye=new T.Vector3(NaN,NaN,NaN),moverState=[];let eyeStamp=0,pass=0;const queue=[];
// Colliders replaced or added after startup (a band's BVH, an instance group) count as moved too, as visibility-state.js has them.
function moversMoved(){let i=0,moved=false;const note=v=>{if(moverState[i]!==v){moverState[i]=v;moved=true;}i++;};for(const[b,r]of col.bands){note(b);note(r.bvh);}for(const g of col.groups){note(g);note(g.bvh);note(g.items);note(g.items.length);}for(const m of col.movers){note(m.enabled);for(const e of m.matrix.elements)note(e);}if(moverState.length!==i){moverState.length=i;moved=true;}return moved;}
// The probe that last saw an owner is tried first; any one that sees it gives the same answer.
function inSight(a,eye){const n=a.probes.length,first=a.seenBy||0;for(let j=0;j<n;j++){const k=(first+j)%n;point.copy(a.probes[k]).sub(eye);const distance=point.length();if(distance<.6){a.seenBy=k;return true;}ray.set(eye,point.divideScalar(distance));if(!blocked(Math.max(.01,distance-.12))){a.seenBy=k;return true;}}return false;}
for(const base of [...layout.rooms.filter(r=>!r.aggregate),...phase6Owners(layout)]){const polygons=[...(base.visibilityPolygons||[base.polygon]),...(layout.hullPrototypes?.prototypes||[]).filter(p=>p.ownerId===base.id||p.id===base.id).map(p=>p.polygon)],r={...base,visibilityPolygons:polygons};const xs=polygons.flat().map(p=>p[0]),zs=polygons.flat().map(p=>p[1]);owners.set(r.id,{r,box:new T.Box3(new T.Vector3(Math.min(...xs),r.visibilityYMin??r.y,Math.min(...zs)),new T.Vector3(Math.max(...xs),r.y+r.height,Math.max(...zs))),probes:[]});}for(const s of layout.shuttles){const xs=s.polygon.map(p=>p[0]),zs=s.polygon.map(p=>p[1]);owners.set(s.id,{r:s,box:new T.Box3(new T.Vector3(Math.min(...xs),s.y,Math.min(...zs)),new T.Vector3(Math.max(...xs),s.y+3.2,Math.max(...zs))),probes:[]});}root.traverse(o=>{if(!o.isInstancedMesh||!o.userData.phase4||o.userData.phase6ArchitectureSource)return;const all=o.instanceMatrix.array.slice();batches.push({o,all,runs:o.userData.ownerRuns,bounds:detailBounds(o,all),lodVisible:new Uint8Array(all.length/16)});for(const run of o.userData.ownerRuns){if(!owners.has(run.component)){o.computeBoundingBox();owners.set(run.component,{box:o.boundingBox.clone().applyMatrix4(o.matrixWorld),probes:[]});}}});const used=new Set(batches.flatMap(b=>b.runs.map(r=>r.component)));for(const[id,owner]of owners){if(!used.has(id)){owners.delete(id);continue;}owner.id=id;owner.stamp=-1;owner.inView=-1;const{r,box}=owner,c=box.getCenter(new T.Vector3());owner.probes.push(c.clone().setY(box.min.y+1.6));if(r?.door?.center)for(const f of[-.35,0,.35])owner.probes.push(new T.Vector3(r.door.center[0]+(r.door.outward?.[1]||0)*f*(r.door.width||1),r.door.center[1]+1.5,r.door.center[2]-(r.door.outward?.[0]||0)*f*(r.door.width||1)));for(const y of[box.min.y+1.1,Math.min(box.max.y-.25,box.min.y+2.8)])for(const f of[0,.25,.5,.75,1]){owner.probes.push(new T.Vector3(box.min.x+(box.max.x-box.min.x)*f,y,box.min.z+.12),new T.Vector3(box.min.x+(box.max.x-box.min.x)*f,y,box.max.z-.12),new T.Vector3(box.min.x+.12,y,box.min.z+(box.max.z-box.min.z)*f),new T.Vector3(box.max.x-.12,y,box.min.z+(box.max.z-box.min.z)*f));}}
return{update(camera,p,low,high,now,pixelHeight=720){setAtriumView(p);if(!materialsReady){let scene=batches[0]?.o||root;while(scene.parent)scene=scene.parent;onePassAtriumGlass(scene);materialsReady=true;}if(!menus){let top=batches[0]?.o||root;while(top.parent)top=top.parent;menus=[];top.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.geometry.attributes.position&&o.material?.name?.startsWith('P4_menu_deck_')&&o.geometry.userData.preparedRanges)menus.push({o,owners:[...new Set(o.geometry.userData.preparedRanges.map(r=>r.userData?.room).filter(Boolean))]});});}const openAtrium=!!atriumViewSpan(),atriumChanged=openAtrium!==lastOpenAtrium,pixelsChanged=pixelHeight!==lastPixelHeight,viewChanged=viewGuard.changed(camera);let resume=false;if(!atriumChanged&&!pixelsChanged&&!viewChanged&&now-last<intervalMs){
 // Between updates: carry on with the last one's probes, from where the eye is now, and redo the pass only if one changed its answer.
 if(!queue.length)return;const t=performance.now(),from=camera.getWorldPosition(scratch.eye??=new T.Vector3());let flipped=false;
 while(queue.length&&performance.now()-t<PROBE_BUDGET_MS){const a=queue.pop();if(a.stamp===eyeStamp)continue;const was=a.seen;a.seen=inSight(a,from);a.stamp=eyeStamp;stats.probed++;if(a.seen!==was)flipped=true;}
 if(!flipped)return;resume=true;}
if(!resume){last=now;viewGuard.commit(camera);lastOpenAtrium=openAtrium;lastPixelHeight=pixelHeight;if(!changed(camera,p,low,high,col)&&!atriumChanged&&!pixelsChanged)return;}const started=performance.now();stats.updates++;const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)),eye=camera.getWorldPosition(new T.Vector3()),visible=new Set();if(!resume&&(moversMoved()||!eye.equals(sightEye))){eyeStamp++;sightEye.copy(eye);}pass++;const probing=[];for(const[id,a]of owners){const box=a.box,r=a.r,publicAtrium=openAtrium&&isAtriumPublicOwner(id,r);if(r?.launchD&&Math.abs(p.y-r.y)>2.0&&!publicAtrium)continue;if((!r?.phase6Atrium&&(box.min.y>=high||box.max.y<=low))||!frustum.intersectsBox(box))continue;if(publicAtrium||r?.showFromBelow){visible.add(id);continue;}if(openAtrium&&r&&!publicAtrium&&box.distanceToPoint(eye)>ATRIUM_VIEW.roomReach)continue;if(r&&p.y>=box.min.y-.5&&p.y<box.max.y&&(r.visibilityPolygons||[r.polygon]).some(poly=>contains(poly,[p.x,p.z]))){visible.add(id);continue;}probing.push(a);}const fresh=a=>a.inView===pass-1?0:1;for(const a of probing)a.range=a.box.distanceToPoint(eye);probing.sort((x,y)=>fresh(y)-fresh(x)||x.stamp-y.stamp||x.range-y.range);queue.length=0;let probed=0;
for(const a of probing){if(a.stamp!==eyeStamp){if(!probed||performance.now()-started<PROBE_BUDGET_MS){a.seen=inSight(a,eye);a.stamp=eyeStamp;probed++;}else{queue.push(a);stats.deferred++;if(fresh(a))a.seen=true;}}a.inView=pass;if(a.seen)visible.add(a.id);}queue.reverse();stats.probed+=probed;
for(const menu of menus)menu.o.visible=menu.owners.some(id=>visible.has(id));const pixelScale=pixelHeight*.5*Math.abs(camera.projectionMatrix.elements[5]);stats.detailCulled=0;stats.offscreenCulled=0;stats.visibleInstances=0;
for(const b of batches){
 const selected=[];
 for(const run of b.runs){if(!visible.has(run.component))continue;
  for(let i=run.start;i<run.start+run.count;i++){
   if(!detailInFrustum(b.bounds,i,frustum,eye)){stats.offscreenCulled++;continue;}
   const keep=detailVisible(b.bounds,i,camera,pixelScale,b.lodVisible[i]);b.lodVisible[i]=keep?1:0;
   if(keep)selected.push(i);else stats.detailCulled++;
  }
 }
 stats.visibleInstances+=selected.length;
 if(b.selected&&selected.length===b.selected.length&&selected.every((v,i)=>v===b.selected[i]))continue;
 b.selected=selected;stats.compactions++;
 selected.forEach((i,n)=>b.o.instanceMatrix.array.set(b.all.subarray(i*16,i*16+16),n*16));
 b.o.count=selected.length;b.o.instanceMatrix.needsUpdate=true;b.o.visible=selected.length>0;
}stats.samples.push(performance.now()-started);if(stats.samples.length>600)stats.samples.shift();},stats,batches:batches.length,owners:owners.size};}
