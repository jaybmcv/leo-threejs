import {SPRITES} from './sprites.js';

// Alien Cat Invasion's rules (feedback-inbox #69, ALIEN_CAT_INVASION.md): plain state and a fixed step, no drawing, so
// the game plays the same in the page and in a Node check. Classic invaders: a 5 x 11 formation marches sideways a
// step at a time, drops at the edges and speeds up as it thins; one shot on screen; three lives; four shields that
// wear away; a mystery mothership; an extra life at 1,500; endless waves, each starting a little lower.
// Units are the screen's pixels (240 x 270), seconds and pixels per second.
export const W=240,H=270,STEP=1/60;
export const PLAYER={y:226,w:15,h:18,speed:90,min:4,max:221};
const SHOT={w:1,h:5,speed:240},BOMB={w:3,h:6},CELL={w:16,h:15},ALIEN={w:12,h:10},MOTHER={y:26,w:16,h:8,speed:40};
export const SHIELDS={xs:[22,80,138,196],y:198,w:22,h:16};
export const ROWS=['scout','tabby','tabby','brute','brute'],COLS=11,POINTS={scout:30,tabby:20,brute:10};
// The mothership's worth follows the shots fired, as on the arcade cabinets.
const MYSTERY=[100,50,50,100,150,100,100,50,300,100,100,100,50,150,100];
export const GROUND=252,EXTRA_AT=1500,LIVES=3;
const START_Y=44,LOWER=8,LOWEST=4,LAND=PLAYER.y-2;

function rng(seed){let s=seed>>>0||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const shieldBits=()=>Uint8Array.from(SPRITES.shield.rows.join(''),c=>c==='.'?0:1);

export function newGame(seed=Date.now()){
 const g={random:rng(seed),score:0,lives:LIVES,wave:0,extraGiven:false,shotsFired:0,t:0,phase:'play',events:[],
  player:{x:(W-PLAYER.w)/2|0,alive:true,respawnAt:0},shot:null,bombs:[],booms:[],aliens:[],formation:null,mother:null,motherAt:0,shields:[],nextWaveAt:0};
 startWave(g);return g;
}
function startWave(g){
 g.wave++;
 g.aliens=[];for(let r=0;r<ROWS.length;r++)for(let c=0;c<COLS;c++)g.aliens.push({row:r,col:c,kind:ROWS[r],alive:true});
 g.formation={x:26,y:START_Y+LOWER*Math.min(g.wave-1,LOWEST),dir:1,stepAt:g.t+.5,frame:0,note:0,drop:false};
 g.shields=SHIELDS.xs.map(()=>shieldBits());g.shot=null;g.bombs=[];g.mother=null;g.motherAt=g.t+18+g.random()*10;g.phase='play';
 g.events.push('wave');
}
export const alive=g=>g.aliens.filter(a=>a.alive);
export const alienBox=(g,a)=>({x:g.formation.x+a.col*CELL.w,y:g.formation.y+a.row*CELL.h,w:ALIEN.w,h:ALIEN.h});
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
// The march's pace: a step every 0.55 s with the formation full, quickening to a step a frame for the last cat.
const pace=(n,wave)=>Math.max(STEP,(.03+.52*(n/55)**1.2)*Math.pow(.94,Math.min(wave-1,8)));

// Wear a shield where something hits it: `r` pixels round (x, y), in screen pixels. True if anything was there.
function chip(g,x,y,r){
 for(let i=0;i<g.shields.length;i++){
  const sx=SHIELDS.xs[i],bits=g.shields[i];let hit=false;
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const px=Math.round(x+dx-sx),py=Math.round(y+dy-SHIELDS.y);
   if(px<0||py<0||px>=SHIELDS.w||py>=SHIELDS.h)continue;const k=py*SHIELDS.w+px;if(bits[k]){hit=true;if(Math.abs(dx)+Math.abs(dy)<=r+((g.random()*2)|0))bits[k]=0;}}
  if(hit)return true;
 }
 return false;
}
// Is there shield at (x, y)?
function solid(g,x,y){for(let i=0;i<g.shields.length;i++){const px=Math.floor(x-SHIELDS.xs[i]),py=Math.floor(y-SHIELDS.y);if(px>=0&&py>=0&&px<SHIELDS.w&&py<SHIELDS.h&&g.shields[i][py*SHIELDS.w+px])return true;}return false;}

function addScore(g,n){
 g.score+=n;
 if(!g.extraGiven&&g.score>=EXTRA_AT){g.extraGiven=true;g.lives++;g.events.push('extra');}
}

