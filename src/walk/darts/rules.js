// The nine-dart challenge's rules (from tester feedback), kept apart from the screen so a Node check can play them.
// Board coordinates are millimetres from the bull, x right and y up, on a standard board: twenty numbered sectors with
// 20 at the top, the triple ring 99 to 107 mm out, the double ring 162 to 170 mm, the outer bull to 15.9 mm (25) and
// the inner bull to 6.35 mm (50). Past the double ring is a miss (0). A ring's edges count as that ring.
export const NUMBERS=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
export const RING={bull:6.35,outer:15.9,trebleIn:99,trebleOut:107,doubleIn:162,doubleOut:170,edge:225};
export const DARTS=9,FLIGHT=.4,AIM_SPEED=150,AIM_LIMIT=210,SWAY=12,SCATTER=7;

// The points for a dart that lands at (x, y).
export function score(x,y){
 const r=Math.hypot(x,y);
 if(r<=RING.bull)return {points:50,mult:1,number:0,label:'BULL'};
 if(r<=RING.outer)return {points:25,mult:1,number:0,label:'25'};
 if(r>RING.doubleOut)return {points:0,mult:0,number:0,label:'MISS'};
 const deg=((Math.atan2(x,y)*180/Math.PI)+369)%360,number=NUMBERS[Math.floor(deg/18)%20];
 const mult=r>=RING.doubleIn?2:r>=RING.trebleIn&&r<=RING.trebleOut?3:1;
 return {points:number*mult,mult,number,label:(mult===3?'T':mult===2?'D':'')+number};
}

// A small seeded random source, so a check can replay a round.
function random(seed){let s=seed>>>0||1;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}

// The hand's slow sway round the aim; the marker shows it, so what you see is where the dart goes, give or take a little.
export function sway(t){return {x:SWAY*Math.sin(t*1.3),y:SWAY*Math.sin(t*1.9+1)};}

export function newRound(seed=(Math.random()*2**31)|0){return {phase:'aim',t:0,aim:{x:0,y:0},darts:[],total:0,flight:null,held:false,rng:random(seed),still:false};}
export const marker=r=>{const s=r.still?{x:0,y:0}:sway(r.t);return {x:r.aim.x+s.x,y:r.aim.y+s.y};};

// Moves the aim with the held arrows and the dart in flight; returns the dart that landed this step, if one did.
export function step(r,dt,keys={}){
 r.t+=dt;
 if(r.phase==='aim'){
  const dx=(keys.right?1:0)-(keys.left?1:0),dy=(keys.up?1:0)-(keys.down?1:0);
  r.aim.x+=dx*AIM_SPEED*dt;r.aim.y+=dy*AIM_SPEED*dt;
  const d=Math.hypot(r.aim.x,r.aim.y);if(d>AIM_LIMIT){r.aim.x*=AIM_LIMIT/d;r.aim.y*=AIM_LIMIT/d;}
  return null;
 }
 if(r.phase!=='flight')return null;
 r.flight.t+=dt;if(r.flight.t<FLIGHT)return null;
 const {x,y}=r.flight,dart={x,y,...score(x,y)};r.flight=null;r.darts.push(dart);r.total+=dart.points;
 r.phase=r.darts.length>=DARTS?'done':'aim';return dart;
}

// The throw key. A dart leaves only on a fresh press while aiming: a held key's repeats, a press while one is in the air
// and presses after the ninth do nothing, and the key must come up before the next dart.
export function press(r,repeat=false){
 if(repeat||r.held)return false;r.held=true;
 if(r.phase!=='aim')return false;
 const m=marker(r),g=()=>{const u=1-r.rng(),v=r.rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
 const k=r.still?0:SCATTER;r.flight={x:m.x+g()*k,y:m.y+g()*k,t:0};r.phase='flight';return true;
}
export function release(r){r.held=false;}
