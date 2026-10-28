// npm run check:live: Leo live (server/leo-live.mjs) against scripted visitors. Starts real servers on spare ports and
// checks the pose wire, joining, poses reaching others near and far, names, the shared lifts, pings, leaving, a second tab,
// bad input, the cap on visitors, Leo passes (Discord identity from The Creamery, net/pass.js: here signed by a
// stand-in key served as a local JWKS), Alien Cat Invasion's leaderboard, Paw Pool's fastest clears, the ship log
// boards' hearts, the selfie booth's shared countdown, chat aboard and, last, sixty visitors walking at once (bytes sent per visitor
// per second). Each server keeps its scores and hearts in temporary files, never the real ones.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {encodeRecord,encodeIdentity,assembleFrame,decodeFrame,WireReader,actorIdOf,PROTOCOL} from '../src/walk/net/wire.js';
import {LIFTS} from '../src/walk/lifts.js';
import {liftState,callLift,stepLift,followLift,applyLiftWire} from '../src/walk/lift-motion.js';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {keySet,verifyPass,readPass,REMEMBER_S} from '../src/walk/net/pass.js';
import {POOL_FASTEST_S} from '../src/walk/pool/limits.js';
import * as T from 'three';
import {createHydroNipLounge} from '../src/hydro-nip-lounge.js';
import {findRestSpots,spotIndex} from '../src/walk/rest.js';
import {COSMO_HEIGHT} from '../src/cosmo-pose.js';
import {arcadeTreadmill} from '../src/walk/arcade.js';

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
 const rolling=decodeFrame(assembleFrame([],[encodeRecord(1,{...poses[0],ball:true,stance:'stand'}),encodeRecord(2,poses[0])]));
 check('wire: a pose says when its visitor is rolling in a hamster ball',rolling?.poses[0].pose.ball===true&&rolling.poses[0].pose.stance==='stand'&&rolling.poses[1].pose.ball===false);
 const torn=[frame.slice(0,frame.length-1),Uint8Array.of(0x4c,9,0,0,0,0),randomBytes(40)];
 check('wire: torn, foreign and random frames are dropped',torn.every(f=>decodeFrame(f)===null));
 let threw=0;for(const bad of [{...poses[0],pos:[NaN,0,0]},{...poses[0],pos:[1e6,0,0]},{...poses[0],stance:'fly'},{...poses[0],jumpCount:9}])try{encodeRecord(1,bad);}catch{threw++;}
 check('wire: out-of-range poses are refused',threw===4);
 const reader=new WireReader();
 check('wire: a pose from a slot never introduced is skipped',reader.read(assembleFrame([],[encodeRecord(3,poses[0])])).length===0);
}

// ---- the Hydro-Nip Lounge's hammocks, as the walk finds them --------------------------------------------------------
// Neighborhood 1's commons moves the lounge 224 m aft and mirrors it across the centreline (model.js createGardenCommons).
// Lying in one, the body is where main.js settle puts it; another visitor's page is sent only that they lie, and knows
// the hammock from where the body is (rest.js hammockAt), to draw its pose (avatar.js: hands behind the head, eyes shut).
const commons=new T.Group();commons.position.x=-224;commons.scale.z=-1;commons.add(createHydroNipLounge({mirror:-1}));
const hammockSpots=findRestSpots(commons).filter(s=>s.hammock),hammocks=spotIndex(hammockSpots);
const lyingIn=s=>{const head=s.head.clone().normalize(),at=s.point.clone().addScaledVector(head,-COSMO_HEIGHT/2);return {spot:s,pos:[at.x,s.height+.13,at.z],yaw:Math.atan2(-head.x,-head.z)};};
{
 const own=hammockSpots.filter(s=>{const {pos:[x,y,z]}=lyingIn(s);return hammocks.hammockAt({x,y,z})===s;}).length;
 check('hammocks: a body lying in each of the nine is known for that hammock',hammockSpots.length===9&&own===9,`${own} of ${hammockSpots.length}`);
 check('hammocks: someone standing in the dome is not in a hammock',!hammocks.hammockAt({x:-90,y:24.3,z:-25}));
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
 const remember={...opts,lapsed:REMEMBER_S},daysAgo=d=>({iat:nowS()-d*86400-600,exp:nowS()-d*86400});
 const kept=await verifyPass(await creamery.sign(claimsFor('222222222222222222','Leo Test Cat',daysAgo(3))),remember);
 check('pass: a remembered pass (expired 3 days ago) is taken, marked lapsed',kept?.discordId==='222222222222222222'&&kept.lapsed===true&&who.lapsed===false);
 check('pass: a pass expired longer ago than visitors are remembered is refused',!await verifyPass(await creamery.sign(claimsFor('222222222222222222','Leo Test Cat',daysAgo(31))),remember));
 check('pass: a remembered pass still needs The Creamery\'s signature',!await verifyPass(await other.sign(claimsFor('222222222222222222','Leo Test Cat',daysAgo(3)),{kid:'test-1'}),remember));
}
const jwksServer=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(creamery.jwks));});
await new Promise(r=>jwksServer.listen(0,'127.0.0.1',r));
const PASS_ENV={LEO_PASS_JWKS_URL:`http://127.0.0.1:${jwksServer.address().port}/keys.json`,LEO_PASS_ISS:ISS};

