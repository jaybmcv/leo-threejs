import {AFT_TOUR} from '../src/aft-tour.js';
import {createNoseCommons,NOSE_COMMONS} from '../src/nose-commons.js';
import {createTransit} from '../src/transit.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {copyBrandAssets} from './brand-assets.mjs';
import {buildCosmo} from './build-cosmo.mjs';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createNeighborhood,SPEC,DECKS,COMMONS,ROUTE} from '../src/model.js';
const out=path.resolve('output/leo-interior-v01');
// Keep the accepted exterior file, avoiding a costly rebuild for interior edits.
await fs.access(path.join(out,'leo-exterior.glb'));
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.({target:this});}).catch(e=>this.onerror?.(e));}};
const detail=createNeighborhood();detail.root.add(createTransit({minimumDeck:15,maximumDeck:19,coreIds:['forward']}).root);detail.root.traverse(o=>{if(o.isMesh)o.geometry.normalizeNormals();});
detail.root.add(createNoseCommons(10).root);
const glb=await new GLTFExporter().parseAsync(detail.root,{binary:true,onlyVisible:true});
await fs.writeFile(path.join(out,'leo-neighborhood.glb'),Buffer.from(glb));
const result=await build({entryPoints:['src/viewer.js'],bundle:true,minify:true,format:'iife',write:false,target:'es2022',legalComments:'eof'});
const html=(await fs.readFile('src/viewer.html','utf8')).replace('/* BUNDLE */',()=>result.outputFiles[0].text.replaceAll('</script','<\\/script'));
await fs.writeFile(path.join(out,'index.html'),html);await copyBrandAssets(out);await buildCosmo(out);
await fs.writeFile(path.join(out,'design-data.json'),JSON.stringify({spec:SPEC,decks:DECKS,commons:COMMONS,noseCommons:NOSE_COMMONS,route:ROUTE},null,2));
await fs.copyFile('README.md',path.join(out,'README.md'));
console.log(`Updated interior GLB (${(glb.byteLength/1048576).toFixed(2)} MB) and viewer. Exterior retained.`);

await fs.writeFile(path.join(out,'aft-journey.json'),JSON.stringify({name:'Residential / engineering / fin crown',stops:AFT_TOUR,transfers:'Scene cuts between decks; lift travel is illustrative'},null,2));
