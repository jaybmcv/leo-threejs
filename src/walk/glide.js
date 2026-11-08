import * as T from 'three';
import {createLongboard} from './longboard.js';

// The longboard glide: hold Space through a fall over a real drop (controller.js GLIDE) and Cosmo pulls out the Leo
// longboard (longboard.js) and rides it down, standing sideways on the grip with his left foot leading, knees bent and
// arms out (avatar.js boardPose). The board pops out under his feet, banks into turns, dips its nose as it dives and
// spins its wheels in the wind; landing or letting go of Space puts it away. Steering is the walk's own keys.
// The board hangs from the walker's holder, whose origin is between the feet and which faces the way he travels.
// 10 studio units become 1.25 m, a long cruiser for a 1.75 m cat.
export const BOARD={scale:.125,deploy:.18};
const GRIP=.071*BOARD.scale;
// Studio axes (X length, +Z underside) into the walker's (+z forward, +y up): X -> +z, Y -> -x, Z -> -y.
const BASE=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0,0,1),new T.Vector3(-1,0,0),new T.Vector3(0,-1,0)));
const SIDEWAYS=-Math.PI/2,UP=new T.Vector3(0,1,0),ORIGIN=new T.Vector3();

// `prebuild`: make the board while the page idles (the visitor's own); others' boards are made on their first ride.
export function createGlide(walker,urls,{prebuild=true}={}){
 let board=null,show=0,roll=0,pitch=0,clock=0;
 const lean=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ'),yaw=new T.Quaternion(),at=new T.Vector3();
 const make=()=>{board=createLongboard(urls);board.root.visible=false;board.root.scale.setScalar(0);walker.holder.add(board.root);};
 // Built while the page idles, so the first ride doesn't stall a frame.
 if(prebuild)(globalThis.requestIdleCallback||(f=>setTimeout(f,3000)))(()=>{if(!board)make();},{timeout:10000});
 return {
  get board(){return board;},
  // After the holder is placed and the body squared up, before the walker's own update. `turnRate` is + to his left.
  // Returns how far into the ride the figure is (0..1), for its pose.
  update(dt,{gliding,speed,rise,turnRate}){
   if(gliding&&!board)make();
   show=T.MathUtils.clamp(show+(gliding?dt:-dt)/BOARD.deploy,0,1);
   if(!board)return 0;
   board.root.visible=show>0;
   if(show===0){roll=pitch=0;return 0;}
   const k=show*show*(3-2*show);clock+=dt;
   // Into the turn, nose down in a dive (sinking fast against the airspeed), and a slow rock as it rides the air.
   roll=T.MathUtils.damp(roll,T.MathUtils.clamp(-turnRate*.22,-.55,.55),6,dt);
   pitch=T.MathUtils.damp(pitch,T.MathUtils.clamp(Math.atan2(-rise,Math.max(speed,2))*.7,-.15,.45),5,dt);
   euler.set(pitch*k,0,(roll+Math.sin(clock*2.1)*.04)*k);lean.setFromEuler(euler);
   // A small overshoot as it pops out.
   board.root.scale.setScalar(BOARD.scale*k*(1+(gliding?.14*Math.sin(Math.PI*k):0)));
   board.root.quaternion.copy(lean).multiply(BASE);
   // Under the middle of his shoes (avatar.js boardFeet), which turn side-on with him.
   yaw.setFromAxisAngle(UP,SIDEWAYS*k);
   board.root.position.copy(at.copy(walker.boardFeet||ORIGIN).applyQuaternion(yaw)).setY(-GRIP).applyQuaternion(lean);
   board.spin(dt*speed*4);
   // The rider turns side-on and leans with the board.
   walker.body.quaternion.copy(lean).multiply(yaw.setFromAxisAngle(UP,SIDEWAYS*k));
   return k;
  },
 };
}
