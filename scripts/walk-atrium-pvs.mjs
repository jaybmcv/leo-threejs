// Atrium PVS: for each 2 m cell of the walk, whether any part of the open atrium can be seen from it (src/v2/atrium-pvs.js
// reads the result in place of the per-frame sight rays). Runs scripts/walk-atrium-pvs.page.js in a debug walk build
// (scripts/walk-frame-build.mjs --debug, served by scripts/walk-frame-serve.mjs) so it tests the walk's own colliders.
//   node scripts/walk-atrium-pvs.mjs --tag=<debug build> [--layout=<layout.json>] [--out=<file>] [--views] [--eyes=x,y,z;...] [--region=x0,x1,z0,z1]
//   node scripts/walk-atrium-pvs.mjs --prepared=<prepared-walk dir> [--layout=<layout.json>] [--out=<file>] [--if-missing] [...]
// --prepared bakes straight from a prepared walk (as authored, or as published), with no walk built: Chrome loads only its
// colliders (scripts/walk-atrium-pvs.entry.js). It writes output/leo-interior-v02/atrium-pvs/<key>.json by default.
// --if-missing skips the bake when one for the walk's key is already there or committed (scripts/atrium-pvs-source.mjs
// bakedPvs), as on a deploy whose colliders and atrium did not change: the key takes about 20 s, a bake most of an hour.
// --views only prints the verdict at the eyes of scripts/walk-frame-views.json. The data carries the key
// (src/v2/atrium-pvs-key.js) of the colliders and atrium it was baked from; the public build ships it only to a walk with
// the same key (scripts/atrium-pvs-source.mjs), so other rebuilds keep it. Copy it to src/walk/assets/atrium-pvs.json, or
// to output/leo-interior-v02/atrium-pvs/<key>.json on the building machine.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import http from 'node:http';
import WebSocket from 'ws';
import {PVS_GRID,PVS_RANGE,encodeCells,decodeCells,snapRange} from '../src/v2/atrium-pvs.js';
import {pvsKey} from '../src/v2/atrium-pvs-key.js';
import {contains,distanceToSegment} from '../src/plan/geometry-v2.js';
import {build as bundle} from './native-bundle.mjs';
import {bakedPvs,layoutPvsSetup,preparedDigest,preparedIntegrity,PVS_LAYOUT,PVS_BAKED_DIR} from './atrium-pvs-source.mjs';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const tag=arg('tag','pvs-base'),prepared=arg('prepared',null),port=Number(arg('cdp',9338)),site='http://127.0.0.1:'+arg('port',4211);
const CHROME=arg('chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'),region=arg('region','').split(',').filter(Boolean).map(Number);
const HEADROOM=1.8,BATCH=400,CANARY_EVERY=10,MAX_FRESH=4,EV_TIMEOUT_MS=5*60e3,CLOSE_MS=10e3;
const loseAt=Number(arg('lose-context-at',-1));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function browser(){
 const profile=path.resolve('output/perf-walk/chrome-profile-pvs');await fs.rm(profile,{recursive:true,force:true,maxRetries:20,retryDelay:250});await fs.mkdir(profile,{recursive:true});
 const chrome=spawn(CHROME,['--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-extensions','--headless=new','--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist',
  '--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=800,600','about:blank'],{stdio:'ignore'});
 for(let i=0;i<80;i++){try{await fetch('http://127.0.0.1:'+port+'/json/version');break;}catch{await sleep(250);}}
 const tab=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json()),socket=new WebSocket(tab.webSocketDebuggerUrl,{maxPayload:1<<30});
 await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});let id=0;const pending=new Map();
 socket.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}});
 // Calls still waiting when the connection closes (Chrome gone) fail at once rather than never.
 socket.on('close',()=>{for(const p of pending.values())p.reject(Error('The page connection closed'));pending.clear();});
 const send=(method,params={})=>new Promise((resolve,reject)=>{if(socket.readyState!==WebSocket.OPEN)return reject(Error('The page connection is closed'));const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 // Every call answers within EV_TIMEOUT_MS: an unattended bake must not hang until the deploy's own time limit.
 const ev=async expression=>{let timer;const late=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The page did not answer within '+EV_TIMEOUT_MS/1000+' s')),EV_TIMEOUT_MS);});
  const r=await Promise.race([send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}),late]).finally(()=>clearTimeout(timer));if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Runtime.enable');await send('Page.enable');
 // close() resolves once Chrome has exited (or at once if it already has), so a fresh one can take its profile; it waits
 // at most CLOSE_MS, and a second call returns the first one's promise.
 let closed=null;
 return {ev,close(){return closed??=(async()=>{socket.close();if(chrome.exitCode!==null||chrome.signalCode!==null)return;const exited=new Promise(r=>chrome.once('exit',r));chrome.kill();await Promise.race([exited,sleep(CLOSE_MS)]);})();}};
}

