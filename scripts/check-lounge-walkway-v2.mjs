import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import layout from '../src/plan/selected-layout.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {polygonGeometry,floor,bounds,mesh} from '../src/v2/geometry.js';
import {buildCorridorFloors} from '../src/v2/corridor-floor-union.js';
import {buildCommonsHallFinish} from '../src/v2/commons-hall-finish.js';
import {launchDFitout} from '../src/v2/launch-d-fitout.js';
import {applyPublicFinishKit} from '../src/v2/finish-kit.js';
import {loungeWalkwayPlan,retireLoungeWalkwayBacking} from '../src/v2/lounge-walkway-finish.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {applyLoungeFloorFinish} from '../src/v2/lounge-floor-material.js';
import {cutChartMany,shellParts} from '../src/v2/hull-prototypes.js';
import {sideGalleryDoorCuts} from '../src/v2/gallery-doorways.js';
import {SYNTHWAVE_MURAL} from '../src/v2/community-routes.js';
import {worldPoint} from '../src/plan/hull-skin-v2.js';
import {installGround} from '../src/v2/ground.js';
import {bakeForWalking} from '../src/walk/render-bake.js';
import {Colliders,solid} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {LOUNGE_PLAN,applyLoungeBalconyCut,applyLoungeWalkwayExtension} from '../src/plan/lounge-layout-v2.js';

