import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

// An explicit maintenance operation, never part of build/check/deploy. Review
// the source diff before naming files here; all unnamed pin rows stay intact.
const files=new Set(process.argv.slice(2).filter(a=>!a.startsWith('--'))),reason=process.argv.find(a=>a.startsWith('--reason='))?.slice(9);
if(!files.size||!reason)throw Error('Usage: node scripts/repin-source-files.mjs --reason="reviewed change" src/file.js ...');
const foldFile='scripts/fixtures/switchover/source-fold-contract.json',overrideFile='scripts/fixtures/switchover/source-stage-overrides.json';
const folds=JSON.parse(await fs.readFile(foldFile)),frozen=JSON.parse(await fs.readFile('scripts/fixtures/switchover/folded-sources.json')),overrides=JSON.parse(await fs.readFile(overrideFile));
const sha=text=>createHash('sha256').update(text).digest('hex'),spec=/((?:from\s*|import\s*(?:\(\s*)?)['"])([^'"\n]+)(['"])/g,changedFold=[],changedOverrides=[];
for(const file of files){
 const row=folds.find(r=>r.file===file),original=frozen.find(r=>r.file===file);if(!row&&!original)continue;
 const source=(await fs.readFile(file,'utf8')).replaceAll('\r\n','\n');
 if(row){const next={...row,bodySha256:sha(source.replace(spec,'$1<module>$3')),imports:[...source.matchAll(spec)].map(m=>m[2]),geometryCalls:[...source.matchAll(/(?:RecordGeometry|ReplayGeometry|recordMerged|replayMerged)\(['"]([^'"]+)['"]/g)].map(m=>m[1])};if(JSON.stringify(row)!==JSON.stringify(next)){Object.assign(row,next);changedFold.push(file);}}
 if(original){const digest=sha(source);if(digest!==(overrides[file]?.sha256||original.sha256)){overrides[file]={sha256:digest,reason};changedOverrides.push(file);}}
}
await fs.writeFile(foldFile,JSON.stringify(folds,null,2)+'\n');await fs.writeFile(overrideFile,JSON.stringify(overrides,null,2)+'\n');
const report={reason,requested:[...files],changedFold,changedOverrides,filesRequiringRepin:[...new Set([...changedFold,...changedOverrides])].sort()};
await fs.mkdir('output/fast-deploy',{recursive:true});await fs.writeFile('output/fast-deploy/repin-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
