import {DECKS} from '../model.js';
import {floorY} from '../transit.js';
import {SHIP_AREAS} from '../areas.js';
import {MAP,MAP_CLASS} from './deck-map.js';

// The ship map on the page. The image (scripts/walk-plan.mjs) holds every deck's plan as a band of class values; each
// deck is coloured into a canvas of its own the first time it shows. The mini-map turns with the camera, centred on
// the walker; the full map lays one deck out bow to the right, with its rooms named and the Go to places marked.
const COLOURS={[MAP_CLASS.empty]:[0,0,0,0],[MAP_CLASS.floor]:[201,206,199,235],[MAP_CLASS.raised]:[146,170,186,240],[MAP_CLASS.wall]:[58,63,72,255],[MAP_CLASS.rail]:[248,88,0,255],[MAP_CLASS.lift]:[47,214,197,255]};
// The deck whose floor the walker is on or above (up to the next); none in the fin and the crown.
export const deckOf=y=>{if(y>floorY(20)+8)return null;let best=DECKS[0];for(const d of DECKS)if(y>=floorY(d.number)-1.2)best=d;return best;};

export class ShipMap{
 constructor(url){
  this.decks=new Map();this.image=new Image();this.image.decoding='async';
  this.ready=new Promise((resolve,reject)=>{this.image.onload=resolve;this.image.onerror=()=>reject(new Error('The ship map could not load'));});
  this.image.src=url;
 }
 // The coloured plan of deck `number`, or null while the image loads.
 deck(number){
  if(!this.image.complete||!this.image.naturalWidth)return null;
  let c=this.decks.get(number);if(c)return c;
  c=document.createElement('canvas');c.width=MAP.nx;c.height=MAP.nz;const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(this.image,0,(number-1)*MAP.nz,MAP.nx,MAP.nz,0,0,MAP.nx,MAP.nz);
  const px=g.getImageData(0,0,MAP.nx,MAP.nz),d=px.data;
  for(let i=0;i<d.length;i+=4){const col=COLOURS[Math.round(d[i]/50)]||COLOURS[0];d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];d[i+3]=col[3];}
  g.putImageData(px,0,0);this.decks.set(number,c);return c;
 }
}

// Map position (pixels of the deck canvas) of a world point.
const toMap=(x,z)=>[(x-MAP.x0)/MAP.cell,(z-MAP.z0)/MAP.cell];
// The walker's marker: an arrow pointing up, centred on the origin.
function arrow(g,size,line){g.fillStyle='#f85800';g.strokeStyle='#050507';g.lineWidth=line;g.beginPath();g.moveTo(0,-size);g.lineTo(size*.7,size*.7);g.lineTo(0,size*.3);g.lineTo(-size*.7,size*.7);g.closePath();g.fill();g.stroke();}

// The corner mini-map, heading-up around the walker (yaw 0 looks along +z). Returns the deck shown.
export function drawMiniMap(canvas,map,{x,y,z,yaw,places=[]}){
 const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height,dpr=w/(canvas.clientWidth||w);
 g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);
 const deck=deckOf(y),plan=deck&&map.deck(deck.number);
 if(plan){
  // 3.2 screen px a metre: about 25 m either side.
  const scale=3.2*dpr*MAP.cell,[mx,mz]=toMap(x,z);
  g.save();g.translate(w/2,h/2);g.rotate(-Math.PI/2-Math.atan2(Math.cos(yaw),Math.sin(yaw)));g.scale(scale,scale);g.imageSmoothingEnabled=false;
  g.drawImage(plan,-mx,-mz);
  g.fillStyle='#f4f0e8';
  for(const p of places){if(deckOf(p.at[1])!==deck)continue;const [px,pz]=toMap(p.at[0],p.at[2]);g.beginPath();g.arc(px-mx,pz-mz,3*dpr/scale,0,Math.PI*2);g.fill();}
  g.restore();
 }
 g.save();g.translate(w/2,h/2);arrow(g,7*dpr,1.5*dpr);g.restore();
 return deck;
}

