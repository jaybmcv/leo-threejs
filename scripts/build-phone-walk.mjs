// node --max-old-space-size=12000 scripts/build-phone-walk.mjs <prepared-walk dir> <out dir> [--layout layout.json] [--margin 6] [--top N]
// The phone walk payload (PHONE_WALK.md step 3), derived from a verified prepared build without rebuilding the ship.
// Same file format as prepared-walk, so readPreparedWorld reads it unchanged, but cut down to the arrival area:
// - every node, name and template stays, so the walk code finds what it looks for;
// - the area is the Deck 2 arrival hall and the garden over it, --margin metres around them (not the decks above:
//   the atrium sight would otherwise pull in most of the ship);
// - render geometry whose world bounds meet the area keeps its triangles, copied out of the shared vertex pools into
//   buffers of its own; everything else keeps only its bounds (as the baked source meshes already do);
// - collision keeps the triangles that meet the area and rebuilds those bands' BVHs; instance copies outside it go;
// - pictures used only by emptied meshes become a 1×1 pixel.
// --top N also lists the N largest kept geometries. scripts/phone-walk-public.mjs runs it for the public site.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {MeshoptDecoder} from 'meshoptimizer';

const args=process.argv.slice(2),flag=n=>{const i=args.indexOf(n);if(i<0)return null;const v=args[i+1];args.splice(i,2);return v;};
const top=Number(flag('--top')||0),margin=Number(flag('--margin')||6),layoutFile=flag('--layout'),[source,out]=args;
if(!source||!out)throw Error('usage: build-phone-walk.mjs <prepared-walk dir> <out dir> [--layout layout.json] [--margin 6]');
const PART=8388608,started=Date.now();
const read=name=>fs.readFileSync(path.join(source,name));
const inflate=b=>b[0]===0x28&&b[1]===0xb5?zlib.zstdDecompressSync(b):zlib.gunzipSync(b);
const metadata=()=>{if(fs.existsSync(path.join(source,'world.bin')))return read('world.bin');const spec=JSON.parse(read('world.parts.json'));return Buffer.concat(spec.parts.map(p=>read(p.name)));};
const m=JSON.parse(inflate(metadata()));
const parts=m.parts.map(p=>inflate(read(p.name)));
const layout=JSON.parse(fs.readFileSync(layoutFile||path.join(source,'../layout.json'),'utf8'));

// The arrival hall, where a guest first stands (20 m in from its centre).
const room=layout.rooms.find(r=>r.id==='d02-arrival-1');if(!room)throw Error('No d02-arrival-1 room in the layout');
const at=new T.Vector3(room.frame.origin[0]-20,room.frame.origin[1],room.frame.origin[2]);
const area=new T.Box3();for(const [x,z] of room.polygon)area.expandByPoint(new T.Vector3(x,room.y,z));
area.min.x-=margin;area.max.x+=margin;area.min.z-=margin;area.max.z+=margin;
// Upward it takes in Hydroponic garden A on Deck 3, which the hall's ceiling opens into and its cat tree climbs to
// (src/walk/arrival-atrium.js: the garden's ceiling is 7.3 m over the hall floor).
area.min.y=room.y-2;area.max.y=room.y+7.3+2;

// Decoding, as readPreparedWorld does it, one array at a time.
await MeshoptDecoder.ready;
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

// The new arrays, each written once.
const written=[],records=[],writtenIds=new Map(),bytesBy={};let total=0,phase='graphs';
const write=a=>{const pad=(4-total%4)%4;if(pad){written.push(new Uint8Array(pad));total+=pad;}const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);records.push({type:a.constructor.name,start:total,bytes:a.byteLength,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});written.push(bytes);total+=a.byteLength;bytesBy[phase]=(bytesBy[phase]||0)+a.byteLength;return records.length-1;};
const copy=id=>{if(id===null||id===undefined)return id;let n=writtenIds.get(id);if(n===undefined)writtenIds.set(id,n=write(decode(id)));return n;};

