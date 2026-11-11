import * as T from 'three';
import {crowdShader,leanMaterial} from './crowd-draw.js';
import {furImage} from './fur.js';

// Visitors beyond the nearest few (remotes.js), drawn without a rig of their own: the crowd. Each plays a loop recorded
// from the rig itself (scripts/bake-crowd-motion.mjs: standing, walking, running, crouched, crouch-walking, prone,
// crawling, sitting, lying, swimming, and each emote, standing), chosen by what their pose says and paced by their speed. Every loop's frames are
// rows of one texture, three texels a bone (the top three rows of its skinning matrix, as half floats); the vertex shader
// blends the two frames either side of the moment and three's instancing places and turns the body. So a visitor in the
// crowd costs a few numbers a frame, and every visitor of one fur colour draws together: one instanced draw per body
// part and colour. Not drawn on them: the hat, the catnip face, the swimsuit, the board, the ball, the grapple line, an
// emote's way in or out (it starts in its loop), or shut eyes. The farther are drawn lighter (the recording's lods,
// scripts/crowd-lod.mjs): each level the parts' indices simplified to within its error, on the same vertices; a
// visitor is drawn at the lightest level whose error comes to under LOD_PX on screen at their depth (along the view: one
// off to the side of the screen is drawn as big as one ahead at that depth).
//   crowdLoop({rest, stance, swimming, speed, emote}) -> the loop's name (an emote not recorded stands: idle)
//   crowdLevels(motion, parts) -> [{error, index: [Uint16Array a part]}], or none when they do not fit the parts
//   createCrowdTier(scene, {template, motion, most, lean}) -> {begin(camera, {all, most, pxPerM}), place(r, dt,
//   swimming), end(), count, levels, dispose()}: begin's all draws them in view or not (the selfie booth's lens may see
//   any); its most, fewer than the tier was made for (a slow page); its pxPerM, the pixels a metre at 1 m of depth
//   (none: every one in full).
//   template: a walker (avatar.js, merged draws) whose skinned parts give the geometry and materials; motion: the
//   recording (crowd-motion.json); most: the most visitors drawn; lean: each part in crowd-draw.js leanMaterial's place
//   of the template's (a phone's, as the near tier's). place(r): a visitor as remotes.js keeps them (cur,
//   tgt, speed); r.crowd keeps their loop and how far into it they are.
export function crowdLoop({rest,stance,swimming,speed,emote=null}){
 if(rest==='sit'||rest==='tube')return 'sit';if(rest==='lie')return 'lie';if(swimming)return 'swim';
 if(emote&&stance!=='crouch'&&stance!=='prone'&&speed<=.3)return emote;
 if(stance==='crouch')return speed>.3?'crouchWalk':'crouch';
 if(stance==='prone')return speed>.15?'crawl':'prone';
 return speed>3?'run':speed>.3?'walk':'idle';
}
// A moving loop keeps pace with them: its speed, scaled by theirs, within these bounds. LEVELS: at most so many lighter.
const PACE=[.5,2],IN_VIEW_M=2.5,LOD_PX=1,LEVELS=7;
// One of a loop's frames (crowdFrame.x, .y: rows; .z: how far from the first to the second) gives each bone's matrix.
const PARS=`
uniform highp sampler2D crowdMotion;
uniform mat4 crowdBind;
attribute vec3 crowdFrame;
attribute vec4 skinIndex;
attribute vec4 skinWeight;
mat4 crowdPose( const in float row, const in float bone ) {
	int x = int( bone ) * 3;
	int y = int( row );
	vec4 a = texelFetch( crowdMotion, ivec2( x, y ), 0 );
	vec4 b = texelFetch( crowdMotion, ivec2( x + 1, y ), 0 );
	vec4 c = texelFetch( crowdMotion, ivec2( x + 2, y ), 0 );
	return mat4( a.x, a.y, a.z, 0.0, a.w, b.x, b.y, 0.0, b.z, b.w, c.x, 0.0, c.y, c.z, c.w, 1.0 );
}
mat4 crowdBone( const in float i ) {
	return crowdPose( crowdFrame.x, i ) * ( 1.0 - crowdFrame.z ) + crowdPose( crowdFrame.y, i ) * crowdFrame.z;
}`;
// The same in JavaScript (for checks): bone `bone`'s matrix at `row` of the recording's numbers.
export function crowdBoneMatrix(numbers,bones,row,bone,out=new T.Matrix4()){
 const o=(row*bones+bone)*12,n=numbers;
 return out.set(n[o],n[o+3],n[o+6],n[o+9], n[o+1],n[o+4],n[o+7],n[o+10], n[o+2],n[o+5],n[o+8],n[o+11], 0,0,0,1);
}
// The recording's numbers as half floats, from its base64.
export function crowdHalves(motion){
 const text=atob(motion.data),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
 return new Uint16Array(bytes.buffer);
}

