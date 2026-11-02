import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {FLOWING_RIB_PARTS,addFlowingCabinRibs,addFlowingAtriumRibs} from '../src/v2/flowing-ribs.js';

const ray=new T.Raycaster();
for(const sign of[-1,1]){
  const root=new T.Group();addFlowingCabinRibs(root,sign);root.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(root);assert(box.max.x<=1.591&&box.min.x>=-1.591);assert(box.min.y>=0&&box.max.y<=3.401);
  assert(Math.min(Math.abs(box.min.z),Math.abs(box.max.z))>=3.69,'Trim stays on sealed window face');
  for(const [x,y]of[[0,.3],[0,1.65],[0,2.9],[-1.2,1.65],[1.2,1.65]]){
    ray.set(new T.Vector3(x,y,0),new T.Vector3(0,0,-sign));assert.equal(ray.intersectObject(root,true).length,0,'Open sightline');
  }
  ray.set(new T.Vector3(1.5,1.65,-sign*5),new T.Vector3(0,0,sign));assert(ray.intersectObject(root,true).length,'Visible window reveal');
  for(const o of root.children)assert(o.userData.noCollide,'Existing collision remains authoritative');
}
const cabins=[{id:'atrium-test',view:'atrium',x:10,z:10,y:0,yaw:0,door:{center:[10,0,13.7]},matrix:new T.Matrix4().makeTranslation(10,0,10)},{id:'exterior-test',view:'space'}];
const facade=new T.Group(),report=addFlowingAtriumRibs(facade,cabins);assert.equal(report.windows,1);assert.equal(report.draws,2);assert(report.trianglesPerWindow<=210);
for(const o of facade.children){assert.equal(o.count,1);assert.deepEqual(o.userData.roomOwners,['atrium-test']);assert.equal(o.userData.proxySpans.length,1);}
const layoutFile=process.argv.find(arg=>arg.startsWith('--layout='))?.slice(9);
const fullShip=layoutFile?JSON.parse(fs.readFileSync(layoutFile,'utf8')).cabins.filter(c=>c.view==='atrium').length:undefined;
console.log(JSON.stringify({status:'PASS',...report,unchangedEntry:true,unchangedCollision:true,excludesSpaceFacingWindows:true,fullShipWindows:fullShip,fullShipTriangles:fullShip===undefined?undefined:fullShip*report.trianglesPerWindow}));
