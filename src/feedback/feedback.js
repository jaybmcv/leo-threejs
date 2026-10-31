// Tester feedback: bugs, changes and ideas. One button, a screenshot taken as it opens, a voice note or a few words,
// images of what the tester has in mind, and the context a fix needs (the exact view link, build, device and recent
// errors), all shown to the tester before anything leaves the page.
// Hidden from visitors. A tester's invite link (?invite=<code>) turns it on for this browser and lets Send deliver the
// report to the capture service (config.js); ?feedback=1 turns it on without one, and Send then saves the report as a
// file. ?feedback=0 turns it off again.
import {FEEDBACK_CONFIG} from './config.js';
const KEY='leo-feedback',INVITE='leo-feedback-invite',MAX_VOICE=120,MAX_SHOT=1600,MAX_ERRORS=20,MAX_IMAGES=3;
let invite=null;

export function feedbackEnabled(){
 const params=new URLSearchParams(location.search),flag=params.get('feedback'),code=params.get('invite');
 // The invite leaves the address straight away, so it never ends up in a shared view link or a report.
 if(code!==null&&location.protocol!=='file:'){params.delete('invite');history.replaceState(history.state,'',location.pathname+(params.size?'?'+params:'')+location.hash);}
 if(code)invite=code;
 try{
  if(code)localStorage.setItem(INVITE,code);
  if(flag==='1'||code)localStorage.setItem(KEY,'1');else if(flag==='0'){localStorage.removeItem(KEY);localStorage.removeItem(INVITE);invite=null;}
  invite=invite||localStorage.getItem(INVITE);return localStorage.getItem(KEY)==='1';
 }catch{return flag==='1'||!!code;}
}
const sending=()=>!!(FEEDBACK_CONFIG.endpoint&&FEEDBACK_CONFIG.turnstileSiteKey&&invite);
// The tester invite this browser holds, or null (the walk gives testers a captain's hat: walk/hat.js, and notes the
// invite with their Discord account). Before feedbackEnabled() it knows only an invite kept from an earlier visit.
export function testerInvite(){try{return invite||localStorage.getItem(INVITE);}catch{return invite;}}
export const hasTesterInvite=()=>!!testerInvite();

// Errors are kept as messages only, long tokens masked, from the moment the page installs this.
const errors=[];
const mask=text=>String(text).replace(/[A-Za-z0-9+/_=-]{32,}/g,'[masked]').slice(0,300);
function remember(message){errors.push(`${new Date().toISOString().slice(11,19)} ${mask(message)}`);if(errors.length>MAX_ERRORS)errors.shift();}

