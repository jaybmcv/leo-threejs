// Proof that a sectioned public prepared walk (prepared-sections-v2.mjs) is the artifact it was made from:
//   node scripts/check-prepared-sections-v2.mjs [--source=DIR] [--published=DIR] [--decoded-only]
// 1. canonicalPrepared (check-fast-dressing-v2.mjs) of both, equal: geometries drawn through their indices, arrays and
//    templates by content, graphs, rests and collision.
// 2. Both decoded by the public walk's own reader (verifyArrays: every decoded array against its checksum), then compared
//    as the walk holds them: every band mesh's attribute and index arrays byte for byte and the same vertex counts (what
//    the atrium geometry pack's guards and LOD indices bind to), shared pool arrays shared alike, every template, the
//    source graph, and the static, ground, group and mover collision (BVH roots, triangle order, window flags) and the
//    colliders' PVS digest.
// 3. verifyPublicSections: the published files are exactly what this artifact sections into.
import './v2-output.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {canonicalPrepared,difference} from './check-fast-dressing-v2.mjs';
import {verifyPublicSections} from './prepared-sections-v2.mjs';

const arg=n=>process.argv.find(a=>a.startsWith('--'+n+'='))?.slice(n.length+3);
const source=arg('source')||'output/leo-interior-v02/prepared-walk',integrity=JSON.parse(await fs.readFile(source+'/integrity.json','utf8'));
const published=arg('published')||'dist-v2/prepared-walk/'+integrity.sha256.slice(0,20);
const sha=b=>createHash('sha256').update(b).digest('hex'),bytesOf=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),report={source,published,status:'FAIL'};
let t=performance.now();
report.files=await verifyPublicSections(published,source,integrity);report.filesSeconds=(performance.now()-t)/1000;console.log('PASS: published section files are this artifact\'s',report.files);

// --decoded-only skips the canonical pass (about 25 minutes on the whole ship) when it has already passed for this pair.
if(!process.argv.includes('--decoded-only')){t=performance.now();const a=await canonicalPrepared(source),b=await canonicalPrepared(published),d=difference(a,b);assert(!d,'Sectioned walk differs by content: '+d);
 report.canonicalSeconds=(performance.now()-t)/1000;console.log('PASS: canonical content equal');}

const {readPreparedWorld}=await import('../src/v2/prepared-codec.public.js'),{colliderDigest}=await import('../src/v2/atrium-pvs-key.js');
const load=async(dir,metadataName)=>{const t=performance.now(),w=await readPreparedWorld(pathToFileURL(path.resolve(dir)+path.sep),{skipImages:true,verifyArrays:true,metadataName,fetchBytes:n=>fs.readFile(path.join(dir,n))});return {w,seconds:(performance.now()-t)/1000};};
// Rests hold scene nodes: by their uuid (three's own toJSON would mint fresh geometry uuids on every load).
const plain=v=>v?.isObject3D?'node:'+v.uuid:v?.toArray?v.toArray():Array.isArray(v)?v.map(plain):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,plain(x)])):v;
// The walk as it holds it: each array by content and by which other uses share its buffer.
const walk=({ship,geometryTemplates})=>{
 const ids=new Map(),array=x=>{if(!x)return null;if(!ids.has(x.buffer))ids.set(x.buffer,'buffer-'+ids.size);return [x.constructor.name,x.length,sha(bytesOf(x)),ids.get(x.buffer)];};
 const geometry=g=>({name:g.name,attributes:Object.entries(g.attributes).sort().map(([k,x])=>[k,x.itemSize,x.count,x.normalized,array(x.array)]),index:g.index?[g.index.count,array(g.index.array)]:null,groups:g.groups,bounds:g.boundingBox?.toArray?.()??[g.boundingBox?.min.toArray(),g.boundingBox?.max.toArray()],sphere:g.boundingSphere?[g.boundingSphere.center.toArray(),g.boundingSphere.radius]:null});
 const tree=root=>{const rows=[];root.traverse(o=>rows.push([o.uuid,o.name,o.type,o.parent?.uuid??null,o.matrix.elements,o.visible,o.renderOrder,o.isMesh?[geometry(o.geometry),[].concat(o.material).map(m=>m.uuid),o.count??null,array(o.instanceMatrix?.array),array(o.instanceColor?.array)]:null]));return rows;};
 const bvh=b=>[geometry(b.geometry),b._roots?.map(r=>sha(new Uint8Array(r))),array(b._indirectBuffer),array(b.leoWindowFlags)];
 const colliders=c=>c&&{bands:[...c.bands].map(([k,x])=>[k,bvh(x.bvh)]),groups:c.groups.map(g=>[g.name,bvh(g.bvh),g.items.map(i=>[i.owner,i.matrix.elements]),[...g.cells.keys()]]),movers:[...(c.v2PreparedMovers||new Map())].map(([k,l])=>[k,l.map(m=>[bvh(m.bvh),m.matrix.elements,m.enabled])]),ground:colliders(c.v2Ground)};
 const bake=ship.v2PreparedBake;
 return {source:tree(ship.root),bands:[...bake.bands].map(([k,g])=>[k,tree(g)]),haze:tree(ship.v2PreparedHaze),facade:tree(ship.v2PreparedFacade),lounge:tree(ship.v2PreparedLounge),signs:tree(ship.v2PreparedSigns),
  templates:[...geometryTemplates].sort(([x],[y])=>x<y?-1:1).map(([k,g])=>[k,geometry(g)]),colliders:colliders(ship.v2PreparedColliders),rest:plain(ship.v2PreparedRest),seats:ship.v2PreparedSeats};
};
const names=await fs.readdir(source),whole=await load(source,names.includes('world.bin')?'world.bin':'world.json.gz');
const x=walk(whole.w),digestA=colliderDigest(whole.w.ship.v2PreparedColliders);whole.w.release();
const sectioned=await load(published,'sections.json');
const y=walk(sectioned.w),digestB=colliderDigest(sectioned.w.ship.v2PreparedColliders);sectioned.w.release();
assert.equal(digestB,digestA,'Collider digest differs');const e=difference(x,y);assert(!e,'Decoded walk differs: '+e);
Object.assign(report,{status:'PASS',decodeSeconds:{whole:whole.seconds,sectioned:sectioned.seconds},colliderDigest:digestA.slice(0,32)});
console.log('PASS: the public reader decodes the same walk (arrays, shared buffers, bands, templates, collision, digest)');
await fs.mkdir('output/fast-deploy',{recursive:true});await fs.writeFile('output/fast-deploy/prepared-sections-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
