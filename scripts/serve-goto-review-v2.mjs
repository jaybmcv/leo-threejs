// Targeted JS review against an immutable prepared build. No model producers,
// mesh/BVH rebuilding or walk flood. Writes review JS/data only under phase7.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {build} from 'esbuild';
import {v2Plugin} from './v2-plugin.mjs';
import {publicPreparedAdapters} from './public-walk-adapters-v2.mjs';
const base=path.resolve(process.argv.find(a=>a.startsWith('--base='))?.slice(7)||'C:/Users/henri/code/redesign-verify/p7-base/dist-v2');
const out=path.resolve('output/phase7/goto-review'),files=await fs.readdir(base),manifest=JSON.parse(await fs.readFile(path.join(base,'asset-manifest.json'),'utf8'));
const first=pattern=>{const name=files.find(f=>pattern.test(f));if(!name)throw Error('Missing frozen review asset');return name;};
await fs.mkdir(out,{recursive:true});
const art={};for(const file of await fs.readdir('src/walk/art')){const stem=path.parse(file).name,name=files.find(n=>n.startsWith('walk-art-'+stem+'.'));if(name)art[file]=name;}
if(!process.argv.includes('--reuse')){
const layout=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8')),plan=await fs.readFile('output/leo-interior-v02/walk-plan.json','utf8');
const data={name:'goto-review-data',setup(b){b.onResolve({filter:/^walk-(partitions|changes)$/},a=>({path:a.path,namespace:'goto-review'}));b.onLoad({filter:/.*/,namespace:'goto-review'},a=>({contents:a.path==='walk-partitions'?plan:'[]',loader:'json'}));}};
const result=await build({entryPoints:['src/walk/main.js'],absWorkingDir:process.cwd(),tsconfigRaw:{},bundle:true,minify:true,format:'esm',write:false,target:'es2022',define:{__PREPARED_META__:JSON.stringify(manifest['walk-prepared'].metadataFile),__PREPARED_URL__:JSON.stringify('./'+manifest['walk-prepared'].directory),__COSMO_SCRIPT__:JSON.stringify(first(/^cosmo\./)),__HYDRO_NIP_MAIN_LOGO__:JSON.stringify(first(/^hydro-nip-main-logo\./)),__EMOTES_URL__:JSON.stringify(first(/^walk-emotes\./)),__MAP_URL__:JSON.stringify(first(/^walk-map\./)),__HAT_URL__:JSON.stringify(first(/^walk-hat\./)),__ART_URLS__:JSON.stringify(art),__REEL_URL__:JSON.stringify(first(/^walk-reel\./)),__LIVE_URL__:'""',__CREAMERY_URL__:'"https://creamery.marscatsvoyage.com"',__WALK_DEBUG__:'true'},plugins:[data,v2Plugin(layout,{preparedWalk:true,sourceAdapters:publicPreparedAdapters,dataDirectory:out})]});
await fs.writeFile(path.join(out,'walk.goto-review.js'),result.outputFiles[0].contents);
}
const frozenHTML=await fs.readFile('src/walk/walk.html','utf8'),html=frozenHTML.replace('<script>/* BUNDLE */</script>','<script>LEO_WALK_BOOT("walk.goto-review.js")</script>').replace('<body>','<body><script>window.LEO_PUBLIC_ASSETS='+JSON.stringify(manifest)+'</script>');
assertHTML();function assertHTML(){if(html===frozenHTML)throw Error('Frozen walk script anchor missing');}
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.bin':'application/octet-stream','.glb':'model/gltf-binary','.mp4':'video/mp4'};
const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'walk.html';if(name==='walk.html'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(html);return;}let chosen=null;for(const dir of [out,base]){const p=path.resolve(dir,name);if(p.startsWith(dir+path.sep)&&await fs.stat(p).then(s=>s.isFile()).catch(()=>false)){chosen=p;break;}}if(!chosen){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(chosen)]||'application/octet-stream','Cache-Control':'no-store'});const handle=await fs.open(chosen);handle.createReadStream().pipe(res);}catch{res.writeHead(500);res.end();}});
server.listen(Number(process.env.LEO_GOTO_REVIEW_PORT||4187),'127.0.0.1',()=>console.log('Goto review ready at http://127.0.0.1:'+server.address().port+'/walk.html (new JS over frozen geometry; empty historical ship log)'));
