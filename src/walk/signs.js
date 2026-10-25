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
// A deck's headline room, named on its lift landings' plaques (in gold, in place of the deck's theme) and stair signs.
export const FEATURED={16:'Mudwater Arena'};const GOLD='#d8cf8f';
const drawn=[];

function canvasTexture(width,height,draw){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const paint=()=>{const c=canvas.getContext('2d');c.clearRect(0,0,width,height);draw(c,width,height);texture.needsUpdate=true;};
 paint();drawn.push(paint);return {texture,paint};
}
// The brand fonts may still be loading when the first signs are painted; paint them again once they're in.
document.fonts?.ready.then(()=>{for(const paint of drawn)paint();});

// Every sign is a screen: dark glass with faint scanlines, a lit teal bezel inside its edge, and wording that glows a little.
function panel(c,w,h,fill=PANEL){
 const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,fill);g.addColorStop(1,'#060b0e');c.fillStyle=g;c.beginPath();c.roundRect(0,0,w,h,18);c.fill();
 c.fillStyle='rgba(47,214,197,.06)';for(let y=3;y<h;y+=4)c.fillRect(6,y,w-12,1);
 c.save();c.strokeStyle='rgba(47,214,197,.75)';c.lineWidth=3;c.shadowColor=TEAL;c.shadowBlur=10;c.beginPath();c.roundRect(6,6,w-12,h-12,12);c.stroke();c.restore();
 c.shadowColor='rgba(47,214,197,.6)';c.shadowBlur=8;
}
function fit(c,text,font,size,max){let s=size;do{c.font=font.replace('SIZE',s+'px');s-=2;}while(c.measureText(text).width>max&&s>10);}

// Deck plaque: "DECK", the number, the deck's name. Fin stops get their own wording.
function plaqueLabel(stop){
 if(stop.deck)return {eyebrow:'Deck',big:String(stop.deck),name:FEATURED[stop.deck]||deckName(stop.deck),featured:!!FEATURED[stop.deck]};
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
  c.fillStyle=l.featured?GOLD:DIM;fit(c,l.name,`${l.featured?600:400} SIZE ${FONT.sans}`,24,w-36);c.fillText(l.name,w/2,286);
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
  if(FEATURED[deck]){const x=100+c.measureText(`DECK ${deck}`).width+30;c.fillStyle=GOLD;fit(c,FEATURED[deck].toUpperCase(),`600 SIZE ${FONT.mono}`,24,w-x-16);c.fillText(FEATURED[deck].toUpperCase(),x,124);}
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
 c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=c.shadowColor=color;c.beginPath();
 c.moveTo(size,0);c.lineTo(0,-size*.8);c.lineTo(0,-size*.32);c.lineTo(-size,-size*.32);c.lineTo(-size,size*.32);c.lineTo(0,size*.32);c.lineTo(0,size*.8);c.closePath();c.fill();c.restore();
}
// Small icons beside each cell's wording, centred on (x,y) in a box `s` across, by room kind.
const ICON_KIND={dining:'dining',kitchen:'dining',ward:'medical',clinic:'medical',surgery:'medical',imaging:'medical',pharmacy:'medical',
 counseling:'medical',isolation:'medical',farm:'garden',nursery:'garden',harvest:'garden',cargo:'cargo',stores:'cargo',logistics:'cargo',
 cold:'cold',arrival:'luggage',baggage:'luggage',airlock:'airlock',security:'shield',shelter:'shield',workshop:'gear',air:'gear',
 thermal:'gear',recycle:'gear',control:'gear',power:'power',water:'water',arena:'cards',library:'book',theater:'screen',
 childcare:'star',gym:'gym',recreation:'ball',community:'people'};
