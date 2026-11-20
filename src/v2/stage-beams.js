import * as T from 'three';
import {stageConcertFixtures} from './stage-concert.js';
import {atriumViewSpan} from './atrium-visibility.js';

const FLOOR=.36,LENGTH=18,UP=new T.Vector3(0,1,0);
// Use alternate fixtures, skipping the front pair behind the speaker arrays. Origins match the existing lens faces.
export function stageBeamSources(){
 return stageConcertFixtures().filter((f,i)=>i%27%2===0&&(i>=27||i>0&&i<26)).map(f=>({...f,row:f.at[0]<113?'front':'back',origin:[f.at[0]-.24*Math.sin(f.tilt),f.at[1]-.24*Math.cos(f.tilt)-.012,f.at[2]]}));
}
// Outward is -X. A shallow downward tilt keeps the finite fan below the balconies and above the seating.
export function stageBeamAim(time,index,out=new T.Vector3()){
 const phase=index*1.37,pan=.44*Math.sin(time*.19+phase),tilt=-.018+.012*Math.sin(time*.23+phase*.83);
 return out.set(-Math.cos(tilt)*Math.cos(pan),Math.sin(tilt),Math.cos(tilt)*Math.sin(pan));
}
const vertexShader=`
 attribute float beamPhase;
 uniform float time;
 uniform vec3 palette[3];
 varying vec2 vUv;
 varying vec3 vNormal,vEye,vColour;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){
  float cycle=mod(time*.045+beamPhase,3.);
  float blend=smoothstep(0.,1.,fract(cycle));
  vColour=cycle<1.?mix(palette[0],palette[1],blend):cycle<2.?mix(palette[1],palette[2],blend):mix(palette[2],palette[0],blend);
  // Keep a clear hue when additive colour meets the bright cream backdrop.
  vColour-=vec3(min(vColour.r,min(vColour.g,vColour.b)));
  vColour/=max(.001,max(vColour.r,max(vColour.g,vColour.b)));
  vUv=uv;
  vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(position,1.);
  vNormal=normalMatrix*mat3(instanceMatrix)*normal;vEye=-mvPosition.xyz;
  gl_Position=projectionMatrix*mvPosition;
  #include <logdepthbuf_vertex>
 }`;
const fragmentShader=`
 uniform float kind;
 varying vec2 vUv;
 varying vec3 vNormal,vEye,vColour;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){
  #include <logdepthbuf_fragment>
  float alpha;
  if(kind>1.5){float r=length(vUv*2.-1.);alpha=.45*pow(max(0.,1.-r*r),2.);}
  else{
   float face=abs(dot(normalize(vNormal),normalize(vEye)));
   float edge=smoothstep(0.,.6,face);
   if(kind>.5)alpha=(.28*edge+pow(face,12.))*smoothstep(0.,.015,vUv.y)*(1.-smoothstep(.6,1.,vUv.y));
   else alpha=.15*pow(face,1.6)*(1.-.2*vUv.y);
  }
  gl_FragColor=vec4(vColour*(kind>.5&&kind<1.5?1.6:1.),alpha);
  #include <colorspace_fragment>
 }`;

export function createStageBeams(scene,y){
 const group=new T.Group();group.name='Common_stage_beams';group.position.y=y;group.userData.noCollide=true;group.visible=false;scene.add(group);
 const sources=stageBeamSources(),front=sources.filter(f=>f.row==='front'),back=sources.filter(f=>f.row==='back');
 const clock={value:0},palette={value:[0xff3ccf,0x20e8ff,0x40ff78].map(c=>new T.Color(c))};
 const batch=(name,geometry,fixtures,kind)=>{
  geometry.setAttribute('beamPhase',new T.InstancedBufferAttribute(new Float32Array(fixtures.map((_,i)=>i*.37)),1));
  const material=new T.ShaderMaterial({name,uniforms:{time:clock,palette,kind:{value:kind}},vertexShader,fragmentShader,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false});
  material.forceSinglePass=true;
  const mesh=new T.InstancedMesh(geometry,material,fixtures.length);mesh.name=name;mesh.userData.noCollide=true;mesh.frustumCulled=false;group.add(mesh);return mesh;
 };
 const drop=back[0].origin[1]-FLOOR;
 const cones=batch('Common_stage_down_cones',new T.CylinderGeometry(.62,.07,drop,16,1,true).translate(0,drop/2,0),back,0);
 const pools=batch('Common_stage_floor_pools',new T.PlaneGeometry(1.7,1.7).rotateX(-Math.PI/2),back,2);
 const lasers=batch('Common_stage_front_beams',new T.CylinderGeometry(.02,.02,LENGTH,12,1,true).translate(0,LENGTH/2,0),front,1);
 lasers.instanceMatrix.setUsage(T.DynamicDrawUsage);
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),point=new T.Vector3(),direction=new T.Vector3(),scale=new T.Vector3(1,1,1);
 back.forEach((f,i)=>{
  cones.setMatrixAt(i,matrix.compose(point.fromArray(f.origin),rotation.setFromUnitVectors(UP,direction.set(0,-1,0)),scale));
  pools.setMatrixAt(i,matrix.makeTranslation(f.origin[0],FLOOR+.018,f.origin[2]));
 });
 const aim=time=>{front.forEach((f,i)=>lasers.setMatrixAt(i,matrix.compose(point.fromArray(f.origin),rotation.setFromUnitVectors(UP,stageBeamAim(time,i,direction)),scale)));lasers.instanceMatrix.needsUpdate=true;};
 aim(0);
 // Follow the atrium visibility gate, then reject distant or offscreen stage effects as a single box.
 const box=new T.Box3(new T.Vector3(106,y+FLOOR,14),new T.Vector3(119.7,y+3.95,46)),centre=box.getCenter(new T.Vector3()),eye=new T.Vector3(),frustum=new T.Frustum(),view=new T.Matrix4();
 return {group,update(camera,time){
  const span=atriumViewSpan();group.visible=!!span&&span[0]<=box.max.y&&span[1]>=box.min.y&&camera.getWorldPosition(eye).distanceToSquared(centre)<90**2;
  if(group.visible){view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);group.visible=frustum.setFromProjectionMatrix(view).intersectsBox(box);}
  if(!group.visible)return;
  clock.value=time;aim(time);
 }};
}
