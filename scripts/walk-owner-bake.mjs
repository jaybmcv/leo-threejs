// Owner bake: for each 2 m camera cell over the open atrium floor, the drawables proven hidden from every eye in it
// (src/v2/owner-proof.js), for one exact walk build (src/v2/owner-hiding.js reads it). Runs scripts/walk-owner-bake.page.js
// in the built walk itself, opened with ?ownerBake (geometry arrays kept, the scene handed to the bake).
//   node scripts/walk-owner-bake.mjs --site=<built site dir> [--out=<file>]          (a deploy: after the public build)
//   node scripts/walk-owner-bake.mjs --tag=<debug build> [--port=4221] [--out=<file>] (a study build, scripts/walk-frame-serve.mjs)
// [--pages=2]: blocks are shared among n headless Chromes (a walk page with its arrays peaks near 3 GB). [--minutes=80]:
// no new block starts after this; cells left unbaked hide nothing. [--top=8]: blocks of top x top cells, one slab tall,
// proven whole first and halved where that fails. [--slabs=2] 2 m slabs from Deck 6's floor; [--margin=4] m round Deck 6's atrium outline.
// The bake is kept only if the self-check passes: [--poses=200] random poses inside the baked blocks, drawn with and
// without the hiding through the walk's own createOwnerHiding, none changing more than [--max-pixels=8] pixels by more
// than 24 levels. It is written to walk-owner-bake.<hash>.json beside the walk script (--site), replacing the build's
// empty one, or output/perf-walk/owner-bake/<tag>.json. --if-missing reuses an existing valid bake and fills missing café coverage.
// --supplement-only adds the café cell to an existing validated bake for the exact same build.
// With --site it is also kept, with each row's digest at the bench and café seeds, in [--store=<file>] (default
// output/leo-interior-v02/owner-bake/last.json; none: not kept), which scripts/walk-owner-carry.mjs carries to later
// builds of the same scene (walk-owner-carry-rows.mjs says what that depends on).
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PVS_GRID} from '../src/v2/atrium-pvs.js';
import {OWNER_BAKE_VERSION,ownerBakeFile,ownerBakeProblem,ownerKey} from '../src/v2/owner-hiding.js';
import {contains,distanceToSegment} from '../src/plan/geometry-v2.js';
import {cafe,coversCafe,addCafeCell} from './walk-owner-hotspots.mjs';
import {tablesDiffer,withoutMoved} from './walk-owner-bake.scene.js';
import {openPage as openWalk,pageScript,walkPage} from './walk-owner-page.mjs';
import {OWNER_STORE} from './walk-owner-carry-rows.mjs';
// The bake is for discrete desktop GPUs' piece size (src/v2/desk-piece.js), whatever GPU bakes it: its key holds the size.
import {DESK_PIECE} from '../src/v2/desk-piece.js';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const SITE_DIR=arg('site',null),TAG=arg('tag',null),PAGES=Number(arg('pages',2)),MINUTES=Number(arg('minutes',80)),TOP=Number(arg('top',8)),SLABS=Number(arg('slabs',2)),MARGIN=Number(arg('margin',4));
const POSES=Number(arg('poses',200)),MAX_PIXELS=Number(arg('max-pixels',8)),CDP=Number(arg('cdp',9348)),CHROME=arg('chrome','C:/Program Files/Google/Chrome/Application/chrome.exe');
if(!SITE_DIR===!TAG)throw Error('Give one of --site=<built site dir> or --tag=<debug build>');
if(!Number.isInteger(PAGES)||PAGES<1||PAGES>8)throw Error('--pages takes a whole number from 1 to 8');
const STORE=SITE_DIR&&arg('store',OWNER_STORE)!=='none'?path.resolve(arg('store',OWNER_STORE)):null;
const PV=PVS_GRID,started=Date.now();

