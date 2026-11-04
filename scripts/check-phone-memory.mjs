// node scripts/check-phone-memory.mjs [url] [--out file] [--no-board]
// Loads walk.html as a phone would (390×844, DPR 3, touch, Android Chrome; cold cache) until the walk can be walked,
// and reports the download, peak JS heap and time. A report only: it fails nothing, and it is desktop Chrome on this
// PC, so it has a phone's screen and input but not its memory, GPU or Safari (PHONE_WALK.md).
// It chooses Try anyway on the start card and Come aboard as a guest (--no-board stops at the name card instead, which
// shows while the ship is still loading).
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/henri/code/feedback-inbox-timers/build/package.json')('playwright');
const args=process.argv.slice(2),flag=n=>{const i=args.indexOf(n);if(i<0)return null;const v=args[i+1];args.splice(i,2);return v;};
const board=!args.includes('--no-board');if(!board)args.splice(args.indexOf('--no-board'),1);
const out=flag('--out')||'output/phone-memory/'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
const url=args[0]||'https://leo.marscatsvoyage.com/walk.html',LIMIT=300000,MB=n=>Math.round(n/1e5)/10;
const report={status:'FAIL',url,at:new Date().toISOString(),phone:'390x844 DPR 3, touch, Android Chrome user agent, cold cache',downloadMB:0,peakHeapMB:0,stages:[],errors:[]};
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-blink-features=AutomationControlled','--enable-precise-memory-info']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});
 // The page samples its own heap as well: CDP calls wait while a long decode holds the page, and would miss its peak.
 await context.addInitScript(()=>{const t0=performance.now();window.__phone={peak:0,stages:[]};
  setInterval(()=>{const h=performance.memory?.usedJSHeapSize||0;if(h>window.__phone.peak)window.__phone.peak=h;},200);
  addEventListener('DOMContentLoaded',()=>{const text=document.getElementById('loading-text');if(!text)return;
   new MutationObserver(()=>{const s=window.__phone.stages,line=text.textContent.trim();const at=Math.round(performance.now()-t0),bare=x=>x.replace(/[\d%\s]+$/,'');if(!line||s.at(-1)?.[1]===line)return;if(s.length&&bare(s.at(-1)[1])===bare(line))s.at(-1)[1]=line;else s.push([at,line]);}).observe(text,{childList:true,characterData:true,subtree:true});});});
 const page=await context.newPage(),cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Performance.enable');
 let bytes=0,cdpPeak=0;cdp.on('Network.loadingFinished',e=>{bytes+=e.encodedDataLength||0;});
 const sampler=setInterval(()=>cdp.send('Performance.getMetrics').then(r=>{const h=r.metrics.find(m=>m.name==='JSHeapUsedSize')?.value||0;if(h>cdpPeak)cdpPeak=h;}).catch(()=>{}),500);
 page.on('pageerror',e=>report.errors.push(e.message.slice(0,300)));page.on('crash',()=>report.errors.push('Page crashed'));
 const t0=Date.now(),seconds=()=>Math.round((Date.now()-t0)/100)/10,state=()=>page.evaluate(()=>({card:document.getElementById('memory')?.hidden===false,
  text:document.getElementById('loading-text')?.textContent||'',guest:!!document.getElementById('who-guest')&&!document.getElementById('who-guest').hidden,ready:document.body.dataset.ready==='1'})).catch(()=>null);
 await page.goto(url,{waitUntil:'domcontentloaded'});
 if((await state())?.card){report.card=true;await page.click('#memory-try');}
 for(let boarded=false;Date.now()-t0<LIMIT&&!report.errors.includes('Page crashed');){
  await new Promise(r=>setTimeout(r,500));const s=await state();if(!s)continue;
  if(s.ready){report.walkableS=seconds();break;}
  if(s.guest&&!boarded){report.nameCardS??=seconds();if(!board)break;boarded=true;await page.click('#who-board').catch(e=>report.errors.push('Come aboard: '+e.message.slice(0,120)));}
 }
 if(report.walkableS!==undefined)await new Promise(r=>setTimeout(r,3000));
 clearInterval(sampler);
 const page2=await page.evaluate(()=>({peak:window.__phone.peak,now:performance.memory?.usedJSHeapSize||0,stages:window.__phone.stages,bundle:[...document.scripts].map(s=>s.src).find(s=>/walk\.[0-9a-f]+\.js/.test(s))||null})).catch(()=>null);
 Object.assign(report,{downloadMB:MB(bytes),peakHeapMB:MB(Math.max(cdpPeak,page2?.peak||0)),settledHeapMB:page2?MB(page2.now):null,stages:page2?.stages||[],bundle:page2?.bundle?.split('/').pop()||null});
 report.status=report.walkableS!==undefined||(!board&&report.nameCardS!==undefined)?'MEASURED':'DID NOT FINISH';
}catch(e){report.errors.push(e.message.slice(0,300));}
finally{await browser.close();}
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2));
console.log(`Phone walk ${report.status}: ${report.downloadMB} MB down, ${report.peakHeapMB} MB peak JS heap, `+
 `name card ${report.nameCardS??'-'} s, walkable ${report.walkableS??'-'} s${report.card?' (start card shown)':''}${report.errors.length?', errors: '+report.errors.join(' | '):''}`);
console.log('Report: '+out);
