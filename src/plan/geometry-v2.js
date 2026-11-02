export const EPS=1e-6;
export function rectangle(x,z,width,depth,yaw=0){const c=Math.cos(yaw),s=Math.sin(yaw);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+c*u*width/2+s*v*depth/2,z-s*u*width/2+c*v*depth/2]);}
export const bounds=p=>({x0:Math.min(...p.map(p=>p[0])),x1:Math.max(...p.map(p=>p[0])),z0:Math.min(...p.map(p=>p[1])),z1:Math.max(...p.map(p=>p[1]))});
export const rectPoly=r=>[[r.x0,r.z0],[r.x1,r.z0],[r.x1,r.z1],[r.x0,r.z1]];
export function overlaps(a,b,gap=0){
 const A=bounds(a),B=bounds(b);if(A.x1<=B.x0-gap+EPS||B.x1<=A.x0-gap+EPS||A.z1<=B.z0-gap+EPS||B.z1<=A.z0-gap+EPS)return false;
 for(const p of [a,b])for(let i=0;i<p.length;i++){
  const q=p[(i+1)%p.length],n=[q[1]-p[i][1],p[i][0]-q[0]],len=Math.hypot(...n);if(len<EPS)continue;
  const aa=a.map(v=>(v[0]*n[0]+v[1]*n[1])/len),bb=b.map(v=>(v[0]*n[0]+v[1]*n[1])/len);
  if(Math.max(...aa)<=Math.min(...bb)-gap+EPS||Math.max(...bb)<=Math.min(...aa)-gap+EPS)return false;
 }return true;
}
export function contains(poly,[x,z]){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j],cross=(x-a[0])*(b[1]-a[1])-(z-a[1])*(b[0]-a[0]);
 if(Math.abs(cross)<EPS&&x>=Math.min(a[0],b[0])-EPS&&x<=Math.max(a[0],b[0])+EPS&&z>=Math.min(a[1],b[1])-EPS&&z<=Math.max(a[1],b[1])+EPS)return true;
 if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;}
export const area=poly=>Math.abs(poly.reduce((a,p,i)=>{const q=poly[(i+1)%poly.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2;
export function distanceToSegment(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}
export function pathLength(points){const s=[0];for(let i=1;i<points.length;i++)s.push(s.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));return s;}
export function pathAt(points,s,d){let lo=0,hi=s.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(s[m]<d)lo=m;else hi=m;}const t=(d-s[lo])/(s[hi]-s[lo]||1),a=points[lo],b=points[hi];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
