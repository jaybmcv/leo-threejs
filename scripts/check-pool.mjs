// Paw Pool's rules (src/walk/pool/rules.js), played headless: the rack, a kick, balls meeting, cushions, pockets, the
// cue ball coming back after it drops, the aim line, a bot clearing whole racks against the clock, and the same seed
// and the same kicks playing the same game. The bot's fastest clear sets the server's floor for a believable time.
// Then 8-ball for two players (src/walk/pool/eightball.js): each rule on a shot set up by hand, ball in hand, and
// two bots playing whole matches to a winner.
import {newGame,step,kick,aim,rack,left,TABLE,R,STEP,POCKETS,HEAD,FOOT,MAX_SPEED} from '../src/walk/pool/rules.js';
import {POOL_FASTEST_S} from '../src/walk/pool/limits.js';
import {newMatch,judge,legal,place,onEight,GROUPS} from '../src/walk/pool/eightball.js';

const problems=[],log=(...a)=>console.log(...a);
const expect=(ok,what)=>{if(!ok)problems.push(what);log(ok?'ok  ':'FAIL',what);};
const settle=(g,limit=60)=>{const all=[];for(let i=0;i<limit/STEP&&g.phase==='roll';i++)all.push(...step(g));return all;};
const onTable=b=>b.potted||(Math.abs(b.x)<=TABLE.w/2-R+1e-9&&Math.abs(b.y)<=TABLE.h/2-R+1e-9)||POCKETS.some(p=>Math.hypot(b.x-p.x,b.y-p.y)<p.r+R);

{const r=rack(3),ns=r.map(b=>b.n).sort((a,b)=>a-b);
 expect(ns.join()===Array.from({length:15},(_,i)=>i+1).join(),'the rack holds balls 1-15 once each');
 const apex=r.find(b=>b.x===Math.min(...r.map(q=>q.x))),eight=r.find(b=>b.n===8);
 expect(apex.n===1&&Math.abs(apex.x-FOOT.x)<1e-9&&Math.abs(eight.y)<1e-9,'the 1 on the foot spot, the 8 in the middle');
 let overlap=false;for(const a of r)for(const b of r)if(a!==b&&Math.hypot(a.x-b.x,a.y-b.y)<2*R)overlap=true;
 expect(!overlap,'no two racked balls overlap');}

{const g=newGame(1);expect(g.balls.length===16&&g.balls[0].x===HEAD.x&&left(g)===15&&g.phase==='aim','a new game: the cue ball on the head spot, fifteen to pot');
 expect(!kick(Object.assign(newGame(1),{phase:'roll'}),0,1),'no kick while balls roll');}

// A straight kick down the table breaks the rack: the cue ball hits the 1, balls spread, all stay on the table.
{const g=newGame(2);kick(g,0,1);const ev=settle(g);
 const spread=g.balls.filter(b=>b.n&&!b.potted&&Math.hypot(b.x-FOOT.x,b.y)>1.5).length;
 expect(ev.some(e=>e.startsWith('click'))&&spread>=5,`a full kick breaks the rack (${spread} balls spread, ${15-left(g)} potted)`);
 expect(g.balls.every(onTable)&&g.phase!=='roll','after the break everything is still and on the table');}

// A ball sent straight at a corner pocket drops; one sent at a cushion comes back slower.
{const g=newGame(4);g.balls.forEach(b=>{if(b.n>1)b.potted=true;});const one=g.balls[1];Object.assign(one,{x:5,y:2});
 g.balls[0].x=4;g.balls[0].y=1;kick(g,Math.atan2(one.y-1,one.x-4),.6);const ev=settle(g);
 expect(one.potted&&ev.includes('pot')&&g.potted.includes(1),'a ball struck at a corner pocket drops');
 expect(g.phase==='done'&&ev.includes('clear'),'the last ball down clears the rack');}
{const g=newGame(5);g.balls.forEach(b=>{if(b.n)b.potted=true;});g.balls[1].potted=false;Object.assign(g.balls[1],{x:-6,y:-3});
 const cue=g.balls[0];Object.assign(cue,{x:3,y:0});kick(g,Math.PI/2,.5);let max=0,turned=false;
 for(let i=0;i<20/STEP&&g.phase==='roll';i++){step(g);max=Math.max(max,cue.y);if(cue.vy<0)turned=true;}
 expect(turned&&max<=TABLE.h/2-R+1e-9&&!cue.potted,'a ball meets the cushion and comes back');}

