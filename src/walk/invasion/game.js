import {inOtherside} from '../net/otherside.js';
import {SPRITES,COLORS,spriteCanvas} from './sprites.js';
import {newGame,step,alive,alienBox,W,H,STEP,PLAYER,SHIELDS,GROUND,MOTHERSHIP} from './rules.js';
import {createSound} from './sound.js';

// Alien Cat Invasion on screen (feedback-inbox #69): a full-window overlay over the walk with the title, play, pause
// and game-over screens, as the approved mock-up. The 240 x 270 screen is drawn at three canvas pixels per pixel, so
// the lettering is crisp, and scaled to fit. Keys, gamepad and on-screen buttons; Esc or the close button leave.
// It runs its own loop only while open. The leaderboard is the page's: `scores` asks the live server (main.js).
//   scores.request()          ask for the board; it arrives through setBoard
//   scores.start()            a game starts (the server times it)
//   scores.submit(score,wave) a game ended; the result arrives through setResult
// setBoard({status:'ok'|'guest'|'offline'|'loading', top:[{name,score}], you:{score,rank}|null})
// setResult({ok, best, rank, newBest} | {ok:false, why:'sign-in'|'offline'|'rejected'})
const S=3,FONT='"JetBrains Mono", ui-monospace, "Courier New", monospace';
const KEYS={left:['ArrowLeft','KeyA'],right:['ArrowRight','KeyD'],fire:['Space','ArrowUp','KeyW']};

