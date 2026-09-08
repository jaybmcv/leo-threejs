import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {refineExterior} from '../src/exterior-finish.js';
import {prepareCrownExterior,createFinCrown} from '../src/fin-crown.js';
const out='output/leo-interior-v01/';
const b=await fs.readFile(out+'leo-exterior.glb'),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh)o.name=o.parent.name;});
g.scene.updateMatrixWorld(true);prepareCrownExterior(g.scene);const stats=refineExterior(g.scene);
g.scene.getObjectByName('01_EXTERIOR_REFINED_V31').add(createFinCrown().root);
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
g.scene.traverse(o=>{if(o.isMesh)o.geometry.normalizeNormals();});const data=await new GLTFExporter().parseAsync(g.scene,{binary:true,onlyVisible:true});
await fs.writeFile(out+'leo-exterior-refined.glb',Buffer.from(data));await fs.writeFile(out+'exterior-refinement-report.json',JSON.stringify({revision:36,...stats,megabytes:data.byteLength/1048576},null,2));console.log(stats,data.byteLength/1048576+' MB');

await fs.writeFile(out+'passenger-window-schedule.json',JSON.stringify(stats.passengerWindows,null,2));
