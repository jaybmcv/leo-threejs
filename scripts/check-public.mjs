import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicAsset} from '../src/public-assets.js';
const manifest=JSON.parse(await fs.readFile('dist/asset-manifest.json','utf8'));
assert.ok(manifest['leo-exterior-web.glb']?.compressedBytes<manifest['leo-exterior-refined.glb'].compressedBytes/2,'the streamed exterior must be the compressed web copy');
globalThis.window={LEO_PUBLIC_ASSETS:manifest};
globalThis.fetch=async name=>new Response(await fs.readFile('dist/'+name.split('?')[0]));
for(const [name,entry] of Object.entries(manifest)){
 const bytes=await publicAsset(name);
 assert.equal(createHash('sha256').update(Buffer.from(bytes)).digest('hex'),entry.sha256,name);
 for(const part of entry.parts)assert.ok((await fs.stat('dist/'+part.split('?')[0])).size<=16*1048576);
}
// The Builder's Hub reads which commit the site was built from: a full commit, or null when the build was of changed files.
const info=JSON.parse(await fs.readFile('dist/build.json','utf8'));assert.ok(info.sha===null||/^[0-9a-f]{40}$/.test(info.sha),'build.json names a commit');
const html=await fs.readFile('dist/index.html','utf8');
assert.ok(html.includes('id="share-view"'));
const viewerScript=html.match(/<script>LEO_BOOT\("(viewer\.[0-9a-f]{10}\.js)"\)<\/script>/)?.[1];assert.ok(viewerScript,'index.html loads the hashed viewer script');
const viewerCode=await fs.readFile('dist/'+viewerScript,'utf8'),cosmoScript=viewerCode.match(/cosmo\.[0-9a-f]{10}\.js/)?.[0];
assert.ok(cosmoScript&&(await fs.stat('dist/'+cosmoScript)).size>2e5,'the viewer names a shipped hashed Cosmo');assert.ok(!html.includes('createDLCat')&&!viewerCode.includes('createDLCat'),'Cosmo must stay in its own file');
for(const name of ['mark.png','share.jpg','archivo.woff2','jetbrains.woff2','sora.woff2']){assert.ok(html.includes('brand/'+name),name);await fs.access('dist/brand/'+name);}
// Tour artwork is loaded by the bundled viewer script rather than named in the HTML; it only has to ship.
for(const name of ['environment.png','art-anniversary.jpg','art-astronaut-cat.jpg','art-close-encounter.jpg','art-crew.jpg','art-launch.jpg','art-mars-cats.jpg','art-spacesuit-cat.jpg'])await fs.access('dist/brand/'+name);assert.ok(html.includes('window.LEO_PUBLIC_ASSETS='));
for(const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)){
 const target=match[1];if(/^(https?:|#)/.test(target)||manifest[target])continue;
 await fs.access('dist/'+target);
}
// Walk around Leo: its own page and hashed script, loading the viewer's Cosmo file and the same models.
const walkHtml=await fs.readFile('dist/walk.html','utf8'),walkScript=walkHtml.match(/<script>LEO_WALK_BOOT\("(walk\.[0-9a-f]{10}\.js)"\)<\/script>/)?.[1];
assert.ok(walkScript&&html.includes('href="walk.html"'),'the viewer links a walk page with a hashed script');
const walkCode=await fs.readFile('dist/'+walkScript,'utf8');
assert.ok(walkCode.includes(cosmoScript)&&!walkCode.includes('createDLCat('),'the walk page loads the shared Cosmo file');
assert.ok(walkHtml.includes('window.LEO_PUBLIC_ASSETS=')&&walkHtml.includes('brand/archivo.woff2'),'the walk page streams the public models');
// Cosmo's emote clips and the ship map ship as hashed files the walk script names.
for(const [stem,ext] of [['walk-emotes','json'],['walk-map','png']]){const name=walkCode.match(new RegExp(String.raw`${stem}\.[0-9a-f]{10}\.${ext}`))?.[0];assert.ok(name,`the walk script names its ${stem} file`);await fs.access('dist/'+name);}
console.log('PASS: browser download/decompression path restores all eight GLBs exactly; public links resolve; parts ≤16 MiB.');
