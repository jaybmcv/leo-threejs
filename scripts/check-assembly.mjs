import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {Vector3,Raycaster,Box3} from 'three';
import {TRANSIT_CORES,floorY} from '../src/transit.js';import {COMMONS,logicalX} from '../src/model.js';import {finishedRoofY} from '../src/exterior-profile.js';
const b=await fs.readFile('output/leo-interior-v01/leo-full-ship.glb'),gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const counts={cabins:0,gardens:0,areas:0,lifeboats:0,seats:0,shuttles:0,structuralDecks:0,lounge:0,reservations:0};let interior=null;
gltf.scene.traverse(o=>{const a=gltf.parser.associations.get(o);if(a?.nodes!==undefined)o.name=gltf.parser.json.nodes[a.nodes].name||o.name;if(o.name==='Fitted_ship_interior')interior=o;
 if(o.name==='Cabin_24m2_floor')counts.cabins++;if(o.name==='Repeated_Cabin_24m2_floor')counts.cabins+=o.count;
 if(/^Fitted_garden_commons_/.test(o.name))counts.gardens++;if(/^Area_d\d{2}-/.test(o.name))counts.areas++;
 if(o.name==='Lifeboat_floor')counts.lifeboats++;if(o.name==='Evacuation_seat')counts.seats+=o.count;if(o.name==='Transfer_shuttle')counts.shuttles++;
 if(o.name==='Deck_slab')counts.structuralDecks++;if(o.name==='Observation_lounge')counts.lounge++;
 if(/space_reservations|twin_cabin_envelopes|Lift_and_transit_reservations|Ten_commons_reservations/.test(o.name))counts.reservations++;
});
assert.deepEqual(counts,{cabins:5000,gardens:10,areas:74,lifeboats:100,seats:10000,shuttles:4,structuralDecks:20,lounge:1,reservations:0});
interior.updateMatrixWorld(true);const slabs=[],geometry=[];interior.traverse(o=>{if(o.name==='Deck_slab')slabs.push(o);if(o.isMesh&&!o.isInstancedMesh)geometry.push({o,box:new Box3().setFromObject(o)});});
let slabSamples=0;const roofCache=new Map();
for(const o of slabs){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),k=v.x.toFixed(4)+','+v.z.toFixed(4);if(!roofCache.has(k))roofCache.set(k,finishedRoofY(logicalX(v.x),v.z));assert.ok(v.y<=roofCache.get(k)+.001,'Structural slab above roof '+v.toArray());slabSamples++;}}
const ray=new Raycaster(),up=new Vector3(0,1,0);let checks=0,minHeadroom=Infinity;
for(const c of TRANSIT_CORES)for(let d=1;d<c.lastDeck;d++)for(const s of [-1,1]){
 const y=floorY(d),x=c.stairX,z=s*c.stairZ,points=[[x+3.5,y+2,z]];
 for(let i=0;i<12;i++)points.push([x-2.5+(i+.5)*5/12,y+(i+1)/6,z-1.4],[x+2.5-(i+.5)*5/12,y+2+(i+1)/6,z+1.4]);
 for(const p of points){const origin=new Vector3(p[0],p[1]+.03,p[2]);const nearby=geometry.filter(({box:b})=>b.min.x<=p[0]&&b.max.x>=p[0]&&b.min.z<=p[2]&&b.max.z>=p[2]&&b.max.y>origin.y&&b.min.y<origin.y+2.1).map(v=>v.o);ray.set(origin,up);ray.far=2.07;const hit=ray.intersectObjects(nearby)[0];assert.ok(!hit,'Assembled stair obstruction '+hit?.object.name+' at '+p);checks++;}
}
let passageChecks=0,passageFloorChecks=0;
function clearPassage(a,b){const va=new Vector3(...a),vb=new Vector3(...b),dir=vb.clone().sub(va),len=dir.length();ray.set(va,dir.normalize());ray.far=len;
 const bounds=new Box3().setFromPoints([va,vb]);const nearby=geometry.filter(({box:b})=>b.intersectsBox(bounds)).map(v=>v.o);const hit=ray.intersectObjects(nearby)[0];assert.ok(!hit,'Landing passage blocked by '+hit?.object.name+' at '+a+' to '+b);passageChecks++;
 for(let i=0;i<=Math.ceil(len);i++){const p=va.clone().lerp(vb,i/Math.max(1,Math.ceil(len))),floor=p.y-1.7;p.y=floor+.4;ray.set(p,new Vector3(0,-1,0));ray.far=.5;const candidates=geometry.filter(({box:b})=>b.min.x<=p.x&&b.max.x>=p.x&&b.min.z<=p.z&&b.max.z>=p.z&&b.min.y<p.y&&b.max.y>floor-.08).map(v=>v.o);assert.ok(ray.intersectObjects(candidates).some(h=>Math.abs(h.point.y-floor)<.035),'Missing passage floor at '+p.toArray());passageFloorChecks++;}
}
for(const c of TRANSIT_CORES)for(let d=1;d<=c.lastDeck;d++)for(const s of [-1,1]){const y=floorY(d)+1.7;
 clearPassage([c.x,y,0],[c.x,y,s*4.1]);clearPassage([c.x,y,0],[c.stairX-3.5,y,0]);clearPassage([c.stairX-3.5,y,0],[c.stairX-3.5,y,s*c.stairZ]);}
for(const c of COMMONS)for(const d of [17,18,19]){const x=d===17?(c.neighborhood>=9?135.3:c.x+5.3):c.x-20.5,z=c.z-Math.sign(c.z)*19,y=floorY(d)+1.7;clearPassage([132,y,0],[x,y,0]);clearPassage([x,y,0],[x,y,z+Math.sign(z)*1.7]);}
const report={status:'PASS',...counts,slabVerticesChecked:slabSamples,assembledStairHeadroomChecks:checks,landingPassageChecks:passageChecks,passageFloorChecks,fullShipMegabytes:b.length/1048576,scope:'Reloaded complete fitted GLB: physical object counts, absence of coarse reservation boxes, finished-roof containment of structural slabs, and clear 2.1 m stair headroom against assembled non-instanced geometry. Cabin separation is covered by the residential fit report.'};
await fs.writeFile('output/leo-interior-v01/assembly-roundtrip.json',JSON.stringify(report,null,2));console.log(report);
