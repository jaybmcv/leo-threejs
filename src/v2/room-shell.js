import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {removeBuriedSlabSides} from './atrium-floor-finish.js';
import {wallJoints,mitreWallGeometry} from './wall-joints.js';
import {roomWallBoundary,setRoomCornerObstacles} from './rounded-room-walls.js';
import {moveRoomFitoutMeshes} from './room-fitout-overrides.js';
import layout from '../plan/selected-layout.js';
import {roomObject} from '../plan/rooms.js';
import {forumTerraces,forumUpperPlan} from './launch-e-fitout.js';
import {forumTerraceGeometry} from './forum-terrace-geometry.js';
import {ownerFootprint} from '../plan/envelope-ownership-v2.js';
import {LOUNGE_MURAL_X} from '../plan/lounge-layout-v2.js';
import {worldPoint} from '../plan/hull-skin-v2.js';
import {buildGardenGuards,galleryHoles} from './garden-guards.js';
import {entrySegments,entryHeader} from './room-entries.js';
import {buildLoungeWalkwayWall} from './lounge-walkway-wall.js';
import {polygonGeometry,mesh,box,wall,mergeBoxes,removePanelEndCaps,removeGeometryCaps,glass,lining,floor} from './geometry.js';

export function buildRoomShell(ship,r,structure){
  const source=roomObject(ship,r.id);
  if(source){moveRoomFitoutMeshes(source,r.id);retireV2RoomShell(source,ship.cutaway);if(r.id==='d16-voyage-forum-bow')source.clear();if(r.id==='observation-lounge'){const keep=[];source.traverse(o=>{if(/Shared_telescope_base|Viewing_scope|Scope_column|Scope_optical_head/.test(o.name))keep.push(o);});for(const o of keep)source.attach(o);for(const o of [...source.children])if(!keep.includes(o))source.remove(o);}}
  if(source&&r.deck===2){
   setRoomCornerObstacles(r,[]);const corners=roomWallBoundary(r,r.polygon).corners,boxes=[],v=new T.Vector3();source.updateWorldMatrix(true,true);
   source.traverse(o=>{if(!o.isMesh||/floor|ceiling|shell|wall/i.test(o.name))return;for(let p=o;p;p=p.parent)if(!p.visible)return;const g=o.geometry,p=g.attributes.position,ix=g.index;if(!p)return;
    const bounds=new T.Box3().setFromObject(o);if(!corners.some(c=>c.at[0]>=bounds.min.x-.3&&c.at[0]<=bounds.max.x+.3&&c.at[1]>=bounds.min.z-.3&&c.at[1]<=bounds.max.z+.3))return;
    for(let i=0;i<(ix?.count??p.count);i+=3){const box=new T.Box3();for(let k=0;k<3;k++)box.expandByPoint(v.fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld));if(box.max.y>=r.y&&box.min.y<=r.y+r.height)boxes.push(box);}
   });setRoomCornerObstacles(r,boxes);
  }
  const g=new T.Group();g.name='V2_shell_'+r.id;g.userData.room=r.id;structure.add(g);if(r.launchE?.kind==='oval-forum'){const [x,z,w,d]=r.launchE.seating,oval=Array.from({length:96},(_,i)=>[x+w/2*Math.cos(i*Math.PI/48),z+d/2*Math.sin(i*Math.PI/48)]),inlay=mesh(g,'Forum_oval_inlay',polygonGeometry(oval,[],r.y+.014,.002),new T.MeshStandardMaterial({name:'Forum_oval_textile',color:0x35545a,roughness:.95}));inlay.userData.noCollide=true;}if(r.launchE?.kind==='oval-forum')for(const t of forumTerraces())mesh(g,'Forum_terrace_floor',forumTerraceGeometry(t,r.y),floor);
  if(r.ceilingExtension){const e=r.ceilingExtension,upper=forumUpperPlan(layout,r);g.userData.forumUpper=upper;mesh(g,'V2_room_ceiling',polygonGeometry(e.polygon,upper.ceilingHoles,e.y+e.height,.10),lining);for(let i=0;i<e.polygon.length;i++){let segments=[[e.polygon[i],e.polygon[(i+1)%e.polygon.length]]];for(const d of upper.portals)segments=segments.flatMap(([a,b])=>entrySegments(a,b,d.center,d.width));for(const[a,b]of segments)removePanelEndCaps(wall(g,a,b,e.y,e.height,lining,'V2_forum_upper_wall'));}}
  const replacements=layout.hullPrototypes?.rollout?layout.hullPrototypes.prototypes.filter(p=>p.kind!=='cabin'&&(p.ownerId===r.id||p.parentRoomId===r.id)):[];
  const holes=r.assembly==='arrival-garden'&&r.deck===3?layout.decks[2].slab.holes.filter(h=>h.assembly==='arrival-garden').map(h=>h.polygon):[];
  if(!(r.kind==='garden'&&r.hullPrototype)){mesh(g,'V2_room_floor',polygonGeometry(r.polygon,[...holes,...replacements.map(p=>p.polygon)],r.y+.006,.12),floor);
  const top=r.envelope?.at(-1)?.polygon??r.polygon;if(!r.openPlan)mesh(g,'V2_room_ceiling',polygonGeometry(top,[...(r.ceilingExtension?[r.ceilingExtension.polygon]:[]),...(r.id==='d02-arrival-1'?layout.decks[2].slab.holes.filter(h=>h.id==='arrival-garden-opening').map(h=>h.polygon):[]),...replacements.map(p=>ownerFootprint(p,p.rect[3]).map(q=>{const w=worldPoint(p.chart,q);return [w[0],w[2]];}))],r.y+r.height,.10),lining);
  // Sectioned facade steps follow the supplied full-height envelope without scaling the fitted room.
  const sections=r.openPlan?[]:r.envelope||[{rise:0,height:r.height,polygon:r.polygon}];
  // Curved panes and their tangent walls keep triangle collision instead of box bounds.
  for(const s of sections){const boundary=roomWallBoundary(r,s.polygon),poly=boundary.polygon,rounded=boundary.corners.flatMap(c=>c.points);for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],doors=[r.door,r.fittingDoor,...(r.galleryDoors||[]),...(r.bayAccessDoors||[])].filter(Boolean).filter(d=>d.center[1]<r.y+s.rise+s.height&&d.center[1]+2.5>r.y+s.rise);
   let segments=[[a,b]];for(const d of doors)segments=segments.flatMap(([a,b])=>entrySegments(a,b,d.center,d.width));
   for(const [aa,bb] of segments){const o=wall(g,aa,bb,r.y+s.rise,s.height,r.outer||r.publicFront&&Math.abs((aa[0]-r.door.center[0])*r.door.outward[0]+(aa[1]-r.door.center[2])*r.door.outward[1])<.02&&Math.abs((bb[0]-r.door.center[0])*r.door.outward[0]+(bb[1]-r.door.center[2])*r.door.outward[1])<.02||r.kind==='garden'||r.id==='d05-aquarium-gallery'&&(Math.abs(aa[0]-98)<.01&&Math.abs(bb[0]-98)<.01||Math.abs(aa[1]+34)<.01&&Math.abs(bb[1]+34)<.01)?glass:lining);removePanelEndCaps(o);if(o&&(r.deck===1||r.deck===2))mitreWallGeometry(o.geometry,wallJoints(poly,i,aa,bb));if(o&&rounded.some(p=>Math.hypot(p[0]-aa[0],p[1]-aa[1])<1e-6||Math.hypot(p[0]-bb[0],p[1]-bb[1])<1e-6)){const old=o.geometry;o.geometry=new T.BufferGeometry().copy(old);old.dispose();}}
   for(const d of doors){const header=entryHeader(a,b,d.center,d.width);if(header&&d.center[1]+2.5<r.y+s.rise+s.height){const upper=Math.max(r.y+s.rise,d.center[1]+2.5),o=wall(g,header[0],header[1],upper,r.y+s.rise+s.height-upper,glass);removeGeometryCaps(o.geometry,0);if(o&&(r.deck===1||r.deck===2))mitreWallGeometry(o.geometry,wallJoints(poly,i,header[0],header[1]));}}
  }}
  }
  if(r.components){const platforms=[...(r.components.galleries||[]),...(r.components.links||[]),...(r.components.landings||[])],landingFloors=[],muralFloors=[];for(const [i,o] of platforms.entries()){const holes=galleryHoles(r,o);
   // Joined lounge routes share one floor surface instead of coplanar plates.
   if(r.id==='commons-1')holes.push(...platforms.slice(0,i).filter(p=>Math.abs(p.center[1]-o.center[1])<.01).map(p=>p.polygon));
   const slab=polygonGeometry(o.polygon,holes,o.center[1],o.size[1]);
   if(r.id==='commons-1'&&['commons-1-rear-4','commons-1-gallery-link-4','commons-1-stair-turn'].includes(o.id))landingFloors.push(slab);
   else if(['commons-1-rear-8','commons-1-end-8'].includes(o.id))muralFloors.push(slab);else mesh(g,'V2_garden_gallery',slab,floor);
   if(o.id==='commons-1-end-8'){
    const zs=o.polygon.filter(p=>p[0]===LOUNGE_MURAL_X).map(p=>p[1]);
    if(zs.length===2){
     // Stop the walker at the wallpaper plane so the first-person eye stays in the room.
     const y=o.center[1],height=r.y+r.height-y,wall=box(g,'V2_lounge_wall_collision',[.02,height,Math.abs(zs[1]-zs[0])],[LOUNGE_MURAL_X-.01,y+height/2,(zs[0]+zs[1])/2]);
     wall.visible=false;Object.assign(wall.userData,{collisionOnly:true,baked:true});
    }
   }}
   // Keep each joined top and underside continuous in the walk bake.
   for(const [slabs,y]of [[landingFloors,r.y+4],[muralFloors,r.y+8]])if(slabs.length){const merged=mergeGeometries(slabs),joined=removeBuriedSlabSides(merged,y).geometry;mesh(g,'V2_garden_gallery',joined,floor);if(joined!==merged)merged.dispose();slabs.forEach(g=>g.dispose());}
   // Report #427: the black wall under the walkway's open-floor edge, stopping at the waterfall pond (lounge-walkway-wall.js).
   if(r.id==='commons-1')buildLoungeWalkwayWall(g,r);
   // The plan's stair center.y is its finished tread elevation.
   const stairs=r.components.stairs||[],lights=[];for(const o of stairs){const tread=box(g,'Gallery_stair',o.size,[o.center[0],o.center[1]-o.size[1]/2,o.center[2]],lining);if(r.id!=='commons-1')continue;
    const flight=stairs.filter(t=>t.id.replace(/-\d+$/,'')===o.id.replace(/-\d+$/,'')).sort((a,b)=>a.center[1]-b.center[1]),dir=Math.sign(flight.at(-1).center[2]-flight[0].center[2]),rise=flight[1].center[1]-flight[0].center[1],geo=tread.geometry.clone(),p=geo.attributes.position,h=o.size[1];
    for(let i=0;i<p.count;i++)if(p.getY(i)<0)p.setY(i,Math.max(-h/2,h/2-.34+(Math.sign(p.getZ(i))===-dir?0:rise)));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
    const visible=mesh(g,'Lounge_slim_stair',geo,lining);visible.position.copy(tread.position);visible.userData.noCollide=true;tread.visible=false;tread.userData.baked=true;
    lights.push([[o.size[0]-.3,.04,.012],[o.center[0],o.center[1]-.06,o.center[2]-dir*(o.size[2]/2+.006)]]);
   }const stepGlow=mergeBoxes(g,'Lounge_step_glow',lights,new T.MeshBasicMaterial({name:'Lounge_step_glow',color:0x9b4dff,toneMapped:false}));if(stepGlow)stepGlow.userData.noCollide=true;buildGardenGuards(g,r,layout);
  }
}

