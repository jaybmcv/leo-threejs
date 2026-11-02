import fs from 'node:fs/promises';
import path from 'node:path';
import WebSocket from 'ws';
export async function connect(url){
 const tabs=await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json()),existing=tabs.find(t=>t.url===url),target=existing||await fetch('http://127.0.0.1:9333/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map(),errors=[];let id=0;
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 ws.on('close',()=>{for(const h of pending.values())h.reject(Error('Review tab closed'));pending.clear();});
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const h=pending.get(m.id);pending.delete(m.id);m.error?h?.reject(Error(JSON.stringify(m.error))):h?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 if(!existing){await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__launchCold={longTasks:[],frames:[]};new PerformanceObserver(list=>{for(const e of list.getEntries())__launchCold.longTasks.push({start:e.startTime,ms:e.duration})}).observe({type:'longtask',buffered:true});let last=0;function capture(now){const w=window.__walk;if(w&&document.body?.dataset.ready==='1'){__launchCold.frames.push({t:now,ms:last?now-last:0,programs:w.renderer.info.programs.length,draws:w.renderer.info.render.calls});last=now;}if(__launchCold.frames.length<120)requestAnimationFrame(capture)}requestAnimationFrame(capture);"});await send('Page.navigate',{url});}
 return {send,evaluate,errors,close:async()=>{ws.close();await fetch("http://127.0.0.1:9333/json/close/"+target.id);},target};
}
export const settle=async(c,n=45)=>c.evaluate('new Promise(r=>{let n='+n+';function f(){if(--n)requestAnimationFrame(f);else r(true)}requestAnimationFrame(f)})');
export async function ready(c){const end=Date.now()+180000;while(Date.now()<end){if(c.errors.length)throw Error(JSON.stringify(c.errors));if(await c.evaluate('!!globalThis.__walk&&document.body.dataset.ready==="1"')){await c.evaluate('(()=>{const r=__walk.renderer;if(!r.__launchPixelRatio){const set=r.setPixelRatio.bind(r);r.setPixelRatio=()=>set(1);r.__launchPixelRatio=true;}r.setPixelRatio(1);document.getElementById("resolution").textContent="Res High";return true;})()');return;}await c.evaluate('try{localStorage.removeItem("leo-walk-building")}catch{}document.querySelector("#memory-try")?.click()');await new Promise(r=>setTimeout(r,300));}throw Error('Review did not become ready');}
export async function pose(c,view){await c.evaluate('(async()=>{const w=__walk;w.input.enabled=false;w.input.down.clear();w.camera.fov=62;w.camera.updateProjectionMatrix();w.goTo('+JSON.stringify({...view,lv:2,resolved:true,view:'first'})+');w.follow.mode="first";w.follow.yaw='+view.yaw+';w.follow.pitch='+view.pitch+';})()');await settle(c);}
export const sample=async function(frames=150){
 const w=__walk,r=w.renderer,oldRender=r.render,oldClear=r.clear,rows=[];let time=0,last=performance.now(),passes=[];
 r.clear=function(...args){if(args[0]!==false){time=0;passes=[];}return oldClear.apply(this,args)};
 r.render=function(...args){const t=performance.now(),result=oldRender.apply(this,args);time+=performance.now()-t;passes.push({name:args[0]===w.scene?'main':args[1].near>=100?'distant':'sky',calls:r.info.render.calls,triangles:r.info.render.triangles});if(args[0]===w.scene){const now=performance.now();rows.push({frame:now-last,submit:time,calls:r.info.render.calls,triangles:r.info.render.triangles,passes:[...passes]});last=now;}return result};
 try{await new Promise(resolve=>{let n=frames;function f(){if(--n)requestAnimationFrame(f);else resolve()}requestAnimationFrame(f)});}
 finally{r.render=oldRender;r.clear=oldClear;}
 const stats=k=>{const a=rows.slice(5).map(r=>r[k]).sort((a,b)=>a-b);return{samples:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],mean:a.reduce((a,b)=>a+b,0)/a.length}};
 const gl=r.getContext(),ex=gl.getExtension('WEBGL_debug_renderer_info');
 return {frameMs:stats('frame'),submitMs:stats('submit'),draws:{calls:rows.at(-1)?.calls,triangles:rows.at(-1)?.triangles},passes:rows.at(-1)?.passes,batching:w.ship.v2LowDeckBatches,rows,walker:w.controller.position.toArray(),camera:w.camera.position.toArray(),yaw:w.follow.yaw,pitch:w.follow.pitch,renderer:ex?gl.getParameter(ex.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),programs:r.info.programs.length,pixelRatio:r.getPixelRatio(),size:r.getSize(new w.T.Vector2()).toArray(),distant:w.ship.v2DistantArchitecture?.userData.proof,visibility:w.phase4Visibility?.stats,renderMetrics:w.renderMetrics};
};
export async function measure(c,n=150){return c.evaluate('('+sample.toString()+')('+n+')');}
export async function screenshot(c,file){const b=await c.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(file,Buffer.from(b.data,'base64'));}
export function profileSummary(profile){
 const by=new Map(profile.nodes.map(n=>[n.id,n])),time=new Map();for(let i=0;i<(profile.samples||[]).length;i++){const n=by.get(profile.samples[i]),f=n.callFrame,key=f.functionName+' '+f.url+':'+f.lineNumber;time.set(key,(time.get(key)||0)+(profile.timeDeltas[i]||0));}
 return [...time].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([name,us])=>({name,ms:us/1000}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1').replaceAll('/',path.sep)){
 const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6)||'http://127.0.0.1:4193/walk.html?view=first';
 const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'output/launch-a/before';await fs.mkdir(out,{recursive:true});
 const c=await connect(url);try{await ready(c);const native=JSON.parse(await fs.readFile('scripts/native-render-baseline-v2.json'));
 await c.evaluate('__walk.actions.respawn();__walk.follow.mode="first";__walk.follow.pitch=0');await settle(c);
 const arrival=await c.evaluate('({name:"deck2-arrival",at:__walk.controller.position.toArray(),yaw:__walk.follow.yaw,pitch:0})');
 const views=[arrival,...native.views.filter(v=>v.name!=='deck2-arrival')],results=[];
 for(const v of views){await pose(c,v);await c.evaluate('(async()=>{await __walk.renderer.compileAsync(__walk.scene,__walk.camera);return true})()');await c.send('Profiler.enable');await c.send('Profiler.start');const r=await measure(c);if(Math.hypot(r.walker[0]-v.at[0],r.walker[2]-v.at[2])>.3||Math.abs(r.walker[1]-v.at[1])>.15)throw Error('View moved during sample '+v.name);const p=await c.send('Profiler.stop');await fs.writeFile(out+'/'+v.name+'-profile.json',JSON.stringify(p.profile));await screenshot(c,out+'/'+v.name+'.png');results.push({...v,...r,profile:profileSummary(p.profile)});await fs.writeFile(out+'/native.json',JSON.stringify({url,at:new Date().toISOString(),views:results},null,2));console.log(v.name,r.draws,r.frameMs,r.submitMs);}
 }finally{await c.close();}
}
