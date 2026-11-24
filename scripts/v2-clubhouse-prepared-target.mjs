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
// Walk across the actual baked landing and the live movers, as in the public page.
const landing=i=>new T.Vector3(0,0,2.85).applyMatrix4(lift.docks[i]);
for(const index of [1,2]){
 assert.equal(lift.lift.at,0);assert(!lift.authorized);
 cat.place(landing(index));const summon=lift.nearest(cat.position);
 assert.equal(summon?.kind,'clubhouse-call');assert.equal(summon.stop,index);
 lift.call(summon.lift,summon.stop);assert(lift.lift.calls.has(index));tick([0,0,0],8);
 assert.equal(lift.lift.at,index);assert.equal(lift.lift.phase,'open');assert(!lift.authorized);
 tick([2.25,0,0],1.25);assert(lift.inside(cat.position)&&lift.authorized,'Prepared upper visitor boards');
 lift.call(lift.lift,0,{now:true});tick([0,0,0],8);assert.equal(lift.lift.at,0);assert(lift.inside(cat.position));
 tick([-2.25,0,0],1.65);
 assert(cat.position.x<landing(0).x&&Math.abs(cat.position.y-24.3)<.05&&!lift.authorized,'Prepared upper visitor exits and the lounge relocks');
}
cat.place(landing(0));assert.equal(lift.nearest(cat.position)?.kind,'clubhouse-password');
assert(lift.unlock('9lives'));const entry=cat.position.clone();tick([2.25,0,0],1.25);const entryDistance=cat.position.distanceTo(entry);
assert(entryDistance>=2.5&&lift.inside(cat.position),'Public prepared collision permits boarding from the lounge');
for(const index of [1,2,0]){
 lift.call(lift.lift,index,{now:true});tick([0,0,0],8);assert.equal(lift.lift.at,index);
 assert.equal(lift.lift.phase,'open');assert(lift.inside(cat.position),'Prepared rider reaches stop '+index);
 if(index===0)break;
 tick([-2.25,0,0],1.43);assert(!lift.inside(cat.position)&&cat.grounded&&Math.abs(cat.position.y-lift.lift.y)<.05,'Prepared walkway edge is flush with the car');
 tick([0,0,-2.25],1.55);assert(cat.grounded&&cat.position.z<landing(index).z-3,'Prepared walkway extends beyond the door');
 tick([0,0,2.25],1.55);tick([2.25,0,0],1.43);assert(lift.inside(cat.position),'Prepared visitor reboards');
}
tick([-2.25,0,0],1.65);assert(cat.position.x<landing(0).x&&Math.abs(cat.position.y-24.3)<.05,'Leave the cab across the actual lounge floor');
cat.place(new T.Vector3(-87,24.3,-51.2));const old=cat.position.clone();tick([2.25,0,0],1);const oldWallDistance=cat.position.distanceTo(old);
assert(oldWallDistance<=.8&&cat.position.x<-86.3,'Public prepared wall must close the retired opening');
tick([0,0,2.25],1);assert(cat.position.z>-49.4&&Math.abs(cat.position.y-24.3)<.05,'The old ground corridor remains walkable');
for(const {deck,y} of lift.lift.stops){
 assert.equal(lift.nearest(new T.Vector3(-86.53,y,-51.2)),null);
 for(const [x,direction] of [[-89,1],[-87,-1],[-87,1],[-85,-1]]){
  const ray=new T.Ray(new T.Vector3(x,y+1.5,-51.2),new T.Vector3(direction,0,0));
  assert(col.raycast(ray,1.5),'Retired wall blocks both faces on Deck '+deck);
 }
}
const report={status:'PASS',artifact:integrity.sha256,entryDistance,oldWallDistance,scope:'Public prepared BVHs, native controller, all three doors and both retired upper walls'};
await fs.mkdir('output/phase3/followup',{recursive:true});await fs.writeFile('output/phase3/followup/clubhouse-prepared-target.json',JSON.stringify(report,null,2)+'\n');console.log('PASS public prepared clubhouse stations',report);
