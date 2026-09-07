// Static hosting transport: lossless gzip chunks preserve the source GLBs.
export async function publicAsset(name,onProgress){
 const entry=window.LEO_PUBLIC_ASSETS?.[name];
 if(!entry)return null;
 let loaded=0;const chunks=[];
 for(const part of entry.parts){
  const res=await fetch(part);
  if(!res.ok)throw new Error(`Could not load ${name} (${res.status}). Please retry.`);
  const data=await res.arrayBuffer();chunks.push(data);loaded+=data.byteLength;
  onProgress?.(Math.min(100,Math.round(loaded/entry.compressedBytes*100)));
 }
 const stream=new Blob(chunks).stream().pipeThrough(new DecompressionStream('gzip'));
 const bytes=await new Response(stream).arrayBuffer();
 if(bytes.byteLength!==entry.bytes)throw new Error(`Incomplete model: ${name}`);
 return bytes;
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
