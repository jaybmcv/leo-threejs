import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash, randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {gzipSync, gunzipSync} from 'node:zlib';
import {MeshoptEncoder} from 'meshoptimizer/encoder';
import {decodeAtriumGeometryTransport} from '../src/v2/atrium-geometry-transport.js';
import {requirePreparedFresh} from './prepared-identity-v2.mjs';

const require=createRequire(import.meta.url), script=fileURLToPath(import.meta.url);
const MiB=1024*1024, PART_BYTES=8*MiB, MAX_PART_BYTES=16*MiB;
export const ATRIUM_PACK_VARIANTS=Object.freeze({desktop:128*MiB,constrained:48*MiB});
export const ATRIUM_PACK_TRANSPORT='leo-atrium-geometry-transport-v1';
const CACHE_FORMAT='leo-atrium-geometry-cache-v1';
const partName=/^atrium-geometry-[0-9a-f]{64}\.bin$/;
export const geometryPackSha=bytes=>createHash('sha256').update(bytes).digest('hex');

// Trace the actual optimizer/codec/builder import graph, including npm code.
// The temporary trace never writes into the prepared artifact or another build's cache.
export async function atriumPackDependencyIdentity({entryPoints=[script]}={}){
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'leo-atrium-pack-dependencies-'));
 try{
  const binary=process.platform==='win32'?require.resolve('@esbuild/win32-x64/esbuild.exe'):require.resolve('esbuild/bin/esbuild');
  const metafile=path.join(temporary,'inputs.json');
  const child=spawnSync(binary,[...entryPoints.map(file=>path.relative(process.cwd(),file)),'--bundle','--platform=node','--format=esm',
   '--outdir='+path.join(temporary,'trace'),'--metafile='+metafile,'--log-level=error'],{stdio:'inherit',windowsHide:true});
  if(child.status!==0)throw child.error||Error('Atrium render-pack dependency trace failed');
  const metadata=JSON.parse(await fs.readFile(metafile,'utf8'));
  const files={};
  for(const name of [...new Set([...Object.keys(metadata.inputs),'package.json','package-lock.json'])].sort()){
   const bytes=await fs.readFile(name);
   files[name]=geometryPackSha(/\.(?:[cm]?js|json)$/.test(name)?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes);
  }
  // Native compressor/bundler versions are build inputs too.
  const toolchain={node:process.version,zlib:process.versions.zlib,esbuild:geometryPackSha(await fs.readFile(binary))};
  return {hash:geometryPackSha(JSON.stringify({files,toolchain})),files,toolchain};
 }finally{
  const resolved=path.resolve(temporary),parent=path.resolve(os.tmpdir());
  if(!resolved.startsWith(parent+path.sep)||!path.basename(resolved).startsWith('leo-atrium-pack-dependencies-'))throw Error('Unsafe dependency trace cleanup');
  await fs.rm(resolved,{recursive:true,force:true});
 }
}

export function atriumPackCacheIdentity(sourceArtifact,dependencyHash,variants=ATRIUM_PACK_VARIANTS){
 if(!/^[0-9a-f]{64}$/.test(sourceArtifact)||!/^[0-9a-f]{64}$/.test(dependencyHash))throw Error('Invalid atrium pack source identity');
 const identity={format:CACHE_FORMAT,sourceArtifact,dependencyHash,variants,chunkBytes:PART_BYTES};
 return {...identity,key:geometryPackSha(JSON.stringify(identity))};
}

async function atomicWrite(file,bytes){
 const temporary=file+'.tmp-'+randomUUID();
 await fs.writeFile(temporary,bytes);
 try{await fs.rename(temporary,file);}catch(error){await fs.unlink(temporary).catch(()=>{});throw error;}
}

