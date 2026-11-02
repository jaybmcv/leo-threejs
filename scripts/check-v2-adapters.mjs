import {fileURLToPath} from 'node:url';
// Retain the complete historical missing-anchor gate and prove the mechanical fold.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const old=spawnSync(process.execPath,['scripts/check-v2-adapters.mjs'],{cwd:'legacy/v1',env:{...process.env,LEO_LAYOUT:'1',LEO_ADAPTER_REPORT_DIRECTORY:fileURLToPath(new URL('../output/phase3/',import.meta.url))},encoding:'utf8',windowsHide:true});process.stdout.write(old.stdout||'');process.stderr.write(old.stderr||'');assert.equal(old.status,0,'Frozen 219-anchor negative gate');
const rows=JSON.parse(await fs.readFile('scripts/fixtures/switchover/folded-sources.json'));const overrides=JSON.parse(await fs.readFile('scripts/fixtures/switchover/source-stage-overrides.json'));for(const r of rows){const s=await fs.readFile(r.file);assert.equal(createHash('sha256').update(s.toString().replaceAll('\r\n','\n')).digest('hex'),overrides[r.file]?.sha256||r.sha256,'Folded source drift: '+r.file);}console.log('PASS exact folded source hashes:',rows.length);

await import('./check-source-fold.mjs');
await import('./check-layout-inputs.mjs');
