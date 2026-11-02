import {ZSTDDecoder} from 'three/addons/libs/zstddec.module.js';
let modelDecoder;
// Static hosting transport: lossless gzip chunks preserve the source GLBs.
// Phones on mobile data drop a download now and then, which used to stop the viewer until a refresh: each part gets a
// few tries. The parts stream through the decompressor into one buffer of the model's exact size, so a model is never
// held twice over (the compressed parts and a growing copy) while it arrives.
const TRIES=3;
async function fetchPart(url,name){
 for(let attempt=1;;attempt++){
  try{
   const res=await fetch(url);
   if(res.ok&&res.body)return res;
   // Only a server hiccup is worth another try; a missing part stays missing.
   if(res.status<500||attempt>=TRIES)throw Object.assign(new Error(`Could not load ${name} (${res.status}). Please retry.`),{final:true});
  }catch(e){if(e.final||attempt>=TRIES)throw e.final?e:new Error(`Could not load ${name}: the connection dropped. Please retry.`);}
  await new Promise(r=>setTimeout(r,600*attempt));
 }
}
export async function publicAsset(name,onProgress){
 const entry=window.LEO_PUBLIC_ASSETS?.[name];
 if(!entry)return null;
 for(let attempt=1;;attempt++){
  try{return entry.transport==='shared-glb-blocks-zstd-v1'?await sharedAsset(name,entry,onProgress):await streamAsset(name,entry,onProgress);}
  catch(e){if(e.final||attempt>=TRIES)throw e;console.warn(`Retrying ${name}.`,e);}
 }
}
async function streamAsset(name,entry,onProgress){
 const bytes=new Uint8Array(entry.bytes),inflate=new DecompressionStream('gzip'),writer=inflate.writable.getWriter();
 let loaded=0,written=0;
 const reading=(async()=>{
  const reader=inflate.readable.getReader();
  for(;;){const {done,value}=await reader.read();if(done)break;
   if(written+value.byteLength>bytes.byteLength)throw new Error(`Incomplete model: ${name}`);
   bytes.set(value,written);written+=value.byteLength;}
 })().catch(e=>{writer.abort(e).catch(()=>{});throw e;});
 // A failed read stops the writes above (they would wait on a reader that has stopped); its error is the one thrown.
 reading.catch(()=>{});
 try{
  for(const part of entry.parts){
   const reader=(await fetchPart(part,name)).body.getReader();
   for(;;){const {done,value}=await reader.read();if(done)break;
    await writer.write(value);loaded+=value.byteLength;onProgress?.(Math.min(100,Math.round(loaded/entry.compressedBytes*100)));}
  }
  await writer.close();
 }catch(e){writer.abort(e).catch(()=>{});await reading;throw e;}
 await reading;
 if(written!==entry.bytes)throw new Error(`Incomplete model: ${name}`);
 return bytes.buffer;
}
export function enablePublicDownloads(){
 if(!window.LEO_PUBLIC_ASSETS)return;
 document.addEventListener('click',async e=>{
  const a=e.target.closest('a[download]');if(!a)return;
  const name=a.getAttribute('href');if(!window.LEO_PUBLIC_ASSETS[name])return;
  e.preventDefault();if(a.dataset.busy)return;
  a.dataset.busy='1';const label=a.textContent;
  try{
   const b=await publicAsset(name,p=>a.textContent=`Preparing download… ${p}%`);
   const url=URL.createObjectURL(new Blob([b],{type:'model/gltf-binary'}));
   const link=document.createElement('a');link.href=url;link.download=name;link.click();
   setTimeout(()=>URL.revokeObjectURL(url),60000);a.textContent=label;
  }catch(err){a.textContent='Download failed — click to retry';a.title=err.message;}
  finally{delete a.dataset.busy;}
 });
}

async function sharedAsset(name,entry,onProgress){modelDecoder??=new ZSTDDecoder();await modelDecoder.init();const bytes=new Uint8Array(entry.bytes),by=new Map(),recipeBytes=await(await fetchPart(entry.recipePart,name)).arrayBuffer(),recipe=JSON.parse(new TextDecoder().decode(modelDecoder.decode(new Uint8Array(recipeBytes))));for(const[index,offset,length,to]of recipe){const part=entry.parts[index],a=by.get(part)||[];a.push({offset,length,to});by.set(part,a)}let loaded=recipeBytes.byteLength;for(const[part,segments]of by){const compressed=await(await fetchPart(part,name)).arrayBuffer(),b=modelDecoder.decode(new Uint8Array(compressed));for(const r of segments)bytes.set(b.subarray(r.offset,r.offset+r.length),r.to);loaded+=compressed.byteLength;onProgress?.(Math.min(100,Math.round(loaded/entry.compressedBytes*100)));await new Promise(r=>setTimeout(r,0))}const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==entry.sha256)throw Error('Incomplete model: '+name);return bytes.buffer}
