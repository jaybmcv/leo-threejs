import {randomBytes} from 'node:crypto';
import {isIP} from 'node:net';

const MAX_BYTES=5*1024*1024,MAX_PIXELS=4*1024*1024,PLAYER_MS=10*60e3,HOUR_MS=60*60e3,PER_HOUR=12,TICKET_MS=30e3;
const PNG=Buffer.from('89504e470d0a1a0a','hex'),IEND=Buffer.from('0000000049454e44ae426082','hex');
async function isPhoto(bytes,type){
 const png=type==='image/png';
 if(png){
  if(!bytes.subarray(0,8).equals(PNG)||!bytes.subarray(-12).equals(IEND))return false;
 }else if(bytes.length<4||bytes.readUInt16BE(0)!==0xffd8||bytes.readUInt16BE(bytes.length-2)!==0xffd9)return false;
 const {default:sharp}=await import('sharp');
 try{
  const image=sharp(bytes,{failOn:'warning',limitInputPixels:MAX_PIXELS});
  const {format,width,height}=await image.metadata();
  if(format!==(png?'png':'jpeg')||!(width>0&&height>0&&width<=4096&&height<=4096&&width*height<=MAX_PIXELS))return false;
  await image.raw().toBuffer();
  return true;
 }catch{return false;}
}

// The live host's Cloudflare tunnel connects on loopback and sets the visitor IP.
export function prankAddress(req){
 const peer=req.socket.remoteAddress,forwarded=req.headers['cf-connecting-ip'];
 if((peer==='127.0.0.1'||peer==='::ffff:127.0.0.1'||peer==='::1')&&isIP(forwarded))return forwarded;
 return peer;
}
const discordId=v=>!v.discord?.glyph&&/^\d{5,25}$/.test(v.discord?.discordId||'')?v.discord.discordId:null;
function player(v){const id=discordId(v);return id?`discord:${id}`:`address:${v.address}`;}
const displayName=v=>(v.name||'').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,' ').replace(/[@<>\\`*_~|\[\]()#!]/g,'').trim()||'Voyager';
function webhookTarget(value){
 try{const url=new URL(value);if(url.protocol==='https:'||url.protocol==='http:'){url.searchParams.set('wait','true');return url;}}catch{}
 return null;
}

// The live socket issues a single-use ticket. The photo itself travels over HTTP.
export function createPrankShare({send,allowed,connected,webhook=process.env.LEO_DISCORD_GAMING_WEBHOOK}){
 const target=webhookTarget(webhook),available=!!target,tickets=new Map(),lastBy=new Map(),recent=[],posting=new Set();let busy=0;
 const aboard=v=>v?.ready&&v.ws.readyState===1&&connected(v);
 function limited(key,now){
  while(recent.length&&recent[0]<=now-HOUR_MS)recent.shift();
  for(const [id,at] of lastBy)if(at<=now-PLAYER_MS)lastBy.delete(id);
  return lastBy.has(key)||posting.has(key)||recent.length+posting.size>=PER_HOUR;
 }
 function leave(v){tickets.delete(v.prankTicket);v.prankTicket=null;}
 function ticket(v,{request}){
  if(!Number.isSafeInteger(request))return;
  const reply=extra=>send(v,{m:'prank-ticket',request,...extra});
  if(!available||!aboard(v)){reply({ok:false,why:'unavailable'});return;}
  const now=Date.now();if(limited(player(v),now)){reply({ok:false,why:'slow'});return;}
  leave(v);const token=randomBytes(24).toString('hex');
  tickets.set(token,{v,until:now+TICKET_MS});v.prankTicket=token;
  reply({ok:true,ticket:token});
 }

 async function upload(req,answer){
  const no=(code,why)=>answer(code,{ok:false,why});
  if(!available)return no(503,'unavailable');
  const token=req.headers['x-leo-prank-ticket'],entry=tickets.get(token),v=entry?.v;
  if(!entry)return no(403,'ticket');
  leave(v);
  if(entry.until<=Date.now()||!aboard(v))return no(403,'ticket');
  const key=player(v),type=req.headers['content-type'];
  if(limited(key,Date.now()))return no(429,'slow');
  if(type!=='image/png'&&type!=='image/jpeg')return no(415,'image');
  if(Number(req.headers['content-length'])>MAX_BYTES)return no(413,'large');
  if(busy>=3)return no(503,'busy');
  busy++;
  try{
   const parts=[];let length=0;
   const timer=setTimeout(()=>req.destroy(),10000);
   try{
    for await(const chunk of req.iterator({destroyOnReturn:false})){
     length+=chunk.length;if(length>MAX_BYTES)return no(413,'large');parts.push(chunk);
    }
   }finally{clearTimeout(timer);}
   const bytes=Buffer.concat(parts,length);
   if(!await isPhoto(bytes,type))return no(415,'image');
   if(!aboard(v))return no(403,'ticket');
   const now=Date.now();if(limited(key,now))return no(429,'slow');
   const id=v.discord?.lapsed?null:discordId(v),filename='leo-ha-gottem.'+(type==='image/png'?'png':'jpg');
   const form=new FormData();
   form.set('payload_json',JSON.stringify({content:`Do Not Press the Button souvenir from ${displayName(v)}${id?` (<@${id}>)`:''}.`,
    allowed_mentions:{parse:[],users:id?[id]:[]},flags:4,attachments:[{id:0,filename}]}));
   form.set('files[0]',new Blob([bytes],{type}),filename);
   // Hold both slots while posting. Release them on a confirmed rejection.
   posting.add(key);let result;
   try{result=await fetch(target,{method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(8000)});}
   finally{
    posting.delete(key);
    // Without a reply the post may already have landed.
    if(!result||result.ok){const at=Date.now();lastBy.set(key,at);recent.push(at);}
   }
   await result.body?.cancel().catch(()=>{});
   if(result.status===429)return no(429,'slow');
   if(!result.ok)return no(502,'failed');
   answer(200,{ok:true});
  }finally{busy--;}
 }

 function http(req,res){
  if(req.url!=='/prank-photo')return false;
  const origin=req.headers.origin||'',cors=allowed(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:null;
  const answer=(status,body)=>{if(res.destroyed||res.headersSent)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(req.complete?{}:{Connection:'close'}),...cors});res.end(JSON.stringify(body));};
  if(!cors)answer(403,{ok:false,why:'origin'});
  else if(req.method==='OPTIONS'){res.writeHead(204,{...cors,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type, X-Leo-Prank-Ticket'});res.end();}
  else if(req.method==='POST')upload(req,answer).catch(()=>answer(502,{ok:false,why:'failed'}));
  else answer(405,{ok:false,why:'method'});
  return true;
 }
 return {available,ticket,leave,http};
}
