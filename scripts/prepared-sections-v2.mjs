// The public prepared walk in sections (src/v2/prepared-sections.js has the format and the reader). Sections carry the
// verified whole-ship artifact's own encoded arrays, byte for byte: the vertex pools, index values and BVHs are the
// artifact's, so everything bound to them (the atrium geometry pack's guards and LOD indices) holds. A section is a
// render band group (by lowest deck), a collision deck (static and ground bands), a template module, the core or its
// images; an array more than one section uses (or a tuple dictionary) is a shared file of its own. Files are named by
// content and cached by their uncompressed bytes, so a fast patch compresses and uploads only the sections it changed.
// output/leo-interior-v02/prepared-walk stays the build's source of truth; this runs at public packaging
// (prepared-public-v2.mjs, LEO_PREPARED_SECTIONS=1).
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import * as zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {preparedManifest,inflate} from './prepared-patch-v2.mjs';
import {SECTIONS_FORMAT,SECTION_FILE,splitSectionFile,validSectionsIndex,loadPreparedSections} from '../src/v2/prepared-sections.js';

const sha=b=>createHash('sha256').update(b).digest('hex');
const types={Float32Array,Float64Array,Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array};
const MAX_FILE=15*1024*1024,GRAPHS=['source','haze','facade','lounge','frost','signs'];
export const sectionsCache='output/leo-interior-v02/prepared-sections-cache';
// What turns uncompressed section bytes into published files.
const compression={level:19,checksum:1,zstd:process.versions.zstd||process.version};

export const deckOfBand=key=>Number(String(key).match(/^-?\d+/)[0]);
export const templateModule=key=>key.split(/[:|]/)[0];

// A fragment collects what one file holds: local ids in first-use order, global ids behind them.
class Fragment{
 constructor(m,id){this.m=m;this.id=id;this.arrayIds=new Map();this.arrays=[];this.geometryIds=new Map();this.geometries=[];this.source=[];this.body={};}
 array(id){if(id===null||id===undefined)return id;if(id!==this.own&&this.shared?.has(id))return this.shared.get(id);let local=this.arrayIds.get(id);if(local===undefined){local=this.arrays.length;this.arrayIds.set(id,local);this.arrays.push(id);}return local;}
 value(v){if(!v||typeof v!=='object')return v;if(Array.isArray(v))return v.map(x=>this.value(x));const out={};for(const [k,x]of Object.entries(v))out[k]=k==='$array'?this.array(x):this.value(x);return out;}
 geometry(id){let local=this.geometryIds.get(id);if(local===undefined){const r=this.m.geometries[id];local=this.geometries.length;this.geometryIds.set(id,local);this.source.push(id);
  this.geometries.push({...r,attributes:Object.fromEntries(Object.entries(r.attributes).map(([k,a])=>[k,{...a,array:this.array(a.array)}])),index:r.index===null?null:this.array(r.index),userData:this.value(r.userData)});}return local;}
 graph(data){return {...data,nodes:data.nodes.map(n=>({...n,...(n.geometry===undefined?{}:{geometry:this.geometry(n.geometry)}),...(n.instanceMatrix===undefined?{}:{instanceMatrix:this.array(n.instanceMatrix)}),...(n.instanceColor==null?{}:{instanceColor:this.array(n.instanceColor)}),userData:this.value(n.userData)}))};}
 bvh(r){return {...r,geometry:this.geometry(r.geometry),roots:r.roots.map(i=>this.array(i)),index:r.index===null?null:this.array(r.index),indirect:r.indirect===null?null:this.array(r.indirect),...(r.windowFlags==null?{}:{windowFlags:this.array(r.windowFlags)})};}
}

