// Alien Cat Invasion's rules (src/walk/invasion/rules.js), played headless: the march and its speed-up, scoring, the
// extra life, shields, deaths, waves, a landing, a bot playing whole games, and the same seed playing the same game.
import {newGame,step,alive,alienBox,STEP,PLAYER,SHIELDS,POINTS,EXTRA_AT,LIVES,GROUND} from '../src/walk/invasion/rules.js';

const problems=[],log=(...a)=>console.log(...a);
const expect=(ok,what)=>{if(!ok)problems.push(what);log(ok?'ok  ':'FAIL',what);};
const run=(g,seconds,input={})=>{for(let i=0;i<Math.round(seconds/STEP);i++)step(g,input);};

{const g=newGame(1);expect(alive(g).length===55&&g.lives===LIVES&&g.wave===1&&g.score===0,'a new game: 55 cats, three lives, wave 1');}

// The march reaches an edge, drops a row and turns.
{const g=newGame(2);g.bombs=[];const y0=g.formation.y,dir0=g.formation.dir;let t=0;
 while(g.formation.y===y0&&t<60){step(g);g.bombs=[];t+=STEP;}
 expect(g.formation.y===y0+8&&g.formation.dir===-dir0,`the formation drops 8 px and turns at the edge (after ${t.toFixed(1)} s)`);}

// Fewer cats, faster steps.
{const steps=g=>{let n=0;const f=g.formation,before=f.x;for(let i=0;i<120;i++){const x=f.x,y=f.y;step(g);g.bombs=[];if(f.x!==x||f.y!==y)n++;}return n;};
 const full=newGame(3),thin=newGame(3);alive(thin).slice(0,50).forEach(a=>a.alive=false);
 const a=steps(full),b=steps(thin);expect(b>a*3,`five cats step faster than fifty-five (${b} vs ${a} steps in 2 s)`);}

// A shot into each kind scores its points.
for(const kind of ['scout','tabby','brute']){
 const g=newGame(4);g.bombs=[];const cat=alive(g).find(a=>a.kind===kind&&a.row===(kind==='scout'?0:kind==='tabby'?2:4)&&a.col===5),box=alienBox(g,cat);
 g.shot={x:box.x+5,y:box.y+box.h+1};step(g);
 expect(!cat.alive&&g.score===POINTS[kind],`a hit ${kind} is worth ${POINTS[kind]}`);}

// One extra life at 1,500.
{const g=newGame(5);g.bombs=[];g.score=EXTRA_AT-10;const kill=()=>{const c=alive(g).find(a=>a.kind==='brute'),b=alienBox(g,c);g.shot={x:b.x+5,y:b.y+b.h+1};step(g);};
 kill();const once=g.lives;kill();expect(once===LIVES+1&&g.lives===LIVES+1,'an extra life at 1,500, once');}

// A bomb wears a shield away.
{const g=newGame(6);g.bombs=[];const before=g.shields[1].reduce((s,v)=>s+v,0);
 g.bombs.push({x:SHIELDS.xs[1]+10,y:SHIELDS.y-8,speed:70,frame:0});run(g,.3);const after=g.shields[1].reduce((s,v)=>s+v,0);
 expect(after<before,`a bomb chips a shield (${before} -> ${after} pixels)`);}

// A bomb on Leo costs a life; Leo comes back.
{const g=newGame(7);g.bombs=[{x:g.player.x+6,y:PLAYER.y-6,speed:70,frame:0}];run(g,.2);
 const hit=!g.player.alive&&g.lives===LIVES-1;g.bombs=[];run(g,2);
 expect(hit&&g.player.alive&&g.phase==='play','a bomb on Leo costs a life, and Leo returns');}

// Clearing a wave: a pause, then the next wave a step lower with whole shields.
{const g=newGame(8);const y1=g.formation.y;g.shields[0].fill(0);alive(g).forEach(a=>a.alive=false);step(g);const between=g.phase==='between';run(g,1.6);
 expect(between&&g.wave===2&&g.formation.y===y1+8&&alive(g).length===55&&g.shields[0].some(Boolean),'a cleared wave brings the next, 8 px lower, shields restored');}

// Cats down at Leo's level: the game is over.
{const g=newGame(9);g.formation.y=PLAYER.y-60;run(g,30);expect(g.phase==='over','cats that land end the game');}

// Losing every life ends the game.
{const g=newGame(10);for(let i=0;i<LIVES;i++){g.bombs=[{x:g.player.x+6,y:PLAYER.y-6,speed:70,frame:0}];run(g,2);}
 expect(g.phase==='over'&&g.lives===0,'three hits end the game');}

// A bot plays whole games: stays under the lowest cat nearest it and fires. Nothing leaves the screen or breaks.
// A bomb coming down within reach of Leo's width steers it away from the bomb first.
function bot(g){const cats=alive(g);if(!cats.length)return {};const p=g.player,mid=p.x+7;
 const threat=g.bombs.filter(b=>b.y>PLAYER.y-75&&b.x+3>p.x-4&&b.x<p.x+19).sort((a,b)=>b.y-a.y)[0];
 if(threat){const away=mid>=threat.x+1?1:-1,dir=(away>0&&p.x>=PLAYER.max-1)||(away<0&&p.x<=PLAYER.min+1)?-away:away;return {left:dir<0,right:dir>0,fire:false};}
 const target=cats.map(a=>alienBox(g,a)).sort((a,b)=>Math.abs(a.x+6-mid)-Math.abs(b.x+6-mid))[0],dx=target.x+6-mid;
 return {left:dx<-1,right:dx>1,fire:Math.abs(dx)<6};}
function play(seed,limit=60*60*10){const g=newGame(seed);let steps=0,bad=null;
 while(g.phase!=='over'&&steps<limit){step(g,bot(g));steps++;
  if(g.player.x<PLAYER.min-1e-9||g.player.x>PLAYER.max+1e-9)bad='Leo left the screen';
  if(g.bombs.some(b=>b.y>GROUND+2))bad='a bomb fell through the ground';
  if(g.lives<0)bad='negative lives';if(bad)break;}
 return {score:g.score,wave:g.wave,steps,over:g.phase==='over',bad};}
const games=[11,12,13,14,15].map(s=>play(s));
games.forEach((r,i)=>log('     bot game',i+1,JSON.stringify(r)));
expect(games.every(r=>!r.bad),'bot games: nothing leaves the screen or falls through');
expect(games.every(r=>r.score>0&&r.score%10===0),'bot games score, always in tens');
expect(games.some(r=>r.wave>=2),'a bot clears at least one wave');
expect(games.some(r=>r.over),'bot games end');
// The same seed and the same inputs play the same game.
expect(JSON.stringify(play(21))===JSON.stringify(play(21)),'the same seed plays the same game');

// The best rate any bot scored at, for the server's sanity cap (points per second of play).
const rate=Math.max(...games.map(r=>r.score/(r.steps*STEP)));log('     best bot rate',rate.toFixed(1),'points/s');
console.log(problems.length?`FAIL: ${problems.length} problem(s)`:'PASS');
process.exitCode=problems.length?1:0;
