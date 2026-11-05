// Frame-time study server: /<tag>/walk.html serves output/perf-walk/builds/<tag> (scripts/walk-frame-build.mjs) over a
// local copy of the deployed public site. Files missing from output/perf-walk/mirror are fetched once from the live
// site and kept; deployed assets are content-hashed, so a kept copy never goes stale. Usage:
//   node scripts/walk-frame-serve.mjs [--port=4211] [--origin=https://leo.marscatsvoyage.com]
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const port=Number(arg('port',4211)),origin=arg('origin','https://leo.marscatsvoyage.com');
const builds=path.resolve('output/perf-walk/builds'),mirror=path.resolve('output/perf-walk/mirror');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.bin':'application/octet-stream','.gz':'application/octet-stream','.glb':'model/gltf-binary','.mp4':'video/mp4','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const inside=(dir,name)=>{const p=path.resolve(dir,name);return p.startsWith(dir+path.sep)?p:null;};
const isFile=p=>fs.stat(p).then(s=>s.isFile(),()=>false);
const pending=new Map();
// One fetch per missing file, however many requests ask for it at once.
function fetchMirror(name){
 if(!pending.has(name))pending.set(name,(async()=>{
  const res=await fetch(origin+'/'+name.split('/').map(encodeURIComponent).join('/'));if(!res.ok)return null;
  const file=inside(mirror,name);if(!file)return null;await fs.mkdir(path.dirname(file),{recursive:true});
  const temp=file+'.'+process.pid+'.part';await fs.writeFile(temp,Buffer.from(await res.arrayBuffer()));await fs.rename(temp,file);console.log('mirrored',name);return file;
 })().finally(()=>pending.delete(name)));
 return pending.get(name);
}
const tags=async()=>new Set(await fs.readdir(builds).catch(()=>[]));
const server=http.createServer(async(req,res)=>{
 try{
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);
  const [first,...rest]=name.split('/');let chosen=null;
  if((await tags()).has(first)){name=rest.join('/')||'walk.html';const p=inside(path.join(builds,first),name);if(p&&await isFile(p))chosen=p;}
  if(!chosen){const p=inside(mirror,name);chosen=p&&await isFile(p)?p:name&&!name.endsWith('/')&&await fetchMirror(name);}
  if(!chosen){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(chosen).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});
  createReadStream(chosen).pipe(res);
 }catch(e){console.error(req.url,e.message);if(!res.headersSent)res.writeHead(500);res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log('Walk frame-time server at http://127.0.0.1:'+port+'/<tag>/walk.html'));
