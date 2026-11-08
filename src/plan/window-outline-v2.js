// Rounded window outlines. A chart opening is [u0,u1,y0,y1] or [u0,u1,y0,y1,radius]; the optional fifth number rounds
// its corners (a JSON-safe field, so it travels with the rect through layout.json, hydration and every cut). Each rounded
// corner is SEGMENTS chords of its quarter circle, so the outline is one convex polygon: the rect's four sides plus the
// chord lines. A radius of 0 (every cabin and legacy window) adds no planes and leaves every path exactly as before.
import {clipPolygon,triangulate} from './hull-skin-v2.js';
export const SEGMENTS=6;
export const openingRadius=o=>Math.max(0,Math.min(o[4]||0,(o[1]-o[0])/2,(o[3]-o[2])/2));
// Half-planes [a,b,c] (a*u+b*y+c >= 0 inside) of the chord lines, corner by corner, in outline order.
export function cornerPlanes(o){const r=openingRadius(o);if(!(r>0))return [];const out=[];
 for(const [cu,cy,su,sy]of [[o[0]+r,o[2]+r,-1,-1],[o[1]-r,o[2]+r,1,-1],[o[1]-r,o[3]-r,1,1],[o[0]+r,o[3]-r,-1,1]])
  for(let k=0;k<SEGMENTS;k++){const a0=k/SEGMENTS*Math.PI/2,a1=(k+1)/SEGMENTS*Math.PI/2,mid=(a0+a1)/2,n=[-su*Math.cos(mid),-sy*Math.sin(mid)],p=[cu+su*r*Math.cos(a0),cy+sy*r*Math.sin(a0)];
   out.push([n[0],n[1],-(n[0]*p[0]+n[1]*p[1])]);}
 return out;}
// The same chords as chart-prism planes for cutChartMany ([a,b,c,d]: a*u+b*y+c*v+d >= 0).
export const cornerChartPlanes=(o,inset=0)=>cornerPlanes(o).map(([a,b,c])=>[a,b,0,c-inset]);
// Outline vertices, counter-clockwise in (u,y).
export function outlinePoints(o){const r=openingRadius(o);if(!(r>0))return [[o[0],o[2]],[o[1],o[2]],[o[1],o[3]],[o[0],o[3]]];const out=[];
 for(const [cu,cy,start]of [[o[1]-r,o[2]+r,-Math.PI/2],[o[1]-r,o[3]-r,0],[o[0]+r,o[3]-r,Math.PI/2],[o[0]+r,o[2]+r,Math.PI]])
  for(let k=0;k<=SEGMENTS;k++){const a=start+k/SEGMENTS*Math.PI/2;out.push([cu+r*Math.cos(a),cy+r*Math.sin(a)]);}
 return out;}
export const outlineArea=o=>{const q=outlinePoints(o);return Math.abs(q.reduce((s,a,i)=>{const b=q[(i+1)%q.length];return s+a[0]*b[1]-a[1]*b[0];},0))/2;};
export const insideOutline=(q,o,pad=0)=>q[0]>=o[0]-pad&&q[0]<=o[1]+pad&&q[1]>=o[2]-pad&&q[1]<=o[3]+pad&&cornerPlanes(o).every(([a,b,c])=>a*q[0]+b*q[1]+c>=-pad);
// Clip a polygon of [u,y,...] points (all components interpolated) to one half-plane; sign -1 keeps the outside.
export function clipHalf(poly,[a,b,c],sign=1){const out=[],d=q=>{const v=sign*(a*q[0]+b*q[1]+c);return Math.abs(v)<1e-9?0:v;},push=q=>{if(!out.length||Math.hypot(...q.slice(0,3).map((v,k)=>v-out.at(-1)[k]))>1e-9)out.push(q);};
 for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=d(p),dq=d(q);if(dp>=0)push(p);if(dp*dq<0){const t=dp/(dp-dq);push(p.map((v,k)=>v+(q[k]-v)*t));}}
 if(out.length>1&&Math.hypot(...out[0].slice(0,3).map((v,k)=>v-out.at(-1)[k]))<=1e-9)out.pop();return out;}
const RECT=o=>[[0,o[0],1],[0,o[1],-1],[1,o[2],1],[1,o[3],-1]];
// The part of a polygon inside the outline.
export function clipToOutline(poly,o){let q=poly;for(const [axis,at,s]of RECT(o)){q=clipPolygon(q,axis,at,s);if(!q.length)return q;}for(const pl of cornerPlanes(o)){q=clipHalf(q,pl);if(!q.length)break;}return q;}
// The pieces of a polygon outside the outline (the rect steps are exactly subtractRect's, so radius 0 is unchanged).
export function subtractOutline(poly,o){const outside=[];let inside=poly;for(const [axis,at,s]of RECT(o)){if(!inside.length)break;const piece=clipPolygon(inside,axis,at,-s);if(piece.length>2)outside.push(piece);inside=clipPolygon(inside,axis,at,s);}
 for(const pl of cornerPlanes(o)){if(inside.length<3)break;const piece=clipHalf(inside,pl,-1);if(piece.length>2)outside.push(piece);inside=clipHalf(inside,pl);}return outside;}
export const withinOutline=(patch,o)=>patch.flatMap(t=>triangulate(clipToOutline(t,o)));
// The opening grown by d on every side (the 12 mm glazing seal keeps the corner arcs concentric).
export const growOpening=(o,d)=>o.length>4&&o[4]>0?[o[0]-d,o[1]+d,o[2]-d,o[3]+d,o[4]+d]:[o[0]-d,o[1]+d,o[2]-d,o[3]+d];
