// The Deck 19 graffiti wall on an isolated Leo live server: temporary storage, a locally signed pass key, no Creamery,
// never the live server or its wall. Two signed-in painters and a guest, permissions, stroke limits, attribution in the log,
// bounded storage, restart persistence and the admin clear. (The v1 check:live case was dropped with the v2 check split.)
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {PROTOCOL} from '../src/walk/net/wire.js';
import {WALL,paintStroke,wallFromText} from '../src/walk/graffiti-wall.js';

const check=(name,ok,detail='')=>{assert(ok,name+' '+detail);console.log('PASS '+name+(detail?' ('+detail+')':''));};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'leo-graffiti-')),children=[],bots=[];
const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
const keys=http.createServer((q,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[{...jwk,kid:'local-g',alg:'EdDSA',use:'sig'}]}));});
await new Promise(r=>keys.listen(0,'127.0.0.1',r));
const sign=async id=>{const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),t=Math.floor(Date.now()/1000),h=b({alg:'EdDSA',kid:'local-g',typ:'JWT'}),p=b({iss:'http://127.0.0.1',aud:'leo.marscatsvoyage.com',sub:'discord:'+id,discord:{id,username:'local'+id,global_name:'Local '+id},wallets:[],iat:t,exp:t+1800});return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url');};
const wallFile=path.join(tmp,'graffiti.json'),clearFile=path.join(tmp,'graffiti-clear');
async function start(){
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const env={...process.env,LEO_LAYOUT:'2',PORT:String(port),LEO_PASS_ISS:'http://127.0.0.1',LEO_PASS_JWKS_URL:'http://127.0.0.1:'+keys.address().port+'/keys',
  LEO_LIVE_SCORES:path.join(tmp,'scores.json'),LEO_LIVE_HEARTS:path.join(tmp,'hearts.json'),LEO_LIVE_CHAT_LOG:path.join(tmp,'chat.json'),LEO_LIVE_GRAFFITI:wallFile,LEO_LIVE_GRAFFITI_CLEAR:clearFile,
  LEO_LIVE_TV:path.join(tmp,'tv'),LEO_LIVE_TV_CLEAR:path.join(tmp,'tv-clear'),LEO_LIVE_MAZE:path.join(tmp,'maze.json'),LEO_LIVE_TREASURE:path.join(tmp,'treasure.json'),
  LEO_LIVE_GIVEAWAY:path.join(tmp,'giveaway.json'),LEO_LIVE_GIVEAWAY_CLAIMS:path.join(tmp,'claims.json'),LEO_LIVE_ARENA_STATS:path.join(tmp,'stats.json'),LEO_LIVE_HALLOWEEN:path.join(tmp,'halloween.json')};
 const p=spawn(process.execPath,['server/leo-live.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});children.push(p);
 let log='';p.stdout.on('data',b=>log+=b);p.stderr.on('data',b=>log+=b);
 for(let i=0;i<3000&&!log.includes('Leo live on')&&p.exitCode===null;i++)await sleep(20);assert.equal(p.exitCode,null,log);
 const health=await (await fetch('http://127.0.0.1:'+port+'/health')).json();
 return {p,port,health,log:()=>log};
}
async function bot(s,{id,signed=true}={}){
 const key=randomBytes(32).toString('hex'),ws=new WebSocket('ws://127.0.0.1:'+s.port+'/live',{origin:'http://localhost:4180'}),b={ws,msgs:[],closed:null,id};bots.push(b);
 ws.on('message',(data,binary)=>{if(!binary)b.msgs.push(JSON.parse(data));});ws.on('close',c=>b.closed=c);
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 b.send=m=>ws.send(JSON.stringify(m));
 b.send({m:'hello',v:PROTOCOL,key,layout:2,layoutIdentity:s.health.layoutIdentity,...(signed?{pass:await sign(id)}:{name:'Guest'})});
 for(let i=0;i<500&&!b.msgs.some(m=>m.m==='welcome');i++)await sleep(20);
 assert(b.msgs.some(m=>m.m==='welcome'),'welcome');return b;
}
const wait=async(b,n,test,ms=1000)=>{for(let i=0;i<ms/25;i++){const got=b.msgs.slice(n).find(test);if(got)return got;await sleep(25);}return null;};
const look=async b=>{const n=b.msgs.length;b.send({m:'wall'});return wait(b,n,x=>x.m==='wall');};
const same=(a,b)=>!!a&&!!b&&a.length===b.length&&a.every((x,i)=>x===b[i]);
const stop=async s=>{s.p.kill();await new Promise(r=>s.p.exitCode!==null||s.p.signalCode!==null?r():s.p.once('exit',r));};
let srv;
try{
 srv=await start();
 console.log('server layout',srv.health.layout,'identity',String(srv.health.layoutIdentity).slice(0,8),'(isolated, storage in a temp folder)');
 const guest=await bot(srv,{signed:false}),bea=await bot(srv,{id:'912121212121212121'}),cal=await bot(srv,{id:'913131313131313131'}),away=await bot(srv,{signed:false});
 const bare=await look(guest),calWall=await look(cal);await look(bea);
 check('anyone can look at the wall; a guest is marked not signed in',bare?.w===WALL.w&&bare.h===WALL.h&&bare.verified===false&&wallFromText(bare.cells)?.every(c=>c===0)&&calWall?.verified===true);
 let n=cal.msgs.length;guest.send({m:'paint',c:3,s:1,p:[10,10,20,20]});
 check("a guest's stroke is refused with a sign-in reason and reaches nobody",(await wait(guest,0,x=>x.m==='painted'))?.why==='sign-in'&&!await wait(cal,n,x=>x.m==='stroke',300));
 const mine=wallFromText(calWall.cells),stroke={c:4,s:1,p:[10,20,30,40,50,40]};
 n=cal.msgs.length;const na=away.msgs.length,nb=bea.msgs.length;bea.send({m:'paint',...stroke});
 const heard=await wait(cal,n,x=>x.m==='stroke');
 check("a signed-in visitor's stroke reaches another visitor looking at the wall, as sprayed",heard?.id===bea.msgs.find(m=>m.m==='welcome').id&&heard.c===4&&heard.s===1&&JSON.stringify(heard.p)===JSON.stringify(stroke.p));
 check('the painter is not sent their own stroke, nor a visitor who never came to look',!await wait(bea,nb,x=>x.m==='stroke',200)&&!away.msgs.slice(na).some(x=>x.m==='stroke'));
 if(heard)paintStroke(mine,heard);
 n=bea.msgs.length;const over={c:9,s:2,p:[30,40]};cal.send({m:'paint',...over});const beaHeard=await wait(bea,n,x=>x.m==='stroke');paintStroke(mine,over);
 const late=await bot(srv,{signed:false}),lateWall=wallFromText((await look(late))?.cells);
 check('what another visitor saw sprayed matches the wall a newcomer is handed',!!beaHeard&&same(lateWall,mine)&&mine.filter(c=>c===4).length>50,`${mine.filter(c=>c===4).length} cells in colour 4, ${mine.filter(c=>c===9).length} in colour 9`);
 check('painting over paint leaves the later colour on top',lateWall?.[40*WALL.w+30]===9&&lateWall?.[20*WALL.w+10]===4);
 n=cal.msgs.length;
 for(const bad of [{c:0,s:1,p:[1,1]},{c:13,s:1,p:[1,1]},{c:2,s:5,p:[1,1]},{c:2,s:1,p:[WALL.w,1]},{c:2,s:1,p:[1,-1]},{c:2,s:1,p:[1,2,3]},{c:2,s:1,p:Array(60).fill(5)},{c:2,s:1.5,p:[1,1]},{c:'2',s:1,p:[1,1]},{c:2,s:1,p:'here'}])bea.send({m:'paint',...bad});
 check('malformed strokes are ignored',!await wait(cal,n,x=>x.m==='stroke',400)&&bea.closed===null);
 await sleep(2100);n=cal.msgs.length;const nb2=bea.msgs.length;
 for(let i=0;i<60;i++)bea.send({m:'paint',c:6,s:0,p:[100,200+(i%20)]});await sleep(400);
 const passed=cal.msgs.slice(n).filter(x=>x.m==='stroke').length;
 check('a flood of strokes is rate-limited and the painter told',passed<=30&&passed>=20&&bea.msgs.slice(nb2).some(x=>x.m==='painted'&&x.why==='slow')&&bea.closed===null,`${passed} of 60 passed on`);
 check('who starts painting is logged at once, with the account id and name',/graffiti painting discord:912121212121212121 "Local 912121212121212121"/.test(srv.log()));
 bea.ws.close();await sleep(300);
 check('when they stop, strokes, cells, colours and area are logged against the account',/graffiti painted discord:912121212121212121 "Local 912121212121212121" \d+ strokes \d+ cells colours 4,6 across 10-100 down 20-219/.test(srv.log()),(srv.log().match(/graffiti painted .*/)||[''])[0].replace(/\d{15,}/g,'<id>'));
 const before=wallFromText((await look(late))?.cells);for(const b of [guest,cal,away,late])b.ws.close();
 await sleep(1300);const size=(await fs.stat(wallFile)).size;await stop(srv);srv=await start();
 const back=await bot(srv,{signed:false}),kept=wallFromText((await look(back))?.cells);
 check('the paint is still there after the server restarts',same(kept,before)&&kept.some(c=>c===6),`file ${size} bytes`);
 const dee=await bot(srv,{id:'914141414141414141'});
 for(let i=0;i<20;i++){dee.send({m:'paint',c:1+i%12,s:2,p:[i*5,i*10,119-i*5,223-i*10]});await sleep(90);}
 await sleep(1300);const grown=(await fs.stat(wallFile)).size;
 check('the stored wall stays the same size however much is painted (a fixed grid in the existing file store)',grown===size&&size<40000,`${size} bytes, then ${grown}`);
 n=back.msgs.length;await fs.writeFile(clearFile,'acceptance check\n');
 const cleared=await wait(back,n,x=>x.m==='wall'&&x.cleared,4000);
 check('the admin clear wipes the wall for everyone looking, is logged with its note, and removes its trigger file',!!cleared&&wallFromText(cleared.cells)?.every(c=>c===0)&&/graffiti wall cleared \(admin: "acceptance check"\)/.test(srv.log())&&!await fs.access(clearFile).then(()=>true,()=>false));
 back.ws.close();dee.ws.close();await sleep(300);await stop(srv);srv=await start();
 const after=await bot(srv,{signed:false});
 check('a cleared wall stays clear after a restart',wallFromText((await look(after))?.cells)?.every(c=>c===0));
 after.ws.close();
 console.log('PASS graffiti live check (isolated server, temp storage)');
}finally{
 for(const b of bots)try{b.ws.close();}catch{}
 for(const p of children)p.kill();keys.close();await sleep(200);await fs.rm(tmp,{recursive:true,force:true}).catch(()=>{});
}
process.exit(0);
