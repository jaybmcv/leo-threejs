

import {hydrateHullLayout,serializeHullLayout} from '../src/plan/envelope-data-v2.js';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {selectedRuntimeLayout} from '../src/plan/runtime-layout.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {liveLayoutIdentity} from './live-layout-identity.mjs';
const require=createRequire(import.meta.url),root=process.cwd();
// Only serializes selected data; all runtime and geometry code lives in source.
export function v2Plugin(layout,{node=false,sourceRef=null,sourceAdapters=null,dataDirectory=null,overview=false,preparedWalk=false,authoringWalk=false,identityProbe=false}={}){if(sourceRef)return {name:'legacy-source-reference',async setup(b){const {v2Plugin}=await import('../legacy/v1/scripts/v2-plugin.mjs');return v2Plugin(layout,{node,sourceRef,...(sourceAdapters?{sourceAdapters}:{}),dataDirectory,overview,preparedWalk,authoringWalk}).setup(b);}};layout=selectedRuntimeLayout(layout);const serialLayout=structuredClone(layout);if(overview&&serialLayout.hullPrototypes)serialLayout.hullPrototypes.prototypes=serialLayout.hullPrototypes.prototypes.map(({id,kind,deck,polygon})=>({id,kind,deck,polygon}));for(const c of [...serialLayout.cabins,...serialLayout.rooms])if(c.hullPrototype)delete c.hullPrototype;if(preparedWalk&&serialLayout.hullPrototypes)serialLayout.hullPrototypes.prototypes=serialLayout.hullPrototypes.prototypes.map(({id,ownerId,kind,deck,polygon,chart,rect,floorHoles})=>({id,ownerId,kind,deck,polygon,chart:{origin:chart.origin},rect,floorHoles}));if(preparedWalk){serialLayout.windows=[];delete serialLayout.hullPrototypes?.parity;serialLayout.decks=serialLayout.decks.map(({roomLine,...d})=>d);}const serialized=preparedWalk?JSON.stringify(serialLayout):serializeHullLayout(serialLayout,{packed:true}),runtimeFile=path.join(root,'output/leo-interior-v02/runtime/layout-'+createHash('sha256').update(serialized).digest('hex').slice(0,16)+'.json'),payload=dataDirectory?gzipSync(serialized,{level:authoringWalk?1:9}):null,payloadHash=payload?createHash('sha256').update(payload).digest('hex').slice(0,16):null,payloadParts=payload?Array.from({length:Math.ceil(payload.length/16777216)},(_,i)=>'layout.'+payloadHash+'.'+i+'.bin'):[];return {name:'leo-layout-2',setup(b){
 b.onStart(async()=>{if(node){await fs.mkdir(path.dirname(runtimeFile),{recursive:true});let valid=false;try{valid=(await fs.stat(runtimeFile)).size===Buffer.byteLength(serialized);}catch{}if(!valid){const temp=runtimeFile+'.'+process.pid+'.tmp';await fs.writeFile(temp,serialized);await fs.rename(temp,runtimeFile);}}if(dataDirectory){await fs.mkdir(dataDirectory,{recursive:true});for(let i=0;i<payloadParts.length;i++)await fs.writeFile(path.join(dataDirectory,payloadParts[i]),payload.subarray(i*16777216,(i+1)*16777216));await fs.writeFile(path.join(dataDirectory,'layout-data.json'),JSON.stringify({parts:payloadParts,bytes:Buffer.byteLength(serialized),compressedBytes:payload.length,sha256:createHash('sha256').update(serialized).digest('hex')}));}});
 b.onResolve({filter:/(?:^v2-live-identity$|[\\/]live-identity[.]js$)/},()=>({path:'identity',namespace:'v2-live-identity'}));
 b.onLoad({filter:/.*/,namespace:'v2-live-identity'},async()=>{
  if(identityProbe)return {contents:'export const LIVE_IDENTITY=null;',loader:'js'};
  const record=await liveLayoutIdentity(layout);if(dataDirectory)await fs.writeFile(path.join(dataDirectory,'live-layout.json'),JSON.stringify(record)+'\n');
  return {contents:'export const LIVE_IDENTITY='+JSON.stringify(record.layoutIdentity)+';',loader:'js'};
 });
 b.onResolve({filter:/(?:^v2-layout$|[\\/]selected-layout[.]js$)/},()=>({path:'layout',namespace:'v2-data'}));
 b.onLoad({filter:/.*/,namespace:'v2-data'},()=>({contents:(node?'import {readFileSync} from \'node:fs\';const layout=JSON.parse(readFileSync('+JSON.stringify(runtimeFile)+',\'utf8\'));':dataDirectory?'const chunks=await Promise.all('+JSON.stringify(payloadParts)+'.map(async name=>{const response=await fetch(new URL(name,import.meta.url));if(!response.ok)throw Error(\'Room geometry download failed\');return response.arrayBuffer();}));const layout=await new Response(new Blob(chunks).stream().pipeThrough(new DecompressionStream(\'gzip\'))).json();':'const layout='+serialized+';')+(preparedWalk?'export default layout;':'import {hydrateHullLayout} from '+JSON.stringify(path.join(root,'src/plan/envelope-data-v2.js').replaceAll('\\','/'))+';hydrateHullLayout(layout);export default layout;'),loader:'js'}));
 b.onResolve({filter:/.*/},a=>{
  if(/^(walk-partitions|walk-changes)$/.test(a.path))return null;
  if(node&&(!a.path.startsWith('.')&&!path.isAbsolute(a.path)))return {path:a.path,external:true};
  const p=a.path==='three'?path.join(root,'node_modules/three/build/three.module.js'):a.path.startsWith('.')?path.resolve(a.resolveDir||root,a.path):path.isAbsolute(a.path)?a.path:require.resolve(a.path);
  return {path:p,namespace:'v2-source'};
 });
 b.onLoad({filter:/.*/,namespace:'v2-source'},async a=>{
  let actual=a.path,s;try{s=await fs.readFile(actual,'utf8');}catch(e){if(!actual.endsWith('.js'))throw e;actual=actual.slice(0,-3)+'.ts';s=await fs.readFile(actual,'utf8');}const file=path.relative(root,actual).replaceAll('\\','/');
  s=sourceAdapters?sourceAdapters(file.replace(/\.(authoring|prepared|public)(\.(?:js|mjs|ts))$/,'$2'),s):s;
  return {contents:s,loader:actual.endsWith('.json')?'json':actual.endsWith('.ts')?'ts':'js',resolveDir:path.dirname(a.path)};
 });
}};}

export {runtimeLayout} from '../src/plan/runtime-layout.js';
