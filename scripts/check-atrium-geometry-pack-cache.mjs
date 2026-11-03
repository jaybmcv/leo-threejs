import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {atriumPackDependencyIdentity,atriumPackCacheIdentity,encodeAtriumPackVariants,
 readAtriumPackCache,writeAtriumPackCache,geometryPackSha} from './build-atrium-geometry-pack.mjs';
import {decodeAtriumGeometryTransport} from '../src/v2/atrium-geometry-transport.js';

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'leo-atrium-pack-test-'));
let checks=0;
try{
 const entry=path.join(temporary,'entry.mjs'),dependency=path.join(temporary,'dependency.mjs'),added=path.join(temporary,'added.mjs');
 await fs.writeFile(entry,"export {value} from './dependency.mjs';\n");await fs.writeFile(dependency,'export const value=1;\n');
 const first=await atriumPackDependencyIdentity({entryPoints:[entry]});
 const again=await atriumPackDependencyIdentity({entryPoints:[entry]});
 assert.equal(first.hash,again.hash);checks++;
 await fs.writeFile(dependency,'export const value=2;\n');
 const changed=await atriumPackDependencyIdentity({entryPoints:[entry]});assert.notEqual(first.hash,changed.hash);checks++;
 await fs.writeFile(added,'export const other=3;\n');await fs.writeFile(dependency,"export {other} from './added.mjs'; export const value=1;\n");
 const expanded=await atriumPackDependencyIdentity({entryPoints:[entry]});assert.notEqual(first.hash,expanded.hash);checks++;
 assert(Object.keys(expanded.files).some(file=>file.endsWith('added.mjs')));checks++;
 assert(first.files['package-lock.json']);checks++;
 const artifact=geometryPackSha('fixture prepared artifact'),variants={desktop:128*1024*1024,constrained:48*1024*1024};
 const identity=atriumPackCacheIdentity(artifact,first.hash,variants);
 assert.notEqual(identity.key,atriumPackCacheIdentity(geometryPackSha('changed artifact'),first.hash,variants).key);checks++;
 assert.notEqual(identity.key,atriumPackCacheIdentity(artifact,changed.hash,variants).key);checks++;
 assert.notEqual(identity.key,atriumPackCacheIdentity(artifact,first.hash,{...variants,desktop:96*1024*1024}).key);checks++;
 // Incompressible bytes force real multi-chunk transport; variants reuse an identical first chunk.
 const firstBytes=8*1024*1024,binary=randomBytes(firstBytes+36);
 const arrayA={type:'Float32Array',offset:0,length:firstBytes/4,bytes:firstBytes},arrayB={type:'Uint16Array',offset:firstBytes,length:18,bytes:36};
 const packs={desktop:{manifest:{fixture:true,variant:'desktop',binaryBytes:binary.length,arrays:[arrayA,arrayB],entries:[{full:{attributes:{position:{array:0,itemSize:1},normal:{array:1,itemSize:3}}},levels:[]}]},binary},
  constrained:{manifest:{fixture:true,variant:'constrained',binaryBytes:firstBytes,arrays:[arrayA],entries:[{full:{attributes:{position:{array:0,itemSize:1}}},levels:[]}]},binary:binary.subarray(0,firstBytes)}};
 const encoded=await encodeAtriumPackVariants(packs,identity),directory=path.join(temporary,'cache');
 assert.equal(encoded.entry.variants.desktop.binary.parts.length,2);checks++;
 assert.equal(encoded.entry.variants.desktop.binary.parts[0].part,encoded.entry.variants.constrained.binary.parts[0].part);checks++;
 assert([...encoded.files.values()].every(bytes=>bytes.length<=16*1024*1024));checks++;
 const descriptors=encoded.entry.variants.desktop.binary.parts;
 const decoded=descriptors.map(spec=>({offset:spec.poolOffset,bytes:gunzipSync(encoded.files.get(encoded.entry.parts[spec.part]))}));
 const manifestSpec=encoded.entry.variants.desktop.manifest,manifest=JSON.parse(gunzipSync(encoded.files.get(encoded.entry.parts[manifestSpec.part])));
 assert.deepEqual(Buffer.from(await decodeAtriumGeometryTransport(manifest,decoded)),binary);checks++;
 await assert.rejects(()=>decodeAtriumGeometryTransport(manifest,decoded.slice(1)),/missing pool/);checks++;
 await assert.rejects(()=>decodeAtriumGeometryTransport(manifest,[...decoded,decoded[0]]),/overlapping/);checks++;
 await assert.rejects(()=>decodeAtriumGeometryTransport(manifest,decoded,{maxBinaryBytes:4}),/buffer size/);checks++;
 assert.equal(await readAtriumPackCache(directory,identity),null);checks++;
 await writeAtriumPackCache(directory,identity,encoded);
 const hit=await readAtriumPackCache(directory,identity);assert(hit);assert.deepEqual(hit.entry,encoded.entry);checks++;
 assert.equal(await readAtriumPackCache(directory,atriumPackCacheIdentity(artifact,changed.hash,variants)),null);checks++;
 const file=path.join(directory,encoded.entry.parts[0]),original=await fs.readFile(file);
 await fs.writeFile(file,original.subarray(1));assert.equal(await readAtriumPackCache(directory,identity),null);checks++;
 await fs.writeFile(file,original);await fs.unlink(path.join(directory,encoded.entry.parts.at(-1)));
 assert.equal(await readAtriumPackCache(directory,identity),null);checks++;
 await writeAtriumPackCache(directory,identity,encoded);
 const indexFile=path.join(directory,'index.json'),saved=JSON.parse(await fs.readFile(indexFile,'utf8'));
 saved.entry.variants.desktop.binary.sha256='0'.repeat(64);saved.entry.sha256=geometryPackSha(JSON.stringify(saved.entry.variants));
 await fs.writeFile(indexFile,JSON.stringify(saved));assert.equal(await readAtriumPackCache(directory,identity),null);checks++;
 console.log(JSON.stringify({status:'PASS',checks,preparedArtifactModified:false,tests:'dependency closure, new import, package pin, artifact/budget cache keys, chunk bounds, deduplication, round trip, corruption and partial-cache rejection'}));
}finally{
 const resolved=path.resolve(temporary),parent=path.resolve(os.tmpdir());
 if(!resolved.startsWith(parent+path.sep)||!path.basename(resolved).startsWith('leo-atrium-pack-test-'))throw Error('Unsafe fixture cleanup');
 await fs.rm(resolved,{recursive:true,force:true});
}
