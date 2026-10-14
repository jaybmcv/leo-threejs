// Tester feedback: one button, a screenshot taken as it opens, a voice note or a few words, and the context a fix needs
// (the exact view link, build, device and recent errors), all shown to the tester before anything leaves the page.
// Hidden from visitors: ?feedback=1 turns it on for this browser, ?feedback=0 off again. Until the capture service
// exists, Send saves the report as one JSON file the tester can pass on.
const KEY='leo-feedback',MAX_VOICE=120,MAX_SHOT=1600,MAX_ERRORS=20;

export function feedbackEnabled(){
 const flag=new URLSearchParams(location.search).get('feedback');
 try{if(flag==='1')localStorage.setItem(KEY,'1');else if(flag==='0')localStorage.removeItem(KEY);return localStorage.getItem(KEY)==='1';}
 catch{return flag==='1';}
}

// Errors are kept as messages only, long tokens masked, from the moment the page installs this.
const errors=[];
const mask=text=>String(text).replace(/[A-Za-z0-9+/_=-]{32,}/g,'[masked]').slice(0,300);
function remember(message){errors.push(`${new Date().toISOString().slice(11,19)} ${mask(message)}`);if(errors.length>MAX_ERRORS)errors.shift();}

// page: 'viewer' or 'walk'. context(): {link, where} for the current view. mount: where the button goes, or a function
// asked again on resize (null: it floats); look 'link' makes it a text link like its neighbours there. css: the page's
// own placement rules. onOpen/onClose: pause and resume the page's own keys while the panel is up.
export function installFeedback({renderer,page,context,mount=null,look='pill',css='',onOpen=()=>{},onClose=()=>{}}){
 if(!feedbackEnabled())return null;
 addEventListener('error',e=>remember(e.message||'Script error'));
 addEventListener('unhandledrejection',e=>remember(e.reason?.message||e.reason||'Unhandled rejection'));

 // The drawing buffer is cleared once a frame is shown, so the screenshot is read in the same task as the page's
 // render calls: the first render after a request queues the read for when the frame's passes are all done.
 let pending=null;const frames=[];
 const render=renderer.render.bind(renderer);
 renderer.render=(scene,camera)=>{render(scene,camera);
  const now=performance.now();if(now-(frames[frames.length-1]||0)>1){frames.push(now);if(frames.length>120)frames.shift();}
  if(pending&&!pending.queued){pending.queued=true;queueMicrotask(()=>{const p=pending;pending=null;p.resolve(snapshot(renderer.domElement));});}};
 const grab=()=>new Promise(resolve=>{pending={resolve,queued:false};setTimeout(()=>{if(pending?.resolve===resolve){pending=null;resolve(null);}},1500);});
 const fps=()=>{const now=performance.now(),recent=frames.filter(t=>now-t<2000);return recent.length>1?Math.round((recent.length-1)/((recent[recent.length-1]-recent[0])/1000)):null;};

 const ui=buildPanel(css);let report=null,recorder=null,timer=0;
 const place=()=>{const m=typeof mount==='function'?mount():mount;if(m?.contains(ui.button))return;
  ui.button.className='fb-button'+(m?' fb-mounted':'')+(m&&look==='link'?' fb-link':'');if(m)m.prepend(ui.button);else document.body.append(ui.button);};
 place();if(typeof mount==='function')addEventListener('resize',place);
 const close=()=>{stopVoice();ui.sheet.hidden=true;report=null;onClose();};
 async function open(){
  if(!ui.sheet.hidden)return;
  // The screenshot first, before the panel covers the view.
  const shot=await grab();
  report={page,shot,voice:null,context:{...context(),build:build(),device:device(renderer),fps:fps(),errors:[...errors],time:new Date().toISOString()}};
  ui.text.value='';ui.error.textContent='';showShot();showVoice();showAttached();
  ui.sheet.hidden=false;onOpen();ui.text.focus();
 }
 function showShot(){ui.shot.hidden=!report.shot;ui.noShot.hidden=!!report.shot;if(report.shot)ui.img.src=report.shot;}
 function showVoice(){
  const v=report.voice;ui.audio.hidden=!v;ui.dropVoice.hidden=!v;ui.record.textContent=v?'Record again':'Record a voice note';
  if(v)ui.audio.src=v.url;else ui.audio.removeAttribute('src');
 }
 function showAttached(){
  const c=report.context,rows=[['View',c.link],['Where',c.where],['Build',c.build.join(', ')||'unknown'],['Device',`${c.device.screen} · ${c.device.touch?'touch':'mouse'} · ${c.device.gpu||'GPU not reported'}`],
   ['Browser',c.device.browser],['Render rate',c.fps?`${c.fps} frames a second`:'not measured'],['Recent errors',c.errors.length?c.errors.join('\n'):'none']];
  ui.list.replaceChildren(...rows.map(([k,v])=>{const row=document.createElement('div');row.append(Object.assign(document.createElement('b'),{textContent:k}),Object.assign(document.createElement('span'),{textContent:v||'—'}));return row;}));
 }
 async function startVoice(){
  if(recorder){stopVoice();return;}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch{ui.error.textContent='The microphone is not available. You can type instead.';return;}
  const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>window.MediaRecorder?.isTypeSupported?.(t));
  const chunks=[];recorder=new MediaRecorder(stream,type?{mimeType:type}:{});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());clearInterval(timer);recorder=null;
   if(!report)return;const blob=new Blob(chunks,{type:chunks[0]?.type||type||'audio/webm'});
   if(report.voice)URL.revokeObjectURL(report.voice.url);report.voice=blob.size?{blob,url:URL.createObjectURL(blob)}:null;showVoice();};
  recorder.start();const t0=Date.now();ui.record.textContent='Stop · 0:00';
  timer=setInterval(()=>{const s=Math.round((Date.now()-t0)/1000);ui.record.textContent=`Stop · ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;if(s>=MAX_VOICE)stopVoice();},250);
 }
 function stopVoice(){if(recorder&&recorder.state!=='inactive')recorder.stop();}
 async function send(){
  if(recorder){ui.error.textContent='Stop the recording first.';return;}
  const text=ui.text.value.trim();
  if(!text&&!report.voice){ui.error.textContent='Say or type what happened first.';ui.text.focus();return;}
  const out={kind:'leo-feedback',version:1,page:report.page,text,context:report.context,screenshot:report.shot,
   voice:report.voice?{type:report.voice.blob.type,data:await dataURL(report.voice.blob)}:null};
  save(out);ui.sent.hidden=false;setTimeout(()=>{ui.sent.hidden=true;close();},1600);
 }
 ui.button.addEventListener('click',open);
 ui.dropShot.addEventListener('click',()=>{report.shot=null;showShot();});
 ui.record.addEventListener('click',startVoice);
 ui.dropVoice.addEventListener('click',()=>{URL.revokeObjectURL(report.voice.url);report.voice=null;showVoice();});
 ui.text.addEventListener('input',()=>{ui.error.textContent='';});
 ui.send.addEventListener('click',send);ui.cancel.addEventListener('click',close);
 ui.sheet.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close();});
 ui.sheet.addEventListener('click',e=>{if(e.target===ui.sheet)close();});
 return {open,close};
}

function snapshot(canvas){
 const s=Math.min(1,MAX_SHOT/canvas.width),c=document.createElement('canvas');c.width=Math.round(canvas.width*s);c.height=Math.round(canvas.height*s);
 // The viewer draws on a transparent canvas; black stands in for the page behind it.
 const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,c.width,c.height);g.drawImage(canvas,0,0,c.width,c.height);
 return c.toDataURL('image/jpeg',.85);
}
// The content-hashed scripts name the exact build.
const build=()=>[...document.scripts].map(s=>s.src.split('/').pop().split('?')[0]).filter(n=>/\.[0-9a-f]{10}\.js$/.test(n));
function device(renderer){
 let gpu=null;try{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');if(ext)gpu=gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);}catch{}
 return {browser:navigator.userAgent,screen:`${innerWidth}×${innerHeight} @${devicePixelRatio}x`,touch:matchMedia('(pointer:coarse)').matches,gpu};
}
const dataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
function save(out){
 const stamp=out.context.time.replace(/[-:]/g,'').replace('T','-').slice(0,15),a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([JSON.stringify(out)],{type:'application/json'}));a.download=`leo-feedback-${stamp}.json`;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}

const CSS=`
.fb-button{position:fixed;left:16px;bottom:50%;z-index:30;background:rgba(5,5,7,.82);color:#f4f0e8;border:1px solid rgba(255,255,255,.125);border-radius:999px;padding:9px 14px;font:400 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.fb-button.fb-mounted{position:static}
.fb-button.fb-link{background:none;border:0;border-radius:0;padding:0;font:inherit;letter-spacing:inherit;text-transform:inherit;color:inherit;backdrop-filter:none;-webkit-backdrop-filter:none;margin-right:14px}
.fb-button.fb-link:hover{color:#f85800}
.fb-button:hover{border-color:#f85800}
.fb-sheet{position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:rgba(0,0,0,.5)}
.fb-sheet[hidden]{display:none}
.fb-card{width:min(460px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;background:rgba(11,11,16,.97);color:#f4f0e8;border:1px solid rgba(255,255,255,.125);border-radius:14px;padding:18px;font:400 13px/1.45 "Sora",ui-sans-serif,system-ui,sans-serif;text-align:left}
.fb-card h2{font:500 22px/1.1 "Archivo",sans-serif;letter-spacing:-.02em;margin:0 0 12px}
.fb-eyebrow{font:400 10px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#f85800;margin-bottom:8px}
.fb-card button{font:400 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em;color:#f4f0e8;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.125);border-radius:10px;padding:10px 12px;cursor:pointer}
.fb-card button:hover{border-color:#f85800}
.fb-card [hidden]{display:none}
.fb-shot img{display:block;width:100%;height:min(28vh,240px);object-fit:contain;background:#000;border-radius:10px;border:1px solid rgba(255,255,255,.125)}
.fb-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px}
.fb-card textarea{width:100%;min-height:84px;resize:vertical;box-sizing:border-box;background:rgba(255,255,255,.04);color:#f4f0e8;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:10px;font:inherit}
.fb-card textarea:focus{outline:2px solid #f85800;outline-offset:1px}
.fb-card audio{width:100%;margin:4px 0}
.fb-muted{color:#a6a5b4;font-size:12px}
.fb-error{color:#ff8a5c;font-size:12px;min-height:16px;margin:6px 0}
.fb-card details{margin:6px 0 10px;color:#c9c3b8}.fb-card summary{cursor:pointer;font-size:12px}
.fb-list{display:grid;gap:6px;margin-top:8px;font:400 10px/1.45 "JetBrains Mono",ui-monospace,monospace}
.fb-list div{display:grid;grid-template-columns:92px 1fr;gap:8px}.fb-list b{font-weight:500;color:#f4f0e8}.fb-list span{white-space:pre-wrap;word-break:break-all;color:#a6a5b4}
.fb-actions{display:flex;gap:8px;justify-content:flex-end}
.fb-actions .fb-send{background:#f85800;border-color:#f85800;color:#fff}
.fb-sent{color:#2fd6c5;font-size:12px;margin-top:8px}
`;
function buildPanel(css){
 document.head.append(Object.assign(document.createElement('style'),{textContent:CSS+css}));
 const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};
 const button=el('button',{type:'button',className:'fb-button',textContent:'Feedback'});
 const img=el('img',{alt:'Screenshot of the view'}),dropShot=el('button',{type:'button',textContent:'Remove screenshot'});
 const shot=el('div',{className:'fb-shot'},img,el('div',{className:'fb-row'},dropShot));
 const noShot=el('p',{className:'fb-muted',textContent:'No screenshot attached.'});
 const text=el('textarea',{placeholder:'What happened, or what would you like changed?','aria-label':'Your feedback'});
 const record=el('button',{type:'button',textContent:'Record a voice note'}),dropVoice=el('button',{type:'button',textContent:'Remove voice note'}),audio=el('audio',{controls:true});
 const list=el('div',{className:'fb-list'}),error=el('div',{className:'fb-error',role:'alert'});
 const send=el('button',{type:'button',className:'fb-send',textContent:'Send'}),cancel=el('button',{type:'button',textContent:'Cancel'});
 const sent=el('div',{className:'fb-sent',textContent:'Saved. Thank you!',hidden:true});
 const card=el('div',{className:'fb-card'},el('div',{className:'fb-eyebrow',textContent:'Tester feedback'}),el('h2',{id:'fb-title',textContent:'Tell us what you see'}),
  shot,noShot,text,el('div',{className:'fb-row'},record,dropVoice),audio,
  el('details',{},el('summary',{textContent:'What gets attached'}),list),error,el('div',{className:'fb-actions'},cancel,send),sent);
 const sheet=el('div',{className:'fb-sheet',hidden:true,role:'dialog'},card);sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','fb-title');
 document.body.append(sheet);
 return {button,sheet,img,shot,noShot,dropShot,text,record,dropVoice,audio,list,error,send,cancel,sent};
}
