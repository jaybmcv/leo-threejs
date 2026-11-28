import * as T from 'three';

const RANGE=8,CAP=5;
const vertexShader=`
varying vec2 vUv;
varying float vSeed;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
 vec3 base=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
 vec2 delta=cameraPosition.xz-base.xz;
 vec2 right=vec2(delta.y,-delta.x)/max(length(delta),.001);
 vec3 world=base+vec3(right.x*position.x,position.y,right.y*position.x);
 vUv=uv;
 vSeed=base.x*2.31+base.z*3.17;
 gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
 #include <logdepthbuf_vertex>
}
`;
const fragmentShader=`
uniform float time;
varying vec2 vUv;
varying float vSeed;
#include <logdepthbuf_pars_fragment>
void main(){
 #include <logdepthbuf_fragment>
 float y=vUv.y;
 float phase=y*15.-time*2.6+vSeed;
 float curl=y*(.22*sin(phase)+.08*sin(phase*1.78));
 float width=.045+.10*y;
 float across=(vUv.x-.5-curl)/width;
 float soft=exp(-across*across*2.);
 float fade=smoothstep(0.,.06,y)*(1.-smoothstep(.47,1.,y));
 float alpha=soft*fade*(.33+.15*sin(phase));
 gl_FragColor=vec4(.69,.66,.81,alpha);
 #include <colorspace_fragment>
}
`;

export function createLoungeTableSmoke(origins,frame,scene){
 if(!scene||!origins?.length)return ()=>{};
 const sources=origins.map(p=>({at:new T.Vector3(...p).applyMatrix4(frame),distance:0}));
 const geometry=new T.PlaneGeometry(.22,.43).translate(0,.215,0);
 const material=new T.ShaderMaterial({name:'Lounge_joint_wisp',vertexShader,fragmentShader,transparent:true,depthWrite:false,
  side:T.DoubleSide,forceSinglePass:true,toneMapped:false,uniforms:{time:{value:0}}});
 const mesh=new T.InstancedMesh(geometry,material,Math.min(sources.length,CAP));
 mesh.name='Walk_lounge_table_smoke';mesh.userData.noCollide=true;mesh.frustumCulled=false;mesh.visible=false;
 mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
 const matrix=new T.Matrix4(),active=[];
 return (dt,eye)=>{
  for(const source of sources)source.distance=source.at.distanceToSquared(eye);
  sources.sort((a,b)=>a.distance-b.distance);
  let count=0;
  while(count<CAP&&count<sources.length&&sources[count].distance<RANGE*RANGE){
   const source=sources[count];
   if(active[count]!==source){active[count]=source;mesh.setMatrixAt(count,matrix.makeTranslation(...source.at));mesh.instanceMatrix.needsUpdate=true;}
   count++;
  }
  mesh.count=count;mesh.visible=count>0;
  if(count)material.uniforms.time.value+=dt;
 };
}