// Which sections reach each array: the same walk the fragments make, without building them.
function arrayUsers(m){
 const users=new Map(),dictionaries=new Set(),use=(a,s)=>{if(a===null||a===undefined)return;let set=users.get(a);if(!set)users.set(a,set=new Set());set.add(s);const d=m.arrays[a].dictionary;if(d!==undefined){dictionaries.add(d);use(d,s);}};
 const value=(v,s)=>{if(!v||typeof v!=='object')return;if(v.$array!==undefined)return use(v.$array,s);for(const x of Array.isArray(v)?v:Object.values(v))value(x,s);};
 const geometry=(id,s)=>{const g=m.geometries[id];for(const a of Object.values(g.attributes))use(a.array,s);use(g.index,s);value(g.userData,s);};
 const graph=(d,s)=>{for(const n of d.nodes){if(n.geometry!==undefined)geometry(n.geometry,s);use(n.instanceMatrix,s);use(n.instanceColor,s);value(n.userData,s);}};
 const bvh=(r,s)=>{geometry(r.geometry,s);r.roots.forEach(a=>use(a,s));use(r.index,s);use(r.indirect,s);use(r.windowFlags,s);};
 for(const [k,g]of m.bands)graph(g,'render:'+deckOfBand(k));
 for(const [k,r]of m.colliders.bands)bvh(r,'collision:'+deckOfBand(k));
 for(const [k,r]of m.colliders.ground?.bands||[])bvh(r,'collision:'+deckOfBand(k));
 for(const [k,id]of m.geometryTemplates||[])geometry(id,'tpl:'+templateModule(k));
 for(const k of GRAPHS)if(m[k])graph(m[k],'core');
 const col=c=>{for(const g of c.groups){bvh(g.bvh,'core');value(g.items,'core');}for(const x of c.movers){bvh(x.bvh,'core');value(x.matrix,'core');}if(c.ground)col(c.ground);};col(m.colliders);
 for(const [k,v]of Object.entries(m))if(!['arrays','geometries','parts','bands','geometryTemplates','colliders','fastPatch',...GRAPHS].includes(k))value(v,'core');
 return {users,dictionaries};
}

// Shared arrays, core, images, then render groups and collision decks low to high, then template modules by name.
export function splitPrepared(m){
 const {users,dictionaries}=arrayUsers(m),sharedIds=[...users].filter(([id,s])=>s.size>1||dictionaries.has(id)).map(([id])=>id).sort((a,b)=>a-b),keys=new Map(),shared=new Map();
 for(const id of sharedIds){const r=m.arrays[id];let key=r.type+':'+r.sha256,n=1;while(keys.has(key))key=r.type+':'+r.sha256+'#'+n++;keys.set(key,id);shared.set(id,key);}
 const fragment=id=>{const f=new Fragment(m,id);f.shared=shared;return f;},sections=new Map(),section=id=>{if(!sections.has(id))sections.set(id,fragment(id));return sections.get(id);};
 const sharedFragments=[...keys].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,id])=>{const f=fragment('shared:'+key);f.own=id;f.array(id);f.body={shared:key};return f;});
 for(const [key,graph]of m.bands){const f=section('render:'+deckOfBand(key));(f.body.bands??=[]).push([key,f.graph(graph)]);}
 for(const [key,r]of m.colliders.bands){const f=section('collision:'+deckOfBand(key));(f.body.colliderBands??=[]).push([key,f.bvh(r)]);}
 for(const [key,r]of m.colliders.ground?.bands||[]){const f=section('collision:'+deckOfBand(key));(f.body.groundBands??=[]).push([key,f.bvh(r)]);}
 for(const [key,id]of m.geometryTemplates||[]){const f=section('tpl:'+templateModule(key));(f.body.templates??=[]).push([key,f.geometry(id)]);}
 // The core is every other reachable thing; geometries and arrays nothing reaches (a patch's replaced ones) are dropped.
 const core=fragment('core'),{arrays,geometries,parts,bands,geometryTemplates,fastPatch,images,...rest}=m,graphs=GRAPHS.filter(k=>rest[k]);
 for(const k of graphs)rest[k]=core.graph(rest[k]);
 const colliders=(c,depth)=>{assert(depth<2||!c.bands.length,'Prepared collision nested deeper than ground');return {...c,bands:[],groups:c.groups.map(g=>({...g,bvh:core.bvh(g.bvh),items:core.value(g.items)})),movers:c.movers.map(x=>({...x,bvh:core.bvh(x.bvh),matrix:core.value(x.matrix)})),ground:c.ground?colliders(c.ground,depth+1):null};};
 rest.colliders=colliders(m.colliders,0);const arrayKeys=[];
 for(const k of Object.keys(rest))if(!graphs.includes(k)&&k!=='colliders'){const before=JSON.stringify(rest[k]);rest[k]=core.value(rest[k]);if(before.includes('"$array"'))arrayKeys.push(k);}
 core.body={manifest:{...rest,graphs,arrayKeys}};
 const imagesFragment=new Fragment(m,'images');imagesFragment.body={images};
 const rank=id=>{const [kind,rest]=[id.slice(0,id.indexOf(':')),id.slice(id.indexOf(':')+1)];return kind==='render'?[0,Number(rest),'']:kind==='collision'?[1,Number(rest),'']:[2,0,rest];};
 const ordered=[...sections.values()].sort((a,b)=>{const x=rank(a.id),y=rank(b.id);return x[0]-y[0]||x[1]-y[1]||(x[2]<y[2]?-1:x[2]>y[2]?1:0);});
 const order={bands:bands.map(b=>b[0]),colliderBands:m.colliders.bands.map(b=>b[0]),groundBands:(m.colliders.ground?.bands||[]).map(b=>b[0])};
 return {fragments:[...sharedFragments,core,imagesFragment,...ordered],order};
}

