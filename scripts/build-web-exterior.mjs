import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
// The viewer streams this meshopt copy of the exterior (60 MB → ~12 MB, ~5 MB over the wire). 16-bit positions keep
// about 1 cm on the 564 m hull. Downloads keep the lossless leo-exterior-refined.glb.
export async function buildWebExterior(source,target){
 await MeshoptEncoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
 const doc=await io.read(source);
 await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16,quantizeNormal:10}));
 await io.write(target,doc);
}
