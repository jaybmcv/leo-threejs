// Leo Pinball's shared high scores (walk/pinball, from tester feedback), for Leo live: one best score per Discord-
// verified player, kept in a file of its own beside this checkout (LEO_LIVE_PINBALL overrides it). Anyone can play and
// read the board; only a player signed in through The Creamery with a checked Leo pass can post, and who they are comes
// from that pass, never from the page.
// A ranked game is the server's from start to end. At the machine the page asks for a ticket, which gives the game's
// seed and starts the server's clock. At game over the page sends what its buttons did, step by step
// (pinball/replay.js), and the server plays the game again from that seed with the same rules (pinball/rules.js). The
// score its own replay reaches is the one kept, and only when it is the score the page says, the game ends on its last
// step, and the clock has run at least as long as the game. A ticket is good for one game, for the account it was given
// to, for TICKET_MS; asking for another drops the last.
// One message, 'pinball', with an op:
//   board    the top ten and this player's best
//   ticket   a ranked game: {op:'ticket', ok:true, id, seed}, or {ok:false, why:'sign-in'|'away'}
//   part     {t, i, d}: the i-th piece of the game's button log (a message holds 1 KB at most)
//   finish   {t, n, steps, score}: the game is over, its log sent in n pieces
// Answers: {m:'pinball', op:'board', verified, top:[{name,score}], you:{score,rank}|null} and {m:'pinball', op:'result',
// ok:true, score, best, rank, newBest} or {ok:false, why:'sign-in'|'rejected'|'used'}. Everyone aboard hears
// {op:'top', top} when the top ten changes. Names are the players' names aboard; account ids stay in the file.
import fs from 'node:fs';
import {randomBytes,randomInt} from 'node:crypto';
import {replay,MOST_STEPS,LOG_MOST} from '../src/walk/pinball/replay.js';
import {STEP} from '../src/walk/pinball/rules.js';
import {pinballSpot} from '../src/walk/pinball/place.js';

// A ticket is given only to a player at the machine: their last pose within 3 m of where a player stands to play.
// (Kept here rather than in live-spatial.js, as the maze keeps its own, so the live layout identity is unchanged.)
const SPOT=pinballSpot(),atMachine=p=>!!p&&Math.abs(p[1]-SPOT[1])<2&&Math.hypot(p[0]-SPOT[0],p[2]-SPOT[2])<3;
const TICKET_MS=3*3600*1000,TICKETS_MOST=5000,USED_MOST=20000,PART_MOST=1000,SLACK_MS=500;
// Each visitor's allowances, [refill per second, burst]: asks, and the pieces of a log (a long game's log is ~60).
const RATE=[1,6],PARTS=[40,160];

