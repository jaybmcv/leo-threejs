// Owner bake: for each 2 m camera cell over the open atrium floor, the drawables proven hidden from every eye in it
// (src/v2/owner-proof.js), for one exact walk build (src/v2/owner-hiding.js reads it). Runs scripts/walk-owner-bake.page.js
// in the built walk itself, opened with ?ownerBake (geometry arrays kept, the scene handed to the bake).
//   node scripts/walk-owner-bake.mjs --site=<built site dir> [--out=<file>]          (a deploy: after the public build)
//   node scripts/walk-owner-bake.mjs --tag=<debug build> [--port=4221] [--out=<file>] (a study build, scripts/walk-frame-serve.mjs)
// [--pages=2]: blocks are shared among n headless Chromes (a walk page with its arrays peaks near 3 GB). [--minutes=80]:
// no new block starts after this; cells left unbaked hide nothing. [--top=8]: blocks of top x top cells, one slab tall,
// proven whole first and halved where that fails. [--slabs=2] 2 m slabs from Deck 6's floor; [--margin=4] m round Deck 6's atrium outline.
// The bake is kept only if the self-check passes: [--poses=60] random poses inside the baked blocks, drawn with and
// without the hiding through the walk's own createOwnerHiding, none changing more than [--max-pixels=8] pixels by more
// than 24 levels. It is written to walk-owner-bake.<hash>.json beside the walk script (--site), replacing the build's
// empty one, or output/perf-walk/owner-bake/<tag>.json. --if-missing skips the bake when that file already holds blocks.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import WebSocket from 'ws';
import {build as bundle} from './native-bundle.mjs';
import {PVS_GRID} from '../src/v2/atrium-pvs.js';
import {OWNER_BAKE_VERSION,ownerBakeFile,ownerKey} from '../src/v2/owner-hiding.js';
import {contains,distanceToSegment} from '../src/plan/geometry-v2.js';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const SITE_DIR=arg('site',null),TAG=arg('tag',null),PAGES=Number(arg('pages',2)),MINUTES=Number(arg('minutes',80)),TOP=Number(arg('top',8)),SLABS=Number(arg('slabs',2)),MARGIN=Number(arg('margin',4));
const POSES=Number(arg('poses',60)),MAX_PIXELS=Number(arg('max-pixels',8)),CDP=Number(arg('cdp',9348)),CHROME=arg('chrome','C:/Program Files/Google/Chrome/Application/chrome.exe');
if(!SITE_DIR===!TAG)throw Error('Give one of --site=<built site dir> or --tag=<debug build>');
if(!Number.isInteger(PAGES)||PAGES<1||PAGES>8)throw Error('--pages takes a whole number from 1 to 8');
const EV_TIMEOUT_MS=10*60e3,PV=PVS_GRID,sleep=ms=>new Promise(r=>setTimeout(r,ms)),started=Date.now();

