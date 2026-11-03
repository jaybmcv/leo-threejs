import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {zstdCompressSync,zstdDecompressSync,gunzipSync,constants} from 'node:zlib';
import {MeshoptDecoder} from 'meshoptimizer/decoder';

export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const inflate=bytes=>bytes[0]===0x28&&bytes[1]===0xb5?zstdDecompressSync(bytes):gunzipSync(bytes);
export const compress=bytes=>zstdCompressSync(bytes,{params:{[constants.ZSTD_c_compressionLevel]:3}});
export async function preparedManifest(base){return JSON.parse(inflate(await fs.readFile(base+'/world.bin')));}

// Lazy array reads do not inflate or decode the rest of the ship. This handles
// both the full-build dictionaries and independently addressed patch parts.
export function preparedArrayReader(manifest,base){
 const parts=new Map(),arrays=new Map();
 const part=async i=>{if(!parts.has(i))parts.set(i,inflate(await fs.readFile(base+'/'+manifest.parts[i].name)));return parts.get(i);};
 return async function read(id){
  if(arrays.has(id))return arrays.get(id);await MeshoptDecoder.ready;
  const r=manifest.arrays[id];let bytes;
  if(r.part!==undefined)bytes=(await part(r.part)).subarray(r.offset,r.offset+r.bytes);
  else {let i=Math.floor(r.start/8388608),offset=r.start%8388608;bytes=Buffer.alloc(r.bytes);for(let n=0;n<r.bytes;i++,offset=0){const p=await part(i),count=Math.min(p.length-offset,r.bytes-n);if(count<=0)throw Error('Prepared array range outside transport');p.copy(bytes,n,offset,offset+count);n+=count;}}
  if(r.encoding){const decoded=new Uint8Array(r.count*r.stride);if(r.count){if(r.encoding==='meshopt-sequence'||r.encoding==='meshopt-tuple')MeshoptDecoder.decodeIndexSequence(decoded,r.count,r.stride,bytes);else MeshoptDecoder.decodeVertexBuffer(decoded,r.count,r.stride,bytes);}
   if(r.encoding==='meshopt-tuple'){const d=await read(r.dictionary),words=new Uint32Array(d.buffer,d.byteOffset,d.byteLength/4),codes=new Uint32Array(decoded.buffer),out=new Uint32Array(r.decodedBytes/4);for(let i=0;i<codes.length;i++)for(let k=0;k<3;k++)out[i*3+k]=words[codes[i]*3+k];bytes=new Uint8Array(out.buffer);}
   else if(r.rawStride===r.stride)bytes=decoded;
   else {bytes=new Uint8Array(r.decodedBytes);for(let i=0;i<r.count;i++)bytes.set(decoded.subarray(i*r.stride,i*r.stride+r.rawStride),i*r.rawStride);}
  }
  const C=globalThis[r.type],copy=Uint8Array.from(bytes),result=new C(copy.buffer);arrays.set(id,result);return result;
 };
}

export class PreparedPatch {
 constructor(manifest){this.manifest=manifest;this.parts=[];this.arrays=[];}
 array(array){const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),index=this.manifest.arrays.length;this.manifest.arrays.push({type:array.constructor.name,bytes:bytes.length,part:this.manifest.parts.length+this.parts.length,offset:0,sha256:hash(bytes)});this.parts.push(bytes);this.arrays.push(index);return index;}
 // PreparedWriter assigns local ids. Relocate only typed references; numbers in
 // coordinates and custom metadata are never mistaken for resource ids.
 absorb(writer){
  const a=this.manifest.arrays.length,g=this.manifest.geometries.length,m=this.manifest.materials.length;
  for(const array of writer.arrays)this.array(array);
  const value=v=>{if(!v||typeof v!=='object')return v;if(Array.isArray(v))return v.map(value);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='$array'?x+a:value(x)]));};
  for(const original of writer.geometries){const r=structuredClone(original);for(const p of Object.values(r.attributes))p.array+=a;if(r.index!==null)r.index+=a;r.userData=value(r.userData);this.manifest.geometries.push(r);}
  this.manifest.materials.push(...writer.materials);
  this.manifest.textures.push(...Object.values(writer.meta.textures));this.manifest.images.push(...Object.values(writer.meta.images));
  const graph=original=>{const data=structuredClone(original);for(const n of data.nodes){if(n.geometry!==undefined)n.geometry+=g;if(n.material!==undefined)n.material=Array.isArray(n.material)?n.material.map(i=>i+m):n.material+m;for(const k of ['instanceMatrix','instanceColor'])if(n[k]!==undefined&&n[k]!==null)n[k]+=a;n.userData=value(n.userData);}return data;};
  const bvh=r=>({...r,geometry:r.geometry+g,roots:r.roots.map(i=>i+a),index:r.index===null?null:r.index+a,indirect:r.indirect===null?null:r.indirect+a,...(r.windowFlags==null?{}:{windowFlags:r.windowFlags+a})});
  const colliders=r=>({...r,bands:r.bands.map(([k,b])=>[k,bvh(b)]),groups:r.groups.map(x=>({...x,bvh:bvh(x.bvh),items:value(x.items)})),movers:r.movers.map(x=>({...x,bvh:bvh(x.bvh),matrix:value(x.matrix)})),ground:r.ground?colliders(r.ground):null});
  return {graph,colliders,value};
 }
 async save(destination,base,sourceInputs,details){
  await fs.mkdir(destination,{recursive:true});
  // Each patch buffer is independent. Bundle them into <=8 MiB parts without
  // changing the baseline's final partial part or its global vertex pools.
  const first=this.manifest.parts.length;let fragments=[],length=0,partIndex=first;
  const flush=async()=>{if(!length)return;const data=Buffer.concat(fragments,length),bytes=compress(data),name='geometry-'+partIndex+'.bin';await fs.writeFile(destination+'/'+name,bytes);this.manifest.parts.push({name,bytes:data.length,zipped:bytes.length,codec:'zstd'});partIndex++;fragments=[];length=0;};
  for(let i=0;i<this.parts.length;i++){const data=this.parts[i];if(data.length>8388608)throw Error('A patch array exceeds 8 MiB; use a wider build');if(length+data.length>8388608)await flush();const r=this.manifest.arrays[this.arrays[i]];r.part=partIndex;r.offset=length;fragments.push(data);length+=data.length;}await flush();
  for(const p of this.manifest.parts.slice(0,first))await fs.copyFile(base+'/'+p.name,destination+'/'+p.name);
  this.manifest.fastPatch={version:1,...details,appendedArrays:this.arrays.length};
  const text=JSON.stringify(this.manifest),world=compress(Buffer.from(text));await fs.writeFile(destination+'/world.bin',world);
  const files=[...this.manifest.parts.map(p=>p.name),'world.bin'].sort(),h=createHash('sha256');for(const f of files)h.update(f).update(await fs.readFile(destination+'/'+f));
  const sha256=h.digest('hex'),old=JSON.parse(await fs.readFile(base+'/complete.json','utf8'));
  await fs.writeFile(destination+'/complete.json',JSON.stringify({...old,parts:this.manifest.parts.length,compressedBytes:this.manifest.parts.reduce((n,p)=>n+p.zipped,0)+world.length,metadataBytes:Buffer.byteLength(text),arrays:this.manifest.arrays.length,fastPatch:this.manifest.fastPatch},null,2));
  await fs.writeFile(destination+'/integrity.json',JSON.stringify({sha256,files,sourceInputs},null,2));return {sha256,parts:this.manifest.parts.length,appendedArrays:this.arrays.length};
 }
}
