// Leo live: the multiplayer server for walk mode (src/walk/walk.html). One process is one shuttle: everyone connected
// walks the same Leo. It passes poses and pings on and runs the lifts, nothing else; the ship itself is static and every visitor
// builds it in their own browser. Modelled on Voyager's Reach's authority (packages/server: pose fan-out by distance,
// poses as bytes, the visitor's id proved by a key their browser keeps), cut down to what a walk needs.
//
//   node server/leo-live.mjs          (or npm run live)
//   PORT=8090                         where it listens; the websocket is at /live, a health check at /health
//   LEO_LIVE_MAX=150                  most visitors at once; the next is told the ship is full
//   LEO_LIVE_ORIGINS=...              pages allowed to connect, comma separated; a * stands for any port
//   LEO_PASS_JWKS_URL=...             The Creamery's public keys for Leo passes (default: its production keys)
//   LEO_PASS_ISS=...                  the issuer a pass must name (default https://creamery.marscatsvoyage.com)
//   LEO_LIVE_GIVEAWAY=...             Mudwater Arena's giveaway settings, read again when changed (arena.mjs)
//   LEO_LIVE_CHAT=verified            who may chat aboard: verified (Discord-verified visitors; everyone reads), all or off
//   LEO_LIVE_CHAT_LOG=...             where the last 100 chat lines are kept (default ../leo-live-chat.json, beside the checkout)
//
// Who someone is: a visitor who connected Discord through The Creamery brings a Leo pass (src/walk/net/pass.js); the
// server checks it and their name aboard is their Discord name, marked as verified. Anyone else is anonymous, with the
// name they typed. A verified visitor who came by an invite link has the code and who used it written to the log
// (invite records proper will live with The Creamery's members).
//
// Movement is trusted from the client, as in Reach: the server checks that a pose is well formed and inside the ship,
// and limits how often anyone may send. Lifts are the server's: a call goes to the server, which steps every car
// (lift-motion.js) and tells everyone when a car's plans change.
import http from 'node:http';
import fs from 'node:fs';
import {WebSocketServer} from 'ws';
import {LIFTS} from '../src/walk/lifts.js';
import {liftState,callLift,stepLift,liftWire} from '../src/walk/lift-motion.js';
import {encodeRecord,encodeIdentity,assembleFrame,actorIdOf,cleanName,cleanChat,hasLink,PROTOCOL,STANCES} from '../src/walk/net/wire.js';
import {keySet,verifyPass,REMEMBER_S} from '../src/walk/net/pass.js';
import {POOL_FASTEST_S} from '../src/walk/pool/limits.js';
import {createArena} from './arena.mjs';

const PORT=Number(process.env.PORT||8090),MAX=Number(process.env.LEO_LIVE_MAX||150);
const ORIGINS=(process.env.LEO_LIVE_ORIGINS||'https://leo.marscatsvoyage.com,http://localhost:*,http://127.0.0.1:*').split(',').map(o=>o.trim()).filter(Boolean)
 .map(o=>new RegExp('^'+o.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/:\*$/,'(:\\d+)?')+'$'));
const FLUSH_MS=50,FAR_MS=500,KEEPALIVE_MS=2000,HELLO_MS=5000,PING_MS=25000,SLOW_BYTES=256*1024,SLOW_MS=5000;
// Near: on the same or the next deck and within 64 m, every flush; anyone else twice a second.
const NEAR_DY=9,NEAR_M=64;
// The ship's bounds, generously: a pose outside them is not a pose from this page.
const BOUNDS={x:[-400,400],y:[-80,200],z:[-200,200]};
// A pass up to REMEMBER_S past its expiry is a remembered visitor (the page kept it; Creamery's sign-in ran out): their
// name, scores and hearts count, but a giveaway claim wants a fresh one (arena.mjs).
const PASS={iss:process.env.LEO_PASS_ISS||'https://creamery.marscatsvoyage.com',aud:'leo.marscatsvoyage.com',lapsed:REMEMBER_S,
 key:keySet(process.env.LEO_PASS_JWKS_URL||'https://creamery.marscatsvoyage.com/.well-known/leo-pass-keys.json')};
const BUDGETS={pose:[20,25],call:[3,6],name:[.5,3],ping:[1,4],mark:[.25,2],play:[.2,3],score:[.2,3],board:[.5,4],hearts:[.5,4],heart:[1,6],selfie:[.2,2],giveaway:[.5,4],claim:[.2,3],arena:[1,6],chat:[.5,5]};

