import * as T from 'three';

// Reshapes the nose toward the concept sheet (concept-shape.js applies it before its other passes). On the saved hull
// the white band between the navy lip (top at y -12) and the lowest windows (y ~16) rose vertically for ~17 m, then
// bent sharply into the window slope, with small kinks that shaded as streaks. Each radial section of the nose now:
// - carries a fuller navy bumper: the band swells up to 1.5 m, widest at y -17, rounding over toward its top;
// - leans its white cheek inward at least 0.3 m per metre (about 17 degrees) from the windows down to the navy top
//   (y -12); where that needs the cheek's foot further out, the bumper grows with it so it stays the widest part;
// - from the navy band to the windows becomes its least outward-bulging envelope (the concave majorant of radius over
//   height), lightly rounded: no S-bend, so no near-vertical band and no kink.
// The hull only moves outward, so nothing inside comes closer to it.
// Sections are taken in vertical planes fanning out from a point aft of the bow (angle 0 straight ahead, 90 abeam) and
// faded in over x 110-165, so the midship sides are unchanged. Everything on the hull moves with it.

const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const HULL=/^Smooth_pressure_envelope/;
export const NOSE={cx:100,y0:-40,y1:20,step:2,fade:[110,165],bumper:{height:1.5,at:-17,spread:6},cheek:{from:-12,to:14,lean:.3},band:[-30,17],ends:[[-33,-28],[14,18]],round:1.5,blur:[1.5,1.5],onSurface:[4,1]};

// The outermost hull radius from (cx, 0) in plan, per angle (degrees) and metre of height, per side.
function sections(exterior,frame,{step=NOSE.step,dy=1,y0=NOSE.y0,y1=NOSE.y1}={}){
 const N=NOSE,m=new T.Matrix4(),v=new T.Vector3(),tris=[];
 exterior.traverse(o=>{if(!o.isMesh||!HULL.test(o.name))return;m.multiplyMatrices(frame,o.matrixWorld);const p=o.geometry.attributes.position,ix=o.geometry.index?.array,n=ix?ix.length:p.count,w=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);w[i*3]=v.x;w[i*3+1]=v.y;w[i*3+2]=v.z;}
  for(let t=0;t<n;t+=3){const q=[0,1,2].map(k=>{const i=(ix?ix[t+k]:t+k)*3;return [w[i],w[i+1],w[i+2]];});
   if(q.some(r=>r[0]<N.cx+5||r[1]<y0-6||r[1]>y1+6))continue;
   const side=Math.sign(q[0][2]);if(!side||q.some(r=>Math.sign(r[2])!==side))continue;
   const ang=q.map(r=>Math.atan2(Math.abs(r[2]),r[0]-N.cx)*180/Math.PI);tris.push({q,side,lo:Math.min(...ang),hi:Math.max(...ang)});}
 });
  const rows=Math.round((y1-y0)/dy)+1,cols=Math.round(90/step)+1,grid=[0,1].map(()=>Array.from({length:rows},()=>new Float64Array(cols).fill(NaN)));
 for(let c=0;c<cols;c++){const a=c*step,rad=a*Math.PI/180,dx=Math.cos(rad),dz=Math.sin(rad);
  for(const {q,side,lo,hi} of tris){if(a<lo-.01||a>hi+.01)continue;
   // Signed distance of each corner to the vertical plane through (cx, 0) along (dx, dz), in (x, |z|).
   const d=q.map(r=>Math.abs(r[2])*dx-(r[0]-N.cx)*dz);
   // The plane cuts the triangle along a segment; every row it spans gets its radius (not just its end points).
   const cut=[];for(let e=0;e<3;e++){const A=q[e],B=q[(e+1)%3],da=d[e],db=d[(e+1)%3];if((da>0)===(db>0)||da===db)continue;
    const t=da/(da-db),x=A[0]+(B[0]-A[0])*t,y=A[1]+(B[1]-A[1])*t,z=Math.abs(A[2]+(B[2]-A[2])*t);cut.push([y,(x-N.cx)*dx+z*dz]);}
   if(cut.length<2)continue;const [[ya,ra],[yb,rb]]=cut[0][0]<=cut[1][0]?cut:[cut[1],cut[0]],g=grid[side>0?0:1];
   for(let j=Math.max(0,Math.ceil((ya-y0)/dy-.5));j<=Math.min(rows-1,Math.floor((yb-y0)/dy+.5));j++){const y=Math.min(yb,Math.max(ya,y0+j*dy)),r=yb>ya?ra+(rb-ra)*(y-ya)/(yb-ya):Math.max(ra,rb);if(r>=10&&!(g[j][c]>=r))g[j][c]=r;}
  }}
 // The dead-ahead plane runs along the seam between the hull halves, so it can come back empty: fill across angles.
 for(const g of grid)for(let j=0;j<rows;j++)g[j]=Float64Array.from(fill(g[j]));
 return grid;
}
const fill=a=>{const o=Array.from(a);let last=NaN;for(let i=0;i<o.length;i++){if(Number.isFinite(o[i]))last=o[i];else o[i]=last;}last=NaN;for(let i=o.length-1;i>=0;i--){if(Number.isFinite(a[i]))last=a[i];else if(!Number.isFinite(o[i]))o[i]=last;}return o;};
function blur2(g,[sr,sc]){
 const k=s=>{const r=Math.ceil(3*s);return {r,w:Array.from({length:2*r+1},(_,i)=>Math.exp(-.5*((i-r)/s)**2))};};
 const pass=(get,set,len,n,{r,w})=>{for(let j=0;j<n;j++){const src=Array.from({length:len},(_,i)=>get(i,j));for(let i=0;i<len;i++){let a=0,s=0;for(let d=-r;d<=r;d++){const x=src[Math.min(len-1,Math.max(0,i+d))];a+=x*w[d+r];s+=w[d+r];}set(i,j,a/s);}}};
 const R=g.length,C=g[0].length;pass((i,j)=>g[j][i],(i,j,x)=>{g[j][i]=x;},C,R,k(sc));pass((i,j)=>g[i][j],(i,j,x)=>{g[i][j]=x;},R,C,k(sr));return g;
}
const sample=(g,fr,fc)=>{const R=g.length,C=g[0].length,r=Math.max(0,Math.min(R-1.001,fr)),c=Math.max(0,Math.min(C-1.001,fc)),i=Math.floor(r),j=Math.floor(c),a=r-i,b=c-j;
 return (g[i][j]*(1-b)+g[i][j+1]*b)*(1-a)+(g[i+1][j]*(1-b)+g[i+1][j+1]*b)*a;};

