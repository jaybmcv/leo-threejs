import assert from 'node:assert/strict';
import {rigPace} from '../src/walk/rig-pace.js';

// When Cosmo's rig solves (src/walk/rig-pace.js): every frame while seen; while unseen, as on a 20 fps machine (no step
// over the cap, all the time spent), at once on a change of discrete input with the time gathered before it solved
// first under the previous inputs, and with the gathered time when he shows.
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
const CAP=.05,close=(a,b)=>Math.abs(a-b)<1e-9,sum=a=>a.reduce((p,q)=>p+q.dt,0);
const run=(pace,frames)=>frames.map(([dt,unseen,inputs='a'])=>pace(dt,unseen,inputs));
// A pace past its first call (which always solves: there are no inputs before it to compare with).
const primed=()=>{const pace=rigPace(CAP);pace(0,true,'a');return pace;};

{const pace=rigPace(CAP),out=run(pace,[[1/60,false],[1/60,false],[.2,false]]);
 assert(out.every(s=>s.length===1&&!s[0].prior));assert(close(out[0][0].dt,1/60)&&close(out[2][0].dt,CAP));
 pass('seen, the rig solves every frame with the frame\'s time, capped as the figure caps it');}

// Share of frames solved while unseen, by display rate, steady and with 60 Hz timing jitter (a long pair of frames then
// solves one frame early, so about 0.38 of frames): never a step over the cap,
// never a solve with earlier inputs while the inputs hold, and no time lost.
const jitter=i=>1/60+(((i*7919)%13)-6)*.00012;
for(const [name,frame,share] of [['30 Hz',()=>1/30,1],['50 Hz',()=>1/50,1/2],['60 Hz',()=>1/60,1/3],['60 Hz with jitter',jitter,.38],['144 Hz',()=>1/144,1/7],['240 Hz',()=>1/240,1/12]]){
 const pace=primed(),n=480,dts=Array.from({length:n},(_,i)=>frame(i)),out=dts.map(dt=>pace(dt,true,'a')),rest=pace(0,false,'a');
 const steps=out.flat();
 assert(steps.every(s=>s.dt<=CAP+1e-6),name+': a step over the cap');assert(steps.every(s=>!s.prior),name+': an earlier-input solve without a change');
 assert(close(sum(steps)+sum(rest),dts.reduce((p,q)=>p+Math.min(q,CAP),0)),name+': time lost');
 assert(Math.abs(out.filter(s=>s.length).length/n-share)<.04,name+': solved '+out.filter(s=>s.length).length+' of '+n);
}
pass('unseen, it solves as on a 20 fps machine at any rate, jitter included: no step over the cap and no time lost, a third of the frames at 60 Hz');

{const pace=primed(),out=run(pace,[[1/60,true],[1/60,true],[.05,true,'b'],[1/60,true,'b']]);
 assert(out[0].length===0&&out[1].length===0&&out[3].length===0);
 assert.equal(out[2].length,2);assert(out[2][0].prior&&close(out[2][0].dt,2/60));assert(!out[2][1].prior&&close(out[2][1].dt,.05));
 pass('a change of input (a takeoff after two hidden frames) solves the time gathered before it under the earlier inputs, then its own frame once');}

{const pace=primed();run(pace,[[1/60,true],[1/60,true]]);const a=pace(.018,true,'a');
 assert.equal(a.length,1);assert(!a[0].prior&&close(a[0].dt,CAP));const b=pace(1/60,false,'a');assert(close(sum(b),2/60+.018-CAP+1/60));
 pass('a gathering that would pass the cap solves a full step and carries the rest to the next frame, in one solve each');}

{const pace=primed();run(pace,[[1/60,true],[1/60,true]]);const out=pace(.15,true,'a');
 assert(out.every(s=>s.dt<=CAP+1e-6));const after=[out,...run(pace,[[1/60,true],[1/60,true],[1/60,false]])].flat();
 assert(close(sum(after),2/60+CAP+3/60));pass('a long frame counts as the figure would count it, and all of it is spent within the cap');}

{const pace=primed();run(pace,[[1/60,true],[1/60,true]]);const out=pace(1/60,false,'a');
 assert.equal(out.length,1);assert(close(out[0].dt,3/60));pass('when he shows, the rig solves at once with all the time gathered while hidden');}

{const pace=rigPace(CAP);assert(close(sum(pace(NaN,false,'a')),0));assert(close(sum(pace(-1,false,'a')),0));pass('a frame time that is not a number, or negative, counts as none');}
console.log(`rig pace: ${checks} checks passed`);