// Geometry: kept ones that read a shared pool get their used vertices copied out of it, in the original triangle
// order, so preparedRanges (index ranges) still hold. Emptied ones keep only bounds.
const geometries=m.geometries.map(g=>({...g}));const keep=new Set(),compacted=new Map();
// A geometry with arrays of its own is copied byte for byte: the walk keys its merged templates on their contents.
const readers=new Map();for(const g of m.geometries)for(const a of Object.values(g.attributes))readers.set(a.array,(readers.get(a.array)||0)+1);
const compact=gi=>{const g=m.geometries[gi],o=geometries[gi];if(compacted.has(gi))return;compacted.set(gi,true);
 if(g.index===null||g.index===undefined||Object.values(g.attributes).every(a=>readers.get(a.array)===1)){o.index=copy(g.index);o.attributes=Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{...a,array:copy(a.array)}]));return;}
 const index=decode(g.index),remap=new Map(),order=[];const out=new Uint32Array(index.length);
 for(let i=0;i<index.length;i++){const v=index[i];let n=remap.get(v);if(n===undefined){n=order.length;remap.set(v,n);order.push(v);}out[i]=n;}
 const small=order.length<=65535?Uint16Array.from(out):out;o.index=write(small);o.attributes={};
 for(const [k,a] of Object.entries(g.attributes)){const src=decode(a.array),size=a.itemSize,dst=new src.constructor(order.length*size);for(let i=0;i<order.length;i++)for(let j=0;j<size;j++)dst[i*size+j]=src[order[i]*size+j];o.attributes[k]={...a,array:write(dst)};}};
// Their index ranges and finish parts describe triangles that are gone (the walk reads both only with a position).
const empty=gi=>{const o=geometries[gi];o.attributes={};o.index=null;if(o.userData?.preparedRanges)o.userData={...o.userData,preparedRanges:[]};if(o.userData?.finishParts)o.userData={...o.userData,finishParts:[]};};

const box=new T.Box3(),mat=new T.Matrix4(),inst=new T.Matrix4();
const worldBox=(bounds,matrixWorld,instances)=>{const local=new T.Box3(new T.Vector3(...bounds[0]),new T.Vector3(...bounds[1])),result=new T.Box3();mat.fromArray(matrixWorld||new T.Matrix4().elements);
 if(!instances){result.copy(local).applyMatrix4(mat);return result;}for(let i=0;i<instances.length;i+=16){inst.fromArray(instances,i).premultiply(mat);result.union(box.copy(local).applyMatrix4(inst));}return result;};
const near=b=>!b.isEmpty()&&b.intersectsBox(area);
const stats={};const count=(k,kept,tris)=>{const s=stats[k]??={nodes:0,kept:0,triangles:0};s.nodes++;if(kept){s.kept++;s.triangles+=tris;}};
const trianglesOf=gi=>{const g=m.geometries[gi];if(g.index!==null&&g.index!==undefined)return m.arrays[g.index].count/3;const p=g.attributes.position;return p?m.arrays[p.array].decodedBytes/(p.itemSize*4)/3:0;};
const owners=new Map();
// `all`: true keeps every mesh, 'live' every one that isn't instanced, a pattern the meshes it names; the rest are kept
// when they meet the area.
const visit=(label,data,all=false)=>{for(const n of data?.nodes||[]){if(n.geometry===undefined)continue;const g=m.geometries[n.geometry];if(!Object.keys(g.attributes).length)continue;
 const instances=n.instanceMatrix!==undefined&&n.instanceMatrix!==null?decode(n.instanceMatrix):null,b=g.bounds?worldBox(g.bounds,n.matrixWorld,instances):new T.Box3();
 const k=all===true||all==='live'&&!instances||all instanceof RegExp&&all.test(n.name)||near(b);count(label,k,trianglesOf(n.geometry)*(instances?n.count:1));if(k){keep.add(n.geometry);owners.get(n.geometry)??owners.set(n.geometry,label+' '+n.name+(instances?' ×'+n.count:''));}}};
// The walk code reads live source meshes (doors, hammocks) to build its own merged ones, whose prepared templates are
// keyed on their contents, so those stay whole wherever they are; instanced ones are drawn as they are.
visit('source',m.source,'live');for(const [,d] of m.bands)visit('bands',d);
// Cabin privacy (src/v2/cabin-privacy.js) copies every frost template at start.
visit('frost',m.frost,true);visit('signs',m.signs);visit('lounge',m.lounge,true);
// The phone distant view (src/v2/distant-architecture.js) is drawn from the facade's tower, sky and atrium floor: kept
// whole, they are the light stand-in for the view up the atrium. It counts the haze's window proxies before it drops them.
visit('haze',m.haze,/^P6_Flowing_atrium_window_(reveal|inlay)$/);visit('facade',m.facade,/^P6_(atrium_floor_actual|sky_ceiling|sky_tip|tower_architecture)$/);
for(const [,gi] of m.geometryTemplates||[])keep.add(gi);
phase='templates';for(const [,gi] of m.geometryTemplates||[])compact(gi);phase='render';for(let gi=0;gi<geometries.length;gi++)if(keep.has(gi))compact(gi);else if(Object.keys(m.geometries[gi].attributes).length)empty(gi);

