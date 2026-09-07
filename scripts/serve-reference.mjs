import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('output/leo-reference');
const port=Number(process.argv[2]||4174);
const mime={'.html':'text/html; charset=utf-8','.png':'image/png','.glb':'model/gltf-binary','.json':'application/json','.md':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain','Cache-Control':'no-store'});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`LEO reference viewer: http://127.0.0.1:${port}`));
