import * as T from 'three';
import {toWorld} from '../plan/rooms.js';
import layout from '../plan/selected-layout.js';
import {contains as polygonContains} from '../plan/geometry-v2.js';

// This room's practical lamps have short ranges and are off outside Arrival.
// Update before the other room controllers run; apply active Arrival last so
// another room's outgoing fade cannot overwrite the arrival transition.
export function createArrivalMood(ship,{hemi,fill,scene}){
 const room=layout.rooms.find(r=>r.id==='d02-arrival-1');if(!room)return null;
 const base={hemi:hemi.intensity,fill:fill.intensity,env:scene.environmentIntensity,sky:hemi.color.clone(),ground:hemi.groundColor.clone()};
 const sky=new T.Color(0x9cb5d5),ground=new T.Color(0x635447),lamps=new T.Group();lamps.name='Arrival_practical_lights';scene.add(lamps);
 for(const [x,y,z,power,range]of[[-2.5,2.7,2.2,19,8],[-10.3,1.6,-7.9,10,6],[10.3,1.6,-7.9,10,6],[-9.8,1.6,7.9,10,6],[10.8,1.6,7.9,10,6]]){
  const light=new T.PointLight(0xffbf7b,power,range,2);light.position.set(...toWorld('d02-arrival-1',[x,y,z]));lamps.add(light);
 }
 lamps.visible=false;let amount=0,active=false;
 const restore=()=>{hemi.intensity=base.hemi;fill.intensity=base.fill;scene.environmentIntensity=base.env;hemi.color.copy(base.sky);hemi.groundColor.copy(base.ground);};
 const contains=eye=>{
  const y=eye.y-room.y;if(y<=0||y>=room.height)return false;
  const section=room.envelope?.find(s=>y>=s.rise&&y<s.rise+s.height);
  return polygonContains(section?.polygon||room.polygon,[eye.x,eye.z]);
 };
 const releaseOutside=eye=>{if(contains(eye))return;if(active)restore();active=false;amount=0;lamps.visible=false;};
 const apply=()=>{
  if(!active)return;
  hemi.intensity=T.MathUtils.lerp(base.hemi,base.hemi*.55,amount);
  fill.intensity=T.MathUtils.lerp(base.fill,base.fill*.44,amount);
  scene.environmentIntensity=T.MathUtils.lerp(base.env,base.env*.35,amount);
  hemi.color.copy(base.sky).lerp(sky,amount);hemi.groundColor.copy(base.ground).lerp(ground,amount);
 };
 return {
  apply,
  update(dt,eye){
   if(!contains(eye)){releaseOutside(eye);return;}
   active=true;lamps.visible=true;amount+=(1-amount)*(1-Math.exp(-3*Math.min(dt,.1)));
   apply();
  },
  dispose(){if(active)restore();lamps.removeFromParent();},
  get active(){return active;},
 };
}
