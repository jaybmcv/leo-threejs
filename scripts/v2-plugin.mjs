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
export function v2Plugin(layout,{node=false,sourceRef=null,sourceAdapters=applyV2Adapters}={}){layout=addStructuralOpenings(structuredClone(layout));const lounge=layout.rooms.find(r=>r.id==='observation-lounge');if(!lounge.fittingFrame){const p=lounge.polygon;const x=lounge.door.center[0];lounge.fittingFrame={origin:[x,lounge.y,0],yaw:0,bounds:[[-24,-2.31,Math.min(...p.map(p=>p[1]))],[Math.max(...p.map(p=>p[0]))-x,lounge.height,Math.max(...p.map(p=>p[1]))]]};}layout.fixedRooms??=AREAS.filter(a=>!layout.rooms.some(r=>r.id===a.id)).map(a=>({...a,frame:{origin:a.origin,yaw:0},width:a.size[0],height:a.size[1],depth:a.size[2],x:a.origin[0],y:a.origin[1],z:a.origin[2],center:a.origin,yaw:0,fixed:true}));layout={...layout,windows:layout.hullPrototypes?layout.windows.filter(w=>layout.hullPrototypes.prototypes.some(p=>p.id===w.cabinId||p.id===w.roomId)):[],decks:layout.decks.map(({programme,corridors,navigation,roomLines,residentialFront,...d})=>d),circulation:Object.fromEntries(['corridors','stairs','bridges','towers','lifts','ramps'].map(k=>[k,layout.circulation[k]]))};return {name:'leo-layout-2',setup(b){
 b.onStart(async()=>{const {issues}=await checkV2Adapters(root);return {errors:issues.map(text=>({text}))};});
 b.onResolve({filter:/^v2-layout$/},()=>({path:'layout',namespace:'v2-data'}));
 b.onLoad({filter:/.*/,namespace:'v2-data'},()=>({contents:JSON.stringify(layout),loader:'json'}));
 b.onResolve({filter:/.*/},a=>{
  if(/^(walk-partitions|walk-changes)$/.test(a.path))return null;
  if(node&&(!a.path.startsWith('.')&&!path.isAbsolute(a.path)))return {path:a.path,external:true};
  const legacy=a.path.endsWith('?legacy');if(legacy)a={...a,path:a.path.slice(0,-7)};
  let p=a.path==='three'?path.join(root,'node_modules/three/build/three.module.js'):a.path.startsWith('.')?path.resolve(a.resolveDir||root,a.path):path.isAbsolute(a.path)?a.path:require.resolve(a.path);
  if(!legacy&&p.endsWith(path.join('walk','railings.js')))p=path.join(root,'src/v2/railings.js');
  if(!legacy&&p.endsWith(path.join('walk','world.js')))p=path.join(root,'src/v2/world.js');
  if(p.endsWith(path.join('walk','rest.js'))&&!a.importer.endsWith(path.join('v2','rest.js')))p=path.join(root,'src/v2/rest.js');
  if(p.endsWith(path.join('walk','haze.js')))p=path.join(root,'src/v2/haze.js');
  return {path:p,namespace:'v2-source'};
 });
 b.onLoad({filter:/.*/,namespace:'v2-source'},async a=>{
  let actual=a.path,s;try{s=await fs.readFile(actual,'utf8');}catch(e){if(!actual.endsWith('.js'))throw e;actual=actual.slice(0,-3)+'.ts';s=await fs.readFile(actual,'utf8');}const file=path.relative(root,a.path).replaceAll('\\','/');
  if(sourceRef&&!file.startsWith('scripts/phase3b-')&&!['src/plan/hull-skin-v2.js','src/v2/hull-prototypes.js'].includes(file)){try{s=(await promisify(execFile)('git',['--no-optional-locks','show',sourceRef+':'+file],{cwd:root,maxBuffer:32*1024*1024})).stdout;}catch(e){throw Error('Baseline source unavailable: '+sourceRef+':'+file+' '+e.message);}}
  s=sourceAdapters(file,s);
  return {contents:s,loader:actual.endsWith('.json')?'json':actual.endsWith('.ts')?'ts':'js',resolveDir:path.dirname(a.path)};
 });
}};}
