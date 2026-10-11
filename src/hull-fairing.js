import * as T from 'three';

// Fairs two bumps out of the saved hull (concept-shape.js applies them before its other passes):
// - between x -110 and 0 the upper sides carry the remains of the hull's "diamond shoulder": they swell 1-2 m wider
//   than midship, kink at 22-26 m and S-bend; the swell above the midship half-width is removed and each cross-section
//   is smoothed up its height, which rounds the kinks off, blended back to the saved hull at both ends;
// - the crown drops ~7 m to the aft deck within ~5 m at x -57, and its outer edge humps beside it; the step becomes a
//   fair curve: along each line of the length, a cubic matching the hull's height and slope at x -95 and -25, which
//   cannot hump.
// Both are measured from the hull itself and applied as smooth displacement fields, so everything on the hull
// (windows, seams, decals) moves with it. Each returns the warp and the region it can touch.

const HULL=/^Smooth_pressure_envelope/,smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const SIDE={x0:-150,x1:75,y0:6,y1:55,midship:[50,70],fore:[20,40],aft:[-140,-120],yFrom:12,yFull:18,yTo:[50,54],creases:[14,18,34,40],outward:.3,soft:.25,section:3,blur:2.5,onSurface:[4,1]};
const CROWN={x0:-125,x1:0,z:48,from:-95,to:-25,slopeSpan:6,blur:2,zFade:[40,48],yFade:[38,44]};

// Triangles of the hull inside a box, in ship coordinates, binned on a 2 m grid over two of its axes.
function hullBins(exterior,frame,box,[u,w]){
 const bins=new Map(),m=new T.Matrix4(),v=new T.Vector3();
 exterior.traverse(o=>{if(!o.isMesh||!HULL.test(o.name))return;m.multiplyMatrices(frame,o.matrixWorld);const p=o.geometry.attributes.position,ix=o.geometry.index?.array,n=ix?ix.length:p.count,world=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);world.set([v.x,v.y,v.z],i*3);}
  for(let t=0;t<n;t+=3){const q=[0,1,2].map(k=>{const i=(ix?ix[t+k]:t+k)*3;return [world[i],world[i+1],world[i+2]];});
   if(q.some(r=>!box.containsPoint(v.set(...r))))continue;
   const lo=k=>Math.floor(Math.min(...q.map(r=>r[k]))/2),hi=k=>Math.floor(Math.max(...q.map(r=>r[k]))/2);
   for(let a=lo(u);a<=hi(u);a++)for(let b=lo(w);b<=hi(w);b++){const key=a*4096+b;let list=bins.get(key);if(!list)bins.set(key,list=[]);list.push(q);}
  }});
 // The surface's extreme value of axis `h` over (U, W), among triangles passing `keep`.
 return (U,W,h,keep,pick=Math.max)=>{let best=NaN;for(const q of bins.get(Math.floor(U/2)*4096+Math.floor(W/2))||[]){if(keep&&!keep(q))continue;
  const [a,b,c]=q,den=(b[w]-c[w])*(a[u]-c[u])+(c[u]-b[u])*(a[w]-c[w]);if(Math.abs(den)<1e-9)continue;
  const l1=((b[w]-c[w])*(U-c[u])+(c[u]-b[u])*(W-c[w]))/den,l2=((c[w]-a[w])*(U-c[u])+(a[u]-c[u])*(W-c[w]))/den,l3=1-l1-l2;if(Math.min(l1,l2,l3)<-1e-6)continue;
  const val=l1*a[h]+l2*b[h]+l3*c[h];best=Number.isNaN(best)?val:pick(best,val);}return best;};
}
// Grid helpers: rows of samples, gaps filled along the row, a separable Gaussian blur, bilinear lookup.
const fillRow=r=>{const out=r.slice();let last=NaN;for(let i=0;i<out.length;i++){if(Number.isFinite(out[i]))last=out[i];else out[i]=last;}last=NaN;for(let i=out.length-1;i>=0;i--){if(Number.isFinite(r[i]))last=r[i];else if(!Number.isFinite(out[i]))out[i]=last;}return out;};
function blur(g,s,axes=[0,1]){
 const r=Math.ceil(3*s),k=Array.from({length:2*r+1},(_,i)=>Math.exp(-.5*((i-r)/s)**2));
 const pass=(get,len,set,n)=>{for(let j=0;j<n;j++){const src=Array.from({length:len},(_,i)=>get(i,j));for(let i=0;i<len;i++){let a=0,wsum=0;for(let d=-r;d<=r;d++){const v=src[Math.min(len-1,Math.max(0,i+d))];if(!Number.isFinite(v))continue;a+=v*k[d+r];wsum+=k[d+r];}set(i,j,wsum?a/wsum:0);}}};
 const rows=g.length,cols=g[0].length;
 if(axes.includes(1))pass((i,j)=>g[j][i],cols,(i,j,v)=>{g[j][i]=v;},rows);
 if(axes.includes(0))pass((i,j)=>g[i][j],rows,(i,j,v)=>{g[i][j]=v;},cols);
 return g;
}
const bilinear=(g,u0,w0,U,W)=>{const fu=Math.max(0,Math.min(g[0].length-1.001,U-u0)),fw=Math.max(0,Math.min(g.length-1.001,W-w0)),i=Math.floor(fu),j=Math.floor(fw),a=fu-i,b=fw-j;
 return (g[j][i]*(1-a)+g[j][i+1]*a)*(1-b)+(g[j+1][i]*(1-a)+g[j+1][i+1]*a)*b;};

