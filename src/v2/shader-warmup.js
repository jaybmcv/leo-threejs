// Compiles every shader the walk can need before its first view, so the first look at another area does not freeze
// while three.js compiles that area's materials (Nov 5, fresh browser: 3.9 s at the open atrium, 1.3 s at the Mudwater
// arena). A shader depends on the material, the kind of mesh, its geometry's attributes and the lights that are on, not
// on where the mesh is, so one sample of each kind is compiled, once for every state of the light groups the walk
// switches (the arrival hall's lamps add five point lights, which is part of every lit material's shader).
// It runs behind the loading card, all at once: the browser compiles in parallel where it has
// KHR_parallel_shader_compile, but its GPU process still spends ~20 ms of the thread that draws on each new shader, so
// spreading them over frames after the first view stuttered for seconds (2 a frame: 109 of 244 frames over 20 ms).
// Pictures are cheap to upload a frame at a time, and do so after the first view (uploadTextures).
export const WARM_WAIT_MS=6000;

// (An InstancedMesh keeps Mesh's `type`, so the kinds of mesh are told apart by their flags.)
const kindOf=o=>{const g=o.geometry;return [o.type,!!o.isInstancedMesh,!!o.isBatchedMesh,!!o.isSkinnedMesh,!!o.instanceColor,!!o.receiveShadow,Object.keys(g.attributes).join(),g.attributes.color?.itemSize,Object.keys(g.morphAttributes).join(),g.morphTargetsRelative].join('|');};
const drawn=o=>(o.isMesh||o.isPoints||o.isLine||o.isSprite)&&o.geometry&&o.material;
const count=renderer=>renderer.info.programs?.length??0;

/** One mesh per distinct shader under `root`, and every texture their materials read. */
export function shaderSamples(root){
 const samples=[],seen=new Set(),textures=new Set();
 root.traverse(o=>{
  if(!drawn(o))return;const kind=kindOf(o);
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   if(!m)continue;if(!seen.has(m.uuid+kind)){seen.add(m.uuid+kind);samples.push(o);}
   for(const v of Object.values(m))if(v?.isTexture)textures.add(v);
   for(const u of Object.values(m.uniforms||{}))if(u?.value?.isTexture)textures.add(u.value);
  }
 });
 return {samples,textures};
}

// Each subset of the switched groups shown in turn (their visibility flipped, then put back before anything draws).
function* lightStates(groups){
 for(let mask=0;mask<1<<groups.length;mask++){
  const flipped=groups.filter((g,i)=>mask&1<<i);for(const g of flipped)g.visible=!g.visible;
  try{yield;}finally{for(const g of flipped)g.visible=!g.visible;}
 }
}

/** `lights`: groups of lights the walk shows and hides. Resolves once every shader is ready or after `waitMs`, whichever
 * is first (the rest go on compiling), with what was done and the textures for uploadTextures. Never rejects: a
 * failure only leaves those shaders to compile when first seen. */
export async function warmShaders(renderer,scene,camera,{lights=[],waitMs=WARM_WAIT_MS}={}){
 const t0=performance.now(),before=count(renderer),{samples,textures}=shaderSamples(scene);
 const proof={samples:samples.length,programs:0,ready:false,ms:0};
 try{
  // three's compile walks `traverse` for meshes and `traverseVisible` for lights: the scene's own lights count once.
  const stand={traverse:fn=>samples.forEach(fn),traverseVisible(){}},pending=[];
  for(const _ of lightStates(lights))pending.push(renderer.compileAsync(stand,camera,scene));
  proof.ready=await Promise.race([Promise.all(pending).then(()=>true),new Promise(r=>setTimeout(r,waitMs,false))]);
 }catch(e){console.warn('Shader warm-up stopped.',e);}
 proof.programs=count(renderer)-before;proof.ms=Math.round(performance.now()-t0);
 return {proof,textures};
}

/** Uploads each texture not yet on the GPU, one per `wait()` (between frames). Resolves with how many it uploaded. */
export async function uploadTextures(renderer,textures,wait){
 let n=0;
 try{
  for(const t of textures){
   if(t.version===0||t.isVideoTexture||renderer.properties.get(t).__version===t.version)continue;
   renderer.initTexture(t);n++;await wait();
  }
 }catch(e){console.warn('Texture warm-up stopped.',e);}
 return n;
}