// Cells to bake: centres inside Deck 6's atrium outline or within MARGIN of it, over SLABS slabs from its floor; as blocks of
// TOP x TOP cells, one per slab, nearest the bench views first.
async function region(){
 const layout=(await import('../src/plan/selected-layout.js')).default,deck=layout.decks.find(d=>d.number===6&&d.atrium?.outline);if(!deck)throw Error('No Deck 6 atrium outline in the layout');
 const ring=deck.atrium.outline,near=p=>contains(ring,p)||ring.some((a,n)=>distanceToSegment(p,a,ring[(n+1)%ring.length])<=MARGIN);
 const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]),i=x=>Math.round((x-PV.x0)/PV.step),j=z=>Math.round((z-PV.z0)/PV.step),k0=Math.floor((deck.y+.01-PV.y0)/2),k1=k0+SLABS-1;
 // Seeds: the bench views standing on this floor (not those on decks above or below the outline).
 const views=JSON.parse(await fs.readFile('scripts/walk-frame-views.json','utf8')).filter(v=>Math.abs(v.at[1]-deck.y)<3&&near([v.at[0],v.at[2]]));seed=views[0]??{at:[0,deck.y,0],yaw:0};const seeds=views.length?views.map(v=>v.at):[seed.at];
 const blocks=[];
 for(let bi=i(Math.min(...xs)-MARGIN);bi<=i(Math.max(...xs)+MARGIN);bi+=TOP)for(let bj=j(Math.min(...zs)-MARGIN);bj<=j(Math.max(...zs)+MARGIN);bj+=TOP){
  let any=false;for(let a=bi;a<bi+TOP&&!any;a++)for(let b=bj;b<bj+TOP&&!any;b++)if(near([PV.x0+PV.step*a,PV.z0+PV.step*b]))any=true;
  if(!any)continue;const cx=PV.x0+PV.step*(bi+TOP/2),cz=PV.z0+PV.step*(bj+TOP/2),d=Math.min(...seeds.map(s=>Math.hypot(s[0]-cx,s[2]-cz)));for(let k=k0;k<=k1;k++)blocks.push({cells:[bi,k,bj,bi+TOP-1,k,bj+TOP-1],d:d+(k-k0)*.01});}
 return blocks.sort((a,b)=>a.d-b.d).map(b=>b.cells);
}

let seed=null;
// A page with the walk up and the bake installed, stood at the seed; its setup() answer.
async function openPage(n,walk,script){
 const page=await openWalk(n,walk,script,{cdp:CDP,chrome:CHROME});
 return {page,setup:await page.ev(`__ownerBake.setup(${JSON.stringify(seed&&{at:seed.at,yaw:seed.yaw})})`)};
}
// Each row's digest (walk-owner-bake.scene.js rowDigests) of `data`'s tables where the page stands now.
const rowsOf=(page,data)=>page.ev(`__ownerBake.rows(${JSON.stringify({parts:data.parts,conds:data.conds})})`);

// Run the supplemental cell in its actual deck state. Tables are local to this setup. Returns {combined, rows}: rows are
// the digests of the combined tables' rows here (addCafeCell keeps the base's tables).
async function extendCafe(page,base){
 const setup=await page.ev(`__ownerBake.setup(${JSON.stringify({at:cafe.at,yaw:cafe.yaw})})`);
 if(setup.key!==base.key||setup.nearMargin!==base.nearMargin)throw Error('Café scene differs from the base bake');
 const bounds=[...cafe.cell,...cafe.cell];
 const raw=await page.ev(`__ownerBake.bake(${JSON.stringify([bounds])},{staticWhole:true})`);
 const entries=[],blocks=raw.blocks.map(b=>[...b.slice(0,6),b[6].map(row=>{entries.push(row);return entries.length-1;})]);
 const extra={version:base.version,key:base.key,grid:base.grid,nearMargin:setup.nearMargin,parts:setup.tables.parts,conds:setup.tables.conditions,entries,blocks};
 const {data}=await page.ev(`__ownerBake.prune(${JSON.stringify(extra)})`);
 const combined=addCafeCell(base,data);
 const focus={...combined,blocks:[combined.blocks.at(-1)]};
 const check=await page.ev(`__ownerBake.check(${JSON.stringify(focus)},100,4523)`);
 if(check.resolved!==check.parts||check.condsResolved!==check.conds||check.poses.length!==100||check.poses.some(p=>p.big>MAX_PIXELS||!p.hidden))throw Error('Café render check failed');
 console.log('owner bake:',cafe.name,focus.blocks.at(-1)[6].length,'shared proofs, maximum changed pixels',Math.max(...check.poses.map(p=>p.big)));
 const rows=await rowsOf(page,combined);console.log('owner bake: café row digests read at',JSON.stringify(rows.where));
 return {combined,rows};
}
// Writes the walk's bake and, with --site, keeps it in the store with its row digests: `main` at the bench seed, `rows` at
// the café's (scripts/walk-owner-carry.mjs carries it from there). Each file is whole or absent.
async function save(complete,main,{rows},code){
 const write=async(file,data)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.part',JSON.stringify(data));await fs.rename(file+'.part',file);};
 await write(out,complete);
 if(!STORE)return;
 const digests=({parts,conds})=>({parts,conds});
 await write(STORE,{...complete,carry:{code,seed:{at:seed.at,yaw:seed.yaw??0},cafeSeed:{at:cafe.at,yaw:cafe.yaw},main:digests(main),cafe:digests(rows)}});
 console.log('owner bake: kept for carrying in',STORE);
}

