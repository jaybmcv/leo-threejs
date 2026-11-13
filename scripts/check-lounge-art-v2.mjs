import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {createGardenCommons} from '../src/model.js';
import {gardenPrintPlacements,fitGardenArt} from '../src/v2/garden-art.js';
import {Colliders,BODY} from '../src/walk/collision.js';

// Use the real merged frame, canvas and ink meshes, including their collision geometry.
const before=gardenPrintPlacements(layout,{}),after=gardenPrintPlacements(layout);
const stray='commons-1/garden-print-73';
assert(before.some(p=>p.id===stray));
assert.deepEqual(after,before.filter(p=>p.id!==stray),'Only the stray lounge print is removed; all other mounts stay put');
const root=new T.Group(),counts=new Map();
for(const number of [1,10]){
 const source=createGardenCommons(number).root;root.add(source);
 source.traverse(o=>{
  const marker=o.geometry?.attributes._leo_print;if(!marker)return;
  const ix=o.geometry.index,kept=new Set();
  for(let i=0,n=ix?ix.count:marker.count;i<n;i++){const v=ix?ix.getX(i):i,seed=marker.getX(v);if(number===1&&![70,71,72].includes(seed))continue;kept.add(v);}
  counts.set(o,kept.size);
 });
}
const ship={root},rows=fitGardenArt(ship,layout);
assert.equal(rows.filter(p=>p.room==='commons-1').length,3);
assert.equal(rows.filter(p=>p.room==='commons-10').length,10,'Other gardens retain every print');
for(const [o,count]of counts){
 assert(o.parent,'Retained print meshes remain attached');
 assert.equal(o.geometry.attributes.position.count,count,o.name+' retains exactly the intended frame/canvas/ink vertices');
 assert(!o.geometry.attributes._leo_print);
}
const former=new T.Box3(new T.Vector3(-103.29,25.17,-48.47),new T.Vector3(-103.21,26.73,-46.10));
root.updateMatrixWorld(true);
for(const o of counts.keys()){
 const p=o.geometry.attributes.position,v=new T.Vector3();
 for(let i=0;i<p.count;i++)assert(!former.containsPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld)),'No frame, canvas or ink remains at the former panel');
}
const col=new Colliders();col.addStatic(root,o=>counts.has(o));col.commit();
for(let d=0;d<=5;d+=.25){
 const x=-104.05+Math.sin(115*Math.PI/180)*d,z=-47.22+Math.cos(115*Math.PI/180)*d;
 const segment=new T.Line3(new T.Vector3(x,24.3+BODY.step+BODY.radius,z),new T.Vector3(x,24.3+BODY.height-BODY.radius,z));
 assert(!col.overlaps(segment,BODY.radius),'No leftover art collision along the reported approach');
}
console.log('PASS: stray lounge print removed from real render/collision meshes; every other garden mount unchanged');
