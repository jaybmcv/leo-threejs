import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Box3,Vector3,Matrix4} from 'three';
import {SPECIAL_AREAS,createSpecialArea} from '../src/special-areas.js';
import {createSpecialCirculation} from '../src/special-circulation.js';
import {SHIP_AREAS} from '../src/areas.js';
import {insideHull,logicalX,halfWidth} from '../src/model.js';
import {finishedRoofY} from '../src/exterior-profile.js';
import {bowHeight} from '../src/diagonal-profile.js';
const roofCache=new Map();
const roof=(x,z)=>{const key=x.toFixed(5)+','+z.toFixed(5);if(!roofCache.has(key))roofCache.set(key,finishedRoofY(logicalX(x),z));return roofCache.get(key);};
let samples=0,minRoof=Infinity,craft=0,seats=0,shuttles=0;const evidence=[];
function checkPoint(p,label,bridge=false){
 const margin=roof(p.x,p.z)-p.y;minRoof=Math.min(minRoof,margin);samples++;
 assert.ok(margin>=-.001,`${label}: outside finished roof by ${-margin}`);
 // Window lining follows the actual facade, so the bridge uses finished-surface containment.
 if(!bridge)assert.ok(insideHull(p.x,p.y,p.z),`${label}: outside usable hull at ${p.toArray()}`);
 else{
   let lo=-55,hi=52.8;const x=logicalX(p.x);for(let i=0;i<28;i++){const m=(lo+hi)/2;if(bowHeight(x,m)<p.y)lo=m;else hi=m;}
   assert.ok(Math.abs(p.z)<=halfWidth(p.x,(lo+hi)/2,0)+.01,`${label}: outside finished bow contour at ${p.toArray()}`);
 }
}
for(const area of SPECIAL_AREAS){
 const room=createSpecialArea(area);room.root.updateMatrixWorld(true);let meshes=0,roomSeats=0;
 room.root.traverse(o=>{
  if(o.name==='Transfer_shuttle')shuttles++;
  if(!o.isMesh)return;meshes++;
  if(o.name==='Lifeboat_floor')craft++;
  if(o.name==='Evacuation_seat'){seats+=o.count;roomSeats+=o.count;}
  const inst=o.isInstancedMesh,count=inst?o.count:1;
  if(area.kind==='bridge'){
    const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i++)checkPoint(new Vector3().fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld),area.id+' '+o.name,true);
  }else{
    o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
    for(let i=0;i<count;i++){
      const m=new Matrix4();if(inst)o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);
      if(inst&&area.kind==='lifeboats'){
        const boat=Math.floor(i/100),cx=-112.5+(boat%10)*25,cz=boat<10?-65.5:65.5,cy=area.center[1],occupied=b.clone().applyMatrix4(m);
        const crossAisle=new Box3(new Vector3(cx-.65,cy,cz-3.5),new Vector3(cx+.65,cy+2.1,cz+3.5));
        const longAisle=new Box3(new Vector3(cx-8.6,cy,cz-.9),new Vector3(cx+8.6,cy+2.1,cz));
        assert.ok(!occupied.intersectsBox(crossAisle)&&!occupied.intersectsBox(longAisle),`${area.id}: seating obstructs a boarding aisle`);
      }
      for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])checkPoint(new Vector3(x,y,z).applyMatrix4(m),area.id+' '+o.name);
    }
  }
 });
 assert.ok(meshes>20);if(area.kind==='lifeboats')assert.equal(roomSeats,2000);
 assert.ok([...room.inside.position,...room.overview.position].every(Number.isFinite));
 checkPoint(new Vector3(...room.inside.position),area.id+' eye',area.kind==='bridge');
 // Whole-room envelopes are checked against existing service rooms only when they represent solid room footprints.
 if(area.kind!=='lifeboats')for(const other of SHIP_AREAS.filter(a=>!a.special)){
   const yOverlap=area.center[1]<other.center[1]+other.height&&area.center[1]+area.height>other.center[1];
   if(yOverlap)assert.ok(Math.abs(area.center[0]-other.center[0])>=(area.width+other.width)/2||Math.abs(area.center[2]-other.center[2])>=(area.depth+other.depth)/2,`${area.id} overlaps ${other.id}`);
 }
 evidence.push({id:area.id,kind:area.kind,meshes,seats:roomSeats});
}
for(const deck of [2,7,20]){
 const c=createSpecialCirculation(deck);c.root.updateMatrixWorld(true);c.root.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])checkPoint(new Vector3(x,y,z).applyMatrix4(o.matrixWorld),`Deck ${deck} corridor`);});
}
assert.equal(craft,100);assert.equal(seats,10000);assert.equal(shuttles,4);
const report={status:'PASS',specialAreas:SPECIAL_AREAS.length,modeledLifeboats:craft,modeledLifeboatSeats:seats,transferShuttles:shuttles,samples,minimumFinishedRoofMarginM:minRoof,evidence,scope:'Command, engineering, hangar and lifeboat geometry containment; 100 modeled craft with 100 physical seats each; service-volume separation; connecting corridor containment. Not propulsion, endurance or evacuation-rate certification.'};
await fs.writeFile('output/leo-interior-v01/special-area-fit-report.json',JSON.stringify(report,null,2));console.log({...report,evidence:undefined});
