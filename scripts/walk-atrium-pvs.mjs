// Atrium PVS: for each 2 m cell of the walk, whether any part of the open atrium can be seen from it (src/v2/atrium-pvs.js
// reads the result in place of the per-frame sight rays). Runs scripts/walk-atrium-pvs.page.js in a debug walk build
// (scripts/walk-frame-build.mjs --debug, served by scripts/walk-frame-serve.mjs) so it tests the walk's own colliders.
//   node scripts/walk-atrium-pvs.mjs --tag=<debug build> [--out=<file>] [--views] [--eyes=x,y,z;...] [--region=x0,x1,z0,z1]
//   node scripts/walk-atrium-pvs.mjs --mask=<pvs.json> [--out=<file>]
// --views only prints the verdict at the eyes of scripts/walk-frame-views.json. The data names the prepared walk it was
// made from; the runtime ignores it for any other.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import WebSocket from 'ws';
import layout from '../src/plan/selected-layout.js';
import {PVS_GRID,encodeCells,decodeCells} from '../src/v2/atrium-pvs.js';
import {atriumEnvelope} from '../src/v2/atrium-sight.js';
import {contains,distanceToSegment} from '../src/plan/geometry-v2.js';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const tag=arg('tag','pvs-base'),port=Number(arg('cdp',9338)),site='http://127.0.0.1:'+arg('port',4211);
const CHROME=arg('chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'),region=arg('region','').split(',').filter(Boolean).map(Number);
// Eye heights above each floor: the lower cell holds the first-person eye (1.62 m), the upper one a raised third-person camera.
const HEIGHTS=[.35,1.65,3],HEADROOM=1.8,BATCH=400;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function browser(){
 const profile=path.resolve('output/perf-walk/chrome-profile-pvs');await fs.rm(profile,{recursive:true,force:true});await fs.mkdir(profile,{recursive:true});
 const chrome=spawn(CHROME,['--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-extensions','--headless=new','--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist',
  '--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=800,600','about:blank'],{stdio:'ignore'});
 for(let i=0;i<80;i++){try{await fetch('http://127.0.0.1:'+port+'/json/version');break;}catch{await sleep(250);}}
 const tab=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json()),socket=new WebSocket(tab.webSocketDebuggerUrl,{maxPayload:1<<30});
 await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});let id=0;const pending=new Map();
 socket.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Runtime.enable');await send('Page.enable');
 return {ev,close(){socket.close();chrome.kill();}};
}

// The atrium as the sight rays bound it (src/v2/atrium-sight.js): one prism over their envelope, the convex hull of
// every deck's outline, up to the sky. Its floor sits 5 cm above deck 6's, where the rays have it 0.3 m under: a floor
// flush with or below the deck's would show through to the gallery beneath, by the prism's polygon offset, though no
// picture there shows the atrium.
const envelope=atriumEnvelope(),deck6=layout.decks.find(d=>d.number===6).y;
const levels=[[envelope.envelope,deck6+.05,envelope.high]];
// An eye inside the envelope the rays call visible unless a known room encloses it, and a cube map of the prism's
// faces cannot tell that apart (from inside the void its faces may all lie behind walls the eye sees past). So every
// cell that reaches into the envelope is left unknown, for the rays to answer as before.
function leaveEnvelope(cells){
 const {x0,z0,nx,nz,step,y0,ny}=PVS_GRID,ring=envelope.envelope,corner=step/Math.SQRT2+.01;let left=0;
 const k0=Math.max(0,Math.floor((envelope.low-y0)/2)),k1=Math.min(ny-1,Math.floor((envelope.high-y0)/2));
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
  const p=[x0+i*step,z0+j*step];
  if(!contains(ring,p)&&!ring.some((a,n)=>distanceToSegment(p,a,ring[(n+1)%ring.length])<corner))continue;
  for(let k=k0;k<=k1;k++){const c=(k*nx+i)*nz+j;if(cells[c]){cells[c]=0;left++;}}
 }
 return left;
}

// --mask=<pvs.json>: leave the envelope's cells unknown in data made before every run did so.
if(arg('mask',null)){const {nx,nz,ny}=PVS_GRID,data=JSON.parse(await fs.readFile(arg('mask'),'utf8')),cells=decodeCells(data.cells,nx*nz*ny),envelopeUnknown=leaveEnvelope(cells);
 let hidden=0,visible=0;for(const v of cells){if(v===1)hidden++;else if(v===2)visible++;}
 const out=arg('out',arg('mask'));await fs.writeFile(out,JSON.stringify({...data,hidden,visible,envelopeUnknown,cells:encodeCells(cells)}));
 console.log('wrote',out,{envelopeUnknown,hidden,visible});process.exit(0);
}

// The envelope above comes from this checkout's layout; the build must have been made from the same one.
const built=JSON.parse(await fs.readFile(path.join('output/perf-walk/builds',tag,'build.json'),'utf8')).layoutSource?.sha256;
const own=createHash('sha256').update(await fs.readFile('output/leo-interior-v02/layout.json')).digest('hex');
if(built!==own)throw Error('Build '+tag+' was made from another layout than this checkout ('+built+' vs '+own+'); rebuild it');

