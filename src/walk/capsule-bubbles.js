import * as T from 'three';

// Small instanced bubbles stay inside the glass and rise with the suite's animation clock.
export function capsuleBubbles(capsules,still=false){
 const count=16,mesh=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshBasicMaterial({color:0xa9edff,transparent:true,opacity:.7,depthWrite:false,toneMapped:false}),capsules.length*count);
 mesh.name='Healing_capsule_bubbles';mesh.frustumCulled=false;mesh.userData.noCollide=true;
 const dummy=new T.Object3D();
 function update(t){for(let i=0;i<capsules.length;i++)for(let j=0;j<count;j++){
  const [x,z]=capsules[i],a=j*2.399+i*.7,r=.32+.12*((j*7)%5)/4;
  const y=.30+((j/count+(still?0:t*.11)*(0.8+(j%3)*.1))%1)*2.05,size=.018+(j%4)*.006;
  dummy.position.set(x+Math.cos(a)*r,y,z+Math.sin(a)*r);dummy.scale.setScalar(size);dummy.updateMatrix();mesh.setMatrixAt(i*count+j,dummy.matrix);
 }mesh.instanceMatrix.needsUpdate=true;}
 update(0);return {mesh,update};
}