export function createPinballBoard({log,send,everyone,file=process.env.LEO_LIVE_PINBALL||new URL('../../leo-live-pinball.json',import.meta.url)}){
 const best=new Map(),tickets=new Map(),open=new Map(),used=new Set(),buckets=new WeakMap();
 try{for(const e of JSON.parse(fs.readFileSync(file,'utf8')))if(e&&typeof e.id==='string'&&Number.isInteger(e.score)&&e.score>0)best.set(e.id,e);}catch{}
 let saving=null;
 const save=()=>{if(saving)return;saving=setTimeout(()=>{saving=null;fs.writeFile(file,JSON.stringify([...best.values()],null,1),e=>{if(e)log('pinball scores not saved',e.message);});},1000);};
 const ranked=()=>[...best.values()].sort((a,b)=>b.score-a.score||a.at.localeCompare(b.at));
 const top=()=>ranked().slice(0,10).map(e=>({name:e.name,score:e.score}));
 // A Discord account checked by its pass; an Otherside visitor's (glyph) is taken on the page's word, so it can't post.
 const account=v=>v.discord&&!v.discord.glyph?v.discord.discordId:null;
 const reply=(v,msg)=>send(v.ws,{m:'pinball',...msg});
 function allowed(v,kind,[rate,burst]){const now=Date.now(),all=buckets.get(v)||{},b=all[kind]||(all[kind]={tokens:burst,at:now});buckets.set(v,all);
  b.tokens=Math.min(burst,b.tokens+(now-b.at)/1000*rate);b.at=now;if(b.tokens<1)return false;b.tokens-=1;return true;}
 function boardFor(v){const all=ranked(),id=account(v),mine=id?best.get(id):null;
  return {op:'board',verified:!!id,top:top(),you:mine?{score:mine.score,rank:all.indexOf(mine)+1}:null};}
 function drop(t){const k=tickets.get(t);if(!k)return;tickets.delete(t);if(open.get(k.account)===t)open.delete(k.account);}
 function ticket(v){
  const id=account(v);if(!id)return reply(v,{op:'ticket',ok:false,why:'sign-in'});
  if(!atMachine(v.pos))return reply(v,{op:'ticket',ok:false,why:'away'});
  const now=Date.now();drop(open.get(id));
  for(const [t,k] of tickets){if(tickets.size<TICKETS_MOST&&k.at+TICKET_MS>now)break;drop(t);}
  const t=randomBytes(12).toString('base64url'),seed=1+randomInt(2**31-2);
  tickets.set(t,{account:id,seed,at:now,parts:[],size:0,bad:false});open.set(id,t);
  reply(v,{op:'ticket',ok:true,id:t,seed});
 }
 function part(v,msg){
  const k=tickets.get(msg.t);if(!k||k.account!==account(v))return;
  if(msg.i!==k.parts.length||typeof msg.d!=='string'||msg.d.length>PART_MOST||k.size+msg.d.length>LOG_MOST){k.bad=true;return;}
  k.parts.push(msg.d);k.size+=msg.d.length;
 }
 // Replays one at a time, a slice at a time, between the server's other work.
 let queue=Promise.resolve();
 const pause=()=>new Promise(r=>setImmediate(r));
 function finish(v,msg){
  const id=account(v);if(!id)return reply(v,{op:'result',ok:false,why:'sign-in'});
  const t=msg.t,k=tickets.get(t);
  if(!k||k.account!==id){
   const why=used.has(t)?'used':'rejected';log('pinball refused',`discord:${id}`,k?'(another player’s ticket)':why==='used'?'(ticket already used)':'(no ticket)');
   return reply(v,{op:'result',ok:false,why});}
  drop(t);used.add(t);if(used.size>USED_MOST)used.delete(used.values().next().value);
  const steps=msg.steps,score=msg.score,elapsed=Date.now()-k.at;
  const why=k.at+TICKET_MS<Date.now()?'ticket ran out':k.bad||msg.n!==k.parts.length?'log incomplete':!Number.isInteger(score)||score<0?'bad score':
   !Number.isInteger(steps)||steps<1||steps>MOST_STEPS?'bad length':elapsed+SLACK_MS<steps*STEP*1000?`faster than the clock (${(steps*STEP).toFixed(0)} s in ${(elapsed/1000).toFixed(0)} s)`:null;
  if(why){log('pinball refused',`discord:${id}`,score,why);return reply(v,{op:'result',ok:false,why:'rejected'});}
  queue=queue.then(()=>replay(k.seed,k.parts.join(''),steps,{pause})).then(r=>{
   if(!r||r.score!==score){log('pinball refused',`discord:${id}`,score,r?`(the replay scored ${r.score})`:'(the replay does not end there)');return reply(v,{op:'result',ok:false,why:'rejected'});}
   const had=best.get(id),newBest=score>0&&(!had||score>had.score),before=JSON.stringify(top());
   if(newBest){best.set(id,{id,name:v.name||'Voyager',score,at:new Date().toISOString()});save();}
   else if(had&&v.name&&had.name!==v.name){had.name=v.name;save();}
   const mine=best.get(id),all=ranked();log('pinball',`discord:${id}`,v.name||'',score,`${(steps*STEP).toFixed(0)}s`,newBest?'(best)':'');
   reply(v,{op:'result',ok:true,score,best:mine?.score??null,rank:mine?all.indexOf(mine)+1:null,newBest});
   const now=top();if(JSON.stringify(now)!==before)for(const o of everyone())if(o.ready)send(o.ws,{m:'pinball',op:'top',top:now});
  }).catch(e=>{log('pinball replay failed',e?.message);reply(v,{op:'result',ok:false,why:'rejected'});});
 }
 return {
  message(v,msg){
   if(msg.op==='part'){if(allowed(v,'part',PARTS))part(v,msg);else{const k=tickets.get(msg.t);if(k&&k.account===account(v))k.bad=true;}return;}
   if(!allowed(v,'ask',RATE))return;
   if(msg.op==='board')reply(v,boardFor(v));
   else if(msg.op==='ticket')ticket(v);
   else if(msg.op==='finish')finish(v,msg);
  },
 };
}
