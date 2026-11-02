// Where each v2 stair and lift sign hangs, from the plan alone (no DOM), so the walk and check-v2-signs agree.
// A wing stair's sign hangs across its wing corridor at the stair, two-faced, readable from both approaches; the
// old fixed +3.5 m z offset put every port-side wing stair's sign inside the cabin next door. Core stairs and lifts
// keep the old place, which the check shows is clear of cabins and rooms.
const segNear=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));const q=[a[0]+t*dx,a[1]+t*dz];return {q,d:Math.hypot(p[0]-q[0],p[1]-q[1]),dir:[dx,dz]};};
export const centroid=poly=>[poly.reduce((v,p)=>v+p[0],0)/poly.length,poly.reduce((v,p)=>v+p[1],0)/poly.length];
export const legacySignPlace=(layout,s)=>{const [x,z]=centroid(s.polygon);return {at:[x,layout.decks[s.deck-1].y+2.6,z+3.5],yaw:0,width:2.5,faces:1};};
export function signPlace(layout,s){
 if(s.wing===undefined){const place=legacySignPlace(layout,s);if(s.id==='forward_lift_1'&&s.deck===5)place.at[2]=8.4;return place;}
 const d=layout.decks[s.deck-1],c=centroid(s.polygon);let best=null;
 // Corridors from layout.circulation: the walk's v2-layout drops each deck's own corridor list.
 for(const r of layout.circulation.corridors.filter(r=>r.kind==='wing'&&r.deck===s.deck))for(let i=0;i<r.points.length-1;i++){const n=segNear(c,r.points[i],r.points[i+1]);if(!best||n.d<best.n.d)best={n,r};}
 if(!best)throw new Error(`No wing corridor beside ${s.id} on deck ${s.deck}`);
 const [dx,dz]=best.n.dir,len=Math.hypot(dx,dz);
 return {at:[best.n.q[0],d.y+2.6,best.n.q[1]],yaw:Math.atan2(dx/len,dz/len),width:Math.min(2.5,best.r.width-.6),faces:2,corridor:best.r.id};
}
export const signPlaces=layout=>[...layout.circulation.stairs,...layout.circulation.lifts].map(s=>({s,...signPlace(layout,s)}));
