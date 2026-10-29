// Pinball's rules (from tester feedback): plain state and a fixed 480 Hz step, no drawing. The table stands up the
// screen, 240 wide and 420 tall, y down; gravity pulls the ball down it. A plunger lane on the right launches the ball
// round the top arch; a one-way gate keeps it out of the lane after. Two flippers at the foot, a slingshot above each,
// three pop bumpers, three top lanes (light all three for a higher multiplier; the flippers move the lit lanes), a
// bank of three drop targets on the right and the Mars saucer on the left, which holds the ball a moment and kicks it
// back out. Three balls a game; a ball that drains in its first seconds comes back once.
export const W=240,H=420,R=5.5,STEP=1/480,BALLS=3;
const G=520,MAX_V=1300,WALL_E=.45,FLIP_E=.35;
// Scores, times the multiplier (up to 5x).
export const POINTS={bumper:100,sling:10,lane:50,lanes:1000,drop:500,bank:5000,saucer:2500};
export const SAVE_S=10,MULT_MAX=5;

// The top arch: from the lane's outer wall over the top to its top-left corner, where a steep wall turns a launched
// ball down into the top lanes and bumpers instead of round the side.
export const ARCH={x:120,y:112,r:110,from:Math.PI*1.4},ARCH_END=[ARCH.x+ARCH.r*Math.cos(ARCH.from),ARCH.y+ARCH.r*Math.sin(ARCH.from)];
// Flippers: pivot, length, pivot and tip radii, rest and raised angles (radians, from the pivot, y down).
const d=a=>a*Math.PI/180;
export const FLIPPERS=[{x:70,y:375,len:36,r0:6,r1:3.5,rest:d(30),up:d(-22)},{x:152,y:375,len:36,r0:6,r1:3.5,rest:d(150),up:d(202)}];
export const BUMPERS=[{x:82,y:140,r:14},{x:140,y:140,r:14},{x:111,y:188,r:14}];
// The top lanes' centres, and the dividers' x either side of them.
export const LANES=[75,105,135],DIVIDERS=[60,90,120,150],LANE_TOP=48,LANE_BOTTOM=74;
export const DROPS=[210,230,250].map(y=>({x:206,y,half:7,r:2.5}));
export const SAUCER={x:36,y:200,r:7};
// The slingshots: three posts each, the kicking face from the first to the third.
export const SLINGS=[[[28,290],[28,320],[56,341]],[[194,290],[194,320],[166,341]]];
export const LANE={x0:212,x1:230,top:150,floor:400},PLUNGE={x:221,y:400-R};
// The gate across the lane's top, sloping down into the table: solid once the ball is out.
export const GATE=[[230,128],[212,150]];

// Every fixed wall as a segment [ax,ay,bx,by,radius,kind].
export const WALLS=(()=>{
 const w=[],seg=(a,b,r=0,kind='wall')=>w.push([a[0],a[1],b[0],b[1],r,kind]);
 const n=24;let prev=null;
 for(let i=0;i<=n;i++){const t=ARCH.from+i*(2*Math.PI-ARCH.from)/n,p=[ARCH.x+ARCH.r*Math.cos(t),ARCH.y+ARCH.r*Math.sin(t)];if(prev)seg(prev,p);prev=p;}
 seg(ARCH_END,[10,112]);seg([10,112],[10,327]);seg([10,327],[66,369]);
 seg([230,112],[230,H]);seg([LANE.x0,LANE.floor],[LANE.x1,LANE.floor]);seg([LANE.x0,LANE.top],[LANE.x0,LANE.floor]);
 seg([212,327],[156,369]);
 for(const x of DIVIDERS)seg([x,LANE_TOP],[x,LANE_BOTTOM],2,'post');
 for(const [a,b,c] of SLINGS){seg(a,c,2,'sling');seg(a,b,2);seg(b,c,2);}
 return w;
})();

// A seeded random number: the saucer's kick and the stuck-ball nudge vary a little.
function rand(g){g.rng=(Math.imul(g.rng,1664525)+1013904223)>>>0;return g.rng/4294967296;}

