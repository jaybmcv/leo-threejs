import assert from 'node:assert/strict';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import layout from '../src/plan/selected-layout.js';
import {SHIP_AREAS,createShipArea} from '../src/areas.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {polygonGeometry} from '../src/v2/geometry.js';
import {moveRoomFitoutMeshes} from '../src/v2/room-fitout-overrides.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {stripCargoMaintenance,createMctBay,SERVICE_BAYS} from '../src/walk/mct-bay.js';
import {Colliders,BODY,solid} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';

const words=[];installWalkCanvas((w,h)=>{const c=createCanvas(w,h),g=c.getContext('2d'),draw=g.fillText.bind(g);g.fillText=(s,...args)=>{words.push(s);return draw(s,...args);};return c;});
const id='d01-workshop-5',r=layout.rooms.find(r=>r.id===id),built=createShipArea(SHIP_AREAS.find(a=>a.id===id)),room=built.root;
const root=new T.Group(),structure=new T.Group();root.add(room,structure);const ship={root,inside:root,cutaway:new Set([built.shell])};
// Record all merged detail triangles, including those belonging to the other cabinets.
function detailTriangles(){const out=[];room.traverse(o=>{if(!/^(Refined_cabinet_hardware|Refined_display_graphics|Polish_instrument_bezel)$/.test(o.name))return;const g=o.geometry,p=g.attributes.position,n=g.index?.count??p.count;
 for(let i=0;i<n;i+=3){const points=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,g.index?g.index.getX(i+k):i+k).applyMatrix4(o.matrix));out.push({key:o.name+'|'+points.flatMap(p=>p.toArray()).join(','),removed:points.every(p=>p.x>.8&&p.x<3.2&&p.y>-.02&&p.y<2.62&&p.z>-15.6&&p.z<-14.35)});}});return out;}
const before=detailTriangles();assert(before.some(t=>t.removed),'Cabinet detail fixture is present');
buildRoomShell(ship,r,structure);
const after=detailTriangles();assert(!after.some(t=>t.removed),'No floating hardware or screen remains at the doorway');
assert.deepEqual(after.map(t=>t.key),before.filter(t=>!t.removed).map(t=>t.key),'Other cabinets keep every detail triangle');
const cabinets=[];room.traverse(o=>{if(o.name==='Equipment_cabinet')cabinets.push(o.position.x);});assert.deepEqual(cabinets,[-12,-5,9,16]);
moveRoomFitoutMeshes(room,id);assert.deepEqual(detailTriangles(),after,'Removal is idempotent');
assert(stripCargoMaintenance(ship));const bay=createMctBay(ship);assert(bay);root.add(bay.group);root.updateMatrixWorld(true);
assert.deepEqual(SERVICE_BAYS,[-11.5,-4.5,9.5,16.5]);
assert.equal(bay.group.children.filter(o=>/^MCT_\d\d$/.test(o.name)).length,4,'Four parked service displays');
assert.equal(words.filter(s=>s==='SERVICE').length,4,'Four service sign strips');for(let n=1;n<=4;n++)assert(words.includes('SERVICE '+n));assert(words.includes('▶ SERVICE 1–4'));
// Include the selected deck slab, which supports the unchanged doorway's corridor side.
const slab=layout.decks[0].slab;root.add(new T.Mesh(polygonGeometry(slab.outline,slab.holes.map(h=>h.polygon),r.y)));
const col=new Colliders();col.addStatic(root,solid);col.addStatic(bay.solid,()=>true);col.commit();
const seg=new T.Line3(),p=new T.Vector3(),ray=new T.Ray(),up=new T.Vector3(0,1,0);let probes=0;
function clear(x,z){room.localToWorld(p.set(x,0,z));seg.start.copy(p).addScaledVector(up,BODY.step+BODY.radius);seg.end.copy(p).addScaledVector(up,BODY.height-BODY.radius);assert(!col.overlaps(seg,BODY.radius),'Blocked route '+[x,z]);ray.origin.copy(p).addScaledVector(up,.3);ray.direction.set(0,-1,0);assert(col.raycast(ray,.5),'Missing floor '+[x,z]);probes++;}
// Cross the old cabinet footprint and the unchanged doorway in both directions.
for(let z=-18;z<=-1;z+=.2)clear(1.3,z);
for(const xc of SERVICE_BAYS.slice(2)){
 for(let z=-13.5;z<=0;z+=.2){clear(xc-2.4,z);clear(xc+2.9,z);}
 for(let x=xc-2.4;x<=xc+2.9;x+=.2){clear(x,-12.8);clear(x,-7.5);}
 // The vehicle and gear have real collision; a visitor cannot walk inside either.
 for(const [x,z] of [[xc,-10.45],[xc+(xc===SERVICE_BAYS[2]?1.95:2.25),xc===SERVICE_BAYS[2]?-9.9:-13.5]]){
  room.localToWorld(p.set(x,0,z));seg.start.copy(p).addScaledVector(up,BODY.step+BODY.radius);seg.end.copy(p).addScaledVector(up,BODY.height-BODY.radius);assert(col.overlaps(seg,BODY.radius),'Service vehicle/gear must be solid '+[x,z]);
 }
}
for(let x=-24;x<=24;x+=.2)for(const z of [-1,0,1])clear(x,z);
// Exercise the floating capsule through the freed cabinet, then back into the room.
const controller=new Controller(col);controller.place(room.localToWorld(new T.Vector3(1.3,0,-12)));
for(let i=0;i<360;i++)controller.step(1/120,new T.Vector3(0,0,-2.25));assert(controller.position.z<r.door.center[2]-.5,'Walk out through the cabinet footprint');
for(let i=0;i<360;i++)controller.step(1/120,new T.Vector3(0,0,2.25));assert(controller.position.z>r.door.center[2]+4,'Walk back into Cargo maintenance');
console.log('PASS Cargo maintenance: four fitted service bays, cabinet and merged details removed, '+probes+' clear floor probes, solid vehicles/gear and two-way capsule crossing.');