const visitors=new Set();
const slots=new Map();let nextSlot=1;
const lifts=LIFTS.map(spec=>({spec,stops:spec.stops,state:liftState(spec),sent:''}));
const log=(...a)=>console.log(new Date().toISOString(),...a);
const arena=createArena({log});

function send(ws,msg){if(ws.readyState===1)ws.send(typeof msg==='string'||msg instanceof Uint8Array?msg:JSON.stringify(msg));}
function broadcast(msg,except){const text=JSON.stringify(msg);for(const v of visitors)if(v.ready&&v!==except)send(v.ws,text);}
function takeSlot(){for(let i=0;i<0xffff;i++){const s=nextSlot;nextSlot=nextSlot%0xfffe+1;if(!slots.has(s))return s;}return 0;}
// A token bucket per message kind: [refill per second, burst].
function allowed(v,kind){
 const [rate,burst]=BUDGETS[kind],b=v.budget[kind]||(v.budget[kind]={tokens:burst,at:Date.now()}),now=Date.now();
 b.tokens=Math.min(burst,b.tokens+(now-b.at)/1000*rate);b.at=now;if(b.tokens<1)return false;b.tokens-=1;return true;
}
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
// The pose a client sends, checked and made into one record (encoded once, copied into every frame that carries it).
function readPose(v,p){
 if(!p||!Array.isArray(p.pos)||p.pos.length!==3)return false;
 const [x,y,z]=p.pos;if(!finite(x,...BOUNDS.x)||!finite(y,...BOUNDS.y)||!finite(z,...BOUNDS.z)||!finite(p.yaw,-1e3,1e3))return false;
 const pose={pos:[x,y,z],yaw:p.yaw,grounded:!!p.g,stance:STANCES.includes(p.st)?p.st:'stand',jumpCount:finite(p.jc,0,3)?Math.round(p.jc):0,
  jumpS:finite(p.js,-1,60)?p.js:-1,rise:finite(p.r,-100,100)?p.r:0,emote:typeof p.e==='string'&&/^[a-z0-9_]{1,32}$/.test(p.e)?p.e:null,rest:p.rest==='sit'||p.rest==='lie'?p.rest:null,
  playing:p.pl===true,ball:p.b===true};
 try{v.record=encodeRecord(v.slot,pose);}catch{return false;}
 v.pos=pose.pos;v.version++;return true;
}

// Alien Cat Invasion's leaderboard (walk/invasion): one best score per Discord-verified player, kept in a file beside
// this checkout. A game is timed from its 'play' to its 'score'; a score that is not in tens, or more than the time
// allows (the check's bots score under 15 points a second; 45 a second and a 300-point start is far past any player),
// is refused.
const SCORES=process.env.LEO_LIVE_SCORES||new URL('../../leo-live-scores.json',import.meta.url);
// Paw Pool's fastest clears share the file as a second board: entries marked game 'pool', with a time in ms, no score.
let board=new Map(),pool=new Map();
try{for(const e of JSON.parse(fs.readFileSync(SCORES,'utf8'))){if(!e||typeof e.id!=='string')continue;
 if(e.game==='pool'){if(Number.isInteger(e.ms))pool.set(e.id,e);}else if(Number.isInteger(e.score))board.set(e.id,e);}}catch{}
let saving=null;
function saveBoard(){if(saving)return;saving=setTimeout(()=>{saving=null;fs.writeFile(SCORES,JSON.stringify([...board.values(),...pool.values()],null,1),e=>{if(e)log('scores not saved',e.message);});},1000);}
const ranked=()=>[...board.values()].sort((a,b)=>b.score-a.score||a.at.localeCompare(b.at));
function boardFor(v){
 const all=ranked(),mine=v.discord?board.get(v.discord.discordId):null;
 return {m:'board',verified:!!v.discord,top:all.slice(0,10).map(e=>({name:e.name,score:e.score})),you:mine?{score:mine.score,rank:all.indexOf(mine)+1}:null};
}
function scored(v,msg){
 const game=v.games.invasion;v.games.invasion=null;
 if(!v.discord){send(v.ws,{m:'scored',ok:false,why:'sign-in'});return;}
 const score=msg.score,wave=msg.wave,seconds=game?(Date.now()-game.at)/1000:0;
 if(!game||!Number.isInteger(score)||score<=0||score%10||score>999990||!Number.isInteger(wave)||wave<1||wave>999||score>300+45*seconds||wave>1+seconds/12){
  log('score refused',`discord:${v.discord.discordId}`,score,wave,Math.round(seconds)+'s');send(v.ws,{m:'scored',ok:false,why:'rejected'});return;}
 const id=v.discord.discordId,had=board.get(id),newBest=!had||score>had.score;
 if(newBest){board.set(id,{id,name:v.name||'Voyager',score,wave,at:new Date().toISOString()});saveBoard();}
 else if(had.name!==v.name&&v.name){had.name=v.name;saveBoard();}
 const best=board.get(id);log('score',`discord:${id}`,v.name||'',score,'wave',wave,newBest?'(best)':'');
 send(v.ws,{m:'scored',ok:true,best:best.score,rank:ranked().indexOf(best)+1,newBest});
}

