import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import layout from '../src/plan/selected-layout.js';
import {frame,v1Frame,toWorld} from '../src/plan/rooms.js';
import {applyRoomFitoutOverrides} from '../src/v2/room-fitout-overrides.js';
import {fitoutGeometry,material} from '../src/v2/phase4-mesh-kit.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {createGamingRefreshments} from '../src/walk/gaming-refreshments.js';
import {dressGamingLounge,createGamingLounge} from '../src/walk/gaming-lounge.js';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';

installWalkCanvas(createCanvas);
const id='d16-training-aft',overrides=JSON.parse(await fs.readFile('src/plan/room-fitout-overrides-v2.json','utf8'));
const data={parts:[],rooms:[],rests:[]};applyRoomFitoutOverrides(data,layout,{[id]:overrides[id]});
assert.equal(data.parts.length,9,'Solid counter and shelf parts');
const root=new T.Group(),room=new T.Group(),fit=new T.Group(),shell=new T.Group();
room.name='Area_'+id;room.position.set(...v1Frame(id).origin);fit.name='Room_fittings';shell.name='Walls_and_ceiling';room.add(fit,shell);root.add(room);
assert(dressGamingLounge({root}));root.updateMatrixWorld(true);
const furniture=[];fit.traverse(o=>{if(o.isMesh)furniture.push(new T.Box3().setFromObject(o));});
for(const p of data.parts){
 const o=new T.Mesh(fitoutGeometry(p),material(p.mat));o.name=p.part;o.position.set(...p.at);o.rotation.y=p.yaw;root.add(o);o.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(o);
 assert(furniture.every(b=>!b.intersectsBox(bounds)),p.part+' overlaps an existing station');
 assert(bounds.max.y<frame(id).origin[1]+1.84,'Shelf stays below the lowest hexagon light');
}
const floor=new T.Mesh(new T.BoxGeometry(48,.2,22));floor.position.set(...toWorld(id,[0,-.1,-2]));root.add(floor);
const colliders=new Colliders();colliders.addStatic(root);colliders.commit();
const walker=new Controller(colliders);walker.place(new T.Vector3(-226.08,20.31,-22.05));
const walk=(yaw,seconds)=>{const p=walker.position.clone(),r=yaw*Math.PI/180,wish=new T.Vector3(Math.sin(r),0,Math.cos(r)).multiplyScalar(2.25);for(let t=0;t<seconds*60;t++)walker.step(1/60,wish);assert(Math.abs(walker.position.y-20.3)<.02,'Route stays on the room floor');return walker.position.distanceTo(p);};
assert(walk(270,3)>4,'Visitor reaches the counter');
assert(walker.position.x>-230.4&&walker.position.x<-230.25,'Counter front stops the cat outside its solid bounds');
assert(walk(270,1)<.02,'Continuing forward cannot enter the counter');
assert(walk(90,.8)>1.4,'Visitor backs away');
assert(walk(0,2)>4,'Green station approach stays clear');
assert(walker.position.z>-18.1&&walker.position.z<-17.3);
assert(walk(180,6)>12.8,'Relocated red station approach stays clear');
assert(walker.position.z>-31.8&&walker.position.z<-30.7);
const redChair=fit.children.find(o=>o.name==='Gaming_chair').getWorldPosition(new T.Vector3());
assert(Math.hypot(walker.position.x-redChair.x,walker.position.z-redChair.z)<1.8,'Route reaches the relocated red PC chair');

const edge=new T.MeshBasicMaterial(),bar=createGamingRefreshments(edge),g=bar.group;
let instanced=0,lights=0;g.traverse(o=>{if(o.isInstancedMesh)instanced+=o.count;if(o.isLight)lights++;});
assert(instanced>=180,'Full rows use instanced stock and labels');assert.equal(lights,0,'No extra lights');
const stages=new Set(),headings=new Set(),headTilts=new Set(),arms=new Set();
let previousStage='';
for(let i=0;i<720;i++){
 bar.update(1/60);const t=g.userData.servingTime,stage=g.userData.servingStage;stages.add(stage);
 headings.add(g.getObjectByName('Gaming_robot_torso').rotation.y.toFixed(2));headTilts.add(g.getObjectByName('Gaming_robot_head').rotation.y.toFixed(2));
 arms.add(g.getObjectByName('Gaming_robot_forearm').quaternion.toArray().map(n=>n.toFixed(2)).join(','));
 const source=g.getObjectByName('Gaming_shelf_can'),held=g.getObjectByName('Gaming_held_can'),served=g.getObjectByName('Gaming_served_can');
 assert.equal(Number(source.visible)+Number(held.visible)+Number(served.visible),1,'Exactly one copy of the serving can');
 assert.equal(held.visible,t>=3.1&&t<7.7);assert.equal(served.visible,t>=7.7&&t<10.6);
 if(served.visible)assert(Math.abs(served.position.y-.1-1.093)<1e-6,'Can rests on the glossy counter');
 if(stage!==previousStage&&stage==='carry')assert(held.position.distanceTo(source.position)<.01,'Can is picked up at the shelf');
 if(stage!==previousStage&&stage==='served')assert(held.position.distanceTo(served.position)<.01,'Can is released at the counter');
 previousStage=stage;
 g.updateMatrixWorld(true);g.getObjectByName('Gaming_robot_server').traverse(o=>{if(!o.isMesh)return;const b=new T.Box3().setFromObject(o);assert(b.max.x<-21.8,'Robot stays behind the counter front');});
}
assert.equal(stages.size,6);assert(headings.size>50&&headTilts.size>10&&arms.size>50,'Torso, head and arms all move');
// Exercise the actual room update as well: distance and reduced motion pause the server.
const previousDocument=globalThis.document;let lounge,still;
try{globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return createCanvas(1,1);}};lounge=createGamingLounge({root});still=createGamingLounge({root},null,{still:true});}
finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
const near=new T.Vector3(-226.08,21.8,-22.05),feet=new T.Vector3(-226.08,20.3,-22.05),far=new T.Vector3(0,0,0);
const clock=()=>lounge.group.getObjectByName('Gaming_refreshments').userData.servingTime;
lounge.update(1,near,feet);assert.equal(clock(),1);lounge.update(1,far,far);assert.equal(clock(),1,'Distant robot pauses');
lounge.update(1,near.clone().add(new T.Vector3(0,-4,0)),feet.clone().add(new T.Vector3(0,-4,0)));assert.equal(clock(),1,'Robot pauses for visitors on another deck');
still.update(1,near,feet);assert.equal(still.group.getObjectByName('Gaming_refreshments').userData.servingTime,0,'Reduced motion keeps a rest pose');
for(const suffix of ['', '.authoring', '.prepared', '.public']){
 const source=await fs.readFile('src/walk/gaming-lounge'+suffix+'.js','utf8');assert(source.includes("from './gaming-refreshments.js'"));assert(source.includes('group.add(refreshments.group)'));assert(source.includes('if(!still&&(inside.containsPoint(eye)'));assert(source.includes('refreshments.update(dt)'));
}
console.log('PASS gaming bar: stocked instances, complete serving loop, existing stations, counter collision and both walking routes');
