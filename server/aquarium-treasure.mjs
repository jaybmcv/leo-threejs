import fs from 'node:fs';
import {SWIM,swimLocal,distance,limitSwim,gemNear} from '../src/walk/aquarium-treasure/layout.js';

// A best swim per signed-in visitor, in a file of its own like the Container Maze's board.
// Poses must visit all seven gems, stay inside the water and travel at swimming speed before the chest can finish.
export function createTreasureBoard({send,log,file=process.env.LEO_LIVE_TREASURE||new URL('../../leo-live-treasure.json',import.meta.url),now=Date.now}){
 const best=new Map(),runs=new WeakMap(),buckets=new WeakMap();let saving=null;
 try{for(const e of JSON.parse(fs.readFileSync(file,'utf8')))if(e&&typeof e.id==='string'&&typeof e.name==='string'&&typeof e.at==='string'&&Number.isInteger(e.ms)&&e.ms>0)best.set(e.id,e);}catch{}
 const ranked=()=>[...best.values()].sort((a,b)=>a.ms-b.ms||a.at.localeCompare(b.at));
 function save(){if(saving)return;saving=setTimeout(()=>{saving=null;fs.writeFile(file,JSON.stringify([...best.values()],null,1),e=>{if(e)log('aquarium times not saved',e.message);});},1000);}
 function reply(v,msg){send(v.ws,{m:'treasure',...msg});}
 function board(v){const all=ranked(),mine=v.discord?best.get(v.discord.discordId):null;
  reply(v,{op:'board',verified:!!v.discord,top:all.slice(0,10).map(e=>({name:e.name,ms:e.ms})),you:mine?{ms:mine.ms,rank:all.indexOf(mine)+1}:null});}
 function observe(v){
  const run=runs.get(v);if(!run||!v.pos)return;
  const at=now(),q=swimLocal(v.pos),dt=Math.max(0,at-run.lastAt)/1000,d=distance(q,run.last);
  run.budget=Math.min(3,run.budget+dt*SWIM.speed*1.15);
  if(at-run.at>30*60*1000||distance(q,limitSwim(q))>.35||d>run.budget+.25){runs.delete(v);return;}
  run.budget-=d;
  // Samples between poses catch a gem even when a frame crossed its edge between two network updates.
  const n=Math.max(1,Math.ceil(d/.25));
  for(let k=1;k<=n;k++){
   const p=q.map((x,i)=>run.last[i]+(x-run.last[i])*k/n);
   if(distance(p,limitSwim(p))>.35){runs.delete(v);return;}
   SWIM.gems.forEach((g,i)=>{if(gemNear(p,g,SWIM.reach+.25))run.found.add(i);});
  }
  run.last=q;run.lastAt=at;
 }
 function finish(v,msg){
  observe(v);const run=runs.get(v);runs.delete(v);
  if(!v.discord){reply(v,{op:'result',ok:false,why:'sign-in'});return;}
  const elapsed=run?now()-run.at:0,ms=msg.ms;
  if(!run||run.found.size!==7||!Number.isInteger(ms)||ms<1000||ms>elapsed+2000||ms<elapsed-3000||!v.pos||distance(swimLocal(v.pos),SWIM.chest)>2.4){
   reply(v,{op:'result',ok:false,why:'rejected'});return;}
  const id=v.discord.discordId,had=best.get(id),newBest=!had||ms<had.ms;
  if(newBest){best.set(id,{id,name:v.name||'Voyager',ms,at:new Date(now()).toISOString()});save();}
  else if(v.name&&had.name!==v.name){had.name=v.name;save();}
  const mine=best.get(id);log('aquarium swim',`discord:${id}`,(ms/1000).toFixed(1)+'s',newBest?'(best)':'');
  reply(v,{op:'result',ok:true,ms,best:mine.ms,rank:ranked().indexOf(mine)+1,newBest});
 }
 return {observe,
  message(v,msg){
   const at=now(),bucket=buckets.get(v)||{at,tokens:6};bucket.tokens=Math.min(6,bucket.tokens+(at-bucket.at)/1000*2);bucket.at=at;buckets.set(v,bucket);
   if(bucket.tokens<1)return;bucket.tokens--;
   if(msg.op==='start'){
    runs.delete(v);if(v.pos&&distance(swimLocal(v.pos),SWIM.door)<3)runs.set(v,{at,lastAt:at,last:[...SWIM.entry],budget:1.5,found:new Set()});
   }else if(msg.op==='cancel')runs.delete(v);
   else if(msg.op==='finish')finish(v,msg);
   else if(msg.op==='board')board(v);
  },
 };
}
