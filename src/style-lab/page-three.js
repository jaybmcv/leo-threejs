// three, as the page already has it: the walk publishes its own copy as globalThis.LEO_THREE (main.public.js), and the
// style lab's walk hook (walk-styles.js) is bundled with 'three' pointed here, so its targets, materials and meshes are
// the walk renderer's own kind. Only the names the style lab uses are listed.
const T=globalThis.LEO_THREE;
if(!T)throw new Error('Style lab: the walk has not published three (globalThis.LEO_THREE)');
export const {ShaderChunk,Vector2,Vector3,Color,Matrix4,DepthTexture,FloatType,HalfFloatType,WebGLRenderTarget,BufferGeometry,Float32BufferAttribute,ShaderMaterial,Mesh,Scene,Camera}=T;
