import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CABINS,SAMPLE} from './model.js';
import {SHIP_AREAS} from './areas.js';

// Exploded view. Turning the dial parts the hull halves (each carrying its wing and engine pod, whose machinery rises
// out of it), lifts the fin and its crown bar away aft, and spreads the twenty decks apart. The last stretch of the
// dial fades the floors and corridors away and scatters every room and space, down to each of the 5,000 cabins, so
// each sits by itself at full scale. Each part keeps its assembled position, so apply(0) puts the ship back exactly.
export const DECK_SPREAD=16;// extra metres between neighbouring decks at full explode (decks are 4 m apart)
const FLOOR=-40,PITCH=4;// Deck 1 floor and the deck pitch, as in model.js
// The hull halves drop as they part (the public view has no floor), so they stay clear of the decks rising between them.
const HULL_OUT=150,HULL_DOWN=110,WING_OUT=110,POD_UP=60,LIFT=40,FIN_BACK=200,FIN_UP=90,CROWN_UP=60,CAP_OUT=60;
// Rooms scatter horizontally away from the middle of their deck by this fraction of their distance from it.
const SCATTER=.6,MID_X=-18;
// While exploded the deck slabs sit 6 cm low: their undersides otherwise coincide with the undersides of the cabin
// and room floors resting on them, which flicker when the spread decks are seen from below.
const SLAB_DROP=.06;
// Each movement runs over its own stretch of the dial, so the ship comes apart in order.
export const STAGES={hull:[0,.28],wing:[.2,.46],pods:[.3,.52],fin:[.14,.42],crown:[.3,.56],decks:[.14,.67],floors:[.68,.82],rooms:[.7,1],tint:[.68,.9]};
// The dial's named stops: each is where one stage has finished (the dial eases onto one when released close by).
export const STOPS=[{value:.28,name:'Hull'},{value:.67,name:'Decks'},{value:1,name:'Rooms'}];
const ease=(p,[a,b])=>{const t=Math.min(1,Math.max(0,(p-a)/(b-a)));return t*t*(3-2*t);};
// The decks lift one after another, top first: each deck's lift takes DECK_RUN of the dial, starting DECK_STAGGER
// after the deck above. Parts inside the ship rise with the deck they stand on.
const DECK_RUN=.34,DECK_STAGGER=.01;
const deckIndex=y=>Math.max(0,Math.round((y-FLOOR)/PITCH));
function deckLift(i,p){const start=STAGES.decks[0]+(19-Math.min(19,i))*DECK_STAGGER;return ease(p,[start,start+DECK_RUN]);}
const rise=(y,p)=>{const i=deckIndex(y);return (LIFT+i*DECK_SPREAD)*deckLift(i,p);};
// The lift and stair shafts span every deck, so they stretch with the stack as a whole.
const stackLift=p=>ease(p,STAGES.decks),stretch=p=>1+DECK_SPREAD/PITCH*stackLift(p),lifted=p=>LIFT*stackLift(p);
// Rooms scatter in a ripple: the middle of each deck moves first and the ends (up to RIPPLE_REACH metres out) last.
const RIPPLE_REACH=300,RIPPLE_DELAY=.1;
function scatterAt(x,z,p){const d=Math.min(1,Math.hypot(x-MID_X,z)/RIPPLE_REACH)*RIPPLE_DELAY;return SCATTER*ease(p,[STAGES.rooms[0]+d,STAGES.rooms[1]-RIPPLE_DELAY+d]);}