export function fairingWarps(exterior,frame){
 // Sides: half-width |z|(x, y) per side; the target is the midship section, blended in along the length, then blurred.
 // Only points on (within a few metres of) the side surface move, so the crown and the deck behind it don't.
 const S=SIDE,sideAt=hullBins(exterior,frame,new T.Box3(new T.Vector3(S.x0-5,S.y0-3,-Infinity),new T.Vector3(S.x1+15,S.y1+3,Infinity)),[0,1]);
 const sample=sign=>{const g=[];for(let y=S.y0;y<=S.y1;y++){const row=[];for(let x=S.x0;x<=S.x1;x++)row.push(Math.abs(sideAt(x,y,2,q=>q.every(r=>Math.sign(r[2])===sign&&Math.abs(r[2])>12),sign>0?Math.max:Math.min)));g.push(fillRow(row));}return g;};
 const width=[sample(1),sample(-1)];
 // The swell e above the midship half-width goes by e²/(e+k): nothing at or below it moves, and the slope stays smooth.
 const swell=(e,k)=>e>0?e*e/(e+k):0;
 const side=width.map(g=>{
  if(S.midship[1]>S.x1)throw new Error('The fairing grid must reach the midship reference');
  const capped=g.map(row=>{const ms=row.slice(S.midship[0]-S.x0,S.midship[1]-S.x0+1).filter(Number.isFinite).sort((a,b)=>a-b),mid=ms[ms.length>>1];return row.map(w=>Number.isFinite(w)&&Number.isFinite(mid)?w-swell(w-mid,S.soft):w);});
  // Rounding up the height only in the crease band; above it the sections turn hard into the crown, which it would bulge.
  const rounded=blur(capped.map(r=>r.slice()),S.section,[0]),[c0,c1,c2,c3]=S.creases;
  return blur(g.map((row,j)=>{const y=S.y0+j,band=smooth(c0,c1,y)*(1-smooth(c2,c3,y));return row.map((w,i)=>{const x=S.x0+i,c=capped[j][i];if(!Number.isFinite(w)||!Number.isFinite(c)||!Number.isFinite(rounded[j][i]))return 0;
   return Math.min(S.outward,(c+(rounded[j][i]-c)*band-w))*smooth(...S.aft,x)*(1-smooth(...S.fore,x))*smooth(S.yFrom,S.yFull,y)*(1-smooth(...S.yTo,y));});}),S.blur);
 });
 const fairSides=v=>{if(v.x<S.x0||v.x>S.x1||v.y<S.y0||v.y>S.y1)return;const k=v.z>0?0:1,a=Math.abs(v.z),w=bilinear(width[k],S.x0,S.y0,v.x,v.y);if(!Number.isFinite(w))return;
  v.z+=Math.sign(v.z)*bilinear(side[k],S.x0,S.y0,v.x,v.y)*smooth(w-S.onSurface[0],w-S.onSurface[1],a);};
 // Crown: top height y(x, z); between `from` and `to` each line along the length becomes a Hermite cubic.
 const C=CROWN,topAt=hullBins(exterior,frame,new T.Box3(new T.Vector3(C.x0-25,30,-C.z-4),new T.Vector3(C.x1+25,Infinity,C.z+4)),[0,2]);
 const top=[];for(let z=-C.z;z<=C.z;z++){const row=[];for(let x=C.x0-20;x<=C.x1+20;x++)row.push(topAt(x,z,1));top.push(fillRow(row));}
 const at=(row,x)=>row[Math.round(x)-(C.x0-20)],L=C.to-C.from,h=C.slopeSpan;
 const lift=blur(top.map((row,j)=>{const z=-C.z+j,ya=at(row,C.from),yb=at(row,C.to),ma=(ya-at(row,C.from-h))/h,mb=(at(row,C.to+h)-yb)/h;
  return row.map((y,i)=>{const x=C.x0-20+i;if(x<=C.from||x>=C.to||![y,ya,yb,ma,mb].every(Number.isFinite))return 0;
   const t=(x-C.from)/L,curve=(2*t**3-3*t*t+1)*ya+(t**3-2*t*t+t)*L*ma+(-2*t**3+3*t*t)*yb+(t**3-t*t)*L*mb;
   return (curve-y)*(1-smooth(...C.zFade,Math.abs(z)));});}),C.blur);
 const fairCrown=v=>{if(v.y<C.yFade[0]||v.x<C.x0||v.x>C.x1||Math.abs(v.z)>C.z)return;v.y+=bilinear(lift,C.x0-20,-C.z,v.x,v.z)*smooth(...C.yFade,v.y);};
 return {grid:{x0:S.x0,y0:S.y0,cols:S.x1-S.x0+1,rows:S.y1-S.y0+1,side},fairSides,fairCrown,sideRegion:new T.Box3(new T.Vector3(S.x0,S.y0,-Infinity),new T.Vector3(S.x1,S.y1,Infinity)),crownRegion:new T.Box3(new T.Vector3(C.x0,C.yFade[0],-C.z),new T.Vector3(C.x1,Infinity,C.z))};
}

