import {ReplayGeometry,replayMerged} from "../v2/prepared-geometry-replay.public.js";
import layout from '../plan/selected-layout.js';
import {fitPreparedLounge as fitNativeLounge} from '../v2/prepared-runtime.public.js';
import * as T from 'three';
import {roomObject,deltaMatrix,hasFrameOverride,moverOrientation} from '../plan/rooms.js';
import {mergeGeometries as nativeMergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {LOUNGE,takeDomeLogo,terpeneBarPlacement} from '../hydro-nip-lounge.js';
import {createTerpeneGlassware} from '../terpene-glassware.js';
import {createLoungeSky} from './lounge-sky.public.js';
import {createLoungeMural} from './lounge-mural.public.js';
import {createLoungeAquarium} from './lounge-aquarium.js';
import {bandOf} from './collision.js';

// The Hydro-Nip Lounge on foot (HYDRO_NIP_LOUNGE.md, phases 2-3; the room itself is src/hydro-nip-lounge.js):
// - the maze's and the dome's sliding doors open for anyone near them, other players included, and each leaf is a
//   moving collider while it slides;
// - the nine hammocks swing gently (in the vertex shader: one draw for all nine), and a walker lying in one swings
//   with it;
// - the room's mood (from tester feedback): its ceiling is clear glass open to the stars and a huge full moon
//   (lounge-sky.js); the walk's lights easing down and warm in the room and the maze's mist and haze are
//   lounge-mood.js, which only the walk pages run, so editing them doesn't rebuild the ship;
// - the code-generated synthwave sunset on the aft side wall, spanning Decks 17-19 (lounge-mural.js);
// - the aquarium filling its front wall, three storeys of glowing reef and fish, with the jaguar's throat running through
//   it as a glass tunnel (lounge-aquarium.js).
// Made after the colliders and rest spots and before the walk merges the ship for drawing: the doors and hammocks
// leave the ship for meshes of their own, drawn with the lounge floor's deck band (main.js).
const DOOR={reach:2.6,rise:2.5,time:.6},SWAY={amp:.075,rate:1.45};
const flip=g=>{for(const a of Object.values(g.attributes))for(let i=0;i<a.count;i+=3)for(let k=0;k<a.itemSize;k++){const t=a.array[(i+1)*a.itemSize+k];a.array[(i+1)*a.itemSize+k]=a.array[(i+2)*a.itemSize+k];a.array[(i+2)*a.itemSize+k]=t;}return g;};
// A mesh's geometry in world space (turned back the right way out under the commons' mirror).
const worldGeometry=o=>{const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);return o.matrixWorld.determinant()<0?flip(g):g;};
const boxTriangles=([w,h,d])=>{const out=[],c=i=>[(i&4?1:-1)*w/2,(i&2?1:-1)*h/2,(i&1?1:-1)*d/2];
 for(const f of [[0,1,3],[0,3,2],[4,6,7],[4,7,5],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,2,6],[0,6,4],[1,5,7],[1,7,3]])for(const i of f)out.push(...c(i));return out;};

