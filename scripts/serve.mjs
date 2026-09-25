import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('output/leo-interior-v01');
const port=Number(process.argv[2]||4173);
const mime={'.html':'text/html; charset=utf-8','.glb':'model/gltf-binary','.json':'application/json','.csv':'text/csv','.md':'text/plain; charset=utf-8','.png':'image/png','.ttf':'font/ttf','.js':'text/javascript; charset=utf-8'};
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(req.method==='PUT'){
      const neighborhoodImage=/^\/renders\/interior-n(?:[1-9]|10)-(all|cabin|garden|observation)(-inside)?\.png$/.test(pathname);
      if(!/^\/renders\/interior-journey-(aft|fin)-([1-9]|10|11)\.png$/.test(pathname)&&!/^\/renders\/interior-aft-(overview|drive|tanks|pods|access|fin|crown)-(overview|inside)\.png$/.test(pathname)&&!/^\/renders\/interior-transit-(forward|aft)-d([1-9]|1[0-9]|20)-(overview|inside|stairs)\.png$/.test(pathname)&&!neighborhoodImage&&!/^\/renders\/interior-area-d[0-9]{2}-[a-z]+-[0-9]+-(overview|inside)\.png$/.test(pathname)&&!/^\/renders\/interior-(all|cabin|garden|observation|walk-[1-6])\.png$/.test(pathname)&&!/^\/renders\/exterior-(refined-)?(perspective|concept|top|side|front|aft|bow|engine|windows|aftwindows|enginewindows)(-shape|-overlay)?\.png$/.test(pathname)){res.writeHead(403);res.end();return;}
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>24*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const data=Buffer.concat(chunks);if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){res.writeHead(415);res.end();return;}
      await fs.mkdir(path.join(root,'renders'),{recursive:true});await fs.writeFile(path.join(root,'renders',path.basename(pathname)),data);res.writeHead(201);res.end('Saved');return;
    }
    const file=path.resolve(root,pathname==='/'?'index.html':'.'+pathname);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`LEO viewer: http://127.0.0.1:${port}`));
