// The prepared walk in sections (scripts/prepared-sections-v2.mjs). sections.json lists the files: one per array used by
// more than one section (the ship's vertex pools and position dictionaries), the core, its images, then one per render
// band group (by lowest deck), per collision deck (static and ground) and per template module. Each file is
// [u32 JSON length][fragment JSON][padding to 4][payload]: the artifact's own encoded array bytes, unchanged.
// mergePreparedSections puts the fragments back into the whole-ship manifest readPreparedWorld decodes: each payload is
// one transport part, which array records address by {part, offset}. In a fragment, an array is its local number or,
// when shared, the string key of its shared file.
export const SECTIONS_FORMAT='leo-prepared-sections-v1';
export const SECTION_FILE=/^(?:[.][.]\/sections\/)?s-[0-9a-f]{20}(?:-\d+)?[.]bin$/;

export function splitSectionFile(bytes){
 const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),length=new DataView(view.buffer,view.byteOffset,view.byteLength).getUint32(0,true);
 if(length<=0||4+length>view.length)throw Error('Invalid prepared section file');
 const fragment=JSON.parse(new TextDecoder().decode(view.subarray(4,4+length)));if(fragment.format!==SECTIONS_FORMAT)throw Error('Unknown prepared section format');
 const start=Math.ceil((4+length)/4)*4;return {fragment,payload:view.subarray(start)};
}

export function validSectionsIndex(index){
 const entry=e=>e&&typeof e.id==='string'&&Number.isSafeInteger(e.bytes)&&e.bytes>0&&e.bytes<=512*1024*1024&&/^[0-9a-f]{64}$/.test(e.sha256)&&Array.isArray(e.files)&&e.files.length>0&&e.files.length<=16&&e.files.every(f=>SECTION_FILE.test(f.name)&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&f.bytes<=16*1024*1024&&/^[0-9a-f]{64}$/.test(f.sha256));
 const list=k=>Array.isArray(index?.order?.[k]);
 if(index?.format!==SECTIONS_FORMAT||!Array.isArray(index.sections)||index.sections.length<2||index.sections.length>4096||!index.sections.every(entry)||!['bands','colliderBands','groundBands'].every(list))throw Error('Invalid prepared sections index');
 return index;
}

const relocator=(shared,a)=>x=>{if(typeof x==='string'){const id=shared.get(x);if(id===undefined)throw Error('Missing shared prepared array '+x);return id;}return x+a;};
const relocate=(v,to)=>{if(!v||typeof v!=='object')return v;if(Array.isArray(v))return v.map(x=>relocate(x,to));const out={};for(const [k,x]of Object.entries(v))out[k]=k==='$array'?to(x):relocate(x,to);return out;};

