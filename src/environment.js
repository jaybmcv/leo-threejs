import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

// The viewer's reflection lighting is three's RoomEnvironment, prefiltered by PMREMGenerator. Prefiltering cost ~0.7 s
// of main thread at every start (more on phones), so its result is baked once into brand/environment.png and decoded
// on the GPU in one pass. The PNG is RGB with a shared exponent per texel (RGBE): mantissas in the top half, exponents
// in the red channel of the bottom half, rows in GL order. No alpha channel, so no browser can premultiply it.
// Rebake after changing the environment: open the viewer with ?studio=1&bake=environment and save the download.
export const ENVIRONMENT_URL='brand/environment.png';
const SIGMA=.04;

export function prefilterRoom(renderer){
 const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),texture=pmrem.fromScene(room,SIGMA).texture;
 room.dispose();pmrem.dispose();return texture;
}

// Draws one full-screen triangle with `fragmentShader` into `target`.
function pass(renderer,target,fragmentShader,uniforms){
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 const material=new T.RawShaderMaterial({glslVersion:T.GLSL3,uniforms,depthTest:false,depthWrite:false,
  vertexShader:'in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'precision highp float;precision highp int;\n'+fragmentShader});
 const mesh=new T.Mesh(geometry,material),scene=new T.Scene();mesh.frustumCulled=false;scene.add(mesh);
 const previous=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(scene,new T.Camera());renderer.setRenderTarget(previous);
 geometry.dispose();material.dispose();
}

function decode(renderer,image){
 const source=new T.Texture(image);Object.assign(source,{flipY:false,colorSpace:T.NoColorSpace,generateMipmaps:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter,needsUpdate:true});
 const width=image.width,height=image.height/2;
 const target=new T.WebGLRenderTarget(width,height,{magFilter:T.LinearFilter,minFilter:T.LinearFilter,generateMipmaps:false,type:T.HalfFloatType,format:T.RGBAFormat,colorSpace:T.LinearSRGBColorSpace,depthBuffer:false});
 pass(renderer,target,`uniform sampler2D rgbe;uniform int rows;out vec4 color;
  void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 m=texelFetch(rgbe,p,0).rgb;float e=floor(texelFetch(rgbe,p+ivec2(0,rows),0).r*255.+.5)-128.;color=vec4(m*exp2(e),1.);}`,
  {rgbe:{value:source},rows:{value:height}});
 source.dispose();
 const texture=target.texture;texture.mapping=T.CubeUVReflectionMapping;texture.name='PMREM.cubeUv';return texture;
}

export async function loadEnvironment(renderer){
 try{
  const image=await new T.ImageLoader().loadAsync(ENVIRONMENT_URL);
  if(!image.width||image.height%2)throw new Error('unexpected size');
  return decode(renderer,image);
 }catch(e){console.warn('Baked environment unavailable; prefiltering it now.',e);return prefilterRoom(renderer);}
}

// Studio tool: prefilters the room and returns it as the RGBE PNG described above.
export async function bakeEnvironmentPNG(renderer){
 const texture=prefilterRoom(renderer),{width,height}=texture.image;
 const target=new T.WebGLRenderTarget(width,height*2,{type:T.UnsignedByteType,format:T.RGBAFormat,depthBuffer:false,generateMipmaps:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
 pass(renderer,target,`uniform sampler2D radiance;uniform int rows;out vec4 color;
  void main(){ivec2 p=ivec2(gl_FragCoord.xy);bool exponentRow=p.y>=rows;vec3 c=texelFetch(radiance,ivec2(p.x,exponentRow?p.y-rows:p.y),0).rgb;
   float peak=max(c.r,max(c.g,c.b));if(peak<=1e-30){color=vec4(0.,0.,0.,1.);return;}
   float e=clamp(floor(log2(peak))+1.,-127.,127.);color=exponentRow?vec4((e+128.)/255.,0.,0.,1.):vec4(c/exp2(e),1.);}`,
  {radiance:{value:texture},rows:{value:height}});
 const rgba=new Uint8Array(width*height*2*4);renderer.readRenderTargetPixels(target,0,0,width,height*2,rgba);target.dispose();texture.dispose();
 const rgb=new Uint8Array(width*height*2*3);for(let i=0,j=0;i<rgba.length;i+=4,j+=3){rgb[j]=rgba[i];rgb[j+1]=rgba[i+1];rgb[j+2]=rgba[i+2];}
 return encodePNG(width,height*2,rgb);
}

// A minimal RGB PNG writer (Sub filter, zlib via CompressionStream), so the baked bytes never pass through a canvas.
const CRC=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=bytes=>{let c=0xffffffff;for(const b of bytes)c=CRC[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function chunk(type,data){
 const out=new Uint8Array(12+data.length),view=new DataView(out.buffer);view.setUint32(0,data.length);
 for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);out.set(data,8);view.setUint32(8+data.length,crc32(out.subarray(4,8+data.length)));return out;
}
async function encodePNG(width,height,rgb){
 const stride=width*3,raw=new Uint8Array((stride+1)*height);
 for(let y=0;y<height;y++){const row=y*(stride+1);raw[row]=1;for(let x=0;x<stride;x++){const v=rgb[y*stride+x];raw[row+1+x]=(v-(x>=3?rgb[y*stride+x-3]:0))&255;}}
 const zlib=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
 const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,width);view.setUint32(4,height);header.set([8,2,0,0,0],8);
 return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib),chunk('IEND',new Uint8Array(0))],{type:'image/png'});
}
