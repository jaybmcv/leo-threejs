import {hydrateAtriumGeometryPackAsync} from './atrium-geometry-pack.js';
import {getAtriumQuality,recommendAtriumQuality} from './atrium-quality.js';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function decodePart(entry,descriptor,fetchBytes){
 const name=entry.parts?.[descriptor.part];
 if(typeof name!=='string'||!/(?:^|\/)atrium-geometry-[a-f0-9]{64}\.bin$/.test(name)||name.includes('..'))throw Error('Invalid atrium part');
 if(!Number.isInteger(descriptor.bytes)||descriptor.bytes<0||descriptor.bytes>16*1048576||!Number.isInteger(descriptor.decodedBytes)||descriptor.decodedBytes<0||descriptor.decodedBytes>8*1048576)throw Error('Invalid atrium part size');
 const bytes=await fetchBytes(name);if(bytes.byteLength!==descriptor.bytes||await hash(bytes)!==descriptor.sha256)throw Error('Atrium transport integrity mismatch');
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),pieces=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>descriptor.decodedBytes)throw Error('Atrium decoded size exceeded');pieces.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}
 if(size!==descriptor.decodedBytes)throw Error('Atrium decoded size mismatch');const decoded=new Uint8Array(size);let offset=0;for(const piece of pieces){decoded.set(piece,offset);offset+=piece.length;}
 if(await hash(decoded)!==descriptor.decodedSha256)throw Error('Atrium decoded integrity mismatch');return decoded;
}
export async function loadAtriumGeometryTransport(baked,assets,{variant,getQuality,fetchBytes=async name=>{const r=await fetch(name,{cache:'force-cache'});if(!r.ok)throw Error('Atrium pack HTTP '+r.status);return new Uint8Array(await r.arrayBuffer());}}){
 const entry=assets?.['atrium-geometry'],expected=assets?.['walk-prepared']?.sha256,v=entry?.variants?.[variant];
 if(entry?.format!=='leo-atrium-geometry-transport-v1'||!expected||entry.sourceArtifact!==expected||!v)throw Error('No compatible atrium geometry pack');
 const limit=variant==='constrained'?48*1048576:128*1048576;
 if(v.memoryBudgetBytes!==limit||!Number.isInteger(v.binary.bytes)||v.binary.bytes<0||v.binary.bytes>limit||!Array.isArray(v.binary.parts)||v.binary.parts.length>40)throw Error('Invalid atrium pack budget');
 const manifestBytes=await decodePart(entry,v.manifest,fetchBytes),manifest=JSON.parse(new TextDecoder().decode(manifestBytes));
 const chunks=[];
 // Decode only pool chunks referenced by the selected variant.
 for(const part of v.binary.parts)chunks.push({offset:part.poolOffset,bytes:await decodePart(entry,part,fetchBytes)});
 const {decodeAtriumGeometryTransport}=await import('./atrium-geometry-transport.js');
 const binary=await decodeAtriumGeometryTransport(manifest,chunks,{maxBinaryBytes:limit});
 if(binary.length!==v.binary.bytes||await hash(binary)!==v.binary.sha256)throw Error('Atrium binary integrity mismatch');
 return hydrateAtriumGeometryPackAsync(baked,{manifest,binary},{getQuality,expectedSourceArtifact:expected,memoryBudgetBytes:limit});
}
// The first playable frame uses the existing complete ship. Download/decode never
// gates readiness, and missing packs never invoke expensive client simplification.
export function createAtriumGeometryRuntime(baked,renderer,{getQuality:quality=getAtriumQuality,deviceHints,assets=globalThis.window?.LEO_PUBLIC_ASSETS,isPlayable=()=>globalThis.document?.body?.dataset.ready==='1',load=loadAtriumGeometryTransport}={}){
 // Keep the fuller optimization coverage on capable PCs, even in Performance.
 const variant=recommendAtriumQuality(deviceHints)==='performance'?'constrained':'desktop';
 const stats={ready:false,enabled:true,state:'waiting-first-frame',variant,runtimeGeneration:false,blockingBuildMs:0};
 let controller=null,started=false,disposed=false,enabled=true;
 return {stats,update(camera,height){
  if(disposed)return;
  if(controller){controller.update(camera,height);Object.assign(stats,controller.stats,{state:'ready',variant,runtimeGeneration:false,blockingBuildMs:0,offlineSimplificationMs:controller.stats.simplificationMs,simplificationMs:0});return;}
  if(started||globalThis.__leoPreparedBuild||!isPlayable())return;
  started=true;if(!assets?.['atrium-geometry']){stats.state='unavailable';return;}stats.state='loading';stats.startedAfterFirstFrame=true;stats.loadStartedAt=performance.now();
  Promise.resolve().then(()=>load(baked,assets,{variant,getQuality:quality})).then(value=>{
   if(disposed){value.dispose();return;}controller=value;controller.setEnabled(enabled);stats.loadMs=performance.now()-stats.loadStartedAt;Object.assign(stats,controller.stats,{state:'ready',variant,runtimeGeneration:false,blockingBuildMs:0,offlineSimplificationMs:controller.stats.simplificationMs,simplificationMs:0});
  }).catch(error=>{if(!disposed){stats.state='unavailable';stats.error=String(error.message||error);console.warn('Atrium detail pack unavailable; retaining the complete original view.',error);}});
 },setEnabled(value){enabled=!!value;stats.enabled=enabled;controller?.setEnabled(enabled);},dispose(){disposed=true;controller?.dispose();stats.state='disposed';stats.enabled=false;}};
}
