// Leo Pinball's shared high scores on an isolated Leo live server (server/pinball.mjs): temporary storage, a locally
// signed pass key, no Creamery, never the live server or its board. Players at the machine play real games with the
// game's own rules, from the seeds their tickets give, and post them as the page does (net/live.js pinballFinish).
// Checked: the empty board; guests and Otherside visitors can read but not post; a ticket only at the machine; ranked
// results kept, ranked, seen by two other clients and kept through a restart; and refused: a forged score, a tampered
// log, a game faster than the server's clock, a ticket used twice, a finish on another player's ticket.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {PROTOCOL} from '../src/walk/net/wire.js';
import {newGame,step,STEP} from '../src/walk/pinball/rules.js';
import {recorder,decode} from '../src/walk/pinball/replay.js';
import {buildLiveV2} from './build-live-v2.mjs';

const check=(name,ok,detail='')=>{assert(ok,name+' '+detail);console.log('PASS '+name+(detail?' ('+detail+')':''));};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Where a player stands to play, in this layout (pinball/place.js, built as the server builds it).
const {pinballSpot}=await import((await buildLiveV2({entry:'src/walk/pinball/place.js',outfile:'output/launch-h/pinball-place.mjs'})).href);
const AT=pinballSpot(),AWAY=[AT[0]-12,AT[1],AT[2]];
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'leo-pinball-')),children=[],bots=[];
const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
const keys=http.createServer((q,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[{...jwk,kid:'local-p',alg:'EdDSA',use:'sig'}]}));});
await new Promise(r=>keys.listen(0,'127.0.0.1',r));
const sign=async id=>{const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),t=Math.floor(Date.now()/1000),h=b({alg:'EdDSA',kid:'local-p',typ:'JWT'}),p=b({iss:'http://127.0.0.1',aud:'leo.marscatsvoyage.com',sub:'discord:'+id,discord:{id,username:'local'+id,global_name:'Pilot '+id.slice(-3)},wallets:[],iat:t,exp:t+1800});return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url');};
const store=path.join(tmp,'pinball.json');
async function start(){
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const env={...process.env,LEO_LAYOUT:'2',PORT:String(port),LEO_PASS_ISS:'http://127.0.0.1',LEO_PASS_JWKS_URL:'http://127.0.0.1:'+keys.address().port+'/keys',LEO_LIVE_PINBALL:store,
  LEO_LIVE_SCORES:path.join(tmp,'scores.json'),LEO_LIVE_HEARTS:path.join(tmp,'hearts.json'),LEO_LIVE_CHAT_LOG:path.join(tmp,'chat.json'),LEO_LIVE_GRAFFITI:path.join(tmp,'graffiti.json'),LEO_LIVE_GRAFFITI_CLEAR:path.join(tmp,'graffiti-clear'),
  LEO_LIVE_TV:path.join(tmp,'tv'),LEO_LIVE_TV_CLEAR:path.join(tmp,'tv-clear'),LEO_LIVE_MAZE:path.join(tmp,'maze.json'),LEO_LIVE_TREASURE:path.join(tmp,'treasure.json'),
  LEO_LIVE_GIVEAWAY:path.join(tmp,'giveaway.json'),LEO_LIVE_GIVEAWAY_CLAIMS:path.join(tmp,'claims.json'),LEO_LIVE_ARENA_STATS:path.join(tmp,'stats.json'),LEO_LIVE_HALLOWEEN:path.join(tmp,'halloween.json')};
 const p=spawn(process.execPath,['server/leo-live.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});children.push(p);
 let log='';p.stdout.on('data',b=>log+=b);p.stderr.on('data',b=>log+=b);
 for(let i=0;i<3000&&!log.includes('Leo live on')&&p.exitCode===null;i++)await sleep(20);assert.equal(p.exitCode,null,log);
 const health=await (await fetch('http://127.0.0.1:'+port+'/health')).json();
 return {p,port,health,log:()=>log};
}
// A visitor: signed in with a pass for id, a guest, or from Otherside with a wallet (glyph).
async function bot(s,{id,glyph}={}){
 const key=randomBytes(32).toString('hex'),ws=new WebSocket('ws://127.0.0.1:'+s.port+'/live',{origin:'http://localhost:4180'}),b={ws,msgs:[],id};bots.push(b);
 ws.on('message',(data,binary)=>{if(!binary)b.msgs.push(JSON.parse(data));});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 b.send=m=>ws.send(JSON.stringify(m));
 b.send({m:'hello',v:PROTOCOL,key,layout:2,layoutIdentity:s.health.layoutIdentity,...(id?{pass:await sign(id)}:glyph?{glyph:{wallet:glyph,username:'Glyph'}}:{name:'Guest'})});
 for(let i=0;i<500&&!b.msgs.some(m=>m.m==='welcome');i++)await sleep(20);
 assert(b.msgs.some(m=>m.m==='welcome'),'welcome');
 b.stand=async at=>{b.send({m:'pose',p:{pos:at,yaw:0,g:true,st:'stand'}});await sleep(150);};
 return b;
}
const wait=async(b,n,test,ms=2000)=>{for(let i=0;i<ms/25;i++){const got=b.msgs.slice(n).find(test);if(got)return got;await sleep(25);}return null;};
const ask=async(b,op,extra={},ms)=>{const n=b.msgs.length;b.send({m:'pinball',op,...extra});return wait(b,n,x=>x.m==='pinball'&&x.op===(op==='finish'?'result':op),ms);};
// A game played with the game's rules from seed: the plunger held for `hold` seconds each ball, no flipping. Its log,
// steps and score are what the page would send.
function play(seed,hold){const g=newGame(seed),rec=recorder();let t=0;
 while(g.phase==='play'&&rec.steps<120/STEP){const b=g.b,input=b.lane&&!b.launching?{launch:(t+=STEP)<hold}:(t=0,{});rec.step(input);step(g,input);}
 return {log:rec.log,steps:rec.steps,score:g.score,over:g.phase==='over',seconds:rec.steps*STEP};}
// The page's finish (net/live.js pinballFinish): the log in 900-character pieces, then the finish.
const finish=(b,ticket,r,{score=r.score,log=r.log}={})=>{const n=Math.ceil(log.length/900);
 for(let i=0;i<n;i++)b.send({m:'pinball',op:'part',t:ticket,i,d:log.slice(i*900,(i+1)*900)});return ask(b,'finish',{t:ticket,n,steps:r.steps,score},20000);};
const stop=async s=>{s.p.kill();await new Promise(r=>s.p.exitCode!==null||s.p.signalCode!==null?r():s.p.once('exit',r));};
let srv;
try{
 srv=await start();
 console.log('server layout',srv.health.layout,'identity',String(srv.health.layoutIdentity).slice(0,8),'(isolated, storage in a temp folder); the machine at',AT.map(n=>n.toFixed(2)).join(','));
 const guest=await bot(srv),watcher=await bot(srv,{id:'914141414141414141'}),glyph=await bot(srv,{glyph:'0x'+'ab'.repeat(20)});
 const ada=await bot(srv,{id:'915151515151515151'}),ben=await bot(srv,{id:'916161616161616161'}),cy=await bot(srv,{id:'917171717171717171'}),
  dee=await bot(srv,{id:'918181818181818181'}),eli=await bot(srv,{id:'919191919191919191'}),fox=await bot(srv,{id:'910101010101010101'});
 const players=[ada,ben,cy,dee,eli,fox];
 const empty=await ask(guest,'board');
 check('the board starts empty, and a guest may read it, marked not signed in',empty?.verified===false&&Array.isArray(empty.top)&&empty.top.length===0&&empty.you===null);
 check('a signed-in player reading it is marked signed in',(await ask(watcher,'board'))?.verified===true);
 await guest.stand(AT);await glyph.stand(AT);
 check('a guest at the machine gets no ticket: sign-in',(await ask(guest,'ticket'))?.why==='sign-in');
 check('an Otherside visitor (a wallet taken on the page’s word) gets no ticket either',(await ask(glyph,'ticket'))?.why==='sign-in');
 check('a guest’s finish is refused: sign-in',(await ask(guest,'finish',{t:'x',n:0,steps:10,score:10}))?.why==='sign-in');
 await ada.stand(AWAY);
 check('a signed-in player away from the machine gets no ticket',(await ask(ada,'ticket'))?.why==='away');
 for(const p of players)await p.stand(AT);
 const tickets=[];for(const p of players){const t=await ask(p,'ticket');tickets.push(t);}
 check('signed-in players at the machine each get a ticket with a seed',tickets.every(t=>t?.ok===true&&typeof t.id==='string'&&Number.isInteger(t.seed))&&new Set(tickets.map(t=>t.id)).size===players.length);
 const t0=Date.now();
 // Each plays a game from their own seed (holds chosen to end in under a minute with different scores).
 const holds=[.25,.3,.45,.3,.8,.3],games=players.map((p,i)=>{for(const h of [holds[i],.3,.5,.7,.9]){const r=play(tickets[i].seed,h);if(r.over&&r.score>0)return r;}throw Error('no short game');});
 console.log('     games:',games.map(r=>`${r.score} in ${r.seconds.toFixed(1)} s`).join(', '));
 // Fox posts at once: the server's clock has not run as long as the game.
 check('a game posted sooner than it could have been played is refused',(await finish(fox,tickets[5].id,games[5]))?.why==='rejected'&&srv.log().includes('faster than the clock'));
 check('and that ticket can’t be tried again',(await finish(fox,tickets[5].id,games[5]))?.why==='used');
 const longest=Math.max(...games.slice(0,5).map(r=>r.seconds))*1000;console.log(`     waiting ${((longest-(Date.now()-t0))/1000).toFixed(0)} s for the games to have been played`);
 await sleep(Math.max(0,longest-(Date.now()-t0))+300);
 // Ben tries Eli's ticket: refused, and Eli's ticket still holds.
 check('a finish on another player’s ticket is refused',(await finish(ben,tickets[4].id,games[4]))?.why==='rejected');
 const nG=guest.msgs.length,nW=watcher.msgs.length;
 const a=await finish(ada,tickets[0].id,games[0]);
 check('a real game is checked by replay and posted',a?.ok===true&&a.score===games[0].score&&a.best===games[0].score&&a.rank===1&&a.newBest===true,JSON.stringify(a));
 const topG=await wait(guest,nG,x=>x.m==='pinball'&&x.op==='top'),topW=await wait(watcher,nW,x=>x.m==='pinball'&&x.op==='top');
 check('everyone aboard hears the new top ten, a guest and another player alike',topG?.top?.[0]?.score===games[0].score&&topW?.top?.[0]?.name==='Pilot '+ada.id.slice(-3));
 check('the same game posted again is refused: used',(await finish(ada,tickets[0].id,games[0]))?.why==='used');
 check('a forged score on a real game is refused',(await finish(cy,tickets[2].id,games[2],{score:games[2].score+5000}))?.why==='rejected'&&srv.log().includes('the replay scored'));
 // Dee's log with her first launch let go an eighth of a second sooner: not the game she says she played.
 const changes=decode(games[3].log);changes[1][0]=Math.max(1,changes[1][0]-60);
 const tampered=changes.map(([d,b])=>d.toString(36)+'ABCDEFGH'[b]).join('');
 check('a tampered log is refused',tampered!==games[3].log&&(await finish(dee,tickets[3].id,games[3],{log:tampered}))?.why==='rejected');
 const b=await finish(ben,tickets[1].id,games[1]),e=await finish(eli,tickets[4].id,games[4]);
 check('other players’ real games are posted too (Eli’s ticket survived Ben’s try)',b?.ok===true&&e?.ok===true);
 const order=[[ada,games[0]],[ben,games[1]],[eli,games[4]]].sort((x,y)=>y[1].score-x[1].score),names=order.map(([p])=>'Pilot '+p.id.slice(-3));
 for(const viewer of [guest,watcher]){const bd=await ask(viewer,'board');
  // (only the three real games, so nothing refused reached it)
  check(`${viewer===guest?'a guest':'another signed-in player'} sees the ranked board: best first, public names only`,
   JSON.stringify(bd.top)===JSON.stringify(order.map(([p,r],i)=>({name:names[i],score:r.score})))&&!JSON.stringify(bd).match(/9[0-9]{17}/));}
 const mine=await ask(ben,'board');check('a player’s own best and rank come with the board',mine.you?.score===games[1].score&&mine.you.rank===order.findIndex(([p])=>p===ben)+1);
 await sleep(1500);
 const saved=JSON.parse(await fs.readFile(store,'utf8'));
 check('accepted results are kept in the pinball store, by account',saved.length===3&&saved.every(x=>/^9\d{17}$/.test(x.id)&&Number.isInteger(x.score)));
 await stop(srv);srv=await start();
 const after=await bot(srv),again=await ask(after,'board');
 check('after a restart the board is read back from the store, unchanged',JSON.stringify(again.top)===JSON.stringify(order.map(([p,r],i)=>({name:names[i],score:r.score}))));
 const ada2=await bot(srv,{id:'915151515151515151'});
 check('an old ticket is not good on the restarted server',(await finish(ada2,tickets[0].id,games[0]))?.ok===false);
 console.log('PASS check-pinball-live');
}finally{
 for(const b of bots)try{b.ws.close();}catch{}
 if(srv)await stop(srv).catch(()=>{});for(const p of children)try{p.kill();}catch{}
 keys.close();await fs.rm(tmp,{recursive:true,force:true}).catch(()=>{});
}
