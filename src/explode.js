import * as T from 'three';

// Exploded view. Turning the dial parts the hull halves (each carrying its wing and engine pod), lifts the fin and its
// crown bar away aft, and spreads the twenty decks apart so the cabins, rooms, gardens and machinery inside show at
// full scale. Each part keeps its assembled position, so apply(0) puts the ship back exactly.
export const DECK_SPREAD=16;// extra metres between neighbouring decks at full explode (decks are 4 m apart)
const FLOOR=-40,PITCH=4;// Deck 1 floor and the deck pitch, as in model.js
// The hull halves drop as they part (the public view has no floor), so they stay clear of the decks rising between them.
const HULL_OUT=150,HULL_DOWN=110,WING_OUT=110,LIFT=40,FIN_BACK=200,FIN_UP=90,CROWN_UP=60,CAP_OUT=60;
// Each movement runs over its own stretch of the dial, so the ship comes apart in order.
const STAGES={hull:[0,.4],wing:[.3,.65],fin:[.2,.6],crown:[.45,.8],decks:[.2,1]};
const ease=(p,[a,b])=>{const t=Math.min(1,Math.max(0,(p-a)/(b-a)));return t*t*(3-2*t);};
// Parts inside the ship rise with the deck they stand on; the deck stack stretches about the Deck 1 floor.
const deckIndex=y=>Math.max(0,Math.round((y-FLOOR)/PITCH));
const stretch=p=>1+DECK_SPREAD/PITCH*ease(p,STAGES.decks),lifted=p=>LIFT*ease(p,STAGES.decks);

