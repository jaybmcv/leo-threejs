// node --max-old-space-size=12000 scripts/build-arrival-pack.mjs <prepared-walk dir> <out dir> [--source-id <sha256>]
// The arrival pack (src/v2/arrival-preview.js): the Deck 2 arrival hall and the garden open above it, cut out of the
// verified prepared walk, small enough to walk a few seconds after the page opens while the whole ship downloads.
// - render: every mesh the prepared walk draws (its render bands, wayfinding signs and hull, and the source graph's
//   instanced and live meshes) keeps, whole, each triangle touching the hall's box widened by VIEW_MARGIN, in world
//   space, one mesh per material and attribute layout; instance colours become vertex colours. Positions to 0.24 mm,
//   normals 8-bit octahedral, colours 16-bit. The paintings the walk hangs there as it starts (paintings.js) come
//   too, each canvas naming its picture, which the page loads from the walk's own copy;
// - the materials' pictures (a handful), as lossless WebP;
// - collision and ground, kept apart as the walk keeps them (ground.js: barriers are not ground), exact, the triangles
//   touching the box widened by a metre. The page closes the box's sides itself, so nobody walks off the cut.
// Nothing is re-pooled or re-indexed into the prepared walk: this is a file of its own the full walk never reads.
// One file, pack.bin: gzip of [u32 header bytes][header JSON][arrays, each 4-byte aligned, meshopt-encoded].
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import * as T from 'three';
import {MeshoptDecoder} from 'meshoptimizer';
import {MeshoptEncoder} from 'meshoptimizer/encoder';
import {MeshBVH} from 'three-mesh-bvh';
import sharp from 'sharp';
import {createPaintings,PAINTINGS} from '../src/walk/paintings.js';
import layout from '../src/plan/selected-layout.js';

const args=process.argv.slice(2),flag=n=>{const i=args.indexOf(n);if(i<0)return null;const v=args[i+1];args.splice(i,2);return v;};
// --source-id: the prepared walk's identity (its asset-manifest sha256), which the page checks the pack was cut from.
const sourceId=flag('--source-id'),[source,out]=args;
if(!source||!out)throw Error('usage: build-arrival-pack.mjs <prepared-walk dir> <out dir> [--source-id <prepared sha256>]');
const PART=8388608,started=Date.now();
// The arrival hall and the hydroponic garden open above it (rooms.js 'arrival-assembly'), from the selected layout.
const ROOMS=['d02-arrival-1','d03-farm-1'];
const BOX=new T.Box3();
for(const id of ROOMS){const r=layout.rooms.find(r=>r.id===id);if(!r?.polygon)throw Error('Arrival pack: the layout has no room '+id);
 for(const [x,z] of r.polygon)BOX.expandByPoint(new T.Vector3(x,r.y,z)).expandByPoint(new T.Vector3(x,r.y+r.height,z));}
BOX.expandByVector(new T.Vector3(.6,.7,.6));
// Drawn this far past the box's sides: a doorway shows several metres of what lies beyond before the page's haze walls.
const VIEW_MARGIN=6,VIEW_BOX=BOX.clone().expandByVector(new T.Vector3(VIEW_MARGIN,0,VIEW_MARGIN)),COLLISION_BOX=BOX.clone().expandByScalar(1);

const read=name=>fs.readFileSync(path.join(source,name));
const inflate=b=>b[0]===0x28&&b[1]===0xb5?zlib.zstdDecompressSync(b):zlib.gunzipSync(b);
const metadata=()=>{if(fs.existsSync(path.join(source,'world.bin')))return read('world.bin');const spec=JSON.parse(read('world.parts.json'));return Buffer.concat(spec.parts.map(p=>read(p.name)));};
const m=JSON.parse(inflate(metadata()));
const parts=m.parts.map(p=>inflate(read(p.name)));
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);

