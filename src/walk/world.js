import * as T from 'three';
import {DECKS,CABINS,SAMPLE} from '../model.js';
import {shapeAft} from '../concept-shape.js';
import {Colliders,solid,meshTriangles} from './collision.js';
import {LIFTS} from './lifts.js';

// Leo's whole walkable interior, built into `ship` (createShip): every deck's fitted rooms and corridors, the ten
// furnished neighborhoods, the garden commons, the forward lounge, both transit cores and the aft systems, with the
// walls and ceilings that the cutaway views hide switched back on. buildSteps() yields between pieces so a page can
// spread the work over idle frames and build the decks nearest the walker first; Node runs it straight through.
// Exterior parts that are not part of the walls of a space: decals, seams, lights and the like. Everything else stays,
// since the engine-pod chambers and wing galleries live inside the nacelles and wings.
const OUTSIDE_ONLY=/(logo|wordmark|brand|identifier|designation|registry|marker|locator|seam|joint|reveal_line|beacon|light|whisker|hazard|amber)/i;
// (The crown lounge's lamps and glow are inside, though they sit in the exterior model.)
export const outsideOnly=o=>OUTSIDE_ONLY.test(o.name)&&!/^(Crown_|Fin_)/.test(o.name);
const SURFACE=/^(Smooth_pressure_envelope|V3[345]_|Forward_observation|Individual_glazing|Forward_navigation|Forward_side_vent|Crown_|Fin_)/;
export const RESIDENTIAL=DECKS.filter(d=>d.residential).map(d=>d.number);

export function* buildSteps(ship,{order=DECKS.map(d=>d.number)}={}){
 ship.inside.visible=true;
 const transit=ship.ensureTransit();transit.root.visible=true;transit.shell.visible=true;transit.structure.visible=true;
 for(const g of transit.decks.values())g.visible=true;
 yield 'transit';
 const aft=ship.ensureAft();if(!ship.aftShaped){shapeAft(aft.root);ship.aftShaped=true;}
 aft.root.visible=true;for(const g of Object.values(aft.parts))g.visible=true;for(const o of aft.shells)o.visible=true;
 yield 'aft';
 for(const n of order){
  ship.ensureServiceDeck(n);yield 'deck '+n+' rooms';
  if(RESIDENTIAL.includes(n)){ship.ensureResidentialDeck(n);yield 'deck '+n+' cabins';}
 }
 ship.ensureGardens();ship.shared.visible=true;yield 'gardens';
 ship.ensureObservation().root.visible=true;yield 'lounge';
 ship.vertical.visible=false;
 for(const o of ship.cutaway)o.visible=true;
 for(const d of ship.decks)d.visible=true;
}
export function buildAll(ship,options){for(const step of buildSteps(ship,options));}

// The repeated cabins: one template (the sample cabin of Neighborhood 10, in its world frame on Deck 15) and the
// rigid transform of each copy on every residential deck, matching createNeighborhood's instancing.
export function cabinPlacements(){
 const {x,y,z}=SAMPLE,others=CABINS.filter(c=>c.neighborhood===10&&c.id!==SAMPLE.id),out=[];
 for(const deck of RESIDENTIAL){
  const dy=(deck-15)*4;
  for(const c of others){
   const side=c.z-Math.round(c.z/26)*26;
   const m=new T.Matrix4().makeTranslation(c.x,c.y+dy,c.z).multiply(new T.Matrix4().makeRotationY(side<0?Math.PI:0)).multiply(new T.Matrix4().makeTranslation(-x,-y,-z));
   out.push({deck,id:c.id,matrix:m});
  }
 }
 return out;
}
export function cabinTemplate(ship){
 const residence=ship.ensureResidentialDeck(15),out=[];
 for(const part of [residence.walls.getObjectByName('Sample_cabin_walls'),residence.root.getObjectByName('Sample_cabin_fittings')]){
  part.updateMatrixWorld(true);
  // The sample sits on Deck 15 at dy 0, so its world frame is the template frame.
  part.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&solid(o))meshTriangles(o,out);});
 }
 return out;
}

