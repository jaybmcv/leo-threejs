import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
process.env.LEO_LAYOUT='2';
const {writeWalkPage}=await import('./walk-page.mjs');

const out=path.resolve('.qa/draw-distance-lab'),base=path.resolve('dist-v2');
const results=path.resolve('.qa/draw-distance-results');
await fs.mkdir(out,{recursive:true});await fs.mkdir(results,{recursive:true});
const client=path.resolve('scripts/draw-distance-lab/client.js').replaceAll('\\','/');
await fs.access(client);
const replace=(s,from,to)=>{if(s.split(from).length!==2)throw Error('Expected one source match: '+from);return s.replace(from,to);};
const adapters=(file,source)=>{
 let s=source.replaceAll('\r\n','\n');
 if(file==='src/walk/main.js'){
  s=`import {distanceProfile,wrapDistanceFrame,installDistanceLab} from ${JSON.stringify(client)};\n`+s;
  s=replace(s,'maxRatio=Math.min(devicePixelRatio,phone?1.25:1.75)','maxRatio=1');
  s=replace(s,'let res=Math.max(0,RES.indexOf(savedRes)),resChosen=savedRes!==null','let res=0,resChosen=true');
  s=replace(s,'const NEAR_CABINS=40,BOAT_REACH=45','const BOAT_REACH=45');
  s=replace(s,'.slice(0,NEAR_CABINS)','.slice(0,distanceProfile.cabins)');
  s=replace(s,'.raycast(ray.ray,90,.6),d=hit?hit.distance:90','.raycast(ray.ray,distanceProfile.rayFar,.6),d=hit?hit.distance:distanceProfile.rayFar');
  s=replace(s,'.raycast(probe,12)','.raycast(probe,distanceProfile.verticalProbe)');
  s=replace(s,'const atriumBand=atriumViewSpan();if(atriumBand)','const atriumBand=atriumViewSpan();distanceProfile.insideAtrium=!!atriumBand;if(atriumBand)');
  s=replace(s,'renderer.setAnimationLoop(()=>{','renderer.setAnimationLoop(wrapDistanceFrame(()=>{');
  s=replace(s,'});\n// One frame of the ship','}));\n// One frame of the ship');
  s+=`\ninstallDistanceLab({T,renderer,scene,camera,hazeCamera,controller,follow,input,renderMetrics,phase4:()=>phase4Visibility,teleport:(...a)=>globalThis.__walk.teleport(...a),reset:()=>{nearFrom.set(1e9,0,0);lastSpan=-Infinity;spanChanged(camera,controller.position,NaN,NaN,colliders);distanceProfile.revision=(distanceProfile.revision||0)+1;}});\n`;
 }
 if(file==='src/v2/atrium-render-policy.js'){
  s=`import {distanceProfile} from ${JSON.stringify(client)};\n`+s;
  s=replace(s,'export const ATRIUM_VIEW = {\n far:450,\n fogNear:120,\n fogFar:1100,\n fullHeight:true,\n roomReach:90,\n};',`export const ATRIUM_VIEW={get far(){return distanceProfile.far},get fogNear(){return distanceProfile.fogNear},get fogFar(){return distanceProfile.fogFar},get fullHeight(){return distanceProfile.fixedAtrium},get roomReach(){return distanceProfile.roomReach??Infinity}};`);
 }
 if(file==='src/v2/phase4-culling.js'){
  s=`import {distanceProfile} from ${JSON.stringify(client)};\n`+s;
  s=replace(s,'export function phase4Culling(root,col){','export function phase4Culling(root,col){let distanceRevision=-1;');
  s=replace(s,'if(!changed(camera,p,low,high,col)&&!atriumChanged)return;','const cameraChanged=changed(camera,p,low,high,col),distanceChanged=distanceRevision!==distanceProfile.revision;distanceRevision=distanceProfile.revision;if(!cameraChanged&&!atriumChanged&&!distanceChanged)return;');
  s=replace(s,'if(publicAtrium||r?.showFromBelow){','if(publicAtrium||distanceProfile.forceAtrium&&r?.phase6Atrium||r?.showFromBelow){');
 }
 return s;
};
const m=JSON.parse(await fs.readFile(path.join(base,'asset-manifest.json')));
const manifest=Object.fromEntries(Object.entries(m).map(([k,v])=>[k,{...v,parts:v.parts.map(p=>'/base/'+p),...(v.recipePart?{recipePart:'/base/'+v.recipePart}:{})}]));
const cosmo=(await fs.readdir(base)).find(n=>/^cosmo\.[0-9a-f]{10}\.js$/.test(n));
await fs.copyFile(path.join(base,cosmo),path.join(out,cosmo));await fs.cp(path.join(base,'brand'),path.join(out,'brand'),{recursive:true});
const result=await writeWalkPage(out,{cosmo,manifest,debug:true,preparedWalk:true,sourceAdapters:adapters});
await fs.copyFile('scripts/draw-distance-lab/index.html',path.join(out,'index.html'));
await fs.writeFile(path.join(out,'provenance.json'),JSON.stringify({status:'RUNTIME_EXPERIMENT',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),prepared:m['walk-prepared'],runtime:result.walk,note:'Identical verified geometry. Runtime-only adapters compare drawing limits; no geometry regeneration or production source edits. Resolution fixed per run; all profiles share the instrumentation.'},null,2));
if(process.argv.includes('--build-only'))process.exit(0);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.mp4':'video/mp4'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST'&&url.pathname==='/__distance-result'){
  let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>8*1024*1024)throw Error('Result too large');chunks.push(c);}
  const value=JSON.parse(Buffer.concat(chunks).toString());if(!/^[a-zA-Z0-9_-]{1,80}$/.test(value.runId))throw Error('Invalid run id');
  await fs.appendFile(path.join(results,value.runId+'.jsonl'),JSON.stringify(value)+'\n');res.writeHead(200,{'Content-Type':'application/json'});res.end('{"saved":true}');return;
 }
 if(req.method!=='GET')throw Error('Unsupported method');
 const isBase=url.pathname.startsWith('/base/'),root=isBase?base:out,rel=isBase?url.pathname.slice(6):url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)),file=path.resolve(root,rel);
 if(!file.startsWith(root+path.sep))throw Error('Outside fixture');const bytes=await fs.readFile(file);
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
}catch(e){res.writeHead(400);res.end(String(e.message));}}).listen(4195,'127.0.0.1',()=>console.log('Draw-distance lab http://127.0.0.1:4195/'));
