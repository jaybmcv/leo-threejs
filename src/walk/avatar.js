import * as T from 'three';
import {COSMO_HEIGHT,aim,turn} from '../cosmo-pose.js';
import {DLCatFigure} from './vr/dlCatFigure.ts';
import {DEFAULT_DLCAT_TUNING} from './vr/dlCatTuning.ts';
import {COSMO_EMOTES} from './vr/cosmoEmotes.ts';
import {WALK_SPEED,RUN_SPEED} from './vr/worldCore.ts';
import {catnipFace} from './catnip-face.js';
import {createSwimSuit} from './aquarium-treasure/suit.js';
import {createFurColour} from './fur.js';
import {rigPace} from './rig-pace.js';
import {mergeSkinnedParts} from './merged-skin.js';
import {solvedPose} from './solved-pose.js';
import {figureMatrices} from './figure-matrices.js';
import {boneWalk} from './bone-walk.js';

// Cosmo as the walker, animated by Voyager's Reach's own figure (vr/dlCatFigure.ts): the authored Ecctrl walk and jog,
// the reference sprint, take-off, air and landing, the turning lean, the tail spring, the idle, crouch, slide and
// crawl, the emotes and the seated pose. Leo adds one pose of its own, lying on a bed, which Voyager's Reach has no
// use for. `holder` is what the controller moves: its origin is between the feet and it faces +z.
const X=new T.Vector3(1,0,0);
export const WALKER={height:COSMO_HEIGHT,walk:WALK_SPEED,run:RUN_SPEED,crouch:2,prone:1.1};
export const EMOTES=Object.keys(COSMO_EMOTES);
// Seconds the catnip face takes to come on or wear off.
const CATNIP_S=1.2;
// On the grapple line (grapple.js): the body leans towards the claw by up to HANG_TILT radians, about the feet, and the
// right arm reaches up the line; both ease in over about HANG_S seconds.
const HANG_TILT=.6,HANG_S=.12;

function liePose(bone){
 for(const side of ['L','R']){
  const out=side==='L'?1:-1;
  aim(bone('thigh.'+side),bone('shin.'+side),new T.Vector3(out*.06,-1,0));
  aim(bone('shin.'+side),bone('foot.'+side),new T.Vector3(out*.02,-1,.04));
  aim(bone('upper_arm.'+side),bone('forearm.'+side),new T.Vector3(out*.2,-1,.04));
  aim(bone('forearm.'+side),bone('hand.'+side),new T.Vector3(out*.12,-1,.28));
  // Feet relaxed, toes eased along the legs (pulled up to the shins, they looked braced).
  turn(bone('foot.'+side),X,30);
 }
 turn(bone('spine.006'),X,-8);
 for(const [i,deg] of [[1,-90],[2,-10]])turn(bone('Tail_springBone_'+i),X,deg);
}
function floatPose(bone){
 turn(bone('spine.003'),X,8);
 for(const side of ['L','R']){
  const out=side==='L'?1:-1;
  aim(bone('thigh.'+side),bone('shin.'+side),new T.Vector3(out*.03,-1,0));
  aim(bone('shin.'+side),bone('foot.'+side),new T.Vector3(0,-1,0));
  aim(bone('upper_arm.'+side),bone('forearm.'+side),new T.Vector3(out*.06,-1,0));
  aim(bone('forearm.'+side),bone('hand.'+side),new T.Vector3(0,-1,0));
 }
 turn(bone('spine.006'),X,-12);
}
// In a hammock (from tester feedback), on top of the lie: hands clasped behind the head, elbows out to the sides.
function hammockArms(bone){
 for(const side of ['L','R']){
  const out=side==='L'?1:-1;
  aim(bone('upper_arm.'+side),bone('forearm.'+side),new T.Vector3(out*.8,.55,-.25));
  aim(bone('forearm.'+side),bone('hand.'+side),new T.Vector3(-out*.6,.6,-.5));
  aim(bone('hand.'+side),bone('f_middle.01.'+side),new T.Vector3(-out*.85,.3,-.45));
 }
}

