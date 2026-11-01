import fs from 'node:fs/promises';
import {connect,ready,pose,settle,measure,screenshot} from './launch-a-measure.mjs';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6)||'http://127.0.0.1:4195/walk.html?view=first';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'output/launch-a/final';
const mode=process.argv.find(a=>a.startsWith('--mode='))?.slice(7)||'distance';
await fs.mkdir(out,{recursive:true});const c=await connect(url);
try{
 await ready(c);
 if(mode==='distance'){
  const rows=[];
  for(const deck of [3,6])for(const side of [-1,1]){
   const target=side*(deck===3?210:132),y=-39.7+(deck-1)*4,yaw=side*Math.PI/2;
   const distances=[250,170,150,140,100,140,150,170,250];
   await pose(c,{at:[target-side*250,y,0],yaw,pitch:0});
   let prior=250;
   for(let i=0;i<distances.length;i++){
    const distance=distances[i],a=target-side*prior,b=target-side*distance;
    await c.evaluate('(async()=>{const w=__walk,a='+a+',b='+b+',y='+y+';const n=Math.max(1,Math.ceil(Math.abs(b-a)*2));for(let i=1;i<=n;i++){w.controller.place(new w.T.Vector3(a+(b-a)*i/n,y,0));await new Promise(requestAnimationFrame);}return true;})()');
    await settle(c,3);
    const row=await c.evaluate('({position:__walk.controller.position.toArray(),camera:__walk.camera.position.toArray(),far:__walk.camera.far,draws:{...__walk.renderer.info.render},proof:__walk.ship.v2DistantArchitecture?.userData.proof})');
    const file='d'+deck+'-'+(side<0?'aft':'bow')+'-'+i+'-'+distance+'.png';await screenshot(c,out+'/'+file);
    rows.push({deck,side,target,distance,direction:i<5?'approach':'recede',file,...row});prior=distance;
    await fs.writeFile(out+'/distance.json',JSON.stringify({method:'Continuous camera-position sweep through the native render loop; 0.5 m increments. Rendering check, not a walking collision test.',rows},null,2));console.log(file,row.draws.calls);
   }
  }
  const farRows=[];
  for(const deck of [3,6])for(const side of [-1,1])for(const distance of [650,800]){
   const target=side*(deck===3?210:132),y=-39.7+(deck-1)*4,x=target-side*distance,yaw=side*Math.PI/2;
   await c.evaluate('(()=>{const w=__walk;w.input.enabled=false;w.input.down.clear();w.follow.mode="first";w.follow.pitch=0;w.follow.yaw='+yaw+';w.controller.place(new w.T.Vector3('+x+','+y+',0));})()');await settle(c,3);
   const file='far-d'+deck+'-'+(side<0?'aft':'bow')+'-'+distance+'.png';await screenshot(c,out+'/'+file);
   farRows.push({deck,side,distance,file,...await c.evaluate('({position:__walk.controller.position.toArray(),far:__walk.camera.far,draws:{...__walk.renderer.info.render}})')});
  }
  await fs.writeFile(out+'/far.json',JSON.stringify(farRows,null,2));
 }else if(mode==='walk'){
  await pose(c,{at:[-135,-35.7,-52.5175106],yaw:Math.PI/2,pitch:0});
  await c.evaluate('(()=>{window.__trace=[];window.__tracing=true;let last=performance.now();function record(now){if(!window.__tracing)return;const w=__walk;window.__trace.push({t:now,ms:now-last,p:w.controller.position.toArray(),draws:w.renderer.info.render.calls,programs:w.renderer.info.programs.length});last=now;requestAnimationFrame(record);}requestAnimationFrame(record);__walk.input.enabled=true;})()');
  const steps=[{name:'hall-in',at:[-126,-52.5175106]},{name:'hall-door',at:[-144,-52.5175106]},{name:'aft-passage-a',at:[-144,-25]},{name:'aft-passage-b',at:[-144,-2.5]},{name:'stair-approach',at:[-136.5,-2.5]},{name:'stair-entry',at:[-136.5,-12.1]},{name:'stair-base',at:[-136.5,-14.9]},{name:'flight-up',at:[-129.6,-14.9]},{name:'half-landing',at:[-129.6,-12.1]},{name:'flight-return',at:[-136,-12.1]},{name:'deck3-landing',at:[-136,-14.9]},{name:'deck3-flight-up',at:[-129.6,-14.9]},{name:'deck3-half-landing',at:[-129.6,-12.1]},{name:'deck4-arrival',at:[-136,-12.1]}],segments=[];
  for(const step of steps){
   await c.send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w',windowsVirtualKeyCode:87});
   const result=await c.evaluate('new Promise(resolve=>{const w=__walk,target='+JSON.stringify(step.at)+',start=performance.now();let last=w.controller.position.clone(),still=0;function f(){const p=w.controller.position,dx=target[0]-p.x,dz=target[1]-p.z,d=Math.hypot(dx,dz);w.follow.yaw=Math.atan2(dx,dz);if(d<.3||performance.now()-start>25000||still>200){resolve({reached:d<.3,distance:d,elapsed:performance.now()-start,position:p.toArray(),still});return;}still=p.distanceToSquared(last)<1e-7?still+1:0;last.copy(p);requestAnimationFrame(f);}requestAnimationFrame(f);})');
   await c.send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87});await settle(c,8);
   await screenshot(c,out+'/walk-'+step.name+'.png');segments.push({...step,...result});await fs.writeFile(out+'/walk-segments.json',JSON.stringify(segments,null,2));console.log(step.name,result);
   if(!result.reached)break;
  }
  const trace=await c.evaluate('__tracing=false;__walk.input.down.clear();window.__trace');
  await fs.writeFile(out+'/walk-trace.json',JSON.stringify({url,segments,trace},null,2));
 }else if(mode==='flicker'){
  await pose(c,{at:[124,-19.7,-2],yaw:Math.PI/2,pitch:-.35});
  const hits=await c.evaluate('(()=>{const w=__walk,T=w.T,ray=new T.Raycaster(),meshes=[];w.scene.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;meshes.push(o)});const rows=[];for(const x of[60,100,120,124,128,132,136])for(const z of[-40,-20,-2,2,20,40]){ray.set(new T.Vector3(x,-18,z),new T.Vector3(0,-1,0));ray.far=3;const h=ray.intersectObjects(meshes,false).filter(h=>h.face.normal.y>.5).map(h=>{let origin=h.object,face=h.faceIndex;if(h.object.isBatchedMesh&&h.batchId!==undefined&&h.object.userData.sources){origin=w.scene.getObjectByProperty("uuid",h.object.userData.sources[h.batchId]);face-=h.object.getGeometryRangeAt(h.batchId).start/3;}const range=(origin?.geometry.userData.preparedRanges||[]).find(r=>face>=r.start&&face<r.start+r.count);return{name:h.object.name,source:range?.name,y:h.point.y,transparent:h.object.material.transparent,depthWrite:h.object.material.depthWrite}});if(h.length>1)rows.push({x,z,hits:h.slice(0,8)})}return{rows,shadows:w.renderer.shadowMap.enabled}})()');
  await fs.writeFile(out+'/surface-probes.json',JSON.stringify(hits,null,2));
  for(let i=0;i<5;i++){await c.evaluate('__walk.follow.yaw='+((Math.PI/2)+i*.005));await settle(c,4);await screenshot(c,out+'/flicker-'+i+'.png');}
  console.log('surface probes',hits.rows.length,'shadows',hits.shadows);
 }
}finally{await c.close();}
