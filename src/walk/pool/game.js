import {newGame,step,kick,aim,left,TABLE,R,STEP,POCKETS,HEAD,colorOf,striped,pocketLook} from './rules.js';
import {createSound} from './sound.js';

// Paw Pool on screen (POOL.md): a full-window overlay over the walk, like Alien Cat Invasion's, with the table seen from
// above. Cosmo's leg stands in for a cue: aim with the mouse, a drag, the arrow keys or a stick, and a white line shows
// where the cue ball will strike and where that ball and the cue ball go next. Hold to kick: the power bar rises and
// falls, the leg winds back with it, and letting go kicks. Practice: pot all fifteen in any order against the clock.
// The leaderboard is the page's: `scores` asks the live server (main.js).
//   scores.request()          ask for the board; it arrives through setBoard
//   scores.start()            a rack starts (the server times it)
//   scores.submit(ms,shots)   a rack cleared; the result arrives through setResult
// setBoard({status:'ok'|'guest'|'offline'|'loading', top:[{name,ms}], you:{ms,rank}|null})
// setResult({ok, ms, best, rank, newBest} | {ok:false, why:'sign-in'|'offline'|'rejected'})
const FONT={display:'"Archivo", "Sora", sans-serif',mono:'"JetBrains Mono", ui-monospace, monospace'};
const C={back:'#05070d',text:'#f4f0e8',dim:'#a6a5b4',orange:'#f85800',teal:'#2fd6c5',navy:'#233b4b',rail:'#1b2f3d',bronze:'#9d7950',pocket:'#06080b',
 fur:'#2f56d8',shorts:'#d89a3a',shoe:'#f4f0e8',sole:'#b9b4aa'};
const KEYS={left:['ArrowLeft','KeyA'],right:['ArrowRight','KeyD'],fine:['ShiftLeft','ShiftRight'],kick:['Space','Enter']};
// The leg's swing in seconds, the power bar's rise-and-fall, the aim's turn rate (radians a second, a fifth with Shift).
const SWING=.14,PERIOD=1.8,TURN=1.2;
const OUTER=[TABLE.w+2*TABLE.rail,TABLE.h+2*TABLE.rail];
const clock=ms=>{const s=Math.max(0,ms)/1000;return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;};

