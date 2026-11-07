// The public reader decodes the phone ship part by part (src/v2/prepared-codec.public.js): every decoded array must match
// its SHA-256 in the manifest, as when all parts were unpacked first. Prints the process's peak memory, to compare.
// node scripts/check-prepared-streaming.mjs <prepared-walk-phone dir> [metadata file, default world.bin]
import fs from 'node:fs/promises';import path from 'node:path';
const [dir,meta='world.bin']=process.argv.slice(2);
if(!dir)throw Error('usage: check-prepared-streaming.mjs <dir> [metadata]');
globalThis.requestAnimationFrame??=f=>setTimeout(f,0);
const {readPreparedWorld}=await import('../src/v2/prepared-codec.public.js');
const lines=[];const t0=Date.now();
const loaded=await readPreparedWorld(new URL('file:///'+path.resolve(dir).split(path.sep).join('/')+'/'),{status:s=>lines.push(s),skipImages:true,verifyArrays:true,metadataName:meta,
 fetchBytes:async name=>{const b=await fs.readFile(path.join(dir,name));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
const rooms=lines.filter(l=>l.startsWith('Loading prepared rooms… '));
if(rooms.at(-1)!=='Loading prepared rooms… 100%')throw Error('progress ended at '+rooms.at(-1));
console.log('PASS every decoded array matches its SHA-256;',loaded.manifest.arrays.length,'arrays,',rooms.length,'progress steps,',Math.round((Date.now()-t0)/1000),'s; peak RSS',Math.round(process.resourceUsage().maxRSS/1024),'MB');