// The side pockets: a ball rolled along the cushion past the middle drops there; the cue ball that drops comes back.
{const g=newGame(6);g.balls.forEach(b=>{if(b.n>1)b.potted=true;});Object.assign(g.balls[1],{x:-3,y:TABLE.h/2-R-.01});
 const cue=g.balls[0];Object.assign(cue,{x:-4,y:TABLE.h/2-R-.01});kick(g,0,.5);settle(g);
 expect(g.balls[1].potted,'a ball rolled along the long cushion drops in the side pocket');}
{const g=newGame(7);const cue=g.balls[0];Object.assign(cue,{x:-6,y:-3});kick(g,Math.atan2(-1,-1),.5);const ev=settle(g);
 expect(ev.includes('scratch')&&!cue.potted&&Math.abs(cue.y-HEAD.y)<1e-9&&cue.x<=HEAD.x&&g.phase==='aim','the cue ball that drops comes back to the head spot');}

// The aim line: straight at the 1 it stops a ball's width short and sends the 1 straight on; past every ball, a cushion.
{const g=newGame(8);const a=aim(g,0);
 expect(a.ball?.n===1&&Math.abs(a.x-(FOOT.x-2*R))<1e-6&&Math.abs(a.dir[0]-1)<1e-6,'the aim line meets the 1 a ball short of it, and the 1 goes on straight');
 const up=aim(g,-Math.PI/2);expect(!up.ball&&Math.abs(up.y-(-TABLE.h/2+R))<1e-6,'aimed away from every ball, the line ends at the cushion');}

// No energy from nowhere: total speed never rises without a kick.
{const g=newGame(9);kick(g,.02,1);let before=Infinity,gained=false;
 for(let i=0;i<30/STEP&&g.phase==='roll';i++){step(g);const e=g.balls.reduce((s,b)=>s+b.vx*b.vx+b.vy*b.vy,0);if(e>before*1.0001+1e-9)gained=true;before=e;}
 expect(!gained,'the balls never speed up on their own');}

// A bot plays whole racks: for each ball and pocket it lines up the ghost ball, keeps the paths clear, and kicks with
// enough power for the distance. It shoots the moment everything is still, so its clear times are faster than a player's.
function clearPath(g,ax,ay,bx,by,skip){
 const dx=bx-ax,dy=by-ay,l=Math.hypot(dx,dy);
 return g.balls.every(o=>{if(o.potted||skip.includes(o))return true;const t=Math.max(0,Math.min(l,((o.x-ax)*dx+(o.y-ay)*dy)/l));return Math.hypot(ax+dx*t/l-o.x,ay+dy*t/l-o.y)>=2*R;});
}
function bot(g,ok=()=>true){
 const cue=g.balls[0];let best=null;
 for(const b of g.balls){if(!b.n||b.potted||!ok(b.n))continue;
  for(const p of POCKETS){
   const px=p.x-b.x,py=p.y-b.y,pl=Math.hypot(px,py),gx=b.x-px/pl*2*R,gy=b.y-py/pl*2*R;
   const sx=gx-cue.x,sy=gy-cue.y,sl=Math.hypot(sx,sy),cut=Math.acos(Math.max(-1,Math.min(1,(sx*px+sy*py)/(sl*pl))));
   if(cut>1.2||!clearPath(g,cue.x,cue.y,gx,gy,[cue,b])||!clearPath(g,b.x,b.y,p.x,p.y,[b]))continue;
   const score=cut*3+sl/4+pl/4;if(!best||score<best.score)best={score,angle:Math.atan2(sy,sx),power:Math.min(1,.35+(sl+pl)/(14*Math.cos(cut)+1))};
  }}
 if(best)return best;
 const near=g.balls.filter(b=>b.n&&!b.potted&&ok(b.n)).sort((a,b)=>Math.hypot(a.x-cue.x,a.y-cue.y)-Math.hypot(b.x-cue.x,b.y-cue.y))[0];
 return {angle:Math.atan2(near.y-cue.y,near.x-cue.x),power:.8};
}
function play(seed,limit=40*60){
 const g=newGame(seed);let bad=null;
 kick(g,(seed%7-3)*.004,1);
 while(g.phase!=='done'&&g.t<limit){
  if(g.phase==='aim'){const s=bot(g);kick(g,s.angle,s.power);}
  step(g);
  if(!g.balls.every(onTable))bad='a ball left the table';
  if(g.balls.some(b=>!Number.isFinite(b.x)||!Number.isFinite(b.y)))bad='a ball went nowhere';
  if(bad)break;
 }
 return {seed,cleared:g.phase==='done',seconds:+g.t.toFixed(1),shots:g.shots,bad};
}
const games=[11,12,13,14,15,16,17,18].map(s=>play(s));
games.forEach(r=>log('     bot game',JSON.stringify(r)));
expect(games.every(r=>!r.bad),'bot games: no ball leaves the table');
expect(games.filter(r=>r.cleared).length>=6,`the bot clears most racks (${games.filter(r=>r.cleared).length} of ${games.length})`);
const fastest=Math.min(...games.filter(r=>r.cleared).map(r=>r.seconds));
log('     fastest bot clear',fastest,'s; the server refuses clears under',POOL_FASTEST_S,'s');
expect(POOL_FASTEST_S<=fastest*.6,'the server\'s floor sits well under the bot\'s fastest clear');
expect(JSON.stringify(play(21))===JSON.stringify(play(21)),'the same seed and kicks play the same game');
expect(MAX_SPEED>0&&TABLE.w===14&&TABLE.h===8,'the table is 14 x 8 m inside its rails');

