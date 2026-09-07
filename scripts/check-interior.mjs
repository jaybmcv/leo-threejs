import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Matrix4,Vector3} from 'three';
import {CABINS,SAMPLE,ROUTE,createNeighborhood,logicalX} from '../src/model.js';
import {finishedRoofY} from '../src/exterior-profile.js';
import {LOUNGE} from '../src/lounge.js';
const detail=createNeighborhood();detail.root.updateMatrixWorld(true);
const cabins=CABINS.filter(c=>c.neighborhood===10&&c.id!==SAMPLE.id);
let instanceParts=0,instanceCorners=0;
detail.district.traverse(o=>{
 if(!o.isInstancedMesh)return;assert.equal(o.count,499);instanceParts++;
 o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
 for(let i=0;i<o.count;i++){
  const m=new Matrix4();o.getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite));const c=cabins[i];
  for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
   const p=new Vector3(x,y,z).applyMatrix4(m);instanceCorners++;
   assert.ok(Math.abs(p.x-c.x)<=c.width/2+.001,`${o.name}: cabin width`);
   assert.ok(Math.abs(p.z-c.z)<=c.depth/2+.001,`${o.name}: cabin depth`);
   assert.ok(p.y>=c.y-.301&&p.y<=c.y+c.height+.001,`${o.name}: cabin height`);
  }
 }
});
assert.ok(instanceParts>20);let loungeVertices=0,minLoungeRoofMargin=Infinity;
for(const g of [detail.observation.lounge,detail.observation.shell,detail.root.getObjectByName('Promenade_inner_lining')])g.traverse(o=>{
 if(!o.isMesh)return;const a=o.geometry.attributes.position;
 for(let i=0;i<a.count;i++){
  const p=new Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);
  minLoungeRoofMargin=Math.min(minLoungeRoofMargin,finishedRoofY(logicalX(p.x),p.z)-p.y);loungeVertices++;
 }
});
assert.ok(minLoungeRoofMargin>=0,`Lounge protrudes through bow: ${minLoungeRoofMargin}`);
assert.equal(LOUNGE.rampEnd-LOUNGE.rampStart,24);assert.equal(LOUNGE.floor-24.3,2);assert.equal(ROUTE.length,6);
for(const r of ROUTE)assert.ok(finishedRoofY(logicalX(r.position[0]),r.position[2])>r.position[1]+.2,`${r.name}: eye point above roof`);
const report={status:'PASS',furnishedCabins:500,berths:1000,instancedCopies:499,instanceParts,instanceCorners,loungeVertices,minimumLoungeRoofMarginM:minLoungeRoofMargin,rampRiseM:2,rampRunM:24,routeStops:6,scope:'Repeated cabin envelope containment, lounge mesh vertices inside the finished bow, ramp endpoints and camera roof clearance. Concept geometry; systems and collision navigation are not validated.'};
await fs.writeFile('output/leo-interior-v01/interior-fit-report.json',JSON.stringify(report,null,2));console.log(report);
