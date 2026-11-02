// Shared data extraction only: no ship build or geometry changes.
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {buildLiveV2} from './build-live-v2.mjs';
import {applyV2Adapters} from './v2-adapters.mjs';
export async function liveSpatialFixtures(){
 const current=await buildLiveV2({entry:'src/v2/live-spatial.js',outfile:'output/launch-h/spatial-v2.mjs'});
 const legacy='output/launch-h/spatial-v1.mjs';
 await build({entryPoints:['src/v2/live-spatial.js'],outfile:legacy,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent',plugins:[{name:'legacy-spatial',setup(b){
  b.onResolve({filter:/^v2-live-identity$/},()=>({path:'legacy',namespace:'identity'}));b.onLoad({filter:/.*/,namespace:'identity'},()=>({contents:'export const LIVE_IDENTITY=null;',loader:'js'}));
  b.onResolve({filter:/.*/},a=>a.kind==='entry-point'?{path:path.resolve(a.path)}:a.path.startsWith('.')?{path:path.resolve(a.resolveDir,a.path)}:{path:a.path,external:true});
  b.onLoad({filter:/[\\/]walk[\\/]arcade\.js$/},async a=>({contents:applyV2Adapters('src/walk/arcade.js',await fs.readFile(a.path,'utf8')),loader:'js'}));
 }}]});
 return {v1:await import(pathToFileURL(path.resolve(legacy)).href),v2:await import(current.href)};
}
