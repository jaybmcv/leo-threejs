// Frame-time study: compile this checkout's public walk (src/walk/main.public.js) against the assets of a deployed
// public build, without authoring geometry. Usage:
//   node scripts/walk-frame-build.mjs --tag=<name> [--debug] [--map] [--layout=<layout.json>] [--pvs=<atrium pvs.json>]
// --map also writes <script>.map, which scripts/walk-frame-bench.mjs --profile uses to name functions.
// The deployed walk.html and asset-manifest.json are read from output/perf-walk/mirror (scripts/walk-frame-serve.mjs
// fetches them). Output goes to output/perf-walk/builds/<tag>/: walk.html, the walk script and its layout data parts.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from './native-bundle.mjs';
import {v2Plugin} from './v2-plugin.mjs';
import {shipLog} from './ship-log.mjs';
import {loadMedia} from './ship-log-media.mjs';
import {PAINTINGS} from '../src/walk/paintings.js';
import {COMICS} from '../src/walk/comics.js';
import {MUDWATER_ART} from '../src/walk/mudwater.js';
import {LONGBOARD_ART} from '../src/walk/longboard.js';
import {preparedPvsKey} from './atrium-pvs-source.mjs';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const tag=arg('tag','candidate'),debug=process.argv.includes('--debug'),mirror='output/perf-walk/mirror';
const out=path.resolve('output/perf-walk/builds',tag),layoutFile=arg('layout','C:/Users/Rigs/leo-live/output/leo-interior-v02/layout.json');
const hashed=(stem,ext,data)=>`${stem}.${createHash('sha256').update(data).digest('hex').slice(0,10)}.${ext}`;
const local=async(file,stem)=>hashed(stem,path.extname(file).slice(1),await fs.readFile(file));

const deployedHTML=await fs.readFile(path.join(mirror,'walk.html'),'utf8'),manifest=JSON.parse(await fs.readFile(path.join(mirror,'asset-manifest.json'),'utf8'));
const deployedScript=deployedHTML.match(/LEO_WALK_BOOT\("([^"]+)"\)/)[1],deployedCode=await fs.readFile(path.join(mirror,deployedScript),'utf8');
const named=pattern=>{const m=deployedCode.match(pattern);if(!m)throw Error('Deployed walk names no '+pattern);return m[0];};
const art={};for(const file of [...PAINTINGS.map(p=>p.file),...COMICS.flatMap(c=>c.pages),...MUDWATER_ART,...LONGBOARD_ART])art[file]=await local('src/walk/art/'+file,'walk-art-'+path.parse(file).name);
const defines={
 __PREPARED_META__:manifest['walk-prepared'].metadataFile,__PREPARED_URL__:'./'+manifest['walk-prepared'].directory,
 __COSMO_SCRIPT__:named(/cosmo\.[0-9a-f]{10}\.js/),__HYDRO_NIP_MAIN_LOGO__:await local('src/walk/assets/hydro-nip-main-logo.jpg','hydro-nip-main-logo'),
 __EMOTES_URL__:await local('src/walk/assets/cosmo-emotes.json','walk-emotes'),__MAP_URL__:named(/walk-map\.[0-9a-f]{10}\.png/),
 __HAT_URL__:await local('src/vendor/captain-hat/captains-hat.glb','walk-hat'),__ART_URLS__:art,
 __REEL_URL__:await local('src/walk/art/theatre-loop.mp4','walk-reel'),__LIVE_URL__:'',__CREAMERY_URL__:'https://creamery.marscatsvoyage.com'};
// --pvs=<file> ships an atrium PVS (scripts/walk-atrium-pvs.mjs) beside the walk script, keyed as the public build keys it
// (scripts/atrium-pvs-source.mjs) from the deployed prepared walk and this layout; without it the sight rays run.
const pvsFile=arg('pvs',null),pvsData=pvsFile&&await fs.readFile(pvsFile);defines.__ATRIUM_PVS_URL__=pvsData?hashed('atrium-pvs','json',pvsData):'';
defines.__ATRIUM_PVS_KEY__=pvsData?await preparedPvsKey(path.join(mirror,manifest['walk-prepared'].directory),await fs.readFile(layoutFile,'utf8')):'';
if(pvsData&&JSON.parse(pvsData).source?.key!==defines.__ATRIUM_PVS_KEY__)console.warn('The PVS was baked for other geometry; the walk will ignore it');
const define=Object.fromEntries(Object.entries(defines).map(([k,v])=>[k,JSON.stringify(v)]));define.__WALK_DEBUG__=String(debug);
// The public entry imports the partition plan but no longer reads it, so the bundle does not depend on its contents.
const data={'walk-partitions':'{}','walk-changes':JSON.stringify(shipLog(process.cwd(),loadMedia().media))};
const walkData={name:'walk-data',setup(b){b.onResolve({filter:/^walk-(partitions|changes)$/},a=>({path:a.path,namespace:'walk'}));b.onLoad({filter:/.*/,namespace:'walk'},a=>({contents:data[a.path],loader:'json'}));}};
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
const layoutText=await fs.readFile(layoutFile,'utf8'),layout=JSON.parse(layoutText);
const map=process.argv.includes('--map');
const result=await build({...map?{sourcemap:'external',outfile:'walk.js'}:{},entryPoints:['src/walk/main.public.js'],bundle:true,minify:true,format:'esm',write:false,target:'es2022',legalComments:'eof',define,plugins:[walkData,v2Plugin(layout,{preparedWalk:true,dataDirectory:out})]});
const code=(result.outputFiles.find(f=>f.path.endsWith('.js'))||result.outputFiles[0]).text,name=hashed('walk','js',code);
await fs.writeFile(path.join(out,name),code);if(pvsData)await fs.writeFile(path.join(out,defines.__ATRIUM_PVS_URL__),pvsData);if(map)await fs.writeFile(path.join(out,name+'.map'),result.outputFiles.find(f=>f.path.endsWith('.map')).contents);
const layoutData=JSON.parse(await fs.readFile(path.join(out,'layout-data.json'),'utf8'));
// Same page as deployed, with this script and this layout data in its manifest.
const html=deployedHTML.replace(deployedScript,name).replace(/window\.LEO_PUBLIC_ASSETS=(\{.*?\});<\/script>/s,(_,json)=>{const m=JSON.parse(json);m['layout-data']=layoutData;return 'window.LEO_PUBLIC_ASSETS='+JSON.stringify(m)+';</script>';});
if(html===deployedHTML)throw Error('Walk page was not rewritten');
await fs.writeFile(path.join(out,'walk.html'),html);
const summary={tag,debug,script:name,bytes:code.length,layoutSource:{file:layoutFile,sha256:createHash('sha256').update(layoutText).digest('hex')},layoutData,deployedLayoutData:manifest['layout-data'],layoutMatchesDeployed:layoutData.sha256===manifest['layout-data'].sha256};
await fs.writeFile(path.join(out,'build.json'),JSON.stringify(summary,null,2));console.log(summary);
