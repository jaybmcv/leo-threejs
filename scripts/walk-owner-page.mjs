// The owner bake's browser side, shared by scripts/walk-owner-bake.mjs (the full bake) and scripts/walk-owner-carry.mjs
// (a bake carried to a later build): a built walk served and opened with ?ownerBake in headless Chromes, and its page
// script (scripts/walk-owner-bake.page.js) bundled and installed.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import WebSocket from 'ws';
import {build as bundle} from './native-bundle.mjs';
// The bake is for discrete desktop GPUs' piece size (src/v2/desk-piece.js), whatever GPU bakes it: its key holds the size.
import {DESK_PIECE} from '../src/v2/desk-piece.js';
import {ANGLE} from './chrome-setup.mjs';

const EV_TIMEOUT_MS=10*60e3,sleep=ms=>new Promise(r=>setTimeout(r,ms));

/** The bake page script, and its identity: the sha256 of the bundle, which holds the proof's rules (src/v2/owner-proof.js),
 * the scene's reading (walk-owner-bake.scene.js) and the walk's own hiding (src/v2/owner-hiding.js). A carry needs the
 * same identity as the bake it carries. */
export async function pageScript(){
 const text=(await bundle({entryPoints:['scripts/walk-owner-bake.page.js'],bundle:true,minify:true,format:'iife',write:false,target:'es2022'})).outputFiles[0].text;
 return {text,code:createHash('sha256').update(text).digest('hex')};
}

/** The walk: its page URL, script name and (--site) directory. `site`: a built site directory, served here; else `tag`, a
 * debug build on scripts/walk-frame-serve.mjs at `port`. */
export async function walkPage({site=null,tag=null,port=4221}){
 if(site){
  const dir=path.resolve(site),types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.bin':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.mp4':'video/mp4','.wasm':'application/wasm','.gz':'application/gzip','.ktx2':'image/ktx2'};
  const server=http.createServer(async(q,s)=>{try{const p=path.join(dir,decodeURIComponent(new URL(q.url,'http://x').pathname));if(!p.startsWith(dir))throw Error('outside');const body=await fs.readFile(p);s.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});s.end(body);}catch{s.writeHead(404);s.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));process.on('exit',()=>server.close());
  const html=await fs.readFile(path.join(dir,'walk.html'),'utf8');return {url:`http://127.0.0.1:${server.address().port}/walk.html`,script:/LEO_WALK_BOOT\("([^"]+)"\)/.exec(html)?.[1],dir};
 }
 const origin='http://127.0.0.1:'+port,html=await fetch(`${origin}/${tag}/walk.html`).then(r=>r.text());
 return {url:`${origin}/${tag}/walk.html`,script:/LEO_WALK_BOOT\("([^"]+)"\)|src="\.?\/?(walk\.[0-9a-z]+\.js)"/.exec(html)?.slice(1).find(Boolean),dir:null};
}

// Chrome number n on its own CDP port, with a profile of its own; killed when the process ends.
const chromes=new Set();process.on('exit',()=>{for(const c of chromes)c.kill();});
async function browser(n,{cdp,chrome}){
 const port=cdp+n,profile=path.resolve('output/perf-walk/chrome-profile-owner-'+port);await fs.rm(profile,{recursive:true,force:true,maxRetries:20,retryDelay:250});await fs.mkdir(profile,{recursive:true});
 const child=spawn(chrome,['--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-extensions','--headless=new',...ANGLE,'--enable-gpu','--ignore-gpu-blocklist',
  '--disable-background-timer-throttling','--disable-renderer-backgrounding','--js-flags=--max-old-space-size=8192','--window-size=1920,1080','about:blank'],{stdio:'ignore'});
 chromes.add(child);child.once('exit',()=>chromes.delete(child));
 for(let i=0;i<80;i++){try{await fetch('http://127.0.0.1:'+port+'/json/version');break;}catch{await sleep(250);}}
 const tab=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json()),socket=new WebSocket(tab.webSocketDebuggerUrl,{maxPayload:1<<30});
 await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});let id=0;const pending=new Map();
 socket.on('message',raw=>{const m=JSON.parse(raw);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}});
 socket.on('close',()=>{for(const p of pending.values())p.reject(Error('The page connection closed'));pending.clear();});
 const send=(method,params={})=>new Promise((resolve,reject)=>{if(socket.readyState!==WebSocket.OPEN)return reject(Error('The page connection is closed'));const k=++id;pending.set(k,{resolve,reject});socket.send(JSON.stringify({id:k,method,params}));});
 const ev=async expression=>{let timer;const late=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The page did not answer within '+EV_TIMEOUT_MS/1000+' s')),EV_TIMEOUT_MS);});
  const r=await Promise.race([send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}),late]).finally(()=>clearTimeout(timer));if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Runtime.enable');await send('Page.enable');
 return {ev,send,close(){socket.close();child.kill();}};
}

/** Page n with the walk up and the bake page script (pageScript().text) installed: {ev, send, close}. `cdp`: the first
 * Chrome's debugging port; `chrome`: its executable. */
export async function openPage(n,walk,script,{cdp=9348,chrome='C:/Program Files/Google/Chrome/Application/chrome.exe'}={}){
 const page=await browser(n,{cdp,chrome}),url=new URL(walk.url);
 // Board through the public build's guest form, with authentication and multiplayer kept local.
 url.search=new URLSearchParams({lv:'2',view:'first',halloween:'0',ownerBake:'',deskpiece:DESK_PIECE.discrete,live:'ws://127.0.0.1:1/live',creamery:'http://127.0.0.1:1'});
 await page.send('Page.navigate',{url:url.href});
 const until=Date.now()+10*60e3;
 let state;
 for(;;){
  if(Date.now()>until)throw Error(`The walk did not come up within 10 minutes on page ${n}: ${JSON.stringify(state)}`);
  try{
   state=await page.ev(`(()=>{
    const form=document.getElementById('who-guest');
    if(form?.getClientRects().length)form.requestSubmit();
    return {ready:document.body?.dataset.ready==='1',host:!!globalThis.__ownerBakeHost,
     stage:document.getElementById('loading-text')?.textContent,failed:document.body?.dataset.failed};
   })()`);
  }catch(e){if(!/execution context was destroyed|cannot find context/i.test(e.message))throw e;}
  if(state?.failed)throw Error(`Walk startup failed on page ${n}: ${state.failed} (${state.stage})`);
  if(state?.ready&&state.host)break;
  await sleep(500);
 }
 console.log(`owner bake: page ${n} ready`);
 await page.ev(script);return page;
}