// The full map of one deck, fitted to `canvas`, bow to the right. Returns the places drawn, with where (CSS px).
export function drawFullMap(canvas,map,number,{walker,places=[]}){
 const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height,dpr=w/(canvas.clientWidth||w),plan=map.deck(number);
 g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);if(!plan)return [];
 // Fit the deck's drawn extent (the grid is wider than any one deck).
 const box=extent(plan),pad=10,scale=Math.min(w/(box.x1-box.x0+2*pad),h/(box.z1-box.z0+2*pad));
 const ox=(w-(box.x1-box.x0)*scale)/2-box.x0*scale,oz=(h-(box.z1-box.z0)*scale)/2-box.z0*scale;
 g.imageSmoothingEnabled=scale<1.5;g.drawImage(plan,ox,oz,MAP.nx*scale,MAP.nz*scale);
 const at=(x,z)=>{const [mx,mz]=toMap(x,z);return [ox+mx*scale,oz+mz*scale];};
 // Room names, where a room is big enough on screen to hold one.
 g.textAlign='center';g.textBaseline='middle';
 const y=floorY(number),here=places.filter(p=>deckOf(p.at[1])?.number===number);
 // (A room with a place marker in it is named by the marker.)
 for(const a of SHIP_AREAS){if(Math.abs(a.center[1]-y)>2.2||a.kind==='lifeboats')continue;
  if(here.some(p=>Math.abs(p.at[0]-a.center[0])<=a.width/2&&Math.abs(p.at[2]-a.center[2])<=a.depth/2))continue;const [cx,cz]=at(a.center[0],a.center[2]),size=Math.min(a.width,a.depth)/MAP.cell*scale;if(size<26*dpr)continue;
  const px=Math.round(Math.min(12,size/7)*dpr);g.font=`500 ${px}px "Sora",sans-serif`;g.fillStyle='rgba(20,24,30,.78)';wrap(g,a.name,cx,cz,a.width/MAP.cell*scale*.85,px*1.15);}
 const shown=[];
 for(const p of here){const [px,pz]=at(p.at[0],p.at[2]);
  g.fillStyle='#2fd6c5';g.strokeStyle='#050507';g.lineWidth=2*dpr;g.beginPath();g.arc(px,pz,6*dpr,0,Math.PI*2);g.fill();g.stroke();
  g.font=`500 ${11*dpr}px "JetBrains Mono",monospace`;g.fillStyle='#f4f0e8';g.strokeStyle='rgba(5,5,7,.9)';g.lineWidth=3*dpr;g.strokeText(p.name,px,pz-14*dpr);g.fillText(p.name,px,pz-14*dpr);
  shown.push({place:p,x:px/dpr,y:pz/dpr});}
 if(walker&&deckOf(walker.y)?.number===number){const [px,pz]=at(walker.x,walker.z);g.save();g.translate(px,pz);g.rotate(Math.atan2(Math.cos(walker.yaw),Math.sin(walker.yaw))+Math.PI/2);arrow(g,9*dpr,2*dpr);g.restore();}
 return shown;
}
const extents=new WeakMap();
function extent(plan){
 let e=extents.get(plan);if(e)return e;
 const d=plan.getContext('2d').getImageData(0,0,plan.width,plan.height).data;e={x0:plan.width,x1:0,z0:plan.height,z1:0};
 for(let j=0;j<plan.height;j++)for(let i=0;i<plan.width;i++)if(d[(j*plan.width+i)*4+3]){if(i<e.x0)e.x0=i;if(i>e.x1)e.x1=i;if(j<e.z0)e.z0=j;if(j>e.z1)e.z1=j;}
 if(e.x1<e.x0)e={x0:0,x1:plan.width,z0:0,z1:plan.height};
 extents.set(plan,e);return e;
}
function wrap(g,text,x,y,width,lineHeight){
 const lines=[];let line='';for(const word of text.split(' ')){const next=line?line+' '+word:word;if(line&&g.measureText(next).width>width){lines.push(line);line=word;}else line=next;}lines.push(line);
 lines.forEach((l,i)=>g.fillText(l,x,y+(i-(lines.length-1)/2)*lineHeight));
}
