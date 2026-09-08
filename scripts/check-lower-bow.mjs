import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Box3,Vector3,Raycaster} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LOWER_BOW_AREAS,createLowerBowArea,createLowerBowCirculation} from '../src/lower-bow.js';
import {insideHull,logicalX} from '../src/model.js';
import {finishedRoofY} from '../src/exterior-profile.js';
let vertices=0,samples=0;const cache=new Map(),required={1:'Supply_crate',4:'Grow_tray',5:'Parallel_bar'};
for(const a of LOWER_BOW_AREAS)for(const r of [createLowerBowArea(a),createLowerBowCirculation(a.deck)]){
 r.root.updateMatrixWorld(true);r.root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
  const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),k=v.x.toFixed(4)+','+v.z.toFixed(4);vertices++;
  assert(insideHull(v.x,v.y,v.z,2.5),o.name+' outside usable hull '+v.toArray());
  if(!cache.has(k))cache.set(k,finishedRoofY(logicalX(v.x),v.z));assert(v.y<=cache.get(k)+.001,o.name+' above finished roof');
  assert(v.y>=a.center[1]-.025&&v.y<=a.center[1]+3.5,o.name+' exceeds deck height '+v.toArray());
 }});
}
const bytes=await fs.readFile('output/leo-interior-v01/leo-full-ship.glb'),g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;});g.scene.updateMatrixWorld(true);
const inside=g.scene.getObjectByName('Fitted_ship_interior'),geometry=[];
inside.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)geometry.push({o,b:new Box3().setFromObject(o)});});
const hangar=new Box3().setFromObject(inside.getObjectByName('Area_d02-hangar-9'));
const ray=new Raycaster(),up=new Vector3(0,1,0),down=new Vector3(0,-1,0);
function route(a,b,y){
 for(const h of [.35,1,1.7]){
  const start=new Vector3(a[0],y+h,a[1]),end=new Vector3(b[0],y+h,b[1]),dir=end.clone().sub(start),length=dir.length(),bounds=new Box3().setFromPoints([start,end]);
  ray.set(start,dir.normalize());ray.far=length;const hit=ray.intersectObjects(geometry.filter(v=>v.b.intersectsBox(bounds)).map(v=>v.o))[0];assert(!hit,'Crossing obstruction '+hit?.object.name+' at height '+h);
 }
 const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2);for(let i=0;i<=n;i++){
 const t=i/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
 const near=geometry.filter(({b})=>x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z&&b.max.y>y-.1&&b.min.y<y+2.2).map(v=>v.o);
 ray.set(new Vector3(x,y+.03,z),up);ray.far=2.07;const hit=ray.intersectObjects(near)[0];assert(!hit,'Blocked route '+hit?.object.name+' at '+[x,y,z]);
 ray.set(new Vector3(x,y+.15,z),down);ray.far=.19;assert(ray.intersectObjects(near).length,'Missing floor at '+[x,y,z]);samples++;
}}
const gaps=[];
for(const a of LOWER_BOW_AREAS){
 const room=inside.getObjectByName('Area_'+a.id);assert(room&&room.getObjectByName(required[a.deck]),'Missing furnished room '+a.id);
 const b=new Box3().setFromObject(room);assert(!b.intersectsBox(hangar),'Room intersects double-height shuttle bay');
 if(a.deck===1){const gap=hangar.min.y-b.max.y;assert(gap>.1);gaps.push({deck:1,toHangarM:gap});}
 if(a.deck===4){const gap=b.min.y-hangar.max.y;assert(gap>.1);gaps.push({deck:4,toHangarM:gap});}
 const y=a.center[1];for(const dz of [-1.5,0,1.5])route([132,dz],[164,dz],y);
 for(const dz of [-2.7,0,2.7])route([164,dz],[225,dz],y);
 // A transverse circulation aisle reaches both sides between furniture banks.
 for(const dx of [-1.4,0,1.4])route([201+dx,-27],[201+dx,27],y);
}
const result={status:'PASS',newRooms:3,verticesChecked:vertices,assembledRouteSamples:samples,shuttleBayClearances:gaps,scope:'Hull/roof and deck-height containment; saved furnishings, shuttle-bay separation and 2.1 m clear approaches and interior cross aisles with continuous supporting floors.'};
await fs.writeFile('output/leo-interior-v01/lower-bow-fit.json',JSON.stringify(result,null,2));console.log(result);
