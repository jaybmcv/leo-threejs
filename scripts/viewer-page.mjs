import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {buildCosmo} from './build-cosmo.mjs';

// Writes the viewer page: index.html plus the viewer script and Cosmo as content-hashed files next to it, so the page
// stays small and the scripts can be cached for a year (a change always gets a new name).
const hashed=(name,text)=>`${name}.${createHash('sha256').update(text).digest('hex').slice(0,10)}.js`;
const HASHED_SCRIPT=/^(viewer|cosmo)\.[0-9a-f]{10}\.js$/;

export async function writeViewerPage(out){
 for(const name of await fs.readdir(out))if(HASHED_SCRIPT.test(name)||name==='cosmo.js')await fs.rm(path.join(out,name));
 const cosmo=await buildCosmo(),cosmoName=hashed('cosmo',cosmo);await fs.writeFile(path.join(out,cosmoName),cosmo);
 const result=await build({entryPoints:['src/viewer.js'],bundle:true,minify:true,format:'iife',write:false,target:'es2022',legalComments:'eof',define:{__COSMO_SCRIPT__:JSON.stringify(cosmoName)}});
 const viewer=result.outputFiles[0].text,viewerName=hashed('viewer',viewer);await fs.writeFile(path.join(out,viewerName),viewer);
 const html=(await fs.readFile('src/viewer.html','utf8')).replace('<script>/* BUNDLE */</script>',()=>`<script src="${viewerName}"></script>`);
 if(html.includes('/* BUNDLE */'))throw new Error('viewer.html lost its bundle placeholder');
 await fs.writeFile(path.join(out,'index.html'),html);
 return {viewer:viewerName,cosmo:cosmoName};
}
