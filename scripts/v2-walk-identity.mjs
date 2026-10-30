
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const WALK_REPORT_VERSION=5;
const hint='Run LEO_LAYOUT=2 npm run check:walk, then LEO_LAYOUT=2 npm run check.';
export async function walkBuildIdentity(out='output/leo-interior-v02'){
 const files={};for(const name of ['layout.json','walk-plan.json',...(await fs.readdir(out)).filter(n=>n.endsWith('.glb')).sort()])files[name]=createHash('sha256').update(await fs.readFile(out+'/'+name)).digest('hex');
 // The full flood consumes the same prepared triangles and serialized BVHs as the public walk.
 const prepared=JSON.parse(await fs.readFile(out+'/prepared-walk/integrity.json','utf8'));files['prepared-walk']=prepared.sha256;
 const source=[];const visit=async dir=>{for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){const name=dir+'/'+entry.name;if(entry.isDirectory())await visit(name);else if(/\.(js|json|ts)$/.test(entry.name))source.push(name);}};await visit('src');
 source.push('package-lock.json','scripts/v2-adapters.mjs','scripts/v2-plugin.mjs','scripts/v2-walk.mjs','scripts/v2-world.mjs','scripts/v2-walk-policy.mjs','scripts/v2-walk-identity.mjs','scripts/prepared-walk-adapters.mjs','scripts/prepared-geometry-adapters.mjs','scripts/prepared-identity-v2.mjs','scripts/encode-prepared-walk-v2.mjs','scripts/prepared-vertex-pool.mjs','scripts/prepared-collision-pack.mjs','scripts/prepared-tuple-codec.mjs','scripts/shared-model-transport-v2.mjs');
 for(const name of source)files[name]=createHash('sha256').update(await fs.readFile(name)).digest('hex');
 return {hash:createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}
export function requireCurrentWalkReport(report,identity){
 if(!report||report.reportVersion!==WALK_REPORT_VERSION||!Array.isArray(report.guardGaps)||!Array.isArray(report.roomFeatureDrops)||!Array.isArray(report.roomFeatureViolations)||!Array.isArray(report.privateLiftStops)||report.privateLiftStops.length!==3||report.privateLiftStops.some(s=>!s.reached)||!report.privateLiftsRidden?.includes('clubhouse-tube-lift')||!report.safeReach||!report.berths||!report.cabinChairs||!report.loungeSeats||!report.hullInterfaces)throw Error('Missing or old-format v2 walk report. '+hint);
 if(report.buildIdentity?.hash!==identity.hash)throw Error('V2 walk report belongs to another build. '+hint);
 if(report.status!=='PASS'||report.guardGaps.length||report.roomFeatureViolations.length)throw Error('V2 walk report failed. '+hint);
 return report;
}
export async function readCurrentWalkReport(out='output/leo-interior-v02'){
 const identity=await walkBuildIdentity(out),until=Number(process.env.LEO_WAIT_FOR_WALK_UNTIL||0);let lastWait=0;
 for(;;){let report;try{report=JSON.parse(await fs.readFile(out+'/walk-report.json','utf8'));}catch{}
  // A concurrent validation may wait for its own flood, never accept another build's report.
  if(report?.buildIdentity?.hash===identity.hash)return requireCurrentWalkReport(report,identity);
  if(Date.now()<until){if(Date.now()-lastWait>60000){console.log('Waiting for the full walk report of current build '+identity.hash.slice(0,16));lastWait=Date.now();}await new Promise(r=>setTimeout(r,500));continue;}
  if(!report)throw Error('Missing or unreadable v2 walk report. '+hint);
  return requireCurrentWalkReport(report,identity);
 }
}
