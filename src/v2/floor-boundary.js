import {ShapeUtils,Vector2} from 'three';
// Trace the boundary of the exact vertical decomposition. Adjacent cells share
// edges, so their internal sweep lines never become floor faces or slab sides.
export function boundaryRings(segments){
 // Cells by x, then z: the same buckets as an "x,z" string key (both treat -0 as 0 and NaN as one key).
 const nodes=[],bins=new Map(),eps=1e-7,cell=(x,z)=>bins.get(x)?.get(z);
 const node=q=>{const x=Math.floor(q[0]/eps),z=Math.floor(q[1]/eps);for(let a=x-1;a<=x+1;a++)for(let b=z-1;b<=z+1;b++)for(const n of cell(a,b)||[])if(Math.hypot(n.q[0]-q[0],n.q[1]-q[1])<=eps)return n;const n={q,id:nodes.length,out:[]};nodes.push(n);let row=bins.get(x);if(!row)bins.set(x,row=new Map());(row.get(z)||row.set(z,[]).get(z)).push(n);return n;};
 const edges=[];for(const [a,b]of segments){const A=node(a),B=node(b);if(A===B)continue;const e={a:A,b:B,used:false};A.out.push(e);edges.push(e);}
 const rings=[];for(const start of edges){if(start.used)continue;const ring=[],seen=new Set();let e=start;while(true){if(e.used||seen.has(e))throw Error('Non-manifold floor boundary');seen.add(e);e.used=true;ring.push(e.a.q);if(e.b===start.a)break;const incoming=[e.b.q[0]-e.a.q[0],e.b.q[1]-e.a.q[1]],candidates=e.b.out.filter(n=>!n.used);if(!candidates.length)throw Error('Unclosed floor boundary at '+e.b.q);e=candidates.sort((a,b)=>{const turn=n=>{const d=[n.b.q[0]-n.a.q[0],n.b.q[1]-n.a.q[1]];return Math.atan2(incoming[0]*d[1]-incoming[1]*d[0],incoming[0]*d[0]+incoming[1]*d[1]);};return turn(b)-turn(a);})[0];}
 // Drops the first straight-through point, then looks again. Points before the one dropped kept their neighbours and
 // were already kept, so the look resumes just before it (from the start when the last point goes, since the first
 // point's neighbour changes): the same points go, in the same order, as rescanning from the start each time.
 for(let i=0;ring.length>3&&i<ring.length;){const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],cross=Math.abs(u[0]*v[1]-u[1]*v[0]);if(cross<=eps*Math.max(Math.hypot(...u),Math.hypot(...v))&&u[0]*v[0]+u[1]*v[1]>=0){const last=i===ring.length-1;ring.splice(i,1);i=last?0:Math.max(0,i-1);}else i++;}
 if(ring.length>=3&&Math.abs(signedArea(ring))>1e-10)rings.push(ring);
 }return rings;
}
export const signedArea=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2;
const contains=(p,q)=>{let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
export function triangulateFloor(rings){const outer=rings.filter(p=>signedArea(p)>0).map(p=>({ring:p,holes:[]}));for(const hole of rings.filter(p=>signedArea(p)<0)){const parent=outer.filter(p=>contains(p.ring,hole[0])).sort((a,b)=>signedArea(a.ring)-signedArea(b.ring))[0];if(!parent)throw Error('Floor hole has no owner');parent.holes.push(hole);}return outer.flatMap(({ring,holes})=>{const points=[...ring,...holes.flat()],faces=ShapeUtils.triangulateShape(ring.map(q=>new Vector2(...q)),holes.map(h=>h.map(q=>new Vector2(...q))));return faces.map(f=>f.map(i=>points[i]));});}

// Crossing mask edges are sweep events too; overlapping holes form a union.
// A pair is keyed by number (earlier edge * edge count + later edge) and the same arithmetic runs on plain numbers, so
// the events and their order are unchanged.
export function floorEvents(rings){const edgeCount=rings.reduce((n,p)=>n+p.length,0),pairKey=edgeCount<67108864?(f,e)=>f*edgeCount+e:(f,e)=>f+','+e,events=new Set(rings.flatMap(p=>p.map(q=>q[0]))),bins=new Map(),seen=new Set();let index=0;for(const p of rings)for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],e={a,b,index:index++},lo=[Math.min(a[0],b[0]),Math.min(a[1],b[1])],hi=[Math.max(a[0],b[0]),Math.max(a[1],b[1])];for(let x=Math.floor(lo[0]/8);x<=Math.floor(hi[0]/8);x++)for(let z=Math.floor(lo[1]/8);z<=Math.floor(hi[1]/8);z++){const key=x+','+z,list=bins.get(key)||[];for(const f of list){const pair=pairKey(f.index,e.index);if(seen.has(pair))continue;seen.add(pair);const u0=b[0]-a[0],u1=b[1]-a[1],v0=f.b[0]-f.a[0],v1=f.b[1]-f.a[1],w0=f.a[0]-a[0],w1=f.a[1]-a[1],den=u0*v1-u1*v0;if(Math.abs(den)<1e-12)continue;const t=(w0*v1-w1*v0)/den,q=(w0*u1-w1*u0)/den;if(t>1e-9&&t<1-1e-9&&q>1e-9&&q<1-1e-9)events.add(a[0]+t*u0);}list.push(e);bins.set(key,list);}}return [...events].sort((a,b)=>a-b);}
