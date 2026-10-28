// Paw Pool's 8-ball for two players taking turns on one computer (POOL.md, stage 3), as plain state with no drawing,
// so scripts/check-pool.mjs can play it in Node. The balls are rules.js's; this judges each shot once they stop:
// fouls and ball in hand, who has solids and who stripes, whose turn it is, and who wins.
// The usual rules, kept simple: no called pockets (any pocket counts, the 8 too), and on an open table any ball but
// the 8 may be struck first. The group goes to the first player to pot legally after the break, by the first ball down.
import {newGame,respot,TABLE,R,POCKETS,HEAD,FOOT} from './rules.js';
const HALF_W=TABLE.w/2,HALF_H=TABLE.h/2;
export const GROUPS={solids:[1,2,3,4,5,6,7],stripes:[9,10,11,12,13,14,15]};
export const groupOf=n=>n>=1&&n<=7?'solids':n>=9&&n<=15?'stripes':null;
const other=gr=>gr==='solids'?'stripes':'solids';

// A new rack. The breaker has ball in hand behind the head string (the kitchen), as usual for a break.
export function newMatch(seed=Date.now(),breaker=0){
 const g=newGame(seed);g.versus=true;
 return {g,turn:breaker,breaker,groups:[null,null],broken:false,inHand:'kitchen',winner:null,why:null,kicks:[0,0],fouls:[0,0],last:null};
}
// Whether player p has potted all of their group, so the 8 is theirs next.
export const onEight=(m,p=m.turn)=>!!m.groups[p]&&GROUPS[m.groups[p]].every(n=>m.g.balls[n].potted);
// Whether ball n is one player p may strike first: any ball on the break, any but the 8 on an open table, then their
// own group, then the 8.
export function legal(m,n,p=m.turn){
 if(!n)return false;if(!m.broken)return true;
 if(!m.groups[p])return n!==8;
 return onEight(m,p)?n===8:groupOf(n)===m.groups[p];
}
// How many of player p's group are down.
export const downOf=(m,p)=>m.groups[p]?GROUPS[m.groups[p]].filter(n=>m.g.balls[n].potted).length:0;

const free=(g,x,y,self)=>g.balls.every(b=>b===self||b.potted||Math.hypot(b.x-x,b.y-y)>=2*R+.005);
// Ball in hand: move the cue ball to (x, y), kept inside the cushions (and behind the head string after a break
// scratch), clear of the pockets and of every other ball. Returns false and leaves it where it was if it can't go there.
export function place(m,x,y){
 if(!m.inHand)return false;const g=m.g,cue=g.balls[0];
 x=Math.max(-HALF_W+R,Math.min(m.inHand==='kitchen'?HEAD.x:HALF_W-R,x));y=Math.max(-HALF_H+R,Math.min(HALF_H-R,y));
 if(POCKETS.some(p=>Math.hypot(x-p.x,y-p.y)<p.r+R*.6)||!free(g,x,y,cue))return false;
 cue.x=x;cue.y=y;return true;
}
// The 8 back on the foot spot after it dropped on the break, or as near behind it (then in front of it) as is free.
function spot(g,b){
 b.potted=false;b.vx=b.vy=0;const i=g.potted.lastIndexOf(b.n);if(i>=0)g.potted.splice(i,1);
 for(let x=FOOT.x;x<HALF_W-R;x+=R/4)if(free(g,x,0,b)){b.x=x;b.y=0;return;}
 for(let x=FOOT.x;x>-HALF_W+R;x-=R/4)if(free(g,x,0,b)){b.x=x;b.y=0;return;}
}

// Judge the shot just played, on rules.js's 'still'. Updates whose turn it is, ball in hand and any winner, and
// returns what happened for the screen: {player, foul, down, first, assigned, keep, win}. A foul is 'scratch' (the
// cue ball dropped), 'no-hit', 'wrong-ball' (the first ball struck wasn't one the player may strike) or 'no-rail'
// (after the first contact nothing dropped and no ball reached a cushion). Balls potted on a foul stay down.
export function judge(m){
 const g=m.g,s=g.shot||{first:null,rail:false,from:g.potted.length},p=m.turn,cue=g.balls[0],down=g.potted.slice(s.from);
 const breakShot=!m.broken,group=m.groups[p],before=n=>g.balls[n].potted&&!down.includes(n);
 const on8=!!group&&GROUPS[group].every(before);
 const firstOk=s.first!==null&&(breakShot||(!group?s.first!==8:on8?s.first===8:groupOf(s.first)===group));
 const foul=cue.potted?'scratch':s.first===null?'no-hit':!firstOk?'wrong-ball':!breakShot&&!down.length&&!s.rail?'no-rail':null;
 const out={player:p,foul,down,first:s.first,assigned:null,keep:false,win:null};
 m.kicks[p]++;if(foul)m.fouls[p]++;
 if(cue.potted)respot(g);
 if(down.includes(8)){
  // On the break the 8 comes back to the foot spot. Otherwise the game is over: won only by a clean shot on the 8
  // after the whole group, and lost if it went early, with a scratch or on any other foul.
  if(breakShot)spot(g,g.balls[8]);
  else{
   const win=!foul&&on8;m.winner=win?p:1-p;m.why=win?'eight':!on8?'eight-early':foul==='scratch'?'scratch-on-eight':'foul-on-eight';
   m.inHand=null;g.phase='done';out.win=m.winner;m.last=out;return out;
  }
 }
 const scoring=down.filter(n=>n!==8&&(!group||groupOf(n)===group));
 if(!foul&&!breakShot&&!group&&scoring.length){const gr=groupOf(scoring[0]);m.groups[p]=gr;m.groups[1-p]=other(gr);out.assigned=gr;}
 // The shooter carries on after potting one of theirs (any ball on the break or an open table) without a foul.
 out.keep=!foul&&(scoring.length>0||(breakShot&&down.length>0));
 m.broken=true;
 m.inHand=foul?(breakShot&&foul==='scratch'?'kitchen':'table'):null;
 if(!out.keep)m.turn=1-p;
 m.last=out;return out;
}
