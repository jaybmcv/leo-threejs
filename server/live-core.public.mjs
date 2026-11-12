// Leo live: the multiplayer server for walk mode (src/walk/walk.html). One process is one shuttle: everyone connected
// walks the same Leo. It passes poses and pings on and runs the lifts (and keeps a few shared things: scores, hearts, chat,
// the graffiti wall, gym rounds, Captain Says and the Deck 1 transporters); the ship itself is static and every visitor
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
//   LEO_LIVE_HALLOWEEN=...            the Halloween clown's badge code as {"code":"..."} (default ../leo-live-halloween.json, beside
//                                     the checkout), read at each ask: with no file the clown has no code yet
//   LEO_LIVE_GRAFFITI=...             where the Deck 19 graffiti wall's paint is kept (default ../leo-live-graffiti.json)
//   LEO_LIVE_GRAFFITI_CLEAR=...       the file that, once created, clears the wall (default ../leo-live-graffiti-clear;
//                                     node scripts/graffiti-clear.mjs): graffiti.mjs
//   LEO_LIVE_MCT_RESET_HOUR=4         the hour (this machine's local time) the Deck 1 transporters nobody is driving go home
//                                     each day: transporters.mjs
//   LEO_LIVE_TV=...                   the folder the Crown lounge TV's video is kept in (default ../leo-live-tv): tv.mjs
//   LEO_LIVE_TV_OWNERS=...            Discord ids, comma separated, who get a Take down button at the TV
//   LEO_LIVE_TV_CLEAR=...             the file that, once created, takes the TV's video down (default ../leo-live-tv-clear;
//                                     node scripts/tv-clear.mjs)
//   LEO_LIVE_TV_MAX_MB=40, LEO_LIVE_TV_MAX_S=120   the largest and longest video the TV takes
//   LEO_LIVE_RUN_KEEP_S=90            how long a game run is kept for a visitor whose link dropped (0 keeps none)
//   LEO_LIVE_JOIN_S=30                how long an ask to join someone waits for their answer (joins.mjs)
//   LEO_LIVE_CS_WAIT_S=10             how long Captain Says counts down to a game, and shows its result after one
//                                     (captain-says.mjs)
//   LEO_LIVE_PINBALL=...              where Leo Pinball's best scores are kept (default ../leo-live-pinball.json): pinball.mjs
//
// Who someone is: a visitor who connected Discord through The Creamery brings a Leo pass (src/walk/net/pass.js); the
// server checks it and their name aboard is their Discord name, marked as verified. Anyone else is anonymous, with the
// name they typed. A verified visitor who came by an invite link has the code and who used it written to the log
// (invite records proper will live with The Creamery's members).
//
// Movement is trusted from the client, as in Reach: the server checks that a pose is well formed and inside the ship,
// and limits how often anyone may send. Lifts are the server's: a call goes to the server, which steps every car
// (lift-motion.js) and tells everyone when a car's plans change.
import {cleanFur} from '../src/walk/fur-colours.js';
import http from 'node:http';
import {policy} from '../src/v2/live-spatial.public.js';
import {buildInfo} from '../scripts/build-info.mjs';
import fs from 'node:fs';
import {WebSocketServer} from 'ws';
import {LIFTS} from '../src/walk/lifts.js';
import {liftState,callLift,stepLift,liftWire} from '../src/walk/lift-motion.js';
import {encodeRecord,encodeIdentity,assembleFrame,actorIdOf,cleanName,cleanChat,hasLink,PROTOCOL,STANCES} from '../src/walk/net/wire.js';
import {keySet,verifyPass,REMEMBER_S} from '../src/walk/net/pass.js';
import {POOL_FASTEST_S} from '../src/walk/pool/limits.js';
import {createArena} from './arena.mjs';
import {createGraffiti} from './graffiti.mjs';
import {createGym} from './gym.mjs';
import {createMazeBoard} from './maze.mjs';
import {createTreasureBoard} from './aquarium-treasure.mjs';
import {createSharedPanel} from './lever-panel.mjs';
import {createTransporters} from './transporters.mjs';
import {createTv} from './tv.mjs';
import {createJoins} from './joins.mjs';
import {createCaptainSays} from './captain-says.mjs';
import {createPinballBoard} from './pinball.mjs';

const PORT=Number(process.env.PORT||8090),MAX=Number(process.env.LEO_LIVE_MAX||1000);
const ORIGINS=(process.env.LEO_LIVE_ORIGINS||'https://leo.marscatsvoyage.com,http://localhost:*,http://127.0.0.1:*').split(',').map(o=>o.trim()).filter(Boolean)
 .map(o=>new RegExp('^'+o.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/:\*$/,'(:\\d+)?')+'$'));
