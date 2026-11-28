import * as T from 'three';
import {setWorldQuat,turn} from '../cosmo-pose.js';
import {solveSeatedLimb} from './vr/seatedContacts.ts';
import {FROG_AT,FROG_BODY_Y,FROG_CUES,frogEase} from './frog-lick.js';

const mix=T.MathUtils.lerp,up=new T.Vector3(0,1,0);
let mouth,tongueShape,tonguePink;
export function createFrogPose(holder,figure){
 const bone=name=>figure.bones.get(name),head=bone('spine.006'),hip=bone('spine'),chest=bone('spine.003');
 if(!mouth){
  const eyes=figure.asset.meshes.find(m=>m.name==='eyes');
  // The point under the nose, measured on Cosmo's face in the bind pose.
  mouth=new T.Vector3(0,1.221,.243).applyMatrix4(eyes.bindMatrix).applyMatrix4(eyes.skeleton.boneInverses[eyes.skeleton.bones.indexOf(head)]);
  tongueShape=new T.SphereGeometry(1,16,10);tonguePink=new T.MeshStandardMaterial({color:0xff789e,emissive:0x6b223a,emissiveIntensity:.3,roughness:.52});
 }
 const tongue=new T.Mesh(tongueShape,tonguePink),grip=new T.Group();
 tongue.name='Frog_lick_tongue';tongue.visible=false;holder.add(grip,tongue);
 const limbs=['L','R'].map((side,i)=>({out:i?-1:1,thigh:bone('thigh.'+side),shin:bone('shin.'+side),foot:bone('foot.'+side),
  shoulder:bone('upper_arm.'+side),elbow:bone('forearm.'+side),hand:bone('hand.'+side)}));
 const xAxis=new T.Vector3(),yAxis=new T.Vector3(),origin=new T.Vector3(),tip=new T.Vector3(),direction=new T.Vector3(),
  rotation=new T.Quaternion(),basis=new T.Matrix4();
 return {grip,apply(frame){
  tongue.visible=false;if(!frame)return;
  const {take,face,lick:lickAt,lower,release}=FROG_CUES,{t,yaw}=frame;
  const lift=frogEase(t,take,face)*(1-frogEase(t,lower,release));
  const reach=frogEase(t,.16,take)*(1-frogEase(t,release,3.67)),bend=reach*(1-lift);
  const lick=frogEase(t,lickAt,1.93)*(1-frogEase(t,2.56,lower));
  holder.getWorldQuaternion(rotation);xAxis.set(1,0,0).applyQuaternion(rotation);yAxis.set(0,1,0).applyQuaternion(rotation);
  if(bend>.001){
   // Lower the hips and tip forward, keeping the shoes where the standing pose put them.
   const feet=limbs.map(({foot})=>[holder.worldToLocal(foot.getWorldPosition(new T.Vector3())).toArray(),foot.getWorldQuaternion(new T.Quaternion())]);
   figure.asset.root.position.y-=.29*bend;
   turn(hip,xAxis,73*bend);
   limbs.forEach(({thigh,shin,foot,out},i)=>{
    solveSeatedLimb(holder,thigh,shin,foot,feet[i][0],[out*.28,0,1]);setWorldQuat(foot,feet[i][1]);
   });
  }
  // Look down at the frog, then lean in once with the muzzle.
  turn(chest,xAxis,8*lick);turn(head,xAxis,-38*bend+11*lift+3*lick);turn(head,yAxis,12*lift*(1-lick));
  const home=holder.worldToLocal(origin.set(FROG_AT[0],FROG_AT[1]+FROG_BODY_Y,FROG_AT[2]));
  // Leave space between the muzzle and the frog's face when both hands are up.
  grip.position.set(mix(home.x,.035,lift),mix(home.y,1.19,lift),mix(home.z,.62,lift));
  const from=Math.atan2(-Math.sin(yaw),Math.cos(yaw));
  grip.rotation.y=from+Math.atan2(Math.sin(-Math.PI/2-from),Math.cos(-Math.PI/2-from))*lift;
  for(const {out,shoulder,elbow,hand} of limbs){
   const a=shoulder.quaternion.clone(),b=elbow.quaternion.clone(),c=hand.quaternion.clone();
   solveSeatedLimb(holder,shoulder,elbow,hand,[grip.position.x+out*.205,grip.position.y-.035,grip.position.z-mix(.10,.18,lift)],[out*.7,-1,-.1]);
   // Both palms cup the frog from underneath, fingers coming in from the sides.
   const along=new T.Vector3(-out*.66,0,.75).normalize(),across=new T.Vector3().crossVectors(along,up);
   setWorldQuat(hand,rotation.clone().multiply(new T.Quaternion().setFromRotationMatrix(basis.makeBasis(across,along,up))));
   shoulder.quaternion.copy(a.slerp(shoulder.quaternion,reach));elbow.quaternion.copy(b.slerp(elbow.quaternion,reach));hand.quaternion.copy(c.slerp(hand.quaternion,reach));
  }
  if(lick>.001){
   holder.worldToLocal(origin.copy(head.localToWorld(tip.copy(mouth))));
   // One stroke from the cheek along the outer flank, then back into the muzzle.
   const stroke=frogEase(t,1.89,2.57);
   tip.set(grip.position.x+.15+.025*Math.sin(stroke*Math.PI),grip.position.y+mix(.075,.115,stroke),grip.position.z+mix(-.19,-.026,stroke)).lerp(origin,1-lick);
   direction.subVectors(tip,origin);tongue.position.copy(origin).lerp(tip,.5);
   tongue.quaternion.setFromUnitVectors(up,direction.clone().normalize());tongue.scale.set(.034,direction.length()*.57,.019);tongue.visible=true;
  }
 }};
}
