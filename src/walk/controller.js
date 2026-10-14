import * as T from 'three';
import {BODY} from './collision.js';

// A floating capsule, as in Ecctrl and Voyager's Reach: the capsule spans `step` to `height` above the feet, so kerbs,
// thresholds and stair risers below the step pass under it, and the feet follow the ground found by short rays.
// Positions are the feet (the walker's origin); speeds are metres per second.
// The feel is Voyager's Reach's (world-core/src/sim/movement.ts): speed is reached and given up over a few frames,
// turns grip, the air keeps the run that set it up, and the jump buffers an early press, forgives a late one off a
// ledge, cuts short when let go, and has one more push in the air.
export const MOVE={gravity:22,accel:42,friction:34,airControl:.28,airDrag:2,turnGrip:10,jump:7*Math.SQRT2,maxFall:30,snap:.12,
 coyote:.12,buffer:.15,minJump:.09,cut:.55,slide:.75,slideDecel:6,slideFrom:5.5,crouchSpeed:2};
const MIN_NY=Math.cos(BODY.maxSlope*Math.PI/180);
const FEET=[[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]];

export class Controller{
 constructor(colliders,body=BODY){
  this.colliders=colliders;this.body=body;this.position=new T.Vector3();this.velocity=new T.Vector3();
  this.grounded=false;this.ground=null;this.airTime=0;
  // The jump: time left on an early press, last step's key, seconds since take-off (-1 in a fall), jumps spent.
  this.jumpBuffer=0;this.jumpHeld=false;this.jumpS=-1;this.jumpCount=0;
  // 'stand' | 'crouch' | 'slide' | 'prone'; the capsule stays 2 m tall in every stance.
  this.stance='stand';this.slideS=0;
  this.segment=new T.Line3(new T.Vector3(),new T.Vector3());this.ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0));
 }
 place(p){this.position.copy(p);this.velocity.set(0,0,0);this.grounded=false;this.jumpS=-1;this.jumpCount=0;this.jumpBuffer=0;this.stance='stand';this.slideS=0;this.settle();}
 // Highest walkable ground under the feet within [y-down, y+up]; null over a gap.
 groundAt(p,up,down){
  let best=null;
  for(const [dx,dz] of FEET){
   this.ray.origin.set(p.x+dx,p.y+up,p.z+dz);this.ray.direction.set(0,-1,0);
   const hit=this.colliders.raycast(this.ray,up+down);
   if(hit&&hit.normal.y>=MIN_NY&&(!best||hit.point.y>best.point.y))best=hit;
  }
  return best;
 }
 settle(){const g=this.groundAt(this.position,this.body.step+.05,2);if(g){this.position.y=g.point.y;this.grounded=true;this.ground=g;}}
 // Toggle a stance from the ground: crouch (a slide when running), or prone.
 toggle(stance){
  if(!this.grounded)return;
  if(stance==='crouch'){
   if(this.stance==='crouch'||this.stance==='slide')this.stance='stand';
   else if(this.stance==='stand'&&this.speed>=MOVE.slideFrom){this.stance='slide';this.slideS=MOVE.slide;}
   else this.stance='crouch';
  }else if(stance==='prone')this.stance=this.stance==='prone'?'stand':'prone';
 }
 // One fixed step. `wish` is the desired horizontal velocity (m/s, world xz); `jump` is whether the key is held.
 step(dt,wish,jump=false){
  const v=this.velocity,b=this.body,{radius:r}=b;
  this.jumpJudge(dt,jump);
  if(this.stance==='slide'){this.slideS=Math.max(0,this.slideS-dt);if(this.slideS===0||!this.grounded)this.stance='crouch';}
  this.drive(dt,wish);
  if(!this.grounded)v.y=Math.max(-MOVE.maxFall,v.y-MOVE.gravity*dt);
  this.airTime=this.grounded?0:this.airTime+dt;
  // Move in short hops so a fast walker never skips a thin wall.
  const travel=v.clone().multiplyScalar(dt),hops=Math.max(1,Math.ceil(travel.length()/(r*.5)));
  travel.divideScalar(hops);
  for(let i=0;i<hops;i++){
   this.position.add(travel);
   const s=this.segment;s.start.set(this.position.x,this.position.y+b.step+r,this.position.z);s.end.set(this.position.x,this.position.y+b.height-r,this.position.z);
   const push=this.colliders.resolve(s,r);
   if(push.lengthSq()>0){
    this.position.x+=push.x;this.position.z+=push.z;
    // A ceiling stops a rise; a wall takes the velocity into it.
    if(push.y<-1e-4&&v.y>0)v.y=0;
    const n=new T.Vector3(push.x,0,push.z);if(n.lengthSq()>1e-8){n.normalize();const into=v.x*n.x+v.z*n.z;if(into<0){v.x-=n.x*into;v.z-=n.z*into;}}
   }
  }
  // Ground: snap down while walking (stairs and ramps), land when falling onto it.
  const reach=this.grounded?b.step+MOVE.snap:Math.max(.05,-v.y*dt+.05);
  const g=v.y>.5?null:this.groundAt(this.position,b.step+.05,reach);
  if(g&&(this.grounded||v.y<=0)){this.position.y=g.point.y;v.y=0;this.grounded=true;this.ground=g;this.jumpS=-1;this.jumpCount=0;}
  else{this.grounded=false;this.ground=null;}
  return this;
 }
 // The jump, settled before anything moves (movement.ts stepPlayer).
 jumpJudge(dt,held){
  const pressed=held&&!this.jumpHeld;this.jumpHeld=held;
  this.jumpBuffer=Math.max(0,(pressed?MOVE.buffer:this.jumpBuffer)-dt);
  if(this.jumpS>=0)this.jumpS+=dt;
  if(this.grounded)this.jumpCount=0;
  // Coyote time spends the ground jump; after it a ledge fall has only the air jump left.
  const footing=this.grounded||(this.airTime<=MOVE.coyote&&this.jumpCount===0),air=!footing&&pressed&&this.jumpCount<2;
  if((footing&&this.jumpBuffer>0)||air){
   this.stance='stand';this.slideS=0;this.jumpCount=footing?1:2;this.velocity.y=MOVE.jump;this.grounded=false;this.jumpBuffer=0;this.jumpS=0;
  }else if(this.jumpS>=MOVE.minJump&&!held&&this.velocity.y>0){this.velocity.y*=MOVE.cut;this.jumpS=-1;}
 }
 // Horizontal: the velocity approaches the wish at a limited rate, one rate for the pair so a diagonal turn takes as
 // long as a straight one; on the ground, velocity across the wish goes faster (the turn grips).
 drive(dt,wish){
  const v=this.velocity;
  if(this.stance==='slide'){const s=Math.hypot(v.x,v.z),k=s>1e-6?Math.max(0,s-MOVE.slideDecel*dt)/s:0;v.x*=k;v.z*=k;if(s*k<MOVE.crouchSpeed){this.stance='crouch';this.slideS=0;}return;}
  const wx=wish.x,wz=wish.z,want=Math.hypot(wx,wz);
  if(this.grounded&&want>1e-6){const nx=wx/want,nz=wz/want,along=v.x*nx+v.z*nz,grip=1-Math.exp(-MOVE.turnGrip*dt);v.x-=(v.x-nx*along)*grip;v.z-=(v.z-nz*along)*grip;}
  const dx=wx-v.x,dz=wz-v.z,gap=Math.hypot(dx,dz);if(gap<1e-6){v.x=wx;v.z=wz;return;}
  const accel=this.grounded?MOVE.accel:MOVE.accel*MOVE.airControl,brake=this.grounded?MOVE.friction:MOVE.airDrag;
  const k=Math.min(1,(want>=Math.hypot(v.x,v.z)?accel:brake)*dt/gap);v.x+=dx*k;v.z+=dz*k;
 }
 get speed(){return Math.hypot(this.velocity.x,this.velocity.z);}
}
