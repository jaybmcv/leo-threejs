// The phone ship (PHONE_WALK.md) keeps less in memory once a thing is on the GPU. A 4 GB phone loaded the light ship but
// slowed and crashed while walking: every picture and shape it drew stayed in the page as well as on the GPU.
// - Pictures: the walk's canvas is about 450×925 pixels on a phone, so a picture in an ordinary material's colour slots
//   larger than PHONE_PICTURE_SIZE is swapped for a copy of that size and uploaded so. The original is held only weakly:
//   a sign drawn once is freed, while a module that redraws its canvas still holds it and gets it back on needsUpdate.
// - Shapes: the prepared ship's arrays are dropped from the page after their first upload (three's onUpload), and those
//   of the meshes low-deck batching copies and hides for good as soon as they are copied. Templates (cloned later),
//   collision, instance attributes, dynamic or morphing geometry and anything outside the prepared ship keep theirs.
import * as T from 'three';
import {preparedResource} from './prepared-resource.public.js';

export const PHONE_PICTURE_SIZE=1024;
const release=function(){this.array=null;};


// Every geometry the prepared ship brought, before setup moves or batches it.
function preparedGeometries(){
 const ship=preparedResource.ship,found=new Set(),visit=root=>root?.traverse(o=>{if(o.geometry)found.add(o.geometry);});
 visit(ship.root);for(const g of ship.v2PreparedBake.bands.values())visit(g);
 for(const g of [ship.v2PreparedHaze,ship.v2PreparedFacade,ship.v2PreparedLounge,ship.v2PreparedSigns,preparedResource.frost])visit(g);
 return found;
}
const prepared=preparedGeometries();

const parts=g=>[...Object.values(g.attributes),g.index].filter(Boolean);
const fixedIn=keep=>a=>!keep.has(a)&&!a.isInstancedBufferAttribute&&!a.isInterleavedBufferAttribute&&a.usage===T.StaticDrawUsage;
// What keeps its arrays whatever happens, and how many of the scene's meshes draw each attribute.
function guard(scene){
 const keep=new Set();
 const keepGeometry=g=>{if(g)for(const a of parts(g))keep.add(a);};
 for(const g of preparedResource.geometryTemplates.values())keepGeometry(g);
 // Collision raycasts read their BVH's geometry, which can be a render mesh's own (collider groups and movers).
 const colliders=c=>{if(!c)return;for(const b of c.bands.values())keepGeometry(b.bvh.geometry);for(const g of c.groups)keepGeometry(g.bvh.geometry);
  for(const list of c.v2PreparedMovers?.values()||[])for(const m of list)keepGeometry(m.bvh.geometry);colliders(c.v2Ground);};
 colliders(preparedResource.ship.v2PreparedColliders);
 const users=new Map();scene.traverse(o=>{if(o.geometry)for(const a of parts(o.geometry))users.set(a,(users.get(a)||0)+1);});
 return {keep,users,fixed:fixedIn(keep)};
}

/** Before low-deck batching: returns what the batching calls with each source it has copied into a batch and hidden for
 * good, which drops the source's arrays unless another mesh draws them. */
export function releaseBatchedSources(scene){
 const {users,fixed}=guard(scene),proof={sources:0,bytes:0};
 const done=o=>{const g=o.geometry;if(!prepared.has(g)||o.isSkinnedMesh)return;for(const a of parts(g))if(a.array&&fixed(a)&&users.get(a)===1){proof.bytes+=a.array.byteLength;a.array=null;}proof.sources++;};
 done.proof=proof;return done;
}

