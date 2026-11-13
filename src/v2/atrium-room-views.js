import * as T from 'three';

// What an atrium cabin looks like from inside, captured by the walk itself: a cube view from just inside the atrium
// window of one real cabin of each layout (door on either side), furnished and lit exactly as the walk lights it, its
// corridor glass frosted as every cabin's is until someone clears it. The card across each atrium window shows it (atrium-rooms.js),
// so every window shows its room at any distance, and little changes when the real cabin takes over near the camera.
//
// Each face is drawn on the walk's own canvas, just before a frame draws over it (main.public.js draw), and copied into
// the cube on the GPU. Drawing to the canvas keeps the renderer's state exactly as for a frame (tone mapping, output
// colour space, lights), so no shader is compiled for it: rendering into a separate target needed a new program variant
// for every material in view, and took over two minutes on the first try. Only the one cabin draws (a layer of its own
// that the lights join), and one face is taken per frame: 12 frames for the two views.
//
// `instanced` is the walk's list of instanced meshes (main.public.js): cabin parts carry userData.cabins and span, the
// furniture also userData.near ({all: matrices}) and cabinIds. A drawn part's hidden parents (the walk hides groups with
// nothing showing) show for the step. Everything a step changes is put back before it returns.
const sideOf=c=>{const dx=c.door.center[0]-c.x,dz=c.door.center[2]-c.z;return Math.sin(c.yaw)*dx+Math.cos(c.yaw)*dz>0?1:-1;};
// The cube's faces as THREE.CubeCamera draws them (+x, -x, +y, -y, +z, -z), so the cube samples by world direction.
const FACES=[[1,0,0,0,-1,0],[-1,0,0,0,-1,0],[0,1,0,0,0,1],[0,-1,0,0,0,-1],[0,0,1,0,-1,0],[0,0,-1,0,-1,0]];
const LAYER=7;

// The eye stands ROOM_VIEW_EYE metres from the room's middle towards its atrium window, just inside the glass: a camera
// in the atrium looks in through that window, so what it would see first (the desk and the beds' heads by the window)
// is what the capture holds, not only what lies beyond the middle of the room.
export const ROOM_VIEW_EYE=3.3;
// Returns a job: call step() once per frame before the frame draws; it returns the views (Map side -> {full: the cube,
// rotation: the cabin's, eye: where the view was taken from, measured from the room's middle}) when the last one is
// taken, else null. views.ms is the time the steps took together. 512 pixels a face: from beside the window the far
// wall is 7 m off and fills a third of a face.
export function atriumRoomViewJob(renderer,scene,instanced,placements,{size=512,hide=[],deckY=4.3}={}){
 const canvas=renderer.domElement;size=Math.min(size,2**Math.floor(Math.log2(Math.min(canvas.width,canvas.height))));
 const cabins=placements.filter(c=>c.view==='atrium'&&c.type==='twin'&&c.door&&Math.abs(c.y-deckY)<.2),todo=[],views=new Map();views.ms=0;
 for(const side of [-1,1]){const list=cabins.filter(c=>sideOf(c)===side).sort((a,b)=>a.x-b.x);if(!list.length)continue;
  const c=list[list.length>>1];views.set(side,{id:c.id,rotation:new T.Matrix3().setFromMatrix4(c.matrix),eye:new T.Vector3(0,0,-side*ROOM_VIEW_EYE)});
  for(let face=0;face<6;face++)todo.push({side,c,face});}
 const eye=new T.PerspectiveCamera(90,1,.05,40);eye.layers.set(LAYER);
 return {size,step(){
  const job=todo.shift();if(!job)return views;const started=performance.now(),{c,face}=job,centre=new T.Vector3(0,1.7,-job.side*ROOM_VIEW_EYE).applyMatrix4(c.matrix);
  const touched=[],layered=[],parents=new Map(),hidden=hide.map(o=>[o,o.visible]);for(const [o] of hidden)o.visible=false;
  const join=o=>{layered.push([o,o.layers.mask]);o.layers.enable(LAYER);};
  for(const o of instanced){const [a,b]=o.userData.span||[0,0];if(!o.userData.cabins||!(a<c.y+3.4&&b>c.y))continue;
   touched.push([o,o.visible,o.count,o.userData.near&&!o.userData.cabinWalls?o.instanceMatrix.array.slice(0,16):null]);let show=true;
   if(o.userData.near&&!o.userData.cabinWalls){const k=o.userData.cabinIds?.indexOf(c.id)??-1;
    if(k<0)show=false;else{o.instanceMatrix.array.set(o.userData.near.all[k].elements,0);o.count=1;o.instanceMatrix.needsUpdate=true;}}
   o.visible=show;if(show){join(o);for(let p=o.parent;p&&!p.isScene;p=p.parent)if(!p.visible&&!parents.has(p)){parents.set(p,false);p.visible=true;}}}
  // The frost on this deck's corridor glass joins too (cabin-privacy.js shows it only near the walker's height).
  scene.traverse(o=>{if(o.isLight)join(o);else if(o.name==='V2_default_cabin_frost'&&Math.abs(o.userData.y-c.y)<.2){join(o);hidden.push([o,o.visible]);o.visible=true;for(let p=o.parent;p&&!p.isScene;p=p.parent)if(!p.visible&&!parents.has(p)){parents.set(p,false);p.visible=true;}}});
  const view=views.get(job.side),target=view.full??=new T.WebGLCubeRenderTarget(size,{generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter,magFilter:T.LinearFilter});
  const viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest(),current=renderer.getRenderTarget();
  try{
   if(!face)renderer.initRenderTarget(target);const gl=renderer.getContext(),texture=renderer.properties.get(target.texture).__webglTexture,css=size/renderer.getPixelRatio();
   renderer.setRenderTarget(null);renderer.setViewport(0,0,css,css);renderer.setScissor(0,0,css,css);renderer.setScissorTest(true);
   const [x,y,z,ux,uy,uz]=FACES[face];eye.position.copy(centre);eye.up.set(ux,uy,uz);eye.lookAt(centre.x+x,centre.y+y,centre.z+z);eye.updateMatrixWorld(true);
   renderer.clear();renderer.render(scene,eye);gl.bindTexture(gl.TEXTURE_CUBE_MAP,texture);gl.copyTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+face,0,0,0,0,0,size,size);
   if(face===5)gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  }finally{
   renderer.resetState();renderer.setRenderTarget(current);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
   for(const [o,mask] of layered.reverse())o.layers.mask=mask;
   for(const [o,visible,count,first] of touched){o.visible=visible;o.count=count;if(first){o.instanceMatrix.array.set(first,0);o.instanceMatrix.needsUpdate=true;}}
   for(const [o,visible] of hidden)o.visible=visible;for(const [p,visible] of parents)p.visible=visible;
  }
  // The canvas holds the frame's final colours (tone mapped, sRGB): the stand-ins show them as they are.
  views.ms+=performance.now()-started;views.worst=Math.max(views.worst||0,performance.now()-started);
  return todo.length?null:views;
 }};
}
