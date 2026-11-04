import {readPreparedWorld} from './prepared-codec.public.js';
const status=text=>{const element=document.getElementById('loading-text');if(element)element.textContent=text;};
// A phone walks the Deck 2 arrival hall only, from a payload of its own (PHONE_WALK.md step 3, scripts/build-phone-walk.mjs):
// walk.html sets LEO_WALK_PHONE. It has the same format as the whole ship, cut down to the hall.
const phone=globalThis.LEO_WALK_PHONE&&globalThis.LEO_PUBLIC_ASSETS?.['walk-phone'];
let loaded=await readPreparedWorld(phone?new URL('./'+phone.directory,import.meta.url):new URL(typeof __PREPARED_URL__!=='undefined'?__PREPARED_URL__:'./prepared-walk/',import.meta.url),{status,metadataName:phone?phone.metadataFile:typeof __PREPARED_META__!=='undefined'?__PREPARED_META__:'world.json.gz'});
export const preparedResource={ship:loaded.ship,geometryTemplates:loaded.geometryTemplates,manifest:{privacy:loaded.manifest.privacy},frost:await loaded.graph(loaded.manifest.frost),phone:loaded.manifest.phone||null};

// Controllers keep the ship/templates/frost. Release transport metadata and the temporary graph factory.
loaded=null;