export function createPawPool({onOpen=()=>{},onClose=()=>{},muted=()=>false,scores}){
 const sound=createSound(muted);
 // The overlay: the canvas, a close button and, on touch screens, a kick button to hold.
 // (Shown and hidden by its display: an inline display would override the hidden attribute.)
 const root=document.createElement('div');root.className='paw-pool';
 root.style.cssText='position:fixed;inset:0;z-index:60;background:'+C.back+';display:none;touch-action:none;user-select:none';
 const canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair';root.appendChild(canvas);
 const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Close the game');close.textContent='×';
 close.style.cssText='position:absolute;top:12px;right:14px;width:44px;height:44px;border-radius:22px;border:1px solid #3a4150;background:#11151d;color:#f4f0e8;font:500 26px/1 system-ui;cursor:pointer';
 root.appendChild(close);
 const touch=matchMedia('(pointer:coarse)').matches;
 const kickButton=document.createElement('button');kickButton.type='button';kickButton.textContent='HOLD TO KICK';kickButton.setAttribute('aria-label','Hold to kick');
 kickButton.style.cssText=`position:absolute;right:16px;bottom:16px;width:132px;height:72px;border-radius:16px;border:1px solid #3a4150;background:#151a24;color:${C.orange};font:700 15px ${FONT.mono};display:${touch?'block':'none'}`;
 root.appendChild(kickButton);
 document.body.appendChild(root);
 const g2=canvas.getContext('2d');

 let open=false,screen='title',game=null,raf=0,last=0,acc=0,board={status:'loading',top:[],you:null},result=null,doneAt=-Infinity;
 let angle=0,charge=0,swing=null,padKick=false;
 const down=new Set();
 const held=k=>KEYS[k].some(c=>down.has(c));
 // The view: table metres to screen pixels. On a tall screen the table turns to stand up the long way.
 const view={w:0,h:0,ratio:1,k:1,ox:0,oy:0,tall:false};
 function fit(){
  const w=innerWidth,h=innerHeight,ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
  const tall=h>w*1.15,top=78,bottom=touch?104:52,side=58,[ww,wh]=tall?[OUTER[1],OUTER[0]]:OUTER;
  const k=Math.min((w-2*side)/(ww+.6),(h-top-bottom)/(wh+.6));
  Object.assign(view,{w,h,ratio,k,tall,ox:w/2,oy:top+(h-top-bottom)/2});
 }
 addEventListener('resize',()=>{if(open)fit();});
 const toWorld=(sx,sy)=>view.tall?[(sy-view.oy)/view.k,-(sx-view.ox)/view.k]:[(sx-view.ox)/view.k,(sy-view.oy)/view.k];
  const inWorld=()=>{const {ratio:r,k}=view;view.tall?g2.setTransform(0,k*r,-k*r,0,view.ox*r,view.oy*r):g2.setTransform(k*r,0,0,k*r,view.ox*r,view.oy*r);};
 const onScreen=()=>g2.setTransform(view.ratio,0,0,view.ratio,0,0);

 const power=now=>{if(!charge)return 0;const t=((now-charge)/1000/PERIOD)%1;return 1-Math.abs(1-2*t);};
 const canAim=()=>open&&screen==='play'&&game.phase==='aim'&&!swing;
 function aimAt(sx,sy){if(!canAim()||charge)return;const [x,y]=toWorld(sx,sy),cue=game.balls[0];if(Math.hypot(x-cue.x,y-cue.y)>.05)angle=Math.atan2(y-cue.y,x-cue.x);}
 function startCharge(now=performance.now()){if(canAim()&&!charge)charge=now;}
 function release(now=performance.now()){if(!charge)return;const p=Math.max(.04,power(now));charge=0;if(canAim())swing={t:0,power:p,angle};}
 function begin(){
  if(screen==='play'||performance.now()-doneAt<700)return;
  game=newGame((Math.random()*2**31)|0);screen='play';result=null;charge=0;swing=null;angle=0;acc=0;sound.rack();scores?.start();
 }
 function finish(){screen='done';doneAt=performance.now();charge=0;scores?.submit(Math.round(game.t*1000),game.shots);}

 // Keys while open are the game's alone: caught before the walk's own listener sees them.
 function onKey(e){
  if(!open)return;const press=e.type==='keydown';
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  e.stopImmediatePropagation();
  if(press&&e.code==='Escape'){hide();return;}
  if(press)down.add(e.code);else down.delete(e.code);
  if(/^(Arrow|Space)/.test(e.code))e.preventDefault();
  if(KEYS.kick.includes(e.code)){if(press&&!e.repeat){if(screen!=='play')begin();else startCharge();}else if(!press)release();}
 }
 addEventListener('keydown',onKey,true);addEventListener('keyup',onKey,true);
 addEventListener('blur',()=>{down.clear();charge=0;});
 // The mouse aims and, held, kicks; a finger on the table aims, and the kick button kicks.
 let mouseDown=false;
 canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.buttons)aimAt(e.clientX,e.clientY);});
 canvas.addEventListener('pointerdown',e=>{
  e.preventDefault();if(screen!=='play'){begin();return;}
  aimAt(e.clientX,e.clientY);if(e.pointerType!=='touch'){mouseDown=true;canvas.setPointerCapture(e.pointerId);startCharge();}
 });
 canvas.addEventListener('pointerup',()=>{if(mouseDown){mouseDown=false;release();}});
 canvas.addEventListener('pointercancel',()=>{mouseDown=false;charge=0;});
 kickButton.addEventListener('pointerdown',e=>{e.preventDefault();kickButton.setPointerCapture(e.pointerId);if(screen!=='play')begin();else startCharge();});
 for(const ev of ['pointerup','lostpointercapture'])kickButton.addEventListener(ev,()=>release());
 close.addEventListener('click',()=>hide());
 // A gamepad: the left stick points the aim, the right stick or the d-pad turns it finely, A (or B) held kicks.
 function pad(dt,now){
  const p=[...(navigator.getGamepads?.()||[])].find(Boolean);if(!p)return;
  const a=p.buttons[0]?.pressed||p.buttons[1]?.pressed;
  if(a&&!padKick){if(screen!=='play')begin();else startCharge(now);}else if(!a&&padKick)release(now);padKick=a;
  if(!canAim()||charge)return;
  const [x,y]=[p.axes[0]||0,p.axes[1]||0];if(Math.hypot(x,y)>.5)angle=view.tall?Math.atan2(-x,y):Math.atan2(y,x);
  const fine=(p.axes[2]||0)+(p.buttons[15]?.pressed?1:0)-(p.buttons[14]?.pressed?1:0);if(Math.abs(fine)>.2)angle+=fine*TURN*.25*dt;
 }

 function loop(now){
  if(!open)return;raf=requestAnimationFrame(loop);
  const dt=Math.min(.1,(now-last)/1000);last=now;
  pad(dt,now);
  if(screen==='play'){
   if(canAim()&&!charge){const turn=(held('right')?1:0)-(held('left')?1:0);angle+=turn*TURN*(held('fine')?.2:1)*dt;}
   if(swing){swing.t+=dt;if(swing.t>=SWING){kick(game,swing.angle,swing.power);sound.kick(swing.power);swing=null;}}
   acc+=dt;while(acc>=STEP){acc-=STEP;sound.play(step(game));if(game.phase==='done'){sound.play(['clear']);finish();break;}}
  }else if(!game)game=newGame(80);
  draw(now);
 }

 function draw(now){
  onScreen();g2.fillStyle=C.back;g2.fillRect(0,0,view.w,view.h);
  inWorld();drawTable();
  for(const b of game.balls)if(!b.potted)drawBall(b.x,b.y,b.n,b.spin);
  if(screen==='play'&&(game.phase==='aim'||swing)){if(!swing)drawAim();drawLeg(now);}
  onScreen();drawHud(now);
  if(screen==='title')drawTitle(now);
  if(screen==='done')drawDone(now);
 }
 function drawTable(){
  const g=g2,hw=TABLE.w/2,hh=TABLE.h/2,rw=TABLE.rail;
  g.fillStyle='rgba(0,0,0,.45)';g.fillRect(-hw-rw+.12,-hh-rw+.16,OUTER[0],OUTER[1]);
  g.fillStyle=C.rail;g.fillRect(-hw-rw,-hh-rw,OUTER[0],OUTER[1]);
  g.strokeStyle=C.bronze;g.lineWidth=.05;g.strokeRect(-hw-rw*.55,-hh-rw*.55,TABLE.w+rw*1.1,TABLE.h+rw*1.1);
  for(let i=0;i<14;i++){g.fillStyle=i%2?'#2e8b45':'#35994e';g.fillRect(-hw+i,-hh,1.01,TABLE.h);}
  g.fillStyle='rgba(0,0,0,.18)';g.fillRect(-hw,-hh,TABLE.w,.12);g.fillRect(-hw,-hh,.12,TABLE.h);
  g.strokeStyle='rgba(244,240,232,.45)';g.lineWidth=.06;g.beginPath();g.moveTo(0,-hh);g.lineTo(0,hh);g.stroke();
  g.beginPath();g.arc(0,0,1.5,0,Math.PI*2);g.stroke();
  g.fillStyle='rgba(244,240,232,.6)';for(const x of [HEAD.x,0,-HEAD.x]){g.beginPath();g.arc(x,0,.08,0,Math.PI*2);g.fill();}
  for(const p of POCKETS){g.fillStyle=C.pocket;g.beginPath();g.arc(p.x,p.y,pocketLook(p),0,Math.PI*2);g.fill();g.strokeStyle=C.bronze;g.lineWidth=.05;g.stroke();}
 }
 // A ball from above: its colour (a band for 9-15), soccer panels, its number upright in a white disc, a highlight.
 function drawBall(x,y,n,spin=0,turn=view.tall?-Math.PI/2:0){
  const g=g2,color=colorOf(n);
  g.save();g.translate(x,y);
  g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(.04,.06,R,R*.9,0,0,Math.PI*2);g.fill();
  g.beginPath();g.arc(0,0,R,0,Math.PI*2);g.save();g.clip();
  g.fillStyle=n===0||striped(n)?C.text:color;g.fillRect(-R,-R,2*R,2*R);
  g.rotate(spin*.35);
  if(striped(n)){g.fillStyle=color;g.fillRect(-R,-R*.5,2*R,R);}
  g.fillStyle=n===0?'#1a1c20':n===8?'#3a3e46':striped(n)?'rgba(10,12,16,.3)':'rgba(10,12,16,.32)';
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5,px=Math.cos(a)*R*.78,py=Math.sin(a)*R*.78;g.beginPath();for(let j=0;j<5;j++){const b=a+j*Math.PI*2/5;g.lineTo(px+Math.cos(b)*R*.2,py+Math.sin(b)*R*.2);}g.fill();}
  if(n===0){g.beginPath();for(let j=0;j<5;j++){const b=-Math.PI/2+j*Math.PI*2/5;g.lineTo(Math.cos(b)*R*.26,Math.sin(b)*R*.26);}g.fill();}
  g.restore();
  if(n){g.rotate(turn);g.fillStyle=C.text;g.beginPath();g.arc(0,0,R*.46,0,Math.PI*2);g.fill();
   g.fillStyle='#15171a';g.font=`700 ${R*.62}px ${FONT.display}`;g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),0,R*.04);}
  const shine=g.createRadialGradient(-R*.35,-R*.4,0,-R*.35,-R*.4,R*.9);shine.addColorStop(0,'rgba(255,255,255,.55)');shine.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=shine;g.beginPath();g.arc(0,0,R,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.015;g.stroke();
  g.restore();
 }
 // The white aim line to the first thing the cue ball meets, the ghost ball there, and where both balls go next.
 function drawAim(){
  const g=g2,cue=game.balls[0],a=aim(game,angle),dx=Math.cos(angle),dy=Math.sin(angle);
  g.strokeStyle='rgba(255,255,255,.92)';g.lineWidth=.04;g.lineCap='round';
  g.beginPath();g.moveTo(cue.x+dx*R,cue.y+dy*R);g.lineTo(a.x-dx*R,a.y-dy*R);g.stroke();
  g.beginPath();g.arc(a.x,a.y,R,0,Math.PI*2);g.stroke();
  if(a.ball){
   const [nx,ny]=a.dir,reach=.5+1.6*Math.cos(a.cut);g.beginPath();g.moveTo(a.ball.x+nx*R,a.ball.y+ny*R);g.lineTo(a.ball.x+nx*(R+reach),a.ball.y+ny*(R+reach));g.stroke();
   if(a.cue){g.strokeStyle='rgba(255,255,255,.5)';g.beginPath();g.moveTo(a.x+a.cue[0]*R,a.y+a.cue[1]*R);g.lineTo(a.x+a.cue[0]*(R+.6),a.y+a.cue[1]*(R+.6));g.stroke();}
  }
 }
 // Cosmo's leg behind the cue ball: blue fur from an orange shorts hem down to a white trainer, winding back as the
 // power builds, then swinging through.
 function drawLeg(now){
  const g=g2,cue=game.balls[0],a=swing?swing.angle:angle,dx=Math.cos(a),dy=Math.sin(a),px=-dy,py=dx;
  const back=swing?(1-swing.t/SWING)*swing.power*1.1:charge?power(now)*1.1:.18;
  const toe=[cue.x-dx*(R+.03+back),cue.y-dy*(R+.03+back)],heel=[toe[0]-dx*.42,toe[1]-dy*.42];
  const knee=[heel[0]-dx*.7+px*.18,heel[1]-dy*.7+py*.18],hip=[knee[0]-dx*.75+px*.12,knee[1]-dy*.75+py*.12];
  const limb=(p,q,width,color)=>{g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.beginPath();g.moveTo(...p);g.lineTo(...q);g.stroke();};
  g.save();g.globalAlpha=.98;
  limb([hip[0]+.04,hip[1]+.06],[heel[0]+.04,heel[1]+.06],.26,'rgba(0,0,0,.25)');
  limb(hip,knee,.3,C.shorts);limb([knee[0]+(hip[0]-knee[0])*.3,knee[1]+(hip[1]-knee[1])*.3],heel,.2,C.fur);
  // The trainer: a rounded sole, the upper, an orange flash.
  g.translate((toe[0]+heel[0])/2,(toe[1]+heel[1])/2);g.rotate(a);
  g.fillStyle=C.sole;round(-.27,-.13,.56,.26,.12);g.fillStyle=C.shoe;round(-.25,-.11,.5,.22,.1);
  g.fillStyle=C.orange;g.beginPath();g.moveTo(-.12,-.11);g.lineTo(.08,-.03);g.lineTo(-.04,.03);g.closePath();g.fill();
  g.restore();
 }
 function round(x,y,w,h,r){const g=g2;g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();g.fill();}

 const text=(s,x,y,size,color,align='left',weight=700,font=FONT.mono)=>{g2.font=`${weight} ${size}px ${font}`;g2.fillStyle=color;g2.textAlign=align;g2.textBaseline='top';g2.fillText(s,x,y);};
 function drawHud(now){
  const w=view.w;
  text('PAW POOL',18,16,22,C.orange,'left',800,FONT.display);text(screen==='play'||screen==='done'?'PRACTICE':'THE RECREATION HALL',18,44,11,C.dim);
  // A visitor who is not signed in can still play, so say while playing that the time will not be kept.
  if((screen==='play'||screen==='done')&&board.status==='guest')text('NOT SIGNED IN: TIMES NOT SAVED',18,62,10,C.orange);
  if(game&&screen!=='title'){text(clock(game.t*1000),w/2,12,30,C.text,'center',700);text(`${15-left(game)} OF 15 · ${game.shots} KICK${game.shots===1?'':'S'}`,w/2,48,11,C.dim,'center');}
  // The fifteen: full while on the table, faint once potted.
  if(game&&w>=980){const x0=w-84-15*20;for(let n=1;n<=15;n++){const b=game.balls[n];g2.save();g2.translate(x0+n*20,30);g2.scale(20/(2*R)*.8,20/(2*R)*.8);g2.globalAlpha=b.potted?.22:1;drawBall(0,0,n,0,0);g2.restore();}}
  // The power bar, beside the table.
  if(screen==='play'){
   const barH=Math.min(260,OUTER[view.tall?0:1]*view.k*.7),x=Math.max(10,view.ox-OUTER[view.tall?1:0]/2*view.k-40),y=view.oy-barH/2;
   g2.fillStyle='#11151d';g2.fillRect(x,y,18,barH);g2.strokeStyle='#3a4150';g2.lineWidth=1;g2.strokeRect(x+.5,y+.5,17,barH-1);
   const p=swing?swing.power:power(now);if(p){const grad=g2.createLinearGradient(0,y+barH,0,y);grad.addColorStop(0,C.teal);grad.addColorStop(1,C.orange);g2.fillStyle=grad;g2.fillRect(x+2,y+barH-2-(barH-4)*p,14,(barH-4)*p);}
   text('POWER',x+9,y+barH+8,9,C.dim,'center');
  }
  const hint=touch?'DRAG ON THE TABLE TO AIM · HOLD KICK':'MOUSE AIMS · HOLD CLICK OR SPACE TO KICK · ← → FINE AIM (SHIFT FINER) · ESC RETURNS TO LEO';
  if(screen==='play')text(hint,touch?18:w/2,view.h-(touch?64:30),touch?10:11,C.dim,touch?'left':'center');
 }
 function panel(x,y,w,h){g2.fillStyle='rgba(5,7,13,.86)';g2.fillRect(x,y,w,h);g2.strokeStyle=C.bronze;g2.lineWidth=2;g2.strokeRect(x,y,w,h);}
 function boardLines(x,y,n,right){
  if(board.status==='loading'){text('LOADING…',(x+right)/2,y+10,12,C.dim,'center');return;}
  if(!board.top.length){text(board.status==='offline'?'THE BOARD IS OFFLINE':'NO CLEARS YET: BE FIRST',(x+right)/2,y+10,12,C.dim,'center');return;}
  board.top.slice(0,n).forEach((r,i)=>{const yy=y+i*20;text(`${i+1}. ${r.name.toUpperCase().slice(0,18)}`,x,yy,13,C.text);text(clock(r.ms),right,yy,13,C.orange,'right');});
 }
 function drawTitle(now){
  const w=Math.min(440,view.w-32),x=(view.w-w)/2,h=300,y=Math.max(80,view.h/2-h/2);
  panel(x,y,w,h);
  text('PAW POOL',view.w/2,y+18,40,C.orange,'center',800,FONT.display);
  text('PRACTICE · POT ALL 15 IN ANY ORDER',view.w/2,y+68,12,C.text,'center');text('AGAINST THE CLOCK, KICKED BY COSMO',view.w/2,y+86,12,C.dim,'center');
  text('FASTEST CLEARS · SIGNED-IN',view.w/2,y+116,11,C.bronze,'center');boardLines(x+28,y+138,5,x+w-28);
  text(board.you?`YOUR BEST  ${clock(board.you.ms)} · RANK ${board.you.rank}`:board.status==='guest'?'SIGN IN WITH DISCORD TO POST TIMES':board.status==='offline'?'OFFLINE: TIMES NOT SAVED':'',view.w/2,y+h-58,11,C.dim,'center');
  if((now/600|0)%2===0)text(touch?'TAP TO RACK':'CLICK OR SPACE TO RACK',view.w/2,y+h-34,15,C.orange,'center');
 }
 function drawDone(now){
  const w=Math.min(460,view.w-32),x=(view.w-w)/2,h=380,y=Math.max(70,view.h/2-h/2);
  panel(x,y,w,h);
  text('RACK CLEARED',view.w/2,y+16,30,C.orange,'center',800,FONT.display);
  text(clock(game.t*1000),view.w/2,y+56,40,C.text,'center');text(`${game.shots} KICK${game.shots===1?'':'S'}`,view.w/2,y+102,12,C.dim,'center');
  const line=!result?'SAVING…':result.ok?(result.newBest?`NEW BEST! RANK ${result.rank||'-'}`:`YOUR BEST ${clock(result.best)} · RANK ${result.rank||'-'}`):
   result.why==='sign-in'?'NOT SAVED: SIGN IN WITH DISCORD':result.why==='offline'?'OFFLINE: TIME NOT SAVED':'TIME NOT ACCEPTED';
  text(line,view.w/2,y+122,13,result?.ok?C.teal:result?C.orange:C.dim,'center');
  text('TOP 10 · SIGNED-IN PLAYERS',view.w/2,y+150,11,C.bronze,'center');boardLines(x+28,y+170,8,x+w-28);
  if((now/600|0)%2===0)text(touch?'TAP TO PLAY AGAIN':'SPACE OR CLICK TO PLAY AGAIN',view.w/2,y+h-28,14,C.orange,'center');
 }

 function show(){if(open)return;open=true;root.style.display='block';screen='title';game=null;charge=0;swing=null;down.clear();fit();scores?.request();onOpen();last=performance.now();acc=0;raf=requestAnimationFrame(loop);}
 function hide(){if(!open)return;open=false;root.style.display='none';cancelAnimationFrame(raf);down.clear();charge=0;swing=null;onClose();}
 return {
  open:show,close:hide,
  get isOpen(){return open;},
  setBoard(b){board={top:[],you:null,...b};},
  setResult(r){result=r;if(r?.ok)scores?.request();},
  // For checks: the state, and ways to play without input devices.
  get state(){return {screen,game,board,result,angle,charge,swing};},
  _begin:begin,_aim(a){angle=a;},_kick(p){swing={t:0,power:p,angle};},
 };
}