// The base64 of an index as Uint16s.
const indexOf=data=>{const text=atob(data),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);return new Uint16Array(bytes.buffer);};
export function crowdLevels(motion,parts){
 const levels=[];
 for(const l of (motion.lods??[]).slice(0,LEVELS)){
  const index=l.parts.length===parts.length?l.parts.map((p,i)=>{const a=indexOf(p.data),n=parts[i].geometry.attributes.position.count;
   return p.name===parts[i].material.name&&a.length>0&&a.length%3===0&&a.every(v=>v<n)?a:null;}):[null];
  if(!(l.error>0)||index.includes(null)||levels.length&&l.error<=levels.at(-1).error){console.warn('Leo crowd: its lighter meshes do not fit the body; drawn in full');return [];}
  levels.push({error:l.error,index});
 }
 return levels;
}

export function createCrowdTier(scene,{template,motion,most=1000,lean=false}){
 const bones=motion.bones,rows=motion.clips.reduce((s,c)=>s+c.frames,0),fps=motion.fps,clips=new Map(motion.clips.map(c=>[c.name,c]));
 const texture=new T.DataTexture(crowdHalves(motion),bones*3,rows,T.RGBAFormat,T.HalfFloatType);
 texture.magFilter=texture.minFilter=T.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 const parts=[];template.figure.root.traverse(o=>{if(o.isSkinnedMesh&&o.visible)parts.push(o);});
 if(!parts.length)throw Error('crowd tier: the template has no skinned parts');
 const groups=new Map(),frustum=new T.Frustum(),view=new T.Matrix4(),sphere=new T.Sphere(),ids=new WeakMap();let nextId=1,count=0,all=false,cap=most;
 // (lodIndex: each level's index for each part, one for every fur colour; reach: the depth each level starts at; eye,
 // ahead: the camera's place and the way it looks)
 const levels=crowdLevels(motion,parts),lodIndex=levels.map(l=>l.index.map(a=>new T.BufferAttribute(a,1)));
 const reach=new Float64Array(levels.length).fill(Infinity),eye=new T.Vector3(),ahead=new T.Vector3(),materials=new Map();
 const idOf=o=>{let id=ids.get(o);if(!id)ids.set(o,id=nextId++);return id;};
 // A part's material for a fur colour: the template's, its map on that colour's image (fur.js), skinned from the
 // recording. Its own hooks come too, the skin after them (as crowd-draw.js does).
 const material=(part,image)=>{
  const source=part.material,m=lean?leanMaterial(source):source.clone();
  if(source.map){const map=source.map.clone();map.source=new T.Source(image);map.needsUpdate=true;m.map=map;}
  const uniforms={crowdMotion:{value:texture},crowdBind:{value:part.bindMatrix.clone()}};
  const before=source.onBeforeCompile,key=source.customProgramCacheKey;
  const hook=function(shader,renderer){before.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);shader.vertexShader=crowdShader(shader.vertexShader,PARS);};
  for(const mark of ['filmLook','cornerShade'])if(before[mark])hook[mark]=before[mark];
  hook.keepsGeometry=false;m.onBeforeCompile=hook;m.customProgramCacheKey=function(){return key.call(this)+'|crowd-tier';};
  return m;
 };
 // The draw for one part in one fur colour at one level (0: in full); every level of a part and colour has one material.
 const groupOf=(index,image,level)=>{
  const at=index+'|'+(image?idOf(image):0),key=at+'|'+level;let g=groups.get(key);if(g)return g;
  const part=parts[index],src=part.geometry,geometry=new T.BufferGeometry();geometry.setIndex(level?lodIndex[level-1][index]:src.index);
  for(const n in src.attributes)geometry.setAttribute(n,src.attributes[n]);
  const frames=new T.InstancedBufferAttribute(new Float32Array(most*3),3);frames.setUsage(T.DynamicDrawUsage);geometry.setAttribute('crowdFrame',frames);
  let m=materials.get(at);if(!m)materials.set(at,m=material(part,image));
  const mesh=new T.InstancedMesh(geometry,m,most);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.name='Crowd_'+(part.material.name||'part')+(level?'_lod'+level:'');mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;mesh.matrixWorldAutoUpdate=false;
  mesh.count=0;mesh.visible=false;mesh.renderOrder=part.renderOrder;mesh.layers.mask=part.layers.mask;mesh.castShadow=false;mesh.receiveShadow=part.receiveShadow;
  scene.add(mesh);g={mesh,frames,count:0,level};groups.set(key,g);return g;
 };
 // A fur colour's draws at a level, one for each part: the body's colour map recoloured, the rest as they are (made once
 // a colour and level).
 const byFur=new Map(),groupsFor=(fur,level)=>{const key=fur*(LEVELS+1)+level;let list=byFur.get(key);if(list)return list;
  list=parts.map((p,i)=>{const image=p.material.map?.image;return groupOf(i,image&&p.material.map.name==='body_BaseColor'?furImage(image,fur):image??null,level);});
  byFur.set(key,list);return list;};
 return {
  begin(camera,{all:every=false,most:fewer=most,pxPerM=0}={}){count=0;all=every;cap=Math.min(most,fewer);for(const g of groups.values())g.count=0;
   view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(view);
   const e=camera.matrixWorld.elements;eye.set(e[12],e[13],e[14]);ahead.set(-e[8],-e[9],-e[10]).normalize();
   for(let k=0;k<levels.length;k++)reach[k]=pxPerM>0?levels[k].error*pxPerM/LOD_PX:Infinity;},
  place(r,dt,swimming=false){
   const c=r.cur,t=r.tgt,clip=clips.get(crowdLoop({rest:t.rest,stance:t.stance,swimming,speed:r.speed,emote:t.emote}))??clips.get('idle');
   // Where they are in the loop: kept across a change of loop (a walk into a run keeps its step), each starting somewhere
   // of their own.
   const s=r.crowd??={phase:(idOf(r)*.618)%1};
   const pace=clip.speed?T.MathUtils.clamp(r.speed/clip.speed,PACE[0],PACE[1]):1;s.phase=(s.phase+dt*pace*(clip.fps??fps)/clip.frames)%1;
   if(count>=cap)return;
   if(!all&&!frustum.intersectsSphere(sphere.set(sphere.center.set(c.x,c.y+.6,c.z),IN_VIEW_M)))return;
   const x=s.phase*clip.frames,a=Math.floor(x)%clip.frames,b=(a+1)%clip.frames,u=x-Math.floor(x),cos=Math.cos(c.yaw),sin=Math.sin(c.yaw);
   const depth=(c.x-eye.x)*ahead.x+(c.y+.6-eye.y)*ahead.y+(c.z-eye.z)*ahead.z;let level=0;while(level<levels.length&&depth>=reach[level])level++;
   const list=groupsFor(t.fur|0,level);
   for(let p=0;p<list.length;p++){
    const g=list[p],i=g.count++,m=g.mesh.instanceMatrix.array,o=i*16,f=g.frames.array;
    m[o]=cos;m[o+1]=0;m[o+2]=-sin;m[o+3]=0;m[o+4]=0;m[o+5]=1;m[o+6]=0;m[o+7]=0;m[o+8]=sin;m[o+9]=0;m[o+10]=cos;m[o+11]=0;m[o+12]=c.x;m[o+13]=c.y;m[o+14]=c.z;m[o+15]=1;
    f[i*3]=clip.start+a;f[i*3+1]=clip.start+b;f[i*3+2]=u;
   }
   count++;
  },
  end(){
   for(const g of groups.values()){g.mesh.count=g.count;g.mesh.visible=g.count>0;
    if(g.count){g.mesh.instanceMatrix.clearUpdateRanges();g.mesh.instanceMatrix.addUpdateRange(0,g.count*16);g.mesh.instanceMatrix.needsUpdate=true;
     g.frames.clearUpdateRanges();g.frames.addUpdateRange(0,g.count*3);g.frames.needsUpdate=true;}}
  },
  get count(){return count;},
  groups,texture,levels,
  dispose(){for(const g of groups.values()){g.mesh.removeFromParent();g.mesh.dispose();g.mesh.geometry.dispose();}for(const m of materials.values()){m.map?.dispose();m.dispose();}
   groups.clear();materials.clear();texture.dispose();},
 };
}
