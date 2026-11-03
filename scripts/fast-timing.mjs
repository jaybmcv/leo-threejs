import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

export function stageTimer({file='output/fast-deploy/timing.json',label='fast'}={}){
 const start=performance.now(),stages=[];
 const save=async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify({label,started:new Date(Date.now()-(performance.now()-start)).toISOString(),elapsedSeconds:(performance.now()-start)/1000,stages},null,2));};
 return {stages,async stage(name,fn){const t=performance.now();let status='PASS';console.log(`[stage] ${name} starting`);try{return await fn();}catch(e){status='FAIL';throw e;}finally{const seconds=(performance.now()-t)/1000;stages.push({name,seconds,status});console.log(`[timing] ${name}: ${seconds.toFixed(3)} s (${status})`);await save();}},async finish(){await save();console.log(`[timing] ${label} total: ${((performance.now()-start)/1000).toFixed(3)} s`);}};
}
export function runNode(script,args=[],options={}){
 return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--max-old-space-size=11000',script,...args],{stdio:'inherit',windowsHide:true,...options});child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`${script} failed (${code??signal})`)));});
}