// Fragments in index order: shared arrays, core, images, then sections.
export function mergePreparedSections(fragments,order){
 const arrays=[],geometries=[],shared=new Map(),bands=new Map(),colliderBands=new Map(),groundBands=new Map(),templates=[];let manifest=null,images=null;
 // Shared arrays lead, one per file, so a dictionary can follow the arrays that use it.
 fragments.forEach((f,i)=>{if(f.shared===undefined)return;if(i!==shared.size||shared.has(f.shared)||f.arrays.length!==1||f.geometries?.length)throw Error('Invalid shared prepared array');shared.set(f.shared,i);});
 fragments.forEach((f,part)=>{
  const to=relocator(shared,arrays.length),g=geometries.length;
  for(const r of f.arrays){const {start,...rest}=r;arrays.push({...rest,part,offset:start,...(r.dictionary===undefined?{}:{dictionary:to(r.dictionary)})});}
  for(const r of f.geometries||[])geometries.push({...r,attributes:Object.fromEntries(Object.entries(r.attributes).map(([k,x])=>[k,{...x,array:to(x.array)}])),index:r.index===null?null:to(r.index),userData:relocate(r.userData,to)});
  const graph=data=>({...data,nodes:data.nodes.map(n=>({...n,...(n.geometry===undefined?{}:{geometry:n.geometry+g}),...(n.instanceMatrix===undefined?{}:{instanceMatrix:to(n.instanceMatrix)}),...(n.instanceColor==null?{}:{instanceColor:to(n.instanceColor)}),userData:relocate(n.userData,to)}))});
  const bvh=r=>({...r,geometry:r.geometry+g,roots:r.roots.map(to),index:r.index===null?null:to(r.index),indirect:r.indirect===null?null:to(r.indirect),...(r.windowFlags==null?{}:{windowFlags:to(r.windowFlags)})});
  if(f.manifest){if(manifest)throw Error('Two prepared cores');const {graphs,colliders,arrayKeys,...rest}=f.manifest;manifest=rest;for(const k of graphs)manifest[k]=graph(f.manifest[k]);
   const col=c=>({...c,groups:c.groups.map(x=>({...x,bvh:bvh(x.bvh)})),movers:c.movers.map(x=>({...x,bvh:bvh(x.bvh)})),ground:c.ground?col(c.ground):null});manifest.colliders=col(colliders);
   for(const k of arrayKeys)manifest[k]=relocate(manifest[k],to);}
  if(f.images)images=f.images;
  for(const [key,data]of f.bands||[])bands.set(key,graph(data));
  for(const [key,r]of f.colliderBands||[])colliderBands.set(key,bvh(r));
  for(const [key,r]of f.groundBands||[])groundBands.set(key,bvh(r));
  for(const [key,id]of f.templates||[])templates.push([key,id+g]);
 });
 if(!manifest||!images)throw Error('Prepared sections without a core');
 // The index keeps the whole ship's insertion order (scene and collider Maps follow it); a key missing on either side is
 // a broken publish, never repaired here.
 const ordered=(keys,map)=>{if(new Set(keys).size!==keys.length||keys.length!==map.size||keys.some(k=>!map.has(k)))throw Error('Prepared sections disagree with their order');return keys.map(k=>[k,map.get(k)]);};
 Object.assign(manifest,{arrays,geometries,images,bands:ordered(order.bands,bands),geometryTemplates:templates});
 manifest.colliders.bands=ordered(order.colliderBands,colliderBands);
 if(manifest.colliders.ground)manifest.colliders.ground.bands=ordered(order.groundBands,groundBands);else ordered(order.groundBands,groundBands);
 return manifest;
}

// The browser and Node read the same way: the index, then every file (six at a time), each checked against the index
// before it is decompressed. Parts come back in index order with their payloads.
export async function loadPreparedSections(fetchBytes,name,inflate,{status=()=>{},sha256}={}){
 const index=validSectionsIndex(JSON.parse(new TextDecoder().decode(await fetchBytes(name)))),base=name.slice(0,name.lastIndexOf('/')+1),entries=index.sections,fragments=new Array(entries.length),parts=new Array(entries.length);let next=0,done=0;
 const one=async i=>{const e=entries[i],chunks=[];let length=0;
  for(const f of e.files){const b=new Uint8Array(await fetchBytes(base+f.name));if(b.length!==f.bytes||(sha256&&await sha256(b)!==f.sha256))throw Error('Prepared section file integrity failed: '+f.name);chunks.push(b);length+=b.length;}
  let joined=chunks[0];if(chunks.length>1){joined=new Uint8Array(length);let at=0;for(const c of chunks){joined.set(c,at);at+=c.length;}}
  const file=await inflate(joined);if(file.length!==e.bytes)throw Error('Prepared section length mismatch: '+e.id);
  let {fragment,payload}=splitSectionFile(file);
  // A large JSON head would otherwise stay alive behind the payload view until release.
  if(file.length-payload.length>payload.length)payload=payload.slice();
  fragments[i]=fragment;parts[i]=payload;done++;status('Loading prepared rooms… '+Math.round(done/entries.length*100)+'%');};
 await Promise.all(Array.from({length:Math.min(6,entries.length)},async()=>{while(next<entries.length)await one(next++);}));
 const manifest=mergePreparedSections(fragments,index.order);if(index.fastPatch)manifest.fastPatch=index.fastPatch;return {index,manifest,parts};
}
