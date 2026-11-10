import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

// Renders the blossom garden's real fountain sound (src/walk/blossom.js) in headless Chrome and measures the audio it makes.
// The page's AudioContext is swapped for an OfflineAudioContext, so the sound's own graph (noise, filters, gain, panner) is rendered to samples
// without a sound card. It is the garden's code on its own, not the built ship, and it leaves out the drip plinks (they only run on a live context).
const dir=path.resolve('.qa/blossom-sound');await fs.mkdir(dir,{recursive:true});
const stubRooms={name:'stub-rooms',setup(b){b.onResolve({filter:/plan\/rooms\.js$/},()=>({path:'rooms',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const roomObject=(ship,id)=>ship.root.getObjectByName(id)||null;',resolveDir:path.resolve('src')}));}};
const entry=`import * as T from 'three';import {createBlossomGarden,prepareBlossomBed} from ${JSON.stringify(path.resolve('src/walk/blossom.js').replace(/\\/g,'/'))};
const SR=44100,SECS=5;
Object.defineProperty(navigator,'userActivation',{value:{hasBeenActive:true}});
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len;for(let i=0;i<n;i+=len)for(let k=0;k<len/2;k++){const c=Math.cos(a*k),s=Math.sin(a*k),x=i+k,y=x+len/2,tr=re[y]*c-im[y]*s,ti=re[y]*s+im[y]*c;re[y]=re[x]-tr;im[y]=im[x]-ti;re[x]+=tr;im[x]+=ti;}}}
function stats(left,right){const n=16384,start=left.length-n,re=new Float64Array(n),im=new Float64Array(n);let sq=0,peak=0;
 for(let i=0;i<n;i++){const v=(left[start+i]+right[start+i])/2;re[i]=v*(.5-.5*Math.cos(2*Math.PI*i/n));sq+=v*v;peak=Math.max(peak,Math.abs(left[start+i]),Math.abs(right[start+i]));}
 fft(re,im);let tot=0,wt=0,low=0,mid=0,high=0;for(let k=1;k<n/2;k++){const f=k*SR/n,e=re[k]*re[k]+im[k]*im[k];tot+=e;wt+=e*f;if(f<300)low+=e;else if(f<4000)mid+=e;else high+=e;}
 return {rms:Math.sqrt(sq/n),peak,centroid:tot?wt/tot:0,lowShare:tot?low/tot:0,midShare:tot?mid/tot:0,highShare:tot?high/tot:0};}
// One garden per case; the walker stands "metres" from the falls at their height, looking at them.
async function render(metres,steps){
 const root=new T.Group(),room=new T.Group();room.name='Fitted_garden_commons_10';root.add(room);
 for(const name of ['Garden_planter','Planting_bed']){const m=new T.Mesh(new T.BoxGeometry(9,.65,9));m.name=name;m.position.set(141,24.625,32);room.add(m);}
 const ship={root,room};prepareBlossomBed(ship);const garden=createBlossomGarden(ship);root.updateMatrixWorld(true);
 let offline=null;const Real=window.AudioContext;window.AudioContext=function(){offline=new OfflineAudioContext(2,SR*SECS,SR);return offline;};
 try{
  const f=garden.falls,walker=new T.Vector3(f.x-metres,f.y,f.z),camera=new T.PerspectiveCamera(70,1,.1,100);camera.position.copy(walker);camera.lookAt(f);
  for(const on of steps)garden.update(1/60,walker,on,camera);
 }finally{window.AudioContext=Real;}
 if(!offline)return {context:false};
 const buf=await offline.startRendering();return {context:true,...stats(buf.getChannelData(0),buf.getChannelData(1))};
}
window.runSound=async()=>({
 near:await render(1.5,[true]),mid:await render(7,[true]),far:await render(12,[true]),edge:await render(13.8,[true]),beyond:await render(15,[true]),
 off:await render(1.5,[false]),muted:await render(1.5,[true,false]),
});`;
const out=await build({stdin:{contents:entry,resolveDir:path.resolve('src/walk'),loader:'js'},bundle:true,write:false,format:'iife',platform:'browser',plugins:[stubRooms],nodePaths:[path.resolve('node_modules')],logLevel:'error'});
const code=out.outputFiles[0].text;await fs.writeFile(path.join(dir,'sound-page.js'),code);

const installed='C:/Program Files/Google/Chrome/Application/chrome.exe';
let chromium;try{chromium=createRequire('C:/Users/henri/code/feedback-inbox-timers/build/package.json')('playwright').chromium;}catch{console.log('SKIP no browser driver available; the fountain sound was not rendered');process.exit(0);}
const browser=await chromium.launch({channel:'chrome',...await fs.stat(installed).then(()=>({executablePath:installed})).catch(()=>({})),headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:code});
 const r=await page.evaluate(()=>window.runSound());
 const db=x=>x>0?(20*Math.log10(x)).toFixed(1)+' dBFS':'silent',row=(k,v)=>console.log(`${k.padEnd(7)} ${v.context?`rms ${db(v.rms)}, peak ${v.peak.toFixed(3)}, centroid ${v.centroid.toFixed(0)} Hz, <300 Hz ${(v.lowShare*100).toFixed(1)}%, 300-4k ${(v.midShare*100).toFixed(1)}%, >4k ${(v.highShare*100).toFixed(1)}%`:'no audio context made'}`);
 for(const [k,v] of Object.entries(r))row(k,v);
 const checks=[],ok=(name,pass)=>{checks.push({name,pass});console.log(`${pass?'PASS':'FAIL'} ${name}`);};
 ok('no page errors',errors.length===0);
 ok('the falls make sound within reach with Sound on',r.near.context&&r.near.rms>.005);
 ok('it fades with distance (1.5 m > 7 m > 12 m > 13.8 m, all still heard)',r.near.rms>r.mid.rms&&r.mid.rms>r.far.rms&&r.far.rms>r.edge.rms&&r.edge.rms>0);
 ok('it is silent past 14 m',!r.beyond.context);
 ok('Sound off makes no sound',!r.off.context);
 ok('turning Sound off after on silences it',!r.muted.context||r.muted.rms<1e-4);
 ok('it is soft: no clipping and peaks under half scale',r.near.peak<.5);
 ok('it is water, not rumble: under 300 Hz is a small share and the mass sits in the middle band',r.near.lowShare<.15&&r.near.midShare>.7&&r.near.centroid>600&&r.near.centroid<3500);
 await fs.writeFile(path.join(dir,'sound-report.json'),JSON.stringify(r,null,1));
 const failed=checks.filter(c=>!c.pass);console.log(JSON.stringify({status:failed.length?'FAIL':'PASS',checks:checks.length,failed:failed.map(c=>c.name)}));
 assert.equal(failed.length,0,'blossom sound checks failed');
}finally{await browser.close();}
