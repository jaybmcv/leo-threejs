import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Box3,Vector3,Raycaster} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createVoyageForum,VOYAGE_FORUM} from '../src/voyage-forum.js';
import {insideHull,logicalX} from '../src/model.js';
import {finishedRoofY} from '../src/exterior-profile.js';
const source=createVoyageForum(),cache=new Map();source.root.updateMatrixWorld(true);let vertices=0,samples=0;
source.root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
 const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),k=v.x.toFixed(4)+','+v.z.toFixed(4);vertices++;
 assert(insideHull(v.x,v.y,v.z,2.5),o.name+' outside hull '+v.toArray());if(!cache.has(k))cache.set(k,finishedRoofY(logicalX(v.x),v.z));assert(v.y<=cache.get(k)+.001,o.name+' above roof');
 assert(v.y>=20.275&&v.y<=23.8,o.name+' outside deck height');
}});
const b=await fs.readFile('output/leo-interior-v01/leo-full-ship.glb'),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;});g.scene.updateMatrixWorld(true);
const inside=g.scene.getObjectByName('Fitted_ship_interior'),forum=inside.getObjectByName('Area_'+VOYAGE_FORUM.id),geometry=[];assert(forum);
inside.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)geometry.push({o,b:new Box3().setFromObject(o)});});
let seats=0,bays=0;forum.traverse(o=>{if(o.name==='Forum_audience_seat')seats++;if(o.name==='Open_mobility_space')bays++;});assert.equal(seats,120);assert.equal(bays,4);
const ramp=forum.getObjectByName('Forum_stage_ramp');assert(ramp);const rampSize=new Box3().setFromObject(ramp).getSize(new Vector3());assert(Math.abs(rampSize.x-5)<.001&&Math.abs(rampSize.y-.25)<.001&&Math.abs(rampSize.z-2)<.001,'Saved ramp dimensions');
const ray=new Raycaster(),up=new Vector3(0,1,0),down=new Vector3(0,-1,0);
function probe(x,y,z){const near=geometry.filter(({b})=>x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z&&b.max.y>y-.1&&b.min.y<y+2.2).map(v=>v.o);
 ray.set(new Vector3(x,y+.03,z),up);ray.far=2.07;const hit=ray.intersectObjects(near)[0];assert(!hit,'Headroom blocked by '+hit?.object.name+' at '+[x,y,z]);
 ray.set(new Vector3(x,y+.15,z),down);ray.far=.18;assert(ray.intersectObjects(near).length,'Missing floor '+[x,y,z]);samples++;
}
function walk(a,b){const start=new Vector3(...a),end=new Vector3(...b),delta=end.clone().sub(start),length=delta.length();
 for(const h of [.35,1,1.7]){const va=start.clone().addScaledVector(up,h),vb=end.clone().addScaledVector(up,h),bounds=new Box3().setFromPoints([va,vb]);ray.set(va,delta.clone().normalize());ray.far=length;const hit=ray.intersectObjects(geometry.filter(v=>v.b.intersectsBox(bounds)).map(v=>v.o))[0];assert(!hit,'Aisle blocked by '+hit?.object.name);}
 for(let i=0;i<=Math.ceil(length*2);i++){const v=start.clone().lerp(end,i/Math.ceil(length*2));probe(v.x,v.y,v.z);}
}
for(const z of [-1.4,0,1.4])walk([132,20.3,z],[196,20.3,z]);
for(const z of [-15,-14,14,15])walk([164,20.3,z],[192,20.3,z]);
for(const x of [164,192])walk([x,20.3,-15],[x,20.3,15]);
for(const s of [-1,1])for(const z of [4.5,8])walk([167,20.3,0],[167,20.3,s*z]);
for(const z of [8.2,9,9.8])walk([193,20.3,z],[198,20.55,z]);
walk([198.2,20.55,9],[198.2,20.55,0]);walk([198.2,20.55,0],[203,20.55,0]);
const result={status:'PASS',modeledAudienceSeats:seats,openMobilitySpaces:bays,geometryVertices:vertices,routeSamples:samples,stageRise:.25,rampRun:5,rampWidth:2,scope:'Saved forum seating counts, source hull/deck fit, clear foyer and audience aisles, and continuous ramp/stage access with floor support and 2.1 m headroom. Not an event-capacity certification.'};
await fs.writeFile('output/leo-interior-v01/voyage-forum-fit.json',JSON.stringify(result,null,2));console.log(result);
