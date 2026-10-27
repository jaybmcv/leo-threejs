import {cutOut} from '../cut-out.js';
import {rectangle} from '../plan/geometry-v2.js';
import {wingFlight} from '../plan/structure-v2.js';
import * as T from 'three';
import layout from 'v2-layout';
import {buildCabins} from './cabins.js';
import {polygonGeometry,mesh,box,wall,strip,glass,lining,floor,bounds} from './geometry.js';
import {roomObject,toWorld} from '../plan/rooms.js';
export function configureV2Ship(ship){
 ship.layout=layout;ship.root.userData={...ship.root.userData,layoutVersion:2,cabins:layout.cabins.length,berths:layout.summary.berths,cabinsPerNeighborhood:layout.summary.perDeck.filter(d=>d.cabins).map(d=>d.cabins),berthsPerCabin:'1 or 2',cabinEnvelope:[3.18,3.5,7.4],cabinInternal:[2.94,3.3,7.28]};
 // Force only the inexpensive deck skeleton, then discard the v1 reservations.
 for(const d of ship.decks){for(const o of [...d.children]){d.remove(o);}const p=layout.decks[d.userData.number-1];d.userData.y=p.y-.3;
  const holes=p.slab.holes.map(h=>h.polygon);const slab=mesh(d,'Deck_slab',polygonGeometry(p.slab.outline,holes,p.y),floor);
  const xs=[...new Set(p.slab.outline.map(v=>v[0]))].sort((a,b)=>a-b);slab.userData.outline=xs.map(x=>[x,Math.max(...p.slab.outline.filter(v=>v[0]===x).map(v=>Math.abs(v[1])))]);slab.userData.v2Holes=holes;
 }
 for(const o of [...ship.shared.children])ship.shared.remove(o);
 ship.ensureResidentialDeck=number=>{if(ship.residentialDecks.has(number))return ship.residentialDecks.get(number);const r=buildCabins(number);ship.decks[number-1].add(r.root);ship.residentialDecks.set(number,r);return r;};
 const service=ship.ensureServiceDeck.bind(ship);ship.ensureServiceDeck=number=>{const parts=service(number);const d=ship.decks[number-1];for(const o of [...d.children])if(!o.name.startsWith('Area_')&&o.name!=='Deck_slab'&&o.name!=='V2_cabin_instances')d.remove(o);return parts;};
 return ship;
}
function entrySegments(a,b,door,width){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),t=((door[0]-a[0])*dx+(door[2]-a[1])*dz)/(len*len),dist=Math.abs((door[0]-a[0])*dz-(door[2]-a[1])*dx)/len;
 if(dist>.3||t<0||t>1)return [[a,b]];const lo=Math.max(0,t-width/(2*len)),hi=Math.min(1,t+width/(2*len)),at=t=>[a[0]+t*dx,a[1]+t*dz];return [[a,at(lo)],[at(hi),b]].filter(([a,b])=>Math.hypot(b[0]-a[0],b[1]-a[1])>.01);}
