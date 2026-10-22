import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {DECKS} from '../model.js';
import {TRANSIT_CORES,floorY} from '../transit.js';
import {SHIP_AREAS} from '../areas.js';
import {serviceRoutes} from '../service-circulation.js';

// Wayfinding for walk mode, in the visitor theme's colours and type: a deck plaque beside every lift landing, a stairs
// sign over every stair landing, and by each lift's call light a display showing where the car is. Signs are canvas
// textures on thin panels; overhead signs at the service corridors' junctions point to the rooms and the lifts, mounted on whatever wall a ray from the lobby finds, so they sit flush on any lift or stair.
const INK='#0d1419',PANEL='#1b2830',TEXT='#f4f0e8',DIM='#a6b4bb',ORANGE='#f85800',TEAL='#2fd6c5';
const FONT={display:'"Archivo", "Sora", sans-serif',mono:'"JetBrains Mono", ui-monospace, monospace',sans:'"Sora", sans-serif'};
const deckName=n=>DECKS.find(d=>d.number===n)?.name||'';
const drawn=[];

function canvasTexture(width,height,draw){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const paint=()=>{const c=canvas.getContext('2d');c.clearRect(0,0,width,height);draw(c,width,height);texture.needsUpdate=true;};
 paint();drawn.push(paint);return {texture,paint};
}
// The brand fonts may still be loading when the first signs are painted; paint them again once they're in.
document.fonts?.ready.then(()=>{for(const paint of drawn)paint();});

function panel(c,w,h,fill=PANEL){c.fillStyle=fill;c.beginPath();c.roundRect(0,0,w,h,18);c.fill();c.strokeStyle='rgba(255,255,255,.14)';c.lineWidth=4;c.stroke();}
function fit(c,text,font,size,max){let s=size;do{c.font=font.replace('SIZE',s+'px');s-=2;}while(c.measureText(text).width>max&&s>10);}

// Deck plaque: "DECK", the number, the deck's name. Fin stops get their own wording.
function plaqueLabel(stop){
 if(stop.deck)return {eyebrow:'Deck',big:String(stop.deck),name:deckName(stop.deck)};
 const fin=/^Fin platform (\d+)/.exec(stop.label);if(fin)return {eyebrow:'Fin',big:fin[1],name:'Inspection platform'};
 if(/Crown/.test(stop.label))return {eyebrow:'Crown',big:'C',name:'Panoramic lounge'};
 return {eyebrow:'Fin',big:'G',name:stop.label};
}
const plaques=new Map();
function plaqueMaterial(stop){
 const l=plaqueLabel(stop),key=l.eyebrow+l.big;let m=plaques.get(key);if(m)return m;
 const {texture}=canvasTexture(256,320,(c,w,h)=>{
  panel(c,w,h);c.textAlign='center';c.textBaseline='alphabetic';
  c.fillStyle=TEAL;c.font=`500 26px ${FONT.mono}`;c.letterSpacing='6px';c.fillText(l.eyebrow.toUpperCase(),w/2,62);c.letterSpacing='0px';
  c.fillStyle=TEXT;fit(c,l.big,`600 SIZE ${FONT.display}`,170,w-40);c.fillText(l.big,w/2,214);
  c.fillStyle=ORANGE;c.fillRect(w/2-28,238,56,5);
  c.fillStyle=DIM;fit(c,l.name,`400 SIZE ${FONT.sans}`,24,w-36);c.fillText(l.name,w/2,286);
 });
 m=new T.MeshBasicMaterial({map:texture,toneMapped:false});plaques.set(key,m);return m;
}
const stairsDecks=new Map();
function stairsSign(deck){
 let m=stairsDecks.get(deck);if(m)return m;
 const {texture}=canvasTexture(512,160,(c,w,h)=>{
  panel(c,w,h);c.textBaseline='middle';
  // Up and down arrows.
  c.fillStyle=ORANGE;for(const [y,s] of [[56,-1],[104,1]]){c.beginPath();c.moveTo(42,y+s*-18);c.lineTo(66,y+s*6);c.lineTo(18,y+s*6);c.closePath();c.fill();}
  c.fillStyle=TEXT;c.textAlign='left';c.font=`600 64px ${FONT.display}`;c.fillText('Stairs',96,72);
  c.fillStyle=DIM;c.font=`400 26px ${FONT.mono}`;c.letterSpacing='3px';c.fillText(`DECK ${deck}`,100,124);c.letterSpacing='0px';
 });
 m=new T.MeshBasicMaterial({map:texture,toneMapped:false});stairsDecks.set(deck,m);return m;
}