// Decoding, as readPreparedWorld does it, one array at a time (scripts/build-phone-walk.mjs).
const types={Float32Array,Float64Array,Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array};
const starts=[];{let n=0;for(const p of parts){starts.push(n);n+=p.length;}}
const slice=r=>{if(!r.bytes)return new Uint8Array();let i,offset;if(r.part!==undefined){i=r.part;offset=r.offset;}else{i=Math.floor(r.start/PART);offset=r.start-starts[i];}
 if(offset+r.bytes<=parts[i].length)return parts[i].subarray(offset,offset+r.bytes);const b=new Uint8Array(r.bytes);let done=0;while(done<r.bytes){const n=Math.min(parts[i].length-offset,r.bytes-done);b.set(parts[i].subarray(offset,offset+n),done);done+=n;i++;offset=0;}return b;};
const decoded=new Map();
const decode=id=>{let a=decoded.get(id);if(a)return a;const r=m.arrays[id];let bytes=slice(r);
 if(r.encoding){const d=new Uint8Array(r.count*r.stride);if(r.count){if(r.encoding==='meshopt-sequence'||r.encoding==='meshopt-tuple')MeshoptDecoder.decodeIndexSequence(d,r.count,r.stride,bytes);else MeshoptDecoder.decodeVertexBuffer(d,r.count,r.stride,bytes);}
  if(r.encoding==='meshopt-tuple'){const dict=decode(r.dictionary),words=new Uint32Array(dict.buffer,dict.byteOffset,dict.byteLength/4),codes=new Uint32Array(d.buffer),o=new Uint32Array(r.decodedBytes/4);for(let i=0;i<codes.length;i++){const k=codes[i]*3;o[i*3]=words[k];o[i*3+1]=words[k+1];o[i*3+2]=words[k+2];}a=new Float32Array(o.buffer);decoded.set(id,a);return a;}
  if(r.rawStride===r.stride)bytes=d;else{bytes=new Uint8Array(r.decodedBytes);for(let i=0;i<r.count;i++)for(let k=0;k<r.rawStride;k++)bytes[i*r.rawStride+k]=d[i*r.stride+k];}}
 bytes=new Uint8Array(bytes);a=new types[r.type](bytes.buffer,0,bytes.byteLength/types[r.type].BYTES_PER_ELEMENT);decoded.set(id,a);return a;};
// One attribute's item as floats, normalised integers turned to [-1,1] or [0,1] as three reads them.
const scale={Int8Array:127,Uint8Array:255,Int16Array:32767,Uint16Array:65535};
const item=(a,i,out)=>{const arr=decode(a.array),s=a.itemSize,n=a.normalized?scale[arr.constructor.name]:0;for(let k=0;k<s;k++){const v=arr[i*s+k];out[k]=n?Math.max(v/n,-1):v;}return out;};