installWalkCanvas(createCanvas);
// This Deck 18 cut must leave the Deck 19 walkway and every other gallery untouched.
{const r=structuredClone(layout.rooms.find(r=>r.id==='commons-1')),saved=structuredClone(r.components.galleries.filter(g=>g.id!=='commons-1-end-4'));
 const end=r.components.galleries.find(g=>g.id==='commons-1-end-4');end.polygon=[[-141,-47.3770888],[-137,-47.3770888],[-137,-28],[-141,-28]];applyLoungeBalconyCut(r);
 assert.deepEqual(r.components.galleries.filter(g=>g.id!=='commons-1-end-4'),saved);assert.equal(Math.min(...end.polygon.map(p=>p[1])),LOUNGE_PLAN.balconyEnd);
}
const plan=loungeWalkwayPlan(layout),deck=layout.decks[18],root=new T.Group(),structure=new T.Group();structure.name='V2_structure';root.add(structure);
const rect=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],geometry=polygonGeometry(rect(-160,-80,-35,5),deck.slab.holes.map(h=>h.polygon),deck.y,.24),slab=new T.Mesh(geometry,floor);slab.name='Deck_slab';slab.userData.v2Deck=19;structure.add(slab);
// Use the real raised corridor producer as well as the slab: its top is 8 mm higher.
const corridorLayout={...layout,circulation:{...layout.circulation,corridors:layout.circulation.corridors.filter(c=>c.deck===19)}},holeBounds=layout.decks.map(d=>d.slab.holes.map(h=>({...h,box:bounds(h.polygon)}))),roomHoles=layout.decks.map(d=>layout.rooms.filter(r=>!r.aggregate&&Math.abs(r.y-d.y)<.1&&r.polygon.length).map(r=>({polygon:r.polygon,box:bounds(r.polygon)})));
buildCorridorFloors(structure,corridorLayout,roomHoles,holeBounds);
const sourceFloors=structure.children.filter(o=>o.material===floor).map(o=>({o,positions:o.geometry.attributes.position.array.slice()}));
const original=geometry.attributes.position.array.slice(),before=geometry.index?.array.slice();
applyPublicFinishKit({root,inside:root},layout,{decks:[19]});
assert.deepEqual(geometry.attributes.position.array,original,'Structural positions must stay unchanged');assert.deepEqual(geometry.index?.array,before,'Structural topology must stay unchanged');
for(const {o,positions}of sourceFloors)assert.deepEqual(o.geometry.attributes.position.array,positions,'Raised corridor structure must stay unchanged');
const finishes=structure.children.filter(o=>/^(V2_public_floor_finish|V2_lounge_walkway_carpet|V2_lounge_walkway_gold)$/.test(o.name)),ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,.1);root.updateMatrixWorld(true);
const hit=(x,z)=>{ray.ray.origin.set(x,32.35,z);return ray.intersectObjects(finishes).map(h=>h.object);};
const material=(x,z,name)=>{const objects=hit(x,z);assert(objects.length>0,'Missing finish '+[x,z]);assert(objects.every(o=>o.material.name===name),'Wrong finish '+[x,z]+': '+objects.map(o=>o.material.name));};
material(-156.42,-7.53,'V2_public_hex_floor');
material(-144,-30,'Lounge_walkway_black_velvet');
material(-142,-28,'Lounge_walkway_black_velvet');
material(-145,-10,'Lounge_walkway_black_velvet');
material(-120,-21,'Lounge_walkway_black_velvet');
material(-90,-21,'Lounge_walkway_black_velvet');
for(const x of [-124.8,-110.3,-96.7])for(const z of [-23.4,-22.7,-21.1,-19.3,-18.4])material(x,z,'Lounge_walkway_black_velvet');
material(-87.9,-21,'V2_public_hex_floor');
material(-130,-3,'V2_public_hex_floor');
material(-136.5,-13.5,'V2_public_hex_floor');
material(plan.outer[0]+plan.strip/2,-7.53,'Lounge_walkway_gold_transition');
material(plan.outer[1]-plan.strip/2,-21,'Lounge_walkway_gold_transition');
material(-140,-plan.strip/2,'Lounge_walkway_gold_transition');
material(-130,plan.tile[2]-plan.strip/2,'Lounge_walkway_gold_transition');
material(-136.5,-11+plan.strip/2,'Lounge_walkway_gold_transition');
assert.equal(hit(-120,-10).length,0,'Atrium stays empty');assert.equal(hit(-120,-30).length,0,'Lounge opening stays empty');
const area=g=>{const p=g.attributes.position,ix=g.index;let total=0;for(let i=0;i<(ix?.count??p.count);i+=3){const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k));const n=v[1].sub(v[0]).cross(v[2].sub(v[0]));if(n.y>0)total+=n.y/2;}return total;};
const originalArea=sourceFloors.reduce((n,{o})=>n+area(o.geometry),0),finishedArea=finishes.reduce((n,o)=>n+area(o.geometry),0);console.log({originalArea,finishedArea,difference:finishedArea-originalArea});
assert(Math.abs(originalArea-finishedArea)<.002,'Partition must conserve top area');
const carpet=finishes.filter(o=>o.name==='V2_lounge_walkway_carpet'),gold=finishes.filter(o=>o.name==='V2_lounge_walkway_gold');assert(carpet.length&&gold.length);
for(const o of [...carpet,...gold]){assert.equal(o.userData.noCollide,true);const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)assert([32.302,32.310].some(y=>Math.abs(p.getY(i)-y)<.00001),'Finish stays at its original slab or corridor hex height');}
ray.ray.origin.set(-120,32.35,-21);const corridorHit=ray.intersectObjects(finishes)[0];assert.equal(corridorHit.object.material.name,'Lounge_walkway_black_velvet');assert(Math.abs(corridorHit.point.y-32.310)<.00001,'Carpet replaces the raised corridor finish at its existing height');
assert.equal(carpet[0].material.roughness,.96);assert.equal(carpet[0].material.metalness,0);assert.equal(carpet[0].material.map.image.width,128);assert.equal(gold[0].material.metalness,.55);
const velvet=carpet[0].material,map=velvet.map,json=velvet.toJSON({textures:{[map.uuid]:{uuid:map.uuid}},images:{}}),readBack=new T.MaterialLoader().setTextures({[json.map]:map}).parse(json);
assert(velvet.isMeshPhysicalMaterial&&velvet.color.r<.01&&velvet.sheen>0&&velvet.sheenRoughness>=.7,'Black carpet uses a soft grazing sheen');
assert.equal(readBack.sheen,velvet.sheen,'Prepared walk keeps the sheen');assert.equal(readBack.sheenColor.getHex(),velvet.sheenColor.getHex());assert.equal(readBack.map,velvet.map);
const pile=velvet.map.image.getContext('2d').getImageData(0,0,128,128).data;
for(const columns of [false,true]){
 const means=[];
 for(let a=0;a<128;a++){let sum=0;for(let b=0;b<128;b++)sum+=pile[(columns?b*128+a:a*128+b)*4];means.push(sum/128);}
 assert(Math.max(...means)-Math.min(...means)<17,'Fine pile has no large directional bands');
}
assert(new Set(pile.filter((_,i)=>i%4===0)).size>=32,'Fine pile varies within the texture');
const collision=new Colliders();collision.addStatic(root,solid);collision.commit();const collisionPositions=[...collision.bands.values()].map(b=>({b,positions:b.geometry.attributes.position.array.slice()}));
assert(retireLoungeWalkwayBacking(root,layout)>0,'Covered corridor backing must retire after collision');assert.equal(retireLoungeWalkwayBacking(root,layout),0,'Backing retirement must be idempotent');
const baked=bakeForWalking(root),bakedFinishes=[];for(const band of baked.bands.values())band.traverse(o=>{if(o.isMesh&&/^Lounge_walkway_/.test(o.material.name))bakedFinishes.push(o);});
for(const {b,positions}of collisionPositions)assert.deepEqual(b.geometry.attributes.position.array,positions,'Render retirement must preserve collision triangles');
const drawn=[...baked.bands.values()];for(const [x,z]of [[-142,-28],[-120,-21],[-90,-21],[-100,-19.3]]){ray.ray.origin.set(x,32.35,z);const top=ray.intersectObjects(drawn,true)[0];assert.equal(top?.object.material.name,'Lounge_walkway_black_velvet','The baked corridor backing must not protrude above the carpet at '+[x,z]);}
for(const name of ['Lounge_walkway_black_velvet','Lounge_walkway_gold_transition']){const parts=bakedFinishes.filter(o=>o.material.name===name);assert(parts.length,'Finish survives the public walk bake: '+name);for(const o of parts)assert(o.material.polygonOffset,'Depth bias survives material batching');}
// The pale lines are the two floor borders of the circulation run at z = -21.
function checkBorders(structure,plan){
 const trims=structure.children.filter(o=>o.name==='V2_public_finish_trim'&&o.userData.roomOwners.includes('circulation-'+plan.deck));
 const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,.025);
 const border=(x,z)=>{ray.ray.origin.set(x,plan.y+.035,z);return ray.intersectObjects(trims).length>0;};
 for(const z of [-20.4,-21.6])for(const x of [-142,-140,-137,-132,-128])assert(!border(x,z),'Floor border above the carpet '+[plan.deck,x,z]);
 for(const z of [-21.6,-18.1]){
  assert(!border(-90,z)&&!border(plan.outer[1]-plan.strip/2,z),'Floor border cannot cross the hall carpet or its gold edge');
  assert(border(-87.9,z),'The same floor border continues outside the carpet');
 }
 if(plan.deck===17)for(const z of [-20.4,-21.6])assert(border(-148,z),'Aft floor borders outside the carpet remain');
}
checkBorders(structure,plan);
const marks=launchDFitout(layout).parts.filter(p=>p.part==='street_wayfinding');
for(const number of [17,18,19]){
 const at=(x,z)=>marks.some(p=>p.deck===number&&p.at[0]===x&&p.at[2]===z);
 for(const x of [-122,-98]){
  assert(!at(x,-19.4),'Sage street dashes cannot sit on the carpet');
  assert(at(x,19.4),'Matching markings on the opposite promenade stay put');
 }
 assert(at(-82,-21.55),'The nearest street dash outside the carpet stays put');
}