function isChild(o,root){for(let p=o.parent;p;p=p.parent)if(p===root)return true;return false;}

export function retireV2RoomShell(source,cutaway){
   // Wall-mounted art, projections, signs and lighting are fittings too. Keep them
   // under the moving room when the accepted shell gives way to its v2 envelope.
   const hung=[];source.traverse(o=>{if(o.isMesh&&/(art|mural|print|poster|painting|sconce|light|sign|display|projection|hanger|shade)/i.test(o.name)){for(let p=o.parent;p&&p!==source;p=p.parent)if(cutaway.has(p)){hung.push(o);break;}}});for(const o of hung)source.attach(o);
   const retired=[];source.traverse(o=>{if(/^(Walls_and_ceiling|Garden_walls_and_ceiling|Observation_walls_and_ceiling|.*_shell)$/.test(o.name)){cutaway.delete(o);o.visible=false;o.userData.v2RemovedShell=true;}if(o.isMesh&&/^(Commons_column|Bridge_window_mullion|Viewport_structural_mullion|Continuous_window_ledge|Panoramic_viewing_rail|Viewing_rail_post|Finished_floor|Commons_floor|Commons_ceiling|Commons_rear_wall|Commons_end_wall|Rear_gallery|End_gallery|Front_gallery|Gallery_stair|Upper_stair_landing|Upper_gallery_connection|Stair_handrail|Gallery_door|Handrail|Baluster|Handrail_bend|Handrail_post|Lounge_rail_glass|Lounge_rail_glow|Lounge_step_glow|Curved_lounge_floor|Lounge_access_ramp|Ramp_floor_edge|Promenade_level_floor|Commons_to_promenade|Ramp_handrail|Ramp_rail_post)$/.test(o.name)){o.visible=false;if(o.name!=='Finished_floor')retired.push(o);}});for(const o of retired)o.removeFromParent();
   // Every declared shell root is detached, so the v1 cutaway toggles cannot bring it back.
   for(const o of [...cutaway])if(o===source||isChild(o,source)){o.removeFromParent();cutaway.delete(o);}

}
