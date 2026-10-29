// The Crown lounge TV's server side (src/walk/crown-tv.js): one shared screen on the crown lift's aft face. Leo live
// (leo-live.mjs) passes the TV's messages and its web requests here.
//
// Anyone signed in with Discord (a Leo pass from The Creamery) may put a video on it, with no approval step; everyone
// else watches. The video stays until the next one replaces it, or until it is taken down. Uploading goes:
//   {m:'tv-ticket'} on the websocket      a one-time ticket for this visitor, good for TICKET_MS; guests are told to sign in
//   POST /tv/upload                       the mp4 itself as the body, the ticket in an X-Leo-Tv-Ticket header
//   GET  /tv/<id>.mp4                     the current video (ranges, so a browser can seek), for any page
//   GET  /tv                              the current video's details, as JSON
// so the file never passes through the websocket, and every upload is tied to a Discord account aboard at that moment.
// Every visitor hears {m:'tv', video, ...} when the video changes, and asks for it once with {m:'tv'}.
//
// Limits: an mp4 (ISO base media file) with an H.264 video track, every browser's common ground; up to LIMITS.bytes
// and LIMITS.seconds, read from the file's own header; no bigger than 1080p; one upload a minute per account, two at
// once in all. Who uploaded what is written to the log, and the uploader's Discord name shows under the screen.
//
// Kept in a folder beside this checkout (LEO_LIVE_TV, default ../../leo-live-tv): the video as <id>.mp4 and its details
// in current.json, so a restart keeps it. Taking it down: a Discord account named in LEO_LIVE_TV_OWNERS gets a Take down
// button at the TV; or, on the computer Leo live runs on, create the file LEO_LIVE_TV_CLEAR (default
// ../../leo-live-tv-clear; `node scripts/tv-clear.mjs` does it). Either way the screen goes blank for everyone at once,
// the file is deleted and the take-down is logged.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=name=>fileURLToPath(new URL('../../'+name,import.meta.url));
const TICKET_MS=120000,COOLDOWN_MS=60000,AT_ONCE=2;
export const TV_LIMITS={bytes:Number(process.env.LEO_LIVE_TV_MAX_MB||40)*1048576,seconds:Number(process.env.LEO_LIVE_TV_MAX_S||120),side:1920,pixels:1920*1080};

// The boxes of an mp4 inside buf[from, to): [{type, start (of its content), end}].
function boxes(buf,from=0,to=buf.length){
 const out=[];let at=from;
 while(at+8<=to){
  let size=buf.readUInt32BE(at),head=8;const type=buf.toString('latin1',at+4,at+8);
  if(size===1){if(at+16>to)break;size=Number(buf.readBigUInt64BE(at+8));head=16;}else if(size===0)size=to-at;
  if(size<head||at+size>to)break;
  out.push({type,start:at+head,end:at+size});at+=size;
 }
 return out;
}
const child=(buf,box,type)=>box&&boxes(buf,box.start,box.end).find(b=>b.type===type);
// What the TV needs to know of an mp4, from its own header: {seconds, width, height, codec}, or {why} it won't do.
export function readMp4(buf){
 const top=boxes(buf);
 if(top[0]?.type!=='ftyp')return {why:'not-mp4'};
 const moov=top.find(b=>b.type==='moov'),mvhd=child(buf,moov,'mvhd');
 if(!mvhd||mvhd.end-mvhd.start<32)return {why:'not-mp4'};
 const v1=buf[mvhd.start]===1,scale=buf.readUInt32BE(mvhd.start+(v1?20:12)),length=v1?Number(buf.readBigUInt64BE(mvhd.start+24)):buf.readUInt32BE(mvhd.start+16);
 const seconds=scale?length/scale:0;
 let video=null;
 for(const trak of boxes(buf,moov.start,moov.end).filter(b=>b.type==='trak')){
  const mdia=child(buf,trak,'mdia'),hdlr=child(buf,mdia,'hdlr');
  if(!hdlr||hdlr.end-hdlr.start<12||buf.toString('latin1',hdlr.start+8,hdlr.start+12)!=='vide')continue;
  const tkhd=child(buf,trak,'tkhd'),stsd=child(buf,child(buf,child(buf,mdia,'minf'),'stbl'),'stsd');
  const w=tkhd&&tkhd.end-tkhd.start>=84?tkhd.start+(buf[tkhd.start]===1?88:76):0;
  video={codec:stsd&&stsd.end-stsd.start>=16?buf.toString('latin1',stsd.start+12,stsd.start+16):'',width:w?Math.round(buf.readUInt32BE(w)/65536):0,height:w?Math.round(buf.readUInt32BE(w+4)/65536):0};
  break;
 }
 if(!video)return {why:'no-video'};
 if(!/^avc[13]$/.test(video.codec))return {why:'codec',codec:video.codec};
 if(!(seconds>0))return {why:'not-mp4'};
 return {seconds,...video};
}
// Whether what readMp4 found is within the limits: null, or why not.
export function tooMuch(info,limits=TV_LIMITS){
 if(info.seconds>limits.seconds+.5)return 'long';
 const long=Math.max(info.width,info.height),short=Math.min(info.width,info.height);
 if(long>limits.side||long*short>limits.pixels)return 'large';
 return null;
}

