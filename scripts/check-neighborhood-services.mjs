import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Vector3,Box3,Raycaster} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SUPPORT_AREAS,createSupportArea,createSupportCirculation} from '../src/neighborhood-services.js';
import {insideHull,logicalX} from '../src/model.js';
import {finishedRoofY} from '../src/exterior-profile.js';
const roofCache=new Map(),roof=(x,z)=>{const k=x.toFixed(4)+','+z.toFixed(4);if(!roofCache.has(k))roofCache.set(k,finishedRoofY(logicalX(x),z));return roofCache.get(k);};
let vertices=0,routeSamples=0;const evidence=[];
const required={laundry:'Laundry_round_door',parcels:'Parcel_locker_door',repair:'Sewing_machine',library:'Shared_equipment_trolley'};
function fits(root){root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
 const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);vertices++;
 assert(insideHull(v.x,v.y,v.z,2.5),o.name+' outside hull '+v.toArray());assert(v.y<=roof(v.x,v.z)+.001,o.name+' above finished roof');
 }});}
for(const a of SUPPORT_AREAS){
 const room=createSupportArea(a);fits(room.root);const b=new Box3().setFromObject(room.root),[x,y,z]=a.center;
 // Shared wall trims project 7 mm beyond the lining face.
 assert(b.min.x>=x-40.01&&b.max.x<=x+40.01&&b.min.z>=z-10.01&&b.max.z<=z+10.01,a.id+' exceeds room boundary');
 assert(b.min.y>=y-.025&&b.max.y<=y+3.5,a.id+' exceeds deck height');
 assert(room.root.getObjectByName(required[a.service]),a.id+' missing defining equipment');
 assert.equal(room.root.userData.polish.revision,2);
 evidence.push({id:a.id,deck:a.deck,service:a.service,fixture:required[a.service]});
}
for(const d of [14,15])fits(createSupportCirculation(d).root);
const bytes=await fs.readFile('output/leo-interior-v01/leo-full-ship.glb'),g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;});g.scene.updateMatrixWorld(true);
const inside=g.scene.getObjectByName('Fitted_ship_interior'),geometry=[];
inside.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)geometry.push({o,b:new Box3().setFromObject(o)});});
for(const a of SUPPORT_AREAS)assert(inside.getObjectByName('Area_'+a.id),'Missing saved room '+a.id);
const ray=new Raycaster(),up=new Vector3(0,1,0),down=new Vector3(0,-1,0);
function route(a,b,y){const length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let i=0;i<=Math.ceil(length*2);i++){
 const t=i/Math.max(1,Math.ceil(length*2)),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
 const near=geometry.filter(({b})=>x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z&&b.min.y<y+2.2&&b.max.y>y-.1).map(r=>r.o);
 ray.set(new Vector3(x,y+.03,z),up);ray.far=2.07;const hit=ray.intersectObjects(near)[0];assert(!hit,'Blocked assembled route '+hit?.object.name+' at '+[x,y,z]);
 ray.set(new Vector3(x,y+.15,z),down);ray.far=.19;assert(ray.intersectObjects(near).length,'Missing route floor '+[x,y,z]);routeSamples++;
}}
for(const d of [14,15]){
 const y=-39.7+(d-1)*4;
 for(const z of [-1.5,0,1.5])route([-132,z],[-258,z],y);
 for(const a of SUPPORT_AREAS.filter(a=>a.deck===d)){
  for(const dx of [-1.4,0,1.4])route([a.entryX+dx,0],[a.entryX+dx,a.center[2]],y);
  for(const dz of [-1.5,0,1.5])route([-258,a.center[2]+dz],[-184,a.center[2]+dz],y);
 }
}
const result={status:'PASS',rooms:4,verticesChecked:vertices,assembledRouteSamples:routeSamples,evidence,scope:'Source room containment and fixtures; saved combined-ship approach, doorway and room-spine floor support and 2.1 m headroom. Does not size laundry throughput or certify occupancy.'};
await fs.writeFile('output/leo-interior-v01/neighborhood-services-fit.json',JSON.stringify(result,null,2));console.log(result);
