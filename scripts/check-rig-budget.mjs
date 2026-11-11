// Other visitors' rig budget (src/walk/rig-budget.js): within a frame's share, the biggest on screen solve most, nobody
// below the rig's slowest pace (20 fps), those that must be drawn every frame every frame, and out of view at the slowest
// pace; the tier (how many get a body) follows what this page's solves cost, one body at a time and steady under timing
// noise; a stall does not move it; and the solves that actually run (rig-pace.js, as avatar.js runs it, held past the
// frame's cap as remotes.js holds them) stay within the budget on average and within the cap on every frame, at 30, 60
// and 144 Hz.
import assert from 'node:assert/strict';
import {createRigBudget} from '../src/walk/rig-budget.js';
import {rigPace} from '../src/walk/rig-pace.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const CAP=.05,HALF_S=1/30;
// A budget that has seen frames of `frameS` and solves of `solveMs` long enough to settle (and its tier with them).
function settled(frameS,solveMs,{seconds=30,...o}={}){
 const b=createRigBudget({cap:CAP,most:24,least:6,...o});
 for(let t=0;t<seconds;t+=frameS){b.frame(frameS);b.spent(solveMs,1);}
 return b;
}
// What a rate costs a frame, as rig-pace.js runs it: one solve every floor(every/frame) frames.
const costOf=(every,frameS)=>{const gap=every===true?CAP:every;return gap>0?1/Math.max(1,Math.floor(Math.min(gap,CAP)/frameS+1e-6)):1;};
const big=n=>Array.from({length:n},()=>({natural:0,forced:false}));