// Graph array references (instances, userData arrays) are copied as they are.
const remapValue=v=>{if(v===null||typeof v!=='object')return v;if(v.$array!==undefined)return {$array:copy(v.$array)};if(Array.isArray(v))return v.map(remapValue);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remapValue(x)]));};
const graph=data=>data&&{...data,nodes:data.nodes.map(n=>({...n,...n.instanceMatrix!==undefined?{instanceMatrix:copy(n.instanceMatrix)}:{},...n.instanceColor!==undefined?{instanceColor:copy(n.instanceColor)}:{},userData:remapValue(n.userData)}))};
for(const g of geometries)if(g.userData)g.userData=remapValue(g.userData);

// Collision.
const geometryRecord=(positions,index)=>{const id=geometries.length,b=new T.Box3().setFromArray(positions),s=b.getBoundingSphere(new T.Sphere());geometries.push({name:'',type:'BufferGeometry',attributes:{position:{array:write(positions),itemSize:3,normalized:false,usage:35044,instanced:false,gpuType:1015}},index:write(index),groups:[],bounds:[b.min.toArray(),b.max.toArray()],sphere:[s.center.toArray(),s.radius],userData:{}});return id;};
// Compacting keeps triangle order, so a BVH's roots and indirect buffer still fit. Prepared BVHs are read with
// setIndex:false, so their index is the geometry's own.
const sameBvh=r=>{compact(r.geometry);keep.add(r.geometry);return {version:r.version,windowFlags:copy(r.windowFlags),geometry:r.geometry,roots:r.roots.map(copy),index:geometries[r.geometry].index,indirect:copy(r.indirect)};};
const tri=new T.Box3(),a=new T.Vector3(),b2=new T.Vector3(),c=new T.Vector3();let collisionTriangles=0,collisionKept=0;
const trimmedBvh=r=>{const g=m.geometries[r.geometry],pos=decode(g.attributes.position.array),index=g.index!==null?decode(g.index):null,flags=r.windowFlags!==null&&r.windowFlags!==undefined?decode(r.windowFlags):null;
 const v=i=>index?index[i]:i,count=(index?index.length:pos.length/3)/3,keptTris=[];
 for(let t=0;t<count;t++){a.fromArray(pos,v(t*3)*3);b2.fromArray(pos,v(t*3+1)*3);c.fromArray(pos,v(t*3+2)*3);tri.makeEmpty().expandByPoint(a).expandByPoint(b2).expandByPoint(c);if(tri.intersectsBox(area))keptTris.push(t);}
 collisionTriangles+=count;collisionKept+=keptTris.length;if(!keptTris.length)return null;
 const remap=new Map(),order=[],idx=new Uint32Array(keptTris.length*3);keptTris.forEach((t,n)=>{for(let k=0;k<3;k++){const p=v(t*3+k);let q=remap.get(p);if(q===undefined){q=order.length;remap.set(p,q);order.push(p);}idx[n*3+k]=q;}});
 const positions=new Float32Array(order.length*3);order.forEach((p,i)=>{positions[i*3]=pos[p*3];positions[i*3+1]=pos[p*3+1];positions[i*3+2]=pos[p*3+2];});
 const geom=new T.BufferGeometry();geom.setAttribute('position',new T.BufferAttribute(positions,3));geom.setIndex(new T.BufferAttribute(idx,1));
 const bvh=new MeshBVH(geom,{targetLeafSize:8,indirect:true}),s=MeshBVH.serialize(bvh,{cloneBuffers:false});
 const keptFlags=flags?Uint8Array.from(keptTris,t=>flags[t]):null;
 const id=geometryRecord(positions,idx);return {version:s.version,windowFlags:keptFlags?write(keptFlags):null,geometry:id,roots:s.roots.map(x=>write(new Uint8Array(x))),index:geometries[id].index,indirect:write(s.indirectBuffer)};};
const colliders=col=>{const groups=[];for(const g of col.groups){const kept=g.items.map((x,i)=>[x,i]).filter(([x])=>near(new T.Box3(new T.Vector3(...x.box.$box3[0]),new T.Vector3(...x.box.$box3[1]))));if(!kept.length)continue;const renumber=new Map(kept.map(([,i],n)=>[i,n]));
  groups.push({name:g.name,bvh:sameBvh(g.bvh),items:kept.map(([x])=>x),cells:g.cells.map(([k,ids])=>[k,ids.filter(i=>renumber.has(i)).map(i=>renumber.get(i))]).filter(([,ids])=>ids.length)});}
 return {bands:col.bands.map(([k,r])=>[k,trimmedBvh(r)]).filter(([,r])=>r),groups,movers:col.movers.map(x=>({...x,bvh:sameBvh(x.bvh)})),ground:col.ground?colliders(col.ground):null};};
