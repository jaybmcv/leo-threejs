import * as T from 'three';
import {getAtriumQuality} from '../v2/atrium-quality.js';
import {LOUNGE} from '../hydro-nip-lounge.js';

const VERTEX=`
attribute vec2 puffSize;
varying vec2 vPuff;
varying vec3 vWorld;
varying float vDistance;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
 vPuff=uv*2.0-1.0;
 vec3 offset=vec3(vPuff*puffSize,0.0);
 vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
 vDistance=length(mvPosition.xyz);
 mvPosition.xyz+=offset;
 vWorld=(modelMatrix*vec4(position,1.0)).xyz+offset*mat3(viewMatrix);
 gl_Position=projectionMatrix*mvPosition;
 #include <logdepthbuf_vertex>
}`;

const FRAGMENT=`
uniform sampler2D atlas;
uniform mat4 loungeInverse;
uniform vec3 insideMin,insideMax,mistColor;
varying vec2 vPuff;
varying vec3 vWorld;
varying float vDistance;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
 float falloff=max(0.0,1.0-dot(vPuff,vPuff));
 if(falloff==0.0)discard;
 vec3 p=(loungeInverse*vec4(vWorld,1.0)).xyz;
 vec3 edge=min(p-insideMin,insideMax-p);
 float boundary=smoothstep(0.04,0.38,min(edge.x,min(edge.y,edge.z)));
 if(boundary==0.0)discard;
 float cloud=texture2D(atlas,vec2(0.75,0.5)+vPuff*vec2(0.235,0.47)).a;
 float density=0.50*falloff*sqrt(falloff)*(0.52+0.48*cloud);
 density*=boundary*smoothstep(0.8,2.2,vDistance);
 #include <logdepthbuf_fragment>
 gl_FragColor=vec4(mistColor,density);
 #include <colorspace_fragment>
}`;

// Reuse the prepared mist centres and atlas. Soft puffs face the camera and fade at the glass and near the eye.
export function createMazeMist(lounge){
 const mesh=lounge.drawn.find(o=>o.name==='Walk_lounge_mist');if(!mesh)return ()=>{};
 const source=mesh.geometry,vertices=source.getAttribute('position'),index=source.index;
 const centres=[],sizes=[],uvs=[],quad=[0,1,0,0,1,1,0,0,1,0,1,1],p=new T.Vector3();
 for(let start=0;start<(index?.count??vertices.count);start+=6){
  p.set(0,0,0);
  for(let i=start;i<start+6;i++){
   const v=index?index.getX(i):i;p.x+=vertices.getX(v);p.y+=vertices.getY(v);p.z+=vertices.getZ(v);
  }
  p.multiplyScalar(1/6);p.y-=.23;
  const n=start/6;
  for(let i=0;i<6;i++){centres.push(p.x,p.y,p.z);sizes.push(1.85+.38*(n%3),.88+.13*(n%4));}
  uvs.push(...quad);
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(centres,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 geometry.setAttribute('puffSize',new T.Float32BufferAttribute(sizes,2));
 const {MAZE,FLOOR}=LOUNGE;
 const material=new T.ShaderMaterial({name:'Maze_mist_puffs',transparent:true,depthWrite:false,toneMapped:false,
  vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms:{atlas:{value:mesh.material.map},loungeInverse:{value:lounge.frame.clone().invert()},
   insideMin:{value:new T.Vector3(MAZE.x0,FLOOR,MAZE.z0)},insideMax:{value:new T.Vector3(MAZE.x1,MAZE.top,MAZE.z1)},mistColor:{value:new T.Color(0x82b29a)}}});
 const phone=globalThis.LEO_WALK_PHONE||globalThis.matchMedia?.('(pointer:coarse)').matches,count=uvs.length/quad.length;
 let detail;
 // Authoring saves the source mist before the walk's first frame.
 return ()=>{
  const quality=phone?'performance':getAtriumQuality();if(quality===detail)return;
  if(!detail){mesh.geometry=geometry;mesh.material=material;}
  detail=quality;const fraction=detail==='performance'?1/3:detail==='balanced'?2/3:1;
  geometry.setDrawRange(0,Math.floor(count*fraction)*6);
 };
}
