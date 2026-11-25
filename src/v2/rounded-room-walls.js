const radius=.25,steps=8,near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6,obstacles=new WeakMap();

// Retained fittings can veto a corner; the finish pass uses the same decision.
export function setRoomCornerObstacles(room,boxes){obstacles.set(room,boxes);}
export function glassRoomEdge(r,a,b){return !!(r.outer||r.kind==='garden'||r.publicFront&&[a,b].every(q=>Math.abs((q[0]-r.door.center[0])*r.door.outward[0]+(q[1]-r.door.center[2])*r.door.outward[1])<.02));}
export function roomWallBoundary(r,input){
 if(r.deck!==2||r.openPlan)return {polygon:input,corners:[],skipped:[]};
 const ring=input.filter((q,i)=>!near(q,input[(i+input.length-1)%input.length])),poly=ring.filter((b,i)=>{const a=ring[(i+ring.length-1)%ring.length],c=ring[(i+1)%ring.length];return Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))>1e-6;}),polygon=[],corners=[],skipped=[],doors=[r.door,r.fittingDoor,...(r.galleryDoors||[]),...(r.bayAccessDoors||[])].filter(Boolean);
 for(let i=0;i<poly.length;i++){
  const q=poly[i],a=poly[(i+poly.length-1)%poly.length],b=poly[(i+1)%poly.length],la=Math.hypot(q[0]-a[0],q[1]-a[1]),lb=Math.hypot(b[0]-q[0],b[1]-q[1]),u=[(q[0]-a[0])/la,(q[1]-a[1])/la],v=[(b[0]-q[0])/lb,(b[1]-q[1])/lb];
  // Hull-grown vertices belong to the pressure facade, not this room-wall detail.
  if(Math.abs(u[0]*v[0]+u[1]*v[1])>1e-6||!glassRoomEdge(r,a,q)||!glassRoomEdge(r,q,b)||r.hullGrowth&&!r.hullGrowth.sourcePolygon.some(p=>near(p,q))){polygon.push(q);continue;}
  const doorway=doors.some(d=>{const dx=q[0]-d.center[0],dz=q[1]-d.center[2],n=d.outward;return n?Math.abs(dx*n[0]+dz*n[1])<.3&&Math.abs(-dx*n[1]+dz*n[0])<d.width/2+.3:Math.hypot(dx,dz)<d.width/2+.3;}),fixture=(obstacles.get(r)||[]).some(box=>q[0]>=box.min.x-.3&&q[0]<=box.max.x+.3&&q[1]>=box.min.z-.3&&q[1]<=box.max.z+.3),reason=doorway?'doorway':fixture?'fixture':Math.min(la,lb)<2*radius+.1?'short wall':null;
  if(reason){polygon.push(q);skipped.push({at:q,reason});continue;}
  const center=[q[0]-u[0]*radius+v[0]*radius,q[1]-u[1]*radius+v[1]*radius],turn=Math.sign(u[0]*v[1]-u[1]*v[0]),angle=Math.atan2(-v[1],-v[0]),points=Array.from({length:steps+1},(_,j)=>{const t=angle+turn*Math.PI/2*j/steps;return [center[0]+radius*Math.cos(t),center[1]+radius*Math.sin(t)];});
  polygon.push(...points);corners.push({at:q,center,radius,points,turn});
 }
 return {polygon,corners,skipped};
}
