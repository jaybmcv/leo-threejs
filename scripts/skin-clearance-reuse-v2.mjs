// Saved per-mesh skin clearance results (auditSkinClearance's options.reuse). A mesh's result is reused only when a
// fingerprint of everything its audit reads is unchanged:
// - the mesh: name, type, instancing, world and instance matrices, user data, its material or materials (shape and
//   names), its bounding box, every geometry attribute as the audit reads it (getX..getW) for the vertices its index
//   references (renumbered in first-use order, so a range moving within a shared buffer still matches), the renumbered
//   index, groups, draw range and geometry user data;
// - every ancestor's name, visibility and user data (ownership and finished-skin naming read them);
// - every room window that any triangle of any instance can reach, in window-list order, with its whole prototype;
// - the global key: the skin authority's canonical proof, the exterior GLB bytes, the source files of the audit, the
//   authority and the GLB parser, package-lock, the installed three, three-mesh-bvh and meshoptimizer, the exterior
//   fitting list and the audit options.
// Anything outside what this can fingerprint exactly (other attribute classes, an index whose count is not its whole
// array, a bounding box that does not enclose the vertices, values other than plain JSON data, typed arrays, undefined
// and non-finite numbers) is audited afresh. Saved entries are schema-checked and carry a digest of their key and result;
// anything that does not check out is audited afresh.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {producerDependencies,sourceHash} from './fast-dependencies-v2.mjs';

const VERSION=2;
const digest=text=>createHash('sha256').update(text).digest('hex');

// Unambiguous: strings are JSON-quoted, numbers are bare (with -0, NaN and ±Infinity spelled out), undefined is a bare
// word no JSON value can be, typed arrays carry their type. Anything else (functions, symbols, bigints, Maps, class
// instances, accessors, cycles) throws, and the mesh is audited afresh.
function stable(value,seen=new Set()){
 if(value===undefined)return 'undefined';
 if(value===null)return 'null';
 switch(typeof value){
  case 'string':return JSON.stringify(value);
  case 'boolean':return String(value);
  case 'number':return Object.is(value,-0)?'-0':String(value);
  case 'object':break;
  default:throw Error('unsupported '+typeof value);
 }
 if(seen.has(value))throw Error('cycle');
 seen.add(value);
 try{
  // Every own property must be a plain enumerable data property with a string key; arrays and typed arrays may have
  // only their indices (and an array its length).
  const own=Reflect.ownKeys(value),plain=k=>{if(typeof k!=='string')throw Error('symbol key');const d=Object.getOwnPropertyDescriptor(value,k);if(!('value' in d)||!d.enumerable&&k!=='length')throw Error('accessor or hidden property');return d.value;};
  if(ArrayBuffer.isView(value)){if(value instanceof DataView)throw Error('DataView');if(own.length!==value.length)throw Error('typed array properties');return value.constructor.name+'['+Array.from(value,x=>stable(x)).join(',')+']';}
  if(Array.isArray(value)){if(Object.getPrototypeOf(value)!==Array.prototype)throw Error('array subclass');if(own.length!==value.length+1)throw Error('sparse array or array properties');let out='[';for(let i=0;i<value.length;i++)out+=(i?',':'')+stable(plain(String(i)),seen);plain('length');return out+']';}
  const proto=Object.getPrototypeOf(value);
  if(proto!==Object.prototype&&proto!==null)throw Error('class instance');
  const out=own.map(k=>[k,plain(k)]).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+stable(v,seen));
  return '{'+out.join(',')+'}';
 }finally{seen.delete(value);}
}

// Attribute classes whose getX..getW are BufferAttribute's own (no Float16 decoding or other overrides).
const PLAIN_ATTRIBUTES=new Set([T.BufferAttribute,T.Int8BufferAttribute,T.Uint8BufferAttribute,T.Uint8ClampedBufferAttribute,T.Int16BufferAttribute,T.Uint16BufferAttribute,T.Int32BufferAttribute,T.Uint32BufferAttribute,T.Float32BufferAttribute]);
const ACCESSORS=['getX','getY','getZ','getW'];
const plainAttribute=a=>PLAIN_ATTRIBUTES.has(a?.constructor)&&ACCESSORS.every(n=>a[n]===T.BufferAttribute.prototype[n])&&a.itemSize>=1&&a.itemSize<=4&&a.array?.length===a.count*a.itemSize;

