import * as T from 'three';
// Viewer-only exhaust effect anchored to the saved outlet geometry.
export function createThrusterEffects(exterior){
 exterior.updateMatrixWorld(true);
 const outlets=new Map(),central=[];
 exterior.traverse(o=>{
  if(!o.isMesh)return;
  if(o.name==='Engine_nozzle_lip'){
   const b=new T.Box3().setFromObject(o),c=b.getCenter(new T.Vector3()),key=c.y.toFixed(2)+','+c.z.toFixed(2);
   if(!outlets.has(key)||b.min.x<outlets.get(key).x)outlets.set(key,{x:b.min.x,y:c.y,z:c.z,r:4.4,len:14});
  }
  if(o.name==='Aft_service_door'){const b=new T.Box3().setFromObject(o),c=b.getCenter(new T.Vector3());central.push({x:b.min.x-.35,y:c.y,z:c.z,r:3.8,len:11});}
 });
 const root=new T.Group();root.name='Subtle_thruster_plumes';const plumes=[];
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,uniforms:{pulse:{value:1}},
 vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'varying vec2 vUv; uniform float pulse; void main(){float fade=pow(1.-vUv.y,1.8);vec3 color=mix(vec3(.68,.88,1.),vec3(.18,.42,1.),vUv.y);gl_FragColor=vec4(color,fade*.22*pulse);}' });
 for(const [i,o]of [...outlets.values(),...central].entries()){
  const g=new T.Group();g.position.set(o.x-.1,o.y,o.z);root.add(g);
  for(const [radius,length]of [[o.r,o.len],[o.r*.42,o.len*.65]]){
   const geo=new T.CylinderGeometry(.12,radius,length,24,12,true);geo.translate(0,length/2,0);geo.rotateZ(Math.PI/2);
   const flame=new T.Mesh(geo,material);flame.name='Exhaust_flame';g.add(flame);
  }
  plumes.push({g,phase:i*1.7});
 }
 // Three restrained lights illuminate the two pod collars and central bank.
 for(const z of [-126.16,0,126.16]){const light=new T.PointLight(0x8ecbff,14,23,2);light.position.set(z===0?-302.8:-294.8,z===0?1.5:-12,z);root.add(light);}
 root.userData.outlets=[...outlets.values(),...central];
 return {root,update(time,animate=true){const t=animate?time:0;material.uniforms.pulse.value=.94+.06*Math.sin(t*3);for(const p of plumes)p.g.scale.x=1+.035*Math.sin(t*4+p.phase);}};
}
