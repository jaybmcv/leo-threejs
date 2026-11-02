import * as T from 'three';
import {exteriorShellPoint} from '../exterior-profile.js';
import {bowHeight} from '../diagonal-profile.js';
import {fairingWarps} from '../hull-fairing.js';
import {noseWarp} from '../nose-fairing.js';
import {rakeBowPoint,liftKeelPoint} from '../concept-shape.js';

// The exterior's uncut loft, at its production resolution and in physical coordinates.
// Cut-out glazing is deliberately filled: an aperture is not missing pressure volume.
export function buildHullV2(){
 const root=new T.Group(),meshes=[];
 for(const side of [-1,1]){
  const p=[],ix=[],rows=401,segments=288;
  for(let i=0;i<rows;i++)for(let j=0;j<=segments;j++){
   const x=-300*Math.cos(i/(rows-1)*Math.PI),q=exteriorShellPoint(x,-Math.PI/2+j/segments*Math.PI,side);
   p.push(.94*q[0]-18,bowHeight(q[0],q[1]),q[2]);
  }
  for(let i=0;i<rows-1;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;ix.push(a,b,a+1,b,b+1,a+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);
  const m=new T.Mesh(g);m.name='Smooth_pressure_envelope_'+side;root.add(m);meshes.push(m);
 }
 root.updateMatrixWorld(true);
 const fair=fairingWarps(root,new T.Matrix4()),v=new T.Vector3();
 const warp=fn=>{for(const m of meshes){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);fn(v);p.setXYZ(i,v.x,v.y,v.z);}}};
 warp(fair.fairSides);warp(fair.fairCrown);
 const nose=noseWarp(root,new T.Matrix4());warp(nose.warp);
 warp(v=>v.fromArray(liftKeelPoint(rakeBowPoint(v.toArray()))));
 const bins=new Map(),triangles=[],vertical=[];
 for(let k=0;k<meshes.length;k++){
  const side=k===0?-1:1,p=meshes[k].geometry.attributes.position,ix=meshes[k].geometry.index;
  for(let t=0;t<ix.count;t+=3){
   const q=[0,1,2].map(j=>{const i=ix.getX(t+j);return [p.getX(i),p.getY(i),side*p.getZ(i)];});
   const den=(q[1][1]-q[2][1])*(q[0][0]-q[2][0])+(q[2][0]-q[1][0])*(q[0][1]-q[2][1]);if(Math.abs(den)<1e-9){vertical.push(q.map(p=>[p[0],p[1],side*p[2]]));continue;}
   const tr={q,den,side,x0:Math.min(...q.map(p=>p[0])),x1:Math.max(...q.map(p=>p[0])),y0:Math.min(...q.map(p=>p[1])),y1:Math.max(...q.map(p=>p[1]))};
   const id=triangles.push(tr)-1;
   for(let x=Math.floor(tr.x0/2);x<=Math.floor(tr.x1/2);x++)for(let y=Math.floor(tr.y0/2);y<=Math.floor(tr.y1/2);y++){
    const key=side+':'+x+':'+y;(bins.get(key)??bins.set(key,[]).get(key)).push(id);
   }
  }
 }
 function skin(x,y,side=1){
  let best=0;
  for(const id of bins.get(side+':'+Math.floor(x/2)+':'+Math.floor(y/2))||[]){
   const {q:[a,b,c],den}=triangles[id],u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,w=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;
   if(Math.min(u,w,1-u-w)>=-1e-7)best=Math.max(best,u*a[2]+w*b[2]+(1-u-w)*c[2]);
  }
  return best;
 }
 const clip=(poly,axis,at,sign)=>{
  const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=sign*(a[axis]-at),db=sign*(b[axis]-at);
   if(da>=-1e-9)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}
  }return out;
 };
 // Exact minima on clipped, piecewise linear skin triangles, not walking-height samples.
 function minimum(x0,x1,y0,y1,side=1){
  if([skin(x0,y0,side),skin(x1,y0,side),skin(x0,y1,side),skin(x1,y1,side)].some(w=>w<=0))return 0;
  const ids=new Set();for(let x=Math.floor(x0/2);x<=Math.floor(x1/2);x++)for(let y=Math.floor(y0/2);y<=Math.floor(y1/2);y++)for(const id of bins.get(side+':'+x+':'+y)||[])ids.add(id);
  let low=Infinity;for(const id of ids){const t=triangles[id];if(t.x1<x0||t.x0>x1||t.y1<y0||t.y0>y1)continue;
   let q=t.q;for(const [a,b,s]of [[0,x0,1],[0,x1,-1],[1,y0,1],[1,y1,-1]])q=clip(q,a,b,s);
   for(const p of q)low=Math.min(low,p[2]);
  }return Number.isFinite(low)?low:0;
 }
 const cache=new Map();
 function roomHalf(x,y,height=3.5,side=1){const key=[x,y,height,side].join(':');if(!cache.has(key))cache.set(key,Math.max(0,minimum(x-.02,x+.02,y-2.5,y+height+2.5,side)-2.5));return cache.get(key);}
 function fits(poly,y,height,inset=2.5,verticalInset=inset){
  for(const side of [-1,1]){
   if(Math.max(...poly.map(p=>side*p[1]))<=0)continue;
   const xs=[...new Set(poly.map(p=>p[0]))].sort((a,b)=>a-b),y0=y-verticalInset,y1=y+height+verticalInset;
   const zAt=x=>{const z=[];for(let j=0;j<poly.length;j++){const p=poly[j],q=poly[(j+1)%poly.length];if(x>=Math.min(p[0],q[0])-1e-7&&x<=Math.max(p[0],q[0])+1e-7){const d=q[0]-p[0];if(Math.abs(d)<1e-9){z.push(side*p[1],side*q[1]);continue;}const t=(x-p[0])/d;z.push(side*(p[1]+(q[1]-p[1])*t));}}return Math.max(...z);};
   for(let i=1;i<xs.length;i++){
    const a=xs[i-1],b=xs[i];if(b-a<1e-8)continue;
    if([skin(a,y0,side),skin(a,y1,side),skin(b,y0,side),skin(b,y1,side)].some(w=>w<=0))return false;
    const ids=new Set();for(let x=Math.floor(a/2);x<=Math.floor(b/2);x++)for(let yy=Math.floor(y0/2);yy<=Math.floor(y1/2);yy++)for(const id of bins.get(side+':'+x+':'+yy)||[])ids.add(id);
    for(const id of ids){const tr=triangles[id];if(tr.x1<a||tr.x0>b||tr.y1<y0||tr.y0>y1)continue;let q=tr.q;
     for(const [axis,at,s]of [[0,a,1],[0,b,-1],[1,y0,1],[1,y1,-1]])q=clip(q,axis,at,s);
     for(const p of q)if(zAt(p[0])>p[2]-inset+1e-5)return false;
    }
   }
  }return true;
 }
 for(const m of meshes)m.geometry.dispose();
 function onSurface(p,tolerance=.001){if(Math.abs(Math.abs(p[2])-skin(p[0],p[1],Math.sign(p[2])||1))<tolerance)return true;const v=new T.Vector3(...p),closest=new T.Vector3(),tr=new T.Triangle();const qs=vertical.slice();for(let x=Math.floor(p[0]/2)-1;x<=Math.floor(p[0]/2)+1;x++)for(let y=Math.floor(p[1]/2)-1;y<=Math.floor(p[1]/2)+1;y++)for(const id of bins.get((Math.sign(p[2])||1)+':'+x+':'+y)||[]){const t=triangles[id];qs.push(t.q.map(p=>[p[0],p[1],t.side*p[2]]));}return qs.some(q=>{tr.set(...q.map(p=>new T.Vector3(...p)));tr.closestPointToPoint(v,closest);return closest.distanceTo(v)<tolerance;});}
 function ray(p,n){const ray=new T.Ray(new T.Vector3(...p),new T.Vector3(...n).normalize()),ids=new Set(),hit=new T.Vector3();const end=p[0]+n[0]*256;for(let x=Math.floor(Math.min(p[0],end)/2)-1;x<=Math.floor(Math.max(p[0],end)/2)+1;x++)for(let y=Math.floor(p[1]/2)-1;y<=Math.floor(p[1]/2)+1;y++)for(const side of [-1,1])for(const id of bins.get(side+':'+x+':'+y)||[])ids.add(id);let best=null,distance=Infinity;const qs=[...ids].map(id=>{const t=triangles[id];return t.q.map(p=>[p[0],p[1],t.side*p[2]]);});for(const q of [...qs,...vertical]){if(ray.intersectTriangle(...q.map(p=>new T.Vector3(...p)),false,hit)){const d=hit.distanceTo(ray.origin);if(d>.00001&&d<distance){distance=d;best=hit.toArray();}}}return best;}
 const sectionHalf=(x,y,height=.5,side=1)=>Math.max(0,minimum(x-.02,x+.02,y,y+height,side)-2.5);
 return {skin,minimum,roomHalf,sectionHalf,fits,onSurface,ray,provenance:{coordinates:'physical ship metres',loft:[401,288],inset:2.5,passes:['exteriorShellPoint','bowHeight','physicalX','fairSides','fairCrown','noseWarp','rakeBowPoint','liftKeelPoint'],method:'full-height clipped skin triangle minima; conservative footprint strips'}};
}
let cached;
export const hullV2=()=>cached??=buildHullV2();
