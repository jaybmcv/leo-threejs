// node --max-old-space-size=12000 scripts/build-phone-walk.mjs <prepared-walk dir> <out dir> [--error 0.05] [--relative 0.03] [--collision-error 0.08] [--textures 0.5] [--top N]
// The phone ship (PHONE_WALK.md step 3): the whole verified prepared build made light enough for a phone, without
// rebuilding the ship. Same file format as prepared-walk, so readPreparedWorld reads it unchanged:
// - render geometry is simplified with meshoptimizer: each connected part to --relative of its middle dimension (so
//   thin strips keep their shape) and at most --error metres, none on lettering; each material group and prepared range
//   on its own, so their index ranges still hold, with the vertices they share locked; normals and colours become 8
//   bits, indices 16 bits where a geometry has few enough vertices, and the owner and finish ids only the inspector
//   reads (_leo_owner, _leo_finish) go;
// - what the walk rebuilds from stays byte for byte: geometry templates and live source meshes (its merged templates
//   are keyed on their contents), cabin frost, the lounge, the facade and haze meshes the phone distant view reads,
//   and source meshes with vertex ranges;
// - collision bands are welded and simplified to --collision-error (window glass on its own), and their BVHs rebuilt;
// - pictures are scaled by --textures;
// - arrays are meshopt-encoded, as the prepared walk's are.
// --top N also lists the N largest geometries. scripts/phone-walk-public.mjs runs it for the public site.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {MeshoptDecoder,MeshoptSimplifier} from 'meshoptimizer';
import {MeshoptEncoder} from 'meshoptimizer/encoder';
import sharp from 'sharp';

const args=process.argv.slice(2),flag=n=>{const i=args.indexOf(n);if(i<0)return null;const v=args[i+1];args.splice(i,2);return v;};
const top=Number(flag('--top')||0),maxError=Number(flag('--error')||0.05),relativeError=Number(flag('--relative')||0.03),collisionError=Number(flag('--collision-error')||0.08),textureScale=Number(flag('--textures')||0.5),[source,out]=args;
if(!source||!out)throw Error('usage: build-phone-walk.mjs <prepared-walk dir> <out dir> [--error 0.05] [--relative 0.03] [--collision-error 0.08] [--textures 0.5]');
const PART=8388608,started=Date.now();
const read=name=>fs.readFileSync(path.join(source,name));
const inflate=b=>b[0]===0x28&&b[1]===0xb5?zlib.zstdDecompressSync(b):zlib.gunzipSync(b);
const metadata=()=>{if(fs.existsSync(path.join(source,'world.bin')))return read('world.bin');const spec=JSON.parse(read('world.parts.json'));return Buffer.concat(spec.parts.map(p=>read(p.name)));};
const m=JSON.parse(inflate(metadata()));
const parts=m.parts.map(p=>inflate(read(p.name)));

// Decoding, as readPreparedWorld does it, one array at a time.
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready,MeshoptSimplifier.ready]);
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

// The new arrays, each written once. A format meshopt-encodes it as encode-prepared-walk-v2.mjs does: 'vertex' with
// the bytes per item, or 'sequence' for indices.
const written=[],records=[],writtenIds=new Map(),bytesBy={};let total=0,decodedTotal=0,phase='graphs';
const write=(a,format)=>{const raw=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),record={type:a.constructor.name,sha256:crypto.createHash('sha256').update(raw).digest('hex')};let bytes=raw;
 if(format&&raw.length){const rawStride=format.kind==='sequence'?a.BYTES_PER_ELEMENT:format.rawStride,stride=format.kind==='sequence'?rawStride:Math.ceil(rawStride/4)*4,count=raw.length/rawStride;let padded=raw;
  if(stride!==rawStride){padded=new Uint8Array(count*stride);for(let i=0;i<count;i++)for(let k=0;k<rawStride;k++)padded[i*stride+k]=raw[i*rawStride+k];}else if(padded.byteOffset%stride)padded=Uint8Array.from(padded);
  bytes=format.kind==='sequence'?MeshoptEncoder.encodeIndexSequence(padded,count,stride):MeshoptEncoder.encodeVertexBuffer(padded,count,stride);Object.assign(record,{encoding:format.kind==='sequence'?'meshopt-sequence':'meshopt-vertex',count,stride,rawStride,decodedBytes:raw.length});}
 const pad=(4-total%4)%4;if(pad){written.push(new Uint8Array(pad));total+=pad;}record.start=total;record.bytes=bytes.length;records.push(record);written.push(bytes);total+=bytes.length;decodedTotal+=raw.length;bytesBy[phase]=(bytesBy[phase]||0)+raw.length;return records.length-1;};
