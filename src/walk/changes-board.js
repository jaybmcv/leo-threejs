import * as T from 'three';
import log from 'walk-changes';
import {readSpot} from './link.js';

// The ship log boards: every change made to Leo (scripts/ship-log.mjs, from git at build time), newest first, with the
// day it was completed, and beside the list the five changes with the most hearts. One board on the Crown lounge lift's
// forward face, one on the Arrival hall's inboard wall; both show the one canvas. E at a board opens it full size: pick
// a change with the arrows, W and S, the wheel or the mouse, and E (Space, or the heart button) gives it a heart or
// takes it back. Hearts are Leo live's (server/leo-live.mjs): one per change per Discord-verified visitor, and every
// visitor's boards update as hearts come and go.
// Open, a row shows its whole name on hover, and a click (or Enter) opens the change's details: its name in full, its
// before-and-after pictures where its pull request has them (a slider between the two, scripts/ship-log-media.mjs) and
// Go there, which takes the walker to the spot the pictures were taken from (onGo). The log also opens anywhere aboard
// (L, or the "changes here" chip, main.js), showing first the changes made near the walker (nearby()).
//   hearts.request()      ask for the counts and this visitor's own hearts; they arrive through setHearts
//   hearts.toggle(id,on)  give (on) or take back a heart
// setHearts({counts:[[id,n]], mine:[id]|undefined, verified}) · setStatus('live'|'offline') · refused(why)
export const BOARDS=[
 // The crown lift's housing, forward face (x -244.82), between the floor (120.3) and its gold panelling.
 {name:'Crown_lounge',wall:[-244.82,122.3,0],facing:[1,0,0],floor:120.3},
 // The Arrival hall's inboard wall, on its piers' face (z -21.16, the vision glass between them is set back), between
 // the benches at x -131 and -122, under the 3.3 m ceiling.
 {name:'Arrival_hall',wall:[-126.5,-33.75,-21.18],facing:[0,0,-1],floor:-35.7},
];
const SIZE=[4,2.3],PX=[1600,920],REACH=3.6,FAVORITES=5;
const INK='#0d1419',PANEL='#1b2830',TEXT='#f4f0e8',DIM='#a6b4bb',ORANGE='#f85800',TEAL='#2fd6c5',SELECT='#24404c';
const FONT={display:'"Archivo", "Sora", sans-serif',mono:'"JetBrains Mono", ui-monospace, monospace',sans:'"Sora", sans-serif'};
const LIST={x:40,y:150,w:1000,row:54},ROWS=Math.floor((PX[1]-LIST.y-70)/LIST.row),FAV={x:1080,y:150,w:480};
// The pictures stay on the repository's pr-media branch; each change keeps only their paths.
const MEDIA='https://raw.githubusercontent.com/jaybmcv/leo-threejs/pr-media/',PULL='https://github.com/jaybmcv/leo-threejs/pull/';
// A change is near the walker when one of its spots is on the same floor (within 2.5 m up or down) and 12 m across.
const NEAR={across:12,up:2.5};
const day=d=>{const [y,m,n]=d.split('-').map(Number);return `${n} ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[m-1]} ${y}`;};
const spotsOf=new Map(log.map(e=>[e.id,[e.go,...(e.shots||[]).map(s=>s.at)].filter(Boolean).map(q=>readSpot('?'+q)).filter(Boolean)]));

function clip(c,text,max){if(c.measureText(text).width<=max)return text;let s=text;while(s.length>1&&c.measureText(s+'…').width>max)s=s.slice(0,-1);return s+'…';}
// Up to two lines of `text` in `max` pixels, the second cut short if it must be.
function wrap(c,text,max){
 const words=text.split(' ');let line='';
 for(let i=0;i<words.length;i++){const next=line?line+' '+words[i]:words[i];if(c.measureText(next).width>max&&line)return [line,clip(c,words.slice(i).join(' '),max)];line=next;}
 return [line];
}
function heart(c,x,y,s,fill){c.fillStyle=fill;c.beginPath();c.moveTo(x,y+s*.35);c.bezierCurveTo(x,y,x-s*.5,y,x-s*.5,y+s*.3);c.bezierCurveTo(x-s*.5,y+s*.6,x,y+s*.8,x,y+s);
 c.bezierCurveTo(x,y+s*.8,x+s*.5,y+s*.6,x+s*.5,y+s*.3);c.bezierCurveTo(x+s*.5,y,x,y,x,y+s*.35);c.fill();}
