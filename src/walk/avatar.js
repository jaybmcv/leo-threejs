import * as T from 'three';
import {COSMO_HEIGHT,aim,turn} from '../cosmo-pose.js';
import {DLCatFigure} from './vr/dlCatFigure.ts';
import {DEFAULT_DLCAT_TUNING} from './vr/dlCatTuning.ts';
import {COSMO_EMOTES} from './vr/cosmoEmotes.ts';
import {WALK_SPEED,RUN_SPEED} from './vr/worldCore.ts';

// Cosmo as the walker, animated by Voyager's Reach's own figure (vr/dlCatFigure.ts): the authored Ecctrl walk and jog,
// the reference sprint, take-off, air and landing, the turning lean, the tail spring, the idle, crouch, slide and
// crawl, the emotes and the seated pose. Leo adds one pose of its own, lying on a bed, which Voyager's Reach has no
// use for. `holder` is what the controller moves: its origin is between the feet and it faces +z.
const X=new T.Vector3(1,0,0);
export const WALKER={height:COSMO_HEIGHT,walk:WALK_SPEED,run:RUN_SPEED,crouch:2,prone:1.1};
export const EMOTES=Object.keys(COSMO_EMOTES);

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
// In a hammock (from tester feedback), on top of the lie: hands clasped behind the head, elbows out to the sides.
function hammockArms(bone){
 for(const side of ['L','R']){
  const out=side==='L'?1:-1;
  aim(bone('upper_arm.'+side),bone('forearm.'+side),new T.Vector3(out*.8,.55,-.25));
  aim(bone('forearm.'+side),bone('hand.'+side),new T.Vector3(-out*.6,.6,-.5));
  aim(bone('hand.'+side),bone('f_middle.01.'+side),new T.Vector3(-out*.85,.3,-.45));
 }
}

// `createDLCat` comes from the Cosmo bundle; `motion` is ecctrl-locomotion.json, the donor clips for the walk.
export async function createWalker(createDLCat,motion){
 const cat=await createDLCat({height:COSMO_HEIGHT,castShadow:true,receiveShadow:true});
 const figure=new DLCatFigure(cat,()=>DEFAULT_DLCAT_TUNING,motion);figure.stylProportions=false;
 const holder=new T.Group();holder.name='Walker';const body=new T.Group();holder.add(body);body.add(figure.root);
 const bone=name=>{const b=figure.bones.get(name);if(!b)throw new Error('Cosmo rig is missing '+name);return b;};
 // The lying pose, built once from the bind pose the figure starts in.
 figure.root.updateMatrixWorld(true);
 const bones=[...figure.bones.values()],rest=bones.map(b=>b.quaternion.clone());
 liePose(bone);const lie=bones.map(b=>b.quaternion.clone());
 hammockArms(bone);const hammock=bones.map(b=>b.quaternion.clone());
 bones.forEach((b,i)=>b.quaternion.copy(rest[i]));figure.root.updateMatrixWorld(true);
 // Eyes shut in a hammock. The face has no lids or morphs, so the eyeballs take the fur's colour from Cosmo's own
 // texture (the body's vertex nearest them) and read as closed lids under the lash line.
 const eyes=figure.asset.meshes.find(m=>m.name==='eyes'),skin=figure.asset.meshes.find(m=>m.name==='body');
 const open=eyes.geometry.attributes.uv,shut=open.clone(),fur=new T.Vector2();
 {eyes.geometry.computeBoundingBox();const c=eyes.geometry.boundingBox.getCenter(new T.Vector3()),p=skin.geometry.attributes.position,v=new T.Vector3();let best=Infinity;
  for(let i=0;i<p.count;i++){const d=v.fromBufferAttribute(p,i).distanceToSquared(c);if(d<best){best=d;fur.fromBufferAttribute(skin.geometry.attributes.uv,i);}}
  for(let i=0;i<shut.count;i++)shut.setXY(i,fur.x,fur.y);}
 // A hat wearer (hat.js) on all fours: the tail's arc would carry its tip up through the back of the crown, so its base
 // tips down a little more, eased in and out.
 const tail=bone('Tail_springBone_1'),TAIL_DROP=-.55,tq=new T.Quaternion(),axis=new T.Vector3();let tailDrop=0;
 // The hips' height above the feet's origin, standing.
 const hipHeight=bone('spine').getWorldPosition(new T.Vector3()).y-figure.root.getWorldPosition(new T.Vector3()).y;
 return {
  holder,body,figure,hipHeight,
  // s: {speed, grounded, stance, jumpCount, jumpS, turnRate, accel, rise, emote, rest:{kind:'sit'|'lie', weight, seatHeight, hammock}}
  update(dt,s){
   const r=s.rest,seated=r?.kind==='sit'&&r.weight>.35;
   figure.apply({pos:[0,0,0],yaw:0,dt,speedMs:r?0:s.speed,grounded:r?true:s.grounded,swimming:false,submerged:false,stance:r?'stand':s.stance||'stand',
    jumpCount:s.jumpCount||1,jumpS:s.jumpS,turnRate:r?0:s.turnRate||0,accelMs2:r?0:s.accel||0,riseMs:r?0:s.rise||0,emote:r?null:s.emote||null,
    seated,seatedVariant:'passenger',seatHeight:seated?r.seatHeight:undefined,seatForward:0},dt);
   // Lying down, in a bed or playing dead, the hat comes off: on his back it would sink into the floor or the pillow.
   if(this.hat)this.hat.mount.visible=!(r?.kind==='lie'&&r.weight>.3)&&s.emote!=='play_dead';
   tailDrop=T.MathUtils.damp(tailDrop,this.hat&&!r&&s.stance==='prone'?1:0,8,dt);
   if(tailDrop>.001){
    // About the walker's own right axis, in the tail base's parent frame.
    axis.set(1,0,0).applyQuaternion(holder.getWorldQuaternion(tq)).applyQuaternion(tail.parent.getWorldQuaternion(tq).invert());
    tail.quaternion.premultiply(tq.setFromAxisAngle(axis,TAIL_DROP*tailDrop));
   }
   const closed=r?.kind==='lie'&&r.hammock&&r.weight>.6?shut:open;if(eyes.geometry.attributes.uv!==closed)eyes.geometry.setAttribute('uv',closed);
   if(r?.kind==='lie'&&r.weight>0){
    const pose=r.hammock?hammock:lie;bones.forEach((b,i)=>b.quaternion.slerp(pose[i],r.weight));
    figure.asset.root.position.y=T.MathUtils.lerp(figure.asset.root.position.y,figure.restOffset,r.weight);
    figure.root.updateMatrixWorld(true);
   }
  },
  dispose(){figure.dispose();holder.removeFromParent();}
 };
}
