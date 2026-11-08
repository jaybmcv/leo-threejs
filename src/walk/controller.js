import * as T from 'three';
import {BODY} from './collision.js';

// A floating capsule, as in Ecctrl and Voyager's Reach: the capsule spans `step` to `height` above the feet, so kerbs,
// thresholds and stair risers below the step pass under it, and the feet follow the ground found by short rays.
// Positions are the feet (the walker's origin); speeds are metres per second.
// A body may set its own take-off speed `jump` and how many jumps it has (`jumps`, default 2); the hamster ball hops once, low.
// The feel is Voyager's Reach's (world-core/src/sim/movement.ts): speed is reached and given up over a few frames,
// turns grip, the air keeps the run that set it up, and the jump buffers an early press, forgives a late one off a
// ledge, cuts short when let go, and has one more push in the air.
export const MOVE={gravity:22,accel:42,friction:34,airControl:.28,airDrag:2,turnGrip:10,jump:7*Math.SQRT2,maxFall:30,snap:.12,
 coyote:.12,buffer:.15,minJump:.09,cut:.55,slide:.75,slideDecel:6,slideFrom:5.5,crouchSpeed:2};
// The longboard glide (glide.js): Space held through a fall with a real drop below (no walkable ground within
// `minDrop`, more than a held double jump's 4.4 m) rides the board down. It sinks at `sink` m/s at the cruise `speed`, faster as it dives towards `dive`
// (Shift), and `catch` is how quickly a deployed board takes up that sink rate from the fall. In the air it steers
// by the wish with `accel`, its velocity turning towards the wish at `grip`; with no keys it coasts, losing `drag`
// m/s each second. Letting go of Space puts the board away; landing does too. A body with `glide:false` never glides.
export const GLIDE={minDrop:5,deploy:-1,sink:1.3,diveSink:3.2,speed:9,dive:15,catch:4,accel:12,grip:3,drag:1.2};
// The grapple hook (grapple.js): Q or the right mouse button fires a line at whatever is in the middle of the view,
// up to `range` metres off. When it bites, the line runs from the hand (`hand` m above the feet) to that point and
// will not stretch: everything else is gravity, so the walker swings under it. The bite yanks the walker `yank` m/s
// along the line and winds it in at `take` m/s to `keep` of its length, which lifts him off the floor and starts the
// swing; from there it holds its length. Shift reels in at `reel` m/s, down to `min` m. In the air W A S D pump the swing at `pump` m/s². A line longer than it should be is pulled
// back at `stiff` per second. Letting go keeps the swing's speed (up to `maxSpeed`); Space lets go with a hop.
export const HOOK={range:65,hand:1.5,shot:160,yank:6,take:10,keep:.6,reel:14,min:2.5,pump:7,stiff:12,maxSpeed:32};
const MIN_NY=Math.cos(BODY.maxSlope*Math.PI/180);
const FEET=[[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]];
const line=new T.Vector3();

