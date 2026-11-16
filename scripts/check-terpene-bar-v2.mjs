import assert from 'node:assert/strict';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {createGardenCommons} from '../src/model.js';
import {resolveRoomFrames} from '../src/plan/rooms.js';
import {Colliders,solid} from '../src/walk/collision.js';
import {createTerpeneGlassware} from '../src/terpene-glassware.js';
import {Controller} from '../src/walk/controller.js';
import {findRestSpots,solidSpots} from '../src/walk/rest.js';
import {COSMO_HEIGHT} from '../src/cosmo-pose.js';
import layout from '../src/plan/selected-layout.js';
import {buildRoomShell} from '../src/v2/room-shell.js';

// Exercise the actual lounge furniture with the visitor's capsule, without a browser.
installWalkCanvas(createCanvas);
const root=new T.Group(),source=createGardenCommons(1);root.add(source.root);resolveRoomFrames(root);
const structure=new T.Group();root.add(structure);buildRoomShell({root,inside:root,cutaway:new Set()},layout.rooms.find(r=>r.id==='commons-1'),structure);root.updateMatrixWorld(true);
const lounge=source.root.getObjectByName('Hydro_Nip_Lounge'),stone=lounge.getObjectByName('Lounge_bar_stone'),front=lounge.getObjectByName('Lounge_bar_front');
assert(stone&&front,'Stone top and bowed front exist');
const bounds=o=>new T.Box3().setFromObject(o,true),top=bounds(stone),body=bounds(front),close=(a,b)=>assert(Math.abs(a-b)<.005,`${a} != ${b}`);
close(top.max.y,25.38);close(body.max.y,25.32);close(top.min.x,body.min.x-.1);close(top.max.x,body.max.x+.1);
assert(stone.material.roughness<=.2&&stone.material.map?.image.data.length===128*128*4,'Glossy stone retains its procedural texture');
const meta={textures:{},images:{}};stone.material.toJSON(meta);const loader=new T.ObjectLoader(),images=await loader.parseImagesAsync(Object.values(meta.images)),maps=loader.parseTextures(Object.values(meta.textures),images);
assert(Object.values(maps).some(t=>t.isDataTexture&&t.image.data.length===128*128*4),'Prepared texture round trip keeps stone veining');
// Both amber rims must remain below the gallery and in front of the dark sign band.
const neon=lounge.getObjectByName('Lounge_neon_glow'),np=neon.geometry.attributes.position,nc=neon.geometry.attributes.color,opaque=[];
root.traverse(o=>{if(o.isMesh&&!o.material.transparent&&o!==neon)opaque.push(o);});
const eye=new T.Vector3(-124.28,24.3+COSMO_HEIGHT*.93,-46.19),sight=new T.Raycaster(),rims=[0,0];
for(let i=0;i<np.count;i+=3){if(nc.getZ(i)>.3||nc.getX(i)<.9)continue;
 const p=new T.Vector3().fromBufferAttribute(np,i).add(new T.Vector3().fromBufferAttribute(np,i+1)).add(new T.Vector3().fromBufferAttribute(np,i+2)).multiplyScalar(1/3).applyMatrix4(neon.matrixWorld),rim=[27.025,27.875].findIndex(y=>Math.abs(p.y-y)<.03);
 if(rim<0||p.x<-127.81||p.x>-121.19||p.z<-53.7||p.z>-53.2)continue;
 const d=p.clone().sub(eye);sight.set(eye,d.clone().normalize());sight.far=d.length()-.005;
 const hit=sight.intersectObjects(opaque,false)[0];assert(!hit,'Amber rim is hidden by '+hit?.object.name+' at '+p.toArray());rims[rim]++;
}
assert(rims.every(n=>n>100),'Both complete amber rims face the reported view');
// Glassware is shared decoration; none of it can become a step or a new collider.
const display=lounge.getObjectByName('Terpene_glassware');assert(display,'Glassware replaces the old icon display');
const glassware=createTerpeneGlassware(),all=glassware.vessels.flat(),shelf=all.filter(v=>v.kind==='shelf'),vials=all.filter(v=>v.kind==='vial');
assert.equal(shelf.length,42);assert.equal(vials.length,25);assert.equal(new Set(shelf.map(v=>v.at[1])).size,3);
assert(glassware.vessels.every(v=>v.some(i=>i.kind==='shelf')),'All four volumetric bottle shapes appear on the shelves');
display.traverse(o=>{if(o.isMesh)assert(!solid(o),'Glassware must never add collision: '+o.name);});
let displayDraws=0,displayTriangles=0;display.traverse(o=>{assert(!o.isLight,'The display adds no room lights');if(o.isMesh){displayDraws++;displayTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
assert(displayDraws<=24&&displayTriangles<30000,'Shared glassware stays inside its modest phone geometry budget');
const bottleGlass=display.children.filter(o=>/^Terpene_bottle_glass_/.test(o.name));
assert.equal(bottleGlass.length,4);assert.equal(bottleGlass.reduce((n,o)=>n+o.count,0),67);
for(const o of bottleGlass){assert(o.isInstancedMesh&&o.geometry.parameters.segments===12,'Bottle shells use modest shared lathe geometry');assert(o.material.transparent&&!o.material.depthWrite&&o.material.side===T.FrontSide&&o.material.roughness<.1&&o.material.envMapIntensity>1,'Glossy single-surface glass preserves the environment without writing depth');}
const instance=new T.Matrix4(),bb=new T.Box3();
for(const o of bottleGlass){o.geometry.computeBoundingBox();for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);bb.copy(o.geometry.boundingBox).applyMatrix4(instance);assert(bb.max.z<37.675,'Shelf bottles stay in front of the dark back panel');}}
const racks=display.getObjectByName('Terpene_tasting_racks'),strips=display.getObjectByName('Terpene_shelf_strips');assert.equal(racks.count,15);assert.equal(strips.count,3);
assert(bounds(display.getObjectByName('Terpene_stoppers')).max.y<27.025,'Every shelf stopper remains below the sign rim');
for(let k=0;k<5;k++){racks.getMatrixAt(k*3,instance);close(instance.elements[12],118.5+k*1.8);close(instance.elements[13]-.025,25.38);close(instance.elements[14],35.95);}
const stillMeshes=glassware.group.children.filter(o=>/^Terpene_(still_|collecting_|collected_|collector_)/.test(o.name)),stillBounds=new T.Box3();for(const o of stillMeshes)stillBounds.union(bounds(o));
assert(stillBounds.max.x-stillBounds.min.x<1.5&&stillBounds.min.y>=25.379&&stillBounds.max.y<26.9,'Still fits behind the counter, below all sign lettering');
assert(glassware.brew.material.transparent&&!glassware.brew.material.depthWrite&&glassware.brew.renderOrder<glassware.bubbles.renderOrder&&glassware.bubbles.renderOrder<glassware.group.getObjectByName('Terpene_still_globe').renderOrder,'Brew, bubbles and shell have explicit interior-to-exterior order');
const bubbleBefore=Array.from(glassware.bubbles.instanceMatrix.array),brewBefore=glassware.brew.scale.y,collectBefore=glassware.collected.material.color.getHex();
glassware.update(2);assert.equal(glassware.time,2);assert.notDeepEqual(Array.from(glassware.bubbles.instanceMatrix.array),bubbleBefore);assert.notEqual(glassware.brew.scale.y,brewBefore);assert.notEqual(glassware.collected.material.color.getHex(),collectBefore);
const restored=new T.ObjectLoader().parse(glassware.group.toJSON());assert.equal(restored.getObjectByName('Terpene_stoppers').count,67,'Glassware retains its instancing in exported scene data');
console.log('PASS 42 instanced shelf bottles, five supported vial racks, bounded glass still, nested transparency and local liquid/bubble animation');
const chairs=lounge.children.filter(o=>o.name==='Seat'&&o.material.name==='Lounge_bar_upholstery'),backs=lounge.children.filter(o=>o.name==='Seat_back');
assert.equal(chairs.length,6);assert.equal(backs.length,6);
assert(chairs.every(o=>o.geometry===chairs[0].geometry&&o.material===chairs[0].material),'Chairs share seat geometry and material');
assert(backs.every(o=>o.geometry===backs[0].geometry&&o.material===chairs[0].material),'Chairs share wrap-around backs');
const bar=new Colliders();bar.addStatic(front);bar.addStatic(stone);bar.commit();
const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1)),face=x=>{ray.origin.set(x,24.9,-48);const hit=bar.raycast(ray,12);assert(hit,'Counter stops the approach');return hit.point.z;},cx=(top.min.x+top.max.x)/2;
assert(face(cx)>face(cx-3)+.15&&face(cx)>face(cx+3)+.15,'Collision follows the bowed front');
assert(top.max.z-body.max.z>.095&&top.max.z-body.max.z<.105,'Top overhang follows the bow');
assert(top.max.z-(body.min.z+1)<=.5,'Counter extends no more than half a metre toward the floor');

