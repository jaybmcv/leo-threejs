// The owner bake's proof (src/v2/owner-proof.js) on random scenes: whatever it calls hidden, brute-force sight lines must
// agree. A proof for a cell C and a box B says no eye anywhere in C sees any point of B while every triangle whose
// condition is in the returned set is drawn. So for each proof, rays from eyes all over C (corners, edge and face
// midpoints, the centre, random points) to points all over B are cast over the raw triangle list, counting only triangles
// with a returned condition and only from the side they are drawn; more rays are aimed through every patch, hole, slit
// and wall edge the generator made. A ray that gets to B refutes the proof and fails the check with the scene's seed.
// This checks soundness only: a null from the proof is never wrong here, and rays that are all stopped confirm nothing
// (a hole between them goes unseen), so a pass means "not refuted", not "proven right".
//  node scripts/check-owner-proof-fuzz.mjs [--scenes=N] [--seed=S]     scene i is built from seed S+i alone
import assert from 'node:assert/strict';
import * as T from 'three';
import {MeshBVH,getBVHExtremes} from 'three-mesh-bvh';
import {createOwnerProof} from '../src/v2/owner-proof.js';

const option=(name,fallback)=>{const a=process.argv.find(a=>a.startsWith(`--${name}=`));if(!a)return fallback;const n=Number(a.slice(name.length+3));assert.ok(Number.isInteger(n)&&n>=0,`--${name} takes a whole number`);return n;};
const SCENES=option('scenes',300),SEED=option('seed',20261110);
// m: a ray that passes this close to a triangle's edge counts as stopped by it. The proof accepts a sight gap of 0.25 mm
// (OWNER_PROOF.slit: half a pixel from the near margin) between triangles a little off its plane, so the verifier must
// not call that a hole; the rest is float32 slack. A number of this check's own: loosening the proof's does not loosen
// the check. Every slit here is cut at least GAP wide (a neighbour lapping over it may narrow or close it) and every
// pinhole 0.8 mm, clear of it.
const TOL=2.75e-4,GAP=.0025;
const RANDOM=8,AIMS=100;      // random eyes and box points on top of the 27 of each grid; points aimed through, per proof
const SHARE=.5;               // of the scenes of a default-sized run, at least this share must produce a proof

// mulberry32: every scene comes from its seed alone (no Math.random anywhere in this file).
function rng(seed){
 let a=Math.imul(seed^0x9E3779B9,0x85EBCA6B)>>>0;
 const r=()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
 return Object.assign(r,{range:(lo,hi)=>lo+(hi-lo)*r(),int:(lo,hi)=>lo+Math.floor(r()*(hi-lo+1)),log:(lo,hi)=>lo*(hi/lo)**r(),sign:()=>r()<.5?-1:1,chance:p=>r()<p,pick:a=>a[Math.floor(r()*a.length)]});
}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const along=(a,d,t)=>[a[0]+d[0]*t,a[1]+d[1]*t,a[2]+d[2]*t],unit=a=>along([0,0,0],a,1/Math.hypot(...a));
const boxAt=(c,h)=>new T.Box3(new T.Vector3(c[0]-h[0],c[1]-h[1],c[2]-h[2]),new T.Vector3(c[0]+h[0],c[1]+h[1],c[2]+h[2]));
const cornersOf=b=>{const out=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])out.push([x,y,z]);return out;};
// The soup as the bake hands it to the proof (scripts/walk-owner-bake.page.js, setup): 9 floats a triangle, counter-
// clockwise seen from its front, with its side (0 front, 1 back, 2 both) and condition, under the same BVH (its maxLeafSize: 8 is this library's targetLeafSize). An empty
// soup still needs one (degenerate, far away) triangle for the BVH.
function occluders(tris){
 const n=Math.max(tris.length,1),positions=new Float32Array(n*9).fill(1e6),sides=new Uint8Array(n),conds=new Uint32Array(n);
 tris.forEach((t,f)=>{positions.set(t.p,f*9);sides[f]=t.side;conds[f]=t.cond;});
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));
 return {positions,sides,conds,bvh:new MeshBVH(g,{indirect:true,targetLeafSize:8})};
}