// The artifact's encoded bytes for a record, as stored: full builds address 8 MiB parts by start, patches by part/offset.
function encodedReader(manifest,base){
 const parts=new Map(),part=async i=>{if(!parts.has(i))parts.set(i,inflate(await fs.readFile(base+'/'+manifest.parts[i].name)));return parts.get(i);};
 return async r=>{if(!r.bytes)return Buffer.alloc(0);const out=Buffer.alloc(r.bytes);let i=r.part!==undefined?r.part:Math.floor(r.start/8388608),offset=r.part!==undefined?r.offset:r.start%8388608;
  for(let n=0;n<r.bytes;i++,offset=0){if(i>=manifest.parts.length)throw Error('Prepared array range outside transport');const p=await part(i),count=Math.min(p.length-offset,r.bytes-n);if(count<=0)throw Error('Prepared array range outside transport');p.copy(out,n,offset,offset+count);n+=count;}return out;};
}

// The uncompressed file: identical record fields but the address, identical encoded bytes; equal ranges stored once.
async function fragmentFile(f,readEncoded){
 const records=[],chunks=[],ranges=new Map();let total=0;
 for(const id of f.arrays){const r=f.m.arrays[id],{start,part,offset,dictionary,...rest}=r,range=r.part!==undefined?'p'+r.part+':'+r.offset+':'+r.bytes:'s'+r.start+':'+r.bytes;let at=ranges.get(range);
  if(at===undefined){const bytes=await readEncoded(r);at=total;chunks.push(bytes);total+=bytes.length;ranges.set(range,at);}
  records.push({...rest,start:at,...(dictionary===undefined?{}:{dictionary:f.array(dictionary)})});}
 const json=Buffer.from(JSON.stringify({format:SECTIONS_FORMAT,id:f.id,arrays:records,geometries:f.geometries,...f.body})),head=Math.ceil((4+json.length)/4)*4,file=Buffer.alloc(head+total);
 file.writeUInt32LE(json.length,0);json.copy(file,4);let at=head;for(const c of chunks){c.copy(file,at);at+=c.length;}return file;
}

// zstd 19 in worker threads: the slow step, and every section is independent.
function compressor(){
 const size=Math.max(1,Math.min(8,os.cpus().length-2)),idle=[],queue=[],workers=[],jobs=new Map();let next=0;
 const code="const {parentPort}=require('node:worker_threads'),z=require('node:zlib');parentPort.on('message',({id,data,level,checksum})=>{const out=new Uint8Array(z.zstdCompressSync(data,{params:{[z.constants.ZSTD_c_compressionLevel]:level,[z.constants.ZSTD_c_checksumFlag]:checksum}}));parentPort.postMessage({id,out},[out.buffer]);});";
 const pump=()=>{while(idle.length&&queue.length){const w=idle.pop(),job=queue.shift();w.postMessage(job,[job.data.buffer]);}};
 for(let i=0;i<size;i++){const w=new Worker(code,{eval:true});w.on('message',({id,out})=>{const job=jobs.get(id);jobs.delete(id);idle.push(w);pump();job.resolve(Buffer.from(out.buffer,out.byteOffset,out.byteLength));});w.on('error',e=>{for(const j of jobs.values())j.reject(e);jobs.clear();});workers.push(w);idle.push(w);}
 return {compress:data=>new Promise((resolve,reject)=>{const id=next++;jobs.set(id,{resolve,reject});queue.push({id,data:Uint8Array.from(data),level:compression.level,checksum:compression.checksum});pump();}),close:()=>Promise.all(workers.map(w=>w.terminate()))};
}