// The checker's own code: every source file the audit, the authority, the GLB parser and this module import, plus
// package-lock and the package.json of the three, three-mesh-bvh and meshoptimizer actually installed: node_modules can
// be a shared junction whose packages differ from this checkout's lock, and three r187 changed this audit's results.
async function installedPackage(name){
 let dir=path.dirname(fileURLToPath(import.meta.resolve(name)));
 for(;;){try{const bytes=await fs.readFile(path.join(dir,'package.json'));if(JSON.parse(bytes).name===name)return bytes;}catch{}const up=path.dirname(dir);if(up===dir)throw Error('No package.json found for '+name);dir=up;}
}
export async function clearanceCodeKey(){
 const files=[...await producerDependencies(['src/plan/skin-clearance-v2.js','scripts/clearance-authority-v2.mjs','scripts/exterior-io-v2.mjs','src/v2/skin-authority.js','scripts/skin-clearance-reuse-v2.mjs']),'package-lock.json'].sort();
 const h=createHash('sha256');for(const f of files)h.update(f+'\0'+sourceHash(f,await fs.readFile(f))+'\0');
 for(const name of ['three','three-mesh-bvh','meshoptimizer'])h.update(name+'\0'+digest(await installedPackage(name))+'\0');
 return h.digest('hex');
}

const count=n=>Number.isInteger(n)&&n>=0;
const point=q=>Array.isArray(q)&&q.length===3&&q.every(Number.isFinite);
// A saved result must have exactly the shape auditMesh returns; failures must carry their witnesses.
function validResult(r){
 if(!r||typeof r!=='object')return false;
 if(Object.keys(r).sort().join()!=='blocked,exceptions,faceSamples,outside,vertices,windowFaces')return false;
 if(!count(r.vertices)||!count(r.faceSamples)||!count(r.windowFaces))return false;
 if(!r.exceptions||typeof r.exceptions!=='object'||Array.isArray(r.exceptions)||!Object.values(r.exceptions).every(n=>count(n)&&n>0))return false;
 if(!Array.isArray(r.blocked)||!r.blocked.every(b=>b&&typeof b==='object'&&typeof b.mesh==='string'&&point(b.point)))return false;
 if(r.outside!==null&&!(r.outside&&typeof r.outside==='object'&&count(r.outside.samples)&&r.outside.samples>0&&point(r.outside.point)&&Number.isFinite(r.outside.maxDistance)))return false;
 return true;
}