// ---- The verifier: plain arithmetic over the raw triangle list. Nothing in it uses the BVH or owner-proof.js.
// The stretch [t0,t1] of the line e+t*d that lies in a box {min,max}, or null.
function span(e,d,b){
 let t0=-Infinity,t1=Infinity;
 for(let k=0;k<3;k++){if(d[k]===0){if(e[k]<b.min[k]||e[k]>b.max[k])return null;continue;}const a=(b.min[k]-e[k])/d[k],c=(b.max[k]-e[k])/d[k];t0=Math.max(t0,Math.min(a,c));t1=Math.min(t1,Math.max(a,c));}
 return t0<=t1?[t0,t1]:null;
}
// Is q, a point of the plane of the triangle at P[o] (normal n), in the triangle or within TOL of it?
function within(P,o,nx,ny,nz,qx,qy,qz){
 let near=Infinity;
 for(let k=0;k<3;k++){const a=o+k*3,b=o+(k+1)%3*3,ex=P[b]-P[a],ey=P[b+1]-P[a+1],ez=P[b+2]-P[a+2],fx=qx-P[a],fy=qy-P[a+1],fz=qz-P[a+2];
  if(nx*(ey*fz-ez*fy)+ny*(ez*fx-ex*fz)+nz*(ex*fy-ey*fx)>=0)continue;    // on the inner side of this edge
  const t=Math.min(1,Math.max(0,(fx*ex+fy*ey+fz*ez)/(ex*ex+ey*ey+ez*ez))),gx=fx-ex*t,gy=fy-ey*t,gz=fz-ez*t;near=Math.min(near,gx*gx+gy*gy+gz*gz);}
 return near===Infinity||near<=TOL*TOL;
}
function caster({positions:P,sides,conds}){
 const n=sides.length,N=new Float64Array(n*3),X=new Float64Array(n*6);
 for(let f=0;f<n;f++){const o=f*9,ux=P[o+3]-P[o],uy=P[o+4]-P[o+1],uz=P[o+5]-P[o+2],vx=P[o+6]-P[o],vy=P[o+7]-P[o+1],vz=P[o+8]-P[o+2];
  N[f*3]=uy*vz-uz*vy;N[f*3+1]=uz*vx-ux*vz;N[f*3+2]=ux*vy-uy*vx;
  for(let k=0;k<3;k++){X[f*6+k]=Math.min(P[o+k],P[o+3+k],P[o+6+k])-TOL;X[f*6+3+k]=Math.max(P[o+k],P[o+3+k],P[o+6+k])+TOL;}}
 return {rays:0,
  // The triangles that count for a proof: drawn under one of its conditions, with some area, and reaching into the
  // box [lo,hi] (a sight line between two boxes stays inside the box around both).
  counted(used,lo,hi){const out=[];for(let f=0,x=0;f<n;f++,x+=6)if(used.has(conds[f])&&(N[f*3]||N[f*3+1]||N[f*3+2])&&X[x]<=hi[0]&&X[x+3]>=lo[0]&&X[x+1]<=hi[1]&&X[x+4]>=lo[1]&&X[x+2]<=hi[2]&&X[x+5]>=lo[2])out.push(f);return out;},
  // The first triangle of `list` that stops sight from e before it gets to p, or -1. A single-sided triangle stops it
  // only from the side it is drawn (front: the side its counter-clockwise normal points to).
  stopped(list,e,p){
   const ex=e[0],ey=e[1],ez=e[2],dx=p[0]-ex,dy=p[1]-ey,dz=p[2]-ez;
   for(let i=0;i<list.length;i++){const f=list[i],o=f*9,nx=N[f*3],ny=N[f*3+1],nz=N[f*3+2],s=nx*(ex-P[o])+ny*(ey-P[o+1])+nz*(ez-P[o+2]),side=sides[f];
    if(side===0?s<=0:side===1?s>=0:s===0)continue;
    const t=-s/(nx*dx+ny*dy+nz*dz);if(!(t>0&&t<1))continue;
    const qx=ex+dx*t,qy=ey+dy*t,qz=ez+dz*t,x=f*6;if(qx<X[x]||qx>X[x+3]||qy<X[x+1]||qy>X[x+4]||qz<X[x+2]||qz>X[x+5])continue;
    if(within(P,o,nx,ny,nz,qx,qy,qz))return f;}
   return -1;}};
}
// The first sampled sight line from the cell that reaches the box past every triangle counted for `used`, or null.
// `features`: points to aim through as well; `r`: where the random eyes and box points come from.
function seen(V,used,cell,box,features,r){
 const C={min:cell.min.toArray(),max:cell.max.toArray()},B={min:box.min.toArray(),max:box.max.toArray()},lo=C.min.map((x,k)=>Math.min(x,B.min[k])),hi=C.max.map((x,k)=>Math.max(x,B.max[k])),list=V.counted(used,lo,hi);
 // corners, edge and face midpoints and the centre, then random points inside
 const grid=b=>{const out=[];for(const x of [0,.5,1])for(const y of [0,.5,1])for(const z of [0,.5,1])out.push([b.min[0]+(b.max[0]-b.min[0])*x,b.min[1]+(b.max[1]-b.min[1])*y,b.min[2]+(b.max[2]-b.min[2])*z]);return out;};
 const eyes=grid(C),points=grid(B);for(let n=0;n<RANDOM;n++){eyes.push(C.min.map((x,k)=>r.range(x,C.max[k])));points.push(B.min.map((x,k)=>r.range(x,B.max[k])));}
 // Sight from e towards p as far as the box's surface: what lies inside the box cannot hide the box. An aimed p is a
 // point on the way (the line may miss the box); any other p is a point of the box.
 const sight=(e,p,aimed)=>{const d=sub(p,e),s=span(e,d,B);if(aimed&&!(s&&s[0]>0))return null;const end=along(e,d,s?aimed?s[0]:Math.min(s[0],1):1);V.rays++;return V.stopped(list,e,end)<0?{eye:e,point:end,via:aimed?'a ray aimed through '+JSON.stringify(p):'the grid of rays'}:null;};
 for(const e of eyes)for(const p of points){const got=sight(e,p);if(got)return got;}
 // Aimed through: of the points lying between the two, the AIMS/2 nearest the line from centre to centre (the likeliest
 // to be on a sight line), then as many of the rest at random.
 const mid=eyes[13],axis=sub(points[13],mid),l2=dot(axis,axis),aside=g=>{const d=sub(g,mid),x=along(d,axis,-Math.min(1,Math.max(0,dot(d,axis)/l2)));return dot(x,x);};
 const near=features.filter(g=>g.every((x,k)=>x>=lo[k]&&x<=hi[k])).map(g=>[aside(g),g]).sort((a,b)=>a[0]-b[0]).map(e=>e[1]);
 for(let i=0;i<AIMS&&i<near.length;i++){let g=near[i];if(i>=AIMS/2){const j=r.int(i,near.length-1);g=near[j];near[j]=near[i];near[i]=g;}
  for(let k=0;k<27;k++){const got=sight(eyes[k],g,true);if(got)return got;}
  // ... and back from the box through the same point, to wherever in the cell that line passes
  for(let k=0;k<27;k++){const p=points[k],d=sub(g,p),s=span(p,d,C);if(!s||s[1]<=1)continue;const got=sight(along(p,d,r.range(Math.max(s[0],1),s[1])),p);if(got)return got;}}
 return null;
}

