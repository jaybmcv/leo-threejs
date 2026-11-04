import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import layout from '../src/plan/selected-layout.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {SHIP_AREAS,createShipArea} from '../src/areas.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {applyRoomFitoutOverrides} from '../src/v2/room-fitout-overrides.js';
import {fitoutGeometry,material} from '../src/v2/phase4-mesh-kit.js';
import {Colliders,BODY,solid} from '../src/walk/collision.js';
import {stripAtmosphere,createAtmosphere,atmosphereReadings,ATMOSPHERE_PORTS} from '../src/walk/atmosphere.js';

installWalkCanvas(createCanvas);
const id='d04-air-1',built=createShipArea(SHIP_AREAS.find(a=>a.id===id)),root=new T.Group(),structure=new T.Group();root.add(built.root,structure);
const ship={root,inside:root,cutaway:new Set([built.shell])};buildRoomShell(ship,layout.rooms.find(r=>r.id===id),structure);
const room=ship.root.getObjectByName('Area_'+id),floor=room.getObjectByName('Finished_floor'),title=room.getObjectByName('Area_identity_panel');
assert(stripAtmosphere(ship));assert.equal(room.getObjectByName('Finished_floor'),floor);assert.equal(room.getObjectByName('Area_identity_panel'),title);
for(const name of ['Air_handling_unit','Chair','Worktop','Display','Service_pipe'])assert.equal(room.getObjectByName(name),undefined);
const data=applyRoomFitoutOverrides({parts:[],rests:[],rooms:[]},layout),parts=data.parts.filter(p=>p.room===id),furniture=new T.Group();
assert.equal(parts.filter(p=>/^atmosphere_(intake|humidity|co2|hepa)$/.test(p.part)).length,8);
for(const p of parts){const o=new T.Mesh(fitoutGeometry(p),material(p.mat));o.name=p.part;o.position.set(...p.at);o.rotation.y=p.yaw;o.userData.noCollide=!!p.noCollide;furniture.add(o);}
ship.root.add(furniture);ship.root.updateMatrixWorld(true);
const plant=createAtmosphere(ship),col=new Colliders();col.addStatic(ship.root,solid);col.addStatic(plant.solid,()=>true);col.commit();
const p=new T.Vector3(),seg=new T.Line3(),ray=new T.Ray(),R=BODY.radius;
let probes=0;
function clear(x,z){room.localToWorld(p.set(x,0,z));seg.start.copy(p).add(new T.Vector3(0,BODY.step+R,0));seg.end.copy(p).add(new T.Vector3(0,BODY.height-R,0));assert(!col.overlaps(seg,R),'Blocked maintenance route '+[x,z]);ray.origin.copy(p).add(new T.Vector3(0,.3,0));ray.direction.set(0,-1,0);assert(col.raycast(ray,.5),'Missing room floor '+[x,z]);probes++;}
for(let z=0;z<=16;z+=.35)clear(0,z);
for(let x=-24;x<=21;x+=.35){clear(x,7.8);clear(x,-7.8);clear(x,16);clear(x,-16);}
for(const x of [-23,-11.5,-.5,10.5])for(let z=7.8;z<=16;z+=.35){clear(x,z);clear(x,-z);}
for(let z=-16;z<=16;z+=.35)clear(21.3,z);
// Every new mesh stays inside the unchanged room and below its ceiling.
const inverse=room.matrixWorld.clone().invert(),bounds=new T.Box3();
for(const root of [furniture,plant.group,plant.solid]){root.updateMatrixWorld(true,true);root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));g.computeBoundingBox();bounds.union(g.boundingBox);g.dispose();});}
assert(bounds.min.x>=-25.8401&&bounds.max.x<=25.8401,JSON.stringify(bounds));assert(bounds.min.z>=-16.8401&&bounds.max.z<=16.8401,JSON.stringify(bounds));assert(bounds.min.y>=-.001&&bounds.max.y<=3.3,JSON.stringify(bounds));
for(const port of ATMOSPHERE_PORTS){assert(Math.abs(port[0])>2&&port[2]===16.84);}
const screen=plant.group.getObjectByName('Atmosphere_illustrative_monitor'),version=screen.material.map.version;
plant.update(2,room.localToWorld(new T.Vector3(0,0,0)));assert(screen.material.map.version>version);
const frozen=createAtmosphere(ship,{still:true}),frozenScreen=frozen.group.getObjectByName('Atmosphere_illustrative_monitor'),v=frozenScreen.material.map.version;
frozen.update(10,p);assert.equal(frozenScreen.material.map.version,v);
for(let t=0;t<=3600;t+=2){const v=atmosphereReadings(t);assert(v.pressure>14.66&&v.pressure<14.70);assert(Math.abs(v.o2+v.n2-99.3)<1e-9);}
await fs.mkdir('output/issue-174',{recursive:true});await fs.writeFile('output/issue-174/monitor.png',screen.material.map.image.toBuffer('image/png'));
console.log('PASS: eight units; original floor/title retained;',probes,'capsule/floor probes; room bounds; doorway ports; animated and reduced-motion display');