phase='collision';const phoneColliders=colliders(m.colliders);phase='graphs';

// Pictures: keep only those a kept mesh's material can show.
const materialsUsed=new Set();const markMaterials=data=>{for(const n of data?.nodes||[])if(n.geometry!==undefined&&keep.has(n.geometry))for(const i of [].concat(n.material))materialsUsed.add(i);};
for(const k of ['source','haze','facade','lounge','frost','signs'])markMaterials(m[k]);for(const [,d] of m.bands)markMaterials(d);
const textureIds=new Set(m.textures.map(t=>t.uuid)),texturesUsed=new Set();const scan=v=>{if(typeof v==='string'){if(textureIds.has(v))texturesUsed.add(v);}else if(v&&typeof v==='object')for(const x of Object.values(v))scan(x);};
for(const i of materialsUsed)scan(m.materials[i]);const imagesUsed=new Set(m.textures.filter(t=>texturesUsed.has(t.uuid)).map(t=>t.image));
const PIXEL='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNoaGj4DwAFhAKAjM1mJgAAAABJRU5ErkJggg==';
const images=m.images.map(i=>imagesUsed.has(i.uuid)?i:{...i,url:PIXEL});

const manifest={...m,arrays:records,geometries,images,parts:[],source:graph(m.source),bands:m.bands.map(([k,d])=>[k,graph(d)]),haze:graph(m.haze),facade:graph(m.facade),lounge:graph(m.lounge),frost:graph(m.frost),signs:graph(m.signs),colliders:phoneColliders,
 ship:remapValue(m.ship),rest:remapValue(m.rest),seats:remapValue(m.seats),privacy:remapValue(m.privacy),roomFeatureSupports:remapValue(m.roomFeatureSupports),
 phone:{format:'leo-phone-walk-v1',source:path.basename(path.resolve(source)),at:at.toArray(),area:[area.min.toArray(),area.max.toArray()]}};
delete manifest.retirements;

// Parts: the arrays back to back, cut every 8 MiB, each zstd-compressed.
const all=Buffer.concat(written,total),files=[];fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(let i=0;i*PART<total;i++){const raw=all.subarray(i*PART,Math.min(total,(i+1)*PART)),zipped=zlib.zstdCompressSync(raw,{params:{[zlib.constants.ZSTD_c_compressionLevel]:12}}),name='geometry-'+i+'.bin';fs.writeFileSync(path.join(out,name),zipped);manifest.parts.push({name,bytes:raw.length,zipped:zipped.length});files.push(name);}
const world=zlib.zstdCompressSync(Buffer.from(JSON.stringify(manifest)),{params:{[zlib.constants.ZSTD_c_compressionLevel]:12}});fs.writeFileSync(path.join(out,'world.bin'),world);files.push('world.bin');
const hash=crypto.createHash('sha256');for(const name of [...files].sort()){hash.update(name);hash.update(fs.readFileSync(path.join(out,name)));}
const report={sha256:hash.digest('hex'),files,source:manifest.phone.source,at:at.toArray(),area:manifest.phone.area,decodedMB:+(total/1e6).toFixed(1),downloadMB:+((manifest.parts.reduce((n,p)=>n+p.zipped,0)+world.length)/1e6).toFixed(1),metadataMB:+(world.length/1e6).toFixed(1),
 render:stats,collision:{triangles:collisionTriangles,kept:collisionKept,bands:phoneColliders.bands.length,groups:phoneColliders.groups.length,movers:phoneColliders.movers.length},images:{kept:imagesUsed.size,of:m.images.length},decodedMBBy:Object.fromEntries(Object.entries(bytesBy).map(([k,v])=>[k,+(v/1e6).toFixed(1)])),seconds:Math.round((Date.now()-started)/1000)};
fs.writeFileSync(path.join(out,'integrity.json'),JSON.stringify(report,null,1));
console.log(JSON.stringify(report,null,1));
if(top){const size=gi=>{const g=geometries[gi];return [...Object.values(g.attributes).map(a=>a.array),g.index].filter(x=>x!==null&&x!==undefined).reduce((n,id)=>n+records[id].bytes,0);};
 for(const [gi,label] of [...owners].sort((x,y)=>size(y[0])-size(x[0])).slice(0,top))console.log((size(gi)/1e6).toFixed(1).padStart(7),'MB',label);}
