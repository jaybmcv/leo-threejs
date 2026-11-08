import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';import{gzipSync,gunzipSync}from'node:zlib';import{buildSync}from'esbuild';
// Each kind of cached result is keyed on the code that computes it: the module below, everything it imports (with the
// .authoring.js variants the offline authoring page uses) and the versions of the packages they import. An edit
// elsewhere, such as to the hull prototypes, leaves these entries warm; entries are also keyed on their own inputs.
const KINDS={windows:'src/v2/chart-cut.js',skin:'src/v2/skin-retirement.js',bvh:'src/walk/collision.js'};
// Cache-policy regions only decide what gets cached, never a result. Line endings differ between checkouts.
const codeText=(f,bytes)=>{let t=bytes.toString('utf8').replace(/\r\n/g,'\n');if(/build-cache(\.authoring)?\.js$/.test(f))t=t.replace(/\/\*cache-policy:start\*\/[\s\S]*?\/\*cache-policy:end\*\//g,'');return t;};
const packageVersion=spec=>{const name=spec.split('/').slice(0,spec.startsWith('@')?2:1).join('/');try{return JSON.parse(fs.readFileSync(path.join('node_modules',name,'package.json'),'utf8')).version;}catch{return null;}};
let kindCodes;
export function cacheKindCodes(){
 if(kindCodes)return kindCodes;kindCodes={};
 for(const [kind,entry]of Object.entries(KINDS))kindCodes[kind]=codeIdentity(entry);
 return kindCodes;
}
// The hash of a module, its whole import closure and the package versions it uses (also keys the retirement workers).
export function codeIdentity(entry){return codeIdentityDetail(entry).hash;}
// The same identity with its parts (each input file's code text hash, each external package's version), so a run
// can say which files changed when a cache keyed on it goes cold.
export function codeIdentityDetail(entry){
  const files=new Set(),packages=new Set();let entries=[entry];
  for(;;){
   const {metafile}=buildSync({entryPoints:entries,bundle:true,write:false,outdir:'unused',platform:'node',format:'esm',packages:'external',external:['v2-layout','walk-partitions','walk-changes'],metafile:true,logLevel:'silent'});
   for(const [f,input]of Object.entries(metafile.inputs)){files.add(f);for(const i of input.imports)if(i.external)packages.add(i.path);}
   const variants=[...files].filter(f=>/\.js$/.test(f)&&!/\.(authoring|prepared|public)\.js$/.test(f)).map(f=>f.slice(0,-3)+'.authoring.js').filter(v=>!files.has(v)&&fs.existsSync(v));
   if(!variants.length)break;entries=[...entries,...variants];
  }
  const h=createHash('sha256'),parts={files:{},packages:{}};for(const f of [...files].sort()){const text=codeText(f,fs.readFileSync(f));h.update(f+'\0').update(text+'\0');parts.files[f]=createHash('sha256').update(text).digest('hex').slice(0,16);}for(const p of [...packages].sort()){const v=packageVersion(p);h.update(p+'@'+v+'\0');parts.packages[p]=v;}
  return {hash:h.digest('hex').slice(0,16),...parts};
}
export function cacheConfiguration({authoring=false}={}){const root=process.cwd(),h=createHash('sha256').update('per-kind code v1');for(const f of ['src/v2/build-cache.js','src/v2/build-cache.authoring.js'])h.update(f).update(codeText(f,fs.readFileSync(f)));const revision=h.digest('hex'),dir=path.join(root,'output/leo-interior-v02/scoped-cache',revision,...(authoring?['authoring']:[]));fs.mkdirSync(dir,{recursive:true});const skin=createHash('sha256').update(fs.readFileSync('output/leo-interior-v02/leo-exterior-web.glb')).digest('hex');return{revision,dir,skin,code:cacheKindCodes(),reuse:process.env.LEO_BUILD_COLD!=='1',files:fs.readdirSync(dir).filter(n=>/^[a-f0-9]{16}[.]json[.]gz$/.test(n))};}
// One output buffer per record: gzip's last four bytes hold the uncompressed size (mod 2^32), and a chunk one byte
// larger keeps zlib from growing its output 16 KB at a time and joining the pieces. Same bytes either way.
const gunzipWhole=gz=>{const n=gz.length>=18?gz.readUInt32LE(gz.length-4):0;return n>0&&n<1<<30?gunzipSync(gz,{chunkSize:Math.max(64,n+1)}):gunzipSync(gz);};
export function installBuildCache(){const config=cacheConfiguration(),stats={hits:0,misses:0,forced:0},loaded=new Map(),forced=(process.env.LEO_SCOPED_FORCE_DECKS||'').split(',').filter(Boolean).map(Number),crosses=(lo,hi)=>forced.some(d=>hi>=-39.7+(d-1)*4-.3&&lo<=-39.7+(d-1)*4+3.75);globalThis.__LEOBuildGeometryCache={skin:config.skin,code:config.code,stats,forceGeometry(o){if(!forced.length)return false;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);return crosses(b.min.y,b.max.y)},forcePositions(a){if(!forced.length)return false;let lo=Infinity,hi=-Infinity;for(let i=1;i<a.length;i+=3){lo=Math.min(lo,a[i]);hi=Math.max(hi,a[i])}return crosses(lo,hi)},get(key){if(!config.reuse)return null;if(loaded.has(key))return loaded.get(key);try{const record=JSON.parse(gunzipWhole(fs.readFileSync(path.join(config.dir,key+'.json.gz'))));loaded.set(key,record);if(loaded.size>128)loaded.delete(loaded.keys().next().value);return record;}catch(e){if(e.code==='ENOENT')return null;throw e;}},put(key,record){const target=path.join(config.dir,key+'.json.gz'),temp=target+'.'+process.pid+'.tmp';fs.writeFileSync(temp,gzipSync(JSON.stringify(record),{level:1}));fs.renameSync(temp,target);},flush(){}};process.on('exit',()=>{const r={...stats,revision:config.revision,scope:process.env.LEO_BUILD_SCOPE||'full',forcedDecks:forced};fs.mkdirSync('output/phase3',{recursive:true});fs.writeFileSync('output/phase3/scoped-cache-raw-last.json',JSON.stringify(r,null,2));console.log('Scoped geometry cache '+JSON.stringify(r));});return config;}
