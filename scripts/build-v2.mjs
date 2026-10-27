import {v2 as selectedV2} from './layout-selector.mjs';
if(!selectedV2)throw new Error('This producer requires LEO_LAYOUT=2');
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runV2} from './run-v2.mjs';
const out='output/leo-interior-v02';await fs.mkdir(out,{recursive:true});
const p=spawnSync(process.execPath,['scripts/layout-v2-data.mjs'],{stdio:'inherit'});if(p.status)throw new Error('v2 plan failed');
for(const n of ['leo-exterior.glb','leo-exterior-refined.glb','leo-exterior-web.glb','leo-exterior-phone.glb','THREE-LICENSE.txt'])await fs.copyFile('output/leo-interior-v01/'+n,out+'/'+n);
await runV2('build');