export function noseWarp(exterior,frame){
 const N=NOSE,{height:B,at:yb,spread:sb}=N.bumper,bump=y=>B*Math.exp(-(((y-yb)/sb)**2)),[ya,yz]=N.band,[[f0,f1],[t0,t1]]=N.ends;
 const radius=sections(exterior,frame);
 // Upper (outer) hull of the points (y, r): the least concave function above them.
 const majorant=(ys,rs)=>{const h=[];for(let i=0;i<ys.length;i++){while(h.length>=2){const [a,b]=[h.at(-2),h.at(-1)];if((rs[b]-rs[a])*(ys[i]-ys[a])<=(rs[i]-rs[a])*(ys[b]-ys[a]))h.pop();else break;}h.push(i);}
  return ys.map(y=>{let k=1;while(k<h.length-1&&ys[h[k]]<y)k++;const a=h[k-1],b=h[k];return rs[a]+(rs[b]-rs[a])*(y-ys[a])/(ys[b]-ys[a]||1);});};
 const offset=radius.map(g=>{const rows=g.length,cols=g[0].length,out=Array.from({length:rows},()=>new Float64Array(cols));
  for(let c=0;c<cols;c++){const col=fill(Array.from({length:rows},(_,j)=>g[j][c]));if(!col.every(Number.isFinite))continue;
   const {from:c0,to:c1,lean}=N.cheek,at=y=>col[y-N.y0],line=y=>at(c1)+lean*(c1-y),grow=Math.max(0,line(c0)-at(c0));
   const ys=[],rs=[];for(let y=ya;y<=yz;y++){ys.push(y);let r=at(y)+bump(y);
    if(y<=c0)r+=grow*smooth(ya,c0-2,y);else if(y<c1)r=Math.max(r,line(y));rs.push(r);}
   const env=majorant(ys,rs),r=Math.ceil(3*N.round),w=Array.from({length:2*r+1},(_,i)=>Math.exp(-.5*((i-r)/N.round)**2));
   const rounded=env.map((_,i)=>{let a=0,s=0;for(let d=-r;d<=r;d++){const k=Math.min(env.length-1,Math.max(0,i+d));a+=env[k]*w[d+r];s+=w[d+r];}return Math.max(a/s,rs[i]);});
   ys.forEach((y,i)=>{out[y-N.y0][c]=(rounded[i]-col[y-N.y0])*smooth(f0,f1,y)*(1-smooth(t0,t1,y));});}
  return blur2(out,N.blur);
 });
 const solid=radius.map(g=>g.map(row=>Array.from(row,x=>Number.isFinite(x)?x:0)));
 const warp=v=>{if(v.x<N.fade[0]||v.y<N.y0||v.y>N.y1)return;const a=Math.abs(v.z),rad=Math.atan2(a,v.x-N.cx),r=Math.hypot(v.x-N.cx,a),k=v.z>0?0:1,fr=v.y-N.y0,fc=rad*180/Math.PI/N.step;
  const R=sample(solid[k],fr,fc);
  const d=sample(offset[k],fr,fc)*smooth(...N.fade,v.x)*smooth(R-N.onSurface[0],R-N.onSurface[1],r);if(!d)return;
  v.x+=d*Math.cos(rad);v.z+=Math.sign(v.z)*d*Math.sin(rad);};
 return {warp,region:new T.Box3(new T.Vector3(N.fade[0],N.y0,-Infinity),new T.Vector3(Infinity,N.y1,Infinity)),radius,offset};
}

