import {spawnSync} from 'node:child_process';
import {v2} from './layout-selector.mjs';
if(v2){await (await import('./cache-transport-pack-v2.mjs')).preparePackedCacheTransport();await import('./build-v2.mjs');process.exit(0);}
await import('./restore-baseline.mjs');
for(const script of ['build-exterior-finish','build-interior','build-residences','build-gardens','build-areas','build-aft','build-assembly']){const p=spawnSync(process.execPath,['scripts/'+script+'.mjs'],{stdio:'inherit'});if(p.status!==0)process.exit(p.status||1);}