const vertex=a=>({kind:'vertex',rawStride:a.itemSize*types[a.constructor.name].BYTES_PER_ELEMENT}),sequence={kind:'sequence'};
const copy=(id,format)=>{if(id===null||id===undefined)return id;let n=writtenIds.get(id);if(n===undefined)writtenIds.set(id,n=write(decode(id),format));return n;};
const copyAttribute=a=>({...a,array:copy(a.array,{kind:'vertex',rawStride:a.itemSize*types[m.arrays[a.array].type].BYTES_PER_ELEMENT})});

const geometries=m.geometries.map(g=>({...g}));
// Byte for byte: a geometry with arrays of its own is copied as it is; one that reads a shared pool gets its used
// vertices copied out of it in the original triangle order, so its index ranges still hold.
const readers=new Map();for(const g of m.geometries)for(const a of Object.values(g.attributes))readers.set(a.array,(readers.get(a.array)||0)+1);
const done=new Set();
const exact=gi=>{const g=m.geometries[gi],o=geometries[gi];if(done.has(gi))return;done.add(gi);
 if(g.index===null||g.index===undefined||Object.values(g.attributes).every(a=>readers.get(a.array)===1)){o.index=copy(g.index,sequence);o.attributes=Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,copyAttribute(a)]));return;}
 const index=decode(g.index),remap=new Map(),order=[];const out=new Uint32Array(index.length);
 for(let i=0;i<index.length;i++){const v=index[i];let n=remap.get(v);if(n===undefined){n=order.length;remap.set(v,n);order.push(v);}out[i]=n;}
 o.index=write(order.length<=65535?Uint16Array.from(out):out,sequence);o.attributes={};
 for(const [k,a] of Object.entries(g.attributes)){const src=decode(a.array),size=a.itemSize,dst=new src.constructor(order.length*size);for(let i=0;i<order.length;i++)for(let j=0;j<size;j++)dst[i*size+j]=src[order[i]*size+j];o.attributes[k]={...a,array:write(dst,{kind:'vertex',rawStride:size*src.BYTES_PER_ELEMENT})};}};

// Light: simplified a piece at a time (the pieces are cut at every material group and prepared range), then only the
// vertices still used are kept, with 8-bit normals and colours.
// The errors a part may be simplified to, in metres: parts are grouped by these.
const LEVELS=[0.001,0.002,0.005,0.01,0.02,0.05,0.1];
const LETTERING=/text|label|letter|glyph|logo|numeral|digit|plaque|wayfinding/i;
const simplified={triangles:0,kept:0,vertices:0,keptVertices:0};
const quantize=(name,a,src,verts)=>{const size=a.itemSize,c=verts.length,gather=dst=>{for(let i=0;i<c;i++)for(let j=0;j<size;j++)dst[i*size+j]=src[verts[i]*size+j];return dst;};
 if(name==='normal'&&(src instanceof Float32Array&&!a.normalized||src instanceof Int16Array&&a.normalized)){const k=src instanceof Float32Array?127:127/32767,d=new Int8Array(c*size);for(let i=0;i<c;i++)for(let j=0;j<size;j++)d[i*size+j]=Math.round(Math.max(-1,Math.min(1,src[verts[i]*size+j]*k/127))*127);return [d,{...a,normalized:true}];}
 if(name==='color'&&src instanceof Uint16Array&&a.normalized){const d=new Uint8Array(c*size);for(let i=0;i<c;i++)for(let j=0;j<size;j++)d[i*size+j]=Math.round(src[verts[i]*size+j]/257);return [d,a];}
 if(name==='color'&&src instanceof Float32Array&&!a.normalized){const f=gather(new Float32Array(c*size));if(f.every(v=>v>=0&&v<=1))return [Uint8Array.from(f,v=>Math.round(v*255)),{...a,normalized:true}];return [f,a];}
 return [gather(new src.constructor(c*size)),a];};
