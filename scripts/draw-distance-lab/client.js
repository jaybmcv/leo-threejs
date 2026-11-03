// QA client only. The parent owns profile source adapters, the iframe and result storage.
export const distanceProfile={id:'current',far:150,rayFar:90,verticalProbe:12,cabins:40,fogNear:70,fogFar:650,forceAtrium:false,fixedAtrium:false,roomReach:null};
const profiles=[
 {...distanceProfile,label:'Current'},
 {id:'long300',label:'Long 300m',far:300,rayFar:300,verticalProbe:64,cabins:40,fogNear:100,fogFar:800,forceAtrium:false},
 {id:'whole450',label:'Whole atrium 450m',far:450,rayFar:450,verticalProbe:80,cabins:40,fogNear:120,fogFar:1100,forceAtrium:false},
 {id:'detail450',label:'Whole atrium + cabin detail',far:450,rayFar:450,verticalProbe:80,cabins:5000,fogNear:120,fogFar:1100,forceAtrium:true},
 {id:'camera450',label:'450m camera, existing visibility checks',far:450,rayFar:90,verticalProbe:12,cabins:40,fogNear:120,fogFar:1100,forceAtrium:false},
 {id:'atrium450',label:'450m public atrium, nearby room interiors',far:450,rayFar:90,verticalProbe:12,cabins:40,fogNear:120,fogFar:1100,forceAtrium:true,fixedAtrium:true,roomReach:90},
].map(p=>({fixedAtrium:false,roomReach:null,...p}));
const views=[
 {id:'west',label:'Deck 6 west',at:[-100,-19.700000762939453,0],lookAt:[132,0,0]},
 {id:'centre',label:'Deck 6 centre',at:[30,-19.700000762939453,-3],lookAt:[-60,5,-45]},
 {id:'bridge',label:'Deck 7 port bridge',at:[132,-15.699999809265137,-12],lookAt:[-120,0,-15]},
];
let lastMetadata=null;
let api=null,gl=null,timer=null,paused=false,pauseStarted=0,lastFrame=null,currentFrame=null,active=null,run=null,ready=false,viewId='centre',lastDisjoint=false;
const pending=[],events=[],hooked=new WeakSet();
const now=()=>performance.now();
const send=(status,extra={})=>{const terminal=['complete','failed'].includes(status),progress=extra.progress;window.parent.postMessage({type:'leo-distance-state',status:progress?`${status} · ${progress.completed}/${progress.total} · ${progress.phase||''} ${progress.profile||''} ${progress.view||''} ${progress.motion||''}`.trim():status,ready,running:!!run&&!terminal,done:terminal,profile:distanceProfile.id,view:viewId,...extra},location.origin);};
const errorText=e=>e?.stack||e?.message||String(e);
function note(kind,detail){const event={at:new Date().toISOString(),time:now(),kind,detail:String(detail)};events.push(event);if(active)active.events.push(event);if(run)run.events.push(event);send(kind,{meta:{...(run?.meta||lastMetadata||{}),event}});}
const vector=p=>p?.toArray?p.toArray():[p.x,p.y,p.z];
function statistics(values){const xs=values.filter(Number.isFinite).sort((a,b)=>a-b),n=xs.length;if(!n)return {count:0,mean:null,p50:null,p95:null,p99:null};const percentile=q=>{const at=(n-1)*q,lo=Math.floor(at),f=at-lo;return xs[lo]+f*(xs[Math.min(n-1,lo+1)]-xs[lo]);};return {count:n,mean:xs.reduce((a,b)=>a+b,0)/n,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99)};}
function getMetadata(requested=null){
 const debug=gl?.getExtension('WEBGL_debug_renderer_info'),size=api.renderer.getDrawingBufferSize(new api.T.Vector2());
 return lastMetadata={timestamp:new Date().toISOString(),userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency??null,deviceMemory:navigator.deviceMemory??null,dpr:devicePixelRatio,pixelRatio:api.renderer.getPixelRatio(),drawingBuffer:{width:size.x,height:size.y},viewport:{width:innerWidth,height:innerHeight},requested,
  gpu:{renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl?.getParameter(gl.VENDOR),timerSupported:!!timer,timerExtension:timer?'EXT_disjoint_timer_query_webgl2':null,version:gl?.getParameter(gl.VERSION)},
  visibility:document.visibilityState,profiles,views,protocol:{rounds:2,warmupMs:3000,sampleMs:6000,segments:profiles.length*views.length*4,motions:['still','look'],lookAmplitudeRadians:.25,lookPeriodMs:6000,units:{cpu:'ms',gpu:'ms',frame:'ms',span:'ms',phase4:'ms'},gpu:'Sum elapsed GPU time over all renderer.render calls per sampled frame. Disjoint/failed/unavailable results are excluded, never replaced with CPU time.'}};
}
function hookSamples(array,key){if(!array||hooked.has(array))return;hooked.add(array);const original=array.push;Object.defineProperty(array,'push',{configurable:true,writable:true,value:function(...values){if(active?.sampling&&!paused)for(const v of values)if(Number.isFinite(v))active.raw[key].push(v);return original.apply(this,values);}});}
function hookMetrics(){hookSamples(api?.renderMetrics?.span,'span');hookSamples(api?.phase4?.()?.stats?.samples,'phase4');}
function removeQuery(query){try{gl.deleteQuery(query);}catch{}}
function invalidateGpu(reason){for(const frame of pending.splice(0)){for(const q of frame.queries)removeQuery(q);if(frame.row){frame.row.gpuInvalid++;frame.row.gpuReasons[reason]=(frame.row.gpuReasons[reason]||0)+1;}}if(currentFrame)currentFrame.invalid=reason;}
function pollGpu(){
 if(!timer||!gl||gl.isContextLost())return;
 let disjoint;try{disjoint=!!gl.getParameter(timer.GPU_DISJOINT_EXT);}catch(e){note('gpu-error',errorText(e));invalidateGpu('query-error');return;}
 if(disjoint){invalidateGpu('disjoint');if(!lastDisjoint)note('gpu-disjoint','GPU timer results invalidated');lastDisjoint=true;return;}lastDisjoint=false;
 for(let i=pending.length-1;i>=0;i--){const f=pending[i];try{
  if(!f.queries.every(q=>gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))){if(now()-f.created>2000){for(const q of f.queries)removeQuery(q);f.row.gpuInvalid++;f.row.gpuReasons.timeout=(f.row.gpuReasons.timeout||0)+1;pending.splice(i,1);}continue;}
  const ms=f.queries.reduce((sum,q)=>sum+gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6,0);for(const q of f.queries)removeQuery(q);pending.splice(i,1);
  if(Number.isFinite(ms)&&ms>=0)f.row.raw.gpu.push(ms);else{f.row.gpuInvalid++;f.row.gpuReasons.invalid=(f.row.gpuReasons.invalid||0)+1;}
 }catch(e){for(const q of f.queries)removeQuery(q);pending.splice(i,1);f.row.gpuInvalid++;f.row.gpuReasons.error=(f.row.gpuReasons.error||0)+1;note('gpu-error',errorText(e));}}
}
function installRenderMeter(){
 const original=api.renderer.render;
 api.renderer.render=function(...args){
  const frame=currentFrame;if(!frame)return original.apply(this,args);
  const before={calls:this.info.render.calls,triangles:this.info.render.triangles};let query=null,begun=false;
  if(frame.row&&timer&&!lastDisjoint&&!gl.isContextLost())try{query=gl.createQuery();if(query){gl.beginQuery(timer.TIME_ELAPSED_EXT,query);begun=true;}}catch(e){frame.invalid='query-start';note('gpu-error',errorText(e));}
  try{return original.apply(this,args);}finally{
   if(begun)try{gl.endQuery(timer.TIME_ELAPSED_EXT);frame.queries.push(query);}catch(e){removeQuery(query);frame.invalid='query-end';note('gpu-error',errorText(e));}else if(query)removeQuery(query);
   const auto=this.info.autoReset,info=this.info.render;frame.calls+=auto?info.calls:Math.max(0,info.calls-before.calls);frame.triangles+=auto?info.triangles:Math.max(0,info.triangles-before.triangles);frame.passes++;
  }
 };
}
function setProfile(id){const p=profiles.find(p=>p.id===id);if(!p)throw Error('Unknown profile '+id);Object.assign(distanceProfile,p);api.camera.far=p.far;api.camera.updateProjectionMatrix();api.hazeCamera.near=p.far-10;api.hazeCamera.updateProjectionMatrix();if(api.scene.fog){api.scene.fog.near=p.fogNear;api.scene.fog.far=p.fogFar;}api.reset();send(run?'running':'profile',{profiles});}
function clearInput(){api.input.down?.clear();api.input.jumpQueued=false;api.input.jumpHeld=false;api.input.zoom=0;api.input.runLatched=false;if(api.input.look){api.input.look.x=0;api.input.look.y=0;}if(api.input.stickVec){api.input.stickVec.x=0;api.input.stickVec.y=0;}}
function setView(id){const view=views.find(v=>v.id===id);if(!view)throw Error('Unknown view '+id);viewId=id;const dx=view.lookAt[0]-view.at[0],dz=view.lookAt[2]-view.at[2],yaw=Math.atan2(dx,dz),pitch=Math.atan2(view.lookAt[1]-(view.at[1]+1.7),Math.hypot(dx,dz));api.teleport(...view.at,yaw,pitch);api.follow.mode='first';api.follow.yaw=yaw;api.follow.pitch=pitch;clearInput();api.reset();lastFrame=null;return {view,yaw,pitch};}
function summaryRows(){return run?.rows.map(({raw,...row})=>row)||[];}
function updateProgress(segment,phase){send('running',{progress:{runId:run.id,completed:run.rows.length,total:run.total,round:segment.round,profile:segment.profile,view:segment.view,motion:segment.motion,phase,elapsedMs:now()-segment.started-segment.pausedMs}});}
function pause(){if(paused)return;paused=true;pauseStarted=now();lastFrame=null;send('paused',{progress:run?{runId:run.id,completed:run.rows.length,total:run.total}:undefined});}
function resume(){if(!paused)return;const duration=now()-pauseStarted;paused=false;if(active)active.pausedMs+=duration;lastFrame=null;send(run?'running':ready?'ready':'loading');}
export function wrapDistanceFrame(fn){return function(...args){
 if(paused)return;
 if(!api)return fn.apply(this,args);
 pollGpu();hookMetrics();const start=now(),interval=lastFrame===null?null:start-lastFrame;lastFrame=start;
 const segment=active;
 if(segment){const elapsed=start-segment.started-segment.pausedMs;segment.sampling=elapsed>=3000&&elapsed<9000;clearInput();api.follow.mode='first';api.follow.yaw=segment.yaw+(segment.motion==='look'?.25*Math.sin(2*Math.PI*elapsed/6000):0);api.follow.pitch=segment.pitch;
  if(segment.sampling&&!segment.sampleStarted){segment.sampleStarted=start;segment.positions.sampleStart=vector(api.controller.position);segment.profileAtSampleStart={...distanceProfile};updateProgress(segment,'sampling');}
  if(start-segment.lastProgress>1000){segment.lastProgress=start;updateProgress(segment,segment.sampling?'sampling':'warming');}
 }
 const row=segment?.sampling?segment:null,frame={row,calls:0,triangles:0,passes:0,queries:[],invalid:lastDisjoint?'disjoint':null};currentFrame=frame;
 let thrown=null;try{fn.apply(this,args);}catch(e){thrown=e;note('frame-error',errorText(e));}finally{
  const cpu=now()-start;currentFrame=null;
  if(row){row.raw.cpu.push(cpu);if(interval!==null&&interval>0)row.raw.frame.push(interval);row.raw.drawCalls.push(frame.calls);row.raw.triangles.push(frame.triangles);row.raw.renderPasses.push(frame.passes);if(document.hidden)row.hiddenFrames++;
   if(timer){row.gpuIssued++;if(frame.invalid||!frame.queries.length||frame.queries.length!==frame.passes){frame.invalid??='incomplete-pass-queries';for(const q of frame.queries)removeQuery(q);row.gpuInvalid++;row.gpuReasons[frame.invalid]=(row.gpuReasons[frame.invalid]||0)+1;}else pending.push({row,queries:frame.queries,created:now()});}
  }else for(const q of frame.queries)removeQuery(q);
  if(segment&&now()-segment.started-segment.pausedMs>=9000){active=null;segment.sampling=false;segment.positions.end=vector(api.controller.position);segment.profileAtSampleEnd={...distanceProfile};segment.sampleEnded=now();segment.resolve();}
  if(thrown&&segment){active=null;segment.reject(thrown);}
 }
 if(thrown)throw thrown;
};}
async function saveRow(meta,row){const body=JSON.stringify({runId:run.id,meta,row});let failure;for(let i=0;i<2;i++)try{const response=await fetch('/__distance-result',{method:'POST',headers:{'Content-Type':'application/json'},body});if(!response.ok)throw Error('Result save HTTP '+response.status);return;}catch(e){failure=e;}
 note('save-error',errorText(failure));row.saveError=errorText(failure);send('save-error',{rows:[row],meta:{runId:run.id,rawFallback:true}});
}
async function measure(spec){
 while(paused)await new Promise(resolve=>setTimeout(resolve,100));
 setProfile(spec.profile);const {yaw,pitch}=setView(spec.view);hookMetrics();
 const row={...spec,profileSettings:{...distanceProfile},started:now(),pausedMs:0,lastProgress:0,yaw,pitch,sampling:false,sampleStarted:null,sampleEnded:null,positions:{start:vector(api.controller.position)},events:[],hiddenAtStart:document.hidden,hiddenFrames:0,gpuIssued:0,gpuInvalid:0,gpuReasons:{},raw:{cpu:[],gpu:[],frame:[],drawCalls:[],triangles:[],renderPasses:[],span:[],phase4:[]}};
 await new Promise((resolve,reject)=>{Object.assign(row,{resolve,reject});active=row;updateProgress(row,'warming');});
 const until=now()+2100;while(pending.some(f=>f.row===row)&&now()<until){pollGpu();await new Promise(resolve=>setTimeout(resolve,16));}
 for(let i=pending.length-1;i>=0;i--)if(pending[i].row===row){for(const q of pending[i].queries)removeQuery(q);pending.splice(i,1);row.gpuInvalid++;row.gpuReasons.timeout=(row.gpuReasons.timeout||0)+1;}
 delete row.resolve;delete row.reject;delete row.sampling;delete row.lastProgress;
 row.summary=Object.fromEntries(Object.entries(row.raw).map(([k,v])=>[k,statistics(v)]));Object.assign(row,{cpu:row.summary.cpu,gpu:row.summary.gpu,frame:row.summary.frame,calls:row.summary.drawCalls,triangles:row.summary.triangles,span:row.summary.span,phase4:row.summary.phase4});row.totalDrawCalls=row.raw.drawCalls.reduce((a,b)=>a+b,0);row.totalTriangles=row.raw.triangles.reduce((a,b)=>a+b,0);row.gpuSupported=!!timer;row.elapsedMs=row.sampleEnded-row.started-row.pausedMs;
 row.valid=row.raw.cpu.length>0&&!row.hiddenAtStart&&!row.hiddenFrames&&!row.events.some(e=>['hidden','context-lost','frame-error','error','unhandled-rejection'].includes(e.kind));
 await saveRow(run.meta,row);run.rows.push(row);send('running',{meta:run.meta,rows:summaryRows(),progress:{runId:run.id,completed:run.rows.length,total:run.total,phase:'segment complete'}});
}
async function benchmark(message){
 if(run){send('busy');return;}if(!ready){send('not-ready');return;}
 const chosen=Array.isArray(message.profiles)?profiles.filter(p=>message.profiles.includes(p.id)):profiles,rounds=Number.isInteger(message.rounds)?Math.max(1,Math.min(4,message.rounds)):2;if(!chosen.length){send('command-error',{meta:{error:'No valid benchmark profiles'}});return;}
 if(paused)resume();const inputEnabled=api.input.enabled,previousMode=api.follow.mode;api.input.enabled=false;clearInput();
 run={id:'distance-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),rows:[],events:[],meta:null,total:rounds*chosen.length*views.length*2};send('running',{progress:{runId:run.id,completed:0,total:run.total,phase:'settling viewport'}});
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 run.meta=getMetadata({width:message.width??1280,height:message.height??720});Object.assign(run.meta.protocol,{rounds,segments:run.total,profileIds:chosen.map(p=>p.id),order:message.order==='paired'?'paired-by-view-and-motion':'profile-major'});run.meta.runId=run.id;run.meta.started=new Date().toISOString();send('running',{meta:run.meta,rows:[],progress:{runId:run.id,completed:0,total:run.total}});
 try{for(let round=1;round<=rounds;round++){const order=round%2===1?chosen:[...chosen].reverse();const specs=message.order==='paired'?views.flatMap(view=>['still','look'].flatMap(motion=>order.map(p=>({round,profile:p.id,view:view.id,motion})))):order.flatMap(p=>views.flatMap(view=>['still','look'].map(motion=>({round,profile:p.id,view:view.id,motion}))));for(const spec of specs)await measure(spec);}
  send('complete',{meta:{...run.meta,ended:new Date().toISOString(),events:run.events},rows:summaryRows(),progress:{runId:run.id,completed:run.rows.length,total:run.total}});
 }catch(e){note('run-error',errorText(e));send('failed',{meta:{...run.meta,error:errorText(e),events:run.events},rows:summaryRows()});}
 finally{active=null;api.input.enabled=inputEnabled;clearInput();api.follow.mode=previousMode;run=null;}
}
export function installDistanceLab(value){
 if(api)throw Error('Distance lab already installed');api=value;api.renderer.setPixelRatio(1);api.renderer.setSize(innerWidth,innerHeight);gl=api.renderer.getContext();timer=typeof gl.createQuery==='function'?gl.getExtension('EXT_disjoint_timer_query_webgl2'):null;installRenderMeter();hookMetrics();
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='leo-distance-command')return;const m=event.data;try{
  if(m.action==='pause')pause();else if(m.action==='resume')resume();else if(m.action==='run')void benchmark(m);else if(run)send('busy');else if(m.action==='profile')setProfile(m.id);else if(m.action==='view'){setView(m.id);send('view',{views});}
 }catch(e){note('command-error',errorText(e));}});
 window.addEventListener('error',event=>note('error',event.error||event.message));window.addEventListener('unhandledrejection',event=>note('unhandled-rejection',errorText(event.reason)));
 document.addEventListener('visibilitychange',()=>note(document.hidden?'hidden':'visible',document.visibilityState));
 api.renderer.domElement.addEventListener('webglcontextlost',()=>{note('context-lost','WebGL context lost');invalidateGpu('context-lost');if(active){const segment=active;active=null;segment.reject(Error('WebGL context lost'));}pause();});
 api.renderer.domElement.addEventListener('webglcontextrestored',()=>{note('context-restored','Reload recommended before another benchmark');});
 const checkReady=()=>{if(document.body?.dataset.ready==='1'){ready=true;setProfile('current');setView('west');send(paused?'paused':'ready',{meta:getMetadata(),profiles,views});return true;}return false;};
 send('initializing',{meta:getMetadata(),profiles,views});if(!checkReady()){const poll=setInterval(()=>{if(checkReady())clearInterval(poll);},250);}
}