export function createInvasion({onOpen=()=>{},onClose=()=>{},muted=()=>false,scores}){
 const sound=createSound(muted);
 // The overlay: the canvas, a close button, and on touch screens the buttons.
 // (Shown and hidden by its display: an inline display would override the hidden attribute.)
 const root=document.createElement('div');root.className='invasion';
 root.style.cssText='position:fixed;inset:0;z-index:60;background:#05070d;display:none;flex-direction:column;align-items:center;justify-content:center;touch-action:none;user-select:none';
 const canvas=document.createElement('canvas');canvas.width=W*S;canvas.height=H*S;canvas.style.cssText='image-rendering:pixelated;display:block';root.appendChild(canvas);
 const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Close the game');close.textContent='×';
 close.style.cssText='position:absolute;top:12px;right:14px;width:44px;height:44px;border-radius:22px;border:1px solid #3a4150;background:#11151d;color:#f4f0e8;font:500 26px/1 system-ui;cursor:pointer';
 root.appendChild(close);
 const touch=matchMedia('(pointer:coarse)').matches,pads={left:false,right:false,fire:false};
 if(touch){
  const bar=document.createElement('div');bar.style.cssText='display:flex;gap:14px;margin-top:10px';
  for(const [k,label] of [['left','◀'],['right','▶'],['fire','FIRE']]){
   const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',k==='fire'?'Fire':k==='left'?'Move left':'Move right');
   b.style.cssText=`width:${k==='fire'?110:76}px;height:64px;border-radius:14px;border:1px solid #3a4150;background:#151a24;color:${k==='fire'?COLORS.accent:'#f4f0e8'};font:700 18px ${FONT}`;
   b.addEventListener('pointerdown',e=>{e.preventDefault();pads[k]=true;b.setPointerCapture(e.pointerId);if(screen!=='play')begin();});
   for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{pads[k]=false;});
   bar.appendChild(b);
  }
  root.appendChild(bar);
 }
 document.body.appendChild(root);
 const g2=canvas.getContext('2d');
 // Sprites drawn once at the canvas's scale; the backdrops too.
 const art={};
 const sprite=(rows,palette)=>spriteCanvas(rows,palette,S);
 for(const [k,s] of Object.entries(SPRITES))art[k]=s.frames?s.frames.map(f=>sprite(f,s.palette)):[sprite(s.rows,s.palette)];
 const mini=spriteCanvas(SPRITES.leo.rows,SPRITES.leo.palette,1);
 function backdrop(seed,mars){
  const c=Object.assign(document.createElement('canvas'),{width:W*S,height:H*S}),g=c.getContext('2d');g.fillStyle='#05070d';g.fillRect(0,0,c.width,c.height);
  let s=seed;const r=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  for(let i=0;i<120;i++){const b=120+r()*135|0;g.fillStyle=`rgb(${b},${b},${Math.min(255,b+25)})`;g.fillRect((r()*W|0)*S,(r()*H|0)*S,S,S);}
  const [cx,cy,rad,dim]=mars;let n=7;const q=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  for(let y=cy-rad;y<=cy+rad;y+=2)for(let x=cx-rad;x<=cx+rad;x+=2){const dx=x-cx,dy=y-cy;if(Math.hypot(dx,dy)>rad)continue;
   const light=Math.max(.18,1-((dx+rad*.45)**2+(dy+rad*.45)**2)/(rad*rad*2.2)),k=(.85+q()*.3)*(Math.sin(dy*.18+dx*.05)>.75?.8:1)*light*dim;
   g.fillStyle=`rgb(${200*k|0},${92*k|0},${52*k|0})`;g.fillRect(x*S,y*S,2*S,2*S);}
  return c;
 }
 const titleBack=backdrop(11,[120,300,92,.75]),playBack=backdrop(5,[192,112,50,.5]);
 const text=(s,x,y,size,color,align='left')=>{g2.font=`700 ${size*S}px ${FONT}`;g2.fillStyle=color;g2.textAlign=align;g2.textBaseline='top';g2.fillText(s,x*S,y*S);};
 const pad=n=>String(n).padStart(5,'0');

 let open=false,screen='title',game=null,raf=0,last=0,acc=0,paused=false,board={status:'loading',top:[],you:null},result=null,best=0;
 const down=new Set();
 const held=k=>KEYS[k].some(c=>down.has(c))||pads[k]||pad_(k);
 function pad_(k){const p=[...(navigator.getGamepads?.()||[])].find(Boolean);if(!p)return false;const x=p.axes[0]||0;
  return k==='left'?x<-.4||p.buttons[14]?.pressed:k==='right'?x>.4||p.buttons[15]?.pressed:p.buttons[0]?.pressed||p.buttons[1]?.pressed;}
 function begin(){if(screen==='play')return;game=newGame((Math.random()*2**31)|0);screen='play';result=null;paused=false;scores?.start();}
 function finish(){screen='over';sound.stop();best=Math.max(best,game.score);scores?.submit(game.score,game.wave);}
 // Keys while open are the game's alone: caught before the walk's own listener sees them.
 function onKey(e){
  if(!open)return;const press=e.type==='keydown';
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  e.stopImmediatePropagation();
  if(press&&e.code==='Escape'){hide();return;}
  if(press)down.add(e.code);else down.delete(e.code);
  if(/^(Arrow|Space)/.test(e.code))e.preventDefault();
  if(press&&!e.repeat){if(paused){paused=false;return;}if(screen!=='play'&&(e.code==='Space'||e.code==='Enter'))begin();}
 }
 addEventListener('keydown',onKey,true);addEventListener('keyup',onKey,true);
 addEventListener('blur',()=>{down.clear();if(open&&screen==='play')paused=true;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&open&&screen==='play')paused=true;});
 canvas.addEventListener('pointerdown',()=>{if(paused){paused=false;return;}if(screen!=='play')begin();});
 close.addEventListener('click',()=>hide());
 function fit(){const room=touch?100:20,k=Math.min((innerWidth-24)/W,(innerHeight-room)/H);canvas.style.width=W*k+'px';canvas.style.height=H*k+'px';}
 addEventListener('resize',()=>{if(open)fit();});

 function loop(now){
  if(!open)return;raf=requestAnimationFrame(loop);
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(screen==='play'&&!paused){
   acc+=dt;const input={left:held('left'),right:held('right'),fire:held('fire')};
   while(acc>=STEP){acc-=STEP;sound.play(step(game,input));if(game.phase==='over'){finish();break;}}
   if(!game.mother)sound.quiet();
  }else if(screen!=='play'&&pad_('fire'))begin();
  draw(now);
 }
 function draw(now){
  const g=g2;
  if(screen==='title'){g.drawImage(titleBack,0,0);drawTitle(now);return;}
  g.drawImage(playBack,0,0);drawPlay(now);
  if(screen==='over')drawOver(now);
  if(paused){g.fillStyle='rgba(5,7,13,.7)';g.fillRect(0,0,W*S,H*S);text('PAUSED',W/2,118,16,COLORS.text,'center');text('PRESS ANY KEY',W/2,140,7,COLORS.dim,'center');}
 }
 function drawTitle(now){
  text('ALIEN CAT',120,22,20,COLORS.accent,'center');text('INVASION',120,44,20,COLORS.text,'center');text('DEFEND LEO',120,68,8,COLORS.dim,'center');
  g2.drawImage(art.leo[0],105*S,82*S);
  [['mothership','= ? MYSTERY',62],['scout','= 30 POINTS',64],['tabby','= 20 POINTS',64],['brute','= 10 POINTS',64]].forEach(([k,label,x],i)=>{
   const y=114+i*16;g2.drawImage(art[k][0],x*S,y*S);text(label,84,y+1,8,COLORS.text);});
  panel(28,182,184,58);text('TOP SCORES · SIGNED-IN',120,186,7,COLORS.ground,'center');
  boardLines(36,198,3,204);
  text(board.you?`YOUR BEST  ${pad(board.you.score)}`:board.status==='guest'?(inOtherside?'':'SIGN IN WITH DISCORD TO POST'):board.status==='offline'?'OFFLINE: SCORES NOT SAVED':'',120,230,6.5,COLORS.dim,'center');
  g2.fillStyle='rgba(5,7,13,.78)';g2.fillRect(0,245*S,W*S,25*S);
  if((now/600|0)%2===0)text(touch?'TAP TO PLAY':'SPACE OR TAP TO PLAY',120,250,8,COLORS.accent,'center');
  text(touch?'TAP × TO RETURN TO LEO':'ESC RETURNS TO LEO',120,261,6,COLORS.dim,'center');
 }
 function panel(x,y,w,h){g2.fillStyle='rgba(5,7,13,.78)';g2.fillRect(x*S,y*S,w*S,h*S);g2.strokeStyle=COLORS.ground;g2.lineWidth=S;g2.strokeRect(x*S,y*S,w*S,h*S);}
 function boardLines(x,y,n,right){
  if(board.status==='loading'){text('LOADING…',120,y+10,7,COLORS.dim,'center');return;}
  if(!board.top.length){text(board.status==='offline'?'THE BOARD IS OFFLINE':'NO SCORES YET: BE FIRST',120,y+10,7,COLORS.dim,'center');return;}
  board.top.slice(0,n).forEach((r,i)=>{const yy=y+i*10;text(`${i+1}. ${r.name.toUpperCase().slice(0,16)}`,x,yy,7,COLORS.text);text(pad(r.score),right,yy,7,COLORS.accent,'right');});
 }
 function drawPlay(now){
  const gm=game;
  text('SCORE',8,4,7,COLORS.dim);text(pad(gm.score),8,13,8,COLORS.accent);
  text('BEST',120,4,7,COLORS.dim,'center');text(pad(Math.max(best,board.you?.score||0,board.top[0]?.score||0,gm.score)),120,13,8,COLORS.text,'center');
  text('WAVE '+gm.wave,232,4,7,COLORS.dim,'right');
  if(gm.mother)g2.drawImage(art.mothership[0],Math.round(gm.mother.x)*S,MOTHERSHIP.y*S);
  for(const a of alive(gm)){const b=alienBox(gm,a);g2.drawImage(art[a.kind][gm.formation.frame],b.x*S,b.y*S);}
  for(const b of gm.booms){if(b.worth){text(String(b.worth),b.x+8,b.y,7,COLORS.accent,'center');continue;}if(b.small){g2.fillStyle=COLORS.bomb;g2.fillRect(b.x*S,(GROUND-3)*S,5*S,2*S);continue;}g2.drawImage(art.boom[0],b.x*S,b.y*S);}
  g2.fillStyle=SPRITES.shield.palette.S;
  gm.shields.forEach((bits,i)=>{for(let k=0;k<bits.length;k++)if(bits[k])g2.fillRect((SHIELDS.xs[i]+k%SHIELDS.w)*S,(SHIELDS.y+(k/SHIELDS.w|0))*S,S,S);});
  if(gm.player.alive)g2.drawImage(art.leo[0],Math.round(gm.player.x)*S,PLAYER.y*S);
  if(gm.shot){g2.fillStyle=COLORS.shot;g2.fillRect(gm.shot.x*S,Math.round(gm.shot.y)*S,S,5*S);}
  g2.fillStyle=COLORS.bomb;for(const b of gm.bombs){const y=Math.round(b.y);(b.frame?[[2,0],[1,1],[0,2],[1,3],[2,4],[1,5]]:[[0,0],[1,1],[2,2],[1,3],[0,4],[1,5]]).forEach(([dx,dy])=>g2.fillRect((b.x+dx)*S,(y+dy)*S,S,S));}
  g2.fillStyle=COLORS.ground;g2.fillRect(0,GROUND*S,W*S,S);
  text(String(gm.lives),8,256,8,COLORS.text);for(let i=0;i<Math.min(gm.lives-1,6);i++)g2.drawImage(mini,0,0,15,18,(20+i*10)*S,256*S,7.5*S,9*S);
  text(touch?'':'ESC TO LEAVE',232,258,6,COLORS.dim,'right');
  if(gm.phase==='between')text('WAVE '+(gm.wave+1),120,120,14,COLORS.text,'center');
 }
 function drawOver(now){
  g2.fillStyle='rgba(5,7,13,.82)';g2.fillRect(0,0,W*S,H*S);
  text('GAME OVER',120,36,20,COLORS.accent,'center');text(`SCORE ${pad(game.score)} · WAVE ${game.wave}`,120,62,8,COLORS.text,'center');
  const line=!result?'SAVING…':result.ok?(result.newBest?`NEW BEST! RANK ${result.rank||'-'}`:`YOUR BEST ${pad(result.best)} · RANK ${result.rank||'-'}`):
   result.why==='sign-in'?(inOtherside?'SCORE NOT SAVED':'SIGN IN WITH DISCORD TO POST SCORES'):result.why==='offline'?'OFFLINE: SCORE NOT SAVED':'SCORE NOT ACCEPTED';
  text(line,120,76,7,result?.ok?COLORS.ground:COLORS.dim,'center');
  panel(28,92,184,124);text('TOP 10 · SIGNED-IN PLAYERS',120,96,7,COLORS.ground,'center');boardLines(36,108,10,204);
  if((now/600|0)%2===0)text(touch?'TAP TO PLAY AGAIN':'SPACE TO PLAY AGAIN',120,228,8,COLORS.accent,'center');
  text(touch?'TAP × TO RETURN TO LEO':'ESC RETURNS TO LEO',120,242,6,COLORS.dim,'center');
 }
 function show(){if(open)return;open=true;root.style.display='flex';screen='title';paused=false;down.clear();fit();scores?.request();onOpen();last=performance.now();acc=0;raf=requestAnimationFrame(loop);}
 function hide(){if(!open)return;open=false;root.style.display='none';cancelAnimationFrame(raf);sound.stop();down.clear();for(const k in pads)pads[k]=false;
  if(screen==='play'&&game&&game.score>0)scores?.submit(game.score,game.wave);onClose();}
 return {
  open:show,close:hide,
  get isOpen(){return open;},
  get playing(){return open;},
  setBoard(b){board={top:[],you:null,...b};},
  setResult(r){result=r;if(r?.ok)scores?.request();},
  // For checks: the state and a way to step without the loop.
  get state(){return {screen,game,board,result,paused};},
  _begin:begin,
 };
}
