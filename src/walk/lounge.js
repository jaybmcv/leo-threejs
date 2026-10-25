import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {LOUNGE} from '../hydro-nip-lounge.js';

// The Hydro-Nip Lounge on foot (HYDRO_NIP_LOUNGE.md, phases 2-3; the room itself is src/hydro-nip-lounge.js):
// - the maze's and the dome's sliding doors open for anyone near them, other players included, and each leaf is a
//   moving collider while it slides;
// - the nine hammocks swing gently (in the vertex shader: one draw for all nine), and a walker lying in one swings
//   with it;
// - inside the maze the catnip mist thins round the camera and a green haze tints the view instead, heavy on the
//   ground floor, light on the lower platform and gone on the top one;
// - the room's mood (from tester feedback): its ceiling panels burn dim and warm, and while the camera is in the
//   commons the walk's lights (shared by the whole ship) ease down and warm, with a violet bounce from below, and the
//   neon and its halos burn brighter.
// Made after the colliders and rest spots and before the walk merges the ship for drawing: the doors and hammocks
// leave the ship for meshes of their own, drawn with the lounge floor's deck band (main.js).
const DOOR={reach:2.6,rise:2.5,time:.6},SWAY={amp:.075,rate:1.45};
// In the room: the lights' share of their usual strength, their colours, and how much brighter the neon and halos burn.
const MOOD={hemi:.32,fill:.12,env:.22,sky:0xffb26b,ground:0x5a2f99,neon:1.35,glow:1.9};
const flip=g=>{for(const a of Object.values(g.attributes))for(let i=0;i<a.count;i+=3)for(let k=0;k<a.itemSize;k++){const t=a.array[(i+1)*a.itemSize+k];a.array[(i+1)*a.itemSize+k]=a.array[(i+2)*a.itemSize+k];a.array[(i+2)*a.itemSize+k]=t;}return g;};
// A mesh's geometry in world space (turned back the right way out under the commons' mirror).
const worldGeometry=o=>{const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);return o.matrixWorld.determinant()<0?flip(g):g;};
const boxTriangles=([w,h,d])=>{const out=[],c=i=>[(i&4?1:-1)*w/2,(i&2?1:-1)*h/2,(i&1?1:-1)*d/2];
 for(const f of [[0,1,3],[0,3,2],[4,6,7],[4,7,5],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,2,6],[0,6,4],[1,5,7],[1,7,3]])for(const i of f)out.push(...c(i));return out;};

