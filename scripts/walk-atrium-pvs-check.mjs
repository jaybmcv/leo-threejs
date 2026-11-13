// Checks an atrium PVS build against the pictures it saves: at random camera poses in cells the PVS calls hidden, the
// frame drawn as built is compared (clock stopped) with the same frame drawn as the sight rays would draw it (the cell
// treated as unknown), the build this replaces: "rays" is the regression. It is also compared with that cell forced
// visible, every deck band and the atrium fog drawn: "forced" bounds what any sight test could still be missing. Half the poses sit next to a visible cell, where a miss is likeliest. --lifts rides each lift car from
// its lowest stop to its highest instead, first person going up and third person coming back down, and compares the
// frames every few metres of the way wherever the PVS calls the cell hidden.
//   node scripts/walk-atrium-pvs-check.mjs --tag=<debug build with --pvs> [--poses=150] [--seed=1] [--lifts]
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {loadImage,createCanvas} from '@napi-rs/canvas';
import {PVS_GRID,PVS_HIDDEN,PVS_VISIBLE,decodeCells} from '../src/v2/atrium-pvs.js';
import {ANGLE} from './chrome-setup.mjs';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const tag=arg('tag','pvs'),lifts=process.argv.includes('--lifts'),poses=Number(arg('poses',150)),port=Number(arg('cdp',9339)),site='http://127.0.0.1:'+arg('port',4211),width=1280,height=720;
const CHROME=arg('chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'),THRESHOLD=8;
let seed=Number(arg('seed',1));const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const INIT=`(()=>{let seed=20261103;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const realNow=performance.now.bind(performance),B=window.__bench={virtual:true,running:true,vt:0,step:1000/60};performance.now=()=>B.vt;
 const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{if(B.running)B.vt+=B.step;cb(B.vt);});})();`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const dir=path.resolve('output/perf-walk/builds',tag),file=(await fs.readdir(dir)).find(n=>/^atrium-pvs\..*\.json$/.test(n));
if(!file)throw Error('Build '+tag+' ships no atrium PVS');
const {nx,nz,ny,x0,z0,step,y0}=PVS_GRID,cells=decodeCells(JSON.parse(await fs.readFile(path.join(dir,file),'utf8')).cells,nx*nz*ny);
const hidden=[],edge=[];
for(let c=0;c<cells.length;c++){if(cells[c]!==PVS_HIDDEN)continue;hidden.push(c);const k=Math.floor(c/(nx*nz)),i=Math.floor(c/nz)%nx,j=c%nz;
 let near=false;for(let di=-2;di<=2&&!near;di++)for(let dj=-2;dj<=2&&!near;dj++){const ii=i+di,jj=j+dj;if(ii>=0&&ii<nx&&jj>=0&&jj<nz&&cells[(k*nx+ii)*nz+jj]===PVS_VISIBLE)near=true;}if(near)edge.push(c);}
console.log('hidden cells',hidden.length,'beside visible',edge.length);

const profile=path.resolve('output/perf-walk/chrome-profile-pvs-check-'+port);await fs.rm(profile,{recursive:true,force:true});await fs.mkdir(profile,{recursive:true});
const chrome=spawn(CHROME,['--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-extensions','--headless=new',...ANGLE,'--enable-gpu','--ignore-gpu-blocklist',
 '--disable-background-timer-throttling','--disable-renderer-backgrounding','--force-device-scale-factor=1','--window-size='+width+','+height,'about:blank'],{stdio:'ignore'});
