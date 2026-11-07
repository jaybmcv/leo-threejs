// The atrium PVS key (src/v2/atrium-pvs-key.js) of a prepared walk, decoded in Node: the public build ships a PVS only
// for the walk it was baked from, and the bake (scripts/walk-atrium-pvs.mjs) records the same key.
//   node scripts/atrium-pvs-source.mjs <prepared-walk dir> [--layout=<layout.json>] [--pvs=<atrium pvs.json>]
// prints the key, and with --pvs whether that data fits.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
// The layout and walk modules load only when a key is wanted: src/v2/atrium-sight.js reads this checkout's layout.json
// as it loads, and builds without one must not fail on that.
const modules=async()=>({...await import('../src/plan/runtime-layout.js'),...await import('../src/v2/atrium-sight.js'),...await import('../src/v2/atrium-pvs-key.js'),...await import('../src/walk/lifts.js')});

export const PVS_LAYOUT='output/leo-interior-v02/layout.json',PVS_PREPARED='output/leo-interior-v02/prepared-walk';
// Where the public build looks for baked data, by key: <key>.json in the directory (where a bake can write without a
// commit), then the file committed with the source.
export const PVS_BAKED_DIR='output/leo-interior-v02/atrium-pvs',PVS_COMMITTED='src/walk/assets/atrium-pvs.json';
const sha=data=>createHash('sha256').update(data).digest('hex');

/** The bake's setup for this layout.json text (see pvsSetup). */
export async function layoutPvsSetup(layoutText){
 const {selectedRuntimeLayout,atriumEnvelope,pvsSetup,shutLandingDoors}=await modules(),layout=selectedRuntimeLayout(JSON.parse(layoutText));
 return pvsSetup(layout,atriumEnvelope(layout),shutLandingDoors());
}

/** The prepared walk's integrity hash, or null for a copy without integrity.json (a mirror that fetched only what the
 * walk loads). */
export const preparedIntegrity=dir=>fs.readFile(path.join(dir,'integrity.json'),'utf8').then(t=>JSON.parse(t).sha256||null,()=>null);

/** colliderDigest of the prepared walk in `dir` (as authored, or as published with world.parts.json). Decoding takes
 * about 20 s, so the digest is kept by the walk's integrity hash and the decoding and hashing code's. */
export async function preparedDigest(dir){
 const names=await fs.readdir(dir),metadataName=['sections.json','world.parts.json','world.bin','world.json.gz'].find(n=>names.includes(n));
 if(!metadataName)throw Error('No prepared walk metadata in '+dir);
 const integrity=await preparedIntegrity(dir);
 const code=sha(Buffer.concat(await Promise.all(['../src/v2/atrium-pvs-key.js','../src/v2/prepared-codec.public.js','../package-lock.json'].map(f=>fs.readFile(new URL(f,import.meta.url))))));
 // A cached digest is whole runs of 32 hex digits joined by dots (written by rename, so a stopped write leaves none).
 const cache=path.join(PVS_BAKED_DIR,'digests',integrity+'-'+code.slice(0,16)+'.txt'),cached=integrity&&await fs.readFile(cache,'utf8').catch(()=>null);
 if(cached&&/^(?:[0-9a-f]{32})+(?:\.(?:[0-9a-f]{32})+)*$/.test(cached))return cached;
 const {readPreparedWorld}=await import('../src/v2/prepared-codec.public.js'),{colliderDigest}=await modules();
 const {ship}=await readPreparedWorld(pathToFileURL(path.resolve(dir)+path.sep),{skipImages:true,metadataName,fetchBytes:n=>fs.readFile(path.join(dir,n))});
 const digest=colliderDigest(ship.v2PreparedColliders);
 if(integrity){await fs.mkdir(path.dirname(cache),{recursive:true});await fs.writeFile(cache+'.part',digest);await fs.rename(cache+'.part',cache);}
 return digest;
}
export const preparedPvsKey=async(dir,layoutText)=>(await modules()).pvsKey(await preparedDigest(dir),await layoutPvsSetup(layoutText));

/** The baked PVS text for `key` from PVS_BAKED_DIR or PVS_COMMITTED, or null with the reason. */
export async function bakedPvs(key,{dir=PVS_BAKED_DIR,committed=PVS_COMMITTED}={}){
 const found=await fs.readFile(path.join(dir,key+'.json'),'utf8').catch(()=>null);
 if(found!==null&&JSON.parse(found).source?.key===key)return {text:found,reason:null};
 const text=await fs.readFile(committed,'utf8').catch(()=>null),made=text&&JSON.parse(text).source?.key;
 return made===key?{text,reason:null}:{text:null,reason:'no atrium PVS baked for '+key+(made?' ('+committed+' is for '+made+')':'')};
}

/** For the public build: the PVS that fits the prepared walk it publishes, or none (the sight rays answer) with the
 * reason. A failure here never fails the build; it only costs the PVS. */
export async function publishedPvs({prepared=PVS_PREPARED,layoutText,expectedSha256}){
 try{
  const integrity=await preparedIntegrity(prepared);
  if(expectedSha256&&integrity!==expectedSha256)return {key:null,text:null,reason:'prepared walk '+integrity+' is not the published '+expectedSha256};
  const key=await preparedPvsKey(prepared,layoutText);
  return {key,...await bakedPvs(key)};
 }catch(e){return {key:null,text:null,reason:'atrium PVS key failed: '+e.message};}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
 const dir=process.argv.slice(2).find(a=>!a.startsWith('--'))??PVS_PREPARED;
 const started=Date.now(),key=await preparedPvsKey(dir,await fs.readFile(arg('layout',PVS_LAYOUT),'utf8'));
 console.log(key,((Date.now()-started)/1000).toFixed(1)+' s');
 if(arg('pvs',null)){const text=await fs.readFile(arg('pvs'),'utf8'),made=JSON.parse(text).source?.key;console.log(made===key?'PVS fits':'PVS was baked for '+made);}
 else{const {reason}=await bakedPvs(key);console.log(reason??'a baked PVS fits');}
}