export async function encodeAtriumPackVariants(packs,identity){
 await MeshoptEncoder.ready;
 const files=new Map(),parts=[],byName=new Map();
 const entry={format:ATRIUM_PACK_TRANSPORT,sourceArtifact:identity.sourceArtifact,dependencyHash:identity.dependencyHash,
  parts,variants:{},bytes:0,compressedBytes:0,encoding:'gzip'};
 const compress=raw=>{
  const bytes=gzipSync(raw,{level:9}),sha256=geometryPackSha(bytes),name='atrium-geometry-'+sha256+'.bin';
  if(bytes.length>MAX_PART_BYTES)throw Error('Atrium geometry transport exceeds 16 MiB');
  let part=byName.get(name);
  if(part===undefined){part=parts.length;parts.push(name);byName.set(name,part);files.set(name,bytes);entry.compressedBytes+=bytes.length;}
  return {part,bytes:bytes.length,sha256,decodedBytes:raw.length,decodedSha256:geometryPackSha(raw)};
 };
 const pool=[],pooled=new Map(),transports={};let poolBytes=0;
 // Put the smaller variant's arrays first so its downloads stay compact even
 // when it shares every array with the larger variant.
 for(const [variant] of Object.entries(identity.variants).sort((a,b)=>a[1]-b[1])){
  const pack=packs[variant];
  if(!pack?.manifest||!(pack.binary instanceof Uint8Array))throw Error('Missing atrium render-pack variant '+variant);
  const uses=new Map();
  for(const geometry of pack.manifest.entries){
   if(geometry.full){
    for(const attribute of Object.values(geometry.full.attributes))uses.set(attribute.array,{encoding:'vertex',itemSize:attribute.itemSize});
    if(geometry.full.index!==undefined)uses.set(geometry.full.index,{encoding:'index'});
   }
   for(const level of geometry.levels)if(level.index!==undefined)uses.set(level.index,{encoding:'index'});
  }
  const arrays=pack.manifest.arrays.map((array,i)=>{
   const use=uses.get(i),Type=globalThis[array.type];
   if(!use||!Type?.BYTES_PER_ELEMENT)throw Error('Missing pack array encoding metadata');
   const raw=Buffer.from(pack.binary.buffer,pack.binary.byteOffset+array.offset,array.bytes);
   const rawStride=Type.BYTES_PER_ELEMENT*(use.encoding==='index'?1:use.itemSize),stride=use.encoding==='index'?rawStride:Math.ceil(rawStride/4)*4,count=array.bytes/rawStride;
   if(!Number.isSafeInteger(count)||count<=0||stride<=0||stride>256||(use.encoding==='index'&&![2,4].includes(stride)))throw Error('Invalid pack array codec stride');
   const key=geometryPackSha(raw)+':'+JSON.stringify({encoding:use.encoding,count,stride,rawStride});
   let record=pooled.get(key);
   if(!record){
    let input=raw;
    if(stride!==rawStride){input=Buffer.alloc(count*stride);for(let row=0;row<count;row++)raw.copy(input,row*stride,row*rawStride,(row+1)*rawStride);}
    const bytes=use.encoding==='index'?MeshoptEncoder.encodeIndexSequence(input,count,stride):MeshoptEncoder.encodeVertexBuffer(input,count,stride);
    record={start:poolBytes,bytes:bytes.length,encoding:use.encoding,count,stride,rawStride};
    pooled.set(key,record);pool.push(bytes);poolBytes+=bytes.length;
   }
   return record;
  });
  transports[variant]={format:'leo-atrium-meshopt-v1',poolBytes:0,arrays};
 }
 const shared=Buffer.concat(pool),chunks=[];
 for(let start=0;start<shared.length;start+=PART_BYTES)chunks.push({...compress(shared.subarray(start,start+PART_BYTES)),poolOffset:start});
 for(const [variant,memoryBudgetBytes] of Object.entries(identity.variants)){
  const pack=packs[variant],transport=transports[variant];transport.poolBytes=poolBytes;
  const manifest=compress(Buffer.from(JSON.stringify({...pack.manifest,transport}))),needed=new Set();
  for(const array of transport.arrays)for(let i=Math.floor(array.start/PART_BYTES);i<=Math.floor((array.start+array.bytes-1)/PART_BYTES);i++)needed.add(i);
  entry.variants[variant]={memoryBudgetBytes,manifest,binary:{encoding:'meshopt-lossless-v1',bytes:pack.binary.byteLength,sha256:geometryPackSha(pack.binary),parts:[...needed].sort((a,b)=>a-b).map(i=>chunks[i])}};
  entry.bytes+=manifest.decodedBytes+pack.binary.byteLength;
 }
 entry.sha256=geometryPackSha(JSON.stringify(entry.variants));
 return {entry,files};
}

