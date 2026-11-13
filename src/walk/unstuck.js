import * as T from 'three';

// Unstuck: a visitor caught somewhere the walk can't get them out of (a gap between props, a ledge the feet can't find,
// a pocket with no way out) is offered a button, "Stuck? Pop out", that drops them on clear floor a couple of metres
// away. The walk senses it (createStuckSense), the page shows the button (createUnstuck, walk.html #unstuck) and
// main.js does the pop through its own Go to path, the one Respawn takes, so Leo live sees an ordinary move.
//
// Sensed only while the walker is on foot with the walk's own keys: never seated or lying, riding a lift or a cart, in a
// lift car, in a game, under a panel or sheet, swimming, in the hamster ball, on the grapple line or the longboard.
// Standing still is never stuck: every test but the one for being wedged in the air needs the movement keys or the stick.
export const STUCK={
 // Blocked: `push` s of trying to move (keys or the stick past half way) without getting `budge` m from where it began.
 push:4,budge:.75,
 // Wedged: off the ground for `hang` s (not gliding, not on the line) without moving `drift` m: held up by something the
 // feet can't stand on.
 hang:2,drift:.5,
 // Boxed in: `boxed` s of trying while never more than `roam` m from one spot, a pocket the walker can't climb out of.
 boxed:8,roam:2,
 // Trying time is given back as fast as it builds while the keys are let go, so a pause to look round doesn't start
 // the count again, and standing about wears it away.
 // Free again: `free` m from where the button came up, and it goes.
 free:3,
 // The pop: the nearest floor `near` to `far` m off, on rings `ring` m apart with points `arc` m apart round each.
 near:2,far:4,ring:.25,arc:.4,
 // Stuck again within `again` s and `same` m of the last pop: the button offers Respawn instead.
 again:30,same:5,
};

const gone=(a,p,m)=>(a.x-p.x)**2+(a.y-p.y)**2+(a.z-p.z)**2>m*m;
const copy=p=>({x:p.x,y:p.y,z:p.z});

// The sense, frame by frame: update(dt,{free,trying,air,at}) gives why the walker is stuck ('blocked', 'wedged' or
// 'boxed') or null. `free`: on foot with the walk's keys (above); `trying`: movement keys or the stick held; `air`: off
// the ground; `at`: the feet. Once stuck it stays stuck until the walker is `free` m away or something takes them over.
export function createStuckSense(o=STUCK){
 const push={at:null,s:0},roam={at:null,s:0},hang={at:null,s:0};let reason=null,shownAt=null;
 // Seconds of trying near one spot: a move of more than `m` starts a new spot.
 const effort=(t,at,dt,trying,m)=>{if(!t.at||gone(t.at,at,m)){t.at=copy(at);t.s=0;}t.s=Math.max(0,t.s+(trying?dt:-dt));return t.s;};
 function reset(){push.at=roam.at=hang.at=null;push.s=roam.s=hang.s=0;reason=null;shownAt=null;}
 return {
  get reason(){return reason;},
  get shownAt(){return shownAt;},
  reset,
  update(dt,{free,trying,air,at}){
   if(!free){if(reason||push.at)reset();return null;}
   if(reason){if(gone(shownAt,at,o.free))reset();return reason;}
   const pushed=effort(push,at,dt,trying,o.budge)>=o.push,boxed=effort(roam,at,dt,trying,o.roam)>=o.boxed;
   if(!air){hang.at=null;hang.s=0;}else if(!hang.at||gone(hang.at,at,o.drift)){hang.at=copy(at);hang.s=0;}else hang.s+=dt;
   reason=pushed?'blocked':hang.s>=o.hang?'wedged':boxed?'boxed':null;
   if(reason)shownAt=copy(at);
   return reason;
  },
 };
}

