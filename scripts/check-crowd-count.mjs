// How many of the crowd a page draws (src/walk/crowd-count.js), on pages made of numbers: a frame takes the room's time
// and each crowd visitor's drawn (room + perCat × drawn, in ms), with noise and a display's refresh where asked. A page
// the crowd holds back draws fewer until its frames come to the target, soon, and then holds steady, never far below
// what the target allows; one with time to spare draws more, up to all of them; one held back by its room keeps its
// crowd (a cut that does not help is undone, and tried again only after longer and longer waits), and when the room
// lets up the crowd comes back; a stall, or the selfie booth counting down, moves nothing; fewer in view than the cap,
// it does not rise, and a cut is from those drawn; it never goes below least nor past most; another target is kept.
import assert from 'node:assert/strict';
import {createCrowdCount} from '../src/walk/crowd-count.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const TARGET_MS=1000/30,OVER=1.03;
const random=seed=>()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
// A page, for `seconds` from `from` (go on from an earlier run with its log's end): room, perCat (ms) and inView (how many
// of the crowd are in view) may change with time; noise, each frame's length off by up to that share; hz, each frame a
// whole number of the display's refreshes; stall(t), a frame that long (s) in place of the page's own; active(t), false
// while the selfie booth counts down. As remotes.js: each frame draws up to the cap as it stands, then passes the last
// frame's length (its own, as remotes.js times it, not clamped) and how many it drew.
function run(c,{seconds,from=0,room,perCat,inView,noise=0,hz=0,seed=1,stall=()=>0,active=()=>true}){
 const r=random(seed),log=[],at=(v,t)=>typeof v==='function'?v(t):v;let t=from,last=1/60;
 while(t<from+seconds){
  const drawn=Math.min(c.most,at(inView,t));c.frame(last,drawn,{active:active(t)});
  let ms=at(room,t)+at(perCat,t)*drawn;ms*=1+noise*(r()*2-1);if(hz)ms=Math.ceil(ms*hz/1000-1e-9)*1000/hz;
  last=stall(t)||ms/1000;t+=last;log.push({t,cap:c.most,drawn,ms:last*1000});
 }
 return log;
}
const span=(log,a,b)=>log.filter(e=>e.t>=a&&e.t<b);
const meanMs=list=>list.reduce((s,e)=>s+e.ms,0)/list.length;
const changes=list=>list.filter((e,i)=>i&&e.cap!==list[i-1].cap).length;
// When a second's mean frame first came to the target, from `after`.
const cameTo=(log,ms,after=0)=>{for(const e of log)if(e.t>=after+1&&meanMs(span(log,e.t-1,e.t))<=ms)return e.t;return Infinity;};

