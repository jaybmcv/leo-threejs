import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// The bow wraps around the ship: unwrap its surface into angle/height space,
// so an aperture follows the actual pane instead of making a rectangular cut.
export const bowChart=v=>[Math.atan2(Math.abs(v[2])/82,(v[0]-125)/120),v[1]];
function edgeClip(poly,a,b,keepInside){
 const side=v=>(b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0]);
 const out=[];for(let i=0;i<poly.length;i++){const x=poly[i],y=poly[(i+1)%poly.length],sx=side(x),sy=side(y),ix=keepInside?sx>=-1e-10:sx<=1e-10,iy=keepInside?sy>=-1e-10:sy<=1e-10;if(ix)out.push(x);if(ix!==iy){const t=sx/(sx-sy);out.push(x.map((v,k)=>v+(y[k]-v)*t));}}return out;
}
export function bowAperturePlan(panes){
 const triangles=[];for(const o of panes){o.updateWorldMatrix(true,false);const g=o.geometry.clone().applyMatrix4(o.matrixWorld),p=g.attributes.position,ix=g.index;
  for(let i=0;i<(ix?.count||p.count);i+=3){const q=[];for(let j=0;j<3;j++){const k=ix?ix.getX(i+j):i+j;q.push(bowChart([p.getX(k),p.getY(k),p.getZ(k)]));}const [a,b,c]=q,area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(area)<1e-10)continue;if(area<0)q.reverse();triangles.push(q);}g.dispose();
 }return triangles;
}
export function cutBowApertures(mesh,plan){
 mesh.updateWorldMatrix(true,false);const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),attrs=Object.entries(g.attributes),p=g.attributes.position,ix=g.index,result=Object.fromEntries(attrs.map(([n])=>[n,[]]));
 const boxes=plan.map(q=>({q,u0:Math.min(...q.map(v=>v[0])),u1:Math.max(...q.map(v=>v[0])),v0:Math.min(...q.map(v=>v[1])),v1:Math.max(...q.map(v=>v[1]))}));let changed=0;
 for(let i=0;i<(ix?.count||p.count);i+=3){const tri=[];for(let j=0;j<3;j++){const k=ix?ix.getX(i+j):i+j,v=bowChart([p.getX(k),p.getY(k),p.getZ(k)]);for(const [,a]of attrs)for(let c=0;c<a.itemSize;c++)v.push(a.array[k*a.itemSize+c]);tri.push(v);}
  const us=tri.map(v=>v[0]),vs=tri.map(v=>v[1]),u0=Math.min(...us),u1=Math.max(...us),v0=Math.min(...vs),v1=Math.max(...vs);let polys=[tri];
  // Only triangles overlapping the measured pane chart can be cut.
  for(const b of boxes){if(u1<=b.u0||u0>=b.u1||v1<=b.v0||v0>=b.v1)continue;const pieces=[];for(const poly of polys){let inner=poly;for(let k=0;k<3;k++){const a=b.q[k],c=b.q[(k+1)%3],outside=edgeClip(inner,a,c,false);if(outside.length>=3)pieces.push(outside);inner=edgeClip(inner,a,c,true);if(inner.length<3)break;}}polys=pieces;changed++;}
  for(const poly of polys)for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){let offset=2;for(const [name,a]of attrs){result[name].push(...v.slice(offset,offset+a.itemSize));offset+=a.itemSize;}}
 }
 const out=new T.BufferGeometry();for(const [name,a]of attrs)out.setAttribute(name,new T.Float32BufferAttribute(result[name],a.itemSize));out.applyMatrix4(mesh.matrixWorld.clone().invert());out.normalizeNormals();
 const merged=mergeVertices(out,1e-5),idx=merged.index,pp=merged.attributes.position,clean=[],va=new T.Vector3(),vb=new T.Vector3(),vc=new T.Vector3();
 for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);if(a===b||b===c||a===c)continue;va.fromBufferAttribute(pp,a);vb.fromBufferAttribute(pp,b).sub(va);vc.fromBufferAttribute(pp,c).sub(va);if(vb.cross(vc).lengthSq()>1e-14)clean.push(a,b,c);}
 merged.setIndex(clean);const compact=merged.toNonIndexed();mesh.geometry=mergeVertices(compact,1e-5);g.dispose();out.dispose();merged.dispose();compact.dispose();return changed;
}