// The render cut: per material, draw order and attribute layout, the kept triangles welded per source mesh.
const chunks=new Map();let seen=0,kept=0;
const p=[new T.Vector3(),new T.Vector3(),new T.Vector3()],normalMatrix=new T.Matrix3(),tmp=[0,0,0,0],nv=new T.Vector3(),triangle=new T.Triangle();
const ATTRIBUTES=['position','normal','uv','color'];
function cut(node,world,origin,tint=null){
 const g=m.geometries[node.geometry];if(!g.attributes.position)return;
 if(g.bounds&&!new T.Box3(new T.Vector3(...g.bounds[0]),new T.Vector3(...g.bounds[1])).applyMatrix4(world).intersectsBox(VIEW_BOX))return;
 const index=g.index!==null?decode(g.index):null,count=index?index.length:decode(g.attributes.position.array).length/3;
 const groups=g.groups?.length?g.groups:[{start:0,count,materialIndex:0}];normalMatrix.getNormalMatrix(world);
 const has=ATTRIBUTES.filter(k=>g.attributes[k]);if(tint&&!has.includes('color'))has.push('color');
 const sizes=has.map(k=>k==='position'||k==='normal'?3:k==='color'?(g.attributes.color?.itemSize??3):g.attributes[k].itemSize);
 for(const group of groups){const material=Array.isArray(node.material)?node.material[group.materialIndex]:node.material;if(material===undefined)continue;
  const key=material+'|'+(node.renderOrder||0)+'|'+(tint?'tinted|':'')+has.map((k,i)=>k+sizes[i]).join(',');let c=chunks.get(key);
  if(!c)chunks.set(key,c={material,tinted:!!tint,renderOrder:node.renderOrder||0,attributes:Object.fromEntries(has.map((k,i)=>[k,{itemSize:sizes[i],values:[]}])),index:[],vertices:0,from:new Set()});
  const welded=new Map();
  for(let t=group.start;t<Math.min(count,group.start+group.count);t+=3){seen++;const v=[0,1,2].map(k=>index?index[t+k]:t+k);
   for(let k=0;k<3;k++){item(g.attributes.position,v[k],tmp);p[k].set(tmp[0],tmp[1],tmp[2]).applyMatrix4(world);}
   triangle.set(p[0],p[1],p[2]);if(!VIEW_BOX.intersectsTriangle(triangle))continue;kept++;c.from.add(origin);
   for(let k=0;k<3;k++){let at=welded.get(v[k]);
    if(at===undefined){welded.set(v[k],at=c.vertices++);c.attributes.position.values.push(p[k].x,p[k].y,p[k].z);
     if(g.attributes.normal){item(g.attributes.normal,v[k],tmp);nv.set(tmp[0],tmp[1],tmp[2]).applyMatrix3(normalMatrix).normalize();c.attributes.normal.values.push(nv.x,nv.y,nv.z);}
     if(g.attributes.uv){item(g.attributes.uv,v[k],tmp);for(let j=0;j<g.attributes.uv.itemSize;j++)c.attributes.uv.values.push(tmp[j]);}
     if(has.includes('color')){const s=c.attributes.color.itemSize;if(g.attributes.color)item(g.attributes.color,v[k],tmp);else tmp.fill(1);for(let j=0;j<s;j++)c.attributes.color.values.push(tmp[j]*(tint&&j<3?tint[j]:1));}}
    c.index.push(at);}}
 }
}
// Drawn: shown all the way up and on the default layer (the camera's).
const shown=nodes=>{const byId=new Map(nodes.map(n=>[n.uuid,n]));return n=>{if(((n.layers??1)&1)===0)return false;for(let q=n;q;q=q.parent?byId.get(q.parent):null)if(q.visible===false)return false;return true;};};
const cutGraph=(graph,label)=>{const visible=shown(graph.nodes);for(const n of graph.nodes)if(n.geometry!==undefined&&n.instanceMatrix===undefined&&visible(n))cut(n,new T.Matrix4().fromArray(n.matrixWorld),label+':'+n.name);};
for(const [,graph] of m.bands)cutGraph(graph,'band');
// Wayfinding signs (the walk moves them under the lifts' sign group as they are).
if(m.signs)cutGraph(m.signs,'sign');
// The hull's outside (facade.js), drawn in the walk's scene: what the hall's windows look out on.
if(m.facade)cutGraph(m.facade,'facade');
// The source graph draws its instanced meshes and the meshes under a keepLive group; the rest is baked into the bands.
{const nodes=m.source.nodes,byId=new Map(nodes.map(n=>[n.uuid,n])),visible=shown(nodes),live=n=>{for(let q=n;q;q=q.parent?byId.get(q.parent):null)if(q.userData?.keepLive)return true;return false;};
 for(const n of nodes){if(n.geometry===undefined||!visible(n))continue;const world=new T.Matrix4().fromArray(n.matrixWorld);
  if(n.instanceMatrix!==undefined){const matrices=decode(n.instanceMatrix),colours=n.instanceColor!==null&&n.instanceColor!==undefined?decode(n.instanceColor):null;
   for(let i=0;i<(n.count??matrices.length/16);i++)cut(n,world.clone().multiply(new T.Matrix4().fromArray(matrices,i*16)),'instanced:'+n.name,colours?[colours[i*3],colours[i*3+1],colours[i*3+2]]:null);}
  else if(live(n))cut(n,world,'live:'+n.name);}}