function ballInLane(){return {x:PLUNGE.x,y:PLUNGE.y,vx:0,vy:0,lane:true,launching:false,hold:0,out:false};}
export function newGame(seed=1){
 return {rng:seed>>>0||1,t:0,score:0,ball:1,balls:BALLS,mult:1,lanes:[false,false,false],drops:[true,true,true],raise:0,phase:'play',
  b:ballInLane(),flips:FLIPPERS.map(f=>({a:f.rest,w:0})),held:[false,false],pull:0,saveUntil:0,saved:false,still:0,inLane:-1,flash:{},kicks:0};
}
export const tip=(f,a)=>[f.x+f.len*Math.cos(a),f.y+f.len*Math.sin(a)];
const add=(g,n)=>{g.score+=n*g.mult;};

// The closest point to (px,py) on segment a-b: [x, y, t along it].
function closest(ax,ay,bx,by,px,py){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l)):0;return [ax+dx*t,ay+dy*t,t];}
// Pushes the ball out of a round surface touching it at (cx,cy) with radius r, moving at (ux,uy); returns the
// closing speed, or 0 if it wasn't touching or was already leaving.
function bounce(b,cx,cy,r,e,ux=0,uy=0){
 let nx=b.x-cx,ny=b.y-cy;const dist=Math.hypot(nx,ny);if(dist>=R+r||dist<1e-9)return 0;
 nx/=dist;ny/=dist;b.x=cx+nx*(R+r);b.y=cy+ny*(R+r);
 const rx=b.vx-ux,ry=b.vy-uy,vn=rx*nx+ry*ny;if(vn>=0)return 0;
 b.vx=rx-(1+e)*vn*nx+ux;b.vy=ry-(1+e)*vn*ny+uy;b.nx=nx;b.ny=ny;return -vn;
}

