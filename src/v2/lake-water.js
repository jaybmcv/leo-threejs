import * as T from 'three';
import {REFLECTION_BAYS} from './reflection-terraces.js';

// G3 option A (lake-a-natural-edge): deeper, clear blue-green water, lighter in the shallows along every shore. The
// lake's one water sheet (atrium-surfaces.js) takes RGBA vertex colours. Its flat triangles are halved along their
// longest edge until none is longer than SPLIT (the sheet stays flat, so the extra vertices open no cracks), then each
// vertex is shaded by its distance to the nearest shore: the lake outline, the dry islands, and the reflection island
// and bay floors standing in the water. Within a metre or so of a shore the water is lighter and more see-through;
// from REACH out it is darker and more opaque. The colour multiplies the material's (atrium-mood.js moves it between
// day and night) and the alpha multiplies its opacity, so the night look keeps working.
const SPLIT=2.5,REACH=4.5;
const SHALLOW=[1.3,1.25,1.05,.6],DEEP=[.12,.38,.5,1.3];
// The reflection island and the bay floors (reflection-terraces.js): circles whose outside is water.
const RINGS=[{x:44,z:-26.8,r:7.22},...REFLECTION_BAYS.map(x=>({x,z:-5.8,r:5.62}))];

function split(pos){
 const out=[],stack=[];
 for(let i=0;i<pos.length;i+=9)stack.push(Array.from(pos.slice(i,i+9)));
 while(stack.length){
  const t=stack.pop(),edge=k=>{const a=k*3,b=(k+1)%3*3;return Math.hypot(t[b]-t[a],t[b+1]-t[a+1],t[b+2]-t[a+2]);};
  const e=[edge(0),edge(1),edge(2)],k=e.indexOf(Math.max(...e));
  if(e[k]<=SPLIT){out.push(...t);continue;}
  const a=k*3,b=(k+1)%3*3,c=(k+2)%3*3,m=[0,1,2].map(i=>(t[a+i]+t[b+i])/2),A=t.slice(a,a+3),B=t.slice(b,b+3),C=t.slice(c,c+3);
  stack.push([...A,...m,...C],[...m,...B,...C]);
 }
 return out;
}
function shoreDistance(rings){
 const segs=rings.flatMap(r=>r.map((a,i)=>[a,r[(i+1)%r.length]]));
 return(x,z)=>{
  let d=Infinity;
  for(const[a,b]of segs){const vx=b[0]-a[0],vz=b[1]-a[1],l=vx*vx+vz*vz,t=l?Math.max(0,Math.min(1,((x-a[0])*vx+(z-a[1])*vz)/l)):0;d=Math.min(d,Math.hypot(x-a[0]-t*vx,z-a[1]-t*vz));}
  for(const c of RINGS)d=Math.min(d,Math.max(0,Math.hypot(x-c.x,z-c.z)-c.r));
  return d;
 };
}
// `g`: the lake's upward faces (non-indexed); `rings`: the lake outline and its island holes, as [x,z] rings.
export function shadeLakeWater(g,rings){
 const pos=split(g.attributes.position.array),near=shoreDistance(rings),cache=new Map(),col=new Float32Array(pos.length/3*4);g.dispose();
 for(let i=0;i<pos.length/3;i++){
  const x=pos[i*3],z=pos[i*3+2],key=x.toFixed(3)+','+z.toFixed(3);let t=cache.get(key);
  if(t===undefined){const s=Math.min(1,near(x,z)/REACH);t=s*s*(3-2*s);cache.set(key,t);}
  for(let k=0;k<4;k++)col[i*4+k]=SHALLOW[k]+(DEEP[k]-SHALLOW[k])*t;
 }
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(pos,3));out.setAttribute('color',new T.BufferAttribute(col,4));out.computeVertexNormals();
 return out;
}