// What the other graphs hold in the box, for the report: the pack leaves them out.
const audit={};for(const k of ['haze','lounge','frost']){if(!m[k])continue;let n=0;for(const r of m[k].nodes){if(r.geometry===undefined)continue;const g=m.geometries[r.geometry];if(g.bounds&&new T.Box3(new T.Vector3(...g.bounds[0]),new T.Vector3(...g.bounds[1])).applyMatrix4(new T.Matrix4().fromArray(r.matrixWorld)).intersectsBox(BOX))n++;}audit[k]=n;}

// The collision cut, collision and ground each as one soup (the walk's ground excludes barriers: ground.js).
const tri=[new T.Vector3(),new T.Vector3(),new T.Vector3()],triBox=new T.Box3();
const cutCollision=(geometry,world,into)=>{const g=m.geometries[geometry],pos=decode(g.attributes.position.array),index=g.index!==null?decode(g.index):null,count=index?index.length:pos.length/3;
 if(g.bounds&&!new T.Box3(new T.Vector3(...g.bounds[0]),new T.Vector3(...g.bounds[1])).applyMatrix4(world||new T.Matrix4()).intersectsBox(COLLISION_BOX))return;
 for(let t=0;t<count;t+=3){for(let k=0;k<3;k++){const v=index?index[t+k]:t+k;tri[k].set(pos[v*3],pos[v*3+1],pos[v*3+2]);if(world)tri[k].applyMatrix4(world);}
  if(!triBox.setFromPoints(tri).intersectsBox(COLLISION_BOX))continue;for(const v of tri)into.push(v.x,v.y,v.z);}};
const cutColliders=(c,into)=>{for(const [,b] of c.bands)cutCollision(b.geometry,null,into);for(const g of c.groups)for(const it of g.items){const at=it.matrix?.$matrix4;if(at)cutCollision(g.bvh.geometry,new T.Matrix4().fromArray(at),into);}};
const collision=[],ground=[];cutColliders(m.colliders,collision);if(m.colliders.ground)cutColliders(m.colliders.ground,ground);
const collisionKept=collision.length/9,groundKept=ground.length/9;
if(!kept||!collisionKept||!groundKept)throw Error(`Arrival pack: nothing cut (render ${kept}, collision ${collisionKept}, ground ${groundKept}): has the arrival hall moved?`);

// The paintings the walk hangs here as it starts (paintings.js, made the same way): frames and canvases, world space, as
// meshes of their own; each canvas names its picture, which the page loads from the walk's own copy (__ART_URLS__).
const extraMaterials=new Map(),paintings=[];
for(const g of createPaintings({}).groups){g.updateMatrixWorld(true);if(!new T.Box3().setFromObject(g).intersectsBox(VIEW_BOX))continue;
 const file=PAINTINGS.find(p=>'Painting_'+p.name===g.name)?.file;if(!file)throw Error('Arrival pack: no picture for '+g.name);paintings.push(g.name);
 g.traverse(o=>{if(!o.isMesh)return;const canvas=o.material.name==='Painting_canvas',key='extra:'+o.material.name+(canvas?':'+file:''),geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry;
  extraMaterials.set(key,{json:o.material.toJSON(),art:canvas?file:null});normalMatrix.getNormalMatrix(o.matrixWorld);
  let c=chunks.get(key);if(!c)chunks.set(key,c={material:key,tinted:false,renderOrder:o.renderOrder,attributes:{position:{itemSize:3,values:[]},normal:{itemSize:3,values:[]},uv:{itemSize:2,values:[]}},index:[],vertices:0,from:new Set()});
  const pos=geometry.attributes.position,nor=geometry.attributes.normal,uv=geometry.attributes.uv;c.from.add('painting:'+g.name);
  for(let i=0;i<pos.count;i++){const v=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld),n=new T.Vector3().fromBufferAttribute(nor,i).applyMatrix3(normalMatrix).normalize();
   c.attributes.position.values.push(v.x,v.y,v.z);c.attributes.normal.values.push(n.x,n.y,n.z);c.attributes.uv.values.push(uv.getX(i),uv.getY(i));c.index.push(c.vertices++);}});}