const FLUSH_MS=50,KEEPALIVE_MS=2000,HELLO_MS=5000,PING_MS=25000,SLOW_BYTES=256*1024,SLOW_MS=5000;
// How often a page hears of another visitor, by how far apart they are on the same or the next deck (NEAR_DY): the
// nearest NEAR_MOST within RINGS[0][0] m (as many as a page gives a body: walk/remotes.js MAX_RIGS) every RINGS[0][1] ms,
// which is each pose they send; the rest about every RINGS[i][1] ms within RINGS[i][0] m; and anyone farther or on
// another deck every FAR_MS. A page is sent a frame every PAGE_MS (the pages take turns, a share at each flush: a send
// is the server's dearest work) of at most PAGE_RECORDS poses (LEO_LIVE_PAGE_RECORDS, but never fewer than the nearest
// and the long unheard need, below; a pose is about 15 bytes, so 80 is at most about 12 KB a second): first the nearest
// (they are few) and anyone long unheard (below); then changes of state (stance, emote, jump, rest, board, ball, hook, fur)
// from anyone at any distance, up to half of what is left, so a crowd sees a move at once (a Simon Says round); then
// the other rings and the far their SHARES of the rest; then what is left, nearest first. When a crowd wants more, that
// page's rates past the nearest stretch together (its pace, to PACE_MOST; the far's to FAR_PACE_MOST) and ease back as
// it thins. (Pages glide over the gaps and let a visitor go after 12 s unheard: walk/remotes.js.) A page's neighbours
// come from a grid of CELL_M cells every NEIGHBOURS_MS, and each ring, and everyone else, is swept once a period, a
// slice a frame: a flush costs about what it sends, not a pass over every pair. Anyone a page has not been sent for
// QUIET_MOST (one walking to and fro across a ring's edge can miss both rings' turns, or a crowd's changes of state
// crowd them out) goes next after the nearest, found by a scan of everyone every QUIET_SCAN_MS: nobody goes unheard for
// much more than the two together (pages let a visitor go after 12 s).
const NEAR_DY=9,RINGS=[[16,100],[32,200],[64,400]],NEAR_MOST=24,FAR_MS=1000,PAGE_MS=100,PAGE_TURNS=Math.max(1,Math.round(PAGE_MS/FLUSH_MS)),
 SHARES=[.45,.25,.3],PACE_MOST=8,FAR_PACE_MOST=4,QUIET_MOST=3000,QUIET_SCAN_MS=2000,NEIGHBOURS_MS=250,CELL_M=32,
 PAGE_RECORDS=Math.max(NEAR_MOST+Math.ceil(1.25*MAX*PAGE_MS/QUIET_MOST),Math.floor(Number(process.env.LEO_LIVE_PAGE_RECORDS)||80));
// Above this many aboard, the aboard count comes without the names: pages list the names they hear with the poses.
const NAMES_UP_TO=150;
// The ship's bounds, generously: a pose outside them is not a pose from this page.
const BOUNDS={x:[-400,400],y:[-80,200],z:[-200,200]};
// A pass up to REMEMBER_S past its expiry is a remembered visitor (the page kept it; Creamery's sign-in ran out): their
// name, scores and hearts count, but a giveaway claim wants a fresh one (arena.mjs).
const PASS={iss:process.env.LEO_PASS_ISS||'https://creamery.marscatsvoyage.com',aud:'leo.marscatsvoyage.com',lapsed:REMEMBER_S,
 key:keySet(process.env.LEO_PASS_JWKS_URL||'https://creamery.marscatsvoyage.com/.well-known/leo-pass-keys.json')};
const BUDGETS={pose:[20,25],call:[3,6],name:[.5,3],ping:[1,4],mark:[.25,2],play:[.2,3],score:[.2,3],board:[.5,4],hearts:[.5,4],heart:[1,6],selfie:[.2,2],giveaway:[.5,4],claim:[.2,3],arena:[1,6],chat:[.5,5],clown:[.2,3],wall:[.5,3],paint:[12,24],tv:[.5,3],'tv-ticket':[.5,5],'tv-down':[.2,2],cannon:[1,3]};
// Keel Club water cannons (walk/keel-club.js): when each last fired; one shot per cannon per CANNON_GAP ms.
const cannonShots=[],CANNON_GAP=1400;

const visitors=new Set();
const slots=new Map();let nextSlot=1;
// Each visitor aboard has a seat k: what the flush reads of them is kept in arrays by seat, and what each page was last
// sent of them (seen*) too, so a flush is arithmetic over arrays, not a map per pair. gen changes when a seat changes
// hands, so pages hear of its new visitor as someone new.
const SEATS=MAX+1,gen=new Int32Array(SEATS).fill(1),ver=new Int32Array(SEATS),stateVer=new Int32Array(SEATS),nameVer=new Int32Array(SEATS),
 px=new Float64Array(SEATS),py=new Float64Array(SEATS),pz=new Float64Array(SEATS),recs=new Array(SEATS).fill(null),seated=new Array(SEATS).fill(null);