export class Controller{
 constructor(colliders,body=BODY){
  this.colliders=colliders;this.body=body;this.position=new T.Vector3();this.velocity=new T.Vector3();
  this.grounded=false;this.ground=null;this.airTime=0;this.bounceS=0;
  // The highest the feet have been since the last ground, and how far the last landing dropped from it.
  this.top=0;this.fell=0;
  // The jump: time left on an early press, last step's key, seconds since take-off (-1 in a fall), jumps spent.
  this.jumpBuffer=0;this.jumpHeld=false;this.jumpS=-1;this.jumpCount=0;
  // 'stand' | 'crouch' | 'slide' | 'prone'; the capsule stays 2 m tall in every stance.
  this.stance='stand';this.slideS=0;
  // Riding the longboard down (GLIDE), and for how long this ride has lasted.
  this.gliding=false;this.glideS=0;
  // Hanging on the grapple line (HOOK): where it bit, how long the line is now, and the length it winds in to.
  this.hook=null;this.rope=0;this.ropeTo=0;
  this.segment=new T.Line3(new T.Vector3(),new T.Vector3());this.ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0));
 }
 place(p){this.position.copy(p);this.top=p.y;this.fell=0;this.velocity.set(0,0,0);this.bounceS=0;this.grounded=false;this.jumpS=-1;this.jumpCount=0;this.jumpBuffer=0;this.stance='stand';this.slideS=0;this.gliding=false;this.glideS=0;this.hook=null;this.settle();}
 // Highest walkable ground under the feet within [y-down, y+up]; null over a gap.
 groundAt(p,up,down){
  let best=null;
  for(const [dx,dz] of FEET){
   this.ray.origin.set(p.x+dx,p.y+up,p.z+dz);this.ray.direction.set(0,-1,0);
   const hit=(this.colliders.raycastGround||this.colliders.raycast).call(this.colliders,this.ray,up+down);
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
 // One fixed step. `wish` is the desired horizontal velocity (m/s, world xz); `jump` is whether the key is held;
 // `reel` (Shift) winds in the grapple line.
 step(dt,wish,jump=false,bounce=null,reel=false){
  const v=this.velocity,b=this.body,{radius:r}=b;
  this.jumpJudge(dt,jump);
  this.glideJudge(dt,jump);
  if(this.stance==='slide'){this.slideS=Math.max(0,this.slideS-dt);if(this.slideS===0||!this.grounded)this.stance='crouch';}
  // Give a ball's rebound a moment to fade before steering takes over again.
  if(!bounce)this.bounceS=0;
  if(this.bounceS>0){this.bounceS=Math.max(0,this.bounceS-dt);const drag=Math.exp(-bounce.drag*dt);v.x*=drag;v.z*=drag;}
  else if(this.hook&&!this.grounded)this.pump(dt,wish);
  else this.drive(dt,wish);
  if(this.gliding){const boost=T.MathUtils.clamp((this.speed-GLIDE.speed)/(GLIDE.dive-GLIDE.speed),0,1),sink=-(GLIDE.sink+GLIDE.diveSink*boost);v.y+=(sink-v.y)*(1-Math.exp(-GLIDE.catch*dt));}
  else if(!this.grounded)v.y=Math.max(this.hook?-HOOK.maxSpeed:-MOVE.maxFall,v.y-MOVE.gravity*dt);
  if(this.hook)this.tether(dt,reel);
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
    const n=new T.Vector3(push.x,0,push.z),side=n.length();if(side>1e-4){n.divideScalar(side);const into=v.x*n.x+v.z*n.z;if(into<0){
     v.x-=n.x*into;v.z-=n.z*into;
     // Ground and ramp corrections keep their usual slide; only a firm side impact rebounds.
     if(bounce&&Math.abs(push.y)<side*.5&&-into>=bounce.minSpeed){
      const kick=Math.min(-into*bounce.restitution,bounce.maxSpeed);v.x+=n.x*kick;v.z+=n.z*kick;
      const cap=Math.min(1,bounce.maxSpeed/Math.hypot(v.x,v.z));v.x*=cap;v.z*=cap;this.bounceS=bounce.seconds;
     }
    }}
    if(bounce)travel.copy(v).multiplyScalar(dt/hops);
   }
  }
  // Ground: snap down while walking (stairs and ramps), land when falling onto it.
  const reach=this.grounded?b.step+MOVE.snap:Math.max(.05,-v.y*dt+.05);
  const g=v.y>.5?null:this.groundAt(this.position,b.step+.05,reach);
  if(g&&(this.grounded||v.y<=0)){if(!this.grounded)this.fell=this.top-g.point.y;this.position.y=g.point.y;v.y=0;this.grounded=true;this.ground=g;this.jumpS=-1;this.jumpCount=0;this.gliding=false;}
  else{this.grounded=false;this.ground=null;}
  this.top=this.grounded?this.position.y:Math.max(this.top,this.position.y);
  return this;
 }
 // The jump, settled before anything moves (movement.ts stepPlayer).
 jumpJudge(dt,held){
  const pressed=held&&!this.jumpHeld;this.jumpHeld=held;
  // A jump lets go of the grapple line, keeping the swing, and spends the air jump if there is one left.
  if(pressed&&this.hook)this.hook=null;
  this.jumpBuffer=Math.max(0,(pressed?MOVE.buffer:this.jumpBuffer)-dt);
  if(this.jumpS>=0)this.jumpS+=dt;
  if(this.grounded)this.jumpCount=0;
  // Coyote time spends the ground jump; after it a ledge fall has only the air jump left.
  const footing=this.grounded||(this.airTime<=MOVE.coyote&&this.jumpCount===0),air=!footing&&pressed&&this.jumpCount<(this.body.jumps??2);
  if((footing&&this.jumpBuffer>0)||air){
   this.stance='stand';this.slideS=0;this.jumpCount=footing?1:2;this.velocity.y=this.body.jump??MOVE.jump;this.grounded=false;this.jumpBuffer=0;this.jumpS=0;
  }else if(this.jumpS>=MOVE.minJump&&!held&&this.velocity.y>0){this.velocity.y*=MOVE.cut;this.jumpS=-1;}
 }
 // The board comes out once Space is held through a fall over a real drop, and goes away when it is let go.
 glideJudge(dt,held){
  if(this.grounded||!held||this.hook||this.body.glide===false||this.stance==='prone'){this.gliding=false;return;}
  if(this.gliding){this.glideS+=dt;return;}
  if(this.velocity.y>GLIDE.deploy||this.groundAt(this.position,.05,GLIDE.minDrop))return;
  this.gliding=true;this.glideS=0;this.stance='stand';this.slideS=0;
 }
 // The grapple bites at `anchor`: the line is as long as the reach from the hand, and it yanks along itself.
 latch(anchor){
  this.hook=anchor.clone();this.gliding=false;this.stance='stand';this.slideS=0;
  line.set(anchor.x-this.position.x,anchor.y-this.position.y-HOOK.hand,anchor.z-this.position.z);
  this.rope=line.length();this.ropeTo=Math.max(HOOK.min,this.rope*HOOK.keep);if(this.rope>1e-4)this.velocity.addScaledVector(line.divideScalar(this.rope),HOOK.yank);
  // Off the ground the swing leaves the air jump for later; a jump in progress stops counting as one.
  this.jumpCount=Math.max(1,this.jumpCount);this.jumpS=-1;this.jumpBuffer=0;
 }
 unhook(){this.hook=null;}
 // Swinging, the keys add speed in their direction rather than steer to a speed.
 pump(dt,wish){
  const want=Math.hypot(wish.x,wish.z);if(want<1e-6)return;
  this.velocity.x+=wish.x/want*HOOK.pump*dt;this.velocity.z+=wish.z/want*HOOK.pump*dt;
 }
 // The line never stretches: velocity away from the bite is taken out, and any slack overrun is pulled back.
 tether(dt,reel){
  const v=this.velocity,a=this.hook;
  if(reel)this.ropeTo=HOOK.min;
  this.rope=Math.max(this.ropeTo,this.rope-(reel?HOOK.reel:HOOK.take)*dt);
  line.set(this.position.x-a.x,this.position.y+HOOK.hand-a.y,this.position.z-a.z);
  const len=line.length();if(len<1e-4)return;line.divideScalar(len);
  if(len>=this.rope){const out=v.dot(line);if(out>0)v.addScaledVector(line,-out);}
  if(len>this.rope)v.addScaledVector(line,-Math.min((len-this.rope)*HOOK.stiff,HOOK.maxSpeed));
  const s=v.length();if(s>HOOK.maxSpeed)v.multiplyScalar(HOOK.maxSpeed/s);
 }
 // Horizontal: the velocity approaches the wish at a limited rate, one rate for the pair so a diagonal turn takes as
 // long as a straight one; on the ground, velocity across the wish goes faster (the turn grips).
 drive(dt,wish){
  const v=this.velocity;
  if(this.stance==='slide'){const s=Math.hypot(v.x,v.z),k=s>1e-6?Math.max(0,s-MOVE.slideDecel*dt)/s:0;v.x*=k;v.z*=k;if(s*k<MOVE.crouchSpeed){this.stance='crouch';this.slideS=0;}return;}
  const wx=wish.x,wz=wish.z,want=Math.hypot(wx,wz);
  if((this.grounded||this.gliding)&&want>1e-6){const nx=wx/want,nz=wz/want,along=v.x*nx+v.z*nz,grip=1-Math.exp(-(this.gliding?GLIDE.grip:MOVE.turnGrip)*dt);v.x-=(v.x-nx*along)*grip;v.z-=(v.z-nz*along)*grip;}
  const dx=wx-v.x,dz=wz-v.z,gap=Math.hypot(dx,dz);if(gap<1e-6){v.x=wx;v.z=wz;return;}
  const accel=this.gliding?GLIDE.accel:this.grounded?MOVE.accel:MOVE.accel*MOVE.airControl,brake=this.gliding?GLIDE.drag:this.grounded?MOVE.friction:MOVE.airDrag;
  const k=Math.min(1,(want>=Math.hypot(v.x,v.z)?accel:brake)*dt/gap);v.x+=dx*k;v.z+=dz*k;
 }
 get speed(){return Math.hypot(this.velocity.x,this.velocity.z);}
}