// One step. `input`: {left, right, launch} held. Returns the events for the sound and screen: 'flip', 'launch',
// 'wall', 'bumper', 'sling', 'lane', 'lanes', 'drop', 'bank', 'saucer', 'kick', 'saved', 'drain', 'ball', 'over'.
export function step(g,input={}){
 const ev=[];if(g.phase!=='play')return ev;
 g.t+=STEP;const b=g.b;
 for(const k in g.flash)if((g.flash[k]-=STEP)<=0)delete g.flash[k];
 // The flippers: up fast while held, back down slower; a fresh press moves the lit top lanes that way.
 FLIPPERS.forEach((f,i)=>{
  const on=!!(i?input.right:input.left),s=g.flips[i],target=on?f.up:f.rest,speed=on?26:12,was=s.a;
  if(on&&!g.held[i]){ev.push('flip');const l=g.lanes;if(i)l.unshift(l.pop());else l.push(l.shift());}
  g.held[i]=on;const dA=target-s.a;s.a+=Math.sign(dA)*Math.min(Math.abs(dA),speed*STEP);s.w=(s.a-was)/STEP;
 });
 // The plunger: hold to draw it back, let go to launch. Too soft a pull falls back for another go.
 if(b.launching&&Math.abs(b.vy)<20&&b.y>=PLUNGE.y-1)b.launching=false;
 if(b.lane&&!b.launching&&b.y>PLUNGE.y-3&&Math.abs(b.vy)<20){
  if(input.launch)g.pull=Math.min(1,g.pull+STEP/.9);
  else if(g.pull>0){if(g.pull>.08){b.vy=-(480+g.pull*620);b.launching=true;ev.push('launch');}g.pull=0;}
 }else if(!input.launch)g.pull=0;
 // The saucer holds the ball, then kicks it back out up the table.
 if(b.hold>0){b.hold-=STEP;if(b.hold<=0){b.vx=230+rand(g)*60;b.vy=-140-rand(g)*80;b.x=SAUCER.x+R+2;ev.push('kick');}return ev;}
 b.vy+=G*STEP;const k=1-.04*STEP;b.vx*=k;b.vy*=k;
 const sp=Math.hypot(b.vx,b.vy);if(sp>MAX_V){b.vx*=MAX_V/sp;b.vy*=MAX_V/sp;}
 b.x+=b.vx*STEP;b.y+=b.vy*STEP;
 // Out of the lane once over the gate; the save clock starts the first time.
 if(b.launching&&b.y<ARCH.y-2){b.launching=false;b.lane=false;if(!b.out){b.out=true;if(!g.saved)g.saveUntil=g.t+SAVE_S;}}
 if(!b.launching&&b.x<LANE.x0-R)b.lane=false;
 // Walls, posts and the slingshots' kicking faces.
 for(const [ax,ay,bx,by,r,kind] of WALLS){
  const [cx,cy]=closest(ax,ay,bx,by,b.x,b.y),v=bounce(b,cx,cy,r,WALL_E);if(!v)continue;
  if(kind==='sling'&&v>30){b.vx+=b.nx*280;b.vy+=b.ny*280;add(g,POINTS.sling);g.flash['sling'+(ax<120?0:1)]=.12;ev.push('sling');}
  else if(v>60)ev.push('wall');
 }
 if(!b.launching&&!b.lane){const [[ax,ay],[bx,by]]=GATE,[cx,cy]=closest(ax,ay,bx,by,b.x,b.y);if(bounce(b,cx,cy,1,WALL_E)>60)ev.push('wall');}
 // The flippers, moving: a struck ball takes the flipper's own speed where it hits.
 FLIPPERS.forEach((f,i)=>{
  const s=g.flips[i],[tx,ty]=tip(f,s.a),[cx,cy,t]=closest(f.x,f.y,tx,ty,b.x,b.y);
  bounce(b,cx,cy,f.r0+(f.r1-f.r0)*t,FLIP_E,-s.w*(cy-f.y),s.w*(cx-f.x));
 });
 for(const [i,p] of BUMPERS.entries()){
  if(!bounce(b,p.x,p.y,p.r,WALL_E))continue;
  const vt=b.vx*-b.ny+b.vy*b.nx;b.vx=b.nx*340-b.ny*vt*.6;b.vy=b.ny*340+b.nx*vt*.6;
  add(g,POINTS.bumper);g.flash['bumper'+i]=.12;ev.push('bumper');
 }
 g.drops.forEach((up,i)=>{
  if(!up)return;const t=DROPS[i],[cx,cy]=closest(t.x,t.y-t.half,t.x,t.y+t.half,b.x,b.y);
  if(!bounce(b,cx,cy,t.r,WALL_E))return;
  g.drops[i]=false;add(g,POINTS.drop);ev.push('drop');
  if(!g.drops.some(Boolean)){g.raise=.8;add(g,POINTS.bank);g.flash.bank=1;ev.push('bank');}
 });
 // A cleared bank comes back up a moment later, once the ball is clear of it.
 if(g.raise>0&&(g.raise-=STEP)<=0){if(DROPS.every(t=>Math.hypot(Math.max(0,Math.abs(b.y-t.y)-t.half),b.x-t.x)>R+t.r+2))g.drops=[true,true,true];else g.raise=STEP;}
 // Top lanes: rolling down through one lights it; all three raise the multiplier.
 const lane=b.y>LANE_TOP+4&&b.y<LANE_BOTTOM&&b.vy>0?LANES.findIndex(x=>Math.abs(b.x-x)<15-R):-1;
 if(lane>=0&&lane!==g.inLane&&!g.lanes[lane]){g.lanes[lane]=true;add(g,POINTS.lane);ev.push('lane');
  if(g.lanes.every(Boolean)){g.lanes=[false,false,false];add(g,POINTS.lanes);g.mult=Math.min(MULT_MAX,g.mult+1);g.flash.lanes=1;ev.push('lanes');}}
 g.inLane=lane;
 if(Math.hypot(b.x-SAUCER.x,b.y-SAUCER.y)<SAUCER.r-1&&Math.hypot(b.vx,b.vy)<320){
  Object.assign(b,{x:SAUCER.x,y:SAUCER.y,vx:0,vy:0,hold:1.2});add(g,POINTS.saucer);g.flash.saucer=1.2;ev.push('saucer');}
 // A ball come to rest out on the table (not cradled on a flipper) gets a nudge after a few seconds.
 const cradled=b.y>330&&FLIPPERS.some(f=>Math.hypot(b.x-f.x,b.y-f.y)<f.len+R+8);
 if(!b.lane&&!cradled&&Math.hypot(b.vx,b.vy)<8){if((g.still+=STEP)>3){g.still=0;b.vx=(rand(g)-.5)*200;b.vy=-220;g.kicks++;ev.push('wall');}}else g.still=0;
 // Down past the flippers: saved early on, once a ball; otherwise the next ball, or the game is over.
 if(b.y>H+10){
  if(g.t<g.saveUntil){g.saved=true;g.saveUntil=0;g.b=ballInLane();ev.push('saved');}
  else if(g.ball<g.balls){g.ball++;g.mult=1;g.saved=false;g.saveUntil=0;g.b=ballInLane();ev.push('drain','ball');}
  else{g.phase='over';ev.push('drain','over');}
 }
 return ev;
}
