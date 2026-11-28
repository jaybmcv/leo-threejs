import assert from 'node:assert/strict';
import * as T from 'three';
import {createFrog,FROG_AT} from '../src/walk/frog.js';
import {createFrogLick,frogFrame,FROG_BODY_Y,FROG_LICK_MS,FROG_LEASE_MS} from '../src/walk/frog-lick.js';
import {createFrogPose} from '../src/walk/frog-pose.js';
import {createFrogHold} from '../server/frog-hold.mjs';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {addAtriumStage,stageGeometry,stageTiers} from '../src/v2/atrium-stage.js';
import {plannedStanding} from '../src/v2/standing.js';
import layout from '../src/plan/selected-layout.js';
import {createDLCat} from '../src/vendor/cosmo/DLCat.js';
import {createFrogTrip,frogStrength} from '../src/walk/frog-trip.js';
import {walkAudioOutput} from '../src/walk/frog-audio.js';
import {WalkInput} from '../src/walk/input.js';

// Real capsule motion against the apron, unchanged seating and the new small collider.
const scene=new T.Scene(),colliders=new Colliders(),floorY=layout.decks[5].y,floor=new T.Mesh(new T.BoxGeometry(60,.2,60));floor.position.set(100,floorY-.1,30);colliders.addStatic(floor);
const parts=[];addAtriumStage({parts,rests:[],y:floorY});
const stage=parts.find(p=>p.part==='p6_stage_platform'),front=stage.at[0]-stage.size[0]/2,z=stage.at[2];
const ring=Math.max(...stageTiers()[0].polygon.filter(p=>p[1]===z).map(p=>p[0]));
assert.deepEqual(FROG_AT,[(front+ring)/2,floorY,z],'halfway between the real stage front and seating edge, on their centre line');
for(const p of parts){const g=stageGeometry(p)||new T.BoxGeometry(...p.size),m=new T.Mesh(g);m.position.set(...p.at);colliders.addStatic(m,()=>true);}
colliders.commit();const frog=createFrog(scene,colliders),bounds=new T.Box3().setFromObject(frog.group);
assert(bounds.max.y-floorY<.6);assert(bounds.max.z-bounds.min.z<=1);
assert(bounds.min.x>ring+1.9&&bounds.max.x<front-1.9);
const stand=new T.Vector3(FROG_AT[0]-.81,floorY,z);
assert(plannedStanding(layout,stand.x,stand.y,stand.z,.35));
assert.equal(frog.near(stand).label,'Lick the Frog');assert.equal(frog.near(stand.clone().add(new T.Vector3(0,4,0))),null);
assert.equal(frog.near(new T.Vector3(102.17,floorY,29.01)),null);
const cat=new Controller(colliders);
function walk(yaw,seconds){
 const v=new T.Vector3(Math.sin(yaw)*2.25,0,Math.cos(yaw)*2.25);for(let i=0;i<seconds*120;i++)cat.step(1/120,v);return cat.position;
}
cat.place(stand);assert(walk(Math.PI/2,.8).x<FROG_AT[0]-.45,'frog stops the capsule on a straight approach');
for(const yaw of [Math.PI/4,3*Math.PI/4]){
 cat.place(new T.Vector3(ring-.3,floorY+.24,z));
 assert(Math.abs(walk(yaw,.82).z-z)>1.2&&cat.grounded,'walk off the ring and out to either side of the frog');
 const p=walk(Math.PI/2,1.46);assert(p.x>front-.3&&Math.abs(p.z-z)>1.2&&cat.grounded,'both routes reach the stage front');
 assert(plannedStanding(layout,p.x,p.y,p.z,.35));
}
console.log('PASS frog centred on the live Deck 6 floor, with both seating-to-stage routes open');

// The actual Cosmo rig reaches the log, keeps its feet down and holds the frog against both paws.
const load=T.ImageLoader.prototype.loadAsync;
T.ImageLoader.prototype.loadAsync=async()=>({width:1,height:1});
let asset;
try{asset=await createDLCat({height:1.75});}finally{T.ImageLoader.prototype.loadAsync=load;}
const holder=new T.Group(),bones=new Map(asset.meshes[0].skeleton.bones.map(b=>[b.userData.originalName??b.name,b]));
holder.position.copy(stand);scene.add(holder);holder.add(asset.root);
const rig=createFrogPose(holder,{asset,bones}),tongue=holder.getObjectByName('Frog_lick_tongue'),bind=[...bones.values()].map(b=>[b,b.quaternion.clone()]),rootY=asset.root.position.y;
const pawY=()=>bones.get('hand.L').getWorldPosition(new T.Vector3()).y;
const poseAt=t=>{
 const frame=frogFrame({at:stand.toArray(),yaw:0},t);holder.rotation.y=frame.yaw;asset.root.position.y=rootY;
 for(const [b,q] of bind)b.quaternion.copy(q);
 rig.apply(frame);frog.show(frame.held,rig.grip);return frame.phase;
};
assert.equal(poseAt(.75),'reach');assert.equal(frog.animal.parent,frog.group);assert(pawY()<floorY+.4);assert(!tongue.visible);
assert.equal(poseAt(1.05),'lift');assert(frog.animal.parent===rig.grip&&rig.grip.position.y>FROG_BODY_Y);
assert.equal(poseAt(1.5),'look');assert(rig.grip.position.y>1.1&&pawY()>floorY+1.05);assert(!tongue.visible);
assert.equal(poseAt(2.05),'lick');assert(tongue.visible&&tongue.scale.y>.07&&frog.group.children.every(o=>o!==frog.animal));
const nearTip=tongue.position.z;poseAt(2.5);assert(tongue.visible&&tongue.position.z>nearTip+.035,'one stroke travels along the frog');
assert.equal(poseAt(3.25),'return');assert.equal(frog.animal.parent,frog.group);assert(!tongue.visible);
assert.equal(frog.animal.position.y,FROG_BODY_Y);
asset.dispose();
console.log('PASS Cosmo reaches, lifts, looks, licks once and sets the frog back on its log');

