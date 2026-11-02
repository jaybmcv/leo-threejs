import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const layout='output/leo-interior-v02/layout.json';
for(const name of ['arrival-design','reflection-terraces','flowing-ribs','layered-conservatory']) {
  const args=['scripts/check-'+name+'.mjs'];
  if(existsSync(layout)&&['reflection-terraces','flowing-ribs'].includes(name))args.push('--layout='+layout);
  const result=spawnSync(process.execPath,args,{stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
console.log('PASS selected interior design checks'+(existsSync(layout)?' with generated layout.':'; run again after building v2 for room-frame checks.'));