// Gather every collider for a built ship into `into`. `extra` roots (the exterior) add their hull parts; `filter`
// picks solid meshes.
// Parts of the exterior (the wing roots, chiefly) cut right through the hull into the decks of the aft half, where a
// walker meets them in the corridors of Decks 6-9. Drop every exterior triangle that lies wholly within the deck plates'
// outlines (3 m inside the hull); hull-surface parts (skin, windows, crown) are left alone. Also make the exterior
// double-sided: from inside, the hull is seen from behind.
export function prepareExteriorForWalking(ship){
 const outlines=ship.decks.map(d=>{const slab=d.children.find(o=>o.name==='Deck_slab');return {y:d.userData.y+.3,points:slab?.userData.outline||[]};});
 const widthAt=(o,x)=>{const p=o.points;if(!p.length||x<p[0][0]||x>p.at(-1)[0])return -1;let i=0;while(i<p.length-1&&p[i+1][0]<x)i++;const a=p[i],b=p[Math.min(i+1,p.length-1)];if(b[0]-a[0]>4.5)return -1;const t=b[0]===a[0]?0:(x-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t;};
 const inside=v=>{const d=Math.floor((v.y-outlines[0].y)/4);if(d<0||d>=outlines.length)return false;const w=Math.min(widthAt(outlines[d],v.x),d+1<outlines.length?widthAt(outlines[d+1],v.x):Infinity);return w>0&&Math.abs(v.z)<w-.5;};
 ship.exterior.updateMatrixWorld(true);const v=new T.Vector3();let dropped=0;
 // Under the fin the decks end below the hull top, but the fin's skin, root fairing and fillet reach down into the
 // upper service gallery and the crown lift's lower lobby. For parts above the decks, drop triangles under the hull top.
 // The hull top as a 1 m height map, rasterized from the skin's triangles (its long slivers defeat a BVH).
 const X0=-310,Z0=-100,NX=590,NZ=200,top=new Float32Array(NX*NZ).fill(-Infinity),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 ship.exterior.traverse(o=>{if(!o.isMesh||!/^Smooth_pressure_envelope/.test(o.name))return;const g=o.geometry,pos=g.attributes.position,idx=g.index?g.index.array:null,n=idx?idx.length:pos.count;
  for(let t=0;t<n;t+=3){a.fromBufferAttribute(pos,idx?idx[t]:t).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(pos,idx?idx[t+1]:t+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(pos,idx?idx[t+2]:t+2).applyMatrix4(o.matrixWorld);
   const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(d)<1e-9)continue;
   for(let j=Math.max(0,Math.floor(Math.min(a.z,b.z,c.z)-Z0));j<=Math.min(NZ-1,Math.floor(Math.max(a.z,b.z,c.z)-Z0));j++)for(let i=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x)-X0));i<=Math.min(NX-1,Math.floor(Math.max(a.x,b.x,c.x)-X0));i++){
    const x=X0+i+.5,z=Z0+j+.5,l1=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,l2=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d,l3=1-l1-l2;
    if(l1>=-1e-6&&l2>=-1e-6&&l3>=-1e-6){const y=l1*a.y+l2*b.y+l3*c.y;if(y>top[j*NX+i])top[j*NX+i]=y;}}}});
 const underHullTop=p=>{const i=Math.floor(p.x-X0),j=Math.floor(p.z-Z0);return i>=0&&i<NX&&j>=0&&j<NZ&&p.y<top[j*NX+i]-.3;};
 ship.exterior.traverse(o=>{
  if(!o.isMesh)return;
  for(const m of Array.isArray(o.material)?o.material:[o.material])m.side=T.DoubleSide;
  if(SURFACE.test(o.name))return;
  const g=o.geometry,pos=g.attributes.position,idx=g.index?g.index.array:null,n=idx?idx.length:pos.count,keep=[];
  if(!g.boundingBox)g.computeBoundingBox();const upper=g.boundingBox.clone().applyMatrix4(o.matrixWorld).max.y>22,test=upper?underHullTop:inside;
  // The fin's skin, root fairing and fillet close off at the bottom right over the service gallery and the crown lift's
  // lower lobby; below the first fin platform their downward faces go, opening the shaft and lobby into the fin.
  const finRoot=/^(Swept_cat_tail|Tail_root_dorsal_fairing|Fin_root_fillet)/.test(o.name),p0=new T.Vector3(),p1=new T.Vector3(),p2=new T.Vector3(),nrm=new T.Vector3();
  for(let t=0;t<n;t+=3){
   p0.fromBufferAttribute(pos,idx?idx[t]:t).applyMatrix4(o.matrixWorld);p1.fromBufferAttribute(pos,idx?idx[t+1]:t+1).applyMatrix4(o.matrixWorld);p2.fromBufferAttribute(pos,idx?idx[t+2]:t+2).applyMatrix4(o.matrixWorld);
   let drop=test(p0)&&test(p1)&&test(p2);
   if(!drop&&finRoot&&Math.max(p0.y,p1.y,p2.y)<31){nrm.subVectors(p1,p0).cross(v.subVectors(p2,p0)).normalize();drop=Math.abs(nrm.y)>.5;}
   if(drop)dropped++;else for(let k=0;k<3;k++)keep.push(idx?idx[t+k]:t+k);
  }
  if(keep.length<n){o.geometry=g.clone();o.geometry.setIndex(keep);}
 });
 // The crown lift climbs out of the decks through the hull top, the fin's root fairing and the closure under the
 // crown, and the crown lounge's lift box (walls, jambs and sill) overlaps the car's outline. All of them are cut away
 // inside the shaft, so nothing passes through the car.
 const {car,stops}=LIFTS.find(l=>l.id==='crown'),box=(m,y0,y1)=>new T.Box3(new T.Vector3(car.x-car.width/2-m,y0,car.z-car.depth/2-m),new T.Vector3(car.x+car.width/2+m,y1,car.z+car.depth/2+m));
 cutOut(ship.exterior,box(.1,stops[0].y+.3,stops.at(-1).y-1));
 cutOut(ship.root,box(0,stops[0].y,stops.at(-1).y+car.height+.3),o=>/^Crown_lift_(side|back|jamb|threshold)$/.test(o.name));
 return dropped;
}
// Cut away whatever of `root`'s meshes (those `pick` takes) lies inside `box`, exactly: each triangle reaching into it
// is split along the box's faces and the pieces inside dropped, with every attribute carried across the cuts. A cut
// triangle keeps its place, collapsed to a point, and its pieces go at the end, so triangle numbers stay put (the
// hull's window plan counts on them, windows.js).
export function cutOut(root,box,pick=()=>true){
 root.updateMatrixWorld(true);const tb=new T.Box3(),w=new T.Vector3();
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||!pick(o)||!new T.Box3().setFromObject(o).intersectsBox(box))return;
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry,names=Object.keys(g.attributes),attrs=names.map(n=>g.attributes[n]);
  // A vertex is its world position followed by every attribute's components.
  const vert=i=>{w.fromBufferAttribute(g.attributes.position,i).applyMatrix4(o.matrixWorld);const v=[w.x,w.y,w.z];for(const a of attrs)for(let k=0;k<a.itemSize;k++)v.push(a.getComponent(i,k));return v;};
  const lerp=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t),out=[],kept=[];let cut=false;
  for(let t=0;t<g.attributes.position.count;t+=3){
   let poly=[vert(t),vert(t+1),vert(t+2)];tb.makeEmpty();for(const v of poly)tb.expandByPoint(w.set(v[0],v[1],v[2]));
   if(!tb.intersectsBox(box)){kept.push(...poly);continue;}cut=true;kept.push(poly[0],poly[0],poly[0]);
   // Peel off the part beyond each face of the box in turn; what is left after all six is inside.
   for(let f=0;f<6&&poly.length;f++){const k=f>>1,d=v=>f&1?v[k]-box.max.getComponent(k):box.min.getComponent(k)-v[k],keep=[],rest=[];
    poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length],da=d(a),db=d(b);(da>0?keep:rest).push(a);if(da>0!==db>0){const c=lerp(a,b,da/(da-db));keep.push(c);rest.push(c);}});
    if(keep.length>2)out.push(keep);poly=rest.length>2?rest:[];}
  }
  if(!cut)return;
  // Fans of the pieces, without the slivers a cut along an edge leaves.
  const e1=new T.Vector3(),e2=new T.Vector3(),tris=kept;
  for(const p of out)for(let i=1;i<p.length-1;i++){const a=p[0],b=p[i],c=p[i+1];e1.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);e2.set(c[0]-a[0],c[1]-a[1],c[2]-a[2]);if(e1.cross(e2).lengthSq()>1e-12)tris.push(a,b,c);}
  const geo=new T.BufferGeometry(),n=tris.length;
  names.forEach((name,j)=>{const a=attrs[j],off=3+attrs.slice(0,j).reduce((s,x)=>s+x.itemSize,0),arr=new Float32Array(n*a.itemSize);let m=0;
   for(const v of tris)for(let k=0;k<a.itemSize;k++)arr[m++]=v[off+k];
   geo.setAttribute(name,new T.BufferAttribute(arr,a.itemSize));});
  o.geometry=geo;
 });
}

export function buildColliders(ship,{extra=[],filter=solid,into=new Colliders()}={}){
 const colliders=into;
 ship.root.updateMatrixWorld(true);
 colliders.addStatic(ship.inside,filter);
 for(const root of extra)colliders.addStatic(root,o=>filter(o)&&!outsideOnly(o));
 colliders.commit();
 colliders.addInstances('cabins',cabinTemplate(ship),cabinPlacements().map(p=>p.matrix));
 return colliders;
}