const light=gi=>{const g=m.geometries[gi],o=geometries[gi];if(done.has(gi))return;done.add(gi);
 const index=decode(g.index),pool=decode(g.attributes.position.array),n=index.length/3;
 // Its own vertices, in pool order.
 const sorted=Uint32Array.from(index).sort();let u=0;for(let i=0;i<sorted.length;i++)if(!i||sorted[i]!==sorted[u-1])sorted[u++]=sorted[i];const verts=sorted.subarray(0,u),local=new Map();for(let i=0;i<u;i++)local.set(verts[i],i);
 const P=new Float32Array(u*3);for(let i=0;i<u;i++){P[i*3]=pool[verts[i]*3];P[i*3+1]=pool[verts[i]*3+1];P[i*3+2]=pool[verts[i]*3+2];}
 const I=Uint32Array.from(index,v=>local.get(v));
 const ranges=g.userData?.preparedRanges||[],end=x=>Number.isFinite(x.count)?x.start+x.count:n*3;
 const finishes=g.userData?.finishParts||[],owned=vertexRanges.get(gi)||[],cuts=new Set([0,n]);for(const x of [...g.groups||[],...finishes,...owned]){cuts.add(x.start/3);cuts.add(end(x)/3);}for(const r of ranges){cuts.add(r.start);cuts.add(r.start+r.count);}
 const edges=[...cuts].filter(x=>Number.isInteger(x)&&x>=0&&x<=n).sort((a,b)=>a-b),named=[...ranges].sort((a,b)=>a.start-b.start),moved=new Map(),pieces=[];let kept=0,r=0;
 // Welded by position: connected parts, each simplified to its own size (a floor of footprints is many small parts),
 // and the vertices pieces share, which are locked so their seams can't open.
 const weld=MeshoptSimplifier.generatePositionRemap(P,3),parent=new Int32Array(u).map((_,i)=>i),find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
 for(let t=0;t<n;t++){const a=find(weld[I[t*3]]);parent[find(weld[I[t*3+1]])]=a;parent[find(weld[I[t*3+2]])]=a;}
 const extent=new Map();for(let i=0;i<u;i++){const c=find(weld[i]);let e=extent.get(c);if(!e)extent.set(c,e=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);for(let j=0;j<3;j++){e[j]=Math.min(e[j],P[i*3+j]);e[3+j]=Math.max(e[3+j],P[i*3+j]);}}
 const allowed=new Map();for(const [c,e] of extent){const size=[e[3]-e[0],e[4]-e[1],e[5]-e[2]].sort((x,y)=>x-y)[1],error=Math.min(maxError,size*relativeError);allowed.set(c,LEVELS.findLast(x=>x<=error)??0);}
 const piece=new Int32Array(u).fill(-1);for(let s=0;s+1<edges.length;s++)for(let t=edges[s]*3;t<edges[s+1]*3;t++){const w=weld[I[t]];piece[w]=piece[w]===-1||piece[w]===s?s:-2;}
 const lock=Uint8Array.from(weld,w=>piece[w]===-2?1:0),none=new Float32Array(0);
 for(let s=0;s+1<edges.length;s++){const a=edges[s],b=edges[s+1];moved.set(a,kept);while(r+1<named.length&&named[r+1].start<=a)r++;const name=named[r]?.start<=a?named[r].name:'';
  const byLevel=new Map();for(let t=a;t<b;t++){const level=LETTERING.test(name)?0:allowed.get(find(weld[I[t*3]]));let list=byLevel.get(level);if(!list)byLevel.set(level,list=[]);list.push(t);}
  for(const [level,list] of byLevel){let part=new Uint32Array(list.length*3);list.forEach((t,i)=>{part[i*3]=I[t*3];part[i*3+1]=I[t*3+1];part[i*3+2]=I[t*3+2];});
   if(level>0&&list.length>=4)[part]=MeshoptSimplifier.simplifyWithAttributes(part,P,3,none,0,[],lock,0,level,['ErrorAbsolute','Sparse']);
   pieces.push(part);kept+=part.length/3;}}
 moved.set(n,kept);
 const used=new Uint8Array(u);for(const p of pieces)for(const q of p)used[q]=1;const keep=[],again=new Int32Array(u).fill(-1);for(let i=0;i<u;i++)if(used[i]){again[i]=keep.length;keep.push(i);}
 const idx=new Uint32Array(kept*3);let at=0;for(const p of pieces)for(const q of p)idx[at++]=again[q];
 const poolOrder=Uint32Array.from(keep,i=>verts[i]),light=[];
 for(const [k,a] of Object.entries(g.attributes)){if(k==='_leo_owner'||k==='_leo_finish')continue;const [d,record]=quantize(k,a,decode(a.array),poolOrder);light.push([k,d,record]);}
 // Vertices that differed only below 8 bits are now the same: each is kept once.
 const views=light.map(([,d,record])=>[new Uint8Array(d.buffer,d.byteOffset,d.byteLength),record.itemSize*d.BYTES_PER_ELEMENT]),same=new Map(),first=[],to=new Uint32Array(keep.length);
 for(let i=0;i<keep.length;i++){let key='';for(const [b,w] of views)for(let k=i*w;k<(i+1)*w;k++)key+=String.fromCharCode(b[k]);let j=same.get(key);if(j===undefined){j=first.length;same.set(key,j);first.push(i);}to[i]=j;}
 for(let i=0;i<idx.length;i++)idx[i]=to[idx[i]];
 o.index=write(first.length<=65535?Uint16Array.from(idx):idx,sequence);o.attributes={};
 for(const [k,d,record] of light){const size=record.itemSize,e=new d.constructor(first.length*size);first.forEach((i,n)=>{for(let j=0;j<size;j++)e[n*size+j]=d[i*size+j];});o.attributes[k]={...record,array:write(e,vertex({itemSize:size,constructor:e.constructor}))};}
 o.groups=(g.groups||[]).map(x=>({...x,start:moved.get(x.start/3)*3,count:(moved.get(end(x)/3)-moved.get(x.start/3))*3}));
 if(ranges.length)o.userData={...g.userData,preparedRanges:ranges.map(x=>({...x,start:moved.get(x.start),count:moved.get(x.start+x.count)-moved.get(x.start)}))};
 if(finishes.length)o.userData={...o.userData??g.userData,finishParts:finishes.map(x=>({...x,start:moved.get(x.start/3)*3,count:(moved.get(end(x)/3)-moved.get(x.start/3))*3}))};
 if(owned.length)movedBy.set(gi,moved);
 simplified.triangles+=n;simplified.kept+=kept;simplified.vertices+=u;simplified.keptVertices+=first.length;};

