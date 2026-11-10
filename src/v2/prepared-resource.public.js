import {readPreparedWorld} from './prepared-codec.public.js';
import {preparedFetcher} from './prepared-fetch.js';
const status=text=>{const element=document.getElementById('loading-text');if(element)element.textContent=text;};
// A phone walks a light copy of the whole ship, from a payload of its own (PHONE_WALK.md step 3,
// scripts/build-phone-walk.mjs): walk.html sets LEO_WALK_PHONE. It has the same format, with simpler shapes and collision
// and smaller pictures.
const phone=globalThis.LEO_WALK_PHONE&&globalThis.LEO_PUBLIC_ASSETS?.['walk-phone'];
// Every file of the payload gets a few tries (prepared-fetch.js). A failure here, as anywhere in the walk script's start,
// rejects the import that walk.html made, which puts the failure line on the loading card.
const base=phone?new URL('./'+phone.directory,import.meta.url):new URL(typeof __PREPARED_URL__!=='undefined'?__PREPARED_URL__:'./prepared-walk/',import.meta.url);
let loaded=await readPreparedWorld(base,{status,fetchBytes:preparedFetcher(base),metadataName:phone?phone.metadataFile:typeof __PREPARED_META__!=='undefined'?__PREPARED_META__:'world.json.gz'});
export const preparedResource={ship:loaded.ship,geometryTemplates:loaded.geometryTemplates,manifest:{privacy:loaded.manifest.privacy},frost:await loaded.graph(loaded.manifest.frost),phone:loaded.manifest.phone||null};

// Controllers keep the ship/templates/frost. Release transport metadata and the temporary graph factory.
loaded.release();loaded=null;
