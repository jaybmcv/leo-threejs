// Keyboard, mouse and touch for walking, with Voyager's Reach's keys: WASD or the arrows move (relative to the camera),
// Shift runs, Space jumps (hold for height, again in the air), C crouches (a slide when running), X goes prone, B opens
// the emotes (1-0 play them), E uses what is in front of you (a seat, a bed, a lift), V or F swaps first and third
// person, M is Go to, N the ship map, L the ship log, P pings where you are for others aboard, T chats with them and R respawns in the arrival hall. Dragging looks around; on touch screens the left thumb steers a joystick and
// the right one looks.
const KEYS={forward:['KeyW','ArrowUp'],back:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight']};

export class WalkInput{
 constructor(surface,{joystick,stick,onAction}={}){
  this.surface=surface;this.down=new Set();this.look={x:0,y:0};this.stickVec={x:0,y:0};this.jumpQueued=false;this.jumpHeld=false;this.runLatched=false;this.zoom=0;
  this.onAction=onAction||(()=>{});this.enabled=true;
  addEventListener('keydown',e=>{
   if(e.code==='Escape'){this.onAction('escape');return;}
   // The browser's own shortcuts (Ctrl+C, Cmd+N...) are not game keys.
   if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest?.('input,select,textarea'))return;
   // With a sheet open, its own keys still answer (B closes the emotes, 1-0 pick one...).
   if(!this.enabled){if(!e.repeat)this.onAction('sheet',e.code);return;}
   // A held key repeats; only movement keys may (they are read as held), never an action.
   if(e.repeat){if(e.code.startsWith('Arrow')||e.code==='Space')e.preventDefault();return;}
   if(e.code==='Space'){this.jumpQueued=true;e.preventDefault();}
   else if(e.code==='KeyE'||e.code==='Enter')this.onAction('use');
   else if(e.code==='KeyV'||e.code==='KeyF')this.onAction('view');
   else if(e.code==='KeyM')this.onAction('places');
   else if(e.code==='KeyN')this.onAction('map');
   else if(e.code==='KeyC')this.onAction('crouch');
   else if(e.code==='KeyX')this.onAction('prone');
   else if(e.code==='KeyB')this.onAction('emotes');
   else if(e.code==='KeyR')this.onAction('respawn');
   else if(e.code==='KeyP')this.onAction('ping');
   else if(e.code==='KeyL')this.onAction('log');
   // Chat: the T must not land in the field it opens.
   else if(e.code==='KeyT'){e.preventDefault();this.onAction('chat');}
   else if(/^Digit[0-9]$/.test(e.code))this.onAction('emote',(+e.code.slice(5)+9)%10);
   if(e.code.startsWith('Arrow'))e.preventDefault();
   this.down.add(e.code);
  });
  addEventListener('keyup',e=>this.down.delete(e.code));
  addEventListener('blur',()=>this.down.clear());
  // Look: drag with any pointer on the scene (or move with the pointer locked).
  let drag=null;
  surface.addEventListener('pointerdown',e=>{
   if(e.pointerType==='touch'&&joystick&&e.clientX<innerWidth*.45)return;
   drag={id:e.pointerId,x:e.clientX,y:e.clientY};surface.setPointerCapture(e.pointerId);
  });
  surface.addEventListener('pointermove',e=>{
   if(document.pointerLockElement===surface){this.look.x+=e.movementX*.0022;this.look.y+=e.movementY*.0022;return;}
   if(!drag||drag.id!==e.pointerId)return;
   const k=e.pointerType==='touch'?.0055:.0042;this.look.x+=(e.clientX-drag.x)*k;this.look.y+=(e.clientY-drag.y)*k;drag.x=e.clientX;drag.y=e.clientY;
  });
  const end=e=>{if(drag&&drag.id===e.pointerId)drag=null;};
  surface.addEventListener('pointerup',end);surface.addEventListener('pointercancel',end);
  surface.addEventListener('wheel',e=>{this.zoom+=Math.sign(e.deltaY);e.preventDefault();},{passive:false});
  if(joystick&&stick)this.bindJoystick(joystick,stick);
 }
 bindJoystick(base,stick){
  let id=null,cx=0,cy=0;const radius=()=>base.clientWidth/2;
  const move=e=>{
   const r=radius();let dx=e.clientX-cx,dy=e.clientY-cy;const d=Math.hypot(dx,dy);if(d>r){dx*=r/d;dy*=r/d;}
   stick.style.transform=`translate(${dx}px,${dy}px)`;this.stickVec={x:dx/r,y:-dy/r};
   // Pushing the stick to its rim runs.
   this.stickRun=d>r*.92;
  };
  base.addEventListener('pointerdown',e=>{id=e.pointerId;const b=base.getBoundingClientRect();cx=b.left+b.width/2;cy=b.top+b.height/2;base.setPointerCapture(id);move(e);e.preventDefault();});
  base.addEventListener('pointermove',e=>{if(e.pointerId===id)move(e);});
  const end=e=>{if(e.pointerId!==id)return;id=null;this.stickVec={x:0,y:0};this.stickRun=false;stick.style.transform='';};
  base.addEventListener('pointerup',end);base.addEventListener('pointercancel',end);
 }
 key(name){return KEYS[name].some(k=>this.down.has(k));}
 // {x: strafe right, y: forward} in [-1,1], plus run and a queued jump (consumed).
 read(){
  let x=(this.key('right')?1:0)-(this.key('left')?1:0)+this.stickVec.x,y=(this.key('forward')?1:0)-(this.key('back')?1:0)+this.stickVec.y;
  const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}
  const run=this.down.has('ShiftLeft')||this.down.has('ShiftRight')||this.runLatched||this.stickRun;
  const jump=this.jumpQueued,held=this.down.has('Space')||this.jumpHeld;this.jumpQueued=false;
  const look={...this.look};this.look.x=0;this.look.y=0;const zoom=this.zoom;this.zoom=0;
  return {x,y,run,jump,held,look,zoom};
 }
}
