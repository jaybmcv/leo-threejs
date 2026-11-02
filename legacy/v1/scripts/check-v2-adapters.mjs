import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {checkV2Adapters,applyV2Adapters} from './v2-adapters.mjs';
const report=await checkV2Adapters();
for(const a of report.adapters){let source=(await fs.readFile(a.file,'utf8')).replaceAll('\r\n','\n');if(/^\/.+\/[gimuy]*$/.test(a.target)){const end=a.target.lastIndexOf('/');source=source.replace(new RegExp(a.target.slice(1,end),a.target.slice(end+1)),'MISSING_ADAPTER_TARGET');}else source=source.replaceAll(a.target,'MISSING_ADAPTER_TARGET');const issues=[];applyV2Adapters(a.file,source,{issues,collect:true});assert(issues.some(s=>s.includes(a.file)&&s.includes(JSON.stringify(a.target))),'Missing-target regression: '+a.file+' '+a.target);}
const all=[];for(const file of new Set(report.adapters.map(a=>a.file)))applyV2Adapters(file,'',{issues:all,collect:true});assert(all.length>=report.adapters.length,'All mismatches must be accumulated');
await fs.mkdir('output/phase3',{recursive:true});await fs.writeFile('output/phase3/adapters.json',JSON.stringify({...report,missingTargetRegressions:report.adapters.length,aggregateMissing:all.length},null,2));
if(report.issues.length)throw new Error('V2 source adapters failed:\n'+report.issues.join('\n'));
console.log('PASS: '+report.adapters.length+' checked adapters across '+new Set(report.adapters.map(a=>a.file)).size+' sources; every removed target rejected; '+all.length+' simultaneous mismatches reported');
