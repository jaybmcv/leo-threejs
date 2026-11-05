// The phone ship in the public site (PHONE_WALK.md step 3): a light copy of the same verified prepared walk the desktop
// loads, made by scripts/build-phone-walk.mjs (in its own process, for the heap), into prepared-walk-phone/<hash>/.
// The asset manifest's 'walk-phone' entry names it; walk.html sends phones to it.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
export async function publishPhoneWalk(out,{source='output/leo-interior-v02/prepared-walk',prepared}){
 const parent=path.resolve(out,'prepared-walk-phone'),staging=path.join(parent,'staging');if(!parent.startsWith(path.resolve(process.cwd())+path.sep))throw Error('Phone walk output is outside the workspace');
 await fs.rm(staging,{recursive:true,force:true});
 execFileSync(process.execPath,['--max-old-space-size=12000','scripts/build-phone-walk.mjs',source,staging],{stdio:['ignore','ignore','inherit']});
 const report=JSON.parse(await fs.readFile(path.join(staging,'integrity.json'),'utf8')),name=report.sha256.slice(0,20),destination=path.join(parent,name);
 for(const entry of await fs.readdir(parent,{withFileTypes:true}))if(entry.isDirectory()&&entry.name!=='staging')await fs.rm(path.join(parent,entry.name),{recursive:true});
 await fs.rename(staging,destination);
 const directory='prepared-walk-phone/'+name+'/',files=report.files;let compressedBytes=0;for(const f of files)compressedBytes+=(await fs.stat(path.join(destination,f))).size;
 console.log(`Phone ship: ${(compressedBytes/1e6).toFixed(1)} MB download, ${report.decodedMB} MB decoded, ${report.render.kept} render and ${report.collision.kept} collision triangles (${report.seconds} s)`);
 return {directory,metadataFile:'world.bin',parts:files.map(f=>directory+f),compressedBytes,decodedBytes:Math.round(report.decodedMB*1e6),sha256:report.sha256,source:prepared?.sha256??null};
}
