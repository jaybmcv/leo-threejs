// A lift car's state and how it moves, shared by the walk page (lift-ride.js) and the multiplayer server
// (server/leo-live.mjs), so a car steps the same way everywhere: alone, the page runs it; aboard with others, the
// server runs it and the page follows, stepping between the server's word.
//
// State: {y, v, at, target, phase, doors, dwell, calls}. `at` is the stop the car is at or last left, `doors` 0 shut
// to 1 open, `calls` the stops waiting for the car. Phases: open -> closing -> moving -> opening -> open, or closed
// (doors shut at a stop, nothing to do). A car serves its calls one after another, nearest first; doors stay open a
// moment (DWELL) before leaving for a call made on another landing, and close at once for a stop chosen in the car.
export const LIFT={speed:5.5,accel:2.6,doorTime:.9,dwell:2.5};

export function liftState(spec){
 const parked=Math.max(0,spec.stops.findIndex(s=>s.deck===spec.parked));// the crown lift waits at its lowest stop
 return {y:spec.stops[parked].y,v:0,at:parked,target:parked,phase:'open',doors:1,dwell:LIFT.dwell,calls:new Set()};
}
// The waiting stop nearest the car.
function nextCall(l,stops){let best=-1;for(const i of l.calls)if(best<0||Math.abs(stops[i].y-l.y)<Math.abs(stops[best].y-l.y))best=i;return best;}

// Send for the car to `index`. `now`: chosen in the car, so the doors close without the usual wait.
export function callLift(l,index,{now=false}={}){
 if(index===l.at&&l.phase!=='moving'){l.calls.delete(index);if(l.phase==='closing'||l.phase==='closed')l.phase='opening';return;}
 l.calls.add(index);
 if(now&&l.phase==='open')l.dwell=LIFT.dwell;
}
// Advance by dt seconds; returns how far the car rose (to carry whoever stands in it).
export function stepLift(l,stops,dt){
 if(l.phase==='open'){l.dwell+=dt;if(l.calls.size&&l.dwell>=LIFT.dwell)l.phase='closing';return 0;}
 if(l.phase==='opening'){l.doors=Math.min(1,l.doors+dt/LIFT.doorTime);if(l.doors===1){l.phase='open';l.dwell=0;}return 0;}
 if(l.phase==='closing'||l.phase==='closed'){
  if(l.phase==='closing'){l.doors=Math.max(0,l.doors-dt/LIFT.doorTime);if(l.doors)return 0;l.phase='closed';}
  if(!l.calls.size)return 0;
  l.target=nextCall(l,stops);l.phase='moving';l.v=0;return 0;
 }
 // Moving: accelerate, cruise and brake to stop on the target.
 const goal=stops[l.target].y,dir=Math.sign(goal-l.y),dist=Math.abs(goal-l.y);
 const vmax=Math.min(LIFT.speed,Math.sqrt(2*LIFT.accel*dist)+.05);l.v=Math.min(vmax,l.v+LIFT.accel*dt);
 const prev=l.y;l.y+=dir*Math.min(dist,l.v*dt);
 if(Math.abs(goal-l.y)<1e-4){l.y=goal;l.v=0;l.at=l.target;l.calls.delete(l.at);l.phase='opening';}
 return l.y-prev;
}
// The state as plain data for the wire, and back.
export const liftWire=l=>({y:l.y,v:l.v,at:l.at,target:l.target,phase:l.phase,doors:l.doors,dwell:l.dwell,calls:[...l.calls]});
export function applyLiftWire(l,w){Object.assign(l,{y:w.y,v:w.v,at:w.at,target:w.target,phase:w.phase,doors:w.doors,dwell:w.dwell});l.calls=new Set(w.calls);}
