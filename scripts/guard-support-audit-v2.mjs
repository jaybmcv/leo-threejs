import * as T from 'three';
// Independent audit of retained guard spans. The producer samples five lateral
// rays; a clipped tip can lie beside a floor strip narrower than their spacing.
// Search the same 0.40 m inboard allowance at 5 mm spacing. The vertical
// allowance remains 0.22 m, and every hit is on an actual floor triangle.
export function auditGuardSupport(rows,col,{step=.20,maxFloorGap=.22,stats={}}={}){
 const cast=(col.raycastGround||col.raycast).bind(col),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),out=[];
 const offsets=[0,...Array.from({length:80},(_,i)=>(i+1)*.005).flatMap(v=>[-v,v])];
 Object.assign(stats,{inputRows:rows.length,inputMetres:0,keptMetres:0,removed:[],maxSupportedOffset:0});
 for(const row of rows){
  const[d,axis,a,b,at,y,z1]=row,point=t=>axis===2?[a+(b-a)*t,at+(z1-at)*t]:axis?[at,a+(b-a)*t]:[a+(b-a)*t,at],p0=point(0),p1=point(1),length=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);if(length<.001)continue;
  const nx=-(p1[1]-p0[1])/length,nz=(p1[0]-p0[0])/length,n=Math.max(1,Math.ceil(length/step));stats.inputMetres+=length;
  const supported=t=>{const[x,z]=point(t);for(const offset of offsets){ray.origin.set(x+nx*offset,y+.25,z+nz*offset);const hit=cast(ray,.85);if(hit&&Math.abs(hit.point.y-y)<=maxFloorGap+1e-5){stats.maxSupportedOffset=Math.max(stats.maxSupportedOffset,Math.abs(offset));return true;}}return false;};
  let start=null,kept=0;for(let k=0;k<=n;k++){const lo=k/n,hi=Math.min(n,k+1)/n,keep=k<n&&supported(lo)&&supported((lo+hi)/2)&&supported(hi);if(keep&&start===null)start=lo;if(!keep&&start!==null){const span=(lo-start)*length;if(span>=.099){const p=point(start),q=point(lo);out.push(axis===2?[d,2,p[0],q[0],p[1],y,q[1]]:[d,axis,a+(b-a)*start,a+(b-a)*lo,at,y]);kept+=span;}start=null;}}
  stats.keptMetres+=kept;if(length-kept>.01)stats.removed.push({row,unsupportedMetres:length-kept});
 }
 stats.removedMetres=stats.inputMetres-stats.keptMetres;return out;
}