// Web Audio graph doubles check that old and newly opened outputs are restored, with no lingering wet chain.
const contexts=[];
class AudioNode{
 constructor(ctx){this.ctx=ctx;this.links=[];this.gain=this.frequency=this.delayTime={value:0,setTargetAtTime(v){this.value=v;}};ctx.nodes.push(this);}
 connect(to){this.links.push(to);return to;}disconnect(){this.links=[];}start(){this.started=true;}stop(){this.stopped=true;}
}
class AudioContext{
 constructor(){this.currentTime=0;this.sampleRate=120;this.state='running';this.nodes=[];this.destination={};contexts.push(this);}
 createGain(){return new AudioNode(this);}createOscillator(){return new AudioNode(this);}createDelay(){return new AudioNode(this);}createBiquadFilter(){return new AudioNode(this);}createConvolver(){return new AudioNode(this);}
 createBuffer(n,length){return {getChannelData:()=>new Float32Array(length)};}resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
}
globalThis.AudioContext=AudioContext;let reduced=false;globalThis.matchMedia=()=>({get matches(){return reduced;}});
const ctx=new AudioContext(),output=walkAudioOutput(ctx),camera=new T.PerspectiveCamera(61),copies=[],disposed=[];
let width=320,draws=0;
const renderer={getDrawingBufferSize:v=>v.set(width,180),copyFramebufferToTexture(t){
 if(!copies.includes(t))t.addEventListener('dispose',()=>disposed.push(t));copies.push(t);
},render:s=>{draws++;renderer.uniforms=s.children[0].material.uniforms;}};
let clock=0,light=false;const trip=createFrogTrip({renderer,camera,light:()=>light,now:()=>clock});
const frame=ms=>{clock=ms;trip.update();trip.render();};
const terms=(warp,trails,overlay)=>{
 const expected=[warp,trails,overlay];assert.deepEqual([trip.warp,trip.trails,trip.overlay],expected);
 if(trip.active)assert.deepEqual(['warp','trails','overlay'].map(name=>renderer.uniforms[name].value),expected);
};
assert.equal(trip.active,false);assert.deepEqual(output.links,[ctx.destination]);
frame(0);terms(0,0,0);assert.equal(copies.length,0);assert.equal(draws,0);
trip.start();frame(0);assert.equal(copies.length,0);assert.equal(draws,0);
frame(250);terms(frogStrength(.25),0,frogStrength(.25));
const [picture,history]=copies;assert.notEqual(picture,history);assert.equal(copies.length,2);
frame(500);assert.equal(trip.strength,.5);terms(.5,.5,.5);assert.deepEqual(copies.slice(2),[picture,history]);
frame(1000);assert.equal(trip.strength,1);terms(1,1,1);assert.notEqual(camera.fov,61);assert(trip.audio.active&&trip.audio.hum&&trip.audio.chains===1);
width=640;frame(1200);terms(1,0,1);assert.deepEqual(disposed,[picture,history]);
const resized=copies.slice(-2);assert(resized.every(t=>t.image.width===640&&!disposed.includes(t)));
const laterCtx=new AudioContext(),laterOutput=walkAudioOutput(laterCtx);assert.equal(trip.audio.chains,2);
frame(15000);assert.equal(trip.strength,1);terms(1,1,1);frame(17500);assert.equal(trip.strength,.5);terms(.5,.5,.5);
const idleCopies=copies.length,idleDraws=draws;frame(20000);terms(0,0,0);frame(21000);
assert.equal(copies.length,idleCopies);assert.equal(draws,idleDraws);assert.deepEqual(disposed,[picture,history,...resized]);
assert.equal(camera.fov,61);assert.equal(trip.active,false);assert.equal(trip.audio.active,false);assert.equal(trip.audio.chains,0);assert.equal(trip.audio.hum,false);assert.deepEqual(output.links,[ctx.destination]);assert.deepEqual(laterOutput.links,[laterCtx.destination]);
for(const c of contexts)for(const n of c.nodes)if(n.started)assert(n.stopped,'effect oscillator stopped');
trip.start();frame(23000);terms(1,0,1);assert(copies.slice(-2).every(t=>!disposed.includes(t)));
trip.end();frame(23225);assert(trip.active);terms(.5,.5,.5);frame(23450);terms(0,0,0);assert.equal(trip.active,false);assert.equal(camera.fov,61);
reduced=true;trip.start();frame(25000);assert.equal(camera.fov,61);terms(.12,0,.72);assert(renderer.uniforms.strength.value<.3);trip.end(true);
reduced=false;trip.start();frame(27000);frame(27100);terms(1,1,1);
const oldHistory=copies.at(-1),lightCopies=copies.length;light=true;frame(27200);terms(.72,0,1);
assert(disposed.includes(oldHistory));assert.equal(copies.length,lightCopies+1);trip.end(true);terms(0,0,0);assert.equal(camera.fov,61);
assert.equal(frogStrength(21),0);
console.log('PASS warp, trails and overlay follow the 20-second envelope; fresh feedback, reduced motion and light rendering; exact FOV and audio restoration');