// A camera (the change has before-and-after pictures) or a map pin (it has a spot to go to), `s` pixels tall.
function camera(c,x,y,s,fill){c.fillStyle=fill;c.beginPath();c.roundRect(x,y+s*.22,s*1.3,s*.78,s*.14);c.fill();c.fillRect(x+s*.38,y+s*.06,s*.5,s*.22);
 c.fillStyle=INK;c.beginPath();c.arc(x+s*.65,y+s*.6,s*.25,0,Math.PI*2);c.fill();c.fillStyle=fill;c.beginPath();c.arc(x+s*.65,y+s*.6,s*.13,0,Math.PI*2);c.fill();}
function pin(c,x,y,s,fill){c.fillStyle=fill;c.beginPath();c.arc(x,y+s*.36,s*.36,Math.PI,0);c.lineTo(x,y+s);c.closePath();c.fill();
 c.fillStyle=INK;c.beginPath();c.arc(x,y+s*.36,s*.14,0,Math.PI*2);c.fill();}

const CSS=`
.ship-log .sl-tip{position:fixed;z-index:62;max-width:min(520px,calc(100vw - 24px));padding:10px 13px;border-radius:10px;background:${INK};border:1px solid rgba(255,255,255,.2);color:${TEXT};font:500 14px/1.4 ${FONT.sans};pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.ship-log .sl-tip small{display:block;margin-top:5px;font:400 11px/1.3 ${FONT.mono};letter-spacing:.06em;text-transform:uppercase;color:${DIM}}
.ship-log [hidden]{display:none!important}
.ship-log .sl-detail{position:absolute;inset:0;display:grid;place-items:center;padding:12px;background:rgba(5,7,13,.55)}
.ship-log .sl-card{width:min(920px,100%);max-height:100%;overflow:auto;box-sizing:border-box;background:${INK};border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:18px 20px;color:${TEXT};font:400 14px/1.45 ${FONT.sans};touch-action:pan-y;user-select:text}
.ship-log .sl-eyebrow{font:500 11px/1 ${FONT.mono};letter-spacing:.16em;text-transform:uppercase;color:${TEAL};margin-bottom:10px}
.ship-log .sl-card h2{font:600 clamp(20px,3.2vw,28px)/1.2 ${FONT.display};letter-spacing:-.01em;margin:0 0 14px}
.ship-log .sl-compare{position:relative;width:100%;aspect-ratio:16/9;max-height:min(60vh,560px);background:#000;border-radius:10px;overflow:hidden;touch-action:none;cursor:ew-resize;user-select:none}
.ship-log .sl-compare img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;-webkit-user-drag:none}
.ship-log .sl-after{clip-path:inset(0 0 0 50%)}
.ship-log .sl-line{position:absolute;top:0;bottom:0;left:50%;width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 6px rgba(0,0,0,.6);pointer-events:none}
.ship-log .sl-line i{position:absolute;top:50%;left:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:#fff;color:${INK};display:grid;place-items:center;font:600 15px/1 ${FONT.mono};font-style:normal}
.ship-log .sl-tag{position:absolute;top:10px;padding:5px 9px;border-radius:7px;background:rgba(5,7,13,.78);font:500 11px/1 ${FONT.mono};letter-spacing:.12em;text-transform:uppercase;pointer-events:none}
.ship-log .sl-tag.before{left:10px;color:${DIM}}.ship-log .sl-tag.after{right:10px;color:${ORANGE}}
.ship-log .sl-wait{position:absolute;inset:0;display:grid;place-items:center;margin:0;color:${DIM};font:400 12px/1.4 ${FONT.mono};letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
.ship-log .sl-shot{display:flex;align-items:center;gap:10px;margin:10px 0 4px}
.ship-log .sl-shot span{flex:1;font:400 12px/1.3 ${FONT.mono};letter-spacing:.04em;color:${DIM}}
.ship-log .sl-thumbs{display:flex;gap:8px;overflow-x:auto;padding:6px 0 4px}
.ship-log .sl-thumbs button{flex:none;width:96px;height:54px;padding:0;border-radius:7px;overflow:hidden;border:2px solid transparent;background:#000;cursor:pointer}
.ship-log .sl-thumbs button[aria-current="true"]{border-color:${ORANGE}}
.ship-log .sl-thumbs img{width:100%;height:100%;object-fit:cover;display:block}
.ship-log .sl-none{margin:0 0 6px;color:${DIM}}
.ship-log .sl-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px}
.ship-log .sl-card button,.ship-log .sl-card a{min-height:42px;padding:0 15px;border-radius:10px;border:1px solid #3a4150;background:#151a24;color:${TEXT};font:500 13px/1 ${FONT.mono};cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;box-sizing:border-box}
.ship-log .sl-card button:hover,.ship-log .sl-card a:hover{border-color:${ORANGE}}
.ship-log .sl-card .sl-go{background:${ORANGE};border-color:${ORANGE};color:#fff}
.ship-log .sl-card .sl-heart.mine{color:${ORANGE};border-color:${ORANGE}}
.ship-log .sl-card .sl-shot button{min-height:34px;padding:0 12px}
.ship-log .sl-card .sl-back{margin-left:auto}
.ship-log .sl-note{min-height:18px;margin-top:10px;font:400 12px/1.4 ${FONT.mono};color:${ORANGE}}
.ship-log .sl-keys{margin-top:4px;font:400 11px/1.4 ${FONT.mono};letter-spacing:.04em;color:#6d7d86}
@media (pointer:coarse){.ship-log .sl-keys{display:none}}
`;

