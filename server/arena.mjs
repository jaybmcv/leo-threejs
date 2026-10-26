// Mudwater Arena's server side (MUDWATER_ARENA.md): the booster pack giveaway at its counter, and counts of how the arena
// is used, for reporting back to BAYC. Leo live (leo-live.mjs) passes the arena's messages here.
//
// The giveaway is switched on and set up by editing one file beside this checkout (LEO_LIVE_GIVEAWAY, default
// ../../leo-live-giveaway.json); it is read again whenever it changes, so no restart is needed. Without the file, or with
// "open": false, the counter's card says details are coming. The file:
//   {"open":true, "mode":"codes", "title":"Booster pack giveaway", "note":"One pack per Voyager while they last.",
//    "limit":100, "codes":["…"], "formUrl":"https://…"}
// Modes, each one claim per Discord-verified visitor (a Leo pass from The Creamery):
//   codes   hands out the next unused code from "codes", and shows it to them again whenever they come back
//   wallet  records one of the wallets The Creamery has verified for them, for packs to be sent to
//   list    records their name, for packs to be arranged some other way
//   form    claims nothing here: the card opens "formUrl" (anyone may follow it)
// "limit" (optional) caps the claims; codes also run out with the list. Claims are kept in a second file
// (LEO_LIVE_GIVEAWAY_CLAIMS, default ../../leo-live-giveaway-claims.json): Discord id, name, when, and the code or
// wallet given. That file has personal data and stays on the server's computer.
//
// The counts (LEO_LIVE_ARENA_STATS, default ../../leo-live-arena-stats.json, and GET /arena on the server) are per day:
// visits (walkers coming in), visitors (different ones that day), game opens (Play Mudwater), giveaway card opens and
// claims. Totals only: no names, ids or wallets. Visitors are told apart by their browser's id in memory only, so a
// restart in the middle of a day can count someone twice.
import fs from 'node:fs';

const here=name=>new URL('../../'+name,import.meta.url);
const MODES=['codes','wallet','list','form'],EVENTS={enter:'visits',play:'plays',card:'cards'};
const WALLET=/^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
// One write at a time, a second after the last change.
function saver(file,data,log){let t=null;return ()=>{if(t)return;t=setTimeout(()=>{t=null;fs.writeFile(file,JSON.stringify(data(),null,1),e=>{if(e)log('not saved',String(file),e.message);});},1000);};}

