import * as T from 'three';
import {inOpenAtrium} from '../v2/atrium-visibility.js';

// 4B: the atrium's own warm golden light. The ship-wide base stays the cool 2B light; while the walker is in the open
// atrium (the Deck 6 floor or a balcony facing it, as atrium-visibility.js classifies it) the shared lights ease to a
// warm late-afternoon tint, like the lounge and recovery moods do for their rooms. No lights are added, so it costs
// nothing per frame beyond a few colour lerps.
const MOOD={hemi:1.04,fill:1.08,env:.9,sky:0xffe2b8,ground:0x8a7356};

// The waterfall's streaks (atrium-gardens.js, P6_atrium_waterfall) scroll down at about 2 m/s while the walker is in
// the open atrium. Its texture is shared by the near and distant copies, authored or prepared, so one offset moves
// them all. Looked for by material name every 2 s until found, giving up after ten tries (no canvas, or a phone that
// drops the garden decor).
let fall=null,tries=0,nextLook=0;
function fallingWater(scene){
 if(fall||tries>=10)return fall;const now=performance.now();if(now<nextLook)return null;nextLook=now+2000;tries++;
 scene.traverse(o=>{if(!fall&&o.isMesh&&o.material?.name==='P6_atrium_waterfall'&&o.material.map)fall=o.material.map;});return fall;
}

export function createAtriumMood(light){
 if(!light)return null;
 const {hemi,fill,scene}=light,base={hemi:hemi.intensity,fill:fill.intensity,env:scene.environmentIntensity,sky:hemi.color.clone(),ground:hemi.groundColor.clone()};
 const sky=new T.Color(MOOD.sky),ground=new T.Color(MOOD.ground);let mood=0,shown=0;
 function setMood(t){const f=(a,b)=>a+(b-a)*t;
  hemi.intensity=f(base.hemi,base.hemi*MOOD.hemi);fill.intensity=f(base.fill,base.fill*MOOD.fill);scene.environmentIntensity=f(base.env,base.env*MOOD.env);
  hemi.color.lerpColors(base.sky,sky,t);hemi.groundColor.lerpColors(base.ground,ground,t);}
 return {
  // Runs before the room moods each frame. Inside the atrium it reapplies its whole state every frame (so a room mood
  // that settles while the walker crosses back in cannot leave its own light behind); on leaving it restores the base
  // exactly once and then never writes again, so a room mood that takes over is never overwritten by a fade.
  update(dt){
   if(inOpenAtrium()){mood+=(1-mood)*(1-Math.exp(-3*Math.min(dt,.1)));shown=mood;setMood(mood);const map=fallingWater(scene);if(map)map.offset.y=(map.offset.y+Math.min(dt,.1)*.9)%1;}
   else if(shown){mood=shown=0;setMood(0);}
  },
  get mood(){return shown;},
 };
}
