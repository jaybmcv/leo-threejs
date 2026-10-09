import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
import fs from 'node:fs/promises';
import {bakeConcept} from './bake-concept.mjs';
// The viewer streams this meshopt copy of the exterior (60 MB → ~12 MB, ~5 MB over the wire). 16-bit positions keep
// about 1 cm on the 564 m hull. Downloads keep the lossless leo-exterior-refined.glb.
export async function buildWebExterior(source,target){
 await MeshoptEncoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
 // The concept shape and detail passes are baked in first (scripts/bake-concept.mjs).
 const doc=await io.readBinary(await bakeConcept(await fs.readFile(source)));
 await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16,quantizeNormal:10}));
 await io.write(target,doc);
}
