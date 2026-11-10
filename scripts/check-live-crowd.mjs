// Leo live with a crowd (server/live-core.mjs flush): how often a page hears of each other visitor by distance, a change
// of state heard at once from anywhere, a page's budget in a dense crowd with its nearest heard first, a seat that
// changes hands heard as someone new, a visitor who has left (taken over, or gone while their pass was checked) holding
// no seat and sending no poses, the budget full with nobody left unheard, and names in the aboard count only up to
// NAMES_UP_TO. A real local server with every state file in a temporary folder (as check-live-spatial-v2.mjs runs one),
// slow keys for a pass from a local stand-in, and bots on WebSockets.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {WireReader,PROTOCOL} from '../src/walk/net/wire.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const STATE={LEO_LIVE_SCORES:'scores.json',LEO_LIVE_HEARTS:'hearts.json',LEO_LIVE_CHAT_LOG:'chat.json',LEO_LIVE_GRAFFITI:'graffiti.json',LEO_LIVE_GRAFFITI_CLEAR:'graffiti-clear',
 LEO_LIVE_TV:'tv',LEO_LIVE_TV_CLEAR:'tv-clear',LEO_LIVE_MAZE:'maze.json',LEO_LIVE_TREASURE:'treasure.json',LEO_LIVE_GIVEAWAY:'giveaway.json',LEO_LIVE_GIVEAWAY_CLAIMS:'claims.json',
 LEO_LIVE_ARENA_STATS:'stats.json',LEO_LIVE_HALLOWEEN:'halloween.json'};
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'leo-live-crowd-'));
const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
// Creamery's keys, slow to come: a hello with a pass waits a moment for them.
const keys=http.createServer((req,res)=>setTimeout(()=>{res.writeHead(200,{'Content-Type':'application/json'});res.end('{"keys":[]}');},1500));
await new Promise(r=>keys.listen(0,'127.0.0.1',r));
const server=spawn(process.execPath,['server/leo-live.mjs'],{env:{...process.env,LEO_LAYOUT:'2',PORT:String(port),LEO_LIVE_MAX:'500',LEO_PASS_ISS:'http://127.0.0.1',
 LEO_PASS_JWKS_URL:`http://127.0.0.1:${keys.address().port}/keys`,...Object.fromEntries(Object.entries(STATE).map(([k,v])=>[k,path.join(dir,v)]))},windowsHide:true,stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',b=>{log+=b;});server.stderr.on('data',b=>{log+=b;});
const bots=[];
const health=async()=>(await fetch(`http://127.0.0.1:${port}/health`)).json();
let identity=null;
// (a bot's onText, when it has one, hears each message in text)
async function bot(name,key=randomBytes(32).toString('hex')){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/live`,{origin:'http://localhost:4180'}),b={ws,name,reader:new WireReader(),heard:[],frames:[],aboard:[],gone:[],id:null};bots.push(b);
 ws.on('message',(data,binary)=>{const now=performance.now();
  if(!binary){const m=JSON.parse(data);if(m.m==='welcome')b.id=m.id;if(m.m==='aboard')b.aboard.push(m);if(m.m==='gone')b.gone.push(m.id);b.onText?.(m);return;}
  const poses=b.reader.read(data);b.frames.push(poses.length);for(const p of poses)b.heard.push({at:now,id:p.id,name:p.name,stance:p.stance,emote:p.emote,x:p.pos[0]});});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 ws.send(JSON.stringify({m:'hello',v:PROTOCOL,layout:2,layoutIdentity:identity,key,name}));
 for(let i=0;i<100&&!b.id;i++)await sleep(20);assert.ok(b.id,name+' aboard');
 b.pose=(pos,extra={})=>ws.send(JSON.stringify({m:'pose',p:{pos,yaw:0,g:true,st:'stand',jc:0,js:-1,r:0,e:null,rest:null,pl:false,b:false,gl:false,hk:null,f:0,...extra}}));
 return b;
}
// Each walker paces a step to and fro round its spot ten times a second, as a page sends its pose.
const walking=new Map();let ticks=null;
const walk=(b,spot,extra)=>{walking.set(b,{spot,extra});};
const startWalking=()=>{let t=0;ticks=setInterval(()=>{t++;for(const [b,{spot:[x,y,z],extra}] of walking)if(b.ws.readyState===1)b.pose([x+.3*Math.sin(t),y,z],extra?.()??{});},100);};
const gaps=(b,id,from)=>{const at=b.heard.filter(h=>h.id===id&&h.at>=from).map(h=>h.at);return at.slice(1).map((t,i)=>t-at[i]);};
const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1];};
try{
 for(let i=0;i<600&&!/Leo live on/.test(log);i++)await sleep(100);assert.ok(/Leo live on/.test(log),'server started:\n'+log.slice(-1500));
 // (the budget a page's frame has: LEO_LIVE_PAGE_RECORDS, from this environment, or the server's own)
 const {layoutIdentity,pageRecords:budget}=await health();identity=layoutIdentity;
 // A page at the middle of a deck and visitors 10, 25 and 50 m away on it, 120 m away, and right above on another deck.
 const me=await bot('Me'),near=await bot('Near'),mid=await bot('Mid'),edge=await bot('Edge'),far=await bot('Far'),above=await bot('Above');
 walk(me,[0,5,0]);walk(near,[10,5,0]);walk(mid,[25,5,0]);walk(edge,[50,5,0]);walk(far,[120,5,0]);walk(above,[0,17,0]);startWalking();
 await sleep(1500);const from=performance.now();await sleep(4000);
 const m=b=>median(gaps(me,b.id,from));
 // (A page is sent a frame every 100 ms, so each gap comes to a whole number of frames: up to one more. On Windows a 50 ms
 // timer runs at about 62 ms, so a frame comes about every 125 ms.)
 const [gNear,gMid,gEdge,gFar,gAbove]=[near,mid,edge,far,above].map(m);
 assert.ok(gNear<170,`within 16 m every pose (~100 ms): ${gNear}`);assert.ok(gMid>=180&&gMid<340,`16-32 m about every 200 ms: ${gMid}`);
 assert.ok(gEdge>=360&&gEdge<600,`32-64 m about every 400 ms: ${gEdge}`);assert.ok(gFar>=900&&gFar<1300,`beyond 64 m every second: ${gFar}`);
 assert.ok(gAbove>=900&&gAbove<1300,`another deck every second: ${gAbove}`);
 pass(`a page hears each visitor by distance: ${[gNear,gMid,gEdge,gFar,gAbove].map(Math.round).join(', ')} ms (10, 25, 50, 120 m, another deck)`);

 // A move from far away (a stance, an emote) reaches the page at the next flush, not a second later.
 for(const [extra,label] of [[{st:'crouch'},'crouch'],[{e:'dance'},'dance']]){
  await sleep(300);walking.set(far,{spot:[120,5,0],extra:()=>extra});const t=performance.now();
  for(let i=0;i<40&&!me.heard.some(h=>h.id===far.id&&h.at>=t&&(h.stance==='crouch'&&label==='crouch'||h.emote==='dance'));i++)await sleep(10);
  const h=me.heard.find(x=>x.id===far.id&&x.at>=t&&(label==='crouch'?x.stance==='crouch':x.emote==='dance'));
  assert.ok(h,`heard the far visitor ${label}`);assert.ok(h.at-t<250,`${label} heard ${Math.round(h.at-t)} ms after it was sent`);
  walking.set(far,{spot:[120,5,0]});
 }
 pass('a far visitor\'s crouch and emote are heard at the next flush');

 // A dense crowd: sixty more 2 to 14 m away, the nearer the lower their number. No frame carries more than the budget;
 // the nearest (the server's NEAR_MOST, 24, as many as a page gives a body) are heard with each pose they send, and
 // the rest often. (Each walker sways a little, so those either side of the 24th are left out.)
 const crowd=[];for(let i=0;i<60;i++){const b=await bot('Crowd '+i);crowd.push(b);const d=2+i*.2;walk(b,[Math.cos(i)*d,5,Math.sin(i)*d]);}
 await sleep(2500);const c0=performance.now(),f0=me.frames.length;await sleep(3000);
 const most=Math.max(...me.frames.slice(f0)),gapOf=b=>median(gaps(me,b.id,c0));
 const nearest=Math.max(...crowd.slice(0,20).map(gapOf)),rest=Math.max(...crowd.slice(28).map(gapOf));
 assert.ok(most<=budget,`a frame carried ${most} poses (the budget: ${budget})`);
 assert.ok(nearest<150,`one of the nearest heard every ${nearest} ms`);assert.ok(rest<400,`one of the rest heard every ${rest} ms`);
 pass(`in a crowd of 66 a frame carries at most ${most} poses; the nearest are heard every ${Math.round(nearest)} ms or less, the rest every ${Math.round(rest)} ms or less (medians)`);

 // A seat changing hands: the newcomer is heard as someone new, with their own name.
 const leaving=crowd.pop();walking.delete(leaving);leaving.ws.close();await sleep(300);assert.ok(me.gone.includes(leaving.id));
 const newcomer=await bot('Newcomer');walk(newcomer,[3,5,3]);await sleep(600);
 assert.ok(me.heard.some(h=>h.id===newcomer.id&&h.name==='Newcomer'));
 pass('a visitor who leaves is gone, and one taking their seat is heard as themself');

 // A visitor taken over by another tab (the same key) has left and lost their seat, but their socket may still send
 // poses as it closes (here, from 30 m off): the server lets them go. No page hears them, and it carries on.
 const key=randomBytes(32).toString('hex'),twin=await bot('Twin',key);twin.pose([1,5,1]);await sleep(300);
 let late=0;twin.onText=m=>{if(m.m==='replaced')for(let i=0;i<5;i++,late++)twin.pose([30+i*.1,5,30],{st:i%2?'crouch':'stand'});};
 const t1=performance.now(),takeover=await bot('Twin again',key);takeover.pose([1,5,1]);await sleep(800);
 assert.equal(late,5,'the first tab was told it was replaced, and sent its poses');
 assert.equal(server.exitCode,null,'the server stopped:\n'+log.slice(-1500));
 assert.ok(!me.heard.some(h=>h.id===takeover.id&&h.at>=t1&&h.x>=29),'a page heard a pose sent after its visitor left');
 const f1=me.frames.length;await sleep(400);assert.ok(me.frames.length>f1,'the page still gets frames');assert.ok((await health()).ok);
 pass('poses from a visitor taken over by another tab, sent as its socket closes, are let go');

 // A hello still waiting on its pass when its socket closes (Creamery's keys are slow to come here) takes no seat.
 const free0=(await health()).seatsFree,token=[{alg:'EdDSA',kid:'slow'},{}].map(o=>Buffer.from(JSON.stringify(o)).toString('base64url')).join('.')+'.AA';
 for(let i=0;i<3;i++){
  const ws=new WebSocket(`ws://127.0.0.1:${port}/live`,{origin:'http://localhost:4180'});await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
  ws.send(JSON.stringify({m:'hello',v:PROTOCOL,layout:2,layoutIdentity:identity,key:randomBytes(32).toString('hex'),name:'Gone '+i,pass:token}));ws.close();
 }
 await sleep(2500);
 assert.equal((await health()).seatsFree,free0,'a hello left while its pass was checked kept a seat');
 pass('a hello left while its pass is being checked takes no seat');

 // Names: the aboard count carries them up to 150 aboard (more who only look on, not posing), then 'heard'.
 const lastNames=()=>me.aboard.at(-1);
 for(let i=bots.filter(b=>b.ws.readyState===1).length;i<150;i++)await bot('Looking on '+i);await sleep(300);
 assert.equal(lastNames().n,150);assert.ok(Array.isArray(lastNames().names)&&lastNames().names.includes('Newcomer'));
 const one=await bot('One more');await sleep(300);
 assert.equal(lastNames().n,151);assert.equal(lastNames().names,'heard');
 one.ws.close();await sleep(300);assert.equal(lastNames().n,150);assert.ok(Array.isArray(lastNames().names)&&lastNames().names.length===150);
 pass('the aboard count carries the names up to 150 aboard, then says they are heard');

 // The budget at work: 250 more walking 16 to 32 m off, and 80 more 16 to 60 m off changing state with every pose
 // (crouching and standing: a crowd at a Simon Says round), so a frame can not carry all that is due even at the
 // slowest pace. Frames carry no more than the budget and mostly fill it (the page's pace keeps them just under), the
 // middle ring is heard less often to fit, the nearest are still heard with each pose, and nobody posing goes unheard,
 // the farthest included: the changes of state, and each ring, take only their share.
 const middle=[];
 for(let j=0;j<330;j++){
  const b=await bot('More '+j),d=j<250?17+(j*.37)%14:16+(j*.53)%44,a=j*2.4;let flip=false;if(j<250)middle.push(b);
  walk(b,[Math.cos(a)*d,5,Math.sin(a)*d],j<250?undefined:()=>({st:(flip=!flip)?'crouch':'stand'}));
 }
 await sleep(3000);const e0=performance.now(),g0=me.frames.length;await sleep(8000);const e1=performance.now();
 const full=me.frames.slice(g0),posing=[...walking.keys()].filter(b=>b!==me&&b.ws.readyState===1);
 const unheard=posing.filter(b=>!me.heard.some(h=>h.id===b.id&&h.at>=e0)).map(b=>b.name);
 const nearestNow=Math.max(...crowd.slice(0,20).map(b=>median(gaps(me,b.id,e0))));
 const meanFull=full.reduce((s,n)=>s+n,0)/full.length,middleGap=median(middle.map(b=>median(gaps(me,b.id,e0))).filter(Number.isFinite));
 // (the longest each went unheard in the window, from its start and to its end too)
 const longest=Math.max(...posing.map(b=>{const at=[e0,...me.heard.filter(h=>h.id===b.id&&h.at>=e0).map(h=>h.at),e1];return Math.max(...at.slice(1).map((t,i)=>t-at[i]));}));
 assert.ok(Math.max(...full)<=budget&&meanFull>=budget*.7,`frames carried ${Math.min(...full)} to ${Math.max(...full)} poses, ${meanFull.toFixed(1)} on average: the budget is ${budget}`);
 assert.ok(middleGap>=400,`the middle ring heard every ${middleGap} ms, not slowed to fit`);
 assert.deepEqual(unheard.slice(0,12),[],`${unheard.length} unheard for 8 s`);assert.ok(longest<6500,`one went unheard for ${Math.round(longest)} ms`);assert.ok(nearestNow<170,`one of the nearest heard every ${nearestNow} ms`);
 pass(`with ${posing.length} posing, 80 changing state at every pose, frames carry ${Math.min(...full)} to ${Math.max(...full)} poses (the budget: ${budget}), the middle ring is heard every ${Math.round(middleGap)} ms, the nearest every ${Math.round(nearestNow)} ms or less, and nobody goes unheard for more than ${(longest/1000).toFixed(1)} s`);

 const h=await health();assert.ok(h.flush&&h.flush.ms>0&&h.flush.max>0);
 pass(`/health reports the flush: ${h.flush.ms} ms mean, ${h.flush.max} ms most`);
}finally{clearInterval(ticks);for(const b of bots)b.ws.terminate();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}keys.closeAllConnections();keys.close();await fs.rm(dir,{recursive:true,force:true});}
console.log(`live crowd: ${passed} checks passed`);
