// Leo live under load: a local server (server/leo-live.mjs, every state file in a temporary folder, as
// check-live-spatial-v2.mjs runs it) and N visitors, each walking and sending its pose ten times a second as a page does
// (net/live.js), packed into one hall or spread over the ship. After they are all aboard it measures, over a window:
// the server's CPU (its process time over the wall time), what each page receives (bytes and records a second, the
// mean and the most), and for a sample of pages how often they hear of each other visitor by distance (the gaps between
// two poses of one visitor: median and 95th percentile, within 16 m, 16-64 m and beyond; and how long each had been
// silent when the window closed, counting any not heard in it at all). It stops with an error if the
// live server's own files beside the checkout changed. With --cpuprof the server runs with its inspector on and is
// profiled over the window: the profile is written to that file (DevTools opens it) and its heaviest functions printed.
//   node scripts/live-load.mjs [--n=150] [--seconds=15] [--layout=hall|spread] [--sample=12] [--cpuprof=output/live.cpuprofile]
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {WireReader,PROTOCOL} from '../src/walk/net/wire.js';

const arg=(k,d)=>{const a=process.argv.find(x=>x.startsWith('--'+k+'='));return a?a.slice(k.length+3):d;};
const N=+arg('n',150),SECONDS=+arg('seconds',15),LAYOUT=arg('layout','hall'),SAMPLE=Math.min(N,+arg('sample',12)),PROF=arg('cpuprof',null);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// The state files the server keeps beside the checkout, sent to a temporary folder (as check-live-spatial-v2.mjs does).
const STATE={LEO_LIVE_SCORES:'scores.json',LEO_LIVE_HEARTS:'hearts.json',LEO_LIVE_CHAT_LOG:'chat.json',LEO_LIVE_GRAFFITI:'graffiti.json',LEO_LIVE_GRAFFITI_CLEAR:'graffiti-clear',
 LEO_LIVE_TV:'tv',LEO_LIVE_TV_CLEAR:'tv-clear',LEO_LIVE_MAZE:'maze.json',LEO_LIVE_TREASURE:'treasure.json',LEO_LIVE_GIVEAWAY:'giveaway.json',LEO_LIVE_GIVEAWAY_CLAIMS:'claims.json',
 LEO_LIVE_ARENA_STATS:'stats.json',LEO_LIVE_HALLOWEEN:'halloween.json'};
// The live server's own files, where a server run from this checkout would keep them: none may change.
const beside=path.resolve('..');
const theirs=async()=>{const out={};for(const f of await fs.readdir(beside).catch(()=>[]))if(/^leo-live-/.test(f))out[f]=(await fs.stat(path.join(beside,f))).mtimeMs;return out;};
const cpuMs=pid=>process.platform==='win32'
 ?+execFileSync('powershell',['-NoProfile','-Command',`(Get-Process -Id ${pid}).TotalProcessorTime.TotalMilliseconds`],{encoding:'utf8'}).trim()
 :(()=>{const s=execFileSync('ps',['-o','time=','-p',String(pid)],{encoding:'utf8'}).trim().split(/[:.]/).map(Number);return ((s[0]*60+s[1])*60+s[2])*1000;})();
// The records in a frame (net/wire.js): u8 tag, u8 version, u16 identities (u16 slot, u8 id bytes + id, u8 flags, u8 name
// bytes + name), then u16 poses.
// A profile's heaviest functions by their own time (ms), from its samples.
const heaviest=p=>{const hits=new Map(),by=new Map(),each=(p.endTime-p.startTime)/1000/p.samples.length;for(const s of p.samples)hits.set(s,(hits.get(s)||0)+1);
 for(const node of p.nodes){const h=hits.get(node.id);if(!h)continue;const f=node.callFrame,key=`${f.functionName||'(anonymous)'} ${f.url.split('/').pop()}:${f.lineNumber+1}`;by.set(key,(by.get(key)||0)+h*each);}
 return Object.fromEntries([...by].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,ms])=>[k,Math.round(ms)]));};
