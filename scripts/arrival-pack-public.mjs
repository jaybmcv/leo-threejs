// The arrival pack in the public site (src/v2/arrival-preview.js): the arrival hall cut out of the same verified prepared
// walk the desktop loads, by scripts/build-arrival-pack.mjs (in its own process, for the heap), into
// prepared-walk-arrival/<hash>/. The asset manifest's 'walk-arrival' entry names it, with the prepared walk it was cut
// from (src/v2/arrival-start.js uses it only for that walk). A build takes a few seconds once the walk is decoded; it is
// kept in output/arrival-pack-cache/, keyed on the prepared walk, the builder and the modules it imports, the layout it
// reads the hall from, the lockfile and the Node version.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import {build} from 'esbuild';
export async function publishArrivalPack(out,{source='output/leo-interior-v02/prepared-walk',prepared}){
 if(!prepared?.sha256)throw Error('Arrival pack: the prepared walk has no sha256');
 const parent=path.resolve(out,'prepared-walk-arrival'),staging=path.join(parent,'staging');if(!parent.startsWith(path.resolve(process.cwd())+path.sep))throw Error('Arrival pack output is outside the workspace');
 await fs.mkdir(parent,{recursive:true});await fs.rm(staging,{recursive:true,force:true});
 // The builder and every local module it imports (the paintings' placement among them: esbuild's metafile), the layout it
 // reads the hall from, the lockfile and Node.
 const graph=await build({entryPoints:['scripts/build-arrival-pack.mjs'],bundle:true,write:false,metafile:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
 const inputs=Object.keys(graph.metafile.inputs).filter(f=>!f.startsWith('node_modules/')).sort();
 const key=crypto.createHash('sha256').update(prepared.sha256);for(const f of [...inputs,'output/leo-interior-v02/layout.json','package-lock.json'])key.update(f).update(await fs.readFile(f));
 const cached=path.resolve('output/arrival-pack-cache',key.update(process.version).digest('hex').slice(0,20));
 if(await fs.access(path.join(cached,'integrity.json')).then(()=>true,()=>false))await fs.cp(cached,staging,{recursive:true});
 else{execFileSync(process.execPath,['--max-old-space-size=12000','scripts/build-arrival-pack.mjs',source,staging,'--source-id',prepared.sha256],{stdio:['ignore','ignore','inherit']});
  await fs.rm(path.dirname(cached),{recursive:true,force:true});await fs.cp(staging,cached,{recursive:true});}
 const report=JSON.parse(await fs.readFile(path.join(staging,'integrity.json'),'utf8'));
 if(report.source!==prepared.sha256)throw Error('Arrival pack was cut from another prepared walk');
 const name=report.sha256.slice(0,20),destination=path.join(parent,name);
 for(const entry of await fs.readdir(parent,{withFileTypes:true}))if(entry.isDirectory()&&entry.name!=='staging')await fs.rm(path.join(parent,entry.name),{recursive:true});
 await fs.rename(staging,destination);
 const directory='prepared-walk-arrival/'+name+'/';let compressedBytes=0;
 for(const f of report.files){const bytes=await fs.readFile(path.join(destination,f));compressedBytes+=bytes.length;
  if(bytes.length>16*1048576)throw Error('Arrival pack file over the 16 MiB transport limit: '+f);
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==report.sha256)throw Error('Arrival pack does not match its integrity report: '+f);}
 console.log(`Arrival pack: ${(compressedBytes/1e6).toFixed(1)} MB download, ${report.render.kept} render and ${report.collision.triangles}+${report.collision.ground} collision/ground triangles (${report.seconds} s)`);
 return {directory,parts:report.files.map(f=>directory+f),compressedBytes,sha256:report.sha256,source:prepared.sha256,format:'leo-arrival-pack-v1'};
}
