import {forumTerraces,forumUpperPlan} from './launch-e-fitout.js';
import {atriumFloorGeometry,atriumFloorMaterial,skyCeilingGeometry,skyMaterial} from './atrium-surfaces.js';
import {buildCrewGallery} from './crew-gallery.js';
import {entrySegments,entryHeader} from './room-entries.js';
import {ownerFootprint} from '../plan/envelope-ownership-v2.js';import {worldPoint} from '../plan/hull-skin-v2.js';
import {buildGardenGuards,galleryHoles} from './garden-guards.js';
import {LIFTS} from '../walk/lifts.js';
import {cutOut} from '../cut-out.js';
import {rectangle} from '../plan/geometry-v2.js';
import {wingFlight} from '../plan/structure-v2.js';
import * as T from 'three';
import layout from 'v2-layout';
import {buildCabins} from './cabins.js';
import {polygonGeometry,mesh,box,wall,strip,removeBottomCap,removePanelEndCaps,removeGeometryCaps,glass,lining,floor,bounds} from './geometry.js';
import {roomObject,toWorld} from '../plan/rooms.js';
// The raised lounge is one continuous room. Old Deck 18/19 masks followed
// the inset wall line and left tiny slab islands outside that line but inside
// the finished room. Reserve the full floor projection through its height;
// the native approach ramp and explicit stairs remain separate meshes.
function loungeVoidMasks(y,depth=.24){const r=layout.rooms.find(r=>r.id==='observation-lounge');return r&&y>r.y+.4&&y-depth<r.y+r.height-.2?[r.polygon]:[];}
export function configureV2Ship(ship){
 ship.layout=layout;ship.root.userData={...ship.root.userData,layoutVersion:2,cabins:layout.cabins.length,berths:layout.summary.berths,cabinsPerNeighborhood:layout.summary.perDeck.filter(d=>d.cabins).map(d=>d.cabins),berthsPerCabin:'1 or 2',cabinEnvelope:[3.42,3.5,7.64],cabinInternal:[3.18,3.4,7.4]};
 // Force only the inexpensive deck skeleton, then discard the v1 reservations.
 for(const d of ship.decks){for(const o of [...d.children]){d.remove(o);}const p=layout.decks[d.userData.number-1];d.userData.y=p.y-.3;
  const holes=[...p.slab.holes.map(h=>h.polygon),...loungeVoidMasks(p.y)];if(layout.hullPrototypes?.rollout)for(const c of layout.cabins.filter(c=>c.deck===p.number))holes.push(c.hullPrototype?c.hullPrototype.polygon:rectangle(c.x,c.z,3.18,7.4,c.yaw));if(layout.hullPrototypes?.rollout)for(const envelope of layout.hullPrototypes.prototypes.filter(e=>e.deck===p.number&&e.kind!=='cabin'))holes.push(envelope.polygon);if(layout.hullPrototypes?.rollout)for(const shuttle of layout.shuttles.filter(s=>s.deck===p.number))holes.push(shuttle.polygon);const slab=mesh(d,'Deck_slab',p.number===6?atriumFloorGeometry(p.slab.outline,holes,p.y,p.atrium.outline):polygonGeometry(p.slab.outline,holes,p.y),p.number===6?atriumFloorMaterial:floor);
  const xs=[...new Set(p.slab.outline.map(v=>v[0]))].sort((a,b)=>a-b);slab.userData.outline=xs.map(x=>[x,Math.max(...p.slab.outline.filter(v=>v[0]===x).map(v=>Math.abs(v[1])))]);slab.userData.v2Holes=holes;
 }
 for(const o of [...ship.shared.children])ship.shared.remove(o);
 ship.ensureResidentialDeck=number=>{if(ship.residentialDecks.has(number))return ship.residentialDecks.get(number);const r=buildCabins(number);ship.decks[number-1].add(r.root);ship.residentialDecks.set(number,r);return r;};
 const service=ship.ensureServiceDeck.bind(ship);ship.ensureServiceDeck=number=>{const parts=service(number);const d=ship.decks[number-1];for(const o of [...d.children])if(!o.name.startsWith('Area_')&&o.name!=='Deck_slab'&&o.name!=='V2_cabin_instances')d.remove(o);return parts;};
 return ship;
}
export function fitV2Structure(ship){
 if(ship.v2Fitted)return;ship.v2Fitted=true;const structure=new T.Group();structure.name='V2_structure';ship.inside.add(structure);
 // The faired hull is kept intact. A continuous interior pressure lining prevents
 // bare distribution slabs from opening onto walkable exterior hull triangles.
 for(const d of layout.decks){const next=layout.decks[d.number];for(let i=0;i<d.slab.outline.length;i++)removePanelEndCaps(wall(structure,d.slab.outline[i],d.slab.outline[(i+1)%d.slab.outline.length],d.y,3.7,glass,'V2_pressure_lining'));mesh(structure,'V2_distribution_ceiling',polygonGeometry(d.slab.outline,[...(next?next.slab.holes.map(h=>h.polygon):[]),...(d.number===20?[d.atrium.outline]:[]),...loungeVoidMasks(d.y+3.72,.08)],d.y+3.72,.08),lining);}
 for(const b of layout.circulation.balconies||[]){if(b.kind==='dining-apron'&&b.deck===6)continue;const d=layout.decks[b.deck-1],xs=b.polygon.map(q=>q[0]),zs=b.polygon.map(q=>q[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),rect=(a,b,c,e)=>rectangle((a+b)/2,(c+e)/2,b-a,e-c),masks=[rect(-1000,x0,-1000,1000),rect(x1,1000,-1000,1000),rect(-1000,1000,-1000,z0),rect(-1000,1000,z1,1000),...d.slab.holes.filter(h=>h.id!=='atrium').map(h=>h.polygon)];const o=mesh(structure,'V2_lounge_balcony_floor',polygonGeometry(d.atrium.outline,masks,d.y,.24),floor);o.userData={v2Deck:b.deck,balcony:b.id,role:'floor'};}
 const sky=mesh(structure,'P6_sky_ceiling',skyCeilingGeometry(layout),skyMaterial());sky.userData={v2Deck:20,phase6:true,ceiling:true};
 buildCrewGallery(structure,layout);
 for(const r of layout.circulation.ramps){const g=polygonGeometry(r.polygon,[],0,.18),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+r.points[0][1]+(p.getX(i)-r.points[0][0])/r.run*r.rise);g.computeVertexNormals();mesh(structure,'V2_access_ramp',g,floor);if(r.id==='observation-lounge-ramp'){const angle=Math.atan2(r.rise,r.run),length=Math.hypot(r.run,r.rise),x=(r.points[0][0]+r.points[1][0])/2,y=(r.points[0][1]+r.points[1][1])/2;for(const side of[-1,1])for(const[h,depth,mat,name]of[[1.1,.06,glass,'V2_observation_ramp_guard'],[.055,.075,lining,'V2_observation_ramp_rail']]){const rise=name.endsWith('_rail')?1.12:.55,o=box(structure,name,[length,h,depth],[x-Math.sin(angle)*rise,y+Math.cos(angle)*rise,side*(r.width/2+.04)],mat);o.rotation.z=angle;}}}
 // Shells are rebuilt in world plan coordinates. Source fittings remain unscaled under their registered roots.
 for(const r of layout.rooms.filter(r=>r.aggregate)){roomObject(ship,r.id)?.removeFromParent();}
 for(const shuttle of layout.shuttles){const g=new T.Group();g.name='V2_escape_shuttle_bay_'+shuttle.id;g.userData={schedule:shuttle.id,hullFacadeOwner:shuttle.roomId,component:shuttle.id,seats:100,placeholder:false,craftInstalled:true};structure.add(g);mesh(g,'V2_shuttle_floor',polygonGeometry(shuttle.polygon,[],shuttle.y,.18),floor);for(let i=0;i<4;i++){const a=shuttle.polygon[i],b=shuttle.polygon[(i+1)%4];if(i===0)continue;if(i===3&&shuttle.hullEnvelope){const door=[(a[0]+b[0])/2,shuttle.y,(a[1]+b[1])/2];g.userData.bayEntry={center:door,width:1.8,height:3.2};for(const [aa,bb] of entrySegments(a,b,door,1.8))removeBottomCap(wall(g,aa,bb,shuttle.y,3.2,glass));}else removeBottomCap(wall(g,a,b,shuttle.y,3.2,glass));}mesh(g,'V2_shuttle_ceiling',polygonGeometry(shuttle.polygon,[],shuttle.y+3.2,.12),lining);}
 for(const r of layout.rooms.filter(r=>!r.aggregate)){
  const source=roomObject(ship,r.id);
  if(source){retireV2RoomShell(source,ship.cutaway);if(r.id==='d16-voyage-forum-bow')source.clear();if(r.id==='observation-lounge'){const keep=[];source.traverse(o=>{if(/Shared_telescope_base|Viewing_scope|Scope_column|Scope_optical_head/.test(o.name))keep.push(o);});for(const o of keep)source.attach(o);for(const o of [...source.children])if(!keep.includes(o))source.remove(o);}}
  const g=new T.Group();g.name='V2_shell_'+r.id;g.userData.room=r.id;structure.add(g);if(r.launchE?.kind==='oval-forum'){const [x,z,w,d]=r.launchE.seating,oval=Array.from({length:96},(_,i)=>[x+w/2*Math.cos(i*Math.PI/48),z+d/2*Math.sin(i*Math.PI/48)]),inlay=mesh(g,'Forum_oval_inlay',polygonGeometry(oval,[],r.y+.014,.002),new T.MeshStandardMaterial({name:'Forum_oval_textile',color:0x35545a,roughness:.95}));inlay.userData.noCollide=true;}if(r.launchE?.kind==='oval-forum')for(const t of forumTerraces())mesh(g,'Forum_terrace_floor',polygonGeometry(t.polygon,[],r.y+t.rise,t.rise),floor);
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
 const holeBounds=layout.decks.map(d=>d.slab.holes.map(h=>({...h,box:bounds(h.polygon)}))),roomHoles=layout.decks.map(d=>layout.rooms.filter(r=>!r.aggregate&&Math.abs(r.y-d.y)<.1&&r.polygon.length).map(r=>({polygon:r.polygon,box:bounds(r.polygon)})));
 for(const c of layout.circulation.corridors){for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)continue;const poly=rectangle((a[0]+b[0])/2,(a[1]+b[1])/2,len,c.width,-Math.atan2(b[1]-a[1],b[0]-a[0])),bb=bounds(poly),holes=[...roomHoles[c.deck-1],...holeBounds[c.deck-1]].filter(h=>h.box.x0<bb.x1&&h.box.x1>bb.x0&&h.box.z0<bb.z1&&h.box.z1>bb.z0).map(h=>h.polygon);if(c.deck===6)holes.push(layout.decks[5].atrium.outline);if(holes.length)mesh(structure,'V2_corridor_floor',polygonGeometry(poly,holes,layout.decks[c.deck-1].y+.008,.06),floor);else strip(structure,'V2_corridor_floor',a,b,layout.decks[c.deck-1].y+.008,c.width,.06,floor);}}
 for(const b of layout.circulation.bridges)mesh(structure,'V2_tower_bridge_floor',polygonGeometry(b.polygon,[],layout.decks[b.deck-1].y,.24),b.deck===20?new T.MeshStandardMaterial({name:'P6_crew_service_floor',color:0x59666b,roughness:.8}):floor);
 for(const t of layout.circulation.towers)mesh(structure,'V2_tower_landing_floor',polygonGeometry(t.polygon,layout.decks[t.deck-1].openings.filter(o=>o.x0>120).map(o=>o.polygon),layout.decks[t.deck-1].y,.24),floor);
 for(const s of layout.circulation.stairs.filter(s=>s.wing!==undefined&&s.deck<15)){
  const y=layout.decks[s.deck-1].y,f=wingFlight(s,layout.circulation.stairs),run=5;
  // Nine lower risers reach a 1.5 m half landing under the upper slab. Fifteen return
  // risers stay inside the explicit upper opening, even where the hull roots taper 5 m.
  for(let k=0;k<9;k++)box(structure,'Stair_tread_up',[run/9+.012,.18,1.2],[f.x-2.5+(k+.5)*run/9,y+(k+1)/6-.09,f.outer],lining);
  for(let k=0;k<15;k++)box(structure,'Stair_tread_return',[run/15+.012,.18,1.2],[f.x+2.5-(k+.5)*run/15,y+1.5+(k+1)/6-.09,f.z],lining);
  box(structure,'V2_wing_stair_landing',[1,.18,6],[f.x+2.9,y+1.41,s.z],floor);
  box(structure,'V2_wing_stair_entry',[1.2,.18,6],[f.x-3.2,y-.09,s.z],floor);
  box(structure,'V2_wing_stair_exit',[1.5,.18,1.6],[f.x-3.25,y+3.91,f.z],floor);
 }
 // Retain the existing nacelle-gallery openings through the new interior lining.
 const wingFloors=[];ship.ensureAft().root.traverse(o=>{if(o.isMesh&&o.name==='Wing_gallery_tread')wingFloors.push(o);});for(const o of wingFloors){o.updateWorldMatrix(true,false);const b=new T.Box3().setFromObject(o);b.min.y=b.max.y-.01;b.max.y+=3.2;b.min.x-=.08;b.max.x+=.08;b.min.z-=.08;b.max.z+=.08;cutOut(structure,b,o=>o.name==='V2_pressure_lining');}
 structure.updateMatrixWorld(true);for(const o of structure.children){const bb=new T.Box3().setFromObject(o);o.userData.v2Deck=Math.max(1,Math.min(20,Math.floor((bb.min.y+39.7+.3)/4)+1));}
 // The retained fin inspection terraces also need glass at their open end edges.
 ship.v2GuardPlatforms=[];ship.ensureAft().root.updateWorldMatrix(true,true);ship.ensureAft().root.traverse(o=>{if(o.name!=='Fin_inspection_platform'||!o.isMesh)return;const b=new T.Box3().setFromObject(o,true),p={x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z,y:b.max.y};ship.v2GuardPlatforms.push(p);for(const side of [-1,1]){const a=box(structure,'V2_fin_guard',[.07,1.1,p.z1-p.z0],[side<0?p.x0:p.x1,p.y+.55,(p.z0+p.z1)/2],glass),c=box(structure,'V2_fin_guard',[p.x1-p.x0,1.1,.07],[(p.x0+p.x1)/2,p.y+.55,side<0?p.z0:p.z1],glass);for(const g of [a,c])g.userData={v2Deck:20,room:'fin'};}});
 // Glazed returns close the two stepped bow-facade corners above the Deck 18 promenade.
 const lounge=layout.rooms.find(r=>r.id==='observation-lounge'),level=layout.decks[17].y,entry=lounge.door.center[0],section=lounge.envelope.find(s=>s.rise>=level-lounge.y-.001),edge=Math.max(...section.polygon.filter(p=>Math.abs(p[0]-entry)<.01).map(p=>Math.abs(p[1])));
 for(const side of [-1,1]){const h=lounge.y+lounge.height-level,o=box(structure,'V2_bow_glazed_return',[.08,h,2.6],[entry-.10,level+h/2,side*(edge-1.3)],glass);o.userData.v2Deck=18;}
 // The retained fin lift had guide rails without a continuous shaft enclosure.
 const crown=LIFTS.find(l=>l.id==='crown'),bottom=crown.stops[0].y,top=crown.stops.at(-1).y+3.2;
 for(const axis of ['x','z'])for(const sign of [-1,1]){const across=axis==='x'?'z':'x',center=crown.car[across],at=crown.car[axis]+sign*2.23,doors=crown.stops.filter(s=>{const d=s.door||crown.door;return d.axis===axis&&d.sign===sign;});const put=(lo,hi,width,mid)=>{for(let y=lo;y<hi-.01;y+=4){const h=Math.min(4,hi-y),o=box(structure,'V2_crown_shaft_glass',axis==='x'?[.1,h,width]:[width,h,.1],axis==='x'?[at,y+h/2,mid]:[mid,y+h/2,at],glass);o.userData.v2Deck=20;}};for(const s of [-1,1])put(bottom,top,.93,center+s*1.765);let y=bottom;for(const d of doors){put(y,d.y,2.6,center);y=d.y+2.8;}put(y,top,2.6,center);}
 // Tower shafts and all exterior/hull geometry retain their fixed transit frames.
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
