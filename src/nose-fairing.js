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
export const NOSE={cx:100,y0:-40,y1:20,step:2,fade:[110,165],bumper:{height:1.5,at:-17,spread:6},cheek:{from:-12,to:14,lean:.3},shade:{band:[[-16,-12],[20,24]],blur:[2.5,1.5]},band:[-30,17],ends:[[-33,-28],[14,18]],round:1.5,blur:[1.5,1.5],onSurface:[4,1]};

// The outermost hull radius from (cx, 0) in plan, per angle (degrees) and metre of height, per side.
function sections(exterior,frame){
 const N=NOSE,m=new T.Matrix4(),v=new T.Vector3(),tris=[];
 exterior.traverse(o=>{if(!o.isMesh||!HULL.test(o.name))return;m.multiplyMatrices(frame,o.matrixWorld);const p=o.geometry.attributes.position,ix=o.geometry.index?.array,n=ix?ix.length:p.count,w=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);w[i*3]=v.x;w[i*3+1]=v.y;w[i*3+2]=v.z;}
  for(let t=0;t<n;t+=3){const q=[0,1,2].map(k=>{const i=(ix?ix[t+k]:t+k)*3;return [w[i],w[i+1],w[i+2]];});
   if(q.some(r=>r[0]<N.cx+5||r[1]<N.y0-6||r[1]>N.y1+6))continue;
   const side=Math.sign(q[0][2]);if(!side||q.some(r=>Math.sign(r[2])!==side))continue;
   const ang=q.map(r=>Math.atan2(Math.abs(r[2]),r[0]-N.cx)*180/Math.PI);tris.push({q,side,lo:Math.min(...ang),hi:Math.max(...ang)});}
 });
 const rows=Math.round((N.y1-N.y0))+1,cols=Math.round(90/N.step)+1,grid=[0,1].map(()=>Array.from({length:rows},()=>new Float64Array(cols).fill(NaN)));
 for(let c=0;c<cols;c++){const a=c*N.step,rad=a*Math.PI/180,dx=Math.cos(rad),dz=Math.sin(rad);
  for(const {q,side,lo,hi} of tris){if(a<lo-.01||a>hi+.01)continue;
   // Signed distance of each corner to the vertical plane through (cx, 0) along (dx, dz), in (x, |z|).
   const d=q.map(r=>Math.abs(r[2])*dx-(r[0]-N.cx)*dz);
   for(let e=0;e<3;e++){const A=q[e],B=q[(e+1)%3],da=d[e],db=d[(e+1)%3];if((da>0)===(db>0)||da===db)continue;
    const t=da/(da-db),x=A[0]+(B[0]-A[0])*t,y=A[1]+(B[1]-A[1])*t,z=Math.abs(A[2]+(B[2]-A[2])*t),r=(x-N.cx)*dx+z*dz;
    const j=Math.round(y-N.y0);if(j<0||j>=rows||r<10)continue;const g=grid[side>0?0:1][j];if(!(g[c]>=r))g[c]=r;}
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
 // The reshaped surface, smoothed further, gives the band's normals (smoothNoseNormals).
 const surface=solid.map((g,k)=>blur2(g.map((row,j)=>Array.from(row,(r,c)=>r+offset[k][j][c])),N.shade.blur));
 return {warp,surface,region:new T.Box3(new T.Vector3(N.fade[0],N.y0,-Infinity),new T.Vector3(Infinity,N.y1,Infinity)),radius,offset};
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
// the light rippled there in streaks. Across the band (navy top to just above the lowest windows) the hull's normals
// blend toward the normal of the smoothed reshaped surface; positions don't change.
export function smoothNoseNormals(exterior,frame,surface){
 const N=NOSE,[[a0,a1],[b0,b1]]=N.shade.band,m=new T.Matrix4(),inv=new T.Matrix4(),toShip=new T.Matrix3(),toLocal=new T.Matrix3(),v=new T.Vector3(),n=new T.Vector3(),f=new T.Vector3(),ty=new T.Vector3(),tt=new T.Vector3();
 const R=(k,y,deg)=>sample(surface[k],y-N.y0,deg/N.step),h=.5;
 exterior.traverse(o=>{if(!o.isMesh||!HULL.test(o.name))return;const g=o.geometry,p=g.attributes.position,nor=g.attributes.normal;if(!nor)return;
  m.multiplyMatrices(frame,o.matrixWorld);toShip.getNormalMatrix(m);toLocal.setFromMatrix4(m).transpose();const out=new Float32Array(nor.count*3);let changed=false;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);n.fromBufferAttribute(nor,i);
   const w=v.x<N.fade[0]?0:smooth(...N.fade,v.x)*smooth(a0,a1,v.y)*(1-smooth(b0,b1,v.y));
   if(w>0){const k=v.z>0?0:1,s=Math.sign(v.z)||1,a=Math.abs(v.z),th=Math.atan2(a,v.x-N.cx),deg=th*180/Math.PI,r=R(k,v.y,deg);
    // Surface (cx + r cos th, y, s r sin th): tangents along height and around the nose; their cross product points out.
    const ry=(R(k,v.y+h,deg)-R(k,v.y-h,deg))/(2*h),rt=(R(k,v.y,deg+h)-R(k,v.y,deg-h))/(2*h*Math.PI/180);
    ty.set(ry*Math.cos(th),1,s*ry*Math.sin(th));tt.set(rt*Math.cos(th)-r*Math.sin(th),0,s*(rt*Math.sin(th)+r*Math.cos(th)));f.crossVectors(ty,tt).normalize();
    if(f.x*Math.cos(th)+f.z*s*Math.sin(th)<0)f.negate();
    const ship=n.clone().applyMatrix3(toShip).normalize();if(ship.dot(f)>.3){ship.lerp(f,w).normalize();n.copy(ship.applyMatrix3(toLocal).normalize());changed=true;}}
   out[i*3]=n.x;out[i*3+1]=n.y;out[i*3+2]=n.z;}
  if(changed){o.geometry=g.clone();o.geometry.setAttribute('normal',new T.BufferAttribute(out,3));}
 });
}