// kind: hull/wing/pod (side ±1), fin, crown, aftcap, nose, roof (rises with the stack), deck (rises, never scatters),
// slab, and room (rises with its deck unless it is already a deck's child, and scatters from x, z).
function offset({kind,side=0,y=0,x=MID_X,z=0,onDeck=false,nudge=0},p,out){
 const parted=ease(p,STAGES.hull),fin=ease(p,STAGES.fin),up=rise(y,p);
 if(kind==='hull')return out.set(0,-HULL_DOWN*parted,side*HULL_OUT*parted);
 if(kind==='wing'||kind==='pod')return out.set(0,-HULL_DOWN*parted+(kind==='pod'?POD_UP*ease(p,STAGES.pods):0),side*(HULL_OUT*parted+WING_OUT*ease(p,STAGES.wing)));
 if(kind==='fin')return out.set(-FIN_BACK*fin,FIN_UP*fin,0);
 if(kind==='crown')return out.set(-FIN_BACK*fin,FIN_UP*fin+CROWN_UP*ease(p,STAGES.crown),0);
 if(kind==='aftcap')return out.set(-CAP_OUT*fin,up,0);
 if(kind==='nose')return out.set(CAP_OUT*fin,up,0);
 if(kind==='slab')return out.set(0,p>0?-SLAB_DROP:0,0);
 if(kind==='room'){const k=scatterAt(x,z,p);return out.set((x-MID_X)*k,(onDeck?0:up)+(p>0?nudge:0),z*k);}
 return out.set(0,up,0);// deck, roof
}

const box=new T.Box3(),center=new T.Vector3();
function bounds(o){box.setFromObject(o);return {min:box.min.clone(),max:box.max.clone(),center:box.getCenter(center).clone()};}

// The exterior's top-level groups hold its parts; name decides the fin, crown, sensors and end caps, and the rest go
// to the side they sit on: hull detailing with its hull half, wing, pod and engine details with the wing.
function exteriorKind(group,part){
 const name=part.name;
 if(group.name==='Fin_panorama_lounge')return 'crown';
 if(/^(Upright_tail_assembly|V34_fin_)/.test(name))return 'fin';
 if(/^(Dorsal_sensor|Sensor_|Dorsal_whiskers)/.test(name))return 'roof';
 if(/^(Contoured_aft_pressure_frame|Aft_service_)/.test(name))return 'aftcap';
 if(/^Nose_/.test(name))return 'nose';
 if(group.name==='Wings_engines_tail'||/^(V35_pod_|V32_engine_)/.test(name))return 'wing';
 return 'hull';
}

// A few wing trims are single meshes running tip to tip. They are split into port and starboard halves (sharing the
// original vertex buffers) so each half can follow its wing. Returns the new starboard mesh, or null if the mesh
// cannot be split cleanly.
function splitAcross(mesh){
 const g=mesh.geometry;if(!g?.attributes.position||g.groups.length||Array.isArray(mesh.material)||g.morphAttributes.position)return null;
 const pos=g.attributes.position,index=g.index?Array.from(g.index.array):Array.from({length:pos.count},(_,i)=>i),port=[],starboard=[],v=new T.Vector3();
 for(let i=0;i<index.length;i+=3){let z=0;for(let k=0;k<3;k++)z+=v.fromBufferAttribute(pos,index[i+k]).applyMatrix4(mesh.matrixWorld).z;(z<0?port:starboard).push(index[i],index[i+1],index[i+2]);}
 if(!port.length||!starboard.length)return null;
 const half=list=>{const h=new T.BufferGeometry();for(const [name,attribute] of Object.entries(g.attributes))h.setAttribute(name,attribute);h.setIndex(list);h.computeBoundingBox();h.computeBoundingSphere();return h;};
 const twin=mesh.clone();twin.geometry=half(starboard);mesh.geometry=half(port);mesh.parent.add(twin);
 return twin;
}

