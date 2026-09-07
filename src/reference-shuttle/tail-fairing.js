import * as T from 'three';
import { exteriorRoofY } from './base/exterior-profile.js';

// Smooth the aft roof as a height field, rather than averaging normals across
// the old pinched triangles. The same displacement carries its surface details.
export function smoothTailFairing(root) {
  const step=2,x0=-280,nx=181,nz=51;
  const raw=new Float64Array(nx*nz),alongX=new Float64Array(nx*nz),blurred=new Float64Array(nx*nz);
  for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++)raw[ix*nz+iz]=exteriorRoofY(x0+ix*step,iz*step);
  const kernel=sigma=>{const r=Math.ceil(sigma*3),values=Array.from({length:2*r+1},(_,i)=>Math.exp(-.5*((i-r)/sigma)**2)),total=values.reduce((a,b)=>a+b,0);return {r,values:values.map(v=>v/total)};};
  const kx=kernel(6),kz=kernel(3);
  for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++) {
    let value=0;for(let k=-kx.r;k<=kx.r;k++)value+=raw[T.MathUtils.clamp(ix+k,0,nx-1)*nz+iz]*kx.values[k+kx.r];
    alongX[ix*nz+iz]=value;
  }
  for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++) {
    let value=0;for(let k=-kz.r;k<=kz.r;k++)value+=alongX[ix*nz+Math.min(nz-1,Math.abs(iz+k))]*kz.values[k+kz.r];
    blurred[ix*nz+iz]=value;
  }
  const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
  function sample(data,x,z) {
    const u=T.MathUtils.clamp((x-x0)/step,1,nx-3),v=T.MathUtils.clamp(Math.abs(z)/step,0,nz-3),i=Math.floor(u),j=Math.floor(v),rows=[];
    for(let dx=-1;dx<=2;dx++) {
      const at=dz=>data[(i+dx)*nz+Math.abs(j+dz)];
      rows.push(cubic(at(-1),at(0),at(1),at(2),v-j));
    }
    return cubic(...rows,u-i);
  }
  const smooth=T.MathUtils.smoothstep;
  const window=x=>smooth(x,-255,-210)*(1-smooth(x,0,55));
  function fillet(x,z) {
    const radius=9*smooth(x,-257,-229)*(1-smooth(x,-190,-145));
    const distance=Math.max(0,Math.abs(z)-4.2);
    return radius>0&&distance<radius?radius-Math.sqrt(Math.max(0,radius*radius-(radius-distance)**2)):0;
  }
  function roof(x,z) {
    const old=sample(raw,x,z),weight=window(x)*smooth(old,12,28);
    return old+(sample(blurred,x,z)-old)*weight+fillet(x,z);
  }
  const oldRoot=root.getObjectByName('Tail_root_dorsal_fairing');
  if(oldRoot)oldRoot.parent.remove(oldRoot);
  // These flat covers and long diagonal hatch marks belonged to the former
  // stepped roof. They conflict with the new fairing rather than describing it.
  const obsolete=[];
  root.traverse(object=>{if(['Dorsal_service_cover','Dorsal_cover_latch','Dorsal_maintenance_hatch'].includes(object.name))obsolete.push(object);});
  for(const object of obsolete)object.parent.remove(object);
  root.updateMatrixWorld(true);
  const point=new T.Vector3(),normal=new T.Vector3();let vertices=0,maxChange=0;
  root.traverse(object=>{
    if(!object.isMesh)return;
    let shell=false;for(let p=object.parent;p;p=p.parent)if(p.name==='Port_shell'||p.name==='Starboard_shell')shell=true;
    if(!shell)return;
    const skin=object.name.startsWith('Smooth_pressure_envelope_');
    const positions=object.geometry.attributes.position,normals=object.geometry.attributes.normal,inverse=object.matrixWorld.clone().invert();
    if(object.name==='Hull_panel_seams') {
      const source=object.geometry.index?.array||Array.from({length:positions.count},(_,i)=>i),indices=[];
      for(let i=0;i<source.length;i+=3) {
        let x=0,y=0;
        for(let k=0;k<3;k++){point.fromBufferAttribute(positions,source[i+k]).applyMatrix4(object.matrixWorld);x+=point.x/3;y+=point.y/3;}
        if(x>-255&&x<45&&y>13)continue;
        indices.push(source[i],source[i+1],source[i+2]);
      }
      object.geometry.setIndex(indices);
    }
    const localNormal=new T.Matrix3().getNormalMatrix(inverse);let changed=false;
    for(let i=0;i<positions.count;i++) {
      point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
      const {x,y,z}=point;
      if(x<=-257||x>=55||y<=12||Math.abs(z)>=94)continue;
      const old=sample(raw,x,z),next=roof(x,z),weight=smooth(y,12,28);
      // Set skin to the smooth height field. Preserve each detail's offset.
      const target=skin?next:y+(next-old);
      point.y=T.MathUtils.lerp(y,target,weight);
      const change=Math.abs(point.y-y);maxChange=Math.max(maxChange,change);
      if(change>1e-5) {point.applyMatrix4(inverse);positions.setXYZ(i,point.x,point.y,point.z);vertices++;changed=true;}
      if(skin&&weight>.99&&normals) {
        const d=.25,dx=(roof(x+d,z)-roof(x-d,z))/(2*d),dz=(roof(x,z+d)-roof(x,z-d))/(2*d);
        normal.set(-dx,1,-dz).applyMatrix3(localNormal).normalize();normals.setXYZ(i,normal.x,normal.y,normal.z);
      }
    }
    if(changed) {
      if(!skin)object.geometry.computeVertexNormals();
      object.geometry.computeBoundingBox();object.geometry.computeBoundingSphere();
    }
  });
  // A small number of deliberate, continuous joints replaces the criss-cross
  // of old shelf seams. Each joint follows the finished height field.
  const jointMaterial=new T.MeshStandardMaterial({name:'LEO_smoothed_fairing_joints',color:0x8a949f,roughness:.8,metalness:.1});
  function joint(points) {
    const curve=new T.CatmullRomCurve3(points,false,'centripetal');
    const mesh=new T.Mesh(new T.TubeGeometry(curve,points.length*2,.055,5,false),jointMaterial);
    mesh.name='Smoothed_aft_panel_joint';root.add(mesh);
  }
  for(const [x,width] of [[-205,38],[-100,58]])joint(Array.from({length:81},(_,i)=>{const z=-width+2*width*i/80;return new T.Vector3(x,roof(x,z)+.13,z);}));
  for(const z of [-24,24])joint(Array.from({length:101},(_,i)=>{const x=-240+245*i/100;return new T.Vector3(x,roof(x,z)+.13,z);}));
  // Measure the roof's longitudinal curvature away from the added root fillet.
  let before=0,after=0;
  for(let x=-190;x<=0;x+=2)for(let z=20;z<=45;z+=5) {
    const lap=f=>Math.abs(f(x-2,z)-2*f(x,z)+f(x+2,z));
    before+=lap((x,z)=>sample(raw,x,z));after+=lap(roof);
  }
  if(!(after<before))throw new Error('Tail fairing did not reduce roof curvature variation');
  root.userData.tailFairing={vertices,maxChangeMetres:maxChange,curvatureBefore:before,curvatureAfter:after,description:'Smoothed aft roof with an integrated tail-root fillet and continuous surface normals'};
}
