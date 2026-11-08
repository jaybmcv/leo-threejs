import http from 'node:http';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

// The style lab (src/style-lab.html): a test preview of Voyager's Reach's art styles on Leo's exterior, apart from the
// viewer and the public build. Bundles the page into output/style-lab (ignored by git) and serves it with the refined
// exterior GLB and the brand files. `node scripts/style-lab.mjs [port]`, then open http://127.0.0.1:4180/.
const root=path.resolve('.'),out=path.join(root,'output','style-lab'),port=Number(process.argv[2]||4180);
const GLB=path.join(root,'output','leo-interior-v01','leo-exterior-refined.glb');
await fs.access(GLB).catch(()=>{throw new Error(`The refined exterior is missing (${path.relative(root,GLB)}); run npm run build first.`);});
await fs.mkdir(out,{recursive:true});
// Built at start and again at every page load, so a change to the lab's source shows on a reload.
async function build(){
 await esbuild.build({entryPoints:['src/style-lab.js'],bundle:true,format:'esm',target:'es2022',outfile:path.join(out,'style-lab.js'),logLevel:'warning'});
 await fs.copyFile('src/style-lab.html',path.join(out,'index.html'));
}
await build();

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css','.mp4':'video/mp4','.woff2':'font/woff2','.ico':'image/x-icon'};

// The walk (scripts/style-lab-walk.mjs) under /walk/: its build first, then the local copy of the deployed public site
// that the frame-time study keeps (scripts/walk-frame-serve.mjs). A deployed file missing from that copy is fetched once
// from the live site and kept; deployed assets are content-hashed, so a kept copy never goes stale.
const WALK_BUILD=path.join(root,'output','perf-walk','builds','style-lab'),MIRROR=path.join(root,'output','perf-walk','mirror'),LIVE='https://leo.marscatsvoyage.com';
const inside=(dir,name)=>{const p=path.resolve(dir,name);return p.startsWith(dir+path.sep)?p:null;};
const isFile=p=>fs.stat(p).then(s=>s.isFile(),()=>false);
const mirroring=new Map();
function mirror(name){
 if(!mirroring.has(name))mirroring.set(name,(async()=>{
  const file=inside(MIRROR,name);if(!file)return null;
  const res=await fetch(LIVE+'/'+name.split('/').map(encodeURIComponent).join('/'));if(!res.ok)return null;
  await fs.mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.part`;
  await fs.writeFile(temp,Buffer.from(await res.arrayBuffer()));await fs.rename(temp,file);console.log('mirrored',name);return file;
 })().finally(()=>mirroring.delete(name)));
 return mirroring.get(name);
}
async function walkFile(name){
 if(!name||name.endsWith('/'))name+='walk.html';
 for(const dir of [WALK_BUILD,MIRROR]){const p=inside(dir,name);if(p&&await isFile(p))return p;}
 return mirror(name);
}
// Each served path, from the page's own files, the exterior, or the brand folder; nothing else.
function fileFor(pathname){
 if(pathname==='/')return path.join(out,'index.html');
 if(pathname==='/leo-exterior-refined.glb')return GLB;
 const [dir,base]=pathname.startsWith('/brand/')?[path.join(root,'src','brand'),pathname.slice(7)]:[out,pathname.slice(1)];
 const file=path.resolve(dir,base);
 return file.startsWith(dir+path.sep)?file:null;
}
// Stills from the page (leoStyleLab.capture): PNGs only, under a plain name, into output/style-lab/captures.
async function saveCapture(req,res,pathname){
 const match=/^\/captures\/([a-z0-9-]+\.png)$/.exec(pathname);
 if(!match){res.writeHead(403);res.end();return;}
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}
 const data=Buffer.concat(chunks);if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){res.writeHead(415);res.end();return;}
 await fs.mkdir(path.join(out,'captures'),{recursive:true});await fs.writeFile(path.join(out,'captures',match[1]),data);res.writeHead(201);res.end('Saved');
}
// Only this machine's own page: a request naming another host (a rebound DNS name) or a PUT from another origin is refused.
const HOSTS=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
const ownRequest=req=>HOSTS.has(req.headers.host)&&(req.method!=='PUT'||!req.headers.origin||HOSTS.has(req.headers.origin.replace(/^http:\/\//,'')));
http.createServer(async(req,res)=>{
 try{
  if(!ownRequest(req)){res.writeHead(403);res.end();return;}
  if(req.method==='PUT'){await saveCapture(req,res,new URL(req.url,'http://localhost').pathname);return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/')await build();
  const file=pathname.startsWith('/walk/')?await walkFile(pathname.slice(6)):fileFor(pathname);
  if(!file){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
  createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`LEO style lab: http://127.0.0.1:${port}/`));
