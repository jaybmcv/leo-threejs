import '../src/model.js';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {createJaguarGate} from '../src/walk/jaguar-gate.js';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';

installWalkCanvas(createCanvas);
const {group,solid}=createJaguarGate(),bounds=new T.Box3().setFromObject(group,true);
let triangles=0;group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
console.log('Jaguar gate:',triangles,'triangles; bounds',bounds.min.toArray(),bounds.max.toArray());
assert(triangles<5000,'Keep the entire gate within a few thousand triangles');
const headBounds=new T.Box3().setFromObject(group.getObjectByName('Jaguar_head'),true);
assert(headBounds.max.y<28,'Head must stay below the Deck 17 ceiling');
for(const name of ['Jaguar_obsidian','Jaguar_ears'])assert(new T.Box3().setFromObject(group.getObjectByName(name),true).max.y<28,'Ears must stay below the ceiling');
assert(Math.abs(group.position.x+112.5)<.001,'Gate stays on the existing doorway centre');
const inverse=group.matrixWorld.clone().invert(),world=p=>new T.Vector3(...p).applyMatrix4(group.matrixWorld);
// Look along the eyes from the corridor. Neither the skull nor brow may bury them.
for(const side of [-1,1]){
 const from=world([side*.84,3.01,5]),toward=world([side*.84,3.01,0]).sub(from).normalize();
 const hit=new T.Raycaster(from,toward).intersectObject(group,true).find(h=>!h.object.material.transparent);
 assert(hit&&/Jaguar_eye/.test(hit.object.material.name),'Yellow eyes must be visible beneath the brow');
}
const col=new Colliders();col.addStatic(solid,()=>true);
const floor=new T.Mesh(new T.BoxGeometry(10,.2,16));floor.position.copy(world([0,-.1,0]));floor.updateMatrixWorld(true);col.addStatic(floor,()=>true);col.commit();
// Use the real standing capsule in both directions, including near both jambs.
for(const x of [-.55,0,.55]){
 const walker=new Controller(col);walker.place(world([x,0,3.4]));
 const step=direction=>{const wish=new T.Vector3(0,0,direction*2.25).transformDirection(group.matrixWorld).multiplyScalar(2.25);
  // The retained exit arch has a 5 cm bevel at its threshold.
  for(let i=0;i<210;i++){walker.step(1/60,wish,false);assert(Math.abs(walker.position.y-24.3)<.06,'Jaw must not lift or drop the walker: '+JSON.stringify({x,step:i,position:walker.position.toArray()}));}
 };
 step(-1);assert(walker.position.clone().applyMatrix4(inverse).z<-3.7,'Visitor must cross the mouth and throat into the lounge');
 step(1);assert(walker.position.clone().applyMatrix4(inverse).z>3.2,'Visitor must return through the mouth into the corridor');
}
console.log('PASS visible eyes, ceiling, triangle budget and three standing routes in both directions');
