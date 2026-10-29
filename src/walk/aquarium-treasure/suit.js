import * as T from 'three';

// A small white pressure suit over Cosmo's moving rig: padded limbs, a pack and a clear bubble helmet.
export function createSwimSuit(figure,body){
 const group=new T.Group();group.name='Aquarium_spacesuit';group.visible=false;body.add(group);
 const white=new T.MeshStandardMaterial({color:0xe4ecf1,roughness:.65}),dark=new T.MeshStandardMaterial({color:0x202e40,roughness:.55});
 const orange=new T.MeshBasicMaterial({color:0xff8c42,toneMapped:false});
 const shell=new T.MeshPhysicalMaterial({color:0x98eaff,transparent:true,opacity:.16,depthWrite:false,roughness:.08,side:T.DoubleSide});
 const sphere=new T.SphereGeometry(1,16,10),cylinder=new T.CylinderGeometry(1,1,1,10);
 const add=(g,m)=>{const o=new T.Mesh(g,m);group.add(o);return o;};
 const limb=(a,b,r)=>({a,b,r,mesh:add(cylinder,white),joint:add(sphere,dark)}),parts=[];
 for(const s of ['L','R'])parts.push(limb('upper_arm.'+s,'forearm.'+s,.095),limb('forearm.'+s,'hand.'+s,.08),limb('thigh.'+s,'shin.'+s,.125),limb('shin.'+s,'foot.'+s,.1));
 const vest=add(sphere,white),pack=add(new T.BoxGeometry(.37,.42,.2),dark),panel=add(new T.BoxGeometry(.25,.18,.035),orange);
 const helmet=add(new T.SphereGeometry(.43,24,16),shell),collar=add(new T.TorusGeometry(.24,.04,8,24),orange);
 helmet.renderOrder=3;
 const inv=new T.Matrix4(),a=new T.Vector3(),b=new T.Vector3(),up=new T.Vector3(0,1,0),headQ=new T.Quaternion();
 const at=(name,out)=>figure.bones.get(name).getWorldPosition(out).applyMatrix4(inv);
 function update(on){
  group.visible=on;if(!on)return;
  body.updateWorldMatrix(true,true);inv.copy(body.matrixWorld).invert();
  for(const p of parts){at(p.a,a);at(p.b,b);p.mesh.position.copy(a).add(b).multiplyScalar(.5);p.mesh.scale.set(p.r,a.distanceTo(b)*.85,p.r);
   p.mesh.quaternion.setFromUnitVectors(up,b.sub(a).normalize());p.joint.position.copy(a);p.joint.scale.setScalar(p.r*1.06);}
  at('spine',a);at('spine.003',b);vest.position.copy(a).lerp(b,.6);vest.scale.set(.22,.3,.17);vest.quaternion.setFromUnitVectors(up,b.sub(a).normalize());
  pack.position.set(0,0,-.23).applyQuaternion(vest.quaternion).add(vest.position);pack.quaternion.copy(vest.quaternion);
  panel.position.set(0,.08,.17).applyQuaternion(vest.quaternion).add(vest.position);panel.quaternion.copy(vest.quaternion);
  const head=figure.bones.get('spine.006');at('spine.006',a);head.getWorldQuaternion(headQ);
  headQ.premultiply(body.getWorldQuaternion(new T.Quaternion()).invert());
  helmet.position.set(0,.18,-.025).applyQuaternion(headQ).add(a);helmet.quaternion.copy(headQ);
  collar.position.copy(a);collar.quaternion.copy(headQ).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2));
 }
 return {update,dispose(){group.removeFromParent();for(const g of new Set(group.children.map(o=>o.geometry)))g.dispose();for(const m of [white,dark,orange,shell])m.dispose();}};
}
