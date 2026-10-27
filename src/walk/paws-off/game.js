import * as T from 'three';
import {roomObject} from '../../plan/rooms.js';
import {newGame,step,press,pad,beltAt} from './rules.js';

// Paws Off (PAWS_OFF.md, stage 1): a typing run on the Deck 16 exercise studio's six treadmills, played in the
// ship itself so others aboard see Cosmo running. E at a treadmill steps on; the camera goes behind him, the belt
// scrolls and he runs at its speed. A heads-up display shows the characters to type and a shrinking timer; miss it and
// he tumbles off the back, then a card shows the time survived and this browser's best. The rules are rules.js.
// While a run is on, the keyboard is the game's: keys are caught before the walk sees them, and Esc steps off.
// The treadmills are the room's own meshes, found by name (areas.js is unchanged); the belts drawn over them are ours.
// A second station, the arcade treadmill in the Deck 17 Hydro-Nip Lounge (arcade.js), is drawn by the arcade and passed
// in; a run there is the same game.
const ROOM='Area_d16-gym-3',REACH=1.5,READY_S=3,FALL_S=1.1,BEST_KEY='leo-paws-off-best';
const STRIDE=1.3;// Cosmo's stride speed for a belt speed: a walk at the start, a sprint by the end

// The belt's slats, scrolled along its length.
function beltTexture(){
 const c=document.createElement('canvas');c.width=64;c.height=64;const g=c.getContext('2d');
 g.fillStyle='#1c2730';g.fillRect(0,0,64,64);g.fillStyle='#2c3c48';for(let y=0;y<64;y+=16)g.fillRect(0,y,64,7);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;
}

const CSS=`
#paws{position:fixed;left:50%;top:76px;transform:translateX(-50%);z-index:8;display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;font-family:var(--sans)}
#paws[hidden],#paws [hidden]{display:none!important}
#paws .bar{display:flex;gap:18px;align-items:center;background:var(--surface);border:1px solid var(--hairline);border-radius:999px;padding:8px 16px;font:400 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
#paws .bar b{color:var(--orange);font-weight:600}#paws .bar span{color:var(--text)}
#paws .keys{display:flex;gap:8px}
#paws .keys i{display:grid;place-items:center;width:58px;height:66px;border-radius:12px;background:var(--card);border:1px solid var(--hairline);font:600 38px/1 var(--mono);font-style:normal;color:var(--text);box-shadow:0 6px 24px rgba(0,0,0,.35)}
#paws .keys i.done{background:rgba(47,214,197,.16);border-color:var(--teal);color:var(--teal)}
#paws .keys i.next{border-color:var(--orange);box-shadow:0 0 0 2px rgba(248,88,0,.35),0 6px 24px rgba(0,0,0,.35)}
#paws .keys.miss i.next{animation:paws-shake .22s}
@keyframes paws-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
#paws .timer{width:min(320px,70vw);height:8px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden}
#paws .timer div{height:100%;background:var(--teal);transform-origin:left;transition:background .2s}
#paws .timer.low div{background:var(--orange)}
#paws .big{font:500 96px/1 var(--display);color:#fff;text-shadow:0 0 28px rgba(0,0,0,.6)}
#paws .note{background:var(--surface);border-radius:10px;padding:8px 14px;font:400 12px/1.3 var(--mono);color:var(--body)}
#paws .pad{pointer-events:auto;display:grid;grid-template-columns:repeat(4,64px);gap:8px;margin-top:6px}
#paws .pad button{height:58px;border-radius:12px;border:1px solid var(--hairline);background:var(--card);color:var(--text);font:600 26px/1 var(--mono)}
#paws .card{pointer-events:auto;min-width:min(320px,86vw);background:var(--card);border:1px solid var(--hairline);border-radius:18px;padding:22px 24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}
#paws .card .eyebrow{font:400 10px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--orange);margin-bottom:12px}
#paws .card h2{margin:0;font:500 46px/1 var(--display);color:var(--text)}
#paws .card p{margin:10px 0 0;font:400 13px/1.4 var(--sans);color:var(--body)}
#paws .card p b{color:var(--teal);font-weight:600}
#paws .card .row{display:flex;gap:8px;justify-content:center;margin-top:18px}
#paws .card button{border-radius:10px;padding:11px 16px;font:500 12px/1 var(--mono);letter-spacing:.06em;border:1px solid var(--hairline);background:none}
#paws .card button.go{background:var(--orange);border-color:var(--orange);color:#fff}
`;

