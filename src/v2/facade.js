import {addPhase6Architecture,attachDistantArchitecture} from './atrium-architecture.js';
import {registerAtriumArchitecture} from './atrium-visibility.js';
import {retireLegacySkinGeometry} from './skin-retirement.js';
import {ownerFootprint} from '../plan/envelope-ownership-v2.js';
import {worldPoint} from '../plan/hull-skin-v2.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from 'three';
import layout from 'v2-layout';
import {distanceToSegment} from '../plan/geometry-v2.js';
import {placements,cabinKey} from './cabins.js';
import {mergeBoxes,metal,glass,lining,floor,polygonGeometry} from './geometry.js';
export function facadeVolumeMasks(lo,hi){const masks=[];for(const r of layout.rooms.filter(r=>!r.aggregate&&r.y<hi&&r.y+r.height>lo)){for(const s of r.envelope||[{rise:0,height:r.height,polygon:r.polygon}])if(r.y+s.rise<hi&&r.y+s.rise+s.height>lo)masks.push(s.polygon);}for(const p of layout.hullPrototypes?.prototypes||[]){const a=Math.max(0,lo-p.chart.origin[1]),b=Math.min(p.rect[3],hi-p.chart.origin[1]);if(b<=a)continue;for(const y of [a,(a+b)/2,b]){const poly=ownerFootprint(p,y).map(q=>{const w=worldPoint(p.chart,q);return[w[0],w[2]];});if(poly.length>2)masks.push(poly);}}return masks;}
export function facadeSlabMasks(d){return [...d.slab.holes.map(h=>h.polygon),...facadeVolumeMasks(d.y-.215,d.y-.015)];}
export function attachFacade(ship,scene,{authority=null}={}){
 const root=new T.Group();root.name='V2_atrium_facade';root.userData.noCollide=true;const caps=[],fronts=[],panes=[];
 for(const c of placements().filter(c=>c.view==='atrium')){
  const at=(u,y,v)=>new T.Vector3(u,y,v).applyMatrix4(c.matrix).toArray(),sign=cabinKey(c).includes('--')?-1:1;
  caps.push([[3.18,.16,.22],at(0,0,-sign*3.7),c.yaw],[[3.18,.12,.2],at(0,3.4,-sign*3.7),c.yaw]);
  fronts.push([[.12,3.4,.16],at(-1.53,1.7,-sign*3.7),c.yaw],[[.12,3.4,.16],at(1.53,1.7,-sign*3.7),c.yaw]);
  panes.push([[3.06,3.15,.035],at(0,1.7,-sign*3.68),c.yaw]);
 }
 mergeBoxes(root,'V2_facade_balconies',caps,metal);mergeBoxes(root,'V2_facade_piers',fronts,lining);mergeBoxes(root,'V2_facade_glass',panes,glass);
 const simple=poly=>{const pts=[...poly,poly[0]],reduce=p=>{if(p.length<3)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;let best=.1,index=-1;for(let i=1;i<p.length-1;i++){const t=l?Math.max(0,Math.min(1,((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dz)/l)):0,dist=Math.hypot(p[i][0]-a[0]-t*dx,p[i][1]-a[1]-t*dz);if(dist>best){best=dist;index=i;}}return index<0?[a,b]:[...reduce(p.slice(0,index+1)).slice(0,-1),...reduce(p.slice(index))];};return reduce(pts).slice(0,-1);};
 // Preserve every real slab void, including public rooms spanning intermediate decks.
 const plates=layout.decks.filter(d=>d.number>=7).map(d=>polygonGeometry(simple(d.slab.outline),facadeSlabMasks(d),d.y-.015,.20));const roof=layout.decks.at(-1);plates.push(polygonGeometry(simple(roof.slab.outline),[...facadeVolumeMasks(roof.y+3.62,roof.y+3.72),roof.atrium.outline],roof.y+3.72,.1));const slab=new T.Mesh(mergeGeometries(plates),floor);slab.name='V2_facade_terraces_and_atrium_roof';root.add(slab);plates.forEach(g=>g.dispose());
 const frontsUpper=[];for(const r of layout.rooms.filter(r=>r.deck>=16&&!r.aggregate)){const p=r.polygon,min=Math.min(...p.map(p=>Math.abs(p[1])));for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(![r.door,...(r.galleryDoors||[])].filter(Boolean).some(d=>distanceToSegment([d.center[0],d.center[2]],a,b)<.2))continue;const len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,doors=[r.door,...(r.galleryDoors||[])].filter(Boolean).map(d=>({...d,t:(d.center[0]-a[0])*ux+(d.center[2]-a[1])*uz})).filter(d=>d.t>=0&&d.t<=len&&Math.abs((d.center[0]-a[0])*uz-(d.center[2]-a[1])*ux)<.2),events=[...new Set([0,len,...doors.flatMap(d=>[Math.max(0,d.t-d.width/2),Math.min(len,d.t+d.width/2)])])].sort((a,b)=>a-b);for(let k=1;k<events.length;k++){const lo=events[k-1],hi=events[k],mid=(lo+hi)/2,cuts=doors.filter(d=>Math.abs(mid-d.t)<d.width/2).map(d=>[Math.max(r.y,d.center[1]),Math.min(r.y+r.height,d.center[1]+2.5)]).sort((a,b)=>a[0]-b[0]),spans=[];let bottom=r.y;for(const [c0,c1] of cuts){if(c0>bottom)spans.push([bottom,c0]);bottom=Math.max(bottom,c1);}if(bottom<r.y+r.height)spans.push([bottom,r.y+r.height]);for(const [y0,y1] of spans)if(hi-lo>.001&&y1-y0>.001)frontsUpper.push([[hi-lo,y1-y0,.06],[a[0]+ux*mid,(y0+y1)/2,a[1]+uz*mid],-Math.atan2(uz,ux)]);}}}mergeBoxes(root,'V2_upper_atrium_fronts',frontsUpper,glass);
 addPhase6Architecture(ship,root,layout);
 // All tiers always draw in a bounded architectural layer; full fitted interiors retain narrow deck-band culling.
 root.traverse(o=>{o.frustumCulled=false;});scene.add(root);if(ship.exterior||authority)ship.v2FacadeRetirement=retireLegacySkinGeometry(ship,layout,{root,authority,actors:false});attachDistantArchitecture(ship,root);registerAtriumArchitecture(root);registerAtriumArchitecture(ship.v2Haze);ship.facade=root;return root;
}

// Retain source objects for inspection without traversing 250k hidden authoring meshes every frame.
export function isolateStaticWorld(ship,scene){ship.root.updateMatrixWorld(true);const live=[],visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};ship.root.traverse(o=>{if((o.isMesh&&!o.userData.baked||o.isLight)&&visible(o))live.push({o,parent:o.parent});});const root=new T.Group();root.name='V2_live_source_draws';scene.add(root);const groups=new Map();for(const {o,parent} of live){let g=groups.get(parent);if(!g){g=new T.Group();g.name=parent.name;root.add(g);groups.set(parent,g);}g.attach(o);}ship.root.removeFromParent();ship.liveDraws=root;return root;}
