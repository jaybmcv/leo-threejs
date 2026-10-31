import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {planWalk} from './walk-plan.mjs';
import {v2} from './layout-selector.mjs';
import {v2Plugin} from './v2-plugin.mjs';
import {PAINTINGS} from '../src/walk/paintings.js';
import {COMICS} from '../src/walk/comics.js';
import {MUDWATER_ART} from '../src/walk/mudwater.js';
import {shipLog} from './ship-log.mjs';
import {loadMedia} from './ship-log-media.mjs';

// Writes the "Walk around Leo" page (walk.html) and its content-hashed script next to the viewer. The partition plan
// (src/walk/partitions.js) is worked out here, from the same ship the page builds, and bundled as data, so visitors
// don't spend seconds rasterizing deck plans. Cosmo comes from the viewer's own hashed cosmo script; his emote clips
// are a hashed file of their own, fetched the first time one plays.
// LEO_LIVE_URL, when set, is the Leo live server the page joins (wss://.../live; server/leo-live.mjs); without it the walk
// is solo. The walk's paintings (src/walk/paintings.js) and comic pages (src/walk/comics.js) are hashed files of their own,
// fetched when a walker comes near or opens the book.
const WALK_SCRIPT=/^walk(-emotes|-map|-hat|-art-[a-z0-9-]+|-reel)?\.[0-9a-f]{10}\.(js|json|png|glb|jpg|mp4)$/;
const WALK_LOGO=/^hydro-nip-main-logo\.[0-9a-f]{10}\.jpg$/;
const hashed=(stem,ext,data)=>`${stem}.${createHash('sha256').update(data).digest('hex').slice(0,10)}.${ext}`;
export async function writeWalkPage(out,{cosmo,manifest,debug=false,layoutOverride=null,walkOverride=null,sourceRef=null,sourceAdapters=undefined,profileMap=false,authoringWalk=false,preparedWalk=false,logMedia=undefined}){
 for(const name of await fs.readdir(out))if(WALK_SCRIPT.test(name)||WALK_LOGO.test(name)||v2&&/^layout\.[0-9a-f]{16}\.\d+\.bin$/.test(name))await fs.rm(path.join(out,name));
 const logo=await fs.readFile('src/walk/assets/hydro-nip-main-logo.jpg'),logoName=hashed('hydro-nip-main-logo','jpg',logo);
 await fs.writeFile(path.join(out,logoName),logo);
 const emotes=await fs.readFile('src/walk/assets/cosmo-emotes.json'),emoteName=hashed('walk-emotes','json',emotes);
 await fs.writeFile(path.join(out,emoteName),emotes);
 // The captain's hat that testers wear (src/walk/hat.js, src/vendor/captain-hat), fetched the first time one is wanted.
 const hat=await fs.readFile('src/vendor/captain-hat/captains-hat.glb'),hatName=hashed('walk-hat','glb',hat);
 await fs.writeFile(path.join(out,hatName),hat);
 const art={};
 for(const file of [...PAINTINGS.map(p=>p.file),...COMICS.flatMap(c=>c.pages),...MUDWATER_ART]){const data=await fs.readFile('src/walk/art/'+file),name=hashed('walk-art-'+path.parse(file).name,path.extname(file).slice(1),data);await fs.writeFile(path.join(out,name),data);art[file]=name;}
 // The theatre screen's muted film loop (src/walk/theatre.js), fetched when a walker comes near.
 const reel=await fs.readFile('src/walk/art/theatre-loop.mp4'),reelName=hashed('walk-reel','mp4',reel);
 await fs.writeFile(path.join(out,reelName),reel);
 const walk=walkOverride||(v2?{plan:JSON.parse(await fs.readFile('output/leo-interior-v02/walk-plan.json','utf8')),map:await fs.readFile('output/leo-interior-v02/walk-map.png')}:await planWalk()),plan=JSON.stringify(walk.plan),mapName=hashed('walk-map','png',walk.map);
 await fs.writeFile(path.join(out,mapName),walk.map);
 // The ship log boards' list of changes (src/walk/changes-board.js), from git: scripts/ship-log.mjs.
 const suppliedMedia=logMedia||(v2?await(await import('./v2-ship-log-media.mjs')).v2ShipLogMedia():undefined);
 const {media,from}=suppliedMedia||loadMedia(),log=shipLog(process.cwd(),media);
 console.log(`ship log: ${log.length} changes, ${log.filter(e=>e.shots).length} with before-and-after pictures (from ${from})`);
 const data={'walk-partitions':plan,'walk-changes':JSON.stringify(log)};
 const partitions={name:'walk-data',setup(b){b.onResolve({filter:/^walk-(partitions|changes)$/},a=>({path:a.path,namespace:'walk'}));b.onLoad({filter:/.*/,namespace:'walk'},a=>({contents:data[a.path],loader:'json'}));}};
 const result=await build({...profileMap?{sourcemap:'external',outfile:'walk.js'}:{},entryPoints:['src/walk/main.js'],bundle:true,minify:true,format:'esm',write:false,target:'es2022',legalComments:'eof',define:{__PREPARED_META__:JSON.stringify(manifest['walk-prepared']?.metadataFile||'world.json.gz'),__PREPARED_URL__:JSON.stringify((debug?'/base/':'./')+(manifest['walk-prepared']?.directory||'prepared-walk/')),__COSMO_SCRIPT__:JSON.stringify(cosmo),__HYDRO_NIP_MAIN_LOGO__:JSON.stringify(logoName),__EMOTES_URL__:JSON.stringify(emoteName),__MAP_URL__:JSON.stringify(mapName),__HAT_URL__:JSON.stringify(hatName),__ART_URLS__:JSON.stringify(art),__REEL_URL__:JSON.stringify(reelName),__LIVE_URL__:JSON.stringify(v2?'':process.env.LEO_LIVE_URL||''),__CREAMERY_URL__:JSON.stringify(process.env.LEO_CREAMERY_URL||'https://creamery.marscatsvoyage.com'),__WALK_DEBUG__:String(debug)},plugins:[partitions,...(v2?[v2Plugin(layoutOverride||JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8')),{sourceRef,preparedWalk,authoringWalk,...(sourceAdapters?{sourceAdapters}:{}),dataDirectory:out})]:[])]});
 const code=(result.outputFiles.find(f=>f.path.endsWith('.js'))||result.outputFiles[0]).text;
 if(code.includes('createDLCat('))throw new Error('The walk script must load Cosmo from its own file');
 if(!debug&&(code.includes('__walk')||code.includes('anchorTest')))throw new Error('The walk debug hook must not ship');
 const name=hashed('walk','js',code);if(profileMap){await fs.mkdir('output/phase3b/startup/maps',{recursive:true});await fs.writeFile('output/phase3b/startup/maps/'+name+'.map',result.outputFiles.find(f=>f.path.endsWith('.map')).contents);}await fs.writeFile(path.join(out,name),code);
 let html=(await fs.readFile('src/walk/walk.html','utf8')).replace('<script>/* BUNDLE */</script>',()=>`<script>LEO_WALK_BOOT("${name}")</script>`);
 if(html.includes('/* BUNDLE */'))throw new Error('walk.html lost its bundle placeholder');
 html=html.replace('<body>',()=>`<body><script>window.LEO_PUBLIC_ASSETS=${JSON.stringify(manifest)};</script>`);
 await fs.writeFile(path.join(out,'walk.html'),html);
 return {walk:name,emotes:emoteName,map:mapName,bytes:code.length,...(v2?{corpus:{from,mediaSha256:createHash('sha256').update(JSON.stringify(media)).digest('hex'),mediaPRs:Object.keys(media).length,entries:log.length,queries:log.reduce((n,e)=>n+(e.go?1:0)+(e.shots||[]).filter(s=>s.at).length,0),provenance:suppliedMedia?.provenance||null}}:{})};
}
