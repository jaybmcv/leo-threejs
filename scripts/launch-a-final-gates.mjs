import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
while(!await fs.access('output/launch-a/complete-completion.json').then(()=>true,()=>false))await new Promise(r=>setTimeout(r,500));
process.env.LEO_LAYOUT='2';process.env.LEO_STARTUP_CANDIDATE='output/launch-a/public-cold-fix';process.env.LEO_STARTUP_BASELINE='C:/Users/henri/code/leo-threejs/.qa/redesign-preview-1027b';
const p=spawnSync(process.execPath,['scripts/check-startup-v2.mjs','--tag=launch-a-complete'],{stdio:'inherit',windowsHide:true});
for(const n of await fs.readdir('output/phase3b/startup'))if(n.startsWith('launch-a-complete-')&&n.endsWith('.json'))await fs.copyFile('output/phase3b/startup/'+n,'output/launch-a/startup/'+n);
await fs.writeFile('output/launch-a/startup/final-run.json',JSON.stringify({exitCode:p.status}));