// The server's inspector (--cpuprof): a call is a method and its parameters, answered with its result.
async function inspector(){
 const url=/Debugger listening on (ws:\/\/\S+)/.exec(log)?.[1];if(!url)throw Error('no inspector in the server log:\n'+log.slice(-500));
 const ws=new WebSocket(url),waiting=new Map();let id=0;await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 ws.on('message',d=>{const m=JSON.parse(d);waiting.get(m.id)?.(m);waiting.delete(m.id);});
 const call=(method,params={})=>new Promise(r=>{waiting.set(++id,r);ws.send(JSON.stringify({id,method,params}));});call.close=()=>ws.close();return call;
}
const recordsIn=data=>{const ids=data.readUInt16LE(2);let o=4;for(let k=0;k<ids;k++){o+=2;o+=1+data[o];o+=1;o+=1+data[o];}return data.readUInt16LE(o);};

const before=await theirs();
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'leo-live-load-'));
const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const env={...process.env,LEO_LAYOUT:'2',PORT:String(port),LEO_LIVE_MAX:String(N+10),LEO_PASS_ISS:'http://127.0.0.1',LEO_PASS_JWKS_URL:'http://127.0.0.1:9/keys',
 ...Object.fromEntries(Object.entries(STATE).map(([k,v])=>[k,path.join(dir,v)]))};
