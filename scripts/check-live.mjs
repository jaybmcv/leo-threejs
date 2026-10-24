// npm run check:live: Leo live (server/leo-live.mjs) against scripted visitors. Starts real servers on spare ports and
// checks the pose wire, joining, poses reaching others near and far, names, the shared lifts, pings, leaving, a second tab,
// bad input, the cap on visitors, Leo passes (Discord identity from The Creamery, net/pass.js: here signed by a
// stand-in key served as a local JWKS), Alien Cat Invasion's leaderboard and, last, sixty visitors walking at once (bytes
// sent per visitor per second). Each server keeps its scores in a temporary file, never the real board.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {encodeRecord,encodeIdentity,assembleFrame,decodeFrame,WireReader,actorIdOf,PROTOCOL} from '../src/walk/net/wire.js';
import {LIFTS} from '../src/walk/lifts.js';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {keySet,verifyPass,readPass} from '../src/walk/net/pass.js';

const results=[];let failed=0;
const check=(what,ok,detail='')=>{results.push(`${ok?'PASS':'FAIL'} ${what}${detail?' · '+detail:''}`);if(!ok)failed++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---- the wire on its own --------------------------------------------------------------------------------------
{
 const poses=[{pos:[12.5,-3.7,-40.25],yaw:1.2,grounded:true,stance:'stand',jumpCount:0,jumpS:-1,rise:0,emote:null,rest:null},
  {pos:[-279.99,131.2,99.5],yaw:-3.1,grounded:false,stance:'crouch',jumpCount:2,jumpS:.42,rise:-3.25,emote:'dance',rest:null},
  {pos:[120.7,16.43,5.4],yaw:0,grounded:true,stance:'stand',jumpCount:0,jumpS:-1,rise:0,emote:null,rest:'lie'}];
 const frame=assembleFrame([encodeIdentity(7,'voyager-abc','Jay')],poses.map((p,i)=>encodeRecord(7+i,p)));
 const back=decodeFrame(frame);
 const close=back&&back.poses.every(({pose},i)=>pose.pos.every((v,k)=>Math.abs(v-poses[i].pos[k])<.0002)&&Math.abs(Math.atan2(Math.sin(pose.yaw-poses[i].yaw),Math.cos(pose.yaw-poses[i].yaw)))<.0002
  &&pose.stance===poses[i].stance&&pose.jumpCount===poses[i].jumpCount&&Math.abs(pose.jumpS-poses[i].jumpS)<.001&&Math.abs(pose.rise-poses[i].rise)<.004&&pose.emote===poses[i].emote&&pose.rest===poses[i].rest&&pose.grounded===poses[i].grounded);
 check('wire: poses come back as sent',!!close,`${frame.length} bytes for 3 poses and a name`);
 check('wire: a still walking pose is 14 bytes',encodeRecord(1,poses[0]).length===14);
 const playing=decodeFrame(assembleFrame([],[encodeRecord(1,{...poses[0],playing:true}),encodeRecord(2,poses[0])]));
 check('wire: a pose says when its visitor is playing Alien Cat Invasion',playing?.poses[0].pose.playing===true&&playing.poses[1].pose.playing===false);
 const torn=[frame.slice(0,frame.length-1),Uint8Array.of(0x4c,9,0,0,0,0),randomBytes(40)];
 check('wire: torn, foreign and random frames are dropped',torn.every(f=>decodeFrame(f)===null));
 let threw=0;for(const bad of [{...poses[0],pos:[NaN,0,0]},{...poses[0],pos:[1e6,0,0]},{...poses[0],stance:'fly'},{...poses[0],jumpCount:9}])try{encodeRecord(1,bad);}catch{threw++;}
 check('wire: out-of-range poses are refused',threw===4);
 const reader=new WireReader();
 check('wire: a pose from a slot never introduced is skipped',reader.read(assembleFrame([],[encodeRecord(3,poses[0])])).length===0);
}

// ---- Leo passes on their own --------------------------------------------------------------------------------------
const b64u=b=>Buffer.from(b).toString('base64url');
async function issuer(kid='test-1'){
 const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
 return {kid,jwks:{keys:[{kty:'OKP',crv:'Ed25519',x:jwk.x,kid,alg:'EdDSA',use:'sig'}]},
  async sign(claims,header={}){const h=b64u(JSON.stringify({alg:'EdDSA',kid,typ:'JWT',...header})),p=b64u(JSON.stringify(claims));
   return `${h}.${p}.${b64u(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(h+'.'+p)))}`;}};
}
const ISS='http://127.0.0.1',AUD='leo.marscatsvoyage.com',nowS=()=>Math.floor(Date.now()/1000);
const claimsFor=(id,name,extra={})=>({iss:ISS,aud:AUD,sub:'discord:'+id,discord:{id,username:name.toLowerCase().replace(/ /g,''),global_name:name,avatar:null},
 wallets:['0x'+'ab'.repeat(20)],iat:nowS(),exp:nowS()+600,jti:randomBytes(8).toString('hex'),...extra});
const creamery=await issuer();
{
 const other=await issuer('other-1'),key=keySet('mem',{fetcher:async()=>({ok:true,json:async()=>creamery.jwks})}),opts={key,iss:ISS,aud:AUD};
 const good=await creamery.sign(claimsFor('222222222222222222','Leo Test Cat'));
 const who=await verifyPass(good,opts);
 check("pass: a pass signed by The Creamery's key is accepted",who?.discordId==='222222222222222222'&&who.name==='Leo Test Cat'&&who.wallets.length===1);
 const [h,p,sig]=good.split('.'),c=readPass(good),tampered=`${h}.${b64u(JSON.stringify({...c,discord:{...c.discord,global_name:'Someone Else'}}))}.${sig}`;
 const bad={
  'tampered claims':tampered,
  'another key':await other.sign(claimsFor('222222222222222222','Leo Test Cat'),{kid:'test-1'}),
  'an unknown key id':await other.sign(claimsFor('222222222222222222','Leo Test Cat')),
  'expired':await creamery.sign(claimsFor('1234567','A',{iat:nowS()-1300,exp:nowS()-700})),
  'issued in the future':await creamery.sign(claimsFor('1234567','A',{iat:nowS()+600,exp:nowS()+1200})),
  'another audience':await creamery.sign(claimsFor('1234567','A',{aud:'reach.marscatsvoyage.com'})),
  'another issuer':await creamery.sign(claimsFor('1234567','A',{iss:'https://evil.example'})),
  'a sub that is not its Discord id':await creamery.sign(claimsFor('1234567','A',{sub:'discord:7654321'})),
  'alg none':`${b64u(JSON.stringify({alg:'none',kid:'test-1'}))}.${p}.`,
  'garbage':'not.a.pass',
 };
 const accepted=[];for(const [what,t] of Object.entries(bad))if(await verifyPass(t,opts))accepted.push(what);
 check('pass: tampered, foreign-key, expired, wrong-audience/issuer, alg-none and malformed passes are refused',accepted.length===0,accepted.length?'accepted: '+accepted.join(', '):`${Object.keys(bad).length} kinds refused`);
}
const jwksServer=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(creamery.jwks));});
await new Promise(r=>jwksServer.listen(0,'127.0.0.1',r));
const PASS_ENV={LEO_PASS_JWKS_URL:`http://127.0.0.1:${jwksServer.address().port}/keys.json`,LEO_PASS_ISS:ISS};

