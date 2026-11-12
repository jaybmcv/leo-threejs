// Performance stats, toggled with the Stats button (in the More menu on a phone), F3 or ` (?fps=1 opens with them
// shown). Twice a second they show, over the last five seconds: frames a second; frame times (median, 95th and 99th
// percentile, worst); the frame's main-thread time and, where the browser can time the GPU
// (EXT_disjoint_timer_query_webgl2), its GPU time; frames over 50 ms; the main pass's draws and triangles; the drawing
// size, pixel ratio and JS heap; the multisampling and depth buffer it draws with (pixel-switches.js); the GPU's name;
// and extra(), if given, a line of the page's own (the walk's: how much of the crowd it draws, remotes.js crowdLine).
// The choice is remembered on this browser. Hidden, they cost nothing a frame.
import {pixelLine} from './pixel-switches.js';
const STORAGE_KEY='leo-walk-stats',WINDOW_MS=5000,PAINT_MS=500,HITCH_MS=50;
const at=(sorted,p)=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]:0;
const sortedOf=(list,key)=>list.map(e=>e[key]).filter(v=>v!=null).sort((a,b)=>a-b);
const ms=v=>v<10?v.toFixed(1):v.toFixed(0);

export function createFrameReadout(renderer,{extra=null}={}){
 let shown=new URLSearchParams(location.search).get('fps')==='1';
 try{shown||=localStorage.getItem(STORAGE_KEY)==='1';}catch{/* storage blocked: start hidden */}
 const gl=renderer.getContext(),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
 const gpuName=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)).replace(/^ANGLE \((.*)\)$/,'$1').replace(/ \(0x[0-9a-f]+\)/gi,''):'GPU name hidden by this browser';
 // Read once, now: the canvas's own framebuffer is the one bound, and neither changes without a new context.
 const pixels=pixelLine({samples:gl.getParameter(gl.SAMPLES),logDepth:renderer.capabilities.logarithmicDepthBuffer});
 let box=null,samples=[],pending=[],query=null,started=0,last=0,painted=0;
 const show=()=>{
  if(!box){box=document.createElement('div');box.id='walk-stats';box.setAttribute('aria-hidden','true');
   box.style.cssText='position:fixed;left:6px;top:calc(env(safe-area-inset-top,0px) + 58px);max-width:calc(100vw - 12px);overflow:hidden;z-index:9999;padding:4px 7px;border-radius:5px;background:rgba(0,0,0,.72);color:#9f9;font:min(11px,2.85vw)/1.4 ui-monospace,monospace;pointer-events:none;white-space:pre';
   box.textContent='Stats: measuring…';document.body.appendChild(box);}
  box.hidden=false;
 };
 if(shown)show();
 // A GPU timing reads back a frame or more later; a disjoint one (the GPU was interrupted meanwhile) is dropped.
 const poll=()=>{
  while(pending.length&&gl.getQueryParameter(pending[0].q,gl.QUERY_RESULT_AVAILABLE)){
   const {q,entry}=pending.shift();if(!gl.getParameter(timer.GPU_DISJOINT_EXT))entry.gpu=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);}
 };
 const paint=now=>{
  samples=samples.filter(e=>now-e.t<=WINDOW_MS);
  const frames=sortedOf(samples,'dt'),cpu=sortedOf(samples,'cpu'),gpu=sortedOf(samples,'gpu'),span=samples.length>1?samples.at(-1).t-samples[0].t:0;
  const fps=span>0?(samples.length-1)*1000/span:0,hitches=frames.filter(v=>v>HITCH_MS).length,{calls,triangles}=renderer.info.render;
  const heap=performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6)+' MB':'n/a';
  box.textContent=[
   `${fps.toFixed(0)} fps   frame ${ms(at(frames,.5))} med  ${ms(at(frames,.95))} p95  ${ms(at(frames,.99))} p99  ${ms(frames.at(-1)||0)} max`,
   `cpu ${ms(at(cpu,.5))} med  ${ms(at(cpu,.95))} p95   gpu ${timer?(gpu.length?`${ms(at(gpu,.5))} med  ${ms(at(gpu,.95))} p95`:'…'):'n/a'}`,
   `frames >${HITCH_MS} ms: ${hitches}   draws ${calls}   tris ${(triangles/1e6).toFixed(2)}M`,
   `${gl.drawingBufferWidth}×${gl.drawingBufferHeight} ×${renderer.getPixelRatio().toFixed(2)}   heap ${heap}   last ${WINDOW_MS/1000} s`,
   pixels,
   gpuName,
   extra?.(),
  ].filter(line=>line!=null&&line!=='').join('\n');
 };
 const mount=globalThis.__leoPreparedBuild?null:document.querySelector('#tools-extra')||document.querySelector('.tools');let button=null;
 const api={
  get shown(){return shown;},
  toggle(){
   shown=!shown;try{localStorage.setItem(STORAGE_KEY,shown?'1':'0');}catch{/* storage blocked: this visit only */}
   if(shown){samples=[];last=0;painted=0;show();}else if(box)box.hidden=true;
   button?.setAttribute('aria-pressed',String(shown));return shown;
  },
  // begin() at the start of a frame's work, frame() at its end, after the render.
  begin(){
   if(!shown)return;started=performance.now();
   if(timer&&!query){query=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}
  },
  frame(now){
   if(!shown)return;
   const entry={t:now,dt:last?now-last:null,cpu:started?performance.now()-started:null,gpu:null};last=now;started=0;
   if(query){gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push({q:query,entry});query=null;}
   if(timer)poll();
   samples.push(entry);
   if(now-painted>=PAINT_MS){painted=now;paint(now);}
  },
 };
 if(mount){button=document.createElement('button');button.id='stats';button.type='button';button.textContent='Stats';button.title='Performance stats (F3 or `)';
  button.setAttribute('aria-pressed',String(shown));button.addEventListener('click',()=>api.toggle());mount.appendChild(button);}
 return api;
}
