import fs from 'node:fs/promises';
export const CACHE_RECORD_LIMIT=8*1024*1024;
// Keep the compressed bytes in Node; only bounded records reach the renderer.
export async function boundedCacheRecord(file){const data=await fs.readFile(file);if(data.length<18)throw Error('Truncated authoring cache record');return data.readUInt32LE(data.length-4)>CACHE_RECORD_LIMIT?null:data;}