// `ship`: the walk's ship (its rooms still unmerged); `ground(point)`: the floor to stand on near a point, or null;
// `more`: treadmills drawn elsewhere (the arcade's), each as below: the place its card names, the floor's height round
// it, its belt's centre on top, the way a runner faces, its length and width.
export function createPawsOff(ship,{ground,more=[],onStart=()=>{},onEnd=()=>{}}){
 const room=roomObject(ship,ROOM),found=[];
 if(room){
  room.updateMatrixWorld(true);
  const meshes=[],displays=[],floor=room.getWorldPosition(new T.Vector3()).y;
  room.traverse(o=>{if(!o.isMesh)return;if(o.name==='Treadmill')meshes.push(o);else if(o.name==='Fitness_display')displays.push(o.getWorldPosition(new T.Vector3()));});
  // Each treadmill: its belt's centre on top, the way a runner faces (to its display), its length and width.
  for(const o of meshes){
   o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,size=b.getSize(new T.Vector3()).multiply(new T.Vector3().setFromMatrixScale(o.matrixWorld));
   const centre=b.getCenter(new T.Vector3()).applyMatrix4(o.matrixWorld),top=new T.Box3().copy(b).applyMatrix4(o.matrixWorld).max.y;
   const display=displays.reduce((a,d)=>!a||d.distanceToSquared(centre)<a.distanceToSquared(centre)?d:a,null);
   const front=display?new T.Vector3(display.x-centre.x,0,display.z-centre.z).normalize():new T.Vector3(0,0,-1).applyQuaternion(o.getWorldQuaternion(new T.Quaternion())).setY(0).normalize();
   const along=Math.abs(front.x)>Math.abs(front.z)?'x':'z';
   found.push({place:'Exercise studio',floor,centre,top,front,length:Math.max(size.x,size.z),width:Math.min(size.x,size.z)});
  }
 }
 const all=[...found,...more];if(!all.length)return null;
 // The belts, in a group at each floor's height, so each is drawn with its deck's band (main.js toBand).
 const groups=new Map(),texture=beltTexture();
 const mills=all.map((t,i)=>{
  const {place,floor,centre,top,front,length,width}=t,map=texture.clone();map.repeat.set(1,length*.77/.5);
  if(!groups.has(floor)){const g=new T.Group();g.name='Paws_off_belts';g.position.y=floor;groups.set(floor,g);}
  const belt=new T.Mesh(new T.PlaneGeometry(width*.74,length*.74).rotateX(-Math.PI/2),new T.MeshStandardMaterial({name:'Paws_off_belt',map,roughness:.85}));
  belt.name='Paws_off_belt_'+(i+1);belt.userData.noCollide=true;belt.position.set(centre.x,top+.012-floor,centre.z);belt.rotation.y=Math.atan2(front.x,front.z);groups.get(floor).add(belt);
  // Cosmo runs a little behind the middle, clear of the handles.
  const stand=new T.Vector3(centre.x,top,centre.z).addScaledVector(front,-length*.08);
  return {index:i,place,centre,top,front,length,width,stand,yaw:Math.atan2(front.x,front.z),map,speed:0};
 });

 // The heads-up display, the countdown, the results card and the touch pad.
 document.head.appendChild(Object.assign(document.createElement('style'),{textContent:CSS}));
 const hud=document.createElement('div');hud.id='paws';hud.hidden=true;hud.setAttribute('aria-live','polite');
 hud.innerHTML=`<div class="bar"><b>Paws Off</b><span class="time">0.0 s</span><span class="belt"></span></div>
<div class="keys"></div><div class="timer"><div></div></div><div class="big" hidden></div><div class="note" hidden></div><div class="pad" hidden></div>
<div class="card" hidden><div class="eyebrow">Paws Off · Exercise studio</div><h2></h2><p class="cleared"></p><p class="best"></p>
<div class="row"><button type="button" class="go">Run again</button><button type="button" class="leave">Step off</button></div></div>`;
 document.body.appendChild(hud);
 const $=s=>hud.querySelector(s),keysEl=$('.keys'),timerEl=$('.timer'),big=$('.big'),note=$('.note'),padEl=$('.pad'),card=$('.card');
 const touch=matchMedia('(pointer:coarse)').matches;
 $('.go').addEventListener('click',()=>again());$('.leave').addEventListener('click',()=>leave());
 padEl.addEventListener('pointerdown',e=>{const k=e.target.closest('button')?.dataset.key;if(k){e.preventDefault();type(k);}});
 const readBest=()=>{try{return Number(localStorage.getItem(BEST_KEY))||0;}catch{return 0;}};

 // phase: null (off) · 'ready' (the countdown, belt starting) · 'run' · 'fall' (off the back) · 'over' (the card).
 let mill=null,phase=null,clock=0,game=null,paused=false,shown='',missAt=0,result=null;
 const body={pos:new T.Vector3(),yaw:0,speed:0,tumble:0};
 function begin(m){
  // The floor he lands on, behind the treadmill.
  m.floor??=ground(m.stand.clone().addScaledVector(m.front,-(m.length/2+.6)))?.y??m.top-.22;
  mill=m;game=newGame((Math.random()*2**31)|0);phase='ready';clock=0;paused=false;shown='';
  $('.eyebrow').textContent=`Paws Off · ${m.place}`;
  hud.hidden=false;card.hidden=true;note.hidden=true;keysEl.hidden=true;timerEl.hidden=true;padEl.hidden=true;
 }
 function type(key){
  if(paused){paused=false;note.hidden=true;return;}
  if(phase!=='run')return;
  const r=press(game,key);
  if(r==='miss'){missAt=performance.now();keysEl.classList.remove('miss');void keysEl.offsetWidth;keysEl.classList.add('miss');}
  if(game.over)fall();else draw();
 }
 function fall(){phase='fall';clock=0;timerEl.hidden=true;padEl.hidden=true;}
 function finish(){
  phase='over';keysEl.hidden=true;
  const time=game.t,best=readBest(),newBest=time>best;
  if(newBest)try{localStorage.setItem(BEST_KEY,time.toFixed(1));}catch{}
  result={time,best:Math.max(best,time),newBest,cleared:game.cleared};
  $('h2').textContent=`${time.toFixed(1)} s`;
  $('.cleared').textContent=`${game.cleared} prompt${game.cleared===1?'':'s'} typed, up to ${game.prompt.length} characters at a time.`;
  $('.best').innerHTML=newBest&&best?'<b>A new best</b> in this browser.':newBest?'Your first run here: that’s your best to beat.':`Your best here: <b>${best.toFixed(1)} s</b>`;
  card.hidden=false;$('.go').focus({preventScroll:true});
 }
 function again(){if(phase==='over'){const m=mill;begin(m);}}
 function leave(){
  if(!phase)return;
  const fell=phase==='fall'||phase==='over',m=mill;
  // Off the back after a fall, where he landed; stepping off mid-run, just behind the treadmill.
  const at=fell?body.pos.clone():m.stand.clone().addScaledVector(m.front,-(m.length/2+.6));
  phase=null;mill=null;game=null;hud.hidden=true;m.speed=0;
  onEnd({at:ground(at)||m.stand.clone(),yaw:m.yaw});
 }
 // The prompt's tiles, redrawn when it changes; the timer every frame.
 function draw(){
  const key=game.prompt+'|'+game.typed;
  if(key!==shown){shown=key;keysEl.textContent='';
   [...game.prompt].forEach((c,i)=>{const t=document.createElement('i');t.textContent=c;if(i<game.typed)t.className='done';else if(i===game.typed)t.className='next';keysEl.appendChild(t);});
   if(touch){padEl.textContent='';for(const k of pad(game,8)){const b=document.createElement('button');b.type='button';b.textContent=k;b.dataset.key=k;padEl.appendChild(b);}}
  }
  const left=game.left/game.limit;timerEl.firstChild.style.transform=`scaleX(${Math.max(0,left)})`;timerEl.classList.toggle('low',left<.35);
  $('.time').textContent=`${game.t.toFixed(1)} s`;$('.belt').textContent=`Belt ${beltAt(game.t).toFixed(1)} m/s`;
 }

 // Keys while a run is on are the game's alone: caught before the walk's own listener sees them.
 function onKey(e){
  if(!phase||e.ctrlKey||e.metaKey||e.altKey)return;
  e.stopImmediatePropagation();if(e.type!=='keydown')return;
  if(e.code==='Escape'){e.preventDefault();leave();return;}
  if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault();
  if(e.repeat)return;
  if(phase==='over'){if(e.code==='Enter'||e.code==='Space'){e.preventDefault();again();}return;}
  if(paused){type('');return;}
  if(e.key.length===1)type(e.key);
 }
 addEventListener('keydown',onKey,true);addEventListener('keyup',onKey,true);
 // Away from the window, the run waits for a key.
 const pause=()=>{if(phase==='ready'||phase==='run'){paused=true;note.textContent='Paused · press any key to run on';note.hidden=false;}};
 addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});

 return {
  groups:[...groups.values()],mills,
  get active(){return !!phase;},get phase(){return phase;},get game(){return game;},get result(){return result;},
  // The use prompt, standing at a treadmill (or on it).
  near(p){
   for(const m of mills){
    if(Math.abs(p.y-m.top)>1.2)continue;
    const dx=p.x-m.centre.x,dz=p.z-m.centre.z,a=dx*m.front.x+dz*m.front.z,s=-dx*m.front.z+dz*m.front.x;
    if(Math.abs(a)<m.length/2+REACH&&Math.abs(s)<m.width/2+REACH)return {kind:'treadmill',label:'Play Paws Off',mill:m};
   }
   return null;
  },
  // A treadmill with someone on its belt.
  onBelt(p){return mills.find(m=>Math.abs(p.y-m.top)<.5&&Math.abs((p.x-m.centre.x)*m.front.x+(p.z-m.centre.z)*m.front.z)<m.length/2&&Math.abs(-(p.x-m.centre.x)*m.front.z+(p.z-m.centre.z)*m.front.x)<m.width/2)||null;},
  start(m){if(phase)return;begin(m);onStart(m);},
  leave,
  // One frame: the countdown, the run, the fall. Returns where Cosmo is and how he moves, or null when off.
  // `others`: where the others playing aboard stand, so their belts run too.
  update(dt,others=[]){
   for(const m of mills)if(m!==mill)m.speed=others.some(p=>this.onBelt(p)===m)?beltAt(20):0;
   for(const m of mills)if(m.speed)m.map.offset.y=(m.map.offset.y+m.speed*dt/.5)%1;
   if(!phase)return null;
   const m=mill;if(!paused)clock+=dt;
   body.pos.copy(m.stand);body.yaw=m.yaw;body.tumble=0;body.speed=0;
   if(phase==='ready'){
    const left=Math.ceil(READY_S-clock);big.hidden=false;big.textContent=left>0?String(left):'Run!';
    m.speed=beltAt(0)*Math.min(1,clock/READY_S);body.speed=m.speed*STRIDE;
    if(clock>=READY_S){phase='run';clock=0;keysEl.hidden=false;timerEl.hidden=false;padEl.hidden=!touch;shown='';draw();}
   }else if(phase==='run'){
    if(clock>.6)big.hidden=true;
    if(!paused){step(game,dt);draw();if(game.over)fall();}
    m.speed=beltAt(game.t);body.speed=m.speed*STRIDE;
    // A wrong key: a stumble back along the belt, quickly made up.
    const since=(performance.now()-missAt)/1000;if(since<.4)body.pos.addScaledVector(m.front,-.18*Math.sin(since/.4*Math.PI));
   }else if(phase==='fall'||phase==='over'){
    if(phase==='fall'){clock=Math.min(clock,FALL_S);if(clock>=FALL_S)finish();}
    const f=phase==='over'?1:clock/FALL_S,e=f*f*(3-2*f);
    m.speed=T.MathUtils.lerp(beltAt(game.t),0,e);
    // Carried off the back, over onto his back on the floor behind.
    body.pos.addScaledVector(m.front,-(m.length/2+.55)*e);
    body.pos.y=T.MathUtils.lerp(m.top,m.floor,T.MathUtils.smoothstep(f,.35,.8))+Math.sin(Math.min(1,f/.5)*Math.PI)*.18;
    body.tumble=e;body.speed=0;
   }
   return body;
  },
 };
}
