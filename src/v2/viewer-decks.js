import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {polygonGeometry} from './geometry.js';
import {roomPolygonAt} from './viewer-data.js';
import {rectangle} from '../plan/geometry-v2.js';
export const COLORS={slab:0x597884,cabin:0x8db9dd,single:0xe4bd77,room:0xe7c395,garden:0x8cceab,shuttle:0xf09275,circulation:0xd4eff0};
export function createDeckView(layout,number){
 const d=layout.decks.find(d=>d.number===number),root=new T.Group();root.name='V2_viewer_deck_'+number;root.userData.deck=number;
 const mats=Object.fromEntries(Object.entries(COLORS).map(([k,color])=>[k,new T.MeshStandardMaterial({color,roughness:.85,side:T.DoubleSide})]));
 const batches=new Map();const add=(key,g)=>{const a=batches.get(key)||[];a.push(g);batches.set(key,a);};
 add('slab',polygonGeometry(d.slab.outline,d.slab.holes.map(h=>h.polygon),d.y,.22));
 for(const c of layout.cabins.filter(c=>c.deck===number))add(c.type==='single'?'single':'cabin',polygonGeometry(c.polygon,[],c.y+.35,.3));
 const rooms=layout.rooms.filter(r=>r.y<=d.y+.1&&r.y+r.height>d.y+.1||r.deck===number);
 for(const r of rooms){const poly=roomPolygonAt(r,d.y+.1),key=r.kind==='garden'?'garden':'room';if(r.deck===number)add(key,polygonGeometry(poly,[],Math.max(d.y,r.y)+.06,.06));else outline(poly,d.y+.08,COLORS[key]);}
 for(const r of layout.rooms.filter(r=>r.components))for(const k of ['galleries','links','landings','stairs'])for(const c of r.components[k]){if(k==='stairs'?c.center[1]<d.y||c.center[1]>=d.y+4:Math.abs(c.center[1]-d.y)>.1)continue;const poly=c.polygon||rectangle(c.center[0],c.center[2],c.size[0],c.size[2]);if(k==='stairs')outline(poly,d.y+.2,COLORS.garden);else add('garden',polygonGeometry(poly,[],d.y+.18,.12));}
 for(const s of layout.shuttles.filter(s=>s.deck===number))add('shuttle',polygonGeometry(s.polygon,[],d.y+.1,.08));
 for(const key of ['bridges','towers','stairs','lifts','ramps','balconies'])for(const b of layout.circulation[key].filter(b=>b.deck===number))if(b.polygon)outline(b.polygon,d.y+.15,COLORS.circulation);
 const lines=[];for(const c of layout.circulation.corridors.filter(c=>c.deck===number))for(let i=1;i<c.points.length;i++)lines.push(c.points[i-1][0],d.y+.12,c.points[i-1][1],c.points[i][0],d.y+.12,c.points[i][1]);if(lines.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(lines,3));root.add(new T.LineSegments(g,new T.LineBasicMaterial({color:COLORS.circulation,transparent:true,opacity:.6})));}
 for(const [key,gs]of batches){const merged=mergeGeometries(gs);const o=new T.Mesh(merged,mats[key]);o.name='V2_viewer_'+key;root.add(o);gs.forEach(g=>g.dispose());}
 for(const h of d.slab.holes)outline(h.polygon,d.y+.18,0x263d48);
 function outline(poly,y,color){const g=new T.BufferGeometry().setFromPoints(poly.map(([x,z])=>new T.Vector3(x,y,z)));root.add(new T.LineLoop(g,new T.LineBasicMaterial({color})));}
 return root;
}
// Eye-level shots use only their own room and the atrium section: no hidden full-ship scene.
export function createTourVolume(layout,shot){
 const root=new T.Group();const wallMat=new T.MeshStandardMaterial({color:0x7ca8b6,side:T.DoubleSide,transparent:true,opacity:.45}),floorMat=new T.MeshStandardMaterial({color:0xbeb49c,side:T.DoubleSide});
 if(shot.room){const r=layout.rooms.find(r=>r.id===shot.room),poly=roomPolygonAt(r,shot.from[1]);root.add(new T.Mesh(polygonGeometry(poly,[],r.y,.18),floorMat));const pos=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];pos.push(a[0],r.y,a[1],b[0],r.y,b[1],b[0],r.y+r.height,b[1],a[0],r.y,a[1],b[0],r.y+r.height,b[1],a[0],r.y+r.height,a[1]);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();root.add(new T.Mesh(g,wallMat));
 }else for(const d of layout.decks.filter(d=>d.number>=6)){const rootDeck=new T.Mesh(polygonGeometry(d.slab.outline,d.slab.holes.map(h=>h.polygon),d.y,.22),floorMat);root.add(rootDeck);}
 return root;
}
export function disposeView(root){root.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose();});root.removeFromParent();}