const page=await browser();
try{
 await page.ev(`location.href=${JSON.stringify(site+'/'+tag+'/walk.html?lv=2&view=first&halloween=0')}`);
 for(let i=0;!await page.ev('document.body?.dataset.ready==="1"&&!!globalThis.__walk').catch(()=>false);i++){if(i>2400)throw Error('Walk did not load');await sleep(250);}
 await sleep(3000);
 await page.ev(await fs.readFile('scripts/walk-atrium-pvs.page.js','utf8'));
 const meta=await page.ev('(()=>{const m=window.LEO_PUBLIC_ASSETS||{};return {prepared:m["walk-prepared"]?.sha256||null,layout:m["layout-data"]?.sha256||null};})()');
 console.log('source',meta);
 console.log('setup',await page.ev(`__atriumPvs.setup(${JSON.stringify(levels)})`));
 if(process.argv.includes('--views')){
  const views=JSON.parse(await fs.readFile('scripts/walk-frame-views.json','utf8'));
  for(const v of views){const eyes=[];for(const h of HEIGHTS)for(const dx of [-2,0,2])for(const dz of [-2,0,2])eyes.push(v.at[0]+dx,v.at[1]+h,v.at[2]+dz);const t=Date.now(),r=await page.ev(`__atriumPvs.run(${JSON.stringify(eyes)})`);console.log(v.name.padEnd(22),r.visible.join(''),'faces',r.faces,(Date.now()-t)+' ms');}
  process.exit(0);
 }
 // --eyes=x,y,z;x,y,z...: the verdict at exactly those eyes (debugging a pose).
 if(arg('eyes',null)){const eyes=arg('eyes').split(';').map(e=>e.split(',').map(Number));const r=await page.ev(`__atriumPvs.run(${JSON.stringify(eyes.flat())})`);eyes.forEach((e,i)=>console.log(JSON.stringify(e).padEnd(28),r.visible[i]?'visible':'hidden'));process.exit(0);}
 const {x0,z0,nx,nz,step,y0,ny}=PVS_GRID;
 const [ix0,ix1,iz0,iz1]=region.length?[Math.round((region[0]-x0)/step),Math.round((region[1]-x0)/step),Math.round((region[2]-z0)/step),Math.round((region[3]-z0)/step)]:[0,nx-1,0,nz-1];
 // Eye samples: [cell, x, y, z] over every floor found.
 const samples=[];let t=Date.now();
 for(let i=ix0;i<=ix1;i+=8){
  const n=Math.min(8,ix1-i+1),cols=await page.ev(`__atriumPvs.columns(${x0+i*step},${z0+iz0*step},${n},${iz1-iz0+1},${step},${y0+ny*2+20},${y0-6},${HEADROOM})`);
  for(let c=0;c<cols.length;c+=3){const ci=i+cols[c],cj=iz0+cols[c+1],floors=cols[c+2];
   for(let f=0;f<floors.length;f+=2)for(const h of HEIGHTS){if(h>floors[f+1]-.1)continue;const y=floors[f]+h,k=Math.floor((y-y0)/2);if(k<0||k>=ny)continue;samples.push([(k*nx+ci)*nz+cj,x0+ci*step,y,z0+cj*step]);}}
 }
 console.log('samples',samples.length,'from columns in',((Date.now()-t)/1000).toFixed(0)+' s');
 const known=new Set(samples.map(s=>s[0])),seen=new Set();let faces=0;t=Date.now();
 for(let b=0;b<samples.length;b+=BATCH){
  const batch=samples.slice(b,b+BATCH),r=await page.ev(`__atriumPvs.run(${JSON.stringify(batch.flatMap(s=>s.slice(1)))})`);faces+=r.faces;
  r.visible.forEach((v,i)=>{if(v)seen.add(batch[i][0]);});
  if((b/BATCH)%25===0)console.log('run',b+batch.length,'/',samples.length,'visible cells',seen.size,'faces',faces,((Date.now()-t)/1000).toFixed(0)+' s');
 }
 // A cell is hidden only when it has samples of its own and neither it nor any of its 26 neighbours saw the void.
 const cells=new Uint8Array(nx*nz*ny);
 for(const c of known)cells[c]=1;
 for(const c of seen){const k=Math.floor(c/(nx*nz)),i=Math.floor(c/nz)%nx,j=c%nz;
  for(let dk=-1;dk<=1;dk++)for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const kk=k+dk,ii=i+di,jj=j+dj;if(kk<0||kk>=ny||ii<0||ii>=nx||jj<0||jj>=nz)continue;const n=(kk*nx+ii)*nz+jj;if(cells[n])cells[n]=2;}}
 const envelopeUnknown=leaveEnvelope(cells);
 let hidden=0,visible=0;for(const v of cells){if(v===1)hidden++;else if(v===2)visible++;}
 const data={version:1,made:new Date().toISOString(),source:meta,grid:PVS_GRID,heights:HEIGHTS,known:known.size,hidden,visible,envelopeUnknown,cells:encodeCells(cells)};
 const out=arg('out','output/perf-walk/atrium-pvs/'+tag+'.json');await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(data));
 console.log('wrote',out,{known:known.size,hidden,visible,bytes:data.cells.length,seconds:Math.round((Date.now()-t)/1000)});
}finally{page.close();}
