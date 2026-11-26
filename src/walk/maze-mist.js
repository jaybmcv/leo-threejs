import * as T from 'three';
import {getAtriumQuality} from '../v2/atrium-quality.js';
import {LOUNGE} from '../hydro-nip-lounge.js';

const SLICES=4;
const VERTEX=`
attribute vec2 puffSize,puffSample;
varying vec2 vPuff;
varying vec2 vSample;
varying vec3 vWorld;
varying float vDistance;
#ifndef USE_LOGARITHMIC_DEPTH_BUFFER
varying float vProjectionZ;
#endif
void main(){
 vPuff=uv*2.0-1.0;
 vSample=puffSample;
 vec3 offset=vec3(vPuff*puffSize,0.0);
 vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
 vDistance=length(mvPosition.xyz);
 mvPosition.xyz+=offset;
 vWorld=(modelMatrix*vec4(position,1.0)).xyz+offset*mat3(viewMatrix);
 gl_Position=projectionMatrix*mvPosition;
 #ifndef USE_LOGARITHMIC_DEPTH_BUFFER
 vProjectionZ=projectionMatrix[3][2];
 #endif
}`;

const FRAGMENT=`
uniform sampler2D atlas;
uniform mat4 loungeInverse;
uniform vec3 insideMin,insideMax,mistColor;
varying vec2 vPuff;
varying vec2 vSample;
varying vec3 vWorld;
varying float vDistance;
#include <common>
#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
uniform float logDepthBufFC;
#else
varying float vProjectionZ;
#endif
void main(){
 float falloff=max(0.0,1.0-dot(vPuff,vPuff));
 if(falloff==0.0)discard;
 // Sample across the puff's depth so an intersecting surface gradually hides the mist.
 float radius=sqrt(falloff);
 float jitter=rand(gl_FragCoord.xy+vSample.y*vec2(13.0,7.0));
 float offset=(2.0*(vSample.x+jitter)/${SLICES}.0-1.0)*1.25*radius;
 float planeDepth=1.0/gl_FragCoord.w,depth=planeDepth+offset;
 float nearFade=smoothstep(0.8,2.2,min(vDistance,depth));
 if(nearFade==0.0)discard;
 vec3 sampleWorld=vWorld+(vWorld-cameraPosition)*(offset/planeDepth);
 vec3 p=(loungeInverse*vec4(sampleWorld,1.0)).xyz;
 vec3 edge=min(p-insideMin,insideMax-p);
 float boundary=smoothstep(0.04,0.65,min(edge.x,min(edge.y,edge.z)));
 if(boundary==0.0)discard;
 float cloud=texture2D(atlas,vec2(0.75,0.5)+vPuff*vec2(0.235,0.47)).a;
 float density=0.50*falloff*radius*(0.52+0.48*cloud)*boundary*nearFade;
 #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
 gl_FragDepth=log2(1.0+depth)*logDepthBufFC*0.5;
 #else
 // Perspective depth changes with the reciprocal of view depth.
 gl_FragDepth=gl_FragCoord.z+0.5*vProjectionZ*(1.0/depth-gl_FragCoord.w);
 #endif
 gl_FragColor=vec4(mistColor,1.0-pow(1.0-density,1.0/${SLICES}.0));
 #include <colorspace_fragment>
}`;

// Reuse the prepared mist centres and atlas. Soft puffs face the camera and fade at the glass and near the eye.
export function createMazeMist(lounge){
 const mesh=lounge.drawn.find(o=>o.name==='Walk_lounge_mist');if(!mesh)return ()=>{};
 const source=mesh.geometry,vertices=source.getAttribute('position'),index=source.index;
 const centres=[],sizes=[],samples=[],uvs=[],quad=[0,1,0,0,1,1,0,0,1,0,1,1],p=new T.Vector3(),stride=6*SLICES;
 for(let start=0;start<(index?.count??vertices.count);start+=6){
  p.set(0,0,0);
  for(let i=start;i<start+6;i++){
   const v=index?index.getX(i):i;p.x+=vertices.getX(v);p.y+=vertices.getY(v);p.z+=vertices.getZ(v);
  }
  p.multiplyScalar(1/6);p.y-=.23;
  const n=start/6;
  for(let slice=0;slice<SLICES;slice++){
   for(let i=0;i<6;i++){centres.push(p.x,p.y,p.z);sizes.push(1.85+.38*(n%3),.88+.13*(n%4));samples.push(slice,n*SLICES+slice);}
   uvs.push(...quad);
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(centres,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 geometry.setAttribute('puffSize',new T.Float32BufferAttribute(sizes,2));
 geometry.setAttribute('puffSample',new T.Float32BufferAttribute(samples,2));
 const {MAZE,FLOOR}=LOUNGE;
 const material=new T.ShaderMaterial({name:'Maze_mist_puffs',transparent:true,depthWrite:false,toneMapped:false,
  vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms:{atlas:{value:mesh.material.map},loungeInverse:{value:lounge.frame.clone().invert()},
   insideMin:{value:new T.Vector3(MAZE.x0,FLOOR,MAZE.z0)},insideMax:{value:new T.Vector3(MAZE.x1,MAZE.top,MAZE.z1)},mistColor:{value:new T.Color(0x82b29a)}}});
 const phone=globalThis.LEO_WALK_PHONE||globalThis.matchMedia?.('(pointer:coarse)').matches,count=centres.length/(3*stride);
 let detail;
 // Authoring saves the source mist before the walk's first frame.
 return ()=>{
  const quality=phone?'performance':getAtriumQuality();if(quality===detail)return;
  if(!detail){mesh.geometry=geometry;mesh.material=material;}
  detail=quality;const fraction=detail==='performance'?1/3:detail==='balanced'?2/3:1;
  geometry.setDrawRange(0,Math.floor(count*fraction)*stride);
 };
}
