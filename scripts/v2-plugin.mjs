import {geometryAdapters} from './prepared-geometry-adapters.mjs';
import {preparedWalkAdapters} from './prepared-walk-adapters.mjs';
import {addBayAccesses} from '../src/plan/bay-access-v2.js';
import {hydrateHullLayout,serializeHullLayout} from '../src/plan/envelope-data-v2.js';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {applyV2Adapters,checkV2Adapters} from './v2-adapters.mjs';
import {AREAS} from '../src/plan/v1.js';
import {addStructuralOpenings} from '../src/plan/structure-v2.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=process.cwd();
// All mutations are opt-in source adapters. The v1 sources and emitted bundle are unchanged.
// The plan as the bundled walk receives it (v2-layout): no per-deck corridors or navigation, and only the circulation
// the walk draws (v2Plugin also trims the window list). Checks of walk code that reads v2-layout should use this shape.
export const runtimeLayout=layout=>({...layout,windows:[],decks:layout.decks.map(({programme,corridors,navigation,roomLines,residentialFront,...d})=>d),circulation:Object.fromEntries(['corridors','stairs','bridges','towers','lifts','ramps'].map(k=>[k,layout.circulation[k]]))});
export function v2Plugin(layout,{node=false,sourceRef=null,sourceAdapters=applyV2Adapters,dataDirectory=null,overview=false,preparedWalk=false,authoringWalk=false}={}){layout=addBayAccesses(addStructuralOpenings(hydrateHullLayout(structuredClone(layout))));const lounge=layout.rooms.find(r=>r.id==='observation-lounge');if(!lounge.fittingFrame){const p=lounge.polygon;const x=lounge.door.center[0];lounge.fittingFrame={origin:[x,lounge.y,0],yaw:0,bounds:[[-24,-2.31,Math.min(...p.map(p=>p[1]))],[Math.max(...p.map(p=>p[0]))-x,lounge.height,Math.max(...p.map(p=>p[1]))]]};}layout.fixedRooms??=AREAS.filter(a=>!layout.rooms.some(r=>r.id===a.id)).map(a=>({...a,frame:{origin:a.origin,yaw:0},width:a.size[0],height:a.size[1],depth:a.size[2],x:a.origin[0],y:a.origin[1],z:a.origin[2],center:a.origin,yaw:0,fixed:true}));layout={...layout,windows:layout.hullPrototypes?layout.windows.filter(w=>layout.hullPrototypes.prototypes.some(p=>p.id===w.prototype||p.id===w.cabinId||(p.ownerId||p.id)===w.roomId)):[],decks:runtimeLayout(layout).decks,circulation:runtimeLayout(layout).circulation};const serialLayout=structuredClone(layout);if(overview&&serialLayout.hullPrototypes)serialLayout.hullPrototypes.prototypes=serialLayout.hullPrototypes.prototypes.map(({id,kind,deck,polygon})=>({id,kind,deck,polygon}));for(const c of [...serialLayout.cabins,...serialLayout.rooms])if(c.hullPrototype)delete c.hullPrototype;if(preparedWalk&&serialLayout.hullPrototypes)serialLayout.hullPrototypes.prototypes=serialLayout.hullPrototypes.prototypes.map(({id,ownerId,kind,deck,polygon,chart,rect,floorHoles})=>({id,ownerId,kind,deck,polygon,chart:{origin:chart.origin},rect,floorHoles}));if(preparedWalk){serialLayout.windows=[];delete serialLayout.hullPrototypes?.parity;serialLayout.decks=serialLayout.decks.map(({roomLine,...d})=>d);}const serialized=preparedWalk?JSON.stringify(serialLayout):serializeHullLayout(serialLayout,{packed:true}),runtimeFile=path.join(root,'output/leo-interior-v02/runtime/layout-'+createHash('sha256').update(serialized).digest('hex').slice(0,16)+'.json'),payload=dataDirectory?gzipSync(serialized,{level:9}):null,payloadHash=payload?createHash('sha256').update(payload).digest('hex').slice(0,16):null,payloadParts=payload?Array.from({length:Math.ceil(payload.length/16777216)},(_,i)=>'layout.'+payloadHash+'.'+i+'.bin'):[];return {name:'leo-layout-2',setup(b){
 b.onStart(async()=>{if(node){await fs.mkdir(path.dirname(runtimeFile),{recursive:true});let valid=false;try{valid=(await fs.stat(runtimeFile)).size===Buffer.byteLength(serialized);}catch{}if(!valid){const temp=runtimeFile+'.'+process.pid+'.tmp';await fs.writeFile(temp,serialized);await fs.rename(temp,runtimeFile);}}if(dataDirectory){await fs.mkdir(dataDirectory,{recursive:true});for(let i=0;i<payloadParts.length;i++)await fs.writeFile(path.join(dataDirectory,payloadParts[i]),payload.subarray(i*16777216,(i+1)*16777216));await fs.writeFile(path.join(dataDirectory,'layout-data.json'),JSON.stringify({parts:payloadParts,bytes:Buffer.byteLength(serialized),compressedBytes:payload.length,sha256:createHash('sha256').update(serialized).digest('hex')}));}const {issues}=await checkV2Adapters(root);return {errors:issues.map(text=>({text}))};});
 b.onResolve({filter:/^v2-layout$/},()=>({path:'layout',namespace:'v2-data'}));
 b.onLoad({filter:/.*/,namespace:'v2-data'},()=>({contents:(node?'import {readFileSync} from \'node:fs\';const layout=JSON.parse(readFileSync('+JSON.stringify(runtimeFile)+',\'utf8\'));':dataDirectory?'const chunks=await Promise.all('+JSON.stringify(payloadParts)+'.map(async name=>{const response=await fetch(new URL(name,import.meta.url));if(!response.ok)throw Error(\'Room geometry download failed\');return response.arrayBuffer();}));const layout=await new Response(new Blob(chunks).stream().pipeThrough(new DecompressionStream(\'gzip\'))).json();':'const layout='+serialized+';')+(preparedWalk?'export default layout;':'import {hydrateHullLayout} from '+JSON.stringify(path.join(root,'src/plan/envelope-data-v2.js').replaceAll('\\','/'))+';hydrateHullLayout(layout);export default layout;'),loader:'js'}));
 b.onResolve({filter:/.*/},a=>{
  if(/^(walk-partitions|walk-changes)$/.test(a.path))return null;
  if(node&&(!a.path.startsWith('.')&&!path.isAbsolute(a.path)))return {path:a.path,external:true};
  const legacy=a.path.endsWith('?legacy');if(legacy)a={...a,path:a.path.slice(0,-7)};
  let p=a.path==='three'?path.join(root,'node_modules/three/build/three.module.js'):a.path.startsWith('.')?path.resolve(a.resolveDir||root,a.path):path.isAbsolute(a.path)?a.path:require.resolve(a.path);
  if(p===path.join(root,'src/public-assets.js'))p=path.join(root,'src/v2/public-assets.js');
  if(!legacy&&p.endsWith(path.join('walk','railings.js')))p=path.join(root,'src/v2/railings.js');
  if(!legacy&&p.endsWith(path.join('walk','world.js')))p=path.join(root,'src/v2/world.js');
  if(p.endsWith(path.join('walk','rest.js'))&&!a.importer.endsWith(path.join('v2','rest.js')))p=path.join(root,'src/v2/rest.js');
  if(p.endsWith(path.join('walk','haze.js')))p=path.join(root,'src/v2/haze.js');
  return {path:p,namespace:'v2-source'};
 });
 b.onLoad({filter:/.*/,namespace:'v2-source'},async a=>{
  let actual=a.path,s;try{s=await fs.readFile(actual,'utf8');}catch(e){if(!actual.endsWith('.js'))throw e;actual=actual.slice(0,-3)+'.ts';s=await fs.readFile(actual,'utf8');}const file=path.relative(root,actual).replaceAll('\\','/');
  if(sourceRef&&!file.startsWith('node_modules/')&&!file.startsWith('scripts/phase3b-')&&!['src/plan/envelope-data-v2.js','src/plan/hull-skin-v2.js','src/plan/finished-skin-v2.js','src/plan/coplanar-v2.js','src/v2/hull-prototypes.js'].includes(file)){try{s=(await promisify(execFile)('git',['--no-optional-locks','show',sourceRef+':'+file],{cwd:root,maxBuffer:32*1024*1024})).stdout;}catch(e){throw Error('Baseline source unavailable: '+sourceRef+':'+file+' '+e.message);}}
  s=geometryAdapters(file,preparedWalkAdapters(file,sourceAdapters(file,s),{authoring:authoringWalk,prepared:preparedWalk}),{authoring:authoringWalk,prepared:preparedWalk});
  return {contents:s,loader:actual.endsWith('.json')?'json':actual.endsWith('.ts')?'ts':'js',resolveDir:path.dirname(a.path)};
 });
}};}
