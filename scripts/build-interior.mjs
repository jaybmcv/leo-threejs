import {AFT_TOUR,FIN_TOUR} from '../src/aft-tour.js';
import {createNoseCommons,NOSE_COMMONS} from '../src/nose-commons.js';
import {createTransit} from '../src/transit.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {copyBrandAssets} from './brand-assets.mjs';
import {writeViewerPage} from './viewer-page.mjs';
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
await writeViewerPage(out);await copyBrandAssets(out);
await fs.writeFile(path.join(out,'design-data.json'),JSON.stringify({spec:SPEC,decks:DECKS,commons:COMMONS,noseCommons:NOSE_COMMONS,route:ROUTE},null,2));
await fs.copyFile('README.md',path.join(out,'README.md'));
console.log(`Updated interior GLB (${(glb.byteLength/1048576).toFixed(2)} MB) and viewer. Exterior retained.`);

await fs.writeFile(path.join(out,'aft-journey.json'),JSON.stringify({name:'Residence to engineering',stops:AFT_TOUR,finCrown:{name:'Residence to the fin crown',stops:FIN_TOUR},transfers:'Scene cuts between decks; lift travel is illustrative'},null,2));
