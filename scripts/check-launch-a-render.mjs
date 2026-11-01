import assert from 'node:assert/strict';
import {applyV2Adapters,checkV2Adapters} from './v2-adapters.mjs';
import fs from 'node:fs/promises';import {build} from 'esbuild';import {v2Plugin} from './v2-plugin.mjs';
const audit=await checkV2Adapters();assert.deepEqual(audit.issues,[]);const privacy=applyV2Adapters('src/v2/cabin-privacy.js',await fs.readFile('src/v2/cabin-privacy.js','utf8'));assert(privacy.includes('compactRenderGeometry(child.geometry).applyMatrix4(child.matrix)'));assert(!privacy.includes('child.geometry.clone()'));
const layout=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json'));await fs.mkdir('output/launch-a',{recursive:true});
await build({entryPoints:['scripts/v2-launch-a-render-fixture.mjs'],outfile:'output/launch-a/render-fixture.mjs',bundle:true,platform:'node',format:'esm',packages:'external',plugins:[v2Plugin(layout,{node:true})]});await import('../output/launch-a/render-fixture.mjs');
