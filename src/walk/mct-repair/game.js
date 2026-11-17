import {PARTS} from './catalog.js';
import {VIEWS,newRepair,required,workbench,install,nextRound,formatTime,pileLayout,floatingPart,boundPart,pushPart,floatPart} from './rules.js';
import {partArt,cartArt,PART_SPOTS} from './art.js';

const KEY='leo-mct-repair-times-v1',label=v=>v[0].toUpperCase()+v.slice(1);
export function createMctRepair({onOpen=()=>{},onClose=()=>{}}={}){
 const root=document.createElement('section');root.className='mct-repair';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','MCT Repairs');
 root.innerHTML=`<style>
 .mct-repair{position:fixed;inset:0;z-index:70;box-sizing:border-box;padding:16px;display:flex;flex-direction:column;gap:10px;background:#060d19f5;color:#edf3f7;font:14px Archivo,system-ui,sans-serif;user-select:none;overflow:auto}
 .mct-repair[hidden],.mct-repair [hidden]{display:none!important}.mct-repair *{box-sizing:border-box}.mct-repair h2,.mct-repair h3,.mct-repair p{margin:0}.mct-repair h2{font:700 22px Sora,system-ui;color:#ff984f}.mct-repair h3{font-size:12px;letter-spacing:1px;color:#83ffe0;text-transform:uppercase}.mct-repair button{font:600 13px Archivo,system-ui;min-height:44px;border:1px solid #546e85;border-radius:8px;background:#14253d;color:#edf3f7;padding:8px 12px;cursor:pointer}.mct-repair button:focus-visible{outline:3px solid #83ffe0;outline-offset:2px}.mct-repair button[aria-pressed=true]{border-color:#83ffe0;background:#24505a}.mct-repair header{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.mct-repair [data-hud]{display:flex;flex-wrap:wrap;gap:8px 18px;font:12px 'JetBrains Mono',monospace;color:#b3c7db}.mct-repair [data-score],.mct-repair [data-time]{color:#83ffe0}.mct-repair [data-game]{display:flex;flex:1;min-height:0;flex-direction:column;gap:8px}.mct-repair [data-assembly]{display:grid;grid-template-columns:190px 1fr;gap:12px;border:1px solid #36586a;border-radius:12px;background:#102034;padding:12px;flex-shrink:0}.mct-repair [data-required]{max-height:274px;overflow:auto;display:flex;flex-direction:column;gap:3px;margin-top:6px}.mct-repair [data-required] div{display:flex;gap:6px;align-items:center;font-size:11px;border-bottom:1px solid #28445b;padding:2px}.mct-repair [data-required] svg{width:28px;height:28px;flex-shrink:0}.mct-repair .done{opacity:.5}.mct-repair .done span:last-child{color:#83ffe0}.mct-repair [data-diagnostic]{color:#b3c7db;line-height:1.4;font-size:12px;max-width:900px;margin:6px 0}.mct-repair nav{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.mct-repair [data-cart]{display:block;position:relative;width:100%;height:220px;padding:0;background:#081622;border-color:#36586a;overflow:hidden;touch-action:none}.mct-repair [data-cart]>svg{width:100%;height:100%}.mct-repair [data-hotspots]{position:absolute;inset:0;pointer-events:none;width:min(100%,482px);margin:auto}.mct-repair [data-hotspots] span{border:1px dashed #83ffe0;border-radius:5px;background:#102034c9}.mct-repair [data-hotspots] svg{display:block;width:clamp(28px,4vw,56px);height:clamp(28px,4vw,56px)}.mct-repair [data-hotspots] .done{border:1px solid #3ee08a;opacity:1;background:#174537}
 .mct-repair [data-bench]{flex:1;min-height:170px;overflow:auto;display:block;padding:10px;background:linear-gradient(#14253d44 1px,transparent 1px),linear-gradient(90deg,#14253d44 1px,transparent 1px),#08121f;background-size:32px 32px;border:1px solid #28445b;border-radius:10px}.mct-repair [data-pile]{position:relative;min-width:94px}.mct-repair [data-part]{min-width:0;min-height:0;width:82px;height:96px;padding:3px;background:#102034b3;position:absolute;touch-action:none;overflow:visible}.mct-repair [data-part].needed{border-color:#497c80;box-shadow:0 0 7px #83ffe019}.mct-repair [data-part]:hover,.mct-repair [data-part]:focus{z-index:2}.mct-repair [data-part] svg{width:43px;height:43px;display:block;margin:auto;pointer-events:none}.mct-repair [data-part] small{display:block;font-size:9px;line-height:11px;white-space:normal;overflow-wrap:anywhere}.mct-repair [data-part].dragging{position:fixed;z-index:10;pointer-events:none;box-shadow:0 10px 24px #000a}.mct-repair [data-message]{min-height:18px;color:#83ffe0;font-size:12px}.mct-repair [data-screen]{margin:auto;max-width:680px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;padding:20px}.mct-repair [data-screen] p{line-height:1.6;color:#b3c7db}.mct-repair [data-screen] svg{max-width:460px;width:100%}.mct-repair [data-primary]{background:#a73d1c;border-color:#ff984f}.mct-repair [data-board]{text-align:left;white-space:pre-line;color:#83ffe0;font:13px 'JetBrains Mono',monospace}.mct-repair footer{font-size:12px;color:#b3c7db}.mct-repair .reject{outline:2px solid #ff8c8c}
 @media(max-width:600px){.mct-repair{padding:8px}.mct-repair [data-assembly]{grid-template-columns:120px 1fr;padding:6px;gap:6px}.mct-repair [data-cart]{height:190px}.mct-repair [data-required]{max-height:300px}.mct-repair [data-hud]{font-size:10px}.mct-repair h2{font-size:18px}.mct-repair [data-diagnostic]{font-size:11px}}@media(max-height:600px){.mct-repair [data-cart]{height:155px}.mct-repair [data-required]{max-height:220px}.mct-repair{padding:8px}.mct-repair [data-bench]{min-height:170px}}
 </style><header><h2>MCT REPAIRS</h2><div data-hud><span data-round>Round 1/3</span><span data-name></span><span>Score <b data-score>0</b></span><span>Time <b data-time>0:00</b></span></div><button data-close>Back to Leo · Esc</button></header>
 <div data-screen><h2 data-title>MCT REPAIRS</h2><div data-preview></div><p data-copy></p><div data-board></div><button data-primary>Start Game</button></div>
 <div data-game hidden><div data-assembly><aside><h3>Required Parts</h3><div data-required></div></aside><div><nav aria-label="MCT views"><h3 data-vehicle>MCT-01 Assembly</h3>${VIEWS.map(v=>`<button data-view="${v}">${label(v)}</button>`).join('')}</nav><p data-diagnostic></p><button data-cart aria-label="Install selected part on the MCT"><div data-hotspots></div></button></div></div><p data-message role="status" aria-live="polite"></p><div data-bench aria-label="Parts workbench"><div data-pile></div></div></div>
 <footer>Drag parts onto the matching MCT view, or select a part then click the MCT. Keyboard: Tab / Enter to select and install; 1–4 or arrows change views. Esc returns to Leo. Times stay in this browser.</footer>`;
 document.body.append(root);
 const $=s=>root.querySelector(s),screen=$('[data-screen]'),gamePanel=$('[data-game]'),cart=$('[data-cart]'),pile=$('[data-pile]'),primary=$('[data-primary]'),bench=$('[data-bench]');
 let open=false,game=null,selected=null,drag=null,started=0,timer=0,transition=0,previousFocus=null,scores=[],stored=true;
 const bodies=new Map(),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0,lastFrame=0,hovered=null;
 function paint(el,p){el.style.left=p.x+'px';el.style.top=p.y+'px';}
 function sizePile(){
  if(!open||gamePanel.hidden)return;
  cancelDrag();const width=pile.clientWidth,count=bodies.size;if(!count||!width)return;
  const availableHeight=Math.max(0,bench.clientHeight-20),initial=pileLayout(count,width,availableHeight);
  let partHeight=96;for(const [el] of bodies){el.style.width=initial.w+'px';partHeight=Math.max(partHeight,el.querySelector('small').scrollHeight+53);}
  const {height,cols,cw,ch,w,h}=pileLayout(count,width,availableHeight,partHeight);
  pile.style.height=height+'px';
  let i=0;for(const [el,p] of bodies){const ax=(i%cols)*cw+(cw-w)/2,ay=Math.floor(i/cols)*ch+(ch-h)/2;
   p.x=ax+p.x-p.ax;p.y=ay+p.y-p.ay;p.ax=ax;p.ay=ay;p.w=w;p.h=h;boundPart(p,width,height);
   el.style.width=w+'px';el.style.height=h+'px';paint(el,p);i++;
  }
 }
 function stopMotion(){cancelAnimationFrame(frame);frame=0;lastFrame=0;}
 function animate(now){
  frame=0;if(!open||game?.phase!=='play'||document.hidden)return;
  const dt=lastFrame?(now-lastFrame)/1000:0,{width,height}=pile.getBoundingClientRect();lastFrame=now;
  for(const [el,p] of bodies){floatPart(p,width,height,dt,{held:el===hovered||el===document.activeElement||el===drag?.el,reduced:motion.matches});if(el!==drag?.el)paint(el,p);}
  frame=requestAnimationFrame(animate);
 }
 function startMotion(){if(!frame&&open&&game?.phase==='play'&&!document.hidden)frame=requestAnimationFrame(animate);}
 function pushNeighbours(x,y,except){const r=pile.getBoundingClientRect();for(const [el,p] of bodies)if(el!==except&&el!==document.activeElement)pushPart(p,x-r.left,y-r.top,motion.matches);}
 const resize=new ResizeObserver(sizePile);resize.observe(pile);resize.observe(bench);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();stopMotion();}else startMotion();});
 try{const rows=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(rows))scores=rows.filter(r=>Number.isFinite(r.time)&&r.time>=0&&typeof r.date==='string').sort((a,b)=>a.time-b.time).slice(0,8);}catch{stored=false;}
 function tick(){if(!game||game.phase!=='play')return;game.elapsed=Math.floor((Date.now()-started)/1000);hud();}
 function hud(){if(!game)return;$('[data-round]').textContent=`Round ${game.current+1}/3`;$('[data-name]').textContent=game.rounds[game.current].name;$('[data-score]').textContent=game.score;$('[data-time]').textContent=formatTime(game.elapsed);}
 function announce(text){$('[data-message]').textContent=text;}
 function renderCart(){
  const spots=required(game).filter(p=>p.view===game.view);cart.innerHTML=cartArt(game.view)+'<div data-hotspots></div>';
  for(const p of spots){const s=document.createElement('span'),[x,y]=PART_SPOTS[game.view][p.id];s.className=game.placed.has(p.id)?'done':'';s.title=p.name;s.style.cssText=`position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%)`;s.innerHTML=partArt(p.id);$('[data-hotspots]').append(s);}
  for(const b of root.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===game.view));
 }
 function renderRequired(){
  const box=$('[data-required]');box.replaceChildren();
  for(const p of required(game)){const row=document.createElement('div');row.className=game.placed.has(p.id)?'done':'';row.innerHTML=partArt(p.id);const text=document.createElement('span');text.textContent=`${p.name} · ${label(p.view)}`;row.append(text);const status=document.createElement('span');status.textContent=game.placed.has(p.id)?'OK':'';row.append(status);box.append(row);}
 }
 function setView(view){if(!game||game.phase!=='play')return;game.view=view;renderCart();}
 function cancelDrag(){if(!drag)return;const {el,id}=drag;drag=null;el.classList.remove('dragging');const p=bodies.get(el);if(p)paint(el,p);if(el.hasPointerCapture(id))el.releasePointerCapture(id);}
 function choose(el){
  if(!game||game.phase!=='play')return;
  selected=el;for(const b of pile.children)b.setAttribute('aria-pressed',String(b===el));
  announce(`${el.title} selected. Choose its view, then install on the MCT.`);
 }
 function drop(el){
  if(!el||!game||game.phase!=='play')return false;
  tick();const ok=install(game,el.dataset.part);
  if(!ok){el.classList.add('reject');announce('Part not fitted. Check Required Parts and the MCT view.');return false;}
  bodies.delete(el);el.remove();selected=null;announce('Part installed.');renderRequired();renderCart();hud();
  if(game.phase!=='play'){stopMotion();clearInterval(timer);transition=setTimeout(finishRound,300);}else cart.focus({preventScroll:true});
  return true;
 }
 function renderPile(){
  stopMotion();bodies.clear();hovered=null;pile.replaceChildren();const box=root.getBoundingClientRect();
  for(const id of workbench(game,box.width,box.height-56)){
   const p=PARTS.find(p=>p.id===id),b=document.createElement('button');b.type='button';b.dataset.part=id;b.title=p?.name||label(id);b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed','false');b.className=game.rounds[game.current].parts.includes(id)?'needed':'';b.innerHTML=partArt(id);const text=document.createElement('small');text.textContent=b.title;b.append(text);
   bodies.set(b,floatingPart(0,0,0,0,bodies.size));b.addEventListener('pointerenter',()=>{hovered=b;});b.addEventListener('pointerleave',()=>{if(hovered===b)hovered=null;});
   b.addEventListener('focus',()=>b.scrollIntoView({block:'nearest',inline:'nearest'}));
   b.addEventListener('click',()=>choose(b));pile.append(b);
  }sizePile();startMotion();
 }
 function load(){
  clearInterval(timer);cancelDrag();selected=null;screen.hidden=true;gamePanel.hidden=false;$('[data-diagnostic]').textContent=game.rounds[game.current].diag;
  renderRequired();renderCart();renderPile();hud();announce('Find the required parts in the workbench.');timer=setInterval(tick,100);$('[data-view="side"]').focus();
 }
 function showScreen(title,copy,button){stopMotion();screen.hidden=false;gamePanel.hidden=true;$('[data-title]').textContent=title;$('[data-copy]').textContent=copy;primary.textContent=button;primary.focus();}
 function finishRound(){
  if(!open)return;
  if(game.phase==='clear'){showScreen('Round Clear',`${game.rounds[game.current].name} repaired.`,'Next Round');return;}
  if(game.phase!=='complete')return;
  scores.push({time:game.elapsed,date:new Date().toLocaleDateString()});scores.sort((a,b)=>a.time-b.time);scores=scores.slice(0,8);
  try{localStorage.setItem(KEY,JSON.stringify(scores));stored=true;}catch{stored=false;}
  showScreen('All Repairs Complete',`Time: ${formatTime(game.elapsed)} · Score: ${game.score}`,'Play Again');
  $('[data-board]').textContent=`${stored?'Best times · this browser only':'Best times · this visit only'}\n`+scores.map((r,i)=>`${i+1}. ${formatTime(r.time)} (${r.date})`).join('\n');
 }
 function begin(){game=newRepair();started=Date.now();$('[data-board]').textContent='';load();}
 primary.addEventListener('click',()=>{if(game?.phase==='clear'){nextRound(game);load();}else begin();});
 for(const b of root.querySelectorAll('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view));
 cart.addEventListener('click',()=>drop(selected));
 // Pointer capture lets mouse and touch carry a part over the assembly panel.
 pile.addEventListener('pointerdown',e=>{
  const el=e.target.closest('[data-part]');if(!el||e.button!==0||game?.phase!=='play')return;
  cancelDrag();choose(el);el.classList.remove('reject');const r=el.getBoundingClientRect();drag={el,id:e.pointerId,x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top,moved:false};pushNeighbours(e.clientX,e.clientY,el);
  try{el.setPointerCapture(e.pointerId);}catch(error){if(error.name!=='InvalidStateError'&&error.name!=='NotFoundError')throw error;}
 });
 addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5&&!drag.moved)return;
  e.preventDefault();drag.moved=true;
  if(Math.hypot(e.clientX-drag.px,e.clientY-drag.py)>=4){pushNeighbours(e.clientX,e.clientY,drag.el);drag.px=e.clientX;drag.py=e.clientY;}
  drag.el.classList.add('dragging');drag.el.style.left=e.clientX-drag.dx+'px';drag.el.style.top=e.clientY-drag.dy+'px';
 });
 addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return;const {el,moved}=drag,r=cart.getBoundingClientRect(),over=e.clientX>r.left&&e.clientX<r.right&&e.clientY>r.top&&e.clientY<r.bottom;
  cancelDrag();if(moved&&over)drop(el);
 });
 pile.addEventListener('pointercancel',cancelDrag);pile.addEventListener('lostpointercapture',cancelDrag);
 function resetInput(){cancelDrag();}
 addEventListener('blur',resetInput);
 function close(){if(!open)return;open=false;stopMotion();clearInterval(timer);clearTimeout(transition);cancelDrag();root.hidden=true;onClose();previousFocus?.focus?.();}
 $('[data-close]').addEventListener('click',close);
 addEventListener('keydown',e=>{
  if(!open||e.ctrlKey||e.metaKey||e.altKey)return;
  e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){close();return;}
  const buttons=[...root.querySelectorAll('button')].filter(b=>!b.disabled&&b.getClientRects().length);
  if(e.code==='Tab'){const i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();return;}
  if(e.repeat)return;
  if(e.code==='Enter'||e.code==='Space'){document.activeElement?.click?.();return;}
  const digit=Number(e.code.replace('Digit',''))-1;if(digit>=0&&digit<4){setView(VIEWS[digit]);return;}
  if(e.code==='ArrowLeft'||e.code==='ArrowRight')setView(VIEWS[(VIEWS.indexOf(game?.view)+(e.code==='ArrowLeft'?3:1))%4]);
 },true);
 addEventListener('keyup',e=>{if(open){e.preventDefault();e.stopImmediatePropagation();}},true);
 return {open(bay=1){if(open)return;onOpen();previousFocus=document.activeElement;open=true;game=null;root.hidden=false;document.exitPointerLock?.();$('[data-vehicle]').textContent=`MCT-0${bay} Assembly`;$('[data-preview]').innerHTML=cartArt('side');$('[data-board]').textContent='';$('[data-name]').textContent=`SERVICE ${bay}`;$('[data-score]').textContent='0';$('[data-time]').textContent='0:00';$('[data-round]').textContent='Round 1/3';showScreen('MCT REPAIRS','Full-screen service bay time trial. Dig through the workbench, cycle the MCT views, and install the required parts as fast as you can.','Start Game');},close,
  get isOpen(){return open;},get state(){return game?{phase:game.phase,current:game.current,score:game.score,elapsed:game.elapsed,view:game.view,needed:required(game).map(p=>({...p})),placed:[...game.placed]}:{phase:'title'};}};
}
