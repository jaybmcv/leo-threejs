import fs from 'node:fs/promises';
import {geometryIdentity,sha} from './fast-dependencies-v2.mjs';

export const preparedSourceIdentity=geometryIdentity;
const validIdentity=value=>value?.files&&sha(JSON.stringify(value.files))===value.hash;
export function matchesExactPreparedMigration(previous,current,migration,{artifactSha256}={}){
 if(!validIdentity(previous)||!validIdentity(current)||previous.version>=2)return false;
 if(migration?.format!=='leo-exact-prepared-migration-v1'||migration.sourceHash!==previous.hash||migration.artifactSha256!==artifactSha256||migration.targetVersion!==current.version)return false;
 const files=Object.keys(current.files).sort();if(JSON.stringify(files)!==JSON.stringify(migration.targetFiles))return false;
 for(const file of files){if(previous.files[file]===current.files[file])continue;const pair=migration.pairs[file];if(!pair||pair.before!==previous.files[file]||pair.after!==current.files[file])return false;}
 return true;
}
export async function compatiblePreparedSources(previous,current,options={}){
 if(!validIdentity(previous)||!validIdentity(current))return false;
 if(previous.hash===current.hash)return true;
 if(previous.version>=2)return false;
 // Preserve the design branch's artifact-pinned migration, separately from the
 // existing main baseline. Neither migration authorizes later geometry edits.
 let design;try{design=JSON.parse(await fs.readFile('scripts/fast-prepared-design-migration.json','utf8'));}catch{}
 if(previous.hash===design?.sourceHash)return matchesExactPreparedMigration(previous,current,design,options);
 let migration;try{migration=JSON.parse(await fs.readFile('scripts/fast-deploy-migration.json','utf8'));}catch{return false;}
 for(const [file,value]of Object.entries(current.files)){if(previous.files[file]===value)continue;const pair=migration[file];if(!pair||pair.before!==previous.files[file]||pair.after!==value)return false;}
 return true;
}
export async function requirePreparedFresh(base='output/leo-interior-v02/prepared-walk'){
 const i=JSON.parse(await fs.readFile(base+'/integrity.json','utf8'));
 if(!i.sourceInputs?.sources)throw Error('Prepared walk lacks geometry provenance; run npm run build');
 const current=await preparedSourceIdentity();
 if(!await compatiblePreparedSources(i.sourceInputs.sources,current,{artifactSha256:i.sha256}))throw Error('Prepared geometry changed; run node scripts/build-fast-v2.mjs (or npm run build for a full rebuild)');
 for(const [name,file]of Object.entries({skin:'leo-exterior-web.glb',layout:'layout.json',plan:'walk-plan.json'}))if(sha(await fs.readFile('output/leo-interior-v02/'+file))!==i.sourceInputs[name])throw Error('Prepared walk input changed: '+file+'; rebuild geometry');
 return i;
}