// The setup (pvsSetup in src/v2/atrium-pvs-key.js) comes from the layout the build was made from: the void is one prism
// over the sight rays' envelope, up to the sky. span() in src/walk/main.public.js draws the envelope's height while the
// atrium is seen, and otherwise at least the local span about the walker's floor. A surface between the two is drawn only
// on the atrium's account, so seeing one counts as seeing the atrium. (A group spanning several bands shows whole once
// either span reaches it; its parts beyond the atrium's bands are not counted.)
// A debug build names its layout; --layout may point at a copy of it.
const built=prepared?null:JSON.parse(await fs.readFile(path.join('output/perf-walk/builds',tag,'build.json'),'utf8')).layoutSource;
const layoutFile=arg('layout',built?.file??PVS_LAYOUT),layoutText=await fs.readFile(layoutFile,'utf8');
if(built&&createHash('sha256').update(layoutText).digest('hex')!==built.sha256)throw Error(layoutFile+' is not the layout build '+tag+' was made from; pass --layout=<its copy>');
const setup=await layoutPvsSetup(layoutText),[[ring]]=setup.levels;
// An eye inside the envelope the rays call visible unless a known room encloses it, and a cube map of the prism's
// faces cannot tell that apart (from inside the void its faces may all lie behind walls the eye sees past). So every
// cell that reaches into the envelope is left unknown, for the rays to answer as before.
function leaveEnvelope(cells){
 const {x0,z0,nx,nz,step,y0,ny}=PVS_GRID,corner=step/Math.SQRT2+.01;let left=0;
 const k0=Math.max(0,Math.floor((setup.atriumSpan[0]-y0)/2)),k1=Math.min(ny-1,Math.floor((setup.atriumSpan[1]-y0)/2));
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
  const p=[x0+i*step,z0+j*step];
  if(!contains(ring,p)&&!ring.some((a,n)=>distanceToSegment(p,a,ring[(n+1)%ring.length])<corner))continue;
  for(let k=k0;k<=k1;k++){const c=(k*nx+i)*nz+j;if(cells[c]){cells[c]=0;left++;}}
 }
 return left;
}
// The key's collider share, worked out in the page from the walk's own colliders: it must equal the one the public build
// decodes from the prepared walk, or the build would key this data to other geometry.
const digestScript=(await bundle({entryPoints:['src/v2/atrium-pvs-key.js'],bundle:true,format:'iife',globalName:'__atriumPvsKey',write:false,target:'es2022'})).outputFiles[0].text;

