// Collision-only reader for focused fixtures. Restores the saved BVHs; builds no
// meshes or BVHs and never starts the walk flood or any model producer.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {ZSTDDecoder} from 'three/addons/libs/zstddec.module.js';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {MeshBVH} from 'three-mesh-bvh';
import {Colliders} from '../src/walk/collision.js';
const types={Float32Array,Float64Array,Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array};
export async function readGotoColliders(directory){
 let base=path.resolve(directory);const exists=async f=>!!await fs.stat(f).catch(()=>null);
 if(!await exists(path.join(base,'world.bin'))&&!await exists(path.join(base,'world.json.gz'))){
  const dirs=await fs.readdir(base,{withFileTypes:true}),found=[];
  for(const d of dirs)if(d.isDirectory()&&await exists(path.join(base,d.name,'world.bin')))found.push(d.name);
  if(found.length!==1)throw Error('Specify one prepared-walk directory containing world.bin');base=path.join(base,found[0]);
 }
 const zstd=new ZSTDDecoder();await zstd.init();await MeshoptDecoder.ready;
 const inflate=b=>b[0]===0x28&&b[1]===0xb5?zstd.decode(b):gunzipSync(b);
 const metadata=await fs.readFile(path.join(base,await exists(path.join(base,'world.bin'))?'world.bin':'world.json.gz'));
 const manifest=JSON.parse(new TextDecoder().decode(inflate(metadata))),arrays=new Map(),geometries=new Map(),bvhs=new Map();let partIndex=-1,part=null;
 const bytes=async r=>{const out=new Uint8Array(r.bytes);let at=0,start=r.start;while(at<out.length){const i=Math.floor(start/8388608);if(partIndex!==i){part=inflate(await fs.readFile(path.join(base,manifest.parts[i].name)));partIndex=i;}const offset=start-i*8388608,n=Math.min(out.length-at,part.length-offset);out.set(part.subarray(offset,offset+n),at);at+=n;start+=n;}return out;};
 const array=async id=>{
  if(id===null||id===undefined)return null;if(arrays.has(id))return arrays.get(id);
  const r=manifest.arrays[id];let b=await bytes(r);
  if(r.encoding){const decoded=new Uint8Array(r.count*r.stride);if(r.count){if(r.encoding==='meshopt-sequence'||r.encoding==='meshopt-tuple')MeshoptDecoder.decodeIndexSequence(decoded,r.count,r.stride,b);else MeshoptDecoder.decodeVertexBuffer(decoded,r.count,r.stride,b);}
   if(r.encoding==='meshopt-tuple'){const dict=await array(r.dictionary),words=new Uint32Array(dict.buffer,dict.byteOffset,dict.byteLength/4),codes=new Uint32Array(decoded.buffer),out=new Uint32Array(r.decodedBytes/4);for(let i=0;i<codes.length;i++)for(let k=0;k<3;k++)out[i*3+k]=words[codes[i]*3+k];b=new Uint8Array(out.buffer);}
   else if(r.rawStride===r.stride)b=decoded;else{b=new Uint8Array(r.decodedBytes);for(let i=0;i<r.count;i++)b.set(decoded.subarray(i*r.stride,i*r.stride+r.rawStride),i*r.rawStride);}
  }
  if(b.byteOffset%types[r.type].BYTES_PER_ELEMENT)b=b.slice();const result=new types[r.type](b.buffer,b.byteOffset,b.byteLength/types[r.type].BYTES_PER_ELEMENT);arrays.set(id,result);return result;
 };
 const geometry=async id=>{if(geometries.has(id))return geometries.get(id);const r=manifest.geometries[id],g=new T.BufferGeometry();for(const [k,a]of Object.entries(r.attributes))g.setAttribute(k,new T.BufferAttribute(await array(a.array),a.itemSize,a.normalized));if(r.index!==null)g.setIndex(new T.BufferAttribute(await array(r.index),1));if(r.bounds)g.boundingBox=new T.Box3(new T.Vector3(...r.bounds[0]),new T.Vector3(...r.bounds[1]));geometries.set(id,g);return g;};
 const bvh=async r=>{const key=r.roots.join(',');if(bvhs.has(key))return bvhs.get(key);const roots=[];for(const id of r.roots){const a=await array(id);roots.push(a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength));}const b=MeshBVH.deserialize({version:r.version,roots,index:await array(r.index),indirectBuffer:await array(r.indirect)},await geometry(r.geometry),{setIndex:false});bvhs.set(key,b);return b;};
 const value=v=>{if(v===null||typeof v!=='object')return v;if(v.$matrix4)return new T.Matrix4().fromArray(v.$matrix4);if(v.$box3)return new T.Box3(new T.Vector3(...v.$box3[0]),new T.Vector3(...v.$box3[1]));if(Array.isArray(v))return v.map(value);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,value(x)]));};
 const collider=async r=>{const c=new Colliders();for(const [key,b]of r.bands){const tree=await bvh(b);c.bands.set(key,{band:key,bvh:tree,geometry:tree.geometry});}for(const g of r.groups){const items=g.items.map(value);c.groups.push({name:g.name,bvh:await bvh(g.bvh),items,cells:new Map(g.cells.map(([k,ids])=>[k,ids.map(i=>items[i])]))});}if(r.ground){c.v2Ground=await collider(r.ground);c.raycastGround=(...args)=>c.v2Ground.raycast(...args);}return c;};
 const colliders=await collider(manifest.colliders);part=null;arrays.clear();
 return {colliders,base,sha256:JSON.parse(await fs.readFile(path.join(base,'integrity.json'),'utf8')).sha256};
}
