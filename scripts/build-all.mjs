import {spawnSync} from 'node:child_process';
import './restore-baseline.mjs';
for(const script of ['build-exterior-finish','build-interior','build-residences','build-gardens','build-areas','build-aft','build-assembly']){const p=spawnSync(process.execPath,['scripts/'+script+'.mjs'],{stdio:'inherit'});if(p.status!==0)process.exit(p.status||1);}
