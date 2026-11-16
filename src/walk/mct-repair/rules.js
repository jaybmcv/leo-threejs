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
 return shuffled([...ids,...shuffled(PARTS.filter(p=>!ids.includes(p.id)),random).slice(0,8).map(p=>p.id),...Array.from({length:count},(_,i)=>JUNK[i%JUNK.length])],random);
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

// Gentle drift stays near each starting slot so required parts remain easy to find.
export const floatingPart=(x,y,w,h,index=0)=>({x,y,w,h,ax:x,ay:y,vx:0,vy:0,time:index*2.399});
export function boundPart(p,width,height){
 const mx=Math.max(0,width-p.w),my=Math.max(0,height-p.h);
 if(p.x<0||p.x>mx){p.x=Math.max(0,Math.min(mx,p.x));p.vx*= -.35;}
 if(p.y<0||p.y>my){p.y=Math.max(0,Math.min(my,p.y));p.vy*= -.35;}
}
export function pushPart(p,x,y,reduced=false){
 const dx=p.x+p.w/2-x,dy=p.y+p.h/2-y,d=Math.hypot(dx,dy),radius=140;
 if(d<1||d>=radius)return;
 const force=(reduced?18:80)*(1-d/radius);
 p.vx+=dx/d*force;p.vy+=dy/d*force;
 const speed=Math.hypot(p.vx,p.vy),limit=reduced?22:100;
 if(speed>limit){p.vx*=limit/speed;p.vy*=limit/speed;}
}
export function floatPart(p,width,height,dt,{held=false,reduced=false}={}){
 dt=Math.max(0,Math.min(.05,dt));p.time+=dt;
 if(held){p.vx=p.vy=0;boundPart(p,width,height);return;}
 if(!reduced){p.vx+=(Math.sin(p.time*.7)*9+(p.ax-p.x)*1.2)*dt;p.vy+=(Math.cos(p.time*.6)*8+(p.ay-p.y)*1.2)*dt;}
 const damping=Math.exp(-(reduced?10:3)*dt);p.vx*=damping;p.vy*=damping;
 if(reduced&&Math.hypot(p.vx,p.vy)<.05)p.vx=p.vy=0;
 p.x+=p.vx*dt;p.y+=p.vy*dt;boundPart(p,width,height);
}
