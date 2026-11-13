import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {build} from 'esbuild';
import {ANGLE_IF_ASKED} from './chrome-setup.mjs';

// The lounge's music (src/walk/lounge-sound.js), measured in headless Chrome. The arrangement is rendered through an OfflineAudioContext with the
// real voices, across the whole loop and into its second pass, to measure length, sections, level, clipping and gaps; the real scheduler is then driven
// on a fake clock for more than two passes, with Sound toggled, to see that every note is scheduled once, on time, with bounded nodes.
const dir=path.resolve('.qa/lounge-music');await fs.mkdir(dir,{recursive:true});
const entry=`import {SCORE,voice,createLoungeSound} from ${JSON.stringify(path.resolve('src/walk/lounge-sound.js').replace(/\\/g,'/'))};
const SR=44100,GAIN=.55,B=SCORE.beat,N=SCORE.notes,LOOP=SCORE.loop,LEAD=.1;
const sig=(from,to)=>JSON.stringify(N.filter(e=>e.at>=from&&e.at<to).map(e=>[+(e.at-from).toFixed(3),e.kind,e.m||0,+(e.v??1).toFixed(2)]));
const inSection=(s,kinds)=>N.filter(e=>kinds.includes(e.kind)&&e.at>=s.start&&e.at<s.start+s.beats);
const kindSig=(kind,s)=>JSON.stringify(inSection(s,[kind]).map(e=>[+(e.at-s.start).toFixed(3),e.m||0,e.n||0]));
const distinct=kind=>new Set(SCORE.sections.map(s=>kindSig(kind,s))).size;
function structure(){
 const secs=SCORE.sections,out={seconds:LOOP*B,sections:secs.length,events:N.length};
 out.distinct={all:new Set(secs.map(s=>sig(s.start,s.start+s.beats))).size};
 for(const k of ['lead','bass','pad','kick','snare','hat','arp'])out.distinct[k]=distinct(k);
 out.chordSets=new Set(secs.map(s=>JSON.stringify(inSection(s,['pad']).map(e=>e.m)))).size;
 out.drumCounts=secs.map(s=>inSection(s,['kick','snare','hat']).length);
 out.leadCounts=secs.map(s=>inSection(s,['lead']).length);
 out.inLoop=N.every(e=>Number.isFinite(e.at)&&e.at>=0&&e.at<LOOP);
 out.startsOnTheTonic=N.filter(e=>e.at===0&&e.kind==='bass').map(e=>e.m);
 return out;
}
async function render(){
 const extra=5,length=LOOP*B+extra+LEAD+1,ctx=new OfflineAudioContext(2,Math.ceil(SR*length),SR),out=ctx.createGain();out.gain.value=GAIN;out.connect(ctx.destination);
 const nb=ctx.createBuffer(1,Math.floor(SR*.6),SR),d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 let count=0;for(const pass of [0,1])for(const e of N){const t=LEAD+(pass*LOOP+e.at)*B;if(t>LEAD+LOOP*B+extra)continue;voice(ctx,out,nb,t,e);count++;}
 const buf=await ctx.startRendering(),l=buf.getChannelData(0);
 let peak=0,clipped=0,jump=0,jumpAt=0;for(let i=0;i<l.length;i++){const a=Math.abs(l[i]);if(a>peak)peak=a;if(a>=.99)clipped++;if(i&&Math.abs(l[i]-l[i-1])>jump){jump=Math.abs(l[i]-l[i-1]);jumpAt=i/SR;}}
 const rms=(from,to)=>{let s=0,n=0;for(let i=Math.floor(from*SR);i<Math.min(l.length,Math.floor(to*SR));i++){s+=l[i]*l[i];n++;}return Math.sqrt(s/Math.max(1,n));};
 const end=LEAD+LOOP*B,beatRms=[];for(let t=LEAD;t<end+extra-B;t+=B)beatRms.push(rms(t,t+B));const minAt=LEAD+beatRms.indexOf(Math.min(...beatRms))*B;
 const sections=SCORE.sections.map(s=>({name:s.name,rms:rms(LEAD+s.start*B,LEAD+(s.start+s.beats)*B)}));
 const around=[];for(let t=end-2;t<end+2;t+=.5)around.push(rms(t,t+.5));
 return {voices:count,peak,clipped,jump,jumpAt,minAt,minBeat:Math.min(...beatRms),meanBeat:beatRms.reduce((a,b)=>a+b,0)/beatRms.length,sections,around,boundaryRms:rms(end-1,end+1),loopRms:rms(LEAD,end)};
}
// A fake clock and graph: every node that starts is recorded, with when it stops, and the music gain's target.
function simulate(){
 let now=0;const starts=[],gains=[];
 const param=()=>({value:0,setValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(){},setTargetAtTime(v){this.value=v;}});
 const node=(extra={})=>({connect:x=>x,start(t){starts.push({t,node:this});},stop(t){this.stopAt=t;},frequency:param(),gain:param(),Q:param(),...extra});
 const Fake=function(){return {get currentTime(){return now;},state:'running',sampleRate:SR,destination:node(),listener:{setPosition(){},setOrientation(){}},suspend(){},resume(){return Promise.resolve();},
  createGain(){const g=node();gains.push(g);return g;},createOscillator:()=>node({type:''}),createBufferSource:()=>node(),createBiquadFilter:()=>node({type:''}),createPanner:()=>node({setPosition(){}}),createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)})};};
 const Real=window.AudioContext;window.AudioContext=Fake;Object.defineProperty(navigator,'userActivation',{value:{hasBeenActive:true},configurable:true});
 try{
  let on=true;const lounge={dome:{centre:{x:1e4,y:0,z:0},r:1},inside:()=>true},falls={a:{x:0,y:0,z:0},b:{x:10,y:0,z:0}},sound=createLoungeSound(lounge,falls),walker={x:0,y:0,z:0};
  const total=LOOP*B*3.4,gainAt=[];let maxActive=0;
  for(let step=0;now<total;step++){
   now=step/60;on=!(now>150&&now<156);
   sound.update(walker,on,null);
   if(step%30===0){const active=starts.filter(s=>s.t<=now&&(s.node.stopAt??1e9)>now).length;if(active>maxActive)maxActive=active;}
   if(step%60===0)gainAt.push([Math.round(now),gains[1]?.gain.value??null]);
  }
  return {starts:starts.filter(s=>s.t!==undefined).map(s=>s.t),gainAt,maxActive,total};
 }finally{window.AudioContext=Real;}
}
window.runMusic=async()=>({structure:structure(),render:await render(),sim:simulate(),beat:B,loop:LOOP,notes:N.map(e=>e.at)});`;
const out=await build({stdin:{contents:entry,resolveDir:path.resolve('src/walk'),loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',nodePaths:[path.resolve('node_modules')],logLevel:'error'});
const code=out.outputFiles[0].text;await fs.writeFile(path.join(dir,'music-page.js'),code);

// Chrome is driven over its DevTools socket with the project's own ws package, as scripts/check-blossom-sound.mjs does. No browser means a failed check, never a skipped one.
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),profile=await fs.mkdtemp(path.join(dir,'chrome-'));let child,socket;
try{
 child=spawn(process.env.LEO_CHROME_EXE||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--no-sandbox','--disable-gpu-sandbox',...ANGLE_IF_ASKED,'--autoplay-policy=no-user-gesture-required','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let launchError;child.once('error',e=>{launchError=e;});
 let port;for(let i=0;i<150;i++){if(launchError)throw Error('Chrome could not start (set LEO_CHROME_EXE): '+launchError.message);try{port=Number((await fs.readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0]);if(port)break;}catch{}await sleep(100);}
 if(!port)throw Error('Chrome did not start; the lounge music was not measured');
 const target=(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(t=>t.type==='page');if(!target)throw Error('Chrome opened no page');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});
 const pending=new Map();let id=0;socket.on('message',raw=>{const e=JSON.parse(raw),p=e.id&&pending.get(e.id);if(p){pending.delete(e.id);e.error?p.reject(Error(JSON.stringify(e.error))):p.resolve(e.result);}});
 const send=(method,params)=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,timeout:240000});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 let r;const errors=[];try{await run(code);r=await run('window.runMusic()');}catch(e){errors.push(String(e));}
 if(!r)throw Error('the lounge music was not measured: '+errors.join('; '));
 const {structure:s,render:a,sim,beat:B,loop:L,notes}=r,db=x=>x>0?(20*Math.log10(x)).toFixed(1)+' dBFS':'silent';
 console.log(`arrangement ${s.seconds.toFixed(1)} s, ${s.sections} sections, ${s.events} events; distinct patterns`,JSON.stringify(s.distinct),'chord sets',s.chordSets);
 console.log('drum events per section',s.drumCounts.join(' '),'| lead notes per section',s.leadCounts.join(' '));
 console.log(`render: ${a.voices} voices, peak ${a.peak.toFixed(3)} (${db(a.peak)}), clipped samples ${a.clipped}, largest sample step ${a.jump.toFixed(3)}, quietest beat rms ${a.minBeat.toExponential(2)} at ${a.minAt.toFixed(1)} s, largest step at ${a.jumpAt.toFixed(2)} s, mean ${a.meanBeat.toFixed(4)}`);
 console.log('section rms',a.sections.map(x=>x.name+' '+x.rms.toFixed(4)).join(', '));
 console.log('half-second rms across the loop boundary',a.around.map(x=>x.toFixed(4)).join(' '),'| 2 s round it',a.boundaryRms.toFixed(4),'| whole loop',a.loopRms.toFixed(4));
 // The scheduler: every started voice, against the score's own times. Sound goes off at 150 s and back on at 156 s.
 const starts=sim.starts.sort((x,y)=>x-y),offAt=150,onAt=156,expected=[];
 for(let pass=0;pass<4;pass++)for(const at of notes)expected.push((pass*L+at)*B);
 const compare=list=>{const t0=list[0];let worst=0;for(let i=0;i<list.length;i++)worst=Math.max(worst,Math.abs(list[i]-t0-expected[i]));return worst;};
 const early=starts.filter(t=>t<offAt+.2),late=starts.filter(t=>t>=onAt),between=starts.filter(t=>t>offAt+.7&&t<onAt).length;
 // Voices scheduled up to half a second ahead can still start just after Sound goes off; the rest must be the score exactly.
 const earlyCut=early.filter(t=>t<offAt-.6),worstEarly=compare(earlyCut),worstLate=compare(late.slice(0,notes.length*1.8));
 console.log(`scheduler: ${starts.length} voices over ${sim.total.toFixed(0)} s; ${earlyCut.length} before Sound off (worst offset from the score ${worstEarly.toExponential(1)} s), ${late.length} after Sound on (${worstLate.toExponential(1)} s), ${between} while off, up to ${sim.maxActive} nodes sounding at once`);
 const checks=[],ok=(name,pass)=>{checks.push({name,pass});console.log(`${pass?'PASS':'FAIL'} ${name}`);};
 const rmsOf=n=>a.sections.find(x=>x.name===n).rms;
 ok('no page errors',errors.length===0);
 ok('the full sequence lasts at least two minutes, much longer than the old 13.7 s cycle',s.seconds>=120);
 ok('ten sections, every event inside the loop',s.sections===10&&s.inLoop);
 ok('every section is distinct from every other',s.distinct.all===s.sections);
 ok('melody, bass, chords and percussion all change between sections',s.distinct.lead>=8&&s.distinct.bass>=5&&s.distinct.pad>=7&&s.chordSets>=7&&s.distinct.hat>=4&&s.distinct.kick>=4);
 ok('a quiet passage has no drums',s.drumCounts.filter(n=>n===0).length>=1);
 ok('the quiet passage is quieter than the opening and the bridge',rmsOf('hush')<.8*rmsOf('theme')&&rmsOf('hush')<.8*rmsOf('bridge'));
 ok('it loops back into the opening: the last section thins to a fill and the loop starts on the tonic',s.startsOnTheTonic.includes(36)&&s.drumCounts[9]>0);
 ok('playback is continuous: no beat of the loop or its boundary is silent',a.minBeat>1e-3);
 ok('no clipping: peak well under full scale at the music gain',a.clipped===0&&a.peak<.5);
 ok('the boundary has no click: the largest sample step stays small',a.jump<.12);
 ok('the loop boundary is no quieter than half the loop average',a.boundaryRms>.5*a.loopRms);
 ok('the scheduler plays the score time for time (no gaps, repeats or drift) across a full loop and into the next',earlyCut.length>notes.length*1.05&&worstEarly<2e-3);
 ok('while Sound is off no new notes are scheduled',between===0);
 ok('Sound on again restarts the arrangement once from its opening, time for time',late.length>notes.length*1.8&&worstLate<2e-3);
 ok('nodes stay bounded across repeated cycles',sim.maxActive<60);
 ok('the music gain is 0.55 when heard and 0 when Sound is off',sim.gainAt.some(g=>g[1]===.55)&&sim.gainAt.some(g=>g[0]>offAt&&g[0]<onAt&&g[1]===0));
 await fs.writeFile(path.join(dir,'music-report.json'),JSON.stringify({s,a,sim:{...sim,starts:undefined}},null,1));
 const failed=checks.filter(c=>!c.pass);console.log(JSON.stringify({status:failed.length?'FAIL':'PASS',checks:checks.length,failed:failed.map(c=>c.name)}));
 assert.equal(failed.length,0,'lounge music checks failed');
}finally{socket?.close();child?.kill();await fs.rm(profile,{recursive:true,force:true}).catch(()=>{});}