// The display by a lift's call light, one canvas per lift shared by all its landings: the stop the car is at or passing,
// and an arrow while it moves.
export function liftDisplay(){
 let state='';
 const t=canvasTexture(256,96,(c,w,h)=>{
  panel(c,w,h,INK);const [label,dir]=state.split('|');c.textBaseline='middle';
  c.fillStyle=ORANGE;c.textAlign='center';c.font=`600 58px ${FONT.mono}`;c.fillText(label||'',w/2+14,h/2+3);
  if(dir){c.fillStyle=TEAL;const s=dir==='up'?-1:1,y=h/2;c.beginPath();c.moveTo(48,y+s*20);c.lineTo(68,y-s*10);c.lineTo(28,y-s*10);c.closePath();c.fill();}
 });
 const material=new T.MeshBasicMaterial({map:t.texture,toneMapped:false});
 return {material,show(label,dir){const next=`${label}|${dir||''}`;if(next!==state){state=next;t.paint();}}};
}
// Short name of a stop for the display: the deck number, or the fin stop's letter and number.
export function stopShort(stop){if(stop.deck)return String(stop.deck);const fin=/^Fin platform (\d+)/.exec(stop.label);return fin?'F'+fin[1]:/Crown/.test(stop.label)?'CR':'G';}

// The wall a ray from `from` along `dir` meets within `reach` metres, if it faces back along the ray.
const ray=new T.Ray();
function wallAt(colliders,from,dir,reach){
 ray.origin.copy(from);ray.direction.copy(dir).normalize();
 const hit=colliders.raycast(ray,reach);
 return hit&&hit.normal.dot(ray.direction)<-.9?hit:null;
}
function mount(parent,material,[w,h],hit){
 const o=new T.Mesh(new T.PlaneGeometry(w,h),material);o.name='Walk_sign';
 o.position.copy(hit.point).addScaledVector(hit.normal,.015);o.lookAt(o.position.clone().add(hit.normal));
 parent.add(o);return o;
}

// A spot on the wall beside a lift landing's doors: `base` is the door line's centre on the floor, `front` points into
// the lobby, `along` across the doors; `side` is which side (the call panel's is +1), `out` how far from the doors' edge.
function besideDoors(colliders,{base,front,along,width},side,out,height){
 const at=base.clone().addScaledVector(along,side*(width/2+out)).addScaledVector(front,1.2).setY(base.y+height);
 return wallAt(colliders,at,front.clone().negate(),1.6);
}
// The deck plaque, on the side away from the call panel.
export function landingSigns(parent,colliders,stop,landing){
 const hit=besideDoors(colliders,landing,-1,.45,1.6)||besideDoors(colliders,landing,1,.45,1.6);
 if(hit)mount(parent,plaqueMaterial(stop),[.42,.525],hit);
}
// The call light: a ring with up and down marks, lit orange from the call until the car arrives.
const lights={};
function lightMaterial(on){
 const key=on?'on':'off';if(lights[key])return lights[key];
 const {texture}=canvasTexture(128,128,(c,w,h)=>{
  c.fillStyle=INK;c.beginPath();c.arc(w/2,h/2,62,0,Math.PI*2);c.fill();
  c.strokeStyle=on?ORANGE:'rgba(244,240,232,.55)';c.lineWidth=7;c.beginPath();c.arc(w/2,h/2,52,0,Math.PI*2);c.stroke();
  if(on){c.fillStyle=ORANGE;c.beginPath();c.arc(w/2,h/2,44,0,Math.PI*2);c.fill();}
  c.fillStyle=on?INK:TEXT;for(const s of [-1,1]){const y=h/2+s*17;c.beginPath();c.moveTo(w/2,y+s*12);c.lineTo(w/2+15,y-s*8);c.lineTo(w/2-15,y-s*8);c.closePath();c.fill();}
 });
 return lights[key]=new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.5,toneMapped:false});
}
export function callLight(parent,colliders,landing){
 const hit=besideDoors(colliders,landing,1,.25,1.3);if(!hit)return null;
 const o=mount(parent,lightMaterial(false),[.14,.14],hit);o.position.addScaledVector(hit.normal,.01);
 return {lit(on){o.material=lightMaterial(on);}};
}
// The car's display, over the call light.
export function liftDisplayMount(parent,colliders,material,landing){
 const hit=besideDoors(colliders,landing,1,.36,1.95);
 if(hit)mount(parent,material,[.44,.165],hit);
}

