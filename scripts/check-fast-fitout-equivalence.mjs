import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import layout from '../src/plan/selected-layout.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {buildPhase4Fitout,addPhase4Colliders} from '../src/v2/phase4-fitout.js';
import {PreparedWriter} from '../src/v2/prepared-codec.js';
import {onePassAtriumGlass} from '../src/v2/atrium-visibility.js';
import {Colliders} from '../src/walk/collision.js';
import {solidSpots} from '../src/walk/rest.js';
import {preparedManifest,preparedArrayReader} from './prepared-patch-v2.mjs';
const tag=process.env.LEO_FAST_TAG||'round2-equivalence',base='output/leo-interior-v02',plan=JSON.parse(await fs.readFile('output/fast-deploy/plan.json')),rooms=new Set(plan.rooms),start=performance.now();
installWalkCanvas(createCanvas);const ship={inside:new T.Group()},fit=buildPhase4Fitout(ship,layout),writer=new PreparedWriter(),nodes=[];
for(const root of fit.roots)onePassAtriumGlass(root);
for(const root of fit.roots)for(const child of root.children)if(child.isInstancedMesh)nodes.push(...writer.graph(child).nodes);
const col=new Colliders(),ground=new Colliders();addPhase4Colliders(ship,col,ground);const collision=writer.colliders(col),groundCollision=writer.colliders(ground);
const full={source:{nodes},arrays:writer.arrays,geometries:writer.geometries,materials:writer.materials,colliders:{...collision,ground:groundCollision}},patch=await preparedManifest(base+'/prepared-walk');
const fullRead=async id=>writer.arrays[id],patchRead=preparedArrayReader(patch,base+'/prepared-walk'),sha=x=>createHash('sha256').update(x).digest('hex');
function normalize(value){if(typeof value==='number'&&value===0)return 0;if(Array.isArray(value))return value.map(normalize);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['uuid','metadata'].includes(k)).map(([k,v])=>[k,normalize(v)]));return value;}
async function rows(m,read){
 const geometry=new Map(),g=async id=>{if(geometry.has(id))return geometry.get(id);const a=m.geometries[id],row={attributes:{}};for(const[k,v]of Object.entries(a.attributes).sort())row.attributes[k]=[v.itemSize,Array.from(await read(v.array))];if(a.index!==null)row.index=Array.from(await read(a.index));const s=sha(JSON.stringify(row));geometry.set(id,s);return s;};
 const meshes=[];for(const n of m.source.nodes){if(!n.userData?.phase4||!n.userData.ownerRuns?.some(r=>rooms.has(r.room)))continue;const matrices=await read(n.instanceMatrix),geometry=await g(n.geometry),material=normalize(m.materials[n.material]);for(const run of n.userData.ownerRuns)if(rooms.has(run.room))for(let i=run.start;i<run.start+run.count;i++)meshes.push(sha(JSON.stringify({name:n.name,room:run.room,component:run.component,geometry,material,matrix:Array.from(matrices.subarray(i*16,i*16+16))})));}
 const colliders=async c=>{const rows=[];for(const group of c.groups)if(group.items.some(i=>rooms.has(i.owner))){const geometry=await g(group.bvh.geometry);for(const i of group.items)if(rooms.has(i.owner))rows.push(sha(JSON.stringify({owner:i.owner,geometry,matrix:i.matrix,inverse:i.inverse,box:i.box})));}return rows.sort();};
 return {meshes:meshes.sort(),collision:await colliders(m.colliders),ground:await colliders(m.colliders.ground)};
}
const a=await rows(full,fullRead),b=await rows(patch,patchRead);
const rest=fit.rests.filter(s=>rooms.has(s.room)).map(s=>({...s,point:new T.Vector3(...s.point),...(s.facing?{facing:new T.Vector3(...s.facing)}:{}),...(s.head?{head:new T.Vector3(...s.head)}:{})}));
const sortRest=list=>list.map(normalize).sort((a,b)=>String(a.id).localeCompare(String(b.id)));a.rests=sortRest(writer.value(rest));b.rests=sortRest(patch.rest.filter(s=>s.phase4&&rooms.has(s.room)));a.seats=solidSpots(rest,col).map(s=>s.id).sort();b.seats=patch.seats.map(i=>patch.rest[i]).filter(s=>s.phase4&&rooms.has(s.room)).map(s=>s.id).sort();
const result={scope:'Full Phase 4/6 fitout producer, not a full ship authoring/build comparison',tag,rooms:[...rooms],status:'FAIL',seconds:0,fullProducerParts:fit.parts.length};
try{assert.deepEqual(b,a);result.status='PASS';result.counts=Object.fromEntries(Object.entries(a).map(([k,v])=>[k,v.length]));}finally{result.seconds=(performance.now()-start)/1000;await fs.writeFile('output/fast-deploy/'+tag+'-full-fitout-comparison.json',JSON.stringify(result,null,2));console.log(result);}
