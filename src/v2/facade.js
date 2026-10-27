import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from 'three';
import layout from 'v2-layout';
import {placements,cabinKey} from './cabins.js';
import {mergeBoxes,metal,glass,lining,floor,polygonGeometry} from './geometry.js';
export function attachFacade(ship,scene){
 const root=new T.Group();root.name='V2_atrium_facade';root.userData.noCollide=true;const caps=[],fronts=[],panes=[];
 for(const c of placements().filter(c=>c.view==='atrium')){
  const at=(u,y,v)=>new T.Vector3(u,y,v).applyMatrix4(c.matrix).toArray(),sign=cabinKey(c).includes('--')?-1:1;
  caps.push([[3.18,.16,.22],at(0,0,-sign*3.7),c.yaw],[[3.18,.12,.2],at(0,3.4,-sign*3.7),c.yaw]);
  fronts.push([[.12,3.4,.16],at(-1.53,1.7,-sign*3.7),c.yaw],[[.12,3.4,.16],at(1.53,1.7,-sign*3.7),c.yaw]);
  panes.push([[3.06,3.15,.035],at(0,1.7,-sign*3.68),c.yaw]);
 }
 mergeBoxes(root,'V2_facade_balconies',caps,metal);mergeBoxes(root,'V2_facade_piers',fronts,lining);mergeBoxes(root,'V2_facade_glass',panes,glass);
 const simple=poly=>{const pts=[...poly,poly[0]],reduce=p=>{if(p.length<3)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;let best=.1,index=-1;for(let i=1;i<p.length-1;i++){const t=l?Math.max(0,Math.min(1,((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dz)/l)):0,dist=Math.hypot(p[i][0]-a[0]-t*dx,p[i][1]-a[1]-t*dz);if(dist>best){best=dist;index=i;}}return index<0?[a,b]:[...reduce(p.slice(0,index+1)).slice(0,-1),...reduce(p.slice(index))];};return reduce(pts).slice(0,-1);};
 const plates=layout.decks.filter(d=>d.number>=6).map(d=>polygonGeometry(simple(d.slab.outline),d.slab.holes.filter(h=>h.id==='atrium'||h.assembly).map(h=>simple(h.polygon)),d.y-.015,.20));for(const b of layout.circulation.bridges)plates.push(polygonGeometry(b.polygon,[],layout.decks[b.deck-1].y-.015,.2));const roof=layout.decks.at(-1);plates.push(polygonGeometry(simple(roof.slab.outline),[],roof.y+3.72,.1));const slab=new T.Mesh(mergeGeometries(plates),floor);slab.name='V2_facade_terraces_and_atrium_roof';root.add(slab);plates.forEach(g=>g.dispose());
 const frontsUpper=[];for(const r of layout.rooms.filter(r=>r.deck>=16&&!r.aggregate)){const p=r.polygon,min=Math.min(...p.map(p=>Math.abs(p[1])));for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(Math.max(Math.abs(a[1]),Math.abs(b[1]))>min+.2)continue;const len=Math.hypot(b[0]-a[0],b[1]-a[1]);frontsUpper.push([[len,r.height,.06],[(a[0]+b[0])/2,r.y+r.height/2,(a[1]+b[1])/2],-Math.atan2(b[1]-a[1],b[0]-a[0])]);}}mergeBoxes(root,'V2_upper_atrium_fronts',frontsUpper,glass);
 // All tiers always draw in five calls; full fitted interiors retain narrow deck-band culling.
 root.traverse(o=>{o.frustumCulled=false;});scene.add(root);ship.facade=root;return root;
}

// Retain source objects for inspection without traversing 250k hidden authoring meshes every frame.
export function isolateStaticWorld(ship,scene){ship.root.updateMatrixWorld(true);const live=[],visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};ship.root.traverse(o=>{if((o.isMesh&&!o.userData.baked||o.isLight)&&visible(o))live.push({o,parent:o.parent});});const root=new T.Group();root.name='V2_live_source_draws';scene.add(root);const groups=new Map();for(const {o,parent} of live){let g=groups.get(parent);if(!g){g=new T.Group();g.name=parent.name;root.add(g);groups.set(parent,g);}g.attach(o);}ship.root.removeFromParent();ship.liveDraws=root;return root;}
