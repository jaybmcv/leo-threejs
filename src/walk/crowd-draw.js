import * as T from 'three';

// Other visitors drawn together (remotes.js). Each visitor's body was four draws (its two merged skinned meshes and its
// two shoes: merged-skin.js), so 24 in view cost 96, each with its own program setup, uniforms and bone texture. Here
// every visitor's bone matrices live in one texture, a row each (its skeleton writes straight into it), and each kind of
// body part is one instanced draw for all the visitors in view: the geometry once, each instance's row given by an
// attribute, skinned in the vertex shader as three skins one figure (three's own mesh and inverse-bind matrices
// multiply to the identity for an attached skin, so the skin comes out in world space). Visitors' parts differ only in
// their fur colour (the body's map image, fur.js) and their eyes (shut in a hammock: their uvs, avatar.js), so there is a
// draw for each part, colour and eye state in use. The hat, the catnip face, the swimsuit, the board and the grapple
// line still draw on their own.
//   createCrowdDraw(scene, {slots, lean}) -> {add(walker), update(camera, {all}): before rendering (all: draw every
//   body, in view or not, as for the selfie booth's camera); enabled (false: each visitor draws its own meshes again);
//   groups, members, texture (checks)}. lean: each part in leanMaterial's place of its own (a phone's).
// A walker needs cacheBones (figure-matrices.js): its bone texture row is rebuilt only when its matrices were remade.

// Room round a body's parts' own bounds (merged-skin.js, dlCatFigure.ts: wide enough for any pose) for how far it may
// have moved since its matrices were last made: a frame's run or ride.
const MOVED_M=.5;
const PARS=`
uniform highp sampler2D crowdBones;
uniform mat4 crowdBind;
attribute float crowdSlot;
attribute vec4 skinIndex;
attribute vec4 skinWeight;
mat4 crowdBone( const in float i ) {
	int x = int( i ) * 4;
	int y = int( crowdSlot );
	return mat4( texelFetch( crowdBones, ivec2( x, y ), 0 ), texelFetch( crowdBones, ivec2( x + 1, y ), 0 ),
		texelFetch( crowdBones, ivec2( x + 2, y ), 0 ), texelFetch( crowdBones, ivec2( x + 3, y ), 0 ) );
}`;
const BASE=`
	mat4 boneMatX = crowdBone( skinIndex.x );
	mat4 boneMatY = crowdBone( skinIndex.y );
	mat4 boneMatZ = crowdBone( skinIndex.z );
	mat4 boneMatW = crowdBone( skinIndex.w );`;
const NORMAL=`
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = skinMatrix * crowdBind;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif`;
const SKIN=`
	vec4 skinVertex = crowdBind * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = skinned.xyz;`;
// A visitor's part shaded cheaply, for a phone: Lambert with its colour map only, front faces only. A phone's GPU is
// short of pixels, not draws, and with the logarithmic depth buffer (main.public.js) its shaders write the depth, so
// every pixel of a body is shaded even behind another. The walk's own GPU, timed at 5760x3240 with 200 visitors from
// 4 m, each way in turn: the visitors 2.9 ms in their own materials (Physical and Standard, with
// normal, roughness and metalness maps, both faces), 1.6 ms front faces only, 0.8 ms so. They look much the same from a
// few metres: the colours keep, the folds of the hoodie flatten, the shine goes. (Standard without its maps is no
// cheaper and darker: its metalness then applies everywhere.)
export function leanMaterial(source){
 return new T.MeshLambertMaterial({name:source.name,color:source.color,map:source.map,vertexColors:source.vertexColors,
  transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,side:T.FrontSide});
}
// The vertex shader with three's skinning chunks (empty here: the draw is not a SkinnedMesh) replaced by the crowd's.
// pars: what declares crowdBone(i) and crowdBind (this draw's: a visitor's own row of the shared bone texture; the
// crowd tier's: a recorded frame of a loop, crowd-tier.js).
export function crowdShader(vertexShader,pars=PARS){
 for(const chunk of ['#include <common>','#include <skinbase_vertex>','#include <skinnormal_vertex>','#include <skinning_vertex>'])
  if(!vertexShader.includes(chunk))throw Error('crowd draw: the vertex shader has no '+chunk);
 return vertexShader.replace('#include <common>','#include <common>'+pars).replace('#include <skinbase_vertex>',BASE)
  .replace('#include <skinnormal_vertex>',NORMAL).replace('#include <skinning_vertex>',SKIN);
}

const ids=new WeakMap();let nextId=1;
const idOf=o=>{if(!o)return 0;let id=ids.get(o);if(!id)ids.set(o,id=nextId++);return id;};

