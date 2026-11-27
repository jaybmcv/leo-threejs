import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
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
const parts=[],rests=[];addAtriumStage({parts,rests,y:FROG_AT[1]});
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
frame(30000);assert(trip.active);assert.equal(trip.strength,1);terms(1,1,1);
frame(35000);assert.equal(trip.strength,1);terms(1,1,1);
frame(37500);assert.equal(trip.strength,.5);terms(.5,.5,.5);
frame(39999);assert(trip.active&&trip.strength>0);
const idleCopies=copies.length,idleDraws=draws;frame(40000);terms(0,0,0);frame(41000);
assert.equal(copies.length,idleCopies);assert.equal(draws,idleDraws);assert.deepEqual(disposed,[picture,history,...resized]);
assert.equal(camera.fov,61);assert.equal(trip.active,false);assert.equal(trip.audio.active,false);assert.equal(trip.audio.chains,0);assert.equal(trip.audio.hum,false);assert.deepEqual(output.links,[ctx.destination]);assert.deepEqual(laterOutput.links,[laterCtx.destination]);
for(const c of contexts)for(const n of c.nodes)if(n.started)assert(n.stopped,'effect oscillator stopped');
trip.start();frame(43000);terms(1,0,1);assert(copies.slice(-2).every(t=>!disposed.includes(t)));
trip.end();frame(43225);assert(trip.active);terms(.5,.5,.5);frame(43450);terms(0,0,0);assert.equal(trip.active,false);assert.equal(camera.fov,61);
reduced=true;trip.start();frame(45000);assert.equal(camera.fov,61);terms(.12,0,.72);assert(renderer.uniforms.strength.value<.3);trip.end(true);
reduced=false;trip.start();frame(47000);frame(47100);terms(1,1,1);
const oldHistory=copies.at(-1),lightCopies=copies.length;light=true;frame(47200);terms(.72,0,1);
assert(disposed.includes(oldHistory));assert.equal(copies.length,lightCopies+1);trip.end(true);terms(0,0,0);assert.equal(camera.fov,61);
assert.equal(frogStrength(41),0);
console.log('PASS warp, trails and overlay follow the 40-second envelope with a five-second fade; exact FOV and audio restoration');

