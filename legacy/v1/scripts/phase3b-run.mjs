import fs from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'esbuild';
import {v2Plugin} from './v2-plugin.mjs';
if(process.env.LEO_LAYOUT!=='2')throw Error('Set LEO_LAYOUT=2');
const task=process.argv[2]||'world',baseline=process.argv.includes('--baseline'),review=process.argv.includes('--review-baseline'),out='output/phase3b';await fs.mkdir(out,{recursive:true});
let layout=JSON.parse(await fs.readFile(baseline||review?'output/leo-interior-v02/layout.json':out+'/layout.json','utf8')),sourceAdapters;
if(baseline||review){const text=(await promisify(execFile)('git',['--no-optional-locks','show',(review?'179d813':'2b1ff60')+':scripts/v2-adapters.mjs'],{maxBuffer:4*1024*1024})).stdout;sourceAdapters=(await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'))).applyV2Adapters;}
const result=await build({entryPoints:['scripts/phase3b-'+task+'.mjs'],absWorkingDir:process.cwd(),tsconfigRaw:{},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,plugins:[v2Plugin(layout,{node:true,sourceRef:review?'179d813':baseline?'2b1ff60':null,sourceAdapters})]});
const file=out+'/.phase3b-'+task+(review?'-review':baseline?'-baseline':'')+'.mjs';await fs.writeFile(file,result.outputFiles[0].contents);const p=spawn(process.execPath,['--max-old-space-size=11000',file,...process.argv.slice(3)],{stdio:'inherit',windowsHide:true});await fs.writeFile(out+'/job-'+task+'.json',JSON.stringify({pid:p.pid,task,at:new Date().toISOString()}));await new Promise((resolve,reject)=>{p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error('Prototype '+task+' exit '+code)));});