export function createCrowdDraw(scene,{slots=24,lean=false}={}){
 let width=0,bones=0,data=null,texture=null,frame=-1,enabled=true;
 const members=[],groups=new Map(),frustum=new T.Frustum(),view=new T.Matrix4(),sphere=new T.Sphere(),drawnNow=[];
 const crowdMaterial=(source,bindMatrix)=>{
  const m=lean?leanMaterial(source):source.clone();
  // The map's image is shared by every visitor of that fur colour; the texture is the visitor's own, and fur.js swaps
  // its image (its source's data, which a clone would share), so the draw has a source of its own on that image.
  if(source.map){const map=source.map.clone();map.source=new T.Source(source.map.image);m.map=map;}
  const uniforms={crowdBones:{value:texture},crowdBind:{value:bindMatrix.clone()}};
  // The visitor's own hooks come too, the skin after them (the film look, corner shading: film-look.js and
  // corner-shade.js mark theirs, and leave a material alone that carries them already).
  const before=source.onBeforeCompile,key=source.customProgramCacheKey;
  const hook=function(shader,renderer){before.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);shader.vertexShader=crowdShader(shader.vertexShader);};
  for(const mark of ['filmLook','cornerShade'])if(before[mark])hook[mark]=before[mark];
  hook.keepsGeometry=false;m.onBeforeCompile=hook;m.customProgramCacheKey=function(){return key.call(this)+'|crowd-skin';};
  return m;
 };
 const makeGroup=(key,part)=>{
  const src=part.geometry,g=new T.InstancedBufferGeometry();g.setIndex(src.index);
  for(const n in src.attributes)g.setAttribute(n,src.attributes[n]);
  // (the uvs are this group's own: a visitor's merged uvs change in place when their eyes shut)
  if(src.attributes.uv)g.setAttribute('uv',src.attributes.uv.clone());
  const slotsOf=new Float32Array(slots),attr=new T.InstancedBufferAttribute(slotsOf,1);attr.setUsage(T.DynamicDrawUsage);
  g.setAttribute('crowdSlot',attr);g.instanceCount=0;
  const mesh=new T.Mesh(g,crowdMaterial(part.material,part.bindMatrix));mesh.name='Crowd_'+(part.material.name||'part');
  mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;mesh.matrixWorldAutoUpdate=false;mesh.visible=false;
  mesh.renderOrder=part.renderOrder;mesh.layers.mask=part.layers.mask;mesh.castShadow=false;mesh.receiveShadow=part.receiveShadow;
  // Drawing, after three's scene pass made every bone current: the rows of the bodies drawn whose matrices changed.
  mesh.onBeforeRender=renderer=>{if(renderer.info.render.frame===frame)return;frame=renderer.info.render.frame;let dirty=false;
   for(const m of drawnNow){const made=m.walker.matrices?m.walker.matrices.made:NaN;if(made===m.made)continue;m.skeleton.update();m.made=made;dirty=true;}
   if(dirty)texture.needsUpdate=true;};
  scene.add(mesh);
  const group={key,mesh,slots:slotsOf,attr,count:0};groups.set(key,group);return group;
 };
 // The key of a part's draw: its material, its map's image (the fur colour) and, for the part holding the eyes, whether
 // they are shut.
 const keyOf=(m,part)=>`${part.material.name}|${idOf(part.material.map?.image)}|${part===m.eyesPart&&m.eyes.geometry.attributes.uv!==m.open?1:0}`;
 // Back to the crowd: its row again (three gives a skeleton drawn on its own a padded copy of its matrices).
 const join=m=>{m.skeleton.boneMatrices=m.row;m.made=NaN;for(const p of m.parts)p.visible=false;
  // (drawn on its own meanwhile, three gave it a bone texture on a padded copy: dropped, so a next time rebuilds it)
  if(m.skeleton.boneTexture){m.skeleton.boneTexture.dispose();m.skeleton.boneTexture=null;}};
 // In the camera's view: any of the body's parts, by its own bounds where its matrices were last made.
 const inView=m=>{for(const p of m.parts){const s=p.boundingSphere;if(!s)return true;
  sphere.copy(s).applyMatrix4(p.matrixWorld);sphere.radius+=MOVED_M;if(frustum.intersectsSphere(sphere))return true;}return false;};
 const leave=m=>{for(const p of m.parts)p.visible=true;};
 return {
  add(walker){
   const parts=[];walker.figure.root.traverse(o=>{if(o.isSkinnedMesh&&o.visible)parts.push(o);});
   if(!parts.length)return;
   const skeleton=parts[0].skeleton;if(parts.some(p=>p.skeleton!==skeleton))throw Error('crowd draw: a body on more than one skeleton');
   if(!data){bones=skeleton.bones.length;width=bones*4;data=new Float32Array(width*slots*4);
    texture=new T.DataTexture(data,width,slots,T.RGBAFormat,T.FloatType);texture.magFilter=texture.minFilter=T.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;}
   if(skeleton.bones.length!==bones)throw Error('crowd draw: bodies with different skeletons');
   if(members.length>=slots)throw Error('crowd draw: more bodies than slots');
   const slot=members.length,eyes=walker.figure.asset.meshes.find(p=>p.name==='eyes')??null;
   const m={walker,slot,parts,skeleton,row:data.subarray(slot*width*4,slot*width*4+bones*16),eyes,open:eyes?.geometry.attributes.uv??null,
    eyesPart:eyes?parts.find(p=>p.material===eyes.material)??null:null,made:NaN};
   members.push(m);if(enabled)join(m);
  },
  update(camera,{all=false}={}){
   drawnNow.length=0;for(const g of groups.values())g.count=0;
   if(!enabled){for(const g of groups.values())g.mesh.visible=false;return;}
   view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(view);
   for(const m of members){
    const holder=m.walker.holder;if(!holder.parent)continue;
    if(!all&&!inView(m))continue;
    drawnNow.push(m);
    for(const part of m.parts){const key=keyOf(m,part),g=groups.get(key)??makeGroup(key,part);g.slots[g.count++]=m.slot;}
   }
   for(const g of groups.values()){g.mesh.geometry.instanceCount=g.count;g.mesh.visible=g.count>0;if(g.count){g.attr.addUpdateRange(0,g.count);g.attr.needsUpdate=true;}}
  },
  get enabled(){return enabled;},
  set enabled(on){on=!!on;if(on===enabled)return;enabled=on;for(const m of members)if(on)join(m);else leave(m);},
  groups,members,get texture(){return texture;},
 };
}