// One fixed step. input: {left, right, fire} (fire: pressed this step). Returns and clears the step's events, for
// sound: shoot, hit, march0-3, mother, motherhit, die, extra, wave, over.
export function step(g,input={}){
 g.events.length=0;
 if(g.phase==='over')return g.events;
 g.t+=STEP;
 g.booms=g.booms.filter(b=>b.until>g.t);
 if(g.phase==='between'){if(g.t>=g.nextWaveAt)startWave(g);return g.events.splice(0);}
 const p=g.player;
 // Leo: moves, and fires when no shot of its own is in the air.
 if(p.alive){
  p.x=Math.min(PLAYER.max,Math.max(PLAYER.min,p.x+((input.right?1:0)-(input.left?1:0))*PLAYER.speed*STEP));
  if(input.fire&&!g.shot){g.shot={x:Math.round(p.x+7),y:PLAYER.y-SHOT.h};g.shotsFired++;g.events.push('shoot');}
 }else if(g.t>=p.respawnAt){if(g.lives>0){p.alive=true;p.x=(W-PLAYER.w)/2|0;}else{g.phase='over';g.events.push('over');return g.events.splice(0);}}
 // The shot: up, into a cat, the mothership, a shield or off the top.
 if(g.shot){
  const s=g.shot;s.y-=SHOT.speed*STEP;const box={x:s.x,y:s.y,w:SHOT.w,h:SHOT.h};
  const cat=alive(g).find(a=>overlap(box,alienBox(g,a)));
  if(cat){cat.alive=false;addScore(g,POINTS[cat.kind]);const b=alienBox(g,cat);g.booms.push({x:b.x,y:b.y,until:g.t+.25});g.shot=null;g.events.push('hit');}
  else if(g.mother&&overlap(box,{x:g.mother.x,y:MOTHER.y,w:MOTHER.w,h:MOTHER.h})){
   const worth=MYSTERY[g.shotsFired%MYSTERY.length];addScore(g,worth);g.booms.push({x:g.mother.x,y:MOTHER.y,until:g.t+.8,worth});g.mother=null;g.shot=null;g.events.push('motherhit');}
  else if(solid(g,s.x,s.y)||solid(g,s.x,s.y+SHOT.h-1)){chip(g,s.x,s.y,1);g.shot=null;}
  else if(s.y<14)g.shot=null;
  // A shot meeting a bomb: both go.
  if(g.shot){const i=g.bombs.findIndex(b=>overlap(box,{x:b.x,y:b.y,w:BOMB.w,h:BOMB.h}));if(i>=0){g.bombs.splice(i,1);g.shot=null;}}
 }
 const cats=alive(g);
 if(!cats.length){g.phase='between';g.nextWaveAt=g.t+1.5;g.bombs=[];g.shot=null;g.mother=null;return g.events.splice(0);}
 // The march: one step at a time, faster as the formation thins; at an edge the next step drops instead.
 const f=g.formation;
 if(g.t>=f.stepAt){
  f.stepAt=g.t+pace(cats.length,g.wave);f.frame^=1;g.events.push('march'+f.note);f.note=(f.note+1)%4;
  if(f.drop){f.y+=LOWER;f.dir*=-1;f.drop=false;}
  else{f.x+=2*f.dir;const xs=cats.map(a=>alienBox(g,a).x);if(Math.min(...xs)<=4||Math.max(...xs)+ALIEN.w>=W-4)f.drop=true;}
  // Bombs: up to three, from the lowest cat of a column, now and then aimed at Leo's column.
  const most=Math.min(3,1+Math.floor(g.wave/2));
  if(g.bombs.length<most&&g.random()<.35){
   const cols=[...new Set(cats.map(a=>a.col))],aim=Math.round((p.x+7-f.x-ALIEN.w/2)/CELL.w);
   const col=g.random()<.4&&cols.includes(aim)?aim:cols[(g.random()*cols.length)|0];
   const low=cats.filter(a=>a.col===col).sort((a,b)=>b.row-a.row)[0],b=alienBox(g,low);
   g.bombs.push({x:b.x+ALIEN.w/2-1,y:b.y+ALIEN.h,speed:70+Math.min(40,5*(g.wave-1)),frame:0});
  }
 }
 // Cats on the shields wear them away; cats down at Leo's level have landed.
 for(const a of cats){const b=alienBox(g,a);if(b.y+b.h>=SHIELDS.y)for(let x=b.x;x<b.x+b.w;x+=2)chip(g,x,b.y+b.h-1,1);
  if(b.y+b.h>=LAND){g.lives=0;p.alive=false;p.respawnAt=g.t;g.booms.push({x:p.x,y:PLAYER.y,until:g.t+1});g.events.push('die');}}
 // Bombs: down, into a shield, Leo or the ground.
 for(const b of g.bombs){
  b.y+=b.speed*STEP;b.frame=(g.t*12|0)%2;
  if(solid(g,b.x+1,b.y+BOMB.h)){chip(g,b.x+1,b.y+BOMB.h,2);b.done=true;continue;}
  // Leo's hull and pods, not the clear space between them.
  if(p.alive&&b.y+BOMB.h>=PLAYER.y+2&&b.y<=PLAYER.y+PLAYER.h&&((b.x+2>=p.x+5&&b.x<=p.x+9)||(b.y+BOMB.h>=PLAYER.y+11&&b.x+2>=p.x&&b.x<=p.x+14))){
   b.done=true;p.alive=false;g.lives--;p.respawnAt=g.t+1.6;g.booms.push({x:p.x,y:PLAYER.y,until:g.t+1.2});g.bombs.forEach(o=>o.done=true);g.shot=null;g.events.push('die');break;}
  if(b.y+BOMB.h>=GROUND){b.done=true;g.booms.push({x:b.x-1,y:GROUND-6,until:g.t+.2,small:true});}
 }
 g.bombs=g.bombs.filter(b=>!b.done);
 // The mothership, now and then while eight or more cats remain.
 if(!g.mother&&g.t>=g.motherAt&&cats.length>=8){const left=g.random()<.5;g.mother={x:left?-MOTHER.w:W,dir:left?1:-1};g.events.push('mother');}
 if(g.mother){g.mother.x+=g.mother.dir*MOTHER.speed*STEP;if(g.mother.x<-MOTHER.w-2||g.mother.x>W+2){g.mother=null;g.motherAt=g.t+20+g.random()*10;}}
 else if(g.t>=g.motherAt&&cats.length<8)g.motherAt=g.t+20;
 if(g.lives<=0&&!p.alive&&g.t>=p.respawnAt){g.phase='over';g.events.push('over');}
 return g.events.splice(0);
}
export const MOTHERSHIP=MOTHER;