// 8-ball. A shot set up by hand: what the cue ball struck first, whether a ball then reached a cushion, which balls
// dropped and whether the cue ball did; then the judge's verdict.
function shot(m,{first=null,rail=true,down=[],scratch=false}){
 const g=m.g;g.shot={first,rail,from:g.potted.length};
 for(const n of down){g.balls[n].potted=true;g.potted.push(n);}
 if(scratch)g.balls[0].potted=true;g.phase='aim';return judge(m);
}
const assigned=(m,p,group)=>{m.broken=true;m.groups[p]=group;m.groups[1-p]=group==='solids'?'stripes':'solids';m.inHand=null;m.turn=p;return m;};
const clearGroup=(m,group)=>{for(const n of GROUPS[group]){m.g.balls[n].potted=true;m.g.potted.push(n);}return m;};
{const m=newMatch(1);
 expect(m.turn===0&&m.inHand==='kitchen'&&!m.broken&&!m.g.shot,'8-ball: player 1 breaks, with ball in hand behind the head string');
 const r=shot(m,{first:1,down:[3]});
 expect(!r.foul&&r.keep&&m.turn===0&&!m.groups[0]&&!m.inHand,'a ball potted on the break: the breaker goes on, the table stays open');}
{const m=newMatch(2),r=shot(m,{first:1,scratch:true});
 const cue=m.g.balls[0];
 expect(r.foul==='scratch'&&m.turn===1&&m.inHand==='kitchen'&&!cue.potted&&cue.x<=HEAD.x,'a scratch on the break: player 2 has ball in hand behind the head string');}
{const m=newMatch(3),r=shot(m,{first:1,down:[8]}),eight=m.g.balls[8];
 expect(r.win===null&&r.keep&&m.turn===0&&!eight.potted&&Math.abs(eight.y)<1e-9&&eight.x>=FOOT.x&&!m.g.potted.includes(8),'the 8 potted on the break comes back to the foot spot and the breaker goes on');}
{const m=newMatch(4);shot(m,{first:1});
 expect(m.turn===1&&!m.inHand,'a break that pots nothing passes the turn, no foul');
 const r=shot(m,{first:2,down:[11]});
 expect(!r.foul&&r.assigned==='stripes'&&m.groups[1]==='stripes'&&m.groups[0]==='solids'&&r.keep&&m.turn===1,'on an open table, the first legal pot sets the groups (a solid struck first, a stripe down)');}
{const m=newMatch(5);shot(m,{first:1});const r=shot(m,{first:8});
 expect(r.foul==='wrong-ball'&&m.turn===0&&m.inHand==='table'&&!m.groups[0]&&!m.groups[1],'on an open table, the 8 struck first is a foul: ball in hand anywhere');}
{const m=assigned(newMatch(6),0,'stripes'),r=shot(m,{first:3,down:[12]});
 expect(r.foul==='wrong-ball'&&m.turn===1&&m.inHand==='table'&&m.g.balls[12].potted,'striking the other group first is a foul, and a ball potted on a foul stays down');}
{const m=assigned(newMatch(7),0,'stripes'),r=shot(m,{first:10,down:[2]});
 expect(!r.foul&&!r.keep&&m.turn===1&&!m.inHand,"potting only the other group's ball passes the turn, no foul");}
{const m=assigned(newMatch(8),0,'stripes'),r=shot(m,{first:10,rail:false});
 expect(r.foul==='no-rail'&&m.turn===1&&m.inHand==='table','nothing potted and no cushion after contact is a foul');
 const r2=shot(m,{});expect(r2.foul==='no-hit'&&m.turn===0,'striking no ball is a foul');}
{const m=assigned(newMatch(9),0,'stripes'),r=shot(m,{first:10,down:[10,8]});
 expect(r.win===1&&m.winner===1&&m.why==='eight-early'&&m.g.phase==='done','the 8 down before the group is cleared loses the game');}
{const m=clearGroup(assigned(newMatch(10),0,'stripes'),'stripes');
 expect(onEight(m,0)&&legal(m,8,0)&&!legal(m,1,0)&&!onEight(m,1),'with the group cleared, the 8 is the only ball to strike first');
 const r=shot(m,{first:3,down:[8]});expect(r.win===1&&m.why==='foul-on-eight','the 8 down after striking another ball first loses');}
{const m=clearGroup(assigned(newMatch(11),0,'stripes'),'stripes'),r=shot(m,{first:8,down:[8],scratch:true});
 expect(r.win===1&&m.why==='scratch-on-eight','the 8 down with the cue ball loses');}
{const m=clearGroup(assigned(newMatch(12),1,'solids'),'solids'),r=shot(m,{first:8,down:[8]});
 expect(r.win===1&&m.winner===1&&m.why==='eight'&&m.g.phase==='done','the 8 down cleanly after the whole group wins');}
{const m=assigned(newMatch(13),0,'stripes');for(const n of [9,10,11,12,13,14]){m.g.balls[n].potted=true;m.g.potted.push(n);}
 const r=shot(m,{first:15,down:[15,8]});expect(r.win===1&&m.why==='eight-early','the last of the group and the 8 on the same kick loses');}