// The deck plates reach the hull wall in the nose too: their outlines follow the reshaping. The offsets travel with
// the exterior (userData.noseFairing, millimetres) so a baked exterior carries them.
export function packNose(offset){const rows=offset[0].length,cols=offset[0][0].length,mm=new Int16Array(2*rows*cols);
 offset.forEach((g,k)=>g.forEach((row,j)=>row.forEach((v,i)=>{mm[(k*rows+j)*cols+i]=Math.round(v*1000);})));
 let bin='';new Uint8Array(mm.buffer).forEach(b=>{bin+=String.fromCharCode(b);});return {rows,cols,mm:btoa(bin)};}
const SLAB=/^Deck_slab$/,SLAB_EDGE=[1.5,.3];
export function noseInterior(exterior,root,warpParts){
 const f=exterior.userData.noseFairing;if(!f)return 0;const N=NOSE,bin=atob(f.mm),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 const mm=new Int16Array(bytes.buffer),offset=[0,1].map(k=>Array.from({length:f.rows},(_,j)=>Array.from({length:f.cols},(_,i)=>mm[(k*f.rows+j)*f.cols+i]/1000)));
 let n=0;root.traverse(o=>{if(!o.isMesh||!SLAB.test(o.name)||!o.userData.outline?.length)return;n++;const pts=o.userData.outline;
  // The outline's radius from (cx, 0) by angle, as the nose's own sections are measured (it curves too steeply here
  // to compare widths at equal x). The tip closes on the centreline.
  const polar=[...pts.filter(([x])=>x>N.cx).map(([x,w])=>[Math.atan2(w,x-N.cx),Math.hypot(x-N.cx,w)]),[0,pts.at(-1)[0]-N.cx]].sort((p,q)=>p[0]-q[0]);
  const outline=t=>{if(t<=polar[0][0])return polar[0][1];for(let i=1;i<polar.length;i++)if(t<=polar[i][0]){const [a,ra]=polar[i-1],[b,rb]=polar[i];return ra+(rb-ra)*(t-a)/(b-a||1);}return polar.at(-1)[1];};
  warpParts([o],v=>{if(v.x<N.fade[0]||v.y<N.y0||v.y>N.y1)return;const a=Math.abs(v.z),rad=Math.atan2(a,v.x-N.cx),out=outline(rad),r=Math.hypot(v.x-N.cx,a);
   const d=sample(offset[v.z>0?0:1],v.y-N.y0,rad*180/Math.PI/N.step)*smooth(...N.fade,v.x)*smooth(out-SLAB_EDGE[0],out-SLAB_EDGE[1],r);if(!d)return;
   v.x+=d*Math.cos(rad);v.z+=Math.sign(v.z)*d*Math.sin(rad);});});
 return n;
}

