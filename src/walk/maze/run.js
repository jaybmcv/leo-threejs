import {MAZE_START,X0,inMaze,inFront} from './layout.js';

// The Container Maze's clock and best times (CONTAINER_MAZE.md). Walking in through the way in starts the clock; the
// red button in the middle stops it. Leaving the maze any other way (back out, Respawn or Go to)
// drops the run. The clock shows at the top of the screen with a Give up button that walks you back to the start.
// Times go to Leo live's maze board (server/maze.mjs), kept for signed-in (verified Discord) players only; this
// browser also keeps its own best, so a guest or a solo walker still has a time to beat.
//   hold: hold.js's maze;  live(): the Leo live link or null;  goTo(at,yaw): put the walker somewhere (ship coords);
//   onOpen()/onClose(): the board sheet opened or closed (the walk stands still behind it);  muted(): Sound is off.
const BEST_KEY='leo-maze-best';
const clock=ms=>{const s=ms/1000,m=Math.floor(s/60);return `${m}:${(s-m*60).toFixed(1).padStart(4,'0')}`;};
const CSS=`
#maze-clock{position:fixed;left:50%;top:108px;transform:translateX(-50%);z-index:6;display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--orange);border-radius:999px;padding:7px 8px 7px 16px;font:400 11px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
#maze-clock[hidden],#maze-toast[hidden]{display:none}
#maze-clock b{font:500 20px/1 var(--mono);letter-spacing:.02em;color:var(--text);min-width:76px;text-align:right}
#maze-clock button{background:none;border:1px solid var(--hairline);border-radius:999px;padding:7px 11px;font:400 10px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase}
#maze-clock button:hover{border-color:var(--orange)}
#maze-toast{position:fixed;left:50%;top:108px;transform:translateX(-50%);z-index:6;background:var(--surface);border:1px solid var(--hairline);border-radius:999px;padding:10px 16px;font:400 11px/1 var(--mono);letter-spacing:.06em;pointer-events:none}
#maze-sheet .time{font:500 44px/1 var(--mono);letter-spacing:-.02em;margin:4px 0 8px;color:var(--text)}
#maze-sheet .note{margin:0 0 12px;font:400 13px/1.45 var(--sans);color:var(--body)}#maze-sheet .note b{color:var(--teal);font-weight:500}
#maze-sheet h3{font:400 10px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--teal);margin:14px 0 8px}
#maze-sheet ol{margin:0;padding:0;list-style:none;display:grid;gap:4px;font:400 12px/1.3 var(--mono)}
#maze-sheet li{display:flex;gap:10px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,.04)}#maze-sheet li span:first-child{color:var(--dim);min-width:18px}#maze-sheet li span:nth-child(2){flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#maze-sheet .empty{font:400 12px/1.4 var(--mono);color:var(--dim)}
#maze-sheet .mine{margin:10px 0 0;font:400 11px/1.4 var(--mono);color:var(--dim)}
#maze-sheet .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}#maze-sheet .back{background:var(--orange);border:1px solid var(--orange);border-radius:10px;padding:10px 14px;font:500 11px/1 var(--mono);color:#fff}`;