// Room colours for the scattered rooms, grouped from the ship-area categories (areas.js). Each room's materials are
// swapped for tinted copies while the rooms scatter, and swapped back once they are home.
export const ROOM_GROUPS=[
 {key:'homes',name:'Homes',color:0xb79cdc},
 {key:'shared',name:'Shared spaces',color:0x7cc28f},
 {key:'food',name:'Food & life support',color:0x4fb8a6},
 {key:'medical',name:'Medical & safety',color:0xe57373},
 {key:'cargo',name:'Cargo & transfer',color:0xd9a35c},
 {key:'command',name:'Command',color:0x6f9be0},
 {key:'engineering',name:'Engineering',color:0xf2702a},
];
const CATEGORY_GROUP={'Cargo & logistics':'cargo','Passenger transfer':'cargo','Neighborhood services':'cargo','Food & cultivation':'food','Life support':'food','Medical & shelter':'medical','Emergency embarkation':'medical','Education & recreation':'shared','Upper aft commons':'shared','Community assembly':'shared','Command & operations':'command','Aft engineering':'engineering','Lower aft services':'engineering'};
const KIND_GROUP={stores:'cargo',farm:'food',gym:'shared'};// the lower bow facilities mix uses
const TINT=.62;// how far each surface moves toward its room colour
const areaGroup=a=>CATEGORY_GROUP[a.category]||KIND_GROUP[a.kind]||null;
// How many rooms each colour covers: the fitted ship areas, plus the 5,000 cabins, ten nose commons, ten gardens
// and the observation lounge.
export const ROOM_COUNTS=Object.fromEntries(ROOM_GROUPS.map(g=>[g.key,SHIP_AREAS.filter(a=>areaGroup(a)===g.key).length+(g.key==='homes'?5000:g.key==='shared'?21:0)]));
function roomGroup(o){
 if(o.name.startsWith('Area_'))return areaGroup(o.userData);
 return /^(Nose_commons_|Fitted_garden_commons_|Shared_observation_lounge)/.test(o.name)?'shared':null;
}

// What a picked room is, for its label and for opening it in its own view.
function roomInfo(o){
 if(o.name.startsWith('Area_'))return {type:'area',id:o.userData.id,name:o.userData.name,deck:o.userData.deck};
 let m=/^Nose_commons_(\d+)/.exec(o.name);if(m)return {type:'nose',neighborhood:Number(m[1])};
 m=/^Fitted_garden_commons_(\d+)/.exec(o.name);if(m)return {type:'garden',neighborhood:Number(m[1])};
 return o.name.startsWith('Shared_observation_lounge')?{type:'observation'}:null;
}

// The repeated cabins are instanced, one InstancedMesh per cabin part with instance i in the cabin CABIN_ORDER[i]
// (model.js createNeighborhood), so scattering them moves each instance's translation.
const CABIN_ORDER=CABINS.filter(c=>c.neighborhood===10&&c.id!==SAMPLE.id);
const CORRIDORS=/(_connected_service_corridors|_special_area_connections)$/,PLACEHOLDERS=/(_space_reservations|_twin_cabin_envelopes|^Primary_corridors)$/;

