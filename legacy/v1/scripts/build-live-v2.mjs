import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {v2Plugin} from './v2-plugin.mjs';
import {applyV2Adapters} from './v2-adapters.mjs';
// Same source modules, same checked adapters, same selected room frames as the browser.
export async function buildLiveV2({entry='server/live-core.mjs',outfile='output/launch-h/live-v2.mjs'}={}){
 const layout=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8'));
 await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',plugins:[v2Plugin(layout,{node:true,sourceAdapters:(file,source)=>{const s=applyV2Adapters(file,source);return file.startsWith('server/')?s.replaceAll('import.meta.url','new URL('+JSON.stringify('./'+path.relative(path.dirname(path.resolve(outfile)),path.resolve(file)).replaceAll('\\','/'))+',import.meta.url).href'):s;}})],logLevel:'silent'});
 const bytes=await fs.readFile(outfile);await fs.writeFile(outfile+'.json',JSON.stringify({layout:2,sha256:createHash('sha256').update(bytes).digest('hex'),entry,layoutData:'output/leo-interior-v02/layout.json'},null,2)+'\n');
 return pathToFileURL(path.resolve(outfile));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.env.LEO_LAYOUT!=='2')throw Error('Select LEO_LAYOUT=2 to build the live server');console.log((await buildLiveV2()).pathname);}
