import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {addReflectionTerraces,reflectionGeometry,reflectionMaterial,REFLECTION_BAYS} from '../src/v2/reflection-terraces.js';
import {contains,distanceToSegment} from '../src/plan/geometry-v2.js';

const parts=[],rests=[],y=-20;
addReflectionTerraces({parts,rests,y});
assert.equal(rests.length,20);
assert.equal(new Set(rests.map(r=>r.id)).size,20);
const solid=[];
for(const p of parts){
  assert([...p.at,...p.size,p.yaw].every(Number.isFinite));
  assert(p.size.every(n=>n>0));
  assert.equal(p.room,'atrium6-lake');
  assert.equal(p.deck,6);
  assert(p.at[0]-p.size[0]/2>4&&p.at[0]+p.size[0]/2<120);
  assert(p.at[2]-p.size[2]/2>-56&&p.at[2]+p.size[2]/2<=-5.79);
  assert(p.at[1]+p.size[1]/2<=y+8,'Owner height: '+p.part);
  const geo=reflectionGeometry(p)||new T.BoxGeometry(...p.size);geo.computeBoundingBox();
  const actual=geo.boundingBox.getSize(new T.Vector3());
  for(let i=0;i<3;i++)assert(Math.abs(actual.getComponent(i)-p.size[i])<.04,'Geometry bounds '+p.part+' axis '+i);
  assert(reflectionMaterial(p.mat)?.isMaterial);
  const mesh=new T.Mesh(geo,reflectionMaterial(p.mat));mesh.position.fromArray(p.at);mesh.updateMatrixWorld();mesh.name=p.part;
  if(!p.noCollide)solid.push(mesh);
}
const ray=new T.Raycaster();
for(const s of rests){
  ray.set(new T.Vector3(s.point[0],s.point[1]+.2,s.point[2]),new T.Vector3(0,-1,0));
  const seat=ray.intersectObjects(solid)[0];
  assert(seat?.object.name==='p6_reflection_seat_cushion','Rest lands on cushion '+s.id);
  assert(Math.abs(seat.point.y-s.point[1])<.001,'Rest top '+s.id);
  const approach=new T.Vector3(...s.point).addScaledVector(new T.Vector3(...s.facing),1.1);
  ray.set(new T.Vector3(approach.x,y+1.5,approach.z),new T.Vector3(0,-1,0));
  const floor=ray.intersectObjects(solid)[0];
  assert(floor?.object.name==='p6_reflection_floor','Clear seated approach '+s.id+' '+floor?.object.name);
}
for(const x of REFLECTION_BAYS){
  ray.set(new T.Vector3(x,y+1.65,-4.5),new T.Vector3(0,0,-1));
  const hit=ray.intersectObjects(solid)[0];
  assert(!hit||hit.distance>6.5,'Portal remains open at eye level');
  for(const dx of[-2,0,2]){
    ray.set(new T.Vector3(x+dx,y+1,-6.1),new T.Vector3(0,-1,0));
    const hit=ray.intersectObjects(solid)[0];assert(hit?.object.name==='p6_reflection_floor','Clear three-lane terrace entrance');
  }
}
assert.equal(reflectionMaterial('cream'),null,'Existing material dispatch unaffected');
assert.equal(reflectionGeometry({part:'existing',size:[1,1,1]}),null);
let minimumPerimeterClearance;
const layoutFile=process.argv.find(arg=>arg.startsWith('--layout='))?.slice(9);
if(layoutFile){
  const outline=JSON.parse(fs.readFileSync(layoutFile,'utf8')).decks[5].atrium.outline;
  minimumPerimeterClearance=Infinity;
  for(const p of parts)for(const dx of[-p.size[0]/2,p.size[0]/2])for(const dz of[-p.size[2]/2,p.size[2]/2]){
    const q=[p.at[0]+dx,p.at[2]+dz];assert(contains(outline,q),'Inside actual atrium: '+p.part);
    const distance=Math.min(...outline.map((a,i)=>distanceToSegment(q,a,outline[(i+1)%outline.length])));
    minimumPerimeterClearance=Math.min(minimumPerimeterClearance,distance);
  }
  assert(minimumPerimeterClearance>=2.4,'Preserve perimeter routes');
}
console.log(JSON.stringify({status:'PASS',parts:parts.length,seats:rests.length,geometryBounds:true,clearSeatApproaches:true,openPortals:true,maximumHeight:8,minimumPerimeterClearance}));
