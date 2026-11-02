import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {requireNativeRenderGates} from './render-gates-v2.mjs';
while(!await fs.access('output/launch-a/startup/launch-a-compact.json').then(()=>true,()=>false))await new Promise(r=>setTimeout(r,500));
const url='http://127.0.0.1:4202/walk.html?view=first&run=release';
for(const [label,file,args]of [
 ['native','scripts/launch-a-measure.mjs',['--url='+url,'--out=output/launch-a/complete-native']],
 ['surface','scripts/launch-a-traces.mjs',['--url='+url,'--out=output/launch-a/complete-surface','--mode=flicker']],
 ['walk','scripts/launch-a-traces.mjs',['--url='+url,'--out=output/launch-a/complete-walk','--mode=walk']],
 ['distance','scripts/launch-a-traces.mjs',['--url='+url,'--out=output/launch-a/complete-distance','--mode=distance']],
 ['cold','scripts/launch-a-cold.mjs',[]]]){console.log('START',label,new Date().toISOString());const r=spawnSync(process.execPath,[file,...args],{stdio:'inherit',windowsHide:true,env:{...process.env,LEO_RENDER_AFTER_PORT:'4202'}});if(r.status!==0)throw Error(label+' failed');console.log('END',label,new Date().toISOString());}
const gates=await requireNativeRenderGates(JSON.parse(await fs.readFile('output/launch-a/complete-native/native.json')),JSON.parse(await fs.readFile('scripts/native-render-baseline-v2.json')));
await fs.writeFile('output/launch-a/native-gates.json',JSON.stringify(gates,null,2));
await fs.writeFile('output/launch-a/complete-completion.json',JSON.stringify({at:new Date().toISOString(),gates},null,2));
console.log('COMPLETE SUITE DONE');
