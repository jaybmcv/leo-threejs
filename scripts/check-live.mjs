// npm run check:live: Leo live (server/leo-live.mjs) against scripted visitors. Starts real servers on spare ports and
// checks the pose wire, joining, poses reaching others near and far, names, the shared lifts, pings, leaving, a second tab,
// bad input, the cap on visitors, Leo passes (Discord identity from The Creamery, net/pass.js: here signed by a
// stand-in key served as a local JWKS), Alien Cat Invasion's leaderboard, Paw Pool's fastest clears, the ship log
// boards' hearts, the selfie booth's shared countdown, chat aboard, the Deck 19 graffiti wall, Paws Off's gym rounds, the Deck 1
// transporters, the Crown lounge TV and, last, sixty visitors walking at once (bytes sent per visitor per second). Each server
// keeps its scores, hearts, chat, graffiti and TV video in temporary files, never the real ones.
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
import {MAZE_ROOM,MAZE_START,MAZE_BUTTON,MAZE_FASTEST_S} from '../src/walk/maze/layout.js';
import {toWorld} from '../src/plan/rooms.js';
import * as T from 'three';
import {createHydroNipLounge} from '../src/hydro-nip-lounge.js';
import {findRestSpots,spotIndex} from '../src/walk/rest.js';
import {inLounge} from '../src/walk/lounge.js';
import {COSMO_HEIGHT} from '../src/cosmo-pose.js';
import {arcadeTreadmill} from '../src/walk/arcade.js';
import {WALL,paintStroke,wallFromText} from '../src/walk/graffiti-wall.js';
import {createTransporters as transporterServer,CARTS} from '../server/transporters.mjs';
import {homes as mctHomes} from '../src/walk/transporter.js';

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
// Who wears the lounge's catnip face (lounge.js inLounge): worked out from where each body is.
commons.updateMatrixWorld(true);const inTheLounge=inLounge(commons.children[0].matrixWorld),posOf=p=>({x:p.pos[0],y:p.pos[1],z:p.pos[2]});
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
const graffitiFile=port=>path.join(os.tmpdir(),`leo-live-graffiti-check-${port}.json`),graffitiClear=port=>path.join(os.tmpdir(),`leo-live-graffiti-clear-check-${port}`);
const tvDir=port=>path.join(os.tmpdir(),`leo-live-tv-check-${port}`),tvClear=port=>path.join(os.tmpdir(),`leo-live-tv-clear-check-${port}`);
const scoresFile=port=>path.join(os.tmpdir(),`leo-live-scores-check-${port}.json`),heartsFile=port=>path.join(os.tmpdir(),`leo-live-hearts-check-${port}.json`),chatFile=port=>path.join(os.tmpdir(),`leo-live-chat-check-${port}.json`);
const started=new Set();
function startServer(port,env={}){
 started.add(port);
 const child=spawn(process.execPath,['server/leo-live.mjs'],{env:{...process.env,PORT:String(port),...PASS_ENV,LEO_LIVE_SCORES:scoresFile(port),LEO_LIVE_HEARTS:heartsFile(port),LEO_LIVE_CHAT_LOG:chatFile(port),LEO_LIVE_GRAFFITI:graffitiFile(port),LEO_LIVE_GRAFFITI_CLEAR:graffitiClear(port),LEO_LIVE_TV:tvDir(port),LEO_LIVE_TV_CLEAR:tvClear(port),...env},stdio:['ignore','pipe','pipe']});
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
 // In the Hydro-Nip Lounge, on its upper gallery, a visitor wears its catnip face for a visitor in the dome below; out
 // in the hall, no longer. The face is drawn from the pose's position, which is what this checks arrives.
 {b.pose([-90,24.3,-25]);a.pose([-92,32.3,-44]);await sleep(300);const lounging=b.poses.get(a.id);
  a.pose([-92,24.3,-4]);await sleep(300);const left=b.poses.get(a.id);
  check('catnip face: a visitor in the lounge is seen wearing it, and not once out in the hall',!!lounging&&inTheLounge(posOf(lounging))&&!!left&&!inTheLounge(posOf(left)),JSON.stringify({in:lounging?.pos,out:left?.pos}));}
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
 // The Deck 1 transporters (src/walk/transporter.js, server/transporters.mjs). The welcome lists the six carts, all at home.
 // One visitor takes MCT-03's driver's seat and the other hears it is taken, and can't take it themselves; the driver is
 // seen seated wherever they drive it (each page draws the cart under its seated driver); parked, it stays where they left
 // it for everyone, a newcomer included. A driver who leaves the ship mid-drive leaves it where they last said it was.
 {
  const carts=x=>{for(let i=x.msgs.length-1;i>=0;i--){const m=x.msgs[i];if(m.m==='mcts')return m.carts;if(m.m==='welcome')return m.mcts;}return null;};
  const heard=(x,n)=>x.msgs.slice(n).filter(m=>m.m==='mcts').length;
  const atHome=carts(b);
  check('transporters: the welcome lists six carts, none driven, all at home',atHome?.length===CARTS&&CARTS===6&&atHome.every(c=>c.d===null&&c.at===null),JSON.stringify(atHome));
  const home=mctHomes()[2],seat=[home.at[0],home.at[1]+.22,home.at[2]];
  b.pose([home.at[0]-3,home.at[1],home.at[2]-6]);a.pose(seat,{yaw:home.yaw});await sleep(150);
  const nb=b.msgs.length;a.send({m:'mct',e:'take',i:2});await sleep(250);
  check('transporters: a visitor takes MCT-03\'s driver\'s seat and the other visitor hears who has it',carts(b)?.[2].d===a.id&&carts(a)?.[2].d===a.id&&heard(b,nb)===1,JSON.stringify(carts(b)?.[2]));
  const na=a.msgs.length,nb2=b.msgs.length;b.send({m:'mct',e:'take',i:2});await sleep(250);
  check('transporters: while one visitor drives a cart, another can\'t take its seat (only they hear so)',carts(b)?.[2].d===a.id&&heard(b,nb2)===1&&heard(a,na)===0);
  // Driving: seated, at walking pace, out of the bay and round toward the door. The other visitor sees them there.
  const path=[[0,-1.2],[0,-2.4],[-.4,-3.5],[-1.4,-4.4],[-2.6,-4.9]];
  for(const [dx,dz] of path){a.pose([seat[0]+dx,seat[1],seat[2]+dz],{yaw:Math.PI+Math.atan2(-dx,-dz)*.5,rest:'sit'});await sleep(120);}
  a.send({m:'mct',e:'at',i:2,at:[home.at[0]-2.6,home.at[1],home.at[2]-4.9],yaw:4.2});await sleep(250);
  const seen=b.poses.get(a.id);
  check('transporters: the driver is seen seated where they have driven the cart',seen?.rest==='sit'&&Math.abs(seen.pos[0]-(seat[0]-2.6))<.01&&Math.abs(seen.pos[2]-(seat[2]-4.9))<.01,JSON.stringify(seen&&{pos:seen.pos,rest:seen.rest}));
  const parkAt=[+(home.at[0]-3.1).toFixed(2),home.at[1],+(home.at[2]-5.6).toFixed(2)];
  a.send({m:'mct',e:'park',i:2,at:parkAt,yaw:4.4});a.pose([parkAt[0]+1.3,home.at[1],parkAt[2]]);await sleep(250);
  const parked=carts(b)?.[2];
  check('transporters: parked, the cart is free and stays where its driver left it, for the other visitor',parked?.d===null&&JSON.stringify(parked.at)===JSON.stringify(parkAt)&&parked.yaw===4.4,JSON.stringify(parked));
  const late=new Bot(PORT,{name:'Late'});await late.welcomed();
  check('transporters: a newcomer is handed the cart where it was parked',JSON.stringify(carts(late)?.[2])===JSON.stringify(parked)&&carts(late)?.[0].at===null);late.close();
  // Bad input changes nothing: another visitor parking a cart they don't drive, a cart that isn't there, a spot off Deck 1.
  const nb3=b.msgs.length;a.send({m:'mct',e:'park',i:0,at:[0,-39.7,0],yaw:0});a.send({m:'mct',e:'take',i:9});a.send({m:'mct',e:'take',i:'1'});await sleep(250);
  check('transporters: parking a cart nobody gave you, and carts that don\'t exist, are ignored',heard(b,nb3)===0&&carts(b)?.[0].at===null);
  // Someone else drives it off, then leaves the ship mid-drive: it stays where they last were.
  const dee=new Bot(PORT,{name:'Dee'});await dee.welcomed();
  const nb4=b.msgs.length;dee.send({m:'mct',e:'take',i:2});await sleep(200);const took=carts(b)?.[2].d===dee.id;
  dee.send({m:'mct',e:'at',i:2,at:[parkAt[0],20.3,parkAt[2]],yaw:1});await sleep(100);
  dee.send({m:'mct',e:'at',i:2,at:[parkAt[0]-6,home.at[1],parkAt[2]],yaw:4.71});await sleep(150);
  dee.close();await sleep(300);
  const left=carts(b)?.[2];
  check('transporters: a driver who leaves the ship mid-drive leaves the cart free where they last said it was (a spot off Deck 1 is ignored)',
   took&&heard(b,nb4)===2&&left?.d===null&&left.at[0]===+(parkAt[0]-6).toFixed(2)&&left.at[1]===home.at[1]&&left.yaw===4.71,JSON.stringify(left));
 }
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

// ---- the Container Maze's best times (server/maze.mjs), in a file of their own, on a server of its own ---------------
// Real time: no run is believed under MAZE_FASTEST_S, so the runners here wait that long. A run starts at the way in
// and ends at the red button, so each runner's pose is put there first.
{
 const port=PORT+23,file=path.join(os.tmpdir(),`leo-live-maze-check-${port}.json`);fs.rmSync(file,{force:true});
 let srv=await startServer(port,{LEO_LIVE_MAZE:file});
 const ask=async(bot,msg,op)=>{const n=bot.msgs.length;bot.send({m:'maze',...msg});for(let i=0;i<40&&!bot.msgs.slice(n).some(x=>x.m==='maze'&&x.op===op);i++)await sleep(25);return bot.msgs.slice(n).find(x=>x.m==='maze'&&x.op===op);};
 const start=toWorld(MAZE_ROOM,[MAZE_START[0]+.4,0,MAZE_START[2]]),button=toWorld(MAZE_ROOM,[MAZE_BUTTON[0],0,MAZE_BUTTON[2]-.6]),away=toWorld('d02-arrival-1',[-20,0,0]);
 const floor=MAZE_FASTEST_S*1000;
 try{
  const guest=new Bot(port,{name:'Guest'}),bea=new Bot(port,{pass:await creamery.sign(claimsFor('744444444444444444','Bea Cat'))}),
   cal=new Bot(port,{pass:await creamery.sign(claimsFor('755555555555555555','Cal Cat'))}),dee=new Bot(port,{pass:await creamery.sign(claimsFor('766666666666666666','Dee Cat'))}),
   eve=new Bot(port,{pass:await creamery.sign(claimsFor('777777777777777777','Eve Cat'))});
  for(const b of [guest,bea,cal,dee,eve])await b.welcomed();
  const empty=await ask(cal,{op:'board'},'board');
  check('maze: the board starts empty, and says the visitor is signed in',empty?.verified===true&&empty.top.length===0&&empty.you===null,JSON.stringify(empty));
  const t0=Date.now();
  for(const b of [guest,bea,dee,eve]){b.pose(start);b.send({m:'maze',op:'start'});}
  cal.pose(away);cal.send({m:'maze',op:'start'});
  eve.pose(button);
  check('maze: a run faster than the way can be run is refused',(await ask(eve,{op:'finish',ms:floor+200},'result'))?.why==='rejected');
  await sleep(floor+1200-(Date.now()-t0));
  guest.pose(button);
  check("maze: a guest's run is not kept, and they are told to sign in",(await ask(guest,{op:'finish',ms:floor+1000},'result'))?.why==='sign-in');
  cal.pose(button);
  check('maze: a run that never started at the way in is refused',(await ask(cal,{op:'finish',ms:floor+1000},'result'))?.why==='rejected'&&/maze run refused discord:755555555555555555 .*\(no start\)/.test(srv.log));
  dee.pose(away);
  check('maze: a run that ends away from the red button is refused',(await ask(dee,{op:'finish',ms:floor+1000},'result'))?.why==='rejected'&&/maze run refused discord:766666666666666666 .*\(not at the button\)/.test(srv.log));
  bea.pose(button);
  const first=await ask(bea,{op:'finish',ms:floor+1000},'result');
  check("maze: a signed-in runner's time is kept as their fastest",first?.ok===true&&first.newBest&&first.best===floor+1000&&first.rank===1,JSON.stringify(first));
  // Bea runs again from the start, slower: her best stays.
  bea.pose(start);bea.send({m:'maze',op:'start'});await sleep(floor+2500);bea.pose(button);
  const slower=await ask(bea,{op:'finish',ms:floor+2400},'result');
  check('maze: a slower run leaves the best time as it was',slower?.ok===true&&!slower.newBest&&slower.best===floor+1000,JSON.stringify(slower));
  // Another visitor, who has run nothing, sees Bea's time on the board.
  const board=await ask(cal,{op:'board'},'board');
  check("maze: another visitor sees a runner's time on the board",board?.top.length===1&&board.top[0].name==='Bea Cat'&&board.top[0].ms===floor+1000&&board.you===null,JSON.stringify(board));
  const gb=await ask(guest,{op:'board'},'board');
  check('maze: a guest can read the board, marked not signed in',gb?.verified===false&&gb.top.length===1);
  check('maze: kept and refused runs are logged',srv.log.includes(`maze run discord:744444444444444444 Bea Cat ${((floor+1000)/1000).toFixed(1)}s (best)`)&&srv.log.includes('maze run refused discord:777777777777777777'));
  [guest,bea,cal,dee,eve].forEach(b=>b.close());
  await sleep(1300);srv.kill();srv=await startServer(port,{LEO_LIVE_MAZE:file});
  const back=new Bot(port,{name:'Later'});await back.welcomed();const kept=await ask(back,{op:'board'},'board');
  check('maze: the best times are still there after the server restarts',kept?.top.length===1&&kept.top[0].name==='Bea Cat',JSON.stringify(kept));
  back.close();
 }finally{srv.kill();fs.rmSync(file,{force:true});}
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

// ---- the Deck 19 graffiti wall (graffiti.mjs), on a server of its own ----------------------------------------------
// One signed-in visitor sprays; another, looking at the wall, hears the stroke and lays it into their own copy, which then
// matches the wall the server hands a newcomer. Guests may look but not paint; strokes are checked and rate-limited; who
// painted is logged; the paint is kept through a restart in a file that never grows; only the admin clear wipes it.
{
 const port=PORT+12;for(const f of [graffitiFile(port),graffitiClear(port)])fs.rmSync(f,{force:true});let srv=await startServer(port);
 const wait=async(bot,n,test,ms=1000)=>{for(let i=0;i<ms/25;i++){const got=bot.msgs.slice(n).find(test);if(got)return got;await sleep(25);}return null;};
 const look=async bot=>{const n=bot.msgs.length;bot.send({m:'wall'});return wait(bot,n,x=>x.m==='wall');};
 const same=(a,b)=>!!a&&!!b&&a.length===b.length&&a.every((x,i)=>x===b[i]);
 try{
  const guest=new Bot(port,{name:'Guest'}),bea=new Bot(port,{pass:await creamery.sign(claimsFor('912121212121212121','Bea Cat'))}),
   cal=new Bot(port,{pass:await creamery.sign(claimsFor('913131313131313131','Cal Cat'))}),away=new Bot(port,{name:'Away'});
  for(const b of [guest,bea,cal,away])await b.welcomed();
  const bare=await look(guest),calWall=await look(cal);await look(bea);
  check('graffiti: anyone can look at the wall, a guest marked not signed in',bare?.w===WALL.w&&bare.h===WALL.h&&bare.verified===false&&wallFromText(bare.cells)?.every(c=>c===0)&&calWall?.verified===true);
  let n=cal.msgs.length;guest.send({m:'paint',c:3,s:1,p:[10,10,20,20]});
  check("graffiti: a guest's stroke is refused, they are told to sign in, and it reaches nobody",(await wait(guest,0,x=>x.m==='painted'))?.why==='sign-in'&&!await wait(cal,n,x=>x.m==='stroke',300));
  // Bea sprays a line; Cal, looking at the wall, sees it and lays it into his copy.
  const mine=wallFromText(calWall.cells),stroke={c:4,s:1,p:[10,20,30,40,50,40]};
  n=cal.msgs.length;const na=away.msgs.length,nb=bea.msgs.length;bea.send({m:'paint',...stroke});
  const heard=await wait(cal,n,x=>x.m==='stroke');
  check("graffiti: a signed-in visitor's stroke reaches another visitor looking at the wall, as sprayed",heard?.id===bea.id&&heard.c===4&&heard.s===1&&JSON.stringify(heard.p)===JSON.stringify(stroke.p),JSON.stringify(heard));
  check('graffiti: the painter is not sent their own stroke, nor is a visitor who never came to look',!await wait(bea,nb,x=>x.m==='stroke',200)&&!away.msgs.slice(na).some(x=>x.m==='stroke'));
  if(heard)paintStroke(mine,heard);
  // Cal sprays over part of it in blue: colours overlap, the later one on top.
  n=bea.msgs.length;const over={c:9,s:2,p:[30,40]};cal.send({m:'paint',...over});const beaHeard=await wait(bea,n,x=>x.m==='stroke');paintStroke(mine,over);
  const late=new Bot(port,{name:'Late'});await late.welcomed();const lateWall=wallFromText((await look(late))?.cells);
  check('graffiti: what another visitor saw sprayed matches the wall a newcomer is handed',!!beaHeard&&same(lateWall,mine)&&mine.filter(c=>c===4).length>50,`${mine.filter(c=>c===4).length} orange cells, ${mine.filter(c=>c===9).length} blue`);
  check('graffiti: painting over paint leaves the later colour on top',lateWall?.[40*WALL.w+30]===9&&lateWall?.[20*WALL.w+10]===4);
  n=cal.msgs.length;
  for(const bad of [{c:0,s:1,p:[1,1]},{c:13,s:1,p:[1,1]},{c:2,s:5,p:[1,1]},{c:2,s:1,p:[WALL.w,1]},{c:2,s:1,p:[1,-1]},{c:2,s:1,p:[1,2,3]},{c:2,s:1,p:Array(60).fill(5)},{c:2,s:1.5,p:[1,1]},{c:'2',s:1,p:[1,1]},{c:2,s:1,p:'here'}])bea.send({m:'paint',...bad});
  check('graffiti: malformed strokes are ignored',!await wait(cal,n,x=>x.m==='stroke',400)&&bea.closed===null);
  await sleep(2100);n=cal.msgs.length;const nb2=bea.msgs.length;
  for(let i=0;i<60;i++)bea.send({m:'paint',c:6,s:0,p:[100,200+(i%20)]});await sleep(400);
  const passed=cal.msgs.slice(n).filter(x=>x.m==='stroke').length;
  check('graffiti: a flood of strokes is rate-limited and the painter told',passed<=30&&passed>=20&&bea.msgs.slice(nb2).some(x=>x.m==='painted'&&x.why==='slow')&&bea.closed===null,`${passed} of 60 passed on`);
  check('graffiti: who starts painting is logged at once',/graffiti painting discord:912121212121212121 "Bea Cat"/.test(srv.log));
  bea.close();await sleep(300);
  check('graffiti: when they stop, how much they painted, in which colours and where is logged',/graffiti painted discord:912121212121212121 "Bea Cat" \d+ strokes \d+ cells colours 4,6 across 10-100 down 20-219/.test(srv.log),(srv.log.match(/graffiti painted .*/)||[''])[0]);
  const before=wallFromText((await look(late))?.cells);[guest,cal,away,late].forEach(b=>b.close());
  await sleep(1300);const size=fs.statSync(graffitiFile(port)).size;srv.kill();srv=await startServer(port);
  const back=new Bot(port,{name:'Back'});await back.welcomed();const kept=wallFromText((await look(back))?.cells);
  check('graffiti: the paint is still there after the server restarts',same(kept,before)&&kept.some(c=>c===6),`file ${size} bytes`);
  // More paint, and the file is the same size: the wall is a fixed grid, not a growing list.
  const dee=new Bot(port,{pass:await creamery.sign(claimsFor('914141414141414141','Dee Cat'))});await dee.welcomed();
  for(let i=0;i<20;i++){dee.send({m:'paint',c:1+i%12,s:2,p:[i*5,i*10,119-i*5,223-i*10]});await sleep(90);}
  await sleep(1300);const grown=fs.statSync(graffitiFile(port)).size;
  check('graffiti: the stored wall stays the same size however much is painted',grown===size&&size<40000,`${size} bytes, then ${grown}`);
  // The admin clear: the clear file appears, the wall goes bare for everyone looking, it is logged, the file is removed.
  n=back.msgs.length;fs.writeFileSync(graffitiClear(port),'check-live\n');
  const cleared=await wait(back,n,x=>x.m==='wall'&&x.cleared,4000);
  check('graffiti: the admin clear wipes the wall for everyone looking, and is logged',!!cleared&&wallFromText(cleared.cells)?.every(c=>c===0)&&/graffiti wall cleared \(admin: "check-live"\)/.test(srv.log)&&!fs.existsSync(graffitiClear(port)));
  back.close();dee.close();await sleep(300);srv.kill();srv=await startServer(port);
  const after=new Bot(port,{name:'After'});await after.welcomed();
  check('graffiti: a cleared wall stays clear after a restart',wallFromText((await look(after))?.cells)?.every(c=>c===0));
  after.close();
 }finally{srv.kill();for(const f of [graffitiFile(port),graffitiClear(port)])fs.rmSync(f,{force:true});}
}

// ---- the Crown lounge TV (tv.mjs), on a server of its own -----------------------------------------------------------
// A signed-in visitor gets a ticket and uploads an mp4 over HTTP; another visitor, who asked nothing, hears that it is on
// and who shared it, and can fetch the very same file (whole, or a range of it). Guests may watch but not upload; files
// that aren't H.264 mp4, too long, too big or from another site are refused; a ticket works once; the video survives a
// restart; only an owner (or the admin clear file) takes it down, which blanks it for everyone and deletes the file.
{
 const port=PORT+24,dir=tvDir(port);fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(tvClear(port),{force:true});
 const env={LEO_LIVE_TV_OWNERS:'914141414141414141',LEO_LIVE_TV_MAX_MB:'3'};let srv=await startServer(port,env);
 const wait=async(bot,n,test,ms=1500)=>{for(let i=0;i<ms/25;i++){const got=bot.msgs.slice(n).find(test);if(got)return got;await sleep(25);}return null;};
 const ask=async(bot,m)=>{const n=bot.msgs.length;bot.send({m});return wait(bot,n,x=>x.m===(m==='tv-down'?'tv-ticket':m));};
 // A request to the server's web side: {status, headers, body (a Buffer), json}.
 const request=(method,pathname,{body,headers={}}={})=>new Promise((resolve,reject)=>{
  const q=http.request({host:'127.0.0.1',port,method,path:pathname,headers:{...(body?{'Content-Length':String(body.length)}:{}),...headers}},res=>{
   const parts=[];res.on('data',c=>parts.push(c));res.on('end',()=>{const b=Buffer.concat(parts);let json=null;try{json=JSON.parse(b);}catch{}resolve({status:res.statusCode,headers:res.headers,body:b,json});});});
  q.on('error',e=>resolve({status:0,headers:{},body:Buffer.alloc(0),json:null,error:e.message}));if(body)q.end(body);else q.end();});
 const upload=(bot,body,ticket,{origin='http://localhost:4180',type='video/mp4'}={})=>request('POST','/tv/upload',{body,headers:{Origin:origin,'Content-Type':type,'X-Leo-Tv-Ticket':ticket||''}});
 const ticketOf=async bot=>(await ask(bot,'tv-ticket'))?.ticket;
 const clip=fs.readFileSync('src/walk/art/theatre-loop.mp4');
 // The same clip made five minutes long (its mvhd duration), and re-labelled HEVC (its first sample entry).
 const longer=Buffer.from(clip),mv=longer.indexOf('mvhd'),scale=longer.readUInt32BE(mv+16);longer.writeUInt32BE(scale*300,mv+20);
 const hevc=Buffer.from(clip);hevc.write('hvc1',hevc.indexOf('avc1',hevc.indexOf('stsd')),'latin1');
 try{
  const guest=new Bot(port,{name:'Guest'}),bea=new Bot(port,{pass:await creamery.sign(claimsFor('912121212121212121','Bea Cat'))}),
   cal=new Bot(port,{pass:await creamery.sign(claimsFor('913131313131313131','Cal Cat'))}),jay=new Bot(port,{pass:await creamery.sign(claimsFor('914141414141414141','Jay Owner'))});
  for(const b of [guest,bea,cal,jay])await b.welcomed();
  const first=await ask(guest,'tv'),calFirst=await ask(cal,'tv'),jayFirst=await ask(jay,'tv');
  check('tv: anyone can ask what is on; nothing yet, and only the owner is marked owner',first?.video===null&&first.verified===false&&first.owner===false&&calFirst?.verified===true&&calFirst.owner===false&&jayFirst?.owner===true&&first.max?.mb===3,JSON.stringify(first));
  check('tv: a guest asking to upload is told to sign in',(await ask(guest,'tv-ticket'))?.why==='sign-in');
  const t1=await ticketOf(bea);
  check('tv: a signed-in visitor gets a one-time upload ticket',/^[0-9a-f]{48}$/.test(t1||''));
  const nc=cal.msgs.length,ng=guest.msgs.length,up=await upload(bea,clip,t1);
  check('tv: an H.264 mp4 within the limits is taken',up.status===200&&up.json?.ok===true&&/^[0-9a-f]{16}$/.test(up.json.video?.id)&&up.headers['access-control-allow-origin']==='http://localhost:4180',`${up.status} ${up.body.toString().slice(0,160)}`);
  const heard=await wait(cal,nc,x=>x.m==='tv'&&x.video),heardGuest=await wait(guest,ng,x=>x.m==='tv'&&x.video);
  check('tv: another visitor hears the new video and who shared it, without asking',heard?.video?.id===up.json?.video?.id&&heard.video.name==='Bea Cat'&&heard.video.src===`/tv/${heard.video.id}.mp4`&&Math.abs(heard.video.seconds-34.3)<.2&&heard.video.width===960,JSON.stringify(heard?.video));
  check('tv: a guest hears it too, still marked not signed in',heardGuest?.video?.id===heard?.video?.id&&heardGuest.verified===false);
  const got=await request('GET',heard?.video?.src||'/tv/none'),part=await request('GET',heard?.video?.src||'/tv/none',{headers:{Range:'bytes=100-299'}});
  check('tv: the other visitor can fetch the very same file, as video/mp4, from any page',got.status===200&&got.body.equals(clip)&&got.headers['content-type']==='video/mp4'&&got.headers['access-control-allow-origin']==='*',`${got.status} ${got.body.length} bytes`);
  check('tv: a range of it comes back as asked, so a browser can seek',part.status===206&&part.body.equals(clip.subarray(100,300))&&part.headers['content-range']===`bytes 100-299/${clip.length}`);
  check('tv: a ticket works once',(await upload(bea,clip,t1)).json?.why==='ticket');
  check('tv: one upload a minute per account',(await ask(bea,'tv-ticket'))?.why==='slow');
  const refusals={};
  for(const [what,body,opts] of [['not-mp4',Buffer.from('this is not a video at all, just some text'.repeat(20))],['codec',hevc],['long',longer],['origin',clip,{origin:'https://evil.example'}],['big',Buffer.concat([clip,Buffer.alloc(1024*1024)])]])
   refusals[what]=(await upload(cal,body,await ticketOf(cal),opts)).json?.why;
  check('tv: text, HEVC, a five-minute video, another site and an oversized file are each refused, with why',Object.entries(refusals).every(([k,v])=>v===k),JSON.stringify(refusals));
  check('tv: refusals leave the video as it was',(await ask(guest,'tv'))?.video?.id===heard?.video?.id);
  check('tv: who uploaded what is logged',new RegExp(`tv video ${heard?.video?.id} discord:912121212121212121 "Bea Cat" ${clip.length} bytes 34.3s 960x540`).test(srv.log),(srv.log.match(/tv video .*/)||[''])[0]);
  // A restart keeps it.
  for(const b of [guest,bea,cal,jay])b.close();srv.kill();await sleep(300);srv=await startServer(port,env);
  const dot=new Bot(port,{name:'Dot'}),cal2=new Bot(port,{pass:await creamery.sign(claimsFor('913131313131313131','Cal Cat'))}),jay2=new Bot(port,{pass:await creamery.sign(claimsFor('914141414141414141','Jay Owner'))});
  for(const b of [dot,cal2,jay2])await b.welcomed();
  const kept=await ask(dot,'tv');
  check('tv: the video is still on after the server restarts',kept?.video?.id===heard?.video?.id&&kept.video.name==='Bea Cat'&&(await request('GET',kept.video.src)).body.equals(clip));
  check('tv: a visitor who is not an owner cannot take it down',(await ask(cal2,'tv-down'))?.why==='not-owner'&&(await ask(dot,'tv'))?.video?.id===heard?.video?.id);
  let n=dot.msgs.length;jay2.send({m:'tv-down'});
  const down=await wait(dot,n,x=>x.m==='tv'&&x.video===null);
  check('tv: an owner takes it down, and every visitor sees the screen go blank',!!down&&down.down===true&&(await request('GET',heard?.video?.src||'/tv/none')).status===404&&!fs.existsSync(path.join(dir,`${heard?.video?.id}.mp4`))&&/tv taken down \S+ discord:912121212121212121 "Bea Cat" \(owner discord:914141414141414141 "Jay Owner"\)/.test(srv.log),(srv.log.match(/tv taken down .*/)||[''])[0]);
  const again=await upload(cal2,clip,await ticketOf(cal2));
  n=dot.msgs.length;fs.writeFileSync(tvClear(port),'check-live\n');
  const cleared=await wait(dot,n,x=>x.m==='tv'&&x.video===null,4000);
  check('tv: the admin clear file takes a video down for everyone, and is logged',again.json?.ok===true&&!!cleared&&/tv taken down \S+ discord:913131313131313131 "Cal Cat" \(admin: "check-live"\)/.test(srv.log)&&!fs.existsSync(tvClear(port))&&fs.readdirSync(dir).filter(f=>f.endsWith('.mp4')).length===0);
  for(const b of [dot,cal2,jay2])b.close();
 }finally{srv.kill();}
}

// ---- Paws Off's gym rounds (server/gym.mjs), on a server of its own ----------------------------------------------------
// One runner on a Deck 16 treadmill and one on the arcade's step on; a third, standing by, asks too. When the countdown
// ends, the two on treadmills run on one seed and the third is told to run alone. One falls, and the other hears it; once
// both are off, both hear the same ranked results. Then a round someone leaves mid-run, and a countdown given up.
{
 const port=PORT+23,srv=await startServer(port);
 try{
  const gymOf=(x,e)=>x.msgs.filter(m=>m.m==='gym'&&(!e||m.e===e)),t=arcadeTreadmill(),arcadeOn=t.centre.clone().addScaledVector(t.front,-t.length*.08).toArray();
  const a=new Bot(port,{name:'Ann'}),b=new Bot(port,{name:'Bea'}),c=new Bot(port,{name:'Cal'});await a.welcomed();await b.welcomed();await c.welcomed();
  a.pose([7,20.56,-47.79],{yaw:Math.PI,pl:true});b.pose(arcadeOn,{pl:true});c.pose([10,20.3,-44]);await sleep(200);
  a.send({m:'gym',e:'in'});await sleep(1000);b.send({m:'gym',e:'in'});c.send({m:'gym',e:'in'});await sleep(300);
  const wa=gymOf(a,'wait').at(-1),wb=gymOf(b,'wait').at(-1);
  check('gym: stepping on opens a short countdown that others on a treadmill join',!!wa&&wa.round===wb?.round&&wa.n===3&&wb.ms>3500&&wb.ms<5200,JSON.stringify({wa,wb}));
  await sleep(5200);
  const ga=gymOf(a,'go')[0],gb=gymOf(b,'go')[0];
  check('gym: when the countdown ends, those on a treadmill (Deck 16 and the arcade) run on one seed',!!ga&&ga.round===wa.round&&gb?.seed===ga.seed&&Number.isInteger(ga.seed)&&JSON.stringify(ga.runners.map(r=>r.id).sort())===JSON.stringify([a.id,b.id].sort())&&ga.runners.find(r=>r.id===b.id)?.name==='Bea',JSON.stringify(ga));
  check('gym: someone who asked but is not on a treadmill is told to run alone',gymOf(c,'cancel').length===1&&!gymOf(c,'go').length);
  await sleep(1500);b.send({m:'gym',e:'fell',round:ga.round,t:1.4,cleared:2});await sleep(300);
  const heard=gymOf(a,'out').at(-1);
  check("gym: one runner's fall reaches the other, with how many are still running",heard?.id===b.id&&heard.how==='fell'&&heard.t===1.4&&heard.running===1,JSON.stringify(heard));
  check('gym: no results while someone is still running',!gymOf(a,'results').length&&!gymOf(b,'results').length);
  await sleep(1000);a.send({m:'gym',e:'fell',round:ga.round,t:999,cleared:9});await sleep(300);
  const ra=gymOf(a,'results')[0],rb=gymOf(b,'results')[0];
  check('gym: once all are off, every runner hears the same ranked results with their place',!!ra&&JSON.stringify(ra)===JSON.stringify(rb)&&ra.ranks[0].id===a.id&&ra.ranks[0].place===1&&ra.ranks[1].id===b.id&&ra.ranks[1].place===2&&ra.ranks[1].t===1.4,JSON.stringify(ra));
  check('gym: a time longer than the round has run is cut to what it ran',ra?.ranks[0].t>2&&ra.ranks[0].t<4.5,JSON.stringify(ra?.ranks[0]));
  // Leaving mid-round: out at once, listed after those who fell.
  const d=new Bot(port,{name:'Dot'});await d.welcomed();d.pose([15,20.56,-47.79],{yaw:Math.PI,pl:true});await sleep(200);
  a.send({m:'gym',e:'in'});d.send({m:'gym',e:'in'});await sleep(6300);
  const g2=gymOf(a,'go').at(-1);
  check('gym: a new round after the last, with a new seed',g2&&g2.round!==ga.round&&g2.seed!==ga.seed&&g2.runners.length===2,JSON.stringify(g2));
  await sleep(1500);d.close();await sleep(300);
  const left=gymOf(a,'out').at(-1);
  check('gym: someone leaving the ship mid-round is out of it at once, and the other hears it',left?.id===d.id&&left.how==='left'&&left.running===1&&left.round===g2?.round,JSON.stringify(left));
  a.send({m:'gym',e:'fell',round:g2?.round,t:.8,cleared:1});await sleep(300);
  const r2=gymOf(a,'results').at(-1);
  check('gym: those who left are ranked after those who fell',r2?.round===g2?.round&&r2.ranks[0].id===a.id&&r2.ranks[0].how==='fell'&&r2.ranks[1].id===d.id&&r2.ranks[1].how==='left',JSON.stringify(r2));
  // Stepping off during the countdown: no round for them.
  const before=gymOf(a,'go').length;a.send({m:'gym',e:'in'});await sleep(300);a.send({m:'gym',e:'off'});await sleep(6300);
  check('gym: stepping off in the countdown leaves no round',gymOf(a,'go').length===before&&!/gym round 3 /.test(srv.log));
  check('gym: rounds are logged as they start and end',(srv.log.match(/ gym results /g)||[]).length===2);
  for(const x of [a,b,c])x.close();
 }finally{srv.kill();}
}

// ---- the Deck 1 transporters' daily reset (server/transporters.mjs), with a stand-in clock ------------------------------
{
 let clock=new Date(2026,9,28,15,0),said=[];const v={id:'voyager-a',name:'A'},w={id:'voyager-b',name:'B'};
 const t=transporterServer({log(){},broadcast:m=>said.push(m),send(){},now:()=>clock,resetHour:4});
 t.message(v,{e:'take',i:0});t.message(v,{e:'park',i:0,at:[-60,-39.7,40],yaw:1});t.message(w,{e:'take',i:1});t.message(w,{e:'at',i:1,at:[-70,-39.7,38],yaw:2});
 clock=new Date(2026,9,29,3,59);t.tick();const before=t.state();
 clock=new Date(2026,9,29,4,1);said=[];t.tick();const after=t.state();
 check('transporters: at the daily reset, a parked cart goes home; one being driven stays with its driver',before[0].at?.[0]===-60&&after[0].at===null&&after[1].d==='voyager-b'&&after[1].at?.[0]===-70&&said.length===1,JSON.stringify(after.slice(0,2)));
 said=[];t.tick();clock=new Date(2026,9,29,23,0);t.tick();
 check('transporters: only once a day',said.length===0);
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
await sleep(300);for(const port of started){fs.rmSync(tvDir(port),{recursive:true,force:true});fs.rmSync(tvClear(port),{force:true});}
console.log(results.join('\n'));
console.log(failed?`${failed} FAILED`:'All Leo live checks passed');
process.exit(failed?1:0);