export function createMazeGame({hold,live,goTo,onOpen,onClose,muted=()=>false}){
 if(!hold||typeof document==='undefined')return null;
 document.head.append(Object.assign(document.createElement('style'),{textContent:CSS}));
 const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};
 const time=el('b',{textContent:'0:00.0'}),giveUp=el('button',{type:'button',textContent:'Give up'});
 const bar=el('div',{id:'maze-clock',hidden:true},el('span',{textContent:'Maze'}),time,giveUp),toast=el('div',{id:'maze-toast',hidden:true});
 const big=el('div',{className:'time'}),note=el('p',{className:'note'}),list=el('ol'),mine=el('p',{className:'mine'}),title=el('h2'),
  back=el('button',{type:'button',className:'back',textContent:'Back to the start'}),close=el('button',{type:'button',textContent:'Close'});
 close.dataset.close='';
 const sheet=el('div',{id:'maze-sheet',className:'sheet',hidden:true},el('div',{className:'card',role:'dialog'},el('div',{className:'eyebrow',textContent:'Container maze · Deck 1'}),
  title,big,note,el('h3',{textContent:'Fastest times'}),list,mine,el('div',{className:'row'},back,close)));
 document.body.append(bar,toast,sheet);
 let state='idle',t0=0,wasFront=false,ran=null,result=null,board={status:'loading',top:[],you:null},toastTimer=0,audio=null;
 const best=()=>{try{const v=+localStorage.getItem(BEST_KEY);return v>0?v:null;}catch{return null;}};
 const keepBest=ms=>{const b=best();if(b&&b<=ms)return false;try{localStorage.setItem(BEST_KEY,String(ms));}catch{}return true;};
 // A short beep on starting, and three rising notes on stopping the clock.
 function beep(notes){
  if(muted())return;try{audio||=new (globalThis.AudioContext||globalThis.webkitAudioContext)();}catch{return;}
  const c=audio;if(c.state==='suspended')c.resume().catch(()=>{});
  notes.forEach(([f,at,len])=>{const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+at;o.type='square';o.frequency.value=f;
   g.gain.setValueAtTime(.08,t);g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(g).connect(c.destination);o.start(t);o.stop(t+len+.02);});
 }
 function say(text,ms=3500){toast.textContent=text;toast.hidden=!bar.hidden;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},ms);}
 function show(){
  const r=result;title.textContent=ran!==null?'You found the button':'Container Maze';big.hidden=ran===null;big.textContent=ran!==null?clock(ran):'';
  note.textContent='';
  if(ran===null)note.append('Find the red button in the middle of the hold. The clock starts as you walk in through START and stops when you press it.');
  else if(!r)note.append('Saving your time…');
  else if(r.ok)note.append(...(r.newBest?[el('b',{textContent:'A new best'}),` · rank ${r.rank} on the board.`]:[`Your best is ${clock(r.best)}, rank ${r.rank}.`]));
  else note.append({'sign-in':'Connect Discord to put your times on the board.',offline:r.kept?'A new best in this browser. Not connected to Leo live, so it isn’t on the board.':'Not connected to Leo live: this time isn’t on the board.',
   rejected:'This time wasn’t accepted for the board.'}[r.why]||'');
  list.textContent='';
  if(!board.top.length)list.append(el('li',{className:'empty',textContent:board.status==='offline'?'The board is offline.':board.status==='loading'?'Loading…':'No times yet: be the first.'}));
  board.top.forEach((e,n)=>list.append(el('li',{},el('span',{textContent:String(n+1)}),el('span',{textContent:e.name}),el('span',{textContent:clock(e.ms)}))));
  const here=best();
  mine.textContent=[board.you?`Your best on the board: ${clock(board.you.ms)} · rank ${board.you.rank}`:board.status==='guest'?'Connect Discord to post times.':'',here?`Your best in this browser: ${clock(here)}`:''].filter(Boolean).join(' · ');
  back.hidden=!(state==='done');
 }
 function open(){
  board={...board,status:'loading'};const link=live();if(link?.live)link.maze('board');else board={status:'offline',top:[],you:null};
  show();if(sheet.hidden){onOpen?.();sheet.hidden=false;close.focus();}
 }
 function hide(){if(sheet.hidden)return;sheet.hidden=true;onClose?.();}
 function toStart(){const [x,y,z]=MAZE_START;hide();goTo(hold.toShip(x-2.2,y,z),Math.PI/2);}
 close.addEventListener('click',hide);back.addEventListener('click',toStart);
 giveUp.addEventListener('click',()=>{if(state==='running'){state='idle';bar.hidden=true;say('Run dropped');}toStart();});
 return {
  get running(){return state==='running';},
  // E near the button or the sign (hold.near): its prompt.
  near(p){const at=hold.near(p);if(!at)return null;return {kind:'maze',at,label:at==='sign'?'Container Maze best times':state==='running'?'Stop the clock':'Press the red button'};},
  use(t,now=performance.now()){
   if(t.at==='sign'){ran=null;result=null;open();return;}
   hold.press(now);
   if(state!=='running'){ran=null;result=null;open();if(state==='idle')say('Walk in through START to time a run');return;}
   state='done';ran=Math.round(now-t0);result=null;bar.hidden=true;beep([[660,0,.12],[880,.12,.12],[1320,.24,.3]]);
   const kept=keepBest(ran),link=live();
   if(link?.live)link.maze('finish',{ms:ran});else result={ok:false,why:'offline',kept};
   open();
  },
  // Each frame: start, run or drop the clock from where the walker is.
  update(p,now=performance.now()){
   hold.update(now);
   const q=hold.toLocal(p),inside=inMaze(q.x,q.y,q.z),front=inFront(q.x,q.y,q.z);
   if(state==='idle'&&inside&&wasFront&&q.x<X0+2){state='running';t0=now;bar.hidden=false;toast.hidden=true;beep([[880,0,.15]]);live()?.maze('start');}
   else if(state!=='idle'&&!inside){if(state==='running')say('Run dropped: you left the maze');state='idle';bar.hidden=true;}
   if(state==='running')time.textContent=clock(now-t0);
   wasFront=front;
  },
  // Leo live's answers: the board, and a finished run's result.
  fromServer(msg){
   if(msg.op==='board'){board={status:msg.verified?'ok':'guest',top:Array.isArray(msg.top)?msg.top:[],you:msg.you||null};if(!sheet.hidden)show();}
   else if(msg.op==='result'){result=msg;if(msg.ok)live()?.maze('board');if(!sheet.hidden)show();}
  },
  close:hide,
 };
}
