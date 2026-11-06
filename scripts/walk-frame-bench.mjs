// Frame-time study benchmark. Loads /<tag>/walk.html (debug builds from scripts/walk-frame-build.mjs, served by
// scripts/walk-frame-serve.mjs) in a dedicated Chrome with vsync and the frame cap off, teleports to fixed views and
// records, per frame: the interval between frames, main-thread time in the frame callback and GPU time (timer query).
// With --shots it also captures each view on a virtual clock (fixed 1/60 s per frame, seeded Math.random) so builds
// can be compared pixel for pixel by scripts/walk-frame-diff.mjs. Usage:
//   node scripts/walk-frame-bench.mjs --tags=base,cand --rounds=3 --frames=300 [--shots] [--out=name] [--list-places] [--profile]
//   [--query=a=1&b=2] (added to every page's URL)
// Chrome runs in a visible window by default (headless timings on this PC varied about 20% between rounds);
// --headless runs it headless on the real GPU, for when the display may lock.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const tags=arg('tags','base').split(','),rounds=Number(arg('rounds',3)),frames=Number(arg('frames',300)),shots=process.argv.includes('--shots');
const width=Number(arg('width',1920)),height=Number(arg('height',1080)),port=Number(arg('cdp',9337)),site='http://127.0.0.1:'+arg('port',4211);
const outName=arg('out',tags.join('-')),outDir=path.resolve('output/perf-walk/results');
const VIEWS=JSON.parse(await fs.readFile(arg('views','scripts/walk-frame-views.json'),'utf8').catch(()=>'[]'));
const CHROME=arg('chrome','C:/Program Files/Google/Chrome/Application/chrome.exe');

// Runs before the page's own scripts: seeded randomness, a fixed resolution choice, a clock that can be made virtual,
// and per-frame timing around every animation-frame callback.
const INIT=`(()=>{
 let seed=20261103;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{localStorage.setItem('leo-walk-resolution','High');}catch{}
 const realNow=performance.now.bind(performance),realDate=Date.now,B=window.__bench={virtual:false,running:true,vt:0,step:1000/60,recording:false,frames:[],gl:null,ext:null,pending:[]};
 performance.now=()=>B.virtual?B.vt:realNow();Date.now=()=>B.virtual?1793750400000+Math.round(B.vt):realDate();
 B.poll=()=>{const gl=B.gl,ext=B.ext;while(B.pending.length){const p=B.pending[0];if(!gl.getQueryParameter(p.q,gl.QUERY_RESULT_AVAILABLE))break;const bad=gl.getParameter(ext.GPU_DISJOINT_EXT);p.f.gpu=bad?null:gl.getQueryParameter(p.q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(p.q);B.pending.shift();}};
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(t=>{
  if(B.virtual&&B.running)B.vt+=B.step;
  const t0=realNow(),gl=B.gl,ext=B.recording&&B.ext;let q=null;
  if(ext){q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);}
  try{cb(B.virtual?B.vt:t);}finally{
   if(q)gl.endQuery(ext.TIME_ELAPSED_EXT);
   if(B.recording){const f={start:t0,cpu:realNow()-t0,gpu:null};B.frames.push(f);if(q)B.pending.push({q,f});}
   if(B.gl&&B.ext)B.poll();
  }
 });
})();`;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(){
 // A fresh profile each launch: state saved by an interrupted load (seen once) can stall every later start.
 const profile=path.resolve('output/perf-walk/chrome-profile');await fs.rm(profile,{recursive:true,force:true});await fs.mkdir(profile,{recursive:true});
 const flags=['--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-extensions',
  '--disable-gpu-vsync','--disable-frame-rate-limit','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
  ...(!process.argv.includes('--headless')?[]:['--headless=new','--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']),
  '--force-device-scale-factor=1','--window-position=0,0','--window-size='+width+','+(height+140),'--autoplay-policy=no-user-gesture-required','about:blank'];
 const chrome=spawn(CHROME,flags,{stdio:'ignore'});
 for(let i=0;i<80;i++){try{await fetch('http://127.0.0.1:'+port+'/json/version');return chrome;}catch{await sleep(250);}}
 throw Error('Chrome did not open its debugging port');
}
async function connect(){
 const tab=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json()),socket=new WebSocket(tab.webSocketDebuggerUrl,{maxPayload:1<<30});
 await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});let id=0;const pending=new Map(),errors=[];
 socket.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async(expression,timeout=300000)=>{const end=Date.now()+timeout;while(!await ev(expression).catch(()=>false)){if(Date.now()>end)throw Error('Timed out waiting for '+expression);await sleep(250);}};
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:INIT});
 return {send,ev,wait,errors,close:()=>{socket.close();return fetch('http://127.0.0.1:'+port+'/json/close/'+tab.id).catch(()=>{});}};
}
const nextFrames=n=>`new Promise(r=>{let n=${n};const f=()=>--n>0?requestAnimationFrame(f):r(true);requestAnimationFrame(f);})`;
const place=v=>`(()=>{const w=__walk;w.input.enabled=false;w.input.down?.clear?.();if(!w.goTo({at:${JSON.stringify(v.at)},yaw:${v.yaw},resolved:true}))throw Error('No stand at ${v.name}');w.follow.mode='first';w.follow.yaw=${v.yaw*Math.PI/180};w.follow.pitch=${(v.pitch||0)*Math.PI/180};w.follow.look(0,0);return true;})()`;
const stats=a=>{const s=[...a].sort((x,y)=>x-y),n=s.length,mean=s.reduce((x,y)=>x+y,0)/n;return {n,mean,median:s[n>>1],p95:s[Math.min(n-1,Math.floor(n*.95))],p99:s[Math.min(n-1,Math.floor(n*.99))]};};

