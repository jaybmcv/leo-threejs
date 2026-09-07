import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createNeighborhood,createGardenCommons,insideHull,logicalX,COMMONS} from '../src/model.js';
import {finishedRoofY} from '../src/exterior-profile.js';
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const template=createNeighborhood(),root=new Group(),evidence=[];root.name='LEO_ten_fitted_garden_commons';let margin=Infinity;
for(let number=1;number<=10;number++){
 const garden=createGardenCommons(number,template),c=COMMONS[number-1];root.add(garden.root);root.updateMatrixWorld(true);let vertices=0;
 for(let ix=0;ix<=18;ix++)for(let iz=0;iz<=16;iz++){
   const x=c.x-c.width/2+c.width*ix/18,z=c.z-c.depth/2+c.depth*iz/16;
   assert.ok(insideHull(x,35.8,z),`N${number}: ceiling grid outside hull at ${x},${z}`);
 }
 garden.root.traverse(o=>{if(!o.isMesh)return;o.geometry.normalizeNormals();o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
  for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
   const p=new Vector3(x,y,z).applyMatrix4(o.matrixWorld);vertices++;
   assert.ok(insideHull(p.x,p.y,p.z),`N${number} ${o.name} outside hull`);
   assert.ok(Math.abs(p.x-c.x)<=c.width/2+.3&&Math.abs(p.z-c.z)<=c.depth/2+.3,`N${number} ${o.name} outside commons including perimeter lining`);
   const m=finishedRoofY(logicalX(p.x),p.z)-p.y;assert.ok(m>=0,`N${number} ${o.name} outside roof`);margin=Math.min(margin,m);
  }
 });
 evidence.push({neighborhood:number,corners:vertices});
}
const bytes=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});
await fs.writeFile('output/leo-interior-v01/leo-garden-commons.glb',Buffer.from(bytes));
const report={status:'PASS',fittedCommons:10,minimumRoofMarginM:margin,evidence,scope:'Fitted garden geometry bounding corners within commons footprints, hull and finished roof; repeated template includes galleries, stairs and shared facilities. Ship-wide connections remain a separate step.'};
await fs.writeFile('output/leo-interior-v01/garden-fit-report.json',JSON.stringify(report,null,2));console.log({...report,evidence:undefined,megabytes:bytes.byteLength/1048576});