// The giveaway file, made safe: anything missing or malformed leaves it closed.
export function readGiveaway(raw){
 const g=raw&&typeof raw==='object'?raw:{};
 const mode=MODES.includes(g.mode)?g.mode:null,text=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
 const formUrl=typeof g.formUrl==='string'&&/^https:\/\/[^\s"<>]{3,300}$/.test(g.formUrl)?g.formUrl:null;
 const codes=Array.isArray(g.codes)?[...new Set(g.codes.filter(c=>typeof c==='string'&&/^[\w-]{4,64}$/.test(c)))]:[];
 const open=g.open===true&&!!mode&&(mode!=='form'||!!formUrl)&&(mode!=='codes'||codes.length>0);
 return {open,mode,title:text(g.title,60)||'Booster pack giveaway',note:text(g.note,240),limit:Number.isInteger(g.limit)&&g.limit>0?g.limit:null,codes,formUrl};
}

// `files`: {giveaway, claims, stats} paths (tests pass their own); `today()`: the day's key (tests pass their own).
export function createArena({log=()=>{},files={},today=()=>new Date().toISOString().slice(0,10),watch=true}={}){
 const GIVEAWAY=files.giveaway||process.env.LEO_LIVE_GIVEAWAY||here('leo-live-giveaway.json');
 const CLAIMS=files.claims||process.env.LEO_LIVE_GIVEAWAY_CLAIMS||here('leo-live-giveaway-claims.json');
 const STATS=files.stats||process.env.LEO_LIVE_ARENA_STATS||here('leo-live-arena-stats.json');
 let giveaway=readGiveaway(readJson(GIVEAWAY,null));
 const claims=new Map(Object.entries(readJson(CLAIMS,{})).filter(([,c])=>c&&typeof c==='object'));
 const stats=readJson(STATS,{days:{}});if(!stats.days||typeof stats.days!=='object')stats.days={};
 const saveClaims=saver(CLAIMS,()=>Object.fromEntries(claims),log),saveStats=saver(STATS,()=>stats,log);
 const seenToday={day:null,ids:new Set()};
 if(watch)fs.watchFile(GIVEAWAY,{interval:2000},()=>{const was=giveaway.open;giveaway=readGiveaway(readJson(GIVEAWAY,null));log('giveaway',giveaway.open?`open (${giveaway.mode})`:'closed',was!==giveaway.open?'(changed)':'');});
 log('giveaway',giveaway.open?`open (${giveaway.mode})`:'closed');

 function day(){const k=today();return stats.days[k]||(stats.days[k]={visits:0,visitors:0,plays:0,cards:0,claims:0});}
 function count(field,n=1){day()[field]+=n;saveStats();}
 const used=()=>new Set([...claims.values()].map(c=>c.code).filter(Boolean));
 const left=()=>{const g=giveaway;let n=g.limit?g.limit-claims.size:Infinity;if(g.mode==='codes'){const u=used();n=Math.min(n,g.codes.filter(c=>!u.has(c)).length);}return n;};
 // What a visitor's card shows: the giveaway's state and, for the signed-in, their own claim and verified wallets.
 function statusFor(v){
  const g=giveaway,mine=v.discord?claims.get(v.discord.discordId):null;
  if(!g.open)return {m:'giveaway',open:false};
  return {m:'giveaway',open:true,mode:g.mode,title:g.title,note:g.note,formUrl:g.mode==='form'?g.formUrl:undefined,
   // A remembered visitor (a lapsed pass: leo-live.mjs) is asked to connect again: claims want fresh wallets.
   verified:!!v.discord&&!v.discord.lapsed,remembered:!!v.discord?.lapsed,wallets:v.discord&&!v.discord.lapsed?(v.discord.wallets||[]).filter(w=>WALLET.test(w)).slice(0,6):[],
   claim:mine?{code:mine.code,wallet:mine.wallet,at:mine.at}:null,soldOut:g.mode!=='form'&&!mine&&left()<=0};
 }
 function claim(v,msg){
  const g=giveaway,reply=r=>({m:'claimed',...r});
  if(!g.open||g.mode==='form')return reply({ok:false,why:'closed'});
  if(!v.discord||v.discord.lapsed)return reply({ok:false,why:'sign-in'});
  const id=v.discord.discordId,had=claims.get(id);
  if(had)return reply({ok:true,again:true,code:had.code,wallet:had.wallet});
  if(left()<=0)return reply({ok:false,why:'sold-out'});
  const entry={name:v.name||'',username:v.discord.username||'',at:new Date().toISOString()};
  if(g.mode==='codes'){const u=used();entry.code=g.codes.find(c=>!u.has(c));}
  if(g.mode==='wallet'){
   const wallets=(v.discord.wallets||[]).filter(w=>WALLET.test(w)),want=typeof msg.wallet==='string'?msg.wallet:wallets[0];
   if(!wallets.length)return reply({ok:false,why:'no-wallet'});
   if(!wallets.includes(want))return reply({ok:false,why:'wallet'});
   entry.wallet=want;
  }
  claims.set(id,entry);saveClaims();count('claims');
  log('giveaway claim',`discord:${id}`,entry.name,g.mode,entry.code?'(code given)':entry.wallet||'');
  return reply({ok:true,code:entry.code,wallet:entry.wallet});
 }
 // A visitor's arena event: walked in, opened the game, opened the giveaway card.
 function event(v,e){
  const field=EVENTS[e];if(!field)return;
  count(field);
  if(e==='enter'){const k=today();if(seenToday.day!==k){seenToday.day=k;seenToday.ids.clear();}if(v.id&&!seenToday.ids.has(v.id)){seenToday.ids.add(v.id);count('visitors');}}
 }
 // The counts for GET /arena: every day kept, and the totals.
 function report(){
  const total={visits:0,plays:0,cards:0,claims:0};for(const d of Object.values(stats.days))for(const k in total)total[k]+=d[k]||0;
  return {days:stats.days,total,giveaway:{open:giveaway.open,mode:giveaway.mode,claimed:claims.size}};
 }
 return {statusFor,claim,event,report,get giveaway(){return giveaway;},stop(){fs.unwatchFile(GIVEAWAY);}};
}