try{
 for(let i=0;i<80;i++){try{await fetch('http://127.0.0.1:'+port+'/json/version');break;}catch{await sleep(250);}}
 const tab=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json()),socket=new WebSocket(tab.webSocketDebuggerUrl,{maxPayload:1<<30});
 await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});let id=0;const pending=new Map();
 socket.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const frames=n=>ev(`new Promise(r=>{let n=${n};const f=()=>--n>0?requestAnimationFrame(f):r(true);requestAnimationFrame(f);})`);
 const shot=async()=>{const s=await send('Page.captureScreenshot',{format:'png'}),img=await loadImage(Buffer.from(s.data,'base64')),c=createCanvas(img.width,img.height),g=c.getContext('2d');g.drawImage(img,0,0);return {png:s.data,data:g.getImageData(0,0,img.width,img.height).data};};
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:INIT});
 await send('Page.navigate',{url:site+'/'+tag+'/walk.html?lv=2&view=first&halloween=0'});
 for(let i=0;!await ev('document.body?.dataset.ready==="1"&&!!globalThis.__walk&&!!__walk.atriumPvs').catch(()=>false);i++){if(i>2400)throw Error('Walk or its PVS did not load');await sleep(250);}
 await frames(120);await sleep(3000);
 const rows=[],out=path.resolve('output/perf-walk/pvs-check',tag+(lifts?'-lifts':''));await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
 // With the clock stopped: the frame as built against the same frame with the camera's cell forced visible.
 const state=()=>ev('(()=>{const w=__walk,e=w.camera.getWorldPosition(new w.T.Vector3());return {pvs:w.atriumSight?.stats.pvs,visible:w.atriumSight?.stats.visible,eye:e.toArray().map(v=>+v.toFixed(2))};})()');
 async function compare(meta,state){
  const a=await shot();
  // Rays first: they turn the atrium on at once but hold it for holdMs before turning it off, and the clock is stopped.
  await ev('(()=>{const p=__walk.atriumPvs;p.realAt??=p.at;p.at=()=>0;return true;})()');await frames(6);
  const rays=await ev('__walk.atriumSight.stats.visible'),r=await shot();
  await ev('(()=>{__walk.atriumPvs.at=()=>2;return true;})()');await frames(6);
  const b=await shot();
  await ev('(()=>{const p=__walk.atriumPvs;p.at=p.realAt;return true;})()');
  const pct=(x,y)=>{let changed=0;for(let q=0;q<x.data.length;q+=4){let m=0;for(let ch=0;ch<3;ch++)m=Math.max(m,Math.abs(x.data[q+ch]-y.data[q+ch]));if(m>THRESHOLD)changed++;}return +(100*changed/(x.data.length/4)).toFixed(4);};
  const n=rows.length+1,row={n,...meta,eye:state.eye,rays,raysPct:pct(a,r),forcedPct:pct(a,b)};rows.push(row);
  if(row.raysPct>.05||row.forcedPct>.05)for(const [name,img] of [['built',a],['rays',r],['forced',b]])await fs.writeFile(path.join(out,n+'-'+name+'.png'),Buffer.from(img.png,'base64'));
  console.log(String(n).padStart(4),(meta.lift||meta.mode).padEnd(18),JSON.stringify(state.eye).padEnd(26),'rays',(rays?'visible ':'hidden  ')+row.raysPct.toFixed(4)+'%','forced',row.forcedPct.toFixed(4)+'%',row.edge?'edge':'');
 }
 if(lifts){
  const cars=await ev('__walk.lifts.lifts.map((l,i)=>({i,id:l.spec.id,x:l.spec.car.x,z:l.spec.car.z,stops:l.stops.map(s=>s.y)}))');
  for(const car of cars)for(const [mode,from,to] of [['first',0,car.stops.length-1],['third',car.stops.length-1,0]]){
   // Park the car at the first stop, doors open, stand in it, and send it to the other end.
   await ev(`(()=>{const w=__walk,l=w.lifts.lifts[${car.i}];w.input.enabled=false;__bench.running=true;Object.assign(l,{y:l.stops[${from}].y,v:0,at:${from},target:${from},phase:'open',doors:1,dwell:9});l.calls.clear();return true;})()`);
   await frames(4);
   // goTo would find a stand on the landing outside; place the walker on the car's floor itself.
   const placed=await ev(`(()=>{const w=__walk,l=w.lifts.lifts[${car.i}];w.controller.place(new w.T.Vector3(${car.x},${car.stops[from]},${car.z}));w.follow.mode='${mode}';w.follow.pitch=${mode==='first'?0:-.2};w.follow.look(0,0);return w.lifts.inside(l,w.controller.position);})()`);
   if(!placed){console.log('could not stand in',car.id);continue;}
   await frames(30);await ev(`(__walk.lifts.call(__walk.lifts.lifts[${car.i}],${to},{now:true}),true)`);
   for(let step=0;step<200;step++){
    await frames(20);await ev('(__bench.running=false,true)');await frames(2);
    const st=await state(),l=await ev(`(()=>{const l=__walk.lifts.lifts[${car.i}],p=__walk.controller.position;return {y:+l.y.toFixed(2),phase:l.phase,aboard:__walk.lifts.inside(l,p)};})()`);
    if(st.pvs===PVS_HIDDEN&&!st.visible)await compare({lift:car.id+' '+mode,carY:l.y,phase:l.phase,aboard:l.aboard},st);
    else console.log('    ',(car.id+' '+mode).padEnd(18),'car',l.y,l.phase,l.aboard?'aboard':'LEFT BEHIND','pvs',st.pvs,'visible',st.visible);
    await ev('(__bench.running=true,true)');
    if(l.phase==='open'&&Math.abs(l.y-car.stops[to])<.05)break;
   }
  }
 }else for(let n=0,tries=0;n<poses&&tries<poses*6;tries++){
  const pool=n%2?hidden:edge,c=pool[Math.floor(random()*pool.length)],k=Math.floor(c/(nx*nz)),i=Math.floor(c/nz)%nx,j=c%nz;
  const at=[x0+i*step+(random()-.5)*1.6,y0+2*(k-(k%2)),z0+j*step+(random()-.5)*1.6],yaw=random()*360,pitch=(random()-.5)*50,mode=random()<.5?'first':'third';
  const placed=await ev(`(()=>{const w=__walk;w.input.enabled=false;__bench.running=true;if(!w.goTo({at:${JSON.stringify(at)},yaw:${yaw},resolved:true}))return false;w.follow.mode='${mode}';w.follow.yaw=${yaw*Math.PI/180};w.follow.pitch=${pitch*Math.PI/180};w.follow.look(0,0);return true;})()`);
  if(!placed)continue;
  await frames(40);await sleep(600);await ev('(__bench.running=false,true)');await frames(8);
  const st=await state();
  if(st.pvs!==PVS_HIDDEN||st.visible)continue;
  await compare({cell:c,edge:pool===edge,mode,yaw:Math.round(yaw),pitch:Math.round(pitch)},st);n++;
 }
 const worst=key=>rows.reduce((m,r)=>Math.max(m,r[key]),0),over=key=>rows.filter(r=>r[key]>.05).length;
 const summary={poses:rows.length,worstRays:worst('raysPct'),overRays:over('raysPct'),worstForced:worst('forcedPct'),overForced:over('forcedPct')};
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({tag,...summary,rows},null,1));
 console.log(JSON.stringify(summary));
}finally{chrome.kill();}