// (urgent: the seats whose state changed since the last flush; urgents: those of the last PAGE_TURNS flushes, newest
// first, so a page sent a frame at one flush in PAGE_TURNS hears of them all)
const freeSeats=[],active=[],urgents=Array.from({length:PAGE_TURNS},()=>[]);let urgent=urgents[0];for(let k=SEATS-1;k>=0;k--)freeSeats.push(k);
function seat(v){const k=freeSeats.pop();v.k=k;seated[k]=v;nameVer[k]=v.nameVersion||0;
 v.seenGen=new Int32Array(SEATS);v.seenVer=new Int32Array(SEATS);v.seenState=new Int32Array(SEATS);v.seenName=new Int32Array(SEATS);v.seenAt=new Float64Array(SEATS);
 // Its neighbours by ring (seats) and which ring each seat is in (-1: none); for each ring and the far (the last), where
 // its sweep is and how many it owes; its pace.
 v.rings=RINGS.map(()=>[]);v.ringOf=new Int8Array(SEATS).fill(-1);v.at=new Int32Array(RINGS.length+1);v.owed=new Float64Array(RINGS.length+1);
 v.pace=1;v.ringsAt=0;v.sweptAt=Date.now();v.quietAt=0;v.quietOwed=0;}
function unseat(v){const k=v.k;if(k===undefined)return;const i=active.indexOf(k);if(i>=0){active[i]=active[active.length-1];active.pop();}
 gen[k]++;recs[k]=null;seated[k]=null;v.k=undefined;v.active=false;freeSeats.push(k);}
