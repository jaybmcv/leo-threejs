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
