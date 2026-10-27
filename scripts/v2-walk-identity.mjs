
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const WALK_REPORT_VERSION=2;
const hint='Run LEO_LAYOUT=2 npm run check:walk, then LEO_LAYOUT=2 npm run check.';
export async function walkBuildIdentity(out='output/leo-interior-v02'){
 const files={};for(const name of ['layout.json','walk-plan.json',...(await fs.readdir(out)).filter(n=>n.endsWith('.glb')).sort()])files[name]=createHash('sha256').update(await fs.readFile(out+'/'+name)).digest('hex');
 // The flood constructs its colliders from procedural source as well as the exported exterior.
 const source=[];const visit=async dir=>{for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){const name=dir+'/'+entry.name;if(entry.isDirectory())await visit(name);else if(/\.(js|json|ts)$/.test(entry.name))source.push(name);}};await visit('src');
 source.push('scripts/v2-adapters.mjs','scripts/v2-plugin.mjs','scripts/v2-walk.mjs','scripts/v2-world.mjs','scripts/v2-walk-policy.mjs','scripts/v2-walk-identity.mjs');
 for(const name of source)files[name]=createHash('sha256').update(await fs.readFile(name)).digest('hex');
 return {hash:createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}
export function requireCurrentWalkReport(report,identity){
 if(!report||report.reportVersion!==WALK_REPORT_VERSION||!Array.isArray(report.guardGaps)||!Array.isArray(report.roomFeatureDrops)||!Array.isArray(report.roomFeatureViolations)||!report.safeReach||!report.berths||!report.cabinChairs)throw Error('Missing or old-format v2 walk report. '+hint);
 if(report.buildIdentity?.hash!==identity.hash)throw Error('V2 walk report belongs to another build. '+hint);
 if(report.status!=='PASS'||report.guardGaps.length||report.roomFeatureViolations.length)throw Error('V2 walk report failed. '+hint);
 return report;
}
export async function readCurrentWalkReport(out='output/leo-interior-v02'){
 let report;try{report=JSON.parse(await fs.readFile(out+'/walk-report.json','utf8'));}catch{throw Error('Missing or unreadable v2 walk report. '+hint);}
 return requireCurrentWalkReport(report,await walkBuildIdentity(out));
}