// `ship` is the viewer's ship (model.js createShip) with its residential decks, gardens, observation lounge, transit
// cores and aft systems built. Fitted areas built later join with refresh().
export function createExplode({ship,transit,aft,thrusters,outline}){
 const {exterior,inside,decks}=ship;
 exterior.updateMatrixWorld(true);inside.updateWorldMatrix(false,true);// always recurses (the viewer skips the interior's per-frame update when nothing moved)
 let crownBox=null;// the crown bar's assembled bounds, for its call-out
 const parts=[],stretched=[],added=[],floors=[],slabs=[],cabins=[],residences=[],registered=new Set();
 // Rooms whose floors overlap (the lifeboat bays share floor area with their neighbours) would be coplanar and
 // flicker once the slabs fade, so while exploded each room sits a few centimetres off its neighbours.
 let rooms=0;
 const add=(object,kind,props={})=>{registered.add(object);parts.push({object,base:object.position.clone(),kind,...(kind==='room'?{nudge:(rooms++%8)*.02+(/lifeboats/.test(object.name)?.01:0)}:{}),...props});};
 for(const group of exterior.children){
  if(group.name==='Fin_panorama_lounge'){add(group,'crown');crownBox=new T.Box3().setFromObject(group);continue;}
  for(const part of [...group.children]){
   const kind=exteriorKind(group,part);let b=bounds(part);
   if((kind==='hull'||kind==='wing')&&b.min.z<-10&&b.max.z>10&&part.isMesh){const twin=splitAcross(part);if(twin){added.push(twin);add(twin,kind,{side:1});b=bounds(part);}}
   add(part,kind,{side:group.name==='Port_shell'?-1:group.name==='Starboard_shell'?1:Math.sign(b.center.z),y:b.min.y});
  }
 }
 // The plumes and their lights follow the pods and the aft service doors.
 if(thrusters)for(const o of thrusters.root.children)add(o,Math.abs(o.position.z)>95?'wing':'aftcap',{side:Math.sign(o.position.z),y:o.position.y});
 decks.forEach((deck,i)=>add(deck,'deck',{y:FLOOR+i*PITCH}));
 // A room's centre, measured with its deck put back in place.
 const roomProps=(o,onDeck)=>{const b=bounds(o);return {x:b.center.x,z:b.center.z,y:b.min.y,onDeck};};
 // Sorts a deck's contents: the slab, corridors (which fade with the floors), cabins and rooms.
 function sortDeck(deck){
  const deckPart=parts.find(part=>part.object===deck);
  for(const o of deck.children){
   if(registered.has(o)||PLACEHOLDERS.test(o.name)&&!o.visible)continue;
   if(o.name==='Deck_slab'){add(o,'slab');slabs.push(o);continue;}
   if(CORRIDORS.test(o.name)){registered.add(o);floors.push(o);continue;}
   const residence=[...ship.residentialDecks.values()].find(r=>r.root===o);
   if(residence){registered.add(o);sortResidence(residence,deckPart);continue;}
   add(o,'room',{...roomProps(o,true),group:roomGroup(o),info:roomInfo(o),box:new T.Box3().setFromObject(o),deckPart});
  }
 }
 function sortResidence(residence,deckPart){
  residences.push({deckPart,neighborhood:residence.number,y:deckPart.y});
  for(const o of residence.root.children)if(o!==residence.district)add(o,'room',{x:SAMPLE.x,z:SAMPLE.z,onDeck:true,group:'homes'});// the furnished sample cabin
  for(const o of residence.district.children){
   if(o.isInstancedMesh&&o.count===CABIN_ORDER.length){
    const base=new Float32Array(o.count*3);for(let i=0;i<o.count;i++)for(let k=0;k<3;k++)base[i*3+k]=o.instanceMatrix.array[i*16+12+k];
    cabins.push({mesh:o,base});
   }else if(o!==residence.districtWalls)floors.push(o);// corridor floors, inlays and fittings
  }
 }
 decks.forEach(sortDeck);
 const transitDecks=new Set(transit.decks.values());
 for(const child of inside.children){
  if(decks.includes(child)||child.name==='Lift_and_transit_reservations')continue;// superseded by the transit cores
  if(child===transit.root){
   // The cores stay put while the rooms scatter around them: shafts stretch with the stack, landings rise with decks.
   for(const o of transit.root.children){if(transitDecks.has(o))continue;if(o===transit.structure||o===transit.shell)stretched.push({object:o,base:o.position.clone(),scale:o.scale.y});else add(o,'deck',{y:bounds(o).min.y});}
   for(const [number,g] of transit.decks)add(g,'deck',{y:FLOOR+(number-1)*PITCH});
   continue;
  }
  if(child===aft.root){
   for(const [key,group] of Object.entries(aft.parts)){
    if(key==='crown')continue;// the exterior crown carries the bar; the layout view leaves this copy hidden too
    for(const o of [...group.children]){
     let b=bounds(o);if(b.min.x===Infinity)continue;
     // Merged finish meshes that reach both pods split so each half follows its own pod.
     if(key!=='fin'&&o.isMesh&&b.min.z<-85&&b.max.z>85){const twin=splitAcross(o);if(twin){add(twin,key==='pods'?'pod':'wing',{side:1,group:'engineering'});b=bounds(o);}}
     if(key==='fin')add(o,'fin');
     else if(Math.abs(b.center.z)>85)add(o,key==='pods'?'pod':'wing',{side:Math.sign(b.center.z),group:'engineering'});// pod machinery rises out of its pod
     else add(o,'room',{x:b.center.x,z:b.center.z,y:b.min.y,group:'engineering'});
    }
   }
   continue;
  }
  // The gardens and observation lounge: each garden scatters on its own.
  for(const o of child===ship.shared?child.children:[child])if(o.visible||child!==ship.shared){const b=bounds(o);if(b.min.x!==Infinity)add(o,'room',{x:b.center.x,z:b.center.z,y:b.min.y,group:roomGroup(o),info:roomInfo(o),box:new T.Box3(b.min,b.max)});}
 }
 // Tinting: each room's meshes get tinted copies of their materials (one copy per material and room group, so the
 // shader programs are shared), whose colour moves from the original toward the group colour.
 const targets=Object.fromEntries(ROOM_GROUPS.map(g=>[g.key,new T.Color(g.color)])),copies=new Map(),swapped=new Map();let tint=0,swapPending=true;
 function tintCopy(m,group){
  if(!m?.color||m.transparent)return m;// glass and fades keep their own look
  const key=m.uuid+group;let c=copies.get(key);if(!c){c=m.clone();c.userData={tintFrom:m,tintTo:targets[group]};copies.set(key,c);}return c;
 }
 function setTint(t){
  if(t>0&&swapPending){
   swapPending=false;
   const tinted=[...parts.filter(part=>part.group).map(part=>[part.object,part.group]),...cabins.map(c=>[c.mesh,'homes'])];
   for(const [object,group] of tinted)object.traverse(o=>{if(!o.isMesh||swapped.has(o))return;swapped.set(o,o.material);o.material=Array.isArray(o.material)?o.material.map(m=>tintCopy(m,group)):tintCopy(o.material,group);});
  }
  if(t===0&&swapped.size){for(const [o,m] of swapped)o.material=m;swapped.clear();swapPending=true;}
  if(t!==tint){tint=t;for(const c of copies.values())c.color.copy(c.userData.tintFrom.color).lerp(c.userData.tintTo,TINT*t);}
 }
 const move=new T.Vector3(),slabMaterial=slabs[0]?.material,cabinScatter=new Float32Array(CABIN_ORDER.length);let applied=-1,scattered=-1,floorsShown=true;
 // A faint outline of the assembled hull stays in place while the ship is apart, so the parts keep their reference.
 // The main hull, wing, pod, tail and crown surfaces (outline matches their names) are merged into one see-through
 // mesh: a single draw, positions only.
 const GHOST_OPACITY=.07,ghostMaterial=new T.MeshBasicMaterial({color:0x9fbcd0,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
 let ghost=null;
 if(outline){
  const shapes=[];
  exterior.traverse(o=>{if(!o.isMesh||!outline.test(o.name)||!o.geometry.attributes.position)return;const g=new T.BufferGeometry();g.setAttribute('position',o.geometry.attributes.position.clone());if(o.geometry.index)g.setIndex(o.geometry.index.clone());shapes.push(g.applyMatrix4(o.matrixWorld).toNonIndexed());});
  const merged=shapes.length&&mergeGeometries(shapes);shapes.forEach(g=>g.dispose());
  if(merged){ghost=new T.Mesh(merged,ghostMaterial);ghost.name='Explode_hull_outline';ghost.visible=false;ghost.castShadow=ghost.receiveShadow=false;ghost.frustumCulled=false;ship.root.add(ghost);}// not culled: always in view while shown, and measuring it would visit every vertex of the hull
 }
 function apply(p){
  applied=p;
  for(const part of parts)part.object.position.copy(part.base).add(offset(part,p,move));
  const k=stretch(p);for(const s of stretched){s.object.scale.y=s.scale*k;s.object.position.y=s.base.y*k+FLOOR*(1-k)+lifted(p);}
  // Floors fade out, then the slabs and corridors go, leaving the rooms standing on their own floors.
  const fade=ease(p,STAGES.floors);
  if(slabMaterial){const transparent=fade>0&&fade<1;if(slabMaterial.transparent!==transparent){slabMaterial.transparent=transparent;slabMaterial.needsUpdate=true;}slabMaterial.opacity=1-fade;}
  for(const s of slabs)s.visible=fade<1;
  if(floorsShown!==fade<.5){floorsShown=fade<.5;for(const o of floors)o.visible=floorsShown;}
  setTint(ease(p,STAGES.tint));
  const s=Math.min(Math.max(p,STAGES.rooms[0]),STAGES.rooms[1]);// the scatter only changes within its stage
  if(s!==scattered){
   scattered=s;for(let i=0;i<CABIN_ORDER.length;i++){const c=CABIN_ORDER[i];cabinScatter[i]=scatterAt(c.x,c.z,p);}
   for(const {mesh,base} of cabins){
    const a=mesh.instanceMatrix.array;
    for(let i=0;i<mesh.count;i++){const c=CABIN_ORDER[i],k=cabinScatter[i];a[i*16+12]=base[i*3]+(c.x-MID_X)*k;a[i*16+14]=base[i*3+2]+c.z*k;}
    mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=p<=STAGES.rooms[0];// the cached bounds no longer hold once scattered
   }
  }
  if(ghost){ghost.visible=p>0;ghostMaterial.opacity=GHOST_OPACITY*ease(p,[0,.3]);}
 }
 // Detail culling. With every deck built there are about 44,000 meshes, most of them furniture and fittings well under
 // a pixel at exploded distances, and each costs a draw call. Meshes smaller than minRadius hide; the list is sorted by
 // size so a change only touches the meshes between the old and new limits. setDetail(0) shows them all again.
 // Corridor meshes are left to the floor fade, and cabin floors always show (one instanced draw per deck), so the
 // 5,000 cabins still read as tiles when the rest of their furniture is too small to draw.
 const detail=[],known=new Set([...floors.filter(o=>o.isMesh),...cabins.map(c=>c.mesh).filter(o=>o.name==='Repeated_Cabin_24m2_floor')]),scale=new T.Vector3();let hidden=0,limit=0;
 function setDetail(minRadius){
  let lo=0,hi=detail.length;while(lo<hi){const m=(lo+hi)>>1;if(detail[m].radius<minRadius)lo=m+1;else hi=m;}
  for(let i=hidden;i<lo;i++)detail[i].mesh.visible=false;for(let i=lo;i<hidden;i++)detail[i].mesh.visible=true;hidden=lo;limit=minRadius;
 }
 function refreshDetail(){
  const keep=limit;setDetail(0);
  inside.traverse(o=>{if(!o.isMesh||!o.visible||known.has(o))return;known.add(o);const g=o.geometry;if(!g.boundingSphere)g.computeBoundingSphere();o.getWorldScale(scale);detail.push({mesh:o,radius:g.boundingSphere.radius*Math.max(scale.x,scale.y,scale.z)});});
  detail.sort((a,b)=>a.radius-b.radius);setDetail(keep);
 }
 refreshDetail();
 // Only the parts move. Everything inside them keeps its local matrix, so three.js need not recompose ~25,000 of them
 // every frame while the dial turns; their world matrices still follow their part.
 function settle(){
  const moving=new Set([...parts.map(part=>part.object),...stretched.map(s=>s.object)]);
  inside.traverse(o=>{if(o===inside||!o.matrixAutoUpdate||moving.has(o))return;o.updateMatrix();o.matrixAutoUpdate=false;});
 }
 settle();
 // Fitted areas built since: sort them into the explode at its current amount, then into the detail culling.
 function refresh(){
  const p=Math.max(applied,0);apply(0);inside.updateWorldMatrix(false,true);decks.forEach(sortDeck);swapPending=true;apply(p);refreshDetail();settle();
 }
 // Picking for the room labels: rays test each room's box where it is now, and each cabin's 4.4 x 3.6 x 6.4 m
 // envelope, rather than the rooms' thousands of meshes.
 const ray=new T.Ray(),hit=new T.Vector3(),probe=new T.Box3(),delta=new T.Vector3();
 function shift(part){delta.copy(part.object.position).sub(part.base);if(part.deckPart)delta.add(part.deckPart.object.position).sub(part.deckPart.base);return delta;}
 function pick(origin,direction){
  ray.set(origin,direction);let best=null,nearest=Infinity;
  for(const part of parts){
   if(!part.info||!part.object.visible)continue;
   probe.copy(part.box).translate(shift(part));if(!ray.intersectBox(probe,hit))continue;
   const d=hit.distanceTo(origin);if(d<nearest){nearest=d;best={info:part.info,group:part.group,box:probe.clone()};}
  }
  for(const r of residences){
   const y=r.y+r.deckPart.object.position.y-r.deckPart.base.y;
   for(let i=0;i<=CABIN_ORDER.length;i++){
    const sample=i===CABIN_ORDER.length,c=sample?SAMPLE:CABIN_ORDER[i],k=sample?scatterAt(c.x,c.z,applied):cabinScatter[i],x=c.x+(c.x-MID_X)*k,z=c.z+c.z*k;
    probe.min.set(x-2.2,y,z-3.2);probe.max.set(x+2.2,y+3.6,z+3.2);if(!ray.intersectBox(probe,hit))continue;
    const d=hit.distanceTo(origin);if(d<nearest){nearest=d;best={info:{type:'cabin',neighborhood:r.neighborhood,id:c.id.replace(/^N10/,'N'+String(r.neighborhood).padStart(2,'0')),deck:r.neighborhood+5},group:'homes',box:probe.clone()};}
   }
  }
  return best;
 }
 // The bounding sphere the camera frames: the assembled ship, growing as it comes apart and again as the rooms
 // scatter. `tilt` (0 to 1) raises the camera as it does, to look down into the decks.
 const frame=p=>{const s=ease(p,[0,.7]),r=ease(p,STAGES.rooms);return {center:new T.Vector3(-18,41,0).lerp(new T.Vector3(110,85,0),s).add(new T.Vector3(-150*r,10*r,0)),radius:380+340*s+190*r,tilt:s};};
 // Call-outs for the exploded ship: the deck bands at the bow end of the stack, and the larger exterior parts. Where
 // they would overlap on screen, the earlier ones in this list are kept.
 const deckAt=(deck,x)=>p=>new T.Vector3(x+(x-MID_X)*scatterAt(x,0,p),FLOOR+(deck-1)*PITCH+2+rise(FLOOR+(deck-1)*PITCH,p),0);
 const labels=[
  {text:'5,000 cabins',detail:'Decks 6–15',at:deckAt(11,225)},
  {text:'Gardens',detail:'Decks 17–19',at:deckAt(18,160)},
  {text:'Command',detail:'Deck 20',at:deckAt(20,150)},
  {text:'Pressure hull',detail:'564 m',at:p=>new T.Vector3(40,30,83).add(offset({kind:'hull',side:1},p,move))},
  {text:'Wing & engine pod',detail:'300 m span',at:p=>new T.Vector3(-215,-2,135).add(offset({kind:'wing',side:1},p,move))},
  {text:'Pod machinery',detail:'Two drive chambers',at:p=>new T.Vector3(-230,0,126).add(offset({kind:'pod',side:1},p,move))},
  // On the crown's starboard face, at mid-height, moving with the crown as it lifts off the fin.
  {text:'Fin crown bar',detail:'66 windows',at:p=>new T.Vector3((crownBox.min.x+crownBox.max.x)/2,(crownBox.min.y+crownBox.max.y)/2,crownBox.max.z).add(offset({kind:'crown'},p,move))},
  {text:'Cargo & shuttles',detail:'Decks 1–2',at:deckAt(1,225)},
  {text:'Farms & medical',detail:'Decks 3–5',at:deckAt(4,235)},
  {text:'Recreation',detail:'Deck 16',at:deckAt(16,200)},
 ];
 return {apply,setDetail,refresh,frame,labels:labels.filter(l=>crownBox||l.text!=='Fin crown bar'),added,pick};
}

export function explodeStage(p){
 return p<=0?'Assembled':p<.28?'Opening the hull':p<.3?'Hull open':p<.67?'Lifting the decks':p<.7?'All twenty decks apart':p<1?'Separating every room':'Every room, to scale';
}
