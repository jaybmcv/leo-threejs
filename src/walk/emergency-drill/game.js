import {newGame,step,STEP,DURATION,HEALTH_POINTS,METALS} from './rules.js';

const W=960,H=600,KEY='leo-emergency-drill-best-v1';
const axes={ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0],ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1]};
export function createEmergencyDrill({onOpen=()=>{},onClose=()=>{}}={}){
 const root=document.createElement('section');root.className='emergency-drill';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Emergency Drill');
 root.innerHTML=`<style>
 .emergency-drill{position:fixed;inset:0;z-index:65;background:#060d19;color:#edf3f7;font:15px system-ui;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px;box-sizing:border-box;touch-action:none;user-select:none}
 .emergency-drill[hidden]{display:none}.emergency-drill header{display:flex;align-items:center;justify-content:space-between;width:min(100%,960px);gap:12px}.emergency-drill h2{font-size:20px;margin:0}.emergency-drill button{font:600 15px system-ui;border:1px solid #66788e;border-radius:9px;padding:10px 18px;background:#14253d;color:#fff;cursor:pointer;min-height:44px}.emergency-drill button:focus-visible{outline:3px solid #83ffe0;outline-offset:2px}.emergency-drill [data-start]{background:#b82037}.emergency-drill [data-hud]{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 26px;font-variant-numeric:tabular-nums}.emergency-drill canvas{display:block;max-width:100%;min-height:0}.emergency-drill nav{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.emergency-drill [data-note]{text-align:center;color:#b3c7db;margin:0;max-width:900px;font-size:13px}.emergency-drill [data-pads]{display:flex;gap:8px}.emergency-drill [data-pads] button{padding:10px 18px;touch-action:none}
 @media(max-height:560px){.emergency-drill{padding:6px;gap:4px}.emergency-drill h2{font-size:16px}.emergency-drill [data-note]{display:none}.emergency-drill button{padding:6px 12px}}
 </style><header><h2>Emergency Drill</h2><button type="button" data-close aria-label="Return to the lifeboat">Return to Leo · Esc</button></header>
 <div data-hud><span data-time>Time till emergency landing: 60 s</span><span data-health>Hull: 100%</span><span data-metals>Metals: 0</span></div>
 <canvas width="960" height="600" role="img" aria-label="Pilot the lifeboat through the meteor field toward the planet"></canvas>
 <nav><button type="button" data-start>Start drill</button><button type="button" data-pause hidden>Pause</button><div data-pads aria-label="Flight controls"><button type="button" data-axis="left" aria-label="Steer left">◀</button><button type="button" data-axis="up" aria-label="Steer up">▲</button><button type="button" data-axis="down" aria-label="Steer down">▼</button><button type="button" data-axis="right" aria-label="Steer right">▶</button></div></nav>
 <p data-note>WASD / arrows or the steering buttons. Dodge meteors; collect metals. Landing earns 100 points per remaining hull percent.</p><p data-best aria-live="polite"></p>`;
 document.body.append(root);
 const $=s=>root.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d'),start=$('[data-start]'),pause=$('[data-pause]'),bestText=$('[data-best]'),down=new Set(),pads=new Set();
 let open=false,screen='title',game=null,paused=false,last=0,acc=0,separation=0,raf=0,best=0,saved=true,previousFocus=null,finishedAt=0;
 try{const value=Number(localStorage.getItem(KEY));if(Number.isFinite(value)&&value>=0)best=Math.floor(value);}catch{saved=false;}
 function bestLine(){bestText.textContent=`Personal best: ${best.toLocaleString()} · ${saved?'this browser only':'storage unavailable; this visit only'}`;}
 function fit(){if(!open)return;const spare=innerHeight-root.querySelector('header').offsetHeight-$('[data-hud]').offsetHeight-root.querySelector('nav').offsetHeight-$('[data-note]').offsetHeight-bestText.offsetHeight-80,scale=Math.max(.1,Math.min((innerWidth-24)/W,spare/H));canvas.style.width=W*scale+'px';canvas.style.height=H*scale+'px';}
 function begin(){game=newGame((Date.now()^Math.random()*0xffffffff)>>>0);screen='separation';separation=0;paused=false;acc=0;down.clear();pads.clear();start.hidden=true;pause.hidden=false;pause.textContent='Pause';bestLine();last=performance.now();fit();pause.focus();}
 function togglePause(){if(!open||!['separation','play'].includes(screen))return;paused=!paused;pause.textContent=paused?'Resume':'Pause';down.clear();pads.clear();acc=0;last=performance.now();}
 function close(){if(!open)return;open=false;root.hidden=true;cancelAnimationFrame(raf);down.clear();pads.clear();onClose();previousFocus?.focus?.();}
 function show(){if(open)return;onOpen();document.exitPointerLock?.();previousFocus=document.activeElement;open=true;root.hidden=false;screen='title';game=null;paused=false;acc=0;separation=0;down.clear();pads.clear();start.hidden=false;start.textContent='Start drill';pause.hidden=true;bestLine();fit();start.focus();last=performance.now();draw(last);raf=requestAnimationFrame(loop);}
 start.addEventListener('click',begin);pause.addEventListener('click',togglePause);$('[data-close]').addEventListener('click',close);
 const directions={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
 for(const b of root.querySelectorAll('[data-axis]')){
  b.addEventListener('pointerdown',e=>{e.preventDefault();pads.add(b.dataset.axis);b.setPointerCapture(e.pointerId);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>pads.delete(b.dataset.axis));
 }
 // Capture the keys before the walk can use its shortcuts or move the cat.
 addEventListener('keydown',e=>{if(!open||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.code==='Tab'){const buttons=[...root.querySelectorAll('button')].filter(b=>!b.hidden),i=buttons.indexOf(document.activeElement);e.preventDefault();e.stopImmediatePropagation();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();return;}
  e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
  if(e.code==='Escape'){close();return;}
  if(axes[e.code])down.add(e.code);
  else if(e.code==='KeyP')togglePause();
  else if(e.code==='Space'||e.code==='Enter'){if(document.activeElement?.tagName==='BUTTON')document.activeElement.click();else if(screen==='title'||screen==='over')begin();}
 },true);
 addEventListener('keyup',e=>{if(!open)return;down.delete(e.code);e.preventDefault();e.stopImmediatePropagation();},true);
 const suspend=()=>{down.clear();pads.clear();if(open&&!paused&&['separation','play'].includes(screen))togglePause();};
 addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});addEventListener('resize',fit);
 function finish(now){screen='over';finishedAt=now;start.hidden=false;start.textContent='Try again';pause.hidden=true;down.clear();pads.clear();
  if(game.phase==='landed'&&game.score>best){best=game.score;try{localStorage.setItem(KEY,String(best));saved=true;}catch{saved=false;}}
  start.focus();bestLine();bestText.textContent=(game.phase==='landed'?`Landed safely. Score ${game.score.toLocaleString()}. `:'Mission Failed. ')+bestText.textContent;fit();
 }
 function loop(now){if(!open)return;raf=requestAnimationFrame(loop);const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
  if(!paused&&screen==='separation'){separation+=dt;if(separation>=2.2){screen='play';acc=0;}}
  else if(!paused&&screen==='play'){
   const a=[0,0];for(const k of down){const d=axes[k];if(d){a[0]+=d[0];a[1]+=d[1];}}for(const k of pads){const d=directions[k];a[0]+=d[0];a[1]+=d[1];}const len=Math.max(1,Math.hypot(...a));
   acc+=dt;while(acc>=STEP&&screen==='play'){step(game,{x:a[0]/len,y:a[1]/len});acc-=STEP;if(game.phase!=='play')finish(now);}
  }
  draw(now);
 }
 function text(s,x,y,size=24,color='#edf3f7'){ctx.fillStyle=color;ctx.font=`600 ${size}px system-ui`;ctx.textAlign='center';ctx.fillText(s,x,y);}
 function ship(x,y,size=1,bank=0){ctx.save();ctx.translate(x,y);ctx.rotate(bank);ctx.scale(size,size);ctx.fillStyle='#61ddff';ctx.beginPath();ctx.moveTo(-10,22);ctx.lineTo(0,48);ctx.lineTo(10,22);ctx.fill();ctx.fillStyle='#e5e9e2';ctx.strokeStyle='#7a9aa9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-35);ctx.lineTo(19,-10);ctx.lineTo(36,22);ctx.lineTo(12,18);ctx.lineTo(0,27);ctx.lineTo(-12,18);ctx.lineTo(-36,22);ctx.lineTo(-19,-10);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#23738d';ctx.fillRect(-9,-14,18,21);ctx.fillStyle='#ff9a49';ctx.fillRect(-24,14,10,5);ctx.fillRect(14,14,10,5);ctx.restore();}
 function background(now){const gradient=ctx.createLinearGradient(0,0,0,H);gradient.addColorStop(0,'#030811');gradient.addColorStop(1,'#162844');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
  const t=game?.t||0;for(let i=0;i<95;i++){const angle=i*2.39996,r=25+((i*73+t*32)%650),x=W/2+Math.cos(angle)*r,y=H*.40+Math.sin(angle)*r*.7;ctx.strokeStyle=i%3?'#536b8e':'#c4ecff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(angle)*(3+t*.18),y+Math.sin(angle)*(3+t*.18));ctx.stroke();}
  const progress=t/DURATION,r=24+Math.pow(progress,3)*620;ctx.save();ctx.beginPath();ctx.arc(W/2,H*.27,r,0,Math.PI*2);ctx.clip();const planet=ctx.createRadialGradient(W/2-r*.3,H*.27-r*.3,r*.1,W/2,H*.27,r);planet.addColorStop(0,'#c59166');planet.addColorStop(.6,'#985135');planet.addColorStop(1,'#29273a');ctx.fillStyle=planet;ctx.fillRect(0,0,W,H);ctx.fillStyle='#8b493b';for(let i=0;i<8;i++){ctx.beginPath();ctx.ellipse(W/2+Math.sin(i*17)*r*.6,H*.27+Math.cos(i*11)*r*.65,r*.3,r*.09,i,0,Math.PI*2);ctx.fill();}ctx.restore();ctx.strokeStyle='#7cd9ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(W/2,H*.27,r+4,0,Math.PI*2);ctx.stroke();
 }
 function draw(now){background(now);
  $('[data-time]').textContent=`Time till emergency landing: ${Math.ceil(DURATION-(game?.t||0))} s`;$('[data-health]').textContent=`Hull: ${game?.health??100}%`;$('[data-metals]').textContent=`Metals: ${game?.metals||0}`;
  if(screen==='separation'){
   const t=Math.min(1,separation/2.2);ctx.save();ctx.translate(190-t*280,300);ctx.fillStyle='#52657b';ctx.beginPath();ctx.ellipse(0,0,250,100,-.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#93d3e8';ctx.fillRect(-160,-20,260,12);ctx.restore();ship(390+t*200,325-t*10,.7+t*.3,-.1);text('LIFEBOAT SEPARATING',480,100,34);text('Practice flight · 60-second descent starts next',480,148,22,'#b3c7db');
  }else if(game){
   // Perspective expands objects from the distant planet to the pilot's flight plane.
   const renderObject=o=>{const depth=o.depth*o.depth,x=480+o.x*360*depth,y=160+(210+o.y*145)*depth,r=(o.kind==='meteor'?31:20)*(.06+depth);ctx.save();ctx.translate(x,y);ctx.rotate(o.spin+game.t*.22);ctx.fillStyle=o.kind==='meteor'?'#7b6e69':METALS[o.metal].color;ctx.strokeStyle=o.kind==='meteor'?'#bd9880':'#fff';ctx.lineWidth=2;ctx.beginPath();for(let k=0;k<8;k++){const a=k*Math.PI/4,rr=r*(k%2?.77:1);k?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();if(o.kind==='metal'&&o.depth>.55)text('+'+METALS[o.metal].value,x,y-r-7,16,METALS[o.metal].color);};
   const sx=480+game.x*360,sy=370+game.y*145;
   game.objects.filter(o=>o.depth<=1).sort((a,b)=>a.depth-b.depth).forEach(renderObject);
   if(game.phase!=='failed')ship(sx,sy,1,game.x*.12);game.objects.filter(o=>o.depth>1).forEach(renderObject);
   if(game.flash){ctx.fillStyle=`rgba(255,40,65,${game.flash*1.5})`;ctx.fillRect(0,0,W,H);}
   if(screen==='over'){
    if(game.phase==='failed'){const t=Math.min(1,(now-finishedAt)/1000);for(let i=0;i<18;i++){const angle=i*2.4,rr=20+t*130;ctx.fillStyle=i%2?'#ffb64f':'#ef5635';ctx.beginPath();ctx.arc(sx+Math.cos(angle)*rr,sy+Math.sin(angle)*rr,15*(1-t)+4,0,Math.PI*2);ctx.fill();}}
    ctx.fillStyle='#060d19cc';ctx.fillRect(120,100,720,365);text(game.phase==='landed'?'ATMOSPHERE REACHED':'Mission Failed',480,162,40,game.phase==='landed'?'#83ffe0':'#ff8c8c');
    if(game.phase==='landed'){text('Landed safely',480,209,25);text(`Metals ${game.metals} + hull ${game.health} × ${HEALTH_POINTS}`,480,266,25);text(`Final score: ${game.score.toLocaleString()}`,480,317,36,'#83ffe0');}
    else{text('Hull lost. The drill is over.',480,235,26);text('No landing score · try another route',480,288,24,'#b3c7db');}
    text('Personal best stays in this browser',480,391,20,'#b3c7db');
   }
  }
  if(screen==='title'){ctx.fillStyle='#060d19dd';ctx.fillRect(100,90,760,410);text('EMERGENCY DRILL',480,155,43);ship(480,224,.8);text('Survive the 60-second flight to safety',480,304,28);text('100% hull · each meteor hit costs 10%',480,351,23,'#b3c7db');text('Iron +25    Titanium +150    Platinum +500',480,398,23,'#83ffe0');text('Land with hull intact for the biggest bonus',480,447,23,'#b3c7db');}
  if(paused){ctx.fillStyle='#060d19dd';ctx.fillRect(0,0,W,H);text('PAUSED',480,275,48);text('Resume when you are ready',480,325,24,'#b3c7db');}
 }
 return {open:show,close,get isOpen(){return open;},get state(){return {screen,game,paused,best,saved};}};
}
