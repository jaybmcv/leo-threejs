// Desktop band piece size by GPU (src/v2/desk-piece.js).
import assert from 'node:assert/strict';
import {DESK_PIECE,deskPieceSize,discreteGpu,gpuName} from '../src/v2/desk-piece.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const q=s=>new URLSearchParams(s);
const discrete=['ANGLE (NVIDIA, NVIDIA GeForce RTX 3090 (0x00002204) Direct3D11 vs_5_0 ps_5_0, D3D11)','NVIDIA GeForce GTX 1060/PCIe/SSE2','ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0, D3D11)','AMD Radeon Pro 5500M OpenGL Engine','ANGLE (Radeon (TM) RX 480 Graphics Direct3D11 vs_5_0 ps_5_0)','AMD Radeon(TM) RX 6600 XT','NVIDIA GeForce GTX 980, or similar'];
const small=['Apple M3','Apple GPU','ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)','ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)','ANGLE (Intel, Intel(R) Arc(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)','ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)','AMD Radeon 780M','Radeon(TM) 780M','AMD Radeon Vega 8 Graphics','Radeon R9 200 Series, or similar',
 'Intel(R) Arc(TM) A750 Graphics, or similar','ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)','ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)','WebKit WebGL','',undefined];
for(const g of discrete)assert.equal(deskPieceSize({gpu:g}),DESK_PIECE.discrete,g);pass('discrete NVIDIA and Radeon RX and Pro cards draw 200k pieces, trademark marks or not');
for(const g of small)assert.equal(deskPieceSize({gpu:g}),DESK_PIECE.small,String(g));pass('Apple, integrated (Intel Arc included: Firefox names the integrated one an A750), software and unknown GPUs draw 100k pieces');
assert.equal(deskPieceSize({phone:true,gpu:discrete[0],query:q('deskpiece=300000')}),0);pass('phones draw one mesh per material, whatever is asked');
assert.equal(deskPieceSize({query:q('deskpiece=0'),gpu:discrete[0]}),0);assert.equal(deskPieceSize({query:q('deskpiece=200000'),gpu:'Apple M3'}),200000);
assert.equal(deskPieceSize({query:q('deskpiece=abc'),gpu:'Apple M3'}),DESK_PIECE.small);assert.equal(deskPieceSize({query:q('deskpiece='),gpu:discrete[0]}),DESK_PIECE.discrete);
assert.equal(deskPieceSize({query:q('deskpiece=-5'),gpu:discrete[0]}),DESK_PIECE.discrete);pass('?deskpiece= sets any size (the owner bake pins its own); a bad one is ignored');
const gl=(name,withExt=true)=>({RENDERER:7937,getExtension:n=>withExt&&n==='WEBGL_debug_renderer_info'?{UNMASKED_RENDERER_WEBGL:37446}:null,getParameter:p=>p===37446?name:p===7937?'WebKit WebGL':null});
assert.equal(gpuName(gl('NVIDIA GeForce RTX 3090')),'NVIDIA GeForce RTX 3090');assert.equal(gpuName(gl('x',false)),'WebKit WebGL');
assert.equal(gpuName({getExtension(){throw Error('lost');}}),'');assert.equal(discreteGpu(gpuName(gl('x',false))),false);pass('the unmasked name when the browser gives it, else the masked one, else nothing');
console.log(`desk piece: ${passed} checks passed`);