// Run the walk handlers with a real controller and trip, plus small doubles for the UI and renderer.
const origin=new T.Vector3(...FROG_AT),vector=at=>new T.Vector3(...at);
const nearest=rests.reduce((a,b)=>vector(a.point).distanceToSquared(origin)<vector(b.point).distanceToSquared(origin)?a:b);
const seat={...nearest,point:vector(nearest.point),facing:vector(nearest.facing)};
const place={id:'apron',at:[104,FROG_AT[1],30],yaw:Math.PI/2};
for(const suffix of ['','.public','.prepared','.authoring']){
 const source=readFileSync(new URL(`../src/walk/main${suffix}.js`,import.meta.url),'utf8');
 const section=(from,to)=>{
  const a=source.indexOf(from),b=source.indexOf(to,a);
  assert(a>=0&&b>a,`main${suffix}.js has ${from}`);return source.slice(a,b);
 };
 const input={enabled:true,down:new Set()},follow={},holder=new T.Group(),ui=new Map(),list={appendChild(){}};
 const $=id=>{if(!ui.has(id))ui.set(id,{hidden:true,querySelector:()=>list});return ui.get(id);};
 const services=Object.fromEntries('prank pawsOff mctRepair emergencyDrill furSettings controlsSettings graphicsSettings maze graffiti crownTv atriumGeometry voyagerLawn roomViewJob ownerHiding featureBatches cabinBatches liftBatches liftDoorBatches drawRuns keelClub phoneBands'.split(' ').map(k=>[k,null]));
 const wardPush={engaged:false,begin(){this.engaged=true;},release(){this.engaged=false;}};
 const treasure={active:false,leave(){this.active=false;},close(){}};
 let target=frog.near(seat.point),mapDeck,menu,gameOpened=false,pickedUp,tourClosed=false;
 const controller=new Controller(colliders);controller.place(seat.point);
 const drawRenderer={clear(){},clearDepth(){},render(){}};
 const walk=runInNewContext([
  section('const frog=createFrog','let emote=null'),
  section('function toggleMap()','{const select='),
  section('function togglePlaces()','// Help:'),
  section('function goTo(place)','// The list is a current server snapshot'),
  section('function draw(view)','// The selfie booth'),
  section('function settle(spot)','const PILLOW_TILT'),
  section('function standUp()','// In a transporter'),
  section('function restPose(dt)','// The lift panel'),
  '({actions,draw,restPose,get resting(){return resting;}})'
 ].join('\n'),{...services,T,$,controller,input,camera,colliders,follow,scene,heading:0,emote:null,resting:null,inBall:false,
  wardPush,treasure,carry:{use(t){pickedUp=t.item;},close(){}},arrivalTour:{close(){tourClosed=true;}},
  lifts:{},lounge:null,walker:{holder,body:new T.Group(),hipHeight:1},PILLOW_TILT:.12,WALKER:{height:1.75},
  ready:()=>true,target:()=>target,arcade:{open(){gameOpened=true;}},chat:{close(){}},closeCamera(){},closeOutside(){},
  createFrog:()=>frog,createFrogTrip:()=>trip,renderer:drawRenderer,sky:scene,haze:scene,skyCamera:camera.clone(),hazeCamera:camera.clone(),
  frameReadout:{frame(){}},performance:{now:()=>clock},inClub:()=>false,deckOf:()=>({number:6}),showMap:n=>{mapDeck=n;},
  document:{createElement:()=>({append(){}})},PLACES:[place],renderGotoMenu(_list,_places,options){menu=options;},
  remapSpot:p=>p,v2GotoStand:(_colliders,at)=>vector(at)});
 const start=clock,drawAt=ms=>{clock=start+ms;walk.draw(camera);};
 const stillTripping=seconds=>{
  assert(trip.active&&trip.audio.active&&trip.audio.amount>0&&trip.warp>0,`main${suffix}.js keeps picture and audio`);
  assert.equal(trip.elapsed,seconds,'time since the lick keeps advancing');
 };
 walk.actions.use();drawAt(1000);stillTripping(1);
 target={kind:'sit',spot:seat};walk.actions.use();walk.restPose(.7);assert.equal(walk.resting.spot,seat);
 drawAt(4000);stillTripping(4);
 walk.actions.use();walk.restPose(.7);assert.equal(walk.resting,null);assert(controller.grounded);
 drawAt(5000);stillTripping(5);
 walk.actions.map();assert.equal(mapDeck,6);assert(!$('map-sheet').hidden&&!input.enabled);
 drawAt(16000);stillTripping(16);
 walk.actions.escape();assert($('map-sheet').hidden&&input.enabled);
 drawAt(17000);stillTripping(17);
 walk.actions.places();assert(!$('places').hidden&&!input.enabled);
 drawAt(25000);stillTripping(25);
 assert(menu.go(place));menu.close();assert($('places').hidden&&input.enabled);
 assert(controller.position.distanceTo(vector(place.at))<.02&&controller.grounded,'Go-to places the walker on the apron');
 drawAt(30000);stillTripping(30);
 target={kind:'carry-item',item:'ration'};walk.actions.use();assert.equal(pickedUp,'ration');
 drawAt(31000);stillTripping(31);
 target={kind:'trolley-push'};walk.actions.use();assert(wardPush.engaged);
 drawAt(32000);stillTripping(32);
 walk.actions.use();assert(!wardPush.engaged);
 drawAt(33000);stillTripping(33);
 drawAt(39999);stillTripping(39.999);
 drawAt(40000);assert(!trip.active&&!trip.audio.active&&trip.warp===0);
 target={kind:'frog'};walk.actions.use();drawAt(41000);
 target={kind:'play'};walk.actions.use();assert(gameOpened&&!trip.active,'Full-screen game still ends the trip');
 target={kind:'frog'};walk.actions.use();drawAt(42000);walk.draw(camera.clone());
 assert(!trip.active,'A separate camera view still ends the trip');
 walk.actions.map();
 wardPush.engaged=treasure.active=true;
 walk.actions.escape();assert(!wardPush.engaged&&treasure.active&&!$('map-sheet').hidden,'Escape still releases the trolley first without a trip');
 walk.actions.escape();assert(!treasure.active&&!$('map-sheet').hidden,'Escape still leaves treasure without a trip');
 walk.actions.escape();assert(tourClosed&&$('map-sheet').hidden&&input.enabled,'Escape still closes the panel and arrival tour without a trip');
 target={kind:'frog'};walk.actions.use();drawAt(43000);walk.actions.escape();assert(trip.active);
 drawAt(43450);assert(!trip.active,'Escape still ends the trip with no panel open');
}
trip.dispose();
console.log('PASS rest, map, Go-to, carry pickup and trolley preserve the 40-second picture and audio in all four walks; Escape keeps its normal handlers');

// Pointer lock consumes Escape before ordinary key handlers. It must still cancel the frog on that first press.
const handlers=[],surface={addEventListener(){}};let escapes=0,unlocked=0;
globalThis.document={pointerLockElement:surface,addEventListener(){},exitPointerLock(){unlocked++;}};
globalThis.addEventListener=(type,fn,capture)=>handlers.push({type,fn,capture});
const input=new WalkInput(surface,{onAction:a=>{if(a==='escape')escapes++;}}),capture=handlers.find(h=>h.type==='keydown'&&h.capture).fn;
const event={code:'Escape',preventDefault(){},stopImmediatePropagation(){}};
capture(event);assert.equal(escapes,0);assert.equal(unlocked,1);
input.escapePointer=()=>true;capture(event);assert.equal(escapes,1);assert.equal(unlocked,2);
console.log('PASS one Escape cancels a frog trip under pointer lock, with ordinary unlocking preserved');
