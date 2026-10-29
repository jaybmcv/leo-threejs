// Leo Pinball's rules (src/walk/pinball/rules.js), played headless: the plunger, the flippers, each scoring piece set
// up by hand, the ball save, draining to game over, the ball never leaving the table, a bot keeping the ball alive
// far longer than an idle player, and the same seed and the same buttons playing the same game.
import {newGame,step,STEP,R,W,H,BALLS,FLIPPERS,BUMPERS,DROPS,SAUCER,LANES,POINTS,PLUNGE,ARCH,tip} from '../src/walk/pinball/rules.js';

const problems=[],log=(...a)=>console.log(...a);
const expect=(ok,what)=>{if(!ok)problems.push(what);log(ok?'ok  ':'FAIL',what);};
// Runs `s` seconds, `input(g)` giving the buttons; returns every event.
const run=(g,s,input=()=>({}))=>{const all=[];for(let i=0;i<s/STEP&&g.phase==='play';i++)all.push(...step(g,input(g)));return all;};
// The plunger drawn back for `hold` seconds, then let go.
const plunge=(hold=1)=>{let t=0;return g=>{const b=g.b;if(b.lane&&!b.launching){t+=STEP;return {launch:t<hold};}t=0;return {};};};
// A player who flips whenever the ball comes down at a flipper, and lets go otherwise.
const flipper=launch=>g=>{const b=g.b,inp=launch(g);
 FLIPPERS.forEach((f,i)=>{const dx=b.x-f.x,dy=b.y-f.y;if(Math.hypot(dx,dy)<f.len+12&&dy>-25&&b.vy>20&&(i?dx<8:dx>-8))inp[i?'right':'left']=true;});return inp;};
// The ball is inside the cabinet: within the walls, under the arch, nowhere inside a bumper.
const inside=g=>{const b=g.b;return Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.x>=10+R-.5&&b.x<=230-R+.5&&Math.hypot(b.x-ARCH.x,Math.min(0,b.y-ARCH.y))<=ARCH.r-R+.5&&BUMPERS.every(p=>Math.hypot(b.x-p.x,b.y-p.y)>=p.r+R-.5);};

{const g=newGame(1);expect(g.ball===1&&g.balls===BALLS&&g.score===0&&g.b.lane&&g.b.x===PLUNGE.x,'a new game: ball 1 of 3 waiting on the plunger');
 run(g,2);expect(g.b.lane&&Math.abs(g.b.y-PLUNGE.y)<.5,'the ball waits on the plunger until launched');}

// A full pull sends the ball up the lane and round the arch onto the table; a soft one falls back for another go.
{const g=newGame(2),ev=run(g,1.6,plunge(1));
 expect(ev.includes('launch')&&!g.b.lane&&g.b.x<212,'a full pull launches the ball round the arch onto the table');}
{const g=newGame(3);let t=0;const ev=run(g,3,()=>({launch:(t+=STEP)<.04}));
 expect(!ev.includes('launch')&&g.b.lane,'a tap too short to pull the plunger does not launch');}
{const g=newGame(3);let t=0;const ev=run(g,6,()=>({launch:(t+=STEP)<.08}));
 expect(ev.includes('launch')&&g.b.lane&&!g.b.launching&&Math.abs(g.b.y-PLUNGE.y)<.5,'a soft launch falls back onto the plunger, ready again');}

// The flippers: up while held, down when let go; a ball resting on a raised flipper's line gets struck up the table.
{const g=newGame(4);step(g,{left:true});const [up]=g.flips;run(g,.2,()=>({left:true}));
 expect(Math.abs(g.flips[0].a-FLIPPERS[0].up)<1e-9&&Math.abs(g.flips[1].a-FLIPPERS[1].rest)<1e-9,'the left flipper rises while held; the right stays down');
 run(g,.3);expect(Math.abs(g.flips[0].a-FLIPPERS[0].rest)<1e-9,'let go, it falls back');}
{const g=newGame(5),f=FLIPPERS[0],[tx,ty]=tip(f,f.rest);Object.assign(g.b,{lane:false,x:(f.x+tx)/2+1,y:(f.y+ty)/2-f.r0-R,vx:0,vy:0,out:true});
 run(g,.12,()=>({left:true}));expect(g.b.vy<-300,`a flip strikes a ball on the flipper up the table (${Math.round(-g.b.vy)} up)`);}

