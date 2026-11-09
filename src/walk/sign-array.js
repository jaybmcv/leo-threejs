import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {compactRenderGeometry} from '../v2/facade.js';

// The wayfinding signs (283, each its own 512×128 picture; src/v2/signs.js, prepared) draw from one texture array, as one
// mesh for the single-faced (double-sided) signs and one for the two-faced ones, for the whole ship: triangles in band
// order, one draw per unbroken run of shown bands, as src/v2/phone-bands.js does. The open atrium drew about 80 of them,
// each about 5 µs of a desktop's main thread. The originals stay in the scene, hidden (the Go-to fixture counts the 283
// placements). The array's layers take the signs' own size: 512×128 on a desktop, 256×64 in the phone ship's payload
// (about 100 and 24 MB with mipmaps). A sign of another size keeps its own draw. `maxLayers` is the GPU's
// MAX_ARRAY_TEXTURE_LAYERS. Returns {root, update, proof}, or null; call update() after showBands.
export function mergeWayfindingSigns(bands,{maxLayers=256}={}){
 const found=[];
 for(const band of bands)band.traverse(o=>{
  if(!o.isMesh||!/^V2_wayfinding/.test(o.name)||!o.visible||Array.isArray(o.material))return;
  const image=o.material.map?.image;if(!image?.width||!image.height||image.complete===false)return;
  found.push({o,band,map:o.material.map,side:o.material.side,size:image.width+'x'+image.height});
 });
 const sizes=new Map();for(const e of found)sizes.set(e.size,(sizes.get(e.size)||0)+1);
 const common=[...sizes].sort((a,b)=>b[1]-a[1])[0]?.[0],entries=found.filter(e=>e.size===common);
 if(entries.length<2)return null;
 for(const e of entries)e.o.updateWorldMatrix(true,false);
 const order=g=>[g.userData.band,g.userData.top??g.userData.band];
 entries.sort((a,b)=>order(a.band)[0]-order(b.band)[0]||order(a.band)[1]-order(b.band)[1]);
 // An array holds at most `maxLayers` pictures (WebGL2 promises 256; the ship has 283 signs), so the signs fill as many
 // arrays as they need, each with its own meshes.
 const [w,h]=common.split('x').map(Number),index=new Map();for(const e of entries)if(!index.has(e.map))index.set(e.map,index.size);
 const chunks=Math.ceil(index.size/maxLayers),arrays=[],canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const context=canvas.getContext('2d',{willReadFrequently:true});
 for(let c=0;c<chunks;c++){
  const depth=Math.min(maxLayers,index.size-c*maxLayers),data=new Uint8Array(w*h*4*depth);
  for(const [map,i] of index){if(Math.floor(i/maxLayers)!==c)continue;const layer=i%maxLayers;
   context.clearRect(0,0,w,h);context.drawImage(map.image,0,0,w,h);const px=context.getImageData(0,0,w,h).data;
   // A picture's top row sits at v=1 (three flips images); an array's first row is v=0, so rows go in bottom first.
   for(let y=0;y<h;y++)data.set(px.subarray((h-1-y)*w*4,(h-y)*w*4),(layer*h+y)*w*4);}
  const array=new T.DataArrayTexture(data,w,h,depth);array.colorSpace=T.SRGBColorSpace;array.generateMipmaps=true;
  array.minFilter=T.LinearMipmapLinearFilter;array.magFilter=T.LinearFilter;array.needsUpdate=true;
  // On the GPU it needs no copy in the page.
  array.onUpdate=()=>{array.image.data=null;};arrays.push(array);
 }
 // The 1×1 map only turns on three's map UVs; the array is sampled in its place.
 const uvOnly=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);uvOnly.needsUpdate=true;
 const material=(side,array)=>{const m=new T.MeshBasicMaterial({name:'V2_wayfinding_array',map:uvOnly,side});
  m.onBeforeCompile=shader=>{shader.uniforms.signArray={value:array};
   shader.vertexShader='attribute float signLayer;\nvarying float vSignLayer;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n\tvSignLayer=signLayer;');
   shader.fragmentShader='uniform highp sampler2DArray signArray;\nvarying float vSignLayer;\n'+shader.fragmentShader.replace('#include <map_fragment>','diffuseColor*=texture(signArray,vec3(vMapUv,vSignLayer));');};
  m.customProgramCacheKey=()=>'v2-wayfinding-array';return m;};
 const root=new T.Group();root.name='V2_wayfinding_array';root.userData={noCollide:true,renderOnly:true};root.matrixAutoUpdate=false;
 const merges=[],proof={signs:entries.length,layers:index.size,arrays:chunks,meshes:0,size:[w,h]};
 for(const side of new Set(entries.map(e=>e.side)))for(let c=0;c<chunks;c++){
  const parts=[],runs=[];let io=0;
  for(const e of entries){
   const i=index.get(e.map);if(e.side!==side||Math.floor(i/maxLayers)!==c)continue;
   const g=compactRenderGeometry(e.o.geometry);g.applyMatrix4(e.o.matrixWorld);
   g.setAttribute('signLayer',new T.BufferAttribute(new Float32Array(g.attributes.position.count).fill(i%maxLayers),1));
   const count=g.index.count,last=runs.at(-1);if(last&&last.band===e.band)last.count+=count;else runs.push({band:e.band,start:io,count});io+=count;parts.push(g);
   // A placement group holding only this sign then draws nothing: hide it too, so three's scene walk skips it.
   e.o.visible=false;if(e.o.parent!==e.band&&e.o.parent?.children.length===1)e.o.parent.visible=false;
  }
  if(!parts.length)continue;
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;
  const mesh=new T.Mesh(geometry,[material(side,arrays[c])]);mesh.name='V2_wayfinding_array_'+(side===T.DoubleSide?'double':'front')+(c?'_'+c:'');
  mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;mesh.userData={noCollide:true,renderOnly:true};root.add(mesh);merges.push({mesh,runs});proof.meshes++;
 }
 root.updateMatrixWorld(true);
 let last='';
 const update=()=>{
  let key='';for(const {runs} of merges)for(const r of runs)key+=r.band.visible?'1':'0';if(key===last)return;last=key;
  for(const {mesh,runs} of merges){const groups=mesh.geometry.groups;groups.length=0;
   for(const r of runs){if(!r.band.visible)continue;const g=groups.at(-1);if(g&&g.start+g.count===r.start)g.count+=r.count;else groups.push({start:r.start,count:r.count,materialIndex:0});}
   mesh.visible=groups.length>0;}
 };
 update();
 return {root,update,proof};
}
