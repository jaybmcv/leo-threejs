import assert from 'node:assert/strict';
import {buildLiveV2} from './build-live-v2.mjs';
const entry=await buildLiveV2({entry:'src/walk/net/live.js',outfile:'output/launch-h/client-live-v2.mjs'});
// A stand-in browser: sockets that open at once and close when told, a page that can be hidden, shown and focused,
// and timers of twenty seconds or more held for the check to fire (the wait before asking a full ship again).
const names=['WebSocket','localStorage','document','addEventListener','removeEventListener','setTimeout','clearTimeout'],previous=Object.fromEntries(names.map(k=>[k,globalThis[k]])),sockets=[],heard={},long=[];
class Socket{constructor(){this.readyState=1;this.sent=[];sockets.push(this);}send(s){this.sent.push(JSON.parse(s));}close(code){if(this.readyState===3)return;this.readyState=3;this.code=code;this.onclose?.();}}
const listen=(type,f)=>(heard[type]||=new Set()).add(f),unlisten=(type,f)=>heard[type]?.delete(f),fire=type=>{for(const f of [...(heard[type]||[])])f();};
const page={hidden:false,focused:true,hasFocus(){return this.focused;},addEventListener:listen,removeEventListener:unlisten};
Object.assign(globalThis,{WebSocket:Socket,localStorage:{getItem:()=>null,setItem(){}},document:page,addEventListener:listen,removeEventListener:unlisten,
 setTimeout:(f,ms,...a)=>{if(!(ms>=20000))return previous.setTimeout(f,ms,...a);const t={f,ms,held:true,cancelled:false};long.push(t);return t;},
 clearTimeout:t=>{if(t?.held)t.cancelled=true;else previous.clearTimeout(t);}});