// Which geometries stay byte for byte.
const whole=new Set(),owners=new Map(),stats={};
// Source batches (cabin and hull envelopes) carry vertex ranges per room (ownerRanges) and per finish (finishParts). They
// were merged from unindexed parts, so a vertex range is also a range of the index; those are rewritten like groups.
// A batch whose ranges don't fall on triangles stays whole.
const vertexRanges=new Map(),movedBy=new Map();
const onTriangles=(list,g)=>list.every(r=>r.start%3===0&&r.count%3===0&&r.start+r.count<=m.arrays[g.index].count);
const visit=(label,data,all)=>{for(const n of data?.nodes||[]){if(n.geometry===undefined)continue;const g=m.geometries[n.geometry];if(!Object.keys(g.attributes).length)continue;const instanced=n.instanceMatrix!==undefined&&n.instanceMatrix!==null;
 const ranges=[...n.userData?.ownerRanges||[],...g.userData?.finishParts||[]],fits=ranges.length&&g.index!==null&&g.index!==undefined&&onTriangles(ranges,g);
 if(fits&&n.userData?.ownerRanges)vertexRanges.set(n.geometry,[...vertexRanges.get(n.geometry)||[],...n.userData.ownerRanges]);
 const k=all===true||all==='live'&&(!instanced||ranges.length&&!fits)||all instanceof RegExp&&all.test(n.name);if(k)whole.add(n.geometry);const s=stats[label]??={nodes:0,whole:0};s.nodes++;if(k)s.whole++;owners.get(n.geometry)??owners.set(n.geometry,label+' '+n.name+(instanced?' ×'+n.count:''));}};
