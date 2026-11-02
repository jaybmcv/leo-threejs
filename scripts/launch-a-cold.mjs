import fs from 'node:fs/promises';
import {flickerAB} from './launch-a-flicker-ab.mjs';
import {connect,ready,settle,measure,screenshot,pose} from './launch-a-measure.mjs';
const results=[];
for(const [name,port]of [['before',4200],['after',Number(process.env.LEO_RENDER_AFTER_PORT||4199)]]){
 const url='http://127.0.0.1:'+port+'/walk.html?lv=2&at=-135,-35.7,-52.5175106&yaw=90&pitch=0&view=first&cold='+Date.now();
 const c=await connect(url);
 try{
  await ready(c);await settle(c,150);
  const cold=await c.evaluate('({capture:__launchCold,timings:__walk.timings,position:__walk.controller.position.toArray(),programs:__walk.renderer.info.programs.length})');
  const warm=await measure(c);const heap=await c.send('Runtime.getHeapUsage');
  const row={name,url,cold,warm,heap};results.push(row);
  await fs.writeFile('output/launch-a/cold-pair.json',JSON.stringify({method:'Sequential fresh WebGL contexts, network cache disabled, same prepared bytes and explicit first-person arrival pose. Diagnostic debug runtimes; not a replacement for merged public startup gate.',results},null,2));
  await screenshot(c,'output/launch-a/cold-'+name+'.png');console.log(name,'ready frame ms',cold.capture.frames[0]?.t,'warm',warm.frameMs,'passes',warm.passes,'heap',heap.usedSize);
  await flickerAB(c,name);
  if(name==='after'){
   const mood=[];
   for(const deck of [15,16]){
    await pose(c,{at:[-136,-39.7+(deck-1)*4,-12.1],yaw:Math.PI/2,pitch:0});
    await c.evaluate('new Promise(r=>setTimeout(r,3000))');
    mood.push(await c.evaluate('(()=>{const w=__walk;return {position:w.controller.position.toArray(),seasonalModule:!!w.halloween,environment:w.scene.environmentIntensity,fog:{near:w.scene.fog.near,far:w.scene.fog.far,color:w.scene.fog.color.getHex()},lights:w.scene.children.filter(o=>o.isLight).map(o=>({type:o.type,intensity:o.intensity}))}})()'));
    await screenshot(c,'output/launch-a/mood-deck-'+deck+'.png');
   }
   await fs.writeFile('output/launch-a/mood.json',JSON.stringify(mood,null,2));
  }
await c.send('Page.navigate',{url:'about:blank'});
 }finally{await c.close();}
}
