import * as T from 'three';
import {createLongboard} from './longboard.js';

// The longboard glide: hold Space through a fall over a real drop (controller.js GLIDE) and Cosmo pulls out the Leo
// longboard (longboard.js) and rides it down, standing sideways on the grip with his left foot leading, knees bent and
// arms out (avatar.js boardPose). The board pops out under his feet, banks into turns, dips its nose as it dives and
// spins its wheels in the wind; landing or letting go of Space puts it away. Steering is the walk's own keys.
// The board hangs from the walker's holder, whose origin is between the feet and which faces the way he travels.
// 10 studio units become 1.25 m, a long cruiser for a 1.75 m cat.
export const BOARD={scale:.125,deploy:.18};
// The skateboard (skate.js, from tester feedback): the same board system, a plain board 0.8 m long ridden along the
// floor. Its wheels stand on the floor, so the rider stands `lift` higher; `flipDrop` is how far below his feet the
// board drops to turn over in a kickflip. 0.882 units from the deck's middle to the wheels' bottom, 0.071 to the grip.
export const SKATEBOARD={scale:.08,flipDrop:.14};
SKATEBOARD.lift=(.882+.071)*SKATEBOARD.scale;
// Studio axes (X length, +Z underside) into the walker's (+z forward, +y up): X -> +z, Y -> -x, Z -> -y.
const BASE=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,0,1),new T.Vector3(-1,0,0),new T.Vector3(0,-1,0)));
const SIDEWAYS=-Math.PI/2,UP=new T.Vector3(0,1,0),FORE=new T.Vector3(0,0,1),ORIGIN=new T.Vector3();

// One board on the holder: made on its first ride, popped out and put away, leaning into the ride.
function createRide(walker,make,scale,{lift=0,air=false}={}){
 let board=null,show=0,roll=0,pitch=0,clock=0;
 const lean=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ'),yaw=new T.Quaternion(),turn=new T.Quaternion(),at=new T.Vector3(),grip=.071*scale;
 return {
  get board(){return board;},make(){if(!board){board=make();board.root.visible=false;board.root.scale.setScalar(0);walker.holder.add(board.root);}},
  // Returns how far out the board is (0..1). `flip`: how far through a kickflip (0..1, 0 for none).
  update(dt,on,{speed,rise,turnRate,flip=0}){
   if(on)this.make();
   show=T.MathUtils.clamp(show+(on?dt:-dt)/BOARD.deploy,0,1);
   if(!board)return 0;
   board.root.visible=show>0;
   if(show===0){roll=pitch=0;return 0;}
   const k=show*show*(3-2*show);clock+=dt;
   // Into the turn, nose down in a dive (sinking fast against the airspeed), and a slow rock as it rides the air.
   roll=T.MathUtils.damp(roll,T.MathUtils.clamp(-turnRate*(air?.22:.06),-.55,.55),6,dt);
   pitch=T.MathUtils.damp(pitch,T.MathUtils.clamp(Math.atan2(-rise,Math.max(speed,2))*.7,-.15,.45),5,dt);
   euler.set(pitch*k,0,(roll+(air?Math.sin(clock*2.1)*.04:0))*k);lean.setFromEuler(euler);
   // A small overshoot as it pops out.
   board.root.scale.setScalar(scale*k*(1+(on?.14*Math.sin(Math.PI*k):0)));
   // A kickflip turns the board once over along its length, under the feet.
   turn.setFromAxisAngle(FORE,Math.PI*2*flip*flip*(3-2*flip));
   board.root.quaternion.copy(lean).multiply(turn).multiply(BASE);
   // Under the middle of his shoes (avatar.js boardFeet), which turn side-on with him.
   yaw.setFromAxisAngle(UP,SIDEWAYS*k);
   board.root.position.copy(at.copy(walker.boardFeet||ORIGIN).applyQuaternion(yaw)).setY(lift*k-grip-SKATEBOARD.flipDrop*Math.sin(Math.PI*flip)).applyQuaternion(lean);
   board.spin(dt*speed*(air?4:1/(.332*scale)));
   // The rider turns side-on and leans with the board.
   walker.body.quaternion.copy(lean).multiply(yaw.setFromAxisAngle(UP,SIDEWAYS*k));
   return k;
  },
 };
}

// `prebuild`: make the longboard while the page idles (the visitor's own); others' boards are made on their first ride.
// The skateboard is the visitor's own only, and is made on their first ride.
export function createGlide(walker,urls,{prebuild=true}={}){
 const glide=createRide(walker,()=>createLongboard(urls),BOARD.scale,{air:true});
 const skate=createRide(walker,()=>createLongboard(urls,{plain:true}),SKATEBOARD.scale,{lift:SKATEBOARD.lift});
 // Built while the page idles, so the first ride doesn't stall a frame.
 if(prebuild)(globalThis.requestIdleCallback||(f=>setTimeout(f,3000)))(()=>glide.make(),{timeout:10000});
 let ride=0;
 return {
  get board(){return glide.board;},get skateboard(){return skate.board;},
  // How far out the longboard is (0..1): the camera rides lower with it (camera.js `ride`).
  get ride(){return ride;},
  // After the holder is placed and the body squared up, before the walker's own update. `turnRate` is + to his left.
  // `skating`: on the skateboard (skate.js), `flip` how far through its kickflip. Returns how far into the ride the
  // figure is (0..1), for its pose.
  update(dt,{gliding,skating=false,flip=0,speed,rise,turnRate}){
   const s=skate.update(dt,skating&&!gliding,{speed,rise,turnRate,flip});
   ride=glide.update(dt,gliding,{speed,rise,turnRate});
   // On the skateboard he stands on its grip, as high as its wheels lift it.
   if(skate.board)walker.body.position.y=SKATEBOARD.lift*s;
   return Math.max(s,ride);
  },
 };
}