// The hull's triangles around the window cut-outs below the lowest windows are thin slivers whose normals scatter, so
// the light rippled there in streaks. Across the band (navy top to the lowest windows' slope) each hull vertex's normal
// becomes the average of its neighbours' within ~2 m: smooth, but on the hull's real slope everywhere.
// The bow's seam strips (the chine and the panel reveals) floated 0.06-1 m off the hull there, by an amount that
// drifted along their length, which read as a wavy line; each now sits a constant distance off the outermost hull at its
// own height (the chine 0.2 m, as along the midship; the reveals 8 cm), its height unchanged.
// Full strength over y -18..2, fading out over 4 m beyond (a hard edge stretched the diagonal joints that cross it).
const SEAM_BAND={y0:-22,y1:6,dy:.25,step:1,ramp:4};
const BAND={x:110,y:[-20,28],fade:[[-16,-12],[22,26]],reach:5,sigma:2.5},SEAMS=/^(Continuous_chine|Bow_horizontal_panel_reveal|Bow_cheek_panel_joint)$/,STANDOFF={Continuous_chine:.2,default:.08};
function hullNeighbourhood(exterior,frame){
 const pts=[],m=new T.Matrix4(),nm=new T.Matrix3(),v=new T.Vector3(),n=new T.Vector3(),cells=new Map(),C=BAND.reach;
 exterior.traverse(o=>{if(!o.isMesh||!HULL.test(o.name)||!o.geometry.attributes.normal)return;m.multiplyMatrices(frame,o.matrixWorld);nm.getNormalMatrix(m);const p=o.geometry.attributes.position,q=o.geometry.attributes.normal;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);if(v.x<BAND.x-C||v.y<BAND.y[0]||v.y>BAND.y[1])continue;n.fromBufferAttribute(q,i).applyMatrix3(nm).normalize();
   // Outer skin only: the envelope also has an inner skin, which would pull averages inside.
   const rad=Math.hypot(v.x-NOSE.cx,v.z)||1;if((n.x*(v.x-NOSE.cx)+n.z*v.z)/rad<.2)continue;
   const k=pts.length;pts.push([v.x,v.y,v.z,n.x,n.y,n.z]);const key=`${Math.floor(v.x/C)},${Math.floor(v.y/C)},${Math.floor(v.z/C)}`;let c=cells.get(key);if(!c)cells.set(key,c=[]);c.push(k);}});
 // The outer skin near (x, y, z), same side only: Gaussian-weighted mean position and normal.
 return (x,y,z)=>{const P=new T.Vector3(),N=new T.Vector3();let w=0;const cx=Math.floor(x/C),cy=Math.floor(y/C),cz=Math.floor(z/C);
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)for(const id of cells.get(`${cx+i},${cy+j},${cz+k}`)||[]){const q=pts[id];
   if(Math.sign(q[2])!==Math.sign(z)&&Math.abs(z)>.5)continue;const d2=(q[0]-x)**2+(q[1]-y)**2+(q[2]-z)**2;if(d2>C*C)continue;const g=Math.exp(-d2/(2*BAND.sigma**2));P.x+=q[0]*g;P.y+=q[1]*g;P.z+=q[2]*g;N.x+=q[3]*g;N.y+=q[4]*g;N.z+=q[5]*g;w+=g;}
  return w?{p:P.divideScalar(w),n:N.normalize()}:null;};
}
export function smoothNoseBand(exterior,frame){
 const near=hullNeighbourhood(exterior,frame),S=SEAM_BAND,outer=sections(exterior,frame,S),
  // The outermost hull radius at a seam vertex's height and angle, interpolated (around the flank it changes ~1 m per
  // degree, so neighbouring bins are no stand-in).
  outerAt=(k,y,deg)=>sample(outer[k],(y-S.y0)/S.dy,deg/S.step),[[a0,a1],[b0,b1]]=BAND.fade,m=new T.Matrix4(),inv=new T.Matrix4(),toShip=new T.Matrix3(),toLocal=new T.Matrix3(),v=new T.Vector3(),n=new T.Vector3();
 straightenReveal(exterior,frame,outerAt);
 const hullAt=hullRadius(exterior,frame,[S.y0,S.y1]);
 exterior.traverse(o=>{if(!o.isMesh)return;const hull=HULL.test(o.name),seam=SEAMS.test(o.name);if(!hull&&!seam)return;
  const g=o.geometry,p=g.attributes.position,nor=g.attributes.normal;m.multiplyMatrices(frame,o.matrixWorld);inv.copy(m).invert();toShip.getNormalMatrix(m);toLocal.setFromMatrix4(m).transpose();
  const pos=new Float32Array(p.count*3),out=nor&&new Float32Array(nor.count*3);let changed=false;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);if(nor)n.fromBufferAttribute(nor,i);
   const fade=v.x<BAND.x?0:smooth(BAND.x,BAND.x+20,v.x),w=fade*smooth(a0,a1,v.y)*(1-smooth(b0,b1,v.y)),local=fade>0&&v.y>=BAND.y[0]&&v.y<=BAND.y[1]?near(v.x,v.y,v.z):null;
   if(local&&hull&&nor&&w>0){const s=n.clone().applyMatrix3(toShip).normalize();if(s.dot(local.n)>0){s.lerp(local.n,w).normalize();n.copy(s.applyMatrix3(toLocal).normalize());changed=true;}}
   // Seams: a constant distance off the outermost hull at their own height, radially (ray-cast; the grid is the fallback).
   if(seam&&fade>0&&v.y>S.y0&&v.y<S.y1){const yf=smooth(S.y0,S.y0+S.ramp,v.y)*(1-smooth(S.y1-S.ramp,S.y1,v.y));const k=v.z>0?0:1,a=Math.abs(v.z),r=Math.hypot(v.x-NOSE.cx,a),th=Math.atan2(a,v.x-NOSE.cx),h=hullAt(v.y,th,v.z>0?1:-1),R=Number.isFinite(h)?h:outerAt(k,v.y,th*180/Math.PI);
    if(Number.isFinite(R)){const d=(R+(STANDOFF[o.name]??STANDOFF.default)-r)*fade*yf;v.x+=d*Math.cos(th);v.z+=Math.sign(v.z)*d*Math.sin(th);changed=true;}}
   const l=v.clone().applyMatrix4(inv);pos[i*3]=l.x;pos[i*3+1]=l.y;pos[i*3+2]=l.z;if(out){out[i*3]=n.x;out[i*3+1]=n.y;out[i*3+2]=n.z;}}
  if(changed){o.geometry=g.clone();o.geometry.setAttribute('position',new T.BufferAttribute(pos,3));if(out&&hull)o.geometry.setAttribute('normal',new T.BufferAttribute(out,3));o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();}
 });
}

