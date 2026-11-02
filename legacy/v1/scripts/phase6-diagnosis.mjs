import fs from 'node:fs/promises';
import {pageAt} from './phase3b-cdp.mjs';
function profiler(){return new Promise(resolve=>{
 const w=__walk,items=[],originals=[];
 w.scene.traverse(o=>{
  if(!o.isMesh)return;
  const before=o.onBeforeRender,after=o.onAfterRender;let start=0;
  o.onBeforeRender=function(...args){start=w.renderer.info.render.calls;before?.apply(this,args);};
  o.onAfterRender=function(...args){
   const draws=w.renderer.info.render.calls-start;after?.apply(this,args);
   const ancestors=[];for(let q=o;q;q=q.parent)ancestors.push(q.name);
   items.push({name:o.name,material:args[4]?.name||o.material?.name,draws,
    triangles:(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3*(o.isInstancedMesh?o.count:1),
    instances:o.isInstancedMesh?o.count:0,ancestors:ancestors.slice(0,5),
    bounds:o.geometry.boundingBox?[o.geometry.boundingBox.min.toArray(),o.geometry.boundingBox.max.toArray()]:null,
    rangeNames:[...new Set((o.geometry.userData.preparedRanges||[]).map(r=>r.name))].slice(0,100),
    room:o.userData.room,phase4:o.userData.phase4});
  };originals.push([o,before,after]);
 });
 requestAnimationFrame(()=>requestAnimationFrame(()=>{for(const[o,a,b]of originals){o.onBeforeRender=a;o.onAfterRender=b;}resolve(items);}));
});}
const dir='output/phase6',p=await pageAt(process.env.LEO_PHASE6_URL||'http://127.0.0.1:4183/normal/walk.html',{reload:true});
try{
 await p.send('Network.setBlockedURLs',{urls:['wss://*','ws://*','*creamery.marscatsvoyage.com*']});
 await p.wait('document.body?.dataset.ready==="1"&&!!globalThis.__walk',240000);
 const base=JSON.parse(await fs.readFile(dir+'/baseline-native.json')),rows=[];
 for(const v of base.views){
  await p.ev('(()=>{const w=__walk;w.input.enabled=false;w.input.down.clear();w.camera.fov=62;w.camera.updateProjectionMatrix();w.goTo('+JSON.stringify({at:v.at,yaw:v.yaw,pitch:v.pitch,lv:2,resolved:true,view:'first'})+');w.follow.mode="first";w.follow.yaw='+v.yaw+';w.follow.pitch='+v.pitch+';return true})()');
  await p.frames(45);
  const native=await p.ev('({calls:__walk.renderer.info.render.calls,triangles:__walk.renderer.info.render.triangles,eye:__walk.camera.position.toArray()})');
  const detail=await p.ev('('+profiler.toString()+')()');
  await p.shot(dir+'/before-'+v.name+'.png');
  rows.push({view:v.name,native,detail});console.log(v.name,native,detail.length);
 }
 await fs.writeFile(dir+'/draw-diagnosis.json',JSON.stringify({at:new Date().toISOString(),base:'Preserved normal Phase 5 prepared artifact 9c497459; supplied 3021/2317 baseline. Current checkout 0700975; prototypes will be rebuilt from source.',timingQualified:'Other-copy validation active; timings provisional',rows,errors:p.errors},null,2));
 console.log('Diagnosis saved');
}finally{await p.send('Page.navigate',{url:'about:blank'}).catch(()=>{});p.socket.close();}
