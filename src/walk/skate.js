// The skateboard (from tester feedback): Skate in the toolbar (or the phone's More) steps Cosmo onto his own plain board
// (glide.js SKATEBOARD) and off again. On it the walk's keys ride at the run speed without Shift and stop when let go,
// Space (Jump) is an ollie, the walk's own single jump, and X (Flip on a touch screen) one cosmetic kickflip while in the
// air: the board turns over under his feet and is flat again by the landing. It adds no height, speed or reach.
// He gets on only standing on firm, level floor; the walk takes him off it (`off`) for a seat, a bed, a game, the ball,
// a swim or anything else that takes him over. Only this visitor sees the board for now: others see him run.
export const SKATE={flip:.42,level:.9};

// button: the Skate toggle; hint: the riding controls card; flipButton: Flip on a touch screen. controller: the walk's
// (controller.js, whose `skating` this sets). blocked(): why he can't get on now ('' if he can).
export function createSkate({button,hint,flipButton,controller,blocked=()=>'',touch=()=>false}){
 let on=false,flipS=-1,flipped=false,noteTimer=0;
 const keys=()=>touch()?'Stick rides · Jump ollies · Flip kickflips in the air · Skate steps off':'W A S D ride · Space ollies · X kickflips in the air · Skate steps off';
 function show(note=''){
  if(!hint)return;clearTimeout(noteTimer);
  hint.hidden=!on&&!note;if(hint.hidden)return;
  hint.querySelector('.keys').textContent=note||keys();hint.querySelector('.who').hidden=!!note;
  // A refusal shows for a moment, then goes (or gives way to the riding controls).
  if(note)noteTimer=setTimeout(()=>show(),2600);
 }
 function set(value){
  on=value;controller.skating=on;flipS=-1;flipped=false;
  button?.setAttribute('aria-pressed',on?'true':'false');button?.classList.toggle('on',on);
  document.body.classList.toggle('skating',on);show();
 }
 if(button){
  button.addEventListener('click',()=>api.toggle());
  // Enter on the focused toggle is the toggle's own, not the walk's Use; Space stays the ollie and never presses it.
  button.addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='NumpadEnter')e.stopPropagation();else if(e.code==='Space')e.preventDefault();});
 }
 flipButton?.addEventListener('pointerdown',e=>{e.preventDefault();api.kickflip();});
 const api={
  get on(){return on;},
  // How far through the kickflip (0..1), 0 with none going.
  get flip(){return flipS<0?0:Math.min(1,flipS/SKATE.flip);},
  // True if he got on or off.
  toggle(){
   if(on){set(false);return true;}
   const why=blocked();if(why){show(why);return false;}
   set(true);return true;
  },
  off(){if(on)set(false);},
  // One kickflip in the air: none on the ground, and none while one turns or after one this jump.
  kickflip(){
   if(!on||controller.grounded||flipS>=0||flipped)return false;
   flipS=0;flipped=true;return true;
  },
  // Each frame, after the walk's step: a landing finishes any kickflip, flat, and allows the next jump's.
  update(dt){
   if(!on)return;
   if(controller.grounded){flipS=-1;flipped=false;return;}
   if(flipS>=0){flipS+=dt;if(flipS>=SKATE.flip)flipS=-1;}
  },
 };
 return api;
}
// Why the walker can't get on the board where he stands ('' if he can): only standing on firm, level floor.
export function skateFooting(controller){
 if(!controller.grounded||!controller.ground||controller.ground.normal.y<SKATE.level)return 'Stand on level floor to get on the board';
 return '';
}
