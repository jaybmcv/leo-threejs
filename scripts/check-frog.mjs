import assert from 'node:assert/strict';
import * as T from 'three';
import {createFrog,FROG_AT} from '../src/walk/frog.js';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {addAtriumStage,stageGeometry} from '../src/v2/atrium-stage.js';
import {createFrogTrip,frogStrength} from '../src/walk/frog-trip.js';
import {walkAudioOutput} from '../src/walk/frog-audio.js';
import {WalkInput} from '../src/walk/input.js';

// Real capsule motion against the apron, unchanged seating and the new small collider.
const scene=new T.Scene(),colliders=new Colliders(),floor=new T.Mesh(new T.BoxGeometry(60,.2,60));floor.position.set(100,FROG_AT[1]-.1,30);colliders.addStatic(floor);
const parts=[];addAtriumStage({parts,rests:[],y:FROG_AT[1]});
for(const p of parts){const g=stageGeometry(p)||new T.BoxGeometry(...p.size),m=new T.Mesh(g);m.position.set(...p.at);colliders.addStatic(m,()=>true);}
colliders.commit();const frog=createFrog(scene,colliders),bounds=new T.Box3().setFromObject(frog.group);
assert(bounds.max.y-FROG_AT[1]<.6);assert(bounds.max.z-bounds.min.z<=1);assert(bounds.max.x<105);
for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z])assert(Math.hypot(x-108,z-30)<6.49,'clear of the inner seating nosing');
assert.equal(frog.near(new T.Vector3(101,-19.7,29.01)).label,'Lick the Frog');assert.equal(frog.near(new T.Vector3(101,-15.7,29.01)),null);
const cat=new Controller(colliders);
function walk(from,velocity,seconds){cat.place(new T.Vector3(...from));for(let i=0;i<seconds*120;i++)cat.step(1/120,new T.Vector3(...velocity));return cat.position.clone();}
const stopped=walk([103.8,-19.7,29.01],[-4,0,0],.8);assert(stopped.x>102.65,'frog blocks walking straight through');
for(const z of [27.5,30.5]){const p=walk([103.8,-19.7,z],[-4,0,0],1.1);assert(p.x<100.2,'both sides lead back to seating');assert(p.y>-19.5,'seating ring remains walkable');}
const across=walk([103.5,-19.7,27.5],[0,0,4],.85);assert(across.z>30.4,'apron passage beside frog stays open');
console.log('PASS frog size, placement, collision and both seating approaches');

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
const ctx=new AudioContext(),output=walkAudioOutput(ctx),camera=new T.PerspectiveCamera(61),copies=[];
const renderer={getDrawingBufferSize:v=>v.set(320,180),copyFramebufferToTexture:t=>copies.push(t),render:s=>{renderer.uniforms=s.children[0].material.uniforms;}};
let clock=0,light=false;const trip=createFrogTrip({renderer,camera,light:()=>light,now:()=>clock});
const frame=ms=>{clock=ms;trip.update();if(trip.active)trip.render();};
assert.equal(trip.active,false);assert.deepEqual(output.links,[ctx.destination]);
trip.start();frame(500);assert.equal(trip.strength,.5);frame(1000);assert.equal(trip.strength,1);assert.notEqual(camera.fov,61);assert(trip.audio.active&&trip.audio.hum&&trip.audio.chains===1);
assert(renderer.uniforms.motion.value===1);frame(1200);assert.equal(renderer.uniforms.trails.value,1);
const laterCtx=new AudioContext(),laterOutput=walkAudioOutput(laterCtx);assert.equal(trip.audio.chains,2);
frame(15000);assert.equal(trip.strength,1);frame(17500);assert.equal(trip.strength,.5);frame(20000);
assert.equal(camera.fov,61);assert.equal(trip.active,false);assert.equal(trip.audio.active,false);assert.equal(trip.audio.chains,0);assert.equal(trip.audio.hum,false);assert.deepEqual(output.links,[ctx.destination]);assert.deepEqual(laterOutput.links,[laterCtx.destination]);
for(const c of contexts)for(const n of c.nodes)if(n.started)assert(n.stopped,'effect oscillator stopped');
trip.start();frame(23000);trip.end();frame(23225);assert(trip.active);assert(Math.abs(trip.strength-.5)<.001);frame(23450);assert.equal(trip.active,false);assert.equal(camera.fov,61);
reduced=true;trip.start();frame(25000);assert.equal(camera.fov,61);assert.equal(renderer.uniforms.motion.value,0);assert.equal(renderer.uniforms.trails.value,0);assert(renderer.uniforms.strength.value<.3);trip.end(true);
reduced=false;light=true;trip.start();frame(27000);assert.equal(renderer.uniforms.motion.value,0);assert.equal(renderer.uniforms.trails.value,0);trip.end(true);assert.equal(camera.fov,61);
assert.equal(frogStrength(21),0);trip.dispose();
console.log('PASS 20-second envelope, early fade, exact FOV/audio restoration, reduced motion and light rendering');

// Pointer lock consumes Escape before ordinary key handlers. It must still cancel the frog on that first press.
const handlers=[],surface={addEventListener(){}};let escapes=0,unlocked=0;
globalThis.document={pointerLockElement:surface,addEventListener(){},exitPointerLock(){unlocked++;}};
globalThis.addEventListener=(type,fn,capture)=>handlers.push({type,fn,capture});
const input=new WalkInput(surface,{onAction:a=>{if(a==='escape')escapes++;}}),capture=handlers.find(h=>h.type==='keydown'&&h.capture).fn;
const event={code:'Escape',preventDefault(){},stopImmediatePropagation(){}};
capture(event);assert.equal(escapes,0);assert.equal(unlocked,1);
input.escapePointer=()=>true;capture(event);assert.equal(escapes,1);assert.equal(unlocked,2);
console.log('PASS one Escape cancels a frog trip under pointer lock, with ordinary unlocking preserved');
