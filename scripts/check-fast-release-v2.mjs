import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicDirectoryBytes} from './public-bytes-v2.mjs';
import {readPublicPreparedFile} from './prepared-public-v2.mjs';
import {stageTimer} from './fast-timing.mjs';
import {checkFastPatchCollision} from './fast-collision-v2.mjs';
const out='dist-v2',tag=process.env.LEO_FAST_TAG||'last',timer=stageTimer({file:'output/fast-deploy/'+tag+'-check-timing.json',label:'fast release checks'}),sha=b=>createHash('sha256').update(b).digest('hex');
const report={status:'FAIL',gates:{}};
const local=file=>{const target=path.resolve(out,file.split('?')[0]);if(!target.startsWith(path.resolve(out)+path.sep))throw Error('Asset points outside public output: '+file);return target;};
try{
 const manifest=JSON.parse(await fs.readFile(out+'/asset-manifest.json','utf8'));
 await timer.stage('artifact integrity',async()=>{
  const prepared=manifest['walk-prepared'];assert(prepared?.directory,'No prepared walk in public manifest');
  const directory=local(prepared.directory),integrity=JSON.parse(await fs.readFile(path.join(directory,'integrity.json'),'utf8')),h=createHash('sha256');
  for(const name of [...integrity.files].sort()){assert(/^(geometry-\d+\.bin|world\.bin|world\.json\.gz)$/.test(name));const bytes=await readPublicPreparedFile(directory,name,prepared.metadataFile);assert(bytes.length,'Empty prepared payload '+name);h.update(name).update(bytes);}
  assert.equal(h.digest('hex'),integrity.sha256);assert.equal(integrity.sha256,prepared.sha256);
  const localIntegrity=JSON.parse(await fs.readFile('output/leo-interior-v02/prepared-walk/integrity.json','utf8'));
  assert.equal(integrity.sha256,localIntegrity.sha256,'Public prepared payload differs from the locally validated geometry');
  for(const file of new Set(Object.values(manifest).flatMap(v=>v.parts||[]))){const bytes=await fs.readFile(local(file));assert(bytes.length,'Empty public asset '+file);const pin=/\/(?:pool|recipe)\.([a-f0-9]{20})\.bin$/.exec(file);if(pin)assert.equal(sha(bytes).slice(0,20),pin[1],file);}
  report.gates.artifact=integrity.sha256;
 });
 await timer.stage('public size and phone hull limits',async()=>{
  const size=await publicDirectoryBytes(out);assert(size.bytes<=250000000,`Public output ${size.bytes} exceeds 250000000 bytes`);
  const bytes=await fs.readFile('output/leo-interior-v02/leo-exterior-phone.glb'),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));let triangles=0;
  for(const n of gltf.nodes||[]){if(n.mesh===undefined)continue;const instances=n.extensions?.EXT_mesh_gpu_instancing?.attributes;const count=instances?gltf.accessors[Object.values(instances)[0]].count:1;for(const p of gltf.meshes[n.mesh].primitives)if((p.mode??4)===4)triangles+=(p.indices===undefined?gltf.accessors[p.attributes.POSITION].count:gltf.accessors[p.indices].count)/3*count;}
  assert(triangles<=750000,`Phone hull has ${triangles} triangles, limit 750000`);report.gates.bytes=size.bytes;report.gates.phoneTriangles=triangles;
 });
 await timer.stage('built site names real files',async()=>{
  for(const page of ['index.html','walk.html','hub.html']){const text=await fs.readFile(out+'/'+page,'utf8'),files=[...text.matchAll(/(?:src|href)=["']([^"'#?]+)/g)].map(m=>m[1]);if(page==='walk.html')files.push(...[...text.matchAll(/LEO_WALK_BOOT\(["']([^"']+)/g)].map(m=>m[1]));for(const file of files)if(!/^(https?:|data:|mailto:|\/\/)/.test(file)&&!file.endsWith('/')){const name=file.replace(/^\.\//,'');if(manifest[name]?.parts?.length)continue;await fs.access(local(name));}}
  const files=(await fs.readdir(out)).filter(n=>/^walk\.[a-f0-9]{10}\.js$/.test(n));assert.equal(files.length,1,'Expected exactly one current walk script');
  const code=await fs.readFile(out+'/'+files[0],'utf8');assert(code.includes('leo-live.marscatsvoyage.com'),'Public walk lacks multiplayer');assert(code.includes('mcv-feedback.mcv-feedback.workers.dev'),'Public walk lacks feedback');report.gates.walk=files[0];
 });
 await timer.stage('changed-room encoded collision probes',async()=>{report.gates.collision=await checkFastPatchCollision();});
 await timer.stage('server layout identity',async()=>{
  const built=JSON.parse(await fs.readFile(out+'/live-layout.json','utf8')),fixture=process.argv.find(a=>a.startsWith('--health-file='))?.slice(14);
  const health=fixture?JSON.parse(await fs.readFile(fixture,'utf8')):await fetch('https://leo-live.marscatsvoyage.com/health',{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('Leo live health HTTP '+r.status);return r.json();});
  if(health.layoutIdentity!==built.layoutIdentity)throw Error(`SERVER UPDATE REQUIRED: built layoutIdentity ${built.layoutIdentity}; server ${health.layoutIdentity||'missing'}. Changed protocol sections: ${(built.changedSections||[]).join(', ')||'shared rules'}. On the server PC update code/dependencies and matching output/leo-interior-v02/layout.json, restart LeoLive, then retry. No site was published.`);
  report.gates.server={layoutIdentity:built.layoutIdentity,verification:fixture?'local fixture; real server NOT verified':'live health endpoint'};
 });
 report.status='PASS';
}finally{await timer.finish();await fs.writeFile('output/fast-deploy/'+tag+'-release-checks.json',JSON.stringify(report,null,2));}
