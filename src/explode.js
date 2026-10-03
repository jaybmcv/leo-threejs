import * as T from 'three';
import {CABINS,SAMPLE} from './model.js';

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
export const STAGES={hull:[0,.28],wing:[.2,.46],pods:[.3,.52],fin:[.14,.42],crown:[.3,.56],decks:[.14,.68],floors:[.68,.82],rooms:[.7,1]};
const ease=(p,[a,b])=>{const t=Math.min(1,Math.max(0,(p-a)/(b-a)));return t*t*(3-2*t);};
// Parts inside the ship rise with the deck they stand on; the deck stack stretches about the Deck 1 floor.
const deckIndex=y=>Math.max(0,Math.round((y-FLOOR)/PITCH));
const stretch=p=>1+DECK_SPREAD/PITCH*ease(p,STAGES.decks),lifted=p=>LIFT*ease(p,STAGES.decks);

// kind: hull/wing/pod (side ±1), fin, crown, aftcap, nose, roof (rises with the stack), deck (rises, never scatters),
// slab, and room (rises with its deck unless it is already a deck's child, and scatters from x, z).
function offset({kind,side=0,y=0,x=MID_X,z=0,onDeck=false},p,out){
 const decks=ease(p,STAGES.decks),parted=ease(p,STAGES.hull),fin=ease(p,STAGES.fin),rise=(LIFT+deckIndex(y)*DECK_SPREAD)*decks;
 if(kind==='hull')return out.set(0,-HULL_DOWN*parted,side*HULL_OUT*parted);
 if(kind==='wing'||kind==='pod')return out.set(0,-HULL_DOWN*parted+(kind==='pod'?POD_UP*ease(p,STAGES.pods):0),side*(HULL_OUT*parted+WING_OUT*ease(p,STAGES.wing)));
 if(kind==='fin')return out.set(-FIN_BACK*fin,FIN_UP*fin,0);
 if(kind==='crown')return out.set(-FIN_BACK*fin,FIN_UP*fin+CROWN_UP*ease(p,STAGES.crown),0);
 if(kind==='aftcap')return out.set(-CAP_OUT*fin,rise,0);
 if(kind==='nose')return out.set(CAP_OUT*fin,rise,0);
 if(kind==='slab')return out.set(0,p>0?-SLAB_DROP:0,0);
 if(kind==='room'){const k=SCATTER*ease(p,STAGES.rooms);return out.set((x-MID_X)*k,onDeck?0:rise,z*k);}
 return out.set(0,rise,0);// deck, roof
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

// The repeated cabins are instanced, one InstancedMesh per cabin part with instance i in the cabin CABIN_ORDER[i]
// (model.js createNeighborhood), so scattering them moves each instance's translation.
const CABIN_ORDER=CABINS.filter(c=>c.neighborhood===10&&c.id!==SAMPLE.id);
const CORRIDORS=/(_connected_service_corridors|_special_area_connections)$/,PLACEHOLDERS=/(_space_reservations|_twin_cabin_envelopes|^Primary_corridors)$/;

// `ship` is the viewer's ship (model.js createShip) with its residential decks, gardens, observation lounge, transit
// cores and aft systems built. Fitted areas built later join with refresh().
export function createExplode({ship,transit,aft,thrusters}){
 const {exterior,inside,decks}=ship;
 exterior.updateMatrixWorld(true);inside.updateMatrixWorld(true);
 const parts=[],stretched=[],added=[],floors=[],slabs=[],cabins=[],registered=new Set();
 const add=(object,kind,props={})=>{registered.add(object);parts.push({object,base:object.position.clone(),kind,...props});};
 for(const group of exterior.children){
  if(group.name==='Fin_panorama_lounge'){add(group,'crown');continue;}
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
  for(const o of deck.children){
   if(registered.has(o)||PLACEHOLDERS.test(o.name)&&!o.visible)continue;
   if(o.name==='Deck_slab'){add(o,'slab');slabs.push(o);continue;}
   if(CORRIDORS.test(o.name)){registered.add(o);floors.push(o);continue;}
   const residence=[...ship.residentialDecks.values()].find(r=>r.root===o);
   if(residence){registered.add(o);sortResidence(residence);continue;}
   add(o,'room',roomProps(o,true));
  }
 }
 function sortResidence(residence){
  for(const o of residence.root.children)if(o!==residence.district)add(o,'room',{x:SAMPLE.x,z:SAMPLE.z,onDeck:true});// the furnished sample cabin
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
     if(key!=='fin'&&o.isMesh&&b.min.z<-85&&b.max.z>85){const twin=splitAcross(o);if(twin){add(twin,key==='pods'?'pod':'wing',{side:1});b=bounds(o);}}
     if(key==='fin')add(o,'fin');
     else if(Math.abs(b.center.z)>85)add(o,key==='pods'?'pod':'wing',{side:Math.sign(b.center.z)});// pod machinery rises out of its pod
     else add(o,'room',{x:b.center.x,z:b.center.z,y:b.min.y});
    }
   }
   continue;
  }
  // The gardens and observation lounge: each garden scatters on its own.
  for(const o of child===ship.shared?child.children:[child])if(o.visible||child!==ship.shared){const b=bounds(o);if(b.min.x!==Infinity)add(o,'room',{x:b.center.x,z:b.center.z,y:b.min.y});}
 }
 const move=new T.Vector3(),slabMaterial=slabs[0]?.material;let applied=-1,scattered=0,floorsShown=true;
 function apply(p){
  applied=p;
  for(const part of parts)part.object.position.copy(part.base).add(offset(part,p,move));
  const k=stretch(p);for(const s of stretched){s.object.scale.y=s.scale*k;s.object.position.y=s.base.y*k+FLOOR*(1-k)+lifted(p);}
  // Floors fade out, then the slabs and corridors go, leaving the rooms standing on their own floors.
  const fade=ease(p,STAGES.floors);
  if(slabMaterial){const transparent=fade>0&&fade<1;if(slabMaterial.transparent!==transparent){slabMaterial.transparent=transparent;slabMaterial.needsUpdate=true;}slabMaterial.opacity=1-fade;}
  for(const s of slabs)s.visible=fade<1;
  if(floorsShown!==fade<.5){floorsShown=fade<.5;for(const o of floors)o.visible=floorsShown;}
  const s=SCATTER*ease(p,STAGES.rooms);
  if(s!==scattered){
   scattered=s;
   for(const {mesh,base} of cabins){
    const a=mesh.instanceMatrix.array;
    for(let i=0;i<mesh.count;i++){const c=CABIN_ORDER[i];a[i*16+12]=base[i*3]+(c.x-MID_X)*s;a[i*16+14]=base[i*3+2]+c.z*s;}
    mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=s===0;// the cached bounds no longer hold once scattered
   }
  }
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
 // Fitted areas built since: sort them into the explode at its current amount, then into the detail culling.
 function refresh(){
  const p=Math.max(applied,0);apply(0);inside.updateMatrixWorld(true);decks.forEach(sortDeck);apply(p);refreshDetail();
 }
 // The bounding sphere the camera frames: the assembled ship, growing as it comes apart and again as the rooms
 // scatter. `tilt` (0 to 1) raises the camera as it does, to look down into the decks.
 const frame=p=>{const s=ease(p,[0,.7]),r=ease(p,STAGES.rooms);return {center:new T.Vector3(-18,41,0).lerp(new T.Vector3(110,85,0),s).add(new T.Vector3(40*r,10*r,0)),radius:380+340*s+190*r,tilt:s};};
 // Call-outs for the exploded ship: the deck bands at the bow end of the stack, and the larger exterior parts. Where
 // they would overlap on screen, the earlier ones in this list are kept.
 const deckAt=(deck,x)=>p=>new T.Vector3(x+(x-MID_X)*SCATTER*ease(p,STAGES.rooms),FLOOR+(deck-1)*PITCH+2+(LIFT+(deck-1)*DECK_SPREAD)*ease(p,STAGES.decks),0);
 const labels=[
  {text:'5,000 cabins',detail:'Decks 6–15',at:deckAt(11,225)},
  {text:'Gardens',detail:'Decks 17–19',at:deckAt(18,160)},
  {text:'Command',detail:'Deck 20',at:deckAt(20,150)},
  {text:'Pressure hull',detail:'564 m',at:p=>new T.Vector3(40,30,83).add(offset({kind:'hull',side:1},p,move))},
  {text:'Wing & engine pod',detail:'300 m span',at:p=>new T.Vector3(-215,-2,135).add(offset({kind:'wing',side:1},p,move))},
  {text:'Pod machinery',detail:'Two drive chambers',at:p=>new T.Vector3(-230,0,126).add(offset({kind:'pod',side:1},p,move))},
  {text:'Fin & crown bar',detail:'66 windows',at:p=>new T.Vector3(-205,70,6).add(offset({kind:'fin'},p,move))},
  {text:'Cargo & shuttles',detail:'Decks 1–2',at:deckAt(1,225)},
  {text:'Farms & medical',detail:'Decks 3–5',at:deckAt(4,235)},
  {text:'Recreation',detail:'Deck 16',at:deckAt(16,200)},
 ];
 return {apply,setDetail,refresh,frame,labels,added};
}

export function explodeStage(p){
 return p<=0?'Assembled':p<.2?'Opening the hull':p<.45?'Lifting the decks':p<.7?'Spreading every part':p<1?'Separating every room':'Every room, to scale';
}
