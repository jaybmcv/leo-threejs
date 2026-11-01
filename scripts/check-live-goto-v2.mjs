// Focused v2 pose smoke. The existing comprehensive v1 protocol suite is retained
// in check-live.mjs; this path does not certify relocated game/service interactions.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {livePosesV2} from './live-poses-v2.mjs';
import {gotoFloor} from '../src/v2/goto-floor.js';
import {readGotoColliders} from './goto-colliders-v2.mjs';
import {WireReader,PROTOCOL} from '../src/walk/net/wire.js';
const layout=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8')),poses=livePosesV2(layout);
const arg=process.argv.find(a=>a.startsWith('--prepared='))?.slice(11),{colliders,sha256}=await readGotoColliders(arg||process.env.LEO_GOTO_PREPARED||'output/leo-interior-v02/prepared-walk');
for(const p of [...poses.shots,poses.nearWalker,poses.far])assert(gotoFloor(colliders,p.feet).ok,'Unsafe v2 live pose '+p.id);
for(let i=0;i<10;i++)assert(gotoFloor(colliders,poses.walk(i)).ok,'Unsafe live walk step');
const port=Number(process.env.LEO_LIVE_CHECK_PORT||8950),temp=await fs.mkdtemp(path.join(os.tmpdir(),'leo-v2-pose-smoke-')),bots=[];
const server=spawn(process.execPath,['server/leo-live.mjs'],{windowsHide:true,env:{...process.env,PORT:String(port),LEO_PASS_JWKS_URL:'http://127.0.0.1:1/unused',LEO_PASS_ISS:'http://127.0.0.1',LEO_LIVE_GIVEAWAY:path.join(temp,'giveaway.json'),LEO_LIVE_GIVEAWAY_CLAIMS:path.join(temp,'claims.json'),LEO_LIVE_ARENA_STATS:path.join(temp,'stats.json'),LEO_LIVE_HALLOWEEN:path.join(temp,'halloween.json'),LEO_LIVE_MAZE:path.join(temp,'maze.json'),LEO_LIVE_TREASURE:path.join(temp,'treasure.json'),LEO_LIVE_SCORES:path.join(temp,'scores.json'),LEO_LIVE_HEARTS:path.join(temp,'hearts.json'),LEO_LIVE_CHAT_LOG:path.join(temp,'chat.json'),LEO_LIVE_GRAFFITI:path.join(temp,'graffiti.json'),LEO_LIVE_GRAFFITI_CLEAR:path.join(temp,'graffiti-clear'),LEO_LIVE_TV:path.join(temp,'tv'),LEO_LIVE_TV_CLEAR:path.join(temp,'tv-clear')},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(f,what)=>{for(let i=0;i<100;i++){const value=f();if(value)return value;await sleep(50);}throw Error('Timed out: '+what);};
try{
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Local v2 pose server did not start')),10000);server.on('error',reject);server.once('exit',()=>reject(Error('Local v2 pose server exited before ready')));server.stdout.on('data',b=>{if(String(b).includes('Leo live on')){clearTimeout(timeout);resolve();}});});
 const health=await (await fetch('http://127.0.0.1:'+port+'/health')).json();
 const bot=async(name,key)=>{const ws=new WebSocket('ws://127.0.0.1:'+port+'/live',{origin:'http://localhost:4180'}),reader=new WireReader(),b={ws,poses:new Map(),id:null};bots.push(b);ws.on('message',(data,binary)=>{if(binary){for(const p of reader.read(data))b.poses.set(p.id,p);}else{const m=JSON.parse(data);if(m.m==='welcome')b.id=m.id;}});await new Promise((r,j)=>{ws.on('open',r);ws.on('error',j);});ws.send(JSON.stringify({m:'hello',v:PROTOCOL,layout:2,layoutIdentity:health.layoutIdentity,key:key.repeat(64),name}));await until(()=>b.id,'welcome');return b;};
 const a=await bot('V2 walker','a'),b=await bot('V2 camera','b'),far=await bot('V2 distant walker','c');
 const send=(b,pos,yaw=0)=>b.ws.send(JSON.stringify({m:'pose',p:{pos,yaw,g:true,st:'stand',jc:0,js:-1,r:0,e:null,rest:null}}));
 const close=(a,b)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<.002);
 assert(!close([],poses.near.feet),'Missing wire pose must fail');
 send(b,poses.nearWalker.feet,poses.nearWalker.yaw);send(far,poses.far.feet,poses.far.yaw);
 for(let i=0;i<10;i++){send(a,poses.walk(i),poses.near.yaw);await sleep(100);}
 await until(()=>close(b.poses.get(a.id)?.pos||[],poses.walk(9))&&b.poses.has(a.id),'near visitor v2 pose');
 await until(()=>far.poses.has(a.id),'distant visitor v2 pose');
 for(const shot of poses.shots){send(a,shot.feet,shot.yaw);await until(()=>b.poses.has(a.id)&&close(b.poses.get(a.id).pos,shot.feet),'v2 shot '+shot.id);}
 await fs.mkdir('output/launch-h',{recursive:true});await fs.writeFile('output/launch-h/live-poses-goto.json',JSON.stringify({status:'PASS',prepared:sha256,shots:poses.shots,checks:['all feet on safe floors','ten small walk steps','near pose delivery','distant pose delivery','all shot positions delivered'],scope:'Pose/camera smoke; signed spatial validation is the subsequent check-live-spatial-v2.mjs suite'},null,2));
 console.log('PASS v2 live poses: '+poses.shots.length+' camera/walker shots, near and distant visitors, safe floor under every pose');
}finally{for(const b of bots)b.ws.close();server.kill();await new Promise(r=>{if(server.exitCode!==null)return r();server.once('exit',r);});const cleanup=path.resolve(temp),tmpRoot=path.resolve(os.tmpdir());if(path.dirname(cleanup)!==tmpRoot||!path.basename(cleanup).startsWith('leo-v2-pose-smoke-'))throw Error('Refusing cleanup outside this smoke test temporary directory');await fs.rm(cleanup,{recursive:true,force:true});}
