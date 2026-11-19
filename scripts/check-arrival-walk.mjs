// node scripts/check-arrival-walk.mjs [url] [--down 40] [--rtt 40] [--runs 3] [--out file] [--failure] [--live ws://127.0.0.1:<port>/live]
// How soon a visitor walks, with the arrival hall walked first (src/v2/arrival-preview.js) and without it (?arrival=0),
// on the same machine and network: real Chrome (ANGLE, the PC's own GPU), a cold cache, the network throttled through
// DevTools to --down Mbit/s and --rtt ms (0 for none), boarding as a guest with a dead Leo live address (so the page
// neither waits on the name card nor joins the real ship), or with --live a local Leo live server (server/leo-live.mjs). Each run loads the page both ways, one after the other.
// A report only: it fails nothing, and every time in it depends on this PC and what else it was doing.
// Per load it records when the name card showed, when the arrival hall could be walked (body data-arrival) and when
// the whole walk was (body data-ready), and the peak JS heap. In the arrival hall it proves the walk: holds W for 60
// drawn frames and at least a second, and sees the view move, then keeps jumping and heading into a corner until the walk takes over, and
// checks that the walk's first view stands where the hall's last one did (on the ground: a jump ends on its ground),
// and that the visitor never left the hall's box. --failure makes one part of the prepared ship fail to download: the
// failure card must come back over the hall, which must stop.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ANGLE,PLAYWRIGHT_FROM} from './chrome-setup.mjs';
const {chromium}=createRequire(PLAYWRIGHT_FROM)('playwright');
const args=process.argv.slice(2),flag=(n,d)=>{const i=args.indexOf(n);if(i<0)return d;const v=args[i+1];args.splice(i,2);return v;};
const LIVE=flag('--live','ws://127.0.0.1:1/live'),DOWN=Number(flag('--down',40)),RTT=Number(flag('--rtt',40)),RUNS=Number(flag('--runs',1)),failure=args.includes('--failure');if(failure)args.splice(args.indexOf('--failure'),1);
const out=flag('--out','output/arrival-walk/'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
const url=args[0]||'https://leo.marscatsvoyage.com/walk.html',LIMIT=420000,S=ms=>ms==null?null:Math.round(ms/100)/10;
const browser=await chromium.launch({channel:'chrome',args:[...ANGLE,'--enable-gpu','--ignore-gpu-blocklist','--disable-blink-features=AutomationControlled','--enable-precise-memory-info',
 '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function load(early){
 const target=new URL(url);target.searchParams.set('live',LIVE);if(!early)target.searchParams.set('arrival','0');
 const context=await browser.newContext({viewport:{width:1600,height:900}}),r={early,errors:[]};
 // The page keeps its own record: CDP calls wait while a long build holds the page and would miss moments.
 await context.addInitScript(()=>{const w=window.__arrivalCheck={peak:0,frames:0,preview:null,main:null,box:[[1e9,1e9,1e9],[-1e9,-1e9,-1e9]]};
  setInterval(()=>{const h=performance.memory?.usedJSHeapSize||0;if(h>w.peak)w.peak=h;},200);
  const dev=new EventTarget();window.__THREE_DEVTOOLS__=dev;dev.addEventListener('observe',e=>{const o=e.detail;if(!o?.isWebGLRenderer||w.renderer)return;w.renderer=o;const render=o.render.bind(o);
   o.render=(scene,camera)=>{render(scene,camera);if(scene.getObjectByName?.('Arrival_preview')){w.frames++;w.preview=camera.position.toArray();for(let k=0;k<3;k++){w.box[0][k]=Math.min(w.box[0][k],w.preview[k]);w.box[1][k]=Math.max(w.box[1][k],w.preview[k]);}}
    else if(scene.children.length>20&&!scene.isFog)w.main=camera.position.toArray();};});
  new MutationObserver(()=>{const b=document.body;if(!b)return;if(b.dataset.arrival==='1'&&!w.arrival)w.arrival=performance.now();if(b.dataset.ready==='1'&&!w.ready){w.ready=performance.now();w.previewAtReady=w.preview;}}).observe(document,{attributes:true,subtree:true,attributeFilter:['data-arrival','data-ready']});});
 const page=await context.newPage(),cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 if(DOWN>0)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:RTT,downloadThroughput:DOWN*1e6/8,uploadThroughput:10e6/8});
 if(failure)await page.route(/\/prepared-walk\/[^/]+\/geometry-5\.bin/,route=>route.fulfill({status:404,body:'missing'}));
 page.on('pageerror',e=>r.errors.push(e.message.slice(0,200)));page.on('console',m=>{if(/arrival hall/i.test(m.text()))(r.notes??=[]).push(m.text().slice(0,200));});page.on('crash',()=>r.errors.push('Page crashed'));
 const state=()=>page.evaluate(()=>{const w=window.__arrivalCheck,b=document.body,g=document.getElementById('who-guest'),loading=document.getElementById('loading');
  return {now:performance.now(),guest:!!g&&!g.hidden&&getComputedStyle(loading).display!=='none',arrival:w.arrival??null,ready:w.ready??null,frames:w.frames,preview:w.preview,failed:b.dataset.failed||null,
   cardShown:loading&&getComputedStyle(loading).display!=='none',walking:b.dataset.arrival==='1'};}).catch(()=>null);
 const t0=Date.now();await page.goto(target.href,{waitUntil:'domcontentloaded'});
 let boarded=false,phase='wait',from=null,framesFrom=0,forwardAt=0,keys=[];const press=async k=>{await page.keyboard.down(k);keys.push(k);},lift=async()=>{for(const k of keys.splice(0))await page.keyboard.up(k);};
 while(Date.now()-t0<LIMIT&&!r.errors.includes('Page crashed')){
  await sleep(150);const s=await state();if(!s)continue;
  if(s.guest&&!boarded){boarded=true;r.nameCardS=S(s.now);await page.evaluate(()=>document.getElementById('who-guest').requestSubmit());}
  if(s.ready){r.walkableS=S(s.ready);break;}
  if(failure&&s.failed){r.failedS=S(s.now);await sleep(1500);break;}
  if(!s.walking)continue;
  r.arrivalS??=S(s.arrival);
  if(phase==='wait'){phase='forward';from=s.preview;framesFrom=s.frames;forwardAt=Date.now();await page.mouse.move(800,450);await press('KeyW');}
  else if(phase==='forward'&&s.frames-framesFrom>=60&&Date.now()-forwardAt>=1000){await lift();const moved=Math.hypot(s.preview[0]-from[0],s.preview[2]-from[2]);r.movedM=+moved.toFixed(2);r.movedS=S(s.now);phase='roam';
   // Into the hall's far corner, jumping now and then, until the walk takes over.
   await press('KeyW');await press('KeyD');await press('ShiftLeft');}
  else if(phase==='roam'){await page.keyboard.press('Space');}
 }
 await lift();
 if(r.walkableS!==undefined)await sleep(3000);
 const end=await page.evaluate(()=>{const w=window.__arrivalCheck,loading=document.getElementById('loading');return {status:document.querySelector('.top')?.innerText.replace(/\s+/g,' ').slice(0,160)||null,peak:w.peak,heap:performance.memory?.usedJSHeapSize||0,preview:w.previewAtReady,main:w.main,box:w.box,frames:w.frames,
  failed:document.body.dataset.failed||null,cardShown:getComputedStyle(loading).display!=='none'&&getComputedStyle(loading).opacity!=='0',walking:document.body.dataset.arrival==='1'};}).catch(()=>null);
 if(end){r.statusLine=end.status;r.peakHeapMB=Math.round(end.peak/1e6);r.settledHeapMB=Math.round(end.heap/1e6);r.previewFrames=end.frames;
  if(early&&end.preview&&end.main){r.handOverM=+Math.hypot(end.main[0]-end.preview[0],end.main[2]-end.preview[2]).toFixed(2);r.handOverDropM=+(end.preview[1]-end.main[1]).toFixed(2);}
  if(early&&end.frames)r.previewSpan={min:end.box[0].map(v=>+v.toFixed(1)),max:end.box[1].map(v=>+v.toFixed(1))};
  if(failure)Object.assign(r,{failureCard:end.cardShown&&!!end.failed,previewStopped:!end.walking});}
 await context.close();return r;
}

const report={url,at:new Date().toISOString(),network:DOWN>0?`${DOWN} Mbit/s, ${RTT} ms`:'unthrottled',failure,runs:[]};
for(let i=0;i<RUNS;i++){const run={};for(const early of i%2?[false,true]:[true,false])run[early?'arrival':'control']=await load(early);report.runs.push(run);
 const a=run.arrival,c=run.control;console.log(`run ${i+1}: arrival hall walkable ${a.arrivalS??'-'} s (moved ${a.movedM??'-'} m by ${a.movedS??'-'} s), whole walk ${a.walkableS??'-'} s, hand-over ${a.handOverM??'-'} m, peak ${a.peakHeapMB} MB`+
  ` | ?arrival=0: whole walk ${c.walkableS??'-'} s, peak ${c.peakHeapMB} MB${failure?` | failure card ${a.failureCard}, hall stopped ${a.previewStopped}`:''}${[...a.errors,...c.errors].length?' | errors: '+[...a.errors,...c.errors].join(' | '):''}`);}
const median=k=>side=>{const v=report.runs.map(r=>r[side][k]).filter(Number.isFinite).sort((x,y)=>x-y);return v.length?v[v.length>>1]:null;};
report.median={arrivalWalkS:median('arrivalS')('arrival'),wholeWalkS:median('walkableS')('arrival'),controlWholeWalkS:median('walkableS')('control'),peakHeapMB:median('peakHeapMB')('arrival'),controlPeakHeapMB:median('peakHeapMB')('control')};
console.log('median:',JSON.stringify(report.median));
await browser.close();
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,1));console.log('Report: '+out);
