import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {createTreasureGame} from '../src/walk/aquarium-treasure/game.js';
import {SWIM,swimWorld,swimLocal,limitSwim,distance,gemNear} from '../src/walk/aquarium-treasure/layout.js';
import {createTreasureBoard} from '../server/aquarium-treasure.mjs';
import {setFrameOverride,clearFrameOverrides} from '../src/plan/rooms.js';

// Play the swim through its movement and interaction API, and its board through the server's pose observer.
// A small DOM stand-in hosts the controls; this does not stand in for browser or visual checks.
class Element{
 constructor(){this.hidden=false;this.children=[];this.style={};this.listeners={};}
 append(...kids){this.children.push(...kids);}
 addEventListener(type,fn){this.listeners[type]=fn;}
 focus(){}
 setPointerCapture(){}
}
let now=10000;const elements=[];
globalThis.document={head:new Element(),body:new Element(),createElement(tag){if(tag==='canvas')return createCanvas(1,1);const e=new Element();elements.push(e);return e;}};
globalThis.addEventListener=()=>{};
const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
for(const change of [{},{dx:7,dz:-3,yawDeg:37,mirror:true}]){
 setFrameOverride('commons-1',change);
 for(const p of [SWIM.entry,SWIM.door,...SWIM.gems])assert(distance(swimLocal(swimWorld(p)),p)<1e-9);
}clearFrameOverrides();
const tank=new T.Group(),controller={position:new T.Vector3(...swimWorld(SWIM.door)),velocity:new T.Vector3(),place(p){this.position.copy(p);this.velocity.set(0,0,0);this.grounded=true;}};
const input={enabled:true,down:new Set()},follow={yaw:0,pitch:0,mode:'third',distance:3.4,current:3.4},camera=new T.PerspectiveCamera();
const game=createTreasureGame({tank,controller,follow,camera,input,live:()=>null,onOpen(){input.enabled=false;},onClose(){input.enabled=true;}});
// Project the wording's left and right edges from the gallery, in either handedness of the room.
for(const mirror of [false,true]){
 const root=new T.Group();root.scale.z=mirror?-1:1;
 const g=createTreasureGame({tank:root,controller,follow,camera,input,live:()=>null}),sign=g.group.children.find(o=>o.material?.map);
 root.updateMatrixWorld(true);const pos=sign.geometry.attributes.position,uv=sign.geometry.attributes.uv;
 const centre=sign.getWorldPosition(new T.Vector3()),view=new T.PerspectiveCamera(60,1,.1,20);
 view.position.copy(centre).add(new T.Vector3(0,0,mirror?-3:3));view.lookAt(centre);view.updateMatrixWorld(true);
 const edge=u=>{const i=Array.from({length:uv.count},(_,k)=>k).find(k=>uv.getX(k)===u&&uv.getY(k)===0);return new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(sign.matrixWorld).project(view).x;};
 assert(edge(0)<edge(1),'Aquarium door lettering is mirrored from the gallery');
}
assert.equal(game.near(controller.position)?.op,'enter');game.use({op:'enter'});
assert(game.active);assert(game.contains(controller.position));assert.equal(game.found,0);
game.use({op:'finish'});assert(!game.done,'The chest cannot finish a run before the gems');
function tick(k={x:0,y:0,held:false,jump:false}){now+=1000/60;game.step(1/60,k);game.updateCamera(1/60);
 assert(distance(swimLocal(controller.position.toArray()),limitSwim(swimLocal(controller.position.toArray())))<1e-7,'Swimmer left its body bounds');
 assert(camera.position.toArray().every(Number.isFinite));}