const sharedOf=fragments=>new Map(fragments.filter(f=>f.body.shared!==undefined).map(f=>[f.body.shared,f.arrays[0]]));
// A fragment against the artifact: put back into the artifact's ids, every geometry, graph, collision record (BVH roots,
// index, indirect order, flags, owner spans, bounds) and placement must be the artifact's, JSON for JSON, and every array
// record the same but its address.
function checkFragment(f,fragment,shared){
 const m=f.m,global=x=>{const id=typeof x==='string'?shared.get(x):f.arrays[x];assert(id!==undefined,f.id+' array reference '+x);return id;},ref=x=>x===null||x===undefined?x:global(x);
 assert.equal(fragment.arrays.length,f.arrays.length,f.id+' arrays');
 fragment.arrays.forEach((r,i)=>{const {start,dictionary,...mine}=r,{start:s,part,offset,dictionary:d,...source}=m.arrays[f.arrays[i]];assert.deepEqual(mine,source,f.id+' array '+i);assert.equal(dictionary===undefined?undefined:global(dictionary),d,f.id+' dictionary '+i);});
 const value=v=>{if(!v||typeof v!=='object')return v;if(Array.isArray(v))return v.map(value);const out={};for(const [k,x]of Object.entries(v))out[k]=k==='$array'?global(x):value(x);return out;};
 const geometry=x=>{assert(Number.isInteger(x)&&x<f.source.length,f.id+' geometry reference');return f.source[x];};
 const geometryRecord=r=>({...r,attributes:Object.fromEntries(Object.entries(r.attributes).map(([k,a])=>[k,{...a,array:global(a.array)}])),index:ref(r.index),userData:value(r.userData)});
 const graph=d=>({...d,nodes:d.nodes.map(n=>({...n,...(n.geometry===undefined?{}:{geometry:geometry(n.geometry)}),...(n.instanceMatrix===undefined?{}:{instanceMatrix:global(n.instanceMatrix)}),...(n.instanceColor==null?{}:{instanceColor:global(n.instanceColor)}),userData:value(n.userData)}))});
 const bvh=r=>({...r,geometry:geometry(r.geometry),roots:r.roots.map(global),index:ref(r.index),indirect:ref(r.indirect),...(r.windowFlags==null?{}:{windowFlags:global(r.windowFlags)})});
 const same=(a,b,where)=>assert(JSON.stringify(a)===JSON.stringify(b),'Prepared section '+where+' differs from the artifact');
 fragment.geometries.forEach((g,i)=>same(geometryRecord(g),m.geometries[f.source[i]],f.id+' geometry '+i));
 const find=(list,key)=>{const row=list.find(([k])=>k===key);assert(row,f.id+' key '+key+' not in the artifact');return row[1];};
 if(fragment.manifest){const {arrays,geometries,parts,bands,geometryTemplates,fastPatch,images,...rest}=m,{graphs,arrayKeys,...mine}=fragment.manifest;
  for(const k of graphs)mine[k]=graph(mine[k]);for(const k of arrayKeys)mine[k]=value(mine[k]);
  const col=c=>({...c,groups:c.groups.map(g=>({...g,bvh:bvh(g.bvh)})),movers:c.movers.map(x=>({...x,bvh:bvh(x.bvh)})),ground:c.ground?col(c.ground):null}),strip=c=>({...c,bands:[],ground:c.ground?strip(c.ground):null});
  mine.colliders=col(mine.colliders);same(mine,{...rest,colliders:strip(m.colliders)},'core');}
 if(fragment.images)same(fragment.images,m.images,'images');
 for(const [key,g]of fragment.bands||[])same(graph(g),find(m.bands,key),f.id+' band '+key);
 for(const [key,r]of fragment.colliderBands||[])same(bvh(r),find(m.colliders.bands,key),f.id+' collision '+key);
 for(const [key,r]of fragment.groundBands||[])same(bvh(r),find(m.colliders.ground.bands,key),f.id+' ground '+key);
 for(const [key,gi]of fragment.templates||[])assert.equal(geometry(gi),find(m.geometryTemplates,key),f.id+' template '+key);
}
// Every array in a new file decoded back to its recorded checksum (tuple arrays through their shared dictionary).
async function decodeFragment(fragment,payload,dictionary){
 await MeshoptDecoder.ready;
 for(const r of fragment.arrays){const bytes=payload.subarray(r.start,r.start+r.bytes);let out=bytes;
  if(r.encoding){const d=new Uint8Array(r.count*r.stride);if(r.count){if(r.encoding==='meshopt-vertex')MeshoptDecoder.decodeVertexBuffer(d,r.count,r.stride,bytes);else MeshoptDecoder.decodeIndexSequence(d,r.count,r.stride,bytes);}
   if(r.encoding==='meshopt-tuple'){const words=await dictionary(r.dictionary),codes=new Uint32Array(d.buffer),o=new Uint32Array(r.decodedBytes/4);for(let i=0;i<codes.length;i++){const p=codes[i]*3;o[i*3]=words[p];o[i*3+1]=words[p+1];o[i*3+2]=words[p+2];}out=new Uint8Array(o.buffer);}
   else if(r.rawStride===r.stride)out=d;else{out=new Uint8Array(r.decodedBytes);for(let i=0;i<r.count;i++)out.set(d.subarray(i*r.stride,i*r.stride+r.rawStride),i*r.rawStride);}}
  assert.equal(sha(out),r.sha256,'Prepared section array '+fragment.id);}
}

