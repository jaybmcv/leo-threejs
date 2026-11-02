import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ensureLegacyWorkspace} from './run-legacy.mjs';

const parent=fs.mkdtempSync(path.join(tmpdir(),'leo-legacy-workspace-'));
const cases=[];
try {
 for(const state of ['clean','empty','nonempty','file','wrong-link','dangling','blocked-last']) {
  const root=path.join(parent,state),legacy=path.join(root,'legacy/v1');
  fs.mkdirSync(legacy,{recursive:true});
  fs.mkdirSync(path.join(root,'node_modules'));
  const link=path.join(legacy,state==='blocked-last'?'node_modules':'output');
  if(state==='empty')fs.mkdirSync(link);
  if(state==='nonempty'||state==='blocked-last') {
   fs.mkdirSync(link);
   fs.writeFileSync(path.join(link,'receipt.txt'),'preserve me');
  }
  if(state==='file')fs.writeFileSync(link,'preserve file');
  if(state==='wrong-link'||state==='dangling') {
   const target=path.join(root,'other');
   if(state==='wrong-link')fs.mkdirSync(target);
   fs.symlinkSync(target,link,'junction');
  }
  if(['nonempty','file','wrong-link','dangling','blocked-last'].includes(state)) {
   assert.throws(()=>ensureLegacyWorkspace(root),/Unexpected legacy workspace target/);
   assert(fs.lstatSync(link));
   if(state==='nonempty'||state==='blocked-last')
    assert.equal(fs.readFileSync(path.join(link,'receipt.txt'),'utf8'),'preserve me');
   if(state==='file')assert.equal(fs.readFileSync(link,'utf8'),'preserve file');
   if(state==='blocked-last') {
    assert(!fs.existsSync(path.join(root,'output')));
    assert(!fs.existsSync(path.join(legacy,'output')));
   }
  } else {
   ensureLegacyWorkspace(root);
   ensureLegacyWorkspace(root);
   for(const name of ['output','dist','dist-v2','node_modules'])
    assert.equal(fs.realpathSync(path.join(legacy,name)),fs.realpathSync(path.join(root,name)));
  }
  cases.push(state);
 }

 // Reproduce the clean-clone order: the frozen v2 audit runs before rollback setup.
 const root=path.join(parent,'gate-first');
 fs.mkdirSync(path.join(root,'legacy'),{recursive:true});
 fs.cpSync(fileURLToPath(new URL('../legacy/v1',import.meta.url)),path.join(root,'legacy/v1'),{
  recursive:true,
  filter:p=>!['output','dist','dist-v2','node_modules'].includes(path.basename(p)),
 });
 fs.mkdirSync(path.join(root,'node_modules'));
 const audit=spawnSync(process.execPath,['scripts/check-v2-adapters.mjs'],{
  cwd:path.join(root,'legacy/v1'),windowsHide:true,encoding:'utf8',
  env:{...process.env,LEO_LAYOUT:'1',LEO_ADAPTER_REPORT_DIRECTORY:path.join(root,'output/phase3')},
 });
 assert.equal(audit.status,0,audit.stdout+audit.stderr);
 assert(!fs.existsSync(path.join(root,'legacy/v1/output')));
 assert(fs.existsSync(path.join(root,'output/phase3/adapters.json')));
 ensureLegacyWorkspace(root);
 assert.equal(fs.realpathSync(path.join(root,'legacy/v1/output')),fs.realpathSync(path.join(root,'output')));
 cases.push('frozen-v2-audit-before-rollback');
 console.log('PASS legacy workspace fixture: '+cases.join(', '));
} finally {
 // Only this freshly allocated fixture tree is removed; real workspace leftovers are preserved.
 fs.rmSync(parent,{recursive:true,force:true});
}
