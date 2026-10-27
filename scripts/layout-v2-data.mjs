import {v2 as selectedV2} from './layout-selector.mjs';
if(!selectedV2)throw new Error('This producer requires LEO_LAYOUT=2');
import fs from 'node:fs/promises';
import {LAYOUT_V2} from '../src/plan/layout-v2.js';
await fs.mkdir('output/leo-interior-v02',{recursive:true});
await fs.writeFile('output/leo-interior-v02/layout.json',JSON.stringify(LAYOUT_V2));
console.log(JSON.stringify(LAYOUT_V2.summary));