function offset({kind,side,y},p,out){
 const decks=ease(p,STAGES.decks),parted=ease(p,STAGES.hull),fin=ease(p,STAGES.fin),rise=(LIFT+deckIndex(y)*DECK_SPREAD)*decks;
 if(kind==='hull')return out.set(0,-HULL_DOWN*parted,side*HULL_OUT*parted);
 if(kind==='wing')return out.set(0,-HULL_DOWN*parted,side*(HULL_OUT*parted+WING_OUT*ease(p,STAGES.wing)));
 if(kind==='fin')return out.set(-FIN_BACK*fin,FIN_UP*fin,0);
 if(kind==='crown')return out.set(-FIN_BACK*fin,FIN_UP*fin+CROWN_UP*ease(p,STAGES.crown),0);
 if(kind==='aftcap')return out.set(-CAP_OUT*fin,rise,0);
 if(kind==='nose')return out.set(CAP_OUT*fin,rise,0);
 return out.set(0,rise,0);// inside, and the dorsal sensors riding above the stack
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

// `inside` is the interior layout (ship.inside), with the transit cores and aft systems built. Rooms added to a deck
// later move with it; call refreshDetail() so they join the detail culling.
export function createExplode({exterior,inside,decks,transit,aft,thrusters}){
 exterior.updateMatrixWorld(true);inside.updateMatrixWorld(true);
 const parts=[],stretched=[],added=[];
 const add=(object,kind,side=0,y=0)=>parts.push({object,base:object.position.clone(),kind,side,y});
 for(const group of exterior.children){
  if(group.name==='Fin_panorama_lounge'){add(group,'crown');continue;}
  for(const part of [...group.children]){
   const kind=exteriorKind(group,part);let b=bounds(part);
   if((kind==='hull'||kind==='wing')&&b.min.z<-10&&b.max.z>10&&part.isMesh){const twin=splitAcross(part);if(twin){added.push(twin);add(twin,kind,1);b=bounds(part);}}
   add(part,kind,group.name==='Port_shell'?-1:group.name==='Starboard_shell'?1:Math.sign(b.center.z),b.min.y);
  }
 }
 // The plumes and their lights follow the pods and the aft service doors.
 if(thrusters)for(const o of thrusters.root.children)add(o,Math.abs(o.position.z)>95?'wing':'aftcap',Math.sign(o.position.z),o.position.y);
 decks.forEach((deck,i)=>add(deck,'inside',0,FLOOR+i*PITCH));
 const transitDecks=new Set(transit.decks.values());
 for(const child of inside.children){
  if(decks.includes(child)||child.name==='Lift_and_transit_reservations')continue;// superseded by the transit cores
  if(child===transit.root){
   for(const o of transit.root.children){if(transitDecks.has(o))continue;if(o===transit.structure||o===transit.shell)stretched.push({object:o,base:o.position.clone(),scale:o.scale.y});else add(o,'inside',0,bounds(o).min.y);}
   for(const [number,g] of transit.decks)add(g,'inside',0,FLOOR+(number-1)*PITCH);
   continue;
  }
  if(child===aft.root){
   for(const [key,group] of Object.entries(aft.parts)){
    if(key==='crown')continue;// the exterior crown carries the bar; the layout view leaves this copy hidden too
    for(const o of group.children){const b=bounds(o);if(b.min.x===Infinity)continue;add(o,key==='fin'?'fin':Math.abs(b.center.z)>85?'wing':'inside',Math.sign(b.center.z),b.min.y);}
   }
   continue;
  }
  const b=bounds(child);if(b.min.x!==Infinity)add(child,'inside',0,b.min.y);
 }
 const move=new T.Vector3();
 function apply(p){
  for(const part of parts)part.object.position.copy(part.base).add(offset(part,p,move));
  const k=stretch(p);for(const s of stretched){s.object.scale.y=s.scale*k;s.object.position.y=s.base.y*k+FLOOR*(1-k)+lifted(p);}
 }
 // Detail culling. With every deck built there are about 44,000 meshes, most of them furniture and fittings well under
 // a pixel at exploded distances, and each costs a draw call. Meshes smaller than minRadius hide; the list is sorted by
 // size so a change only touches the meshes between the old and new limits. setDetail(0) shows them all again.
 // Rooms built after this (refreshDetail) join the list.
 const detail=[],known=new Set(),scale=new T.Vector3();let hidden=0,limit=0;
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
 // The bounding sphere the camera frames: the assembled ship, growing as it comes apart. `tilt` (0 to 1) raises the
 // camera as it does, to look down into the decks.
 const frame=p=>{const s=ease(p,[0,1]);return {center:new T.Vector3(-18,41,0).lerp(new T.Vector3(110,85,0),s),radius:380+340*s,tilt:s};};
 // Call-outs for the exploded ship: the deck bands at the bow end of the stack, and the larger exterior parts. Where
 // they would overlap on screen, the earlier ones in this list are kept.
 const deckAt=(deck,x)=>p=>new T.Vector3(x,FLOOR+(deck-1)*PITCH+2+(LIFT+(deck-1)*DECK_SPREAD)*ease(p,STAGES.decks),0);
 const labels=[
  {text:'5,000 cabins',detail:'Decks 6–15',at:deckAt(11,225)},
  {text:'Gardens',detail:'Decks 17–19',at:deckAt(18,160)},
  {text:'Command',detail:'Deck 20',at:deckAt(20,150)},
  {text:'Pressure hull',detail:'564 m',at:p=>new T.Vector3(40,30,83).add(offset({kind:'hull',side:1},p,move))},
  {text:'Wing & engine pod',detail:'300 m span',at:p=>new T.Vector3(-215,-2,135).add(offset({kind:'wing',side:1},p,move))},
  {text:'Fin & crown bar',detail:'66 windows',at:p=>new T.Vector3(-205,70,6).add(offset({kind:'fin'},p,move))},
  {text:'Cargo & shuttles',detail:'Decks 1–2',at:deckAt(1,225)},
  {text:'Farms & medical',detail:'Decks 3–5',at:deckAt(4,235)},
  {text:'Recreation',detail:'Deck 16',at:deckAt(16,200)},
 ];
 return {apply,setDetail,refreshDetail,frame,labels,added};
}

export function explodeStage(p){
 return p<=0?'Assembled':p<.3?'Opening the hull':p<.65?'Lifting the decks':p<1?'Spreading every part':'Every part, to scale';
}