const exists=f=>fs.access(f).then(()=>true,()=>false);

// Writes sections.json into `destination` and the section files into `blobs`. A file whose uncompressed bytes are cached
// is copied (its bytes checked); a new one is checked against the artifact, decoded, compressed, checked and cached.
export async function writePreparedSections(source,destination,blobs,{integrity,cache=sectionsCache,log=console.log}={}){
 const started=performance.now(),manifest=await preparedManifest(source);assert(!manifest.sectionsIndex,'Sections are made from a whole-ship artifact');
 const readEncoded=encodedReader(manifest,source),{fragments,order}=splitPrepared(manifest),shared=sharedOf(fragments),pool=compressor(),entries=[],timing={split:(performance.now()-started)/1000,files:0,checks:0,compress:0};
 const sharedFiles=new Map(),dictionaries=new Map(),dictionary=async key=>{if(!dictionaries.has(key)){const id=shared.get(key),r=manifest.arrays[id],d=new Uint8Array(r.count*r.stride);await MeshoptDecoder.ready;MeshoptDecoder.decodeVertexBuffer(d,r.count,r.stride,await readEncoded(r));let o=d;if(r.rawStride!==r.stride){o=new Uint8Array(r.decodedBytes);for(let i=0;i<r.count;i++)o.set(d.subarray(i*r.stride,i*r.stride+r.rawStride),i*r.rawStride);}dictionaries.set(key,new Uint32Array(o.buffer,o.byteOffset,o.byteLength/4));}return dictionaries.get(key);};
 await fs.mkdir(cache,{recursive:true});await fs.mkdir(destination,{recursive:true});await fs.mkdir(blobs,{recursive:true});const pending=[];
 try{
  for(const f of fragments){let t=performance.now();const file=await fragmentFile(f,readEncoded),bytes=sha(file);timing.files+=(performance.now()-t)/1000;
   const key=sha(JSON.stringify([bytes,compression])),record=path.join(cache,key+'.json');let entry=await fs.readFile(record,'utf8').then(JSON.parse,()=>null);
   if(entry){for(const x of entry.files){const b=await fs.readFile(path.join(cache,x.name)).catch(()=>null);if(!b||b.length!==x.bytes||sha(b)!==x.sha256){entry=null;break;}}}
   if(entry){entries.push({...entry,id:f.id,reused:true});continue;}
   t=performance.now();const {fragment,payload}=splitSectionFile(file);checkFragment(f,fragment,shared);await decodeFragment(fragment,payload,dictionary);timing.checks+=(performance.now()-t)/1000;
   const slot={id:f.id,reused:false};entries.push(slot);
   pending.push((async()=>{const t=performance.now(),zipped=await pool.compress(file);timing.compress+=(performance.now()-t)/1000;
    assert(inflate(zipped).equals(file),'Prepared section '+f.id+' compression');
    const name='s-'+sha(zipped).slice(0,20),files=[];for(let at=0,i=0;at<zipped.length;at+=MAX_FILE,i++){const part=zipped.subarray(at,at+MAX_FILE),n=name+(zipped.length>MAX_FILE?'-'+i:'')+'.bin';files.push({name:n,bytes:part.length,sha256:sha(part)});await fs.writeFile(path.join(cache,n),part);}
    Object.assign(slot,{key,files,bytes:file.length,sha256:bytes,zipped:zipped.length});const {id,reused,...stored}=slot;await fs.writeFile(record+'.tmp',JSON.stringify(stored));await fs.rename(record+'.tmp',record);})());
  }
  await Promise.all(pending);
 }finally{await pool.close();}
 for(const e of entries)for(const x of e.files)await fs.copyFile(path.join(cache,x.name),path.join(blobs,x.name));
 const relative=path.relative(destination,blobs).replaceAll('\\','/'),sections=entries.map(({reused,key,zipped,...e})=>({...e,files:e.files.map(x=>({...x,name:relative+'/'+x.name}))}));
 const index={format:SECTIONS_FORMAT,source:integrity?.sha256??null,order,sections,...(manifest.fastPatch?{fastPatch:manifest.fastPatch}:{})};
 validSectionsIndex(index);await fs.writeFile(path.join(destination,'sections.json'),JSON.stringify(index));
 const rewritten=entries.filter(e=>!e.reused),size=e=>e.files.reduce((n,x)=>n+x.bytes,0);
 const summary={sections:entries.length,files:entries.reduce((n,e)=>n+e.files.length,0)+1,rewritten:rewritten.map(e=>e.id),rewrittenBytes:rewritten.reduce((n,e)=>n+size(e),0),compressedBytes:entries.reduce((n,e)=>n+size(e),0),seconds:(performance.now()-started)/1000,timing};
 log(`Prepared sections: ${summary.sections} sections, ${rewritten.length} new (${(summary.rewrittenBytes/1e6).toFixed(1)} MB), ${(summary.compressedBytes/1e6).toFixed(1)} MB in all, ${summary.seconds.toFixed(1)} s`);
 return {index,summary,blobs:entries.flatMap(e=>e.files.map(x=>x.name))};
}

