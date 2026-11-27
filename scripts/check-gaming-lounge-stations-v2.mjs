import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {worldPoint} from '../src/plan/hull-skin-v2.js';
import {v1Frame,resolveRoomFrames} from '../src/plan/rooms.js';
import {shellParts} from '../src/v2/hull-prototypes.js';
import {dressGamingLounge,createGamingLounge} from '../src/walk/gaming-lounge.js';
import {geometryRecords} from '../src/v2/prepared-geometry-record.js';
import {findRestSpots,solidSpots} from '../src/walk/rest.js';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';

// Exercise the real furniture, seat finder and capsule without building the rest of the ship.
const id='d16-training-aft',plan=layout.rooms.find(r=>r.id===id),root=new T.Group(),room=new T.Group();
room.name='Area_'+id;room.position.set(...v1Frame(id).origin);root.add(room);
for(const name of ['Room_fittings','Walls_and_ceiling']){const g=new T.Group();g.name=name;room.add(g);}
assert(dressGamingLounge({root}));resolveRoomFrames(root);
const fit=room.getObjectByName('Room_fittings'),seats=fit.children.filter(o=>o.name==='Gaming_curved_couch_seat');
assert.equal(seats.length,4);
for(const o of seats){assert.equal(o.geometry,seats[0].geometry);assert.equal(o.material,seats[0].material);}
const expectedStations=[[8.7,-11,Math.PI/2],[19,-9.5,0],[19,0,0],[8.7,2,-Math.PI/2]];
const screens=fit.children.filter(o=>o.name==='Lounge_screen_frame');
assert.equal(screens.length,4);
for(let i=0;i<4;i++){
 const [x,z,yaw]=expectedStations[i],expected=room.localToWorld(new T.Vector3(x,0,z)),seat=seats[i],facing=new T.Vector3(1,0,0).transformDirection(seat.matrixWorld);
 assert(seat.getWorldPosition(new T.Vector3()).distanceTo(expected)<1e-6,'Couch centre must follow the fan placement');
 assert(facing.distanceTo(new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)))<1e-6,'Station must face its scheduled wall');
 const screen=room.localToWorld(new T.Vector3(x+2.21*Math.cos(yaw),1.5,z-2.21*Math.sin(yaw)));
 assert(screens[i].getWorldPosition(new T.Vector3()).distanceTo(screen)<1e-6,'Screen must follow its couch');
}
assert.equal(fit.children.filter(o=>o.name==='Gaming_chair').length,13);
assert.deepEqual(fit.children.filter(o=>o.name==='Wall_screen_frame').map(o=>o.position.toArray()),[-21,-16.5,-12,-7.5,-3].map(x=>[x,1.35,7.84-.025]));
assert.equal(fit.children.filter(o=>o.name==='Media_cabinet').length,5);
assert.equal(fit.children.filter(o=>o.name==='Side_table_top').length,5);
const starts=fit.children.map((o,i)=>o.name==='Lounge_screen_frame'?i:-1).filter(i=>i>=0);
const stations=starts.map((i,j)=>fit.children.slice(i,starts[j+1]??fit.children.length));
const bounds=objects=>objects.map(o=>new T.Box3().setFromObject(o));
const boxes=stations.map(bounds),wall=bounds(fit.children.slice(0,starts[0]));
const gap=(a,b)=>Math.hypot(Math.max(0,a.min.x-b.max.x,b.min.x-a.max.x),Math.max(0,a.min.z-b.max.z,b.min.z-a.max.z));
let clearance=Infinity;
for(let i=0;i<4;i++)for(const a of boxes[i]){
 for(const b of wall)clearance=Math.min(clearance,gap(a,b));
 for(let j=0;j<i;j++)for(const b of boxes[j])clearance=Math.min(clearance,gap(a,b));
 // Reserve the complete planned doorway, plus the required clear floor on its room side.
 const d=plan.door,b=new T.Box3(new T.Vector3(d.center[0]-d.width/2,plan.y,d.center[2]),new T.Vector3(d.center[0]+d.width/2,plan.y+3,d.center[2]));
 assert(gap(a,b)>=2.5,'Station reaches the doorway approach');
 assert(a.max.x<=plan.x+24-1.2&&a.max.z<=plan.z+8-1.2,'Station reaches the glass wall aisle');
 // Hull-facing polygon edges carry the windows; use each part's own height slice.
 const slice=plan.envelope.find(s=>a.max.y-plan.y<=s.rise+s.height+.001)||plan.envelope.at(-1);
 for(let k=0;k<slice.polygon.length-1;k++){
  const p=slice.polygon[k],q=slice.polygon[k+1];if(p[1]>plan.z-8||q[1]>plan.z-8)continue;
  const edge=new T.Box3(new T.Vector3(Math.min(p[0],q[0]),0,Math.min(p[1],q[1])),new T.Vector3(Math.max(p[0],q[0]),0,Math.max(p[1],q[1])));
  assert(gap(a,edge)>=2.5,`Station ${i+1} reaches the windows: ${gap(a,edge).toFixed(3)} m`);
 }
}
assert(clearance>=2.5,`Only ${clearance.toFixed(3)} m between furniture`);
const floor=new T.Mesh(new T.BoxGeometry(48,.2,32),new T.MeshBasicMaterial());floor.position.set(plan.x,plan.y-.1,plan.z-8);root.add(floor);
const colliders=new Colliders();colliders.addStatic(root);colliders.commit();
const spots=solidSpots(findRestSpots(root),colliders);
for(const seat of seats){
 const O=seat.getWorldPosition(new T.Vector3()),f=new T.Vector3(1,0,0).transformDirection(seat.matrixWorld),p=O.clone().addScaledVector(f,-3.7);
 assert(spots.some(s=>s.kind==='sit'&&s.point.clone().setY(p.y).distanceTo(p)<.5&&s.facing.dot(f)>.99),'Missing solid couch seat facing its screen');
}
const cat=new Controller(colliders),walk=(from,wish,seconds)=>{cat.place(new T.Vector3(...from));for(let i=0;i<seconds*120;i++)cat.step(1/120,new T.Vector3(...wish),false);return cat.position.clone();};
for(const seat of seats){
 const O=seat.getWorldPosition(new T.Vector3()),f=new T.Vector3(1,0,0).transformDirection(seat.matrixWorld),start=O.clone().addScaledVector(f,-5.7).setY(plan.y);
 const hit=walk(start.toArray(),f.clone().multiplyScalar(3).toArray(),2);
 assert(hit.clone().sub(O).dot(f)<-4.5,'Cat walked through a couch');assert(hit.clone().sub(start).dot(f)>.5,'Approach already blocked');
 const away=walk(hit.toArray(),f.clone().multiplyScalar(-3).toArray(),.5);assert(away.clone().sub(hit).dot(f)<-1,'Cat cannot walk away');
}
const reach=(x,z)=>{
 const to=new T.Vector3(x,plan.y,z);
 for(let i=0;i<1200&&cat.position.distanceTo(to)>.04;i++){
  const wish=to.clone().sub(cat.position).setY(0);wish.multiplyScalar(Math.min(2.25,wish.length()*8)/wish.length());cat.step(1/120,wish,false);
 }
 assert(cat.position.distanceTo(to)<.1,'Blocked circuit at '+to.toArray());
};
for(const station of stations){
 const b=new T.Box3();for(const o of station)b.expandByObject(o);
 const x0=b.min.x-.65,x1=b.max.x+.65,z0=b.min.z-.65,z1=b.max.z+.65;
 cat.place(new T.Vector3(x0,plan.y,z0));
 for(const [x,z] of [[x1,z0],[x1,z1],[x0,z1],[x0,z0]])reach(x,z);
}
cat.place(room.localToWorld(new T.Vector3(3.4,0,5.65)));
reach(plan.x+13.3,plan.z+5.65);
const removed=room.localToWorld(new T.Vector3(10.5,0,5.59));
assert(!spots.some(s=>Math.hypot(s.point.x-removed.x,s.point.z-removed.z)<1.5),'Removed chair left a sit target');
reach(plan.x+13.3,plan.z-4.5);reach(plan.x+4.7,plan.z-4.5);
console.log(`Gaming lounge: four shared stations, solid seats and colliders; ${clearance.toFixed(3)} m minimum furniture clearance.`);