// Solid but not drawn: collision with no drawn surface within 30 cm (something the walk builds as it starts, or draws
// from a graph left out). The report lists where, in 2 m cells, for the list of what the early walk lacks.
const unseen=(()=>{const positions=[],index=[];let offset=0;for(const c of chunks.values()){for(const v of c.attributes.position.values)positions.push(v);for(const i of c.index)index.push(i+offset);offset+=c.vertices;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(index);const bvh=new MeshBVH(g),hit={},at=new T.Vector3(),cells=new Map();let count=0;
 for(let i=0;i<collision.length;i+=9){at.set((collision[i]+collision[i+3]+collision[i+6])/3,(collision[i+1]+collision[i+4]+collision[i+7])/3,(collision[i+2]+collision[i+5]+collision[i+8])/3);
  if(!BOX.containsPoint(at)||bvh.closestPointToPoint(at,hit,0,.3))continue;count++;const key=[at.x,at.y,at.z].map(v=>Math.floor(v/2)*2).join(',');cells.set(key,(cells.get(key)||0)+1);}
 return {triangles:count,cells:[...cells].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,n])=>k+' ('+n+')')};})();

// Arrays: meshopt-encoded (vertex streams padded to 4 bytes, indices as sequences).
const blobs=[];let offset=0;
const put=(typed,kind)=>{const raw=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength);let record;
 if(kind==='index'){const encoded=MeshoptEncoder.encodeIndexSequence(raw,typed.length,typed.BYTES_PER_ELEMENT);record={encoding:'meshopt-sequence',count:typed.length,stride:typed.BYTES_PER_ELEMENT,bytes:encoded.length};blobs.push(encoded);}
 else{const stride=kind.stride,count=kind.oct?typed.length/4:raw.length/stride,filtered=kind.exp?MeshoptEncoder.encodeFilterExp(typed,count,stride,kind.exp):kind.oct?MeshoptEncoder.encodeFilterOct(typed,count,stride,kind.oct):raw;
  const encoded=MeshoptEncoder.encodeVertexBuffer(filtered,count,stride);record={encoding:'meshopt-vertex',count,stride,bytes:encoded.length,...kind.exp?{filter:'EXPONENTIAL'}:kind.oct?{filter:'OCTAHEDRAL'}:{}};blobs.push(encoded);}
 record.type=kind.oct?'Int8Array':typed.constructor.name;record.offset=offset;offset+=record.bytes;const pad=(4-offset%4)%4;if(pad){blobs.push(new Uint8Array(pad));offset+=pad;}return record;};
const meshes=[];const usedMaterials=new Set();
for(const c of chunks.values()){if(!c.index.length)continue;usedMaterials.add(c.material);
 // Drawn positions to 20 bits of mantissa (meshopt's exponential filter: within 0.24 mm here, the same value always the
 // same, so no seams open); collision below stays exact.
 const position=put(new Float32Array(c.attributes.position.values),{stride:12,exp:20});
 // Normals as 8-bit octahedral pairs (meshopt's filter), four bytes each, read back as 8-bit xyz.
 let normal=null;if(c.attributes.normal){const v=c.attributes.normal.values,n=new Float32Array(v.length/3*4);for(let i=0;i<v.length/3;i++)for(let k=0;k<3;k++)n[i*4+k]=v[i*3+k];normal=put(n,{stride:4,oct:8});}
 const uv=c.attributes.uv?put(new Float32Array(c.attributes.uv.values),{stride:c.attributes.uv.itemSize*4}):null;
 // Colours as 16-bit fractions, padded to four (they are linear and all within 0..1: 8 bits would band the darkest).
 let color=null;if(c.attributes.color){const v=c.attributes.color.values,s=c.attributes.color.itemSize;if(v.some(x=>!(x>=0&&x<=1)))throw Error('Arrival pack: a vertex colour outside 0..1');
  const q=new Uint16Array(v.length/s*4);for(let i=0;i<v.length/s;i++)for(let k=0;k<s;k++)q[i*4+k]=Math.round(v[i*s+k]*65535);color={itemSize:s,...put(q,{stride:8})};}
 const index=put(c.vertices<65536?new Uint16Array(c.index):new Uint32Array(c.index),'index');
 meshes.push({material:c.material,tinted:c.tinted,renderOrder:c.renderOrder,vertices:c.vertices,triangles:c.index.length/3,from:[...c.from].slice(0,4),position,normal,uv,color,index});}
