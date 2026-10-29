// The Container Maze's best times (walk/maze, CONTAINER_MAZE.md), for Leo live: one fastest run per Discord-verified
// player, kept in a file of its own beside this checkout (LEO_LIVE_MAZE overrides it), as Paw Pool keeps its clears.
// One message, 'maze', with an op:
//   start   a run begins: the walker is at the way in (their last pose within 8 m of the start line). The server
//           starts its own clock.
//   finish  the button is pressed, {ms} by the page's clock: the walker must be at the button (within 4 m). The
//           page's time is kept when it agrees with the server's: never more than 3 s under it, nor more than 2 s
//           over. A run faster than MAZE_FASTEST_S (the way at a sprint, corners cut) is refused by either clock.
//   board   the top ten and this visitor's best.
// Answers: {m:'maze', op:'board', verified, top:[{name,ms}], you:{ms,rank}|null} and {m:'maze', op:'result', ok,
// ms, best, rank, newBest} or {m:'maze', op:'result', ok:false, why:'sign-in'|'rejected'}. Guests can run and read the
// board; only verified players' times are kept.
import fs from 'node:fs';
import {MAZE_ROOM,MAZE_START,MAZE_BUTTON,MAZE_FASTEST_S} from '../src/walk/maze/layout.js';
import {toWorld} from '../src/plan/rooms.js';

const START=toWorld(MAZE_ROOM,MAZE_START),BUTTON=toWorld(MAZE_ROOM,MAZE_BUTTON);
const near=(p,at,r)=>!!p&&Math.abs(p[1]-at[1])<2&&Math.hypot(p[0]-at[0],p[2]-at[2])<r;
// Each visitor's own allowance: [refill per second, burst].
const RATE=[1,5];

export function createMazeBoard({log,send,file=process.env.LEO_LIVE_MAZE||new URL('../../leo-live-maze.json',import.meta.url)}){
 const best=new Map(),runs=new WeakMap(),buckets=new WeakMap();
 try{for(const e of JSON.parse(fs.readFileSync(file,'utf8')))if(e&&typeof e.id==='string'&&Number.isInteger(e.ms))best.set(e.id,e);}catch{}
 let saving=null;
 const save=()=>{if(saving)return;saving=setTimeout(()=>{saving=null;fs.writeFile(file,JSON.stringify([...best.values()],null,1),e=>{if(e)log('maze times not saved',e.message);});},1000);};
 const ranked=()=>[...best.values()].sort((a,b)=>a.ms-b.ms||a.at.localeCompare(b.at));
 function allowed(v){const now=Date.now(),b=buckets.get(v)||{tokens:RATE[1],at:now};b.tokens=Math.min(RATE[1],b.tokens+(now-b.at)/1000*RATE[0]);b.at=now;buckets.set(v,b);
  if(b.tokens<1)return false;b.tokens-=1;return true;}
 function boardFor(v){const all=ranked(),mine=v.discord?best.get(v.discord.discordId):null;
  return {m:'maze',op:'board',verified:!!v.discord,top:all.slice(0,10).map(e=>({name:e.name,ms:e.ms})),you:mine?{ms:mine.ms,rank:all.indexOf(mine)+1}:null};}
 function finish(v,msg){
  const run=runs.get(v);runs.delete(v);
  if(!v.discord){send(v.ws,{m:'maze',op:'result',ok:false,why:'sign-in'});return;}
  const elapsed=run?Date.now()-run.at:0,said=msg.ms,floor=MAZE_FASTEST_S*1000;
  if(!run||!Number.isInteger(said)||said<floor||elapsed<floor||said>elapsed+2000||!near(v.pos,BUTTON,4)){
   log('maze run refused',`discord:${v.discord.discordId}`,said,Math.round(elapsed/1000)+'s',run?'':'(no start)',near(v.pos,BUTTON,4)?'':'(not at the button)');
   send(v.ws,{m:'maze',op:'result',ok:false,why:'rejected'});return;}
  const ms=Math.max(said,elapsed-3000),id=v.discord.discordId,had=best.get(id),newBest=!had||ms<had.ms;
  if(newBest){best.set(id,{id,name:v.name||'Voyager',ms,at:new Date().toISOString()});save();}
  else if(had.name!==v.name&&v.name){had.name=v.name;save();}
  const mine=best.get(id);log('maze run',`discord:${id}`,v.name||'',(ms/1000).toFixed(1)+'s',newBest?'(best)':'');
  send(v.ws,{m:'maze',op:'result',ok:true,ms,best:mine.ms,rank:ranked().indexOf(mine)+1,newBest});
 }
 return {
  message(v,msg){
   if(!allowed(v))return;
   if(msg.op==='start'){if(near(v.pos,START,8))runs.set(v,{at:Date.now()});else runs.delete(v);}
   else if(msg.op==='finish')finish(v,msg);
   else if(msg.op==='board')send(v.ws,boardFor(v));
  },
 };
}
