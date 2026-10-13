import * as T from 'three';
import {BODY} from './collision.js';

// A floating capsule, as in Ecctrl and Voyager's Reach: the capsule spans `step` to `height` above the feet, so kerbs,
// thresholds and stair risers below the step pass under it, and the feet follow the ground found by short rays.
// Positions are the feet (the walker's origin); speeds are metres per second.
export const MOVE={gravity:22,accel:42,friction:34,airControl:.35,jump:5.2,maxFall:30,snap:.12};
const MIN_NY=Math.cos(BODY.maxSlope*Math.PI/180);
const FEET=[[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]];

export class Controller{
 constructor(colliders,body=BODY){
  this.colliders=colliders;this.body=body;this.position=new T.Vector3();this.velocity=new T.Vector3();
  this.grounded=false;this.ground=null;this.airTime=0;
  this.segment=new T.Line3(new T.Vector3(),new T.Vector3());this.ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0));
 }
 place(p){this.position.copy(p);this.velocity.set(0,0,0);this.grounded=false;this.settle();}
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
 // One fixed step. `wish` is the desired horizontal velocity (m/s, world xz); `jump` asks for a jump this step.
 step(dt,wish,jump=false){
  const v=this.velocity,b=this.body,{radius:r}=b;
  const horizontal=new T.Vector3(v.x,0,v.z),target=new T.Vector3(wish.x,0,wish.z);
  const rate=(target.lengthSq()>1e-4?MOVE.accel:MOVE.friction)*(this.grounded?1:MOVE.airControl);
  const change=target.sub(horizontal),max=rate*dt;if(change.length()>max)change.setLength(max);
  v.x+=change.x;v.z+=change.z;
  if(this.grounded&&jump){v.y=MOVE.jump;this.grounded=false;}
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
  if(g&&(this.grounded||v.y<=0)){this.position.y=g.point.y;v.y=0;this.grounded=true;this.ground=g;}
  else{this.grounded=false;this.ground=null;}
  return this;
 }
 get speed(){return Math.hypot(this.velocity.x,this.velocity.z);}
}
