import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt,weld,simplify} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import fs from 'node:fs/promises';
import {bakeConcept} from './bake-concept.mjs';
// The viewer streams this meshopt copy of the exterior (60 MB → ~12 MB, ~5 MB over the wire). 16-bit positions keep
// about 1 cm on the 564 m hull. Downloads keep the lossless leo-exterior-refined.glb.
// `phoneTarget` also gets a lighter copy for phones (the viewer's light mode): each mesh simplified to within 0.1 % of
// its size, ~0.3 m on the hull and finer on small parts, well under a pixel on a phone. Borders stay put so parts
// still meet. 1.42 M triangles become ~0.52 M; every node, name and material is kept.
export async function buildWebExterior(source,target,phoneTarget){
 await MeshoptEncoder.ready;await MeshoptSimplifier.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
 // The concept shape and detail passes are baked in first (scripts/bake-concept.mjs).
 const baked=await bakeConcept(await fs.readFile(source));
 const compress=meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16,quantizeNormal:10});
 const doc=await io.readBinary(baked);
 await doc.transform(compress);
 await io.write(target,doc);
 if(!phoneTarget)return;
 const phone=await io.readBinary(baked);
 await phone.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:0,error:1e-3,lockBorder:true}),compress);
 await io.write(phoneTarget,phone);
}