// The walk: its page URL and script name.
async function walkPage(){
 if(SITE_DIR){
  const dir=path.resolve(SITE_DIR),types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.bin':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.mp4':'video/mp4','.wasm':'application/wasm','.gz':'application/gzip','.ktx2':'image/ktx2'};
  const server=http.createServer(async(q,s)=>{try{const p=path.join(dir,decodeURIComponent(new URL(q.url,'http://x').pathname));if(!p.startsWith(dir))throw Error('outside');const body=await fs.readFile(p);s.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});s.end(body);}catch{s.writeHead(404);s.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));process.on('exit',()=>server.close());
  const html=await fs.readFile(path.join(dir,'walk.html'),'utf8');return {url:`http://127.0.0.1:${server.address().port}/walk.html`,script:/LEO_WALK_BOOT\("([^"]+)"\)/.exec(html)?.[1],dir};
 }
 const site='http://127.0.0.1:'+arg('port',4221),html=await fetch(`${site}/${TAG}/walk.html`).then(r=>r.text());
 return {url:`${site}/${TAG}/walk.html`,script:/LEO_WALK_BOOT\("([^"]+)"\)|src="\.?\/?(walk\.[0-9a-z]+\.js)"/.exec(html)?.slice(1).find(Boolean),dir:null};
}

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
// Chrome number n on its own CDP port, with a profile of its own; killed when the bake ends.
const chromes=new Set();process.on('exit',()=>{for(const c of chromes)c.kill();});
async function browser(n){
 const port=CDP+n,profile=path.resolve('output/perf-walk/chrome-profile-owner-'+port);await fs.rm(profile,{recursive:true,force:true,maxRetries:20,retryDelay:250});await fs.mkdir(profile,{recursive:true});
 const chrome=spawn(CHROME,['--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-extensions','--headless=new','--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist',
  '--disable-background-timer-throttling','--disable-renderer-backgrounding','--js-flags=--max-old-space-size=8192','--window-size=1920,1080','about:blank'],{stdio:'ignore'});
 chromes.add(chrome);chrome.once('exit',()=>chromes.delete(chrome));
 for(let i=0;i<80;i++){try{await fetch('http://127.0.0.1:'+port+'/json/version');break;}catch{await sleep(250);}}
 const tab=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json()),socket=new WebSocket(tab.webSocketDebuggerUrl,{maxPayload:1<<30});
 await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});let id=0;const pending=new Map();
 socket.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}});
 socket.on('close',()=>{for(const p of pending.values())p.reject(Error('The page connection closed'));pending.clear();});
 const send=(method,params={})=>new Promise((resolve,reject)=>{if(socket.readyState!==WebSocket.OPEN)return reject(Error('The page connection is closed'));const k=++id;pending.set(k,{resolve,reject});socket.send(JSON.stringify({id:k,method,params}));});
 const ev=async expression=>{let timer;const late=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The page did not answer within '+EV_TIMEOUT_MS/1000+' s')),EV_TIMEOUT_MS);});
  const r=await Promise.race([send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}),late]).finally(()=>clearTimeout(timer));if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Runtime.enable');await send('Page.enable');
 return {ev,send,close(){socket.close();chrome.kill();}};
}
// A page with the walk up and the bake installed; its setup() answer.
async function openPage(n,walk,script){
 const page=await browser(n);await page.send('Page.navigate',{url:walk.url+'?lv=2&view=first&halloween=0&ownerBake'});
 const until=Date.now()+10*60e3;
 for(;;){if(Date.now()>until)throw Error('The walk did not come up within 10 minutes on page '+n);
  let up=false;try{up=await page.ev(`document.body?.dataset.ready==='1'&&!!globalThis.__ownerBakeHost`);}catch(e){if(/did not answer|closed/.test(e.message))throw e;}
  if(up)break;await sleep(500);}
 await page.ev(script);return {page,setup:await page.ev(`__ownerBake.setup(${JSON.stringify(seed&&{at:seed.at,yaw:seed.yaw})})`)};
}

const walk=await walkPage();if(!walk.script)throw Error('No walk script named in walk.html');
const scriptKey=ownerKey(walk.script),out=arg('out',walk.dir?path.join(walk.dir,ownerBakeFile(walk.script)):path.resolve('output/perf-walk/owner-bake',TAG+'.json'));
if(process.argv.includes('--if-missing')){try{const d=JSON.parse(await fs.readFile(out,'utf8'));if(d.key?.startsWith(scriptKey)&&d.blocks?.length){console.log('owner bake: already baked for',walk.script);process.exit(0);}}catch{}}
const blocks=await region();console.log(`owner bake: ${walk.script}, ${blocks.length} blocks of ${TOP}x${TOP} cells x ${SLABS} slabs, ${PAGES} pages, ${MINUTES} min`);
const script=(await bundle({entryPoints:['scripts/walk-owner-bake.page.js'],bundle:true,minify:true,format:'iife',write:false,target:'es2022'})).outputFiles[0].text;
const pages=await Promise.all(Array.from({length:PAGES},(_,n)=>openPage(n,walk,script)));
// Every page must see the same scene: the same parts and conditions, in the same order.
const digest=t=>createHash('sha256').update(JSON.stringify(t)).digest('hex');
const tables=pages[0].setup.tables,first=digest(tables),key=pages[0].setup.key;if(!key?.startsWith(scriptKey))throw Error('The page reports key '+key+' for '+walk.script);for(const [n,p] of pages.entries())if(digest(p.setup.tables)!==first){
 // Name what differs: usually a part that moves on its own and is missing from MOVING (walk-owner-bake.scene.js).
 const name=r=>JSON.parse(r[0]).map(s=>s[0]).filter(Boolean).join('/'),differ=['parts','conditions'].flatMap(k=>p.setup.tables[k].filter((r,i)=>JSON.stringify(r)!==JSON.stringify(tables[k][i])).map(name));
 throw Error(`Page ${n} built a different scene (${[...new Set(differ)].slice(0,6).join(', ')||'tables of another length'}); the bake was not kept`);}
