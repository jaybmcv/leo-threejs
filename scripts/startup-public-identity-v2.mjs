import {rejectPreviewAcceptance} from './visual-preview-policy-v2.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{requirePreparedFresh}from'./prepared-identity-v2.mjs';
// The speed test must certify the prepared world that the geometry/flood gates
// inspect, rather than an older fast dist directory left behind by a rebuild.
export async function startupPublicIdentity(root='dist-v2'){
 const integrity=await requirePreparedFresh(),manifest=JSON.parse(await fs.readFile(path.join(root,'asset-manifest.json'))),entry=manifest['walk-prepared'];
 assert.equal(entry?.sha256,integrity.sha256,'Stale public prepared world: run LEO_LAYOUT=2 npm run build:public');
 assert(/^prepared-walk\/[a-f0-9]{20}\/$/.test(entry.directory),'Invalid public prepared directory');
 const html=await fs.readFile(path.join(root,'walk.html'),'utf8');rejectPreviewAcceptance(html);const match=html.match(/window[.]LEO_PUBLIC_ASSETS=(\{.*?\});<\/script>/),embedded=match&&JSON.parse(match[1]);
 assert.equal(embedded?.['walk-prepared']?.sha256,integrity.sha256,'Public HTML embeds a stale prepared world');
 const bundle=html.match(/walk[.][0-9a-f]{10}[.]js/g)?.at(-1);assert(bundle,'Public walk bundle missing');
 assert((await fs.readFile(path.join(root,bundle),'utf8')).includes(entry.directory),'Public bundle points to another prepared world');
 const copied=JSON.parse(await fs.readFile(path.join(root,entry.directory,'integrity.json')));assert.equal(copied.sha256,integrity.sha256);assert.deepEqual(copied.sourceInputs,integrity.sourceInputs);
 const hash=createHash('sha256');for(const name of [...integrity.files].sort()){assert(/^(geometry-\d+[.]bin|world[.]bin|world[.]json[.]gz)$/.test(name));hash.update(name);hash.update(await fs.readFile(path.join(root,entry.directory,name)));}
 assert.equal(hash.digest('hex'),integrity.sha256,'Public prepared transport bytes differ from the checked artifact');
 return{artifact:integrity.sha256,directory:entry.directory,bundle,sourceHash:integrity.sourceInputs.sources.hash,transportFiles:integrity.files.length};
}
if(process.argv[1]?.endsWith('startup-public-identity-v2.mjs'))console.log(await startupPublicIdentity());
