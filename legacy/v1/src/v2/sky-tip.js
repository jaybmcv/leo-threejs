import * as T from 'three';
import {polygonGeometry,metal} from './geometry.js';
import {boundaryRings} from './floor-boundary.js';
import {skyMaterial,skyUV} from './atrium-surfaces.js';
const rect=(a,b,c,d)=>[[a,c],[b,c],[b,d],[a,d]];
const pointKey=p=>p.map(v=>v.toFixed(6)).join(',');
export function skyTipFootprint(layout){
 const low=layout.decks[14],high=layout.decks[15],g=polygonGeometry(low.atrium.outline,[high.atrium.outline,rect(-1000,138,-1000,1000)],0,.1),p=g.attributes.position,n=g.attributes.normal,edges=new Map();
 for(let i=0;i<p.count;i+=3){if(n.getY(i)<.9)continue;const t=[0,1,2].map(k=>[p.getX(i+k),p.getZ(i+k)]);for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=pointKey(a)+'|'+pointKey(b),reverse=pointKey(b)+'|'+pointKey(a);if(edges.has(reverse))edges.delete(reverse);else edges.set(key,[a,b]);}}
 g.dispose();return boundaryRings([...edges.values()]);
}
function removeUnderFaces(g,rings){const p=g.attributes.position,ix=g.index,attrs=Object.entries(g.attributes),out=Object.fromEntries(attrs.map(([k])=>[k,[]]));let removed=0;
 const emit=(ids,vertices=null)=>{for(let k=0;k<3;k++)for(const[name,a]of attrs){if(vertices&&name==='position')out[name].push(...vertices[k]);else if(vertices&&name==='normal')out[name].push(0,-1,0);else for(let j=0;j<a.itemSize;j++)out[name].push(a.array[ids[k]*a.itemSize+j]);}};
 for(let i=0;i<(ix?.count??p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k),t=ids.map(j=>[p.getX(j),p.getY(j),p.getZ(j)]),normal=new T.Triangle(...t.map(q=>new T.Vector3(...q))).getNormal(new T.Vector3());
 if(normal.y>-.99||Math.max(...t.map(q=>q[0]))<138||Math.min(...t.map(q=>q[0]))>198){emit(ids);continue;}
 const clipped=polygonGeometry(t.map(q=>[q[0],q[2]]),rings,t[0][1],0),cp=clipped.attributes.position,cn=clipped.attributes.normal;let area=0;
 for(let j=0;j<cp.count;j+=3)if(cn.getY(j)<-.9){const v=[0,1,2].map(k=>[cp.getX(j+k),cp.getY(j+k),cp.getZ(j+k)]);area+=new T.Triangle(...v.map(q=>new T.Vector3(...q))).getArea();emit(ids,v);}
 const oldArea=new T.Triangle(...t.map(q=>new T.Vector3(...q))).getArea();if(oldArea-area>1e-5)removed+=oldArea-area;clipped.dispose();}
 const next=new T.BufferGeometry();for(const[name,a]of attrs)next.setAttribute(name,new T.BufferAttribute(new a.array.constructor(out[name]),a.itemSize,a.normalized));next.computeBoundingBox();next.computeBoundingSphere();return{geometry:next,removed};
}
export function finishSkyTip(ship,layout){
 if(ship.v2SkyTip)return ship.v2SkyTip;const rings=skyTipFootprint(layout),y=layout.decks[14].y+3.72-.08-.01,changes=[];
 // Called only after static collision bands and their ground BVHs are complete.
 // Replace visual underside faces; keep every original walking top and collider.
 const candidates=[ship.decks[15].getObjectByName('Deck_slab')];ship.inside.traverse(o=>{if(o.isMesh&&o.name==='V2_distribution_ceiling'){o.geometry.computeBoundingBox();if(Math.abs(o.geometry.boundingBox.min.y-(y+.01))<.002)candidates.push(o);}});
 for(const o of candidates.filter(Boolean)){const result=removeUnderFaces(o.geometry,rings);o.geometry=result.geometry;changes.push({name:o.name,removedArea:result.removed});}
 const parts=rings.map(r=>polygonGeometry(r,[],y,0)),positions=[];for(const g of parts){const p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i+=3)if(n.getY(i)<-.9)for(let k=0;k<3;k++)positions.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));g.dispose();}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();skyUV(geo,layout);const root=ship.inside.getObjectByName('V2_structure'),panel=new T.Mesh(geo,skyMaterial());panel.name='P6_sky_tip';panel.userData={noCollide:true,phase6SkyTip:true,v2Deck:16};root.add(panel);
 const vertices=[],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
 for(const ring of rings){const edge=ring.map((p,i)=>{const q=ring[(i+1)%ring.length],l=Math.hypot(q[0]-p[0],q[1]-p[1]);return[(q[0]-p[0])/l,(q[1]-p[1])/l];}),offset=(i,h)=>{const p=ring[i],a=edge[(i+ring.length-1)%ring.length],b=edge[i],A=[p[0]-a[1]*h,p[1]+a[0]*h],B=[p[0]-b[1]*h,p[1]+b[0]*h],den=cross(a,b);if(Math.abs(den)<1e-6)return B;const t=cross([B[0]-A[0],B[1]-A[1]],b)/den;return[A[0]+a[0]*t,A[1]+a[1]*t];},left=ring.map((_,i)=>offset(i,.08)),right=ring.map((_,i)=>offset(i,-.08)),at=(p,h)=>[p[0],h,p[1]],quad=(a,b,c,d)=>vertices.push(...a,...b,...c,...a,...c,...d);
 for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length,A=at(left[i],y+.02),B=at(left[j],y+.02),C=at(right[j],y+.02),D=at(right[i],y+.02),a=at(left[i],y-.02),b=at(left[j],y-.02),c=at(right[j],y-.02),d=at(right[i],y-.02);quad(A,B,C,D);quad(d,c,b,a);quad(a,b,B,A);quad(d,D,C,c);}}
 const frameGeometry=new T.BufferGeometry();frameGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));frameGeometry.computeVertexNormals();const frame=new T.Mesh(frameGeometry,metal);frame.name='P6_sky_tip_border';frame.userData={noCollide:true,phase6SkyTip:true,v2Deck:16};root.add(frame);
 return ship.v2SkyTip={rings,y,changes,panelTriangles:positions.length/9,borderTriangles:(frame.geometry.index?.count??frame.geometry.attributes.position.count)/3,borderWidth:.16,borderDrop:.02,collisionUnchanged:true,narrowLedges:'retained as architecture'};
}
