import * as T from 'three';
import {DECKS} from '../model.js';
import {TRANSIT_CORES,floorY} from '../transit.js';

// Wayfinding for walk mode, in the visitor theme's colours and type: a deck plaque beside every lift landing, a stairs
// sign over every stair landing, and by each lift's call light a display showing where the car is. Signs are canvas
// textures on thin panels, mounted on whatever wall a ray from the lobby finds, so they sit flush on any lift or stair.
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
