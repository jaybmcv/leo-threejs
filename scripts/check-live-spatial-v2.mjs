// Real loopback servers, locally signed Ed25519 players, isolated files. No production identity provider.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {PROTOCOL,WireReader} from '../src/walk/net/wire.js';
// The pinned v1 server speaks its own, older wire protocol: a v1 client says hello in it.
import {PROTOCOL as V1_PROTOCOL} from '../legacy/v1/src/walk/net/wire.js';
import {POOL_FASTEST_S} from '../src/walk/pool/limits.js';
import {liveSpatialFixtures} from './live-spatial-fixture.mjs';
const {v1,v2}=await liveSpatialFixtures(),old=v1.spatial,now=v2.spatial;
const results=[],check=(name,ok,detail='')=>{assert(ok,name+' '+detail);results.push({name,status:'PASS',detail});console.log('PASS '+name);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,label,ms=10000)=>{const end=Date.now()+ms;do{const v=f();if(v)return v;await sleep(20);}while(Date.now()<end);throw Error('Timed out: '+label);};
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'leo-stream-h-')),children=[],bots=[];
const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
// keysDown: the identity provider's keys cannot be had (it answers 503), as when Creamery is unreachable.
let jwksReads=0,keysDown=false;const keys=http.createServer((req,res)=>{jwksReads++;if(keysDown){res.statusCode=503;res.end();return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[{...jwk,kid:'local-h',alg:'EdDSA',use:'sig'}]}));});
await new Promise(r=>keys.listen(0,'127.0.0.1',r));
const sign=async(id,kid='local-h')=>{const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),t=Math.floor(Date.now()/1000),h=b({alg:'EdDSA',kid,typ:'JWT'}),p=b({iss:'http://127.0.0.1',aud:'leo.marscatsvoyage.com',sub:'discord:'+id,discord:{id,username:'local'+id,global_name:'Local '+id},wallets:[],iat:t,exp:t+1800});return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url');};
let serial=100;
const stateNames={LEO_LIVE_SCORES:'scores.json',LEO_LIVE_HEARTS:'hearts.json',LEO_LIVE_CHAT_LOG:'chat.json',LEO_LIVE_GRAFFITI:'graffiti.json',LEO_LIVE_GRAFFITI_CLEAR:'graffiti-clear',LEO_LIVE_TV:'tv',LEO_LIVE_TV_CLEAR:'tv-clear',LEO_LIVE_MAZE:'maze.json',LEO_LIVE_TREASURE:'treasure.json',LEO_LIVE_GIVEAWAY:'giveaway.json',LEO_LIVE_GIVEAWAY_CLAIMS:'claims.json',LEO_LIVE_ARENA_STATS:'stats.json',LEO_LIVE_HALLOWEEN:'halloween.json'};
async function start(version,dir){await fs.mkdir(dir,{recursive:true});const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const env={...process.env,LEO_LAYOUT:String(version),PORT:String(port),LEO_PASS_ISS:'http://127.0.0.1',LEO_PASS_JWKS_URL:'http://127.0.0.1:'+keys.address().port+'/keys',...Object.fromEntries(Object.entries(stateNames).map(([k,v])=>[k,path.join(dir,v)]))};const p=spawn(process.execPath,['server/leo-live.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});children.push(p);let log='';p.stdout.on('data',b=>log+=b);p.stderr.on('data',b=>log+=b);await until(()=>log.includes('Leo live on')||p.exitCode!==null,'server start',60000);assert.equal(p.exitCode,null,log);const health=await (await fetch('http://127.0.0.1:'+port+'/health')).json();return {p,port,health,dir,log:()=>log};}
async function bot(s,{layout=2,identity=now.identity,id=String(880000000000000000n+BigInt(++serial)),key=randomBytes(32).toString('hex'),signed=true,pass,glyph,otherside,name,protocol=PROTOCOL}={}){const ws=new WebSocket('ws://127.0.0.1:'+s.port+'/live',{origin:'http://localhost:4180'}),b={ws,msgs:[],poses:new Map(),closed:null,id,key},reader=new WireReader();bots.push(b);ws.on('message',(data,binary)=>{if(binary){for(const p of reader.read(data))b.poses.set(p.id,p);}else b.msgs.push(JSON.parse(data));});ws.on('close',code=>b.closed=code);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});b.send=m=>ws.send(JSON.stringify(m));b.pose=async(pos,extra={})=>{b.send({m:'pose',p:{pos,yaw:0,g:true,...extra}});await sleep(65);};b.ask=async(m,test=x=>x.m===m.m)=>{const n=b.msgs.length;b.send(m);return until(()=>b.msgs.slice(n).find(test),'reply '+m.m);};b.send({m:'hello',v:protocol,key,...(layout===null?{}:{layout}),...(identity?{layoutIdentity:identity}:{}),...(pass?{pass}:signed?{pass:await sign(id)}:{}),...(glyph?{glyph}:{}),...(otherside?{otherside}:{}),...(name?{name}:{})});await until(()=>b.msgs.some(m=>m.m==='welcome'||m.m==='reload')||b.closed,'join');b.welcome=b.msgs.find(m=>m.m==='welcome');return b;}
const stop=async s=>{s.p.kill();await new Promise(r=>s.p.exitCode!==null||s.p.signalCode!==null?r():s.p.once('exit',r));};
try{
 // These servers keep a dropped visitor's game run for 4 s, not 90 (live-core.mjs keepRuns), so the check can outwait it.
 process.env.LEO_LIVE_RUN_KEEP_S='4';
 // Asks to join run out after 2 s, not 30 (joins.mjs).
 process.env.LEO_LIVE_JOIN_S='2';
 const dir=path.join(tmp,'v2'),legacyId='880000000000000001',legacy=[{id:legacyId,name:'Earlier swimmer',ms:45678,at:'2026-10-01T00:00:00.000Z'}];await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'treasure.json'),JSON.stringify(legacy));const historicScores=[{id:legacyId,name:'Earlier player',score:900,wave:3,at:'2026-10-01T00:00:00.000Z'},{game:'pool',id:legacyId,name:'Earlier player',ms:80000,shots:22,at:'2026-10-01T00:00:00.000Z'}],historicMaze=[{id:legacyId,name:'Earlier player',ms:12345,at:'2026-10-01T00:00:00.000Z'}];await fs.writeFile(path.join(dir,'scores.json'),JSON.stringify(historicScores));await fs.writeFile(path.join(dir,'maze.json'),JSON.stringify(historicMaze));const s=await start(2,dir);
 check('v2 health advertises matching layout identity',s.health.layout===2&&s.health.layoutIdentity===now.identity);
 const a=await bot(s,{id:legacyId}),observer=await bot(s);check('locally signed identities are verified',a.welcome?.you.verified&&observer.welcome?.you.verified&&jwksReads>0);
 // The retained Deck 4 puzzle is shared even for guests, with one admitted visitor and a safe inside release.
 {const finder=await bot(s,{signed:false}),follower=await bot(s,{signed:false}),y=-27.7,face=-175.2;
  const latest=b=>b.msgs.filter(m=>m.m==='panel').at(-1)||b.welcome.panel;
  check('new visitors receive the sealed panel',finder.welcome.panel.phase==='sealed'&&follower.welcome.panel.phase==='sealed');
  for(const [i,z] of [[0,.8],[3,-.4],[4,-.8]]){
   await finder.pose([face+1.2,y,z]);finder.send({m:'panel',op:'flip',i});
   await until(()=>latest(follower).levers[i]===1,'shared lever '+i);
  }
  await until(()=>latest(follower).phase==='open'&&latest(follower).down===1,'shared panel opens');
  await finder.pose([face+1.2,y,0]);await follower.pose([face+1.2,y,0]);
  await until(()=>latest(follower).owner===finder.welcome.id,'first visitor reserves the panel');
  check('simultaneous follower does not replace the first admission',latest(finder).owner===finder.welcome.id);
  await finder.pose([face-.3,y,0]);await sleep(450);check('panel waits for a body to clear the doorway',latest(follower).down===1);
  await finder.pose([face-2,y,0]);await until(()=>latest(follower).phase==='sealed'&&latest(follower).down===0,'panel closes behind first visitor');
  const joined=await bot(s,{signed:false});check('late join receives the occupied sealed state',joined.welcome.panel.owner===finder.welcome.id&&joined.welcome.panel.phase==='sealed');
  follower.send({m:'panel',op:'flip',i:2});await sleep(200);check('occupied room cannot be solved again outside',latest(follower).levers.every(n=>n===0));
  finder.send({m:'panel',op:'exit'});await until(()=>latest(follower).phase==='exit'&&latest(follower).down===1,'inside release is shared');
  await finder.pose([face+2,y,0]);await until(()=>latest(follower).owner===null&&latest(follower).down===0,'exit resets the puzzle');
  for(const [i,z] of [[0,.8],[3,-.4],[4,-.8]]){await follower.pose([face+1.2,y,z]);follower.send({m:'panel',op:'flip',i});await until(()=>latest(finder).levers[i]===1,'next shared lever '+i);}
  await until(()=>latest(finder).down===1,'next opening');await follower.pose([face+1.2,y,0]);await follower.pose([face-2,y,0]);
  await until(()=>latest(finder).owner===follower.welcome.id,'second owner');follower.ws.close();
  await until(()=>latest(finder).owner===null&&latest(finder).down===0,'disconnect resets the panel');
  check('disconnect releases the room for the next visitor',true);finder.ws.close();joined.ws.close();}
 const reads=jwksReads;for(const opts of [{layout:null,identity:null},{layout:1,identity:null},{identity:'stale-layout'}]){const bad=await bot(s,{...opts,id:legacyId,key:a.key});await until(()=>bad.closed,'mismatch close');check('v2 rejects '+JSON.stringify(opts)+' before replacing identity',bad.closed===4004&&!bad.welcome&&a.closed===null);}
 check('mismatch is rejected before identity-provider access',jwksReads===reads);
 // A player from Otherside: everything a Discord account gets, on the page's word, and so no verified dot.
 {const wallet='0xAbCdEf0123456789aBcDeF0123456789AbCdEf01',gale=await bot(s,{signed:false,glyph:{wallet,username:'Gale Cat'}});
  check('a wallet from Otherside gets full access under its Glyph name',gale.welcome?.you.verified===true&&gale.welcome?.you.name==='Gale Cat');
  const n=observer.msgs.length;gale.send({m:'chat',text:'Hello from Otherside'});const line=await until(()=>observer.msgs.slice(n).find(m=>m.m==='chat'&&m.text==='Hello from Otherside'),'glyph chat');
  check('a Glyph player can chat, with no verified dot',line.name==='Gale Cat'&&line.verified===false);
  const unnamed=await bot(s,{signed:false,glyph:{wallet:'0x1111111111111111111111111111111111111111'}});check('no username goes by the short wallet',unnamed.welcome?.you.name==='0x1111…1111'&&unnamed.welcome?.you.verified===true);
  for(const glyph of [{wallet:'0x12',username:'Bad'},{username:'None'},'nope']){const guest=await bot(s,{signed:false,glyph});check('without a usable wallet they stay a guest: '+JSON.stringify(glyph),guest.welcome?.you.verified===false);}
  const gale2=await bot(s,{signed:false,glyph:{wallet:wallet.toLowerCase(),username:'Gale Cat'}});await until(()=>gale.closed,'takeover');check('the same wallet elsewhere takes over, whatever its letter case',gale.closed===4002&&gale2.welcome?.you.verified===true);
  // walkotherside.html with no glyph:ready: a typed name gets the same access, on this browser's id.
  const tess=await bot(s,{signed:false,otherside:true,name:'Tess Cat'});check('a typed name from the Otherside page gets full access',tess.welcome?.you.verified===true&&tess.welcome?.you.typed===true&&tess.welcome?.you.name==='Tess Cat');
  const k=observer.msgs.length;tess.send({m:'chat',text:'Typed hello'});const said=await until(()=>observer.msgs.slice(k).find(m=>m.m==='chat'&&m.text==='Typed hello'),'typed chat');check('a typed-name player can chat, with no verified dot',said.name==='Tess Cat'&&said.verified===false);
  tess.send({m:'name',name:'Tess Two'});await sleep(150);const j=observer.msgs.length;await sleep(1100);tess.send({m:'chat',text:'Renamed hello'});const again=await until(()=>observer.msgs.slice(j).find(m=>m.m==='chat'&&m.text==='Renamed hello'),'renamed chat');check('a typed-name player can change their name',again.name==='Tess Two');
  const claim=await tess.ask({m:'claim'},m=>m.m==='claimed');check('a typed-name player cannot claim from the giveaway',claim.ok===false);
  const blank=await bot(s,{signed:false,otherside:true});check('a blank name on the Otherside page goes by Voyager',/^Voyager /.test(blank.welcome?.you.name||'')&&blank.welcome?.you.verified===true);
  const plain=await bot(s,{signed:false,name:'Plain'});check('walk.html guests still need Discord',plain.welcome?.you.verified===false);
  const site=await bot(s);check('Discord players are not marked typed',site.welcome?.you.verified===true&&!site.welcome?.you.typed);
  // A pass that is not taken says why, so the page forgets only one that was checked and found bad (net/live.js).
  const [h,p,sig]=(await sign('880000000000000901')).split('.'),forged=await bot(s,{pass:h+'.'+p+'.'+(sig[0]==='A'?'B':'A')+sig.slice(1)}),rotated=await bot(s,{pass:await sign('880000000000000902','retired-key')});
  check('a pass with a wrong signature, or by a key the provider no longer lists, is called bad',forged.welcome?.you.verified===false&&forged.welcome.you.pass==='bad'&&rotated.welcome?.you.verified===false&&rotated.welcome.you.pass==='bad');
  check('a guest and a verified player hear nothing about a pass',!('pass' in plain.welcome.you)&&!('pass' in site.welcome.you));forged.ws.close();rotated.ws.close();}
 const original=await a.ask({m:'treasure',op:'board'},m=>m.m==='treasure'&&m.op==='board');check('old aquarium record is the v2 personal best on the shared board',original.you?.ms===45678&&original.top.some(e=>e.ms===45678)&&!('course' in original)&&!('previousCourse' in original));
 const invasionHistory=await a.ask({m:'board'},m=>m.m==='board'),poolHistory=await a.ask({m:'board',game:'pool'},m=>m.m==='board'&&m.game==='pool'),mazeHistory=await a.ask({m:'maze',op:'board'},m=>m.m==='maze'&&m.op==='board');check('existing invasion, pool and maze scores remain visible and comparable',invasionHistory.you.score===900&&poolHistory.you.ms===80000&&mazeHistory.you.ms===12345);
 // Every relocated scoring station: valid game vs old/outside station. No score-formula change.
 for(const [name,at,badAt,game] of [['invasion arcade',now.arcade.invasion,old.arcade.invasion,'invasion'],['invasion telescope',now.telescope,[0,0,0],'invasion'],['pool arcade',now.arcade.pool,old.arcade.pool,'pool'],['pool table',now.pool,[old.pool[0],old.pool[1],old.pool[2]+5.5],'pool']]){
  const good=await bot(s),bad=await bot(s),left=await bot(s);await good.pose(at,{pl:true});await bad.pose(badAt,{pl:true});await left.pose(at,{pl:true});good.send({m:'play',game});bad.send({m:'play',game});left.send({m:'play',game});await left.pose([0,0,0],{pl:true});if(game==='pool')await sleep(POOL_FASTEST_S*1000+100);else await sleep(100);
  const score=game==='pool'?{m:'score',game,ms:POOL_FASTEST_S*1000,shots:30}:{m:'score',score:100,wave:1};const yes=await good.ask(score,m=>m.m==='scored'),no=await bad.ask(score,m=>m.m==='scored');check(name+' accepts current station and refuses old/outside station',yes.ok&&!no.ok);const leftResult=await left.ask(score,m=>m.m==='scored');check(name+' refuses a finish after leaving the station',!leftResult.ok);good.ws.close();bad.ws.close();left.ws.close();
 }
 const corner=await bot(s),cg=now.gymSpecs[0],cornerAt=cg.centre.map((x,i)=>x+(i===0?2.1:i===2?2.7:0));await corner.pose(cornerAt,{pl:true});const cornerReply=await corner.ask({m:'gym',e:'in'},m=>m.m==='gym');check('client-valid treadmill approach corner is accepted',cornerReply.e==='wait');corner.send({m:'gym',e:'off'});corner.ws.close();
 // One simultaneous gym round covers all six relocated treadmills and the arcade treadmill.
 const runners=[];for(const at of now.treadmills){const b=await bot(s);await b.pose(at,{pl:true});b.send({m:'gym',e:'in'});runners.push(b);}const absent=await bot(s);await absent.pose(old.treadmills[0],{pl:true});const cancelled=await absent.ask({m:'gym',e:'in'},m=>m.m==='gym');check('old treadmill position is refused despite playing flag',cancelled.e==='cancel');
 await until(()=>runners.every(b=>b.msgs.some(m=>m.m==='gym'&&m.e==='go')),'shared gym starts');for(const b of runners){const go=b.msgs.find(m=>m.m==='gym'&&m.e==='go');check('signed treadmill '+runners.indexOf(b)+' runs shared round',go.runners.length===7);b.send({m:'gym',e:'fell',round:go.round,t:.1,cleared:1});}await until(()=>runners.every(b=>b.msgs.some(m=>m.m==='gym'&&m.e==='results')),'shared gym results');check('all relocated treadmill runners receive same results',runners.every(b=>JSON.stringify(b.msgs.find(m=>m.m==='gym'&&m.e==='results'))===JSON.stringify(runners[0].msgs.find(m=>m.m==='gym'&&m.e==='results'))));
 // Maze: unchanged course length and time floor, but new start/finish frame.
 const maze=await bot(s),badMaze=await bot(s);await maze.pose(now.maze.start);maze.send({m:'maze',op:'start'});await badMaze.pose(old.maze.start);badMaze.send({m:'maze',op:'start'});await sleep(now.maze.fastest*1000+100);await maze.pose(now.maze.button);await badMaze.pose(now.maze.button);const mazeYes=await maze.ask({m:'maze',op:'finish',ms:now.maze.fastest*1000},m=>m.m==='maze'),mazeNo=await badMaze.ask({m:'maze',op:'finish',ms:now.maze.fastest*1000},m=>m.m==='maze');check('moved maze finishes; old start cannot award time',mazeYes.ok&&!mazeNo.ok&&now.maze.fastest===old.maze.fastest);
 // A run outlives a dropped link (live-core.mjs keepRuns): the same browser, back in time as the same player, has its
 // run again with the server's clock still running, and the finish is judged as ever. Nobody else gets it.
 {const back=b=>bot(s,{id:b.id,key:b.key}),drop=async b=>{b.ws.close();await until(()=>b.closed,'drop');};
  const poolAt=now.arcade.pool,invAt=now.arcade.invasion,poolMs=POOL_FASTEST_S*1000,mazeMs=now.maze.fastest*1000;
  const clear={m:'score',game:'pool',ms:poolMs,shots:30},points={m:'score',score:100,wave:1},pressed={m:'maze',op:'finish',ms:mazeMs},scored=m=>m.m==='scored',result=m=>m.m==='maze'&&m.op==='result';
  const playing=async(game,at)=>{const b=await bot(s);await b.pose(at,{pl:true});b.send({m:'play',game});await sleep(60);return b;};
  const running=async()=>{const b=await bot(s);await b.pose(now.maze.start);b.send({m:'maze',op:'start'});await sleep(60);return b;};
  let quick=await playing('pool',poolAt),hasty=await playing('pool',poolAt),walker=await running(),stray=await running(),away=await playing('invasion',invAt);
  const t0=Date.now();await drop(away);
  // Invasion has no shortest game, so its finishes can be tried at once.
  let v=await playing('invasion',invAt);await drop(v);v=await back(v);
  check('back aboard, a finish before any pose is refused: where they stood is not remembered',!(await v.ask(points,scored)).ok);
  await v.pose(invAt,{pl:true});check('and that finish used the run up',!(await v.ask(points,scored)).ok);
  v=await playing('invasion',invAt);await drop(v);v=await back(v);await v.pose([0,0,0],{pl:true});
  check('back aboard somewhere else, the finish is refused',!(await v.ask(points,scored)).ok);
  v=await playing('invasion',invAt);await drop(v);v=await back(v);await v.pose(invAt,{pl:true});const kept=await v.ask(points,scored);
  check('an invasion game survives a dropped link',kept.ok===true,JSON.stringify(kept));
  // The old socket still open when the same browser says hello again: a link that died unseen, or a second tab.
  const first=await playing('invasion',invAt),second=await back(first);await until(()=>first.closed,'takeover');await second.pose(invAt,{pl:true});
  check('the same browser taking over from its own open socket inherits the run',first.closed===4002&&(await second.ask(points,scored)).ok===true);
  v=await playing('invasion',invAt);await drop(v);const other=await bot(s,{id:v.id});await other.pose(invAt,{pl:true});const taken=await other.ask(points,scored);
  v=await back(v);await v.pose(invAt,{pl:true});const own=await v.ask(points,scored);
  check('another browser signed in as the same player does not inherit the run; their own browser, back in time, does',!taken.ok&&own.ok===true);
  v=await playing('invasion',invAt);await drop(v);v=await bot(s,{key:v.key});await v.pose(invAt,{pl:true});
  check('the same browser signed in as another player does not inherit the run',!(await v.ask(points,scored)).ok);
  // Pool and the maze have a shortest time, counted by the server from the first start: dropped part-way, not before.
  await sleep(Math.max(0,t0+3000-Date.now()));
  for(const b of [quick,hasty,walker,stray])await drop(b);quick=await back(quick);hasty=await back(hasty);walker=await back(walker);stray=await back(stray);
  await hasty.pose(poolAt,{pl:true});check('a reconnect buys no time: a clear said before the shortest game is refused',!(await hasty.ask(clear,scored)).ok);
  await sleep(Math.max(0,t0+4400-Date.now()));away=await back(away);await away.pose(invAt,{pl:true});
  check('a run is kept only so long: back after that, the finish is refused',!(await away.ask(points,scored)).ok);
  await sleep(Math.max(0,t0+mazeMs+200-Date.now()));await stray.pose(now.maze.start);await walker.pose(now.maze.button);const strayed=await stray.ask(pressed,result),ran=await walker.ask(pressed,result);
  check('a maze run survives a dropped link, and still ends only at the button',ran.ok===true&&!strayed.ok,JSON.stringify(ran));
  await sleep(Math.max(0,t0+poolMs+200-Date.now()));await quick.pose(poolAt,{pl:true});const cleared=await quick.ask(clear,scored);
  check('a pool game survives a dropped link, timed by the server from its first play',cleared.ok===true&&cleared.ms>=poolMs,JSON.stringify(cleared));}
 // Aquarium: real-speed poses visit every gem; sample the new course in the same world frame as the client.
 const swimmer=await bot(s);await swimmer.pose(now.aquarium.door);swimmer.send({m:'treasure',op:'start'});let q=[...v2.SWIM.entry],started=Date.now();await swimmer.pose(v2.swimWorld(q));
 const travel=async target=>{const n=Math.ceil(v2.distance(q,target)/.32),from=[...q];for(let i=1;i<=n;i++){await sleep(100);q=from.map((x,k)=>x+(target[k]-x)*i/n);await swimmer.pose(v2.swimWorld(q));}};
 for(const gem of v2.SWIM.gems)await travel([gem[0],gem[1]-v2.SWIM.offset,gem[2]]);await travel(v2.SWIM.chest);const treasureYes=await swimmer.ask({m:'treasure',op:'finish',ms:Date.now()-started},m=>m.m==='treasure'&&m.op==='result');check('all seven moved aquarium gems award a signed shared-board time',treasureYes.ok&&treasureYes.newBest,JSON.stringify(treasureYes));
 const shared=await a.ask({m:'treasure',op:'board'},m=>m.m==='treasure'&&m.op==='board');check('old and v2 aquarium times compete in one ranking',shared.you?.ms===45678&&shared.top.length===2&&shared.top[0].ms===Math.min(45678,treasureYes.ms)&&shared.top[1].ms===Math.max(45678,treasureYes.ms)&&shared.you.rank===shared.top.findIndex(e=>e.ms===45678)+1&&!('previousCourse' in shared));
 const badSwim=await bot(s);await badSwim.pose(old.aquarium.door);badSwim.send({m:'treasure',op:'start'});await badSwim.pose(now.aquarium.chest);const treasureNo=await badSwim.ask({m:'treasure',op:'finish',ms:2000},m=>m.m==='treasure'&&m.op==='result');check('old aquarium entrance cannot award a time',!treasureNo.ok);
 const invalid=await bot(s);await invalid.pose(now.aquarium.door);invalid.send({m:'treasure',op:'start'});await invalid.pose(old.aquarium.gems[0]);const oldGem=await invalid.ask({m:'treasure',op:'finish',ms:2000},m=>m.m==='treasure'&&m.op==='result');check('old world gem invalidates swim instead of counting',!oldGem.ok);
 const missing=await bot(s);await missing.pose(now.aquarium.door);missing.send({m:'treasure',op:'start'});await missing.pose(now.aquarium.entry);const miss=await missing.ask({m:'treasure',op:'finish',ms:2000},m=>m.m==='treasure'&&m.op==='result');check('missing gems cannot finish',!miss.ok);
 // Calls use the current car envelope and the original lift motion rules.
 for(const lift of now.lifts){const driver=await bot(s),stop=0,c=lift.car,from=driver.msgs.length;await driver.pose([c.x,c.stops?.[0]?.y??lift.stops[0].y,c.z]);driver.send({m:'call',lift:lift.id,stop,now:true});await until(()=>driver.msgs.slice(from).some(m=>m.m==='lift'&&m.id===lift.id),'lift '+lift.id);check('signed current landing controls '+lift.id,true);driver.ws.close();}
 const freight=now.lifts.find(l=>l.id==='aft-service'),f=await bot(s);check('freight dimensions match client v2',freight.car.width===7.2&&freight.door.width===5.8&&old.lifts.find(l=>l.id===freight.id).car.width===3.6);await f.pose([freight.car.x+3,freight.stops[0].y,freight.car.z]);let n=f.msgs.length;f.send({m:'call',lift:freight.id,stop:1,now:true});await until(()=>f.msgs.slice(n).some(m=>m.m==='lift'&&m.id===freight.id),'wide freight call');check('wide freight car side can call next stop',true);await f.pose([0,0,0]);n=f.msgs.length;f.send({m:'call',lift:freight.id,stop:2,now:true});await sleep(150);check('remote freight call is refused',!f.msgs.slice(n).some(m=>m.m==='lift'&&m.id===freight.id&&m.s.calls.includes(2)));
 const cart=await bot(s);await cart.pose(now.transporters[0].at);let got=await cart.ask({m:'mct',e:'take',i:0},m=>m.m==='mcts');check('current transporter bay can take driver seat',got.carts[0].d===cart.welcome.id);got=await cart.ask({m:'mct',e:'park',i:0,at:now.transporters[0].at,yaw:0},m=>m.m==='mcts');check('v2 transporter parks on deck 1',got.carts[0].at[2]===+now.transporters[0].at[2].toFixed(2));await cart.ask({m:'mct',e:'take',i:0},m=>m.m==='mcts');got=await cart.ask({m:'mct',e:'park',i:0,at:[0,20.3,0],yaw:0},m=>m.m==='mcts');check('transporter rejects off-deck update',got.carts[0].at[1]===-39.7);
 await observer.pose(now.ball);await a.pose(now.ball,{b:true});await until(()=>observer.poses.get(a.welcome.id)?.ball,'ball pose');check('moved hamster ball relays as ball (no server scoring gate)',observer.poses.get(a.welcome.id).ball===true);await a.pose(now.ball,{b:'yes'});await until(()=>observer.poses.get(a.welcome.id)?.ball===false,'invalid ball flag');check('invalid ball flag does not become riding state',true);
 await observer.pose(now.selfie);await a.pose([0,0,0]);n=observer.msgs.length;a.send({m:'selfie'});await sleep(150);check('outside selfie range cannot trigger countdown',!observer.msgs.slice(n).some(m=>m.m==='selfie'));await a.pose(now.selfie);a.send({m:'selfie'});await until(()=>observer.msgs.slice(n).some(m=>m.m==='selfie'),'selfie countdown');check('unchanged selfie location still starts countdown',true);
 await sleep(1200);const saved=JSON.parse(await fs.readFile(path.join(dir,'treasure.json'),'utf8'));check('v2 write preserves existing record values and stores no course tags',JSON.stringify(saved.find(e=>e.id===legacyId))===JSON.stringify(legacy[0])&&saved.some(e=>e.id===swimmer.id&&e.ms===treasureYes.ms)&&saved.every(e=>!('course' in e)));
 const keptScores=JSON.parse(await fs.readFile(path.join(dir,'scores.json'),'utf8')),keptMaze=JSON.parse(await fs.readFile(path.join(dir,'maze.json'),'utf8'));check('new awards preserve existing score and maze record values',historicScores.every(e=>JSON.stringify(keptScores.find(x=>x.id===e.id&&x.game===e.game))===JSON.stringify(e))&&JSON.stringify(keptMaze.find(e=>e.id===legacyId))===JSON.stringify(historicMaze[0]));
 // Ask to join (server/joins.mjs, protocol 10): the Aboard list says who is who; a request is accepted, declined, lets
 // its 2 s run out (LEO_LIVE_JOIN_S here), is cancelled or goes with either side; the place given on accept is public.
 {const joinFrom=(b,n,test)=>until(()=>b.msgs.slice(n).find(m=>m.m==='join'&&test(m)),'join reply');
  const quiet=async(b,n)=>{await sleep(250);return !b.msgs.slice(n).some(m=>m.m==='join');};
  const host=await bot(s,{name:'Host'}),guest=await bot(s,{name:'Guest'});await host.pose(now.selfie);await guest.pose([0,0,0]);
  const list=await until(()=>[...guest.msgs].reverse().find(m=>m.m==='aboard'&&m.ids?.includes(host.welcome.id)),'aboard ids');
  check('the Aboard list gives each name its visitor id, in order',Array.isArray(list.ids)&&list.ids.length===list.names.length&&list.names[list.ids.indexOf(host.welcome.id)]===host.welcome.you.name);
  let n=guest.msgs.length,h=host.msgs.length;guest.send({m:'join',op:'ask',to:host.welcome.id});
  const sent=await joinFrom(guest,n,m=>m.e==='sent'),asked=await joinFrom(host,h,m=>m.e==='ask');
  check('an ask reaches the one asked with the asker\'s name and id',sent.to===host.welcome.id&&asked.from===guest.welcome.id&&asked.req===sent.req&&asked.name===guest.welcome.you.name&&asked.ms===2000);
  n=guest.msgs.length;h=host.msgs.length;const stranger=await bot(s);stranger.send({m:'join',op:'answer',req:asked.req,ok:true});
  check('only the one asked can answer',await quiet(guest,n));
  host.send({m:'join',op:'answer',req:asked.req,ok:true});const go=await joinFrom(guest,n,m=>m.e==='go'),done=await joinFrom(host,h,m=>m.e==='done');
  check('accepted: the asker is told where the host stands',go.req===sent.req&&go.at.every((v,i)=>Math.abs(v-now.selfie[i])<.01)&&done.from===guest.welcome.id);
  n=guest.msgs.length;host.send({m:'join',op:'answer',req:asked.req,ok:true});check('a request is answered once',await quiet(guest,n));
  // Declined, then asked again at once: refused for a minute.
  n=guest.msgs.length;h=host.msgs.length;guest.send({m:'join',op:'ask',to:host.welcome.id});const again=await joinFrom(host,h,m=>m.e==='ask');
  host.send({m:'join',op:'answer',req:again.req,ok:false});check('declined: the asker hears no',(await joinFrom(guest,n,m=>m.e==='no')).why==='declined');
  n=guest.msgs.length;guest.send({m:'join',op:'ask',to:host.welcome.id});check('asking again right after a no is refused',(await joinFrom(guest,n,m=>m.e==='no')).why==='again');
  // Unanswered: both sides hear it ran out.
  const late=await bot(s,{name:'Late'});n=late.msgs.length;h=host.msgs.length;late.send({m:'join',op:'ask',to:host.welcome.id});
  const lateAsk=await joinFrom(host,h,m=>m.e==='ask');
  const ranOut=await joinFrom(late,n,m=>m.e==='no'),hostOut=await joinFrom(host,h,m=>m.e==='off');
  check('unanswered: it runs out for both',ranOut.why==='expired'&&hostOut.why==='expired'&&hostOut.req===lateAsk.req);
  n=late.msgs.length;host.send({m:'join',op:'answer',req:lateAsk.req,ok:true});check('a request that ran out cannot be accepted',await quiet(late,n));
  // Cancelled by the asker.
  const shy=await bot(s,{name:'Shy'});n=shy.msgs.length;h=host.msgs.length;shy.send({m:'join',op:'ask',to:host.welcome.id});await joinFrom(host,h,m=>m.e==='ask');
  shy.send({m:'join',op:'cancel'});check('cancelled: the one asked is told and the asker hears it went',(await joinFrom(host,h,m=>m.e==='off')).why==='cancelled'&&(await joinFrom(shy,n,m=>m.e==='no')).why==='cancelled');
  // Either side leaves.
  const leaver=await bot(s);h=host.msgs.length;leaver.send({m:'join',op:'ask',to:host.welcome.id});await joinFrom(host,h,m=>m.e==='ask');leaver.ws.close();
  check('the asker leaves: the one asked is told',(await joinFrom(host,h,m=>m.e==='off')).why==='gone');
  const left=await bot(s),waiter=await bot(s);await left.pose(now.selfie);n=waiter.msgs.length;waiter.send({m:'join',op:'ask',to:left.welcome.id});await joinFrom(waiter,n,m=>m.e==='sent');left.ws.close();
  check('the one asked leaves: the asker is told',(await joinFrom(waiter,n,m=>m.e==='no')).why==='gone');
  // Never into a restricted area, a lift shaft or a game: the one asked is told why, the asker hears busy.
  const club=now.restricted.find(z=>z.name==='clubhouse'),lift=now.lifts[0],cx=club.poly.reduce((s,p)=>s+p[0],0)/club.poly.length,cz=club.poly.reduce((s,p)=>s+p[1],0)/club.poly.length;
  for(const [where,pos,extra] of [['the clubhouse',[cx,club.y[0]+.5,cz],{}],['a lift shaft',[lift.car.x,lift.stops[1].y,lift.car.z],{}],['a game',now.selfie,{pl:true}],['the maze',now.maze.button,{}]]){
   const busy=await bot(s),asker=await bot(s);await busy.pose(pos,extra);n=asker.msgs.length;h=busy.msgs.length;asker.send({m:'join',op:'ask',to:busy.welcome.id});
   const r=await joinFrom(busy,h,m=>m.e==='ask');busy.send({m:'join',op:'answer',req:r.req,ok:true});
   check('accepting in '+where+' sends nobody',(await joinFrom(asker,n,m=>m.e==='no')).why==='busy'&&(await joinFrom(busy,h,m=>m.e==='off')).why==='busy');busy.ws.close();asker.ws.close();}
  check('policy: the selfie booth and the maze\'s way in are public; inside the maze, the tank bay and the clubhouse are not',
   v2.policy.canJoin(now.selfie)&&v2.policy.canJoin(now.maze.start)&&!v2.policy.canJoin(now.maze.button)&&!v2.policy.canJoin([cx,club.y[0]+.5,cz])&&!v2.policy.canJoin([-180,-27.7,0])&&!v2.policy.canJoin(null));
  // Limits: yourself, nobody, three asking one visitor, and three asks in 30 s.
  n=guest.msgs.length;guest.send({m:'join',op:'ask',to:guest.welcome.id});check('asking yourself is refused',(await joinFrom(guest,n,m=>m.e==='no')).why==='self');
  const popular=await bot(s),fans=[];for(let i=0;i<4;i++)fans.push(await bot(s));await popular.pose(now.selfie);
  for(const f of fans.slice(0,3)){const k=f.msgs.length;f.send({m:'join',op:'ask',to:popular.welcome.id});await joinFrom(f,k,m=>m.e==='sent');}
  n=fans[3].msgs.length;fans[3].send({m:'join',op:'ask',to:popular.welcome.id});check('a fourth asking the same visitor at once is refused',(await joinFrom(fans[3],n,m=>m.e==='no')).why==='busy');
  const eager=await bot(s),targets=[];for(let i=0;i<4;i++)targets.push(await bot(s));
  for(let i=0;i<3;i++){const k=eager.msgs.length;eager.send({m:'join',op:'ask',to:targets[i].welcome.id});await joinFrom(eager,k,m=>m.e==='sent');}
  n=eager.msgs.length;eager.send({m:'join',op:'ask',to:targets[3].welcome.id});check('only three asks in 30 s',(await joinFrom(eager,n,m=>m.e==='no')).why==='slow');
  n=guest.msgs.length;guest.send({m:'join',op:'ask',to:'nobody-here'});check('asking someone not aboard is refused',(await joinFrom(guest,n,m=>m.e==='no')).why==='unknown');
  for(const b of [host,guest,stranger,late,shy,waiter,popular,...fans,eager,...targets])b.ws.close();}
 // A page from before protocol 10 is told to reload.
 {const ws=new WebSocket('ws://127.0.0.1:'+s.port+'/live',{origin:'http://localhost:4180'}),got=[];let code=null;ws.on('message',d=>got.push(JSON.parse(d)));ws.on('close',c=>code=c);await new Promise(r=>ws.once('open',r));
  ws.send(JSON.stringify({m:'hello',v:PROTOCOL-1,layout:2,layoutIdentity:now.identity,key:randomBytes(32).toString('hex')}));await until(()=>code!==null,'old page closed');
  check('a protocol '+(PROTOCOL-1)+' page is told to reload',PROTOCOL===10&&got.some(m=>m.m==='reload')&&code===4000);}
 for(const b of bots)b.ws.close();await stop(s);
 // A server started while the identity provider is unreachable has no keys: a good pass is unchecked, not bad, the
 // visitor comes aboard unverified with their login intact, and the same pass is taken once the keys can be had.
 {keysDown=true;const dark=await start(2,path.join(tmp,'no-keys')),who='880000000000000903',pass=await sign(who),early=await bot(dark,{id:who,pass});
  // The server's log line can reach this process a moment after the welcome does: wait for it, up to the usual 10 s.
  await until(()=>dark.log().includes('pass not checked'),'the unchecked pass in the server log').catch(()=>{});
  check('with no keys from the provider a good pass is unchecked, not bad',early.welcome?.you.verified===false&&early.welcome.you.pass==='unchecked'&&dark.log().includes('pass not checked'));
  keysDown=false;const later=await bot(dark,{id:who,key:early.key,pass});check('the same pass is taken once the provider answers',later.welcome?.you.verified===true&&!('pass' in later.welcome.you));
  early.ws.close();later.ws.close();await stop(dark);}
 const one=await start(1,dir),before=await fs.readFile(path.join(dir,'treasure.json'),'utf8'),accepted=await bot(one,{layout:null,identity:null,id:legacyId,protocol:V1_PROTOCOL});check('v1 still accepts an unversioned v1 client',accepted.welcome?.you.verified);const mismatch=await bot(one,{id:legacyId,key:accepted.key});await until(()=>mismatch.closed,'v1 rejects v2');check('v1 rejects v2 before replacing its signed player',mismatch.closed===4004&&accepted.closed===null);const v1Board=await accepted.ask({m:'treasure',op:'board'},m=>m.m==='treasure'&&m.op==='board');check('v1 restart reads the same shared aquarium ranking without changing stored data',v1Board.you.ms===45678&&JSON.stringify(v1Board.top)===JSON.stringify(shared.top)&&!('previousCourse' in v1Board)&&(await fs.readFile(path.join(dir,'treasure.json'),'utf8'))===before);accepted.ws.close();await stop(one);
 await fs.mkdir('output/launch-h',{recursive:true});await fs.writeFile('output/launch-h/spatial-inventory.json',JSON.stringify({v1:old,v2:now},null,2));await fs.writeFile('output/launch-h/spatial-checks.json',JSON.stringify({status:'PASS',checks:results,scope:'Real local signed players through current server rules; no production connections'},null,2));console.log('All '+results.length+' v2 spatial checks passed');
}finally{for(const b of bots)b.ws.close();for(const p of children)if(p.exitCode===null&&p.signalCode===null)p.kill();await new Promise(r=>keys.close(r));await Promise.all(children.map(p=>p.exitCode!==null||p.signalCode!==null?Promise.resolve():new Promise(r=>p.once('exit',r))));const resolved=path.resolve(tmp);assert(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('leo-stream-h-'));await fs.rm(resolved,{recursive:true,force:true});}