// page: 'viewer' or 'walk'. context(): {link, where} for the current view. mount: where the button goes, or a function
// asked again on resize (null: it floats); look 'link' makes it a text link like its neighbours there. css: the page's
// own placement rules. onOpen/onClose: pause and resume the page's own keys while the panel is up. identity(): on a page
// that knows who the tester is, null or {name, pass(), renew()}: their Discord name, a promise of the Leo pass
// (walk/net/connect.js) that goes with the report, so the capture service can check whose report it is (an expired
// one when it could not be renewed: the issue says "pass lapsed"), and renew(), called as the panel opens.
export function installFeedback({renderer,page,context,mount=null,look='pill',css='',identity=null,onOpen=()=>{},onClose=()=>{}}){
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

 const ui=buildPanel(css);let report=null,recorder=null,timer=0,check=null,token=null,checkFailed=false,waiting=false,leaving=0;
 const place=()=>{const m=typeof mount==='function'?mount():mount;if(m?.contains(ui.button))return;
  ui.button.className='fb-button'+(m?' fb-mounted':'')+(m&&look==='link'?' fb-link':'');if(m)m.prepend(ui.button);else document.body.append(ui.button);};
 place();if(typeof mount==='function')addEventListener('resize',place);
 // The human check's script loads while the tester is still looking around, so the check can start the moment the
 // panel opens.
 if(sending())(window.requestIdleCallback||setTimeout)(()=>loadTurnstile().catch(()=>{}),{timeout:2000});
 const close=()=>{clearTimeout(leaving);ui.sent.hidden=true;stopVoice();ui.sheet.hidden=true;report=null;waiting=false;ui.send.disabled=false;ui.send.textContent='Send';onClose();};
 async function open(){
  if(!ui.sheet.hidden)return;
  // The screenshot first, before the panel covers the view.
  const shot=await grab();
  report={page,shot,voice:null,images:[],context:{...context(),build:build(),device:device(renderer),fps:fps(),errors:[...errors],time:new Date().toISOString()}};
  ui.hub.hidden=!sending();ui.text.value='';ui.error.textContent='';ui.saveInstead.hidden=true;showShot();showVoice();showImages();showAttached();
  ui.sheet.hidden=false;onOpen();ui.text.focus();
  if(sending()){humanCheck();identity?.()?.renew?.().catch(()=>{});}
 }
 // Cloudflare Turnstile; the service verifies its token. A token not yet used is kept for the next time the panel
 // opens (the widget renews it before it runs out). Send pressed while the check runs sends as soon as it finishes.
 async function humanCheck(){
  ui.check.hidden=false;if(token)return;checkFailed=false;
  try{await loadTurnstile();}catch(e){checkFailed=true;ui.error.textContent=e.message;return;}
  if(check===null)check=window.turnstile.render(ui.check,{sitekey:FEEDBACK_CONFIG.turnstileSiteKey,theme:'dark',size:'flexible',
   callback:t=>{token=t;checkFailed=false;ui.error.textContent='';if(waiting)send();},'expired-callback':()=>{token=null;},
   'error-callback':()=>{token=null;checkFailed=true;ui.error.textContent='The human check could not run here. You can save the report as a file instead.';if(waiting)send();}});
  else window.turnstile.reset(check);
 }
 function showShot(){ui.shot.hidden=!report.shot;ui.noShot.hidden=!!report.shot;if(report.shot)ui.img.src=report.shot;}
 function showVoice(){
  const v=report.voice;ui.audio.hidden=!v;ui.dropVoice.hidden=!v;ui.record.textContent=v?'Record again':'Record a voice note';
  if(v)ui.audio.src=v.url;else ui.audio.removeAttribute('src');
 }
 function showImages(){
  ui.images.replaceChildren(...report.images.map((im,i)=>{const drop=Object.assign(document.createElement('button'),{type:'button',textContent:'×',title:'Remove image'});drop.setAttribute('aria-label',`Remove ${im.name}`);
   drop.onclick=()=>{report.images.splice(i,1);showImages();};const fig=document.createElement('figure');fig.append(Object.assign(document.createElement('img'),{src:im.data,alt:im.name}),drop);return fig;}));
  ui.images.hidden=!report.images.length;ui.addImages.hidden=report.images.length>=MAX_IMAGES;
 }
 // Images the tester adds (picked, pasted or dropped): scaled down and re-encoded here, so only pixels leave the page.
 async function addImages(files){
  const picked=[...files].filter(f=>f.type.startsWith('image/'));
  if(files.length&&!picked.length){ui.error.textContent='Only images can be added. For a video, paste its link in the text.';return;}
  for(const f of picked){
   if(report.images.length>=MAX_IMAGES){ui.error.textContent=`Up to ${MAX_IMAGES} images.`;break;}
   try{report.images.push({name:f.name||'pasted image',data:await shrink(f)});}catch{ui.error.textContent=`${f.name||'That image'} could not be read.`;}
  }
  showImages();
 }
 function showAttached(){
  const c=report.context,rows=[['View',c.link],['Where',c.where],['Build',c.build.join(', ')||'unknown'],['Device',`${c.device.screen} · ${c.device.touch?'touch':'mouse'} · ${c.device.gpu||'GPU not reported'}`],
   ['Browser',c.device.browser],['Render rate',c.fps?`${c.fps} frames a second`:'not measured'],['Recent errors',c.errors.length?c.errors.join('\n'):'none']];
  if(identity)rows.splice(1,0,['Discord',identity()?.name||'not connected']);
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
  // The panel can close and open on a new report while this one is on its way; its answer then has no business here.
  const mine=report,current=()=>report===mine;
  const text=ui.text.value.trim();
  if(!text&&!report.voice){ui.error.textContent='Say or type what you would like first.';ui.text.focus();return;}
  const out={kind:'leo-feedback',version:1,page:mine.page,text,context:mine.context,screenshot:mine.shot,
   voice:mine.voice?{type:mine.voice.blob.type,data:await dataURL(mine.voice.blob)}:null,images:mine.images.map(im=>({name:im.name.slice(0,80),data:im.data}))};
  if(!current())return;
  if(!sending()){save(out);done('Saved. Thank you!');return;}
  if(!token&&checkFailed){waiting=false;ui.send.disabled=false;ui.send.textContent='Send';ui.error.textContent='The human check could not run here. You can save the report as a file instead.';offerFile(out);return;}
  if(!token){waiting=true;ui.send.disabled=true;ui.send.textContent='Sending after the human check…';return;}
  waiting=false;ui.send.disabled=true;ui.send.textContent='Sending…';
  // A token works once; the widget starts on the next one straight away.
  const human=token;token=null;
  try{
   const pass=await identity?.()?.pass().catch(()=>null);
   let r;try{r=await fetch(FEEDBACK_CONFIG.endpoint.replace(/\/$/,'')+'/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite,turnstile:human,report:out,...(pass?{pass}:{})})});}
   catch{throw new Error('The report could not be sent.');}
   const reply=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(reply.error||`The report could not be sent (${r.status}).`);
   if(current())done(`Sent. Thank you! Reference ${reply.id}.`,reply.id);
  }catch(e){
   // Nothing is lost: the tester can keep the report as a file and pass it on.
   if(current())ui.error.textContent=`${e.message} You can save it as a file instead.`;
   if(current())offerFile(out);
  }finally{if(current()){ui.send.disabled=!ui.sent.hidden;ui.send.textContent='Send';if(check!==null)window.turnstile.reset(check);}}
 }
 function offerFile(out){ui.saveInstead.hidden=false;ui.saveInstead.onclick=()=>{save(out);done('Saved. Thank you!');};}
 // A sent report stays up a little longer, with the way to follow it.
 function done(message,sentId=null){
  ui.sent.textContent=message;ui.sent.hidden=false;
  if(sentId)ui.sent.append(' ',Object.assign(document.createElement('a'),{href:`hub.html?r=${encodeURIComponent(sentId)}`,target:'_blank',rel:'noopener',textContent:'Track it'}));
  leaving=setTimeout(close,sentId?7000:2200);
 }
 ui.button.addEventListener('click',open);
 ui.dropShot.addEventListener('click',()=>{report.shot=null;showShot();});
 ui.record.addEventListener('click',startVoice);
 ui.addImages.addEventListener('click',()=>ui.picker.click());
 ui.picker.addEventListener('change',()=>{addImages(ui.picker.files);ui.picker.value='';});
 ui.sheet.addEventListener('paste',e=>{if(report&&e.clipboardData?.files.length){e.preventDefault();addImages(e.clipboardData.files);}});
 ui.card.addEventListener('dragover',e=>{e.preventDefault();ui.card.classList.add('fb-drop');});
 ui.card.addEventListener('dragleave',()=>ui.card.classList.remove('fb-drop'));
 ui.card.addEventListener('drop',e=>{e.preventDefault();ui.card.classList.remove('fb-drop');if(report)addImages(e.dataTransfer.files);});
 ui.dropVoice.addEventListener('click',()=>{URL.revokeObjectURL(report.voice.url);report.voice=null;showVoice();});
 ui.text.addEventListener('input',()=>{ui.error.textContent='';});
 ui.send.addEventListener('click',send);ui.cancel.addEventListener('click',close);
 ui.sheet.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close();});
 ui.sheet.addEventListener('click',e=>{if(e.target===ui.sheet)close();});
 return {open,close};
}