export async function createClearanceReuse(file,parts){
 const globalKey=digest(stable({version:VERSION,...parts}));
 const entryDigest=(key,r)=>digest(globalKey+'\0'+key+'\0'+JSON.stringify(r));
 let saved=new Map(),rejected=0;
 try{
  const data=JSON.parse(await fs.readFile(file,'utf8'));
  if(data?.version===VERSION&&data.globalKey===globalKey&&data.entries&&typeof data.entries==='object')
   for(const [key,e] of Object.entries(data.entries)){if(/^[0-9a-f]{64}$/.test(key)&&e&&validResult(e.result)&&e.digest===entryDigest(key,e.result))saved.set(key,e.result);else rejected++;}
 }catch{}
 const used=new Map(),windowKeys=new Map(),prototypeKeys=new Map();let unkeyed=0,windowIndex=null;
 const prototypeKey=p=>{let k=prototypeKeys.get(p);if(!k){k=digest(stable(p));prototypeKeys.set(p,k);}return k;};
 const windowKey=w=>{let k=windowKeys.get(w);if(!k){const {p,opening,rect,box,faces}=w;k=digest(stable({prototype:prototypeKey(p),opening,rect,box:[box.min.toArray(),box.max.toArray()],faces}));windowKeys.set(w,k);}return k;};
 return {
  globalKey,
  key(o,box,windowCheck){
   try{
    if(!windowIndex||windowIndex.check!==windowCheck)windowIndex={check:windowCheck,index:new Map(windowCheck.windows.map((w,i)=>[w,i]))};
    const h=createHash('sha256').update(globalKey);
    const add=(label,text)=>h.update(label+'\0'+text+'\0');
    const material=o.material;
    add('mesh',stable({name:o.name,type:o.type,instanced:!!o.isInstancedMesh,count:o.isInstancedMesh?o.count:1,matrixWorld:Array.from(o.matrixWorld.elements),userData:o.userData,
     material:Array.isArray(material)?{arrayName:material.name,array:material.map(m=>m==null?null:{name:m.name})}:material==null?null:{name:material.name},box:[box.min.toArray(),box.max.toArray()]}));
    for(let a=o.parent;a;a=a.parent)add('ancestor',stable({name:a.name,visible:a.visible,userData:a.userData}));
    const g=o.geometry,ix=g.index,pos=g.attributes.position;
    if(g.morphAttributes&&Object.keys(g.morphAttributes).length)throw Error('morph attributes');
    // Vertices in first use order: the audit reads only vertices its index references (all of them when not indexed).
    const order=[],local=new Map();
    if(ix){
     if(!plainAttribute(ix)||ix.itemSize!==1||ix.normalized||!(ix.array instanceof Uint16Array||ix.array instanceof Uint32Array))throw Error('index');
     const a=ix.array,n=a.length,tri=new Uint32Array(n);
     for(let i=0;i<n;i++){const vtx=a[i];if(vtx>=pos.count)throw Error('index out of range');let k=local.get(vtx);if(k===undefined){k=order.length;local.set(vtx,k);order.push(vtx);}tri[i]=k;}
     add('triangles',n+' '+sha(tri));
    }else{for(let i=0;i<pos.count;i++)order.push(i);add('triangles','none '+pos.count);}
    // The audit always reads x, y and z of a position.
    if(pos.itemSize!==3)throw Error('position item size');
    // getAttribute reads any property of the attributes object, so every one must be a plain, visible, own entry.
    const attrs=g.attributes,attrProto=Object.getPrototypeOf(attrs);if(attrProto!==Object.prototype&&attrProto!==null)throw Error('attributes prototype');
    for(const k of Reflect.ownKeys(attrs)){const d=typeof k==='string'&&Object.getOwnPropertyDescriptor(attrs,k);if(!d||!('value' in d)||!d.enumerable)throw Error('hidden attribute');}
    for(const name of Object.keys(g.attributes).sort()){
     const attr=g.attributes[name];if(!plainAttribute(attr))throw Error('attribute '+name);
     const size=attr.itemSize,out=new Float64Array(order.length*size);
     for(let i=0;i<order.length;i++)for(let c=0;c<size;c++)out[i*size+c]=attr[ACCESSORS[c]](order[i]);
     add('attribute '+name,size+' '+attr.normalized+' '+attr.array.constructor.name+' '+sha(out));
    }
    // The audit trusts the bounding box to find nearby windows, so it must enclose every vertex the audit reads.
    const v=new T.Vector3();for(const i of order)if(!box.containsPoint(v.fromBufferAttribute(pos,i)))throw Error('bounding box does not enclose the mesh');
    add('geometry',stable({groups:g.groups,userData:g.userData,drawRange:g.drawRange}));
    // getMatrixAt reads the raw array.
    if(o.isInstancedMesh){const m=o.instanceMatrix;if(m?.constructor!==T.InstancedBufferAttribute||m.itemSize!==16||!(m.array instanceof Float32Array)||m.array.length<o.count*16)throw Error('instances');add('instances',sha(m.array.slice(0,o.count*16)));}
    // Every window a triangle can reach: the audit searches each instance's world box (and per-triangle boxes inside
    // it); 1 mm of slack covers rounding between a transformed triangle and the transformed box.
    const instances=o.isInstancedMesh?o.count:1,inst=new T.Matrix4(),im=new T.Matrix4();
    for(let i=0;i<instances;i++){
     inst.copy(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(i,im);inst.multiply(im);}
     const near=[...windowCheck.candidates(box.clone().applyMatrix4(inst).expandByScalar(.001))].map(w=>windowIndex.index.get(w)).sort((a,b)=>a-b);
     add('windows '+i,near.map(n=>windowKey(windowCheck.windows[n])).join(','));
    }
    return h.digest('hex');
   }catch{unkeyed++;return null;}
  },
  get(key){const r=saved.get(key);if(r)used.set(key,r);return r||null;},
  put(key,r){used.set(key,JSON.parse(JSON.stringify(r)));},
  stats(){return {saved:saved.size,rejected,kept:used.size,unkeyed};},
  async save(){
   const tmp=file+'.'+process.pid+'.tmp',entries={};for(const [key,result] of used)entries[key]={result,digest:entryDigest(key,result)};
   await fs.writeFile(tmp,JSON.stringify({version:VERSION,globalKey,entries}));await fs.rename(tmp,file);
  }
 };
}
const sha=view=>createHash('sha256').update(new Uint8Array(view.buffer,view.byteOffset,view.byteLength)).digest('hex');
