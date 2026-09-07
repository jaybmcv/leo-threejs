import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Vector3,Raycaster} from 'three';
import {createShip,insideHull,logicalX,createGardenCommons} from '../src/model.js';
import {createTransit,TRANSIT_CORES,floorY} from '../src/transit.js';
import {finishedRoofY} from '../src/exterior-profile.js';
const ship=createShip({deferExterior:true}),transit=createTransit();
ship.root.updateMatrixWorld(true);transit.root.updateMatrixWorld(true);
const slabs=ship.decks.map(d=>d.getObjectByName('Deck_slab')),ray=new Raycaster(),down=new Vector3(0,-1,0),up=new Vector3(0,1,0);
let openingChecks=0,headroomChecks=0,samples=0,minHeadroom=Infinity;const cache=new Map();
transit.root.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new Vector3(x,y,z).applyMatrix4(o.matrixWorld),key=p.x.toFixed(4)+','+p.z.toFixed(4);if(!cache.has(key))cache.set(key,finishedRoofY(logicalX(p.x),p.z));assert.ok(insideHull(...p.toArray()),o.name+' exceeds hull '+p.toArray());assert.ok(p.y<=cache.get(key)+.001,o.name+' exceeds roof');samples++;}});
function slabHit(d,x,z){ray.set(new Vector3(x,floorY(d)+1,z),down);return ray.intersectObject(slabs[d-1]).length>0;}
for(let d=1;d<=20;d++){
 assert.ok(slabHit(d,0,0));
 for(const c of TRANSIT_CORES)if(d<=c.lastDeck)for(const s of [-1,1]){assert.ok(!slabHit(d,c.x,s*6));openingChecks++;if(d>1){assert.ok(!slabHit(d,c.stairX+3.5,s*c.stairZ));openingChecks++;}}
}
for(const [d,x,z]of [[3,184,0],[18,185,0],[19,185,0],[18,158,0]]){assert.ok(!slabHit(d,x,z));openingChecks++;}
const overhead=[...slabs];transit.root.traverse(o=>{if(o.isMesh&&/Stair_tread|Stair_half_landing|Stair_top_ceiling|Connected_transit_floor/.test(o.name))overhead.push(o);});
for(const c of TRANSIT_CORES)for(let d=1;d<c.lastDeck;d++)for(const s of [-1,1]){
 const y=floorY(d),x=c.stairX,z=s*c.stairZ;
 const points=[[x+3.5,y+2,z]];
 for(let i=0;i<12;i++){points.push([x-2.5+(i+.5)*5/12,y+(i+1)/6,z-1.4],[x+2.5-(i+.5)*5/12,y+2+(i+1)/6,z+1.4]);}
 for(const p of points){ray.set(new Vector3(p[0],p[1]+.02,p[2]),up);const hit=ray.intersectObjects(overhead)[0];if(hit){minHeadroom=Math.min(minHeadroom,hit.distance+.02);assert.ok(hit.distance+.02>=2.1,'Headroom '+(hit.distance+.02)+' at '+p+' hit '+hit.object.name);}headroomChecks++;}
}
const nodes=new Set(transit.graph.nodes.map(n=>n.id)),adj=new Map([...nodes].map(n=>[n,[]]));for(const e of transit.graph.edges){assert.ok(nodes.has(e.a)&&nodes.has(e.b));adj.get(e.a).push(e.b);adj.get(e.b).push(e.a);}
const reached=new Set(),queue=[nodes.values().next().value];while(queue.length){const n=queue.pop();if(reached.has(n))continue;reached.add(n);queue.push(...adj.get(n));}assert.equal(reached.size,nodes.size);
const report={status:'PASS',liftShafts:4,stairTowers:4,decks:20,openingChecks,headroomChecks,minimumStairHeadroomM:minHeadroom,geometryCornerSamples:samples,connectedNodes:reached.size,scope:'Actual deck mesh openings, stair tread and landing headroom, transit hull/roof containment, network graph connectivity. Guided movement remains illustrative.'};
await fs.writeFile('output/leo-interior-v01/transit-fit-report.json',JSON.stringify(report,null,2));console.log(report);
