import {newGame,step,STEP,W,H,BALLS,POINTS} from './rules.js';
import {drawTable,commas,C,FONT} from './art.js';
import {createSound} from './sound.js';
import {recorder} from './replay.js';

// Pinball on screen (from tester feedback): a full-window overlay over the walk, like Alien Cat Invasion's and Paw
// Pool's, opened at the machine in the Recreation Hall (machine.js). The table stands up the screen under a strip with
// the score, the ball and the best. Hold the launch to draw the plunger back and let go; the flippers on two keys, the
// two halves of the screen, buttons on a touch screen, or a gamepad's shoulder buttons. Three balls a game. This
// browser keeps its own best. The shared board is Leo live's (server/pinball.mjs), through the page's `scores`:
//   scores.request()   ask for the board; false with no link. It arrives through fromServer({op:'board'})
//   scores.ticket()    ask for a ranked game's ticket (its seed); it arrives through fromServer({op:'ticket'})
//   scores.submit(r)   a ranked game is over: {ticket, log, steps, score}; false with no link
// A game started with a ticket in hand is ranked: it plays from the ticket's seed and writes down its buttons
// (replay.js), which the server plays again to check the score. Without one (a guest, no link, an old server) the game
// is a casual one, as before. Nothing waits on the board: an answer that never comes reads as unavailable.
// onBoard(board) hears every change of the board, for the one on the wall (machine.js).
const REPLY_MS=5000,RESULT_MS=15000;
const S=3,TOP=50,VW=W,VH=H+TOP,BEST_KEY='leo-pinball-best';
const KEYS={left:['ArrowLeft','KeyZ','ShiftLeft','KeyA'],right:['ArrowRight','Slash','ShiftRight','KeyD','KeyM'],launch:['Space','ArrowDown','Enter','KeyS']};
const NEWS={saved:'BALL SAVED',lanes:'MULTIPLIER UP',bank:`MARS BANK +${POINTS.bank}`,saucer:`MARS LANDING +${POINTS.saucer}`};

const readBest=()=>{try{return Number(localStorage.getItem(BEST_KEY))||0;}catch{return 0;}};
const saveBest=n=>{try{localStorage.setItem(BEST_KEY,String(n));}catch{}};

