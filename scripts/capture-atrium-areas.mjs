// Fixed atrium viewpoints for before / concept / after comparisons, one set per improvement area.
// Each view is a walk share link (src/walk/link.js), so the same poses work on the live site and on a local build.
// Needs Chrome with remote debugging on port 9333, as scripts/launch-a-measure.mjs.
//   node scripts/capture-atrium-areas.mjs <tag> [baseUrl] [--only=id,id]
// Writes output/atrium-areas/<tag>/<id>.png and captures.json.
import fs from 'node:fs/promises';
import {connect,settle,screenshot} from './launch-a-measure.mjs';
const [tag='before',base='http://127.0.0.1:4173']=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const {width,height,views}=JSON.parse(await fs.readFile('scripts/atrium-area-views.json','utf8'));
const out='output/atrium-areas/'+tag;await fs.mkdir(out,{recursive:true});
// A dead local live socket keeps the walk solo, so a capture never joins the live server as a visitor.
const link=v=>base+'/walk.html?lv=2&view=first&live=ws://127.0.0.1:9/&at='+v.at.join(',')+'&yaw='+v.yaw+'&pitch='+v.pitch;
// Hide the HUD and minimap: only the walk's renderer canvas (in #viewport) stays visible.
const HIDE_HUD='document.head.append(Object.assign(document.createElement("style"),{textContent:"body *{visibility:hidden!important}#viewport>canvas{visibility:visible!important}"}))';
const STREAM_MS=8000; // nearby geometry streams in and the atrium mood eases after the first frame
const c=await connect('about:blank');
await c.send('Network.setCacheDisabled',{cacheDisabled:false});
await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
const rows=[];
for(const v of views.filter(v=>!only||only.includes(v.id))){
 await c.send('Page.navigate',{url:link(v)});
 await boarded();
 await new Promise(r=>setTimeout(r,STREAM_MS));
 await settle(c,90);
 const where=await c.evaluate('document.getElementById("where")?.textContent.trim()||""');
 await c.evaluate(HIDE_HUD);
 await settle(c,10);
 const file=out+'/'+v.id+'.png';await screenshot(c,file);
 rows.push({id:v.id,area:v.area,file,link:link(v),where});console.log(v.id,'|',where);
}
await fs.writeFile(out+'/captures.json',JSON.stringify({tag,base,width,height,capturedAt:new Date().toISOString(),rows,errors:c.errors},null,2));
console.log(rows.length,'captures,',c.errors.length,'page errors');
process.exit(0);

// The guest card asks for a name first; take the default and wait for the first complete frame.
async function boarded(){
 const end=Date.now()+300000;
 while(Date.now()<end){
  const state=await c.evaluate('(()=>{const who=document.getElementById("who");if(who&&!who.hidden){document.getElementById("who-board")?.click();return "boarding";}return document.body?.dataset.ready==="1"?"ready":"loading";})()').catch(()=>'loading');
  if(state==='ready')return;
  await new Promise(r=>setTimeout(r,1000));
 }
 throw Error('Walk did not become ready');
}
