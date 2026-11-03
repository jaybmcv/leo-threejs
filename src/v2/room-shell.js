import * as T from 'three';
import layout from '../plan/selected-layout.js';
import {roomObject} from '../plan/rooms.js';
import {forumTerraces,forumUpperPlan} from './launch-e-fitout.js';
import {forumTerraceGeometry} from './forum-terrace-geometry.js';
import {ownerFootprint} from '../plan/envelope-ownership-v2.js';
import {worldPoint} from '../plan/hull-skin-v2.js';
import {buildGardenGuards,galleryHoles} from './garden-guards.js';
import {entrySegments,entryHeader} from './room-entries.js';
import {polygonGeometry,mesh,box,wall,removePanelEndCaps,removeGeometryCaps,glass,lining,floor} from './geometry.js';

export function buildRoomShell(ship,r,structure){
  const source=roomObject(ship,r.id);
  if(source){retireV2RoomShell(source,ship.cutaway);if(r.id==='d16-voyage-forum-bow')source.clear();if(r.id==='observation-lounge'){const keep=[];source.traverse(o=>{if(/Shared_telescope_base|Viewing_scope|Scope_column|Scope_optical_head/.test(o.name))keep.push(o);});for(const o of keep)source.attach(o);for(const o of [...source.children])if(!keep.includes(o))source.remove(o);}}
  const g=new T.Group();g.name='V2_shell_'+r.id;g.userData.room=r.id;structure.add(g);if(r.launchE?.kind==='oval-forum'){const [x,z,w,d]=r.launchE.seating,oval=Array.from({length:96},(_,i)=>[x+w/2*Math.cos(i*Math.PI/48),z+d/2*Math.sin(i*Math.PI/48)]),inlay=mesh(g,'Forum_oval_inlay',polygonGeometry(oval,[],r.y+.014,.002),new T.MeshStandardMaterial({name:'Forum_oval_textile',color:0x35545a,roughness:.95}));inlay.userData.noCollide=true;}if(r.launchE?.kind==='oval-forum')for(const t of forumTerraces())mesh(g,'Forum_terrace_floor',forumTerraceGeometry(t,r.y),floor);
  if(r.ceilingExtension){const e=r.ceilingExtension,upper=forumUpperPlan(layout,r);g.userData.forumUpper=upper;mesh(g,'V2_room_ceiling',polygonGeometry(e.polygon,upper.ceilingHoles,e.y+e.height,.10),lining);for(let i=0;i<e.polygon.length;i++){let segments=[[e.polygon[i],e.polygon[(i+1)%e.polygon.length]]];for(const d of upper.portals)segments=segments.flatMap(([a,b])=>entrySegments(a,b,d.center,d.width));for(const[a,b]of segments)removePanelEndCaps(wall(g,a,b,e.y,e.height,lining,'V2_forum_upper_wall'));}}
  const replacements=layout.hullPrototypes?.rollout?layout.hullPrototypes.prototypes.filter(p=>p.kind!=='cabin'&&(p.ownerId===r.id||p.parentRoomId===r.id)):[];
  const holes=r.assembly==='arrival-garden'&&r.deck===3?layout.decks[2].slab.holes.filter(h=>h.assembly==='arrival-garden').map(h=>h.polygon):[];
  if(!(r.kind==='garden'&&r.hullPrototype)){mesh(g,'V2_room_floor',polygonGeometry(r.polygon,[...holes,...replacements.map(p=>p.polygon)],r.y+.006,.12),floor);
  const top=r.envelope?.at(-1)?.polygon??r.polygon;if(!r.openPlan)mesh(g,'V2_room_ceiling',polygonGeometry(top,[...(r.ceilingExtension?[r.ceilingExtension.polygon]:[]),...(r.id==='d02-arrival-1'?layout.decks[2].slab.holes.filter(h=>h.id==='arrival-garden-opening').map(h=>h.polygon):[]),...replacements.map(p=>ownerFootprint(p,p.rect[3]).map(q=>{const w=worldPoint(p.chart,q);return [w[0],w[2]];}))],r.y+r.height,.10),lining);
  // Sectioned facade steps follow the supplied full-height envelope without scaling the fitted room.
  const sections=r.openPlan?[]:r.envelope||[{rise:0,height:r.height,polygon:r.polygon}];
  for(const s of sections)for(let i=0;i<s.polygon.length;i++){const a=s.polygon[i],b=s.polygon[(i+1)%s.polygon.length],doors=[r.door,r.fittingDoor,...(r.galleryDoors||[]),...(r.bayAccessDoors||[])].filter(Boolean).filter(d=>d.center[1]<r.y+s.rise+s.height&&d.center[1]+2.5>r.y+s.rise);
   let segments=[[a,b]];for(const d of doors)segments=segments.flatMap(([a,b])=>entrySegments(a,b,d.center,d.width));
   for(const [aa,bb] of segments){const o=wall(g,aa,bb,r.y+s.rise,s.height,r.outer||r.publicFront&&Math.abs((aa[0]-r.door.center[0])*r.door.outward[0]+(aa[1]-r.door.center[2])*r.door.outward[1])<.02&&Math.abs((bb[0]-r.door.center[0])*r.door.outward[0]+(bb[1]-r.door.center[2])*r.door.outward[1])<.02||r.kind==='garden'||r.id==='d05-aquarium-gallery'&&(Math.abs(aa[0]-98)<.01&&Math.abs(bb[0]-98)<.01||Math.abs(aa[1]+34)<.01&&Math.abs(bb[1]+34)<.01)?glass:lining);removePanelEndCaps(o);}
   for(const d of doors){const header=entryHeader(a,b,d.center,d.width);if(header&&d.center[1]+2.5<r.y+s.rise+s.height){const upper=Math.max(r.y+s.rise,d.center[1]+2.5),o=wall(g,header[0],header[1],upper,r.y+s.rise+s.height-upper,glass);removeGeometryCaps(o.geometry,0);}}
  }
  }
  if(r.components){for(const o of [...(r.components.galleries||[]),...(r.components.links||[]),...(r.components.landings||[])]){const holes=galleryHoles(r,o);mesh(g,'V2_garden_gallery',polygonGeometry(o.polygon,holes,o.center[1],o.size[1]),floor);}
   // The plan's stair center.y is its finished tread elevation.
   for(const o of r.components.stairs||[])box(g,'Gallery_stair',o.size,[o.center[0],o.center[1]-o.size[1]/2,o.center[2]],lining);buildGardenGuards(g,r,layout);
  }
}

