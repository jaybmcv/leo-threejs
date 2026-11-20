import {readPreparedWorld} from './prepared-codec.public.js';
import {preparedFetcher} from './prepared-fetch.js';
import {arrivalStart,arrivalDownload} from './arrival-start.js';
const status=text=>{const element=document.getElementById('loading-text');if(element)element.textContent=text;};
// A phone walks a light copy of the whole ship, from a payload of its own (PHONE_WALK.md step 3,
// scripts/build-phone-walk.mjs): walk.html sets LEO_WALK_PHONE. It has the same format, with simpler shapes and collision
// and smaller pictures.
const phone=globalThis.LEO_WALK_PHONE&&globalThis.LEO_PUBLIC_ASSETS?.['walk-phone'];
// Every file of the payload gets a few tries (prepared-fetch.js). A failure here, as anywhere in the walk script's start,
// rejects the import that walk.html made, which puts the failure line on the loading card.
const base=phone?new URL('./'+phone.directory,import.meta.url):new URL(typeof __PREPARED_URL__!=='undefined'?__PREPARED_URL__:'./prepared-walk/',import.meta.url);
// Parts asked for ahead of the one being decoded: two on a desktop, so the link isn't idle for each part's round trip;
// one on the phone ship, whose memory peak is the decode's.
const PREFETCH=phone?1:2;
// The decoded ship, once it is.
export let preparedResource=null;
export const preparedResourceReady=(async()=>{
 // An arrival-hall start downloads the hall first (arrival-start.js).
 if(arrivalDownload)await arrivalDownload.settled;
 let loaded=await readPreparedWorld(base,{status,fetchBytes:preparedFetcher(base),prefetch:PREFETCH,metadataName:phone?phone.metadataFile:typeof __PREPARED_META__!=='undefined'?__PREPARED_META__:'world.json.gz'});
 preparedResource={ship:loaded.ship,geometryTemplates:loaded.geometryTemplates,manifest:{privacy:loaded.manifest.privacy},frost:await loaded.graph(loaded.manifest.frost),phone:loaded.manifest.phone||null};
 // Controllers keep the ship/templates/frost. Release transport metadata and the temporary graph factory.
 loaded.release();loaded=null;
 return preparedResource;
})();
// Every start waits for the ship here, before the rest of the walk script runs, as it always has; except a start in the
// arrival hall (arrival-start.js), whose script runs on while the ship downloads and walks the arrival pack meanwhile
// (arrival-preview.js). That start waits for it in loadPreparedShip (prepared-runtime.public.js), where a failure here
// still rejects the import walk.html made; until then the rejection is held, not reported twice.
if(arrivalStart)preparedResourceReady.catch(()=>{});
else await preparedResourceReady;