// A sign over every stair landing of the two main cores, on the wall facing the way in.
export function stairSigns(parent,colliders){
 for(const c of TRANSIT_CORES)for(const s of [-1,1])for(let deck=1;deck<=c.lastDeck;deck++){
  const y=floorY(deck),at=new T.Vector3(c.stairX-3.5,y+2.85,s*(c.stairZ-1.5));
  const hit=wallAt(colliders,at,new T.Vector3(0,0,s),6);
  if(hit)mount(parent,stairsSign(deck),[1.5,.47],hit);
 }
}

// Overhead direction signs in the service corridors (service-circulation.js): over the spine before each side corridor,
// its rooms to the left and right and the lifts ahead; in each side corridor near the spine, the lifts either way.
// Each sign reads left, ahead, right, as the walker faces it.
function arrow(c,x,y,angle,size,color){
 c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();
 c.moveTo(size,0);c.lineTo(0,-size*.8);c.lineTo(0,-size*.32);c.lineTo(-size,-size*.32);c.lineTo(-size,size*.32);c.lineTo(0,size*.32);c.lineTo(0,size*.8);c.closePath();c.fill();c.restore();
}
// Signs with the same wording share one material.
const directions=new Map();
function directionMaterial(cells){
 const key=JSON.stringify(cells);let m=directions.get(key);if(m)return m;
 const {texture}=canvasTexture(768,96,(c,w,h)=>{
  panel(c,w,h,INK);c.textBaseline='middle';const third=w/3,y=h/2+2;
  c.fillStyle='rgba(255,255,255,.16)';for(const x of [third,2*third])c.fillRect(x-1,14,2,h-28);
  const [left,ahead,right]=cells;
  if(left){arrow(c,34,y,Math.PI,16,left.color);c.fillStyle=TEXT;c.textAlign='left';fit(c,left.text,`600 SIZE ${FONT.display}`,30,third-80);c.fillText(left.text,62,y);}
  if(ahead){c.textAlign='center';
   if(ahead.arrow){arrow(c,third+30,y,-Math.PI/2,16,ahead.color);c.fillStyle=TEXT;fit(c,ahead.text,`600 SIZE ${FONT.display}`,30,third-80);c.fillText(ahead.text,third*1.5+14,y);}
   else{c.fillStyle=DIM;c.font=`500 26px ${FONT.mono}`;c.letterSpacing='5px';c.fillText(ahead.text,third*1.5,y);c.letterSpacing='0px';}}
  if(right){arrow(c,w-34,y,0,16,right.color);c.fillStyle=TEXT;c.textAlign='right';fit(c,right.text,`600 SIZE ${FONT.display}`,30,third-80);c.fillText(right.text,w-62,y);}
 });
 m=new T.MeshBasicMaterial({map:texture,toneMapped:false});directions.set(key,m);return m;
}
const signBody=new T.MeshBasicMaterial({color:INK}),rodGeometry=new T.CylinderGeometry(.015,.015,1,6);
// A sign hung from the ceiling `ceiling` metres above `at`, readable from `facing`; `back` is the wording on its other side.
function hang(parent,material,back,at,facing,width,ceiling){
 const h=width/8,g=new T.Group();g.name='Walk_corridor_sign';g.position.copy(at);g.lookAt(at.clone().add(facing));
 const body=new T.Mesh(new T.BoxGeometry(width,h,.05),signBody);g.add(body);
 const face=new T.Mesh(new T.PlaneGeometry(width,h),material);face.position.z=.026;g.add(face);
 const rear=new T.Mesh(face.geometry,back);rear.position.z=-.026;rear.rotation.y=Math.PI;g.add(rear);
 const drop=ceiling-h/2;for(const s of [-1,1]){const rod=new T.Mesh(rodGeometry,signBody);rod.scale.y=drop;rod.position.set(s*width*.4,h/2+drop/2,0);g.add(rod);}
 parent.add(g);return g;
}
const LIFTS={fore:'Forward lifts',aft:'Aft lifts'};
export function corridorSigns(parent){
 const roomName=id=>SHIP_AREAS.find(a=>a.id===id)?.name||'';
 const lifts=TEAL,rooms=ORANGE,height=2.8,ceiling=3.3-height;
 for(let deck=1;deck<=20;deck++){
  const plan=serviceRoutes(deck);if(!plan)continue;
  const {x0:spineStart}=plan.spine,cores=TRANSIT_CORES.filter(c=>deck<=c.lastDeck);
  const coreAhead=(x,d)=>cores.some(c=>(c.x-x)*d>0)?{text:LIFTS[d>0?'fore':'aft'],color:lifts,arrow:true}:null;
  const tag={text:`DECK ${deck}`};
  for(const b of plan.branches){
   const port=b.entries.filter(e=>e.z<0).map(e=>roomName(e.id)).join(' · '),starboard=b.entries.filter(e=>e.z>0).map(e=>roomName(e.id)).join(' · ');
   const cell=text=>text?{text,color:rooms}:null;
   // Over the spine, one sign for each way along it. Facing the nose, port is to the left. The back reads for a walker
   // heading the other way.
   const cells=(x,d)=>d>0?[cell(port),coreAhead(x,d),cell(starboard)]:[cell(starboard),coreAhead(x,d),cell(port)];
   for(const d of [1,-1]){
    const x=d>0?b.x0-2:b.x1+2;if(x<spineStart)continue;
    hang(parent,directionMaterial(cells(x,d)),directionMaterial(cells(x,-d)),new T.Vector3(x,plan.y+height,0),new T.Vector3(-d,0,0),5.6,ceiling);
   }
   // In each side corridor, facing a walker on the way back to the spine. From the starboard side, aft is to the left;
   // the back, seen on the way out, reads the other way round.
   const aft=cores.some(c=>c.id==='aft')?{text:LIFTS.aft,color:lifts}:null,fore=cores.some(c=>c.id==='forward')?{text:LIFTS.fore,color:lifts}:null;
   for(const s of [-1,1])hang(parent,directionMaterial(s>0?[aft,tag,fore]:[fore,tag,aft]),directionMaterial(s>0?[fore,tag,aft]:[aft,tag,fore]),
    new T.Vector3((b.x0+b.x1)/2,plan.y+height,s*6),new T.Vector3(0,0,s),5,ceiling);
  }
 }
}

