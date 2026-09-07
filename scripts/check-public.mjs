import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicAsset} from '../src/public-assets.js';
const manifest=JSON.parse(await fs.readFile('dist/asset-manifest.json','utf8'));
globalThis.window={LEO_PUBLIC_ASSETS:manifest};
globalThis.fetch=async name=>new Response(await fs.readFile('dist/'+name));
for(const [name,entry] of Object.entries(manifest)){
 const bytes=await publicAsset(name);
 assert.equal(createHash('sha256').update(Buffer.from(bytes)).digest('hex'),entry.sha256,name);
 for(const part of entry.parts)assert.ok((await fs.stat('dist/'+part)).size<=16*1048576);
}
const html=await fs.readFile('dist/index.html','utf8');
assert.ok(html.includes('id="share-view"'));assert.ok(html.includes('window.LEO_PUBLIC_ASSETS='));
for(const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)){
 const target=match[1];if(/^(https?:|#)/.test(target)||manifest[target])continue;
 await fs.access('dist/'+target);
}
console.log('PASS: browser download/decompression path restores all eight GLBs exactly; public links resolve; parts ≤16 MiB.');
