import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {applyV2Adapters} from './v2-adapters.mjs';
import path from 'node:path';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {v2Plugin} from './v2-plugin.mjs';
const layout=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8'));
const result=await build({entryPoints:['scripts/v2-ship-log-remap-check.mjs'],absWorkingDir:process.cwd(),tsconfigRaw:{},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,plugins:[v2Plugin(layout,{node:true})]});
const target='output/phase7/.remap-check.mjs';await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,result.outputFiles[0].contents);
const child=spawnSync(process.execPath,[target],{stdio:'inherit'});if(child.status!==0)throw Error('Phase 7 ship-log remap check failed');

await import('./ship-log-remap-fixture.mjs');

// Mutation of the assembled runtime, without editing any source: this must
// make the same corpus gate fail, proving the check cannot pass a missing hook.
const mutant=await build({entryPoints:['scripts/v2-ship-log-remap-check.mjs'],absWorkingDir:process.cwd(),tsconfigRaw:{},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,plugins:[v2Plugin(layout,{node:true,sourceAdapters(file,source,options){const adapted=applyV2Adapters(file,source,options);return file==='src/walk/link.js'?adapted.replace('const corridor=remapLegacyCorridor(spot,room);','const corridor=null;'):adapted;}})]});
const broken='output/phase7/.remap-removed-hook.mjs';await fs.writeFile(broken,mutant.outputFiles[0].contents);
const rejected=spawnSync(process.execPath,[broken],{encoding:'utf8'});assert.notEqual(rejected.status,0,'Removing the runtime remapper must fail');assert(rejected.stderr.includes('left a circulation link unresolved'),'Mutation failed for an unrelated reason');
await fs.writeFile('output/phase7/remap-negative.json',JSON.stringify({status:'PASS',removedRuntimeRemapperRejected:true,fixture:'ship-log-remap-fixture.mjs'},null,2)+'\n');
console.log('Phase 7 removed-runtime-hook mutation: rejected by the actual corpus gate PASS');