function icon(c,name,x,y,s,color){
 const u=s/2;c.save();c.translate(x,y);c.strokeStyle=c.fillStyle=color;c.lineWidth=Math.max(3,s*.11);c.lineCap=c.lineJoin='round';
 const path=p=>{c.beginPath();c.moveTo(p[0]*u,p[1]*u);for(let i=2;i<p.length;i+=2)c.lineTo(p[i]*u,p[i+1]*u);};
 const line=(...p)=>{path(p);c.stroke();},fill=(...p)=>{path(p);c.closePath();c.fill();};
 const ring=(cx,cy,r,solid)=>{c.beginPath();c.arc(cx*u,cy*u,r*u,0,Math.PI*2);solid?c.fill():c.stroke();};
 const box=(x0,y0,w,h,r=.15)=>{c.beginPath();c.roundRect(x0*u,y0*u,w*u,h*u,r*u);c.stroke();};
 const star=(n,outer,inner)=>{c.beginPath();for(let i=0;i<n*2;i++){const a=-Math.PI/2+i*Math.PI/n,r=(i%2?inner:outer)*u;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();};
 switch(name){
  case 'lift':box(-.62,-.9,1.24,1.8);fill(0,-.62,.32,-.14,-.32,-.14);fill(0,.62,.32,.14,-.32,.14);break;
  case 'stairs':line(-.9,.8,-.45,.8,-.45,.3,0,.3,0,-.2,.45,-.2,.45,-.7,.9,-.7);break;
  case 'dining':line(-.5,-.85,-.5,.85);line(-.78,-.85,-.78,-.35,-.22,-.35,-.22,-.85);
   c.beginPath();c.moveTo(.45*u,.85*u);c.lineTo(.45*u,-.85*u);c.quadraticCurveTo(.9*u,-.4*u,.45*u,.05*u);c.stroke();break;
  case 'medical':fill(-.25,-.85,.25,-.85,.25,-.25,.85,-.25,.85,.25,.25,.25,.25,.85,-.25,.85,-.25,.25,-.85,.25,-.85,-.25,-.25,-.25);break;
  case 'garden':c.beginPath();c.moveTo(-.7*u,.7*u);c.quadraticCurveTo(-.8*u,-.8*u,.8*u,-.8*u);c.quadraticCurveTo(.7*u,.6*u,-.7*u,.7*u);c.stroke();line(-.85,.85,.2,-.2);break;
  case 'cargo':box(-.85,-.6,1.7,1.4,.08);line(-.85,-.15,.85,-.15);line(-.2,-.6,-.2,-.15);line(.2,-.6,.2,-.15);break;
  case 'cold':for(let i=0;i<3;i++){const a=i*Math.PI/3,dx=Math.cos(a)*.9,dy=Math.sin(a)*.9;line(-dx,-dy,dx,dy);}break;
  case 'luggage':box(-.85,-.4,1.7,1.25);line(-.35,-.4,-.35,-.8,.35,-.8,.35,-.4);break;
  case 'airlock':ring(0,0,.85);ring(0,0,.4);line(-.4,0,.4,0);break;
  case 'shield':c.beginPath();c.moveTo(0,-.9*u);c.lineTo(.75*u,-.6*u);c.quadraticCurveTo(.75*u,.5*u,0,.9*u);c.quadraticCurveTo(-.75*u,.5*u,-.75*u,-.6*u);c.closePath();c.stroke();break;
  case 'gear':star(8,.92,.66);c.globalCompositeOperation='destination-out';ring(0,0,.3,true);c.globalCompositeOperation='source-over';break;
  case 'power':fill(.2,-.95,-.6,.1,-.05,.1,-.2,.95,.6,-.1,.05,-.1);break;
  case 'water':c.beginPath();c.moveTo(0,-.9*u);c.quadraticCurveTo(.7*u,-.05*u,.6*u,.35*u);c.arc(0,.35*u,.6*u,0,Math.PI);c.quadraticCurveTo(-.7*u,-.05*u,0,-.9*u);c.fill();break;
  case 'cards':for(const [dx,a] of [[-.28,-.28],[.28,.28]]){c.save();c.translate(dx*u,.05*u);c.rotate(a);c.beginPath();c.roundRect(-.38*u,-.62*u,.76*u,1.24*u,.1*u);c.stroke();c.restore();}break;
  case 'book':line(0,-.55,0,.75);line(0,-.55,-.85,-.75,-.85,.55,0,.75,.85,.55,.85,-.75,0,-.55);break;
  case 'screen':box(-.9,-.7,1.8,1.3);fill(-.25,-.38,-.25,.28,.32,-.05);break;
  case 'star':star(5,.95,.4);break;
  case 'gym':line(-.6,0,.6,0);line(-.6,-.55,-.6,.55);line(.6,-.55,.6,.55);line(-.88,-.3,-.88,.3);line(.88,-.3,.88,.3);break;
  case 'ball':ring(0,0,.85);c.beginPath();c.arc(-1.2*u,0,1.05*u,-.75,.75);c.stroke();c.beginPath();c.arc(1.2*u,0,1.05*u,Math.PI-.75,Math.PI+.75);c.stroke();break;
  case 'people':for(const dx of [-.42,.42]){ring(dx,-.4,.26,true);c.beginPath();c.arc(dx*u,.75*u,.42*u,Math.PI,0);c.fill();}break;
 }
 c.restore();
}
// A cell's wording: one line if it fits at a readable size, otherwise split into two.
function label(c,text,x,y,max){
 fit(c,text,`600 SIZE ${FONT.display}`,30,max);
 if(parseInt(/(\d+)px/.exec(c.font)[1])>=22||!text.includes(' ')){c.fillText(text,x,y);return;}
 const words=text.split(' '),halves=i=>[words.slice(0,i).join(' '),words.slice(i).join(' ')];let best=1;
 for(let i=2;i<words.length;i++){const [a,b]=halves(i),[p,q]=halves(best);if(Math.abs(a.length-b.length)<Math.abs(p.length-q.length))best=i;}
 const [a,b]=halves(best);fit(c,a.length>b.length?a:b,`600 SIZE ${FONT.display}`,25,max);c.fillText(a,x,y-13);c.fillText(b,x,y+14);
}
// Signs with the same wording share one material. A cell reads its arrow, its icons, then its wording, in from the
// sign's edge; the cell ahead fills the middle third.
const ICON=34,GAP=8;
const directions=new Map();
function directionMaterial(cells){
 const key=JSON.stringify(cells);let m=directions.get(key);if(m)return m;
 const {texture}=canvasTexture(768,96,(c,w,h)=>{
  panel(c,w,h,INK);c.textBaseline='middle';const third=w/3,y=h/2+2;
  c.fillStyle='rgba(255,255,255,.16)';for(const x of [third,2*third])c.fillRect(x-1,14,2,h-28);
  const [left,ahead,right]=cells,icons=cell=>cell.icons||[];
  if(left){arrow(c,30,y,Math.PI,15,left.color);let x=56;
   for(const i of icons(left)){icon(c,i,x+ICON/2,y,ICON,left.color);x+=ICON+GAP;}
   c.fillStyle=TEXT;c.textAlign='left';label(c,left.text,x+4,y,third-x-18);}
  if(ahead){c.textAlign='center';
   if(ahead.arrow){let x=third+18;arrow(c,x+14,y,-Math.PI/2,15,ahead.color);x+=40;
    for(const i of icons(ahead)){icon(c,i,x+ICON/2,y,ICON,ahead.color);x+=ICON+GAP;}
    c.fillStyle=TEXT;label(c,ahead.text,(x+2*third-14)/2,y,2*third-14-x);}
   else{c.fillStyle=DIM;c.font=`500 26px ${FONT.mono}`;c.letterSpacing='5px';c.fillText(ahead.text,third*1.5,y);c.letterSpacing='0px';}}
  if(right){arrow(c,w-30,y,0,15,right.color);let x=w-56;
   for(const i of icons(right)){icon(c,i,x-ICON/2,y,ICON,right.color);x-=ICON+GAP;}
   c.fillStyle=TEXT;c.textAlign='right';label(c,right.text,x-4,y,x-2*third-18);}
 });
 m=new T.MeshBasicMaterial({map:texture,toneMapped:false});directions.set(key,m);return m;
}
const signBody=new T.MeshBasicMaterial({color:INK}),signGlow=new T.MeshBasicMaterial({color:TEAL,toneMapped:false}),rodGeometry=new T.CylinderGeometry(.015,.015,1,6);
// A screen hung from the ceiling `ceiling` metres above `at`, readable from `facing`; `back` is the wording on its other side.
function hang(parent,material,back,at,facing,width,ceiling){
 const h=width/8,g=new T.Group();g.name='Walk_corridor_sign';g.position.copy(at);g.lookAt(at.clone().add(facing));
 const body=new T.Mesh(new T.BoxGeometry(width,h,.05),signBody);g.add(body);
 const face=new T.Mesh(new T.PlaneGeometry(width,h),material);face.position.z=.026;g.add(face);
 const rear=new T.Mesh(face.geometry,back);rear.position.z=-.026;rear.rotation.y=Math.PI;g.add(rear);
 // A lit strip under the screen.
 const glow=new T.Mesh(new T.BoxGeometry(width-.1,.014,.03),signGlow);glow.position.y=-h/2-.007;g.add(glow);
 const drop=ceiling-h/2;for(const s of [-1,1]){const rod=new T.Mesh(rodGeometry,signBody);rod.scale.y=drop;rod.position.set(s*width*.4,h/2+drop/2,0);g.add(rod);}
 parent.add(g);return g;
}
// The lift cells show lift and stairs icons: each core holds both.
const LIFTS={fore:'Forward lifts',aft:'Aft lifts'},CORE=['lift','stairs'];
export function corridorSigns(parent){
 const area=id=>SHIP_AREAS.find(a=>a.id===id),roomName=id=>area(id)?.name||'';
 const lifts=TEAL,rooms=ORANGE,height=2.8,ceiling=3.3-height;
 for(let deck=1;deck<=20;deck++){
  const plan=serviceRoutes(deck);if(!plan)continue;
  const {x0:spineStart}=plan.spine,cores=TRANSIT_CORES.filter(c=>deck<=c.lastDeck);
  const coreAhead=(x,d)=>cores.some(c=>(c.x-x)*d>0)?{text:LIFTS[d>0?'fore':'aft'],color:lifts,icons:CORE,arrow:true}:null;
  const tag={text:`DECK ${deck}`};
  for(const b of plan.branches){
   const port=b.entries.filter(e=>e.z<0),starboard=b.entries.filter(e=>e.z>0);
   // A room cell's icon follows its first room's kind.
   const cell=list=>{if(!list.length)return null;const i=ICON_KIND[area(list[0].id)?.kind];
    return {text:list.map(e=>roomName(e.id)).join(' · '),color:rooms,...(i&&{icons:[i]})};};
   // Over the spine, one sign for each way along it. Facing the nose, port is to the left. The back reads for a walker
   // heading the other way.
   const cells=(x,d)=>d>0?[cell(port),coreAhead(x,d),cell(starboard)]:[cell(starboard),coreAhead(x,d),cell(port)];
   for(const d of [1,-1]){
    const x=d>0?b.x0-2:b.x1+2;if(x<spineStart)continue;
    hang(parent,directionMaterial(cells(x,d)),directionMaterial(cells(x,-d)),new T.Vector3(x,plan.y+height,0),new T.Vector3(-d,0,0),5.6,ceiling);
   }
   // In each side corridor, facing a walker on the way back to the spine. From the starboard side, aft is to the left;
   // the back, seen on the way out, reads the other way round.
   const aft=cores.some(c=>c.id==='aft')?{text:LIFTS.aft,color:lifts,icons:CORE}:null,fore=cores.some(c=>c.id==='forward')?{text:LIFTS.fore,color:lifts,icons:CORE}:null;
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
