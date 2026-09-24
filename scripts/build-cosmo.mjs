import path from 'node:path';
import {build} from 'esbuild';
// Cosmo (the crew cat: 5 MB of rig and embedded textures) ships as its own cosmo.js so the viewer's first paint
// never waits for it. It borrows the viewer's three.js through globalThis.LEO_THREE instead of bundling a second copy.
const threeFromViewer={name:'three-from-viewer',setup(b){b.onResolve({filter:/^three$/},()=>({path:path.resolve('src/vendor/three-global.cjs')}));}};
export async function buildCosmo(out){
 await build({entryPoints:['src/cosmo.js'],bundle:true,minify:true,format:'iife',globalName:'LeoCosmo',target:'es2022',legalComments:'eof',plugins:[threeFromViewer],outfile:path.join(out,'cosmo.js'),logLevel:'error'});
}
