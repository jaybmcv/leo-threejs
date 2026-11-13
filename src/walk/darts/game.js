import {newRound,step,press,release,marker,DARTS,FLIGHT,RING} from './rules.js';
import {drawBoard} from './art.js';

// The nine-dart challenge on screen (from tester feedback): a full-window overlay over the walk, like Leo Pinball's,
// opened with E at a throwing line in the Recreation Hall (lanes.js). The arrows aim, Space throws, nine darts a round,
// the total at the end. Best rounds are kept on this device only, and only for finished rounds; Escape leaves at any
// time, and a round left early is not kept. A shared board would be Leo live's, later.
const S=2,VW=420,VH=520,BX=210,BY=262,K=150/RING.edge,BEST_KEY='leo-darts-best',KEEP=5;
const C={back:'#071019',panel:'#0d1b27',text:'#f4f0e8',dim:'#9fb0b8',orange:'#f85800',teal:'#2fd6c5',gold:'#ffd166'};
const FONT='"JetBrains Mono", ui-monospace, monospace',DISPLAY='"Archivo", "Sora", system-ui, sans-serif';
const KEYS={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'};

// Scores on this device: a short list, best first. A browser that won't store them still plays.
const readBest=()=>{try{const v=JSON.parse(localStorage.getItem(BEST_KEY)||'[]');return Array.isArray(v)?v.filter(Number.isFinite).slice(0,KEEP):[];}catch{return [];}};
const saveBest=list=>{try{localStorage.setItem(BEST_KEY,JSON.stringify(list));return true;}catch{return false;}};

export function createDarts({onOpen=()=>{},onClose=()=>{}}={}){
 const root=document.createElement('div');root.className='darts';
 root.style.cssText='position:fixed;inset:0;z-index:60;background:'+C.back+';display:none;flex-direction:column;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none';
 const canvas=document.createElement('canvas');canvas.width=VW*S;canvas.height=VH*S;canvas.style.cssText='display:block;touch-action:none';root.appendChild(canvas);
 const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Leave darts');close.textContent='×';
 close.style.cssText='position:absolute;top:12px;right:14px;width:44px;height:44px;border-radius:22px;border:1px solid #3a4150;background:#11151d;color:#f4f0e8;font:500 26px/1 system-ui;cursor:pointer';
 root.appendChild(close);
 // On a touch screen: aim buttons and a throw button under the board.
 const touch=matchMedia('(pointer:coarse)').matches,pads={left:false,right:false,up:false,down:false};
 if(touch){
  const bar=document.createElement('div');bar.style.cssText='display:flex;gap:8px;margin-top:10px';
  for(const [k,label] of [['left','◀'],['up','▲'],['down','▼'],['right','▶'],['throw','THROW']]){
   const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',k==='throw'?'Throw a dart':'Aim '+k);
   b.style.cssText=`width:${k==='throw'?96:56}px;height:56px;border-radius:14px;border:1px solid #3a4150;background:#151a24;color:${k==='throw'?C.orange:C.text};font:700 16px ${FONT}`;
   b.addEventListener('pointerdown',e=>{e.preventDefault();if(k==='throw'){if(round?.phase==='done')begin();else throwDart(false);}else pads[k]=true;b.setPointerCapture(e.pointerId);});
   for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{if(k==='throw'){if(round)release(round);}else pads[k]=false;});
   bar.appendChild(b);
  }
  root.appendChild(bar);
 }
 document.body.appendChild(root);
 const g=canvas.getContext('2d');
 const text=(s,x,y,size,color,align='center',weight=700,font=FONT)=>{g.font=`${weight} ${size*S}px ${font}`;g.fillStyle=color;g.textAlign=align;g.textBaseline='top';g.fillText(s,x*S,y*S);};

 let open=false,round=null,raf=0,last=0,best=readBest(),saved=null,lane=0,shown=null,thrown=0;
 const down=new Set(),held=k=>down.has(KEYS[k])||pads[k];
 function begin(){round=newRound();saved=null;shown=null;}
 function throwDart(repeat){if(round&&press(round,repeat))thrown++;}
 // A finished round goes into this device's list; `saved` is its place there, or -1 if storing failed.
 function finish(){
  const list=[...best,round.total].sort((a,b)=>b-a).slice(0,KEEP),place=list.indexOf(round.total);
  if(place<0){saved={place:-1,ok:true};return;}
  best=list;saved={place,ok:saveBest(list)};
 }
 // Keys while open are the game's alone: caught before the walk's own listener sees them.
 function onKey(e){
  if(!open)return;if(e.ctrlKey||e.metaKey||e.altKey)return;
  e.stopImmediatePropagation();const isDown=e.type==='keydown';
  if(/^(Arrow|Space)/.test(e.code))e.preventDefault();
  if(isDown&&e.code==='Escape'){hide();return;}
  if(isDown)down.add(e.code);else down.delete(e.code);
  if(e.code==='Space'){if(isDown)throwDart(e.repeat);else if(round)release(round);}
  if(isDown&&!e.repeat&&round?.phase==='done'&&(e.code==='KeyE'||e.code==='Enter'))begin();
 }
 addEventListener('keydown',onKey,true);addEventListener('keyup',onKey,true);
 addEventListener('blur',()=>{down.clear();for(const k in pads)pads[k]=false;if(round)release(round);});
 close.addEventListener('click',()=>hide());
 function fit(){const k=Math.min((innerWidth-24)/VW,(innerHeight-(touch?90:20))/VH);canvas.style.width=VW*k+'px';canvas.style.height=VH*k+'px';}
 addEventListener('resize',()=>{if(open)fit();});

 function loop(now){
  if(!open)return;raf=requestAnimationFrame(loop);
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(round){const d=step(round,dt,{left:held('left'),right:held('right'),up:held('up'),down:held('down')});
   if(d)shown={dart:d,until:1.3};if(d&&round.phase==='done')finish();}
  if(shown&&(shown.until-=dt)<=0)shown=null;
  draw(now);
 }
 // Board millimetres (y up) to canvas pixels.
 const px=(x,y)=>[(BX+x*K)*S,(BY-y*K)*S];
 function dart(x,y,size=1,color=C.orange){const [cx,cy]=px(x,y);g.strokeStyle='#f4f0e8';g.lineWidth=2*S*size;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+7*S*size,cy+10*S*size);g.stroke();
  g.fillStyle=color;g.beginPath();g.moveTo(cx+7*S*size,cy+10*S*size);g.lineTo(cx+14*S*size,cy+9*S*size);g.lineTo(cx+8*S*size,cy+17*S*size);g.closePath();g.fill();
  g.fillStyle='#10161c';g.beginPath();g.arc(cx,cy,2.2*S*size,0,Math.PI*2);g.fill();}
 function hud(){
  g.fillStyle=C.panel;g.fillRect(0,0,VW*S,58*S);g.fillStyle=C.orange;g.fillRect(0,57*S,VW*S,S);
  const left=round?DARTS-round.darts.length-(round.flight?1:0):DARTS;
  text('DARTS LEFT',14,8,7,C.dim,'left');for(let i=0;i<DARTS;i++){g.fillStyle=i<left?C.orange:'#2a3640';g.fillRect((14+i*11)*S,24*S,7*S,20*S);}
  text('TOTAL',VW/2+20,8,7,C.dim);text(String(round?.total||0),VW/2+20,20,22,C.text);
  text('BEST · THIS DEVICE',VW-14,8,7,C.dim,'right');text(best.length?String(best[0]):'—',VW-14,22,16,C.gold,'right');
 }
 function draw(now){
  g.fillStyle=C.back;g.fillRect(0,0,VW*S,VH*S);hud();
  drawBoard(g,BX*S,BY*S,K*S);
  if(round){
   for(const d of round.darts)dart(d.x,d.y);
   // The dart in the air: from below the board, growing smaller as it reaches the board, a ring where it strikes.
   if(round.flight){const f=round.flight,u=Math.min(1,f.t/FLIGHT),e=1-(1-u)*(1-u);
    dart(f.x,f.y-(1-e)*260,1+(1-e)*2.2);}
   if(shown){const [cx,cy]=px(shown.dart.x,shown.dart.y),a=Math.max(0,shown.until/1.3);
    g.strokeStyle=`rgba(255,209,102,${a})`;g.lineWidth=2*S;g.beginPath();g.arc(cx,cy,(10+(1-a)*18)*S,0,Math.PI*2);g.stroke();
    // The hit's points in the gap over the board, clear of the bull.
    const d=shown.dart,ring=d.label==='BULL'?'BULL':d.label==='25'?'OUTER BULL':(['','SINGLE','DOUBLE','TRIPLE'][d.mult]+' '+d.number);
    text(d.points?`+${d.points}  ${ring}`:'MISS · 0',BX,72,16,d.points?C.gold:C.dim);}
   if(round.phase==='aim'){const m=marker(round),[cx,cy]=px(m.x,m.y);g.strokeStyle=C.teal;g.lineWidth=2*S;
    g.beginPath();g.arc(cx,cy,9*S,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(cx-15*S,cy);g.lineTo(cx-4*S,cy);g.moveTo(cx+4*S,cy);g.lineTo(cx+15*S,cy);
    g.moveTo(cx,cy-15*S);g.lineTo(cx,cy-4*S);g.moveTo(cx,cy+4*S);g.lineTo(cx,cy+15*S);g.stroke();}
   // Each dart's points along the bottom, nine slots.
   for(let i=0;i<DARTS;i++){const d=round.darts[i],x=VW/2+(i-4)*42;g.fillStyle=d?'#173042':'#101c26';g.fillRect((x-19)*S,428*S,38*S,22*S);
    text(d?(d.points?d.label:'0'):'·',x,433,8,d?(d.points?C.text:C.dim):'#3a4a55');}
  }
  text(touch?'◀ ▲ ▼ ▶ AIM   THROW   × LEAVE':'ARROWS AIM · SPACE THROW · ESC LEAVE',VW/2,462,8,C.dim);
  if(round?.phase==='done')drawDone(now);
 }
 function drawDone(now){
  g.fillStyle='rgba(7,16,25,.86)';g.fillRect(40*S,120*S,(VW-80)*S,290*S);
  text('ROUND OVER',VW/2,136,22,C.orange,'center',800,DISPLAY);
  text(`${round.total} POINTS`,VW/2,170,18,C.text);text(`NINE DARTS · ${round.darts.filter(d=>d.points).length} SCORED`,VW/2,196,7,C.dim);
  text(saved?.place===0?'NEW BEST ON THIS DEVICE!':`BEST ON THIS DEVICE ${best[0]}`,VW/2,216,9,saved?.place===0?C.gold:C.dim);
  text('YOUR BEST ROUNDS · SAVED ON THIS DEVICE ONLY',VW/2,244,6.5,C.dim);
  best.forEach((v,i)=>text(`${i+1}.  ${String(v).padStart(3,' ')}`,VW/2,260+i*16,9,i===saved?.place?C.gold:C.text));
  if(saved&&!saved.ok)text('THIS BROWSER WOULD NOT SAVE IT',VW/2,346,7,C.dim);
  if((now/600|0)%2===0)text(touch?'TAP THROW TO PLAY AGAIN':'E TO PLAY AGAIN',VW/2,368,10,C.orange);
  text(touch?'TAP × TO RETURN TO LEO':'ESC RETURNS TO LEO',VW/2,388,7,C.dim);
 }
 // Opens at a throwing line with a fresh round under way.
 function show(at=0){if(open)return;open=true;lane=at;best=readBest();root.style.display='flex';down.clear();fit();begin();onOpen();last=performance.now();raf=requestAnimationFrame(loop);}
 // Leaving mid-round drops that round: only finished rounds were saved, in finish().
 function hide(){if(!open)return;open=false;root.style.display='none';cancelAnimationFrame(raf);down.clear();for(const k in pads)pads[k]=false;round=null;shown=null;onClose();}
 return {
  open:show,close:hide,
  get isOpen(){return open;},
  // For checks: the round, this device's list and how many darts have left the hand since the page loaded.
  get state(){return {lane,phase:round?.phase||'closed',darts:round?round.darts.length+(round.flight?1:0):0,landed:round?.darts.map(d=>d.points)||[],total:round?.total||0,best:[...best],saved,thrown,aim:round?{...round.aim}:null};},
 };
}
