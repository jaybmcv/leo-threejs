import assert from 'node:assert/strict';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {SHIP_AREAS,createShipArea} from '../src/areas.js';
import {GREEN_ROOM_ID} from '../src/plan/room-names-v2.js';
import layout from '../src/plan/selected-layout.js';
import {toWorld} from '../src/plan/rooms.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {addPhase4Colliders,buildPhase4Fitout} from '../src/v2/phase4-fitout.js';
import {greenRoomMaterials} from '../src/v2/green-room-fitout.js';
import {material} from '../src/v2/phase4-mesh-kit.js';
import {gotoFloor} from '../src/v2/goto-floor.js';
import {roomPlaces} from '../src/v2/wayfinding-data.js';
import {Colliders,solid} from '../src/walk/collision.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {createGreenRoom} from '../src/walk/green-room.js';
import {solidSpots,spotIndex} from '../src/walk/rest.js';

installWalkCanvas(createCanvas);
const id=GREEN_ROOM_ID,room=layout.rooms.find(r=>r.id===id),built=createShipArea(SHIP_AREAS.find(a=>a.id===id));
const root=new T.Group(),structure=new T.Group();
structure.name='V2_structure';root.add(built.root,structure);
const ship={root,inside:root,cutaway:new Set([built.shell])};
buildRoomShell(ship,room,structure);
for(const name of ['Room_fittings','Shelter_bench','Equipment_cabinet','Service_counter','Area_identity_panel','Ceiling_light'])
 assert.equal(built.root.getObjectByName(name),undefined,name+' still in the room');
const shell=structure.getObjectByName('V2_shell_'+id),fit=buildPhase4Fitout(ship,layout,{rooms:[id]});
for(const [name,finish] of Object.entries(greenRoomMaterials)){
 const own=fit.meshes.find(o=>o.material.name==='P4_green_room_'+name)?.material,shared=material(name);
 assert(own,'Missing Green Room finish '+name);
 assert.notEqual(own,shared,'Green Room shares the ship finish '+name);
 assert(shared.color.equals(new T.Color(finish.color)),'Shared finish was dimmed: '+name);
 assert.equal(shared.emissiveIntensity,finish.emissiveIntensity??1);
 const scale=['fuchsia','mint','amber'].includes(name)?1:['brass','lacquer'].includes(name)?.55:.32;
 assert(own.color.equals(shared.color.clone().multiplyScalar(scale)),'Wrong Green Room finish brightness: '+name);
 assert.equal(own.emissiveIntensity,shared.emissiveIntensity*scale);
}
const col=new Colliders(),ground=new Colliders();
col.addStatic(shell,solid);ground.addStatic(shell,o=>o.name==='V2_room_floor');
addPhase4Colliders(ship,col,ground);col.commit();ground.commit();
col.raycastGround=(...args)=>ground.raycast(...args);
const clear=at=>{const result=gotoFloor(col,at);assert(result.ok,result.reason+' at '+at);};
const local=(x,z)=>toWorld(id,[x,0,z]);
function aisle(a,b){
 const n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.35);
 for(let i=0;i<=n;i++){const t=i/n;clear(local(T.MathUtils.lerp(a[0],b[0],t),T.MathUtils.lerp(a[1],b[1],t)));}
}
const destination=roomPlaces(layout).find(r=>r.id===id);
clear(destination.at);
for(const [a,b] of [
 [[1.1,-16.5],[1.1,14.4]], // Door to sofa aisle and back bar.
 [[1.1,-5.8],[-3.5,-5.8]], // East side of the first sofa.
 [[-9,-6.8],[-9,9.8]], // Screen side of both sofas.
 [[1.1,13],[20.4,13]], // Catering to the instruments.
 [[20.4,-8],[20.4,13]], // Vanity and curtained bays.
 [[1.1,14.4],[21,14.4]], // Bar frontage, fridge and decorative panel.
 [[-9,13],[1.1,13]], // Return from the screen aisle.
])aisle(a,b);

assert.equal(fit.rests.length,8);
for(const s of fit.rests){
 assert.deepEqual(s.facing,[-1,0,0]);
 const ray=new T.Ray(new T.Vector3(s.point[0],s.height+.12,s.point[2]),new T.Vector3(0,-1,0));
 const hit=ground.raycast(ray,.2);
 assert(hit&&Math.abs(hit.point.y-s.height)<.01,'Seat anchor misses its cushion '+s.id);
}
const seats=solidSpots(fit.rests.map(s=>({...s,point:new T.Vector3(...s.point),facing:new T.Vector3(...s.facing)})),col);
assert.equal(seats.length,8);
const approach=local(-6.65,-6.8);clear(approach);
assert.equal(spotIndex(seats).pick(new T.Vector3(...approach),new T.Vector3(1,0,0))?.room,id);
const cushions=fit.meshes.filter(m=>m.name==='P4_green_room_sofa_seat_cushion');
const upward=new T.Raycaster(undefined,new T.Vector3(0,1,0),0,.13);
for(const foot of fit.parts.filter(p=>p.part==='green_room_sofa_foot')){
 const [x,y,z]=foot.at,[w,,d]=foot.size;
 for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2]){
  upward.ray.origin.set(x+dx,y,z+dz);
  assert(upward.intersectObjects(cushions,false).length,'Sofa foot protrudes past the cushion at '+foot.at);
 }
}
const active=createGreenRoom(),quiet=createGreenRoom({still:true}),screen=g=>g.group.getObjectByName('Green_room_stage_loop').material.map;
const a=screen(active),q=screen(quiet),version=a.version,stillVersion=q.version;
const pixels=t=>Buffer.from(t.image.getContext('2d').getImageData(0,0,1024,128).data);
const first=pixels(a),inside=new T.Vector3(...local(0,0));
active.update(.5,inside);quiet.update(.5,inside);
assert(a.version>version);
assert.notEqual(Buffer.compare(first,pixels(a)),0,'The screen content must animate');
assert.equal(q.version,stillVersion);
const drawn=a.version;active.update(.5,inside.clone().add(new T.Vector3(0,4,0)));
assert.equal(a.version,drawn);
console.log('PASS Green Room: isolated finishes, shelter fittings removed, walking routes clear, eight supported seats, animated stage and reduced-motion still');
