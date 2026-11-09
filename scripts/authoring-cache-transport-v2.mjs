import fs from 'node:fs/promises';
import path from 'node:path';
export const CACHE_RECORD_LIMIT=8*1024*1024;
// Keep the compressed bytes in Node; only bounded records reach the renderer.
const bounded=data=>{if(data.length<18)throw Error('Truncated authoring cache record');return data.readUInt32LE(data.length-4)>CACHE_RECORD_LIMIT?null:data;};
export async function boundedCacheRecord(file){return bounded(await fs.readFile(file));}
// The packed store (cache-transport-pack-v2.mjs) read into memory once. Its records lie in name order, so the page's
// reads, in build order, were each a small random read of the file (about 140 us). A record is served from memory
// exactly when the packed transport (cache-transport-loader-v2.mjs) would serve it from the file: same entry, same file
// size and modification time, same range checks. Anything else (not packed, changed, missing, a store over 1 GiB or
// not well formed) reads through boundedCacheRecord as before. The check is an asynchronous stat, so a caller can start
// many at once (build-prepared-walk-v2.mjs does, per batch).
export function packedCacheRecords(base){
 const store=(async()=>{try{const meta=JSON.parse(await fs.readFile(base+'.json','utf8'));if(meta?.version!==1||!Number.isSafeInteger(meta.bytes)||meta.bytes<0||!meta.entries||typeof meta.entries!=='object'||Array.isArray(meta.entries))return null;
  const size=(await fs.stat(base+'.bin')).size;if(size<meta.bytes||size>2**30)return null;const bin=await fs.readFile(base+'.bin');return bin.length>=meta.bytes?{entries:meta.entries,bin,bytes:meta.bytes}:null;}catch{return null;}})();
 return async file=>{const s=await store,name=path.basename(file),row=s&&/^[a-f0-9]{16}[.]json[.]gz$/.test(name)&&Object.hasOwn(s.entries,name.slice(0,16))?s.entries[name.slice(0,16)]:null;
  if(!Array.isArray(row))return boundedCacheRecord(file);let stat;try{stat=await fs.stat(file);}catch{return boundedCacheRecord(file);}
  if(stat.size!==row[1]||stat.mtimeMs!==row[2]||!Number.isSafeInteger(row[0])||!Number.isSafeInteger(row[1])||row[0]<0||row[1]<0||row[0]+row[1]>s.bytes)return boundedCacheRecord(file);
  return bounded(s.bin.subarray(row[0],row[0]+row[1]));};
}