// The ship log boards' hearts (walk/changes-board.js): which changes each Discord-verified visitor has given a heart, one
// per change, kept in a file beside this checkout like the scores. A change is its pull request's number; any number
// is taken, so a new change can have hearts without a restart. Everyone aboard hears the counts when they change.
const HEARTS=process.env.LEO_LIVE_HEARTS||new URL('../../leo-live-hearts.json',import.meta.url),MOST_HEARTS=500;
const hearts=new Map();
try{for(const [id,list] of Object.entries(JSON.parse(fs.readFileSync(HEARTS,'utf8'))))if(Array.isArray(list))hearts.set(id,new Set(list.filter(Number.isInteger)));}catch{}
let savingHearts=null;
function saveHearts(){if(savingHearts)return;savingHearts=setTimeout(()=>{savingHearts=null;fs.writeFile(HEARTS,JSON.stringify(Object.fromEntries([...hearts].map(([id,s])=>[id,[...s]]))),e=>{if(e)log('hearts not saved',e.message);});},1000);}
function heartCounts(){const n=new Map();for(const s of hearts.values())for(const c of s)n.set(c,(n.get(c)||0)+1);return [...n];}
const heartsFor=v=>({m:'hearts',counts:heartCounts(),mine:v.discord?[...(hearts.get(v.discord.discordId)||[])]:[],verified:!!v.discord});
function hearted(v,msg){
 if(!v.discord){send(v.ws,{m:'hearted',ok:false,why:'sign-in'});return;}
 const change=msg.change;if(!Number.isInteger(change)||change<1||change>99999||typeof msg.on!=='boolean')return;
 const id=v.discord.discordId,mine=hearts.get(id)||new Set();
 if(msg.on===mine.has(change)){send(v.ws,heartsFor(v));return;}
 if(msg.on&&mine.size>=MOST_HEARTS){send(v.ws,{m:'hearted',ok:false,why:'too-many'});return;}
 if(msg.on)mine.add(change);else mine.delete(change);
 if(mine.size)hearts.set(id,mine);else hearts.delete(id);saveHearts();
 log('heart',`discord:${id}`,v.name||'',msg.on?'+':'-',change);
 send(v.ws,heartsFor(v));broadcast({m:'hearts',counts:heartCounts()},v);
}

// Paw Pool (walk/pool): one fastest clear of all fifteen balls per Discord-verified player. The server times the game
// from its 'play' to its 'score'. The page's own clock is kept when it agrees: it starts a moment after the server's, so
// it may be a little shorter, but never more than 3 s. A clear under POOL_FASTEST_S, by either clock, is refused.
const poolRanked=()=>[...pool.values()].sort((a,b)=>a.ms-b.ms||a.at.localeCompare(b.at));
function poolBoardFor(v){
 const all=poolRanked(),mine=v.discord?pool.get(v.discord.discordId):null;
 return {m:'board',game:'pool',verified:!!v.discord,top:all.slice(0,10).map(e=>({name:e.name,ms:e.ms})),you:mine?{ms:mine.ms,rank:all.indexOf(mine)+1}:null};
}
function cleared(v,msg){
 const game=v.games.pool;v.games.pool=null;
 if(!v.discord){send(v.ws,{m:'scored',game:'pool',ok:false,why:'sign-in'});return;}
 const elapsed=game?Date.now()-game.at:0,said=msg.ms,shots=msg.shots;
 if(!game||!Number.isInteger(said)||!Number.isInteger(shots)||shots<1||shots>999||said<POOL_FASTEST_S*1000||elapsed<POOL_FASTEST_S*1000||said>elapsed+2000){
  log('pool clear refused',`discord:${v.discord.discordId}`,said,shots,Math.round(elapsed/1000)+'s');send(v.ws,{m:'scored',game:'pool',ok:false,why:'rejected'});return;}
 const ms=Math.max(said,elapsed-3000),id=v.discord.discordId,had=pool.get(id),newBest=!had||ms<had.ms;
 if(newBest){pool.set(id,{game:'pool',id,name:v.name||'Voyager',ms,shots,at:new Date().toISOString()});saveBoard();}
 else if(had.name!==v.name&&v.name){had.name=v.name;saveBoard();}
 const best=pool.get(id);log('pool clear',`discord:${id}`,v.name||'',(ms/1000).toFixed(1)+'s',shots,'shots',newBest?'(best)':'');
 send(v.ws,{m:'scored',game:'pool',ok:true,ms,best:best.ms,rank:poolRanked().indexOf(best)+1,newBest});
}