const collisionArray=put(new Float32Array(collision),{stride:12}),groundArray=put(new Float32Array(ground),{stride:12});

// Materials and only the pictures they use, renumbered from 0.
const materialIds=[...usedMaterials],materialAt=new Map(materialIds.map((id,i)=>[id,i]));for(const mesh of meshes)mesh.material=materialAt.get(mesh.material);
const materials=materialIds.map(id=>typeof id==='string'?extraMaterials.get(id).json:m.materials[id]);
for(const mesh of meshes){const extra=extraMaterials.get(materialIds[mesh.material]);if(extra?.art)mesh.art=extra.art;}
// Instance colours became vertex colours: those meshes draw with a copy of their material that reads them.
for(const mesh of meshes)if(mesh.tinted){const j={...materials[mesh.material],uuid:materials[mesh.material].uuid+'-tinted',vertexColors:true};mesh.material=materials.push(j)-1;}
const textureIds=new Set();for(const j of materials)for(const [k,v] of Object.entries(j))if(/map$/i.test(k)&&typeof v==='string')textureIds.add(v);
const textures=m.textures.filter(t=>textureIds.has(t.uuid)),imageIds=new Set(textures.map(t=>t.image));
// Pictures as lossless WebP (the same pixels, colour under transparent ones kept: about a sixth of the PNG's bytes).
const images=await Promise.all(m.images.filter(i=>imageIds.has(i.uuid)).map(async i=>{const [type,data]=String(i.url).split(',');if(!/^data:image\/png;base64$/.test(type))return i;
 const png=Buffer.from(data,'base64'),webp=await sharp(png).webp({lossless:true,exact:true,effort:6}).toBuffer();return webp.length<png.length?{...i,url:'data:image/webp;base64,'+webp.toString('base64')}:i;}));

// The arrival spot is worked out by the page (main.js START), from the same layout: the box must hold it.
const header={format:'leo-arrival-pack-v1',source:sourceId||path.basename(path.resolve(source)),box:[BOX.min.toArray(),BOX.max.toArray()],view:[VIEW_BOX.min.toArray(),VIEW_BOX.max.toArray()],rooms:ROOMS,meshes,materials,textures,images,collision:{...collisionArray,triangles:collisionKept},ground:{...groundArray,triangles:groundKept}};
const json=Buffer.from(JSON.stringify(header)),head=Buffer.alloc(4);head.writeUInt32LE(json.length);
const pad=Buffer.alloc((4-(4+json.length)%4)%4);
const body=Buffer.concat([head,json,pad,...blobs]);
const packed=zlib.gzipSync(body,{level:9});
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'pack.bin'),packed);
const sha256=crypto.createHash('sha256').update(packed).digest('hex');
const report={sha256,files:['pack.bin'],source:header.source,box:header.box,downloadMB:+(packed.length/1e6).toFixed(2),rawMB:+(body.length/1e6).toFixed(2),
 render:{seen,kept,meshes:meshes.length,materials:materials.length,pictures:images.length,paintings,leftOut:audit},collision:{triangles:collisionKept,ground:groundKept,unseen},seconds:Math.round((Date.now()-started)/1000)};
fs.writeFileSync(path.join(out,'integrity.json'),JSON.stringify(report,null,1));
console.log(JSON.stringify(report));
