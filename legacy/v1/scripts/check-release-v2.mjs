// Bounded release parity checks against the actual v2 public directory.
import {spawnSync} from 'node:child_process';
for(const script of ['check-hub.mjs','check-public-v2.mjs','check-release-browser-v2.mjs']){const p=spawnSync(process.execPath,['scripts/'+script],{stdio:'inherit',windowsHide:true,env:{...process.env,LEO_PUBLIC_DIR:'dist-v2'}});if(p.status!==0)throw Error(script+' failed ('+p.status+')');}