// The crown lounge's selfie booth (walk/selfie.js): a press at its camera starts one 5-second countdown for everyone
// standing near it, so a group's pages all take the photo together. Kept nowhere; a press while one runs is ignored.
const SELFIE={at:[-265.3,120.3,0],reach:4,near:15,ms:5000};let selfieEnds=0;
const byBooth=(p,m)=>p&&Math.abs(p[1]-SELFIE.at[1])<3&&Math.hypot(p[0]-SELFIE.at[0],p[2]-SELFIE.at[2])<m;
function selfie(v){
 const now=Date.now();if(now<selfieEnds||!byBooth(v.pos,SELFIE.reach))return;
 selfieEnds=now+SELFIE.ms;log('selfie',v.id);
 for(const o of visitors)if(o!==v&&o.ready&&byBooth(o.pos,SELFIE.near))send(o.ws,{m:'selfie',id:v.id,ms:SELFIE.ms});
}

// Chat aboard (walk/chat.js): a line said by one visitor reaches everyone aboard, the sender included, so every page
// shows the same lines in the same order. The last CHAT_KEEP lines, however old, are handed to each newcomer in their
// welcome, so what was said before they came aboard is still there; they are kept in a file beside this checkout (like
// the scores and hearts), so a restart keeps them too. Lines are plain text with no links at all (a link in a crowd that
// holds wallets is how scams start), at most a few every few seconds, and written to the log so they can be looked into.
// Unless LEO_LIVE_CHAT says otherwise, only Discord-verified visitors may speak, so every line has an account behind it;
// everyone aboard reads.
const CHAT=['all','verified','off'].includes(process.env.LEO_LIVE_CHAT)?process.env.LEO_LIVE_CHAT:'verified';
const CHAT_KEEP=100,CHAT_FILE=process.env.LEO_LIVE_CHAT_LOG||new URL('../../leo-live-chat.json',import.meta.url);
const said=[];
try{for(const l of JSON.parse(fs.readFileSync(CHAT_FILE,'utf8'))){const text=cleanChat(l?.text);
 if(text&&typeof l.id==='string'&&Number.isFinite(l.at))said.push({id:l.id,name:typeof l.name==='string'?cleanName(l.name)||null:null,verified:l.verified===true,text,at:l.at});}
 said.splice(0,Math.max(0,said.length-CHAT_KEEP));}catch{}
let savingChat=null;
function saveChat(){if(savingChat)return;savingChat=setTimeout(()=>{savingChat=null;fs.writeFile(CHAT_FILE,JSON.stringify(said),e=>{if(e)log('chat not saved',e.message);});},1000);}
function chat(v,msg){
 const no=why=>send(v.ws,{m:'said',ok:false,why});
 if(CHAT==='off')return no('off');
 if(CHAT==='verified'&&!v.discord)return no('sign-in');
 const text=cleanChat(msg.text);if(!text)return;
 if(!allowed(v,'chat'))return no('slow');
 if(hasLink(text))return no('link');
 // The same line again at once is a stutter, or a flood.
 if(text===v.lastSaid&&Date.now()-v.lastSaidAt<10000)return no('again');
 v.lastSaid=text;v.lastSaidAt=Date.now();
 const line={id:v.id,name:v.name,verified:!!v.discord,text,at:Date.now()};
 said.push(line);if(said.length>CHAT_KEEP)said.shift();saveChat();
 log('chat',v.id,v.discord?`discord:${v.discord.discordId}`:'',JSON.stringify(v.name||''),JSON.stringify(text));
 broadcast({m:'chat',...line});
}

