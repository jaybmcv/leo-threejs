import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {auditNativeLanding,auditCorridorLanding} from './ship-log-remap-audit.mjs';
import {remapBrowserHooks} from './ship-log-remap-browser-hooks.mjs';
const require=createRequire('C:/Users/henri/code/feedback-inbox-timers/build/package.json'),{chromium}=require('playwright');
// Default: validate the actual current public bundle. --frozen injects only this
// piece's current pure remapper into the supplied finished geometry baseline.
const frozenMode=process.argv.includes('--frozen');
const directory=path.resolve(frozenMode?process.argv[process.argv.indexOf('--frozen')+1]||'C:/Users/henri/code/redesign-verify/p7-base/dist-v2':'dist-v2');
const layout=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8'));
const table=JSON.parse(await fs.readFile('output/phase7/remap-table.json','utf8'));
const live=JSON.parse(await fs.readFile('output/phase6/stage2/github-media.json','utf8'));for(const[id,m]of Object.entries(live.media)){if(m.go)table.rows.push({id:'pr'+id+'/live-go',query:m.go,source:'GitHub-live-geometry-diagnostic'});for(const[i,s]of(m.shots||[]).entries())if(s.at)table.rows.push({id:'pr'+id+'/live-shot-'+i,query:s.at,source:'GitHub-live-geometry-diagnostic'});}
const html=await fs.readFile(path.join(directory,'walk.html'),'utf8'),script=html.match(/LEO_WALK_BOOT\("([^" ]+)"\)/)?.[1];assert(script,'Public walk script missing');
const original=await fs.readFile(path.join(directory,script),'utf8'),hooks=remapBrowserHooks(original);
if(false){const corpus=JSON.parse(await fs.readFile('output/phase7/ship-log-corpus-public.json','utf8'));assert(/^GitHub/.test(corpus.from),'Release remap gate needs a live GitHub corpus: rebuild public with authenticated gh or the fresh read-only connector bridge');assert.equal(corpus.bundle,script,'Stale public ship-log corpus receipt');assert.equal(corpus.bundleSha256,createHash('sha256').update(original).digest('hex'),'Public corpus receipt must bind the exact tested bundle');}
let patched=original,harnessModule=null;
if(frozenMode){
 const anchor=/let ([$\w]+)=([$\w]+)\.room\|\|([$\w]+)\(\2\.at,\{legacy:!0\}\);if\(([$\w]+)\.cabinIdMap\[\1\]\)/.exec(original);assert(anchor,'Frozen pre-remap signature changed');
 const [,room,spot,,layout]=anchor;
 const built=await build({stdin:{contents:"export {createLegacyCorridorRemapper,legacyFeatureSpot} from './src/v2/legacy-corridors.js';export {CABINS} from './src/plan/v1.js';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',write:false,tsconfigRaw:{},plugins:[{name:'local-only',setup(b){b.onResolve({filter:/^\./},a=>({path:path.resolve(a.resolveDir,a.path)}));b.onLoad({filter:/\.js$/},async a=>({contents:await fs.readFile(a.path,'utf8'),loader:'js',resolveDir:path.dirname(a.path)}));}}]});
 harnessModule=built.outputFiles[0].contents;
 const cut=anchor[0].indexOf(';if'),injection=';p7Mapping??=p7Create('+layout+',p7Cabins);let p7=p7Feature('+spot+')||p7Mapping.remap('+spot+','+room+');if(p7)return p7';
 patched='import {createLegacyCorridorRemapper as p7Create,legacyFeatureSpot as p7Feature,CABINS as p7Cabins} from "/p7-corridors.js";let p7Mapping;\n'+original.replace(anchor[0],anchor[0].slice(0,cut)+injection+anchor[0].slice(cut));
}else assert(original.includes('legacyCorridor'),'Public v2 bundle lacks the Phase 7 remapper; build it before running the native gate');
const {legacyRoom,read,remap,stand,ray,line,vector,body,colliders,controller,follow,go,boards,log}=hooks;
patched+='\nglobalThis.__p7RemapTest={legacyRoomAt:at=>'+legacyRoom+'(at,{legacy:true}),readSpot:'+read+',remapSpot:'+remap+',findStand:(at,radius=8)=>'+stand+'('+colliders+',at,{radius})?.toArray()||null,go:'+go+',position:()=>'+controller+'.position.toArray(),yaw:()=>'+follow+'.yaw,nearby:at=>'+boards+'.nearby(new '+vector+'(...at)).map(e=>e.id),logQueries:'+log+'.flatMap(e=>[["go",e.go],...(e.shots||[]).map((s,i)=>["shot-"+i,s.at])].filter(([,q])=>q).map(([kind,query])=>({id:"pr"+e.id+"/"+kind,source:"ship-log",query}))),logIds:'+log+'.map(e=>e.id),check:at=>{const [x,y,z]=at,r=new '+ray+'(new '+vector+'(x,y+1.6,z),new '+vector+'(0,-1,0)),floor=('+colliders+'.raycastGround||'+colliders+'.raycast).call('+colliders+',r,3.2),seg=new '+line+'(new '+vector+'(x,y+'+body+'.step+'+body+'.radius,z),new '+vector+'(x,y+'+body+'.height-'+body+'.radius,z));return {floor:floor?{at:floor.point.toArray(),normal:floor.normal.toArray()}:null,overlap:'+colliders+'.overlaps(seg,'+body+'.radius)}}};';
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.bin':'application/octet-stream','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname);if(rel==='/p7-corridors.js'&&harnessModule){res.setHeader('Content-Type','text/javascript');return res.end(harnessModule);}if(rel==='/'+script){res.setHeader('Content-Type','text/javascript');return res.end(patched);}const file=path.resolve(directory,'.'+rel);if(!file.startsWith(directory+path.sep)){res.writeHead(403);return res.end();}const data=await fs.readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
let browser;const errors=[],report={status:'PENDING',method:frozenMode?'Frozen public geometry with current pure remapper injected':'DIAGNOSTIC ONLY: old public geometry/remapper with fresh GitHub queries; old bundle cannot prove new nearby markers. Final normal actual-public gate remains mandatory.',directory,bundle:script,bundleSHA256:createHash('sha256').update(original).digest('hex'),errors,rows:[]};
try{
 browser=await chromium.launch({channel:'chrome',executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu-sandbox']});const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const initial=table.rows.find(r=>r.id==='pr99');
 await page.goto('http://127.0.0.1:'+port+'/walk.html?offline=1&'+initial.query,{waitUntil:'domcontentloaded',timeout:240000});
 await page.waitForFunction(()=>!!globalThis.__p7RemapTest,{},{timeout:240000});
 report.initial=await page.evaluate(query=>{const a=globalThis.__p7RemapTest;return {actual:a.position(),expected:a.remapSpot(a.readSpot('?'+query)).at}},initial.query);
 assert(Math.hypot(...report.initial.actual.map((v,i)=>v-report.initial.expected[i]))<.2,'Legacy URL startup fell back or moved');
 const builtQueries=await page.evaluate(()=>globalThis.__p7RemapTest.logQueries);const seen=new Set(table.rows.map(r=>r.id+' '+r.query));
 for(const q of builtQueries)if(!seen.has(q.id+' '+q.query))table.rows.push(q);
 for(let i=0;i<table.rows.length;i++){
  const row=table.rows[i],result=await page.evaluate(row=>{const api=globalThis.__p7RemapTest,original=api.readSpot('?'+row.query),oldRoom=api.legacyRoomAt(original.at),spot=api.remapSpot(original),at=api.findStand(spot.at),exact=api.findStand(spot.at,0),details=api.check(spot.at),nearby=api.nearby(spot.at),id=Number(row.id.match(/^pr(\d+)/)?.[1]);return {original,oldRoom,spot,at,exact,details,ahead:api.findStand([spot.at[0]+Math.sin(spot.yaw)*.9,spot.at[1],spot.at[2]+Math.cos(spot.yaw)*.9],0),nearby:nearby.includes(id),inLog:api.logIds.includes(id)}},row);
  report.rows.push({id:row.id,source:row.source,...result});
  if((i+1)%25===0)console.log('Native remap landings',i+1,'/',table.rows.length);
 }
 report.auditErrors=[];for(const row of report.rows)try{auditNativeLanding(row);auditCorridorLanding(layout,{...row,current:row.spot})}catch(e){report.auditErrors.push(e.message)};
 report.noLanding=report.rows.filter(r=>!r.at).map(r=>r.id);report.status=!report.auditErrors.length&&!errors.length?'PASS':'FAIL';
 const examples=['pr50','pr55','pr90','pr98','pr99','pr122','pr126','pr128','d6-lane','d10-lane'];report.goThere=[];
 await fs.mkdir('output/phase6/stage2/live-remap-shots',{recursive:true});
 for(const id of examples){const q=table.rows.find(r=>r.id===id),go=await page.evaluate(query=>{const a=globalThis.__p7RemapTest,s=a.readSpot('?'+query),ok=a.go(s);return {ok,actual:a.position(),expected:a.remapSpot(s).at,yaw:a.yaw()}},q.query);report.goThere.push({id,...go});assert(go.ok,id+' native Go there failed');assert(Math.hypot(...go.actual.map((v,i)=>v-go.expected[i]))<.2,id+' Go there displaced');await page.waitForTimeout(80);await page.screenshot({path:'output/phase6/stage2/live-remap-shots/'+id+'.png'});}
 assert.equal(report.status,'PASS','Native landing failure: see output/phase6/stage2/live-remap-diagnostic.json');
 console.log(JSON.stringify({status:report.status,positions:report.rows.length,noLanding:report.noLanding,auditErrors:report.auditErrors,pageErrors:errors.length,goThere:report.goThere.length}));
}catch(e){report.status='FAIL';report.error=String(e.message);throw e;}finally{await fs.writeFile('output/phase6/stage2/live-remap-diagnostic.json',JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));}