visit('source',m.source,'live');for(const [,d] of m.bands)visit('bands',d,false);
// Cabin privacy (src/v2/cabin-privacy.js) copies every frost template at start.
visit('frost',m.frost,true);visit('signs',m.signs,true);visit('lounge',m.lounge,true);
// The phone distant view (src/v2/distant-architecture.js) is drawn from the facade's tower, sky and atrium floor, and
// counts the haze's window proxies.
visit('haze',m.haze,/^P6_Flowing_atrium_window_(reveal|inlay)$/);visit('facade',m.facade,/^P6_(atrium_floor_actual|sky_ceiling|sky_tip|tower_architecture)$/);
for(const [,gi] of m.geometryTemplates||[])whole.add(gi);
phase='templates';for(const [,gi] of m.geometryTemplates||[])exact(gi);
// Collision geometry is left to the collision section below.
const colliding=new Set(),collect=c=>{for(const [,r] of c.bands)colliding.add(r.geometry);for(const x of [...c.groups,...c.movers])colliding.add(x.bvh.geometry);if(c.ground)collect(c.ground);};collect(m.colliders);
phase='render';for(let gi=0;gi<geometries.length;gi++){const g=m.geometries[gi];if(!Object.keys(g.attributes).length||done.has(gi)||colliding.has(gi))continue;
 if(whole.has(gi)||g.index===null||g.index===undefined||!(decode(g.attributes.position.array) instanceof Float32Array)||g.attributes.position.normalized)exact(gi);else light(gi);}

// Graph array references (instances, userData arrays) are copied as they are.
const remapValue=v=>{if(v===null||typeof v!=='object')return v;if(v.$array!==undefined)return {$array:copy(v.$array)};if(Array.isArray(v))return v.map(remapValue);return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remapValue(x)]));};
const ownerRanges=(n,u)=>{const moved=movedBy.get(n.geometry);if(!moved||!u?.ownerRanges)return u;return {...u,ownerRanges:u.ownerRanges.map(r=>({...r,start:moved.get(r.start/3)*3,count:(moved.get((r.start+r.count)/3)-moved.get(r.start/3))*3}))};};
const graph=data=>data&&{...data,nodes:data.nodes.map(n=>({...n,...n.instanceMatrix!==undefined?{instanceMatrix:copy(n.instanceMatrix,{kind:'vertex',rawStride:64})}:{},...n.instanceColor!==undefined&&n.instanceColor!==null?{instanceColor:copy(n.instanceColor,{kind:'vertex',rawStride:3*types[m.arrays[n.instanceColor].type].BYTES_PER_ELEMENT})}:{},userData:remapValue(ownerRanges(n,n.userData))}))};
for(const g of geometries)if(g.userData)g.userData=remapValue(g.userData);

