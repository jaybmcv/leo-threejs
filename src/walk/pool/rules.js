// Paw Pool's rules: a soccer-ball pool table the size of the Recreation Hall's activity floor, as plain state and a
// fixed step, no drawing, so the game plays the same in the page and in a Node check (scripts/check-pool.mjs).
// Practice: Cosmo kicks the cue ball, any ball in any pocket counts, and the clock runs until all fifteen are down.
// Units are metres and seconds. x runs along the table (the hall's +x), y across it (the hall's +z); (0, 0) is its middle.
export const TABLE={w:14,h:8,rail:.45},R=.2,STEP=1/240,MAX_SPEED=18;
const HALF_W=TABLE.w/2,HALF_H=TABLE.h/2;
// Six pockets: the corners and the middle of each long side. Near a pocket the cushion opens (its mouth), and a ball
// that reaches the pocket, or passes the cushion line there, drops.
export const POCKETS=[[-1,-1],[0,-1],[1,-1],[-1,1],[0,1],[1,1]].map(([sx,sy])=>sx?{x:sx*HALF_W,y:sy*HALF_H,r:.5,corner:true}:{x:0,y:sy*(HALF_H+.1),r:.38,corner:false});
export const MOUTH={corner:.55,side:.42};
const ROLL=2.4,DRAG=.22,CUSHION=.78,BOUNCE=.94,STILL=.01;
export const HEAD={x:-HALF_W/2,y:0},FOOT={x:HALF_W/2,y:0};
// Ball colours, 1-7 solid, 9-15 striped with the same colours, 8 black.
export const COLORS=['#f4f0e8','#f2c230','#2459c9','#d8332b','#6b3fa0','#f07a22','#1f8a4c','#8a2430','#15171a'];
export const colorOf=n=>n===0?COLORS[0]:COLORS[n>8?n-8:n],striped=n=>n>8;

function rng(seed){let s=seed>>>0||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}

// The rack: a triangle with its apex on the foot spot, the 1 at the apex, the 8 in the middle of the third row, a
// solid and a stripe in the back corners and the rest shuffled by the seed. Returns [{n, x, y}] for balls 1-15.
export function rack(seed=1){
 const random=rng(seed),gap=2*R*1.002,rows=[];
 for(let k=0;k<5;k++)for(let j=0;j<=k;j++)rows.push({x:FOOT.x+k*gap*Math.sqrt(3)/2,y:(j-k/2)*gap,k,j});
 const solids=[2,3,4,5,6,7],stripes=[9,10,11,12,13,14,15],pick=list=>list.splice((random()*list.length)|0,1)[0];
 const order=new Map([[0,1],[4,8]]);
 const back=random()<.5;order.set(10,back?pick(solids):pick(stripes));order.set(14,back?pick(stripes):pick(solids));
 const rest=[...solids,...stripes];for(let i=rest.length;i>1;i--){const k=(random()*i)|0;[rest[i-1],rest[k]]=[rest[k],rest[i-1]];}
 rows.forEach((p,i)=>{if(!order.has(i))order.set(i,rest.pop());});
 return rows.map((p,i)=>({n:order.get(i),x:p.x,y:p.y}));
}

export function newGame(seed=Date.now()){
 const balls=[{n:0,x:HEAD.x,y:HEAD.y},...rack(seed)].map(b=>({...b,vx:0,vy:0,potted:false,spin:0}));
 balls.sort((a,b)=>a.n-b.n);
 return {balls,phase:'aim',t:0,shots:0,potted:[],events:[]};
}
export const left=g=>g.balls.filter(b=>b.n&&!b.potted).length;
const moving=b=>!b.potted&&(b.vx||b.vy);

// Kick the cue ball: `angle` in radians (0 along +x), `power` 0-1. Only while everything is still.
export function kick(g,angle,power){
 const cue=g.balls[0];if(g.phase!=='aim'||cue.potted)return false;
 const speed=MAX_SPEED*Math.min(1,Math.max(.04,power))**1.25;
 cue.vx=Math.cos(angle)*speed;cue.vy=Math.sin(angle)*speed;g.phase='roll';g.shots++;g.events.push('kick');return true;
}

