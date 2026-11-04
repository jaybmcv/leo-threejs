import * as T from 'three';
import {toWorld,yawToWorld} from '../plan/rooms.js';

// A short walk around the arrival hall. Points are clear approaches to existing features.
const ROOM='d02-arrival-1',GUIDE=[-16,0,-3];
export const ARRIVAL_TOUR=[
 {at:[-18,0,-2],title:'Welcome aboard Leo',text:'Explore the Mars Cats Voyage ship as Cosmo. Walk to each marker at your own pace, or skip whenever you like.',keys:'WASD or arrows to walk; drag to look. H opens Help.',touch:'Use the left joystick to walk and drag on the right to look. Help explains the controls.'},
 {at:[-23,0,13],title:'Push the yarn ball',text:'The pink yarn ball starts in this corner. Walk into it to push it around. If it has rolled away, carry on to the next stop.',keys:'Hold Shift to run. Scroll to zoom; V changes the camera view.',touch:'Push the joystick to its edge to run. View changes the camera.'},
 {at:[-12.5,0,6.5],title:'Take a seat',text:'The round planters have seats facing out. Approach a cushion until the use prompt says Sit down.',keys:'E sits down; E again stands up.',touch:'Tap the orange Sit down button; tap Stand up to leave.'},
 {at:[-6.3,0,2.2],title:'Climb to the garden',text:'Follow the paw prints to the cat tree. Its platforms lead to Hydroponic garden A above. Climbing is optional for this tour.',keys:'Space jumps. Hold for height; press again in the air to double jump.',touch:'Hold Jump for height; tap again in the air to double jump.'},
 {at:[-11.5,0,13.8],title:'Find your next stop',text:'The ship log on this wall records changes aboard. Go to lists destinations across the ship; you can replay Arrival tour there too.',keys:'E reads the board; L opens the log anywhere. M opens Go to; N opens the ship map.',touch:'Use reads the board. Log opens it anywhere; Go to lists destinations. Tap the mini-map for the ship map.'},
];
const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};

export function createArrivalTour(kit){
 const group=kit.figure();group.name='Arrival_welcome_guide';
 group.position.set(...toWorld(ROOM,GUIDE));group.rotation.y=yawToWorld(ROOM,Math.PI/2);
 const stops=ARRIVAL_TOUR.map(s=>({...s,point:new T.Vector3(...toWorld(ROOM,s.at))}));
 const count=el('div',{className:'eyebrow'}),title=el('h2',{id:'arrival-tour-title'}),text=el('p'),controls=el('p',{className:'tour-controls'}),distance=el('p',{className:'tour-distance'});
 const back=el('button',{type:'button',textContent:'Back'}),next=el('button',{type:'button'}),skip=el('button',{type:'button',textContent:'Skip tour'});
 const card=el('section',{id:'arrival-tour',hidden:true},count,title,text,controls,distance,el('div',{className:'tour-buttons'},back,next,skip));
 card.setAttribute('aria-labelledby',title.id);count.setAttribute('aria-live','polite');
 // Enter and Space on these buttons must not also trigger the walk's Use and Jump actions.
 card.addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='Space')e.stopPropagation();});
 document.body.append(card);
 const label=el('b',{textContent:'Welcome guide'}),tag=el('div',{className:'ping-mark tour-guide-tag',hidden:true},label,el('span',{textContent:'E / Use · Arrival tour'}));
 const marker=el('div',{className:'ping-mark tour-waypoint',hidden:true},el('b'),el('span'));
 document.getElementById('names').append(tag,marker);
 let mode='offer',index=0,shown=false,wanted=false;
 function render(){
  const active=mode==='tour',done=mode==='done',s=stops[index];
  count.textContent=active?`Arrival tour · ${index+1} / ${stops.length}`:'Arrival tour · 5 stops';
  title.textContent=active?s.title:done?'Ready to explore':'Welcome aboard Leo';
  text.textContent=active?s.text:done?'Keep exploring at your own pace. Go to can take you to named places throughout the ship.':'Leo is the Mars Cats Voyage ship. You explore it on foot as Cosmo, with rooms, gardens and games to discover. Want a short tour of this hall?';
  controls.textContent=active?(matchMedia('(pointer:coarse)').matches?s.touch:s.keys):done?'Replay this tour from Go to → Arrival tour, or return to the welcome guide.':'Walk yourself between five nearby markers. You can skip a stop with Next, or leave the tour at any time.';
  back.hidden=!active;back.disabled=index===0;distance.hidden=!active;
  next.textContent=active?(index===stops.length-1?'Finish tour':'Next stop'):done?'Replay tour':'Start tour';
  skip.textContent=done?'Close':'Skip tour';
  marker.firstChild.textContent=`Tour ${index+1}/${stops.length} · ${s.title}`;
 }
 function close(){wanted=false;shown=true;mode='offer';card.hidden=tag.hidden=marker.hidden=true;}
 function open(){mode='offer';shown=true;wanted=true;render();card.hidden=false;}
 back.onclick=()=>{index=Math.max(0,index-1);render();back.blur();};
 next.onclick=()=>{if(mode!=='tour'){mode='tour';index=0;}else if(index<stops.length-1)index++;else mode='done';render();next.blur();};
 skip.onclick=()=>{close();skip.blur();};
 const projected=new T.Vector3(),view=new T.Vector3(),target=new T.Vector3();
 function place(node,point,camera,edge=false){
  view.copy(point).applyMatrix4(camera.matrixWorldInverse);const behind=view.z>0;
  projected.copy(point).project(camera);let x=projected.x,y=projected.y;
  if(behind){x=-x;y=-y;const scale=Math.max(Math.abs(x),Math.abs(y))||1;x/=scale;y/=scale;}
  const outside=Math.max(Math.abs(x)/.86,Math.abs(y)/.72);
  if(!edge&&(behind||outside>1)){node.hidden=true;return;}
  if(outside>1){x/=outside;y/=outside;}
  node.hidden=false;node.classList.toggle('edge',edge&&(behind||outside>1));
  node.style.transform=`translate(${(x+1)/2*innerWidth}px,${(1-y)/2*innerHeight}px) translate(-50%,-100%)`;
 }
 function update(p,camera,enabled){
  const near=group.position.distanceTo(p),onDeck=Math.abs(p.y-group.position.y)<1.5;
  if(enabled&&!shown&&onDeck&&near<7)open();
  card.hidden=!wanted||!enabled;tag.hidden=marker.hidden=true;
  if(!enabled)return;
  if(onDeck&&near<14&&mode!=='tour')place(tag,target.copy(group.position).setY(group.position.y+2.15),camera);
  if(!wanted||mode!=='tour')return;
  const s=stops[index],metres=Math.round(p.distanceTo(s.point)),here=onDeck&&metres<=2;
  distance.textContent=onDeck?(here?'At this stop · Next when ready':`${metres} m to the marker · walk at your own pace`):'Tour stops are on Deck 2 · Go to → Arrival hall returns there.';
  marker.lastChild.textContent=onDeck?(here?'You are here':`${metres} m · follow the marker`):'Deck 2 · Arrival hall';
  place(marker,target.copy(s.point).setY(s.point.y+1.8),camera,true);
 }
 render();
 return {group,stops,open,close,update,near(p){return Math.abs(p.y-group.position.y)<1.5&&p.distanceTo(group.position)<2.8?{kind:'arrival-tour',label:'Talk to the welcome guide'}:null;}};
}