// ---- The generator.
// A wall's frame: origin o, unit axes u and v in the wall and w across it (u x v = w). Square to the world's axes,
// turned about the vertical, a hair off an axis, or tilted freely; cells and boxes stay square to the world.
function frame(r,o){
 const m=r(),axis=k=>[0,1,2].map(i=>i===k?1:0),any=()=>{for(;;){const a=[r.range(-1,1),r.range(-1,1),r.range(-1,1)];if(Math.hypot(...a)>.2)return a;}};let kind,w,u;
 if(m<.35){const k=r.int(0,2),s=r.sign();kind='square';w=axis(k).map(x=>x&&x*s);u=axis((k+r.int(1,2))%3);}
 else if(m<.6){const a=r.range(0,2*Math.PI);kind='turned';w=[Math.cos(a),0,Math.sin(a)];u=r.chance(.8)?[0,1,0]:any();}
 else if(m<.72){kind='a hair off';w=unit(along(axis(r.int(0,2)),any(),r.log(1e-5,.02)));u=any();}
 else{kind='tilted';w=unit(any());u=any();}
 for(;;){const p=along(u,w,-dot(u,w));if(Math.hypot(...p)>.1){u=unit(p);break;}u=any();}
 const v=cross(w,u);
 return {kind,o,u,v,w,at:(a,b,c=0)=>[o[0]+u[0]*a+v[0]*b+w[0]*c,o[1]+u[1]*a+v[1]*b+w[1]*c,o[2]+u[2]*a+v[2]*b+w[2]*c],local:p=>{const d=sub(p,o);return [dot(d,u),dot(d,v),dot(d,w)];}};
}
// One patch of a wall: the rectangle [a0,a1] x [b0,b1] of frame F at height c, as a grid of quads (inner corners moved
// about, each quad split either way), drawn from side `face` of the wall (1: +w, -1: -w, 0: both). Also the points to
// aim rays at: on the patch, and just outside each edge, where a neighbour that stops short would let sight past.
function patch(r,S,F,[a0,a1,b0,b1],c,face,cond,fine,drawn=true){
 const aim=(a,b)=>S.features.push(F.at(a,b,c));
 aim((a0+a1)/2,(b0+b1)/2);aim(r.range(a0,a1),r.range(b0,b1));
 // about every 40 cm along each edge, 0.4 mm to 8 mm outside it
 const off=()=>r.pick([4e-4,.001,.003,.008]),steps=len=>Math.max(1,Math.min(12,Math.ceil(len/.4)));
 for(let n=steps(b1-b0);n--;){aim(a0-off(),r.range(b0,b1));aim(a1+off(),r.range(b0,b1));}
 for(let n=steps(a1-a0);n--;){aim(r.range(a0,a1),b0-off());aim(r.range(a0,a1),b1+off());}
 if(!drawn)return;
 const count=len=>Math.max(1,Math.min(Math.floor(len/.02),fine?r.int(4,12):r.pick([1,1,1,2,3,5]))),nu=count(a1-a0),nv=count(b1-b0),uneven=r.chance(.5);
 // Single-sided towards `face` either way round: a front face wound to face it, or a back face wound to face away.
 const back=face!==0&&r.chance(.5),side=face===0?2:back?1:0,up=face===0?r.sign():back?-face:face,g=[];
 for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){const inner=uneven&&i>0&&i<nu&&j>0&&j<nv;g.push(F.at(a0+(a1-a0)*(i+(inner?r.range(-.24,.24):0))/nu,b0+(b1-b0)*(j+(inner?r.range(-.24,.24):0))/nv,c).map(Math.fround));}
 const at=(i,j)=>g[i*(nv+1)+j],tri=(p,q,s)=>S.tris.push({p:up>0?[...p,...q,...s]:[...p,...s,...q],side,cond});
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const p=at(i,j),q=at(i+1,j),s=at(i+1,j+1),t=at(i,j+1);if(r.chance(.5)){tri(p,q,s);tri(p,s,t);}else{tri(p,q,t);tri(q,s,t);}}
}
// One flat wall of frame F at height c: the rectangle [u0,u1] x [v0,v1] cut into patches, each tiled on its own, drawn
// from one side or both and given one of `conds`. A patch may be flawed: missing (a hole), drawn from the far side only,
// stopping short of an edge (a slit), set off in depth (a step, whose riser is open), or pierced by a hole of a
// millimetre or a few. Not flaws: a patch that laps over its neighbours, or sits within the proof's plane tolerance of the
// wall's plane. A `long` wall is for looking along: many patches in a row, half of them off its plane by most of that
// tolerance and most lapping all round by millimetres, so that whether sight at a slope slips between two of them
// turns on the proof's slope bound.
function wall(r,S,F,c,[u0,u1],[v0,v1],{face,conds,flaws,fine,long}){
 const cuts=(lo,hi,n)=>{const out=[lo];for(const x of Array.from({length:n},()=>r.range(lo,hi)).sort((a,b)=>a-b))if(x-out.at(-1)>.1&&hi-x>.1)out.push(x);return [...out,hi];};
 const us=cuts(u0,u1,long?r.int(3,7):r.int(0,3)),vs=cuts(v0,v1,r.int(0,2)),mixed=r.chance(.4);
 for(let i=0;i+1<us.length;i++)for(let j=0;j+1<vs.length;j++){
  const edges=[us[i],us[i+1],vs[j],vs[j+1]],q=edges.slice(),flaw=r.chance(flaws)?r.pick(['hole','away','slit','step','pinhole']):null;let h=c;
  if(r.chance(long?.85:.25))for(let k=0;k<4;k++)if(long||r.chance(.5))q[k]+=(k%2?1:-1)*r.log(1e-4,long?.005:.3);
  if(r.chance(long?.5:.12))h+=r.sign()*r.log(long?6e-5:2e-5,9.5e-5);
  if(flaw==='slit'){const k=r.int(0,3);q[k]=edges[k]+(k%2?-1:1)*r.log(GAP,.08);}
  if(flaw==='step')h=c+r.sign()*r.log(3e-4,.03);
  const towards=flaw==='away'?-(face||r.sign()):face&&mixed&&r.chance(.3)?0:face,cond=r.pick(conds);
  if(flaw==='pinhole'){const e=r.log(4e-4,.002),x=r.range(q[0]+.02,q[1]-.02),y=r.range(q[2]+.02,q[3]-.02);S.features.push(F.at(x,y,h));for(const part of [[q[0],x-e,q[2],q[3]],[x+e,q[1],q[2],q[3]],[x-e,x+e,q[2],y-e],[x-e,x+e,y+e,q[3]]])patch(r,S,F,part,h,towards,cond,fine);}
  else patch(r,S,F,q,h,towards,cond,fine,flaw!=='hole');
  // A hole may be plugged by a patch of its own, under a condition of its own that the proof must then name: flush
  // with the hole, lapping over its rim, or short of the rim all round (a slit again).
  if(flaw==='hole'&&r.chance(.5)){const e=r.chance(.3)?0:r.chance(.7)?r.log(.001,.2):-r.log(GAP,.04);patch(r,S,F,[q[0]-e,q[1]+e,q[2]-e,q[3]+e],c+(r.chance(.3)?r.sign()*r.log(2e-5,9.5e-5):0),face,r.pick(conds),fine);}}
 return {us,vs};
}
// A main wall with cells on one side and boxes on the other, other walls about it, and loose triangles all around.
function cluster(r,S,o,pool,big,id){
 const F=frame(r,o),conds=Array.from({length:r.int(1,3)},()=>r.pick(pool)),long=r.chance(.15),hu=long?r.range(12,40):r.range(3,12),hv=r.range(2.5,7),s=r.sign(),face=r.chance(.3)?0:r.chance(.94)?s:-s;
 const look=f=>({face:f,conds,flaws:r.chance(.45)?0:r.range(.04,.2),fine:r.chance(big?.25:.08),long});
 let front=0,back=0,main,lap=null;   // how far other walls stand off the main one, towards the cells and towards the boxes
 // Staggered: the main wall stops at a, and one behind it carries on from `lap` before a. Only a split can prove across it.
 if(r.chance(.25)){const a=r.range(-hu*.6,hu*.6);lap=[a-r.range(.5,6),a];back=r.range(.3,2.5);main=wall(r,S,F,0,[-hu,a],[-hv,hv],look(face));wall(r,S,F,-s*back,[lap[0],hu],[-hv,hv],look(face));}
 else main=wall(r,S,F,0,[-hu,hu],[-hv,hv],look(face));
 // Partial covers standing off the main wall on either side, and a wall in a frame of its own cutting across.
 for(let n=r.pick([0,0,1,2]);n--;){const d=r.sign()*r.range(.3,3),cu=r.range(-hu,hu),cv=r.range(-hv,hv);wall(r,S,F,d,[cu-r.range(.3,hu),cu+r.range(.3,hu)],[cv-r.range(.3,hv),cv+r.range(.3,hv)],look(r.pick([0,s,s,-s])));if(d*s>0)front=Math.max(front,d*s);else back=Math.max(back,-d*s);}
 if(r.chance(.35))wall(r,S,frame(r,F.at(r.range(-hu,hu),r.range(-hv,hv),r.range(-3,3))),0,[-r.range(.5,4),r.range(.5,4)],[-r.range(.5,3),r.range(.5,3)],look(r.pick([0,1,-1])));
 // Loose triangles: nothing to prove with, but the BVH and the rays have to cope with them (a few have no area).
 for(let n=r.int(0,big?30:10);n--;){const m=F.at(r.range(-hu-2,hu+2),r.range(-hv-2,hv+2),r.range(-6,6)),size=r.log(.05,1.5),p=()=>m.map(x=>Math.fround(x+r.range(-size,size))),a=p();S.tris.push({p:[...a,...p(),...(r.chance(.08)?a:p())],side:r.int(0,2),cond:r.pick(pool)});}
 // Cells: the walk's 2 m cell, a block of them, or any box; a little under the near margin from the wall (never
 // provable), just over it, a room away or far off (by a long wall: close to it, to look along it). Often a
 // neighbouring cell too, which shares the boxes' hints.
 const reach=h=>Math.abs(F.w[0])*h[0]+Math.abs(F.w[1])*h[1]+Math.abs(F.w[2])*h[2],sizes=(...ranges)=>r.pick(ranges.map(([lo,hi])=>()=>r.range(lo,hi)))();
 const ch=(r.chance(.6)?[2,2,2]:r.chance(.5)?[2*r.int(1,3),2,2*r.int(1,3)]:[r.range(.4,5),r.range(.4,3),r.range(.4,5)]).map(x=>x/2);
 const cw=(r.chance(.85)?front:0)+(long?r.range(.5005,1.2):r.chance(.04)?r.range(.2,.499):sizes([.5005,.6],[.6,4],[.6,4],[4,25]))+reach(ch),cu=r.range(-hu,hu)*.85,cv=r.range(-hv,hv)*.85,cc=F.at(cu,cv,s*cw),cells=[boxAt(cc,ch)],targets=[];
 if(r.chance(.6)){const k=r.int(0,2),n=cc.slice();n[k]+=r.sign()*ch[k]*2;cells.push(boxAt(n,ch));}
 // Now and then a cell the wall cuts through: its eyes beyond the wall see the boxes.
 if(r.chance(.1))cells.push(boxAt(F.at(cu,cv,r.range(-.4,.4)),ch));
 // Boxes: thin, small or large; a little short of the margin behind the wall, just past it, near or far.
 for(let n=r.int(2,4);n--;){
  // Where two walls lap, half the boxes straddle the lap: long along the wall and close behind it, so that one wall
  // covers only a half or a quarter of each.
  const th=[0,1,2].map(()=>sizes([.03,.3],[.15,1.2],[.15,1.2],[1,4])/2),straddle=lap&&r.chance(.5);if(straddle)th[[0,1,2].sort((a,b)=>Math.abs(F.u[b])-Math.abs(F.u[a]))[0]]=r.range(1.5,3);
  const tw=(r.chance(.85)?back:0)+(straddle?r.range(.1505,.5):r.chance(.04)?r.range(.02,.149):sizes([.1505,.3],[.3,3],[.3,3],[3,30]))+reach(th),mode=r();
  // Seen from the cell's centre through a point of the wall: mostly far enough inside the wall for it to cover all
  // sight between the two (`fit`: about how wide that is at the wall), sometimes anywhere about it; where two walls
  // lap, often there; along a long wall, far enough along it for sight to cross it at a slope ...
  const fit=(tw*Math.hypot(...ch)+cw*Math.hypot(...th))/(cw+tw),room=h=>r.range(-1,1)*(mode<.1?h*1.5:Math.max(.2*h,h-fit));
  const qu=straddle||lap&&r.chance(.5)?r.range(...lap):long?Math.max(-hu*.95,Math.min(hu*.95,cu+r.sign()*r.range(8,30)*cw)):room(hu),qv=room(hv),t=[qu+(qu-cu)*tw/cw,qv+(qv-cv)*tw/cw,-s*tw];
  // ... or slid along the wall until the edge of what the wall must cover lands within a few cm of a patch boundary
  // or of the wall's own edge: just short of it, or poking past it.
  if(mode>.65){const k=r.int(0,1),dir=r.sign(),goal=dir*r.pick(k?main.vs:main.us)+r.sign()*r.log(.001,.15),cl=cornersOf(cells[0]).map(F.local),bl=cornersOf(boxAt(F.at(...t),th)).map(F.local);
   if(cl.every(p=>p[2]*s>0)&&bl.every(p=>p[2]*s<0)){const edge=x=>{let m=-Infinity;for(const p of cl)for(const b of bl)m=Math.max(m,dir*(p[k]+(b[k]+x-p[k])*p[2]/(p[2]-b[2])));return m;};
    let lo=-80,hi=80;for(let n=0;n<48;n++){const mid=(lo+hi)/2;if(edge(dir*mid)<goal)lo=mid;else hi=mid;}t[k]+=dir*lo;}}
  targets.push(boxAt(F.at(...t),th));}
 // As the bake does: cell by cell, each box under its own hint key; a single cell may be split, a block often not.
 for(const cell of cells)for(const [n,target] of targets.entries())S.pairs.push({cell,target,key:id+':'+n,depth:r.chance(.7)?undefined:r.int(0,1),kind:F.kind,normal:F.w});
 return {cells,targets};
}
function scene(seed){
 const r=rng(seed),big=r.chance(.05),S={seed,tris:[],features:[],pairs:[]},pool=Array.from({length:r.int(1,8)},(_,i)=>i*601+r.int(0,600)),groups=[];
 // Near the origin, or out where a ship's coordinates leave a float32 some 0.03 mm of noise.
 const o=r.chance(.3)?[r.range(-400,400),r.range(-60,60),r.range(-400,400)]:[r.range(-30,30),r.range(-30,30),r.range(-30,30)];
 for(let k=0,n=big?r.int(6,12):r.chance(.15)?2:1;k<n;k++)groups.push(cluster(r,S,[o[0]+k%4*r.range(24,40),o[1]+r.range(-3,3),o[2]+Math.floor(k/4)*r.range(24,40)],pool,big,k));
 // A cell of one group and a box of another: far apart, with whatever stands between.
 for(let n=groups.length>1?r.int(1,groups.length):0;n--;){const a=r.pick(groups),b=r.pick(groups);if(a!==b)S.pairs.push({cell:r.pick(a.cells),target:r.pick(b.targets),key:'far'+n,depth:undefined,kind:'across'});}
 // The bake's soup comes mesh by mesh; shuffled, each triangle's side and condition must still be found by its own index.
 if(r.chance(.5))for(let i=S.tris.length-1;i>0;i--){const j=r.int(0,i),t=S.tris[i];S.tris[i]=S.tris[j];S.tris[j]=t;}
 return S;
}

