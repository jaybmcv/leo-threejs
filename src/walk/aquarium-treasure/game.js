import {inOtherside} from '../net/otherside.js';
import * as T from 'three';
import {canvasTexture} from '../../polish-kit.js';
import {AQUARIUM as A} from '../lounge-aquarium.js';
import {SWIM,swimWorld,swimLocal,distance,limitSwim,inWater,gemNear} from './layout.js';

// The reef stays sealed to walkers. E at the upper gallery's glass door puts a suited swimmer inside it.
// Every run owns its gems and chest. Only best times go to Leo live; a solo run keeps a best in this browser.
const KEY='leo-aquarium-best',clock=ms=>(ms/1000).toFixed(1)+' s';
const CSS=`
#treasure-bar{position:fixed;z-index:6;top:104px;left:50%;transform:translateX(-50%);max-width:94vw;background:var(--surface,#101720);border:1px solid #45e5ff;border-radius:14px;padding:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;font:12px var(--mono,monospace)}
#treasure-bar[hidden],#treasure-sheet[hidden]{display:none}#treasure-bar small{flex-basis:100%;text-align:center;color:var(--dim,#bcd)}
#treasure-bar button,#treasure-sheet button{padding:9px 13px;border:1px solid #456273;border-radius:8px;background:#172633;color:#f2f9ff;touch-action:none}
#treasure-sheet .card{max-height:85vh;overflow:auto}#treasure-sheet p{line-height:1.5}#treasure-sheet ol{padding-left:24px}#treasure-sheet li{padding:6px 0}#treasure-sheet .row{display:flex;gap:10px;flex-wrap:wrap}
@media(max-width:560px){#treasure-bar{top:100px;font-size:11px;gap:6px}#treasure-bar small{max-width:260px}}
`;
export function createTreasureGame({tank,controller,follow,camera,input,live,onOpen,onClose,onEnter,onExit}){
 if(!tank)return null;
 const group=new T.Group();group.name='Aquarium_treasure';tank.add(group);
 const steel=new T.MeshStandardMaterial({color:0x263b4e,metalness:.5,roughness:.4}),gold=new T.MeshBasicMaterial({color:0xffca55,toneMapped:false});
 const cyan=new T.MeshBasicMaterial({color:0x45e5ff,toneMapped:false});
 const add=(geo,mat,p,parent=group)=>{const o=new T.Mesh(geo,mat);o.position.fromArray(p);parent.add(o);return o;};
 const door=SWIM.door,dy=door[1]+1.35,dz=A.front+.06;
 for(const x of [door[0]-.9,door[0]+.9])add(new T.BoxGeometry(.055,2.7,.055),cyan,[x,dy,dz]);
 for(const y of [door[1]+.03,door[1]+2.7])add(new T.BoxGeometry(1.85,.055,.055),cyan,[door[0],y,dz]);
 add(new T.PlaneGeometry(1.75,2.65),new T.MeshBasicMaterial({color:0x66ddff,transparent:true,opacity:.12,side:T.DoubleSide,depthWrite:false}),[door[0],dy,dz]);
 add(new T.BoxGeometry(.06,.3,.1),gold,[door[0]+.62,dy,dz+.08]);
 const label=canvasTexture(768,192,(g,w,h)=>{g.fillStyle='#0a1928';g.fillRect(0,0,w,h);g.textAlign='center';g.fillStyle='#72edff';g.font='bold 44px sans-serif';g.fillText('AQUARIUM TREASURE',w/2,70);g.fillStyle='#ffffff';g.font='30px sans-serif';g.fillText('ENTER · SWIM · FIND 7 GEMS',w/2,133);});
 const face=new T.PlaneGeometry(2.8,.7);tank.updateWorldMatrix(true,false);
 // Keep the wording readable from the gallery when the lounge's frame is mirrored.
 if(tank.matrixWorld.determinant()<0){const uv=face.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));}
 add(face,new T.MeshBasicMaterial({map:label,side:T.DoubleSide,toneMapped:false}),[door[0],door[1]+2.75,dz+.03]);
 const gems=SWIM.gems.map((p,i)=>{const o=add(new T.OctahedronGeometry(.28),new T.MeshBasicMaterial({color:SWIM.colors[i],toneMapped:false}),p);o.scale.y=1.4;return o;});
 const chest=new T.Group();chest.position.fromArray(SWIM.chest);group.add(chest);
 add(new T.BoxGeometry(1.25,.55,.7),steel,[0,0,0],chest);
 for(const x of [-.43,.43])add(new T.BoxGeometry(.08,.57,.73),gold,[x,0,0],chest);
 const lid=new T.Group();lid.position.set(0,.28,-.35);chest.add(lid);
 add(new T.BoxGeometry(1.28,.18,.74),gold,[0,.09,.35],lid);
 const prize=add(new T.OctahedronGeometry(.25),cyan,[0,.42,0],chest);prize.visible=false;
 document.head.append(Object.assign(document.createElement('style'),{textContent:CSS}));
 const el=(tag,props={},...kids)=>{const o=Object.assign(document.createElement(tag),props);o.append(...kids);return o;};
 const count=el('b'),time=el('b'),exit=el('button',{type:'button',textContent:'Exit to gallery'}),up=el('button',{type:'button',textContent:'↑ Rise','ariaLabel':'Hold to swim up'}),down=el('button',{type:'button',textContent:'↓ Dive','ariaLabel':'Hold to swim down'});
 const hint=el('small',{textContent:'Move and look as usual · Space rises · hold C to dive · swim over gems'});
 const bar=el('div',{id:'treasure-bar',hidden:true},el('span',{textContent:'Aquarium'}),count,time,up,down,exit,hint);
 const title=el('h2'),note=el('p'),list=el('ol'),mine=el('p'),close=el('button',{type:'button',textContent:'Keep swimming'}),back=el('button',{type:'button',textContent:'Back to gallery'});
 const sheet=el('div',{id:'treasure-sheet',className:'sheet',hidden:true},el('div',{className:'card',role:'dialog',ariaLabel:'Aquarium treasure results'},title,note,el('h3',{textContent:'Fastest swims'}),list,mine,el('div',{className:'row'},close,back)));
 document.body.append(bar,sheet);
 let active=false,done=false,t0=0,ran=0,found=new Set(),heldUp=false,heldDown=false,returnAt=null,oldView=null,result=null,board=null,awaiting=false,timeout=null;
 const velocity=new T.Vector3(),p=new T.Vector3(),aim=new T.Vector3();
 const best=()=>{try{const n=+localStorage.getItem(KEY);return n>0?n:null;}catch{return null;}};
 function hide(){if(sheet.hidden)return;sheet.hidden=true;onClose?.();}
 function leave(returning=true){
  if(!active)return;active=false;hide();bar.hidden=true;heldUp=heldDown=false;velocity.set(0,0,0);live()?.treasure('cancel');
  if(returning&&returnAt)controller.place(returnAt);if(oldView){follow.mode=oldView.mode;follow.distance=oldView.distance;follow.current=.4;}
  onExit?.();input.down.clear();
 }
 function begin(){
  onEnter?.();returnAt=controller.position.clone();oldView={mode:follow.mode,distance:follow.distance};follow.mode='third';follow.distance=2.5;
  follow.pitch=-.1;input.down.clear();controller.velocity.set(0,0,0);controller.grounded=false;controller.ground=null;controller.stance='stand';controller.jumpCount=0;controller.jumpS=-1;
  controller.position.fromArray(swimWorld(SWIM.entry));active=true;done=false;t0=performance.now();found=new Set();result=null;awaiting=false;clearTimeout(timeout);
  bar.hidden=false;gems.forEach(g=>g.visible=true);lid.rotation.x=0;prize.visible=false;live()?.treasure('start');
 }
 function showBoard(){
  title.textContent='Treasure recovered · '+clock(ran);list.textContent='';
  note.textContent=awaiting?'Checking your swim with Leo live…':result?.ok?`${result.newBest?'A new best! ':''}Your best: ${clock(result.best)} · rank ${result.rank}.`:
   result?.why==='sign-in'?inOtherside?'Your browser best is saved.':'Connect Discord to post times. Your browser best is saved.':result?.why==='rejected'?'This swim was not accepted for the shared board. Your browser best is saved.':'Your browser best is saved. The shared board is offline.';
  if(!board?.top?.length)list.append(el('li',{textContent:board?'No times yet.':'Shared board unavailable.'}));
  for(const [i,e] of (board?.top||[]).entries())list.append(el('li',{textContent:`${i+1}. ${e.name} · ${clock(e.ms)}`}));
  mine.textContent=best()?`Best in this browser: ${clock(best())}`:'';
 }
 function finish(){
  if(done||found.size!==7)return;done=true;ran=Math.round(performance.now()-t0);const b=best();if(!b||ran<b)try{localStorage.setItem(KEY,String(ran));}catch{}
  awaiting=!!live()?.live;result=null;board=null;
  if(awaiting){live().treasure('finish',{ms:ran});live().treasure('board');timeout=setTimeout(()=>{awaiting=false;showBoard();},6000);}
  showBoard();onOpen?.();sheet.hidden=false;close.focus();
 }
 for(const [b,set] of [[up,v=>heldUp=v],[down,v=>heldDown=v]]){
  b.onpointerdown=e=>{e.preventDefault();set(true);b.setPointerCapture(e.pointerId);};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>set(false));
 }
 addEventListener('blur',()=>{heldUp=heldDown=false;});
 exit.onclick=back.onclick=()=>leave();close.onclick=hide;
 return {
  get active(){return active;},get found(){return found.size;},get done(){return done;},group,
  contains(pos){return inWater(swimLocal([pos.x,pos.y,pos.z]));},
  near(pos){const q=swimLocal([pos.x,pos.y,pos.z]);
   if(active){if(done&&distance(q,SWIM.chest)<2)return {kind:'treasure',op:'board',label:'Aquarium best times'};
    if(found.size===7&&distance(q,SWIM.chest)<2)return {kind:'treasure',op:'finish',label:'Recover treasure · stop the clock'};return null;}
   return distance(q,SWIM.door)<2.1?{kind:'treasure',op:'enter',label:'Enter aquarium · treasure swim'}:null;
  },
  use(t){if(t.op==='enter')begin();else if(t.op==='finish')finish();else if(t.op==='board'){live()?.treasure('board');showBoard();onOpen?.();sheet.hidden=false;close.focus();}},
  leave,close:hide,
  step(dt,k){
   if(!active)return;
   const enabled=input.enabled&&sheet.hidden,forward=new T.Vector3(Math.sin(follow.yaw)*Math.cos(follow.pitch),Math.sin(follow.pitch),Math.cos(follow.yaw)*Math.cos(follow.pitch));
   const right=new T.Vector3(-Math.cos(follow.yaw),0,Math.sin(follow.yaw));
   aim.copy(forward).multiplyScalar(enabled?k.y:0).addScaledVector(right,enabled?k.x:0);
   aim.y+=enabled?((k.held||k.jump||heldUp?1:0)-(input.down.has('KeyC')||heldDown?1:0)):0;
   if(aim.lengthSq()>1)aim.normalize();aim.multiplyScalar(SWIM.speed);velocity.lerp(aim,1-Math.exp(-8*dt));
   const old=swimLocal(controller.position.toArray()),next=swimLocal(p.copy(controller.position).addScaledVector(velocity,dt).toArray());
   // Below its roof, a glass tunnel side stops the swimmer; it never lifts them through the roof.
   const r=SWIM.radius,lo=A.tunnel.x0-r,hi=A.tunnel.x1+r;
   if(next[1]<A.tunnel.top+.3&&next[0]>lo&&next[0]<hi){next[0]=old[0]<=lo?lo:old[0]>=hi?hi:next[0];}
   const bounded=limitSwim(next);p.fromArray(swimWorld(bounded));controller.velocity.copy(p).sub(controller.position).divideScalar(Math.max(dt,.001));controller.position.copy(p);
   controller.grounded=false;controller.ground=null;controller.fell=0;
   const q=swimLocal(p.toArray());
   if(!done)SWIM.gems.forEach((g,i)=>{if(!found.has(i)&&gemNear(q,g)){found.add(i);gems[i].visible=false;}});
   count.textContent=`${found.size}/7 gems`;time.textContent=clock(done?ran:performance.now()-t0);
   hint.textContent=found.size===7?'Chest open: swim to the gold chest and press E or tap Use.':'Move and look as usual · Space rises · hold C to dive · swim over gems';
   lid.rotation.x=T.MathUtils.damp(lid.rotation.x,found.size===7?-1.9:0,5,dt);prize.visible=found.size===7;
  },
  updateCamera(dt){
   const origin=controller.position.clone().add(new T.Vector3(0,SWIM.offset,0)),dir=new T.Vector3(Math.sin(follow.yaw)*Math.cos(follow.pitch),Math.sin(follow.pitch),Math.cos(follow.yaw)*Math.cos(follow.pitch));
   p.copy(origin).addScaledVector(dir,follow.mode==='first'?.15:-follow.distance);
   p.fromArray(swimWorld(limitSwim(swimLocal(p.toArray()),true)));camera.position.copy(p);
   camera.lookAt(follow.mode==='first'?origin.addScaledVector(dir,4):origin);follow.current=camera.position.distanceTo(origin);
  },
  fromServer(msg){
   if(msg.op==='result'){result=msg;awaiting=false;clearTimeout(timeout);if(msg.ok)live()?.treasure('board');}
   if(msg.op==='board')board=msg;
   if(!sheet.hidden)showBoard();
  },
 };
}
