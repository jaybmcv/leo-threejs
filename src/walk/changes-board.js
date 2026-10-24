import * as T from 'three';
import log from 'walk-changes';

// The ship log boards: every change made to Leo (scripts/ship-log.mjs, from git at build time), newest first, with the
// day it was completed, and beside the list the five changes with the most hearts. One board on the Crown lounge lift's
// forward face, one on the Arrival hall's inboard wall; both show the one canvas. E at a board opens it full size: pick
// a change with the arrows, W and S, the wheel or the mouse, and E (Enter, Space, or the heart button) gives it a heart
// or takes it back. Hearts are Leo live's (server/leo-live.mjs): one per change per Discord-verified visitor, and every
// visitor's boards update as hearts come and go.
//   hearts.request()      ask for the counts and this visitor's own hearts; they arrive through setHearts
//   hearts.toggle(id,on)  give (on) or take back a heart
// setHearts({counts:[[id,n]], mine:[id]|undefined, verified}) · setStatus('live'|'offline') · refused(why)
export const BOARDS=[
 // The crown lift's housing, forward face (x -244.82), between the floor (120.3) and its gold panelling.
 {name:'Crown_lounge',wall:[-244.82,122.3,0],facing:[1,0,0],floor:120.3},
 // The Arrival hall's inboard wall (z -21.09), between the benches at x -131 and -122, under the 3.3 m ceiling.
 {name:'Arrival_hall',wall:[-126.5,-33.75,-21.09],facing:[0,0,-1],floor:-35.7},
];
const SIZE=[4,2.3],PX=[1600,920],REACH=3.4,FAVORITES=5;
const INK='#0d1419',PANEL='#1b2830',TEXT='#f4f0e8',DIM='#a6b4bb',ORANGE='#f85800',TEAL='#2fd6c5',SELECT='#24404c';
const FONT={display:'"Archivo", "Sora", sans-serif',mono:'"JetBrains Mono", ui-monospace, monospace',sans:'"Sora", sans-serif'};
const LIST={x:40,y:150,w:1000,row:54},ROWS=Math.floor((PX[1]-LIST.y-70)/LIST.row),FAV={x:1080,y:150,w:480};
const day=d=>{const [y,m,n]=d.split('-').map(Number);return `${n} ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[m-1]} ${y}`;};

function clip(c,text,max){if(c.measureText(text).width<=max)return text;let s=text;while(s.length>1&&c.measureText(s+'…').width>max)s=s.slice(0,-1);return s+'…';}
// Up to two lines of `text` in `max` pixels, the second cut short if it must be.
function wrap(c,text,max){
 const words=text.split(' ');let line='';
 for(let i=0;i<words.length;i++){const next=line?line+' '+words[i]:words[i];if(c.measureText(next).width>max&&line)return [line,clip(c,words.slice(i).join(' '),max)];line=next;}
 return [line];
}
function heart(c,x,y,s,fill){c.fillStyle=fill;c.beginPath();c.moveTo(x,y+s*.35);c.bezierCurveTo(x,y,x-s*.5,y,x-s*.5,y+s*.3);c.bezierCurveTo(x-s*.5,y+s*.6,x,y+s*.8,x,y+s);
 c.bezierCurveTo(x,y+s*.8,x+s*.5,y+s*.6,x+s*.5,y+s*.3);c.bezierCurveTo(x+s*.5,y,x,y,x,y+s*.35);c.fill();}

