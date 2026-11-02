import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import WebSocket from 'ws';
const NL=String.fromCharCode(10),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function connect(url){
 const socket=new WebSocket(url),pending=new Map(),handlers=new Map();let id=0;
 await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});
 socket.on('message',raw=>{const e=JSON.parse(raw);if(e.id){const p=pending.get(e.id);if(!p)return;clearTimeout(p.timer);pending.delete(e.id);e.error?p.reject(Error(JSON.stringify(e.error))):p.resolve(e.result);}else for(const f of handlers.get(e.method)||[])f(e.params);});
 socket.on('close',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser connection closed'));}pending.clear();});
 return{socket,on:(name,f)=>{(handlers.get(name)||handlers.set(name,[]).get(name)).push(f);},send:(method,params={},timeout=10000)=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method));},timeout);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}));})};
}
const probeCode='('+function(){
 const probe={statuses:[],longTasks:[],errors:[],readyMs:null,firstStatusMs:null,heapPeak:0};window.__leoStartupProbe=probe;
 const emit=(kind,data)=>{try{window.leoStartupEvent(JSON.stringify({kind,...data}));}catch{}};
 const desc=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
 Object.defineProperty(Node.prototype,'textContent',{...desc,set(value){if(this.nodeType===1&&this.id==='loading-text'){const at=performance.now();if(probe.firstStatusMs===null)probe.firstStatusMs=at;const row={at,text:String(value)};probe.statuses.push(row);emit('status',row);}return desc.set.call(this,value);}});
 const initialStatus=()=>{const e=document.getElementById('loading-text');if(probe.firstStatusMs===null&&e?.textContent){const at=performance.now();probe.firstStatusMs=at;const row={at,text:e.textContent};probe.statuses.push(row);emit('status',row);}};new MutationObserver(initialStatus).observe(document,{subtree:true,childList:true});initialStatus();
 new PerformanceObserver(list=>{for(const e of list.getEntries()){const row={at:e.startTime,duration:e.duration};probe.longTasks.push(row);emit('longtask',row);}}).observe({type:'longtask',buffered:true});
 let previewRejected=false;const check=()=>{if(document.documentElement?.dataset.leoVisualPreview){if(!previewRejected){previewRejected=true;emit('error',{message:'Visual preview cannot be used for acceptance'});}return;}if(probe.readyMs===null&&document.body?.dataset.ready==='1'){probe.readyMs=performance.now();emit('ready',{at:probe.readyMs});}};
 new MutationObserver(check).observe(document,{subtree:true,attributes:true,attributeFilter:['data-ready','data-leo-visual-preview']});
 setInterval(()=>{check();if(performance.memory){const used=performance.memory.usedJSHeapSize;probe.heapPeak=Math.max(probe.heapPeak,used);emit('heap',{at:performance.now(),used});}},250);
 addEventListener('error',e=>{probe.errors.push(String(e.message));emit('error',{message:String(e.message)});});
}.toString()+')()';
export async function measurePublicStartup({url,tag,directory='output/phase3b/startup',captureTimeout=180000,profile=false,touch=false,reducedMotion=false,chrome=process.env.LEO_CHROME_EXE||'C:/Program Files/Google/Chrome/Application/chrome.exe'}={}){
 await fs.mkdir(directory,{recursive:true});const profileDir=path.resolve(directory,'chrome-'+tag+'-'+randomUUID());await fs.mkdir(profileDir);
 const child=spawn(chrome,['--headless=new','--remote-debugging-port=0','--no-sandbox','--disable-gpu-sandbox','--use-angle=d3d11','--enable-precise-memory-info','--user-data-dir='+profileDir,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let browser,page,trace,profiler=false,traceActive=false,interval,ready=null,heapBusy=false,runtimeBusy=false;
 const report={tag,url,at:new Date().toISOString(),status:'RUNNING',readyMs:null,statuses:[],longTasks:[],errors:[],heapSamples:[],peakJSHeap:0,peakPageMemory:0,peakBackingStorage:0,firstStatusMs:null,metricTimeouts:0,profileDir,browserPid:child.pid};
 const heap=(used,at,source,extra={})=>{if(!Number.isFinite(used))return;if(source==='page')report.peakPageMemory=Math.max(report.peakPageMemory,used);else report.peakJSHeap=Math.max(report.peakJSHeap,used);if(extra.backingStorageSize)report.peakBackingStorage=Math.max(report.peakBackingStorage,extra.backingStorageSize);report.heapSamples.push({at,used,source,...extra});};
 try{
  let port;for(let i=0;i<150;i++){try{port=Number((await fs.readFile(profileDir+'/DevToolsActivePort','utf8')).split(NL)[0]);if(port)break;}catch{}await pause(100);}if(!port)throw Error('Dedicated headless Chrome did not start');
  const version=await fetch('http://127.0.0.1:'+port+'/json/version').then(r=>r.json());report.browser=version.Browser;browser=await connect(version.webSocketDebuggerUrl);
  const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'}),tab=(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(t=>t.id===targetId);page=await connect(tab.webSocketDebuggerUrl);
  await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Network.enable');await page.send('Network.setCacheDisabled',{cacheDisabled:true});await page.send('Emulation.setDeviceMetricsOverride',touch?{width:390,height:844,deviceScaleFactor:1,mobile:true}:{width:1280,height:720,deviceScaleFactor:1,mobile:false});if(touch)await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});if(reducedMotion)await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await page.send('Runtime.addBinding',{name:'leoStartupEvent'});await page.send('Page.addScriptToEvaluateOnNewDocument',{source:probeCode});await page.send('Performance.enable');await page.send('HeapProfiler.collectGarbage');
  page.on('Runtime.bindingCalled',e=>{if(e.name!=='leoStartupEvent')return;let p;try{p=JSON.parse(e.payload);}catch{return;}if(p.kind==='ready'){ready=p.at;report.readyMs=ready;}else if(p.kind==='status'){report.firstStatusMs??=p.at;report.statuses.push({at:p.at,text:p.text});console.log(tag,Math.round(p.at)+'ms',p.text);}else if(p.kind==='longtask')report.longTasks.push({at:p.at,duration:p.duration});else if(p.kind==='heap')heap(p.used,p.at,'page');else if(p.kind==='error')report.errors.push(p.message);});
  page.on('Runtime.exceptionThrown',e=>report.errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
  if(profile){await page.send('Profiler.enable');await page.send('Profiler.setSamplingInterval',{interval:1000});await page.send('Profiler.start');profiler=true;}
  trace=createWriteStream(path.join(directory,tag+'.trace.jsonl'));trace.on('error',e=>report.errors.push('Trace output: '+e.message));
  page.on('Tracing.dataCollected',e=>{for(const item of e.value){if(trace&&!trace.writableEnded&&!trace.destroyed)trace.write(JSON.stringify(item)+NL);const d=item.args?.data||item.args||{};for(const [k,v]of Object.entries(d))if(/jsHeapSizeUsed|usedHeapSizeBefore|usedHeapSizeAfter|heap_size_before|heap_size_after/.test(k)&&typeof v==='number')heap(v,item.ts/1000,'trace:'+k);}});
  await page.send('Tracing.start',{categories:'toplevel,devtools.timeline,disabled-by-default-devtools.timeline,v8,disabled-by-default-v8.gc,blink.user_timing',options:'record-as-much-as-possible',transferMode:'ReportEvents'});traceActive=true;
  const begin=Date.now();interval=setInterval(()=>{if(!heapBusy){heapBusy=true;const sent=Date.now();page.send('Performance.getMetrics',{},3000).then(r=>{const m=Object.fromEntries(r.metrics.map(x=>[x.name,x.value]));heap(m.JSHeapUsedSize,Date.now()-begin,'CDP-performance',{latency:Date.now()-sent,total:m.JSHeapTotalSize});}).catch(()=>report.metricTimeouts++).finally(()=>heapBusy=false);}if(!runtimeBusy){runtimeBusy=true;const sent=Date.now();page.send('Runtime.getHeapUsage',{},3000).then(r=>heap(r.usedSize,Date.now()-begin,'CDP-runtime',{latency:Date.now()-sent,total:r.totalSize,backingStorageSize:r.backingStorageSize,embedderHeapUsedSize:r.embedderHeapUsedSize})).catch(()=>{}).finally(()=>runtimeBusy=false);}},500);
  await page.send('Page.navigate',{url});while(ready===null&&!report.errors.length&&Date.now()-begin<captureTimeout)await pause(100);
  report.captureElapsedMs=Date.now()-begin;report.timedOut=ready===null&&!report.errors.length;
  if(ready!==null){await pause(1000);const state=await page.send('Runtime.evaluate',{expression:'JSON.stringify({...window.__leoStartupProbe,media:{touch:matchMedia("(pointer:coarse)").matches,reducedMotion:matchMedia("(prefers-reduced-motion: reduce)").matches}})',returnByValue:true});const value=JSON.parse(state.result.value);report.firstStatusMs??=value.firstStatusMs;report.peakPageMemory=Math.max(report.peakPageMemory,value.heapPeak);report.pageProbe=value;}
  clearInterval(interval);interval=null;
  if(profiler){try{const p=await page.send('Profiler.stop',{},10000);await fs.writeFile(path.join(directory,tag+'.cpuprofile'),JSON.stringify(p.profile));}catch(e){report.profileError=String(e);}profiler=false;}
  report.maxLongTask=Math.max(0,...report.longTasks.filter(e=>report.firstStatusMs===null||e.at+e.duration>=report.firstStatusMs).map(e=>e.duration));report.status=report.errors.length?'ERROR':ready!==null?'READY':'TIMEOUT';if(traceActive){const completed=new Promise(resolve=>page.on('Tracing.tracingComplete',resolve));await page.send('Tracing.end',{},10000).catch(e=>{(report.cleanupWarnings??=[]).push(String(e));});await Promise.race([completed,pause(10000)]);traceActive=false;}
  report.maxLongTask=Math.max(0,...report.longTasks.filter(e=>report.firstStatusMs===null||e.at+e.duration>=report.firstStatusMs).map(e=>e.duration));report.status=report.errors.length?'ERROR':ready!==null?'READY':'TIMEOUT';
  if(ready!==null){const shot=await page.send('Page.captureScreenshot',{format:'png'},10000);await fs.writeFile(path.join(directory,tag+'-ready.png'),Buffer.from(shot.data,'base64'));}
 }catch(e){report.status='ERROR';report.errors.push(String(e.stack||e));}finally{if(interval)clearInterval(interval);await fs.writeFile(path.join(directory,tag+'.json'),JSON.stringify(report,null,2));if(traceActive&&page)await page.send('Tracing.end',{},2000).catch(()=>{});if(trace)await new Promise(r=>trace.end(r));page?.socket.close();if(browser){await browser.send('Browser.close',{},2000).catch(()=>{});browser.socket.close();}await pause(250);try{child.kill();}catch{}await fs.writeFile(path.join(directory,tag+'.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify({tag,status:report.status,readyMs:report.readyMs,maxLongTask:report.maxLongTask,peakJSHeap:report.peakJSHeap,peakBackingStorage:report.peakBackingStorage,errors:report.errors}));return report;
}
