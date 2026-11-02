import {EXTMeshoptCompression} from '@gltf-transform/extensions';import {reorder,quantize} from '@gltf-transform/functions';import {MeshoptEncoder} from 'meshoptimizer';
// Cut pressure triangles contain T junctions. A whole-ship 16-bit position grid
// moves the short edge away from its unsplit neighbour, exposing hairline cracks.
// Preserve Float32 positions and compress their bytes; normals can still quantize.
export async function compressExactExterior(document){await MeshoptEncoder.ready;await document.transform(reorder({encoder:MeshoptEncoder,target:'size'}),quantize({pattern:/^(?!POSITION$).*/,patternTargets:/^(?!POSITION$).*/,quantizeNormal:12}));document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});}