// Cache hits are byte-verified, including gzip decoding and the assembled payload.
// A partial/corrupt cache is rebuilt; it never becomes permission to reuse bad geometry.
export async function readAtriumPackCache(cacheDirectory,identity){
 try{
  const saved=JSON.parse(await fs.readFile(path.join(cacheDirectory,'index.json'),'utf8'));
  if(saved.format!==CACHE_FORMAT||JSON.stringify(saved.identity)!==JSON.stringify(identity))return null;
  const entry=saved.entry,files=new Map();
  if(entry.format!==ATRIUM_PACK_TRANSPORT||entry.sourceArtifact!==identity.sourceArtifact||entry.dependencyHash!==identity.dependencyHash||
   entry.sha256!==geometryPackSha(JSON.stringify(entry.variants))||JSON.stringify(Object.keys(entry.variants))!==JSON.stringify(Object.keys(identity.variants))||
   !Array.isArray(entry.parts)||new Set(entry.parts).size!==entry.parts.length)return null;
  for(const name of entry.parts){
   if(!partName.test(name))return null;
   const bytes=await fs.readFile(path.join(cacheDirectory,name));
   if(bytes.length>MAX_PART_BYTES||name!=='atrium-geometry-'+geometryPackSha(bytes)+'.bin')return null;
   files.set(name,bytes);
  }
  let decodedTotal=0;
  const referenced=new Set();
  const decode=spec=>{
   if(!Number.isSafeInteger(spec.part)||spec.part<0||spec.part>=entry.parts.length)throw Error('Invalid pack part');
   if(!Number.isSafeInteger(spec.decodedBytes)||spec.decodedBytes<0||spec.decodedBytes>MAX_PART_BYTES)throw Error('Invalid decoded pack length');
   const name=entry.parts[spec.part],bytes=files.get(name);referenced.add(name);
   if(bytes.length!==spec.bytes||geometryPackSha(bytes)!==spec.sha256)throw Error('Invalid compressed pack bytes');
   const raw=gunzipSync(bytes,{maxOutputLength:Math.max(1,spec.decodedBytes)});
   if(raw.length!==spec.decodedBytes||geometryPackSha(raw)!==spec.decodedSha256)throw Error('Invalid decoded pack bytes');
   return raw;
  };
  for(const [variant,spec] of Object.entries(entry.variants)){
   if(spec.memoryBudgetBytes!==identity.variants[variant])return null;
   const json=decode(spec.manifest),manifest=JSON.parse(json.toString('utf8'));
   const binary=await decodeAtriumGeometryTransport(manifest,spec.binary.parts.map(part=>({offset:part.poolOffset,bytes:decode(part)})),{maxBinaryBytes:spec.memoryBudgetBytes});
   if(binary.length!==spec.binary.bytes||geometryPackSha(binary)!==spec.binary.sha256)return null;
   decodedTotal+=json.length+binary.length;
  }
  if(referenced.size!==files.size||entry.bytes!==decodedTotal||entry.compressedBytes!==[...files.values()].reduce((n,b)=>n+b.length,0))return null;
  return {entry,files};
 }catch(error){if(error.code==='EACCES'||error.code==='EPERM')throw error;return null;}
}

export async function writeAtriumPackCache(cacheDirectory,identity,encoded){
 await fs.mkdir(cacheDirectory,{recursive:true});
 for(const [name,bytes] of encoded.files){if(!partName.test(name))throw Error('Invalid atrium pack cache path');await atomicWrite(path.join(cacheDirectory,name),bytes);}
 await atomicWrite(path.join(cacheDirectory,'index.json'),JSON.stringify({format:CACHE_FORMAT,identity,entry:encoded.entry}));
}

async function verifiedPreparedSource(source,preparedManifest){
 const integrity=await requirePreparedFresh(source);
 if(preparedManifest&&preparedManifest.sha256!==integrity.sha256)throw Error('Public prepared artifact changed before render-pack generation');
 const hash=createHash('sha256');
 for(const name of [...integrity.files].sort()){
  if(!/^(geometry-\d+\.bin|world\.json\.gz|world\.bin)$/.test(name))throw Error('Invalid prepared input path');
  hash.update(name);hash.update(await fs.readFile(path.join(source,name)));
 }
 if(hash.digest('hex')!==integrity.sha256)throw Error('Prepared artifact integrity failed before render-pack generation');
 return integrity;
}