// A phone a thousand in view hold back (75 ms frames), from all of them: within a few seconds at the target, then steady,
// and not cut far below what the target allows (15 + 0.06 × 305 ms is 33 ms).
{
 const c=createCrowdCount({start:1000}),log=run(c,{seconds:60,room:15,perCat:.06,inView:1000});
 const at=cameTo(log,TARGET_MS*OVER),late=span(log,30,60);
 assert.ok(at<=8,`at the target after ${at.toFixed(1)} s`);
 assert.ok(meanMs(late)<=TARGET_MS*OVER,`frames of ${meanMs(late).toFixed(1)} ms`);
 assert.equal(changes(late),0,'the cap moved after it settled');
 assert.ok(c.most>=183&&c.most<=305,`${c.most} drawn`);
 pass(`a phone a thousand hold back to 13 fps comes to the target in ${at.toFixed(1)} s and holds ${c.most} (${meanMs(late).toFixed(1)} ms frames, the cap still)`);
}
// From where it starts (150), a phone with time to spare draws more, until frames come near the target, not past it.
{
 const c=createCrowdCount(),log=run(c,{seconds:60,room:10,perCat:.06,inView:1000}),late=span(log,30,60);
 assert.ok(c.most>=278&&c.most<=388,`${c.most} drawn`);
 assert.ok(meanMs(late)<=TARGET_MS*OVER,`frames of ${meanMs(late).toFixed(1)} ms`);
 assert.equal(changes(late),0,'the cap moved after it settled');
 pass(`a phone with time to spare rises from 150 to ${c.most} (${meanMs(late).toFixed(1)} ms frames)`);
}
// A desktop: all thousand within a few seconds.
{
 const c=createCrowdCount(),log=run(c,{seconds:20,room:5,perCat:.004,inView:1000}),all=log.find(e=>e.cap===1000);
 assert.ok(all&&all.t<=6,`all drawn after ${all?.t.toFixed(1)} s`);assert.equal(c.most,1000);
 pass(`a desktop draws all thousand after ${all.t.toFixed(1)} s`);
}
// A page held back by its room (45 ms frames, the crowd next to nothing): each cut tried is undone a second later, the
// next only after 15, 30, 60, 120 s; the crowd is all there but for those seconds. When the room lets up, it comes back
// up to what the target allows; and a cut that helps starts the waits over.
{
 const c=createCrowdCount(),log=run(c,{seconds:240,room:45,perCat:.002,inView:400}),below=log.filter(e=>e.cap<150);
 const tries=log.filter((e,i)=>i&&e.cap<log[i-1].cap).map(e=>e.t);
 const lost=below.reduce((s,e)=>s+e.ms/1000,0);
 assert.equal(c.most,150);assert.ok(tries.length>=3&&tries.length<=5,`${tries.length} tries: ${tries.map(t=>t.toFixed(0))}`);
 for(let i=2;i<tries.length;i++)assert.ok(tries[i]-tries[i-1]>=1.8*(tries[i-1]-tries[i-2])-3,`tries at ${tries.map(t=>t.toFixed(0))}: not longer apart each time`);
 assert.ok(lost<=tries.length*1.6,`${lost.toFixed(1)} s with fewer drawn`);
 const after=run(c,{seconds:40,from:240,room:10,perCat:.06,inView:1000}),late=span(after,265,280);
 assert.ok(c.most>=278,`${c.most} drawn once the room let up`);assert.ok(meanMs(late)<=TARGET_MS*OVER);
 pass(`a page its room holds back to 22 fps keeps its 150, but for ${lost.toFixed(1)} s over 4 minutes (tries at ${tries.map(t=>t.toFixed(0)).join(', ')} s); when the room lets up it rises to ${c.most}`);
}
// The room grows heavier under a settled crowd: cuts that help are kept, down to the target or the least drawn.
{
 const c=createCrowdCount(),room=t=>t<40?10:30;
 const log=run(c,{seconds:80,room,perCat:.06,inView:1000}),at=cameTo(log,TARGET_MS*OVER,40);
 assert.ok(at<=52||c.most===40,`at the target ${(at-40).toFixed(1)} s after, ${c.most} drawn`);
 assert.ok(meanMs(span(log,70,80))<=TARGET_MS*OVER||c.most===40,`frames of ${meanMs(span(log,70,80)).toFixed(1)} ms, ${c.most} drawn`);
 pass(`the room heavier by 20 ms under a settled crowd: down to ${c.most}, at the target ${(at-40).toFixed(1)} s later`);
}
// A page held back by its room whose frames jump about (each off by up to a quarter), forty times over for ten minutes:
// a lucky second may pass a cut now and then (tried for as long as the page is there, any test is), but it is tried
// again the other way, and the crowd comes back; none ends with fewer, and the time with fewer stays short.
{
 let lucky=0,worst=0;
 for(let seed=1;seed<=40;seed++){
  const c=createCrowdCount(),log=run(c,{seconds:600,room:45,perCat:.002,inView:400,noise:.25,seed});
  const fewer=log.reduce((s,e)=>s+(e.cap<150?e.ms/1000:0),0);worst=Math.max(worst,fewer);
  if(log.some((e,i)=>i>90&&e.cap<150&&log[i-90].cap<150))lucky++;
  assert.equal(c.most,150,`seed ${seed}: ${c.most} drawn`);
 }
 assert.ok(worst<=60,`${worst.toFixed(0)} s with fewer in ten minutes`);
 pass(`a page its room holds back, frames each off by up to a quarter, forty times for ten minutes: ${lucky} lucky cut${lucky===1?"":"s"} kept a while, every one let back; at most ${worst.toFixed(0)} s with fewer`);
}
// The same with fifty in view, so a lucky cut goes all the way down to the least (40), where no later cut can be tried
// to find it out: it is tried again the other way all the same, and the fifty come back.
{
 let worst=0;
 for(let seed=40;seed<=48;seed++){
  const c=createCrowdCount(),log=run(c,{seconds:1050,room:45,perCat:.002,inView:50,noise:.25,seed});
  const fewer=log.reduce((s,e)=>s+(e.cap<50?e.ms/1000:0),0);worst=Math.max(worst,fewer);
  assert.ok(c.most>=50,`seed ${seed}: ${c.most} drawn`);
 }
 assert.ok(worst<=60,`${worst.toFixed(0)} s with fewer`);
 pass(`fifty in view, nine times for 17 minutes: a lucky cut to the least is tried again and let back, at most ${worst.toFixed(0)} s with fewer`);
}
// A cut kept, the next found not to help, and those the first left out let back while the view grows lighter: they stay
// (only frames surely longer for them would bring the cut back).
{
 const c=createCrowdCount(),feed=(ms,drawn,until)=>{for(let i=0;i<2000&&!until();i++)c.frame(ms/1000,Math.min(c.most,drawn));};
 feed(45,150,()=>c.state.trial);const cut=c.most;assert.ok(cut<150);
 feed(40,150,()=>!c.state.trial||c.most<cut);assert.equal(c.state.kept,1,'the cut was kept');
 feed(41,150,()=>c.most===cut&&!c.state.trial);
 feed(41,150,()=>c.state.trial&&c.most===150);assert.equal(c.most,150,'the kept cut tried the other way');
 feed(30,150,()=>!c.state.trial);assert.equal(c.most,150);
 feed(30,150,()=>false);assert.equal(c.most,150,'they stayed');
 pass(`a kept cut (150 to ${cut}) tried again the other way while the view grew lighter: the 150 stay`);
}
// Long frames either side of a gap, or of the selfie booth's countdown, are not in a row: twenty, a gap, twenty-two do
// not make a page slow.
for(const between of ['gap','photo']){
 const c=createCrowdCount({start:1000});for(let i=0;i<200;i++)c.frame(.01,1000);
 for(let i=0;i<20;i++)c.frame(.1,1000);
 if(between==='gap')c.frame(30,1000);else c.frame(.01,1000,{active:false});
 for(let i=0;i<22;i++)c.frame(.1,1000);
 assert.equal(c.most,1000,`long frames either side of a ${between} were counted in a row`);
}
pass('long frames either side of a gap or the selfie booth\'s countdown are not counted in a row');
// Noisy frames (each off by up to a quarter), whole refreshes of a display, eight times over: settled, it holds the
// target. At 60 Hz a frame is 33 ms or 50 (the noise made coarse), and a cut's gain can be within what that unevenness
// could make: not kept, frames may hold a little over (an eighth at worst).
for(const hz of [0,120,60]){
 let worst=0,sum=0,moves=0;
 for(let seed=1;seed<=8;seed++){
  const c=createCrowdCount({start:1000}),late=span(run(c,{seconds:180,room:15,perCat:.06,inView:1000,noise:.25,hz,seed}),60,180);
  worst=Math.max(worst,meanMs(late)/TARGET_MS);sum+=meanMs(late)/TARGET_MS/8;moves=Math.max(moves,changes(late));
 }
 assert.ok(sum<=1.05&&worst<=(hz===60?1.15:1.05),`frames at ${sum.toFixed(3)} of the target, ${worst.toFixed(3)} at worst`);
 assert.ok(moves<=16,`the cap moved ${moves} times in two minutes`);
 pass(`frames each off by up to a quarter, ${hz?`at ${hz} Hz`:'free'}: ${(sum*100).toFixed(0)}% of the target's frame on average, ${(worst*100).toFixed(0)}% at worst; the cap moved at most ${moves} times in two minutes`);
}
// Fewer in view than the cap: no rise however fast the frames, and a cut is from those drawn.
{
 const fast=createCrowdCount();run(fast,{seconds:20,room:5,perCat:.004,inView:100});assert.equal(fast.most,150);
 const slow=createCrowdCount();const log=run(slow,{seconds:1.5,room:40,perCat:.1,inView:100});
 assert.ok(log.some(e=>e.cap<=80),'the first cut was from the cap, not those drawn');
 pass('fewer in view than the cap: it does not rise, and a cut is from those drawn');
}
// A stall (twenty frames of 0.1 s on a desktop) moves nothing, nor a gap (a tab come back); frames that stay long are this
// page's, after thirty of them or three seconds.
{
 const c=createCrowdCount();run(c,{seconds:20,room:5,perCat:.004,inView:1000});assert.equal(c.most,1000);
 const log=run(c,{seconds:10,from:20,room:5,perCat:.004,inView:1000,stall:t=>t>=25&&t<27?.1:0});
 assert.ok(log.every(e=>e.cap===1000),'a stall cut the crowd');assert.ok(c.state.frameS<.012);
 run(c,{seconds:4,from:30,room:5,perCat:.004,inView:1000,stall:t=>t<30.1?30:0});assert.equal(c.most,1000,'a gap cut the crowd');assert.ok(c.state.frameS<.012);
 run(c,{seconds:8,from:64,room:85,perCat:.001,inView:1000});assert.ok(c.state.frameS>.08,`${c.state.frameS} s frames`);
 const slow=createCrowdCount({start:1000}),first=run(slow,{seconds:6,room:0,perCat:.4,inView:1000}).find(e=>e.cap<1000);
 assert.ok(first&&first.t<=5,'frames of 0.4 s were let go');
 pass(`a stall of 2 s moves nothing, nor a gap of 30 s; frames that stay long are counted after thirty, or 3 s of them (at 2.5 fps, the first cut ${first.t.toFixed(1)} s in)`);
}
// The selfie booth counting down (every one drawn, in view or not): its frames are not counted, and nothing moves.
{
 const c=createCrowdCount();const log=run(c,{seconds:10,room:60,perCat:.1,inView:1000,active:()=>false});
 assert.ok(log.every(e=>e.cap===150));assert.equal(c.state.frameS,1/30);
 pass('the selfie booth counting down: its frames not counted, the cap where it was');
}
// Never below least nor past most; a start outside them is brought within.
{
 assert.equal(createCrowdCount({start:5}).most,40);assert.equal(createCrowdCount({start:5000}).most,1000);
 const c=createCrowdCount({start:1000}),log=run(c,{seconds:60,room:0,perCat:.9,inView:1000});
 const late=span(log,30,60),atLeast=late.filter(e=>e.cap===40).reduce((s,e)=>s+e.ms,0)/late.reduce((s,e)=>s+e.ms,0);
 assert.ok(log.every(e=>e.cap>=40&&e.cap<=1000));assert.ok(atLeast>=.9,`at 40 for ${(atLeast*100).toFixed(0)}% of the last 30 s`);
 pass(`it never goes below 40 nor past 1,000 (still over the target at 40, it holds there ${(atLeast*100).toFixed(0)}% of the time, now and then letting the last cut's back to be sure)`);
}
// Another target (45 fps): kept as this one is.
{
 const c=createCrowdCount({fps:45,start:1000}),log=run(c,{seconds:60,room:10,perCat:.06,inView:1000}),late=span(log,30,60);
 assert.ok(meanMs(late)<=1000/45*OVER,`frames of ${meanMs(late).toFixed(1)} ms`);assert.equal(changes(late),0);
 pass(`a target of 45 fps: ${c.most} drawn, ${meanMs(late).toFixed(1)} ms frames`);
}
console.log(`${passed} checks passed`);