// Collision.
const geometryRecord=(positions,index)=>{const id=geometries.length,b=new T.Box3().setFromArray(positions),s=b.getBoundingSphere(new T.Sphere());geometries.push({name:'',type:'BufferGeometry',attributes:{position:{array:write(positions,{kind:'vertex',rawStride:12}),itemSize:3,normalized:false,usage:35044,instanced:false,gpuType:1015}},index:write(index,sequence),groups:[],bounds:[b.min.toArray(),b.max.toArray()],sphere:[s.center.toArray(),s.radius],userData:{}});return id;};
// Group and mover BVHs stay as they are. Prepared BVHs are read with setIndex:false, so their index is the geometry's own.
const sameBvh=r=>{exact(r.geometry);return {version:r.version,windowFlags:copy(r.windowFlags,{kind:'vertex',rawStride:1}),geometry:r.geometry,roots:r.roots.map(id=>copy(id,{kind:'vertex',rawStride:32})),index:geometries[r.geometry].index,indirect:copy(r.indirect,sequence)};};
let collisionTriangles=0,collisionKept=0;
// A band is welded by position and simplified, glass and the rest each on its own (windowFlags is per triangle), then its BVH
// rebuilt.
const lightBvh=r=>{const g=m.geometries[r.geometry],pool=decode(g.attributes.position.array),index=g.index!==null&&g.index!==undefined?decode(g.index):null,flags=r.windowFlags!==null&&r.windowFlags!==undefined?decode(r.windowFlags):null;
 const count=(index?index.length:pool.length/3)/3,corner=i=>index?index[i]:i;
 const remap=new Map(),order=[],I=new Uint32Array(count*3);for(let i=0;i<count*3;i++){const p=corner(i);let q=remap.get(p);if(q===undefined){q=order.length;remap.set(p,q);order.push(p);}I[i]=q;}
 const P=new Float32Array(order.length*3);order.forEach((p,i)=>{P[i*3]=pool[p*3];P[i*3+1]=pool[p*3+1];P[i*3+2]=pool[p*3+2];});
 const weld=MeshoptSimplifier.generatePositionRemap(P,3);for(let i=0;i<I.length;i++)I[i]=weld[I[i]];
 const classes=new Map();for(let t=0;t<count;t++){const f=flags?flags[t]:0;let list=classes.get(f);if(!list)classes.set(f,list=[]);list.push(t);}
 const kept=[],keptFlags=[];for(const [f,list] of classes){const piece=new Uint32Array(list.length*3);list.forEach((t,i)=>{piece[i*3]=I[t*3];piece[i*3+1]=I[t*3+1];piece[i*3+2]=I[t*3+2];});
  const [s]=MeshoptSimplifier.simplify(piece,P,3,0,collisionError,['ErrorAbsolute','Sparse']);kept.push(s);for(let i=0;i<s.length/3;i++)keptFlags.push(f);}
 const all=new Uint32Array(keptFlags.length*3);let at=0;for(const s of kept){all.set(s,at);at+=s.length;}
 const again=new Map(),verts=[],idx=new Uint32Array(all.length);for(let i=0;i<all.length;i++){let q=again.get(all[i]);if(q===undefined){q=verts.length;again.set(all[i],q);verts.push(all[i]);}idx[i]=q;}
 const positions=new Float32Array(verts.length*3);verts.forEach((p,i)=>{positions[i*3]=P[p*3];positions[i*3+1]=P[p*3+1];positions[i*3+2]=P[p*3+2];});
 collisionTriangles+=count;collisionKept+=keptFlags.length;
 // 32-triangle leaves with the index put in BVH order and no indirect buffer, as scripts/prepared-collision-pack.mjs
 // packs the ship's.
 const geom=new T.BufferGeometry();geom.setAttribute('position',new T.BufferAttribute(positions,3));geom.setIndex(new T.BufferAttribute(idx,1));
 const bvh=new MeshBVH(geom,{targetLeafSize:32,indirect:true}),s=MeshBVH.serialize(bvh,{cloneBuffers:false}),permutation=s.indirectBuffer,direct=new Uint32Array(idx.length),directFlags=new Uint8Array(permutation.length);
 for(let i=0;i<permutation.length;i++){const t=permutation[i];direct[i*3]=idx[t*3];direct[i*3+1]=idx[t*3+1];direct[i*3+2]=idx[t*3+2];directFlags[i]=keptFlags[t];}
 const id=geometryRecord(positions,direct);return {version:s.version,windowFlags:flags?write(directFlags,{kind:'vertex',rawStride:1}):null,geometry:id,roots:s.roots.map(x=>write(new Uint8Array(x),{kind:'vertex',rawStride:32})),index:geometries[id].index,indirect:null};};
const colliders=col=>({bands:col.bands.map(([k,r])=>[k,lightBvh(r)]),groups:col.groups.map(g=>({...g,bvh:sameBvh(g.bvh)})),movers:col.movers.map(x=>({...x,bvh:sameBvh(x.bvh)})),ground:col.ground?colliders(col.ground):null});
phase='collision';const phoneColliders=colliders(m.colliders);phase='graphs';

