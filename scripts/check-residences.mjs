import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Matrix4,Vector3} from 'three';
import {createResidentialDeck,createNeighborhood,CABINS,SAMPLE,insideHull,logicalX} from '../src/model.js';
import {finishedRoofY} from '../src/exterior-profile.js';
const cache=new Map();const roof=(x,z)=>{const k=x.toFixed(4)+','+z.toFixed(4);if(!cache.has(k))cache.set(k,finishedRoofY(logicalX(x),z));return cache.get(k);};
const template=createNeighborhood(),evidence=[];let totalCorners=0,minRoof=Infinity;
for(let number=1;number<=10;number++){
 const room=createResidentialDeck(number,template);room.root.updateMatrixWorld(true);
 const cabins=CABINS.filter(c=>c.neighborhood===number&&!(c.x===SAMPLE.x&&c.z===SAMPLE.z));assert.equal(cabins.length,499);
 let parts=0,corners=0;
 room.root.traverse(o=>{
  if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
  const count=o.isInstancedMesh?o.count:1;if(o.isInstancedMesh){assert.equal(count,499);parts++;}
  for(let i=0;i<count;i++){
   const m=new Matrix4();if(o.isInstancedMesh)o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);
   for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
    const p=new Vector3(x,y,z).applyMatrix4(m);corners++;
    assert.ok(insideHull(p.x,p.y,p.z),`N${number} ${o.name} outside hull: ${p.toArray()}`);
    const margin=roof(p.x,p.z)-p.y;assert.ok(margin>=0,`N${number}: roof`);minRoof=Math.min(minRoof,margin);
    if(o.isInstancedMesh){const c=cabins[i];assert.ok(Math.abs(p.x-c.x)<=c.width/2+.001&&Math.abs(p.z-c.z)<=c.depth/2+.001&&p.y>=c.y-.301&&p.y<=c.y+c.height+.001,`N${number}: ${o.name} outside cabin ${c.id}`);}
   }
  }
 });
 assert.ok(parts>20);totalCorners+=corners;evidence.push({neighborhood:number,deck:number+5,cabins:500,berths:1000,instancedPartGroups:parts,corners});
}
const report={status:'PASS',furnishedCabins:5000,berths:10000,neighborhoods:10,geometryCornersChecked:totalCorners,minimumRoofMarginM:minRoof,evidence,scope:'All ten furnished residential decks: cabin-part envelope, hull and roof containment, including corridors. Vertical connections and evacuation are not verified.'};
await fs.writeFile('output/leo-interior-v01/residential-fit-report.json',JSON.stringify(report,null,2));console.log({...report,evidence:undefined});