export function fitV2Structure(ship){
 if(ship.v2Fitted)return;ship.v2Fitted=true;const structure=new T.Group();structure.name='V2_structure';ship.inside.add(structure);
 // The faired hull is kept intact. A continuous interior pressure lining prevents
 // bare distribution slabs from opening onto walkable exterior hull triangles.
 for(const d of layout.decks){const next=layout.decks[d.number];for(let i=0;i<d.slab.outline.length;i++)wall(structure,d.slab.outline[i],d.slab.outline[(i+1)%d.slab.outline.length],d.y,3.7,glass,'V2_pressure_lining');mesh(structure,'V2_distribution_ceiling',polygonGeometry(d.slab.outline,next?next.slab.holes.map(h=>h.polygon):[],d.y+3.72,.08),lining);}
 for(const r of layout.circulation.ramps){const g=polygonGeometry(r.polygon,[],0,.18),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+r.points[0][1]+(p.getX(i)-r.points[0][0])/r.run*r.rise);g.computeVertexNormals();mesh(structure,'V2_access_ramp',g,floor);}
 // Shells are rebuilt in world plan coordinates. Source fittings remain unscaled under their registered roots.
 for(const r of layout.rooms.filter(r=>r.aggregate)){roomObject(ship,r.id)?.removeFromParent();}
 for(const shuttle of layout.shuttles){const g=new T.Group();g.name='V2_escape_shuttle_placeholder_'+shuttle.id;g.userData={schedule:shuttle.id,seats:100,placeholder:true};structure.add(g);mesh(g,'V2_shuttle_floor',polygonGeometry(shuttle.polygon,[],shuttle.y,.18),floor);for(let i=0;i<4;i++){const a=shuttle.polygon[i],b=shuttle.polygon[(i+1)%4];if(i!==0)wall(g,a,b,shuttle.y,3.2,glass);}mesh(g,'V2_shuttle_ceiling',polygonGeometry(shuttle.polygon,[],shuttle.y+3.2,.12),lining);}
 for(const r of layout.rooms.filter(r=>!r.aggregate)){
  const source=roomObject(ship,r.id);
  if(source){
   // Wall-mounted art, projections, signs and lighting are fittings too. Keep them
   // under the moving room when the accepted shell gives way to its v2 envelope.
   const hung=[];source.traverse(o=>{if(o.isMesh&&/(art|mural|print|poster|painting|sconce|light|sign|display|projection|hanger|shade)/i.test(o.name)){for(let p=o.parent;p&&p!==source;p=p.parent)if(ship.cutaway.has(p)){hung.push(o);break;}}});for(const o of hung)source.attach(o);
   const retired=[];source.traverse(o=>{if(/^(Walls_and_ceiling|Garden_walls_and_ceiling|Observation_walls_and_ceiling|.*_shell)$/.test(o.name)){ship.cutaway.delete(o);o.visible=false;o.userData.v2RemovedShell=true;}if(o.isMesh&&/^(Finished_floor|Commons_floor|Commons_ceiling|Commons_rear_wall|Commons_end_wall|Rear_gallery|End_gallery|Front_gallery|Gallery_stair|Upper_stair_landing|Upper_gallery_connection|Stair_handrail|Gallery_door|Handrail|Baluster|Handrail_bend|Handrail_post|Lounge_rail_glass|Lounge_rail_glow|Curved_lounge_floor|Lounge_access_ramp|Ramp_floor_edge|Promenade_level_floor|Commons_to_promenade|Ramp_handrail|Ramp_rail_post)$/.test(o.name)){o.visible=false;if(o.name!=='Finished_floor')retired.push(o);}});for(const o of retired)o.removeFromParent();
   // Every declared shell root is detached, so the v1 cutaway toggles cannot bring it back.
   for(const o of [...ship.cutaway])if(o===source||isChild(o,source)){o.removeFromParent();ship.cutaway.delete(o);}
  }
  if(r.id==='d03-cold-6')r.fittingDoor={center:toWorld(r.id,[-26,0,0]),width:4};
  const g=new T.Group();g.name='V2_shell_'+r.id;g.userData.room=r.id;structure.add(g);
  const holes=r.assembly==='arrival-garden'&&r.deck===3?layout.decks[2].slab.holes.filter(h=>h.assembly==='arrival-garden').map(h=>h.polygon):[];
  mesh(g,'V2_room_floor',polygonGeometry(r.polygon,holes,r.y+.006,.12),floor);
  const top=r.envelope?.at(-1)?.polygon??r.polygon;mesh(g,'V2_room_ceiling',polygonGeometry(top,[],r.y+r.height,.10),lining);
  // Sectioned facade steps follow the supplied full-height envelope without scaling the fitted room.
  const sections=r.envelope||[{rise:0,height:r.height,polygon:r.polygon}];
  for(const s of sections)for(let i=0;i<s.polygon.length;i++){const a=s.polygon[i],b=s.polygon[(i+1)%s.polygon.length],doors=[r.door,r.fittingDoor,...(r.galleryDoors||[])].filter(Boolean).filter(d=>d.center[1]<r.y+s.rise+s.height&&d.center[1]+2.5>r.y+s.rise);
   let segments=[[a,b]];for(const d of doors)segments=segments.flatMap(([a,b])=>entrySegments(a,b,d.center,d.width));
   for(const [aa,bb] of segments)wall(g,aa,bb,r.y+s.rise,s.height,r.outer||r.kind==='garden'?glass:lining);
   for(const d of doors)if(entrySegments(a,b,d.center,d.width).length!==1&&d.center[1]+2.5<r.y+s.rise+s.height){const upper=Math.max(r.y+s.rise,d.center[1]+2.5);const len=Math.hypot(b[0]-a[0],b[1]-a[1]),u=(b[0]-a[0])/len,v=(b[1]-a[1])/len;wall(g,[d.center[0]-u*d.width/2,d.center[2]-v*d.width/2],[d.center[0]+u*d.width/2,d.center[2]+v*d.width/2],upper,r.y+s.rise+s.height-upper,glass);}
  }
  if(r.components){for(const o of [...(r.components.galleries||[]),...(r.components.links||[]),...(r.components.landings||[])]){const holes=(r.components.stairs||[]).filter(t=>t.center[1]<=o.center[1]+.02&&t.center[1]>o.center[1]-2.4).map(t=>[[t.center[0]-t.size[0]/2-.08,t.center[2]-t.size[2]/2-.08],[t.center[0]+t.size[0]/2+.08,t.center[2]-t.size[2]/2-.08],[t.center[0]+t.size[0]/2+.08,t.center[2]+t.size[2]/2+.08],[t.center[0]-t.size[0]/2-.08,t.center[2]+t.size[2]/2+.08]]);mesh(g,'V2_garden_gallery',polygonGeometry(o.polygon,holes,o.center[1],o.size[1]),floor);}
   // The plan's stair center.y is its finished tread elevation.
   for(const o of r.components.stairs||[])box(g,'Gallery_stair',o.size,[o.center[0],o.center[1]-o.size[1]/2,o.center[2]],lining);
  }
 }
 const holeBounds=layout.decks.map(d=>d.slab.holes.map(h=>({...h,box:bounds(h.polygon)})));
 for(const c of layout.circulation.corridors){for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)continue;const poly=rectangle((a[0]+b[0])/2,(a[1]+b[1])/2,len,c.width,-Math.atan2(b[1]-a[1],b[0]-a[0])),bb=bounds(poly),holes=holeBounds[c.deck-1].filter(h=>h.box.x0<bb.x1&&h.box.x1>bb.x0&&h.box.z0<bb.z1&&h.box.z1>bb.z0).map(h=>h.polygon);if(holes.length)mesh(structure,'V2_corridor_floor',polygonGeometry(poly,holes,layout.decks[c.deck-1].y+.008,.06),floor);else strip(structure,'V2_corridor_floor',a,b,layout.decks[c.deck-1].y+.008,c.width,.06,floor);}}
 for(const b of layout.circulation.bridges)mesh(structure,'V2_tower_bridge_floor',polygonGeometry(b.polygon,[],layout.decks[b.deck-1].y,.24),floor);
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
 // Tower shaft glass and all exterior/hull geometry stay from the existing fixed transit network.
}
function isChild(o,root){for(let p=o.parent;p;p=p.parent)if(p===root)return true;return false;}