// --prepared: a local server for the colliders page and the prepared walk's files.
async function servePrepared(dir){
 const script=(await bundle({entryPoints:['scripts/walk-atrium-pvs.entry.js'],bundle:true,minify:true,format:'esm',write:false,target:'es2022'})).outputFiles[0].text;
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://x'),name=decodeURIComponent(url.pathname);
  try{
   if(name==='/')return res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><body><script type="module" src="bake.js"></script></body>');
   if(name==='/bake.js')return res.writeHead(200,{'content-type':'text/javascript'}).end(script);
   // A sectioned publish's files sit beside its directory, in prepared-walk/sections/ (prepared-sections-v2.mjs).
   const file=/^\/prepared\/([\w.-]+)$/.exec(name)?.[1],section=/^\/sections\/(s-[0-9a-f]{20}(?:-\d+)?[.]bin)$/.exec(name)?.[1];if(!file&&!section)return res.writeHead(404).end();
   res.writeHead(200,{'content-type':'application/octet-stream'}).end(await fs.readFile(file?path.join(dir,file):path.join(dir,'..','sections',section)));
  }catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:'http://127.0.0.1:'+server.address().port+'/',close:()=>server.close()};
}

if(prepared&&process.argv.includes('--if-missing')){
 const key=pvsKey(await preparedDigest(prepared),setup);
 if((await bakedPvs(key)).text){console.log('already baked',key);process.exit(0);}
 console.log('baking',key);
}
const served=prepared&&await servePrepared(prepared);let page=await browser();
// The page with the colliders and the bake's own script (set up by setUp), opened again on a fresh browser when the GPU
// goes wrong part way through a bake (CANARY_EVERY, below).
async function open(){
 const names=prepared&&await fs.readdir(prepared),meta=prepared&&['sections.json','world.parts.json','world.bin','world.json.gz'].find(n=>names.includes(n));
 await page.ev(`location.href=${JSON.stringify(prepared?served.url+'?meta='+meta:site+'/'+tag+'/walk.html?lv=2&view=first&halloween=0')}`);
 for(let i=0;!await page.ev('document.body?.dataset.ready==="1"&&!!globalThis.__walk').catch(()=>false);i++){
  const failed=await page.ev('document.body?.dataset.failed').catch(()=>null);if(failed)throw Error('Colliders did not load: '+failed);
  if(i>2400)throw Error('Walk did not load');await sleep(250);
 }
 if(!prepared)await sleep(3000);
 await page.ev(await fs.readFile('scripts/walk-atrium-pvs.page.js','utf8'));
}
const setUp=async()=>{const units=await page.ev('__atriumPvs.range');if(units.y0!==PVS_RANGE.y0||units.span!==PVS_RANGE.span)throw Error('The bake page measures heights unlike src/v2/atrium-pvs.js PVS_RANGE');return page.ev(`__atriumPvs.setup(${JSON.stringify(setup.levels)},${JSON.stringify(setup.atriumSpan)},${JSON.stringify(setup.localSpan)},${JSON.stringify(setup.band)})`);};
// Eyes about the bench views (scripts/walk-frame-views.json), [x, y, z, floor] each: the bake's canary and its check.
const benchEyes=async()=>{const views=JSON.parse(await fs.readFile('scripts/walk-frame-views.json','utf8')),eyes=[];
 for(const v of views)for(const h of setup.heights)for(const dx of [-2,0,2])for(const dz of [-2,0,2])eyes.push({view:v.name,eye:[v.at[0]+dx,v.at[1]+h,v.at[2]+dz,v.at[1]]});return eyes;};
