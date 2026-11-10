import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from './native-bundle.mjs';
import {v2Plugin} from './v2-plugin.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const logic=['src/walk/net/panel-rules.js','server/lever-panel.mjs','src/v2/live-spatial.js','src/v2/activity-layout.js','src/walk/pool/rules.js',
 'src/walk/maze/layout.js','src/walk/aquarium-treasure/layout.js',
 // These implement shared coordinate transforms and moving-game rules, not
 // merely their serialized start positions. A toLocal-only edit must differ.
 'src/plan/rooms.js','src/walk/lifts.js','src/walk/lift-motion.js',
 'src/walk/hamster-ball.js','src/walk/net/wire.js','package-lock.json'];
const memo=new Map();

export async function liveProtocolSnapshot(layout){
 const code=await build({entryPoints:['src/v2/live-spatial.js'],bundle:true,platform:'node',format:'esm',write:false,
  plugins:[v2Plugin(layout,{node:true,identityProbe:true})]});
 const bytes=code.outputFiles[0].contents,dir='output/fast-deploy/live-protocol';await fs.mkdir(dir,{recursive:true});
 const file=path.resolve(dir,sha(bytes)+'.mjs');await fs.writeFile(file,bytes);
 const {spatial}=await import(pathToFileURL(file).href);
 const data=JSON.parse(JSON.stringify(spatial,(key,value)=>['identity','name'].includes(key)?undefined:value));
 const functions={};for(const f of logic)functions[f]=sha((await fs.readFile(f,'utf8')).replace(/\r\n?/g,'\n'));
 // Policy bodies/helpers are covered by these source hashes. Function#toString
 // of bundled output would make esbuild-generated aliases part of the protocol.
 return {data,functions};
}

export async function liveLayoutIdentity(layout){
 const key=sha(JSON.stringify(layout)+JSON.stringify(await Promise.all(logic.map(f=>fs.readFile(f,'utf8')))));
 if(!memo.has(key))memo.set(key,(async()=>{
  const snapshot=await liveProtocolSnapshot(layout),basis=sha(JSON.stringify(snapshot));
  const baseline=JSON.parse(await fs.readFile('src/plan/live-protocol-baseline-v2.json','utf8'));
  const unchanged=basis===baseline.basis;
  return {layout:2,layoutIdentity:unchanged?baseline.layoutIdentity:sha('leo-live-protocol-v2:'+basis),protocolBasis:basis,
   protocolChanged:!unchanged,changedSections:Object.keys(snapshot.data).filter(k=>JSON.stringify(snapshot.data[k])!==JSON.stringify(baseline.snapshot.data[k]))};
 })());
 return memo.get(key);
}