// Lit guide lines on the service corridors' floors, in the signs' colours: teal down the spine between the lift lobbies,
// with a bar to each pair of lift doors, and orange from the spine down each side corridor to every room's door, ending in
// an arrow. One mesh per colour per deck, a hair above the floor and the entry thresholds.
const guideMaterial=color=>new T.MeshStandardMaterial({name:'Walk_floor_guide',color,emissive:color,emissiveIntensity:.35,roughness:.6});
function strip(x0,z0,x1,z1,width=.12){
 const g=new T.PlaneGeometry(Math.hypot(x1-x0,z1-z0)+width,width);g.rotateX(-Math.PI/2);g.rotateY(-Math.atan2(z1-z0,x1-x0));g.translate((x0+x1)/2,0,(z0+z1)/2);return g;
}
function head(x,z,angle,size=.32){
 const g=new T.ShapeGeometry(new T.Shape([new T.Vector2(size,0),new T.Vector2(-size*.4,size*.75),new T.Vector2(-size*.4,-size*.75)]));
 g.rotateX(-Math.PI/2);g.rotateY(-angle);g.translate(x,0,z);return g;
}
export function floorGuides(parent){
 const lifts=guideMaterial(TEAL),rooms=guideMaterial(ORANGE),lift=.03;
 for(let deck=1;deck<=20;deck++){
  const plan=serviceRoutes(deck);if(!plan)continue;
  const xs=TRANSIT_CORES.filter(c=>deck<=c.lastDeck).map(c=>c.x),teal=[],orange=[];
  const mid=plan.branches.map(b=>(b.x0+b.x1)/2),xa=Math.min(...xs,...mid),xb=Math.max(...xs,...mid);
  teal.push(strip(xa,0,xb,0));
  for(const x of xs)for(const s of [-1,1])teal.push(strip(x,0,x,s*3.2),head(x,s*3.45,s*Math.PI/2));
  for(const b of plan.branches){
   const bx=(b.x0+b.x1)/2;
   for(const e of b.entries){
    const s=Math.sign(e.z);orange.push(strip(bx,s*.35,bx,e.z),strip(bx,e.z,b.x1-.55,e.z),head(b.x1-.3,e.z,0));
   }
  }
  for(const [list,material] of [[teal,lifts],[orange,rooms]]){
   const o=new T.Mesh(mergeGeometries(list),material);o.name='Walk_floor_guide';o.position.y=plan.y+lift;o.receiveShadow=true;
   list.forEach(g=>g.dispose());parent.add(o);
  }
 }
}
