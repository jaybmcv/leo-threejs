import * as T from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {requirePreparedFresh} from './prepared-identity-v2.mjs';
import {readPreparedWorld,installPreparedColliders} from '../src/v2/prepared-codec.public.js';
import {restoreRoomAnchors} from '../src/plan/rooms.js';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {createVaultLift} from '../src/walk/vault-lift.js';

const base='output/leo-interior-v02/prepared-walk',integrity=await requirePreparedFresh(base);
const loaded=await readPreparedWorld(new URL('../'+base+'/',import.meta.url),{skipImages:true,metadataName:integrity.files.includes('world.bin')?'world.bin':'world.json.gz',fetchBytes:name=>fs.readFile(base+'/'+name)});
restoreRoomAnchors(loaded.ship.root,loaded.ship.v2RoomAnchors);
const col=installPreparedColliders(new Colliders(),loaded.ship.v2PreparedColliders),lift=createVaultLift(col),cat=new Controller(col);
const tick=(wish,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++){lift.update(1/60,cat);if(!lift.riding)cat.step(1/60,new T.Vector3(...wish),false);}};
// Retained upper routes must work before anyone has unlocked the lounge station.
for(const index of [1,2]){
 assert.equal(lift.lift.at,0);assert(!lift.authorized);
 cat.place(new T.Vector3(0,0,2.5).applyMatrix4(lift.docks[index]));const summon=lift.nearest(cat.position);
 assert.equal(summon?.kind,'clubhouse-call');assert.equal(summon.stop,index);lift.call(summon.lift,summon.stop);
 assert(lift.lift.calls.has(index),'Prepared upper landing queues the locked cab');tick([0,0,0],8);
 assert.equal(lift.lift.at,index);assert.equal(lift.lift.phase,'open');assert(!lift.authorized);
 tick([0,0,-2.25],.9);assert(lift.inside(cat.position)&&lift.authorized,'Prepared upper visitor boards');
 lift.call(lift.lift,0,{now:true});tick([0,0,0],8);assert.equal(lift.lift.at,0);assert(lift.inside(cat.position));
 tick([0,0,-2.25],2);assert(cat.position.z<-33&&Math.abs(cat.position.y-24.3)<.05&&!lift.authorized,'Prepared upper visitor exits and the lounge relocks');
}
cat.place(new T.Vector3(-138.9,24.3,-32.15));assert.equal(lift.nearest(cat.position)?.kind,'clubhouse-password');
assert(lift.unlock('9lives'));const entry=cat.position.clone();tick([0,0,2.25],.85);const entryDistance=cat.position.distanceTo(entry);
assert(entryDistance>=1.5&&lift.inside(cat.position),'Public prepared collision must permit the reported lounge entry: '+JSON.stringify({entryDistance,at:cat.position.toArray()}));
for(const index of [1,2,0]){lift.call(lift.lift,index,{now:true});tick([0,0,0],8);assert.equal(lift.lift.at,index);assert.equal(lift.lift.phase,'open');assert(lift.inside(cat.position),'Prepared rider reaches stop '+index);}
tick([0,0,-2.25],2);assert(cat.position.z<-33&&Math.abs(cat.position.y-24.3)<.05,'Leave the new station across the actual lounge floor');
cat.place(new T.Vector3(-87,24.3,-51.2));const old=cat.position.clone();tick([2.25,0,0],1);const oldWallDistance=cat.position.distanceTo(old);
assert(oldWallDistance<=.8&&cat.position.x<-86.3,'Public prepared wall must close the retired opening: '+JSON.stringify({oldWallDistance,at:cat.position.toArray()}));
assert.equal(lift.nearest(cat.position),null);tick([0,0,2.25],1);assert(cat.position.z>-49.4&&Math.abs(cat.position.y-24.3)<.05,'The old station corridor remains walkable');
for(const [x,direction] of [[-87,1],[-85,-1]]){const ray=new T.Ray(new T.Vector3(x,25.6,-51.2),new T.Vector3(direction,0,0));assert(col.raycast(ray,1.5),'Retired wall blocks sight from both faces');}
const report={status:'PASS',artifact:integrity.sha256,entryDistance,oldWallDistance,scope:'Public prepared BVHs, native controller, real password gate, all three stop transforms and retired wall collision'};
await fs.mkdir('output/phase3/followup',{recursive:true});await fs.writeFile('output/phase3/followup/clubhouse-prepared-target.json',JSON.stringify(report,null,2)+'\n');console.log('PASS public prepared clubhouse stations',report);
