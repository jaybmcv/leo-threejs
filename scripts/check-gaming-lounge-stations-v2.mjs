import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {v1Frame,resolveRoomFrames} from '../src/plan/rooms.js';
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
const starts=fit.children.map((o,i)=>o.name==='Lounge_screen_frame'?i:-1).filter(i=>i>=0);
const stations=starts.map((i,j)=>fit.children.slice(i,starts[j+1]??fit.children.length));
const bounds=objects=>objects.map(o=>new T.Box3().setFromObject(o));
const boxes=stations.map(bounds),wall=bounds(fit.children.slice(0,starts[0]));
const gap=(a,b)=>Math.hypot(Math.max(0,a.min.x-b.max.x,b.min.x-a.max.x),Math.max(0,a.min.z-b.max.z,b.min.z-a.max.z));
let clearance=Infinity;
for(let i=1;i<4;i++)for(const a of boxes[i]){
 for(const b of wall)clearance=Math.min(clearance,gap(a,b));
 for(let j=0;j<i;j++)for(const b of boxes[j])clearance=Math.min(clearance,gap(a,b));
 // Reserve the complete planned doorway, plus the required clear floor on its room side.
 const d=plan.door,b=new T.Box3(new T.Vector3(d.center[0]-d.width/2,plan.y,d.center[2]),new T.Vector3(d.center[0]+d.width/2,plan.y+3,d.center[2]));
 assert(gap(a,b)>=2.5,'Station reaches the doorway approach');
 // Hull-facing polygon edges carry the windows; use each part's own height slice.
 const slice=plan.envelope.find(s=>a.max.y-plan.y<=s.rise+s.height+.001)||plan.envelope.at(-1);
 for(let k=0;k<slice.polygon.length-1;k++){
  const p=slice.polygon[k],q=slice.polygon[k+1];if(p[1]>plan.z-8||q[1]>plan.z-8)continue;
  const edge=new T.Box3(new T.Vector3(Math.min(p[0],q[0]),0,Math.min(p[1],q[1])),new T.Vector3(Math.max(p[0],q[0]),0,Math.max(p[1],q[1])));
  assert(gap(a,edge)>=2.5,'Station reaches the windows');
 }
}
assert(clearance>=2.5,`Only ${clearance.toFixed(3)} m between furniture`);
const floor=new T.Mesh(new T.BoxGeometry(48,.2,32),new T.MeshBasicMaterial());floor.position.set(plan.x,plan.y-.1,plan.z-8);root.add(floor);
const colliders=new Colliders();colliders.addStatic(root);colliders.commit();
const spots=solidSpots(findRestSpots(root),colliders);
for(const seat of seats){const O=new T.Vector3().setFromMatrixPosition(seat.matrixWorld);assert(spots.some(s=>s.kind==='sit'&&Math.abs(s.point.x-(O.x-3.7))<.5&&Math.abs(s.point.z-O.z)<.5),'Missing solid couch seat');}
const cat=new Controller(colliders),walk=(from,wish,seconds)=>{cat.place(new T.Vector3(...from));for(let i=0;i<seconds*120;i++)cat.step(1/120,new T.Vector3(...wish),false);return cat.position.clone();};
for(const seat of seats){
 const O=new T.Vector3().setFromMatrixPosition(seat.matrixWorld),start=[O.x-5.7,plan.y,O.z];
 const hit=walk(start,[3,0,0],2);assert(hit.x<O.x-4.5,'Cat walked through a couch');assert(hit.x>start[0]+.5,'Approach already blocked');
 const away=walk(hit.toArray(),[-3,0,0],.5);assert(away.x<hit.x-1,'Cat cannot walk away');
}
console.log(`Gaming lounge: four shared stations, solid seats and colliders; ${clearance.toFixed(3)} m minimum furniture clearance.`);

// Record the authoring templates, then replay the same group in both visitor variants.
globalThis.document={createElement:()=>createCanvas(1,1)};
const signature=group=>{const h=createHash('sha256');group.traverse(o=>{if(!o.geometry)return;h.update(o.name);for(const a of Object.values(o.geometry.attributes))h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));if(o.geometry.index)h.update(Buffer.from(o.geometry.index.array.buffer));});return h.digest('hex');};
const expected=createGamingLounge({root},null,{still:true});
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
