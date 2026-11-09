// The nightly checks that need no geometry build, run by every fast deploy after the public bundle (and still by the
// nightly, through check-all). A check that reads only source goes stale the moment a fast-deployed change edits what
// it reads; caught here, the author still has the change open, and the nightly isn't stopped by it hours later.
// Checks that need the full prepared build (clearance, envelope, live glass, hull reports) stay nightly-only.
// LEO_QUICK_JOBS sets how many run at once (default 3).
import {spawn} from 'node:child_process';
import {checkPreparedStartupSource} from './prepared-startup-source.mjs';

const SCRIPTS=[
 // The games' and features' own rules.
 'check-hub','check-backdrop','check-invasion','check-emergency-drill','check-paws-off','check-giveaway','check-pool','check-ship-log',
 'check-lullaby','check-maze','check-pinball','check-treasure','check-mudwater',
 // Ship features and walk rules that build only what they test.
 'check-walk-performance','check-otherside','phase4-room-floor-fixture','check-kitten-supports-v2','check-cat-tree','check-cat-tree-landings',
 'check-nose-park','check-keel-club','check-clubhouse-access-v2','check-release-v2','check-sign-render-v2','check-lobby-tile-v2','check-halloween-v2',
 'check-crew-gallery-v2','check-build-cache-v2','check-privacy-classes-v2','check-export-metadata-v2','check-atrium-proxy-fade',
];
const started=performance.now(),jobs=Math.max(1,Number(process.env.LEO_QUICK_JOBS)||3),results=[];
const run=(name,args)=>new Promise(resolve=>{const t=performance.now();let log='';
 const child=spawn(process.execPath,args,{windowsHide:true,env:process.env});
 child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
 child.once('error',e=>{log+=e.stack;resolve({name,code:-1,seconds:(performance.now()-t)/1000,log});});
 child.once('exit',code=>resolve({name,code,seconds:(performance.now()-t)/1000,log}));});

console.log('PASS: '+await checkPreparedStartupSource());
const queue=[...SCRIPTS.map(s=>[s,['scripts/'+s+'.mjs']]),['atrium rays',['scripts/run-v2.mjs','quick']]];
await Promise.all(Array.from({length:jobs},async()=>{for(let next;(next=queue.shift());){const r=await run(...next);results.push(r);console.log(`${r.code===0?'PASS':'FAIL'} ${r.name} (${r.seconds.toFixed(1)} s)`);}}));
const failed=results.filter(r=>r.code!==0);
for(const r of failed)console.log(`\n===== ${r.name} failed (${r.code}) =====\n${r.log.trim().split('\n').slice(-40).join('\n')}`);
console.log(`[timing] quick nightly checks: ${results.length+1} checks in ${((performance.now()-started)/1000).toFixed(1)} s, ${failed.length} failed`);
if(failed.length)process.exit(1);