const server=spawn(process.execPath,[...(PROF?['--inspect=127.0.0.1:0']:[]),'server/leo-live.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';
server.stdout.on('data',b=>{log+=b;});server.stderr.on('data',b=>{log+=b;});
const stop=async()=>{if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}await fs.rm(dir,{recursive:true,force:true});};
try{
 for(let i=0;i<600&&!/Leo live on/.test(log);i++)await sleep(100);if(!/Leo live on/.test(log))throw Error('server did not start:\n'+log.slice(-2000));
 // The layout identity the server was built with (its bundler fills it in; the source has none): pages send it.
 const identity=(await (await fetch(`http://127.0.0.1:${port}/health`)).json()).layoutIdentity;
 // Where each visitor walks: a loop of 3 m radius round its own spot, in one hall (about 40 x 40 m) or over the ship's
 // length on two decks.
 const spot=i=>LAYOUT==='spread'?[-280+560*((i*0.618)%1),i%2?14:5,-60+120*((i*0.382)%1)]:[-20+40*((i*0.618)%1),5,-20+40*((i*0.382)%1)];
 const bots=[],first=[];let welcomed=0;
 for(let i=0;i<N;i++){
  const ws=new WebSocket(`ws://127.0.0.1:${port}/live`,{origin:'http://localhost:4180'}),b={i,ws,bytes:0,records:0,reader:i<SAMPLE?new WireReader():null,seen:new Map(),gaps:[]};bots.push(b);
  ws.on('message',(data,binary)=>{
   if(!binary){const m=JSON.parse(data);if(b.i===0&&first.length<5)first.push(String(data).slice(0,200));if(m.m==='welcome'){b.id=m.id;welcomed++;}return;}
   b.bytes+=data.length;b.records+=recordsIn(data);
   if(b.reader){const now=performance.now();for(const p of b.reader.read(data)){const last=b.seen.get(p.id);if(last!==undefined&&b.measuring)b.gaps.push([now-last,p.id]);b.seen.set(p.id,now);}}});
  ws.on('error',()=>{});
  await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
  ws.send(JSON.stringify({m:'hello',v:PROTOCOL,layout:2,layoutIdentity:identity,key:randomBytes(32).toString('hex'),name:'Load '+i}));
  if(i%25===24)await sleep(20);
 }
 for(let i=0;i<300&&welcomed<N;i++)await sleep(100);
 if(welcomed<N)throw Error(`only ${welcomed} of ${N} aboard; the first page heard ${JSON.stringify(first)}, its socket ${bots[0].ws.readyState===3?'closed':'open'}:\n`+log.slice(-1500));
 // Ten poses a second each.
 const t0=performance.now();let sent=0;
 const timer=setInterval(()=>{const t=(performance.now()-t0)/1000;for(const b of bots){if(b.ws.readyState!==1)continue;const [x,y,z]=spot(b.i),a=t*.7+b.i;
  b.ws.send(JSON.stringify({m:'pose',p:{pos:[x+3*Math.cos(a),y,z+3*Math.sin(a)],yaw:a,g:true,st:'stand',jc:0,js:-1,r:0,e:null,rest:null,pl:false,b:false,gl:false,hk:null,f:0}}));sent++;}},100);
 await sleep(3000);
 for(const b of bots){b.bytes=0;b.records=0;b.measuring=true;b.gaps.length=0;}
 const cdp=PROF?await inspector():null;if(cdp){await cdp('Profiler.enable');await cdp('Profiler.start');}
 const c0=cpuMs(server.pid),w0=performance.now(),sent0=sent;
 await sleep(SECONDS*1000);
 const c1=cpuMs(server.pid),w1=performance.now(),secs=(w1-w0)/1000;clearInterval(timer);
 // (what each page had when the window closed: poses still arriving while /health and the profile are read are not counted)
 for(const b of bots){b.measuring=false;b.closed={bytes:b.bytes,records:b.records,seen:new Map(b.seen)};}
 // What a flush costs by the server's own measure (/health: a running mean, and the most in the last ten seconds).
 const flush=(await (await fetch(`http://127.0.0.1:${port}/health`)).json()).flush;
 let profile=null;if(cdp){profile=(await cdp('Profiler.stop')).result.profile;cdp.close();await fs.writeFile(PROF,JSON.stringify(profile));}
 const per=bots.map(b=>({bytes:b.closed.bytes/secs,records:b.closed.records/secs}));
 const mean=k=>per.reduce((s,p)=>s+p[k],0)/per.length,most=k=>Math.max(...per.map(p=>p[k]));
 // Gaps by distance between a sample page's visitor and the one it heard of.
 // (and those whose spots are the 12 nearest on its deck: each walks a loop round its spot, so the server's nearest 24
 // are mostly these and others)
 const spotOf=new Map(bots.map(b=>[b.id,spot(b.i)]));const bands={'nearest 12':[],'<16m':[],'16-64m':[],'>64m or another deck':[]};
 for(const b of bots.filter(x=>x.reader)){const me=spot(b.i);
  const nearest=new Set(bots.filter(o=>o!==b&&spot(o.i)[1]===me[1]).map(o=>[o.id,Math.hypot(spot(o.i)[0]-me[0],spot(o.i)[2]-me[2])]).sort((p,q)=>p[1]-q[1]).slice(0,12).map(([id])=>id));
  for(const [gap,id] of b.gaps){const o=spotOf.get(id);if(!o)continue;const d=Math.hypot(o[0]-me[0],o[2]-me[2]),dy=Math.abs(o[1]-me[1]);
   bands[nearest.has(id)?'nearest 12':dy>=9||d>=64?'>64m or another deck':d<16?'<16m':'16-64m'].push(gap);}}
 const q=(a,f)=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y);return Math.round(s[Math.min(s.length-1,Math.floor(f*s.length))]);};
 // Silences: for each sample page and each other visitor, how long since it last heard of them when the window closed
 // (all of it if not once in it), so one never heard counts too.
 const silences=[];let unheard=0;
 for(const b of bots.filter(x=>x.reader))for(const o of bots){if(o===b)continue;const at=b.closed.seen.get(o.id);if(at===undefined||at<w0){unheard++;silences.push(w1-w0);}else silences.push(w1-at);}
 for(const b of bots)b.ws.terminate();
 const after=await theirs();
 if(JSON.stringify(after)!==JSON.stringify(before))throw Error('the live server\'s own files changed: '+JSON.stringify({before,after}));
 console.log(JSON.stringify({n:N,layout:LAYOUT,seconds:+secs.toFixed(1),posesInPerSecond:Math.round((sent-sent0)/secs),serverCpuPercent:+(100*(c1-c0)/(w1-w0)).toFixed(1),flushMs:flush,
  perPage:{kBytesPerSecond:{mean:+(mean('bytes')/1024).toFixed(1),most:+(most('bytes')/1024).toFixed(1)},recordsPerSecond:{mean:Math.round(mean('records')),most:Math.round(most('records'))}},
  serverOutKBytesPerSecond:Math.round(per.reduce((s,p)=>s+p.bytes,0)/1024),
  gapsMs:Object.fromEntries(Object.entries(bands).map(([k,a])=>[k,{median:q(a,.5),p95:q(a,.95),samples:a.length}])),
  silenceAtEndMs:{p95:q(silences,.95),most:q(silences,1),unheardAllWindow:unheard}}));
 if(profile)console.log(JSON.stringify({profile:PROF,heaviestSelfMs:heaviest(profile)}));
}finally{await stop();}
