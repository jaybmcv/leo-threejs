// Public v2 contract; never invokes a model build or the full validation.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicAsset} from '../src/v2/public-assets.js';
const out='dist-v2',manifest=JSON.parse(await fs.readFile(out+'/asset-manifest.json'));
globalThis.window={LEO_PUBLIC_ASSETS:manifest};const nativeFetch=globalThis.fetch;globalThis.fetch=async name=>String(name).startsWith('data:')?nativeFetch(name):new Response(await fs.readFile(path.join(out,name.split('?')[0])));
let assets=0,parts=0;for(const [name,entry] of Object.entries(manifest)){
 for(const part of entry.parts||[]){assert((await fs.stat(path.join(out,part.split('?')[0]))).size<=16*1048576,'Transport too large: '+part);parts++;}
 if(!name.endsWith('.glb'))continue;const bytes=await publicAsset(name);assert.equal(createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),entry.sha256,name);assets++;
}
const html=await fs.readFile(out+'/index.html','utf8'),walk=await fs.readFile(out+'/walk.html','utf8'),hub=await fs.readFile(out+'/hub.html','utf8');
for(const id of ['share-view','save-picture','toggle-panels','walk-link','ship-stamp','build-stamp','safe-start'])assert(html.includes('id="'+id+'"'),id);
assert(html.includes('hub.html'));const script=html.match(/LEO_V2_BOOT\('([^']+)'\)/)?.[1];assert(script,'Hashed v2 viewer entry');assert(/^viewer\.[0-9a-f]{10}\.js$/.test(script));const code=await fs.readFile(out+'/'+script,'utf8');assert(code.includes('leo-feedback'),'Tester feedback bundled');
const walkScript=walk.match(/LEO_WALK_BOOT\("([^" ]+)"\)/)?.[1];assert(walkScript);const walkCode=await fs.readFile(out+'/'+walkScript,'utf8');assert(!walkCode.includes('__walk'),'No debug hooks in public walk');const cosmo=walkCode.match(/cosmo\.[0-9a-f]{10}\.js/)?.[0];assert(cosmo);await fs.access(out+'/'+cosmo);assert(!walkCode.includes('createDLCat('));
assert(walk.includes('LEO_TO_HUB')&&walk.indexOf('LEO_TO_HUB')<800);assert(walk.includes('Loading the prepared ship'));assert(!walk.includes('This computer will take a few minutes'));
const hubScript=hub.match(/src="(hub\.[0-9a-f]{10}\.js)"/)?.[1];assert(hubScript);await fs.access(out+'/'+hubScript);
const info=JSON.parse(await fs.readFile(out+'/build.json'));assert(info.sha===null||/^[0-9a-f]{40}$/.test(info.sha));assert(!(info.dirty&&info.sha),'Dirty build must not claim a commit');
for(const doc of [html,walk,hub])for(const m of doc.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)){const target=m[1].split('?')[0].split('#')[0];if(!target||/^(https?:|#)/.test(target)||manifest[target])continue;await fs.access(path.join(out,target));}
const size=async dir=>(await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?size(path.join(dir,e.name)):fs.stat(path.join(dir,e.name)).then(s=>s.size)))).reduce((a,b)=>a+b,0);const bytes=await size(out);assert(bytes<=250000000,'Public folder exceeds 250 MB');
console.log(JSON.stringify({status:'PASS',assets,parts,publicBytes:bytes,viewer:script,walk:walkScript,hub:hubScript,build:info}));
