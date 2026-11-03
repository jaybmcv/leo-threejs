import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import * as T from 'three';

const parse=bytes=>{assert.equal(bytes.readUInt32LE(0),0x46546c67);const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));return {json,bin:bytes.subarray(28+length)};};
const size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const align=buffer=>Buffer.concat([buffer,Buffer.alloc((4-buffer.length%4)%4)]);
function pack(json,bin){bin=align(bin);json.buffers=[{byteLength:bin.length}];const text=align(Buffer.from(JSON.stringify(json))),padding=text.length-Buffer.byteLength(JSON.stringify(json));if(padding)text.fill(32,text.length-padding);const head=Buffer.alloc(20),chunk=Buffer.alloc(8);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+text.length+bin.length,8);head.writeUInt32LE(text.length,12);head.writeUInt32LE(0x4e4f534a,16);chunk.writeUInt32LE(bin.length);chunk.writeUInt32LE(0x004e4942,4);return Buffer.concat([head,text,chunk,bin]);}

export async function patchModels({baseline,destination,rooms,roots}){
 globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
 const selected=new Set(rooms),rows=[],additions=new Map(),seen=new Set();
 const additionFor=async owners=>{
  const key=[...owners].sort().join('|');if(additions.has(key))return additions.get(key);
  const root=new T.Group();
  for(const group of roots){const copy=group.clone(false);for(const mesh of group.children){const keep=[],runs=[];for(const run of mesh.userData.ownerRuns||[])if(owners.has(run.room)||owners.has(run.component)){runs.push({...run,start:keep.length});for(let i=run.start;i<run.start+run.count;i++)keep.push(i);}if(!keep.length)continue;const clone=mesh.clone();clone.instanceMatrix=new T.InstancedBufferAttribute(Float32Array.from(keep.flatMap(i=>Array.from(mesh.instanceMatrix.array.subarray(i*16,i*16+16)))),16);clone.count=keep.length;clone.userData={...mesh.userData,ownerRuns:runs,roomOwners:[...new Set(runs.map(r=>r.room))]};clone.boundingBox=null;clone.boundingSphere=null;copy.add(clone);}if(copy.children.length)root.add(copy);}
  const addition=root.children.length?parse(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false}))):null;
  if(addition)assert(!addition.json.images?.length&&!addition.json.skins?.length&&!addition.json.animations?.length,'Room model patch must contain static untextured fitout');
  additions.set(key,addition);return addition;
 };
 for(const file of (await fs.readdir(baseline)).filter(f=>f.endsWith('.glb'))){
  const original=await fs.readFile(baseline+'/'+file),{json:j,bin}=parse(original),targets=j.nodes.filter(n=>n.extras?.phase4&&n.extras.ownerRuns?.some(r=>selected.has(r.room)||selected.has(r.component)));
  const owners=new Set(rooms.filter(id=>j.nodes.some(n=>n.name==='V2_shell_'+id||n.name==='Area_'+id||n.extras?.ownerRuns?.some(r=>r.room===id||r.component===id))));
  for(const id of owners)seen.add(id);
  if(file==='leo-full-ship.glb')assert(rooms.every(id=>owners.has(id)),'Full ship lacks a changed room owner; use a wider build');
  if(!owners.size){await fs.copyFile(baseline+'/'+file,destination+'/'+file);rows.push({file,reused:true});continue;}
  const fragments=[align(bin)];let length=fragments[0].length;
  const append=bytes=>{const offset=length,b=align(Buffer.from(bytes));fragments.push(b);length+=b.length;return offset;};
  for(const n of targets){const ext=n.extensions?.EXT_mesh_gpu_instancing;if(!ext)throw Error('Affected model fitout is not an instance batch: '+n.name);const runs=n.extras.ownerRuns,keep=[];for(const r of runs)if(!selected.has(r.room)&&!selected.has(r.component))for(let i=r.start;i<r.start+r.count;i++)keep.push(i);
   if(!keep.length){delete n.mesh;delete n.extensions;n.extras.ownerRuns=[];n.extras.roomOwners=[];continue;}
   for(const [key,id]of Object.entries(ext.attributes)){const a=j.accessors[id],view=j.bufferViews[a.bufferView],element=size[a.componentType]*width[a.type],stride=view.byteStride||element,out=Buffer.alloc(keep.length*element);keep.forEach((i,k)=>bin.copy(out,k*element,(view.byteOffset||0)+(a.byteOffset||0)+i*stride,(view.byteOffset||0)+(a.byteOffset||0)+i*stride+element));const bufferView=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:append(out),byteLength:out.length});ext.attributes[key]=j.accessors.length;const next={...a,bufferView,byteOffset:0,count:keep.length};delete next.min;delete next.max;j.accessors.push(next);}
   let offset=0;n.extras.ownerRuns=runs.filter(r=>!selected.has(r.room)&&!selected.has(r.component)).map(r=>{const row={...r,start:offset};offset+=r.count;return row;});n.extras.roomOwners=[...new Set(n.extras.ownerRuns.map(r=>r.room))];
  }
  const addition=await additionFor(owners);
  if(!addition){const bytes=pack(j,Buffer.concat(fragments,length));await fs.writeFile(destination+'/'+file,bytes);rows.push({file,reused:false,removedBatches:targets.length,addedBatches:0,bytes:bytes.length});continue;}
  const a=addition.json,viewOffset=j.bufferViews.length,accessorOffset=j.accessors.length,materialOffset=(j.materials||[]).length,meshOffset=j.meshes.length,nodeOffset=j.nodes.length,binOffset=append(addition.bin);
  j.bufferViews.push(...a.bufferViews.map(v=>({...v,buffer:0,byteOffset:binOffset+(v.byteOffset||0)})));
  j.accessors.push(...a.accessors.map(x=>({...x,bufferView:x.bufferView+viewOffset})));
  j.materials??=[];j.materials.push(...(a.materials||[]));
  j.meshes.push(...a.meshes.map(m=>({...m,primitives:m.primitives.map(p=>({...p,attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,v+accessorOffset])),...(p.indices===undefined?{}:{indices:p.indices+accessorOffset}),...(p.material===undefined?{}:{material:p.material+materialOffset})}))})));
  for(const originalNode of a.nodes){const n=structuredClone(originalNode);if(n.mesh!==undefined)n.mesh+=meshOffset;if(n.children)n.children=n.children.map(i=>i+nodeOffset);if(n.extensions?.EXT_mesh_gpu_instancing)n.extensions.EXT_mesh_gpu_instancing.attributes=Object.fromEntries(Object.entries(n.extensions.EXT_mesh_gpu_instancing.attributes).map(([k,v])=>[k,v+accessorOffset]));j.nodes.push(n);}
  let added=0;for(let i=0;i<a.nodes.length;i++){const source=a.nodes[i];if(!/^V2_phase4_deck_\d+$/.test(source.name))continue;const parent=j.nodes.slice(0,nodeOffset).find(n=>n.name===source.name);if(parent){parent.children??=[];parent.children.push(...(source.children||[]).map(n=>n+nodeOffset));}else{j.scenes[j.scene||0].nodes.push(i+nodeOffset);}added+=(source.children||[]).length;}
  assert(added>0,'No matching room model parent in '+file);
  j.extensionsUsed=[...new Set([...(j.extensionsUsed||[]),...(a.extensionsUsed||[])])];j.extensionsRequired=[...new Set([...(j.extensionsRequired||[]),...(a.extensionsRequired||[])])];
  const bytes=pack(j,Buffer.concat(fragments,length));await fs.writeFile(destination+'/'+file,bytes);rows.push({file,reused:false,owners:[...owners],removedBatches:targets.length,addedBatches:added,bytes:bytes.length});
 }
 assert(rooms.every(id=>seen.has(id)),'No model contains a changed room owner; use a wider build');
 return rows;
}
