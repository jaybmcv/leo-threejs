// How big a desktop's view-culled pieces of the merged deck bands are (phone-bands.js), by what limits the machine.
// Small pieces cut the triangles a GPU-bound machine draws: Apple and integrated GPUs (an M5 MacBook Air drew 11M at the
// open atrium, #455). A discrete desktop GPU is limited by the processor instead, where every piece is a draw: on an
// RTX 3090 at the atrium bench, 100k pieces drew 594 calls against 521 unsplit (about 0.5 ms more a frame), and 200k
// pieces 554 while keeping 68-86% of the triangle cut.
export const DESK_PIECE={small:100000,discrete:200000};

// A discrete card by its WebGL renderer name: NVIDIA, AMD Radeon RX or Pro, Intel Arc A-series. Integrated parts name
// themselves otherwise ("AMD Radeon(TM) Graphics", "Intel(R) Arc(TM) Graphics", "Intel(R) UHD Graphics", "Apple M3"), and
// software renderers never count.
const DISCRETE=/nvidia|geforce|quadro|radeon\s*(rx|pro)\b|arc\(tm\)\s*a\d{3}/i,SOFTWARE=/swiftshader|llvmpipe|softpipe|microsoft basic render/i;
export const discreteGpu=name=>typeof name==='string'&&DISCRETE.test(name)&&!SOFTWARE.test(name);

// The renderer's name as the browser reports it unmasked, or '' when it will not say.
export function gpuName(gl){
 try{const ext=gl.getExtension('WEBGL_debug_renderer_info');return String(gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)||'');}catch{return '';}
}

// {query: URLSearchParams, phone, gpu: renderer name}. Phones draw one mesh per material (0); ?deskpiece= sets any size (0
// for one mesh per material) and is how the owner bake pins the size it bakes for.
export function deskPieceSize({query,phone=false,gpu=''}={}){
 if(phone)return 0;
 const v=query?.get('deskpiece');if(v!==null&&v!==undefined&&v!==''&&Number.isFinite(+v)&&+v>=0)return +v;
 return discreteGpu(gpu)?DESK_PIECE.discrete:DESK_PIECE.small;
}
