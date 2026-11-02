// Door intervals are clipped against every crossed wall segment, even when the
// door centre lies on another sampled segment of the same straight boundary.
export function entryHeader(a,b,door,width){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1e-9)return null;const centre=((door[0]-a[0])*dx+(door[2]-a[1])*dz)/len,dist=Math.abs((door[0]-a[0])*dz-(door[2]-a[1])*dx)/len,lo=Math.max(0,centre-width/2),hi=Math.min(len,centre+width/2);if(dist>.3||hi-lo<1e-8)return null;return [[a[0]+dx*lo/len,a[1]+dz*lo/len],[a[0]+dx*hi/len,a[1]+dz*hi/len]];}
export function entrySegments(a,b,door,width){const cut=entryHeader(a,b,door,width);if(!cut)return [[a,b]];return [[a,cut[0]],[cut[1],b]].filter(([p,q])=>Math.hypot(q[0]-p[0],q[1]-p[1])>.01);}