// Ball in hand: kept inside the cushions and behind the head string after a break scratch, never on another ball.
{const m=newMatch(14),cue=m.g.balls[0];
 expect(place(m,-5,2)&&cue.x===-5&&cue.y===2,'ball in hand moves the cue ball behind the head string');
 expect(place(m,3,0)&&cue.x===HEAD.x,'behind the head string it stops at the line');
 const one=m.g.balls[1];m.inHand='table';const was=[cue.x,cue.y];
 expect(!place(m,one.x,one.y)&&cue.x===was[0]&&cue.y===was[1],"it can't be put on another ball");
 expect(place(m,99,0)&&cue.x===TABLE.w/2-R,'it stays inside the cushions');
 expect(!place(m,TABLE.w/2-R,TABLE.h/2-R),"it can't be put in a pocket's mouth");
 m.inHand=null;expect(!place(m,-5,0),'without ball in hand it stays put');}
// The real thing: a straight break records the 1 as the first ball struck and a cushion after it.
{const m=newMatch(15);kick(m.g,0,1);m.inHand=null;let ev=[];for(let i=0;i<60/STEP&&!ev.includes('still');i++)ev=step(m.g);
 expect(m.g.shot.first===1&&m.g.shot.rail&&m.g.phase==='aim'&&ev.includes('still'),'a break records the 1 struck first and a cushion after it, then waits to be judged');
 const r=judge(m);expect(m.broken&&!m.g.balls[0].potted&&(r.keep?m.turn===0:m.turn===1),'the break is judged');}
// Two bots play whole matches: each kicks at a ball it may strike first, as the practice bot does, and leaves the
// cue ball where it is with ball in hand. Every match must end with a winner and keep the rules' bookkeeping straight.
function match(seed,limit=400){
 const m=newMatch(seed,seed%2);let bad=null,kicks=0;
 kick(m.g,(seed%7-3)*.004,1);m.inHand=null;
 while(m.winner===null&&kicks<limit){
  const ev=step(m.g);
  if(ev.includes('still')){
   const r=judge(m);
   if(m.groups[0]&&m.groups[0]===m.groups[1])bad='both players on one group';
   if(r.foul&&m.winner===null&&!m.inHand)bad='a foul without ball in hand';
   if(m.g.balls[0].potted)bad='the cue ball left off the table';
   if(m.winner===null){const s=bot(m.g,n=>legal(m,n));kick(m.g,s.angle,s.power);m.inHand=null;kicks++;}
  }
  if(!m.g.balls.every(onTable))bad='a ball left the table';
  if(bad)break;
 }
 const g=m.g;
 if(m.why==='eight'&&!GROUPS[m.groups[m.winner]].every(n=>g.balls[n].potted))bad='a win with the group still up';
 return {seed,winner:m.winner,why:m.why,kicks:m.kicks,fouls:m.fouls,bad};
}
const matches=[31,32,33,34,35,36,37,38,39,40,41,42].map(s=>match(s));
matches.forEach(r=>log('     8-ball match',JSON.stringify(r)));
expect(matches.every(r=>!r.bad),"8-ball matches: the rules' bookkeeping holds and no ball leaves the table");
expect(matches.every(r=>r.winner!==null),`every 8-ball match ends with a winner (${matches.filter(r=>r.winner!==null).length} of ${matches.length})`);
expect(matches.filter(r=>r.why==='eight').length>=matches.length/2,`most matches are won by potting the 8 (${matches.filter(r=>r.why==='eight').length} of ${matches.length})`);
expect(new Set(matches.map(r=>r.winner)).size===2,'both players win some');
expect(JSON.stringify(match(41))===JSON.stringify(match(41)),'the same seed and kicks play the same match');

console.log(problems.length?`FAIL: ${problems.length} problem(s)`:'PASS');
process.exitCode=problems.length?1:0;
