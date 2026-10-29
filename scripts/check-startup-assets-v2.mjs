import './v2-output.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import{startupPublicIdentity}from'./startup-public-identity-v2.mjs';
const current=await startupPublicIdentity();assert(current.artifact&&current.transportFiles>0);
const parent=path.resolve('output/phase3b/startup');await fs.mkdir(parent,{recursive:true});const fixture=await fs.mkdtemp(path.join(parent,'stale-public-'));
try{const manifest=JSON.parse(await fs.readFile('dist-v2/asset-manifest.json'));manifest['walk-prepared'].sha256='0'.repeat(64);await fs.writeFile(path.join(fixture,'asset-manifest.json'),JSON.stringify(manifest));await assert.rejects(startupPublicIdentity(fixture),/Stale public prepared world/);}
finally{await fs.unlink(path.join(fixture,'asset-manifest.json')).catch(e=>{if(e.code!=='ENOENT')throw e});await fs.rmdir(fixture);}
console.log('PASS: exact current public prepared bytes, HTML and bundle; stale-public negative rejected');