// The deck plates reach the hull wall, so their edges follow the faired sides. The side offsets travel with the exterior
// (userData.hullFairing, in millimetres) so a baked exterior still carries them.
// Only the plate's outer outline moves: vertices within a metre or so of its outline (holes cut for the commons on
// Decks 18-19 keep their edges).
const SLAB=/^Deck_slab$/,SLAB_EDGE=[1.5,.3];
export function packFairing({x0,y0,cols,rows,side}){const mm=new Int16Array(2*rows*cols);side.forEach((g,k)=>g.forEach((row,j)=>row.forEach((v,i)=>{mm[(k*rows+j)*cols+i]=Math.round(v*1000);})));
 let bin='';new Uint8Array(mm.buffer).forEach(b=>{bin+=String.fromCharCode(b);});return {x0,y0,cols,rows,mm:btoa(bin)};}
export function fairInterior(exterior,root,warpParts){
 const f=exterior.userData.hullFairing;if(!f)return 0;const bin=atob(f.mm),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 const mm=new Int16Array(bytes.buffer),grid=k=>Array.from({length:f.rows},(_,j)=>Array.from({length:f.cols},(_,i)=>mm[(k*f.rows+j)*f.cols+i]/1000)),side=[grid(0),grid(1)];
 const x1=f.x0+f.cols-1,y1=f.y0+f.rows-1;
 const slabs=[];root.traverse(o=>{if(o.isMesh&&SLAB.test(o.name))slabs.push(o);});
 for(const o of slabs){
  // The plate's outline half-width at x, interpolated from the points it was cut from (model.js, ship x and z).
  const pts=o.userData.outline;if(!pts?.length)continue;
  const outline=v=>{const x=v.x;if(x<=pts[0][0])return pts[0][1];for(let i=1;i<pts.length;i++)if(x<=pts[i][0]){const [a,wa]=pts[i-1],[b,wb]=pts[i];return wa+(wb-wa)*(x-a)/(b-a||1);}return pts.at(-1)[1];};
  warpParts([o],v=>{if(v.x<f.x0||v.x>x1||v.y<f.y0||v.y>y1)return;const out=outline(v);v.z+=Math.sign(v.z)*bilinear(side[v.z>0?0:1],f.x0,f.y0,v.x,v.y)*smooth(out-SLAB_EDGE[0],out-SLAB_EDGE[1],Math.abs(v.z));});
 }
 return slabs.length;
}
