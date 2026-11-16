import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {seeded} from './polish-kit.js';

// Five small silhouettes share one unlit material. Their glow needs no room lights or bloom.
export function domePlants(root,{x,z,y,inner,outer,door}){
 const rnd=seeded(379),up=new T.Vector3(0,1,0),parts=[];
 const add=(g,color)=>{const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();const c=new T.Color(color),a=new Float32Array(n.attributes.position.count*3);
  for(let i=0;i<a.length;i+=3)c.toArray(a,i);n.setAttribute('color',new T.BufferAttribute(a,3));parts.push(n);};
 const rod=(a,b,r,color)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A);
  add(new T.CylinderGeometry(r,r,d.length(),4,1,true).applyQuaternion(new T.Quaternion().setFromUnitVectors(up,d.normalize())).translate(...A.add(B).multiplyScalar(.5).toArray()),color);};
 const leaf=(a,b,width,color)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),m=A.clone().lerp(B,.48),side=new T.Vector3(B.z-A.z,0,A.x-B.x).normalize().multiplyScalar(width);
  const g=new T.BufferGeometry().setFromPoints([A,m.clone().add(side),B,A,B,m.clone().sub(side)]);g.computeVertexNormals();g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(12),2));add(g,color);};
 const templates=[];
 const finish=name=>{const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());parts.length=0;templates.push({name,g});};
 // Arching fern stems carry paired leaflets, rather than a single foliage blob.
 for(let f=0;f<5;f++){const a=f*Math.PI*2/5,point=t=>[Math.cos(a)*.22*t,.06+.48*Math.sin(t*Math.PI*.65),Math.sin(a)*.22*t];
  for(let k=0;k<6;k++){const t=k/6,A=point(t),B=point((k+1)/6);rod(A,B,.008,0x248b60);
   if(!k)continue;for(const s of [-1,1]){const w=.075*(1-t*.7);leaf(A,[A[0]+Math.cos(a+s*1.05)*w,A[1]+.035,A[2]+Math.sin(a+s*1.05)*w],.018,k%2?0x51ff9c:0x29d5bc);}}}
 finish('fern');
 // Faceted caps, pale stems and luminous cap freckles.
 for(const [cx,cz,h,r] of [[0,0,.42,.135],[-.12,.09,.25,.085],[.12,-.09,.31,.095]]){
  rod([cx,0,cz],[cx,h,cz],.025,0x568eac);
  add(new T.SphereGeometry(r,8,3,0,Math.PI*2,0,Math.PI/2).scale(1,.58,1).translate(cx,h,cz),0xff58db);
  add(new T.CylinderGeometry(r,r*.9,.025,8).translate(cx,h,cz),0xab43ee);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(new T.OctahedronGeometry(.016).translate(cx+Math.cos(a)*r*.55,h+r*.48,cz+Math.sin(a)*r*.55),0xa7fff9);}}
 finish('mushroom');
 // Short ribbed cactus arms, each ending in a small violet flower.
 rod([0,.02,0],[0,.48,0],.075,0x36de91);
 add(new T.OctahedronGeometry(.075).scale(1,.4,1).translate(0,.48,0),0x91ffd2);
 for(const s of [-1,1]){rod([0,.19,0],[s*.13,.24,0],.04,0x20aebb);rod([s*.13,.24,0],[s*.13,.36,0],.04,0x52ffc0);
  add(new T.OctahedronGeometry(.043).scale(1,.6,1).translate(s*.13,.39,0),0xe968ff);}
 for(let i=0;i<6;i++)for(let k=1;k<5;k++){const a=i*Math.PI/3;rod([Math.cos(a)*.071,k*.085,Math.sin(a)*.071],[Math.cos(a)*.092,k*.085+.022,Math.sin(a)*.092],.004,0xb0ffe0);}
 finish('cactus');
 // Hexagonal crystals have straight bodies and pointed crowns.
 for(let i=0;i<5;i++){const a=i*2.4,r=i?.12:0,h=i?.22+i*.04:.52,w=i?.045:.065;
  const body=new T.CylinderGeometry(w,w,h*.65,5).translate(0,h*.325,0),tip=new T.ConeGeometry(w,h*.35,5).translate(0,h*.825,0);
  for(const [g,c] of [[body,i%2?0x7349da:0x38c7e5],[tip,i%2?0xe294ff:0x9bfffa]])add(g.rotateZ(i?.18:0).rotateY(a).translate(Math.cos(a)*r,0,Math.sin(a)*r),c);}
 finish('crystal');
 // A low rosette of folded, pointed leaves.
 for(let i=0;i<11;i++){const a=i*2.4,h=i%3===0?.53:.3+(i%4)*.035,r=i%3===0?.08:.23;
  leaf([0,.02,0],[Math.cos(a)*r,h,Math.sin(a)*r],.04,i%2?0xb65eff:0x54f0ef);}
 finish('spiky');
 const material=new T.MeshBasicMaterial({name:'Lounge_dome_leaf_glow',vertexColors:true,side:T.DoubleSide,toneMapped:false}),sites=[];
 for(let i=0;i<100;i++){const a=i/100*Math.PI*2+(rnd()-.5)*.025,r=(inner+outer)/2+(rnd()-.5)*.12,px=Math.cos(a)*r,pz=Math.sin(a)*r;
  if(pz<0&&Math.abs(px)<door+.65)continue;
  sites.push({i,x:x+px,z:z+pz,scale:.68+rnd()*.34,angle:rnd()*Math.PI*2});}
 const matrix=new T.Matrix4(),q=new T.Quaternion(),position=new T.Vector3(),scale=new T.Vector3();
 const instance=(name,g,items)=>{const mesh=new T.InstancedMesh(g,material,items.length);mesh.name='Lounge_dome_'+name+'_leaf_glow';mesh.userData.noCollide=true;
  items.forEach((p,i)=>{matrix.compose(position.set(p.x,y+(p.lift||0),p.z),q.setFromAxisAngle(up,p.angle||0),scale.setScalar(p.scale));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new T.Color(p.color||0xffffff));});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);};
 templates.forEach(({name,g},k)=>instance(name,g,sites.filter(p=>p.i%5===k)));
 const specks=[];
 for(let i=0;i<180;i++){const a=rnd()*Math.PI*2,r=inner+.15+rnd()*(outer-inner-.3),px=Math.cos(a)*r,pz=Math.sin(a)*r;
  if(pz<0&&Math.abs(px)<door+.5)continue;
  specks.push({x:x+px,z:z+pz,lift:.03+rnd()*.17,scale:.012+rnd()*.014,color:[0x69ffc0,0x4cf4ff,0xff69e6,0xb98aff][i%4]});}
 const speck=new T.OctahedronGeometry(1);speck.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(speck.attributes.position.count*3).fill(1),3));instance('moss',speck,specks);
}
