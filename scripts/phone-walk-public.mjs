// The phone ship in the public site (PHONE_WALK.md step 3): a light copy of the same verified prepared walk the desktop
// loads, made by scripts/build-phone-walk.mjs (in its own process, for the heap), into prepared-walk-phone/<hash>/.
// The asset manifest's 'walk-phone' entry names it; walk.html sends phones to it. A build takes about 2 minutes, so it
// is kept in output/phone-walk-cache/, keyed on the prepared walk, the builder, the lockfile (meshoptimizer, sharp, three-mesh-bvh) and
// the Node version, for deploys that change none of them.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
export async function publishPhoneWalk(out,{source='output/leo-interior-v02/prepared-walk',prepared}){
 const parent=path.resolve(out,'prepared-walk-phone'),staging=path.join(parent,'staging');if(!parent.startsWith(path.resolve(process.cwd())+path.sep))throw Error('Phone walk output is outside the workspace');
 await fs.rm(staging,{recursive:true,force:true});
 const key=prepared?.sha256&&crypto.createHash('sha256').update(prepared.sha256).update(await fs.readFile('scripts/build-phone-walk.mjs')).update(await fs.readFile('package-lock.json')).update(process.version).digest('hex').slice(0,20),cached=key&&path.resolve('output/phone-walk-cache',key);
 if(cached&&await fs.access(path.join(cached,'integrity.json')).then(()=>true,()=>false))await fs.cp(cached,staging,{recursive:true});
 else{execFileSync(process.execPath,['--max-old-space-size=12000','scripts/build-phone-walk.mjs',source,staging],{stdio:['ignore','ignore','inherit']});
  if(cached){await fs.rm(path.dirname(cached),{recursive:true,force:true});await fs.cp(staging,cached,{recursive:true});}}
 const report=JSON.parse(await fs.readFile(path.join(staging,'integrity.json'),'utf8')),name=report.sha256.slice(0,20),destination=path.join(parent,name);
 for(const entry of await fs.readdir(parent,{withFileTypes:true}))if(entry.isDirectory()&&entry.name!=='staging')await fs.rm(path.join(parent,entry.name),{recursive:true});
 await fs.rename(staging,destination);
 const directory='prepared-walk-phone/'+name+'/',files=report.files;let compressedBytes=0;for(const f of files)compressedBytes+=(await fs.stat(path.join(destination,f))).size;
 console.log(`Phone ship: ${(compressedBytes/1e6).toFixed(1)} MB download, ${report.decodedMB} MB decoded, ${report.render.kept} render and ${report.collision.kept} collision triangles (${report.seconds} s)`);
 return {directory,metadataFile:'world.bin',parts:files.map(f=>directory+f),compressedBytes,decodedBytes:Math.round(report.decodedMB*1e6),sha256:report.sha256,source:prepared?.sha256??null};
}