function swimTo(local){const dest=new T.Vector3(...swimWorld(local));let n=0;
 while(controller.position.distanceTo(dest)>.18&&n++<5000){const d=dest.clone().sub(controller.position).normalize();follow.yaw=Math.atan2(d.x,d.z);follow.pitch=Math.asin(d.y);tick({x:0,y:1});}
 assert(n<5000,'Cannot swim to '+local.join(','));
}
// All seven need horizontal and vertical movement. The route crosses over the tunnel on the way to the right reef.
for(const g of SWIM.gems)swimTo([g[0],g[1]-SWIM.offset,g[2]]);
assert.equal(game.found,7);assert(!game.done,'The last gem leaves the clock running');
swimTo(SWIM.chest);assert.equal(game.near(controller.position)?.op,'finish');game.use({op:'finish'});assert(game.done);
assert(saved.has('leo-aquarium-best'));assert(!input.enabled);game.close();assert(input.enabled);
game.leave();assert(!game.active);assert(controller.grounded);assert(controller.position.distanceTo(new T.Vector3(...swimWorld(SWIM.door)))<1e-8);
game.use({op:'enter'});assert.equal(game.found,0);assert(!game.done);
// Drive hard into every side, the lid, bed and tunnel; no input can leave the water.
for(const [yaw,pitch] of [[0,0],[Math.PI,0],[Math.PI/2,0],[-Math.PI/2,0],[0,Math.PI/2],[0,-Math.PI/2]]){
 follow.yaw=yaw;follow.pitch=pitch;for(let i=0;i<1000;i++)tick({x:0,y:1});}
game.leave(false);assert(!game.active);
console.log('Aquarium: seven gems through swim controls, chest, camera, exit, restart, bounds and room transforms pass.');

delete globalThis.document;
await fs.mkdir('.qa',{recursive:true});const dir=await fs.mkdtemp(path.resolve('.qa/treasure-')),file=path.join(dir,'times.json'),answers=[];
const board=createTreasureBoard({file,now:()=>now,log(){},send(ws,msg){answers.push({ws,msg});}});
const visitor=id=>({ws:id,name:id,pos:swimWorld(SWIM.door),discord:id==='guest'?null:{discordId:id}});
const start=v=>board.message(v,{op:'start'}),finish=(v,ms)=>{board.message(v,{op:'finish',ms});return answers.at(-1).msg;};
function pose(v,p){v.pos=swimWorld(p);board.observe(v);}
function travel(v,from,to){const n=Math.max(1,Math.ceil(distance(from,to)/.2));for(let i=1;i<=n;i++){now+=55;pose(v,from.map((x,k)=>x+(to[k]-x)*i/n));}}
const v=visitor('Cosmo');start(v);let t0=now,last=[...SWIM.entry];pose(v,last);
for(const g of SWIM.gems){const p=[g[0],g[1]-SWIM.offset,g[2]];travel(v,last,p);last=p;}
travel(v,last,SWIM.chest);const good=finish(v,Math.round(now-t0));assert(good.ok);assert(good.newBest);assert.equal(good.rank,1);
now+=4000;const missing=visitor('Missing');start(missing);const missingAt=now;travel(missing,SWIM.entry,SWIM.chest);assert.equal(finish(missing,Math.round(now-missingAt)).ok,false);
const warp=visitor('Warp');start(warp);for(const g of SWIM.gems){now+=1;pose(warp,[g[0],g[1]-.8,g[2]]);}pose(warp,SWIM.chest);assert.equal(finish(warp,1100).ok,false);
const guest=visitor('guest');start(guest);assert.equal(finish(guest,1000).why,'sign-in');
now+=4000;v.pos=swimWorld(SWIM.door);start(v);board.message(v,{op:'cancel'});now+=10000;pose(v,SWIM.chest);assert.equal(finish(v,10000).ok,false);
await new Promise(r=>setTimeout(r,1100));assert.equal(JSON.parse(await fs.readFile(file,'utf8')).length,1);
const reload=createTreasureBoard({file,now:()=>now,log(){},send(ws,msg){answers.push({ws,msg});}});reload.message(v,{op:'board'});
assert.equal(answers.at(-1).msg.top[0].name,'Cosmo');assert.equal(answers.at(-1).msg.you.ms,good.ms);
assert(dir.startsWith(path.resolve('.qa')+path.sep));await fs.rm(dir,{recursive:true});
console.log('Aquarium board: observed gem visits, valid clock, missing gems, warps, sign-in, cancellation and persistence pass.');