// Keeps the cache to what the given indexes use.
export async function pruneSectionsCache(indexes,cache=sectionsCache){
 const keep=new Set();for(const index of indexes)for(const e of index.sections)for(const x of e.files)keep.add(path.basename(x.name));
 const records=(await fs.readdir(cache).catch(()=>[])).filter(n=>/^[0-9a-f]{64}[.]json$/.test(n));
 for(const name of records){const e=JSON.parse(await fs.readFile(path.join(cache,name),'utf8'));if(e.files.every(x=>keep.has(x.name)))keep.add(name);else await fs.rm(path.join(cache,name));}
 for(const name of await fs.readdir(cache))if(SECTION_FILE.test(name)&&!keep.has(name))await fs.rm(path.join(cache,name));
}

// A published prepared directory with sections.json, read as the whole-ship manifest with each part's payload attached.
export async function readPreparedSections(directory){
 const {index,manifest,parts}=await loadPreparedSections(n=>fs.readFile(path.join(directory,n)),'sections.json',async b=>inflate(Buffer.from(b.buffer,b.byteOffset,b.byteLength)),{sha256:async b=>sha(b)});
 manifest.parts=parts.map((p,i)=>{const part={name:'section-'+i,bytes:p.length};Object.defineProperty(part,'payload',{value:Buffer.from(p.buffer,p.byteOffset,p.byteLength)});return part;});
 Object.defineProperty(manifest,'sectionsIndex',{value:index});return manifest;
}

// The published index against the artifact it claims: the same source, every file's bytes, and each section's
// uncompressed bytes equal to what this artifact sections into (the structure check runs when a section is first made).
export async function verifyPublicSections(directory,source,integrity){
 const index=validSectionsIndex(JSON.parse(await fs.readFile(path.join(directory,'sections.json'),'utf8')));
 assert.equal(index.source,integrity.sha256,'Public prepared sections are for another artifact');
 const manifest=await preparedManifest(source),{fragments,order}=splitPrepared(manifest),readEncoded=encodedReader(manifest,source);
 assert.deepEqual(index.order,order,'Public prepared section order differs from the artifact');
 assert.deepEqual(index.sections.map(e=>e.id),fragments.map(f=>f.id),'Public prepared sections differ from the artifact\'s');
 let bytes=0;for(let i=0;i<fragments.length;i++){const e=index.sections[i],expected=sha(await fragmentFile(fragments[i],readEncoded)),parts=[];
  for(const x of e.files){const b=await fs.readFile(path.join(directory,x.name));assert(b.length===x.bytes&&sha(b)===x.sha256,'Prepared section file '+x.name);parts.push(b);bytes+=b.length;}
  const file=inflate(Buffer.concat(parts));assert(file.length===e.bytes&&sha(file)===e.sha256&&e.sha256===expected,'Prepared section '+e.id+' differs from the artifact');}
 return {sections:fragments.length,files:index.sections.reduce((n,e)=>n+e.files.length,0)+1,bytes};
}
