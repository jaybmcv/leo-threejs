import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Colliders} from '../src/walk/collision.js';
import {PreparedWriter} from '../src/v2/prepared-codec.js';
import {bakeForWalking} from '../src/walk/render-bake.js';
import {packPreparedCollision} from './prepared-collision-pack.mjs';
import {PreparedPatch,preparedManifest,preparedArrayReader} from './prepared-patch-v2.mjs';
import {removeOwnedSpans} from './patch-owned-spans-v2.mjs';

const dir='output/fast-deploy/round2-span-fixture',root=new T.Group();
for(const [id,x]of [['a',0],['b',4],['shared',8]]){const group=new T.Group();group.name=id==='shared'?'shared':'Area_'+id;const mesh=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial());mesh.name='Area_identity_panel';mesh.position.set(x,0,0);group.add(mesh);root.add(group);}
const col=new Colliders();col.addStatic(root);col.commit();const baked=bakeForWalking(root),writer=new PreparedWriter(),bands=[...baked.bands].map(([key,g])=>[key,writer.graph(g)]),colliders=writer.colliders(col);
let bytes=0;const buffers=[],m={version:1,parts:[],arrays:writer.arrays.map(a=>{const row={type:a.constructor.name,start:bytes,bytes:a.byteLength};buffers.push(Buffer.from(a.buffer,a.byteOffset,a.byteLength));bytes+=a.byteLength;return row;}),geometries:writer.geometries,materials:writer.materials,textures:[],images:[],bands,colliders};
const raw=Buffer.concat(buffers),extra=new Map();const getRaw=r=>extra.get(r)||raw.subarray(r.start,r.start+r.bytes),addRaw=(data,type)=>{const row={type,bytes:data.byteLength},id=m.arrays.length;m.arrays.push(row);extra.set(row,Buffer.from(data));return id;};
packPreparedCollision(m,{getRaw,addRaw});
// Turn the packed fixture into independent writer arrays, preserving the
// packer's triangle permutation and its remapped owner spans.
const seed=dir+'/seed';await fs.mkdir(seed,{recursive:true});await fs.writeFile(seed+'/complete.json','{}');
const all=m.arrays.map(r=>new globalThis[r.type](Uint8Array.from(getRaw(r)).buffer));m.arrays=[];const patch=new PreparedPatch(m);for(const a of all)patch.array(a);await patch.save(dir+'/base',seed,{},{});
const before=await preparedManifest(dir+'/base'),read=preparedArrayReader(before,dir+'/base'),next=new PreparedPatch(before);
const result=await removeOwnedSpans(before,next,read,new Set(['a|source']));assert.equal(result.renderTriangles,12);assert(result.collisionTriangles>=12);
await next.save(dir+'/patch',dir+'/base',{},{});const after=await preparedManifest(dir+'/patch');
for(const [,band]of after.colliders.bands){assert(!band.ownerSpans.some(r=>r.owner==='a|source'));assert(band.ownerSpans.some(r=>r.owner==='b|source'));assert(band.ownerSpans.some(r=>r.owner===null));}
const remaining=after.bands.flatMap(([,g])=>g.nodes).filter(n=>n.geometry!==undefined).flatMap(n=>after.geometries[n.geometry].userData.preparedRanges);assert(!remaining.some(r=>r.patchOwner==='a|source'));assert(remaining.some(r=>r.patchOwner==='b|source'));
console.log('PASS packed collision owner permutation, mixed render removal, neighbour and shared geometry preservation');
