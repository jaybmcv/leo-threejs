import * as T from 'three';
import {deckOf} from './minimap.js';

// Pings: a visitor presses P and everyone aboard sees a marker where they stood, with their name, how far it is and
// how many decks up or down, for MARK_S seconds. It is drawn over everything, walls included, so others can find
// the way to it; off screen or behind, it waits at the edge of the view on the side to turn to. One mark per visitor.
const MARK_S=20,EDGE_X=.9,EDGE_Y=.82;

export class Marks{
 constructor(layer){this.layer=layer;this.marks=new Map();this.v=new T.Vector3();}
 show(id,name,at,now=performance.now()){
  let m=this.marks.get(id);
  if(!m){m={el:document.createElement('div')};m.el.className='ping-mark';m.el.append(document.createElement('b'),document.createElement('span'));this.layer.appendChild(m.el);this.marks.set(id,m);}
  Object.assign(m,{at:new T.Vector3(...at),until:now+MARK_S*1000});m.el.firstChild.textContent=name;
  // Fresh again: the pulse replays.
  m.el.classList.remove('fresh');void m.el.offsetWidth;m.el.classList.add('fresh');
 }
 clear(){for(const m of this.marks.values())m.el.remove();this.marks.clear();}
 update(camera,eye,now=performance.now()){
  if(!this.marks.size)return;
  const rect=this.layer.getBoundingClientRect(),here=deckOf(eye.y)?.number;
  for(const [id,m] of this.marks){
   if(now>m.until){m.el.remove();this.marks.delete(id);continue;}
   const v=this.v.copy(m.at).applyMatrix4(camera.matrixWorldInverse),behind=v.z>0;
   v.copy(m.at).project(camera);let x=v.x,y=v.y;
   // Behind the camera the projection mirrors: turn it back, then out to the edge.
   if(behind){x=-x;y=-y;const s=Math.max(Math.abs(x),Math.abs(y))||1;x/=s;y/=s;}
   const out=Math.max(Math.abs(x)/EDGE_X,Math.abs(y)/EDGE_Y);
   const edge=behind||out>1;if(out>1){x/=out;y/=out;}
   const deck=deckOf(m.at.y)?.number,up=here&&deck?deck-here:0;
   m.el.lastChild.textContent=`${Math.round(eye.distanceTo(m.at))} m${up?` · ${Math.abs(up)} deck${Math.abs(up)>1?'s':''} ${up>0?'up':'down'}`:''}`;
   m.el.classList.toggle('edge',edge);
   m.el.style.transform=`translate(${(x+1)/2*rect.width}px,${(1-y)/2*rect.height}px) translate(-50%,-100%)`;
  }
 }
}