// ---- a server and some visitors -----------------------------------------------------------------------------------
const scoresFile=port=>path.join(os.tmpdir(),`leo-live-scores-check-${port}.json`);
function startServer(port,env={}){
 const child=spawn(process.execPath,['server/leo-live.mjs'],{env:{...process.env,PORT:String(port),...PASS_ENV,LEO_LIVE_SCORES:scoresFile(port),...env},stdio:['ignore','pipe','pipe']});
 child.log='';child.stdout.on('data',d=>{child.log+=d;});
 return new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(/Leo live on/.test(d))resolve(child);});child.on('exit',c=>reject(new Error('server exited '+c)));setTimeout(()=>reject(new Error('server did not start')),10000);});
}
class Bot{
 constructor(port,{name='',key=randomBytes(32).toString('hex'),origin='http://localhost:4180',v=PROTOCOL,pass,invite,hat}={}){
  Object.assign(this,{key,name,poses:new Map(),frames:0,bytes:0,msgs:[],gone:[],lifts:[],closed:null,reader:new WireReader(),got:new Map()});
  this.ws=new WebSocket(`ws://127.0.0.1:${port}/live`,{origin});
  this.opened=new Promise((resolve,reject)=>{this.ws.on('open',()=>{this.ws.send(JSON.stringify({m:'hello',v,key,name,pass,invite,hat}));resolve();});this.ws.on('error',reject);this.ws.on('unexpected-response',(q,res)=>reject(new Error('HTTP '+res.statusCode)));});
  this.ws.on('message',(data,binary)=>{
   if(binary){this.frames++;this.bytes+=data.length;for(const p of this.reader.read(data)){this.poses.set(p.id,p);this.got.set(p.id,(this.got.get(p.id)||0)+1);}return;}
   const msg=JSON.parse(data);this.msgs.push(msg);if(msg.m==='welcome')this.id=msg.id;if(msg.m==='gone')this.gone.push(msg.id);if(msg.m==='lift')this.lifts.push(msg);
  });
  this.ws.on('close',code=>{this.closed=code;});
 }
 async welcomed(){await this.opened;for(let i=0;i<100&&!this.id&&this.closed===null;i++)await sleep(30);return this.id;}
 pose(pos,extra={}){this.ws.send(JSON.stringify({m:'pose',p:{pos,yaw:0,g:true,st:'stand',jc:0,js:-1,r:0,e:null,rest:null,...extra}}));}
 send(msg){this.ws.send(JSON.stringify(msg));}
 close(){this.ws.close();}
}
const PORT=18090+Math.floor(Math.random()*500);
const server=await startServer(PORT);
try{
 // Joining.
 const a=new Bot(PORT,{name:'  Jay‮  cat\u0007 '}),b=new Bot(PORT,{name:'Bea'});
 await a.welcomed();await b.welcomed();
 check('join: a visitor\'s id is proved by their key',a.id===await actorIdOf(a.key)&&/^voyager-[0-9a-f]{20}$/.test(a.id));
 const health=await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
 check('join: /health counts those aboard',health.aboard===2,JSON.stringify(health));
 const evil=new Bot(PORT,{origin:'https://evil.example'});let refused=false;await evil.opened.catch(()=>{refused=true;});
 check('join: a page from another site is turned away',refused);
 const stale=new Bot(PORT,{v:PROTOCOL+1});await stale.opened;await sleep(300);
 check('join: a page from another build is told to reload',stale.msgs.some(m=>m.m==='reload')&&stale.closed!==null);
 const silent=new WebSocket(`ws://127.0.0.1:${PORT}/live`,{origin:'http://localhost:4180'});let silentClosed=false;silent.on('close',()=>{silentClosed=true;});
 // Poses reaching others.
 for(let i=0;i<10;i++){a.pose([100+i*.2,-3.7,0]);b.pose([104,-3.7,0]);await sleep(100);}
 await sleep(200);
 const seen=b.poses.get(a.id);
 check('poses: a near visitor\'s pose arrives',!!seen&&Math.abs(seen.pos[0]-101.8)<.01,seen?seen.pos.map(v=>v.toFixed(3)).join(','):'none');
 check('names: control and direction characters are cleaned out',seen?.name==='Jay cat',JSON.stringify(seen?.name));
 a.send({m:'name',name:'Jay B'});await sleep(150);a.pose([102,-3.7,1]);await sleep(250);
 check('names: a new name reaches others',b.poses.get(a.id)?.name==='Jay B');
 // Near and far: a visitor 200 m off hears about a moving one twice a second, a near one ten times.
 const far=new Bot(PORT,{name:'Far'});await far.welcomed();far.pose([-100,-3.7,0]);b.got.clear();far.got.clear();
 for(let i=0;i<30;i++){a.pose([100+i*.3,-3.7,0]);b.pose([104,-3.7,0]);far.pose([-100,-3.7,0]);await sleep(100);}
 const nearRate=(b.got.get(a.id)||0)/3,farRate=(far.got.get(a.id)||0)/3;
 check('poses: near visitors hear every pose, far ones twice a second',nearRate>=7&&farRate>=1.5&&farRate<=3,`near ${nearRate.toFixed(1)}/s, far ${farRate.toFixed(1)}/s`);
 // Bad input.
 const before=b.poses.get(a.id).pos[0];
 for(const bad of [[NaN,0,0],[9999,0,0],'x',[1,2]])a.send({m:'pose',p:{pos:bad,yaw:0}});
 a.send({m:'pose',p:{pos:[1,1,1],yaw:'north'}});await sleep(300);
 check('input: malformed and out-of-ship poses are ignored',Math.abs(b.poses.get(a.id).pos[0]-before)<.01);
 for(let i=0;i<300;i++)a.pose([100+i*.01,-3.7,0]);
 await sleep(400);
 const h2=await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
 check('input: a flood of poses is rate-limited and the server carries on',h2.ok&&a.closed===null);
 a.ws.send('x'.repeat(5000));await sleep(200);
 check('input: an oversized message ends the connection',a.closed!==null);
 const a2=new Bot(PORT,{key:a.key,name:'Jay'});await a2.welcomed();
 check('join: the same visitor back gets the same id',a2.id===a.id);
 check('leave: others are told when someone goes',b.gone.includes(a.id));
 // A second tab.
 const tab=new Bot(PORT,{key:a2.key});await tab.welcomed();await sleep(200);
 check('join: opening Leo in a second tab takes over from the first',a2.msgs.some(m=>m.m==='replaced')&&a2.closed!==null&&!!tab.id);
 // Lifts: a call reaches everyone and the car comes.
 const spec=LIFTS.find(l=>l.id==='forward-port'),stop=spec.stops.findIndex(s=>s.deck===14);
 const welcome=b.msgs.find(m=>m.m==='welcome');
 check('lifts: a visitor joins with every car\'s state',welcome.lifts.length===LIFTS.length);
 tab.send({m:'call',lift:'forward-port',stop});await sleep(300);
 const told=b.lifts.find(l=>l.id==='forward-port'&&l.s.calls.includes(stop));
 check('lifts: a call reaches everyone aboard',!!told);
 let arrived=null;for(let i=0;i<120&&!arrived;i++){await sleep(100);arrived=b.lifts.find(l=>l.id==='forward-port'&&l.s.at===stop&&l.s.phase==='opening');}
 check('lifts: the car comes to the landing that called it',!!arrived&&!arrived.s.calls.includes(stop),arrived?`after ${(b.lifts.indexOf(arrived))} updates`:'never');
 tab.send({m:'call',lift:'forward-port',stop:999});tab.send({m:'call',lift:'nowhere',stop:1});await sleep(200);
 check('lifts: calls to stops that do not exist are ignored',tab.closed===null);
 // Pings: passed on to everyone else, checked, and only so many.
 tab.send({m:'mark',at:[10.123,-3.7,2]});await sleep(200);
 const marks=()=>b.msgs.filter(m=>m.m==='mark'&&m.id===tab.id);
 check('pings: a ping reaches others aboard, not its sender',marks().some(m=>m.at[0]===10.12&&m.at[1]===-3.7)&&!tab.msgs.some(m=>m.m==='mark'));
 tab.send({m:'mark',at:[9999,0,0]});tab.send({m:'mark',at:'here'});tab.send({m:'mark'});await sleep(200);
 check('pings: a ping outside the ship or malformed is ignored',marks().length===1);
 for(let i=0;i<10;i++)tab.send({m:'mark',at:[11,-3.7,2]});await sleep(300);
 check('pings: a flood of pings is rate-limited',marks().length<=3&&tab.closed===null,`${marks().length} passed on`);
 check('join: a socket that never says hello is closed',await (async()=>{for(let i=0;i<40&&!silentClosed;i++)await sleep(200);return silentClosed;})());
 for(const bot of [b,far,tab])bot.close();
}finally{server.kill();}