// Riding the longboard down (glide.js), side-on with the left foot leading: the body turns a quarter to the right on
// the board, so here, in his own frame (facing +z, left +x), the feet spread along x over the trucks, the knees bend
// out over them, the arms reach out fore and aft for balance, and the head turns left to look where he is going.
const Y=new T.Vector3(0,1,0);
function boardPose(bone){
 for(const side of ['L','R']){
  const out=side==='L'?1:-1;
  aim(bone('thigh.'+side),bone('shin.'+side),new T.Vector3(out*.4,-1,.62));
  aim(bone('shin.'+side),bone('foot.'+side),new T.Vector3(out*.14,-1,-.5));
  turn(bone('foot.'+side),Y,-out*12);
  aim(bone('upper_arm.'+side),bone('forearm.'+side),new T.Vector3(out*1,-.42,out>0?.22:.05));
  aim(bone('forearm.'+side),bone('hand.'+side),new T.Vector3(out*.85,-.2,out>0?.45:.2));
 }
 turn(bone('spine.001'),X,18);turn(bone('spine.003'),Y,14);turn(bone('spine.003'),X,6);
 turn(bone('spine.005'),Y,24);turn(bone('spine.006'),Y,36);turn(bone('spine.006'),X,-8);
 for(const [i,deg] of [[1,-35],[2,-15]])turn(bone('Tail_springBone_'+i),X,deg);
}

