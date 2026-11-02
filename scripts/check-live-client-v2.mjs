import assert from 'node:assert/strict';
import {buildLiveV2} from './build-live-v2.mjs';
const entry=await buildLiveV2({entry:'src/walk/net/live.js',outfile:'output/launch-h/client-live-v2.mjs'});
const previous={WebSocket:globalThis.WebSocket,localStorage:globalThis.localStorage},sockets=[];
class Socket{constructor(){this.readyState=1;this.sent=[];sockets.push(this);}send(s){this.sent.push(JSON.parse(s));}close(code){this.readyState=3;this.code=code;this.onclose?.();}}
globalThis.WebSocket=Socket;globalThis.localStorage={getItem:()=>null,setItem(){}};
try{const {connectLive}=await import(entry.href);
 for(const welcome of [{id:'old-server',you:{}},{id:'wrong-layout',layout:1},{id:'stale-v2',layout:2,layoutIdentity:'stale'}]){const statuses=[],live=connectLive('ws://127.0.0.1:1/live',{status:s=>statuses.push(s)});const ws=sockets.at(-1);await ws.onopen();assert.equal(ws.sent[0].layout,2);assert.match(ws.sent[0].layoutIdentity,/^[0-9a-f]{64}$/);ws.onmessage({data:JSON.stringify({m:'welcome',...welcome})});live.pose({pos:[1,2,3],yaw:0},1000);live.score(100,1);assert(!live.live&&!live.id&&ws.code===4004&&statuses.at(-1)==='layout');assert.equal(ws.sent.length,1);}
 const live=connectLive('ws://127.0.0.1:1/live',{}),ws=sockets.at(-1);await ws.onopen();ws.onmessage({data:JSON.stringify({m:'welcome',id:'matching',layout:2,layoutIdentity:ws.sent[0].layoutIdentity,you:{verified:true}})});assert(live.live);live.pose({pos:[1,2,3],yaw:0},1000);assert.equal(ws.sent.at(-1).m,'pose');live.close();console.log('PASS v2 client: old v1, mismatched version and stale layout welcome cannot enable poses or scores; matching welcome can');
 // A pass still on its way when the page rejoins stays off the next socket: that one says hello with its own.
 {let release;const pending=new Promise(r=>{release=r;}),passes=[pending,Promise.resolve('fresh')],late=connectLive('ws://127.0.0.1:1/live',{},{pass:()=>passes.shift()}),first=sockets.at(-1),opening=first.onopen();
  late.rejoin();for(let i=0;i<40&&sockets.at(-1)===first;i++)await new Promise(r=>setTimeout(r,100));const second=sockets.at(-1);assert.notEqual(second,first,'a rejoin opens a new socket');
  await second.onopen();release('stale');await opening;
  assert.deepEqual(second.sent.map(m=>m.pass),['fresh'],'the new socket says hello once, with the fresh pass');assert.equal(first.sent.length,0,'the old one says nothing');late.close();console.log('PASS a pass from before a rejoin stays off the new socket');}
}finally{Object.assign(globalThis,previous);}