// ---- Discord identity through a pass, on a server of its own ----------------------------------------------------
{
 const port=PORT+3,srv=await startServer(port);
 try{
  const pass=await creamery.sign(claimsFor('333333333333333333','Bea Cat'));
  const bea=new Bot(port,{name:'typed name',pass,invite:'SPRING-01',hat:true}),watch=new Bot(port,{name:'Watcher'}),forged=new Bot(port,{name:'Plain',pass:pass.slice(0,-4)+'AAAA'});
  for(const b of [bea,watch,forged])await b.welcomed();
  for(let i=0;i<5;i++){bea.pose([10,-3.7,0]);forged.pose([12,-3.7,0]);watch.pose([11,-3.7,0]);await sleep(100);}
  await sleep(200);
  const seenBea=watch.poses.get(bea.id),seenForged=watch.poses.get(forged.id);
  check('identity: a verified visitor goes by their Discord name, marked verified',seenBea?.name==='Bea Cat'&&seenBea.verified===true,JSON.stringify({name:seenBea?.name,verified:seenBea?.verified}));
  check('identity: the server tells a verified visitor how they are aboard',bea.msgs.find(m=>m.m==='welcome')?.you?.verified===true);
  check('identity: a forged pass leaves the visitor anonymous with their own name',seenForged?.name==='Plain'&&!seenForged.verified);
  check("hat: a tester's captain's hat reaches others, and nobody else gets one",seenBea?.hat===true&&seenForged?.hat===false);
  bea.send({m:'name',name:'Impostor'});await sleep(150);bea.pose([10.5,-3.7,0]);await sleep(250);
  check('identity: a verified visitor cannot rename themselves',watch.poses.get(bea.id)?.name==='Bea Cat');
  check('invites: an invite used by a verified visitor is logged with who used it',/invite SPRING-01 used by discord:333333333333333333 beacat 0xabab/.test(srv.log));
  const bea2=new Bot(port,{pass:await creamery.sign(claimsFor('333333333333333333','Bea Cat'))});await bea2.welcomed();await sleep(250);
  check('identity: the same Discord account in another browser takes over from the first',bea.msgs.some(m=>m.m==='replaced')&&!!bea2.id);
  [watch,forged,bea2].forEach(b=>b.close());
 }finally{srv.kill();}
}

