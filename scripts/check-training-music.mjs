import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {build} from 'esbuild';

// The Deck 16 gaming lounge's room loop (src/walk/training-sound.js), measured in headless Chrome: the score is rendered through an
// OfflineAudioContext with the real voices and echo, across the whole loop and into its second pass, to measure level, clipping, gaps and
// the loop boundary. How it follows the walker (fades, silence outside, Sound button, no stacked loops) is played in the walk itself.
const dir=path.resolve('.qa/training-music');await fs.mkdir(dir,{recursive:true});
const entry=`import {NOTES,voice,MASTER,BEAT,LOOP} from ${JSON.stringify(path.resolve('src/walk/training-sound.js').replace(/\\/g,'/'))};
const SR=44100,LEAD=.1;
async function render(){
 const tail=6,length=2*LOOP*BEAT+tail+LEAD,ctx=new OfflineAudioContext(2,Math.ceil(SR*length),SR),out=ctx.createGain(),send=ctx.createGain(),master=ctx.createGain();
 master.gain.value=MASTER;master.connect(ctx.destination);out.connect(master);send.gain.value=.5;
 const echo=ctx.createDelay(2),back=ctx.createGain(),tone=ctx.createBiquadFilter(),wet=ctx.createGain();echo.delayTime.value=BEAT*.75;back.gain.value=.38;tone.type='lowpass';tone.frequency.value=2200;wet.gain.value=.5;
 send.connect(echo);echo.connect(tone);tone.connect(back);back.connect(echo);tone.connect(wet);wet.connect(out);
 const nb=ctx.createBuffer(1,Math.floor(SR*.5),SR),d=nb.getChannelData(0);let s=12345;for(let i=0;i<d.length;i++){s=(s*16807)%2147483647;d[i]=s/1073741823-1;}
 const count={live:0};let n=0;for(const pass of [0,1])for(const e of NOTES){voice(ctx,out,send,nb,LEAD+(pass*LOOP+e.at)*BEAT,e,count);n++;}
 const buf=await ctx.startRendering(),l=buf.getChannelData(0),boundary=LEAD+LOOP*BEAT;
 const rms=(from,to)=>{let q=0,c=0;for(let i=Math.floor(from*SR);i<Math.min(l.length,Math.floor(to*SR));i++){q+=l[i]*l[i];c++;}return Math.sqrt(q/Math.max(1,c));};
 const step=(from,to)=>{let m=0;for(let i=Math.max(1,Math.floor(from*SR));i<Math.min(l.length,Math.floor(to*SR));i++)m=Math.max(m,Math.abs(l[i]-l[i-1]));return m;};
 let peak=0,clipped=0;for(const x of l){const a=Math.abs(x);if(a>peak)peak=a;if(a>=.99)clipped++;}
 const beats=[];for(let t=LEAD+2;t<boundary+tail-BEAT;t+=BEAT)beats.push(rms(t,t+BEAT));
 return {voices:n,peak,clipped,beats:beats.length,quietest:Math.min(...beats),mean:beats.reduce((a,b)=>a+b,0)/beats.length,
  stepAll:step(LEAD,boundary+tail),stepBoundary:step(boundary-.5,boundary+.5),boundaryRms:rms(boundary-1,boundary+1),loopRms:rms(LEAD,boundary),
  around:[-2,-1,0,1].map(o=>rms(boundary+o,boundary+o+1)),live:count.live,seconds:LOOP*BEAT,
  inLoop:NOTES.every(e=>Number.isFinite(e.at)&&e.at>=0&&e.at<LOOP),kinds:[...new Set(NOTES.map(e=>e.kind))].sort().join(' '),
  firstBass:NOTES.find(e=>e.kind==='bass').m,lastLead:NOTES.filter(e=>e.kind==='lead').pop().m,firstPad:NOTES.find(e=>e.kind==='pad').m};
}
window.runMusic=async()=>({render:await render(),master:MASTER});`;
const out=await build({stdin:{contents:entry,resolveDir:path.resolve('src/walk'),loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',nodePaths:[path.resolve('node_modules')],logLevel:'error'});
const code=out.outputFiles[0].text;await fs.writeFile(path.join(dir,'music-page.js'),code);

// Chrome is driven over its DevTools socket with the project's own ws package, as scripts/check-lounge-music.mjs does. No browser means a failed check, never a skipped one.
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),profile=await fs.mkdtemp(path.join(dir,'chrome-'));let child,socket;
try{
 child=spawn(process.env.LEO_CHROME_EXE||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--no-sandbox','--disable-gpu-sandbox','--autoplay-policy=no-user-gesture-required','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let launchError;child.once('error',e=>{launchError=e;});
 let port;for(let i=0;i<150;i++){if(launchError)throw Error('Chrome could not start (set LEO_CHROME_EXE): '+launchError.message);try{port=Number((await fs.readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0]);if(port)break;}catch{}await sleep(100);}
 if(!port)throw Error('Chrome did not start; the room loop was not measured');
 const target=(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(t=>t.type==='page');if(!target)throw Error('Chrome opened no page');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});
 const pending=new Map();let id=0;socket.on('message',raw=>{const e=JSON.parse(raw),p=e.id&&pending.get(e.id);if(p){pending.delete(e.id);e.error?p.reject(Error(JSON.stringify(e.error))):p.resolve(e.result);}});
 const send=(method,params)=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,timeout:240000});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 let r;const errors=[];try{await run(code);r=await run('window.runMusic()');}catch(e){errors.push(String(e));}
 if(!r)throw Error('the room loop was not measured: '+errors.join('; '));
 const {render:a,master}=r,db=x=>x>0?(20*Math.log10(x)).toFixed(1)+' dBFS':'silent';
 console.log(`loop ${a.seconds.toFixed(1)} s, ${a.voices} voices over two passes; kinds: ${a.kinds}`);
 console.log(`render: peak ${a.peak.toFixed(4)} (${db(a.peak)}), clipped ${a.clipped}, quietest beat rms ${a.quietest.toExponential(2)}, mean ${a.mean.toExponential(2)} (${db(a.mean)}), largest sample step ${a.stepAll.toExponential(2)}, within 0.5 s of the boundary ${a.stepBoundary.toExponential(2)}`);
 console.log('one-second rms from 2 s before the boundary',a.around.map(x=>x.toExponential(2)).join(' '),'| 2 s round it',a.boundaryRms.toExponential(2),'| whole loop',a.loopRms.toExponential(2),'| voices still alive after the render',a.live);
 const checks=[],ok=(name,pass)=>{checks.push({name,pass});console.log(`${pass?'PASS':'FAIL'} ${name}`);};
 ok('no page errors',errors.length===0);
 ok('the loop is long enough not to grate, and every note falls inside it',a.seconds>=40&&a.inLoop);
 ok('only soft tones: pad, bass, lead, pulse and ticks, no other voices',a.kinds==='bass lead pad pulse tick');
 ok('the loop starts on its tonic (A) and ends its melody on a note of the opening chord',a.firstBass%12===9&&[0,4,9,11].includes(a.lastLead%12)&&a.firstPad%12===9);
 ok('playback is continuous: no beat of the two passes, including the boundary, is silent',a.quietest>5e-4);
 ok('no clipping, and well under the game effects: peak below 0.1 at the track\'s own volume',a.clipped===0&&a.peak<.1);
 ok('the room loop is quiet: mean level below -35 dBFS',a.mean<.0178);
 ok('the loop boundary has no click: the largest sample step within 0.5 s of it, and in the whole render, stays small',a.stepBoundary<.02&&a.stepAll<.02);
 ok('the loop boundary is no quieter than half the loop average',a.boundaryRms>.5*a.loopRms);
 ok('every voice stops itself',a.live===0);
 ok('the track\'s own volume is a single constant below the game effects (0.3)',master<.3);
 await fs.writeFile(path.join(dir,'music-report.json'),JSON.stringify({a,master},null,1));
 const failed=checks.filter(c=>!c.pass);console.log(JSON.stringify({status:failed.length?'FAIL':'PASS',checks:checks.length,failed:failed.map(c=>c.name)}));
 assert.equal(failed.length,0,'room loop checks failed');
}finally{socket?.close();child?.kill();await fs.rm(profile,{recursive:true,force:true}).catch(()=>{});}
