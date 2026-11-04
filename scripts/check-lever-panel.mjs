import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {createSharedPanel} from '../server/lever-panel.mjs';
import {PANEL} from '../src/walk/net/panel-rules.js';
import {createLeverPanel} from '../src/walk/lever-panel.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {connectLive} from '../src/walk/net/live.js';

let now=0;const people=new Set(),messages=[];
const panel=createSharedPanel({everyone:()=>people,broadcast:m=>messages.push(m),clock:()=>now});
const visitor=id=>{const v={id,ready:true,pos:[PANEL.face+1.2,PANEL.floor,0]};people.add(v);return v;};
const a=visitor('a'),b=visitor('b');
const step=seconds=>{for(let t=0;t<seconds;t+=.05){now+=50;panel.tick(.05);}};
const pose=(v,x,z=0,y=PANEL.floor)=>{v.pos=[x,y,z];panel.observe(v);};
function solve(){for(const i of [0,3,4]){pose(a,PANEL.face+1.2,PANEL.levers[i]);panel.message(a,{op:'flip',i});}}
pose(a,0);panel.message(a,{op:'flip',i:0});assert.deepEqual(panel.state().levers,[0,0,0,0,0]);
pose(a,PANEL.face+1.2,0,PANEL.floor+4);panel.message(a,{op:'flip',i:2});assert.equal(panel.state().levers[2],0);
pose(a,PANEL.face+1.2,0);panel.message(a,{op:'flip',i:4});assert.equal(panel.state().levers[4],0);
solve();assert.equal(panel.state().phase,'open');assert.deepEqual(messages.at(-1).levers,PANEL.code);step(2);
pose(a,PANEL.face+1.2);pose(b,PANEL.face+1.2);assert.equal(panel.state().owner,'a');
pose(a,PANEL.face-.3);step(1);assert.equal(panel.state().down,1,'a capsule in the doorway holds the panel');
pose(a,PANEL.face-2);step(.5);assert.equal(panel.state().down,0);assert.equal(panel.state().owner,'a');
panel.message(b,{op:'flip',i:2});assert.deepEqual(panel.state().levers,[0,0,0,0,0]);
// The actual client meshes and admission colliders see the same snapshots, with no optimistic lever changes.
installWalkCanvas(createCanvas);
function client(id){const movers=[],sent=[],view=createLeverPanel({addMover(name){const m={name,enabled:true};movers.push(m);return m;}},{shared:true,id:()=>id,send:m=>sent.push(m)});return {view,movers,sent};}
const ca=client('a'),cb=client('b');
ca.view.apply(panel.state());ca.view.update(.05,{x:PANEL.face-2,y:PANEL.floor,z:0});
assert.equal(ca.view.near({x:PANEL.face-2,y:PANEL.floor,z:0}).kind,'lever-exit');ca.view.release();assert.deepEqual(ca.sent,[{op:'exit'}]);
ca.view.update(.05,{x:PANEL.face+2,y:PANEL.floor,z:0});
pose(a,PANEL.face-2);panel.message(a,{op:'exit'});step(2);
for(const c of [ca,cb]){c.view.apply(panel.state());c.view.update(.05,{x:PANEL.face+1.2,y:PANEL.floor,z:0});}
assert(ca.movers[1].enabled,'exit does not admit someone outside');assert(cb.movers[1].enabled);
ca.view.release(); // A release is offered only from inside in the real walk.
ca.view.update(.05,{x:PANEL.face-.5,y:PANEL.floor,z:0});assert(!ca.movers[0].enabled);
pose(a,PANEL.face-1);step(.1);assert.equal(panel.state().owner,'a');assert.equal(panel.state().phase,'exit','the inside approach is not an exit yet');
pose(a,PANEL.face-.3);step(22);assert.equal(panel.state().down,1,'exit timeout cannot close on a body');
pose(a,PANEL.face+2);step(.5);assert.equal(panel.state().owner,null);assert.equal(panel.state().down,0);
solve();step(2);pose(b,PANEL.face+1.2);assert.equal(panel.state().owner,'b');
const open=panel.state();for(const c of [ca,cb]){c.view.update(.05,{x:PANEL.face+2,y:PANEL.floor,z:0});c.view.apply(open);c.view.update(.05,{x:PANEL.face+1.2,y:PANEL.floor,z:0});}
assert(ca.movers[1].enabled);assert(!cb.movers[1].enabled);assert(!cb.movers[0].enabled);
ca.view.flip(0);assert.equal(ca.sent.length,1,'no local flip is sent while the shared panel is open');
pose(b,PANEL.face-2);step(.5);people.delete(b);panel.left(b);assert.equal(panel.state().owner,null);step(.5);
solve();step(2);pose(a,PANEL.face+1.2);pose(a,PANEL.face+3);step(21);assert.equal(panel.state().owner,null,'abandoned reservation expires');
solve();step(2);pose(a,PANEL.face+1.2);pose(a,PANEL.face-2);step(.5);step(PANEL.recovery+1);assert.equal(panel.state().owner,null,'stale room owner expires');
panel.message(a,{op:'exit'});step(2);assert.equal(panel.state().down,1,'a stranded visitor gets time to leave');assert.equal(panel.state().owner,'a');
pose(a,PANEL.face+2);step(.5);assert.equal(panel.state().owner,null);
solve();step(2);pose(a,PANEL.face+1.2);pose(a,PANEL.face-.3);step(PANEL.recovery+1);assert.equal(panel.state().down,0,'a silent doorway pose eventually stops holding the door');
solve();step(2);pose(a,PANEL.face+1.2);pose(a,PANEL.face-2);
for(let i=0;i<151;i++){step(2);pose(a,PANEL.face-2);}assert.equal(panel.state().owner,'a','live inside keepalives renew the lease');
// A stale or missing connection stays closed outside, but the inner release still works.
ca.view.lost();ca.view.update(.05,{x:PANEL.face+1.2,y:PANEL.floor,z:0});assert(ca.movers[0].enabled&&ca.movers[1].enabled);
ca.view.release();for(let i=0;i<40;i++)ca.view.update(.05,{x:PANEL.face-2,y:PANEL.floor,z:0});assert.equal(ca.view.down,1);assert(!ca.movers[0].enabled);
const solo=createLeverPanel();for(const i of [0,3,4])solo.flip(i);
for(let i=0;i<40;i++)solo.update(.05,{x:PANEL.face+2,y:PANEL.floor,z:0});assert.equal(solo.down,1);
solo.update(.05,{x:PANEL.face-2,y:PANEL.floor,z:0});assert.equal(solo.state,'sealed','the solo puzzle still closes after entry');
// Exercise the actual client message routing without requiring generated ship data or a network connection.
const previous={WebSocket:globalThis.WebSocket,localStorage:globalThis.localStorage};let socket;
class Socket{constructor(){socket=this;this.readyState=1;this.sent=[];}send(s){this.sent.push(JSON.parse(s));}close(){this.readyState=3;this.onclose?.();}}
globalThis.WebSocket=Socket;globalThis.localStorage={getItem:()=>null,setItem(){}};
try{
 const received=[],live=connectLive('ws://127.0.0.1:1/live',{panel:m=>received.push(m)});
 await socket.onopen();const hello=socket.sent[0];
 socket.onmessage({data:JSON.stringify({m:'welcome',layout:2,layoutIdentity:hello.layoutIdentity,id:'wire',you:{}})});
 assert(live.panel({op:'flip',i:3}));assert.deepEqual(socket.sent.at(-1),{op:'flip',i:3,m:'panel'});
 socket.onmessage({data:JSON.stringify(open)});assert.deepEqual(received,[open]);live.close();assert(!live.panel({op:'exit'}));
}finally{Object.assign(globalThis,previous);}
console.log('PASS shared panel: code, proximity, first admission, safe close/exit, disconnect, timeouts and client gates');
