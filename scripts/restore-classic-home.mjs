import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const hash=b=>createHash('sha256').update(b).digest('hex');

// Retain the complete inspector's visual shell with the current walk's manifest.
// No legacy GLBs or second procedural reconstruction of the interior.
export async function restoreClassicHome(out) {
  const manifest=JSON.parse(await fs.readFile(path.join(out,'asset-manifest.json'),'utf8'));
  const home=await fs.readFile(path.join(out,'index.html'),'utf8');
  if(home.includes('LEO_V2_BOOT'))await fs.writeFile(path.join(out,'layout2.html'),home);
  const layoutPage=await fs.readFile(path.join(out,'layout2.html'),'utf8');
  const layoutFile=layoutPage.match(/window.LEO_VIEWER_LAYOUT=([^;]+);/)?.[1];
  if(!layoutFile)throw Error('The current viewer layout is missing');
  const layout=JSON.parse(await fs.readFile(path.join(out,JSON.parse(layoutFile)),'utf8'));
  if(layout.version!==2||!manifest['leo-full-ship.glb']?.sha256)throw Error('Expected the current published model');
  const result=await build({entryPoints:['src/v2/inspector.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false});
  const code=result.outputFiles[0].contents,script='inspector.'+hash(code).slice(0,10)+'.js';await fs.writeFile(path.join(out,script),code);
  let html=await fs.readFile('src/viewer.html','utf8');
  const field=(label,id)=>`<label class="field">${label}<select id="${id}"></select></label>`;
  const check=(id,label,checked=false)=>`<label class="check"><input type="checkbox" id="${id}" ${checked?'checked':''}>${label}</label>`;
  const panels=`<div id="layout-controls" hidden>${field('Inspect a deck','deck-select')}${check('isolate','Isolate selected deck',true)}${check('shell-context','Show hull context')}<div class="numbers"><div><strong id="deck-cabins"></strong><span>cabins</span></div><div><strong id="deck-berths"></strong><span>sleeping berths</span></div></div><p class="small" id="deck-description"></p><a class="action" href="leo-residential-decks.glb" download>Residential decks GLB ↓</a></div>
  <div id="neighborhood-controls" hidden>${field('Choose a neighborhood','neighborhood-select')}<div class="numbers"><div><strong id="neighborhood-cabins"></strong><span>cabins</span></div><div><strong id="neighborhood-berths"></strong><span>berths</span></div></div>${check('detail-walls','Show walls & ceilings')}<div class="choice">${[['all','Overview'],['cabin','Cabin'],['nose','Dining'],['garden','Garden'],['observation','Observation']].map(([key,label])=>`<button data-focus="${key}">${label}</button>`).join('')}</div><a id="enter-space" class="action" href="walk.html">Walk in this space ↗</a><p class="small">The current cabins, gardens and shared spaces. Choose a neighborhood to inspect its updated layout.</p></div>
  <div id="areas-controls" hidden>${field('Choose an area','area-select')}<div class="numbers"><div><strong id="area-deck"></strong><span>deck</span></div><div><strong id="area-count"></strong><span>room areas</span></div></div><div class="choice"><button data-area-view="overview">Room overview</button><button data-area-view="inside">Eye-level view</button></div><p class="small" id="area-description"></p><button id="locate-area" class="action">Locate on deck</button></div>
  <div id="aft-controls" hidden><label class="field">Inspect the aft section<select id="aft-section"><option value="all">All aft systems</option><option value="pods">Engine pods</option><option value="crown">Fin and crown lounge</option></select></label>${check('aft-shell','Show exterior context',true)}<a class="action" href="leo-aft-systems.glb" download>Aft systems GLB ↓</a></div>
  <div id="transit-controls" hidden><label class="field">Connection<select id="transit-core"><option value="forward">Forward lifts & stairs</option><option value="aft">Aft lifts & stairs</option></select></label>${field('Deck','transit-deck')}<p class="small">Inspect the current lift lobbies and stair connections.</p><a class="action" href="leo-transit.glb" download>Connections GLB ↓</a></div>
  <div id="walk-controls" hidden><label class="field">Choose a journey<select id="tour-select"><option value="ROUTE">Life aboard LEO</option><option value="LOUNGE_TOUR">Gardens & observation lounge</option><option value="ATRIUM_TOUR">Atrium fly-through</option></select></label><div class="numbers"><div><strong id="stop-count"></strong><span>route stop</span></div></div><button id="restart-tour" class="action">Restart route</button><a id="tour-walk" class="action" href="walk.html">Walk at this stop ↗</a></div>
  `;
  html=html.slice(0,html.indexOf('<div id="layout-controls"'))+panels+html.slice(html.indexOf('<p class="small concept-note">'));
  html=html.replace(/<label class="check studio-only"><input type="checkbox" id="shape-only">Shape only<\/label>/,'');
  html=html.replace(/<p class="small" id="render-status"[^>]*>.*?<\/p>/,'<p class="small" id="render-status">Current viewport · selected camera</p>');
  html=html.replace(/<a class="action" style="margin:0 0 8px" href="top-plan-review.html"[\s\S]*?<p class="small">Narrow crown[\s\S]*?<\/p>/,'');
  html=html.replace('id="save-interior" class="action" hidden','id="save-interior" class="action"');
  html=html.replace('<a href="README.md">Notes ↗</a>','<a href="hub.html">Builder’s Hub ↗</a>');
  html=html.replace('Neighborhood 10 GLB ↓','Furnished Deck 15 GLB ↓');
  html=html.replace('</style>','body.panels-hidden .panel,body.panels-hidden .intro,body.panels-hidden .stamp{display:none} #enter-space,#tour-walk{display:inline-block;margin-top:12px}</style>');
  html=html.replace('<script>/* BUNDLE */</script>',`<script>window.LEO_PUBLIC_ASSETS=${JSON.stringify(manifest).replaceAll('<','\\u003c')};window.LEO_VIEWER_LAYOUT=${layoutFile};LEO_BOOT("${script}");</script>`);
  await fs.writeFile(path.join(out,'index.html'),html);
  const provenance={viewer:'classic-current-model',layout:2,indexSha256:hash(html),script,modelSha256:manifest['leo-full-ship.glb'].sha256,exteriorSha256:manifest['leo-exterior-web.glb'].sha256,stats:layout.stats,walk:'layout 2',layout2Viewer:'layout2.html'};
  await fs.writeFile(path.join(out,'viewer-version.json'),JSON.stringify(provenance,null,2)+'\n');
  return provenance;
}
