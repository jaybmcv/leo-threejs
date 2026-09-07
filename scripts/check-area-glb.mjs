import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SHIP_AREAS} from '../src/areas.js';
const bytes=await fs.readFile('output/leo-interior-v01/leo-service-areas.glb');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
let areas=0,lifeboats=0,lifeboatSeats=0,shuttles=0;
gltf.scene.traverse(o=>{
 const a=gltf.parser.associations.get(o),name=a?.nodes!==undefined?gltf.parser.json.nodes[a.nodes].name:o.name;
 if(/^Area_d\d{2}-/.test(name||''))areas++;
 if(name==='Lifeboat_floor')lifeboats++;
 if(name==='Evacuation_seat'){assert.ok(o.isInstancedMesh);lifeboatSeats+=o.count;}
 if(name==='Transfer_shuttle')shuttles++;
});
assert.equal(areas,SHIP_AREAS.length);assert.equal(lifeboats,100);assert.equal(lifeboatSeats,10000);assert.equal(shuttles,4);
const report={status:'PASS',areas,lifeboats,lifeboatSeats,shuttles,scope:'Reloaded exported GLB, including physical evacuation-seat instances.'};
await fs.writeFile('output/leo-interior-v01/area-roundtrip.json',JSON.stringify(report,null,2));console.log(report);
