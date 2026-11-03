import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {preparedManifest} from './prepared-patch-v2.mjs';
const root='output/leo-interior-v02',base=root+'/fast-base',before=await preparedManifest(base+'/prepared-walk'),after=await preparedManifest(root+'/prepared-walk'),rooms=new Set(after.fastPatch?.rooms||[]);
assert(rooms.size,'No room patch to compare');
const report={status:'FAIL',rooms:[...rooms],unchangedChunks:0,unchangedArrays:before.arrays.length,unchangedGeometries:before.geometries.length,modelBuffers:[]};
for(const p of before.parts){assert((await fs.readFile(base+'/prepared-walk/'+p.name)).equals(await fs.readFile(root+'/prepared-walk/'+p.name)),p.name);report.unchangedChunks++;}
assert.deepEqual(after.arrays.slice(0,before.arrays.length),before.arrays);assert.deepEqual(after.geometries.slice(0,before.geometries.length),before.geometries);
for(const key of ['bands','haze','facade','lounge','frost','privacy','ship','skinAuthority','retirements','roomFeatureSupports','signs','geometryTemplates'])assert.deepEqual(after[key],before[key],key);
const nodes=new Map(after.source.nodes.map(n=>[n.uuid,n]));for(const n of before.source.nodes){if(n.userData?.ownerRuns?.some(r=>rooms.has(r.room)||rooms.has(r.component)))continue;assert.deepEqual(nodes.get(n.uuid),n,'Unchanged source node '+n.name);}
const items=col=>col.groups.flatMap(g=>g.items.filter(i=>!rooms.has(i.owner)).map(i=>JSON.stringify({bvh:g.bvh,owner:i.owner,matrix:i.matrix,inverse:i.inverse,box:i.box}))).sort();
assert.deepEqual(items(after.colliders),items(before.colliders),'Unchanged collision instances');assert.deepEqual(items(after.colliders.ground),items(before.colliders.ground),'Unchanged ground instances');
assert.deepEqual(after.colliders.bands,before.colliders.bands);assert.deepEqual(after.colliders.ground.bands,before.colliders.ground.bands);assert.deepEqual(after.colliders.movers,before.colliders.movers);
assert.deepEqual(after.rest.filter(s=>!rooms.has(s.room)),before.rest.filter(s=>!rooms.has(s.room)));
const bin=b=>b.subarray(28+b.readUInt32LE(12));
for(const f of (await fs.readdir(base)).filter(f=>f.endsWith('.glb'))){const a=await fs.readFile(base+'/'+f),b=await fs.readFile(root+'/'+f),old=bin(a),next=bin(b);assert(next.subarray(0,old.length).equals(old),'Original model vertex buffer changed: '+f);report.modelBuffers.push({file:f,originalBufferBytes:old.length,byteExactPrefix:true});}
report.status='PASS';const tag=process.env.LEO_FAST_TAG||'last';await fs.writeFile('output/fast-deploy/'+tag+'-preservation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