/** After setup (low-deck batching included). `scene` is the walk's scene. Returns the proof counts. */
export function releasePhoneGeometry(scene){
 const {fixed}=guard(scene),proof={released:0,kept:0};
 const batches=new Set();scene.traverse(o=>{if(o.userData.renderOnly&&o.userData.sources?.length&&/^V2_low_deck_(batch|merged)_/.test(o.name))batches.add(o);});
 const releasable=(o,g)=>(prepared.has(g)||batches.has(o))&&!o.isSkinnedMesh&&!Object.keys(g.morphAttributes).length;
 scene.traverse(o=>{const g=o.geometry;if(!g?.attributes.position||!releasable(o,g))return;
  if(!g.boundingSphere)g.computeBoundingSphere();if(!g.boundingBox)g.computeBoundingBox();
  // A culling batch reads its index every frame and each chunk's bounds once, from its positions: work those out now,
  // and keep the index.
  if(o.isBatchedMesh)for(let i=0;i<(o._geometryInfo?.length??0);i++){o.getBoundingBoxAt(i,new T.Box3());o.getBoundingSphereAt(i,new T.Sphere());}
  for(const a of [...Object.values(g.attributes),o.isBatchedMesh?null:g.index]){if(!a?.array||a.onUploadCallback===release)continue;if(!fixed(a)){proof.kept++;continue;}
   a.onUpload(release);proof.released++;}});
 return proof;
}

/** Pictures in the colour slots of ordinary materials larger than `size` are swapped for copies of at most `size`, now and
 * every `every` ms after, and uploaded at that size. Returns {proof, stop, sweep}. */
export function shrinkPhonePictures(renderer,scene,{size=PHONE_PICTURE_SIZE,every=4000}={}){
 const done=new WeakSet(),proof={shrunk:0,reuploaded:0,restored:0,pixels:0};
 const shrink=t=>{
  const img=t.image;if(done.has(t)||!img||t.version===0||t.isRenderTargetTexture||t.isVideoTexture||t.isDataTexture||t.isCompressedTexture)return;
  if(!(img instanceof HTMLCanvasElement||img instanceof HTMLImageElement&&img.complete||typeof ImageBitmap!=='undefined'&&img instanceof ImageBitmap))return;
  const w=img.width,h=img.height;if(Math.max(w,h)<=size)return;
  const s=size/Math.max(w,h),copy=document.createElement('canvas');copy.width=Math.max(1,Math.floor(w*s));copy.height=Math.max(1,Math.floor(h*s));
  copy.getContext('2d').drawImage(img,0,0,copy.width,copy.height);
  const uploaded=!!renderer.properties.get(t).__webglTexture,original=new WeakRef(img);done.add(t);t.image=copy;t.needsUpdate=true;
  proof.shrunk++;if(uploaded)proof.reuploaded++;proof.pixels+=w*h-copy.width*copy.height;
  // A redraw brings the original back while it is still alive (its module holds it) and keeps it from then on; a new
  // picture set in its place (fur colours) stays.
  Object.defineProperty(t,'needsUpdate',{configurable:true,set(v){if(v&&t.image===copy){const o=original.deref();if(o){t.image=o;proof.restored++;}}delete t.needsUpdate;t.needsUpdate=v;}});
 };
 // Only colour data in the standard slots: a shader's own textures (an RGBE environment, lookup tables) and the scene's
 // environment are read texel by texel or decoded, and a smoothed copy changes the lighting.
 const sweep=()=>{const exact=new Set(),list=new Set();
  scene.traverse(o=>{if(o.isScene){if(o.environment?.isTexture)exact.add(o.environment);if(o.background?.isTexture)exact.add(o.background);}
   for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m)continue;
    if(m.uniforms)for(const u of Object.values(m.uniforms))if(u?.value?.isTexture)exact.add(u.value);
    if(m.isShaderMaterial)continue;for(const k of SLOTS)if(m[k]?.isTexture)list.add(m[k]);}});
  for(const t of list)if(!exact.has(t))shrink(t);};
 sweep();const timer=setInterval(sweep,every);return {proof,stop:()=>clearInterval(timer),sweep};
}
const SLOTS=['map','emissiveMap','normalMap','roughnessMap','metalnessMap','alphaMap','bumpMap','specularMap','aoMap','clearcoatMap','sheenColorMap','transmissionMap'];
