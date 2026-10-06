import * as T from 'three';

// The small shuttle that flies beside Leo on the concept sheet: ~32 m long, white over a navy belly, a dark canopy
// band and twin engines. It keeps station off the starboard side, below the hull (where the boarding and concept
// cameras see it), drifting a few metres and rolling gently; with reduced motion it holds still. It gives the
// 564 m ship a sense of scale. It lives outside the exterior, so the Explode dial and the paint pass leave it alone.

const STATION=[-60,-62,168],LENGTH=22,RADIUS=4.2,FLATTEN=[1,.62,.95],BELLY=.05;
const DRIFT={x:[10,.11,0],y:[2.5,.23,1],z:[4,.17,2]},PITCH=.02,ROLL=.04;
const CERAMIC=0xb8bbc6,NAVY=0x262d3f,GLASS=0x1c2a3c,AMBER=0xd9822f,GLOW=0x8fd8ff;

export function createEscortShuttle(){
 const root=new T.Group();root.name='Escort_shuttle';root.position.set(...STATION);
 // One flattened capsule along x; its lower part is navy through vertex colours.
 const body=new T.CapsuleGeometry(RADIUS,LENGTH,8,24);body.rotateZ(Math.PI/2);body.scale(...FLATTEN);
 const p=body.attributes.position,colors=new Float32Array(p.count*3),white=new T.Color(CERAMIC),navy=new T.Color(NAVY);
 for(let i=0;i<p.count;i++){const c=p.getY(i)<RADIUS*FLATTEN[1]*BELLY?navy:white;colors.set([c.r,c.g,c.b],i*3);}
 body.setAttribute('color',new T.BufferAttribute(colors,3));
 const part=(name,geometry,material,position)=>{const m=new T.Mesh(geometry,material);m.name=name;m.position.set(...position);root.add(m);return m;};
 part('Escort_hull',body,new T.MeshStandardMaterial({vertexColors:true,roughness:.42,metalness:.14}),[0,0,0]);
 const glass=new T.MeshStandardMaterial({color:GLASS,roughness:.18,metalness:.5}),dark=new T.MeshStandardMaterial({color:NAVY,roughness:.5,metalness:.4});
 const canopy=new T.CapsuleGeometry(1.1,7,4,12);canopy.rotateZ(Math.PI/2);canopy.scale(1,.55,2.7);part('Escort_canopy',canopy,glass,[7.5,1.85,0]);
 for(const z of [-1,1])for(let k=0;k<5;k++)part('Escort_window',new T.BoxGeometry(1.6,.5,.1),glass,[-6+k*3,.55,z*RADIUS*FLATTEN[2]*.985]);
 for(const z of [-1.7,1.7]){
  const bell=new T.CylinderGeometry(1.1,.85,2.4,16,1,true);bell.rotateZ(Math.PI/2);part('Escort_engine',bell,dark,[-LENGTH/2-RADIUS*.8,-.2,z]);
  const glow=new T.CircleGeometry(.8,16);glow.rotateY(-Math.PI/2);part('Escort_engine_glow',glow,new T.MeshBasicMaterial({color:GLOW,transparent:true,opacity:.75,blending:T.AdditiveBlending,depthWrite:false}),[-LENGTH/2-RADIUS*.8-.6,-.2,z]);
 }
 part('Escort_marker',new T.SphereGeometry(.45,10,6),new T.MeshStandardMaterial({color:AMBER,emissive:AMBER,emissiveIntensity:.6}),[LENGTH/2+RADIUS*.98,-.6,0]);
 root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
 const wave=([a,f,phase],t)=>a*Math.sin(t*f+phase);
 return {root,update(t,moving=true){
  if(!moving)t=0;
  root.position.set(STATION[0]+wave(DRIFT.x,t),STATION[1]+wave(DRIFT.y,t),STATION[2]+wave(DRIFT.z,t));
  root.rotation.set(ROLL*Math.sin(t*DRIFT.z[1]+DRIFT.z[2]),0,PITCH*Math.cos(t*DRIFT.y[1]+DRIFT.y[2]));
 }};
}