// ---- A refuted proof: what to run again, and the scene cut down to the triangles that still show it.
// Triangles are dropped while the same cell and box are still "proven" (from scratch, no hint) and the same ray still gets through.
function reduce(tris,pair,ray){
 const fails=t=>{const O=occluders(t),used=createOwnerProof(O).prove(pair.cell,pair.target,undefined,undefined,pair.depth);if(!used)return false;const V=caster(O),far=[Infinity,Infinity,Infinity];return V.stopped(V.counted(used,far.map(x=>-x),far),ray.eye,ray.point)<0;};
 if(!fails(tris))return null;
 for(let n=tris.length>>1||1;;n>>=1){for(let i=0;i<tris.length;){const t=[...tris.slice(0,i),...tris.slice(i+n)];if(fails(t))tris=t;else i+=n;}if(n<=1)break;}
 return tris;
}
function refuted(S,pair,used,ray){
 const show=b=>JSON.stringify([...b.min.toArray(),...b.max.toArray()]),small=reduce(S.tris,pair,ray);
 console.log(`FAIL seed ${S.seed}: the proof calls a box hidden that a sight line reaches. Again: node scripts/check-owner-proof-fuzz.mjs --seed=${S.seed} --scenes=1`);
 console.log(` cell ${show(pair.cell)}\n box ${show(pair.target)}\n depth ${pair.depth??'default'}, wall ${pair.kind}, ${S.tris.length} triangles, conditions returned ${JSON.stringify([...used].sort((a,b)=>a-b))}`);
 console.log(` eye ${JSON.stringify(ray.eye)}\n reaches ${JSON.stringify(ray.point)} (${ray.via})`);
 console.log(small?` cut down to ${small.length} triangles that still show it without a hint, as [9 floats, side, condition]:\n${small.map(t=>' '+JSON.stringify([...t.p,t.side,t.cond])).join('\n')}`:' it does not show without the hints of the pairs before it, so the scene is not cut down');
 assert.fail(`seed ${S.seed}: a proof is refuted by a sight line`);
}

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
// ---- The verifier has teeth: handed a wrong "proof" it finds the sight line, and it leaves a right one alone.
{const flat=(x0,x1,y0,y1,side=0,cond=0)=>[[x0,y0,0,x1,y0,0,x1,y1,0],[x0,y0,0,x1,y1,0,x0,y1,0]].map(p=>({p,side,cond}));    // in z=0, front towards +z
 const cell=boxAt([0,1,5],[1,1,1]),target=boxAt([0,1,-2.5],[.5,.5,.5]);
 const claim=(tris,conds,features=[])=>seen(caster(occluders(tris)),new Set(conds),cell,target,features,rng(1)),proven=tris=>{const used=createOwnerProof(occluders(tris)).prove(cell,target);return used&&[...used].sort();};
 const solid=flat(-10,10,-2,8,0,7);
 assert.deepEqual(proven(solid),[7]);assert.equal(claim(solid,[7]),null);pass('a solid wall is proven, and no ray gets past it');
 const slit=[...flat(-10,-.005,-2,8),...flat(.005,10,-2,8)];
 assert.equal(proven(slit),null);assert.ok(claim(slit,[0]));pass('a claim that a wall with a 1 cm slit in line with the box hides it is refuted');
 const away=flat(-10,10,-2,8,1);
 assert.equal(proven(away),null);assert.ok(claim(away,[0]));pass('a claim that a wall drawn from the far side only hides the box is refuted');
 const halves=[...flat(-10,0,-2,8,0,1),...flat(0,10,-2,8,2,2)];
 assert.deepEqual(proven(halves),[1,2]);assert.equal(claim(halves,[1,2]),null);assert.ok(claim(halves,[1]));assert.ok(claim(halves,[2]));pass('a claim that leaves out a condition it relies on is refuted');
 // What sampling cannot do, and what aiming is for: a 3 mm hole between the rays of the grid.
 const hx=.137,hy=1.213,e=.0015,pinhole=[...flat(-10,hx-e,-2,8),...flat(hx+e,10,-2,8),...flat(hx-e,hx+e,-2,hy-e),...flat(hx-e,hx+e,hy+e,8)];
 assert.equal(proven(pinhole),null);assert.equal(claim(pinhole,[0]),null);assert.ok(claim(pinhole,[0],[[hx,hy,0]]));pass('a 3 mm hole slips between the grid of rays (they confirm nothing) and is found by a ray aimed through it');
}

