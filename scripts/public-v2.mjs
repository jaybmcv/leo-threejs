import {writeBuildInfo} from './build-info.mjs';
import {writeHubPage} from './hub-page.mjs';
import{v2ShipLogMedia}from'./v2-ship-log-media.mjs';
import {writeViewerLounge,VIEWER_LOUNGE} from './viewer-tour-assets-v2.mjs';
import {publicPreparedAdapters} from './public-walk-adapters-v2.mjs';
import{ensureV1Public}from'./v2-baseline-inputs.mjs';import{writeV2Cosmo}from'./v2-cosmo.mjs';
import {sharedModelTransport} from './shared-model-transport-v2.mjs';
import {copyPreparedWalk} from './prepared-public-v2.mjs';
import {publicV2Export} from './v2-public-export.mjs';
import {v2 as selectedV2} from './layout-selector.mjs';
if(!selectedV2)throw new Error('This producer requires LEO_LAYOUT=2');
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {writeWalkPage} from './walk-page.mjs';
import {writeViewerPageV2} from './viewer-page-v2.mjs';
await ensureV1Public();const source='output/leo-interior-v02',out='dist-v2',sha=b=>createHash('sha256').update(b).digest('hex');await fs.mkdir(out+'/models',{recursive:true});
const modelDir=path.resolve(out,'models');if(!modelDir.startsWith(process.cwd()+path.sep))throw Error('Model cleanup outside workspace');for(const name of await fs.readdir(modelDir))if(/(?:\.glb\.\d+|^(?:pool|recipe)\.[0-9a-f]+)\.bin$/.test(name))await fs.unlink(path.join(modelDir,name));
for(const name of await fs.readdir(out))if(/^(viewer|cosmo)\.[0-9a-f]{10}\.js$/.test(name)||/^layout\.[0-9a-f]+\.\d+\.bin$/.test(name))await fs.rm(out+'/'+name);
const cache=source+'/public-cache';await fs.mkdir(cache,{recursive:true});const packingHash=sha(Buffer.concat(await Promise.all(['scripts/v2-public-export.mjs','scripts/exact-exterior-compression-v2.mjs','package-lock.json'].map(f=>fs.readFile(f))))).slice(0,12);// All non-phone public exteriors use the finished web asset. The phone retains its own bounded skin.
const webBytes=await fs.readFile(source+'/leo-exterior-web.glb'),models=new Map(),byInput=new Map();for(const name of(await fs.readdir(source)).filter(n=>n.endsWith('.glb')).sort()){const raw=await fs.readFile(source+'/'+name),sourceSha256=sha(raw),input=name.startsWith('leo-exterior')&&!name.includes('phone')?webBytes:raw,inputHash=sha(input);let packed=byInput.get(inputHash);if(!packed){const file=cache+'/'+inputHash+'-'+packingHash+'.glb';try{packed=await fs.readFile(file)}catch{packed=await publicV2Export(input,{exactPositions:name.startsWith('leo-exterior')});await fs.writeFile(file,packed)}byInput.set(inputHash,packed)}models.set(name,{packed,rawBytes:raw.length,sourceSha256})}const manifest=await sharedModelTransport(models,out);
manifest[VIEWER_LOUNGE]=await writeViewerLounge({out,bytes:models.get('leo-full-ship.glb').packed,sourceHash:manifest['leo-full-ship.glb'].sha256});
await fs.writeFile(out+'/asset-manifest.json',JSON.stringify(manifest,null,2));
const cosmo=await writeV2Cosmo(out);
for(const file of ['THREE-LICENSE.txt'])await fs.copyFile(source+'/'+file,out+'/'+file).catch(()=>{});
await fs.cp('dist/brand',out+'/brand',{recursive:true});
const layout=JSON.parse(await fs.readFile(source+'/layout.json','utf8'));
await writeViewerPageV2(out,{layout,manifest});
manifest['walk-prepared']=await copyPreparedWalk(out);const logMedia=await v2ShipLogMedia(),walkResult=await writeWalkPage(out,{cosmo,manifest,preparedWalk:true,profileMap:true,sourceAdapters:publicPreparedAdapters,logMedia});console.log(walkResult);await fs.mkdir('output/phase7',{recursive:true});await fs.writeFile('output/phase7/ship-log-corpus-public.json',JSON.stringify({...walkResult.corpus,at:new Date().toISOString(),bundle:walkResult.walk,bundleSha256:sha(await fs.readFile(out+'/'+walkResult.walk))},null,2));manifest['layout-data']=JSON.parse(await fs.readFile(out+'/layout-data.json','utf8'));await fs.writeFile(out+'/asset-manifest.json',JSON.stringify(manifest,null,2));
// Local verifier page; the public walk still strips its debug hook.
const debug='output/leo-interior-v02/review';await fs.mkdir(debug,{recursive:true});const debugManifest=Object.fromEntries(Object.entries(manifest).map(([k,v])=>[k,{...v,parts:v.parts.map(p=>'/base/'+p),...(v.recipePart?{recipePart:'/base/'+v.recipePart}:{})}]));await fs.copyFile(out+'/'+cosmo,debug+'/'+cosmo);await fs.cp(out+'/brand',debug+'/brand',{recursive:true});await writeWalkPage(debug,{cosmo,manifest:debugManifest,debug:true,preparedWalk:true,sourceAdapters:publicPreparedAdapters,logMedia});
console.log('v2 public assets built locally in '+out);

const hub=await writeHubPage(out,{workspaceLocal:true});console.log(`Builder's Hub: ${hub.script}, ${(hub.bytes/1024).toFixed(0)} KB.`);
await writeBuildInfo(out);