// Where to pop out to from `at` (feet, ship metres): the nearest spot `near` to `far` m off that passes the walk's own
// landing checks, as public-area.js publicStand does: stand(p) is findStand(colliders,p,{radius:0}) (planned interior
// floor within 1.6 m up or down, with room for the walker's capsule), check(p) is Go to's gotoStand (floor under the
// whole footprint); it must be in sight of the walker at chest height (never through a wall, the hull or its windows),
// and public (restrictedAt, public-area.js). A walker already in an area they let themselves into (the clubhouse, the
// lever-panel bay) may land inside it too. Round each ring the spots nearest the way the walker faces (`toward`, [x,z])
// come first. Null when nothing near passes: the caller respawns instead.
export const OWN_WAY_IN=new Set(['clubhouse','lever-panel']);
export function popStand(at,{colliders,stand,check,restrictedAt,toward=null,o=STUCK}){
 if(!Array.isArray(at)||at.length!==3||!at.every(Number.isFinite))return null;
 const here=restrictedAt(at),allowed=area=>!area||(area===here&&OWN_WAY_IN.has(area));
 const from=new T.Vector3(at[0],at[1]+1,at[2]),to=new T.Vector3(),sight=new T.Ray();
 const seen=q=>{to.set(q.x,q.y+1,q.z);const d=from.distanceTo(to);sight.set(from,to.clone().sub(from).normalize());return !colliders.raycast(sight,d);};
 const tx=toward?.[0]??0,tz=toward?.[1]??0;
 for(let d=o.near;d<=o.far+1e-6;d+=o.ring){
  const n=Math.max(8,Math.round(d*2*Math.PI/o.arc)),angles=Array.from({length:n},(_,i)=>i/n*Math.PI*2);
  if(tx||tz)angles.sort((a,b)=>(Math.cos(b)*tx+Math.sin(b)*tz)-(Math.cos(a)*tx+Math.sin(a)*tz));
  for(const a of angles){
   const q=stand([at[0]+Math.cos(a)*d,at[1],at[2]+Math.sin(a)*d]);
   if(!q||!allowed(restrictedAt([q.x,q.y,q.z]))||!seen(q))continue;
   const g=check([q.x,q.y,q.z]);if(g)return g;
  }
 }
 return null;
}

// The button (walk.html #unstuck). It shows while the sense says stuck; a click, a tap, U, or Enter or E with nothing
// to use in front (press(), from the walk's Use) calls pop('pop'), or pop('respawn') when the walker is stuck again
// right where the last pop was. update(dt,state) runs once a frame with the sense's state.
export function createUnstuck(button,{pop,o=STUCK}){
 const sense=createStuckSense(o),label=button.querySelector('.label');
 let shown=false,mode='pop',clock=0,last=null;
 function show(on,at){
  if(on===shown)return;shown=on;button.hidden=!on;if(!on)return;
  mode=last&&clock-last.t<o.again&&!gone(last.at,at,o.same)?'respawn':'pop';button.dataset.mode=mode;
  const text=mode==='pop'?'Stuck? Pop out':'Still stuck? Respawn';
  if(label)label.textContent=text;button.setAttribute('aria-label',text+(mode==='pop'?' a couple of metres away':' in the arrival hall')+' (U)');
 }
 function press(){
  if(!shown)return false;const was=mode,at=sense.shownAt;show(false);sense.reset();
  last=was==='pop'&&at?{at,t:clock}:null;pop(was);return true;
 }
 button.addEventListener('click',e=>{e.preventDefault();press();});
 // U while the button is up (before the walk's own keys, so a key bound to an emote doesn't also play it).
 addEventListener('keydown',e=>{
  if(e.code!=='KeyU'||!shown||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target?.closest?.('input,select,textarea'))return;
  e.preventDefault();e.stopImmediatePropagation();press();
 },true);
 return {
  get shown(){return shown;},get mode(){return mode;},get reason(){return sense.reason;},sense,press,
  update(dt,state){clock+=dt;const r=sense.update(dt,state);show(!!r,state.at);return r;},
 };
}