export function createLounge(ship,colliders,light=null){
 const root=ship.root.getObjectByName('Hydro_Nip_Lounge');if(!root)return null;
 root.updateMatrixWorld(true);
 const frame=root.matrixWorld,toWorld=(x,y,z)=>new T.Vector3(x,y,z).applyMatrix4(frame);
 // Everything drawn here is placed at the lounge floor's height, so main.js files it with that floor's deck band.
 const floorY=toWorld(0,LOUNGE.FLOOR,0).y,drawn=[];
 const place=(g,mat,name)=>{g.translate(0,-floorY,0);const o=new T.Mesh(g,mat);o.name=name;o.position.y=floorY;o.frustumCulled=false;drawn.push(o);return o;};

 // Doors: each leaf (pane and frame) slides along its own `slide`; the doors' state is how far open, 0 to 1.
 const leaves=new Map();
 root.traverse(o=>{if(o.isMesh&&/^Lounge_door_(panel|frame)$/.test(o.name)){const k=o.userData.door+':'+o.userData.slide[0];(leaves.get(k)||leaves.set(k,{meshes:[]}).get(k)).meshes.push(o);}});
 const doors=[];
 for(const leaf of leaves.values()){
  const pane=leaf.meshes[0],u=pane.userData,at=pane.getWorldPosition(new T.Vector3());
  leaf.at=at;leaf.door=u.door;leaf.slide=toWorld(...u.slide).sub(toWorld(0,0,0));
  leaf.mover=colliders.addMover('lounge-door',boxTriangles(u.size),new T.Matrix4().makeTranslation(at.x,at.y,at.z));
  const d=doors[u.door]||(doors[u.door]={leaves:[],centre:new T.Vector3(),open:0});d.leaves.push(leaf);
 }
 for(const d of doors){d.centre.set(0,0,0);for(const l of d.leaves)d.centre.add(l.at);d.centre.divideScalar(d.leaves.length);d.centre.y=floorY;}
 // One mesh per material for all the leaves; each leaf's vertices move together.
 const byMaterial=new Map();
 for(const leaf of leaves.values())for(const o of leaf.meshes){const list=byMaterial.get(o.material)||byMaterial.set(o.material,[]).get(o.material);list.push({leaf,g:worldGeometry(o)});o.removeFromParent();}
 const doorMeshes=[...byMaterial].map(([mat,items])=>{
  const g=mergeGeometries(items.map(i=>i.g));let start=0;const ranges=items.map(i=>{const r={leaf:i.leaf,start,count:i.g.attributes.position.count};start+=r.count;return r;});
  const mesh=place(g,mat,'Walk_lounge_doors'),base=g.attributes.position.array.slice();return {mesh,ranges,base};});
 let doorsMoved=true;
 function slideDoors(){
  for(const {mesh,ranges,base} of doorMeshes){const p=mesh.geometry.attributes.position,a=p.array;
   for(const r of ranges){const d=doors[r.leaf.door].open,ox=r.leaf.slide.x*d,oy=r.leaf.slide.y*d,oz=r.leaf.slide.z*d;
    for(let i=r.start*3,e=(r.start+r.count)*3;i<e;i+=3){a[i]=base[i]+ox;a[i+1]=base[i+1]+oy;a[i+2]=base[i+2]+oz;}}
   p.needsUpdate=true;mesh.geometry.computeBoundingSphere();}
  for(const leaf of leaves.values()){const o=doors[leaf.door].open,p=leaf.at.clone().addScaledVector(leaf.slide,o);leaf.mover.place(new T.Matrix4().makeTranslation(p.x,p.y,p.z));}
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
  place(mergeGeometries(parts),mat,'Walk_lounge_hammocks');
  for(const o of hammocks)o.removeFromParent();
 }
 // How a hammock (a rest spot's mesh) hangs now: the same swing as the shader's.
 const time=()=>performance.now()/1000;
 function swingOf(mesh){const s=swing.find(h=>h.mesh===mesh);if(!s)return null;return {pivot:s.pivot,axis:s.axis,angle:SWAY.amp*Math.sin(time()*SWAY.rate+s.phase)};}

 // The maze tower, in the world, for the mist and the haze.
 const {MAZE,LEVELS}=LOUNGE,tower=new T.Box3().setFromPoints([toWorld(MAZE.x0,LOUNGE.FLOOR,MAZE.z0),toWorld(MAZE.x1,MAZE.top,MAZE.z1)]);
 // The maze's mist, taken whole (the walk would split it by deck band, a draw for each).
 const mists=[];let mist=1,haze=0,tint=null;
 root.traverse(o=>{if(o.isMesh&&o.material?.name==='Lounge_maze_mist')mists.push(o);});
 for(const o of mists){const m=place(worldGeometry(o),o.material,'Walk_lounge_mist');m.renderOrder=o.renderOrder;o.removeFromParent();o.material.userData.full=o.material.opacity;}
 if(typeof document!=='undefined'){tint=document.createElement('div');tint.id='lounge-haze';
  tint.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;background:radial-gradient(ellipse at 50% 55%,rgba(150,255,170,.25),rgba(70,200,110,.8));mix-blend-mode:screen';
  document.body.appendChild(tint);}

 // The mood. The commons' ceiling panels (Circadian_light) take a warm, dim copy of their material for good.
 const {ROOM}=LOUNGE,room=new T.Box3().setFromPoints([toWorld(ROOM.x0,LOUNGE.FLOOR,ROOM.z0),toWorld(ROOM.x1,LOUNGE.CEILING,ROOM.z1)]);
 let warm=null;root.parent?.parent?.traverse(o=>{if(o.isMesh&&o.name==='Circadian_light'){
  warm||=Object.assign(o.material.clone(),{name:'Walk_lounge_ceiling_light'});warm.color.set(0x5a4030);warm.emissive.set(0xffa04a);warm.emissiveIntensity=.3;o.material=warm;}});
 const glows=[];root.traverse(o=>{if(o.isMesh&&/^Lounge_(neon_glow|additive_glow)$/.test(o.material?.name)&&!glows.some(g=>g.m===o.material))glows.push({m:o.material,k:o.material.name==='Lounge_neon_glow'?MOOD.neon:MOOD.glow});});
 const base=light&&{hemi:light.hemi.intensity,fill:light.fill.intensity,env:light.scene.environmentIntensity,sky:light.hemi.color.clone(),ground:light.hemi.groundColor.clone()};
 const sky=new T.Color(MOOD.sky),ground=new T.Color(MOOD.ground);let mood=0,shown=0;
 function setMood(t){
  if(base){const {hemi,fill,scene}=light,f=(a,b)=>a+(b-a)*t;
   hemi.intensity=f(base.hemi,base.hemi*MOOD.hemi);fill.intensity=f(base.fill,base.fill*MOOD.fill);scene.environmentIntensity=f(base.env,base.env*MOOD.env);
   hemi.color.lerpColors(base.sky,sky,t);hemi.groundColor.lerpColors(base.ground,ground,t);}
  for(const {m,k} of glows)m.color.setScalar(1+(k-1)*t);
 }

 return {
  drawn,doors,
  // After the merge for drawing: the maze's mist meshes (split by deck band) to thin out.
  // `bodies`: the walker's and every other player's positions; `eye`: the camera's.
  update(dt,bodies,eye){
   uniforms.uTime.value=time();
   for(const d of doors){const near=bodies.some(b=>Math.abs(b.y-d.centre.y)<DOOR.rise&&Math.hypot(b.x-d.centre.x,b.z-d.centre.z)<DOOR.reach);
    const o=T.MathUtils.clamp(d.open+(near?1:-1)*dt/DOOR.time,0,1);if(o!==d.open){d.open=o;doorsMoved=true;}}
   if(doorsMoved){doorsMoved=false;slideDoors();}
   const inside=tower.containsPoint(eye),k=1-Math.exp(-4*dt);
   mist+=((inside?.12:1)-mist)*k;for(const o of mists)o.material.opacity=o.material.userData.full*mist;
   haze+=((inside?(eye.y<LEVELS[0]?.34:eye.y<LEVELS[1]?.16:0):0)-haze)*k;if(tint)tint.style.opacity=haze.toFixed(3);
   mood+=((room.containsPoint(eye)?1:0)-mood)*k;if(Math.abs(mood-shown)>.002||(mood<.002&&shown)){shown=mood<.002?0:mood;setMood(shown);}
  },
  swingOf,
 };
}
