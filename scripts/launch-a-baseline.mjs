import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {connect,screenshot,settle} from './launch-a-measure.mjs';
const root='C:/Users/henri/code/leo-threejs/.qa/redesign-preview-1027b',out='output/launch-a/179d813';
await fs.mkdir(out,{recursive:true});
const pin=JSON.parse(await fs.readFile('scripts/startup-baseline-v2.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const [file,expected]of [['walk.html',pin.htmlSha256],[pin.bundle,pin.bundleSha256],['asset-manifest.json',pin.manifestSha256]])if(hash(await fs.readFile(root+'/'+file))!==expected)throw Error('Pinned baseline mismatch '+file);
const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'walk.html',file=path.resolve(root,name);if(!file.startsWith(root.replaceAll('/',path.sep)+path.sep))throw Error('path');const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary'}[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(4194,'127.0.0.1',r));
const c=await connect('about:blank');
const instrument=()=>{
 window.__native={rows:[],events:[],current:null};
 const d=window.__native,p=WebGL2RenderingContext.prototype;
 const clear=p.clear;p.clear=function(mask){
  if(mask&this.COLOR_BUFFER_BIT){if(d.current){d.current.ms=performance.now()-d.current.start;d.rows.push(d.current);if(d.rows.length>3000)d.rows.shift();}d.current={start:performance.now(),pass:0,calls:[0,0,0],triangles:[0,0,0]};}
  else if(mask&this.DEPTH_BUFFER_BIT&&d.current)d.current.pass++;
  return clear.call(this,mask);
 };
 for(const [name,ci,ii]of [['drawElements',1,null],['drawArrays',2,null],['drawElementsInstanced',1,4],['drawArraysInstanced',2,3]]){
  const fn=p[name];p[name]=function(...args){const f=d.current;if(f){const pass=Math.min(2,f.pass);f.calls[pass]++;if(args[0]===this.TRIANGLES)f.triangles[pass]+=args[ci]/3*(ii===null?1:args[ii]);}return fn.apply(this,args);};
 }
 for(const name of ['compileShader','linkProgram','texImage2D']){const fn=p[name];p[name]=function(...args){const start=performance.now(),value=fn.apply(this,args);d.events.push({name,start,ms:performance.now()-start});return value;};}
};
await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'('+instrument.toString()+')();localStorage.removeItem("leo-walk-building");'});
await c.send('Page.navigate',{url:'http://127.0.0.1:4194/walk.html?lv=2&at=-135,-35.7,-52.5175106&yaw=90&pitch=0&view=first'});
let ready=false;for(let i=0;i<900;i++){if(await c.evaluate('document.body?.dataset.ready==="1"')){ready=true;break}if(c.errors.length)throw Error(JSON.stringify(c.errors));await c.evaluate('document.querySelector("#memory-try")?.click()');await new Promise(r=>setTimeout(r,200));}
if(!ready)throw Error('Baseline load did not finish');
await settle(c,45);const first=await c.evaluate('__native.rows.length');await settle(c,150);
const result=await c.evaluate('({rows:__native.rows.slice('+first+'),cold:__native.rows.slice(0,60),events:__native.events,readyMs:performance.now(),url:location.href})');
result.revision=pin.commit;result.pin=pin;result.method='Unmodified pinned public bundle; WebGL2 draw calls counted separately by sky, haze and main pass; usual entry pose, first-person; 45 warmup frames then 150 frames';
await fs.writeFile(out+'/arrival.json',JSON.stringify(result,null,2));await screenshot(c,out+'/arrival.png');
console.log(JSON.stringify({revision:pin.commit,samples:result.rows.length,calls:result.rows.at(-1)?.calls}));
c.close();server.close();