// ---- Alien Cat Invasion's leaderboard, on a server of its own -------------------------------------------------------
{
 const port=PORT+4;fs.rmSync(scoresFile(port),{force:true});let srv=await startServer(port);
 const last=(bot,m)=>[...bot.msgs].reverse().find(x=>x.m===m);
 const ask=async(bot,msg,m)=>{const n=bot.msgs.length;bot.send(msg);for(let i=0;i<40&&!bot.msgs.slice(n).some(x=>x.m===m);i++)await sleep(25);return last(bot,m);};
 try{
  const guest=new Bot(port,{name:'Guest'}),bea=new Bot(port,{pass:await creamery.sign(claimsFor('444444444444444444','Bea Cat'))}),
   cal=new Bot(port,{pass:await creamery.sign(claimsFor('555555555555555555','Cal Cat'))}),dee=new Bot(port,{pass:await creamery.sign(claimsFor('666666666666666666','Dee Cat'))});
  for(const b of [guest,bea,cal,dee])await b.welcomed();
  guest.send({m:'play'});await sleep(50);
  check("board: a guest's score is not kept, and they are told to sign in",(await ask(guest,{m:'score',score:100,wave:1},'scored'))?.why==='sign-in');
  const empty=await ask(guest,{m:'board'},'board');
  check('board: a guest sees the board, marked not signed in',empty?.verified===false&&Array.isArray(empty.top)&&empty.top.length===0);
  bea.send({m:'play'});await sleep(400);const first=await ask(bea,{m:'score',score:100,wave:1},'scored');
  check("board: a signed-in player's score is kept as their best",first?.ok===true&&first.newBest===true&&first.best===100&&first.rank===1,JSON.stringify(first));
  check('board: a score with no game started is refused',(await ask(bea,{m:'score',score:60,wave:1},'scored'))?.why==='rejected');
  cal.send({m:'play'});await sleep(50);check('board: a score too high for the time played is refused',(await ask(cal,{m:'score',score:5000,wave:1},'scored'))?.why==='rejected');
  dee.send({m:'play'});await sleep(50);check('board: a score not in tens is refused',(await ask(dee,{m:'score',score:105,wave:1},'scored'))?.why==='rejected');
  bea.send({m:'play'});await sleep(400);const lower=await ask(bea,{m:'score',score:50,wave:1},'scored');
  check('board: a lower score leaves the best as it was',lower?.ok===true&&lower.newBest===false&&lower.best===100,JSON.stringify(lower));
  cal.send({m:'play'});await sleep(400);await ask(cal,{m:'score',score:200,wave:1},'scored');
  const top=await ask(bea,{m:'board'},'board');
  check("board: the top scores in order, with the player's own rank",top?.verified===true&&top.top.map(e=>e.name+' '+e.score).join(',')==='Cal Cat 200,Bea Cat 100'&&top.you?.rank===2&&top.you.score===100,JSON.stringify(top));
  bea.pose([10,-3.7,0],{pl:true});await sleep(250);
  check('board: a player at the game shows as playing to others',cal.poses.get(bea.id)?.playing===true);
  check('board: accepted and refused scores are logged',/score discord:444444444444444444 Bea Cat 100 wave 1 \(best\)/.test(srv.log)&&/score refused discord:555555555555555555 5000/.test(srv.log));
  [guest,bea,cal,dee].forEach(b=>b.close());
  await sleep(1300);srv.kill();srv=await startServer(port);
  const back=new Bot(port,{name:'Later'});await back.welcomed();const kept=await ask(back,{m:'board'},'board');
  check('board: the board is still there after the server restarts',kept?.top?.length===2&&kept.top[0].name==='Cal Cat',JSON.stringify(kept?.top));
  back.close();
 }finally{srv.kill();fs.rmSync(scoresFile(port),{force:true});}
}