async function open(page,tag){
 await page.send('Page.navigate',{url:site+'/'+tag+'/walk.html?lv=2&view=first&halloween=0'+(arg('query',null)?'&'+arg('query'):'')});
 await page.wait('document.body?.dataset.ready==="1"&&!!globalThis.__walk',600000);
 // Interior rooms and lazily built details arrive after the first frames.
 await page.ev(nextFrames(120));await sleep(4000);
 return page.ev(`(()=>{const B=__bench,gl=__walk.renderer.getContext();B.gl=gl;B.ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');const d=gl.getExtension('WEBGL_debug_renderer_info');return {gpuTimer:!!B.ext,renderer:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):null,size:[gl.drawingBufferWidth,gl.drawingBufferHeight]};})()`);
}
async function measure(page,v){
 await page.ev(place(v));await page.ev(nextFrames(90));await sleep(1500);await page.ev(nextFrames(60));
 await page.ev('(()=>{const B=__bench;B.frames=[];B.recording=true;return true})()');
 await page.ev(nextFrames(frames));
 await page.ev('(()=>{__bench.recording=false;return true})()');await page.ev(nextFrames(8));
 const raw=await page.ev('__bench.frames.map(f=>[f.start,f.cpu,f.gpu])'),info=await page.ev('(()=>{const i=__walk.renderer.info.render;return {calls:i.calls,triangles:i.triangles}})()');
 const intervals=raw.slice(1).map((f,i)=>f[0]-raw[i][0]),gpu=raw.map(f=>f[2]).filter(x=>x!=null);
 return {view:v.name,frame:stats(intervals),cpu:stats(raw.map(f=>f[1])),gpu:gpu.length?stats(gpu):null,...info};
}
async function capture(page,v,dir){
 await page.ev(place(v));
 // Settle loads with the clock stopped, then advance exactly the same frames in every build.
 await page.ev('(()=>{__bench.running=false;return true})()');await page.ev(nextFrames(30));await sleep(2500);await page.ev(nextFrames(30));
 await page.ev('(()=>{__bench.running=true;return true})()');await page.ev(nextFrames(60));await page.ev('(()=>{__bench.running=false;return true})()');await page.ev(nextFrames(3));
 const shot=await page.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(dir,v.name+'.png'),Buffer.from(shot.data,'base64'));
}
async function stills(tag){
 const dir=path.resolve('output/perf-walk/shots',tag);await fs.mkdir(dir,{recursive:true});
 const page=await connect();await page.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__bench&&(window.__bench.virtual=true);'});
 // The virtual clock starts with the page, so the whole startup sequence is the same in every build.
 try{await page.send('Page.navigate',{url:site+'/'+tag+'/walk.html?lv=2&view=first&halloween=0'});await page.wait('document.body?.dataset.ready==="1"&&!!globalThis.__walk',600000);
  await page.ev('(()=>{__bench.running=false;return true})()');await sleep(4000);await page.ev('(()=>{__bench.running=true;return true})()');await page.ev(nextFrames(120));
  for(const v of VIEWS)await capture(page,v,dir);}finally{await page.close();}
}

