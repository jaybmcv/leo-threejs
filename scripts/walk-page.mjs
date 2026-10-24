import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {planWalk} from './walk-plan.mjs';
import {PAINTINGS} from '../src/walk/paintings.js';
import {COMICS} from '../src/walk/comics.js';
import {shipLog} from './ship-log.mjs';

// Writes the "Walk around Leo" page (walk.html) and its content-hashed script next to the viewer. The partition plan
// (src/walk/partitions.js) is worked out here, from the same ship the page builds, and bundled as data, so visitors
// don't spend seconds rasterizing deck plans. Cosmo comes from the viewer's own hashed cosmo script; his emote clips
// are a hashed file of their own, fetched the first time one plays.
// LEO_LIVE_URL, when set, is the Leo live server the page joins (wss://.../live; server/leo-live.mjs); without it the walk
// is solo. The walk's paintings (src/walk/paintings.js) and comic pages (src/walk/comics.js) are hashed files of their own,
// fetched when a walker comes near or opens the book.
const WALK_SCRIPT=/^walk(-emotes|-map|-hat|-art-[a-z0-9-]+|-reel)?\.[0-9a-f]{10}\.(js|json|png|glb|jpg|mp4)$/;
const hashed=(stem,ext,data)=>`${stem}.${createHash('sha256').update(data).digest('hex').slice(0,10)}.${ext}`;
export async function writeWalkPage(out,{cosmo,manifest}){
 for(const name of await fs.readdir(out))if(WALK_SCRIPT.test(name))await fs.rm(path.join(out,name));
 const emotes=await fs.readFile('src/walk/assets/cosmo-emotes.json'),emoteName=hashed('walk-emotes','json',emotes);
 await fs.writeFile(path.join(out,emoteName),emotes);
 // The captain's hat that testers wear (src/walk/hat.js, src/vendor/captain-hat), fetched the first time one is wanted.
 const hat=await fs.readFile('src/vendor/captain-hat/captains-hat.glb'),hatName=hashed('walk-hat','glb',hat);
 await fs.writeFile(path.join(out,hatName),hat);
 const art={};
 for(const file of [...PAINTINGS.map(p=>p.file),...COMICS.flatMap(c=>c.pages)]){const data=await fs.readFile('src/walk/art/'+file),name=hashed('walk-art-'+path.parse(file).name,'jpg',data);await fs.writeFile(path.join(out,name),data);art[file]=name;}
 // The theatre screen's muted film loop (src/walk/theatre.js), fetched when a walker comes near.
 const reel=await fs.readFile('src/walk/art/theatre-loop.mp4'),reelName=hashed('walk-reel','mp4',reel);
 await fs.writeFile(path.join(out,reelName),reel);
 const walk=await planWalk(),plan=JSON.stringify(walk.plan),mapName=hashed('walk-map','png',walk.map);
 await fs.writeFile(path.join(out,mapName),walk.map);
 // The ship log boards' list of changes (src/walk/changes-board.js), from git: scripts/ship-log.mjs.
 const data={'walk-partitions':plan,'walk-changes':JSON.stringify(shipLog())};
 const partitions={name:'walk-data',setup(b){b.onResolve({filter:/^walk-(partitions|changes)$/},a=>({path:a.path,namespace:'walk'}));b.onLoad({filter:/.*/,namespace:'walk'},a=>({contents:data[a.path],loader:'json'}));}};
 const result=await build({entryPoints:['src/walk/main.js'],bundle:true,minify:true,format:'esm',write:false,target:'es2022',legalComments:'eof',define:{__COSMO_SCRIPT__:JSON.stringify(cosmo),__EMOTES_URL__:JSON.stringify(emoteName),__MAP_URL__:JSON.stringify(mapName),__HAT_URL__:JSON.stringify(hatName),__ART_URLS__:JSON.stringify(art),__REEL_URL__:JSON.stringify(reelName),__LIVE_URL__:JSON.stringify(process.env.LEO_LIVE_URL||''),__CREAMERY_URL__:JSON.stringify(process.env.LEO_CREAMERY_URL||'https://creamery.marscatsvoyage.com'),__WALK_DEBUG__:'false'},plugins:[partitions]});
 const code=result.outputFiles[0].text;
 if(code.includes('createDLCat('))throw new Error('The walk script must load Cosmo from its own file');
 if(code.includes('__walk'))throw new Error('The walk debug hook must not ship');
 const name=hashed('walk','js',code);await fs.writeFile(path.join(out,name),code);
 let html=(await fs.readFile('src/walk/walk.html','utf8')).replace('<script>/* BUNDLE */</script>',()=>`<script>LEO_WALK_BOOT("${name}")</script>`);
 if(html.includes('/* BUNDLE */'))throw new Error('walk.html lost its bundle placeholder');
 html=html.replace('<body>',()=>`<body><script>window.LEO_PUBLIC_ASSETS=${JSON.stringify(manifest)};</script>`);
 await fs.writeFile(path.join(out,'walk.html'),html);
 return {walk:name,emotes:emoteName,map:mapName,bytes:code.length};
}
