import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {geometryIdentity} from './fast-dependencies-v2.mjs';
import {classifyFastChange} from './fast-state-v2.mjs';
const before=await geometryIdentity();
for(const file of ['src/plan/layout-v2.js','scripts/hull-envelopes-v2.mjs','scripts/exterior-envelopes-v2.mjs','src/concept-paint.js','src/v2/signs.js','src/plan/signs-v2.js','src/walk/fin-casing.js','src/walk/windows.js','src/walk/lounge-floor.authoring.js','src/walk/lift-tile-floor.authoring.js','src/walk/assets/hydro-nip-main-logo.jpg','output/leo-interior-v01/leo-exterior.glb','output/leo-interior-v01/leo-exterior-refined.glb','output/leo-interior-v01/leo-exterior-web.glb','output/leo-interior-v01/leo-exterior-phone.glb'])assert(before.files[file],'Missing producer dependency '+file);
const logo='src/walk/assets/hydro-nip-main-logo.jpg',logoSource=await fs.readFile(logo);
try{await fs.appendFile(logo,Buffer.from([0]));assert.notEqual((await geometryIdentity()).hash,before.hash,'Baked image bytes must invalidate prepared geometry');}finally{await fs.writeFile(logo,logoSource);}
const hull='output/leo-interior-v01/leo-exterior-phone.glb',held=hull+'.fast-test-held';
await assert.rejects(fs.access(held),{code:'ENOENT'});
try{await fs.rename(hull,held);assert.equal((await classifyFastChange()).lane,'whole','Missing immutable inputs must reach the full restoration path');}finally{await fs.rename(held,hull);}
const file='src/plan/layout-v2.js',source=await fs.readFile(file);
try{await fs.appendFile(file,'\n// fast-deploy dependency regression fixture\n');assert.notEqual((await geometryIdentity()).hash,before.hash);}finally{await fs.writeFile(file,source);}
assert.equal((await geometryIdentity()).hash,before.hash);
const shared='src/v2/launch-e-fitout.js',sharedSource=await fs.readFile(shared);
try{await fs.appendFile(shared,'\n// shared shell dependency fixture\n');assert.equal((await classifyFastChange()).lane,'whole','A module also used by shell builders must not be treated as descriptor-only');}finally{await fs.writeFile(shared,sharedSource);}
const rooms='src/plan/rooms.js',original=await fs.readFile(rooms,'utf8'),needle="export function toLocal(id,p){return new T.Vector3(...p).applyMatrix4(matrix(frame(id)).invert()).toArray();}";
assert(original.includes(needle));
const output='output/fast-deploy/coordinate-policy-fixture.json',code=`import fs from 'node:fs/promises';import layout from './src/plan/selected-layout.js';import{liveLayoutIdentity}from'./scripts/live-layout-identity.mjs';await fs.writeFile(${JSON.stringify(output)},JSON.stringify(await liveLayoutIdentity(layout)));`;
try{
 await fs.writeFile(rooms,original.replace(needle,needle.replace('.toArray();','.add(new T.Vector3(.1,0,0)).toArray();')));
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{stdio:'inherit',windowsHide:true});assert.equal(child.status,0);
 const actual=JSON.parse(await fs.readFile(output)),baseline=JSON.parse(await fs.readFile('src/plan/live-protocol-baseline-v2.json'));
 assert.notEqual(actual.layoutIdentity,baseline.layoutIdentity,'toLocal-only policy edit must require a server update');
}finally{await fs.writeFile(rooms,original);}
try{
 await fs.writeFile(rooms,original.replace(/\r\n/g,'\n'));
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{stdio:'inherit',windowsHide:true});assert.equal(child.status,0);
 const actual=JSON.parse(await fs.readFile(output)),baseline=JSON.parse(await fs.readFile('src/plan/live-protocol-baseline-v2.json'));
 assert.equal(actual.layoutIdentity,baseline.layoutIdentity,'Checkout line endings must not require a server update');
}finally{await fs.writeFile(rooms,original);}
console.log('PASS: layout producer transitive dependencies and toLocal-only policy invalidation; source fixtures restored');