try{
 await open();
 const dir=prepared||path.join('output/perf-walk/mirror',await page.ev('window.LEO_PUBLIC_ASSETS["walk-prepared"].directory'));
 const digest=await preparedDigest(dir);
 // Checked on every page, a fresh one after the GPU went wrong included.
 const checkColliders=async()=>{await page.ev(digestScript);const walkDigest=await page.ev('__atriumPvsKey.colliderDigest(__walk.colliders)');
  if(walkDigest!==digest)throw Error(`The walk's colliders (${walkDigest}) are not those of the prepared walk in ${dir} (${digest})`);};
 await checkColliders();
 const integrity=await preparedIntegrity(dir)??await page.ev('window.LEO_PUBLIC_ASSETS?.["walk-prepared"]?.sha256??null')??path.basename(path.resolve(dir));
 const source={prepared:integrity,layout:createHash('sha256').update(layoutText).digest('hex'),key:pvsKey(digest,setup)};
 console.log('source',source);
 console.log('setup',await setUp());
 if(process.argv.includes('--views')){
  const views=JSON.parse(await fs.readFile('scripts/walk-frame-views.json','utf8'));
  for(const v of views){const eyes=[];for(const h of setup.heights)for(const dx of [-2,0,2])for(const dz of [-2,0,2])eyes.push(v.at[0]+dx,v.at[1]+h,v.at[2]+dz,v.at[1]);const t=Date.now(),r=await page.ev(`__atriumPvs.run(${JSON.stringify(eyes)})`);console.log(v.name.padEnd(22),r.visible.join(''),'faces',r.faces,(Date.now()-t)+' ms');}
  process.exit(0);
 }
 // --eyes=x,y,z[,floor];...: the verdict at exactly those eyes (debugging a pose); the walker's floor defaults to a
 // first-person eye's.
 if(arg('eyes',null)){const eyes=arg('eyes').split(';').map(e=>e.split(',').map(Number)).map(([x,y,z,floor=y-1.62])=>[x,y,z,floor]);const r=await page.ev(`__atriumPvs.run(${JSON.stringify(eyes.flat())})`);const y=v=>(PVS_RANGE.y0+PVS_RANGE.span*v/255).toFixed(1);eyes.forEach((e,i)=>console.log(JSON.stringify(e).padEnd(28),r.visible[i]?'visible '+y(r.lo[i])+' to '+y(r.hi[i]):'hidden'));process.exit(0);}
 const {x0,z0,nx,nz,step,y0,ny}=PVS_GRID;
 const [ix0,ix1,iz0,iz1]=region.length?[Math.round((region[0]-x0)/step),Math.round((region[1]-x0)/step),Math.round((region[2]-z0)/step),Math.round((region[3]-z0)/step)]:[0,nx-1,0,nz-1];
 // Eye samples: [cell, x, y, z, floor] over every floor found.
 const samples=[];let t=Date.now();
 for(let i=ix0;i<=ix1;i+=8){
  const n=Math.min(8,ix1-i+1),cols=await page.ev(`__atriumPvs.columns(${x0+i*step},${z0+iz0*step},${n},${iz1-iz0+1},${step},${y0+ny*2+20},${y0-6},${HEADROOM})`);
  for(let c=0;c<cols.length;c+=3){const ci=i+cols[c],cj=iz0+cols[c+1],floors=cols[c+2];
   for(let f=0;f<floors.length;f+=2)for(const h of setup.heights){if(h>floors[f+1]-.1)continue;const y=floors[f]+h,k=Math.floor((y-y0)/2);if(k<0||k>=ny)continue;samples.push([(k*nx+ci)*nz+cj,x0+ci*step,y,z0+cj*step,floors[f]]);}}
 }
 console.log('samples',samples.length,'from columns in',((Date.now()-t)/1000).toFixed(0)+' s');
 // seen: each cell that saw the void, with the lowest and highest height (bytes, PVS_RANGE) any of its eyes reached.
 const known=new Set(samples.map(s=>s[0])),seen=new Map();let faces=0;t=Date.now();
 // A long bake's page can stop drawing what it should: two full bakes of 0e604d6 saw the atrium from fewer and fewer
 // bench-view eyes (157 on a fresh page, 88 and 56 at the end) and failed their check, while a fresh page answers the
 // same every time. So the bench-view eyes are a canary: every CANARY_EVERY batches, and when the WebGL context was
 // lost, they must answer as they did on the first page, or the batches since the last good canary are redone on a
 // fresh browser. The check at the end is unchanged.
 // A run that fails or does not answer counts as a page gone wrong, as a lost context does.
 const run=async eyes=>{try{return await page.ev(`__atriumPvs.run(${JSON.stringify(eyes)})`);}catch(e){console.log('the page failed a run:',e.message);return {visible:[],faces:0,lost:true};}};
 const canaryEyes=(await benchEyes()).flatMap(e=>e.eye),canary=async()=>{const r=await run(canaryEyes);return r.lost?null:r.visible.join('');};
 const baseline=await canary();if(!baseline)throw Error('The WebGL context was lost before the bake began');
 let pending=[],checkpoint=0,since=0,fresh=0;
 for(let b=0;b<samples.length;){
  // --lose-context-at=<n> (testing): the WebGL context is lost before the n-th batch, once.
  if(loseAt>=0&&b===loseAt*BATCH&&!fresh)await page.ev('__walk.renderer.forceContextLoss(),true');
  const batch=samples.slice(b,b+BATCH),r=await run(batch.flatMap(s=>s.slice(1)));faces+=r.faces;
  r.visible.forEach((v,i)=>{if(v)pending.push([batch[i][0],r.lo[i],r.hi[i]]);});
  if((b/BATCH)%25===0)console.log('run',b+batch.length,'/',samples.length,'visible cells',seen.size+pending.length,'faces',faces,((Date.now()-t)/1000).toFixed(0)+' s');
  b+=batch.length;since++;
  if(!r.lost&&since<CANARY_EVERY&&b<samples.length)continue;
  const now=r.lost?null:await canary();
  if(now===baseline){for(const [c,l,h] of pending){const s=seen.get(c);if(s){s[0]=Math.min(s[0],l);s[1]=Math.max(s[1],h);}else seen.set(c,[l,h]);}pending=[];checkpoint=b;since=0;continue;}
  // Redo from the last good canary on a fresh browser, which must answer as the first page did.
  const differ=now?[...now].filter((v,i)=>v!==baseline[i]).length:null;
  if(++fresh>MAX_FRESH)throw Error(`The page went wrong ${fresh} times (canary eyes changed or the context was lost); the bake was not kept`);
  console.log('page went wrong after sample',b,now?`(${differ} canary eyes changed)`:'(WebGL context lost)','- redoing from',checkpoint,'on a fresh browser');
  await page.close();page=await browser();await open();await checkColliders();await setUp();
  if(await canary()!==baseline)throw Error('A fresh page does not answer the canary as the first did: the bake is not repeatable here');
  pending=[];b=checkpoint;since=0;
 }
 // A cell is hidden only when it has samples of its own and neither it nor any of its 26 neighbours saw the void; a
 // visible one reaches every height those neighbours reached.
 const cells=new Uint8Array(nx*nz*ny),lo=new Uint8Array(cells.length).fill(255),hi=new Uint8Array(cells.length);
 for(const c of known)cells[c]=1;
 for(const [c,[l,h]] of seen){const k=Math.floor(c/(nx*nz)),i=Math.floor(c/nz)%nx,j=c%nz;
  for(let dk=-1;dk<=1;dk++)for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const kk=k+dk,ii=i+di,jj=j+dj;if(kk<0||kk>=ny||ii<0||ii>=nx||jj<0||jj>=nz)continue;const n=(kk*nx+ii)*nz+jj;
   if(cells[n]){cells[n]=2;if(l<lo[n])lo[n]=l;if(h>hi[n])hi[n]=h;}}}
 const envelopeUnknown=leaveEnvelope(cells);
 let hidden=0,visible=0;for(const v of cells){if(v===1)hidden++;else if(v===2)visible++;}
 // The bake checks itself before it is kept, since the key proves only which geometry it was baked from: a GPU that drew
 // nothing would call every cell hidden. At least a twentieth of the known cells must see the atrium, the cells must read
 // back as written, and no cell may be hidden where eyes about the bench views (scripts/walk-frame-views.json) see it.
 // Those eyes must also answer as on the first page (the canary's baseline): a page that drifted after the last canary
 // would see less from them, and check less.
 const cellAt=(x,y,z)=>{const i=Math.round((x-x0)/step),j=Math.round((z-z0)/step),k=Math.floor((y-y0)/2);return i<0||i>=nx||j<0||j>=nz||k<0||k>=ny?-1:(k*nx+i)*nz+j;};
 let probes=0,changed=0;const contradicted=new Set(),narrow=new Set(),eyes=await benchEyes();
 {const r=await page.ev(`__atriumPvs.run(${JSON.stringify(eyes.flatMap(e=>e.eye))})`);if(r.lost)throw Error('The WebGL context was lost during the check; the bake was not kept');
  r.visible.forEach((seen,e)=>{if(!seen)return;probes++;const [x,y,z]=eyes[e].eye,c=cellAt(x,y,z);if(c>=0&&cells[c]===1)contradicted.add(eyes[e].view);
   // Its cell must reach at least the heights the eye's own sight reaches.
   if(c>=0&&cells[c]===2&&(lo[c]>r.lo[e]||hi[c]<r.hi[e]))narrow.add(eyes[e].view);});
  if(r.visible.join('')!==baseline)changed=[...r.visible.join('')].filter((v,i)=>v!==baseline[i]).length;}
 for(let c=0;c<cells.length;c++)if(cells[c]!==2)lo[c]=hi[c]=0;else[lo[c],hi[c]]=snapRange(lo[c],hi[c]);
 const encoded=encodeCells(cells),back=decodeCells(encoded,cells.length),problems=[];
 const ranges={...PVS_RANGE,lo:encodeCells(lo),hi:encodeCells(hi)},backLo=decodeCells(ranges.lo,cells.length,255),backHi=decodeCells(ranges.hi,cells.length,255);
 if(visible<known.size/20)problems.push(`only ${visible} of ${known.size} known cells see the atrium`);
 // And at least a twentieth hidden: a page whose occluders drew nothing (a shader that failed to compile, say) sees the
 // atrium from everywhere, which no check above can catch.
 if(hidden<known.size/20)problems.push(`only ${hidden} of ${known.size} known cells are hidden: did the occluders draw?`);
 if(!probes)problems.push('no bench-view eye sees the atrium');
 if(changed)problems.push(changed+' bench-view eyes answer differently from the first page');
 if(contradicted.size)problems.push('cells hidden where bench-view eyes see the atrium: '+[...contradicted].join(', '));
 if(narrow.size)problems.push('cells reach fewer heights than bench-view eyes in them see: '+[...narrow].join(', '));
 if(back.some((v,i)=>v!==cells[i]))problems.push('the cells do not read back as written');
 if(backLo.some((v,i)=>v!==lo[i])||backHi.some((v,i)=>v!==hi[i]))problems.push('the ranges do not read back as written');
 console.log('check',{probes,contradicted:contradicted.size,narrow:narrow.size,visibleShare:+(visible/Math.max(1,known.size)).toFixed(3)});
 if(problems.length)throw Error('The PVS failed its check, so it was not kept: '+problems.join('; '));
 const data={version:1,made:new Date().toISOString(),source,grid:PVS_GRID,heights:setup.heights,atriumSpan:setup.atriumSpan,localSpan:setup.localSpan,known:known.size,hidden,visible,envelopeUnknown,cells:encoded,ranges};
 const out=arg('out',prepared?path.join(PVS_BAKED_DIR,source.key+'.json'):'output/perf-walk/atrium-pvs/'+tag+'.json');await fs.mkdir(path.dirname(out),{recursive:true});
 // Written whole, then renamed: a bake stopped part way (a deploy's time limit) leaves no half file under the key.
 await fs.writeFile(out+'.part',JSON.stringify(data));await fs.rename(out+'.part',out);
 console.log('wrote',out,{known:known.size,hidden,visible,bytes:data.cells.length,seconds:Math.round((Date.now()-t)/1000)});
}finally{await page.close();served?.close();}
