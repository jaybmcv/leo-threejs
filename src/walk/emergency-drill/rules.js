// A solo practice flight. Metals are points; a safe hull earns most of the score.
export const STEP=1/60,DURATION=60,HEALTH_POINTS=100;
export const METALS=[{name:'Iron',value:25,color:'#a9c4d6'},{name:'Titanium',value:150,color:'#72ffe1'},{name:'Platinum',value:500,color:'#e4a5ff'}];
const clamp=n=>Math.max(-1,Math.min(1,n));
export function newGame(seed=1){return {phase:'play',t:0,x:0,y:.35,health:100,metals:0,score:0,collected:[0,0,0],objects:[],spawn:.5,pickup:2,rng:seed>>>0,flash:0};}
function random(g){g.rng=(Math.imul(g.rng,1664525)+1013904223)>>>0;return g.rng/4294967296;}
export const difficulty=t=>({speed:.28+.44*Math.min(1,t/DURATION),interval:.95-.65*Math.min(1,t/DURATION)});
export function step(g,input={}){
 if(g.phase!=='play')return;
 g.x=clamp(g.x+clamp(input.x||0)*STEP*1.6);g.y=clamp(g.y+clamp(input.y||0)*STEP*1.6);
 g.t=Math.min(DURATION,g.t+STEP);g.flash=Math.max(0,g.flash-STEP);
 const d=difficulty(g.t);
 const spawn=(kind,metal=0)=>g.objects.push({kind,metal,x:random(g)*1.9-.95,y:random(g)*1.9-.95,depth:0,spin:random(g)*Math.PI*2,checked:false});
 g.spawn-=STEP;if(g.spawn<=0){spawn('meteor');g.spawn+=d.interval;}
 g.pickup-=STEP;if(g.pickup<=0){const r=random(g);spawn('metal',r<.04?2:r<.24?1:0);g.pickup+=3.2;}
 for(const o of g.objects){o.depth+=STEP*d.speed;
  if(!o.checked&&o.depth>=1){o.checked=true;
   if(Math.hypot((g.x-o.x)*1.25,g.y-o.y)<(o.kind==='meteor'?.24:.25)){
    if(o.kind==='meteor'){g.health=Math.max(0,g.health-10);g.flash=.22;}else{g.metals+=METALS[o.metal].value;g.collected[o.metal]++;}o.hit=true;
   }
  }
 }
 g.objects=g.objects.filter(o=>o.depth<1.22&&!o.hit);
 if(g.health===0){g.phase='failed';g.score=0;}
 else if(g.t>=DURATION-1e-8){g.t=DURATION;g.phase='landed';g.score=g.metals+g.health*HEALTH_POINTS;}
}