async function shrink(file){
 const bitmap=await createImageBitmap(file),s=Math.min(1,MAX_SHOT/Math.max(bitmap.width,bitmap.height));
 const c=document.createElement('canvas');c.width=Math.round(bitmap.width*s);c.height=Math.round(bitmap.height*s);
 const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
 return c.toDataURL('image/jpeg',.85);
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
function loadTurnstile(){
 if(window.turnstile)return Promise.resolve();
 return new Promise((resolve,reject)=>{const s=Object.assign(document.createElement('script'),{src:'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',async:true});
  s.onload=resolve;s.onerror=()=>reject(new Error('The human check could not load. You can save the report as a file instead.'));document.head.append(s);});
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
.fb-sent{color:#2fd6c5;font-size:12px;margin-top:8px}.fb-sent a{color:inherit;font-weight:500;padding:6px 0;display:inline-block}
.fb-card{position:relative;box-sizing:border-box}.fb-hub{position:absolute;top:6px;right:10px;padding:12px 6px;font:400 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em;color:#2fd6c5;text-decoration:none}.fb-hub:hover{color:#f4f0e8}
.fb-check{margin:4px 0 8px;min-height:65px}
.fb-intro{color:#c9c3b8;margin:-4px 0 12px}
.fb-label{font:400 10px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#a6a5b4;margin:0 0 6px}
.fb-images{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.fb-images figure{position:relative;margin:0;width:88px;height:66px}
.fb-images img{width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.125)}
.fb-card .fb-images button{position:absolute;top:3px;right:3px;padding:2px 7px;border-radius:999px;background:rgba(0,0,0,.7);font-size:13px}
.fb-card.fb-drop{outline:2px dashed #f85800;outline-offset:-6px}
`;
function buildPanel(css){
 document.head.append(Object.assign(document.createElement('style'),{textContent:CSS+css}));
 const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};
 const button=el('button',{type:'button',className:'fb-button',textContent:'Feedback'});
 const img=el('img',{alt:'Screenshot of your view'}),dropShot=el('button',{type:'button',textContent:'Remove screenshot'});
 const shot=el('div',{className:'fb-shot'},el('p',{className:'fb-label',textContent:'Your view right now'}),img,el('div',{className:'fb-row'},dropShot));
 const noShot=el('p',{className:'fb-muted',textContent:'No screenshot attached.'});
 const text=el('textarea',{placeholder:'What’s wrong, or what would you like to see here?','aria-label':'Your feedback'});
 const addImages=el('button',{type:'button',textContent:'Add images'}),picker=el('input',{type:'file',accept:'image/*',multiple:true,hidden:true}),images=el('div',{className:'fb-images',hidden:true});
 const record=el('button',{type:'button',textContent:'Record a voice note'}),dropVoice=el('button',{type:'button',textContent:'Remove voice note'}),audio=el('audio',{controls:true});
 const list=el('div',{className:'fb-list'}),error=el('div',{className:'fb-error',role:'alert'});
 const send=el('button',{type:'button',className:'fb-send',textContent:'Send'}),cancel=el('button',{type:'button',textContent:'Cancel'}),saveInstead=el('button',{type:'button',textContent:'Save as a file',hidden:true});
 const hub=el('a',{className:'fb-hub',href:'hub.html',target:'_blank',rel:'noopener',textContent:'My ideas →',hidden:true});
 const check=el('div',{className:'fb-check',hidden:true});
 const sent=el('div',{className:'fb-sent',textContent:'Saved. Thank you!',hidden:true});
 const card=el('div',{className:'fb-card'},hub,el('div',{className:'fb-eyebrow',textContent:'Feedback'}),el('h2',{id:'fb-title',textContent:'What would you change?'}),
  el('p',{className:'fb-intro',textContent:'Spotted a bug? Want a room, prop or detail added or changed? Tell us, and add a picture or a link of what you have in mind.'}),
  shot,noShot,text,el('div',{className:'fb-row'},record,dropVoice,addImages,picker),audio,images,
  el('details',{},el('summary',{textContent:'What gets attached'}),list),check,error,el('div',{className:'fb-actions'},cancel,saveInstead,send),sent);
 const sheet=el('div',{className:'fb-sheet',hidden:true,role:'dialog'},card);sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','fb-title');
 document.body.append(sheet);
 return {button,hub,sheet,card,img,shot,noShot,dropShot,text,record,dropVoice,addImages,picker,images,audio,list,check,error,send,cancel,saveInstead,sent};
}
