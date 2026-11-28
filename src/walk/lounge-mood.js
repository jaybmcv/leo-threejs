import * as T from 'three';
import layout from '../plan/selected-layout.js';
import {contains} from '../plan/geometry-v2.js';
import {onLoungeAtriumWalkway} from '../v2/lounge-light-boundary.js';
import {AQUARIUM} from './lounge-aquarium.js';
import {createMazeMist} from './maze-mist.js';

// The Hydro-Nip Lounge's mood on foot; the room, its doors and hammocks are lounge.js:
// - the maze's catnip mist is drawn in the tower, with fewer layers on phones and at lower detail;
// - while the camera is in the commons (or looking out from the aquarium's water) the walk's lights (shared by the
//   whole ship) ease down and warm, with a violet bounce from below, and the neon and its halos burn brighter;
// - whether a visitor is in the room, for the catnip face and the lounge music.
// Only the walk pages (main*.js) import this, like the atrium's mood: none of the producers of the ship's geometry do
// (scripts/fast-dependencies-v2.mjs), so an edit here takes the fast lane instead of a full build. Nothing here
// reaches the prepared walk: the authoring page saves it before its first frame, and the Node build never runs it.
// In the room: the lights' share of their usual strength, their colours, and how much brighter the neon and halos burn.
const MOOD={hemi:.32,fill:.12,env:.22,sky:0xffb26b,ground:0x5a2f99,neon:1.35,glow:1.9};

// `lounge` is what createLounge returned; `light` the walk's shared lights ({hemi,fill,scene}). Adds lounge.inside.
export function createLoungeMood(lounge,light=null){
 const {frame,glows}=lounge,updateMist=createMazeMist(lounge);
 const inRoom=loungeMoodRegion(),lit=glows.map(m=>({m,k:m.name==='Lounge_neon_glow'?MOOD.neon:MOOD.glow}));
 const base=light&&{hemi:light.hemi.intensity,fill:light.fill.intensity,env:light.scene.environmentIntensity,sky:light.hemi.color.clone(),ground:light.hemi.groundColor.clone()};
 const sky=new T.Color(MOOD.sky),ground=new T.Color(MOOD.ground);let mood=0,shown=0,waterMix=0;
 const waterFrame=frame.clone().multiply(new T.Matrix4().makeTranslation(0,0,6)).invert(),waterPoint=new T.Vector3();
 let waterTint=null;if(typeof document!=='undefined'){waterTint=document.createElement('div');
  waterTint.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;background:rgba(0,130,145,.22)';document.body.appendChild(waterTint);}
 function inWaterView(eye){const p=waterPoint.copy(eye).applyMatrix4(waterFrame),a=AQUARIUM,t=a.tunnel;
  return p.x>a.x0&&p.x<a.x1&&p.y>a.bed&&p.y<a.top&&p.z>a.back&&p.z<a.glass&&!(p.x>t.x0&&p.x<t.x1&&p.y<t.top);}
 function setMood(t){
  if(base){const {hemi,fill,scene}=light,f=(a,b)=>a+(b-a)*t;
   hemi.intensity=f(base.hemi,base.hemi*MOOD.hemi);fill.intensity=f(base.fill,base.fill*MOOD.fill);scene.environmentIntensity=f(base.env,base.env*MOOD.env);
   hemi.color.lerpColors(base.sky,sky,t);hemi.groundColor.lerpColors(base.ground,ground,t);}
  for(const {m,k} of lit)m.color.setScalar(1+(k-1)*t);
 }
 // Whether a body is in the room (inLounge, below): the catnip face (main.js) and the lounge music (lounge-sound.js).
 lounge.inside=inLounge();
 return {
  // After the lounge's own step (doors and hammocks), with the camera's position.
  update(dt,eye){
   const k=1-Math.exp(-4*dt);updateMist();
   const underwater=inWaterView(eye);waterMix+=((underwater?1:0)-waterMix)*k;if(waterTint)waterTint.style.opacity=waterMix.toFixed(3);
   mood+=((underwater||inRoom(eye)?1:0)-mood)*k;if(Math.abs(mood-shown)>.002||(mood<.002&&shown)){shown=mood<.002?0:mood;setMood(shown);}
  },
 };
}

// Body effects and music follow the same native room as the lighting, including the portal wall.
export function inLounge(){
 const room=layout.rooms.find(r=>r.id==='commons-1'),inside=loungeMoodRegion(room),at=new T.Vector3();
 // A seated body's feet can sit below a low cushion, up to a metre below the floor.
 return p=>p.y>=room.y-1&&inside(at.copy(p).setY(Math.max(p.y,room.y)));
}

// The current room reaches past the old fittings, including the arcade wall.
// Follow its height slices so the mood stays inside the lounge's sloping envelope.
export function loungeMoodRegion(room=layout.rooms.find(r=>r.id==='commons-1')){
 const sections=room.envelope?.length?room.envelope:[{rise:0,height:room.height,polygon:room.polygon}];
 return p=>{const rise=p.y-room.y,s=sections.find(s=>rise>=s.rise&&rise<=s.rise+s.height);
  return !!s&&!onLoungeAtriumWalkway(p)&&contains(s.polygon,[p.x,p.z]);};
}