async function hello(v,msg){
 if(msg.v!==PROTOCOL){send(v.ws,{m:'reload'});v.ws.close(4000,'old page');return;}
 const id=await actorIdOf(typeof msg.key==='string'?msg.key:'');
 if(!id){v.ws.close(4001,'no key');return;}
 const who=msg.pass?await verifyPass(msg.pass,PASS).catch(()=>null):null;
 // One body per visitor: the same browser in a second tab, or the same Discord account elsewhere, takes over.
 for(const o of visitors)if(o!==v&&(o.id===id||(who&&o.discord?.discordId===who.discordId))){send(o.ws,{m:'replaced'});o.ws.close(4002,'replaced');leave(o);}
 if([...visitors].filter(o=>o.ready).length>=MAX){send(v.ws,{m:'full'});v.ws.close(4003,'full');return;}
 v.slot=takeSlot();if(!v.slot){v.ws.close(4003,'full');return;}
 // A tester (the page holds a tester invite) wears the captain's hat. Taken on the page's word: it is a hat.
 Object.assign(v,{id,name:(who?cleanName(who.name):cleanName(msg.name))||null,discord:who,hat:msg.hat===true,ready:true});slots.set(v.slot,v);
 send(v.ws,{m:'welcome',id,aboard:aboard(),you:{name:v.name,verified:!!who},lifts:lifts.map(l=>({id:l.spec.id,s:liftWire(l.state)})),chat:{mode:CHAT,lines:CHAT==='off'?[]:said}});
 countChanged=true;log('aboard',aboard(),'+',id,v.name||'',who?`discord:${who.discordId}${who.lapsed?' (remembered)':''}`:msg.pass?'(pass refused)':'');
 if(who&&typeof msg.invite==='string'&&/^[A-Za-z0-9_-]{3,40}$/.test(msg.invite))log('invite',msg.invite,'used by',`discord:${who.discordId}`,who.username||'',who.wallets.join(' ')||'(no verified wallet)');
}
function leave(v){
 if(!visitors.delete(v))return;
 if(v.slot)slots.delete(v.slot);
 if(v.ready){broadcast({m:'gone',id:v.id});countChanged=true;log('aboard',aboard(),'-',v.id);}
}
const aboard=()=>{let n=0;for(const v of visitors)if(v.ready)n++;return n;};
let countChanged=false;

function onMessage(v,data,binary){
 if(binary||data.length>1024){v.ws.close(1009,'too big');return;}
 let msg;try{msg=JSON.parse(data);}catch{return;}
 if(!msg||typeof msg.m!=='string')return;
 if(!v.ready){if(msg.m==='hello'&&!v.helloSeen){v.helloSeen=true;hello(v,msg).catch(()=>v.ws.close(1011,'hello failed'));}return;}
 switch(msg.m){
  case 'pose':if(allowed(v,'pose'))readPose(v,msg.p);break;
  // A verified visitor's name is their Discord name.
  case 'name':if(allowed(v,'name')&&!v.discord){v.name=cleanName(msg.name)||null;v.nameVersion=(v.nameVersion||0)+1;}break;
  case 'call':{
   if(!allowed(v,'call'))break;
   const l=lifts.find(l=>l.spec.id===msg.lift);if(!l||!Number.isInteger(msg.stop)||msg.stop<0||msg.stop>=l.stops.length)break;
   callLift(l.state,msg.stop,{now:!!msg.now});liftChanged(l,true);break;
  }
  case 'ping':if(allowed(v,'ping'))send(v.ws,{m:'pong',t:msg.t});break;
  // Alien Cat Invasion, or Paw Pool when game is 'pool': a game starts, a game's score, the board.
  case 'play':if(allowed(v,'play'))v.games[msg.game==='pool'?'pool':'invasion']={at:Date.now()};break;
  case 'score':if(allowed(v,'score'))(msg.game==='pool'?cleared:scored)(v,msg);break;
  case 'board':if(allowed(v,'board'))send(v.ws,msg.game==='pool'?poolBoardFor(v):boardFor(v));break;
  // The ship log boards: the hearts, and a heart given or taken back.
  case 'hearts':if(allowed(v,'hearts'))send(v.ws,heartsFor(v));break;
  case 'heart':if(allowed(v,'heart'))hearted(v,msg);break;
  // The selfie camera pressed: a countdown for everyone at the booth.
  case 'selfie':if(allowed(v,'selfie'))selfie(v);break;
  // Mudwater Arena (arena.mjs): the giveaway card's state, a claim at the counter, and an arena event to count.
  case 'giveaway':if(allowed(v,'giveaway'))send(v.ws,arena.statusFor(v));break;
  case 'claim':if(allowed(v,'claim'))send(v.ws,arena.claim(v,msg));break;
  case 'arena':if(allowed(v,'arena'))arena.event(v,msg.e);break;
  // A line of chat, for everyone aboard.
  case 'chat':chat(v,msg);break;
  // A ping for others to find (walk/marks.js): where the visitor stands, passed on to everyone else aboard.
  case 'mark':{
   const a=msg.at;if(!allowed(v,'mark')||!Array.isArray(a)||a.length!==3||!finite(a[0],...BOUNDS.x)||!finite(a[1],...BOUNDS.y)||!finite(a[2],...BOUNDS.z))break;
   broadcast({m:'mark',id:v.id,at:a.map(n=>Math.round(n*100)/100)},v);break;
  }
 }
}