export function createLounge(ship,colliders){
 const root=roomObject(ship,'Hydro_Nip_Lounge');if(!root)return null;
 root.updateMatrixWorld(true);
 const frame=root.matrixWorld,toWorld=(x,y,z)=>new T.Vector3(x,y,z).applyMatrix4(frame);
 const logo=takeDomeLogo(root);
 // Everything drawn here is placed at the lounge floor's height, so main.js files it with that floor's deck band.
 const floorY=toWorld(0,LOUNGE.FLOOR,0).y,drawn=[];
 // Where the doors, hammocks and glass roof can draw (userData.occlusionBox, for the walk's occlusion in
 // group-occlusion.js): set once the prepared lounge is fitted in below, which gives each placed mesh its stored userData.
 const declared=[];
 const place=(g,mat,name)=>{g.translate(0,-floorY,0);const o=new T.Mesh(g,mat);o.name=name;o.position.y=floorY;o.frustumCulled=false;drawn.push(o);return o;};

 // Doors: each leaf (pane and frame) slides along its own `slide`; the doors' state is how far open, 0 to 1.
 const leaves=new Map();
 root.traverse(o=>{if(o.isMesh&&/^Lounge_door_(panel|frame)$/.test(o.name)){const k=o.userData.door+':'+o.userData.slide[0];(leaves.get(k)||leaves.set(k,{meshes:[]}).get(k)).meshes.push(o);}});
 const doors=[];
 for(const leaf of leaves.values()){
  const pane=leaf.meshes[0],u=pane.userData,at=pane.getWorldPosition(new T.Vector3());
  leaf.at=at;leaf.door=u.door;leaf.slide=toWorld(...u.slide).sub(toWorld(0,0,0));
  leaf.mover=colliders.addMover('lounge-door',boxTriangles(u.size),moverOrientation('commons-1',new T.Matrix4().makeTranslation(at.x,at.y,at.z)));
  const d=doors[u.door]||(doors[u.door]={leaves:[],centre:new T.Vector3(),open:0});d.leaves.push(leaf);
 }
 for(const d of doors){d.centre.set(0,0,0);for(const l of d.leaves)d.centre.add(l.at);d.centre.divideScalar(d.leaves.length);d.centre.y=floorY;}
 // One mesh per material for all the leaves; each leaf's vertices move together.
 const byMaterial=new Map();
 for(const leaf of leaves.values())for(const o of leaf.meshes){const list=byMaterial.get(o.material)||byMaterial.set(o.material,[]).get(o.material);list.push({leaf,g:worldGeometry(o)});o.removeFromParent();}
 const doorMeshes=[...byMaterial].map(([mat,items])=>{
  const g=replayMerged("src/walk/lounge.js",nativeMergeGeometries,items.map(i=>i.g));let start=0;const ranges=items.map(i=>{const r={leaf:i.leaf,start,count:i.g.attributes.position.count};start+=r.count;return r;});
  const mesh=place(g,mat,'Walk_lounge_doors'),base=g.attributes.position.array.slice();
  // The doors shut or fully open (slideDoors writes `base` moved by each leaf's slide; the bounds stay as built).
  declared.push([mesh,()=>{const box=new T.Box3().setFromArray(base);for(const r of ranges){const leaf=new T.Box3().setFromArray(base.subarray(r.start*3,(r.start+r.count)*3));leaf.min.addVectors(leaf.min,r.leaf.slide);leaf.max.addVectors(leaf.max,r.leaf.slide);box.union(leaf);}return box.expandByScalar(.05);}]);
  return {mesh,ranges,base};});
 let doorsMoved=true;
 function slideDoors(){
  for(const {mesh,ranges,base} of doorMeshes){const p=mesh.geometry.attributes.position,a=p.array;
   for(const r of ranges){const d=doors[r.leaf.door].open,ox=r.leaf.slide.x*d,oy=r.leaf.slide.y*d,oz=r.leaf.slide.z*d;
    for(let i=r.start*3,e=(r.start+r.count)*3;i<e;i+=3){a[i]=base[i]+ox;a[i+1]=base[i+1]+oy;a[i+2]=base[i+2]+oz;}}
   p.needsUpdate=true;mesh.geometry.computeBoundingSphere();}
  for(const leaf of leaves.values()){const o=doors[leaf.door].open,p=leaf.at.clone().addScaledVector(leaf.slide,o);leaf.mover.place(moverOrientation('commons-1',new T.Matrix4().makeTranslation(p.x,p.y,p.z)));}
 }

 // Hammocks: one mesh, each vertex swung about its own hammock's long axis (through its rim's middle).
 const hammocks=[];root.traverse(o=>{if(o.isMesh&&o.name==='Hammock')hammocks.push(o);});
 const uniforms={uTime:{value:0}},swing=[];
 if(hammocks.length){
  const parts=hammocks.map((o,i)=>{const g=worldGeometry(o),n=g.attributes.position.count,pivot=o.getWorldPosition(new T.Vector3()),axis=new T.Vector3(1,0,0).transformDirection(o.matrixWorld);
   const phase=(o.userData.sway??i)*2.1;swing.push({mesh:o,pivot,axis,phase});
   const fill=(v,size)=>new T.Float32BufferAttribute(Array.from({length:n},()=>v).flat(),size);
   g.setAttribute('aPivot',fill(pivot.toArray(),3));g.setAttribute('aAxis',fill(axis.toArray(),3));g.setAttribute('aPhase',fill([phase],1));return g;});
  const mat=hammocks[0].material.clone();mat.name='Walk_lounge_hammocks';
  mat.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms,{uAmp:{value:SWAY.amp},uRate:{value:SWAY.rate}});
   s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
uniform float uTime;uniform float uAmp;uniform float uRate;attribute vec3 aPivot;attribute vec3 aAxis;attribute float aPhase;
vec3 swingAbout(vec3 v,float a){return v*cos(a)+cross(aAxis,v)*sin(a)+aAxis*dot(aAxis,v)*(1.-cos(a));}`)
    .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat swingA=uAmp*sin(uTime*uRate+aPhase);objectNormal=swingAbout(objectNormal,swingA);')
    .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=swingAbout(transformed-(aPivot-vec3(0.,'+floorY.toFixed(4)+',0.)),swingA)+(aPivot-vec3(0.,'+floorY.toFixed(4)+',0.));');};
  mat.customProgramCacheKey=()=>'lounge-hammocks';
  const hung=place(replayMerged("src/walk/lounge.js",nativeMergeGeometries,parts),mat,'Walk_lounge_hammocks');
  // Each vertex swings at most SWAY.amp about its pivot, so moves at most its distance from it times that.
  declared.push([hung,()=>{const pos=hung.geometry.attributes.position,piv=hung.geometry.attributes.aPivot;if(!piv)return null;let reach=0;
   for(let i=0;i<pos.count;i++)reach=Math.max(reach,Math.hypot(pos.getX(i)-piv.getX(i),pos.getY(i)-(piv.getY(i)-floorY),pos.getZ(i)-piv.getZ(i)));
   return new T.Box3().setFromBufferAttribute(pos).expandByScalar(reach*SWAY.amp+.05);}]);
  for(const o of hammocks)o.removeFromParent();
 }
 // How a hammock (a rest spot's mesh) hangs now: the same swing as the shader's.
 const time=()=>performance.now()/1000;
 function swingOf(mesh){const s=swing.find(h=>h.mesh===mesh);if(!s)return null;return {pivot:s.pivot,axis:s.axis,angle:SWAY.amp*Math.sin(time()*SWAY.rate+s.phase)};}

 // The maze's mist, taken whole (the walk would split it by deck band, a draw for each); lounge-mood.js thins it.
 const mists=[];
 root.traverse(o=>{if(o.isMesh&&o.material?.name==='Lounge_maze_mist')mists.push(o);});
 for(const o of mists){const m=place(worldGeometry(o),o.material,'Walk_lounge_mist');m.renderOrder=o.renderOrder;o.removeFromParent();o.material.userData.full=o.material.opacity;}

 // The mood. The commons' ceiling panels (Circadian_light) go, and a glass roof open to space goes in under the ceiling
 // (lounge-sky.js), drawn with the floor's band so it shows from inside the dome too, where the ceiling's band is culled.
 // The mural fills the aft side wall across Decks 17-19, clear of the upper gallery doors and aquarium.
 const mural=createLoungeMural(frame);
 if(mural){mural.group.userData={band:bandOf(toWorld(0,mural.low,0).y),top:bandOf(toWorld(0,mural.top,0).y)};}
 // The aquarium: its glass solid everywhere, its tank drawn in the page (null in Node).
 const aquarium=createLoungeAquarium(ship,frame,colliders);
 if(aquarium)aquarium.group.userData={band:bandOf(toWorld(0,aquarium.low,0).y),top:bandOf(toWorld(0,aquarium.top,0).y)};
 const {ROOM}=LOUNGE;
 const panels=[];root.parent?.parent?.traverse(o=>{if(o.isMesh&&o.name==='Circadian_light')panels.push(o);});for(const o of panels)o.removeFromParent();
 {const sky=createLoungeSky(frame,ROOM,LOUNGE.CEILING-.16,uniforms.uTime);const roof=place(sky.geometry,sky.material,'Walk_lounge_glass_roof');
  // Its shader draws the geometry where it is (lounge-sky.js): its own bounds.
  declared.push([roof,()=>new T.Box3().setFromBufferAttribute(roof.geometry.attributes.position)]);}
 // The neon and halo materials, which burn brighter in the room's mood (lounge-mood.js).
 const glows=[];root.traverse(o=>{if(o.isMesh&&/^Lounge_(neon_glow|additive_glow)$/.test(o.material?.name)&&!glows.includes(o.material))glows.push(o.material);});

 fitNativeLounge(ship,layout,drawn,mural);
 for(const [o,bounds] of declared){const b=bounds();if(b&&!b.isEmpty())o.userData.occlusionBox=b;}
 // Keep the small instanced display live, outside the static bake and hull trimming.
 root.getObjectByName('Terpene_glassware')?.removeFromParent();
 const still=createTerpeneGlassware(),display=new T.Group();display.name='Walk_terpene_glassware';display.position.y=floorY;
 still.group.applyMatrix4(new T.Matrix4().makeTranslation(0,-floorY,0).multiply(frame).multiply(terpeneBarPlacement));display.add(still.group);drawn.push(display);
 return {
  drawn,doors,still,logo,
  // The dome's centre on its floor and its radius in the world, for its lullaby (lullaby.js).
  dome:{centre:toWorld(LOUNGE.DOME.x,LOUNGE.FLOOR,LOUNGE.DOME.z),r:LOUNGE.DOME.r},
  // The wall mural's group (null in Node), filed with the deck bands it spans by main.js.
  mural:mural?.group||null,
  // The aquarium's group (null in Node), filed the same way.
  aquarium:aquarium?.group||null,
  // For the room's mood (lounge-mood.js, which the walk pages run after this step and which adds `inside`): the
  // lounge's frame in the world, the maze's mist meshes and the neon and halo materials.
  frame,mists,glows,tableSmoke:root.userData.tableSmoke,
  // `bodies`: the walker's and every other player's positions.
  update(dt,bodies){
   uniforms.uTime.value=time();aquarium?.update();still.update(dt);
   logo?.rotateY(dt*2*Math.PI/25);
   for(const d of doors){const near=bodies.some(b=>Math.abs(b.y-d.centre.y)<DOOR.rise&&Math.hypot(b.x-d.centre.x,b.z-d.centre.z)<DOOR.reach);
    const o=T.MathUtils.clamp(d.open+(near?1:-1)*dt/DOOR.time,0,1);if(o!==d.open){d.open=o;doorsMoved=true;}}
   if(doorsMoved){doorsMoved=false;slideDoors();}
  },
  swingOf,
 };
}

