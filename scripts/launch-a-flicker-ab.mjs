import fs from 'node:fs/promises';
import {pose,settle,screenshot} from './launch-a-measure.mjs';
export async function flickerAB(c,name){
 const out='output/launch-a/flicker-ab';await fs.mkdir(out,{recursive:true});
 await pose(c,{at:[124,-19.7,-2],yaw:Math.PI/2,pitch:-.35});
 const cases=name==='before'?['normal','opaque-only','near-0.5']:['normal'];
 const records=[];
 for(const variant of cases){
  await c.evaluate('(()=>{const w=__walk;window.__flickerMats??=new Map();w.scene.traverse(o=>{for(const m of [].concat(o.material||[]))if(m.transparent&&!__flickerMats.has(m))__flickerMats.set(m,m.visible)});for(const [m,v]of __flickerMats)m.visible='+JSON.stringify(variant==='opaque-only')+'?false:v;w.camera.near='+ (variant==='near-0.5'?'.5':'.05')+';w.camera.updateProjectionMatrix();return true})()');
  for(let i=0;i<5;i++){
   await c.evaluate('__walk.follow.yaw='+(Math.PI/2+(i-2)*.002));await settle(c,5);
   const points=await c.evaluate('(()=>{const w=__walk,size=w.renderer.getSize(new w.T.Vector2());return [128,130,132,134,136].map(x=>{const p=new w.T.Vector3(x,-19.694,0).project(w.camera);return [Math.round((p.x*.5+.5)*size.x),Math.round((-p.y*.5+.5)*size.y)]})})()');
   const file=name+'-'+variant+'-'+i+'.png';await screenshot(c,out+'/'+file);records.push({variant,i,file,points});
  }
 }
 await c.evaluate('(()=>{for(const[m,v]of window.__flickerMats)m.visible=v;__walk.camera.near=.05;__walk.camera.updateProjectionMatrix();return true})()');
 await fs.writeFile(out+'/'+name+'.json',JSON.stringify({shadows:false,nearPlanes:[.05,.5],records},null,2));
}
