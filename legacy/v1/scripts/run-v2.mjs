import {v2 as selectedV2} from './layout-selector.mjs';
if(!selectedV2)throw new Error('This producer requires LEO_LAYOUT=2');
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {v2Plugin} from './v2-plugin.mjs';
export async function runV2(task){
 let layout;try{layout=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8'));}catch{const p=spawnSync(process.execPath,['scripts/layout-v2-data.mjs'],{stdio:'inherit'});if(p.status)throw new Error('v2 layout failed');layout=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8'));}
 const result=await build({entryPoints:['scripts/v2-'+task+'.mjs'],absWorkingDir:process.cwd(),tsconfigRaw:{},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,plugins:[v2Plugin(layout,{node:true})]});
 const file='scripts/.v2-'+task+'.mjs';await fs.writeFile(file,result.outputFiles[0].contents);const p=spawnSync(process.execPath,['--max-old-space-size=10000',...(task==='build'?['--import',new URL('./install-build-cache-v2.mjs',import.meta.url).href]:[]),file],{stdio:'inherit'});if(p.status!==0)throw new Error('v2 '+task+' failed ('+p.status+')');
}
if(process.argv[1]?.endsWith('run-v2.mjs'))await runV2(process.argv[2]);
