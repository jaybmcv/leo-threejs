import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {planWalk} from './walk-plan.mjs';

// Writes the "Walk around Leo" page (walk.html) and its content-hashed script next to the viewer. The partition plan
// (src/walk/partitions.js) is worked out here, from the same ship the page builds, and bundled as data, so visitors
// don't spend seconds rasterizing deck plans. Cosmo comes from the viewer's own hashed cosmo script; his emote clips
// are a hashed file of their own, fetched the first time one plays.
const WALK_SCRIPT=/^walk(-emotes|-map)?\.[0-9a-f]{10}\.(js|json|png)$/;
const hashed=(stem,ext,data)=>`${stem}.${createHash('sha256').update(data).digest('hex').slice(0,10)}.${ext}`;
export async function writeWalkPage(out,{cosmo,manifest}){
 for(const name of await fs.readdir(out))if(WALK_SCRIPT.test(name))await fs.rm(path.join(out,name));
 const emotes=await fs.readFile('src/walk/assets/cosmo-emotes.json'),emoteName=hashed('walk-emotes','json',emotes);
 await fs.writeFile(path.join(out,emoteName),emotes);
 const walk=await planWalk(),plan=JSON.stringify(walk.plan),mapName=hashed('walk-map','png',walk.map);
 await fs.writeFile(path.join(out,mapName),walk.map);
 const partitions={name:'walk-partitions',setup(b){b.onResolve({filter:/^walk-partitions$/},()=>({path:'walk-partitions',namespace:'walk'}));b.onLoad({filter:/.*/,namespace:'walk'},()=>({contents:plan,loader:'json'}));}};
 const result=await build({entryPoints:['src/walk/main.js'],bundle:true,minify:true,format:'esm',write:false,target:'es2022',legalComments:'eof',define:{__COSMO_SCRIPT__:JSON.stringify(cosmo),__EMOTES_URL__:JSON.stringify(emoteName),__MAP_URL__:JSON.stringify(mapName),__WALK_DEBUG__:'false'},plugins:[partitions]});
 const code=result.outputFiles[0].text;
 if(code.includes('createDLCat('))throw new Error('The walk script must load Cosmo from its own file');
 if(code.includes('__walk'))throw new Error('The walk debug hook must not ship');
 const name=hashed('walk','js',code);await fs.writeFile(path.join(out,name),code);
 let html=(await fs.readFile('src/walk/walk.html','utf8')).replace('<script>/* BUNDLE */</script>',()=>`<script type="module" src="${name}"></script>`);
 if(html.includes('/* BUNDLE */'))throw new Error('walk.html lost its bundle placeholder');
 html=html.replace('<body>',()=>`<body><script>window.LEO_PUBLIC_ASSETS=${JSON.stringify(manifest)};</script>`);
 await fs.writeFile(path.join(out,'walk.html'),html);
 return {walk:name,emotes:emoteName,map:mapName,bytes:code.length};
}
