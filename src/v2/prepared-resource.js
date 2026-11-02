import {readPreparedWorld} from './prepared-codec.js';
const status=text=>{const element=document.getElementById('loading-text');if(element)element.textContent=text;};
let loaded=await readPreparedWorld(new URL(typeof __PREPARED_URL__!=='undefined'?__PREPARED_URL__:'./prepared-walk/',import.meta.url),{status,metadataName:typeof __PREPARED_META__!=='undefined'?__PREPARED_META__:'world.json.gz'});
export const preparedResource={ship:loaded.ship,geometryTemplates:loaded.geometryTemplates,manifest:{privacy:loaded.manifest.privacy},frost:await loaded.graph(loaded.manifest.frost)};

// Controllers keep the ship/templates/frost. Release transport metadata and the temporary graph factory.
loaded=null;
