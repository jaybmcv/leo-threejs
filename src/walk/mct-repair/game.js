import {PARTS,JUNK_NAMES} from './catalog.js';
import {VIEWS,newRepair,required,workbench,scatterPile,pileMetrics,pilePosition,pileDrop,floatingPosition,pushPileMotion,stepPileMotion,install,nextRound,formatTime} from './rules.js';
import {partArt,cartArt,PART_SPOTS} from './art.js';

const KEY='leo-mct-repair-times-v1',label=v=>v[0].toUpperCase()+v.slice(1);
export function createMctRepair({onOpen=()=>{},onClose=()=>{}}={}){
 const root=document.createElement('section');root.className='mct-repair';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','MCT Repairs');
 root.innerHTML=`<style>
 .mct-repair{position:fixed;inset:0;z-index:70;box-sizing:border-box;padding:16px;display:flex;flex-direction:column;gap:10px;background:#060d19f5;color:#edf3f7;font:14px Archivo,system-ui,sans-serif;user-select:none;overflow:auto}
 .mct-repair[hidden],.mct-repair [hidden]{display:none!important}.mct-repair *{box-sizing:border-box}.mct-repair h2,.mct-repair h3,.mct-repair p{margin:0}.mct-repair h2{font:700 22px Sora,system-ui;color:#ff984f}.mct-repair h3{font-size:12px;letter-spacing:1px;color:#83ffe0;text-transform:uppercase}.mct-repair button{font:600 13px Archivo,system-ui;min-height:44px;border:1px solid #546e85;border-radius:8px;background:#14253d;color:#edf3f7;padding:8px 12px;cursor:pointer}.mct-repair button:focus-visible{outline:3px solid #83ffe0;outline-offset:2px}.mct-repair button[aria-pressed=true]{border-color:#83ffe0;background:#24505a}.mct-repair header{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.mct-repair [data-hud]{display:flex;flex-wrap:wrap;gap:8px 18px;font:12px 'JetBrains Mono',monospace;color:#b3c7db}.mct-repair [data-score],.mct-repair [data-time]{color:#83ffe0}.mct-repair [data-game]{display:flex;flex:1;min-height:min-content;flex-direction:column;gap:8px}.mct-repair [data-assembly]{display:grid;grid-template-columns:190px minmax(0,1fr);gap:12px;border:1px solid #36586a;border-radius:12px;background:#102034;padding:12px;flex-shrink:0}.mct-repair [data-assembly]>aside{min-width:0}.mct-repair [data-assembly].many-parts{grid-template-columns:clamp(340px,42vw,440px) minmax(0,1fr)}.mct-repair [data-required]{display:grid;grid-template-columns:minmax(0,1fr);gap:3px 10px;margin-top:6px}.mct-repair .many-parts [data-required]{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.mct-repair [data-required] div{display:flex;min-width:0;gap:6px;align-items:center;font-size:11px;line-height:14px;border-bottom:1px solid #28445b;padding:2px}.mct-repair [data-required] span:first-of-type{flex:1;min-width:0;overflow-wrap:anywhere}.mct-repair [data-required] span:last-child{flex:0 0 16px;font-size:10px}.mct-repair [data-required] svg{width:28px;height:28px;flex-shrink:0}.mct-repair .done{opacity:.5}.mct-repair .done span:last-child{color:#83ffe0}.mct-repair [data-diagnostic]{color:#b3c7db;line-height:1.4;font-size:12px;max-width:900px;margin:6px 0}.mct-repair nav{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.mct-repair [data-cart]{display:block;position:relative;width:100%;height:220px;padding:0;background:#081622;border-color:#36586a;overflow:hidden;touch-action:none;container-type:size}.mct-repair [data-cart]>svg{width:100%;height:100%}
 /* Match the letterboxed viewBox used by the cart drawing. */
 .mct-repair [data-hotspots]{position:absolute;top:50%;left:50%;width:min(100%,calc(100cqh * 460 / 210));aspect-ratio:460 / 210;transform:translate(-50%,-50%);pointer-events:none;container-type:inline-size}.mct-repair [data-hotspots] span{border:1px dashed #83ffe0;border-radius:5px;background:#102034c9}.mct-repair [data-hotspots] svg{display:block;width:11cqw;height:11cqw}.mct-repair [data-hotspots] .done{border:1px solid #3ee08a;opacity:1;background:#174537}
 .mct-repair [data-bench]{flex:1;min-height:170px;position:relative;background:linear-gradient(#14253d44 1px,transparent 1px),linear-gradient(90deg,#14253d44 1px,transparent 1px),#08121f;background-size:32px 32px;border:1px solid #28445b;border-radius:10px}.mct-repair [data-pile]{position:absolute;inset:4px}.mct-repair [data-part]{position:absolute;min-height:0;padding:0;border:0;border-radius:0;background:transparent!important;box-shadow:none;touch-action:none;transform:translate(-50%,-50%)}.mct-repair [data-part] svg{display:block;width:100%;height:100%;pointer-events:none;transform:rotate(var(--angle));filter:drop-shadow(2px 3px 2px #0009)}.mct-repair [data-part]:focus-visible{outline:2px dashed #83ffe0}.mct-repair [data-part][aria-pressed=true] svg{filter:drop-shadow(0 0 3px #83ffe0)}.mct-repair [data-part].dragging{cursor:grabbing}.mct-repair [data-item-name]{position:absolute;top:6px;left:8px;max-width:calc(100% - 16px);padding:5px 8px;border-radius:5px;background:#102034ed;color:#edf3f7;z-index:2147483647;pointer-events:none;font-size:12px}.mct-repair [data-message]{min-height:18px;color:#83ffe0;font-size:12px}.mct-repair [data-screen]{margin:auto;max-width:680px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;padding:20px}.mct-repair [data-screen] p{line-height:1.6;color:#b3c7db}.mct-repair [data-screen] svg{max-width:460px;width:100%}.mct-repair [data-primary]{background:#a73d1c;border-color:#ff984f}.mct-repair [data-board]{text-align:left;white-space:pre-line;color:#83ffe0;font:13px 'JetBrains Mono',monospace}.mct-repair footer{font-size:12px;color:#b3c7db}.mct-repair .reject{outline:2px solid #ff8c8c}
 .mct-repair{container-type:size}
 @media(max-width:600px),(max-height:600px){.mct-repair{padding:8px;gap:6px}}
 @container (max-width:580px){.mct-repair [data-assembly],.mct-repair [data-assembly].many-parts{grid-template-columns:minmax(0,1fr);padding:6px;gap:6px}.mct-repair [data-cart]{height:190px}.mct-repair [data-required]{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.mct-repair [data-required] div{gap:4px}.mct-repair [data-required] svg{width:24px;height:24px}.mct-repair [data-hud]{font-size:10px}.mct-repair h2{font-size:18px}.mct-repair [data-diagnostic]{font-size:11px}}
 @container (max-height:580px){.mct-repair [data-game]{gap:5px}.mct-repair [data-assembly],.mct-repair [data-assembly].many-parts{padding:6px;gap:6px}.mct-repair [data-cart]{height:135px}.mct-repair [data-required]{row-gap:2px}.mct-repair [data-required] div{gap:4px;padding:0 2px}.mct-repair [data-required] svg{width:24px;height:24px}.mct-repair [data-bench]{min-height:94px}.mct-repair footer{font-size:11px}}
 @container (max-width:580px) and (max-height:580px){.mct-repair [data-assembly],.mct-repair [data-assembly].many-parts{grid-template-columns:minmax(0,3fr) minmax(0,2fr);grid-template-areas:"views views" "diag diag" "parts cart";align-items:start}.mct-repair [data-assembly]>div{display:contents}.mct-repair [data-assembly]>aside{grid-area:parts}.mct-repair nav{grid-area:views}.mct-repair [data-diagnostic]{grid-area:diag;margin:0}.mct-repair [data-cart]{grid-area:cart}.mct-repair [data-message]{min-height:30px}}
 @container (max-width:380px) and (max-height:580px){.mct-repair nav button{padding-inline:6px}.mct-repair [data-assembly].many-parts{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}.mct-repair .many-parts [data-required]{column-gap:4px}}
 @container (max-width:580px) and (max-height:580px){.mct-repair header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px}.mct-repair [data-hud]{grid-column:1/-1;grid-row:2;gap:3px 12px}}
 </style><header><h2>MCT REPAIRS</h2><div data-hud><span data-round>Round 1/3</span><span data-name></span><span>Score <b data-score>0</b></span><span>Time <b data-time>0:00</b></span></div><button data-close>Back to Leo · Esc</button></header>
 <div data-screen><h2 data-title>MCT REPAIRS</h2><div data-preview></div><p data-copy></p><div data-board></div><button data-primary>Start Game</button></div>
 <div data-game hidden><div data-assembly><aside><h3>Required Parts</h3><div data-required></div></aside><div><nav aria-label="MCT views"><h3 data-vehicle>MCT-01 Assembly</h3>${VIEWS.map(v=>`<button data-view="${v}">${label(v)}</button>`).join('')}</nav><p data-diagnostic></p><button data-cart aria-label="Install selected part on the MCT"><div data-hotspots></div></button></div></div><p data-message role="status" aria-live="polite"></p><div data-bench aria-label="Parts workbench"><div data-pile></div><div data-item-name hidden></div></div></div>
 <footer>Drag clutter aside to uncover parts. Drag parts onto the matching MCT view, or select a part then click the MCT. Keyboard: Tab / Enter to select and install; 1–4 or arrows change views. Esc returns to Leo. Times stay in this browser.</footer>`;
 document.body.append(root);
 const $=s=>root.querySelector(s),screen=$('[data-screen]'),gamePanel=$('[data-game]'),cart=$('[data-cart]'),pile=$('[data-pile]'),primary=$('[data-primary]');
 const pieces=new WeakMap(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let open=false,game=null,selected=null,drag=null,started=0,timer=0,transition=0,previousFocus=null,scores=[],stored=true,top=0,pileCount=0,hovered=null;
 let frame=0,lastFrame=null,floatTime=0;
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
  const box=$('[data-required]'),parts=required(game);box.replaceChildren();
  box.closest('[data-assembly]').classList.toggle('many-parts',parts.length>4);
  for(const p of parts){const row=document.createElement('div');row.className=game.placed.has(p.id)?'done':'';row.innerHTML=partArt(p.id);const text=document.createElement('span');text.textContent=`${p.name} · ${label(p.view)}`;row.append(text);const status=document.createElement('span');status.textContent=game.placed.has(p.id)?'OK':'';row.append(status);box.append(row);}
 }
 function setView(view){if(!game||game.phase!=='play')return;game.view=view;renderCart();}
 function metrics(){return pileMetrics(pile.clientWidth,pile.clientHeight,pileCount);}
 function position(el,m,home=pilePosition(pieces.get(el).home,m)){
  const p=floatingPosition(home,m,pieces.get(el).motion);
  el.style.left=p.x+'px';el.style.top=p.y+'px';
 }
 function place(el,m){
  el.style.width=el.style.height=m.size+'px';position(el,m);
 }
 function nudge(e,last,held,box=pile.getBoundingClientRect()){
  const m=metrics(),to={x:e.clientX-box.left,y:e.clientY-box.top};
  const from=last?{x:last.x-box.left,y:last.y-box.top}:to,reduced=reducedMotion.matches;
  const power=(reduced?45:185)*(last?Math.min(.55,Math.hypot(to.x-from.x,to.y-from.y)/48):1);
  for(const el of pile.children){
   if(el===held)continue;
   const piece=pieces.get(el),p=floatingPosition(pilePosition(piece.home,m),m,piece.motion);
   piece.motion=pushPileMotion(piece.motion,p,from,to,Math.max(105,m.size*1.8),power);
  }
 }
 function canFloat(){return open&&!document.hidden&&game?.phase==='play';}
 function floatPile(now){
  frame=0;if(!canFloat())return;
  const dt=lastFrame===null?0:Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
  const m=metrics(),reduced=reducedMotion.matches,focused=document.activeElement;
  if(!reduced)floatTime+=dt;
  for(const el of pile.children){
   if(el===drag?.el||el===hovered||(el===focused&&el.matches(':focus-visible')))continue;
   const piece=pieces.get(el),home=pilePosition(piece.home,m);
   const next=stepPileMotion(piece.motion,home,m,dt,floatTime,reduced);
   const moved=next.x!==piece.motion.x||next.y!==piece.motion.y;piece.motion=next;
   if(moved)position(el,m,home);
  }
  startMotion();
 }
 function startMotion(){if(!frame&&canFloat())frame=requestAnimationFrame(floatPile);}
 function stopMotion(){cancelAnimationFrame(frame);frame=0;lastFrame=null;}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion();else startMotion();});
 function raise(el){el.style.zIndex=++top;}
 function itemName(){
  const focused=document.activeElement?.closest?.('[data-part]'),el=drag?.el||hovered||(pile.contains(focused)?focused:null),box=$('[data-item-name]');
  box.hidden=!el||!pile.contains(el);box.textContent=box.hidden?'':el.getAttribute('aria-label');
 }
 function cancelDrag(){
  if(!drag)return;const {el,id}=drag;drag=null;el.classList.remove('dragging');place(el,metrics());
  try{if(el.hasPointerCapture(id))el.releasePointerCapture(id);}catch{}
  itemName();
 }
 function choose(el){
  if(!game||game.phase!=='play'||!pile.contains(el))return;
  selected=el;for(const b of pile.children)b.setAttribute('aria-pressed',String(b===el));
  raise(el);announce('Part selected. Choose its view, then install on the MCT.');
 }
 function drop(el){
  if(!el||!game||game.phase!=='play')return false;
  tick();const ok=install(game,el.dataset.part);
  if(!ok){el.classList.add('reject');announce('Part not fitted. Check Required Parts and the MCT view.');return false;}
  el.remove();selected=null;if(hovered===el)hovered=null;itemName();announce('Part installed.');renderRequired();renderCart();hud();
  if(game.phase!=='play'){stopMotion();clearInterval(timer);transition=setTimeout(finishRound,300);}else cart.focus({preventScroll:true});
  return true;
 }
 function renderPile(){
  pile.replaceChildren();hovered=null;top=0;const box=root.getBoundingClientRect(),ids=workbench(game,box.width,box.height-56),points=scatterPile(ids.length);pileCount=ids.length;
  const m=metrics();
  for(const [i,id] of ids.entries()){
   const p=PARTS.find(p=>p.id===id),b=document.createElement('button'),point=points[i];b.type='button';b.dataset.part=id;b.setAttribute('aria-label',p?.name||JUNK_NAMES[id]||label(id));b.setAttribute('aria-pressed','false');b.className=game.rounds[game.current].parts.includes(id)?'needed':'';b.innerHTML=partArt(id);b.style.setProperty('--angle',point.angle+'deg');
   pieces.set(b,{home:point,motion:{x:0,y:0,vx:0,vy:0,phase:i*2.4}});
   b.addEventListener('click',()=>choose(b));b.addEventListener('focus',()=>{raise(b);itemName();});b.addEventListener('blur',()=>itemName());pile.append(b);raise(b);place(b,m);
  }
  itemName();
 }
 function load(){
  clearInterval(timer);cancelDrag();selected=null;screen.hidden=true;gamePanel.hidden=false;$('[data-diagnostic]').textContent=game.rounds[game.current].diag;
  renderRequired();renderCart();renderPile();hud();announce('Find the required parts in the workbench.');timer=setInterval(tick,100);$('[data-view="side"]').focus();
  floatTime=0;startMotion();
 }
 function showScreen(title,copy,button){screen.hidden=false;gamePanel.hidden=true;$('[data-title]').textContent=title;$('[data-copy]').textContent=copy;primary.textContent=button;primary.focus();}
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
 // Capture is requested only during an active press.
 pile.addEventListener('pointerdown',e=>{
  const el=e.target.closest('[data-part]');if(!el||e.button!==0||!(e.buttons&1)||game?.phase!=='play'||drag)return;
  choose(el);el.classList.remove('reject');const r=el.getBoundingClientRect(),{motion}=pieces.get(el);
  motion.vx=motion.vy=0;drag={el,id:e.pointerId,x:e.clientX,y:e.clientY,last:{x:e.clientX,y:e.clientY},dx:e.clientX-r.left-r.width/2,dy:e.clientY-r.top-r.height/2,moved:false};
  nudge(e,null,el);
  try{el.setPointerCapture(e.pointerId);}catch{cancelDrag();return;}itemName();
 });
 addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  if(!(e.buttons&1)){cancelDrag();return;}
  if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5&&!drag.moved)return;
  e.preventDefault();drag.moved=true;
  const box=pile.getBoundingClientRect();nudge(e,drag.last,drag.el,box);drag.last={x:e.clientX,y:e.clientY};
  drag.el.classList.add('dragging');drag.el.style.left=e.clientX-drag.dx-box.left+'px';drag.el.style.top=e.clientY-drag.dy-box.top+'px';
 },{passive:false});
 addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return;const {el,moved}=drag,r=cart.getBoundingClientRect(),over=e.clientX>r.left&&e.clientX<r.right&&e.clientY>r.top&&e.clientY<r.bottom;
  if(moved&&!over){const box=pile.getBoundingClientRect(),piece=pieces.get(el);piece.home=pileDrop(e.clientX-drag.dx-box.left,e.clientY-drag.dy-box.top,metrics());piece.motion.x=piece.motion.y=0;}
  cancelDrag();if(moved&&over)drop(el);
 });
 const lost=e=>{if(drag?.id===e.pointerId)cancelDrag();};
 addEventListener('pointercancel',lost);pile.addEventListener('lostpointercapture',lost);
 pile.addEventListener('pointerover',e=>{hovered=e.target.closest('[data-part]');itemName();});
 pile.addEventListener('pointerout',e=>{hovered=e.relatedTarget?.closest?.('[data-part]');itemName();});
 // Normalized positions survive resizing without putting rotated corners off the bench.
 new ResizeObserver(()=>{if(!open||gamePanel.hidden||!pile.clientWidth)return;cancelDrag();const m=metrics();for(const el of pile.children)place(el,m);}).observe(pile);
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