// onGo(spot): take the walker to a spot (link.js's readSpot form); true if it could.
export function createChangesBoards({hearts,onOpen=()=>{},onClose=()=>{},onGo=()=>false}={}){
 const canvas=document.createElement('canvas');canvas.width=PX[0];canvas.height=PX[1];
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
 const c=canvas.getContext('2d');
 let counts=new Map(),mine=new Set(),verified=false,status='offline',note='',noteAt=0,top=0,selected=0,hover=-1,open=false;
 // rows: the list shown, every change or (filtered) those near where the log was opened; here: the latter.
 let rows=log,here=[],detail=null;
 const filtered=()=>rows!==log;
 const count=id=>counts.get(id)||0;
 const favorites=()=>log.filter(e=>count(e.id)>0).sort((a,b)=>count(b.id)-count(a.id)||b.date.localeCompare(a.date)||b.id-a.id).slice(0,FAVORITES);
 function paint(){
  const w=PX[0],h=PX[1];c.clearRect(0,0,w,h);
  c.fillStyle=INK;c.beginPath();c.roundRect(0,0,w,h,22);c.fill();c.strokeStyle='rgba(255,255,255,.16)';c.lineWidth=5;c.stroke();
  c.textBaseline='alphabetic';c.textAlign='left';
  c.fillStyle=TEAL;c.font=`500 24px ${FONT.mono}`;c.letterSpacing='6px';c.fillText(filtered()?'SHIP LOG · NEAR YOU':'SHIP LOG',LIST.x,62);c.letterSpacing='0px';
  c.fillStyle=TEXT;c.font=`600 52px ${FONT.display}`;c.fillText(filtered()?'Changes around here':'Changes to Leo',LIST.x,116);
  c.fillStyle=DIM;c.font=`400 22px ${FONT.mono}`;c.textAlign='right';c.fillText(filtered()?`${rows.length} of ${log.length} changes`:`${log.length} changes · newest first`,LIST.x+LIST.w,116);c.textAlign='left';
  c.fillStyle=ORANGE;c.fillRect(LIST.x,132,90,5);
  // The list, a window of ROWS rows from `top`.
  if(!log.length){c.fillStyle=DIM;c.font=`400 28px ${FONT.sans}`;c.fillText('The ship log is not in this build.',LIST.x,LIST.y+60);}
  for(let r=0;r<ROWS&&top+r<rows.length;r++){
   const i=top+r,e=rows[i],y=LIST.y+r*LIST.row,n=count(e.id),own=mine.has(e.id);
   if(open&&(i===selected||i===hover)){c.fillStyle=i===selected?SELECT:'rgba(255,255,255,.05)';c.beginPath();c.roundRect(LIST.x-14,y+4,LIST.w+10,LIST.row-6,10);c.fill();}
   if(open&&i===selected){c.fillStyle=ORANGE;c.fillRect(LIST.x-14,y+4,6,LIST.row-6);}
   c.fillStyle=DIM;c.font=`400 22px ${FONT.mono}`;c.fillText(day(e.date),LIST.x,y+37);
   c.fillStyle=TEXT;c.font=`400 27px ${FONT.sans}`;c.fillText(clip(c,e.name,LIST.w-350),LIST.x+190,y+37);
   if(e.shots)camera(c,LIST.x+LIST.w-142,y+16,24,TEAL);else if(e.go)pin(c,LIST.x+LIST.w-126,y+14,26,'#6d7d86');
   heart(c,LIST.x+LIST.w-70,y+15,24,own?ORANGE:n?'#6d7d86':'#33434c');
   c.fillStyle=own?ORANGE:n?TEXT:'#55656e';c.font=`500 24px ${FONT.mono}`;c.textAlign='right';c.fillText(String(n),LIST.x+LIST.w-14,y+37);c.textAlign='left';
  }
  // The scroll bar.
  if(rows.length>ROWS){const x=LIST.x+LIST.w+10,y0=LIST.y+6,hh=ROWS*LIST.row-12,bar=Math.max(40,hh*ROWS/rows.length),at=y0+(hh-bar)*top/(rows.length-ROWS);
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
  c.fillText(fresh?note:open?'↑ ↓ CHOOSE · CLICK OR ENTER: PICTURES, GO THERE · E: HEART':'PRESS E HERE TO BROWSE THE LOG, SEE BEFORE AND AFTER',LIST.x,y);
  c.textAlign='right';c.fillStyle=DIM;c.fillText(status!=='live'?'HEARTS OFFLINE':verified?'ONE HEART PER CHANGE':'SIGN IN WITH DISCORD TO GIVE HEARTS',w-40,y);c.textAlign='left';
  texture.needsUpdate=true;
 }
 paint();document.fonts?.ready.then(paint);
 const say=text=>{note=text;noteAt=performance.now();paint();ui.note.textContent=detail?text:'';setTimeout(()=>{if(note===text){paint();if(ui.note.textContent===text)ui.note.textContent='';}},6100);};

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
 document.head.appendChild(Object.assign(document.createElement('style'),{textContent:CSS}));
 const root=document.createElement('div');root.className='ship-log';
 root.style.cssText='position:fixed;inset:0;z-index:60;background:rgba(5,7,13,.82);display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;touch-action:none;user-select:none';
 canvas.style.cssText='display:block;max-width:calc(100vw - 24px);max-height:calc(100vh - 110px);width:1200px;height:auto;aspect-ratio:1600/920;border-radius:12px;cursor:pointer';
 root.appendChild(canvas);
 const bar=document.createElement('div');bar.style.cssText='display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:0 12px';
 const button=(label,aria,css='')=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',aria);
  b.style.cssText=`min-width:64px;height:52px;padding:0 18px;border-radius:12px;border:1px solid #3a4150;background:#151a24;color:${TEXT};font:500 18px ${FONT.mono};cursor:pointer;${css}`;bar.appendChild(b);return b;};
 const up=button('▲','Previous change'),give=button('♥ Heart','Give or take back a heart',`color:${ORANGE}`),down=button('▼','Next change'),
  more=button('Details','Pictures and details of this change',`color:${TEAL}`),near=button('Near you','Show only the changes near you'),done=button('Done','Close the ship log');
 root.appendChild(bar);document.body.appendChild(root);
 const ui=detailPanel(root);

 // The list's entry `i` picked (and scrolled into view).
 function choose(i){selected=T.MathUtils.clamp(i,0,Math.max(0,rows.length-1));if(selected<top)top=selected;else if(selected>=top+ROWS)top=selected-ROWS+1;paint();if(detail)showDetail(rows[selected]);}
 function scroll(n){top=T.MathUtils.clamp(top+n,0,Math.max(0,rows.length-ROWS));paint();}
 // Every change, or only those near where the log was opened; the picked change stays picked where it can.
 function filter(on){
  const e=rows[selected];rows=on&&here.length?here:log;
  const i=rows.indexOf(e);selected=0;top=0;choose(i<0?0:i);
  near.hidden=!here.length;near.textContent=filtered()?'All changes':`Near you · ${here.length}`;
  near.setAttribute('aria-label',filtered()?'Show every change':'Show only the changes near you');
 }
 function toggle(e=rows[selected]){
  if(!e)return;
  if(status!=='live'){say('LEO LIVE IS NOT CONNECTED: HEARTS CAN’T BE SAVED RIGHT NOW');return;}
  if(!verified){say('SIGN IN WITH DISCORD TO GIVE HEARTS');return;}
  hearts?.toggle(e.id,!mine.has(e.id));
 }
 // The list row (or favorite) under a point on the canvas, if any.
 function rowAt(ev){
  const r=canvas.getBoundingClientRect(),x=(ev.clientX-r.left)*PX[0]/r.width,y=(ev.clientY-r.top)*PX[1]/r.height;
  if(x>=LIST.x-14&&x<=LIST.x+LIST.w&&y>=LIST.y&&y<LIST.y+ROWS*LIST.row){const i=top+Math.floor((y-LIST.y)/LIST.row);return i<rows.length?{e:rows[i],i,heart:x>LIST.x+LIST.w-110}:null;}
  if(x>=FAV.x-24&&y>=LIST.y+80){const k=Math.floor((y-LIST.y-80)/104),e=favorites()[k];if(e)return {e,i:rows.indexOf(e),heart:false};}
  return null;
 }
 // Hovering a row shows its whole name, and what a click will show.
 function showTip(ev,h){
  if(!h||ev.pointerType==='touch'){ui.tip.hidden=true;return;}
  const e=h.e,what=e.shots?`${e.shots.length} before-and-after picture${e.shots.length>1?'s':''} · click to see them`:e.go?'Click to go there or read more':'Click for details';
  ui.tipName.textContent=e.name;ui.tipWhat.textContent=`${day(e.date)} · ${h.heart?'click to give or take back a heart':what}`;ui.tip.hidden=false;
  const r=ui.tip.getBoundingClientRect();
  ui.tip.style.left=Math.min(ev.clientX+16,innerWidth-r.width-12)+'px';ui.tip.style.top=(ev.clientY+22+r.height>innerHeight?ev.clientY-r.height-14:ev.clientY+22)+'px';
 }
 canvas.addEventListener('pointermove',ev=>{const h=rowAt(ev),i=h&&h.e===rows[h.i]?h.i:-1;if(i!==hover){hover=i;paint();}showTip(ev,h);});
 canvas.addEventListener('pointerleave',()=>{hover=-1;ui.tip.hidden=true;paint();});
 // A click on a change opens its details; a click on its heart gives or takes back a heart.
 canvas.addEventListener('click',ev=>{
  const h=rowAt(ev);if(!h)return;ui.tip.hidden=true;
  if(h.i<0)filter(false);
  choose(rows.indexOf(h.e));if(h.heart)toggle();else showDetail(h.e);
 });
 canvas.addEventListener('wheel',ev=>{ev.preventDefault();scroll(Math.sign(ev.deltaY)*3);},{passive:false});
 up.addEventListener('click',()=>choose(selected-1));down.addEventListener('click',()=>choose(selected+1));give.addEventListener('click',()=>toggle());
 more.addEventListener('click',()=>showDetail(rows[selected]));near.addEventListener('click',()=>filter(!filtered()));done.addEventListener('click',()=>hide());

 // A change's details, over the list: its name in full, its pictures, and the way there.
 let shot=0,split=50;
 function showDetail(e){
  if(!e)return;const first=detail!==e;detail=e;ui.tip.hidden=true;
  if(first){shot=0;split=50;ui.note.textContent='';}
  ui.eyebrow.textContent=`Change #${e.id} · ${day(e.date)}`;ui.title.textContent=e.name;
  ui.pull.href=PULL+e.id;
  const shots=e.shots||[];ui.pictures.hidden=!shots.length;ui.none.hidden=!!shots.length;
  ui.none.textContent=e.go?'No before-and-after pictures for this change yet, but you can go and see it.':'No before-and-after pictures or spot for this change.';
  if(shots.length&&first){
   ui.thumbs.replaceChildren(...shots.map((s,k)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',s.label);b.title=s.label;
    b.append(Object.assign(document.createElement('img'),{src:MEDIA+s.after,alt:''}));b.onclick=()=>showShot(k);return b;}));
   ui.thumbs.hidden=shots.length<2;
  }
  if(shots.length)showShot(shot);else showGo();
  showHeart();bar.hidden=true;ui.detail.hidden=false;
 }
 function showShot(k){
  const shots=detail.shots;shot=(k+shots.length)%shots.length;const s=shots[shot];
  ui.shotLabel.textContent=shots.length>1?`${s.label} · ${shot+1} of ${shots.length}`:s.label;ui.prev.hidden=ui.next.hidden=shots.length<2;
  [...ui.thumbs.children].forEach((b,j)=>b.setAttribute('aria-current',String(j===shot)));
  ui.wait.hidden=false;ui.wait.textContent='Loading the pictures…';let loaded=0;
  for(const [img,path,name] of [[ui.before,s.before,'before'],[ui.after,s.after,'after']]){
   img.onload=()=>{if(++loaded===2)ui.wait.hidden=true;if(name==='before'&&img.naturalWidth)ui.compare.style.aspectRatio=`${img.naturalWidth}/${img.naturalHeight}`;};
   img.onerror=()=>{ui.wait.hidden=false;ui.wait.textContent='The pictures could not load. Try again later.';};
   img.alt=`${s.label}, ${name} the change`;img.src=MEDIA+path;
  }
  setSplit(split);showGo();
 }
 // Go there: to the spot the shown pictures were taken from, else the change's own spot.
 const goSpot=()=>detail?.shots?.[shot]?.at||detail?.go||null;
 function showGo(){const q=goSpot();ui.go.hidden=!q;ui.go.textContent=detail?.shots?.[shot]?.at?'Go to this view':'Go there';}
 function go(){
  const q=goSpot(),spot=q&&readSpot('?'+q);if(!spot)return;
  const e=detail;hide();if(!onGo(spot)){show();showDetail(e);say('THAT SPOT COULDN’T BE REACHED FROM HERE');}
 }
 function setSplit(v){split=T.MathUtils.clamp(v,0,100);ui.after.style.clipPath=`inset(0 0 0 ${split}%)`;ui.line.style.left=split+'%';ui.compare.setAttribute('aria-valuenow',String(Math.round(split)));}
 function showHeart(){if(!detail)return;const own=mine.has(detail.id);ui.heart.textContent=`${own?'♥':'♡'} ${count(detail.id)}`;ui.heart.classList.toggle('mine',own);
  ui.heart.setAttribute('aria-label',`${count(detail.id)} hearts; ${own?'take back your heart':'give a heart'}`);}
 function closeDetail(){if(!detail)return;detail=null;ui.detail.hidden=true;bar.hidden=false;ui.before.removeAttribute('src');ui.after.removeAttribute('src');paint();}
 let dragging=null;
 ui.compare.addEventListener('pointerdown',ev=>{dragging=ev.pointerId;try{ui.compare.setPointerCapture(ev.pointerId);}catch{}drag(ev);});
 ui.compare.addEventListener('pointermove',ev=>{if(dragging===ev.pointerId)drag(ev);});
 ui.compare.addEventListener('pointerup',()=>{dragging=null;});ui.compare.addEventListener('pointercancel',()=>{dragging=null;});
 function drag(ev){const r=ui.compare.getBoundingClientRect();setSplit((ev.clientX-r.left)/r.width*100);}
 ui.prev.addEventListener('click',()=>showShot(shot-1));ui.next.addEventListener('click',()=>showShot(shot+1));
 ui.go.addEventListener('click',go);ui.heart.addEventListener('click',()=>toggle(detail));ui.back.addEventListener('click',closeDetail);
 ui.detail.addEventListener('click',ev=>{if(ev.target===ui.detail)closeDetail();});

 // Keys while open are the board's alone: caught before the walk's own listener sees them.
 function onKey(e){
  if(!open||e.ctrlKey||e.metaKey||e.altKey)return;
  e.stopImmediatePropagation();if(e.type!=='keydown')return;
  const k=e.code;
  if(/^(Arrow|Space|Page|Home|End|Backspace)/.test(k))e.preventDefault();
  if(detail){
   if(k==='Escape'||k==='Backspace')closeDetail();
   else if(k==='ArrowUp'||k==='KeyW')choose(selected-1);else if(k==='ArrowDown'||k==='KeyS')choose(selected+1);
   else if(detail.shots&&(k==='ArrowLeft'||k==='KeyA'))showShot(shot-1);else if(detail.shots&&(k==='ArrowRight'||k==='KeyD'))showShot(shot+1);
   else if(!e.repeat&&detail.shots&&k==='Space')setSplit(split>50?0:100);
   else if(!e.repeat&&(k==='KeyG'||k==='Enter'))go();
   else if(!e.repeat&&k==='KeyE')toggle(detail);
   return;
  }
  if(k==='Escape'){hide();return;}
  if(k==='ArrowUp'||k==='KeyW')choose(selected-1);
  else if(k==='ArrowDown'||k==='KeyS')choose(selected+1);
  else if(k==='PageUp')choose(selected-ROWS);else if(k==='PageDown')choose(selected+ROWS);
  else if(k==='Home')choose(0);else if(k==='End')choose(rows.length-1);
  else if(!e.repeat&&(k==='Enter'||k==='ArrowRight'))showDetail(rows[selected]);
  else if(!e.repeat&&k==='KeyF'&&here.length)filter(!filtered());
  else if(!e.repeat&&k==='KeyL'){hide();return;}
  else if(!e.repeat&&(k==='KeyE'||k==='Space'))toggle();
 }
 addEventListener('keydown',onKey,true);addEventListener('keyup',onKey,true);
 // near: where the walker is, to offer (and with nearFirst, start on) the changes made around it.
 function show({near:p=null,nearFirst=false}={}){
  if(open)return;open=true;root.style.display='flex';note='';hover=-1;
  here=p?nearby(p):[];filter(nearFirst);hearts?.request();onOpen();
 }
 function hide(){if(!open)return;closeDetail();filter(false);open=false;root.style.display='none';hover=-1;ui.tip.hidden=true;paint();onClose();}
 // The changes with a spot near p, newest first.
 function nearby(p){return log.filter(e=>spotsOf.get(e.id).some(s=>Math.abs(p.y-s.at[1])<NEAR.up&&Math.hypot(p.x-s.at[0],p.z-s.at[2])<NEAR.across));}

 return {
  groups:boards.map(b=>b.group),
  get isOpen(){return open;},
  open:show,close:hide,nearby,
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
   paint();showHeart();
  },
  refused(why){say(why==='sign-in'?'SIGN IN WITH DISCORD TO GIVE HEARTS':'THAT HEART WASN’T SAVED');},
  // For checks: what the board holds.
  get state(){return {log,rows,counts,mine,verified,status,selected,top,favorites:favorites(),detail,shot,split};},
 };
}