async function generatePacks(source,integrity){
 // The canonical reader preserves hierarchy, direct child order, material identity,
 // bounds, transforms and pooled attributes. A flattened audit scene cannot bind safely.
 const {readPreparedWorld}=await import('../src/v2/prepared-codec.js');
 const {buildAtriumGeometryPack,hydrateAtriumGeometryPack}=await import('../src/v2/atrium-geometry-pack.js');
 const base=pathToFileURL(path.resolve(source)+path.sep);
 const loaded=await readPreparedWorld(base,{skipImages:true,
  metadataName:integrity.files.includes('world.bin')?'world.bin':'world.json.gz',
  fetchBytes:name=>fs.readFile(path.join(source,name))});
 const packs={};
 for(const [variant,memoryBudgetBytes] of Object.entries(ATRIUM_PACK_VARIANTS)){
  packs[variant]=await buildAtriumGeometryPack(loaded.ship.v2PreparedBake,{sourceArtifact:integrity.sha256,variant,memoryBudgetBytes,maxSimplifyMs:Infinity});
  // Bind the exported bytes back to the exact source graph before publishing.
  const check=hydrateAtriumGeometryPack(loaded.ship.v2PreparedBake,packs[variant],{expectedSourceArtifact:integrity.sha256,memoryBudgetBytes});
  check.setEnabled(false);check.setEnabled(true);check.dispose();
  console.log(`Atrium geometry ${variant}: ${(packs[variant].binary.byteLength/MiB).toFixed(1)} MiB decoded; canonical hydration ${check.stats.hydrationMs.toFixed(1)} ms`);
 }
 return packs;
}

export async function publishAtriumGeometryPack({out='dist-v2',source='output/leo-interior-v02/prepared-walk',
 preparedManifest=null,cacheRoot='output/leo-interior-v02/atrium-geometry-cache',maxCompressedBytes=32*MiB}={}){
 const start=performance.now(),integrity=await verifiedPreparedSource(source,preparedManifest),dependencies=await atriumPackDependencyIdentity();
 const identity=atriumPackCacheIdentity(integrity.sha256,dependencies.hash),cacheDirectory=path.join(cacheRoot,identity.key);
 let encoded=await readAtriumPackCache(cacheDirectory,identity);const hit=!!encoded;
 if(!encoded){
  encoded=await encodeAtriumPackVariants(await generatePacks(source,integrity),identity);
  if((await atriumPackDependencyIdentity()).hash!==dependencies.hash)throw Error('Atrium pack builder dependencies changed during generation; retry after edits finish');
  await writeAtriumPackCache(cacheDirectory,identity,encoded);
 }
 if(encoded.entry.compressedBytes>maxCompressedBytes)throw Error(`Atrium render packs exceed public byte allowance: ${encoded.entry.compressedBytes} > ${maxCompressedBytes}`);
 const destination=path.resolve(out),workspace=path.resolve(process.cwd());
 if(!destination.startsWith(workspace+path.sep))throw Error('Atrium geometry public output is outside the workspace');
 await fs.mkdir(destination,{recursive:true});
 for(const [name,bytes] of encoded.files)await atomicWrite(path.join(destination,name),bytes);
 // Only this producer's content-addressed files are eligible for cleanup.
 for(const name of await fs.readdir(destination))if(partName.test(name)&&!encoded.files.has(name))await fs.unlink(path.join(destination,name));
 console.log(`Atrium geometry packs: ${hit?'cache hit':'built'}, ${(encoded.entry.compressedBytes/MiB).toFixed(2)} MiB compressed, ${((performance.now()-start)/1000).toFixed(1)} s`);
 return encoded.entry;
}

if(process.argv[1]&&path.resolve(process.argv[1])===script){
 const out=process.argv[2]||'dist-v2';
 const entry=await publishAtriumGeometryPack({out});
 await atomicWrite(path.join(out,'atrium-geometry-manifest.json'),JSON.stringify(entry,null,2));
}