// Pictures, scaled down (none below 16 pixels a side).
let pictureBytes=[0,0];
const images=await Promise.all(m.images.map(async i=>{const url=i.url;if(typeof url!=='string'||!url.startsWith('data:image/')||textureScale>=1)return i;
 const data=Buffer.from(url.slice(url.indexOf(',')+1),'base64'),picture=sharp(data),{width,height,format}=await picture.metadata(),w=Math.max(16,Math.round(width*textureScale)),h=Math.max(16,Math.round(height*textureScale));
 if(w>=width&&h>=height)return i;const smaller=await picture.resize(w,h,{fit:'fill'})[format==='jpeg'?'jpeg':'png']().toBuffer();pictureBytes[0]+=width*height*4;pictureBytes[1]+=w*h*4;
 return {...i,url:'data:image/'+(format==='jpeg'?'jpeg':'png')+';base64,'+smaller.toString('base64')};}));

const manifest={...m,arrays:records,geometries,images,parts:[],source:graph(m.source),bands:m.bands.map(([k,d])=>[k,graph(d)]),haze:graph(m.haze),facade:graph(m.facade),lounge:graph(m.lounge),frost:graph(m.frost),signs:graph(m.signs),colliders:phoneColliders,
 ship:remapValue(m.ship),rest:remapValue(m.rest),seats:remapValue(m.seats),privacy:remapValue(m.privacy),roomFeatureSupports:remapValue(m.roomFeatureSupports),
 phone:{format:'leo-phone-ship-v1',source:path.basename(path.resolve(source)),error:maxError,relativeError,collisionError,textureScale}};
delete manifest.retirements;

// Parts: the arrays back to back, cut every 8 MiB, each zstd-compressed.
const all=Buffer.concat(written,total),files=[];fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(let i=0;i*PART<total;i++){const raw=all.subarray(i*PART,Math.min(total,(i+1)*PART)),zipped=zlib.zstdCompressSync(raw,{params:{[zlib.constants.ZSTD_c_compressionLevel]:19}}),name='geometry-'+i+'.bin';fs.writeFileSync(path.join(out,name),zipped);manifest.parts.push({name,bytes:raw.length,zipped:zipped.length});files.push(name);}
const world=zlib.zstdCompressSync(Buffer.from(JSON.stringify(manifest)),{params:{[zlib.constants.ZSTD_c_compressionLevel]:19}});fs.writeFileSync(path.join(out,'world.bin'),world);files.push('world.bin');
const hash=crypto.createHash('sha256');for(const name of [...files].sort()){hash.update(name);hash.update(fs.readFileSync(path.join(out,name)));}
const mb=n=>+(n/1e6).toFixed(1);
const report={sha256:hash.digest('hex'),files,source:manifest.phone.source,error:maxError,relativeError,collisionError,textureScale,decodedMB:mb(decodedTotal),downloadMB:mb(manifest.parts.reduce((n,p)=>n+p.zipped,0)+world.length),metadataMB:mb(world.length),
 render:{stats,triangles:simplified.triangles,kept:simplified.kept,vertices:simplified.vertices,keptVertices:simplified.keptVertices,whole:[...whole].length},collision:{triangles:collisionTriangles,kept:collisionKept,bands:phoneColliders.bands.length},
 pictures:{decodedMB:mb(pictureBytes[0]),scaledMB:mb(pictureBytes[1])},decodedMBBy:Object.fromEntries(Object.entries(bytesBy).map(([k,v])=>[k,mb(v)])),seconds:Math.round((Date.now()-started)/1000)};
fs.writeFileSync(path.join(out,'integrity.json'),JSON.stringify(report,null,1));
console.log(JSON.stringify(report,null,1));
if(top){const size=gi=>{const g=geometries[gi];return [...Object.values(g.attributes).map(a=>a.array),g.index].filter(x=>x!==null&&x!==undefined).reduce((n,id)=>n+(records[id].decodedBytes??records[id].bytes),0);};
 for(const [gi,label] of [...owners].sort((x,y)=>size(y[0])-size(x[0])).slice(0,top))console.log((size(gi)/1e6).toFixed(1).padStart(7),'MB',whole.has(gi)?'whole':'light',label);}
