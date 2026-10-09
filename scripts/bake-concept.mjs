import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {applyConceptShape} from '../src/concept-shape.js';
import {applyConceptDetail} from '../src/concept-detail.js';

// Bakes the concept shape and detail passes into the streamed exterior, so visitors don't run them on every load
// (~0.3 s on a desktop, more on phones). The root is marked conceptBaked; the viewer then skips both passes. The paint
// pass, the aft interiors' fin drop, the tour stops and the escort shuttle stay at runtime.
globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
export async function bakeConcept(bytes){
 const g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh&&a?.meshes!==undefined)o.name=o.parent.name;});
 const exterior=g.scene.getObjectByName('01_EXTERIOR_REFINED_V31');if(!exterior)throw new Error('The saved exterior is missing its root');
 applyConceptShape(exterior);applyConceptDetail(exterior);exterior.userData.conceptBaked=1;
 return new Uint8Array(await new GLTFExporter().parseAsync(g.scene,{binary:true,onlyVisible:false}));
}
