import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Box3,Vector3,Raycaster} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {UPPER_AFT_AREAS,createUpperAftArea,createUpperAftCirculation} from '../src/upper-aft.js';
import {insideHull,logicalX} from '../src/model.js';
import {finishedRoofY} from '../src/exterior-profile.js';
let vertices=0,samples=0;const cache=new Map();
for(const a of UPPER_AFT_AREAS)for(const room of [createUpperAftArea(a),createUpperAftCirculation(a.deck)]){
 room.root.updateMatrixWorld(true);room.root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
  const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),key=v.x.toFixed(4)+','+v.z.toFixed(4);vertices++;
  assert(insideHull(v.x,v.y,v.z,2.5),o.name+' outside hull '+v.toArray());
  if(!cache.has(key))cache.set(key,finishedRoofY(logicalX(v.x),v.z));assert(v.y<=cache.get(key)+.001,o.name+' above finished roof');
  assert(v.y>=a.center[1]-.025&&v.y<=a.center[1]+3.5,o.name+' outside deck');
 }});
}
const b=await fs.readFile('output/leo-interior-v01/leo-full-ship.glb'),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;});g.scene.updateMatrixWorld(true);
const interior=g.scene.getObjectByName('Fitted_ship_interior'),geometry=[];
interior.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)geometry.push({o,b:new Box3().setFromObject(o)});});
const ray=new Raycaster(),up=new Vector3(0,1,0),down=new Vector3(0,-1,0);
function walk(a,b,y){const length=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(length*2);for(let i=0;i<=steps;i++){
 const t=i/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
 const near=geometry.filter(({b})=>x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z&&b.min.y<y+2.2&&b.max.y>y-.1).map(r=>r.o);
 ray.set(new Vector3(x,y+.03,z),up);ray.far=2.07;const hit=ray.intersectObjects(near)[0];assert(!hit,'Obstructed route '+hit?.object.name+' '+[x,y,z]);
 ray.set(new Vector3(x,y+.15,z),down);ray.far=.19;assert(ray.intersectObjects(near).length,'Missing supporting floor '+[x,y,z]);samples++;
}}
for(const a of UPPER_AFT_AREAS){
 const r=interior.getObjectByName('Area_'+a.id);assert(r,'Missing room '+a.id);assert(r.getObjectByName(a.deck===16?'Briefing_wall':'Passenger_bench'));
 const y=a.center[1];for(const offset of [-1.5,0,1.5]){
  walk([-132,offset],[-230,offset],y);
  walk([-205+offset,0],[-205+offset,a.center[2]],y);
  walk([-230,a.center[2]+offset],[-188,a.center[2]+offset],y);
 }
}
// The lounge branch is checked across the railing height, not just at eye level.
// Verify continuing west along the existing gallery towards the fin lift too.
walk([-205,0],[-242,0],24.3);
const result={status:'PASS',newRooms:2,geometryVertices:vertices,assembledRouteSamples:samples,scope:'Hull and roof containment, deck-height fit, saved room furnishings and continuous 2.1 m-high routes across the gallery-rail opening to both rooms and towards the fin lift.'};
await fs.writeFile('output/leo-interior-v01/upper-aft-fit.json',JSON.stringify(result,null,2));console.log(result);