const walk=await walkPage({site:SITE_DIR,tag:TAG,port:arg('port',4221)});if(!walk.script)throw Error('No walk script named in walk.html');
const scriptKey=ownerKey(walk.script),out=arg('out',walk.dir?path.join(walk.dir,ownerBakeFile(walk.script)):path.resolve('output/perf-walk/owner-bake',TAG+'.json'));
const onlyCafe=process.argv.includes('--supplement-only');
let previous=null;
if(onlyCafe||process.argv.includes('--if-missing')){
 try{previous=JSON.parse(await fs.readFile(out,'utf8'));}catch(error){if(onlyCafe)throw error;}
 if(previous&&(previous.key!==ownerKey(walk.script,'merge'+DESK_PIECE.discrete+'kc')||!previous.blocks?.length||ownerBakeProblem(previous,previous.key)))previous=null;
 if(onlyCafe&&!previous)throw Error('A valid current-build owner bake is required for --supplement-only');
 if(previous&&coversCafe(previous)){
  console.log('owner bake: already baked for',walk.script);process.exit(0);
 }
}
const blocks=await region();console.log(`owner bake: ${walk.script}, ${blocks.length} blocks of ${TOP}x${TOP} cells x ${SLABS} slabs, ${PAGES} pages, ${MINUTES} min`);
const {text:script,code}=await pageScript();
if(previous){
 const {page}=await openPage(0,walk,script);
 try{
  const main=await rowsOf(page,previous),cafeRun=await extendCafe(page,previous);
  await save(cafeRun.combined,main,cafeRun,code);
 }finally{page.close();}
 process.exit(0);
}
const pages=await Promise.all(Array.from({length:PAGES},(_,n)=>openPage(n,walk,script)));
// Every page must see the same scene: the same parts and conditions, in the same order.
const digest=t=>createHash('sha256').update(JSON.stringify(t)).digest('hex');
const tables=pages[0].setup.tables,first=digest(tables),key=pages[0].setup.key;if(!key?.startsWith(scriptKey))throw Error('The page reports key '+key+' for '+walk.script);// A row whose print differs between pages moved on its own (an animation MOVING does not name): every entry relying on
// it, as the part hidden or as a wall that helped prove it, is dropped below. Rows of other paths refuse the bake.
const moved={parts:new Set(),conditions:new Set()},rowName=r=>JSON.parse(r[0]).map(s=>s[0]).filter(Boolean).join('/');
for(const [n,p] of pages.entries()){if(digest(p.setup.tables)===first)continue;const d=tablesDiffer(tables,p.setup.tables);
 if(!d)throw Error(`Page ${n} built a different scene (other parts or walls); the bake was not kept`);for(const k of ['parts','conditions'])for(const i of d[k])moved[k].add(i);}