// A desktop at 60 Hz, solves of 0.1 ms: 24 bodies all big on screen.
{
 const b=settled(1/60,.1),rates=b.rates(big(24)),spend=rates.reduce((s,e)=>s+costOf(e,1/60),0),{solves}=b.state;
 assert.ok(Math.abs(solves-.08*16.667/.1)<.2,`the budget buys ${solves} solves a frame`);
 assert.ok(spend<=solves+1e-9,`spent ${spend} of ${solves}`);
 assert.ok(rates.every(e=>e<=CAP),'nobody below 20 fps');
 for(let i=1;i<rates.length;i++)assert.ok(rates[i]>=rates[i-1],`the bigger first: ${rates}`);
 const full=rates.filter(e=>e===0).length;assert.ok(full>=4&&full<24,`${full} every frame`);
 assert.equal(b.tier,24);
 pass(`a desktop with 24 big on screen: ${full} solve every frame, the rest at ${[...new Set(rates.filter(e=>e>0).map(e=>Math.round(1/e)))].join('/')} fps, ${spend.toFixed(1)} of ${solves.toFixed(1)} solves a frame`);
}
// What a body wants is the most it gets: one small on screen is never given more.
{
 const b=settled(1/60,.02),rates=b.rates([{natural:0},{natural:HALF_S},{natural:CAP},{natural:true}]);
 assert.deepEqual(rates,[0,HALF_S,CAP,true]);
 pass('with room to spare each body has its natural rate, and no more; one out of view keeps the slowest pace');
}
// Forced (the selfie booth, a grapple line out) solve every frame even past the budget, and the rest still at 20 fps.
{
 const b=settled(1/60,.5),rates=b.rates([...Array.from({length:4},()=>({natural:0,forced:true})),...big(10)]);
 assert.deepEqual(rates.slice(0,4),[0,0,0,0]);assert.ok(rates.slice(4).every(e=>e===CAP),`${rates}`);
 pass('those that must be drawn every frame solve every frame; the rest fall to 20 fps');
}
// A phone: 30 fps, solves of 0.6 ms. At 30 Hz the slowest pace is a solve every frame (rig-pace.js), and the budget buys
// about 4.4 a frame: the tier steps down to the least, six, one body at a time half a second apart, and back up to 24
// when solves get cheaper.
{
 const b=createRigBudget({cap:CAP,most:24,least:6});const seen=[b.tier];let t=0;
 for(;t<3;t+=1/30){b.frame(1/30);b.spent(.6,1);seen.push(b.tier);}
 for(let i=1;i<seen.length;i++)assert.ok(Math.abs(seen[i]-seen[i-1])<=1,'one body at a time');
 const changes=seen.filter((x,i)=>i&&x!==seen[i-1]).length;assert.ok(changes<=Math.ceil(3/.5),`${changes} changes in 3 s`);
 for(;t<25;t+=1/30){b.frame(1/30);b.spent(.6,1);}
 assert.equal(b.tier,6,`the tier settles at ${b.tier}`);
 for(let u=0;u<25;u+=1/30){b.frame(1/30);b.spent(.09,1);}
 assert.equal(b.tier,24,`and recovers to ${b.tier}`);
 pass('a phone: the tier steps down to 6 one body at a time, and back to 24 when solves get cheaper');
}
// Steady under timing noise: solves of 0.198 to 0.202 ms at 60 Hz put the room right on a tier's edge; it settles and
// stays.
{
 const b=settled(1/60,.2);let changes=0,last=b.tier;
 for(let i=0;i<600;i++){b.frame(1/60);b.spent(.198+.004*((i*7919)%101)/100,1);if(b.tier!==last){changes++;last=b.tier;}}
 assert.ok(changes<=1,`${changes} tier changes in 10 s of noise`);
 pass(`timing noise at a tier's edge moves the tier ${changes} time${changes===1?'':'s'} in 10 s`);
}
// A stall: main.js clamps a frame to 0.1 s, so twenty stalled frames come as 0.1 s each; they barely move the budget,
// and a frame without a solve says nothing of its cost.
{
 const b=settled(1/60,.1),before=b.state;for(let i=0;i<20;i++)b.frame(.1);b.frame(0);b.frame(-1);b.spent(5,0);
 const after=b.state;assert.ok(Math.abs(after.frameS/before.frameS-1)<.15,`frame ${before.frameS} -> ${after.frameS}`);
 assert.equal(after.solveMs,before.solveMs);assert.equal(after.tier,before.tier);
 pass(`twenty stalled frames move the frame length ${(100*(after.frameS/before.frameS-1)).toFixed(0)}% and the tier not at all`);
}
// The solves that run, as avatar.js runs them (rig-pace.js), held past the frame's cap as remotes.js holds them: 24 big
// bodies for 10 s, in step (all made at once, the worst case), the rates given afresh each frame. On average within the
// budget, on no frame after the first past the cap, and each body at least 20 a second.
for(const hz of [30,60,144]){
 const f=1/hz,b=settled(f,.1),paces=Array.from({length:24},()=>rigPace(CAP)),solved=new Array(24).fill(0);let total=0,frames=0,most=0;
 for(let t=0;t<10;t+=f,frames++){
  const rates=b.rates(big(24)),cap=b.frameCap();let now=0;
  paces.forEach((p,i)=>{const n=p(f,rates[i],'walk',now>=cap).length;solved[i]+=n;now+=n;});
  // (the first frame is every body's first input, which always solves: rig-pace.js)
  total+=now;if(frames)most=Math.max(most,now);
 }
 const per=total/frames,{solves}=b.state,cap=b.frameCap();
 assert.ok(per<=solves*1.05,`${hz} Hz: ${per.toFixed(2)} solves a frame against ${solves.toFixed(2)}`);
 assert.ok(most<=Math.ceil(cap)+1,`${hz} Hz: a frame ran ${most} solves against a cap of ${cap.toFixed(1)}`);
 assert.ok(solved.every(n=>n>=20*10*.97),`${hz} Hz: each solved at least 20 a second: ${Math.min(...solved)}`);
 pass(`${hz} Hz through rig-pace for 10 s: ${per.toFixed(2)} solves a frame against ${solves.toFixed(2)}, at most ${most} on a frame (cap ${cap.toFixed(1)}), each body at least ${(Math.min(...solved)/10).toFixed(0)} a second`);
}
// Held, a body gathers its time and catches up a cap at a time: none of it is lost.
{
 const p=rigPace(CAP);let time=0;
 for(let i=0;i<120;i++)time+=p(1/60,0,'walk',i%3===0).reduce((s,x)=>s+x.dt,0);
 for(let i=0;i<10;i++)time+=p(1/60,0,'walk').reduce((s,x)=>s+x.dt,0);
 assert.ok(Math.abs(time-130/60)<1e-9,`solved ${time} of ${130/60} s`);
 pass('a held body loses no time: what it gathers it solves later');
}
console.log(`rig budget: ${passed} checks passed`);
