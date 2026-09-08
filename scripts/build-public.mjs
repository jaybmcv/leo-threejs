import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const source='output/leo-interior-v01',out='dist';
await fs.mkdir(out+'/models',{recursive:true});
const names=['leo-exterior-refined.glb','leo-residential-decks.glb','leo-garden-commons.glb','leo-service-areas.glb','leo-aft-systems.glb','leo-transit.glb','leo-full-ship.glb','leo-neighborhood.glb'];
const manifest={};
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const name of names){
 const b=await fs.readFile(path.join(source,name)),gz=gzipSync(b,{level:9});
 if(hash(gunzipSync(gz))!==hash(b))throw new Error('Model transport changed '+name);
 const parts=[];
 for(let i=0;i<gz.length;i+=16*1024*1024){const part=`models/${name}.${i/(16*1024*1024)}.bin`;await fs.writeFile(path.join(out,part),gz.subarray(i,i+16*1024*1024));parts.push(part);}
 manifest[name]={parts,bytes:b.length,compressedBytes:gz.length,sha256:hash(b)};
 console.log(`${name}: ${(b.length/1048576).toFixed(1)} → ${(gz.length/1048576).toFixed(1)} MB, ${parts.length} part(s)`);
}
let html=await fs.readFile(source+'/index.html','utf8');
html=html.replace('<head>','<head><meta name="description" content="Explore Leo, the Mars Cats Voyage shuttle: 20 decks, 10 neighborhoods, and room for 10,000 travelers. Orbit the ship, inspect rooms, and take an interior tour.">');
// Retain the entire interactive viewer; archive-comparison pages remain local.
html=html.replace(/<a[^>]*href="(?:top-plan-review|comparison)\.html"[^>]*>.*?<\/a>(?:<br>)?/g,'');
html=html.replace('Narrow crown, rounded diamond shoulder, straight side planes. Use the opacity overlay to compare the complete top surfaces.','Explore the exterior, select a deck, or take a guided walk through life aboard Leo.');
html=html.replace('<div class="foot-links">','<div class="foot-links"><button id="share-view" type="button">Copy view link</button>');
html=html.replace('</style>','\n#share-view{font:inherit;color:#ebbd83;background:none;border:0;padding:0;cursor:pointer} @media(max-width:1000px){.tabs{overflow-x:auto;justify-content:flex-start;scrollbar-width:thin}.tabs button{flex-shrink:0}} @media(max-width:680px){.foot-links a{display:none}.foot-links #share-view{display:block}}\n</style>');
html=html.replace('<body>',`<body><script>window.LEO_PUBLIC_ASSETS=${JSON.stringify(manifest)};if(!location.search)history.replaceState(null,'','?camera=concept');</script>`);
await fs.writeFile(out+'/index.html',html);
await fs.writeFile(out+'/asset-manifest.json',JSON.stringify(manifest,null,2));
await fs.writeFile(out+'/README.md',`# LEO · Mars Cats Voyage\n\nAn interactive concept model of a 564 m shuttle for 10,000 travelers.\n\nUse Exterior to orbit the ship; Deck layout to inspect the 20 decks; Neighborhood to explore twin cabins and gardens; Ship areas for shared facilities; Aft systems for engineering and the panoramic fin lounge. Walkthrough follows curated interior routes.\n\nDrag to orbit or look, scroll to zoom, and use Copy view link to share the current scene. Model downloads preserve the complete geometry. Larger models take longer to prepare.\n\nThe interior refinement pass covers all 68 named rooms, service corridors, lifts and stairs, and five aft engineering sections, alongside the furnished cabins, gardens and observation lounges. The second polish pass refines furniture, joinery, instruments and circulation finishes throughout. Decks 6–15 now each have a distinct nose commons: cafe, library, art studio, family commons, music lounge, games club, wellness room, maker studio, communal kitchen and quiet grove. Open Neighborhood → Nose commons and change the deck selector to explore them. They are included in the residential and complete-ship downloads. The fin lounge retains its curved white underside. Passenger and panoramic windows have dark exterior tint and clearer interior faces; view changes preserve the tint.\n\nThis is a spatial design concept, not an engineered spacecraft or a certified occupancy plan.\n\n© Mars Cats Voyage. Three.js license: [THREE-LICENSE.txt](THREE-LICENSE.txt).\n`);
await fs.copyFile(source+'/THREE-LICENSE.txt',out+'/THREE-LICENSE.txt');
const config=JSON.parse((await fs.readFile('.openai/hosting.json','utf8')).replace(/^\uFEFF/,''));config.static={directory:'dist'};await fs.writeFile('.openai/hosting.json',JSON.stringify(config,null,2)+'\n');
console.log('Public viewer ready. All compressed models verified losslessly.');
