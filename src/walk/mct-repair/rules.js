import {PARTS,PUZZLES,JUNK} from './catalog.js';

export const VIEWS=['front','side','rear','top'];
export const formatTime=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const shuffled=(items,random)=>items.map(value=>({value,key:random()})).sort((a,b)=>a.key-b.key).map(a=>a.value);
export function newRepair(random=Math.random){
 const rounds=[4,8,12].map(count=>{const choices=PUZZLES.filter(p=>p.count===count);return choices[Math.floor(random()*choices.length)];});
 return {rounds,current:0,score:0,elapsed:0,view:'side',placed:new Set(),phase:'play'};
}
export const required=g=>g.rounds[g.current].parts.map(id=>PARTS.find(p=>p.id===id));
export function workbench(g,width,height,random=Math.random){
 const ids=g.rounds[g.current].parts,scale=Math.min(2.2,Math.max(1,width*height/(1920*1080))),count=Math.round((28+g.current*4)*scale);
 // Sample the larger junk catalog without adding more clutter. Large benches reuse a shuffled cycle.
 const junk=shuffled(JUNK,random);
 return shuffled([...ids,...shuffled(PARTS.filter(p=>!ids.includes(p.id)),random).slice(0,8).map(p=>p.id),...Array.from({length:count},(_,i)=>junk[i%junk.length])],random);
}
const unit=n=>Math.max(0,Math.min(1,n));
// Most pieces share loose clumps; the rest spread out across the bench.
export function scatterPile(count,random=Math.random){
 const clumps=Array.from({length:4},()=>({x:.12+random()*.76,y:.18+random()*.64}));
 return Array.from({length:count},()=>{
  const c=clumps[Math.floor(random()*clumps.length)],clustered=random()<.65;
  return {x:unit(clustered?c.x+(random()+random()-1)*.24:random()),y:unit(clustered?c.y+(random()+random()-1)*.34:random()),angle:(random()-.5)*320};
 });
}
export function pileMetrics(width,height,count){
 const size=Math.max(52,Math.min(Math.sqrt(width*height/Math.max(1,count))*1.35,width/3,height/2));
 // Leave room for every rotated corner and the focus outline.
 const inset=size/Math.SQRT2+3;
 return {size,inset,spanX:Math.max(0,width-2*inset),spanY:Math.max(0,height-2*inset)};
}
export function pilePosition(point,metrics){return {x:metrics.inset+unit(point.x)*metrics.spanX,y:metrics.inset+unit(point.y)*metrics.spanY};}
export function pileDrop(x,y,metrics){return {x:metrics.spanX?unit((x-metrics.inset)/metrics.spanX):.5,y:metrics.spanY?unit((y-metrics.inset)/metrics.spanY):.5};}
export function pileMotion(point,index=0){return {...point,vx:0,vy:0,phase:index*2.399963};}
// Velocities are pixels per second, so small benches float at the same gentle pace.
export function pushPile(point,pointer,metrics,reduced=false){
 const p=pilePosition(point,metrics),dx=p.x-pointer.x,dy=p.y-pointer.y,d=Math.hypot(dx,dy),radius=Math.max(90,metrics.size*1.6);
 if(d<.001||d>=radius)return {...point};
 const strength=(reduced?14:65)*(1-d/radius)**2,limit=reduced?18:80;
 let vx=point.vx+dx/d*strength,vy=point.vy+dy/d*strength;const speed=Math.hypot(vx,vy);
 if(speed>limit){vx*=limit/speed;vy*=limit/speed;}
 return {...point,vx,vy};
}
export function stepPile(point,metrics,seconds,time,{held=false,reduced=false}={}){
 if(held)return {...point,vx:0,vy:0};
 const dt=Math.max(0,Math.min(.05,seconds)),decay=Math.exp(-(reduced?8:3.5)*dt),phase=point.phase;
 const idleX=reduced?0:3*Math.sin(time*.37+phase),idleY=reduced?0:2.5*Math.cos(time*.43+phase);
 let vx=idleX+(point.vx-idleX)*decay,vy=idleY+(point.vy-idleY)*decay;
 const p=pilePosition(point,metrics);
 // Steer inward before the edge, then catch even a large push inside the safe inset.
 const steer=(v,pos,span)=>{
  const margin=Math.min(24,span/3);if(!margin)return 0;if(reduced)return v;
  return v+((1-unit(pos/margin))**2-(1-unit((span-pos)/margin))**2)*40*dt;
 };
 vx=steer(vx,p.x-metrics.inset,metrics.spanX);vy=steer(vy,p.y-metrics.inset,metrics.spanY);
 const x=p.x+vx*dt,y=p.y+vy*dt;
 if(x<metrics.inset)vx=Math.abs(vx)*.35;else if(x>metrics.inset+metrics.spanX)vx=-Math.abs(vx)*.35;
 if(y<metrics.inset)vy=Math.abs(vy)*.35;else if(y>metrics.inset+metrics.spanY)vy=-Math.abs(vy)*.35;
 return {...point,...pileDrop(x,y,metrics),vx,vy,angle:point.angle+(reduced?0:Math.sin(time*.29+phase)*1.8*dt)};
}
// A wrong part, view or repeated installation costs nothing and stays on the bench.
export function install(g,id){
 const part=PARTS.find(p=>p.id===id);
 if(g.phase!=='play'||!part||part.view!==g.view||!g.rounds[g.current].parts.includes(id)||g.placed.has(id))return false;
 g.placed.add(id);g.score+=150+Math.max(0,90-g.elapsed);
 if(g.placed.size===g.rounds[g.current].count)g.phase=g.current===2?'complete':'clear';
 return true;
}
export function nextRound(g){if(g.phase!=='clear')return false;g.current++;g.view='side';g.placed.clear();g.phase='play';return true;}
