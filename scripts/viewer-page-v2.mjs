import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// Read source explicitly, so bundling also works in restricted worktrees with linked dependencies.
const viewerSourcePlugin={name:'v2-viewer-source',setup(b){b.onResolve({filter:/.*/},a=>({path:a.path.startsWith('.')?path.resolve(a.resolveDir||process.cwd(),a.path):path.isAbsolute(a.path)?a.path:require.resolve(a.path),namespace:'viewer-source'}));b.onLoad({filter:/.*/,namespace:'viewer-source'},async a=>({contents:await fs.readFile(a.path,'utf8'),loader:'js',resolveDir:path.dirname(a.path)}));}};
import {selectViewerLayout} from '../src/v2/viewer-data.js';
const sha=b=>createHash('sha256').update(b).digest('hex').slice(0,10);
const json=x=>JSON.stringify(x).replaceAll('<','\\u003c');
export async function viewerHTML({viewer,layoutFile,manifest={},stats}){const template=await fs.readFile(new URL('../src/v2/viewer.html',import.meta.url),'utf8');const counts=stats.cabins.toLocaleString('en-US')+' cabins · '+stats.berths.toLocaleString('en-US')+' berths<br>'+stats.shuttles+' escape shuttles · '+stats.decks+' decks · '+stats.gardens+' sky gardens';return template.replace('@@COUNTS@@',counts).replace('@@ROOMS@@',String(stats.rooms)).replace('@@CONFIG@@','window.LEO_PUBLIC_ASSETS='+json(manifest)+';window.LEO_VIEWER_LAYOUT='+json(layoutFile)+';').replace('@@VIEWER@@',viewer);}
export async function writeViewerPageV2(out,{layout,manifest={}}){
 await fs.mkdir(out,{recursive:true});const selected=selectViewerLayout(layout),payload=JSON.stringify(selected),layoutFile='viewer-layout.'+sha(payload)+'.json';await fs.writeFile(path.join(out,layoutFile),payload);
 const result=await build({entryPoints:[path.resolve('src/v2/viewer.js')],absWorkingDir:process.cwd(),tsconfigRaw:{},bundle:true,minify:true,format:'esm',target:'es2022',write:false,plugins:[viewerSourcePlugin]});const contents=result.outputFiles[0].contents,viewer='viewer.'+sha(contents)+'.js';await fs.writeFile(path.join(out,viewer),contents);const html=await viewerHTML({viewer,layoutFile,manifest,stats:selected.stats});await fs.writeFile(path.join(out,'index.html'),html);for(const name of await fs.readdir(out))if(((/^viewer[.][0-9a-f]{10}[.]js$/).test(name)&&name!==viewer)||((/^viewer-layout[.][0-9a-f]{10}[.]json$/).test(name)&&name!==layoutFile))await fs.unlink(path.join(out,name));return {viewer,layoutFile,scriptBytes:contents.length,layoutBytes:Buffer.byteLength(payload),stats:selected.stats};
}
