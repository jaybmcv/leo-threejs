import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {geometryIdentity,sha} from './fast-dependencies-v2.mjs';
import {compatiblePreparedSources,requirePreparedFresh} from './prepared-identity-v2.mjs';

const file='output/leo-interior-v02/prepared-walk/integrity.json';
const bytes=await fs.readFile(file),artifact=JSON.parse(bytes),previous=artifact.sourceInputs.sources;
const current=await geometryIdentity(),options={artifactSha256:artifact.sha256};
let checks=0;const check=(condition,message)=>{assert(condition,message);checks++;};
const changed=(key,value)=>{const next=structuredClone(current);if(value===undefined)delete next.files[key];else next.files[key]=value;next.hash=sha(JSON.stringify(next.files));return next;};
check(await compatiblePreparedSources(previous,current,options),'Verified legacy artifact must accept the exact dependency-contract migration');
for(const runtime of ['src/walk/main.js','src/walk/main.authoring.js','src/walk/main.prepared.js','src/walk/main.public.js','src/walk/graphics-settings.js','src/v2/atrium-quality.js'])
 check(!(runtime in current.files),'Runtime edit must not enter geometry identity: '+runtime);
for(const producer of ['src/model.js','src/plan/layout-v2.js','src/walk/prepare.authoring.js','package-lock.json','src/walk/assets/hydro-nip-main-logo.jpg']){
 check(producer in current.files,'Producer must remain tracked: '+producer);
 check(!await compatiblePreparedSources(previous,changed(producer,sha('changed producer bytes')),options),'Changed producer must reject reuse: '+producer);
}
check(!await compatiblePreparedSources(previous,changed('src/v2/new-geometry-dependency.js',sha('new producer')),options),'New geometry dependency must reject reuse');
check(!await compatiblePreparedSources(previous,changed('src/model.js',undefined),options),'Removed geometry dependency must reject migration');
check(!await compatiblePreparedSources(previous,current,{artifactSha256:sha('another artifact')}),'Migration must be pinned to the exact prepared artifact');
check(!await compatiblePreparedSources(previous,current),'Legacy migration requires artifact evidence');
check(!await compatiblePreparedSources({...previous,hash:sha('another source')},current,options),'Forged legacy fingerprint must reject');
check(!await compatiblePreparedSources(previous,{...current,hash:sha('forged current')},options),'Forged current fingerprint must reject');
check(!await compatiblePreparedSources({...previous,version:2},current,options),'Migration cannot accept a later incompatible schema');
check(await compatiblePreparedSources(current,current),'A subsequent exact geometry fingerprint remains reusable');
check((await requirePreparedFresh()).sha256===artifact.sha256,'Normal freshness gate must accept the verified unchanged geometry');
check((await fs.readFile(file)).equals(bytes),'Freshness checks must not rewrite artifact provenance');
console.log(JSON.stringify({status:'PASS',checks,geometryInputs:Object.keys(current.files).length,artifact:artifact.sha256,legacySource:previous.hash,currentGeometry:current.hash,limitations:'Virtual changed-input records exercise migration rejection; live producer files and prepared metadata were not edited.'},null,2));