export function createPinball({onOpen=()=>{},onClose=()=>{},muted=()=>false,scores=null,onBoard=()=>{}}={}){
 const sound=createSound(muted);
 // The overlay: the canvas, a close button, and on touch screens the flipper and launch buttons.
 // (Shown and hidden by its display: an inline display would override the hidden attribute.)
 const root=document.createElement('div');root.className='pinball';
 root.style.cssText='position:fixed;inset:0;z-index:60;background:#05070d;display:none;flex-direction:column;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none';
 const canvas=document.createElement('canvas');canvas.width=VW*S;canvas.height=VH*S;canvas.style.cssText='display:block;touch-action:none';root.appendChild(canvas);
 const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Close the game');close.textContent='×';
 close.style.cssText='position:absolute;top:12px;right:14px;width:44px;height:44px;border-radius:22px;border:1px solid #3a4150;background:#11151d;color:#f4f0e8;font:500 26px/1 system-ui;cursor:pointer';
 root.appendChild(close);
 // (whether this is a touch screen is asked each time the game opens; the buttons show only on one)
 let touch=matchMedia('(pointer:coarse)').matches;const pads={left:false,right:false,launch:false};
 const bar=document.createElement('div');bar.className='pinball-pads';bar.style.cssText='display:none;gap:12px;margin-top:10px';
 for(const [k,label,aria] of [['left','◀ FLIP','Left flipper'],['launch','LAUNCH','Launch the ball'],['right','FLIP ▶','Right flipper']]){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',aria);
  b.style.cssText=`width:${k==='launch'?96:104}px;height:64px;border-radius:14px;border:1px solid #3a4150;background:#151a24;color:${k==='launch'?C.orange:C.text};font:700 15px ${FONT.mono}`;
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(screen!=='play'){begin();return;}pads[k]=true;b.setPointerCapture(e.pointerId);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{pads[k]=false;});
  bar.appendChild(b);
 }
 root.appendChild(bar);
 document.body.appendChild(root);
 const g2=canvas.getContext('2d');
 const text=(s,x,y,size,color,align='center',weight=700,font=FONT.mono)=>{g2.font=`${weight} ${size*S}px ${font}`;g2.fillStyle=color;g2.textAlign=align;g2.textBaseline='top';g2.fillText(s,x*S,y*S);};
 const pad=n=>String(n).padStart(7,'0');

 let open=false,screen='title',game=null,raf=0,last=0,acc=0,paused=false,best=readBest(),newBest=false,news=null;
 // The shared board ({status:'loading'|'ok'|'offline', verified, top, you}); the ticket for the next ranked game, or
 // why there is none; this game's button log and ticket id when it is ranked; its result from the server.
 let board={status:'loading',verified:false,top:[],you:null},boardTimer=0,ticket=null,why=null,rec=null,ranked=null,result=null,resultTimer=0;
 const clean=t=>Array.isArray(t)?t.filter(r=>r&&typeof r.name==='string'&&Number.isInteger(r.score)).slice(0,10):[];
 function setBoard(b){board={...board,...b};onBoard(board);}
 function request(){
  clearTimeout(boardTimer);if(!scores?.request()){setBoard({status:'offline'});return;}
  if(board.status!=='ok')setBoard({status:'loading'});
  boardTimer=setTimeout(()=>{if(board.status==='loading')setBoard({status:'offline'});},REPLY_MS);
 }
 function askTicket(){ticket=null;why=scores?.ticket()?null:'offline';}
 const down=new Set(),pointers=new Map();
 const held=k=>KEYS[k].some(c=>down.has(c))||pads[k]||[...pointers.values()].includes(k)||pad_(k);
 function pad_(k){const p=[...(navigator.getGamepads?.()||[])].find(Boolean);if(!p)return false;const b=i=>!!p.buttons[i]?.pressed;
  return k==='left'?b(4)||b(6)||b(14):k==='right'?b(5)||b(7)||b(15):b(0)||b(13)||(p.axes[1]||0)>.6;}
 function begin(){if(screen==='play')return;
  const t=ticket;ticket=null;game=newGame(t?t.seed:(Math.random()*2**31)|0);ranked=t?t.id:null;rec=t?recorder():null;result=null;clearTimeout(resultTimer);
  screen='play';paused=false;newBest=false;news={text:'PULL AND LET GO TO LAUNCH',until:4};}
 function finish(){screen='over';if(game.score>best){best=game.score;newBest=true;saveBest(best);}
  if(ranked){
   const r={ticket:ranked,log:rec.log,steps:rec.steps,score:game.score};ranked=null;
   if(scores?.submit(r)){result={pending:true};resultTimer=setTimeout(()=>{if(result?.pending)result={ok:false,why:'offline'};},RESULT_MS);}
   else result={ok:false,why:'offline'};
  }
  askTicket();}
 // Keys while open are the game's alone: caught before the walk's own listener sees them.
 function onKey(e){
  if(!open)return;const press=e.type==='keydown';
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  e.stopImmediatePropagation();
  if(press&&e.code==='Escape'){hide();return;}
  if(press)down.add(e.code);else down.delete(e.code);
  if(/^(Arrow|Space|Slash)/.test(e.code))e.preventDefault();
  if(press&&!e.repeat){if(paused){paused=false;return;}if(screen!=='play'&&(e.code==='Space'||e.code==='Enter'))begin();}
 }
 addEventListener('keydown',onKey,true);addEventListener('keyup',onKey,true);
 addEventListener('blur',()=>{down.clear();pointers.clear();if(open&&screen==='play')paused=true;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&open&&screen==='play')paused=true;});
 // A press on the table: the plunger while the ball waits in its lane, otherwise the flipper on that side.
 canvas.addEventListener('pointerdown',e=>{
  e.preventDefault();if(paused){paused=false;return;}if(screen!=='play'){begin();return;}
  const r=canvas.getBoundingClientRect(),waiting=game.b.lane&&!game.b.launching;
  pointers.set(e.pointerId,waiting?'launch':e.clientX<r.left+r.width/2?'left':'right');canvas.setPointerCapture(e.pointerId);
 });
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>pointers.delete(e.pointerId));
 close.addEventListener('click',()=>hide());
 // On a narrow screen the table starts under the close button.
 function fit(){const k0=Math.min((innerWidth-24)/VW,(innerHeight-(touch?100:20))/VH),under=innerWidth-VW*k0<130?56:0,room=(touch?100:20)+under,
  k=Math.min((innerWidth-24)/VW,(innerHeight-room)/VH);canvas.style.width=VW*k+'px';canvas.style.height=VH*k+'px';canvas.style.marginTop=under+'px';}
 addEventListener('resize',()=>{if(open)fit();});

 function loop(now){
  if(!open)return;raf=requestAnimationFrame(loop);
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(screen==='play'&&!paused){
   acc+=dt;const input={left:held('left'),right:held('right'),launch:held('launch')};
   while(acc>=STEP){acc-=STEP;rec?.step(input);const ev=step(game,input);
    if(ev.length){sound.play(ev);for(const e of ev)if(NEWS[e])news={text:e==='lanes'?`MULTIPLIER ${game.mult}X`:NEWS[e],until:1.6};
     if(ev.includes('ball'))news={text:`BALL ${game.ball}`,until:1.6};}
    if(game.phase==='over'){finish();break;}}
   if(news&&(news.until-=dt)<=0)news=null;
  }else if(screen!=='play'&&pad_('launch'))begin();
  draw(now);
 }
 function hud(){
  g2.fillStyle='#0a0e18';g2.fillRect(0,0,VW*S,TOP*S);g2.fillStyle=C.orange;g2.fillRect(0,(TOP-1)*S,VW*S,S);
  const score=game?.score||0;
  text('SCORE',10,8,7,C.dim,'left');text(pad(score),10,20,13,C.text,'left');
  text('BALL',140,8,7,C.dim);text(game&&screen==='play'?`${game.ball}/${BALLS}`:'-',140,20,13,C.teal);
  text('BEST',230,8,7,C.dim,'right');text(pad(Math.max(best,score)),230,20,11,C.orange,'right');
  if(game?.mult>1&&screen==='play')text(`${game.mult}X`,186,21,10,C.gold);
  if(game&&screen==='play')text(rec?'RANKED':'CASUAL',230,37,5.5,rec?C.teal:C.dim,'right');
 }
 function draw(now){
  const g=g2;g.fillStyle=C.back;g.fillRect(0,0,VW*S,VH*S);hud();
  g.save();g.translate(0,TOP*S);drawTable(g,S,screen==='title'?null:game,now);g.restore();
  if(screen==='title')drawTitle(now);
  else if(screen==='over')drawOver(now);
  else if(news){g.fillStyle='rgba(5,7,13,.72)';g.fillRect(20*S,(TOP+222)*S,200*S,22*S);text(news.text,120,TOP+228,9,C.gold);}
  if(paused){g.fillStyle='rgba(5,7,13,.7)';g.fillRect(0,0,VW*S,VH*S);text('PAUSED',120,210,16,C.text);text('PRESS ANY KEY',120,234,7,C.dim);}
 }
 function veil(){g2.fillStyle='rgba(5,7,13,.8)';g2.fillRect(0,TOP*S,VW*S,H*S);}
 // The shared board's top n from y down, or what stands in for it: loading, empty or unavailable.
 function boardLines(y,n){
  if(board.status!=='ok'||!board.top.length){
   const [a,b]=board.status==='loading'?['LOADING THE BOARD…','']:board.status==='offline'?['BOARD UNAVAILABLE','CASUAL PLAY STILL WORKS']:['NO SCORES YET','BE THE FIRST ON THE BOARD'];
   text(a,120,y+10,8,board.status==='offline'?C.gold:C.text);if(b)text(b,120,y+24,6,C.dim);return;}
  board.top.slice(0,n).forEach((r,i)=>{const yy=y+i*10.5,c=i?C.text:C.gold;
   text(`${i+1}.`,36,yy,7,C.dim,'left');text(r.name.toUpperCase().slice(0,15),52,yy,7,c,'left');text(commas(r.score),204,yy,7,c,'right');});
 }
 // Why a game isn't ranked, in a few words.
 const casual=()=>board.status==='offline'||why==='offline'?'BOARD UNAVAILABLE':why==='sign-in'||board.status==='ok'&&!board.verified?'CONNECT DISCORD TO POST':why==='away'?'STAND AT THE MACHINE':'NOT RANKED';
 function drawTitle(now){
  veil();
  text('LEO',120,TOP+16,30,C.orange,'center',800,FONT.display);text('PINBALL',120,TOP+52,20,C.teal,'center',800,FONT.display);
  const lines=touch?[['LAUNCH','HOLD, LET GO'],['FLIPPERS','◀ FLIP · FLIP ▶'],['OR','TAP EACH HALF']]:
   [['LAUNCH','HOLD SPACE, LET GO'],['FLIPPERS','← →  OR  Z /'],['','OR CLICK EACH HALF'],['GAMEPAD','A · LB RB']];
  lines.forEach(([a,b],i)=>{const y=TOP+88+i*12;text(a,40,y,7,C.dim,'left');text(b,200,y,7,C.text,'right');});
  [['BUMPER',POINTS.bumper],['LIGHT L-E-O','MULTIPLIER'],['DROP BANK',POINTS.bank],['MARS SAUCER',POINTS.saucer]].forEach(([a,b],i)=>{
   const y=TOP+142+i*11;text(a,40,y,6.5,C.dim,'left');text(String(b),200,y,6.5,C.gold,'right');});
  text('HIGH SCORES',120,TOP+194,9,C.orange,'center',800,FONT.display);boardLines(TOP+210,5);
  text(`YOUR BEST  ${pad(best)}`,120,TOP+272,8,C.text);
  text(ticket?'SIGNED IN · THIS GAME IS RANKED':`3 BALLS · CASUAL: ${casual()}`,120,TOP+286,6,ticket?C.teal:C.dim);
  if((now/600|0)%2===0)text(touch?'TAP TO PLAY':'SPACE OR CLICK TO PLAY',120,TOP+330,10,C.orange);
  text(touch?'TAP × TO RETURN TO LEO':'ESC RETURNS TO LEO',120,TOP+352,7,C.dim);
 }
 // What became of this game's score on the shared board.
 function outcome(){
  if(result?.pending)return ['CHECKING YOUR GAME…',C.dim];
  if(result?.ok)return [result.newBest?`ON THE BOARD! RANK ${result.rank}`:result.rank?`POSTED · YOUR BOARD BEST ${commas(result.best)} · #${result.rank}`:'POSTED',C.teal];
  if(result)return [{'sign-in':'CONNECT DISCORD TO POST SCORES',rejected:'THIS GAME COULD NOT BE CHECKED: NOT POSTED',used:'THIS GAME WAS ALREADY POSTED'}[result.why]||'BOARD UNAVAILABLE: SCORE NOT POSTED',C.gold];
  return ['CASUAL GAME · '+casual(),C.dim];
 }
 function drawOver(now){
  veil();
  text('GAME OVER',120,TOP+36,22,C.orange,'center',800,FONT.display);
  text(pad(game.score),120,TOP+72,18,C.text);
  text(newBest?'NEW BEST!':`YOUR BEST ${pad(best)}`,120,TOP+98,9,newBest?C.gold:C.dim);
  const [line,color]=outcome();text(line,120,TOP+114,6,color);
  text('HIGH SCORES',120,TOP+136,9,C.orange,'center',800,FONT.display);boardLines(TOP+152,10);
  if((now/600|0)%2===0)text(touch?'TAP TO PLAY AGAIN':'SPACE TO PLAY AGAIN',120,TOP+300,10,C.orange);
  text(touch?'TAP × TO RETURN TO LEO':'ESC RETURNS TO LEO',120,TOP+322,7,C.dim);
 }
 function show(){if(open)return;open=true;root.style.display='flex';touch=matchMedia('(pointer:coarse)').matches;bar.style.display=touch?'flex':'none';screen='title';paused=false;down.clear();pointers.clear();fit();request();askTicket();onOpen();last=performance.now();acc=0;raf=requestAnimationFrame(loop);}
 // (a ranked game left unfinished is dropped: its ticket goes unused, and the next asked for replaces it)
 function hide(){if(!open)return;open=false;root.style.display='none';cancelAnimationFrame(raf);down.clear();pointers.clear();for(const k in pads)pads[k]=false;
  if(screen==='play'&&game&&game.score>best){best=game.score;saveBest(best);}ranked=null;onClose();}
 return {
  open:show,close:hide,
  get isOpen(){return open;},
  // What Leo live says (server/pinball.mjs): the board, the top ten changed, a ticket, a ranked game's result.
  fromServer(msg){
   if(msg?.op==='board'){clearTimeout(boardTimer);setBoard({status:'ok',verified:!!msg.verified,top:clean(msg.top),you:msg.you||null});}
   else if(msg?.op==='top'&&Array.isArray(msg.top))setBoard({status:'ok',top:clean(msg.top)});
   else if(msg?.op==='ticket'){if(msg.ok&&typeof msg.id==='string'&&Number.isInteger(msg.seed)){ticket={id:msg.id,seed:msg.seed};why=null;}else{ticket=null;why=msg.why||'offline';}}
   else if(msg?.op==='result'){clearTimeout(resultTimer);result={...msg,pending:false};if(msg.ok)request();}
  },
  // The link to Leo live came up (true) or went (false). A ranked game under way keeps its ticket through a reconnect
  // (the server holds it by account): asking for another would drop it, and the game's finish with it.
  link(up){if(up){request();if(open&&!(screen==='play'&&ranked))askTicket();}else{clearTimeout(boardTimer);ticket=null;why='offline';setBoard({status:'offline'});}},
  get board(){return board;},
  // For checks: the state and a way to start without a key.
  get state(){return {screen,game,paused,best,board,ranked:!!rec&&screen==='play',ticket,why,result,steps:rec?.steps??null,touch};},
  _begin:begin,
 };
}
