import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

// The viewer's and the walk's reflection lighting is three's RoomEnvironment, prefiltered by PMREMGenerator into a cube
// with a mip level per roughness step (256 px faces down to 8 px). Prefiltering cost ~0.7 s of main thread at every
// start (more on phones), so its result is baked once into brand/environment-cube.png and decoded on the GPU, one pass per
// face and level. The PNG is RGB with a shared exponent per texel (RGBE): mantissas in the top half, exponents in the
// red channel of the bottom half, rows in GL order. Each level is a row of the six faces in GL's order (+x, -x, +y, -y,
// +z, -z), the largest level first; texels are read and written in GL's own cube orientation. No alpha channel, so no
// browser can premultiply it.
// Rebake after changing the environment or three's PMREM: open the viewer with ?studio=1&bake=environment and save the
// download. (Until three r187 it held a CubeUV atlas as environment.png; the new name keeps old pages off this layout.)
export const ENVIRONMENT_URL='brand/environment-cube.png';
const SIGMA=.04,FACES=6;
// The levels of a PMREM with `size` px faces, as PMREMGenerator makes them (down to 8 px), with each level's first row.
const levelsOf=size=>{const levels=[];for(let s=size,y=0;s>=8;y+=s,s>>=1)levels.push({size:s,y});return levels;};
const rowsOf=levels=>levels.reduce((n,l)=>n+l.size,0);

export function prefilterRoom(renderer){
 const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),texture=pmrem.fromScene(room,SIGMA).texture;
 room.dispose();pmrem.dispose();return texture;
}