// ---- the cap on visitors, on a server of its own ------------------------------------------------------------------
{
 const port=PORT+1,capped=await startServer(port,{LEO_LIVE_MAX:'3'});
 try{
  const bots=[0,1,2].map(()=>new Bot(port));for(const b of bots)await b.welcomed();
  const extra=new Bot(port);await extra.opened;await sleep(300);
  check('cap: the visitor after the last place is told Leo is full',extra.msgs.some(m=>m.m==='full'));
  bots.forEach(b=>b.close());
 }finally{capped.kill();}
}

// ---- sixty visitors at once -----------------------------------------------------------------------------------------
{
 const port=PORT+2,busy=await startServer(port),N=60;
 try{
  const bots=Array.from({length:N},(_,i)=>new Bot(port,{name:'Bot '+i}));
  for(const b of bots)await b.welcomed();
  // Walking circles on two decks: half around the forward lobby on Deck 10, half 100 m aft.
  const t0=Date.now();
  for(let tick=0;tick<50;tick++){
   const t=(Date.now()-t0)/1000;
   bots.forEach((b,i)=>{const cx=i%2?130:30,a=t+i;b.pose([cx+Math.cos(a)*8,-3.7,Math.sin(a)*8]);});
   await sleep(100);
  }
  const s=(Date.now()-t0)/1000,bytes=bots.reduce((n,b)=>n+b.bytes,0)/N/s,heard=bots.every(b=>b.poses.size===N-1);
  check(`load: ${N} visitors each hear all ${N-1} others`,heard,`${(bytes/1024).toFixed(1)} KB/s to each visitor, ${(bytes*N/1048576).toFixed(2)} MB/s out in all`);
  bots.forEach(b=>b.close());
 }finally{busy.kill();}
}

jwksServer.close();
console.log(results.join('\n'));
console.log(failed?`${failed} FAILED`:'All Leo live checks passed');
process.exit(failed?1:0);
