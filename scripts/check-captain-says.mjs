// Captain Says on a real Leo live server (server/captain-says.mjs, through live-core.mjs): bots on WebSockets, sending
// their poses ten times a second as a page does, join and play whole games. One alone waits; the rest join and the
// countdown opens; every round each bot does what its part says and its fate is checked against the call: one doing
// the called move stays in, one not doing it is out, one whose pose comes in the slack after the call stays in and one
// whose pose comes after the judging is out; on the trick, the one who moves is out and those who hold still stay in.
// One leaves mid-game and one drops its link, and both are gone from it; one joins mid-game and watches; the last one in
// wins; the next game opens with everyone still joined, and when they all go out in one round they share the win; left
// alone after it, the last one waits. Someone who never joins hears none of it. The rules alone (no server) are
// check-captain-says-rules.mjs, run first. A real local server with every state file in a temporary folder (as
// check-live-crowd.mjs runs one), Creamery's keys from a local stand-in, and a countdown and result of 2 s
// (LEO_LIVE_CS_WAIT_S) rather than 10, so it runs in about a minute.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {PROTOCOL} from '../src/walk/net/wire.js';
import {STANCE_CALLS,JUDGE_SLACK_MS,CALL_GRACE_MS} from '../server/captain-says.mjs';
await import('./check-captain-says-rules.mjs');

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const STATE={LEO_LIVE_SCORES:'scores.json',LEO_LIVE_HEARTS:'hearts.json',LEO_LIVE_CHAT_LOG:'chat.json',LEO_LIVE_GRAFFITI:'graffiti.json',LEO_LIVE_GRAFFITI_CLEAR:'graffiti-clear',
 LEO_LIVE_TV:'tv',LEO_LIVE_TV_CLEAR:'tv-clear',LEO_LIVE_MAZE:'maze.json',LEO_LIVE_TREASURE:'treasure.json',LEO_LIVE_GIVEAWAY:'giveaway.json',LEO_LIVE_GIVEAWAY_CLAIMS:'claims.json',
 LEO_LIVE_ARENA_STATS:'stats.json',LEO_LIVE_HALLOWEEN:'halloween.json'};