// `send(v,msg)`, `log(...)`, `everyone()`: the visitors aboard; `allowed(origin)`: a page that may upload.
// `files`: {dir, clear} (tests pass their own through the environment).
export function createTv({send,log=()=>{},everyone=()=>[],allowed=()=>false,files={},watch=true,limits=TV_LIMITS}={}){
 const DIR=files.dir||process.env.LEO_LIVE_TV||here('leo-live-tv');
 const CLEAR=files.clear||process.env.LEO_LIVE_TV_CLEAR||here('leo-live-tv-clear');
 const OWNERS=new Set((process.env.LEO_LIVE_TV_OWNERS||'').split(',').map(s=>s.trim()).filter(s=>/^\d{5,24}$/.test(s)));
 const STATE=path.join(DIR,'current.json'),fileOf=id=>path.join(DIR,id+'.mp4');
 fs.mkdirSync(DIR,{recursive:true});
 let current=null;
 try{const c=JSON.parse(fs.readFileSync(STATE,'utf8'));if(c&&/^[0-9a-f]{16}$/.test(c.id)&&fs.existsSync(fileOf(c.id)))current=c;}catch{}
 // Anything else in the folder is an old video (or one cut off by a restart): gone, once nothing is reading it.
 const stale=new Set();
 const sweep=()=>{for(const f of fs.readdirSync(DIR))if(/\.(mp4|part)$/.test(f)&&f!==`${current?.id}.mp4`)stale.add(path.join(DIR,f));
  for(const f of stale)try{fs.rmSync(f,{force:true});stale.delete(f);}catch{}};
 sweep();const sweeper=setInterval(sweep,60000);sweeper.unref?.();
 const tickets=new Map(),lastBy=new Map();let busy=0;
 const owner=v=>!!v.discord&&OWNERS.has(v.discord.discordId);
 const who=v=>`discord:${v.discord.discordId} ${JSON.stringify(v.name||'')}`;
 const shown=()=>current&&{id:current.id,src:`/tv/${current.id}.mp4`,name:current.name,at:current.at,seconds:current.seconds,width:current.width,height:current.height};
 const stateFor=(v,extra={})=>({m:'tv',video:shown(),verified:!!v.discord,owner:owner(v),max:{mb:Math.round(limits.bytes/1048576),seconds:limits.seconds},...extra});
 const tellAll=extra=>{for(const v of everyone())if(v.ready)send(v,stateFor(v,extra));};
 function save(){
  try{if(current)fs.writeFileSync(STATE,JSON.stringify(current));else fs.rmSync(STATE,{force:true});}catch(e){log('tv state not saved',e.message);}
 }
 function takeDown(how){
  if(!current)return false;
  const was=current;current=null;save();stale.add(fileOf(was.id));sweep();
  log('tv taken down',was.id,`discord:${was.discordId}`,JSON.stringify(was.name||''),how);
  tellAll({down:true});return true;
 }

 function message(v,msg){
  if(msg.m==='tv'){send(v,stateFor(v));return;}
  if(msg.m==='tv-ticket'){
   if(!v.discord){send(v,{m:'tv-ticket',ok:false,why:'sign-in'});return;}
   const wait=(lastBy.get(v.discord.discordId)||0)+COOLDOWN_MS-Date.now();
   if(wait>0){send(v,{m:'tv-ticket',ok:false,why:'slow',ms:wait});return;}
   for(const [t,x] of tickets)if(x.v===v||x.until<Date.now())tickets.delete(t);
   const ticket=randomBytes(24).toString('hex');tickets.set(ticket,{v,until:Date.now()+TICKET_MS});
   send(v,{m:'tv-ticket',ok:true,ticket,max:{bytes:limits.bytes,seconds:limits.seconds}});return;
  }
  if(msg.m==='tv-down'){
   if(!owner(v)){send(v,{m:'tv-ticket',ok:false,why:'not-owner'});return;}
   if(!takeDown(`(owner ${who(v)})`))send(v,stateFor(v));
  }
 }
 function leave(v){for(const [t,x] of tickets)if(x.v===v)tickets.delete(t);}

 // Web requests under /tv; false for anything else.
 function http(req,res){
  const url=new URL(req.url,'http://x');if(url.pathname!=='/tv'&&!url.pathname.startsWith('/tv/'))return false;
  const origin=req.headers.origin||'',cors=origin&&allowed(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{};
  const answer=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',...cors});res.end(JSON.stringify(body));};
  if(url.pathname==='/tv'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({video:shown()}));return true;}
  if(url.pathname==='/tv/upload'){
   if(req.method==='OPTIONS'){res.writeHead(cors['Access-Control-Allow-Origin']?204:403,{...cors,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type, X-Leo-Tv-Ticket','Access-Control-Max-Age':'600'});res.end();return true;}
   if(req.method!=='POST'){answer(405,{ok:false,why:'method'});return true;}
   upload(req,res,{answer,cors}).catch(e=>{log('tv upload failed',e.message);if(!res.headersSent)answer(500,{ok:false,why:'failed'});});
   return true;
  }
  const m=/^\/tv\/([0-9a-f]{16})\.mp4$/.exec(url.pathname);
  if(!m||!current||m[1]!==current.id||(req.method!=='GET'&&req.method!=='HEAD')){res.writeHead(404,{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});res.end();return true;}
  serve(req,res,fileOf(current.id));return true;
 }
 // The video, whole or a range of it. Cached for a few minutes only, so a take-down is soon gone everywhere.
 function serve(req,res,file){
  let size;try{size=fs.statSync(file).size;}catch{res.writeHead(404,{'Access-Control-Allow-Origin':'*'});res.end();return;}
  const head={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'public, max-age=600','Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin','X-Content-Type-Options':'nosniff'};
  let start=0,end=size-1,code=200;const r=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
  if(r&&(r[1]||r[2])){
   if(r[1]===''){start=Math.max(0,size-Number(r[2]));}else{start=Number(r[1]);if(r[2]!=='')end=Math.min(size-1,Number(r[2]));}
   if(start>end||start>=size){res.writeHead(416,{...head,'Content-Range':`bytes */${size}`});res.end();return;}
   code=206;head['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  res.writeHead(code,{...head,'Content-Length':String(end-start+1)});
  if(req.method==='HEAD'){res.end();return;}
  fs.createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
 }
 async function upload(req,res,{answer,cors}){
  // Refused: say why, and let the rest of the body drain, up to the size limit (past it, the connection is cut).
  const no=(code,why)=>{answer(code,{ok:false,why});if(req.complete)return;let n=0;req.removeAllListeners('data');req.on('data',c=>{n+=c.length;if(n>limits.bytes)req.destroy();}).on('error',()=>{}).resume();};
  if(!cors['Access-Control-Allow-Origin'])return no(403,'origin');
  const ticket=String(req.headers['x-leo-tv-ticket']||''),t=tickets.get(ticket);tickets.delete(ticket);
  const v=t?.v;
  if(!t||t.until<Date.now()||!v.ready||v.ws.readyState!==1||!v.discord)return no(403,'ticket');
  if((lastBy.get(v.discord.discordId)||0)+COOLDOWN_MS>Date.now())return no(429,'slow');
  if(!/^video\/mp4\b/.test(req.headers['content-type']||''))return no(415,'not-mp4');
  const said=Number(req.headers['content-length']);
  if(said>limits.bytes)return no(413,'big');
  if(busy>=AT_ONCE)return no(503,'busy');
  busy++;
  try{
   const parts=[];let got=0;
   const whole=await new Promise(resolve=>{
    req.on('data',c=>{got+=c.length;if(got>limits.bytes){resolve(false);req.pause();return;}parts.push(c);});
    req.on('end',()=>resolve(true));req.on('error',()=>resolve(null));req.on('aborted',()=>resolve(null));
   });
   if(whole===null)return;
   // Past the limit with more to come: refused and cut off (a page checks the size before it sends).
   if(!whole){res.once('finish',()=>req.destroy());answer(413,{ok:false,why:'big'});return;}
   const buf=Buffer.concat(parts),info=readMp4(buf);
   if(info.why){log('tv upload refused',who(v),info.why,info.codec||'',buf.length,'bytes');return no(415,info.why);}
   const over=tooMuch(info,limits);
   if(over){log('tv upload refused',who(v),over,info.seconds.toFixed(1)+'s',`${info.width}x${info.height}`);return no(413,over);}
   const id=randomBytes(8).toString('hex');
   fs.writeFileSync(fileOf(id)+'.part',buf);fs.renameSync(fileOf(id)+'.part',fileOf(id));
   const was=current;
   current={id,name:v.name||'Voyager',discordId:v.discord.discordId,at:new Date().toISOString(),bytes:buf.length,seconds:Math.round(info.seconds*10)/10,width:info.width,height:info.height};
   save();if(was)stale.add(fileOf(was.id));sweep();lastBy.set(v.discord.discordId,Date.now());
   log('tv video',id,who(v),buf.length,'bytes',current.seconds+'s',`${info.width}x${info.height}`,was?`replacing ${was.id}`:'');
   answer(200,{ok:true,video:shown()});tellAll();
  }finally{busy--;}
 }

 const checkClear=()=>{if(!fs.existsSync(CLEAR))return;let note='';try{note=fs.readFileSync(CLEAR,'utf8').trim().slice(0,80);}catch{}
  try{fs.rmSync(CLEAR,{force:true});}catch{}if(!takeDown(`(admin${note?': '+JSON.stringify(note):''})`))log('tv clear asked, but the screen is already blank');};
 if(watch){checkClear();fs.watchFile(CLEAR,{interval:1000},checkClear);}
 return {message,leave,http,takeDown,stop(){clearInterval(sweeper);fs.unwatchFile(CLEAR);},get current(){return current;}};
}