// Record the authoring templates, then replay the same group in both visitor variants.
globalThis.document={createElement:()=>createCanvas(1,1)};
const signature=group=>{const h=createHash('sha256');group.traverse(o=>{if(!o.geometry)return;h.update(o.name);for(const a of Object.values(o.geometry.attributes))h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));if(o.geometry.index)h.update(Buffer.from(o.geometry.index.array.buffer));});return h.digest('hex');};
const expected=createGamingLounge({root},null,{still:true});
// Check the lights against the same opaque lining and end returns the ship uses.
const facade=layout.hullPrototypes.prototypes.find(p=>p.ownerId===id),shell=shellParts(facade,q=>worldPoint(facade.chart,q));
const opaque=new T.MeshBasicMaterial({side:T.DoubleSide}),hull=new T.Mesh(shell.wall,opaque),ends=new T.Mesh(shell.sides,opaque);
const [aft,bow,,top]=facade.rect,zFront=facade.chart.origin[2]-facade.fixedV;
const ray=new T.Raycaster(),out=new T.Vector3(0,0,-1),position=new T.Vector3();
expected.group.updateMatrixWorld(true);
const light=name=>expected.group.getObjectByName('Gaming_'+name);
for(const name of ['hex_light','hex_glow']){
 const mesh=light(name),p=mesh.geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  position.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
  assert(position.y<plan.y+top&&position.z<zFront,'The RGB panels stay below the wall top and clear of entry glass');
  const side=position.x<aft+.06?-1:position.x>bow-.06?1:0,dir=side?new T.Vector3(side,0,0):out;
  ray.set(position.clone().addScaledVector(dir,-.1),dir);ray.far=.17;
  const backing=ray.intersectObject(side?ends:hull)[0];
  assert(backing&&backing.distance>.098,`${name} needs opaque wall backing at ${position.toArray()}`);
 }
}
const strip=light('light_strip'),stripBounds=new T.Box3().setFromObject(strip),y=stripBounds.getCenter(position).y;
assert(stripBounds.max.z<=zFront+.001&&stripBounds.max.y<plan.y+top,'The strip stays clear of the entry glass and below the wall top');
const followsWall=(from,dir,surface)=>{
 ray.set(from,dir);ray.far=60;
 const led=ray.intersectObject(strip)[0],backing=ray.intersectObject(surface)[0];
 assert(led&&backing&&backing.distance-led.distance>=0&&backing.distance-led.distance<.05,`The strip needs continuous wall backing from ${from.toArray()}`);
};
for(let x=aft+.25;x<bow;x+=.5)followsWall(new T.Vector3(x,y,zFront),out,hull);
for(const [u,dir] of [[aft,-1],[bow,1]]){
 ray.set(new T.Vector3(u-dir*.001,y,zFront),out);ray.far=60;
 const corner=ray.intersectObject(hull)[0].point.z;
 for(let z=zFront-.15;z>corner+.15;z-=.25)followsWall(new T.Vector3(u-dir*.1,y,z),new T.Vector3(dir,0,0),ends);
}
console.log('Gaming lounge: hex faces and halos have solid backing, and the strip follows the three solid runs.');
const dir=path.resolve('.qa/gaming-lounge-stations');await fs.mkdir(dir,{recursive:true});
const url=p=>pathToFileURL(path.resolve(p)).href,replay=path.join(dir,'replay.mjs');
let source=await fs.readFile('src/v2/prepared-geometry-replay.public.js','utf8');
source=source.replace("import {preparedResource} from './prepared-resource.public.js';",`import {geometryRecords} from ${JSON.stringify(url('src/v2/prepared-geometry-record.js'))};const preparedResource={geometryTemplates:geometryRecords()};`)
 .replace("'./prepared-geometry-key.js'",JSON.stringify(url('src/v2/prepared-geometry-key.js')));
await fs.writeFile(replay,source);
for(const mode of ['authoring','prepared','public']){
 const file=path.join(dir,mode+'.mjs'),entry=path.resolve(`src/walk/gaming-lounge.${mode}.js`);
 let text=await fs.readFile(entry,'utf8');
 text=text.replace(/from (['"])(\.[^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(url(p.includes('prepared-geometry-replay')?replay:path.resolve(path.dirname(entry),p))));
 await fs.writeFile(file,text);
 const module=await import(pathToFileURL(file).href),actual=module.createGamingLounge({root},null,{still:true});
 assert.equal(signature(actual.group),signature(expected.group),mode+' geometry differs');
 assert.equal(actual.group.children.filter(o=>o.material?.name==='Gaming_lounge_screen').length,1,'Screens must stay in one material batch');
}
assert(geometryRecords().size>0);delete globalThis.document;
console.log('Gaming lounge: authoring, prepared and public screen geometry matches the source.');
