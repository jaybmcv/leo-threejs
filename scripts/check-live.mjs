// npm run check:live: Leo live (server/leo-live.mjs) against scripted visitors. Starts real servers on spare ports and
// checks the pose wire, joining, poses reaching others near and far, names, the shared lifts, leaving, a second tab,
// bad input, the cap on visitors and, last, sixty visitors walking at once (bytes sent per visitor per second).
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {encodeRecord,encodeIdentity,assembleFrame,decodeFrame,WireReader,actorIdOf,PROTOCOL} from '../src/walk/net/wire.js';
import {LIFTS} from '../src/walk/lifts.js';

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
 const torn=[frame.slice(0,frame.length-1),Uint8Array.of(0x4c,9,0,0,0,0),randomBytes(40)];
 check('wire: torn, foreign and random frames are dropped',torn.every(f=>decodeFrame(f)===null));
 let threw=0;for(const bad of [{...poses[0],pos:[NaN,0,0]},{...poses[0],pos:[1e6,0,0]},{...poses[0],stance:'fly'},{...poses[0],jumpCount:9}])try{encodeRecord(1,bad);}catch{threw++;}
 check('wire: out-of-range poses are refused',threw===4);
 const reader=new WireReader();
 check('wire: a pose from a slot never introduced is skipped',reader.read(assembleFrame([],[encodeRecord(3,poses[0])])).length===0);
}

// ---- a server and some visitors -----------------------------------------------------------------------------------
function startServer(port,env={}){
 const child=spawn(process.execPath,['server/leo-live.mjs'],{env:{...process.env,PORT:String(port),...env},stdio:['ignore','pipe','pipe']});
 return new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(/Leo live on/.test(d))resolve(child);});child.on('exit',c=>reject(new Error('server exited '+c)));setTimeout(()=>reject(new Error('server did not start')),10000);});
}
class Bot{
 constructor(port,{name='',key=randomBytes(32).toString('hex'),origin='http://localhost:4180',v=PROTOCOL}={}){
  Object.assign(this,{key,name,poses:new Map(),frames:0,bytes:0,msgs:[],gone:[],lifts:[],closed:null,reader:new WireReader(),got:new Map()});
  this.ws=new WebSocket(`ws://127.0.0.1:${port}/live`,{origin});
  this.opened=new Promise((resolve,reject)=>{this.ws.on('open',()=>{this.ws.send(JSON.stringify({m:'hello',v,key,name}));resolve();});this.ws.on('error',reject);this.ws.on('unexpected-response',(q,res)=>reject(new Error('HTTP '+res.statusCode)));});
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
 check('join: a socket that never says hello is closed',await (async()=>{for(let i=0;i<40&&!silentClosed;i++)await sleep(200);return silentClosed;})());
 for(const bot of [b,far,tab])bot.close();
}finally{server.kill();}

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

console.log(results.join('\n'));
console.log(failed?`${failed} FAILED`:'All Leo live checks passed');
process.exit(failed?1:0);
