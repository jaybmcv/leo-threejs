import {buildRoomShell} from './room-shell.js';
export {buildRoomShell,retireV2RoomShell} from './room-shell.js';
import {forumTerraces,forumUpperPlan} from './launch-e-fitout.js';
import {forumTerraceGeometry} from './forum-terrace-geometry.js';
import {buildCorridorFloors} from './corridor-floor-union.js';
import {buildCommonsHallFinish} from './commons-hall-finish.js';
import {atriumFloorGeometry,atriumFloorMaterial,skyCeilingGeometry,skyMaterial} from './atrium-surfaces.authoring.js';
import {buildCrewGallery} from './crew-gallery.js';
import {entrySegments,entryHeader} from './room-entries.js';
import {ownerFootprint} from '../plan/envelope-ownership-v2.js';import {worldPoint} from '../plan/hull-skin-v2.js';
import {buildGardenGuards,galleryHoles} from './garden-guards.js';
import {LIFTS} from '../walk/lifts.authoring.js';
import {cutOut} from '../cut-out.js';
import {rectangle} from '../plan/geometry-v2.js';
import {wingFlight} from '../plan/structure-v2.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import layout from '../plan/selected-layout.js';
import {buildCabins} from './cabins.authoring.js';
import {polygonGeometry,mesh,box,wall,strip,removeBottomCap,removePanelEndCaps,removeGeometryCaps,glass,lining,floor,bounds} from './geometry.js';
import {roomObject,toWorld} from '../plan/rooms.js';
// The raised lounge is one continuous room. Old Deck 18/19 masks followed
// the inset wall line and left tiny slab islands outside that line but inside
// the finished room. Reserve the full floor projection through its height;
// the native approach ramp and explicit stairs remain separate meshes.
function loungeVoidMasks(y,depth=.24){const r=layout.rooms.find(r=>r.id==='observation-lounge');return r&&y>r.y+.4&&y-depth<r.y+r.height-.2?[r.polygon]:[];}
// Atrium concept A (lit glass tower, 2026-11-08). The facade's copy of the tower (atrium-architecture.js) gives its bridges
// and landings glass-blue undersides, close to the concept's light glass bands, and fascias in the same tone, so a slab's
// edge recedes and reads as the warm light line under it; the walked tops keep their finish. Each [x,y,z,colour,lit]
// colours the faces facing that way, and lit (if given) shades them as if they faced that way instead: shaded truly, a
// face looking down takes the hemisphere's ground colour and the lower environment, so the concept's pale glass-blue
// would read steel grey.
const TOWER_SLAB_FACES=[[0,-1,0,0x80b2cc,[0,1,0]],...[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]].map(v=>[...v,0x80b2cc,[0,1,0]])];
// Under each landing above Deck 6, a pale lane runs from its aft edge to each forward shaft, as wide as the shaft, so the
// glass shafts read as one column through the landings (the concept's glass prism). 2 cm thick, 2 cm under the slab, in
// the landings' own bucket of the tower copy (named in atrium-architecture.js). Visual only.
const TOWER_LANE_FACES=[[0,-1,0,0xe6f3f8,[0,1,0]]];
function towerShaftLanes(structure){
 const parts=[];
 for(const t of layout.circulation.towers.filter(t=>t.deck>6)){
  const d=layout.decks[t.deck-1],{x0}=bounds(t.polygon);
  for(const l of LIFTS.filter(l=>l.id.startsWith('forward-'))){const x1=l.car.x-1.8;if(x1-x0>1)parts.push(new T.BoxGeometry(x1-x0-.21,.02,3.6).translate((x0+.21+x1)/2,d.y-.27,l.car.z));}
 }
 if(parts.length){const o=mesh(structure,'V2_tower_shaft_lanes',mergeGeometries(parts),floor);o.userData.noCollide=true;o.userData.towerFaces=TOWER_LANE_FACES;parts.forEach(g=>g.dispose());}
}
// A warm line of light under both long edges of each bridge above Deck 6, only where it crosses the open atrium (further
// out it lies over the deck's own slab), and along each landing's aft edge and its short returns to the bridges, so the
// line runs unbroken across the tower. 20 cm wide, hanging 8 cm below the slab, so it still reads from the atrium floor.
// Lit like the lift lobbies' ceiling lights (transit.js), so the tower copy draws the two together. Visual only.
const towerBridgeLight=new T.MeshStandardMaterial({name:'V2_tower_bridge_light',color:0xffe5af,emissive:0xffc66e,emissiveIntensity:1.5});
function towerBridgeLights(structure){
 const parts=[],across=(p,x)=>{let h=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(a[0]!==b[0]&&(a[0]-x)*(b[0]-x)<=0)h=Math.max(h,Math.abs(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])));}return h;};
 for(const b of layout.circulation.bridges.filter(b=>b.deck>6)){
  const d=layout.decks[b.deck-1],{x0,x1,z0,z1}=bounds(b.polygon),side=Math.sign(z0+z1),open=Math.min(across(d.atrium.outline,x0),across(d.atrium.outline,x1))-.25;
  const lo=Math.min(Math.abs(z0),Math.abs(z1))+.25,hi=Math.min(Math.max(Math.abs(z0),Math.abs(z1)),open);if(hi-lo<1)continue;
  for(const x of [x0+.105,x1-.105])parts.push(new T.BoxGeometry(.2,.1,hi-lo).translate(x,d.y-.27,side*(lo+hi)/2));
 }
 for(const t of layout.circulation.towers.filter(t=>t.deck>6)){
  const d=layout.decks[t.deck-1],{x0,z0,z1}=bounds(t.polygon),bridges=layout.circulation.bridges.filter(b=>b.deck===t.deck);
  if(across(d.atrium.outline,x0)<z1+.25)continue;
  parts.push(new T.BoxGeometry(.2,.1,z1-z0).translate(x0+.105,d.y-.27,(z0+z1)/2));
  const bx=Math.min(...bridges.map(b=>bounds(b.polygon).x0));if(!(bx>x0+1&&bx<Infinity))continue;
  for(const z of [z0+.105,z1-.105])parts.push(new T.BoxGeometry(bx+.2-x0,.1,.2).translate((x0+bx+.2)/2,d.y-.27,z));
 }
 if(parts.length){mesh(structure,'V2_tower_bridge_light',mergeGeometries(parts),towerBridgeLight).userData.noCollide=true;parts.forEach(g=>g.dispose());}
}
function alignShuttleGlass(o,y){o.updateMatrix();o.geometry.applyMatrix4(o.matrix);o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);const p=o.geometry.attributes.position,base=Math.fround(y);for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-base)<.0001)p.setY(i,base);o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();o.updateMatrix();return o;}
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
 for(const shuttle of layout.shuttles){const g=new T.Group();g.name='V2_escape_shuttle_bay_'+shuttle.id;g.userData={schedule:shuttle.id,hullFacadeOwner:shuttle.roomId,component:shuttle.id,seats:100,placeholder:false,craftInstalled:true};structure.add(g);mesh(g,'V2_shuttle_floor',polygonGeometry(shuttle.polygon,[],shuttle.y,.18),floor);for(let i=0;i<4;i++){const a=shuttle.polygon[i],b=shuttle.polygon[(i+1)%4];if(i===0)continue;if(i===3&&shuttle.hullEnvelope){const door=[(a[0]+b[0])/2,shuttle.y,(a[1]+b[1])/2];g.userData.bayEntry={center:door,width:1.8,height:3.2};for(const [aa,bb] of entrySegments(a,b,door,1.8))removeBottomCap(alignShuttleGlass(wall(g,aa,bb,shuttle.y,3.2,glass),shuttle.y));}else removeBottomCap(alignShuttleGlass(wall(g,a,b,shuttle.y,3.2,glass),shuttle.y));}mesh(g,'V2_shuttle_ceiling',polygonGeometry(shuttle.polygon,[],shuttle.y+3.2,.12),lining);}
 for(const r of layout.rooms.filter(r=>!r.aggregate))buildRoomShell(ship,r,structure);
 const holeBounds=layout.decks.map(d=>d.slab.holes.map(h=>({...h,box:bounds(h.polygon)}))),roomHoles=layout.decks.map(d=>layout.rooms.filter(r=>!r.aggregate&&Math.abs(r.y-d.y)<.1&&r.polygon.length).map(r=>({polygon:r.polygon,box:bounds(r.polygon)})));
 buildCorridorFloors(structure,layout,roomHoles,holeBounds);
 buildCommonsHallFinish(structure,layout);
 for(const b of layout.circulation.bridges)mesh(structure,'V2_tower_bridge_floor',polygonGeometry(b.polygon,[],layout.decks[b.deck-1].y,.24),b.deck===20?new T.MeshStandardMaterial({name:'P6_crew_service_floor',color:0x59666b,roughness:.8}):floor).userData.towerFaces=TOWER_SLAB_FACES;
 for(const t of layout.circulation.towers)mesh(structure,'V2_tower_landing_floor',polygonGeometry(t.polygon,layout.decks[t.deck-1].openings.filter(o=>o.x0>120).map(o=>o.polygon),layout.decks[t.deck-1].y,.24),floor).userData.towerFaces=TOWER_SLAB_FACES;
 towerBridgeLights(structure);towerShaftLanes(structure);
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