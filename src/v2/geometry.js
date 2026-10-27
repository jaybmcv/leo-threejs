import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export const glass=new T.MeshStandardMaterial({name:'V2_smart_glass',color:0x8ec7d4,transparent:true,opacity:.23,depthWrite:false,roughness:.3,metalness:.1,side:T.DoubleSide});
export const lining=new T.MeshStandardMaterial({name:'V2_lining',color:0xdce1db,roughness:.8});
export const floor=new T.MeshStandardMaterial({name:'V2_floor',color:0xa6b9b6,roughness:.8});
export const metal=new T.MeshStandardMaterial({name:'V2_rail_cap',color:0x586e7b,metalness:.55,roughness:.4});
export function mesh(parent,name,geometry,material=floor){const o=new T.Mesh(geometry,material);o.name=name;parent.add(o);return o;}
export function box(parent,name,size,at,material=lining){const o=mesh(parent,name,new T.BoxGeometry(...size),material);o.position.set(...at);return o;}
export function polygonGeometry(outline,holes=[],y=0,depth=.24){
 // Vertical decomposition unions overlapping holes (atrium, shafts, garden voids).
 // Each event interval has linear boundary edges, so the trapezoids are exact.
 const rings=[outline,...holes],events=[...new Set(rings.flatMap(p=>p.map(v=>v[0])))].sort((a,b)=>a-b),pos=[];
 const edgeAt=(p,x)=>{const edges=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(x>Math.min(a[0],b[0])&&x<Math.max(a[0],b[0]))edges.push({a,b,z:a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])});}return edges.sort((a,b)=>a.z-b.z);};
 const at=(e,x)=>e.a[1]+(e.b[1]-e.a[1])*(x-e.a[0])/(e.b[0]-e.a[0]);
 const tri=(a,b,c)=>pos.push(...a,...b,...c);
 for(let i=1;i<events.length;i++){const x0=events[i-1],x1=events[i];if(x1-x0<1e-7)continue;const mid=(x0+x1)/2,outer=edgeAt(outline,mid),cuts=holes.flatMap(p=>{const e=edgeAt(p,mid),o=[];for(let j=1;j<e.length;j+=2)o.push([e[j-1],e[j]]);return o;}).sort((a,b)=>a[0].z-b[0].z);
  for(let j=1;j<outer.length;j+=2){let lo=outer[j-1],hi=outer[j];const pieces=[];for(const [a,b] of cuts){if(b.z<=lo.z||a.z>=hi.z)continue;if(a.z>lo.z)pieces.push([lo,a]);if(b.z>lo.z)lo=b;if(lo.z>=hi.z)break;}if(lo.z<hi.z)pieces.push([lo,hi]);
   for(const [a,b] of pieces){const p=[[x0,y,at(a,x0)],[x1,y,at(a,x1)],[x1,y,at(b,x1)],[x0,y,at(b,x0)]],q=p.map(([x,y,z])=>[x,y-depth,z]);tri(p[0],p[2],p[1]);tri(p[0],p[3],p[2]);tri(q[0],q[1],q[2]);tri(q[0],q[2],q[3]);for(let k=0;k<4;k++){const l=(k+1)%4;tri(p[k],p[l],q[l]);tri(p[k],q[l],q[k]);}}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}
export function strip(parent,name,a,b,y,width,height,material=floor){const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)return null;const o=box(parent,name,[len,height,width],[(a[0]+b[0])/2,y-height/2,(a[1]+b[1])/2],material);o.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);return o;}
export function wall(parent,a,b,y,height,material=glass,name='V2_glass_wall'){return strip(parent,name,a,b,y+height,.10,height,material);}
export function mergeBoxes(parent,name,items,material){if(!items.length)return;const gs=items.map(([size,at,yaw=0])=>new T.BoxGeometry(...size).rotateY(yaw).translate(...at));const o=mesh(parent,name,mergeGeometries(gs),material);gs.forEach(g=>g.dispose());return o;}
export const bounds=p=>({x0:Math.min(...p.map(p=>p[0])),x1:Math.max(...p.map(p=>p[0])),z0:Math.min(...p.map(p=>p[1])),z1:Math.max(...p.map(p=>p[1]))});