// The full layout check guards the room's routes; this floor supplies the same Deck 17 datum locally.
const floor=new T.Mesh(new T.BoxGeometry(53,.24,38.4),new T.MeshBasicMaterial());floor.position.set(-114.5,24.18,-43.2);root.add(floor);root.updateMatrixWorld(true);
const col=new Colliders();col.addStatic(root);col.commit();
const spots=solidSpots(findRestSpots(root),col),centres=chairs.map(o=>bounds(o).getCenter(new T.Vector3()));
for(const c of centres){const s=spots.find(s=>s.kind==='sit'&&s.point.distanceTo(c.clone().setY(25.1))<.01);assert(s,'Chair keeps its supported sitting anchor');assert(s.facing?.z<-.95,'Chair faces the counter');}
const walker=new Controller(col),walk=(wish,seconds)=>{for(let i=0;i<seconds*60;i++)walker.step(1/60,new T.Vector3(...wish),false);return walker.position.clone();};
walker.place(new T.Vector3(-124.28,24.3,-46.19));
const yaw=181*Math.PI/180,stop=walk([Math.sin(yaw)*2.25,0,Math.cos(yaw)*2.25],4);
console.log('Counter bounds',JSON.stringify({top:[top.min.toArray(),top.max.toArray()],body:[body.min.toArray(),body.max.toArray()],chairs:centres.map(p=>p.toArray()),stop:stop.toArray()}));
assert(stop.z>body.max.z&&stop.z<body.max.z+.6&&Math.abs(stop.y-24.3)<.05,'Visitor stops at the counter between chairs');
const held=walk([Math.sin(yaw)*2.25,0,Math.cos(yaw)*2.25],1);assert(held.distanceTo(stop)<.12,'Holding forward cannot pass through the counter');
// Back off the chairs, cross the open floor, then pass the rounded end and return.
walk([0,0,2.25],.75);const aside=walk([2.25,0,0],3.2);assert(aside.x>top.max.x+.6,'Walk sideways beyond the end');
const end=walk([0,0,-2.25],1.8);console.log('End route',JSON.stringify({aside:aside.toArray(),end:end.toArray()}));assert(end.z<top.min.z&&end.x>top.max.x+.5,'Walk around the end without getting stuck');
const away=walk([0,0,2.25],3);assert(away.z>-48&&Math.abs(away.y-24.3)<.05,'Walk away across the lounge');
console.log('PASS bowed counter collision, unchanged seat heights, shared chairs, end clearance and walk away');
