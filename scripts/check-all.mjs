import {layoutVersion as selectedLayout} from './layout-selector.mjs';
if(selectedLayout===1)(await import('./run-legacy.mjs')).runLegacy("scripts/check-all.mjs",process.argv.slice(2));
import {v2 as useV2} from './layout-selector.mjs';
import fs from 'node:fs/promises';
import {runJobs} from './check-scheduler.mjs';
// Every full check runs as its own process, several at once (scripts/check-scheduler.mjs sets the limits). Importing
// layout-selector above sets LEO_LAYOUT=2, which every child inherits, and has already made the v2 output folders.
// Two checks read what another writes, so they wait for it: the ship-log browser check reads the remap table written by
// check-ship-log-remap-v2, and the v2 check reads the hull, phone, skin-clearance and prepared-walk reports check-plan
// writes. No check uses a fixed port or browser profile.
// Per-check timings are printed as [check-timing] lines and kept in output/fast-deploy/full-check-timing.json, rewritten
// after every check so a failed run still has them; the next run starts the longest checks first from them.
const timingFile='output/fast-deploy/full-check-timing.json',timings=[],started=performance.now();
// A missing or damaged timing file only loses the longest-first order.
const previous={};
try{for(const c of JSON.parse(await fs.readFile(timingFile,'utf8')).checks)if(typeof c?.name==='string'&&Number.isFinite(c.seconds))previous[c.name]=c.seconds;}catch{}
let writing=Promise.resolve();
const record=(name,seconds,status)=>{timings.push({name,seconds,status});console.log(`[check-timing] ${name}: ${seconds.toFixed(1)} s (${status})`);
 return writing=writing.then(async()=>{await fs.mkdir('output/fast-deploy',{recursive:true});const tmp=timingFile+'.'+process.pid+'.tmp';await fs.writeFile(tmp,JSON.stringify({started:new Date(Date.now()-(performance.now()-started)).toISOString(),elapsedSeconds:(performance.now()-started)/1000,parallel:true,checks:timings},null,1));await fs.rename(tmp,timingFile);}).catch(e=>console.log('[check-timing] could not save the timing file: '+e.message));};

// Retired by Jay, 2026-11-02: the v1 rollback proofs, switchover hash pins, frozen layout inputs, ownership
// signatures, startup and draw-call baselines, and the download and phone-hull limits. The scripts remain to run by hand.
// heavy: loads the full ship or the prepared world; browser: drives Chrome.
const HEAVY=new Set(['check-exterior-v2','check-phase4-prototypes','check-phase6-v2','check-goto-v2','check-plan']);
const BROWSER=new Set(['check-ship-log-remap-browser-v2','check-viewer-suite-v2','check-release-v2']);
const AFTER={'check-ship-log-remap-browser-v2':'check-ship-log-remap-v2','v2 check':'check-plan'};
const V2_CHECKS=['check-walk-performance','check-otherside','launch-b-normalization-fixture','check-visual-preview-v2','check-retirement-transport-v2',
 'check-budgets-v2','check-clean-output-v2','phase5-hatch-negatives','phase5-inner-fixture','phase5-phone-policy-fixture',
 'phase5-window-coverage-fixture','check-exterior-v2','check-phase4-prototypes','check-phase4-community','phase4-room-floor-fixture',
 'phase4-display-floor-fixture','check-kitten-supports-v2','check-cat-tree','check-cat-tree-landings','check-nose-park','check-keel-club','check-waterfall-fit-v2',
 'check-main-features-v2','check-clubhouse-access-v2','check-ship-log-remap-v2','check-ship-log-remap-browser-v2','check-viewer-suite-v2',
 'check-release-v2','check-phase6-v2','check-freight-airlock-v2','check-v2-round2','check-v2-signs','check-sign-render-v2','check-lobby-tile-v2',
 'check-goto-v2','check-halloween-v2','check-crew-gallery-v2','check-build-cache-v2','check-authoring-cache-v2','check-authoring-skin-proof-v2',
 'check-privacy-classes-v2','check-streamed-metadata-v2','check-public-bindings-v2','check-cache-transport-v2','check-export-metadata-v2',
 'check-atrium-void-fixtures-v2','check-band-merge-sources','check-atrium-proxy-fade','check-plan'];
// The games' and features' own rules: quick, and independent of the ship's geometry. (The v1 ship's geometry checks
// were removed with the v1 rollback, Jay 2026-11-02.)
const GAMES=['check-hub','check-backdrop','check-invasion','check-emergency-drill','check-paws-off','check-giveaway','check-pool','check-ship-log','check-walk-start','check-public-area','check-joins','check-fur',
 'check-lullaby','check-maze','check-pinball','check-treasure','check-mudwater','check-plaque-atlas','check-rig-pace','check-merged-skin','check-solved-pose','check-figure-matrices','check-bone-walk','check-visitor-bones','check-crowd-draw','check-rig-budget','check-crowd-motion','check-captain-says-rules','check-share-materials','check-call-lights','check-owner-proof','check-owner-proof-fuzz','check-owner-hiding','check-owner-bake-scene','check-desk-piece','check-pixel-switches','check-inspector-loading'];
const kind=name=>HEAVY.has(name)?'heavy':BROWSER.has(name)?'browser':'light';
const jobs=[
 ...(useV2?[
  // These ran inside check-all's own process, which `npm run check` gives an 11000 MB heap; each keeps that cap.
  ...V2_CHECKS.map(name=>({name,args:['--max-old-space-size=11000','scripts/'+name+'.mjs']})),
  // run-v2 bundles the task and runs it with its own 14000 MB heap.
  {name:'v2 launch-b-entry-glass-fixture',args:['scripts/run-v2.mjs','launch-b-entry-glass-fixture']},
  {name:'v2 check',args:['scripts/run-v2.mjs','check'],kind:'heavy'},
 ]:[]),
 ...GAMES.map(name=>({name,args:['scripts/'+name+'.mjs']})),
].map(j=>({kind:kind(j.name),...j,after:AFTER[j.name]}));

const {results,minFreeGB}=await runJobs(jobs,{previous,record});
await writing;
const failed=[...results].filter(([,r])=>r.code!==0).map(([name,r])=>name+(r.code===-2?' (not run: what it needs failed)':''));
console.log(`[timing] full checks: ${results.size} checks in ${((performance.now()-started)/1000).toFixed(1)} s, ${failed.length} failed; lowest free memory ${minFreeGB.toFixed(1)} GB`);
if(failed.length){console.log('Failed: '+failed.join(', '));process.exit(1);}
process.exit(0);
