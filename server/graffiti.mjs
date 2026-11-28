// Keep the stern's painted sections in the existing graffiti store. A legacy file is placed on the stern on load.
import fs from 'node:fs';
import {LEGACY,WALL,sectionId,readStroke,paintStroke,sectionToText,sectionFromText,migrateLegacy} from '../src/walk/graffiti-wall.js';

const here=name=>new URL('../../'+name,import.meta.url);
const STOP_MS=8000;

export function createGraffiti({send,log=()=>{},files={},watch=true}={}){
 const FILE=files.wall||process.env.LEO_LIVE_GRAFFITI||here('leo-live-graffiti.json');
 const CLEAR=files.clear||process.env.LEO_LIVE_GRAFFITI_CLEAR||here('leo-live-graffiti-clear');
 const TEMP=FILE instanceof URL?new URL(FILE.href+'.tmp'):FILE+'.tmp';
 const sections=new Map(),encoded=new Map();
 try{
  const saved=JSON.parse(fs.readFileSync(FILE,'utf8'));
  if(saved.version===2&&saved.sections&&typeof saved.sections==='object'){
   for(const [key,text] of Object.entries(saved.sections)){
    const id=Number(key),cells=sectionId(id)&&sectionFromText(text);
    if(cells&&cells.some(c=>c))sections.set(id,cells);
   }
  }else{
   const cells=migrateLegacy(saved);
   if(cells?.some(c=>c))sections.set(LEGACY.section,cells);
   else if(!cells)log('graffiti wall file not read: wrong size or damaged; starting bare');
  }
 }catch(e){if(e.code!=='ENOENT')log('graffiti wall file not read:',e.message);}
 const textFor=(id,cells)=>{
  if(!encoded.has(id))encoded.set(id,sectionToText(cells));
  return encoded.get(id);
 };
 const watching=new Set(),painters=new Set();
 let saving=null,writes=Promise.resolve();
 const save=(now=false)=>{
  const write=()=>{
   saving=null;
   const data=JSON.stringify({version:2,sections:Object.fromEntries([...sections].map(([id,cells])=>[id,textFor(id,cells)]))});
   writes=writes.then(async()=>{await fs.promises.writeFile(TEMP,data);await fs.promises.rename(TEMP,FILE);})
    .catch(e=>log('graffiti not saved',e.message));
  };
  if(now){clearTimeout(saving);write();return;}if(!saving)saving=setTimeout(write,1000);
 };
 const who=v=>`discord:${v.discord.discordId} ${JSON.stringify(v.name||'')}`;
 function done(v){
  const s=v.painting;if(!s)return;v.painting=null;painters.delete(v);
  log('graffiti painted',who(v),s.strokes,'strokes',s.cells,'cells','colours',[...s.colours].sort((a,b)=>a-b).join(','),`across ${s.u0}-${s.u1} down ${s.v0}-${s.v1}`,Math.round((s.last-s.at)/1000)+'s');
 }
 const timer=setInterval(()=>{const now=Date.now();for(const v of painters)if(now-v.painting.last>STOP_MS)done(v);},2000);timer.unref?.();

 // Empty sections are implicit. A viewer in sight receives the painted sections and their subsequent strokes.
 function look(v,msg){
  if(msg?.look===false){watching.delete(v);done(v);return;}
  if(msg?.look!==true)return;
  watching.add(v);
  for(const [section,cells] of sections)send(v,{m:'wall',section,cells:textFor(section,cells)});
  send(v,{m:'wall',ready:true});
 }
 function paint(v,msg,{slow=false}={}){
  if(!v.discord){send(v,{m:'painted',ok:false,why:'sign-in'});return;}
  if(slow){send(v,{m:'painted',ok:false,why:'slow'});return;}
  if(!watching.has(v)){send(v,{m:'painted',ok:false,why:'closed'});return;}
  const stroke=readStroke(msg);if(!stroke)return;
  let s=v.painting;const now=Date.now();
  if(!s){s=v.painting={at:now,last:now,strokes:0,cells:0,colours:new Set(),u0:WALL.w,u1:0,v0:WALL.h,v1:0};painters.add(v);log('graffiti painting',who(v));}
  const n=paintStroke(sections,stroke,id=>encoded.delete(id));
  s.last=now;s.strokes++;s.cells+=n;s.colours.add(stroke.c);
  for(let i=0;i<stroke.p.length;i+=2){s.u0=Math.min(s.u0,stroke.p[i]);s.u1=Math.max(s.u1,stroke.p[i]);s.v0=Math.min(s.v0,stroke.p[i+1]);s.v1=Math.max(s.v1,stroke.p[i+1]);}
  if(n)save();
  // Echo the server's order to the painter too, so simultaneous paint over the same spot converges.
  const out={m:'stroke',id:v.id,...stroke};
  for(const o of watching)if(o.ready&&(n||o===v))send(o,out);
 }
 function leave(v){done(v);watching.delete(v);}
 function clear(how){
  sections.clear();encoded.clear();save(true);
  for(const v of painters)done(v);
  log('graffiti wall cleared',how);
  for(const v of watching)if(v.ready)send(v,{m:'wall',cleared:true});
 }
 const checkClear=()=>{if(!fs.existsSync(CLEAR))return;let note='';try{note=fs.readFileSync(CLEAR,'utf8').trim().slice(0,80);}catch{}
  try{fs.rmSync(CLEAR,{force:true});}catch{}clear(`(admin${note?': '+JSON.stringify(note):''})`);};
 if(watch){checkClear();fs.watchFile(CLEAR,{interval:1000},checkClear);}
 return {look,paint,leave,clear,stop(){clearInterval(timer);clearTimeout(saving);fs.unwatchFile(CLEAR,checkClear);}};
}
