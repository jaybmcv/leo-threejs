// The phone ship (PHONE_WALK.md) draws each opaque or faint glass material of the deck bands once, not once per band:
// a phone's frame was mostly the CPU's cost of thousands of draws (3,200 in the arrival hall, from about 240
// materials), while the GPU draws the same triangles either way.
// Every opaque mesh low-deck batching would take from a deck band (Walk_band_*), and faint glass, is copied into one
// plain mesh per material, its triangles ordered by band, and hidden for good. After showBands, each copy draws the runs
// of the bands showBands shows, one draw per unbroken run (usually one: the bands a view span shows mostly sit together
// in band order). Plain draws only: no multi-draw, no draw list that changes from frame to frame (src/v2/facade.js has
// why that matters on a Galaxy S9).
import * as T from 'three';

const IDENTITY=new T.Matrix4();

// Faint glass that writes no depth merges too (most of the bands' draws are two such glass materials, 18-23% opaque):
// no pane can hide another, and two such panes blended in the other order differ by the square of their opacity times
// their difference (about 5%). Against other transparent things the merged glass sorts by the centre of its bounds, as
// each 50-150 m chunk of it did before, so mostly behind them as before.
const faint=m=>m.transparent&&!m.depthWrite&&m.blending===T.NormalBlending&&m.opacity<=.35;
const eligible=o=>{const m=o.material,g=o.geometry;
 return o.isMesh&&!o.isInstancedMesh&&!o.isBatchedMesh&&!o.isSkinnedMesh&&o.visible&&g?.attributes.position&&!Array.isArray(m)&&(!m.transparent&&m.opacity>=1||faint(m))&&!m.isShaderMaterial&&!m.name.startsWith('P4_menu_deck_')
  &&!Object.keys(g.morphAttributes).length&&g.drawRange.start===0&&g.drawRange.count===Infinity
  &&!Object.values(g.attributes).some(a=>a.isInterleavedBufferAttribute)&&!(g.attributes.tangent&&!o.matrixWorld.equals(IDENTITY));};
const layoutOf=g=>Object.entries(g.attributes).map(([k,a])=>k+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name).sort().join(',');

/** Merges the deck bands' opaque meshes per material. `hidden` is called with each source once it is copied and hidden.
 * Returns {root, update, proof}: add nothing (root is already in `scene`); call update() after showBands. */
export async function mergePhoneBands(baked,scene,{hidden=null}={}){
 let slice=performance.now();const yieldWork=async()=>{if(performance.now()-slice<12)return;await new Promise(resolve=>setTimeout(resolve,0));slice=performance.now();};
 const bands=[...baked.bands.values()].filter(g=>/^Walk_band_/.test(g.name));
 // Band order: by lowest deck, then highest, so the bands a view span shows sit together.
 bands.sort((a,b)=>a.userData.band-b.userData.band||(a.userData.top??a.userData.band)-(b.userData.top??b.userData.band));
 const buckets=new Map();
 for(const group of bands)for(const o of group.children){
  o.updateWorldMatrix(true,false);if(!eligible(o))continue;
  const key=o.material.uuid+'|'+o.renderOrder+'|'+layoutOf(o.geometry);let list=buckets.get(key);if(!list)buckets.set(key,list=[]);list.push({o,group});
 }
 const root=new T.Group();root.name='V2_phone_band_merges';root.userData={noCollide:true,renderOnly:true};root.matrixAutoUpdate=false;
 const merges=[],proof={meshes:0,sources:0,vertices:0,triangles:0},m3=new T.Matrix3(),v=new T.Vector3();
 for(const list of buckets.values()){
  if(list.length<2)continue;
  let vertices=0,indices=0;for(const {o} of list){const g=o.geometry;vertices+=g.attributes.position.count;indices+=g.index?g.index.count:g.attributes.position.count;}
  const first=list[0].o.geometry,attributes={};
  for(const [name,a] of Object.entries(first.attributes))attributes[name]=new a.array.constructor(vertices*a.itemSize);
  const index=new Uint32Array(indices),runs=[];let vo=0,io=0;
  for(const {o,group} of list){
   const g=o.geometry,count=g.attributes.position.count,ix=g.index?.array;
   const m=o.matrixWorld,identity=m.equals(IDENTITY);if(!identity)m3.getNormalMatrix(m);
   for(const [name,a] of Object.entries(g.attributes)){const out=attributes[name],n=a.itemSize;
    if(identity||(name!=='position'&&name!=='normal')){out.set(a.array.subarray(0,count*n),vo*n);continue;}
    // A moved part: positions take its matrix, directions its normal matrix (getX/setX keep normalized storage).
    const target=new T.BufferAttribute(out,n,a.normalized);
    for(let i=0;i<count;i++){v.fromBufferAttribute(a,i);if(name==='position')v.applyMatrix4(m);else v.applyMatrix3(m3).normalize();target.setXYZ(vo+i,v.x,v.y,v.z);if(n===4)target.setW(vo+i,a.getW(i));}
   }
   // A mirrored part flips its winding: swap two corners so its faces keep facing out.
   const flip=!identity&&m.determinant()<0,start=io;
   if(ix){for(let i=0;i<ix.length;i+=3){index[io++]=ix[i]+vo;index[io++]=ix[i+(flip?2:1)]+vo;index[io++]=ix[i+(flip?1:2)]+vo;}}
   else for(let i=0;i<count;i+=3){index[io++]=vo+i;index[io++]=vo+i+(flip?2:1);index[io++]=vo+i+(flip?1:2);}
   const last=runs.at(-1);if(last&&last.group===group)last.count+=io-start;else runs.push({group,start,count:io-start});
   vo+=count;o.visible=false;hidden?.(o);await yieldWork();
  }
  const geometry=new T.BufferGeometry();
  for(const [name,a] of Object.entries(first.attributes))geometry.setAttribute(name,new T.BufferAttribute(attributes[name],a.itemSize,a.normalized));
  geometry.setIndex(new T.BufferAttribute(index,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  // One material slot, drawn once per run of shown bands (geometry groups).
  const mesh=new T.Mesh(geometry,[list[0].o.material]);mesh.name='V2_low_deck_merged_'+list[0].o.material.name;mesh.renderOrder=list[0].o.renderOrder;
  mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;mesh.userData={noCollide:true,renderOnly:true,sources:list.map(e=>e.o.uuid)};root.add(mesh);
  merges.push({mesh,runs});proof.meshes++;proof.sources+=list.length;proof.vertices+=vertices;proof.triangles+=indices/3;await yieldWork();
 }
 scene.add(root);root.updateMatrixWorld(true);
 let last='';
 const update=()=>{
  let key='';for(const g of bands)key+=g.visible?'1':'0';if(key===last)return;last=key;
  for(const {mesh,runs} of merges){const groups=mesh.geometry.groups;groups.length=0;
   for(const r of runs){if(!r.group.visible)continue;const last=groups.at(-1);if(last&&last.start+last.count===r.start)last.count+=r.count;else groups.push({start:r.start,count:r.count,materialIndex:0});}
   mesh.visible=groups.length>0;}
 };
 update();
 return {root,update,proof};
}
