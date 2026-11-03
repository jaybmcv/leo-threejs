import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {geometryIdentity,sha} from './fast-dependencies-v2.mjs';
import {compatiblePreparedSources,matchesExactPreparedMigration,requirePreparedFresh} from './prepared-identity-v2.mjs';
const record=(version,files)=>({version,files,hash:sha(JSON.stringify(files))});
const previous=record(1,{'src/model.js':sha('old'),'src/walk/main.js':sha('runtime')}),target=record(3,{'src/model.js':sha('new')});
const artifactSha256=sha('verified artifact'),options={artifactSha256},migration={format:'leo-exact-prepared-migration-v1',sourceHash:previous.hash,artifactSha256,targetVersion:3,targetFiles:['src/model.js'],pairs:{'src/model.js':{before:previous.files['src/model.js'],after:target.files['src/model.js']}}};
let checks=0;const check=(test,message)=>{assert(test,message);checks++;},match=(a=previous,b=target,m=migration,o=options)=>matchesExactPreparedMigration(a,b,m,o);
check(match(),'Exact artifact/source migration accepted');
check(!match(previous,target,migration,{}),'Legacy design migration requires artifact evidence');
check(!match(previous,target,migration,{artifactSha256:sha('other')}),'Wrong artifact rejected');
check(!match({...previous,hash:sha('forged')}),'Forged previous identity rejected');
check(!match(previous,{...target,hash:sha('forged')}),'Forged current identity rejected');
check(!match({...previous,version:2}),'Later incompatible schema rejected');
check(!match(previous,record(3,{'src/model.js':sha('later edit')})),'Later producer edits rejected');
check(!match(previous,record(3,{})),'Missing producer rejected');
check(!match(previous,record(3,{...target.files,'src/new.js':sha('new')})),'New producer rejected');
check(!match(previous,target,{...migration,targetVersion:2}),'Wrong target version rejected');
check(!match(previous,target,{...migration,pairs:{}}),'Unapproved changed row rejected');
const current=await geometryIdentity();
for(const runtime of ['src/walk/main.js','src/walk/main.authoring.js','src/walk/main.prepared.js','src/walk/main.public.js','src/walk/graphics-settings.js','src/v2/atrium-quality.js','src/v2/atrium-geometry-quality.js','src/v2/atrium-geometry-runtime.js','src/v2/atrium-geometry-pack.js','src/v2/atrium-geometry-transport.js'])check(!(runtime in current.files),'Runtime edit enters geometry identity: '+runtime);
for(const producer of ['src/model.js','src/plan/layout-v2.js','src/walk/prepare.authoring.js','package-lock.json','src/walk/assets/hydro-nip-main-logo.jpg']){
 check(producer in current.files,'Producer remains tracked: '+producer);
 const next=record(current.version,{...current.files,[producer]:sha('changed bytes')});check(!await compatiblePreparedSources(current,next),'Changed current producer rejected: '+producer);
}
check(await compatiblePreparedSources(current,current),'Exact modern identity remains reusable');
const file='output/leo-interior-v02/prepared-walk/integrity.json',bytes=await fs.readFile(file),artifact=JSON.parse(bytes),compatible=await compatiblePreparedSources(artifact.sourceInputs.sources,current,{artifactSha256:artifact.sha256});
if(compatible)check((await requirePreparedFresh()).sha256===artifact.sha256,'Fresh artifact accepted');else{await assert.rejects(()=>requirePreparedFresh(),/Prepared geometry changed/);checks++;}
check((await fs.readFile(file)).equals(bytes),'Freshness checks do not rewrite provenance');
console.log(JSON.stringify({status:'PASS',checks,geometryInputs:Object.keys(current.files).length,artifact:artifact.sha256,currentArtifactCompatible:compatible,currentGeometry:current.hash},null,2));
