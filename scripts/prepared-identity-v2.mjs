import fs from 'node:fs/promises';
import {geometryIdentity,sha} from './fast-dependencies-v2.mjs';

export const preparedSourceIdentity=geometryIdentity;
export async function compatiblePreparedSources(previous,current){
 if(previous?.hash===current.hash)return true;
 if(previous?.version>=2)return false;
 // Upgrade only the exact non-geometric migration from the old all-src hash.
 let migration={};try{migration=JSON.parse(await fs.readFile('scripts/fast-deploy-migration.json','utf8'));}catch{}
 for(const [file,value]of Object.entries(current.files)){
  if(previous?.files?.[file]===value)continue;
  const pair=migration[file];if(!pair||pair.before!==previous?.files?.[file]||pair.after!==value)return false;
 }
 return !!previous?.files;
}
export async function requirePreparedFresh(base='output/leo-interior-v02/prepared-walk'){
 const i=JSON.parse(await fs.readFile(base+'/integrity.json','utf8'));
 if(!i.sourceInputs?.sources)throw Error('Prepared walk lacks geometry provenance; run npm run build');
 const current=await preparedSourceIdentity();
 if(!await compatiblePreparedSources(i.sourceInputs.sources,current))throw Error('Prepared geometry changed; run node scripts/build-fast-v2.mjs (or npm run build for a full rebuild)');
 for(const [name,file]of Object.entries({skin:'leo-exterior-web.glb',layout:'layout.json',plan:'walk-plan.json'}))if(sha(await fs.readFile('output/leo-interior-v02/'+file))!==i.sourceInputs[name])throw Error('Prepared walk input changed: '+file+'; rebuild geometry');
 return i;
}