for(const number of [17,18]){
 const root=new T.Group(),structure=new T.Group(),plan=loungeWalkwayPlan(layout,number),deck=layout.decks[number-1],y=deck.y;
 structure.name='V2_structure';root.add(structure);
 const put=(name,g)=>{const o=new T.Mesh(g,floor);o.name=name;o.userData.v2Deck=number;structure.add(o);return o;};
 const slab=put('Deck_slab',polygonGeometry(rect(-160,-80,-35,5),deck.slab.holes.map(h=>h.polygon),y)),positions=slab.geometry.attributes.position.array.slice();
 const corridorLayout={...layout,circulation:{...layout.circulation,corridors:layout.circulation.corridors.filter(c=>c.deck===number)}};
 buildCorridorFloors(structure,corridorLayout,roomHoles,holeBounds);
 const balcony=layout.circulation.balconies.find(b=>b.deck===number&&b.owner==='commons-1');
 if(balcony){
  const {x0,x1,z0,z1}=bounds(balcony.polygon),masks=[rect(-1000,x0,-1000,1000),rect(x1,1000,-1000,1000),rect(-1000,1000,-1000,z0),rect(-1000,1000,z1,1000)];
  put('V2_lounge_balcony_floor',polygonGeometry(deck.atrium.outline,[...masks,...deck.slab.holes.filter(h=>h.id!=='atrium').map(h=>h.polygon)],y));
  buildCommonsHallFinish(structure,layout);
 }
 applyPublicFinishKit({root,inside:root},layout,{decks:[number]});root.updateMatrixWorld(true);
 assert.deepEqual(slab.geometry.attributes.position.array,positions,'The deck slab stays intact');
 checkBorders(structure,plan);
 const finishes=[];root.traverse(o=>{if(o.isMesh&&/^(V2_public_floor_finish|V2_lounge_walkway_(carpet|gold)|V2_commons_hall_floor_finish)$/.test(o.name))finishes.push(o);});
 function finishAt(objects,x,z,recursive=false){ray.ray.origin.set(x,y+.05,z);return ray.intersectObjects(objects,recursive)[0];}
 function expectFinish(x,z,name){assert.equal(finishAt(finishes,x,z)?.object.material.name,name,'Wrong finish on Deck '+number+' at '+[x,z]);}
 for(const [x,z]of [[-146,-21],[-142,-28],[-145,-10],[-120,-21],[-90,-21]])assert.equal(finishAt(finishes,x,z)?.object.material,velvet,'Use the same velvet across the lobby and aquarium hall');
 for(const [x,z]of [[plan.outer[0]+plan.strip/2,-21],[plan.outer[1]-plan.strip/2,-21],[-136.5,-11+plan.strip/2]])expectFinish(x,z,'Lounge_walkway_gold_transition');
 for(const [x,z]of [[-149.15,-14.16],[-149.15,-21],[-130,-3],[-136.5,-13.5]])expectFinish(x,z,'V2_public_hex_floor');
 for(const [x,z]of [[-120,-10],[-134,-13.5],[-132,-6]])assert.equal(finishAt(finishes,x,z),undefined,'Keep the atrium, stair and lift openings clear');
 if(number===17){
  expectFinish(-120,-17.3,'Lounge_walkway_black_velvet');assert.equal(finishAt(finishes,-120,-16.7),undefined,'Finish ends at the balcony edge');
  const hall=finishAt(finishes,-120,-22.1);assert.equal(hall.object.material,velvet);assert(Math.abs(hall.point.y-y-.002)<.00001,'Deck 17 velvet follows the slab below the retired matte top');
  const matte=finishes.filter(o=>o.name==='V2_commons_hall_floor_finish');
  const seam=new T.Raycaster(new T.Vector3(-142,y+.013,-22),new T.Vector3(1,0,0),0,2);
  assert.equal(seam.intersectObjects(matte).length,0,'The raised matte side cannot show as a pale seam across the carpet');
  assert.equal(finishAt(finishes,-120,-30)?.object.material.name,'V2_public_hex_floor','No outer carpet inside the lounge');
  expectFinish(-87.9,-22.1,'Commons_hall_matte_floor');
 }else{
  assert.equal(finishAt(finishes,-120,-17.3),undefined,'Deck 18 keeps the narrower balcony edge');
  assert.equal(finishAt(finishes,-120,-30),undefined,'Upper lounge opening stays empty');
 }
 for(const o of finishes.filter(o=>o.name.startsWith('V2_lounge_walkway_')))assert(o.userData.noCollide,'Every finish is non-solid');
 const col=installGround(new Colliders(),new Colliders());col.addStatic(root,solid);col.commit();
 const walker=new Controller(col),speed=new T.Vector3(2.25,0,0);walker.place(new T.Vector3(-149.15,y,-21));
 for(const direction of [1,-1])for(let i=0;i<1200;i++){
  walker.step(1/120,speed.setX(direction*2.25));
  assert(walker.grounded&&Math.abs(walker.ground.point.y-y)<.02,'Ground support across the Deck '+number+' carpet route');
  if(i===1199)assert(direction===1?walker.position.x>-128:walker.position.x<plan.outer[0],'Cat walks into the hall and crosses back out');
 }
 assert(retireLoungeWalkwayBacking(root,layout)>0,'Covered corridor backing must retire on Deck '+number);
 const baked=bakeForWalking(root),drawn=[...baked.bands.values()];
 for(const [x,z]of [[-142,-28],[-120,-21],[-90,-21],[-137,-21.6]])assert.equal(finishAt(drawn,x,z,true)?.object.material,velvet,'The baked floor still shows velvet at '+[number,x,z]);
}
const source=f=>fs.readFileSync(f,'utf8').replaceAll('\r\n','\n').replaceAll('.authoring.js','.js');assert.equal(source('src/v2/finish-kit.js'),source('src/v2/finish-kit.authoring.js'),'Authoring and public finish producers must agree');
assert.equal(source('src/v2/render-bake.js'),source('src/v2/render-bake.authoring.js'),'Both bake producers must retire covered backing');
console.log('PASS: velvet, 65 mm transitions and clipped floor borders on Decks 17–19. Existing tile, landings, interior floors, voids and walking support are preserved.');

