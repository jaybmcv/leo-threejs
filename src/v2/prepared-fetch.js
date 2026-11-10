// Downloads for the prepared walk (prepared-resource.public.js): each file gets a few tries with a short wait between,
// as the viewer's parts do (src/public-assets.js). A dropped connection or a server hiccup is worth another try; a
// missing file stays missing, and a device out of memory is not a download problem. The last failure is marked as a
// download, which the walk page's failure line reads (walk.html, LEO_WALK_FAILED).
export const PREPARED_TRIES=3;
export function preparedFetcher(base,{fetch=globalThis.fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),tries=PREPARED_TRIES,warn=console.warn}={}){
 const failed=(name,why,cause)=>Object.assign(Error('Prepared walk download failed: '+name+' ('+why+')',{cause}),{leoWalkFailure:'download'});
 return async name=>{
  const url=new URL(name,base);
  for(let attempt=1;;attempt++){
   let why;
   try{
    const r=await fetch(url);
    // The body is read inside the try: a connection that drops partway is as worth another try as one that never opens.
    if(r.ok)return await r.arrayBuffer();
    if(r.status<500||attempt>=tries)throw failed(name,r.status);
    why=r.status;
   }catch(e){
    if(e.leoWalkFailure||e instanceof RangeError)throw e;
    if(attempt>=tries)throw failed(name,'the connection dropped',e);
    why=e;
   }
   warn('Retrying '+name+'.',why);
   await wait(600*attempt);
  }
 };
}