// The lower bow reveal (the dark line above the chine) was a run of short separate pieces stepping between heights
// (-9.75 to -8.25 m) with gaps, which read as a dashed, stepped line. Each side's run is replaced by one continuous
// strip at a constant gap off the hull, its height a smooth fit through the old pieces (it still rises gently aft).
const REVEAL={name:'Bow_horizontal_panel_reveal',below:-5,width:.22,gap:.1,step:.1,reach:3};
// The outer hull's radius at (y, th), by a ray cast inward from outside it, against only the hull triangles within reach of
// the line's heights (the section grid is too coarse here: between its samples the hull stood up to 0.2 m proud of the strip).
function hullRadius(exterior,frame,[y0,y1]){
 // Binned by angle about the bow axis (0.5 degree bins, each side), so a ray tests only the triangles it can cross.
 const BIN=.5,bins=new Map(),m=new T.Matrix4(),deg=v=>Math.atan2(Math.abs(v.z),v.x-NOSE.cx)*180/Math.PI;
 exterior.traverse(o=>{if(!o.isMesh||!HULL.test(o.name))return;m.multiplyMatrices(frame,o.matrixWorld);const p=o.geometry.attributes.position,ix=o.geometry.index;
  for(let t=0;t<(ix?ix.count:p.count);t+=3){const q=[0,1,2].map(n=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(t+n):t+n).applyMatrix4(m));
   if(Math.max(...q.map(v=>v.x))<NOSE.cx||Math.max(...q.map(v=>v.y))<y0||Math.min(...q.map(v=>v.y))>y1)continue;
   const zs=q.map(v=>v.z),sides=[...(Math.max(...zs)>0?[1]:[]),...(Math.min(...zs)<=0?[-1]:[])],a=q.map(deg);
   for(const side of sides)for(let b=Math.floor(Math.min(...a)/BIN);b<=Math.floor(Math.max(...a)/BIN);b++){const k=side*(b+1);(bins.get(k)??bins.set(k,[]).get(k)).push(q);}}});
 const ray=new T.Ray(),hit=new T.Vector3(),FAR=400;
 return (y,th,sgn)=>{ray.direction.set(-Math.cos(th),0,-sgn*Math.sin(th));ray.origin.set(NOSE.cx,y,0).addScaledVector(ray.direction,-FAR);let best=Infinity;
  // A triangle across the bow centreline is binned on both sides.
  for(const k of [sgn*(Math.floor(th*180/Math.PI/BIN)+1)])for(const [a,b,c] of bins.get(k)||[])if(ray.intersectTriangle(a,b,c,false,hit))best=Math.min(best,hit.distanceTo(ray.origin));
  return best<FAR?FAR-best:NaN;};
}
function straightenReveal(exterior,frame,outerAt){
 for(const side of ['Port_shell','Starboard_shell']){
  const group=exterior.getObjectByName(side),o=group&&(()=>{let m=null;group.traverse(x=>{if(x.isMesh&&x.name===REVEAL.name)m=x;});return m;})();if(!o)continue;
  const m=new T.Matrix4().multiplyMatrices(frame,o.matrixWorld),p=o.geometry.attributes.position,ix=o.geometry.index,keep=[],fit=[],v=new T.Vector3(),c=new T.Vector3();
  for(let t=0;t<(ix?ix.count:p.count);t+=3){c.set(0,0,0);const ids=[0,1,2].map(k=>ix?ix.getX(t+k):t+k);for(const i of ids)c.add(v.fromBufferAttribute(p,i).applyMatrix4(m));c.divideScalar(3);
   if(c.y<REVEAL.below){fit.push([Math.atan2(Math.abs(c.z),c.x-NOSE.cx),c.y]);}else keep.push(...ids);}
  if(fit.length<10)continue;
  // y = a + b th^2 (symmetric about the bow), least squares.
  let s0=0,s1=0,s2=0,t0=0,t1=0;for(const [th,y] of fit){const u=th*th;s0++;s1+=u;s2+=u*u;t0+=y;t1+=y*u;}const b=(s0*t1-s1*t0)/(s0*s2-s1*s1),a=(t0-b*s1)/s0;
  const thMax=Math.max(...fit.map(f=>f[0])),sgn=side==='Port_shell'?-1:1,k=sgn>0?0:1,pts=[],idx=[];
  const ys=fit.map(f=>f[1]),hull=hullRadius(exterior,frame,[Math.min(...ys)-REVEAL.reach,Math.max(...ys)+REVEAL.reach]);
  // The highest hull between this vertex and its neighbours' midpoints, so a bump narrower than a step can't poke through.
  const hullMax=(y,th)=>{let r=NaN;for(let e=-REVEAL.step/2;e<=REVEAL.step/2+1e-6;e+=REVEAL.step/2){const h=hull(y,Math.max(0,th+e*Math.PI/180),sgn);if(!(h<=r))r=Number.isFinite(h)?h:r;}return r;};
  for(let d=0,i=0;d<=thMax*180/Math.PI+1e-6;d+=REVEAL.step,i++){const th=Math.min(d*Math.PI/180,thMax),y=a+b*th*th;
   for(const dy of [-REVEAL.width/2,REVEAL.width/2]){const h=hullMax(y+dy,th),R=(Number.isFinite(h)?h:outerAt(k,y+dy,th*180/Math.PI))+REVEAL.gap;pts.push(NOSE.cx+R*Math.cos(th),y+dy,sgn*R*Math.sin(th));}
   if(i>0){const q=2*i;sgn>0?idx.push(q-2,q-1,q,q-1,q+1,q):idx.push(q-2,q,q-1,q-1,q,q+1);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pts,3));geo.setIndex(idx);geo.applyMatrix4(new T.Matrix4().multiplyMatrices(frame,group.matrixWorld).invert());geo.computeVertexNormals();
  const line=new T.Mesh(geo,o.material);line.name='Bow_reveal_line';group.add(line);line.updateMatrixWorld(true);
  // The old run goes; the upper reveal stays.
  const g=o.geometry.clone();g.setIndex(keep);o.geometry=g;
  // The panel joints' horizontal feet along this line, with gaps between them, read as a second, dashed copy of it:
  // joint triangles within the strip's band go (the strip covers it), so the diagonal joints run into one clean line.
  const band=REVEAL.width/2-.02;
  group.traverse(j=>{if(!j.isMesh||j.name!=='Bow_cheek_panel_joint')return;const jm=new T.Matrix4().multiplyMatrices(frame,j.matrixWorld),jp=j.geometry.attributes.position,jx=j.geometry.index,jk=[],c=new T.Vector3(),q=new T.Vector3();
   for(let t=0;t<(jx?jx.count:jp.count);t+=3){const ids=[0,1,2].map(k=>jx?jx.getX(t+k):t+k);c.set(0,0,0);for(const i of ids)c.add(q.fromBufferAttribute(jp,i).applyMatrix4(jm));c.divideScalar(3);
    const th=Math.atan2(Math.abs(c.z),c.x-NOSE.cx);if(!(c.x>NOSE.cx&&th<=thMax&&Math.abs(c.y-(a+b*th*th))<band))jk.push(...ids);}
   const jg=j.geometry.clone();jg.setIndex(jk);j.geometry=jg;});
 }
}