const lick=createFrogLick({now:()=>clock,startTrip:()=>trip.start()});
clock=30000;assert(lick.start(stand.toArray(),Math.PI/2,false));
clock=32000;lick.update();assert(lick.locked&&lick.local().phase==='lick'&&!trip.active&&!trip.audio.active);
clock=33699;lick.update();assert(lick.locked&&!lick.local().held&&!trip.active);
clock=33700;lick.update();assert(!lick.locked&&trip.active&&trip.audio.active);
frame(53699);assert(trip.active);frame(53700);assert(!trip.active);
assert(lick.start(stand.toArray(),0,false));lick.cancel();clock+=FROG_LICK_MS;lick.update();
assert(!lick.locked&&!trip.active,'an interrupted lick never starts the trip');
assert(lick.start(stand.toArray(),0,false));lick.update(clock,stand.clone().setX(95));assert(!lick.locked&&!trip.active);
trip.dispose();
console.log('PASS the trip starts after the 3.7-second pose, lasts 20 seconds and is skipped on interruption');

// Relay the same claim between two local client state machines and the server's single lease.
const visitors=[{id:'a',ws:'a'},{id:'b',ws:'b'}],inbox=[],localPose={pos:stand.toArray(),g:true,st:'stand',yaw:0};
const server=createFrogHold({now:()=>clock,send:(ws,msg)=>inbox.push([ws,msg]),broadcast:msg=>visitors.forEach(v=>inbox.push([v.ws,msg]))});
const clients=visitors.map(v=>createFrogLick({now:()=>clock,startTrip:()=>assert.fail('no completed lick in this scenario'),send:(op,request)=>{
 server.message(v,{op,request,p:localPose},p=>{v.pos=p.pos;return true;});return true;
}}));
const deliver=()=>{for(const [ws,msg] of inbox.splice(0))clients[ws==='a'?0:1].hear(msg,ws);};
const [a,b]=clients,[va,vb]=visitors;
assert(a.start(stand.toArray(),0,true));assert(b.start(stand.toArray(),0,true));deliver();
assert(a.locked&&!b.locked&&b.busy);assert.equal(server.state().id,'a');
clock+=2000;assert.equal(a.local().phase,'lick');assert(b.remote().held&&b.remote().phase==='lick');
server.message(vb,{op:'end',request:1});assert.equal(server.state().id,'a');
server.left(va);a.reset();deliver();assert(!a.locked&&!b.busy&&!b.remote()&&!server.state());
assert(b.start(stand.toArray(),0,true));deliver();b.cancel();deliver();assert(!server.state()&&!a.busy);
assert(b.start(stand.toArray(),0,true));deliver();clock+=FROG_LEASE_MS;server.expire();deliver();assert(!server.state()&&!b.locked&&!a.busy);
const noReply=createFrogLick({now:()=>clock,send:()=>true,startTrip:()=>assert.fail('no claim accepted')});
assert(noReply.start(stand.toArray(),0,true));clock+=1500;noReply.update();assert(!noReply.locked);
localPose.pos=[FROG_AT[0],floorY+4,z];assert(a.start(stand.toArray(),0,true));deliver();assert(!a.locked&&!server.state());
console.log('PASS one live holder, with matching remote timing and release on end, disconnect or lease expiry');

// Pointer lock consumes Escape before ordinary key handlers. It must still cancel the frog on that first press.
const handlers=[],surface={addEventListener(){}};let escapes=0,unlocked=0;
globalThis.document={pointerLockElement:surface,addEventListener(){},exitPointerLock(){unlocked++;}};
globalThis.addEventListener=(type,fn,capture)=>handlers.push({type,fn,capture});
const input=new WalkInput(surface,{onAction:a=>{if(a==='escape')escapes++;}}),capture=handlers.find(h=>h.type==='keydown'&&h.capture).fn;
const event={code:'Escape',preventDefault(){},stopImmediatePropagation(){}};
capture(event);assert.equal(escapes,0);assert.equal(unlocked,1);
input.escapePointer=()=>true;capture(event);assert.equal(escapes,1);assert.equal(unlocked,2);
console.log('PASS one Escape cancels a frog trip under pointer lock, with ordinary unlocking preserved');