// The scoring pieces, each struck by a ball placed beside it.
{const g=newGame(6),p=BUMPERS[0];Object.assign(g.b,{lane:false,out:true,x:p.x,y:p.y-p.r-R-3,vx:0,vy:120});const ev=run(g,.1);
 expect(ev.includes('bumper')&&g.score===POINTS.bumper&&Math.hypot(g.b.vx,g.b.vy)>250,'a pop bumper scores and kicks the ball away hard');}
{const g=newGame(7),t=DROPS[1];Object.assign(g.b,{lane:false,out:true,x:t.x-t.r-R-4,y:t.y,vx:300,vy:0});const ev=run(g,.05);
 expect(ev.includes('drop')&&!g.drops[1]&&g.drops[0]&&g.drops[2]&&g.score===POINTS.drop,'a drop target struck goes down and scores');}
{const g=newGame(8);g.drops=[false,true,false];const t=DROPS[1];Object.assign(g.b,{lane:false,out:true,x:t.x-t.r-R-4,y:t.y,vx:300,vy:0});const ev=run(g,.05);
 expect(ev.includes('bank')&&!g.drops.some(Boolean)&&g.score===POINTS.drop+POINTS.bank,'the last of the bank scores the bank bonus');
 g.b.x=100;g.b.y=200;run(g,1);expect(g.drops.every(Boolean),'the bank comes back up once the ball is clear of it');}
{const g=newGame(9);Object.assign(g.b,{lane:false,out:true,x:SAUCER.x,y:SAUCER.y-12,vx:0,vy:60});const ev=run(g,.2);
 expect(ev.includes('saucer')&&g.b.hold>0&&g.score===POINTS.saucer,'the Mars saucer catches a slow ball and scores');
 let kicked=false;for(let i=0;i<1.5/STEP&&!kicked;i++)kicked=step(g,{}).includes('kick');
 expect(kicked&&g.b.hold<=0&&g.b.vx>0&&g.b.vy<0,'then kicks it back out up the table');}
{const g=newGame(10);g.lanes=[true,false,true];Object.assign(g.b,{lane:false,out:true,x:LANES[1],y:50,vx:0,vy:80});const ev=run(g,.2);
 expect(ev.includes('lanes')&&g.mult===2&&g.lanes.every(l=>!l)&&g.score===POINTS.lane+POINTS.lanes,'lighting the last top lane raises the multiplier and clears the lights');
 const p=BUMPERS[2];Object.assign(g.b,{x:p.x,y:p.y-p.r-R-3,vx:0,vy:120});const before=g.score;run(g,.1);expect(g.score-before===2*POINTS.bumper,'scores count double at 2x');}
{const g=newGame(11);g.lanes=[true,false,false];step(g,{right:true});
 expect(g.lanes.join()==='false,true,false','a flipper press moves the lit lanes along');}

// Draining: the first ball lost soon after launch comes back once; after that, the next ball, then game over.
{const g=newGame(12);run(g,2,plunge(1));Object.assign(g.b,{x:111,y:H+5,vx:0,vy:300});const ev=run(g,.1);
 expect(ev.includes('saved')&&g.ball===1&&g.b.lane,'a ball lost in its first seconds is saved and comes back to the plunger');
 run(g,2,plunge(1));Object.assign(g.b,{x:111,y:H+5,vx:0,vy:300});const ev2=run(g,.1);
 expect(ev2.includes('drain')&&g.ball===2&&g.mult===1,'saved once, the next loss drains it: ball 2');}
{const g=newGame(13),ev=run(g,240,plunge(1));
 expect(g.phase==='over'&&ev.filter(e=>e==='drain').length===BALLS&&ev.includes('over'),'nobody at the flippers: three balls drain and the game is over');
 expect(step(g,{left:true}).length===0,'a finished game no longer steps');}

// Long games: the ball never leaves the table, never sticks, and a player at the flippers keeps it far longer.
{let out=0,steps=0,idle=0,kept=0,stuck=0;const scores=[];
 for(let seed=1;seed<=6;seed++){
  const g=newGame(seed),input=flipper(plunge(.5+seed*.08));
  for(let i=0;i<300/STEP&&g.phase==='play';i++){step(g,input(g));steps++;if(!inside(g))out++;}
  kept+=g.t;scores.push(g.score);stuck+=g.kicks;
  const h=newGame(seed);run(h,300,plunge(.5+seed*.08));idle+=h.t;}
 expect(out===0,`the ball stays inside the table over ${(steps*STEP/60).toFixed(0)} minutes of play`);
 expect(stuck<=3,`the ball rarely needs a nudge to get going again (${stuck} nudges)`);
 expect(kept>idle*4,`flipping keeps the ball alive: ${kept.toFixed(0)} s against ${idle.toFixed(0)} s untouched`);
 expect(scores.every(s=>s>5000),`a flipping player scores (${scores.join(', ')})`);}

{const play=seed=>{const g=newGame(seed),input=flipper(plunge(.8));run(g,60,input);return JSON.stringify([g.score,g.b.x,g.b.y,g.ball]);};
 expect(play(21)===play(21),'the same seed and the same buttons play the same game');}

console.log(problems.length?`FAIL: ${problems.length} problem(s)`:'PASS');
process.exitCode=problems.length?1:0;
