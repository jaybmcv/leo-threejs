import fs from 'node:fs/promises';
import {geometryIdentity,sha} from './fast-dependencies-v2.mjs';

export const preparedSourceIdentity=geometryIdentity;

// Backport the upstream geometry-only contract. This branch's old all-src
// artifact has its own exact migration; it is not the upstream design baseline.
export async function compatiblePreparedSources(previous,current,{artifactSha256}={}){
 if(!previous?.files||!current?.files)return false;
 if(sha(JSON.stringify(previous.files))!==previous.hash||sha(JSON.stringify(current.files))!==current.hash)return false;
 if(previous.hash===current.hash)return true;
 if(previous.version>=2)return false;
 let migration;try{migration=JSON.parse(await fs.readFile('scripts/fast-prepared-design-migration.json','utf8'));}catch{return false;}
 if(migration.format!=='leo-exact-prepared-migration-v1'||migration.sourceHash!==previous.hash
  ||migration.artifactSha256!==artifactSha256||migration.targetVersion!==current.version)return false;
 const files=Object.keys(current.files).sort();
 if(JSON.stringify(files)!==JSON.stringify(migration.targetFiles))return false;
 for(const file of files){
  const value=current.files[file];if(previous.files[file]===value)continue;
  const pair=migration.pairs[file];
  if(!pair||pair.before!==previous.files[file]||pair.after!==value)return false;
 }
 return true;
}

export async function requirePreparedFresh(base='output/leo-interior-v02/prepared-walk'){
 const i=JSON.parse(await fs.readFile(base+'/integrity.json','utf8'));
 if(!i.sourceInputs?.sources)throw Error('Prepared walk lacks geometry provenance; run LEO_LAYOUT=2 npm run build');
 const current=await preparedSourceIdentity();
 if(!await compatiblePreparedSources(i.sourceInputs.sources,current,{artifactSha256:i.sha256}))
  throw Error('Prepared geometry changed; run LEO_LAYOUT=2 npm run build (runtime-only edits reuse verified geometry)');
 for(const [name,file]of Object.entries({skin:'leo-exterior-web.glb',layout:'layout.json',plan:'walk-plan.json'}))
  if(sha(await fs.readFile('output/leo-interior-v02/'+file))!==i.sourceInputs[name])throw Error('Prepared walk input changed: '+file+'; rebuild geometry');
 return i;
}