// Where the shot lined up at `angle` first meets something: the cue ball's centre there (the ghost ball), the ball it
// strikes (or null for a cushion), and the directions that ball and the cue ball leave in. For the aim line.
export function aim(g,angle){
 const cue=g.balls[0],dx=Math.cos(angle),dy=Math.sin(angle);
 let t=Infinity,hit=null;
 // The cushions, a ball's radius in.
 if(dx>0)t=Math.min(t,(HALF_W-R-cue.x)/dx);else if(dx<0)t=Math.min(t,(-HALF_W+R-cue.x)/dx);
 if(dy>0)t=Math.min(t,(HALF_H-R-cue.y)/dy);else if(dy<0)t=Math.min(t,(-HALF_H+R-cue.y)/dy);
 for(const b of g.balls){
  if(!b.n||b.potted)continue;
  const ox=b.x-cue.x,oy=b.y-cue.y,along=ox*dx+oy*dy;if(along<=0)continue;
  const off=(ox*ox+oy*oy)-along*along,reach=4*R*R-off;if(reach<0)continue;
  const s=along-Math.sqrt(reach);if(s<t&&s>=0){t=s;hit=b;}
 }
 t=Math.max(0,t);const x=cue.x+dx*t,y=cue.y+dy*t;
 if(!hit)return {x,y,ball:null};
 const nx=(hit.x-x)/(2*R),ny=(hit.y-y)/(2*R),dot=dx*nx+dy*ny,cx=dx-dot*nx,cy=dy-dot*ny,cl=Math.hypot(cx,cy);
 return {x,y,ball:hit,dir:[nx,ny],cue:cl>1e-6?[cx/cl,cy/cl]:null,cut:Math.acos(Math.min(1,dot))};
}

// Put the cue ball back on the head spot after it dropped, or as near behind it as is free.
function respot(g){
 const cue=g.balls[0];cue.potted=false;cue.vx=cue.vy=0;
 for(let x=HEAD.x;x>-HALF_W+R;x-=R/2){if(g.balls.every(b=>b===cue||b.potted||Math.hypot(b.x-x,b.y-HEAD.y)>=2*R+.01)){cue.x=x;cue.y=HEAD.y;return;}}
 cue.x=HEAD.x;cue.y=HEAD.y;
}
function drop(g,b){
 b.potted=true;b.vx=b.vy=0;
 if(b.n){g.potted.push(b.n);g.events.push('pot');}else g.events.push('scratch');
}

// One fixed step. Returns and clears the step's events, for sound: kick, click (with the speed of the hit as
// 'click:4.2'), cushion, pot, scratch, still, clear.
export function step(g){
 g.events.length=0;
 if(g.phase==='done')return g.events;
 g.t+=STEP;
 if(g.phase!=='roll')return g.events.splice(0);
 const live=g.balls.filter(b=>!b.potted);
 // Rolling: a steady slowing plus a little drag, then each ball moves.
 for(const b of live){
  const s=Math.hypot(b.vx,b.vy);if(!s)continue;
  const next=Math.max(0,s-(ROLL+DRAG*s)*STEP);
  if(next<STILL){b.vx=b.vy=0;continue;}
  b.vx*=next/s;b.vy*=next/s;b.x+=b.vx*STEP;b.y+=b.vy*STEP;b.spin+=next*STEP/R;
 }
 // Balls meeting: equal masses, a little energy lost, pushed apart so they never sit inside one another.
 for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
  const a=live[i],b=live[j],dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;if(d2>=4*R*R||d2===0)continue;
  const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,push=(2*R-d)/2;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;
  const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(closing<=0)continue;
  const j2=closing*(1+BOUNCE)/2;a.vx-=j2*nx;a.vy-=j2*ny;b.vx+=j2*nx;b.vy+=j2*ny;
  if(closing>.15)g.events.push('click:'+closing.toFixed(1));
 }
 // Pockets, then the cushions, which open at each pocket's mouth.
 for(const b of live){
  if(b.potted)continue;
  if(POCKETS.some(p=>Math.hypot(b.x-p.x,b.y-p.y)<p.r)||Math.abs(b.x)>HALF_W||Math.abs(b.y)>HALF_H){drop(g,b);continue;}
  const inMouthX=Math.abs(b.y)>HALF_H-MOUTH.corner,inMouthY=Math.abs(b.x)>HALF_W-MOUTH.corner||Math.abs(b.x)<MOUTH.side;
  if(Math.abs(b.x)>HALF_W-R&&!inMouthX){const s=Math.sign(b.x);b.x=s*(HALF_W-R);if(b.vx*s>0){if(Math.abs(b.vx)>.3)g.events.push('cushion');b.vx*=-CUSHION;b.vy*=.96;}}
  if(Math.abs(b.y)>HALF_H-R&&!inMouthY){const s=Math.sign(b.y);b.y=s*(HALF_H-R);if(b.vy*s>0){if(Math.abs(b.vy)>.3)g.events.push('cushion');b.vy*=-CUSHION;b.vx*=.96;}}
 }
 // Everything still: the cue ball comes back if it dropped, and the rack is cleared or it is the next shot.
 if(!g.balls.some(moving)){
  if(g.balls[0].potted)respot(g);
  if(!left(g)){g.phase='done';g.events.push('clear');}else{g.phase='aim';g.events.push('still');}
 }
 return g.events.splice(0);
}
