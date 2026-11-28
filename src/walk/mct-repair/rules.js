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
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n)),unit=n=>clamp(n,0,1);
// Most pieces share loose clumps; the rest spread out across the bench.
export function scatterPile(count,random=Math.random){
 const clumps=Array.from({length:4},()=>({x:.12+random()*.76,y:.18+random()*.64}));
 return Array.from({length:count},()=>{
  const c=clumps[Math.floor(random()*clumps.length)],clustered=random()<.65;
  return {x:unit(clustered?c.x+(random()+random()-1)*.24:random()),y:unit(clustered?c.y+(random()+random()-1)*.34:random()),angle:(random()-.5)*320};
 });
}
export function pileMetrics(width,height,count){
 const preferred=Math.min(Math.sqrt(width*height/Math.max(1,count))*1.35,width/3,height/2);
 const edge=Math.min(width,height)/2,size=Math.min(Math.max(52,preferred),Math.max(0,edge-3)*Math.SQRT2);
 // Leave room for every rotated corner and the focus outline.
 const inset=Math.min(edge,size/Math.SQRT2+3);
 return {size,inset,spanX:Math.max(0,width-2*inset),spanY:Math.max(0,height-2*inset)};
}
export function pilePosition(point,metrics){return {x:metrics.inset+unit(point.x)*metrics.spanX,y:metrics.inset+unit(point.y)*metrics.spanY};}
export function pileDrop(x,y,metrics){return {x:metrics.spanX?unit((x-metrics.inset)/metrics.spanX):.5,y:metrics.spanY?unit((y-metrics.inset)/metrics.spanY):.5};}
export function floatingPosition(home,{inset,spanX,spanY},motion){
 return {x:clamp(home.x+motion.x,inset,inset+spanX),y:clamp(home.y+motion.y,inset,inset+spanY)};
}
// Push away from the nearest point on the pointer's path. A press is a path of length zero.
export function pushPileMotion(motion,point,from,to,radius,power){
 const dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
 const t=length?unit(((point.x-from.x)*dx+(point.y-from.y)*dy)/length):0;
 const x=point.x-from.x-dx*t,y=point.y-from.y-dy*t,distance=Math.hypot(x,y);
 if(distance>=radius)return motion;
 const force=power*(1-distance/radius)**2;
 return {...motion,vx:motion.vx+force*(distance?x/distance:Math.cos(motion.phase)),vy:motion.vy+force*(distance?y/distance:Math.sin(motion.phase))};
}
function floatAxis(position,home,velocity,min,span,wave,dt,reduced){
 const max=min+span,amplitude=reduced?0:Math.min(11,span/2);
 const target=clamp(home,min+amplitude,max-amplitude)+wave*amplitude;
 velocity=clamp((velocity+(target-position)*(reduced?5:2.5)*dt)*Math.exp(-(reduced?8:3.5)*dt),reduced?-40:-160,reduced?40:160);
 // Slow down on approach to the edge, then let the pull toward the anchor turn the piece back.
 velocity*=unit((velocity<0?position-min:max-position)/18);
 return [clamp(position+velocity*dt,min,max)-home,velocity];
}
export function stepPileMotion(motion,home,metrics,dt,time,reduced){
 const p=floatingPosition(home,metrics,motion),{phase,vx,vy}=motion,{inset,spanX,spanY}=metrics;
 const [x,nextX]=floatAxis(p.x,home.x,vx,inset,spanX,Math.sin(time*.66+phase),dt,reduced);
 const [y,nextY]=floatAxis(p.y,home.y,vy,inset,spanY,Math.cos(time*.83+phase*1.7),dt,reduced);
 return {x,y,vx:nextX,vy:nextY,phase};
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