const lifts=LIFTS.map(spec=>({spec,stops:spec.stops,state:liftState(spec),sent:''}));
const log=(...a)=>console.log(new Date().toISOString(),...a);
const arena=createArena({log});
// The graffiti wall on Deck 19's fin root casing (graffiti.mjs): its paint, kept in a file, and who painted it.
const graffiti=createGraffiti({send:(v,msg)=>send(v.ws,msg),log});
// Paws Off's gym rounds on the treadmills (gym.mjs), in memory only.
const gym=createGym({log,send,canPlay:policy.canGym});BUDGETS.gym=[2,6];
// The Container Maze's best times (maze.mjs): its own file, its own message.
const maze=createMazeBoard({log,send});
const treasure=createTreasureBoard({log,send});
// Leo Pinball's shared high scores (pinball.mjs): its own file, its own message; ranked games replayed here to be checked.
const pinball=createPinballBoard({log,send,everyone:()=>visitors});
const panel=createSharedPanel({everyone:()=>visitors,broadcast:msg=>broadcast(msg)});BUDGETS.panel=[4,8];
// The Mars Cat Transporters on Deck 1 (transporters.mjs): who drives each, and where each is parked, in memory only.
const mct=createTransporters({log,broadcast:msg=>broadcast(msg),send:(v,msg)=>send(v.ws,msg)});BUDGETS.mct=[3,8];
setInterval(()=>mct.tick(),10000);
// Ask to join (joins.mjs): someone in the Aboard list asked to come to where another visitor stands, who accepts or
// declines. Requests live in memory only; the place given on accept must be public (policy.canJoin).
const joins=createJoins({send:(v,msg)=>send(v.ws,msg),find:id=>[...visitors].find(v=>v.ready&&v.id===id)||null,canJoin:policy.canJoin,log,ms:Number(process.env.LEO_LIVE_JOIN_S||30)*1000});BUDGETS.join=[2,8];
// Captain Says (captain-says.mjs): Simon Says for everyone aboard who joins, judged from their poses; in memory only.
const captainSays=createCaptainSays({log,send:(v,text)=>send(v.ws,text),waitMs:Number(process.env.LEO_LIVE_CS_WAIT_S||10)*1000});BUDGETS.cs=[1,4];
// The Crown lounge TV (tv.mjs): the video everyone sees, uploaded over plain HTTP by a signed-in visitor with a ticket.
const tv=createTv({send:(v,msg)=>send(v.ws,msg),log,everyone:()=>visitors,allowed:origin=>ORIGINS.some(o=>o.test(origin))});

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
// Where a visitor's grapple line bit (walk/grapple.js): inside the ship's bounds and within the hook's reach of them.
const HOOK_REACH=80;
function hookOf(h,[x,y,z]){
 if(!Array.isArray(h)||h.length!==3)return null;const [a,b,c]=h;
 return finite(a,...BOUNDS.x)&&finite(b,...BOUNDS.y)&&finite(c,...BOUNDS.z)&&Math.hypot(a-x,b-y,c-z)<=HOOK_REACH?[a,b,c]:null;
}
function readPose(v,p){
 if(!p||!Array.isArray(p.pos)||p.pos.length!==3)return false;
 const [x,y,z]=p.pos;if(!finite(x,...BOUNDS.x)||!finite(y,...BOUNDS.y)||!finite(z,...BOUNDS.z)||!finite(p.yaw,-1e3,1e3))return false;
 const pose={pos:[x,y,z],yaw:p.yaw,grounded:!!p.g,stance:STANCES.includes(p.st)?p.st:'stand',jumpCount:finite(p.jc,0,3)?Math.round(p.jc):0,
  jumpS:finite(p.js,-1,60)?p.js:-1,rise:finite(p.r,-100,100)?p.r:0,emote:typeof p.e==='string'&&/^[a-z0-9_]{1,32}$/.test(p.e)?p.e:null,rest:p.rest==='sit'||p.rest==='lie'||p.rest==='tube'?p.rest:null,
  playing:p.pl===true,ball:p.b===true,glide:p.gl===true,hook:hookOf(p.hk,[x,y,z]),fur:cleanFur(p.f)};
 try{v.record=encodeRecord(v.slot,pose);}catch{return false;}
 v.pos=pose.pos;v.playing=pose.playing;v.version++;
 // (a pose can still come from a visitor who has left, their socket closing: they have no seat)
 const k=v.k;if(k===undefined)return false;px[k]=x;py[k]=y;pz[k]=z;recs[k]=v.record;ver[k]++;
 const state=`${pose.stance}|${pose.emote}|${pose.rest}|${pose.jumpCount}|${pose.playing}|${pose.ball}|${pose.glide}|${!!pose.hook}|${pose.fur}`;
 if(state!==v.state){v.state=state;stateVer[k]++;urgent.push(k);}
 if(!v.active){v.active=true;active.push(k);}
 treasure.observe(v);panel.observe(v);captainSays.observe(v,pose);return true;
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
 if(!game||!policy.canPlay('invasion',v.pos)||!Number.isInteger(score)||score<=0||score%10||score>999990||!Number.isInteger(wave)||wave<1||wave>999||score>300+45*seconds||wave>1+seconds/12){
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
 if(!game||!policy.canPlay('pool',v.pos)||!Number.isInteger(said)||!Number.isInteger(shots)||shots<1||shots>999||said<POOL_FASTEST_S*1000||elapsed<POOL_FASTEST_S*1000||said>elapsed+2000){
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
// The Halloween clown on Deck 15 gives the badge code kept in a file on this server, so it is never in the public code.
// The file is read at each ask, so the code can be set or changed without a restart. Each find is logged.
const HALLOWEEN_FILE=process.env.LEO_LIVE_HALLOWEEN||new URL('../../leo-live-halloween.json',import.meta.url);
function clown(v){
 let code=null;try{const c=JSON.parse(fs.readFileSync(HALLOWEEN_FILE,'utf8')).code;if(typeof c==='string'&&/^[\w-]{3,64}$/.test(c))code=c;}catch{}
 log('clown',v.id,v.discord?`discord:${v.discord.discordId}`:'',JSON.stringify(v.name||''),code?'code given':'no code yet');
 send(v.ws,{m:'clown',code});
}
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
 const line={id:v.id,name:v.name,verified:vouched(v),text,at:Date.now()};
 said.push(line);if(said.length>CHAT_KEEP)said.shift();saveChat();
 log('chat',v.id,v.discord?`discord:${v.discord.discordId}`:'',JSON.stringify(v.name||''),JSON.stringify(text));
 broadcast({m:'chat',...line});
}

// A player from Otherside (src/walk/net/otherside.js) has everything a Discord account has, except giveaway claims
// (arena.mjs). With a wallet from glyph:ready, that wallet is their account and their Glyph username their name; without
// one, their browser's id is their account and they type a name (typed). Taken on the page's word: nothing here is signed,
// and anyone can claim any wallet. That's why their name gets no verified dot.
function typedVisitor(id,name){return {discordId:'otherside:'+id,username:null,name:cleanName(name)||'Voyager '+id.slice(-4),avatar:null,wallets:[],exp:null,jti:null,lapsed:false,glyph:true,typed:true};}
function glyphVisitor(g){
 if(!g||typeof g!=='object'||typeof g.wallet!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(g.wallet))return null;
 const wallet=g.wallet.toLowerCase(),username=typeof g.username==='string'?g.username:'';
 return {discordId:'glyph:'+wallet,username:username.slice(0,40)||null,name:cleanName(username)||wallet.slice(0,6)+'…'+wallet.slice(-4),avatar:null,wallets:[wallet],exp:null,jti:null,lapsed:false,glyph:true};
}
const vouched=v=>!!v.discord&&!v.discord.glyph;
async function hello(v,msg){
 if((msg.layout??1)!==policy.version||(policy.version===2&&msg.layoutIdentity!==policy.identity)){send(v.ws,{m:'reload',why:'layout',layout:policy.version});v.ws.close(4004,'layout mismatch');return;}
 if(msg.v!==PROTOCOL){send(v.ws,{m:'reload'});v.ws.close(4000,'old page');return;}
 const id=await actorIdOf(typeof msg.key==='string'?msg.key:'');
 if(!id){v.ws.close(4001,'no key');return;}
 const who=msg.pass?await verifyPass(msg.pass,PASS).catch(()=>null):glyphVisitor(msg.glyph)||(msg.otherside===true?typedVisitor(id,msg.name):null);
 // (the socket may have closed while the key or the pass was checked: then the visitor has left, and takes no seat)
 if(!visitors.has(v))return;
 // A pass not taken: 'bad' when it was checked and failed, 'unchecked' when Creamery's keys could not be had (it has
 // not answered since this server started, or not for a key this server has not seen). The page forgets a bad pass
 // and keeps one that was only unchecked (net/live.js), so a restart while Creamery is away costs nobody their login.
 const pass=msg.pass&&!who?(PASS.key.down()?'unchecked':'bad'):null;
 // One body per visitor: the same browser in a second tab, or the same Discord account elsewhere, takes over.
 for(const o of visitors)if(o!==v&&(o.id===id||(who&&o.discord?.discordId===who.discordId))){send(o.ws,{m:'replaced'});o.ws.close(4002,'replaced');leave(o);}
 if([...visitors].filter(o=>o.ready).length>=MAX){send(v.ws,{m:'full'});v.ws.close(4003,'full');return;}
 v.slot=takeSlot();if(!v.slot||!freeSeats.length){v.ws.close(4003,'full');return;}
 // A tester (the page holds a tester invite) wears the captain's hat. Taken on the page's word: it is a hat.
 Object.assign(v,{id,name:(who?cleanName(who.name):cleanName(msg.name))||null,discord:who,hat:msg.hat===true,ready:true});slots.set(v.slot,v);seat(v);
 send(v.ws,{m:'welcome',...(policy.version===2?{layout:2,layoutIdentity:policy.identity}:{}),id,aboard:aboard(),you:{name:v.name,verified:!!who,typed:!!who?.typed,...(pass?{pass}:{})},lifts:lifts.map(l=>({id:l.spec.id,s:liftWire(l.state)})),chat:{mode:CHAT,lines:CHAT==='off'?[]:said},mcts:mct.state(),panel:panel.state()});
 countChanged=true;log('aboard',aboard(),'+',id,v.name||'',who?`${who.glyph?'':'discord:'}${who.discordId}${who.lapsed?' (remembered)':''}`:pass==='unchecked'?'(pass not checked: no keys from Creamery)':pass?'(pass refused)':'');
 if(who&&typeof msg.invite==='string'&&/^[A-Za-z0-9_-]{3,40}$/.test(msg.invite))log('invite',msg.invite,'used by',`discord:${who.discordId}`,who.username||'',who.wallets.join(' ')||'(no verified wallet)');
 // A run this visitor had open when their last connection dropped is theirs again (keepRuns).
 returnRuns(v);
}
// A run that outlives a dropped link. A visitor who leaves with a run open (Paw Pool, Alien Cat Invasion, the Container
// Maze) has it kept under their id for RUN_KEEP_MS; when that browser (its key gives the id) says hello again as the
// same account, the run is theirs again. Its start time is never touched, so the server's clock ran through the gap,
// and the finish is judged as ever: where they stand comes from a pose on the new connection. A second tab of the same
// browser inherits the run as well: the server cannot tell it from a link that dropped before its old socket closed.
// An aquarium treasure swim is not kept: the server follows it pose by pose (aquarium-treasure.mjs) and cannot vouch
// for a stretch it did not see.
const RUN_KEEP_MS=Number(process.env.LEO_LIVE_RUN_KEEP_S||90)*1000,KEPT_MOST=1000,kept=new Map();
const accountOf=v=>v.discord?.discordId||null;
function keepRuns(v){
 if(!v.ready)return;
 const pool=v.games.pool,invasion=v.games.invasion,run=maze.take(v),now=Date.now();
 if(!pool&&!invasion&&!run)return;
 for(const [id,k] of kept)if(k.until<=now)kept.delete(id);
 kept.delete(v.id);if(kept.size>=KEPT_MOST)kept.delete(kept.keys().next().value);
 kept.set(v.id,{pool,invasion,maze:run,account:accountOf(v),until:now+RUN_KEEP_MS});
 log('run kept',v.id,[pool&&'pool',invasion&&'invasion',run&&'maze'].filter(Boolean).join(' '));
}
function returnRuns(v){
 const k=kept.get(v.id);if(!k||k.account!==accountOf(v))return;
 kept.delete(v.id);if(k.until<=Date.now())return;
 if(k.pool)v.games.pool=k.pool;if(k.invasion)v.games.invasion=k.invasion;if(k.maze)maze.give(v,k.maze);
 log('run back',v.id);
}
function leave(v){
 if(!visitors.delete(v))return;
 if(v.slot)slots.delete(v.slot);
 unseat(v);
 keepRuns(v);
 graffiti.leave(v);
 gym.left(v);
 mct.left(v);
 panel.left(v);
 tv.leave(v);
 joins.left(v);
 captainSays.left(v);
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
  case 'name':if(allowed(v,'name')&&(!v.discord||v.discord.typed)){v.name=cleanName(msg.name)||(v.discord?v.discord.name:null);v.nameVersion=(v.nameVersion||0)+1;if(v.k!==undefined)nameVer[v.k]=v.nameVersion;countChanged=true;}break;
  case 'call':{
   if(!allowed(v,'call'))break;
   const l=lifts.find(l=>l.spec.id===msg.lift);if(!l||!Number.isInteger(msg.stop)||msg.stop<0||msg.stop>=l.stops.length||!policy.canCall(v.pos,l.spec,msg.stop))break;
   callLift(l.state,msg.stop,{now:!!msg.now});liftChanged(l,true);break;
  }
  case 'ping':if(allowed(v,'ping'))send(v.ws,{m:'pong',t:msg.t});break;
  // Alien Cat Invasion, or Paw Pool when game is 'pool': a game starts, a game's score, the board.
  case 'play':if(allowed(v,'play')){const game=msg.game==='pool'?'pool':'invasion';if(policy.canPlay(game,v.pos))v.games[game]={at:Date.now()};else delete v.games[game];}break;
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
  // The Container Maze (maze.mjs): a run starts, a run ends at the button, the board.
  case 'maze':maze.message(v,msg);break;
  case 'treasure':treasure.message(v,msg);break;
  // Leo Pinball (pinball.mjs): the board, a ranked game's ticket, and its button log and finish.
  case 'pinball':pinball.message(v,msg);break;
  case 'panel':if(allowed(v,'panel'))panel.message(v,msg);break;
  // A line of chat, for everyone aboard.
  case 'chat':chat(v,msg);break;
  // A knock on the Halloween clown's glass (walk/halloween.js): its badge code, if there is one yet.
  case 'clown':if(allowed(v,'clown'))clown(v);break;
  // The Deck 19 graffiti wall (graffiti.mjs): the whole wall for a visitor come to look, and a stroke of spray paint.
  // A stroke over the limit is refused, and the painter told, so their page can take the wall back as it is.
  case 'wall':if(allowed(v,'wall'))graffiti.look(v);break;
  case 'paint':graffiti.paint(v,msg,{slow:!allowed(v,'paint')});break;
  // Paws Off (walk/paws-off): stepping onto a treadmill, a fall, stepping off, for the gym round (gym.mjs).
  case 'gym':if(allowed(v,'gym')){if(msg.e==='in'&&!policy.canGym(v.pos)){send(v.ws,{m:'gym',e:'cancel'});break;}gym.message(v,msg);}break;
  // The Deck 1 transporters (transporters.mjs): a driver's seat taken, where a cart is, a cart parked.
  case 'mct':if(allowed(v,'mct'))mct.message(v,msg);break;
  // Ask to join someone from the Aboard list (joins.mjs): ask, cancel, and the answer of the one asked.
  case 'join':if(allowed(v,'join'))joins.message(v,msg);break;
  // Captain Says (captain-says.mjs): join its next game, or leave it.
  // (only from a visitor still aboard: a socket closing after being taken over may still send; leaving is never held back)
  case 'cs':if(visitors.has(v)&&(msg.e==='leave'||allowed(v,'cs')))captainSays.message(v,msg);break;
  // The Crown lounge TV (tv.mjs): what is on it, a ticket to upload a video, and an owner taking it down.
  case 'tv':case 'tv-ticket':case 'tv-down':if(allowed(v,msg.m))tv.message(v,msg);break;
  // A ping for others to find (walk/marks.js): where the visitor stands, passed on to everyone else aboard.
  case 'mark':{
   const a=msg.at;if(!allowed(v,'mark')||!Array.isArray(a)||a.length!==3||!finite(a[0],...BOUNDS.x)||!finite(a[1],...BOUNDS.y)||!finite(a[2],...BOUNDS.z))break;
   broadcast({m:'mark',id:v.id,at:a.map(n=>Math.round(n*100)/100)},v);break;
  }
  // A Keel Club water cannon shot: from someone on that cannon's bridge crown (policy.canFire), once per cannon per
  // CANNON_GAP. Every page aboard, the shooter's too, fires the accepted shot from its seed, and each rider's page judges
  // its own hits.
  case 'cannon':{
   const i=msg.i,now=Date.now();if(!allowed(v,'cannon')||!Number.isInteger(i)||!policy.canFire(v.pos,i)||now-(cannonShots[i]||0)<CANNON_GAP)break;
   cannonShots[i]=now;v.shots=(v.shots||0)+1;const seed=Number.isInteger(msg.seed)&&msg.seed>0&&msg.seed<2147483647?msg.seed:1+Math.floor(Math.random()*2147483646);
   broadcast({m:'cannon',id:v.id,i,seed,shot:v.id+':'+v.shots});break;
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

// Every flush: step the lifts, then send the visitors whose turn it is the poses due to them.
// (flushMs: a running mean of what a flush takes; peaks: the most in each of the last ten seconds)
let last=Date.now(),flushes=0,flushMs=0,peakSecond=0;const peaks=new Float64Array(10);
// Those with a pose by grid cell (CELL_M across, NEAR_DY high), made again each flush.
const grid=new Map(),cellKey=(cx,cy,cz)=>((cx+512)*1024+cz+512)*256+cy+128;
const RING2=RINGS.map(([m])=>m*m),REACH=Math.ceil(RINGS.at(-1)[0]/CELL_M),SWEEPS=RINGS.length+1,periods=new Float64Array(SWEEPS);
// A page's neighbours by ring, from the cells round it: in the first, the nearest NEAR_MOST within its reach (where it
// ends found from a histogram of how far they are, BINS steps of the distance squared), the rest of those in the next.
const near=new Int32Array(SEATS),nearD2=new Float64Array(SEATS),BINS=32,bins=new Int32Array(BINS);
function neighbours(r){
 for(const list of r.rings){for(const k of list)r.ringOf[k]=-1;list.length=0;}
 if(!r.active)return;
 const me=r.k,rx=px[me],ry=py[me],rz=pz[me],cx=Math.floor(rx/CELL_M),cy=Math.floor(ry/NEAR_DY),cz=Math.floor(rz/CELL_M),reach2=RING2.at(-1);
 let n=0,inFirst=0;
 for(let a=-REACH;a<=REACH;a++)for(let b=-REACH;b<=REACH;b++)for(let c=-1;c<=1;c++){
  const here=grid.get(cellKey(cx+a,cy+c,cz+b));if(!here)continue;
  for(const k of here){
   const dy=py[k]-ry;if(k===me||dy>=NEAR_DY||dy<=-NEAR_DY)continue;
   const dx=px[k]-rx,dz=pz[k]-rz,d2=dx*dx+dz*dz;if(d2>=reach2)continue;
   near[n]=k;nearD2[n++]=d2;if(d2<RING2[0])inFirst++;
  }
 }
 // The first ring: every bin below edgeBin, and of that bin all nearer than edgeD2 and as many as there is room for
 // of those exactly as near (ties: visitors standing on one spot, as at a spawn point, are all as near).
 let edgeBin=BINS,edgeD2=-1,ties=0;
 if(inFirst>NEAR_MOST){
  bins.fill(0);for(let i=0;i<n;i++)if(nearD2[i]<RING2[0])bins[Math.floor(nearD2[i]/RING2[0]*BINS)]++;
  let below=0;edgeBin=0;while(below+bins[edgeBin]<=NEAR_MOST)below+=bins[edgeBin++];
  const room=NEAR_MOST-below;
  if(room>0){const cut=[];for(let i=0;i<n;i++)if(nearD2[i]<RING2[0]&&Math.floor(nearD2[i]/RING2[0]*BINS)===edgeBin)cut.push(nearD2[i]);cut.sort((a,b)=>a-b);edgeD2=cut[room-1];ties=room-cut.indexOf(edgeD2);}
 }
 for(let i=0;i<n;i++){
  const k=near[i],d2=nearD2[i];let j=1;
  if(d2<RING2[0]){const bin=Math.floor(d2/RING2[0]*BINS);if(bin<edgeBin||bin===edgeBin&&(d2<edgeD2||d2===edgeD2&&ties-->0))j=0;}
  else while(d2>=RING2[j])j++;
  r.rings[j].push(k);r.ringOf[k]=j;
 }
}
// One page's frame: the nearest ring; anyone long unheard; changes of state, up to half of what is left; the other rings and the far, each
// up to its share of the rest; then what is left, nearest first. The nearest ring keeps its own rate, the rest the
// page's pace. Each ring, and everyone in none, is swept once a period: owed[s] is how many that sweep has still to
// look at, at[s] where it is. Due: someone new or a change of state; a newer pose, half a period or more since they
// were last sent; or a keepalive.
function pagePoses(r,now){
 const me=r.k,sGen=r.seenGen,sVer=r.seenVer,sState=r.seenState,sAt=r.seenAt,ringOf=r.ringOf,pace=r.pace;
 const identities=[],records=[];let left=PAGE_RECORDS;
 const take=k=>{const o=seated[k];
  if(sGen[k]!==gen[k]||r.seenName[k]!==nameVer[k])identities.push(encodeIdentity(o.slot,o.id,o.name,vouched(o),o.hat));
  records.push(recs[k]);sGen[k]=gen[k];sVer[k]=ver[k];sState[k]=stateVer[k];r.seenName[k]=nameVer[k];sAt[k]=now;left--;};
 const elapsed=Math.max(0,now-r.sweptAt);r.sweptAt=now;
 for(let s=0;s<SWEEPS;s++){const ring=s<RINGS.length,n=ring?r.rings[s].length:active.length;
  periods[s]=s===0?RINGS[0][1]:ring?RINGS[s][1]*pace:FAR_MS*Math.min(pace,FAR_PACE_MOST);r.owed[s]=Math.min(n,r.owed[s]+n*elapsed/periods[s]);}
 // Sweep s, taking at most quota of those due.
 const sweep=(s,quota)=>{
  const ring=s<RINGS.length,list=ring?r.rings[s]:active,n=list.length;if(!n)return;
  const period=periods[s];let at=r.at[s]%n,owed=r.owed[s];
  for(;owed>=1&&quota>0&&left>0;owed--){
   const k=list[at];at=at+1===n?0:at+1;
   if(k===me||!recs[k]||!ring&&ringOf[k]>=0)continue;
   const age=now-sAt[k];
   if(sGen[k]!==gen[k]||sState[k]!==stateVer[k]||(sVer[k]!==ver[k]?age>=period/2:age>=Math.max(KEEPALIVE_MS-period/2,period/2))){take(k);quota--;}
  }
  r.at[s]=at;r.owed[s]=owed;
 };
 sweep(0,left);
 // Anyone not sent for QUIET_MOST, from a scan of everyone once every QUIET_SCAN_MS.
 const count=active.length;
 if(count){
  let at=r.quietAt%count;r.quietOwed=Math.min(count,r.quietOwed+count*elapsed/QUIET_SCAN_MS);
  for(;r.quietOwed>=1&&left>0;r.quietOwed--){const k=active[at];at=at+1===count?0:at+1;if(k!==me&&recs[k]&&now-sAt[k]>=QUIET_MOST)take(k);}
  r.quietAt=at;
 }
 const keep=left-(left>>1);
 for(const list of urgents)for(let i=0;i<list.length&&left>keep;i++){const k=list[i];if(k!==me&&recs[k]&&(sGen[k]!==gen[k]||sState[k]!==stateVer[k]))take(k);}
 const base=left;for(let s=1;s<SWEEPS;s++)sweep(s,Math.max(1,Math.floor(base*SHARES[s-1])));
 for(let s=1;s<SWEEPS&&left;s++)sweep(s,left);
 // A page whose budget ran out goes slower; one with room to spare eases back.
 r.pace=left===0?Math.min(PACE_MOST,pace*1.25):left>PAGE_RECORDS*.3?Math.max(1,pace/1.1):pace;
 if(records.length)send(r.ws,assembleFrame(identities,records));
}
function flush(){
 const now=Date.now(),t0=performance.now(),dt=Math.min(.25,(now-last)/1000);last=now;flushes++;
 panel.tick(dt);joins.tick();
 for(const l of lifts){stepLift(l.state,l.stops,dt);liftChanged(l,false);}
 // The Aboard list: names, and each one's id (for asking to join them), in the same order; above NAMES_UP_TO, the count alone.
 if(countChanged){countChanged=false;const n=aboard(),here=n<=NAMES_UP_TO?[...visitors].filter(v=>v.ready):null;
  broadcast(here?{m:'aboard',n,names:here.map(v=>v.name||'Voyager '+v.id.slice(-4)),ids:here.map(v=>v.id)}:{m:'aboard',n,names:'heard'});}
 grid.clear();
 for(const k of active){const key=cellKey(Math.floor(px[k]/CELL_M),Math.floor(py[k]/NEAR_DY),Math.floor(pz[k]/CELL_M)),here=grid.get(key);if(here)here.push(k);else grid.set(key,[k]);}
 for(const r of visitors){
  if(!r.ready||(flushes+r.k)%PAGE_TURNS)continue;
  if(r.ws.bufferedAmount>SLOW_BYTES){if(!r.slowSince)r.slowSince=now;else if(now-r.slowSince>SLOW_MS){r.ws.close(4004,'too slow');leave(r);}continue;}
  r.slowSince=0;
  // (each page's neighbours are found again in turn, NEIGHBOURS_MS apart)
  if(now>=r.ringsAt){neighbours(r);r.ringsAt=now+NEIGHBOURS_MS;}
  pagePoses(r,now);
 }
 urgent=urgents.pop();urgent.length=0;urgents.unshift(urgent);
 // What a flush costs the server (/health): a running mean, and the most in the last ten seconds.
 const ms=performance.now()-t0,second=Math.floor(t0/1000);flushMs+=(ms-flushMs)*.05;
 if(second!==peakSecond){for(let s=peakSecond+1;s<=second&&s<=peakSecond+10;s++)peaks[s%10]=0;peakSecond=second;}
 peaks[second%10]=Math.max(peaks[second%10],ms);
}
setInterval(flush,FLUSH_MS);

// The commit this server runs, read as it starts, so the Builder's Hub knows when a server change has really gone live.
// None when its files have changes: then it isn't running that commit.
const REVISION=buildInfo(new URL('..',import.meta.url)).sha;
const server=http.createServer((req,res)=>{
 // Mudwater Arena's daily counts, totals only (arena.mjs).
 if(req.url==='/arena'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(arena.report()));return;}
 // The Crown lounge TV: its video, and uploads to it (tv.mjs).
 if(tv.http(req,res))return;
 if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({ok:true,aboard:aboard(),max:MAX,seatsFree:freeSeats.length,pageRecords:PAGE_RECORDS,revision:REVISION,flush:{ms:+flushMs.toFixed(2),max:+Math.max(...peaks).toFixed(2)},...(policy.version===2?{layout:2,layoutIdentity:policy.identity}:{})}));return;}
 res.writeHead(200,{'Content-Type':'text/plain'});res.end('Leo live: the multiplayer server for Walk around Leo.\n');
});
const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{
 const origin=req.headers.origin||'';
 if(new URL(req.url,'http://x').pathname!=='/live'||!ORIGINS.some(o=>o.test(origin))){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
wss.on('connection',ws=>{
 const v={ws,ready:false,id:null,slot:0,name:null,record:null,pos:null,version:0,budget:{},games:{},alive:true};visitors.add(v);
 const timer=setTimeout(()=>{if(!v.ready)ws.close(4005,'no hello');},HELLO_MS);
 ws.on('message',(data,binary)=>onMessage(v,binary?data:data.toString(),binary));
 ws.on('pong',()=>{v.alive=true;});
 ws.on('close',()=>{clearTimeout(timer);leave(v);});
 ws.on('error',()=>{});
});
// Behind a tunnel an idle socket is cut after a couple of minutes; a ping keeps it open, and one never answered ends it.
setInterval(()=>{for(const v of visitors){if(!v.alive){v.ws.terminate();leave(v);continue;}v.alive=false;v.ws.ping();}},PING_MS);
server.listen(PORT,()=>log(`Leo live on :${PORT} (/live, /health, /arena, /tv), up to ${MAX} aboard`));
export {server};