function isChild(o,root){for(let p=o.parent;p;p=p.parent)if(p===root)return true;return false;}

export function retireV2RoomShell(source,cutaway){
   // Wall-mounted art, projections, signs and lighting are fittings too. Keep them
   // under the moving room when the accepted shell gives way to its v2 envelope.
   const hung=[];source.traverse(o=>{if(o.isMesh&&/(art|mural|print|poster|painting|sconce|light|sign|display|projection|hanger|shade)/i.test(o.name)){for(let p=o.parent;p&&p!==source;p=p.parent)if(cutaway.has(p)){hung.push(o);break;}}});for(const o of hung)source.attach(o);
   const retired=[];source.traverse(o=>{if(/^(Walls_and_ceiling|Garden_walls_and_ceiling|Observation_walls_and_ceiling|.*_shell)$/.test(o.name)){cutaway.delete(o);o.visible=false;o.userData.v2RemovedShell=true;}if(o.isMesh&&/^(Commons_column|Bridge_window_mullion|Viewport_structural_mullion|Continuous_window_ledge|Panoramic_viewing_rail|Viewing_rail_post|Finished_floor|Commons_floor|Commons_ceiling|Commons_rear_wall|Commons_end_wall|Rear_gallery|End_gallery|Front_gallery|Gallery_stair|Upper_stair_landing|Upper_gallery_connection|Stair_handrail|Gallery_door|Handrail|Baluster|Handrail_bend|Handrail_post|Lounge_rail_glass|Lounge_rail_glow|Curved_lounge_floor|Lounge_access_ramp|Ramp_floor_edge|Promenade_level_floor|Commons_to_promenade|Ramp_handrail|Ramp_rail_post)$/.test(o.name)){o.visible=false;if(o.name!=='Finished_floor')retired.push(o);}});for(const o of retired)o.removeFromParent();
   // Every declared shell root is detached, so the v1 cutaway toggles cannot bring it back.
   for(const o of [...cutaway])if(o===source||isChild(o,source)){o.removeFromParent();cutaway.delete(o);}

}