// Source positions for a --map build: each generated line's segments [column, source, line, column].
async function sourceMapper(tag){
 const dir=path.resolve('output/perf-walk/builds',tag),file=(await fs.readdir(dir)).find(n=>n.endsWith('.js.map'));if(!file)return null;
 const map=JSON.parse(await fs.readFile(path.join(dir,file),'utf8')),B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',lines=[];let src=0,line=0,col=0;
 for(const text of map.mappings.split(';')){const segs=[];let gen=0;for(const seg of text.split(',')){if(!seg)continue;const v=[];let shift=0,value=0;for(const ch of seg){const d=B64.indexOf(ch);value+=(d&31)<<shift;if(d&32)shift+=5;else{v.push(value&1?-(value>>1):value>>1);shift=value=0;}}
  gen+=v[0];if(v.length>=4){src+=v[1];line+=v[2];col+=v[3];segs.push([gen,src,line]);}}lines.push(segs);}
 return (l,c)=>{const segs=lines[l]||[];let hit=null;for(const s of segs){if(s[0]>c)break;hit=s;}return hit?map.sources[hit[1]].replace(/^.*?(src|node_modules)\//,'$1/')+':'+(hit[2]+1):null;};
}
await fs.mkdir(outDir,{recursive:true});
const chrome=await launch();
try{
 if(process.argv.includes('--list-places')){const page=await connect();try{console.log(await open(page,tags[0]));const places=await page.ev('__walk.PLACES.map(p=>({name:p.name||p.label||p.id,id:p.id,at:p.at,deck:p.deck}))');await fs.writeFile(path.join(outDir,'places.json'),JSON.stringify(places,null,1));console.log(places.length+' places');}finally{await page.close();}chrome.kill();process.exit(0);}
 // --profile: a sampled CPU profile per view, summarized as self time by function (named from a --map build).
 if(process.argv.includes('--profile')){const page=await connect(),dir=path.resolve('output/perf-walk/profiles',tags[0]);await fs.mkdir(dir,{recursive:true});const where=await sourceMapper(tags[0]);try{await open(page,tags[0]);await page.send('Profiler.enable');await page.send('Profiler.setSamplingInterval',{interval:200});
  for(const v of VIEWS){await page.ev(place(v));await page.ev(nextFrames(120));await sleep(1000);await page.send('Profiler.start');await page.ev(nextFrames(frames));const {profile}=await page.send('Profiler.stop');await fs.writeFile(path.join(dir,v.name+'.cpuprofile'),JSON.stringify(profile));
   const self=new Map(),dt=new Map(profile.nodes.map(n=>[n.id,0]));profile.samples.forEach((id,i)=>dt.set(id,dt.get(id)+(profile.timeDeltas[i]||0)));
   for(const n of profile.nodes){const f=n.callFrame,key=(f.url&&where?.(f.lineNumber,f.columnNumber))||(f.functionName||'(anon)')+' '+path.basename(f.url||'')+':'+f.lineNumber;self.set(key,(self.get(key)||0)+dt.get(n.id));}
   const total=[...self.values()].reduce((a,b)=>a+b,0),top=[...self].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,us])=>[k,+(100*us/total).toFixed(1)]);
   await fs.writeFile(path.join(dir,v.name+'.top.json'),JSON.stringify(top,null,1));console.log('==',v.name);for(const [k,p] of top.slice(0,15))console.log(String(p).padStart(5)+'%',k);}
 }finally{await page.close();}chrome.kill();process.exit(0);}
 // --probe=<file.js>: evaluate an expression (the file's text) at every view and print what it returns.
 const probe=arg('probe',null);if(probe){const page=await connect(),code=await fs.readFile(probe,'utf8');try{await open(page,tags[0]);for(const v of VIEWS){await page.ev(place(v));await page.ev(nextFrames(60));console.log('==',v.name,JSON.stringify(await page.ev(code)));}}finally{await page.close();}chrome.kill();process.exit(0);}
 if(shots)for(const tag of tags)await stills(tag);
 const results={at:new Date().toISOString(),width,height,frames,rounds,views:VIEWS.map(v=>v.name),runs:[]};
 // Rounds interleave the builds (A B A B ...) so drift in clocks or temperature falls on all of them alike.
 for(let r=0;r<rounds;r++)for(const tag of tags){
  const page=await connect();
  try{
   const env=await open(page,tag);if(r===0)console.log(tag,env);
   const run={tag,round:r,env,views:[]};
   for(const v of VIEWS){const m=await measure(page,v);run.views.push(m);console.log(tag,'r'+r,v.name.padEnd(22),'frame',m.frame.mean.toFixed(2),'cpu',m.cpu.mean.toFixed(2),'gpu',m.gpu?m.gpu.mean.toFixed(2):'-','calls',m.calls);}
   if(page.errors.length)run.errors=page.errors.slice(0,10);
   results.runs.push(run);
  }finally{await page.close();}
 }
 // Per view and build: each round's median, then the best round. Other programs on this PC load the CPU and GPU in
 // bursts; a round's median ignores short stalls and the best round ignores a burst that spans a whole round.
 const summary={};for(const tag of tags){summary[tag]={};for(const v of VIEWS){const rows=results.runs.filter(r=>r.tag===tag).map(r=>r.views.find(x=>x.view===v.name));const best=k=>{const s=rows.map(k).filter(x=>x!=null);return s.length?Math.min(...s):null;},med=k=>{const s=rows.map(k).filter(x=>x!=null).sort((a,b)=>a-b);return s.length?s[s.length>>1]:null;};summary[tag][v.name]={frame:best(x=>x.frame.median),cpu:best(x=>x.cpu.median),gpu:best(x=>x.gpu?.median),frameMean:med(x=>x.frame.mean),p95:med(x=>x.frame.p95),calls:med(x=>x.calls),triangles:med(x=>x.triangles)};}
  const all=Object.values(summary[tag]);if(all.length)summary[tag].overall={frame:all.reduce((a,b)=>a+b.frame,0)/all.length,cpu:all.reduce((a,b)=>a+b.cpu,0)/all.length,gpu:all.every(x=>x.gpu!=null)?all.reduce((a,b)=>a+b.gpu,0)/all.length:null};}
 results.summary=summary;await fs.writeFile(path.join(outDir,outName+'.json'),JSON.stringify(results,null,1));
 for(const tag of tags)console.log(tag,'overall',JSON.stringify(summary[tag].overall));
}finally{chrome.kill();}