// Check the room-side infill with the real shell, finish, guards and cut bulkhead.
{
 const r=layout.rooms.find(r=>r.id==='commons-1'),end=r.components.galleries.find(g=>g.id==='commons-1-end-8');
 const copy={...r,components:structuredClone(r.components)};applyLoungeWalkwayExtension(copy);assert.deepEqual(copy.components,r.components);
 const xWall=SYNTHWAVE_MURAL.x,xJoin=-139,zDrop=-44.4435229,zEnd=-40.6935229,y=deck.y;
 const root=new T.Group(),ship={root,inside:root,cutaway:new Set()};buildRoomShell(ship,r,root);applyLoungeFloorFinish(ship);
 const proto=r.hullPrototype,parts=shellParts(proto,p=>worldPoint(proto.chart,p)),wall=mesh(root,'V2_prototype_garden_side_walls',parts.sides);
 cutChartMany(wall,sideGalleryDoorCuts(r));root.updateMatrixWorld(true);
 const slabs=root.getObjectsByProperty('name','V2_garden_gallery'),probe=new T.Raycaster(),cast=(at,dir,objects,far=.4)=>{probe.set(new T.Vector3(...at),new T.Vector3(...dir));probe.far=far;return probe.intersectObjects(objects);};
 const surface=(x,z)=>{
  for(const [level,sign] of [[y,-1],[y-end.size[1],1]]){
   const hits=cast([x,level-sign*.2,z],[0,sign,0],slabs);assert.equal(hits.length,1,'One continuous top or underside at '+[x,z]);
   assert(Math.abs(hits[0].point.y-level)<.00002);assert.equal(hits[0].object.material.name,'Lounge_velvet_carpet');
  }
 };
 for(const x of [xWall+.002,-140.3,-139.7,xJoin-.01,xJoin+.01])for(const z of [zDrop+.015,-43.2,-41.7,zEnd-.015,zEnd+.015])surface(x,z);
 for(const [x,z] of [[xWall-.002,-42.5],[-140,zDrop-.02],[-139.7,-48]])assert.equal(cast([x,y+.2,z],[0,-1,0],slabs).length,0,'Slab stops at the mural and the drop edge');
 for(const [name,height] of [['V2_garden_guard_glass',.6],['V2_garden_guard_cap',1.1],['Lounge_rail_glow',.04]]){
  const guard=root.getObjectsByProperty('name',name);assert(guard.length);
  if(name!=='V2_garden_guard_glass')assert.equal(guard[0].material.color.getHex(),0xff6b20);
  for(let x=xWall+.003;x<xJoin+.05;x+=.025)assert(cast([x,y+height,zDrop+.3],[0,0,-1],guard).length,'Continuous return guard '+name);
  for(let z=zDrop+.12;z<zEnd-.12;z+=.1)assert.equal(cast([xJoin+.28,y+height,z],[-1,0,0],guard,2.1).length,0,'The old edge and wall line have no guard '+name);
 }
 const collision=installGround(new Colliders(),new Colliders());collision.addStatic(root,solid);collision.commit();
 const start=new T.Vector3(-138.02,y,-40.31),yaw=217*Math.PI/180,walker=new Controller(collision);walker.place(start);
 const walk=(direction,seconds)=>{for(let i=0;i<Math.round(60*seconds);i++){walker.step(1/60,direction);assert(walker.grounded&&Math.abs(walker.position.y-y)<.00002,'Reported route stays at Deck 19 height');}};
 walk(new T.Vector3(Math.sin(yaw),0,Math.cos(yaw)).multiplyScalar(2.25),2.2);
 assert(Math.abs(walker.position.x-xWall-walker.body.radius)<.02&&walker.position.distanceTo(start)>4,'Cross the old guard line to the mural without clipping the camera');
 walk(new T.Vector3(-2.25,0,0),.35);const stopped=walker.position.clone();walk(new T.Vector3(-2.25,0,0),.4);assert(walker.position.distanceTo(stopped)<.01,'The wall stops further travel');
 walk(start.clone().sub(stopped).setY(0).normalize().multiplyScalar(2.25),2);assert(walker.position.distanceTo(start)<.4,'Turn and walk back to the starting spot');
 const baked=[...bakeForWalking(root).bands.values()].flatMap(b=>b.getObjectsByProperty('isMesh',true));
 for(const [level,sign] of [[y,-1],[y-end.size[1],1]])for(const x of [-140.55,-139.03,-138.97]){
  const face=cast([x,level-sign*.2,-42.2],[0,sign,0],baked)[0];assert.equal(face?.object.material.name,'Lounge_velvet_carpet');assert(Math.abs(face.point.y-level)<.00002,'The walk bake keeps both sides flush across the joint');
 }
 console.log('PASS Deck 19 mural infill: flush carpet and underside, joined orange glass guard, solid wall and level round trip');
}