// A car's plans as everyone last heard them; told again whenever they change, and once a second while it moves, so a
// page that steps it a little differently never drifts far.
function liftChanged(l,force){
 const s=l.state,key=`${s.phase}|${s.at}|${s.target}|${[...s.calls].sort()}`,now=Date.now();
 if(!force&&key===l.sent&&!(s.phase==='moving'&&now-l.sentAt>1000))return;
 l.sent=key;l.sentAt=now;broadcast({m:'lift',id:l.spec.id,s:liftWire(s)});
}

// Every flush: step the lifts, then send each visitor the poses due to them.
let last=Date.now();
function flush(){
 const now=Date.now(),dt=Math.min(.25,(now-last)/1000);last=now;
 for(const l of lifts){stepLift(l.state,l.stops,dt);liftChanged(l,false);}
 if(countChanged){countChanged=false;broadcast({m:'aboard',n:aboard()});}
 for(const r of visitors){
  if(!r.ready)continue;
  if(r.ws.bufferedAmount>SLOW_BYTES){if(!r.slowSince)r.slowSince=now;else if(now-r.slowSince>SLOW_MS){r.ws.close(4004,'too slow');leave(r);}continue;}
  r.slowSince=0;
  const identities=[],records=[];
  for(const o of visitors){
   if(o===r||!o.ready||!o.record)continue;
   const seen=r.seen.get(o.slot),near=r.pos&&Math.abs(o.pos[1]-r.pos[1])<NEAR_DY&&Math.hypot(o.pos[0]-r.pos[0],o.pos[2]-r.pos[2])<NEAR_M;
   const fresh=!seen||seen.id!==o.id;
   const due=fresh||(seen.version!==o.version&&(near||now-seen.at>=FAR_MS))||now-seen.at>=KEEPALIVE_MS;
   if(!due)continue;
   if(fresh||seen.nameVersion!==(o.nameVersion||0))identities.push(encodeIdentity(o.slot,o.id,o.name,!!o.discord,o.hat));
   records.push(o.record);r.seen.set(o.slot,{id:o.id,version:o.version,at:now,nameVersion:o.nameVersion||0});
  }
  if(records.length)send(r.ws,assembleFrame(identities,records));
 }
}
setInterval(flush,FLUSH_MS);

const server=http.createServer((req,res)=>{
 // Mudwater Arena's daily counts, totals only (arena.mjs).
 if(req.url==='/arena'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(arena.report()));return;}
 if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({ok:true,aboard:aboard(),max:MAX}));return;}
 res.writeHead(200,{'Content-Type':'text/plain'});res.end('Leo live: the multiplayer server for Walk around Leo.\n');
});
const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{
 const origin=req.headers.origin||'';
 if(new URL(req.url,'http://x').pathname!=='/live'||!ORIGINS.some(o=>o.test(origin))){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
wss.on('connection',ws=>{
 const v={ws,ready:false,id:null,slot:0,name:null,record:null,pos:null,version:0,seen:new Map(),budget:{},games:{},alive:true};visitors.add(v);
 const timer=setTimeout(()=>{if(!v.ready)ws.close(4005,'no hello');},HELLO_MS);
 ws.on('message',(data,binary)=>onMessage(v,binary?data:data.toString(),binary));
 ws.on('pong',()=>{v.alive=true;});
 ws.on('close',()=>{clearTimeout(timer);leave(v);});
 ws.on('error',()=>{});
});
// Behind a tunnel an idle socket is cut after a couple of minutes; a ping keeps it open, and one never answered ends it.
setInterval(()=>{for(const v of visitors){if(!v.alive){v.ws.terminate();leave(v);continue;}v.alive=false;v.ws.ping();}},PING_MS);
server.listen(PORT,()=>log(`Leo live on :${PORT} (/live, /health, /arena), up to ${MAX} aboard`));
export {server};
