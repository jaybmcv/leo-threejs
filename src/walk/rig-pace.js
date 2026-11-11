// When Cosmo's rig solves (avatar.js): every frame while he can be seen. While nothing draws him (first person), it
// gathers frames and solves them together, as a machine running at 1/cap fps would, never in a step longer than the
// figure's own cap. Each frame's time counts as the figure counts it (at most `cap`) and all of it is spent. A change of
// discrete input (grounded, jumps, stance, swimming, emote, rest) solves at once, and the time gathered before that frame
// is solved first with the previous frame's inputs, the ones it was gathered under: the states the rig starts on an edge
// (a landing, the jump clock, prone, swimming) see each change once, at its own time. So he is current whenever he
// shows. A gathering that would pass the cap solves a full step and carries the rest (less than a frame) to the next.
//   rigPace(cap) -> next(dt,every,inputs,hold): this frame's solves, in order, each {dt, prior}: prior means "with the
//   previous frame's inputs". None, one, or (on a change of input) two, or more when time was held (no step longer
//   than the cap). every: false (or 0) solves every frame; true
//   (unseen) as at 1/cap fps; a number of seconds, up to cap, at about that interval (another visitor small on screen:
//   remotes.js), gathering in the same way: it solves once every floor(every*TOL/frame) frames. hold: this frame's budget
//   for other visitors is spent (rig-budget.js), so it gathers this frame too, up to two caps, unless an input changed;
//   it then catches up a cap at a time.
// TOL: a gap a little shorter than the pace's (2%) still fits, so a frame's jitter about the display's rate does not
// change how often a body solves (at about 60 Hz, a 20 fps pace stays every third frame).
const SLACK=1e-6,TOL=1.02;
export function rigPace(cap=.05){
 let due=0,last=null;
 return (dt,every,inputs,hold=false)=>{
  const step=Number.isFinite(dt)?Math.min(Math.max(dt,0),cap):0,changed=inputs!==last;last=inputs;
  if(hold&&!changed&&due+step<=2*cap+SLACK){due+=step;return [];}
  const gap=every===true?cap:Math.min(Math.max(Number(every)||0,0),cap);
  // Defer while the next frame (of about this one's length) would still fit in one gap.
  if(gap>0&&!changed&&due+2*step<=gap*TOL+SLACK){due+=step;return [];}
  // What was gathered before a change, in steps no longer than the cap (held, it may be two caps).
  if(changed&&due>SLACK){const out=[];let prior=due;due=0;while(prior>cap+SLACK){out.push({dt:cap,prior:true});prior-=cap;}
   if(prior>SLACK)out.push({dt:prior,prior:true});out.push({dt:step,prior:false});return out;}
  const total=due+step;if(total<=cap+SLACK){due=0;return [{dt:total,prior:false}];}
  due=total-cap;return [{dt:cap,prior:false}];
 };
}