console.log('scene:',JSON.stringify({...pages[0].setup,tables:undefined}));
// Blocks are shared out as pages come free; none starts after the time limit.
const results=[],queue=[...blocks],deadline=started+MINUTES*60e3;let done=0;
await Promise.all(pages.map(async({page})=>{while(queue.length&&Date.now()<deadline){const block=queue.shift(),r=await page.ev(`__ownerBake.bake(${JSON.stringify([block])})`);results.push(...r.blocks);done++;
 if(done%20===0)console.log(`  ${done}/${blocks.length} blocks, ${((Date.now()-started)/60e3).toFixed(1)} min`);}}));
// The bake's data: entries shared between blocks.
const entries=[],entryIndex=new Map(),stored=results.map(([i0,k0,j0,i1,k1,j1,list])=>[i0,k0,j0,i1,k1,j1,list.map(e=>{const k=JSON.stringify(e);let n=entryIndex.get(k);if(n===undefined){n=entries.length;entries.push(e);entryIndex.set(k,n);}return n;})]);
const data={version:OWNER_BAKE_VERSION,key,made:new Date().toISOString(),grid:{x0:PV.x0,z0:PV.z0,step:PV.step,y0:PV.y0},nearMargin:pages[0].setup.nearMargin,region:{deck:6,slabs:SLABS,margin:MARGIN,top:TOP,blocks:blocks.length,baked:done},parts:tables.parts,conds:tables.conditions,entries,blocks:stored};
// Drop what moved or changed since setup, then the self-check through the walk's own hiding (the unchecked data is kept
// beside the output for a failed one).
const pruned=await pages[0].page.ev(`__ownerBake.prune(${JSON.stringify(data)})`);Object.assign(data,pruned.data);console.log('pruned:',JSON.stringify(pruned.dropped));
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out+'.unchecked',JSON.stringify(data));
const check=data.blocks.length?await pages[0].page.ev(`__ownerBake.check(${JSON.stringify(data)},${POSES})`):{resolved:0,parts:0,condsResolved:0,conds:0,poses:[]},worst=Math.max(0,...check.poses.map(p=>p.big));
console.log('check:',JSON.stringify({resolved:`${check.resolved}/${check.parts}`,conds:`${check.condsResolved}/${check.conds}`,poses:check.poses.length,worstPixels:worst,maxDelta:Math.max(0,...check.poses.map(p=>p.max)),meanHidden:Math.round(check.poses.reduce((a,p)=>a+p.hidden,0)/Math.max(1,check.poses.length))}));
for(const {page} of pages)page.close();
if(check.resolved!==check.parts||check.condsResolved!==check.conds)throw Error('The walk could not match every baked part and condition; the bake was not kept');
if(worst>MAX_PIXELS)throw Error(`A pose changed ${worst} pixels (> ${MAX_PIXELS}); the bake was not kept`);
await fs.writeFile(out+'.part',JSON.stringify(data));await fs.rm(out+'.unchecked',{force:true});await fs.rename(out+'.part',out);
console.log(`owner bake: ${done}/${blocks.length} blocks, ${entries.length} entries, ${(Buffer.byteLength(JSON.stringify(data))/1024).toFixed(0)} KB -> ${out} in ${((Date.now()-started)/60e3).toFixed(1)} min`);
process.exit(0);