if(moved.parts.size||moved.conditions.size)console.log('moved between pages, entries relying on them dropped:',JSON.stringify({parts:moved.parts.size,conditions:moved.conditions.size,names:[...new Set([...[...moved.parts].map(i=>rowName(tables.parts[i])),...[...moved.conditions].map(i=>rowName(tables.conditions[i]))])].slice(0,8)}));
const movedRows={parts:[...moved.parts],conditions:[...moved.conditions]};
console.log('scene:',JSON.stringify({...pages[0].setup,tables:undefined}));
// Blocks are shared out as pages come free; none starts after the time limit.
const results=[],queue=[...blocks],deadline=started+MINUTES*60e3;let done=0;
await Promise.all(pages.map(async({page})=>{while(queue.length&&Date.now()<deadline){const block=queue.shift(),r=await page.ev(`__ownerBake.bake(${JSON.stringify([block])})`);results.push(...r.blocks);done++;
 if(done%20===0)console.log(`  ${done}/${blocks.length} blocks, ${((Date.now()-started)/60e3).toFixed(1)} min`);}}));
// The bake's data: entries shared between blocks.
const entries=[],entryIndex=new Map(),stored=results.map(([i0,k0,j0,i1,k1,j1,list])=>[i0,k0,j0,i1,k1,j1,withoutMoved(list,movedRows).map(e=>{const k=JSON.stringify(e);let n=entryIndex.get(k);if(n===undefined){n=entries.length;entries.push(e);entryIndex.set(k,n);}return n;})]);
const data={version:OWNER_BAKE_VERSION,key,made:new Date().toISOString(),grid:{x0:PV.x0,z0:PV.z0,step:PV.step,y0:PV.y0},nearMargin:pages[0].setup.nearMargin,region:{deck:6,slabs:SLABS,margin:MARGIN,top:TOP,blocks:blocks.length,baked:done},parts:tables.parts,conds:tables.conditions,entries,blocks:stored};
// Drop what moved or changed since setup, then the self-check through the walk's own hiding (the unchecked data is kept
// beside the output for a failed one).
const pruned=await pages[0].page.ev(`__ownerBake.prune(${JSON.stringify(data)})`);Object.assign(data,pruned.data);console.log('pruned:',JSON.stringify(pruned.dropped));
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out+'.unchecked',JSON.stringify(data));
const check=data.blocks.length?await pages[0].page.ev(`__ownerBake.check(${JSON.stringify(data)},${POSES})`):{resolved:0,parts:0,condsResolved:0,conds:0,poses:[]},worst=Math.max(0,...check.poses.map(p=>p.big));
console.log('check:',JSON.stringify({resolved:`${check.resolved}/${check.parts}`,conds:`${check.condsResolved}/${check.conds}`,poses:check.poses.length,worstPixels:worst,maxDelta:Math.max(0,...check.poses.map(p=>p.max)),meanHidden:Math.round(check.poses.reduce((a,p)=>a+p.hidden,0)/Math.max(1,check.poses.length))}));
let main,cafeRun;
try{
if(check.resolved!==check.parts||check.condsResolved!==check.conds)throw Error('The walk could not match every baked part and condition; the bake was not kept');
if(worst>MAX_PIXELS)throw Error(`A pose changed ${worst} pixels (> ${MAX_PIXELS}); the bake was not kept`);
// The rows' digests while the walker still stands at the seed the bake was proven from; then the café, from its own.
main=await rowsOf(pages[0].page,data);console.log('owner bake: row digests read at',JSON.stringify(main.where));
cafeRun=await extendCafe(pages[0].page,data);
}finally{for(const {page} of pages)page.close();}
await save(cafeRun.combined,main,cafeRun,code);await fs.rm(out+'.unchecked',{force:true});
console.log(`owner bake: ${done}/${blocks.length} blocks, ${entries.length} entries, ${(Buffer.byteLength(JSON.stringify(data))/1024).toFixed(0)} KB -> ${out} in ${((Date.now()-started)/60e3).toFixed(1)} min`);
process.exit(0);
