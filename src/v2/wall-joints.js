// Slopes along a wall for each metre to its right. Door cuts keep square ends.
export function wallJoints(poly,i,a=poly[i],b=poly[(i+1)%poly.length]){
 const p=poly[i],q=poly[(i+1)%poly.length],len=Math.hypot(q[0]-p[0],q[1]-p[1]);if(len<1e-8)return [null,null];
 const t=[(q[0]-p[0])/len,(q[1]-p[1])/len],near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6;
 const slope=(v,step)=>{let k=i+(step>0?1:0),other;for(let j=0;j<poly.length;j++){k=(k+step+poly.length)%poly.length;other=poly[k];if(!near(v,other))break;}const dx=step<0?v[0]-other[0]:other[0]-v[0],dz=step<0?v[1]-other[1]:other[1]-v[1],n=Math.hypot(dx,dz),u=[dx/n,dz/n],cross=t[0]*u[1]-t[1]*u[0];return Math.abs(cross)<1e-8?0:(1-t[0]*u[0]-t[1]*u[1])/cross;};
 return [near(a,p)?slope(p,-1):null,near(b,q)?slope(q,1):null];
}

// Shear each end onto the shared bisector, leaving no internal end faces.
// Geometry is local to the wall: +X along it, +Z to its left.
export function mitreWallGeometry(g,joints,offset=0){
 const p=g.attributes.position,ix=g.index;g.computeBoundingBox();const {min,max}=g.boundingBox,keep=[];
 for(let i=0;i<(ix?.count??p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);if([0,1].some(k=>joints[k]!==null&&ids.every(id=>Math.abs(p.getX(id)-(k?max.x:min.x))<1e-7)))continue;keep.push(...ids);}
 g.setIndex(keep);g.clearGroups();const mid=(min.x+max.x)/2;
 for(let i=0;i<p.count;i++){const d=offset-p.getZ(i),s=joints[p.getX(i)<mid?0:1]??0;p.setXYZ(i,p.getX(i)+s*d,p.getY(i),-d);}
 p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