// `createDLCat` comes from the Cosmo bundle; `motion` is ecctrl-locomotion.json, the donor clips for the walk.
// The longest step Cosmo's rig takes in one solve: the figure's own cap (dlCatFigure.ts apply, stepMax), a 20 fps frame.
const RIG_CAP=.05;
// mergeDraws: draw the body's parts as one skinned mesh per material (merged-skin.js); cacheBones: the scene pass and the
// bone texture leave the figure alone on frames nothing moved it (figure-matrices.js), and the scene walk skips the
// bones (bone-walk.js). Both for other visitors (remotes.js), which nothing draws into shadow maps.
export async function createWalker(createDLCat,motion,{mergeDraws=false,cacheBones=false}={}){
 const cat=await createDLCat({height:COSMO_HEIGHT,castShadow:true,receiveShadow:true});
 const figure=new DLCatFigure(cat,()=>DEFAULT_DLCAT_TUNING,motion);figure.stylProportions=false;
 const setFur=createFurColour(figure.asset);
 const holder=new T.Group();holder.name='Walker';const body=new T.Group();holder.add(body);body.add(figure.root);
 const bone=name=>{const b=figure.bones.get(name);if(!b)throw new Error('Cosmo rig is missing '+name);return b;};
 // The lying pose, built once from the bind pose the figure starts in.
 figure.root.updateMatrixWorld(true);
 const bones=[...figure.bones.values()],rest=bones.map(b=>b.quaternion.clone());
 liePose(bone);const lie=bones.map(b=>b.quaternion.clone());
 hammockArms(bone);const hammock=bones.map(b=>b.quaternion.clone());
 bones.forEach((b,i)=>b.quaternion.copy(rest[i]));figure.root.updateMatrixWorld(true);
 floatPose(bone);const floating=bones.map(b=>b.quaternion.clone());
 // On the longboard, and how far the bent knees lift the feet towards the hips, so the figure drops to keep them on it.
 const footY=()=>Math.min(bone('foot.L').getWorldPosition(new T.Vector3()).y,bone('foot.R').getWorldPosition(new T.Vector3()).y);
 bones.forEach((b,i)=>b.quaternion.copy(rest[i]));figure.root.updateMatrixWorld(true);const standFoot=footY();
 boardPose(bone);const board=bones.map(b=>b.quaternion.clone());const boardDrop=footY()-standFoot;
 // Where the board goes under him: the middle of his shoes' footprint in this pose, not his ankles (the big shoes run
 // well forward of them, so a board centred on the ankles carried only the heels). In his own frame (left +x, facing
 // +z); glide.js centres the board there. Without shoe meshes, the balls of the feet.
 const boardFeet=new T.Vector3(),shoes=figure.asset.meshes.filter(m=>/^shoes/.test(m.name));
 if(shoes.length){const box=new T.Box3(),v=new T.Vector3();for(const m of shoes){m.updateMatrixWorld(true);for(let i=0;i<m.geometry.attributes.position.count;i+=2)box.expandByPoint(m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld));}box.getCenter(boardFeet);}
 else for(const side of ['L','R'])boardFeet.addScaledVector(bone('toe.'+side).getWorldPosition(new T.Vector3()),.5);
 boardFeet.x=0;boardFeet.y=0;
 bones.forEach((b,i)=>b.quaternion.copy(rest[i]));figure.root.updateMatrixWorld(true);
 // Eyes shut in a hammock. The face has no lids or morphs, so the eyeballs take the fur's colour from Cosmo's own
 // texture (the body's vertex nearest them) and read as closed lids under the lash line.
 const eyes=figure.asset.meshes.find(m=>m.name==='eyes'),skin=figure.asset.meshes.find(m=>m.name==='body');
 const open=eyes.geometry.attributes.uv,shut=open.clone(),fur=new T.Vector2();
 {eyes.geometry.computeBoundingBox();const c=eyes.geometry.boundingBox.getCenter(new T.Vector3()),p=skin.geometry.attributes.position,v=new T.Vector3();let best=Infinity;
  for(let i=0;i<p.count;i++){const d=v.fromBufferAttribute(p,i).distanceToSquared(c);if(d<best){best=d;fur.fromBufferAttribute(skin.geometry.attributes.uv,i);}}
  for(let i=0;i<shut.count;i++)shut.setXY(i,fur.x,fur.y);}
 // In the Hydro-Nip Lounge (catnip-face.js): dreamy half-shut lids, a blush and a content smile, eased in and out.
 const face=catnipFace(figure.asset,fur);let catnip=0;
 // A hat wearer (hat.js) on all fours: the tail's arc would carry its tip up through the back of the crown, so its base
 // tips down a little more, eased in and out.
 const tail=bone('Tail_springBone_1'),TAIL_DROP=-.55,tq=new T.Quaternion(),axis=new T.Vector3();let tailDrop=0;
 // The hips' height above the feet's origin, standing.
 const hipHeight=bone('spine').getWorldPosition(new T.Vector3()).y-figure.root.getWorldPosition(new T.Vector3()).y;
 let suit=null;
 const paw=bone('hand.R'),shoulder=bone('upper_arm.R'),elbow=bone('forearm.R'),hung=new T.Quaternion(),lean=new T.Vector3(),hold=new T.Quaternion(),q=new T.Quaternion();
 let hang=0,lastPose=null;const anchor=new T.Vector3(),pace=rigPace(RIG_CAP);
 // Last, once every part is in place: the parts stay for what reads them, hidden, and the merged copies draw.
 figure.root.updateMatrixWorld(true);const merged=mergeDraws?mergeSkinnedParts(figure.asset.meshes):null;
 // What is done on top of a solve below starts from the solved pose on frames without one (solved-pose.js).
 const held=solvedPose(bones,figure.asset.root);
 const matrices=cacheBones?figureMatrices(figure):null,walk=cacheBones?boneWalk(bones):null;
 // Bones moved on top of a solve, or back to it.
 const touched=()=>{held.touched();matrices?.changed();};
 return {
  holder,body,figure,hipHeight,setFur,boardFeet,merged,
  // (figure-matrices.js, with cacheBones: how many times the figure's matrices were made, for crowd-draw.js)
  matrices,
  // Where the right paw is drawn (the grapple line leaves from it).
  hand(out=new T.Vector3()){return paw.getWorldPosition(out);},
  // s: {speed, grounded, stance, jumpCount, jumpS, turnRate, accel, rise, emote, rest:{kind:'sit'|'lie', weight, seatHeight, hammock},
  //  catnip: in the Hydro-Nip Lounge, board: riding the longboard (0..1, glide.js), hook: the grapple's bite (world) or null,
  //  unseen: nothing draws him this frame (first person), so the figure's rig solve (about 0.33 ms) runs less often,
  //  solveEvery: seconds between solves while he is small on screen (another visitor far off: remotes.js), 0 every frame}
  // Returns how many times the rig solved this frame (none, one, or two on a change of input: rig-pace.js), and keeps
  // what those solves took (solveMs) for the budget of other visitors' rigs (rig-budget.js). s.hold: that budget is
  // spent this frame, so the rig gathers its time instead of solving (rig-pace.js), unless an input changed.
  update(dt,s){
   const r=s.rest,seated=r?.kind==='sit'&&r.weight>.35;
   hang=T.MathUtils.clamp(hang+(s.hook&&!r?1:-1)*dt/HANG_S,0,1);if(s.hook)anchor.copy(s.hook);
   // Hanging, the body leans along the line, in the holder's frame, from the feet.
   if(hang>0){
    holder.updateWorldMatrix(true,false);lean.copy(anchor).sub(holder.position).setY(anchor.y-holder.position.y-1).applyQuaternion(holder.getWorldQuaternion(hold).invert()).normalize();
    hung.setFromUnitVectors(Y,lean);const angle=2*Math.acos(Math.min(1,Math.abs(hung.w)));if(angle>HANG_TILT)hung.slerpQuaternions(q.identity(),hung,HANG_TILT/angle);
    body.quaternion.premultiply(q.identity().slerp(hung,hang*hang*(3-2*hang)));
   }
   // Unseen (first person), the rig solves as on a 20 fps machine, keeping pace exactly (rig-pace.js): he is current when
   // he shows, and the paw the grapple aims from is at most one such step behind. A third of the work at 60 Hz. Time
   // gathered before a change of input is solved with the inputs it was gathered under (the previous frame's pose).
   const inputs=[s.grounded,s.jumpCount,s.stance,!!s.swimming,s.emote,r?.kind,seated].join('|');
   const pose={pos:[0,0,0],yaw:0,dt,speedMs:r?0:s.speed,grounded:r?true:s.grounded,swimming:!!s.swimming,submerged:!!s.swimming,stance:r?'stand':s.stance||'stand',
    jumpCount:s.jumpCount||1,jumpS:s.jumpS,turnRate:r?0:s.turnRate||0,accelMs2:r?0:s.accel||0,riseMs:r?0:s.rise||0,emote:r?null:s.emote||null,
    seated,seatedVariant:'passenger',seatHeight:seated?r.seatHeight:undefined,seatForward:0};
   let solved=0;const solving=pace(dt,s.unseen?true:s.solveEvery||0,inputs,!!s.hold),t0=solving.length?performance.now():0;
   for(const {dt:step,prior} of solving){
    const p={...(prior&&lastPose||pose),dt:step};if(matrices)matrices.solve(()=>figure.apply(p,step));else figure.apply(p,step);solved++;}
   this.solveMs=solved?performance.now()-t0:0;
   if(solved)held.keep();else if(held.restore())matrices?.changed();
   lastPose=pose;
   // Lying down, in a bed or playing dead, the hat comes off: on his back it would sink into the floor or the pillow.
   if(this.hat)this.hat.mount.visible=!s.swimming&&!(r?.kind==='lie'&&r.weight>.3)&&s.emote!=='play_dead';
   if(s.swimming&&!suit)suit=createSwimSuit(figure,body);suit?.update(!!s.swimming);
   tailDrop=T.MathUtils.damp(tailDrop,this.hat&&!r&&s.stance==='prone'?1:0,8,dt);
   if(tailDrop>.001){
    // About the walker's own right axis, in the tail base's parent frame.
    axis.set(1,0,0).applyQuaternion(holder.getWorldQuaternion(tq)).applyQuaternion(tail.parent.getWorldQuaternion(tq).invert());
    tail.quaternion.premultiply(tq.setFromAxisAngle(axis,TAIL_DROP*tailDrop));touched();
   }
   catnip=T.MathUtils.clamp(catnip+(s.catnip?1:-1)*dt/CATNIP_S,0,1);face.set(catnip*catnip*(3-2*catnip));
   const closed=r?.kind==='lie'&&r.hammock&&r.weight>.6?shut:open;if(eyes.geometry.attributes.uv!==closed){eyes.geometry.setAttribute('uv',closed);merged?.sync();}
   if(s.board>0&&!r){
    bones.forEach((b,i)=>b.quaternion.slerp(board[i],s.board));touched();
    figure.asset.root.position.y=T.MathUtils.lerp(figure.asset.root.position.y,figure.restOffset-boardDrop,s.board);
    figure.root.updateMatrixWorld(true);
   }
   // The right arm up the line, eased from the animated arm.
   if(hang>0){
    figure.root.updateMatrixWorld(true);const w=hang*hang*(3-2*hang),a=shoulder.quaternion.clone(),b=elbow.quaternion.clone();
    lean.copy(anchor).sub(shoulder.getWorldPosition(new T.Vector3()));
    aim(shoulder,elbow,lean);aim(elbow,paw,lean);touched();
    shoulder.quaternion.copy(a.slerp(shoulder.quaternion,w));elbow.quaternion.copy(b.slerp(elbow.quaternion,w));
    figure.root.updateMatrixWorld(true);
   }
   if((r?.kind==='lie'||r?.kind==='float')&&r.weight>0){
    const pose=r.kind==='float'?floating:r.hammock?hammock:lie;bones.forEach((b,i)=>b.quaternion.slerp(pose[i],r.weight));touched();
    figure.asset.root.position.y=T.MathUtils.lerp(figure.asset.root.position.y,figure.restOffset,r.weight);
    figure.root.updateMatrixWorld(true);
   }
   // The hat and the catnip face, shown or hidden above, keep their way through the scene walk.
   walk?.sync();
   return solved;
  },
  dispose(){merged?.dispose();suit?.dispose();figure.dispose();holder.removeFromParent();}
 };
}
