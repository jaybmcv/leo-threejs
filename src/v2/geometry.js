import {boundaryRings,triangulateFloor,floorEvents} from './floor-boundary.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export const glass=new T.MeshStandardMaterial({name:'V2_smart_glass',color:0x8ec7d4,transparent:true,opacity:.23,depthWrite:false,roughness:.3,metalness:.1,side:T.DoubleSide});
export const lining=new T.MeshStandardMaterial({name:'V2_lining',color:0xdce1db,roughness:.8});
export const floor=new T.MeshStandardMaterial({name:'V2_floor',color:0xa6b9b6,roughness:.8});
export const metal=new T.MeshStandardMaterial({name:'V2_rail_cap',color:0x586e7b,metalness:.55,roughness:.4});
export function mesh(parent,name,geometry,material=floor){const o=new T.Mesh(geometry,material);o.name=name;parent.add(o);return o;}
export function box(parent,name,size,at,material=lining){const o=mesh(parent,name,new T.BoxGeometry(...size),material);o.position.set(...at);return o;}
export function polygonGeometry(outline,holes=[],y=0,depth=.24){
 // The same exact vertical decomposition, with sides only on the solid's true perimeter.
 const rings=[outline,...holes],events=floorEvents(rings),pos=[],segments=[],boundaries=new Map(),tri=(a,b,c)=>pos.push(...a,...b,...c),side=(a,b)=>segments.push([[a[0],a[2]],[b[0],b[2]]]),put=(x,kind,lo,hi)=>{if(hi-lo<1e-8)return;let record=boundaries.get(x);if(!record)boundaries.set(x,record={left:[],right:[]});record[kind].push([lo,hi]);};
 const edgeAt=(p,x)=>{const edges=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(x>Math.min(a[0],b[0])&&x<Math.max(a[0],b[0]))edges.push({a,b,z:a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])});}return edges.sort((a,b)=>a.z-b.z);},at=(e,x)=>e.a[1]+(e.b[1]-e.a[1])*(x-e.a[0])/(e.b[0]-e.a[0]);
 for(let i=1;i<events.length;i++){const x0=events[i-1],x1=events[i];if(x1-x0<1e-7)continue;const mid=(x0+x1)/2,outer=edgeAt(outline,mid),cuts=holes.flatMap(p=>{const e=edgeAt(p,mid),o=[];for(let j=1;j<e.length;j+=2)o.push([e[j-1],e[j]]);return o;}).sort((a,b)=>a[0].z-b[0].z);for(let j=1;j<outer.length;j+=2){let lo=outer[j-1],hi=outer[j];const pieces=[];for(const [a,b]of cuts){if(b.z<=lo.z||a.z>=hi.z)continue;if(a.z>lo.z)pieces.push([lo,a]);if(b.z>lo.z)lo=b;if(lo.z>=hi.z)break;}if(lo.z<hi.z)pieces.push([lo,hi]);for(const [a,b]of pieces){const p=[[x0,y,at(a,x0)],[x1,y,at(a,x1)],[x1,y,at(b,x1)],[x0,y,at(b,x0)]],q=p.map(([x,y,z])=>[x,y-depth,z]);side(p[0],p[1]);side(p[2],p[3]);put(x0,'right',p[0][2],p[3][2]);put(x1,'left',p[1][2],p[2][2]);}}}
 for(const [x,record]of boundaries){const zs=[...record.left,...record.right].flat().sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>1e-7),inside=(ranges,z)=>ranges.some(([lo,hi])=>z>lo&&z<hi);for(let i=1;i<zs.length;i++){const lo=zs[i-1],hi=zs[i],mid=(lo+hi)/2,L=inside(record.left,mid),R=inside(record.right,mid);if(L===R)continue;if(L)side([x,y,lo],[x,y,hi]);else side([x,y,hi],[x,y,lo]);}}
 const loops=boundaryRings(segments);for(const face of triangulateFloor(loops)){const p=face.map(([x,z])=>[x,y,z]);if((p[1][2]-p[0][2])*(p[2][0]-p[0][0])-(p[1][0]-p[0][0])*(p[2][2]-p[0][2])<0)p.reverse();tri(...p);tri(...p.slice().reverse().map(([x,yy,z])=>[x,yy-depth,z]));}for(const loop of loops)for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length],p=[a[0],y,a[1]],q=[b[0],y,b[1]],r=[b[0],y-depth,b[1]],t=[a[0],y-depth,a[1]];tri(p,q,r);tri(p,r,t);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}
export function strip(parent,name,a,b,y,width,height,material=floor){const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)return null;const o=box(parent,name,[len,height,width],[(a[0]+b[0])/2,y-height/2,(a[1]+b[1])/2],material);o.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);return o;}
export function wall(parent,a,b,y,height,material=glass,name='V2_glass_wall'){return strip(parent,name,a,b,y+height,.10,height,material);}
export function mergeBoxes(parent,name,items,material){if(!items.length)return;const gs=items.map(([size,at,yaw=0])=>new T.BoxGeometry(...size).rotateY(yaw).translate(...at));const o=mesh(parent,name,mergeGeometries(gs),material);gs.forEach(g=>g.dispose());return o;}
export const bounds=p=>({x0:Math.min(...p.map(p=>p[0])),x1:Math.max(...p.map(p=>p[0])),z0:Math.min(...p.map(p=>p[1])),z1:Math.max(...p.map(p=>p[1]))});

// The floor closes a glazing panel at its foot; a second downward cap at the
// same level is redundant, and tints the floor through double-sided glass.
export function removeBottomCap(o){if(!o)return;const g=o.geometry,p=g.attributes.position,ix=g.index,lo=(g.computeBoundingBox(),g.boundingBox.min.y),keep=[];for(let i=0;i<(ix?.count??p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);if(ids.every(id=>Math.abs(p.getY(id)-lo)<1e-8))continue;keep.push(...ids);}g.setIndex(keep);}

// A continuous fallback glazing strip needs only its two upright faces.
// Its floor/ceiling close the horizontal edges; adjacent panel caps overlap at bends.
export function removePanelEndCaps(o){if(!o)return;const g=o.geometry,p=g.attributes.position,ix=g.index;g.computeBoundingBox();const {min,max}=g.boundingBox,keep=[];for(let i=0;i<(ix?.count??p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);if(ids.every(id=>Math.abs(p.getX(id)-min.x)<1e-8)||ids.every(id=>Math.abs(p.getX(id)-max.x)<1e-8)||ids.every(id=>Math.abs(p.getY(id)-min.y)<1e-8)||ids.every(id=>Math.abs(p.getY(id)-max.y)<1e-8))continue;keep.push(...ids);}g.setIndex(keep);}

export function removeGeometryCaps(g,axis){const p=g.attributes.position,ix=g.index;g.computeBoundingBox();const lo=g.boundingBox.min.getComponent(axis),hi=g.boundingBox.max.getComponent(axis),keep=[];for(let i=0;i<(ix?.count??p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);if(ids.every(id=>Math.abs(p.getComponent(id,axis)-lo)<1e-8)||ids.every(id=>Math.abs(p.getComponent(id,axis)-hi)<1e-8))continue;keep.push(...ids);}g.setIndex(keep);g.clearGroups();return g;}
