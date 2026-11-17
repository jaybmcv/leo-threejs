// Shared stern paint tiles. The original fixed-size wall file migrates intact into the middle tile.
import fs from 'node:fs';
import {WALL,readTile,readStroke,paintStroke,wallToText,wallFromText} from '../src/walk/graffiti-wall.js';
const here=name=>new URL('../../'+name,import.meta.url),STOP_MS=8000;
export function createGraffiti({send,log=()=>{},files={},watch=true}={}){
 const FILE=files.wall||process.env.LEO_LIVE_GRAFFITI||here('leo-live-graffiti.json'),CLEAR=files.clear||process.env.LEO_LIVE_GRAFFITI_CLEAR||here('leo-live-graffiti-clear');
 const tiles=new Map(),watching=new Map();let saving=null;
 try{
  const saved=JSON.parse(fs.readFileSync(FILE,'utf8'));
  if(saved.w===WALL.w&&saved.h===WALL.h){
   if(saved.version===2){for(const [id,text] of Object.entries(saved.tiles||{})){const back=readTile(id)&&wallFromText(text);if(back)tiles.set(id,back);}}
   else{const back=wallFromText(saved.cells);if(back)tiles.set('legacy',back);else log('graffiti wall file not read: wrong size or damaged; starting bare');}
  }else log('graffiti wall file not read: wrong size or damaged; starting bare');
 }catch{}
 const blank=()=>new Uint8Array(WALL.w*WALL.h);
 const save=(now=false)=>{
  const write=()=>{saving=null;fs.writeFileSync(FILE,JSON.stringify({version:2,w:WALL.w,h:WALL.h,at:new Date().toISOString(),tiles:Object.fromEntries([...tiles].map(([id,cells])=>[id,wallToText(cells)]))}));};
  if(now){clearTimeout(saving);write();return;}if(!saving)saving=setTimeout(()=>{try{write();}catch(e){log('graffiti not saved',e.message);}},1000);
 };
 const who=v=>`discord:${v.discord.discordId} ${JSON.stringify(v.name||'')}`;
 function done(v){const s=v.painting;if(!s)return;v.painting=null;
  log('graffiti painted',who(v),s.strokes,'strokes',s.cells,'cells','colours',[...s.colours].sort((a,b)=>a-b).join(','),`across ${s.u0}-${s.u1} down ${s.v0}-${s.v1}`,'tiles',[...s.tiles].join(','),Math.round((s.last-s.at)/1000)+'s');
 }
 const timer=setInterval(()=>{const now=Date.now();for(const v of watching.keys())if(v.painting&&now-v.painting.last>STOP_MS)done(v);},2000);timer.unref?.();
 function snapshot(v,id,extra={}){send(v,{m:'wall',tile:id,w:WALL.w,h:WALL.h,verified:!!v.discord,cells:tiles.has(id)?wallToText(tiles.get(id)):'',...extra});}
 function look(v,msg={}){
  const ids=msg.tiles===undefined?[readTile(msg.tile)]:Array.isArray(msg.tiles)&&msg.tiles.length<=24?msg.tiles.map(readTile):[];
  if(!ids.length||ids.some(id=>!id))return;
  let seen=watching.get(v)||new Set();
  if(Array.isArray(msg.keep)&&msg.keep.length<=36&&msg.keep.every(id=>readTile(id)))seen=new Set(msg.keep);
  for(const id of ids){if(seen.size>=36&&!seen.has(id))continue;seen.add(id);snapshot(v,id);}watching.set(v,seen);
 }
 function paint(v,msg,{slow=false}={}){
  const id=readTile(msg.tile);if(!id)return;
  if(!v.discord){send(v,{m:'painted',tile:id,ok:false,why:'sign-in'});return;}
  if(slow){send(v,{m:'painted',tile:id,ok:false,why:'slow'});return;}
  const stroke=readStroke(msg);if(!stroke)return;
  let seen=watching.get(v);if(!seen)watching.set(v,seen=new Set());if(seen.size<36)seen.add(id);
  let cells=tiles.get(id);if(!cells)tiles.set(id,cells=blank());
  let s=v.painting;const now=Date.now();
  if(!s){s=v.painting={at:now,last:now,strokes:0,cells:0,colours:new Set(),tiles:new Set(),u0:WALL.w,u1:0,v0:WALL.h,v1:0};log('graffiti painting',who(v));}
  const n=paintStroke(cells,stroke);s.last=now;s.strokes++;s.cells+=n;s.colours.add(stroke.c);s.tiles.add(id);
  for(let i=0;i<stroke.p.length;i+=2){s.u0=Math.min(s.u0,stroke.p[i]);s.u1=Math.max(s.u1,stroke.p[i]);s.v0=Math.min(s.v0,stroke.p[i+1]);s.v1=Math.max(s.v1,stroke.p[i+1]);}
  if(n)save();const out={m:'stroke',tile:id,id:v.id,c:stroke.c,s:stroke.s,p:stroke.p};
  for(const [o,ids] of watching)if(o!==v&&o.ready&&ids.has(id))send(o,out);
 }
 function leave(v){done(v);watching.delete(v);}
 function clear(how){
  tiles.clear();save(true);for(const v of watching.keys())if(v.painting)done(v);log('graffiti wall cleared',how);
  for(const [v,ids] of watching)if(v.ready)for(const id of ids)snapshot(v,id,{cleared:true});
 }
 const checkClear=()=>{if(!fs.existsSync(CLEAR))return;let note='';try{note=fs.readFileSync(CLEAR,'utf8').trim().slice(0,80);}catch{}
  try{fs.rmSync(CLEAR,{force:true});}catch{}clear(`(admin${note?': '+JSON.stringify(note):''})`);};
 if(watch){checkClear();fs.watchFile(CLEAR,{interval:1000},checkClear);}
 return {look,paint,leave,clear,stop(){clearInterval(timer);fs.unwatchFile(CLEAR);if(saving){try{save(true);}catch(e){log('graffiti not saved',e.message);}}},get cells(){return tiles.get('legacy')||blank();}};
}