const WAIT_S=2,WAIT=WAIT_S*1000;
// A bot reacts REACT_MS after a call reaches it, as a person would: well past the grace in which a pose still counts as
// from before the call.
const REACT_MS=500;assert(REACT_MS>CALL_GRACE_MS+150);
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'leo-live-captain-'));
const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
// Creamery's keys, from here: nobody brings a pass, but the server never asks production for them.
const keys=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end('{"keys":[]}');});
await new Promise(r=>keys.listen(0,'127.0.0.1',r));
const server=spawn(process.execPath,['server/leo-live.mjs'],{env:{...process.env,LEO_LAYOUT:'2',PORT:String(port),LEO_LIVE_MAX:'50',LEO_PASS_ISS:'http://127.0.0.1',LEO_LIVE_CS_WAIT_S:String(WAIT_S),
 LEO_PASS_JWKS_URL:`http://127.0.0.1:${keys.address().port}/keys`,...Object.fromEntries(Object.entries(STATE).map(([k,v])=>[k,path.join(dir,v)]))},windowsHide:true,stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',b=>{log+=b;});server.stderr.on('data',b=>{log+=b;});
const bots=[];let identity=null;
const until=async(ok,ms,what)=>{const end=performance.now()+ms;while(!ok()){if(performance.now()>end)throw new Error(`timed out waiting for ${what}\n${log.slice(-1500)}`);await sleep(20);}};
// A bot: its pose (where it stands, its stance, emote and jump count), sent at once when it changes and ten times a
// second; every Captain Says message it hears, with the game it came in (one more after each 'over').
async function bot(name,spot){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/live`,{origin:'http://localhost:4180'});
 const b={ws,name,id:null,spot,state:{st:'stand',e:null,jc:0},cs:[],game:1,expect:new Map(),plan:()=>'none'};bots.push(b);
 ws.on('message',(data,binary)=>{if(binary)return;const m=JSON.parse(data);if(m.m==='welcome')b.id=m.id;
  if(m.m==='cs'){b.cs.push({...m,g:b.game,at:performance.now()});if(m.s==='call')called(b,m);if(m.s==='over'){b.game++;b.state={st:'stand',e:null,jc:0};b.send();}}});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 ws.send(JSON.stringify({m:'hello',v:PROTOCOL,layout:2,layoutIdentity:identity,key:randomBytes(32).toString('hex'),name}));
 await until(()=>b.id,3000,name+' aboard');
 b.send=()=>{if(ws.readyState===1)ws.send(JSON.stringify({m:'pose',p:{pos:spot,yaw:0,g:true,st:b.state.st,jc:b.state.jc,js:-1,r:0,e:b.state.e,rest:null,pl:false,b:false,gl:false,hk:null,f:0}}));};
 b.set=patch=>{b.state={...b.state,...patch};b.send();};
 b.join=()=>ws.send(JSON.stringify({m:'cs',e:'join'}));b.leave=()=>ws.send(JSON.stringify({m:'cs',e:'leave'}));
 return b;
}
const heard=(b,s,g)=>b.cs.filter(m=>m.s===s&&(g===undefined||m.g===g));
// Doing a move as the page does it: a stance (which ends an emote), an emote (standing), or a jump (the jump count rises,
// and falls again on landing). The wrong move: another stance, or another emote; for a jump, none.
function move(b,mv){
 if(STANCE_CALLS.includes(mv))b.set({st:mv,e:null});
 else if(mv==='jump'){b.set({st:'stand',e:null,jc:b.state.jc+1});setTimeout(()=>b.set({jc:0}),600);}
 else b.set({st:'stand',e:mv});
}
function wrong(b,mv){if(STANCE_CALLS.includes(mv))b.set({st:mv==='crouch'?'prone':'crouch',e:null});else if(mv!=='jump')b.set({st:'stand',e:mv==='dance'?'box':'dance'});}
// What each way of answering a call comes to: right (the move when the captain says it, else nothing), eager (the move,
// said or not), wrong (another move when said, the move when not), none, late (the move just after the call's time, in
// the slack), tardy (the move after the judging), leave, drop (the link). done: the bot is in the called stance or
// emote already, so doing it changes nothing, and doing nothing does it.
const fate=(cs,how,done)=>cs?{right:'in',eager:'in',late:'in',wrong:'out',none:done?'in':'out',tardy:done?'in':'out'}[how]
 :{right:'in',none:'in',tardy:'in',eager:done?'in':'out',wrong:done?'in':'out',late:done?'in':'out'}[how];
function called(b,m){
 const how=b.plan(m);if(m.you!=='in')return;
 if(how==='leave'){b.leave();b.leftAt=performance.now();return;}
 if(how==='drop'){b.ws.close();return;}
 const done=STANCE_CALLS.includes(m.mv)?b.state.st===m.mv:m.mv!=='jump'&&b.state.e===m.mv;
 b.expect.set(`${b.game}:${m.r}`,{how,fate:fate(m.cs,how,done),call:m});
 const at=how==='late'?m.ms+150:how==='tardy'?m.ms+JUDGE_SLACK_MS+400:REACT_MS;
 setTimeout(()=>{if(how==='right'&&m.cs||how==='eager'||how==='late'||how==='tardy'||how==='wrong'&&!m.cs)move(b,m.mv);else if(how==='wrong')wrong(b,m.mv);},at);
}
let ticks=null;
try{
 for(let i=0;i<600&&!/Leo live on/.test(log);i++)await sleep(100);assert.ok(/Leo live on/.test(log),'server started:\n'+log.slice(-1500));
 identity=(await (await fetch(`http://127.0.0.1:${port}/health`)).json()).layoutIdentity;
 const [good,steady,late,eager,idle,tardy,leaver,dropper,watcher,outsider]=await Promise.all(['Good','Steady','Late','Eager','Idle','Tardy','Leaver','Dropper','Watcher','Outsider'].map((n,i)=>bot(n,[i*4-18,5,i%2?6:-6])));
 ticks=setInterval(()=>{for(const b of bots)b.send();},100);
 // Each part's answers in the first game. Steady and Late slip deliberately at the call after the first trick, so Good is
 // left the last one in; in the next game nobody answers at all.
 let trickSeen=false;
 const slip=m=>trickSeen?'wrong':'right';
 const first=(how,then)=>m=>m.r===1?how:then(m);
 good.plan=()=>'right';steady.plan=slip;late.plan=first('late',slip);eager.plan=()=>'eager';idle.plan=()=>'none';tardy.plan=first('tardy',()=>'none');
 leaver.plan=first('right',()=>'leave');dropper.plan=first('right',()=>'drop');
 const inGame=[good,steady,late,eager,idle,tardy,leaver,dropper];

 good.join();await until(()=>heard(good,'idle').length,2000,'Good told it waits');await sleep(WAIT+500);
 assert.deepEqual(good.cs.map(m=>[m.s,m.n]).at(0),['idle',1]);assert(good.cs.every(m=>m.s==='idle'),'one alone: no countdown');
 pass('one alone waits, with no countdown');

 for(const b of inGame.slice(1))b.join();
 await until(()=>heard(good,'call').length,WAIT+3000,'the first call');
 const lobby=heard(good,'lobby');assert(lobby.length&&lobby[0].ms>WAIT-300&&lobby.at(-1).n===8,`countdown ${JSON.stringify(lobby)}`);
 for(const b of inGame)assert.deepEqual((({r,cs,ms,n,of,you})=>({r,cs,ms,n,of,you}))(heard(b,'call')[0]),{r:1,cs:true,ms:4000,n:8,of:8,you:'in'},b.name);
 pass(`the rest join: a ${WAIT_S} s countdown for all, its count reaching 8, then round 1 for all 8, said by the captain ("${heard(good,'call')[0].mv}")`);

 // Round by round to the end of the first game, the watcher joining once round 1 is judged.
 const rounds=new Map();let sawTrick=false;
 const watch=setInterval(()=>{const j=heard(good,'judged',1);if(j.length&&!watcher.joinedAt){watcher.joinedAt=performance.now();watcher.join();}
  for(const m of j)if(!rounds.has(m.r)){rounds.set(m.r,m);const c=heard(good,'call',1).find(x=>x.r===m.r);if(!c.cs){sawTrick=true;trickSeen=true;}}},20);
 await until(()=>heard(good,'over',1).length,60000,'the end of the first game');clearInterval(watch);for(const b of bots)b.plan=()=>'none';await sleep(300);
 const over1=heard(good,'over',1)[0],calls=heard(good,'call',1);
 // Every bot in at a call came out as its answer says; one out before a call is out after it.
 for(const b of inGame.filter(b=>b!==leaver&&b!==dropper))for(const c of calls){
  const e=b.expect.get(`1:${c.r}`),after=c.r===over1.r?heard(b,'over',1)[0]:heard(b,'judged',1).find(m=>m.r===c.r);
  const want=e?e.fate:'out';assert.equal(c.r===over1.r?{won:'in',lost:'out'}[after.you]:after.you,want,`${b.name}, round ${c.r} (${c.cs?'Captain says ':''}${c.mv}): ${e?.how||'already out'}`);
 }
 const r1=heard(good,'judged',1).find(m=>m.r===1)??over1;
 assert.equal(r1.n,6,'round 1: Idle and Tardy out');
 pass(`round 1: those doing "${calls[0].mv}" stay in, Late's pose in the ${JUDGE_SLACK_MS} ms after the call's time counts, Idle (nothing) and Tardy (after the judging) are out`);
 const trick=calls.find(c=>!c.cs&&eager.expect.get(`1:${c.r}`)?.fate==='out');assert(sawTrick&&trick,'a trick that caught Eager');
 assert.equal(good.expect.get(`1:${trick.r}`).fate,'in');
 pass(`the trick, "${trick.mv}" in round ${trick.r}: Eager moved and is out, those holding still stay in`);
 const r2=heard(good,'judged',1).find(m=>m.r===2)??over1;
 assert.equal(heard(leaver,'call',1).length,2);await sleep(200);assert(leaver.cs.filter(m=>m.at>leaver.leftAt+150).length===0,'Leaver heard more after leaving');
 assert.equal(dropper.ws.readyState,WebSocket.CLOSED);
 if(r2!==over1)assert.equal(r2.n,[good,steady,late,eager].filter(b=>b.expect.get('1:2')?.fate==='in').length,'round 2: Leaver and Dropper not counted');
 pass('round 2: Leaver leaves and Dropper drops its link mid-call; neither is counted, and Leaver hears no more');
 assert.deepEqual([over1.wn,over1.w,heard(good,'over',1)[0].you],[1,['Good'],'won']);
 for(const b of [steady,late,eager,idle,tardy])assert.equal(heard(b,'over',1)[0].you,'lost',b.name);
 assert(heard(watcher,'judged',1)[0].you==='watch'&&heard(watcher,'call',1).every(m=>m.you==='watch')&&heard(watcher,'over',1)[0].you==='watch','Watcher watches');
 pass(`Watcher joins mid-game and watches; Steady and Late slip after the trick, and Good, the last one in, wins after ${over1.r} rounds`);

 // The next game: everyone still joined (Watcher too), nobody answering, so all go out in round 1 and share the win.
 const players2=[good,steady,late,eager,idle,tardy,watcher];
 await until(()=>heard(good,'over',2).length,WAIT*2+8000,'the second game');
 for(const b of players2){const c=heard(b,'call',2)[0],o=heard(b,'over',2)[0];assert.deepEqual([c.r,c.of,c.you,o.r,o.wn,o.you],[1,7,'in',1,7,'won'],b.name);}
 assert.deepEqual([...heard(good,'over',2)[0].w].sort(),players2.map(b=>b.name).sort());assert(heard(good,'lobby',2).at(-1).n===7);
 pass('the next game opens with the 7 still joined; nobody answers, so all 7 go out in round 1 and share the win');

 for(const b of players2.slice(1))b.leave();
 await until(()=>heard(good,'idle',3).length,WAIT+3000,'Good waiting again');await sleep(WAIT+500);
 assert(heard(good,'lobby',3).length===0&&heard(good,'call',3).length===0&&heard(good,'idle',3).at(-1).n===1,'alone after the game: waits');
 assert.equal(outsider.cs.length,0,'Outsider never joined, and heard nothing');
 const games=[...log.matchAll(/captain says game (\d+): (\d+) players, (\d+) rounds, (.+)/g)].map(m=>[+m[1],+m[2],+m[3],m[4].trim()]);
 assert.deepEqual(games.map(g=>g.slice(0,3)),[[1,8,over1.r],[2,7,1]]);assert.equal(games[0][3],'won by '+good.id);
 assert(server.exitCode===null&&(await (await fetch(`http://127.0.0.1:${port}/health`)).json()).ok);
 pass('the others leave and Good, alone, waits; Outsider heard nothing; one log line for each game; the server carries on');
}finally{clearInterval(ticks);for(const b of bots)b.ws.terminate();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}keys.closeAllConnections();keys.close();await fs.rm(dir,{recursive:true,force:true});}
console.log(`captain says: ${passed} checks passed`);