// A full-screen triangle drawing `fragmentShader`: draw(target,face,level) renders it into a target (for a cube target,
// one face and mip level); done() frees it.
function fullScreen(renderer,fragmentShader,uniforms){
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 const material=new T.RawShaderMaterial({glslVersion:T.GLSL3,uniforms,depthTest:false,depthWrite:false,
  vertexShader:'in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'precision highp float;precision highp int;\n'+fragmentShader});
 const mesh=new T.Mesh(geometry,material),scene=new T.Scene(),camera=new T.Camera();mesh.frustumCulled=false;scene.add(mesh);
 return {
  draw(target,face=0,level=0){
   // The renderer takes the target's viewport as it is, not scaled to the mip level.
   const previous=renderer.getRenderTarget();target.viewport.set(0,0,target.width>>level,target.height>>level);
   renderer.setRenderTarget(target,face,level);renderer.render(scene,camera);renderer.setRenderTarget(previous);target.viewport.set(0,0,target.width,target.height);
  },
  done(){geometry.dispose();material.dispose();},
 };
}

// The cube direction of a texel of face `face` at `st` (-1 to 1 across the face), as GL samples cube maps.
const FACE_DIRECTION=`vec3 faceDirection(int face,vec2 st){
 if(face==0)return vec3(1.,-st.y,-st.x);if(face==1)return vec3(-1.,-st.y,st.x);if(face==2)return vec3(st.x,1.,st.y);
 if(face==3)return vec3(st.x,-1.,-st.y);if(face==4)return vec3(st.x,-st.y,1.);return vec3(-st.x,-st.y,-1.);}`;

function decode(renderer,image){
 const size=image.width/FACES,levels=levelsOf(size),rows=rowsOf(levels);
 if(!Number.isInteger(size)||size<8||image.height!==rows*2)throw new Error(`not a baked PMREM cube (${image.width}×${image.height})`);
 const source=new T.Texture(image);Object.assign(source,{flipY:false,colorSpace:T.NoColorSpace,generateMipmaps:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter,needsUpdate:true});
 // Drawing into a half-float target needs a colour-buffer extension some phone GPUs lack; without one the reflections
 // would come out black and the hull flat grey. Those get an 8-bit target (highlights clip at 1, the rest is unchanged).
 const halfFloat=renderer.extensions.has('EXT_color_buffer_half_float')||renderer.extensions.has('EXT_color_buffer_float');
 const target=new T.WebGLCubeRenderTarget(size,{magFilter:T.LinearFilter,minFilter:T.LinearMipmapLinearFilter,generateMipmaps:false,type:halfFloat?T.HalfFloatType:T.UnsignedByteType,colorSpace:T.LinearSRGBColorSpace,depthBuffer:false});
 // What makes three sample it as a PMREM: the flag, and the levels (the last is the fully rough one).
 const texture=target.texture;for(const l of levels)texture.mipmaps.push({width:l.size,height:l.size});texture.name='PMREM';texture.isPMREMTexture=true;
 const uniforms={rgbe:{value:source},rows:{value:rows},face:{value:0},size:{value:0},y0:{value:0}};
 const pass=fullScreen(renderer,`uniform sampler2D rgbe;uniform int rows,face,size,y0;out vec4 color;
  void main(){ivec2 p=ivec2(face*size,y0)+ivec2(gl_FragCoord.xy);vec3 m=texelFetch(rgbe,p,0).rgb;float e=floor(texelFetch(rgbe,p+ivec2(0,rows),0).r*255.+.5)-128.;color=vec4(m*exp2(e),1.);}`,uniforms);
 levels.forEach((l,level)=>{for(let face=0;face<FACES;face++){uniforms.face.value=face;uniforms.size.value=l.size;uniforms.y0.value=l.y;pass.draw(target,face,level);}});
 pass.done();source.dispose();return texture;
}

export async function loadEnvironment(renderer){
 try{
  const image=await new T.ImageLoader().loadAsync(ENVIRONMENT_URL);
  return decode(renderer,image);
 }catch(e){console.warn('Baked environment unavailable; prefiltering it now.',e);return prefilterRoom(renderer);}
}

// Studio tool: prefilters the room and returns it as the RGBE PNG described above.
export async function bakeEnvironmentPNG(renderer){
 const texture=prefilterRoom(renderer),size=texture.mipmaps[0].width,levels=levelsOf(size),rows=rowsOf(levels),width=size*FACES;
 if(levels.length!==texture.mipmaps.length)throw new Error(`PMREM has ${texture.mipmaps.length} levels, the PNG layout ${levels.length}`);
 const target=new T.WebGLRenderTarget(width,rows*2,{type:T.UnsignedByteType,format:T.RGBAFormat,depthBuffer:false,generateMipmaps:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
 const pass=fullScreen(renderer,`uniform samplerCube radiance;uniform int rows,size;out vec4 color;${FACE_DIRECTION}
  void main(){ivec2 p=ivec2(gl_FragCoord.xy);bool exponentRow=p.y>=rows;int y=exponentRow?p.y-rows:p.y,s=size,y0=0,level=0;
   for(int i=0;i<16&&y>=y0+s;i++){y0+=s;s>>=1;level++;}
   color=vec4(0.,0.,0.,1.);if(s<8||p.x>=s*6)return;
   int face=p.x/s;vec2 st=(vec2(p.x-face*s,y-y0)+.5)/float(s)*2.-1.;vec3 c=textureLod(radiance,faceDirection(face,st),float(level)).rgb;
   float peak=max(c.r,max(c.g,c.b));if(peak<=1e-30)return;
   float e=clamp(floor(log2(peak))+1.,-127.,127.);color=exponentRow?vec4((e+128.)/255.,0.,0.,1.):vec4(c/exp2(e),1.);}`,
  {radiance:{value:texture},rows:{value:rows},size:{value:size}});
 pass.draw(target);pass.done();
 const rgba=new Uint8Array(width*rows*2*4);renderer.readRenderTargetPixels(target,0,0,width,rows*2,rgba);target.dispose();texture.dispose();
 const rgb=new Uint8Array(width*rows*2*3);for(let i=0,j=0;i<rgba.length;i+=4,j+=3){rgb[j]=rgba[i];rgb[j+1]=rgba[i+1];rgb[j+2]=rgba[i+2];}
 return encodePNG(width,rows*2,rgb);
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