const URL='ws://127.0.0.1:1/live',tick=()=>new Promise(r=>previous.setTimeout(r,0)),ticks=async n=>{for(let i=0;i<n;i++)await tick();};
const until=async(f,what,ms=8000)=>{const end=Date.now()+ms;for(;;){const v=f();if(v)return v;if(Date.now()>end)assert.fail('timed out: '+what);await tick();}};
try{const {connectLive}=await import(entry.href);
 // The socket a link opens next (once its pass is in), with its hello said.
 const socket=async(n,what='a socket')=>{await until(()=>sockets.length>n,what);const ws=sockets.at(-1);await ws.onopen();return ws;};
 const join=async(on={},opts={})=>{const n=sockets.length,live=connectLive(URL,on,opts);return {live,ws:await socket(n)};};
 const say=(ws,msg)=>ws.onmessage({data:JSON.stringify(msg)});
 const welcome=(ws,you={verified:true})=>say(ws,{m:'welcome',id:'me',layout:2,layoutIdentity:ws.sent[0].layoutIdentity,you});

 for(const bad of [{id:'old-server',you:{}},{id:'wrong-layout',layout:1},{id:'stale-v2',layout:2,layoutIdentity:'stale'}]){const statuses=[],{live,ws}=await join({status:s=>statuses.push(s)});assert.equal(ws.sent[0].layout,2);assert.match(ws.sent[0].layoutIdentity,/^[0-9a-f]{64}$/);say(ws,{m:'welcome',...bad});live.pose({pos:[1,2,3],yaw:0},1000);live.score(100,1);assert(!live.live&&!live.id&&ws.code===4004&&statuses.at(-1)==='layout');assert.equal(ws.sent.length,1);}
 {const {live,ws}=await join();welcome(ws);assert(live.live);live.pose({pos:[1,2,3],yaw:0},1000);assert.equal(ws.sent.at(-1).m,'pose');live.close();}
 console.log('PASS v2 client: old v1, mismatched version and stale layout welcome cannot enable poses or scores; matching welcome can');

 // "Joining…" on the first connection: the page's status handler reads the link connectLive returns (main.js
 // showAboard hides the chip without one), so it must not hear 'connecting' before it holds that link.
 {const seen=[],n=sockets.length;let link=null;link=connectLive(URL,{status:s=>seen.push([s,!!link])});await socket(n);
  assert.deepEqual(seen[0],['connecting',true],'the page holds the link when it first hears "connecting"');link.close();console.log('PASS the first "connecting" reaches a page that already holds the link');}

 // The server closes a socket that has not said hello within five seconds, and Creamery may take eight to give a
 // pass: no socket opens until the pass is in, and hello is said the moment it does.
 {let release;const slow=new Promise(r=>{release=r;}),n=sockets.length,statuses=[],link=connectLive(URL,{status:s=>statuses.push(s)},{pass:()=>slow});
  await ticks(5);assert.equal(sockets.length,n,'no socket opens while the pass is still on its way');assert.deepEqual(statuses,['connecting'],'and the page says Joining meanwhile');
  release('slow-pass');const ws=await socket(n,'a socket once the pass is in');assert.deepEqual(ws.sent.map(m=>[m.m,m.pass]),[['hello','slow-pass']],'hello goes out as the socket opens, with the pass');
  welcome(ws);assert(link.live);link.close();console.log('PASS a slow pass holds the socket back, so the server\'s wait for hello never runs out on it');}

 // A pass still on its way when the page rejoins is not used: the next try says hello with its own.
 {let release;const pending=new Promise(r=>{release=r;}),passes=[pending,Promise.resolve('fresh')],n=sockets.length,late=connectLive(URL,{},{pass:()=>passes.shift()});
  await ticks(2);late.rejoin();const ws=await socket(n,'a socket after the rejoin');release('stale');await ticks(5);
  assert.equal(sockets.length,n+1,'one socket, for the try that followed the rejoin');assert.deepEqual(ws.sent.map(m=>m.pass),['fresh'],'it says hello once, with the fresh pass');
  // And a rejoin with a socket up closes it and comes back with the pass of the day.
  welcome(ws);passes.push(Promise.resolve('newer'));late.rejoin();assert.equal(ws.readyState,3);const next=await socket(n+1,'a socket after a rejoin while aboard');assert.deepEqual(next.sent.map(m=>m.pass),['newer']);
  late.close();console.log('PASS a pass from before a rejoin stays off the new socket');}

 // A pass the server did not take. Only a server that says it checked the pass and it is bad costs the browser its
 // kept login; one that could not check it (no keys from Creamery yet), or an older one that does not say, does not.
 {// An older server: not vouched for, no reason given. Back once without that pass, and nothing forgotten.
  let forgotten=0;const n=sockets.length,a=connectLive(URL,{},{pass:()=>Promise.resolve('kept'),refused:()=>forgotten++}),first=await socket(n);
  assert.equal(first.sent[0].pass,'kept');welcome(first,{verified:false});assert.equal(first.readyState,3,'it leaves to come back without the pass');
  const second=await socket(n+1,'a second socket');assert(!('pass' in second.sent[0]),'the pass that was not taken is not sent again');welcome(second,{verified:false});
  assert(a.live&&second.readyState===1&&forgotten===0,'aboard as a guest, with the kept login untouched');a.close();}
 {// The server could not check it: the visitor stays aboard as they are, and the pass goes out again on the next connection.
  let forgotten=0;const n=sockets.length,b=connectLive(URL,{},{pass:()=>Promise.resolve('kept'),refused:()=>forgotten++}),first=await socket(n);
  welcome(first,{verified:false,pass:'unchecked'});assert(b.live&&first.readyState===1&&forgotten===0,'an unchecked pass neither drops the socket nor the login');
  first.close();const second=await socket(n+1,'a socket after the link dropped');assert.equal(second.sent[0].pass,'kept','the same pass is offered again');welcome(second);assert(b.you.verified&&forgotten===0);b.close();}
 {// The server checked it and it is bad: forgotten, and back once with whatever Creamery gives now.
  let forgotten=0;const passes=['old','new'],n=sockets.length,c=connectLive(URL,{},{pass:()=>Promise.resolve(passes.shift()),refused:()=>forgotten++}),first=await socket(n);
  welcome(first,{verified:false,pass:'bad'});assert(forgotten===1&&first.readyState===3,'a bad pass is forgotten');
  const second=await socket(n+1,'a second socket');assert.equal(second.sent[0].pass,'new');welcome(second,{verified:false,pass:'bad'});assert(c.live&&forgotten===1&&second.readyState===1,'only once: no loop');c.close();}
 console.log('PASS only a pass the server checked and found bad is forgotten; unchecked or unexplained, the login is kept');

 // A full ship: asked again every thirty seconds, saying "full" all the while, until there is room.
 {const statuses=[],n=sockets.length,{live,ws}=await join({status:s=>statuses.push(s)});say(ws,{m:'full'});ws.close(4003);
  const wait=long.filter(t=>!t.cancelled);assert(wait.length===1&&wait[0].ms===30000,'a full ship is asked again in thirty seconds');assert.equal(statuses.at(-1),'full');
  await ticks(5);assert.equal(sockets.length,n+1,'and not before');
  const from=statuses.length;wait[0].f();const again=await socket(n+1,'a socket asking again');say(again,{m:'full'});again.close(4003);
  assert.deepEqual(statuses.slice(from),['full'],'still full: it says so, with no "Joining" or "reconnecting" in between');
  // The server gone when it is asked again: then it is an ordinary lost connection, and says so.
  long.at(-1).f();const third=await socket(n+2,'a third socket');third.close(1006);assert.equal(statuses.at(-1),'offline','a lost link while waiting says reconnecting, not full');
  const fourth=await socket(n+3,'a fourth socket');welcome(fourth);assert(live.live&&statuses.at(-1)==='live','aboard once there is room');
  live.close();}
 console.log('PASS a full ship is asked again and lets the visitor aboard when there is room');

 // Another tab took over: this one stays out until its visitor comes back to it, then takes over in turn, once.
 {const statuses=[],n=sockets.length,timers=long.length,{live,ws}=await join({status:s=>statuses.push(s)});welcome(ws);say(ws,{m:'replaced'});ws.close(4002);
  assert.equal(statuses.at(-1),'replaced');assert.equal(long.length,timers,'no timer brings a taken-over tab back by itself');
  page.hidden=true;fire('visibilitychange');await ticks(5);assert.equal(sockets.length,n+1,'a hidden tab stays out');
  // Shown and focused again straight away: too soon after being told (two tabs must not trade places at machine
  // speed), so it waits out the rest of three seconds first.
  page.hidden=false;fire('visibilitychange');fire('focus');await ticks(5);assert.equal(sockets.length,n+1,'not within three seconds of being taken over');
  const back=await socket(n+1,'a socket once the visitor is back at this tab');assert.equal(statuses.at(-1),'connecting','it says Joining');
  fire('focus');fire('visibilitychange');await ticks(5);assert.equal(sockets.length,n+2,'one try, however many times the tab is focused');
  welcome(back);assert(live.live&&statuses.at(-1)==='live');
  // Taken over again, and left behind for another window before the three seconds are up: it stays out.
  say(back,{m:'replaced'});back.close(4002);fire('focus');page.focused=false;await new Promise(r=>previous.setTimeout(r,3300));assert.equal(sockets.length,n+2,'a tab no longer in front does not take over');
  page.focused=true;fire('focus');await socket(n+2,'a socket on the next return');live.close();
  fire('focus');await ticks(5);assert.equal(sockets.length,n+3,'a closed link listens no more');}
 console.log('PASS a tab that was taken over comes back when its visitor returns to it, and only then');
 // A game's finish said while the link is down is held, and goes once this visitor is aboard again and a pose has gone
 // out on the new connection; one that cannot be held, or is held too long, is said to be lost.
 {const pause=ms=>new Promise(r=>setTimeout(r,ms)),next=async from=>{for(let i=0;i<60&&sockets.at(-1)===from;i++)await pause(50);assert.notEqual(sockets.at(-1),from,'a new socket opens');return sockets.at(-1);};
  const aboard=async ws=>{await ws.onopen();ws.onmessage({data:JSON.stringify({m:'welcome',id:'runner',layout:2,layoutIdentity:ws.sent[0].layoutIdentity,you:{verified:true}})});};
  const kinds=ws=>ws.sent.slice(1).map(m=>m.m==='maze'?'maze '+m.op:m.m==='score'?'score '+(m.game||'invasion'):m.m),lost=[],at={pos:[1,2,3],yaw:0};
  const before=sockets.at(-1),link=connectLive('ws://127.0.0.1:1/live',{}),first=await next(before);
  link.score(100,1,()=>lost.push('never aboard'));assert.deepEqual(lost,['never aboard'],'a finish from a link that was never up is lost at once');
  await aboard(first);link.cleared(61500,22,()=>lost.push('no pose yet'));assert.deepEqual(kinds(first),[],'aboard with no pose out yet, a finish waits: the server has nowhere to judge it from');
  link.pose(at,1000);link.score(120,2);assert.deepEqual(kinds(first),['pose','score pool','score invasion'],'it follows the first pose, and later ones go at once');
  first.close();link.cleared(62000,23,()=>lost.push('pool'));link.score(300,2,()=>lost.push('invasion'));link.maze('finish',{ms:9000},()=>lost.push('maze'));link.maze('start');link.maze('board');
  const second=await next(first);await aboard(second);assert.deepEqual(kinds(second),[],'back aboard, the held finishes still wait for a pose');
  link.pose(at,5000);assert.deepEqual(kinds(second),['pose','score pool','score invasion','maze finish'],'the held finishes go after the pose, in the order they were said; a maze start or board asked for meanwhile is not kept');
  assert.deepEqual(second.sent.at(-1),{m:'maze',op:'finish',ms:9000});assert.deepEqual(lost,['never aboard'],'and none of them was lost');
  second.close();const held=Date.now();link.score(500,3,()=>lost.push('held too long'));const third=await next(second);
  await pause(Math.max(0,held+4500-Date.now()));assert.equal(lost.length,1,'a finish is held for most of five seconds');
  await pause(Math.max(0,held+5300-Date.now()));assert.equal(lost.at(-1),'held too long','and given up after five');
  await aboard(third);link.pose(at,9000);assert.deepEqual(kinds(third),['pose'],'a finish given up does not go later');
  third.close();const clock=Date.now;Date.now=()=>clock()+90001;try{link.score(700,4,()=>lost.push('too long ago'));}finally{Date.now=clock;}
  assert.equal(lost.at(-1),'too long ago','with the last pose more than a kept run\'s life ago there is nothing to hold for');
  link.close();link.maze('finish',{ms:9000},()=>lost.push('closed'));assert.equal(lost.at(-1),'closed','a link that has stopped trying holds nothing');
  console.log('PASS a finish said while the link is down is held for the reconnect, sent after a pose, and reported lost when it cannot go');}
}finally{Object.assign(globalThis,previous);for(const k of names)if(previous[k]===undefined)delete globalThis[k];}