export function createChangesBoards({hearts,onOpen=()=>{},onClose=()=>{}}={}){
 const canvas=document.createElement('canvas');canvas.width=PX[0];canvas.height=PX[1];
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
 const c=canvas.getContext('2d');
 let counts=new Map(),mine=new Set(),verified=false,status='offline',note='',noteAt=0,top=0,selected=0,hover=-1,open=false;
 const count=id=>counts.get(id)||0;
 const favorites=()=>log.filter(e=>count(e.id)>0).sort((a,b)=>count(b.id)-count(a.id)||b.date.localeCompare(a.date)||b.id-a.id).slice(0,FAVORITES);
 function paint(){
  const w=PX[0],h=PX[1];c.clearRect(0,0,w,h);
  c.fillStyle=INK;c.beginPath();c.roundRect(0,0,w,h,22);c.fill();c.strokeStyle='rgba(255,255,255,.16)';c.lineWidth=5;c.stroke();
  c.textBaseline='alphabetic';c.textAlign='left';
  c.fillStyle=TEAL;c.font=`500 24px ${FONT.mono}`;c.letterSpacing='6px';c.fillText('SHIP LOG',LIST.x,62);c.letterSpacing='0px';
  c.fillStyle=TEXT;c.font=`600 52px ${FONT.display}`;c.fillText('Changes to Leo',LIST.x,116);
  c.fillStyle=DIM;c.font=`400 22px ${FONT.mono}`;c.textAlign='right';c.fillText(`${log.length} changes · newest first`,LIST.x+LIST.w,116);c.textAlign='left';
  c.fillStyle=ORANGE;c.fillRect(LIST.x,132,90,5);
  // The list, a window of ROWS rows from `top`.
  if(!log.length){c.fillStyle=DIM;c.font=`400 28px ${FONT.sans}`;c.fillText('The ship log is not in this build.',LIST.x,LIST.y+60);}
  for(let r=0;r<ROWS&&top+r<log.length;r++){
   const i=top+r,e=log[i],y=LIST.y+r*LIST.row,n=count(e.id),own=mine.has(e.id);
   if(open&&(i===selected||i===hover)){c.fillStyle=i===selected?SELECT:'rgba(255,255,255,.05)';c.beginPath();c.roundRect(LIST.x-14,y+4,LIST.w+10,LIST.row-6,10);c.fill();}
   if(open&&i===selected){c.fillStyle=ORANGE;c.fillRect(LIST.x-14,y+4,6,LIST.row-6);}
   c.fillStyle=DIM;c.font=`400 22px ${FONT.mono}`;c.fillText(day(e.date),LIST.x,y+37);
   c.fillStyle=TEXT;c.font=`400 27px ${FONT.sans}`;c.fillText(clip(c,e.name,LIST.w-300),LIST.x+190,y+37);
   heart(c,LIST.x+LIST.w-70,y+15,24,own?ORANGE:n?'#6d7d86':'#33434c');
   c.fillStyle=own?ORANGE:n?TEXT:'#55656e';c.font=`500 24px ${FONT.mono}`;c.textAlign='right';c.fillText(String(n),LIST.x+LIST.w-14,y+37);c.textAlign='left';
  }
  // The scroll bar.
  if(log.length>ROWS){const x=LIST.x+LIST.w+10,y0=LIST.y+6,hh=ROWS*LIST.row-12,bar=Math.max(40,hh*ROWS/log.length),at=y0+(hh-bar)*top/(log.length-ROWS);
   c.fillStyle='rgba(255,255,255,.08)';c.fillRect(x,y0,6,hh);c.fillStyle=DIM;c.fillRect(x,at,6,bar);}
  // Favorites: the five with the most hearts, whatever their age.
  c.fillStyle=PANEL;c.beginPath();c.roundRect(FAV.x-24,LIST.y-6,FAV.w+44,ROWS*LIST.row+12,16);c.fill();
  heart(c,FAV.x+14,LIST.y+20,30,ORANGE);c.fillStyle=TEXT;c.font=`600 40px ${FONT.display}`;c.fillText('Favorites',FAV.x+44,LIST.y+48);
  c.fillStyle=DIM;c.font=`400 20px ${FONT.mono}`;c.fillText('MOST HEARTS',FAV.x+250,LIST.y+46);
  const fav=favorites();
  if(!fav.length){c.fillStyle=DIM;c.font=`400 26px ${FONT.sans}`;c.fillText(status==='live'?'No hearts yet.':'Hearts show here',FAV.x,LIST.y+120);c.fillText(status==='live'?'Give the first one!':'when Leo live is on.',FAV.x,LIST.y+156);}
  fav.forEach((e,k)=>{
   const y=LIST.y+80+k*104;
   c.fillStyle=ORANGE;c.font=`600 44px ${FONT.display}`;c.fillText(String(k+1),FAV.x,y+44);
   c.fillStyle=TEXT;c.font=`500 25px ${FONT.sans}`;wrap(c,e.name,FAV.w-60).forEach((l,j)=>c.fillText(l,FAV.x+44,y+22+j*30));
   c.fillStyle=DIM;c.font=`400 19px ${FONT.mono}`;c.fillText(`${day(e.date)} · ♥ ${count(e.id)}`,FAV.x+44,y+86);
  });
  // The foot: how to use it, or what just happened.
  const y=h-30;c.font=`400 22px ${FONT.mono}`;
  const fresh=note&&performance.now()-noteAt<6000;
  c.fillStyle=fresh?ORANGE:DIM;
  c.fillText(fresh?note:open?'↑ ↓ OR CLICK TO CHOOSE · E TO GIVE OR TAKE BACK A HEART · ESC TO LEAVE':'PRESS E HERE TO BROWSE THE LOG AND GIVE A HEART',LIST.x,y);
  c.textAlign='right';c.fillStyle=DIM;c.fillText(status!=='live'?'HEARTS OFFLINE':verified?'ONE HEART PER CHANGE':'SIGN IN WITH DISCORD TO GIVE HEARTS',w-40,y);c.textAlign='left';
  texture.needsUpdate=true;
 }
 paint();document.fonts?.ready.then(paint);
 const say=text=>{note=text;noteAt=performance.now();paint();setTimeout(()=>{if(note===text)paint();},6100);};

 // The boards on their walls.
 const frame=new T.MeshStandardMaterial({name:'Ship_log_frame',color:0x1c1a18,roughness:.55,metalness:.2});
 const face=new T.MeshBasicMaterial({name:'Ship_log_face',map:texture,toneMapped:false});
 const boards=BOARDS.map(b=>{
  const [x,y,z]=b.wall,f=new T.Vector3(...b.facing),group=new T.Group();group.name='Ship_log_'+b.name;
  // Its origin on the floor, so main.js files it with that deck's band.
  group.position.set(x,b.floor,z);group.rotation.y=Math.atan2(f.x,f.z);
  const back=new T.Mesh(new T.BoxGeometry(SIZE[0]+.16,SIZE[1]+.16,.06),frame);back.name='Ship_log_frame';back.position.set(0,y-b.floor,.03);group.add(back);
  const screen=new T.Mesh(new T.PlaneGeometry(...SIZE),face);screen.name='Ship_log_screen';screen.position.set(0,y-b.floor,.065);group.add(screen);
  return {group,centre:new T.Vector3(x,y,z),facing:f,floor:b.floor};
 });

 // The board full size, over the walk.
 const root=document.createElement('div');root.className='ship-log';
 root.style.cssText='position:fixed;inset:0;z-index:60;background:rgba(5,7,13,.82);display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;touch-action:none;user-select:none';
 canvas.style.cssText='display:block;max-width:calc(100vw - 24px);max-height:calc(100vh - 110px);width:1200px;height:auto;aspect-ratio:1600/920;border-radius:12px;cursor:pointer';
 root.appendChild(canvas);
 const bar=document.createElement('div');bar.style.cssText='display:flex;gap:12px';
 const button=(label,aria,css='')=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',aria);
  b.style.cssText=`min-width:64px;height:52px;padding:0 18px;border-radius:12px;border:1px solid #3a4150;background:#151a24;color:${TEXT};font:500 18px ${FONT.mono};cursor:pointer;${css}`;bar.appendChild(b);return b;};
 const up=button('▲','Previous change'),give=button('♥ Heart','Give or take back a heart',`color:${ORANGE}`),down=button('▼','Next change'),done=button('Done','Close the ship log');
 root.appendChild(bar);document.body.appendChild(root);

 function choose(i){selected=T.MathUtils.clamp(i,0,Math.max(0,log.length-1));if(selected<top)top=selected;else if(selected>=top+ROWS)top=selected-ROWS+1;paint();}
 function scroll(rows){top=T.MathUtils.clamp(top+rows,0,Math.max(0,log.length-ROWS));paint();}
 function toggle(){
  const e=log[selected];if(!e)return;
  if(status!=='live'){say('LEO LIVE IS NOT CONNECTED: HEARTS CAN’T BE SAVED RIGHT NOW');return;}
  if(!verified){say('SIGN IN WITH DISCORD TO GIVE HEARTS');return;}
  hearts?.toggle(e.id,!mine.has(e.id));
 }
 // The list row under a point on the canvas, if any.
 function rowAt(ev){
  const r=canvas.getBoundingClientRect(),x=(ev.clientX-r.left)*PX[0]/r.width,y=(ev.clientY-r.top)*PX[1]/r.height;
  if(x>=LIST.x-14&&x<=LIST.x+LIST.w&&y>=LIST.y&&y<LIST.y+ROWS*LIST.row){const i=top+Math.floor((y-LIST.y)/LIST.row);return i<log.length?{i,heart:x>LIST.x+LIST.w-110}:null;}
  if(x>=FAV.x-24&&y>=LIST.y+80){const k=Math.floor((y-LIST.y-80)/104),e=favorites()[k];if(e)return {i:log.indexOf(e),heart:false};}
  return null;
 }
 canvas.addEventListener('pointermove',ev=>{const h=rowAt(ev)?.i??-1;if(h!==hover){hover=h;paint();}});
 canvas.addEventListener('pointerleave',()=>{hover=-1;paint();});
 // A click picks a change; a click on its heart, or on the change already picked, gives or takes back a heart.
 canvas.addEventListener('click',ev=>{const h=rowAt(ev);if(!h)return;if(h.heart||h.i===selected){choose(h.i);toggle();}else choose(h.i);});
 canvas.addEventListener('wheel',ev=>{ev.preventDefault();scroll(Math.sign(ev.deltaY)*3);},{passive:false});
 up.addEventListener('click',()=>choose(selected-1));down.addEventListener('click',()=>choose(selected+1));give.addEventListener('click',toggle);done.addEventListener('click',()=>hide());
 // Keys while open are the board's alone: caught before the walk's own listener sees them.
 function onKey(e){
  if(!open||e.ctrlKey||e.metaKey||e.altKey)return;
  e.stopImmediatePropagation();if(e.type!=='keydown')return;
  const k=e.code;
  if(k==='Escape'){hide();return;}
  if(/^(Arrow|Space|Page|Home|End)/.test(k))e.preventDefault();
  if(k==='ArrowUp'||k==='KeyW')choose(selected-1);
  else if(k==='ArrowDown'||k==='KeyS')choose(selected+1);
  else if(k==='PageUp')choose(selected-ROWS);else if(k==='PageDown')choose(selected+ROWS);
  else if(k==='Home')choose(0);else if(k==='End')choose(log.length-1);
  else if(!e.repeat&&(k==='KeyE'||k==='Enter'||k==='Space'))toggle();
 }
 addEventListener('keydown',onKey,true);addEventListener('keyup',onKey,true);
 function show(){if(open)return;open=true;root.style.display='flex';note='';hover=-1;choose(selected);hearts?.request();onOpen();}
 function hide(){if(!open)return;open=false;root.style.display='none';hover=-1;paint();onClose();}

 return {
  groups:boards.map(b=>b.group),
  get isOpen(){return open;},
  open:show,close:hide,
  // The use prompt for a walker standing in front of a board.
  near(p){
   for(const b of boards){const dx=p.x-b.centre.x,dz=p.z-b.centre.z,out=dx*b.facing.x+dz*b.facing.z,along=Math.abs(dx*b.facing.z-dz*b.facing.x);
    if(Math.abs(p.y-b.floor)<1.5&&out>0&&out<REACH&&along<SIZE[0]/2+.4)return {kind:'log',label:'Browse the ship log'};}
   return null;
  },
  setStatus(s){if(s!==status){status=s;if(s!=='live')verified=false;paint();}},
  setHearts(h){
   counts=new Map((h.counts||[]).filter(([id,n])=>Number.isInteger(id)&&Number.isInteger(n)));
   if(Array.isArray(h.mine))mine=new Set(h.mine);if(typeof h.verified==='boolean')verified=h.verified;
   paint();
  },
  refused(why){say(why==='sign-in'?'SIGN IN WITH DISCORD TO GIVE HEARTS':'THAT HEART WASN’T SAVED');},
  // For checks: what the board holds.
  get state(){return {log,counts,mine,verified,status,selected,top,favorites:favorites()};},
 };
}
