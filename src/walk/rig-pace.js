// When Cosmo's rig solves (avatar.js): every frame while he can be seen. While nothing draws him (first person), it
// gathers frames and solves them together, as a machine running at 1/cap fps would, never in a step longer than the
// figure's own cap. Each frame's time counts as the figure counts it (at most `cap`) and all of it is spent. A change of
// discrete input (grounded, jumps, stance, swimming, emote, rest) solves at once, and the time gathered before that frame
// is solved first with the previous frame's inputs, the ones it was gathered under: the states the rig starts on an edge
// (a landing, the jump clock, prone, swimming) see each change once, at its own time. So he is current whenever he
// shows. A gathering that would pass the cap solves a full step and carries the rest (less than a frame) to the next.
//   rigPace(cap) -> next(dt,unseen,inputs): this frame's solves, in order, each {dt, prior}: prior means "with the
//   previous frame's inputs". None, one, or (on a change of input) two.
const SLACK=1e-6;
export function rigPace(cap=.05){
 let due=0,last=null;
 return (dt,unseen,inputs)=>{
  const step=Number.isFinite(dt)?Math.min(Math.max(dt,0),cap):0,changed=inputs!==last;last=inputs;
  // Defer while the next frame (of about this one's length) would still fit in one step.
  if(unseen&&!changed&&due+2*step<=cap+SLACK){due+=step;return [];}
  if(changed&&due>SLACK){const prior=due;due=0;return [{dt:prior,prior:true},{dt:step,prior:false}];}
  const total=due+step;if(total<=cap+SLACK){due=0;return [{dt:total,prior:false}];}
  due=total-cap;return [{dt:cap,prior:false}];
 };
}
