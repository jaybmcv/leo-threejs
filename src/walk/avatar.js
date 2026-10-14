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
  turn(bone('foot.'+side),X,-20);
 }
 turn(bone('spine.006'),X,-8);
 for(const [i,deg] of [[1,-90],[2,-10]])turn(bone('Tail_springBone_'+i),X,deg);
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
 bones.forEach((b,i)=>b.quaternion.copy(rest[i]));figure.root.updateMatrixWorld(true);
 // The hips' height above the feet's origin, standing.
 const hipHeight=bone('spine').getWorldPosition(new T.Vector3()).y-figure.root.getWorldPosition(new T.Vector3()).y;
 return {
  holder,body,figure,hipHeight,
  // s: {speed, grounded, stance, jumpCount, jumpS, turnRate, accel, rise, emote, rest:{kind:'sit'|'lie', weight, seatHeight}}
  update(dt,s){
   const r=s.rest,seated=r?.kind==='sit'&&r.weight>.35;
   figure.apply({pos:[0,0,0],yaw:0,dt,speedMs:r?0:s.speed,grounded:r?true:s.grounded,swimming:false,submerged:false,stance:r?'stand':s.stance||'stand',
    jumpCount:s.jumpCount||1,jumpS:s.jumpS,turnRate:r?0:s.turnRate||0,accelMs2:r?0:s.accel||0,riseMs:r?0:s.rise||0,emote:r?null:s.emote||null,
    seated,seatedVariant:'passenger',seatHeight:seated?r.seatHeight:undefined,seatForward:0},dt);
   if(r?.kind==='lie'&&r.weight>0){
    bones.forEach((b,i)=>b.quaternion.slerp(lie[i],r.weight));
    figure.asset.root.position.y=T.MathUtils.lerp(figure.asset.root.position.y,figure.restOffset,r.weight);
    figure.root.updateMatrixWorld(true);
   }
  },
  dispose(){figure.dispose();holder.removeFromParent();}
 };
}