// ---- Random scenes.
const tally={proving:0,pairs:0,proven:0,rays:0,split:0,hinted:0,several:0,steep:0,large:0,biggest:0,deepest:0,kinds:{}},started=performance.now();
const slope=p=>{let m=0;for(const c of cornersOf(p.cell))for(const b of cornersOf(p.target)){const d=sub(b,c),n=Math.abs(dot(d,p.normal));m=Math.max(m,Math.sqrt(Math.max(0,dot(d,d)-n*n))/n);}return m;};
for(let i=0;i<SCENES;i++){
 const S=scene(SEED+i),O=occluders(S.tris),proof=createOwnerProof(O),V=caster(O),hint=new Map(),r=rng(SEED+i+0x5bd1e995);let any=false;
 for(const pair of S.pairs){
  const {splits,hinted}=proof.stats,used=proof.prove(pair.cell,pair.target,hint,pair.key,pair.depth);tally.pairs++;if(!used)continue;
  const ray=seen(V,used,pair.cell,pair.target,S.features,r);if(ray)refuted(S,pair,used,ray);
  any=true;tally.proven++;tally.kinds[pair.kind]=(tally.kinds[pair.kind]||0)+1;if(proof.stats.splits>splits)tally.split++;if(proof.stats.hinted>hinted)tally.hinted++;if(used.size>1)tally.several++;if(pair.normal&&slope(pair)>5)tally.steep++;}
 if(any)tally.proving++;tally.rays+=V.rays;if(S.tris.length>2000)tally.large++;tally.biggest=Math.max(tally.biggest,S.tris.length);tally.deepest=Math.max(tally.deepest,getBVHExtremes(O.bvh)[0].depth.max);
}
const pct=(a,b)=>b?Math.round(100*a/b)+'%':'-',num=n=>n.toLocaleString('en-US');
console.log(` ${num(tally.proven)} of ${num(tally.pairs)} cell and box pairs proven (${pct(tally.proven,tally.pairs)}), in ${num(tally.proving)} of ${num(SCENES)} scenes (${pct(tally.proving,SCENES)}); ${num(tally.rays)} rays cast, none past a proof; ${((performance.now()-started)/1000).toFixed(1)} s`);
console.log(` proofs by wall: ${Object.entries(tally.kinds).map(([k,n])=>k+' '+num(n)).join(', ')||'none'}; ${num(tally.split)} needed a split, ${num(tally.hinted)} came through a hint, ${num(tally.several)} named several conditions, ${num(tally.steep)} had sight sloping over 5 against the wall`);
console.log(` ${num(tally.large)} scenes over 2,000 triangles; the biggest ${num(tally.biggest)}, its BVH up to ${tally.deepest} deep`);
// A run in which the proof hardly ever says yes has checked next to nothing.
if(SCENES>=100)assert.ok(tally.proving>=SCENES*SHARE,`only ${tally.proving} of ${SCENES} scenes produced a proof: the generator no longer gives the proof much to say yes to`);
if(SCENES)pass(`${num(SCENES)} random scenes (seeds ${SEED} to ${SEED+SCENES-1}): no proof refuted`);
console.log(`owner proof fuzz: ${passed} checks passed`);
