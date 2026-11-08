import * as T from 'three';

// Third-person follow camera (Voyager's Reach chaseCamera.ts, tuned for rooms and corridors): it orbits a pivot at
// the walker's shoulders, pulls in at once when a wall comes between and eases back out. View 'first' puts it at
// the eyes. Yaw 0 looks along +z. Riding the longboard (glide.js), `ride` (0..1) eases the pivot down to the board
// and the rider's middle, square behind them rather than over a shoulder, and pulls back `rideBack` so both fit.
export const VIEW={distance:3.4,shoulder:.32,pivot:.86,ridePivot:.15,rideBack:1.3,eye:.93,crouchEye:.68,stanceDuration:.35,minPitch:-1.2,maxPitch:1.1,clearance:.22};

export class FollowCamera{
 constructor(camera,colliders){
  this.camera=camera;this.colliders=colliders;this.yaw=0;this.pitch=-.18;this.mode='third';this.distance=VIEW.distance;
  this.current=VIEW.distance;this.crouch=0;this.ride=0;this.ray=new T.Ray();this.pivot=new T.Vector3();
 }
 look(dx,dy){this.yaw-=dx;this.pitch=T.MathUtils.clamp(this.pitch-dy,VIEW.minPitch,VIEW.maxPitch);}
 // The direction the camera faces on the ground plane, for camera-relative movement.
 forward(out=new T.Vector3()){return out.set(Math.sin(this.yaw),0,Math.cos(this.yaw));}
 // `feet` is the walker's origin, `height` its standing height.
 update(dt,feet,height,stance=null){
  // Match the crouch pose's transition; other activities keep their own camera height.
  this.crouch=stance===null?0:T.MathUtils.clamp(this.crouch+(stance==='crouch'?1:-1)*dt/VIEW.stanceDuration,0,1);
  const cam=this.camera,dir=new T.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch));
  if(this.mode==='first'){
   const eye=T.MathUtils.lerp(VIEW.eye,VIEW.crouchEye,T.MathUtils.smoothstep(this.crouch,0,1));
   cam.position.set(feet.x,feet.y+height*eye,feet.z).addScaledVector(new T.Vector3(dir.x,0,dir.z).normalize(),.12);
   cam.lookAt(cam.position.clone().add(dir));return;
  }
  const right=new T.Vector3(-Math.cos(this.yaw),0,Math.sin(this.yaw));
  const ride=T.MathUtils.smoothstep(this.ride,0,1),shoulder=VIEW.shoulder*(1-ride),reach=this.distance+VIEW.rideBack*ride;
  this.pivot.set(feet.x,feet.y+height*T.MathUtils.lerp(VIEW.pivot,VIEW.ridePivot,ride),feet.z).addScaledVector(right,shoulder);
  // Keep the shoulder offset itself clear of a wall beside the walker.
  this.ray.origin.set(feet.x,this.pivot.y,feet.z);this.ray.direction.copy(right);
  const side=shoulder>0&&this.colliders.raycast(this.ray,shoulder+VIEW.clearance);
  if(side)this.pivot.set(feet.x,this.pivot.y,feet.z).addScaledVector(right,Math.max(0,side.distance-VIEW.clearance));
  this.ray.origin.copy(this.pivot);this.ray.direction.copy(dir).negate();
  const hit=this.colliders.raycast(this.ray,reach+VIEW.clearance),clear=hit?Math.max(.3,hit.distance-VIEW.clearance):reach;
  this.current=clear<this.current?clear:T.MathUtils.damp(this.current,clear,4,dt);
  cam.position.copy(this.pivot).addScaledVector(dir,-this.current);
  cam.lookAt(this.pivot);
 }
 // How visible the walker should be: fade the body when the camera is pressed into it.
 get bodyOpacity(){return this.mode==='first'?0:T.MathUtils.smoothstep(this.current,.45,1.1);}
}
