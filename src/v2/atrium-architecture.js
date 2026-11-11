import {ATRIUM_PROTOTYPE} from '../plan/atrium-v2.js';
import {addFlowingAtriumRibs} from './flowing-ribs.js';
import {addAtriumGardens,simplifyDistantGardens} from './atrium-gardens.js';
import {atriumFloorGeometry,atriumFloorMaterial,skyCeilingGeometry,skyMaterial} from './atrium-surfaces.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {placements,doorSide} from './cabins.js';
// The paving draws 6 mm proud of Deck 6 (separateAtriumPaving, facade.js) to clear the tower and transit slabs at deck
// level, which put its top in the plane of the room floors laid 6 mm up on it. Under those floors it keeps the deck's own
// level, buried in them: top triangles reaching under a room are split along its (convex) outline and the part inside
// lowered by that separation. Every other triangle is copied unchanged.
const PAVING_SEPARATION=.006;
function sinkUnderRooms(o,layout){
 const g=o.geometry,top=layout.decks[5].y,e=o.matrixWorld.elements;if(e.some((v,i)=>Math.abs(v-(i%5===0?1:0))>1e-9))return g;
 const area=p=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a[0]*b[1]-b[0]*a[1];},0),convex=p=>p.every((a,i)=>{const b=p[(i+1)%p.length],c=p[(i+2)%p.length];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>=-1e-9;});
 const rooms=layout.rooms.filter(r=>r.deck===6&&!r.aggregate&&!(r.kind==='garden'&&r.hullPrototype)&&Math.abs(r.y-top)<1e-4).map(r=>area(r.polygon)<0?[...r.polygon].reverse():r.polygon).filter(convex).map(p=>({p,x0:Math.min(...p.map(q=>q[0])),x1:Math.max(...p.map(q=>q[0])),z0:Math.min(...p.map(q=>q[1])),z1:Math.max(...p.map(q=>q[1]))}));
 const names=Object.keys(g.attributes),attrs=names.map(n=>g.attributes[n]),P=attrs.slice(0,names.indexOf('position')).reduce((n,a)=>n+a.itemSize,0),ix=g.index,count=ix?ix.count:g.attributes.position.count;
 const vert=i=>{const v=[];for(const a of attrs)for(let k=0;k<a.itemSize;k++)v.push(a.getComponent(i,k));return v;},out=names.map(()=>[]);
 const emit=(poly,clipped)=>{for(let i=1;i<poly.length-1;i++){const a=poly[0],b=poly[i],c=poly[i+1];if(clipped&&Math.abs((b[P]-a[P])*(c[P+2]-a[P+2])-(b[P+2]-a[P+2])*(c[P]-a[P]))<1e-10)continue;for(const v of [a,b,c]){let at=0;attrs.forEach((x,j)=>{for(let k=0;k<x.itemSize;k++)out[j].push(v[at++]);});}}};
 const split=(poly,a,b)=>{const keep=[],away=[],s=v=>(b[0]-a[0])*(v[P+2]-a[1])-(b[1]-a[1])*(v[P]-a[0]);for(let i=0;i<poly.length;i++){const u=poly[i],w=poly[(i+1)%poly.length],su=s(u),sw=s(w);(su>=0?keep:away).push(u);if((su>=0)!==(sw>=0)){const t=su/(su-sw),c=u.map((x,k)=>x+(w[k]-x)*t);keep.push(c);away.push(c);}}return [keep,away];};
 let sunk=0;
 for(let t=0;t<count;t+=3){
  const tri=[0,1,2].map(k=>vert(ix?ix.getX(t+k):t+k));if(!tri.every(v=>Math.abs(v[P+1]-top)<1e-4)){emit(tri);continue;}
  let rest=[tri];const down=[];
  for(const r of rooms){const next=[];for(const poly of rest){if(poly.every(v=>v[P]<=r.x0)||poly.every(v=>v[P]>=r.x1)||poly.every(v=>v[P+2]<=r.z0)||poly.every(v=>v[P+2]>=r.z1)){next.push(poly);continue;}let inside=poly;for(let i=0;i<r.p.length&&inside.length>2;i++){const [keep,away]=split(inside,r.p[i],r.p[(i+1)%r.p.length]);if(away.length>2)next.push(away);inside=keep;}if(inside.length>2)down.push(inside);}rest=next;}
  if(!down.length){emit(tri);continue;}
  for(const poly of rest)emit(poly,true);for(const poly of down)emit(poly.map(v=>{const w=v.slice();w[P+1]-=PAVING_SEPARATION;return w;}),true);sunk++;
 }
 if(!sunk)return g;
 const result=new T.BufferGeometry();attrs.forEach((a,j)=>result.setAttribute(names[j],new T.BufferAttribute(new a.array.constructor(out[j]),a.itemSize,a.normalized)));result.userData={...g.userData,pavingSunkUnderRooms:sunk};result.computeBoundingBox();result.computeBoundingSphere();return result;
}
// The aft core's stair flights merge into their own copy, P6_tower_stairs (#258). Nothing else draws any of the tower
// parts this takes: their sources leave the walk's bake, so the atrium never hides either copy (atrium-visibility.js).
const STAIR_FLIGHT=/^(Stair_(tread|riser)_(up|return)|Stair_support_stringer|Stair_half_landing|Transit_handrail)$/;
export function addPhase6Architecture(ship,root,layout){
 // Pure proxy/facade fixtures do not instantiate the physical ship. They use
 // the same actual surface factories, never a solid approximation of its void.
 if(!ship.root){const source=new T.Group(),deck=new T.Group();deck.userData.number=6;source.add(deck);const floor=new T.Mesh(atriumFloorGeometry(layout.decks[5].slab.outline,layout.decks[5].slab.holes.map(h=>h.polygon),layout.decks[5].y,layout.decks[5].atrium.outline),atriumFloorMaterial);floor.name='Deck_slab';deck.add(floor);const sky=new T.Mesh(skyCeilingGeometry(layout),skyMaterial());sky.name='P6_sky_ceiling';source.add(sky);ship={...ship,root:source};}
 const selected=[];ship.root.updateMatrixWorld(true,true);ship.root.traverse(o=>{
  if(o.isInstancedMesh&&/^P4_p6_terrace_(glass|rail)$/.test(o.name)){for(let i=0;i<o.count;i++){const q=new T.Mesh(o.geometry,o.material),m=new T.Matrix4();o.getMatrixAt(i,m);q.name='P6_terrace_guard_actual';q.matrixWorld.copy(o.matrixWorld).multiply(m);selected.push({o:q,kind:'tower'});}o.userData.phase6ArchitectureSource=true;o.visible=false;return;}
 // The Common stage's tiers, cushions and deck collide as furnishings but draw in the garden mesh (atrium-stage.js).
 if(o.isInstancedMesh&&/^P4_p6_stage_(tiers|cushions_\d+|platform)$/.test(o.name)){o.userData.phase6ArchitectureSource=true;o.visible=false;return;}
  if(!o.isMesh||o.isInstancedMesh||!o.geometry?.attributes.position?.count||Array.isArray(o.material))return;
  for(let q=o;q;q=q.parent)if(!q.visible||q.userData.keepLive)return;
  if(o.userData.phase6SkyTip||o.name==='P6_sky_ceiling'||o.name==='P6_lake_water'||o.name==='Deck_slab'&&o.parent.userData.number===6){selected.push({o,kind:o.name==='Deck_slab'?'floor':o.name==='P6_lake_water'?'water':'sky'});return;}
  const b=new T.Box3().setFromObject(o,true);
  if((b.min.x>=126&&b.max.x<=138&&Math.max(Math.abs(b.min.z),Math.abs(b.max.z))<=10.2||b.min.x>=-141&&b.max.x<=-122&&Math.max(Math.abs(b.min.z),Math.abs(b.max.z))<=19)&&b.min.y>=-40.8&&b.max.y<=40.3||/^(V2_tower_(bridge|landing)_floor|V2_tower_bridge_light|V2_tower_shaft_lanes|V2_lounge_balcony_floor)$/.test(o.name))selected.push({o,kind:'tower'});
 });
 const buckets=new Map(),sourceNames=[];
 for(const {o,kind} of selected){
  sourceNames.push(o.name);
  if(kind==='floor')o.geometry=sinkUnderRooms(o,layout);
  if(kind!=='tower'){const clone=new T.Mesh(o.geometry,o.material);clone.name=kind==='floor'?'P6_atrium_floor_actual':o.name;clone.matrixAutoUpdate=false;clone.matrix.copy(o.matrixWorld);clone.userData={noCollide:true,phase6Architecture:true,role:kind,actualSource:o.name};root.add(clone);o.visible=false;continue;}
  const m=o.material,stair=STAIR_FLIGHT.test(o.name),key=[stair,m.type,m.roughness,m.metalness,!!m.transparent,m.opacity,m.side,m.emissive?.getHex(),m.emissiveIntensity,m.map?.uuid,m.normalMap?.uuid,m.normalScale?.toArray().join(','),m.roughnessMap?.uuid,m.metalnessMap?.uuid,m.emissiveMap?.uuid,m.alphaMap?.uuid,m.aoMap?.uuid,m.envMap?.uuid,m.envMapIntensity,m.depthWrite,m.depthTest,m.alphaTest,m.blending,m.premultipliedAlpha,m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.flatShading,m.toneMapped,m.fog,m.wireframe].join('|');
  let b=buckets.get(key);if(!b){const material=m.clone();material.name='P6_tower_architecture';material.color?.set(0xffffff);material.vertexColors=true;if(material.transparent&&material.side===2)material.forceSinglePass=true;b={parts:[],material,name:stair?'P6_tower_stairs':'P6_tower_architecture'};buckets.set(key,b);}
  let g=o.geometry.clone();if(g.index)g=g.toNonIndexed();g.applyMatrix4(o.matrixWorld);
  if(!g.attributes.normal)g.computeVertexNormals();if(!m.map)g.deleteAttribute('uv');else if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  for(const name of Object.keys(g.attributes))if(!['position','normal','uv','color'].includes(name))g.deleteAttribute(name);
  const tint=m.color||new T.Color(1,1,1),prior=g.attributes.color,c=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<g.attributes.position.count;i++)c.set([tint.r*(prior?prior.getX(i):1),tint.g*(prior?prior.getY(i):1),tint.b*(prior?prior.getZ(i):1)],i*3);
  // A source can colour the faces facing given ways, and shade them as if they faced another ([x,y,z,colour,lit]; the
  // tower's bridge fascias and undersides, model.js), or shade all its faces as if they faced one way (towerLit [x,y,z];
  // the forward shafts' glass and white frame, transit.js and main.js).
  for(const [x,y,z,hex,lit] of o.userData.towerFaces||[]){
   const want=new T.Vector3(x,y,z),colour=new T.Color(hex),n=g.attributes.normal,sum=new T.Vector3(),v=new T.Vector3();
   for(let i=0;i<n.count;i+=3){sum.set(0,0,0);for(let k=0;k<3;k++)sum.add(v.fromBufferAttribute(n,i+k));if(sum.normalize().dot(want)>.7)for(let k=0;k<3;k++){colour.toArray(c,(i+k)*3);if(lit)n.setXYZ(i+k,...lit);}}
  }
  if(o.userData.towerLit)for(let i=0;i<g.attributes.normal.count;i++)g.attributes.normal.setXYZ(i,...o.userData.towerLit);
  g.setAttribute('color',new T.BufferAttribute(c,3));b.parts.push(g);o.visible=false;
 }
 for(const b of buckets.values()){const o=new T.Mesh(mergeGeometries(b.parts),b.material);o.name=b.name;o.userData={noCollide:true,phase6Architecture:true,actualSources:true};root.add(o);b.parts.forEach(g=>g.dispose());}
 // Open atrium-facing room carcasses only. Their glass front stays open;
 // the opaque sides/back/floor/ceiling describe the real room behind it.
 const cabins=placements().filter(c=>c.view==='atrium');
 const flowingRibs=addFlowingAtriumRibs(root,cabins);
 // 4B hanging gardens: sill cascades, signature trees, lake stones and timber decks (visual only).
 const gardens=addAtriumGardens(root,layout);
 for(const side of[-1,1]){const list=cabins.filter(c=>doorSide(c)===side),g=new T.BoxGeometry(3.16,3.4,7.4),p=g.attributes.position,keep=[]; // 1 cm inside the piers: no coplanar sides
  for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(k=>g.index.getX(i+k));if(!ids.every(j=>Math.abs(p.getZ(j)+side*3.7)<.0001))keep.push(...ids);}
  g.setIndex(keep);g.clearGroups();const o=new T.InstancedMesh(g,new T.MeshBasicMaterial({name:'P6_atrium_room_returns',color:0xe6d4b6,side:T.DoubleSide}) /* 4B: warmer cream */,list.length);
  o.name='P6_atrium_room_returns';o.frustumCulled=false;o.userData={noCollide:true,phase6Architecture:true,roomOwners:list.map(c=>c.id),proxySpans:list.map(c=>[c.y-.14,c.y+3.5])};
  list.forEach((c,i)=>o.setMatrixAt(i,c.matrix.clone().multiply(new T.Matrix4().makeTranslation(0,1.7,0))));o.computeBoundingBox();o.computeBoundingSphere();root.add(o);
 }
 // Distant bow/stern backdrop comes from the finished, aperture-cut web skin.
 // Retain only axial end faces; no opaque planes are substituted for windows.
 const endFaces=[];ship.exterior?.updateWorldMatrix(true,true);ship.exterior?.traverse(o=>{if(!o.isMesh||!/^Smooth_pressure_envelope/.test(o.name))return;const p=o.geometry.attributes.position,ix=o.geometry.index;
  for(let i=0;i<(ix?.count??p.count);i+=3){const t=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld));
   if(t.every(q=>q.y< -20)||t.every(q=>q.y>40.1)||!t.some(q=>(q.x>145||q.x< -122)&&Math.abs(q.z)<30))continue;for(const q of t)endFaces.push(q.x,q.y,q.z);}
 });
 if(endFaces.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(endFaces,3));g.computeBoundingBox();g.computeBoundingSphere();const o=new T.Mesh(g,new T.MeshBasicMaterial({name:'P6_distant_finished_end_skin',color:0xd9dcd6,side:T.DoubleSide}));o.name='P6_distant_finished_end_skin';o.frustumCulled=false;o.userData={noCollide:true,phase6Architecture:true,distantOnly:true,finishedWebTriangles:true};root.add(o);}
 root.userData.phase6Architecture={actualSources:selected.length,materialClasses:buckets.size,sourceNames:[...new Set(sourceNames)],atriumCabins:cabins.length,proxyClasses:2,endSkinTriangles:endFaces.length/9,gardens,interiorReach:ATRIUM_PROTOTYPE.interiorReach,flowingRibs};
 for(const o of root.children)if(o.userData.distantOnly)o.visible=false;
 return root.userData.phase6Architecture;
}
export function attachDistantArchitecture(ship,root){
 // Clone only after the finished-skin/room retirement has completed.
 if(ship.v2Haze){const distant=root.clone(true);distant.traverse(o=>{if(o.userData.distantOnly)o.visible=true;});distant.name='P6_distant_atrium_architecture';const materials=new Map();distant.traverse(o=>{if(!o.isMesh)return;let m=materials.get(o.material);if(!m){const source=o.material;m=new T.MeshBasicMaterial({name:'P6_distant_'+source.name,color:source.color||0xffffff,map:source.map||null,vertexColors:!!source.vertexColors,transparent:!!source.transparent,opacity:source.opacity,side:source.side,depthWrite:source.depthWrite,fog:source.fog});m.forceSinglePass=true;materials.set(source,m);}o.material=m;});distant.traverse(o=>{if(o.userData.proxySpans)o.userData.distantProxy=true;});simplifyDistantGardens(distant);ship.v2Haze.add(distant);}
 return root.userData.phase6Architecture;
}
