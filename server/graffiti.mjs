// The graffiti wall's server side (src/walk/graffiti-wall.js, walk/graffiti.js): the one shared wall on the fin root
// casing in Deck 19's aft lift lobby. Leo live (leo-live.mjs) passes the wall's messages here.
//
// Only Discord-verified visitors (a Leo pass from The Creamery) may paint; everyone else can look. A stroke is laid into
// the server's own copy of the wall and passed on to everyone looking at it, so they see it as it is sprayed; strokes
// are limited in leo-live.mjs like every other message. Who painted is written to the log: a line when someone starts,
// and one when they stop (after STOP_MS without a stroke, or on leaving) with how much, in which colours and where, as
// cell ranges across and down, so a drawing can be traced to an account.
//
// The wall is kept in a file beside this checkout (LEO_LIVE_GRAFFITI, default ../../leo-live-graffiti.json), like the
// scores and hearts, so a restart keeps the paint. It is a fixed grid, so the file stays the same size (about 36 KB)
// however much is painted. Nothing wipes it but an admin clear: create the file LEO_LIVE_GRAFFITI_CLEAR (default
// ../../leo-live-graffiti-clear, beside the checkout; `node scripts/graffiti-clear.mjs` does it) and within a couple of seconds
// the wall is cleared for everyone, the clear is logged, and the file is removed again.
import fs from 'node:fs';
import {WALL,readStroke,paintStroke,wallToText,wallFromText} from '../src/walk/graffiti-wall.js';

const here=name=>new URL('../../'+name,import.meta.url);
const STOP_MS=8000;

// `send(v,msg)`, `log(...)`; `files`: {wall, clear} paths (tests pass their own through the environment).
export function createGraffiti({send,log=()=>{},files={},watch=true}={}){
 const FILE=files.wall||process.env.LEO_LIVE_GRAFFITI||here('leo-live-graffiti.json');
 const CLEAR=files.clear||process.env.LEO_LIVE_GRAFFITI_CLEAR||here('leo-live-graffiti-clear');
 let cells=new Uint8Array(WALL.w*WALL.h);
 try{const saved=JSON.parse(fs.readFileSync(FILE,'utf8'));const back=saved?.w===WALL.w&&saved.h===WALL.h?wallFromText(saved.cells):null;
  if(back)cells=back;else log('graffiti wall file not read: wrong size or damaged; starting bare');}catch{}
 // Who is looking at the wall (they asked for it), so strokes go only to them.
 const watching=new Set();
 let saving=null;
 const save=(now=false)=>{
  const write=()=>{saving=null;fs.writeFile(FILE,JSON.stringify({w:WALL.w,h:WALL.h,at:new Date().toISOString(),cells:wallToText(cells)}),e=>{if(e)log('graffiti not saved',e.message);});};
  if(now){clearTimeout(saving);write();return;}if(!saving)saving=setTimeout(write,1000);
 };
 const who=v=>`discord:${v.discord.discordId} ${JSON.stringify(v.name||'')}`;
 // A painter's session so far, logged when they stop.
 function done(v){
  const s=v.painting;if(!s)return;v.painting=null;
  log('graffiti painted',who(v),s.strokes,'strokes',s.cells,'cells','colours',[...s.colours].sort((a,b)=>a-b).join(','),`across ${s.u0}-${s.u1} down ${s.v0}-${s.v1}`,Math.round((s.last-s.at)/1000)+'s');
 }
 const timer=setInterval(()=>{const now=Date.now();for(const v of watching)if(v.painting&&now-v.painting.last>STOP_MS)done(v);},2000);timer.unref?.();

 // The whole wall, for a visitor who comes to look; they hear every stroke from then on.
 function look(v){watching.add(v);send(v,{m:'wall',w:WALL.w,h:WALL.h,verified:!!v.discord,cells:wallToText(cells)});}
 function paint(v,msg,{slow=false}={}){
  if(!v.discord){send(v,{m:'painted',ok:false,why:'sign-in'});return;}
  if(slow){send(v,{m:'painted',ok:false,why:'slow'});return;}
  const stroke=readStroke(msg);if(!stroke)return;
  watching.add(v);
  let s=v.painting;const now=Date.now();
  if(!s){s=v.painting={at:now,last:now,strokes:0,cells:0,colours:new Set(),u0:WALL.w,u1:0,v0:WALL.h,v1:0};log('graffiti painting',who(v));}
  const n=paintStroke(cells,stroke);
  s.last=now;s.strokes++;s.cells+=n;s.colours.add(stroke.c);
  for(let i=0;i<stroke.p.length;i+=2){s.u0=Math.min(s.u0,stroke.p[i]);s.u1=Math.max(s.u1,stroke.p[i]);s.v0=Math.min(s.v0,stroke.p[i+1]);s.v1=Math.max(s.v1,stroke.p[i+1]);}
  if(n)save();
  const out={m:'stroke',id:v.id,c:stroke.c,s:stroke.s,p:stroke.p};
  for(const o of watching)if(o!==v&&o.ready)send(o,out);
 }
 function leave(v){done(v);watching.delete(v);}
 // The admin clear.
 function clear(how){
  cells=new Uint8Array(WALL.w*WALL.h);save(true);
  for(const v of watching)if(v.painting)done(v);
  log('graffiti wall cleared',how);
  for(const v of watching)if(v.ready)send(v,{m:'wall',w:WALL.w,h:WALL.h,verified:!!v.discord,cells:wallToText(cells),cleared:true});
 }
 const checkClear=()=>{if(!fs.existsSync(CLEAR))return;let note='';try{note=fs.readFileSync(CLEAR,'utf8').trim().slice(0,80);}catch{}
  try{fs.rmSync(CLEAR,{force:true});}catch{}clear(`(admin${note?': '+JSON.stringify(note):''})`);};
 if(watch){checkClear();fs.watchFile(CLEAR,{interval:1000},checkClear);}
 return {look,paint,leave,clear,stop(){clearInterval(timer);fs.unwatchFile(CLEAR);},get cells(){return cells;}};
}
