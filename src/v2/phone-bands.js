// The walk draws each opaque or faint glass material of the deck bands once, not once per band: a phone's frame was
// mostly the CPU's cost of thousands of draws (3,200 in the arrival hall, from about 240 materials; PHONE_WALK.md), and so
// was a desktop's (2,700 at the open atrium, 13 ms a frame on an RTX 3090, 8.4 ms merged; its GPU time fell too).
// Every opaque mesh low-deck batching would take from a deck band (Walk_band_*), and faint glass, is copied into one
// plain mesh per material, its triangles ordered by band, and hidden for good. After showBands, each copy draws the runs
// of the bands showBands shows, one draw per unbroken run (usually one: the bands a view span shows mostly sit together
// in band order). Plain draws only: no multi-draw, no draw list that changes from frame to frame (src/v2/facade.js has
// why that matters on a Galaxy S9).
import * as T from 'three';
import {compactRenderGeometry} from './facade.js';
import {yieldEvery} from './yield-to-page.js';

const IDENTITY=new T.Matrix4(),release=function(){this.array=null;};

// Faint glass that writes no depth merges too (most of the bands' draws are two such glass materials, 18-23% opaque):
// no pane can hide another, and two such panes blended in the other order differ by the square of their opacity times
// their difference (about 5%). Against other transparent things the merged glass sorts by the centre of its bounds, as
// each 50-150 m chunk of it did before, so mostly behind them as before.
const faint=m=>m.transparent&&!m.depthWrite&&m.blending===T.NormalBlending&&m.opacity<=.35;
// Deck menus are left to phase4-culling's room culling unless `menus` (their sources are marked bandMerged).
const eligible=(o,menus)=>{const m=o.material,g=o.geometry;
 return o.isMesh&&!o.isInstancedMesh&&!o.isBatchedMesh&&!o.isSkinnedMesh&&o.visible&&g?.attributes.position&&!Array.isArray(m)&&(!m.transparent&&m.opacity>=1||faint(m))&&!m.isShaderMaterial&&(menus||!m.name.startsWith('P4_menu_deck_'))
  &&!Object.keys(g.morphAttributes).length&&g.drawRange.start===0&&g.drawRange.count===Infinity
  &&!Object.values(g.attributes).some(a=>a.isInterleavedBufferAttribute)&&!(g.attributes.tangent&&!o.matrixWorld.equals(IDENTITY));};
// The bake makes a copy of some plain materials per chunk (48 of Area_light_polished): an opaque material without
// textures or shader hooks merges with any other of the same type and settings (userData included; one that can't be
// written out stays apart).
const settingsOf=m=>{
 if(m.transparent||Object.hasOwn(m,'onBeforeCompile')||Object.hasOwn(m,'customProgramCacheKey'))return null;
 const parts=[m.type];
 try{
  for(const k of Object.keys(m).sort()){if(k==='uuid'||k==='id'||k==='version'||k==='_listeners')continue;const v=m[k];
   if(v?.isTexture||typeof v==='function')return null;
   parts.push(k+'='+(v?.isColor?v.getHex():typeof v?.toArray==='function'?v.toArray().join(','):v!==null&&typeof v==='object'?JSON.stringify(v):String(v)));}
 }catch{return null;}
 return parts.join('|');
};
const layoutOf=g=>Object.entries(g.attributes).map(([k,a])=>k+':'+a.itemSize+':'+a.normalized+':'+a.array.constructor.name).sort().join(',');

/** Merges the deck bands' opaque meshes per material. `hidden` is called with each source once it is copied and hidden.
 * Returns {root, update, proof}: add nothing (root is already in `scene`); call update() after showBands. */
export async function mergePhoneBands(baked,scene,{hidden=null,menus=false}={}){
 const yieldWork=yieldEvery();
 const bands=[...baked.bands.values()].filter(g=>/^Walk_band_/.test(g.name));
 // Band order: by lowest deck, then highest, so the bands a view span shows sit together.
 bands.sort((a,b)=>a.userData.band-b.userData.band||(a.userData.top??a.userData.band)-(b.userData.top??b.userData.band));
 const buckets=new Map(),alike=new Map();
 // A band's direct meshes, and the meshes inside any of its groups marked userData.bandMergeParts (static, such as the
 // wayfinding guides: posts, directory backings and floor arrows share a few materials over 20 decks).
 const partsOf=group=>{const list=[];for(const o of group.children){list.push(o);if(o.userData.bandMergeParts)o.traverse(c=>{if(c!==o&&c.isMesh)list.push(c);});}return list;};
 for(const group of bands)for(const o of partsOf(group)){
  o.updateWorldMatrix(true,false);if(!eligible(o,menus))continue;
  const settings=settingsOf(o.material);let same=settings&&alike.get(settings);if(settings&&!same)alike.set(settings,same=o.material);
  const key=(same||o.material).uuid+'|'+o.renderOrder+'|'+layoutOf(o.geometry);let list=buckets.get(key);if(!list)buckets.set(key,list=[]);list.push({o,group});
 }
 const root=new T.Group();root.name='V2_phone_band_merges';root.userData={noCollide:true,renderOnly:true};root.matrixAutoUpdate=false;
 const merges=[],proof={meshes:0,sources:0,vertices:0,triangles:0},m3=new T.Matrix3(),v=new T.Vector3();
 for(const list of buckets.values()){
  if(list.length<2)continue;
  // A desktop's pieces index vertex pools they share: each is copied with only the vertices it draws.
  for(const e of list){const g=e.o.geometry;e.g=g.index&&g.attributes.position.count>g.index.count?compactRenderGeometry(g):g;await yieldWork();}
  let vertices=0,indices=0;for(const {g} of list){vertices+=g.attributes.position.count;indices+=g.index?g.index.count:g.attributes.position.count;}
  const first=list[0].g,attributes={};
  for(const [name,a] of Object.entries(first.attributes))attributes[name]=new a.array.constructor(vertices*a.itemSize);
  const index=new Uint32Array(indices),runs=[];let vo=0,io=0;
  for(const {o,g,group} of list){
   const count=g.attributes.position.count,ix=g.index?.array;
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
   vo+=count;o.visible=false;o.userData.bandMerged=true;hidden?.(o);if(g!==o.geometry)g.dispose();await yieldWork();
  }
  const geometry=new T.BufferGeometry();
  for(const [name,a] of Object.entries(first.attributes))geometry.setAttribute(name,new T.BufferAttribute(attributes[name],a.itemSize,a.normalized));
  geometry.setIndex(new T.BufferAttribute(index,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  // Drawn only: its arrays leave the page once on the GPU (groups and bounds are all three reads after).
  for(const a of [...Object.values(geometry.attributes),geometry.index])a.onUpload(release);
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