// The hover note and the details card, built once.
function detailPanel(root){
 const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};
 const tipName=el('span'),tipWhat=el('small'),tip=el('div',{className:'sl-tip',hidden:true},tipName,tipWhat);
 const before=el('img',{className:'sl-before',draggable:false}),after=el('img',{className:'sl-after',draggable:false}),line=el('div',{className:'sl-line'},el('i',{textContent:'⇔'}));
 const wait=el('p',{className:'sl-wait'});
 const compare=el('div',{className:'sl-compare',role:'slider',tabIndex:0},before,after,line,el('b',{className:'sl-tag before',textContent:'Before'}),el('b',{className:'sl-tag after',textContent:'After'}),wait);
 compare.setAttribute('aria-label','Drag to compare before and after');compare.setAttribute('aria-valuemin','0');compare.setAttribute('aria-valuemax','100');
 const prev=el('button',{type:'button',textContent:'‹'}),next=el('button',{type:'button',textContent:'›'}),shotLabel=el('span');
 prev.setAttribute('aria-label','Previous picture');next.setAttribute('aria-label','Next picture');
 const thumbs=el('div',{className:'sl-thumbs'});
 const pictures=el('div',{},compare,el('div',{className:'sl-shot'},prev,shotLabel,next),thumbs);
 const none=el('p',{className:'sl-none'});
 const go=el('button',{type:'button',className:'sl-go'}),heart=el('button',{type:'button',className:'sl-heart'}),
  pull=el('a',{target:'_blank',rel:'noopener',textContent:'How it was made ↗'}),back=el('button',{type:'button',className:'sl-back',textContent:'Back to the log'});
 const eyebrow=el('div',{className:'sl-eyebrow'}),title=el('h2'),note=el('div',{className:'sl-note',role:'status'});
 const keys=el('div',{className:'sl-keys',textContent:'Drag the pictures to compare · ← → pictures · ↑ ↓ other changes · G go there · Esc back'});
 const card=el('div',{className:'sl-card',role:'dialog'},eyebrow,title,pictures,none,el('div',{className:'sl-actions'},go,heart,pull,back),note,keys);
 card.setAttribute('aria-modal','true');
 const detail=el('div',{className:'sl-detail',hidden:true},card);
 root.append(detail,tip);
 return {tip,tipName,tipWhat,detail,eyebrow,title,pictures,compare,before,after,line,wait,prev,next,shotLabel,thumbs,none,go,heart,pull,back,note};
}