// ---- a server and some visitors -----------------------------------------------------------------------------------
const scoresFile=port=>path.join(os.tmpdir(),`leo-live-scores-check-${port}.json`),heartsFile=port=>path.join(os.tmpdir(),`leo-live-hearts-check-${port}.json`),chatFile=port=>path.join(os.tmpdir(),`leo-live-chat-check-${port}.json`);
function startServer(port,env={}){
 const child=spawn(process.execPath,['server/leo-live.mjs'],{env:{...process.env,PORT:String(port),...PASS_ENV,LEO_LIVE_SCORES:scoresFile(port),LEO_LIVE_HEARTS:heartsFile(port),LEO_LIVE_CHAT_LOG:chatFile(port),...env},stdio:['ignore','pipe','pipe']});
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
fs.rmSync(chatFile(PORT),{force:true});const server=await startServer(PORT,{LEO_LIVE_CHAT:'all'});
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
 // Sitting in a Deck 4 lifeboat seat reaches a visitor standing in the aisle.
 b.pose([-115,-27.7,64.9]);a.pose([-120.7,-27.14,64.6],{yaw:Math.PI/2,rest:'sit'});await sleep(300);
 const sat=b.poses.get(a.id);
 check('rest: a visitor sitting in a lifeboat seat is seen sitting',sat?.rest==='sit'&&Math.abs(sat.pos[0]+120.7)<.01&&Math.abs(sat.pos[2]-64.6)<.01,JSON.stringify(sat&&{pos:sat.pos,rest:sat.rest}));
 // Lying in a sleeping pod in the Deck 20 crew recovery lounge reaches a visitor standing in front of the pods.
 b.pose([-85,36.3,21]);a.pose([-84.5,37.01,24.17],{yaw:-Math.PI/2,rest:'lie'});await sleep(300);
 const podded=b.poses.get(a.id);
 check('rest: a visitor lying in a recovery lounge sleeping pod is seen lying there',podded?.rest==='lie'&&Math.abs(podded.pos[0]+84.5)<.01&&Math.abs(podded.pos[1]-37.01)<.01&&Math.abs(podded.pos[2]-24.17)<.01,JSON.stringify(podded&&{pos:podded.pos,rest:podded.rest}));
 // Lying in a hammock in the Hydro-Nip Lounge's dome reaches a visitor standing in the dome, at that hammock.
 {const lay=lyingIn(hammockSpots[4]);b.pose([-90,24.3,-25]);a.pose(lay.pos,{yaw:lay.yaw,rest:'lie'});await sleep(300);
  const swung=b.poses.get(a.id),found=swung&&hammocks.hammockAt({x:swung.pos[0],y:swung.pos[1],z:swung.pos[2]});
  check('rest: a visitor lying in a lounge hammock is seen lying in that hammock',swung?.rest==='lie'&&found===lay.spot,JSON.stringify(swung&&{pos:swung.pos.map(v=>+v.toFixed(3)),rest:swung.rest,hammock:!!found}));}
 // Standing in a healing capsule in the Deck 5 surgical suite (the walk's surgery.js): seen standing on its floor,
 // 0.24 m up, not sitting or lying; then out again, back on the suite's floor.
 b.pose([-63.3,-23.7,-42]);a.pose([-63.3,-23.46,-47],{yaw:0});await sleep(300);
 const capsuled=b.poses.get(a.id);
 check('rest: a visitor in a surgical suite healing capsule is seen standing in it',!!capsuled&&!capsuled.rest&&Math.abs(capsuled.pos[0]+63.3)<.01&&Math.abs(capsuled.pos[1]+23.46)<.01&&Math.abs(capsuled.pos[2]+47)<.01,JSON.stringify(capsuled&&{pos:capsuled.pos,rest:capsuled.rest}));
 a.pose([-63.3,-23.7,-45.6]);await sleep(300);
 check('rest: out of the capsule, they are seen back on the floor',Math.abs(b.poses.get(a.id)?.pos[1]+23.7)<.01);
 // Paws Off on a Deck 16 exercise studio treadmill (src/walk/paws-off): a runner on the belt is seen there, playing; after
 // a fall, on their back behind it, still playing; stepped off, no longer playing.
 b.pose([5,20.3,-44]);a.pose([7,20.56,-47.79],{yaw:Math.PI,pl:true});await sleep(300);
 const running=b.poses.get(a.id);
 check('paws off: a visitor running on a treadmill is seen on its belt, playing',running?.playing===true&&!running.rest&&Math.abs(running.pos[1]-20.56)<.01&&Math.abs(running.pos[2]+47.79)<.01,JSON.stringify(running&&{pos:running.pos,playing:running.playing}));
 a.pose([7,20.3,-46.04],{yaw:Math.PI,pl:true,rest:'lie'});await sleep(300);
 const fallen=b.poses.get(a.id);
 check('paws off: a fall off the back is seen lying behind the treadmill',fallen?.rest==='lie'&&fallen.playing===true&&Math.abs(fallen.pos[2]+46.04)<.01,JSON.stringify(fallen&&{pos:fallen.pos,rest:fallen.rest}));
 a.pose([7,20.3,-45.5]);await sleep(300);
 check('paws off: stepped off, they are no longer playing',b.poses.get(a.id)?.playing===false&&!b.poses.get(a.id)?.rest);
 // Paws Off's second station, the arcade treadmill in the Deck 17 Hydro-Nip Lounge (src/walk/arcade.js), the same way, for
 // a visitor standing in the lounge: the runner where the game holds them (paws-off/game.js), a little behind the deck's
 // middle, and after a fall, half the deck's length and 0.55 m further back, on the floor.
 {const t=arcadeTreadmill(),yaw=Math.atan2(t.front.x,t.front.z),on=t.centre.clone().addScaledVector(t.front,-t.length*.08),off=on.clone().addScaledVector(t.front,-(t.length/2+.55)).setY(t.floor);
  const at=(p,q)=>!!p&&Math.abs(p.pos[0]-q.x)<.01&&Math.abs(p.pos[1]-q.y)<.01&&Math.abs(p.pos[2]-q.z)<.01;
  b.pose([off.x-4,t.floor,off.z-2]);a.pose(on.toArray(),{yaw,pl:true});await sleep(300);
  const arcadeRun=b.poses.get(a.id);
  check('paws off: a visitor running on the arcade treadmill is seen on its belt, playing',arcadeRun?.playing===true&&!arcadeRun.rest&&at(arcadeRun,on),JSON.stringify(arcadeRun&&{pos:arcadeRun.pos,playing:arcadeRun.playing}));
  a.pose(off.toArray(),{yaw,pl:true,rest:'lie'});await sleep(300);
  const arcadeFall=b.poses.get(a.id);
  check('paws off: a fall off the arcade treadmill is seen lying behind it',arcadeFall?.rest==='lie'&&arcadeFall.playing===true&&at(arcadeFall,off),JSON.stringify(arcadeFall&&{pos:arcadeFall.pos,rest:arcadeFall.rest}));
  a.pose([off.x-.6,t.floor,off.z]);await sleep(300);
  check('paws off: stepped off the arcade treadmill, they are no longer playing',b.poses.get(a.id)?.playing===false&&!b.poses.get(a.id)?.rest);}
 // The hamster ball in the Deck 17 gardens (src/walk/hamster-ball.js): one visitor climbs in and rolls off; another
 // standing nearby sees them in the ball, upright, where it rolled, and the hop they take in it; climbed out, no longer in one.
 b.pose([135,24.3,20]);a.pose([137.4,24.3,21.7],{b:true});await sleep(250);a.pose([139.2,24.3,23.1],{yaw:.9,b:true});await sleep(300);
 const rolled=b.poses.get(a.id);
 check('hamster ball: a visitor rolling in the ball is seen in it, upright, where it rolled',rolled?.ball===true&&rolled.stance==='stand'&&Math.abs(rolled.pos[0]-139.2)<.01&&Math.abs(rolled.pos[2]-23.1)<.01,JSON.stringify(rolled&&{pos:rolled.pos,ball:rolled.ball,stance:rolled.stance}));
 // The hop: one jump of about half a metre, seen by the other visitor in the air, still in the ball.
 a.pose([139.2,24.75,23.1],{yaw:.9,b:true,g:false,jc:1,js:.2,r:1.5});await sleep(300);
 const hop=b.poses.get(a.id);
 check('hamster ball: a visitor hopping in the ball is seen in the air in it',hop?.ball===true&&hop.grounded===false&&hop.jumpCount===1&&Math.abs(hop.pos[1]-24.75)<.01&&hop.stance==='stand',JSON.stringify(hop&&{pos:hop.pos,ball:hop.ball,grounded:hop.grounded,jc:hop.jumpCount}));
 a.pose([139.2,24.3,23.1],{yaw:.9});await sleep(300);
 check('hamster ball: climbed out, they are no longer seen in a ball',b.poses.get(a.id)?.ball===false&&b.poses.get(a.id)?.stance==='stand');
 const junk=new Bot(PORT,{name:'Junk'});await junk.welcomed();junk.pose([136,24.3,20],{b:'yes'});await sleep(300);
 check('hamster ball: anything but true is not a ball',b.poses.get(junk.id)?.ball===false);junk.close();
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
 // The crown lift at fin platform 1 (40 m, FIN_PLATFORMS in fin-crown.js): called from the landing there, the server's car
 // comes and stops level with its floor, and a second call from the landing, after the car has gone, brings it back.
 // Another visitor hears both. (A server still running the old 32 m stop left the car 8 m below the floor.)
 {
  const crown=LIFTS.find(l=>l.id==='crown'),p1=crown.stops.findIndex(s=>s.label==='Fin platform 1');
  const wait=async(who,from,test)=>{let got=null;for(let i=0;i<250&&!got;i++){got=who.lifts.slice(from).find(l=>l.id==='crown'&&test(l.s));if(!got)await sleep(100);}return got;};
  check('lifts: the crown lift stops at fin platform 1, 40 m up',p1>0&&Math.abs(crown.stops[p1].y-40)<1e-6,`stop ${p1} at ${crown.stops[p1]?.y}`);
  const ask=async()=>{const from=b.lifts.length;tab.send({m:'call',lift:'crown',stop:p1});
   const told=await wait(b,from,s=>s.calls.includes(p1)),level=await wait(b,from,s=>s.at===p1&&s.phase==='opening');return {told,level};};
  const first=await ask();
  check('lifts: a call from fin platform 1 reaches everyone aboard',!!first.told);
  check('lifts: the crown lift stops level with fin platform 1, for the other visitor too',!!first.level&&Math.abs(first.level.s.y-40)<.001,first.level?`stopped at ${first.level.s.y} m`:'never came');
  const from=b.lifts.length;tab.send({m:'call',lift:'crown',stop:0,now:true});
  const gone=await wait(b,from,s=>s.at===0&&s.phase==='opening');
  const second=gone&&await ask();
  check('lifts: the call from fin platform 1 brings the crown lift back after it has left',!!second?.level&&Math.abs(second.level.s.y-40)<.001,second?.level?`stopped at ${second.level.s.y} m`:'never came back');
 }
 // A ride as the rider's page sees it: the rider chooses Deck 1 in the car, the page steps its own car every frame and
 // hears the server 60-200 ms late (a real connection's lag, which comes and goes). The car must go one way all the way
 // down, never hopping back up.
 {
  const mine=liftState(spec),back=spec.stops.findIndex(s=>s.deck===1),heard=[],LAG=120;let lags=0;
  b.ws.on('message',(data,binary)=>{if(binary)return;const m=JSON.parse(data);if(m.m==='lift'&&m.id==='forward-port')heard.push({t:Math.max(heard.at(-1)?.t||0,Date.now()+(lags++%2?200:60)),s:m.s});});
  const settled=()=>b.lifts.filter(l=>l.id==='forward-port').at(-1).s;for(let i=0;i<50&&settled().phase!=='open';i++)await sleep(100);
  // `old` takes the server's word as it comes, as pages did before: each word put the car back where the server had it.
  const old=liftState(spec);applyLiftWire(mine,settled());applyLiftWire(old,settled());
  callLift(mine,back,{now:true});callLift(old,back,{now:true});await sleep(LAG);tab.send({m:'call',lift:'forward-port',stop:back,now:true});
  let last=Date.now(),hop=0,snap=0,moves=0,dir=Math.sign(spec.stops[back].y-mine.y),done=false;
  for(let i=0;i<2000&&!done;i++){
   await sleep(16);const now=Date.now(),dt=Math.min(.1,(now-last)/1000),before=mine.y;last=now;
   stepLift(mine,spec.stops,dt);let was=old.y;stepLift(old,spec.stops,dt);snap=Math.max(snap,(was-old.y)*dir);
   while(heard.length&&now>=heard[0].t){const w=heard.shift().s;moves+=w.phase==='moving';followLift(mine,w);was=old.y;applyLiftWire(old,w);snap=Math.max(snap,(was-old.y)*dir);}
   hop=Math.max(hop,(before-mine.y)*dir);done=mine.at===back&&mine.phase==='open'&&!heard.length;
  }
  check("lifts: a rider's car rides smoothly on the server's word, with no hop back",done&&moves>=3&&hop<.01,`${moves} updates on the way; largest step back ${hop.toFixed(3)} m; snapping to the server as before hopped back ${snap.toFixed(2)} m`);
 }
 // Pings: passed on to everyone else, checked, and only so many.
 tab.send({m:'mark',at:[10.123,-3.7,2]});await sleep(200);
 const marks=()=>b.msgs.filter(m=>m.m==='mark'&&m.id===tab.id);
 check('pings: a ping reaches others aboard, not its sender',marks().some(m=>m.at[0]===10.12&&m.at[1]===-3.7)&&!tab.msgs.some(m=>m.m==='mark'));
 tab.send({m:'mark',at:[9999,0,0]});tab.send({m:'mark',at:'here'});tab.send({m:'mark'});await sleep(200);
 check('pings: a ping outside the ship or malformed is ignored',marks().length===1);
 for(let i=0;i<10;i++)tab.send({m:'mark',at:[11,-3.7,2]});await sleep(300);
 check('pings: a flood of pings is rate-limited',marks().length<=3&&tab.closed===null,`${marks().length} passed on`);
 // Chat: a line reaches everyone aboard, its sender too, cleaned; links, repeats and floods are refused; newcomers get
 // the last few lines in their welcome.
 {
  const lines=x=>x.msgs.filter(m=>m.m==='chat'),refusals=x=>x.msgs.filter(m=>m.m==='said').map(m=>m.why);
  check('chat: with LEO_LIVE_CHAT=all, everyone joins with chat open to all',b.msgs.find(m=>m.m==='welcome')?.chat?.mode==='all');
  tab.send({m:'chat',text:'  Meet at the\ncrown‮ lounge  '});await sleep(200);
  const heard=lines(b).at(-1),own=lines(tab).at(-1);
  check('chat: a line reaches others aboard, with who said it',heard?.id===tab.id&&heard.text==='Meet at the crown lounge'&&heard.verified===false,JSON.stringify(heard));
  check('chat: the sender hears their own line back',own?.text===heard?.text);
  tab.send({m:'chat',text:'x'.repeat(400)});await sleep(200);
  check('chat: a long line is cut to 160 characters',[...lines(b).at(-1)?.text||''].length===160);
  // (A line a link spoils still counts against the sender's allowance: wait for it to fill again first.)
  await sleep(4000);const before=lines(b).length;
  for(const text of ['free mint at claim-now.xyz','https://evil.example','join discord.gg/abc','site (dot) com']){tab.send({m:'chat',text});await sleep(80);}
  await sleep(200);
  check('chat: lines with links are refused and passed on to nobody',lines(b).length===before&&refusals(tab).filter(w=>w==='link').length===4,refusals(tab).join(','));
  await sleep(4000);
  tab.send({m:'chat',text:'hello'});await sleep(80);tab.send({m:'chat',text:'hello'});await sleep(200);
  check('chat: the same line twice at once is refused',lines(b).filter(m=>m.text==='hello').length===1&&refusals(tab).includes('again'));
  for(const text of [1,'',{},' \u200b ',null])tab.send({m:'chat',text});await sleep(200);
  check('chat: empty and malformed lines are ignored',lines(b).filter(m=>m.text==='hello').length===1&&tab.closed===null);
  for(let i=0;i<12;i++)tab.send({m:'chat',text:'spam '+i});await sleep(300);
  const spam=lines(b).filter(m=>m.text.startsWith('spam')).length;
  check('chat: a flood of lines is rate-limited',spam<=5&&refusals(tab).includes('slow')&&tab.closed===null,`${spam} of 12 passed on`);
  const late=new Bot(PORT,{name:'Late'});await late.welcomed();
  const history=late.msgs.find(m=>m.m==='welcome')?.chat?.lines||[];
  check('chat: a newcomer is handed the lines said before they came',history.some(l=>l.text==='Meet at the crown lounge')&&history.some(l=>l.text==='hello'),`${history.length} lines`);
  check('chat: lines go to the log',/chat voyager-[0-9a-f]+ .*"hello"/.test(server.log));
  late.close();
 }
 // The selfie booth: a press at its camera starts one countdown on every page near the booth, and nowhere else.
 {
  const cam=new Bot(PORT,{name:'Cam'}),pal=new Bot(PORT,{name:'Pal'}),away=new Bot(PORT,{name:'Away'});
  await Promise.all([cam,pal,away].map(x=>x.welcomed()));
  cam.pose([-265.1,120.3,.8]);pal.pose([-269.5,120.3,-2.5]);away.pose([-230,120.3,0]);await sleep(200);
  const heard=x=>x.msgs.filter(m=>m.m==='selfie');
  away.send({m:'selfie'});await sleep(200);
  check('selfie: a press away from the camera starts nothing',!heard(cam).length&&!heard(pal).length);
  cam.send({m:'selfie'});await sleep(200);
  const got=heard(pal)[0];
  check('selfie: a press at the camera starts the same 5 s countdown for a visitor at the booth',got?.id===cam.id&&got.ms===5000&&!heard(cam).length,JSON.stringify(got));
  check('selfie: visitors away from the booth are not counted in',!heard(away).length);
  pal.send({m:'selfie'});await sleep(200);
  check('selfie: a press while the countdown runs is ignored',!heard(cam).length&&heard(pal).length===1);
  await sleep(5000);pal.pose([-265.2,120.3,-.5]);await sleep(150);pal.send({m:'selfie'});await sleep(200);
  check('selfie: once the photo is taken the camera can be used again',heard(cam).at(-1)?.id===pal.id);
  for(const x of [cam,pal,away])x.close();
 }
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
  // A browser that connected days ago, whose Creamery sign-in has since run out, brings the pass it kept.
  const kept=new Bot(port,{name:'typed',pass:await creamery.sign(claimsFor('343434343434343434','Kit Cat',{iat:nowS()-5*86400-600,exp:nowS()-5*86400}))});await kept.welcomed();
  for(let i=0;i<3;i++){kept.pose([13,-3.7,0]);watch.pose([11,-3.7,0]);await sleep(100);}await sleep(200);
  check('identity: a remembered visitor is aboard under their Discord name, verified',kept.msgs.find(m=>m.m==='welcome')?.you?.verified===true&&watch.poses.get(kept.id)?.name==='Kit Cat'&&/discord:343434343434343434 \(remembered\)/.test(srv.log));
  const old=new Bot(port,{name:'Old',pass:await creamery.sign(claimsFor('353535353535353535','Old Cat',{iat:nowS()-40*86400-600,exp:nowS()-40*86400}))});await old.welcomed();
  check('identity: a pass kept longer than visitors are remembered leaves them anonymous',old.msgs.find(m=>m.m==='welcome')?.you?.verified===false);
  [watch,forged,bea2,kept,old].forEach(b=>b.close());
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

// ---- the ship log boards' hearts, on a server of its own --------------------------------------------------------------
{
 const port=PORT+5;fs.rmSync(heartsFile(port),{force:true});let srv=await startServer(port);
 const ask=async(bot,msg,m)=>{const n=bot.msgs.length;bot.send(msg);for(let i=0;i<40&&!bot.msgs.slice(n).some(x=>x.m===m);i++)await sleep(25);return bot.msgs.slice(n).find(x=>x.m===m);};
 const heard=async(bot,n,test)=>{for(let i=0;i<40;i++){const got=bot.msgs.slice(n).find(x=>x.m==='hearts'&&test(x));if(got)return got;await sleep(25);}return null;};
 const countOf=(h,id)=>new Map(h?.counts||[]).get(id)||0;
 try{
  const guest=new Bot(port,{name:'Guest'}),bea=new Bot(port,{pass:await creamery.sign(claimsFor('777777777777777777','Bea Cat'))}),
   cal=new Bot(port,{pass:await creamery.sign(claimsFor('888888888888888888','Cal Cat'))});
  for(const b of [guest,bea,cal])await b.welcomed();
  const start=await ask(guest,{m:'hearts'},'hearts');
  check('hearts: anyone aboard can see the hearts, a guest marked not signed in',start?.verified===false&&Array.isArray(start.counts)&&start.counts.length===0,JSON.stringify(start));
  check("hearts: a guest's heart is refused and they are told to sign in",(await ask(guest,{m:'heart',change:109,on:true},'hearted'))?.why==='sign-in');
  // Bea gives change 109 a heart: Bea hears it as hers, and Cal and the guest, elsewhere aboard, hear the new count.
  let nc=cal.msgs.length,ng=guest.msgs.length;
  const mine=await ask(bea,{m:'heart',change:109,on:true},'hearts');
  check("hearts: a signed-in visitor's heart is kept and counted as theirs",mine?.verified===true&&countOf(mine,109)===1&&mine.mine.includes(109),JSON.stringify(mine));
  const calHeard=await heard(cal,nc,h=>countOf(h,109)===1),guestHeard=await heard(guest,ng,h=>countOf(h,109)===1);
  check("hearts: another visitor's heart reaches everyone else aboard",!!calHeard&&!!guestHeard&&calHeard.mine===undefined,JSON.stringify(calHeard));
  const again=await ask(bea,{m:'heart',change:109,on:true},'hearts');
  check('hearts: one heart per change per visitor',countOf(again,109)===1);
  nc=cal.msgs.length;await ask(cal,{m:'heart',change:109,on:true},'hearts');await ask(cal,{m:'heart',change:47,on:true},'hearts');
  const both=await ask(bea,{m:'hearts'},'hearts');
  check('hearts: hearts from different visitors add up, and each sees only their own as theirs',countOf(both,109)===2&&countOf(both,47)===1&&both.mine.join()==='109',JSON.stringify(both));
  nc=cal.msgs.length;await ask(bea,{m:'heart',change:109,on:false},'hearts');
  check('hearts: a heart taken back comes off the count for everyone',!!await heard(cal,nc,h=>countOf(h,109)===1));
  for(const bad of [{change:0,on:true},{change:1.5,on:true},{change:'109',on:true},{change:109},{change:1e6,on:true}])bea.send({m:'heart',...bad});await sleep(300);
  const after=await ask(bea,{m:'hearts'},'hearts');
  check('hearts: malformed hearts are ignored',after?.counts.length===2&&countOf(after,109)===1&&countOf(after,47)===1&&bea.closed===null,JSON.stringify(after?.counts));
  check('hearts: hearts given and taken back are logged',/heart discord:777777777777777777 Bea Cat \+ 109/.test(srv.log)&&/heart discord:777777777777777777 Bea Cat - 109/.test(srv.log));
  [guest,bea,cal].forEach(b=>b.close());
  await sleep(1300);srv.kill();srv=await startServer(port);
  const back=new Bot(port,{pass:await creamery.sign(claimsFor('888888888888888888','Cal Cat'))});await back.welcomed();const kept=await ask(back,{m:'hearts'},'hearts');
  check('hearts: the hearts are still there after the server restarts',countOf(kept,109)===1&&countOf(kept,47)===1&&kept.mine.sort().join()==='109,47',JSON.stringify(kept));
  back.close();
 }finally{srv.kill();fs.rmSync(heartsFile(port),{force:true});}
}

// ---- Paw Pool's fastest clears, a second board in the same file, on a server of its own ----------------------------
// Real time: no clear is believed under POOL_FASTEST_S, so the players here wait that long.
{
 const port=PORT+6;fs.rmSync(scoresFile(port),{force:true});let srv=await startServer(port);
 const last=(bot,m)=>[...bot.msgs].reverse().find(x=>x.m===m);
 const ask=async(bot,msg,m)=>{const n=bot.msgs.length;bot.send(msg);for(let i=0;i<40&&!bot.msgs.slice(n).some(x=>x.m===m);i++)await sleep(25);return last(bot,m);};
 try{
  const guest=new Bot(port,{name:'Guest'}),bea=new Bot(port,{pass:await creamery.sign(claimsFor('744444444444444444','Bea Cat'))}),
   cal=new Bot(port,{pass:await creamery.sign(claimsFor('755555555555555555','Cal Cat'))}),eve=new Bot(port,{pass:await creamery.sign(claimsFor('777777777777777777','Eve Cat'))});
  for(const b of [guest,bea,cal,eve])await b.welcomed();
  const t0=Date.now();for(const b of [guest,bea,cal,eve])b.send({m:'play',game:'pool'});
  bea.send({m:'play'});await sleep(400);await ask(bea,{m:'score',score:100,wave:1},'scored');
  check('pool: a clear faster than any rack can go is refused',(await ask(cal,{m:'score',game:'pool',ms:25000,shots:20},'scored'))?.why==='rejected');
  cal.send({m:'play',game:'pool'});
  await sleep(POOL_FASTEST_S*1000+1500-(Date.now()-t0));
  check("pool: a guest's clear is not kept, and they are told to sign in",(await ask(guest,{m:'score',game:'pool',ms:POOL_FASTEST_S*1000+1000,shots:18},'scored'))?.why==='sign-in');
  const first=await ask(bea,{m:'score',game:'pool',ms:POOL_FASTEST_S*1000+1000,shots:18},'scored');
  check("pool: a signed-in player's clear is kept as their fastest",first?.ok===true&&first.game==='pool'&&first.newBest&&first.best===POOL_FASTEST_S*1000+1000&&first.rank===1,JSON.stringify(first));
  check('pool: a clear claiming longer than the server timed is refused',(await ask(cal,{m:'score',game:'pool',ms:600000,shots:18},'scored'))?.why==='rejected'&&/pool clear refused discord:755555555555555555 600000 18 2\ds/.test(srv.log));
  await sleep(4000);
  const shaved=await ask(eve,{m:'score',game:'pool',ms:POOL_FASTEST_S*1000,shots:18},'scored'),served=Date.now()-t0;
  check('pool: a clear claimed well under the server\'s clock is kept at the server\'s time, less 3 s at most',shaved?.ok===true&&shaved.ms>=served-3000-500,JSON.stringify(shaved)+` · server timed about ${served} ms`);
  const board=await ask(cal,{m:'board',game:'pool'},'board');
  check("pool: another visitor sees a player's clear on the board, fastest first",board?.game==='pool'&&board.top.map(e=>e.name).join(',')==='Bea Cat,Eve Cat'&&board.top[0].ms===POOL_FASTEST_S*1000+1000&&board.you===null,JSON.stringify(board));
  const theirs=await ask(cal,{m:'board'},'board');
  check("pool: the pool board and Alien Cat Invasion's are kept apart",!theirs.game&&theirs.top.map(e=>e.name+' '+e.score).join()==='Bea Cat 100',JSON.stringify(theirs));
  check('pool: accepted and refused clears are logged',/pool clear discord:744444444444444444 Bea Cat 21\.0s 18 shots \(best\)/.test(srv.log)&&/pool clear refused discord:755555555555555555 25000/.test(srv.log));
  [guest,bea,cal,eve].forEach(b=>b.close());
  await sleep(1300);srv.kill();srv=await startServer(port);
  const back=new Bot(port,{name:'Later'});await back.welcomed();
  const pool=await ask(back,{m:'board',game:'pool'},'board'),inv=await ask(back,{m:'board'},'board');
  check('pool: both boards are still there after the server restarts',pool?.top?.length===2&&pool.top[0].name==='Bea Cat'&&inv?.top?.length===1,JSON.stringify({pool:pool?.top,invasion:inv?.top}));
  back.close();
 }finally{srv.kill();fs.rmSync(scoresFile(port),{force:true});}
}

// ---- chat as it starts (Discord-verified visitors only), and chat turned off, on servers of their own --------------
{
 const port=PORT+7,only=await startServer(port);
 try{
  const guest=new Bot(port,{name:'Guest'}),cat=new Bot(port,{pass:await creamery.sign(claimsFor('333333333333333333','Chat Cat'))});
  await guest.welcomed();await cat.welcomed();
  check('chat (default, verified only): the welcome says so',guest.msgs.find(m=>m.m==='welcome')?.chat?.mode==='verified');
  guest.send({m:'chat',text:'hi all'});cat.send({m:'chat',text:'hello from Discord'});await sleep(300);
  const lines=guest.msgs.filter(m=>m.m==='chat');
  check('chat (default, verified only): a guest is asked to connect Discord, a verified visitor is heard, marked verified',
   !lines.some(m=>m.text==='hi all')&&guest.msgs.some(m=>m.m==='said'&&m.why==='sign-in')&&lines.some(m=>m.text==='hello from Discord'&&m.verified&&m.name==='Chat Cat'),JSON.stringify(lines));
  guest.close();cat.close();
 }finally{only.kill();}
 const off=await startServer(port+1,{LEO_LIVE_CHAT:'off'});
 try{
  const a=new Bot(port+1),z=new Bot(port+1);await a.welcomed();await z.welcomed();
  a.send({m:'chat',text:'anyone?'});await sleep(300);
  check('chat (off): nothing is passed on and the sender is told',a.msgs.find(m=>m.m==='welcome')?.chat?.mode==='off'&&!z.msgs.some(m=>m.m==='chat')&&a.msgs.some(m=>m.m==='said'&&m.why==='off'));
  a.close();z.close();
 }finally{off.kill();}
}

// ---- chat history: kept however old, up to 100 lines, and through a restart --------------------------------------
{
 const port=PORT+9,day=86400000,now=Date.now();
 // A saved history of 130 lines, the oldest from three days ago, with one malformed entry and one with control characters.
 const saved=Array.from({length:130},(_,i)=>({id:'voyager-'+'0'.repeat(19)+(i%10),name:'Old '+(i%10),verified:i%2===0,text:'old line '+i,at:now-3*day+i*60000}));
 saved.splice(50,0,{id:7,text:'not a line'});saved[129].text='old line 128‮';
 fs.writeFileSync(chatFile(port),JSON.stringify(saved));
 let srv=await startServer(port,{LEO_LIVE_CHAT:'all'});
 try{
  const first=new Bot(port,{name:'First'});await first.welcomed();
  const kept=first.msgs.find(m=>m.m==='welcome')?.chat?.lines||[];
  check('chat history: a newcomer is handed the last 100 lines, however long ago they were said',kept.length===100&&kept[0].text==='old line 30'&&kept.at(-1).text==='old line 129'&&kept[0].at<now-2*day,`${kept.length} lines, ${kept[0]?.text} .. ${kept.at(-1)?.text}`);
  check('chat history: lines read back from the file are checked and cleaned',!kept.some(l=>l.text==='not a line')&&kept.some(l=>l.text==='old line 128'));
  first.send({m:'chat',text:'said before the restart'});await sleep(1500);first.close();
  srv.kill();await sleep(300);srv=await startServer(port,{LEO_LIVE_CHAT:'all'});
  const after=new Bot(port,{name:'After'});await after.welcomed();
  const back=after.msgs.find(m=>m.m==='welcome')?.chat?.lines||[];
  check('chat history: lines said before a restart are still there after it',back.length===100&&back.at(-1).text==='said before the restart'&&back.at(-1).name==='First',`${back.length} lines, last ${JSON.stringify(back.at(-1)?.text)}`);
  after.close();
 }finally{srv.kill();fs.rmSync(chatFile(port),{force:true});}
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

// ---- the Halloween clown's badge code (walk/halloween.js) ---------------------------------------------------------------
{
 const port=PORT+11,file=path.join(os.tmpdir(),`leo-live-halloween-check-${port}.json`);fs.rmSync(file,{force:true});
 const spooky=await startServer(port,{LEO_LIVE_HALLOWEEN:file});
 try{
  const a=new Bot(port,{name:'Finder'}),b=new Bot(port,{name:'Bystander'});await a.welcomed();await b.welcomed();
  const answers=()=>a.msgs.filter(m=>m.m==='clown').map(m=>m.code);
  a.send({m:'clown'});await sleep(200);
  fs.writeFileSync(file,JSON.stringify({code:'BOO-2026'}));a.send({m:'clown'});await sleep(200);
  fs.writeFileSync(file,JSON.stringify({code:'<b>boo</b>'}));a.send({m:'clown'});await sleep(200);
  check('clown: no code until the file has one, then that code, and never anything but a plain code',JSON.stringify(answers())===JSON.stringify([null,'BOO-2026',null]),JSON.stringify(answers()));
  check('clown: the code goes only to the visitor who knocked',!b.msgs.some(m=>m.m==='clown'));
  check('clown: each knock is logged',(spooky.log.match(/ clown /g)||[]).length===3);
  a.close();b.close();
 }finally{spooky.kill();fs.rmSync(file,{force:true});}
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
