import * as T from 'three';

// The Deck 20 crew recovery lounge's pod side on foot (from tester feedback; the pods and coffee bar are
// src/command-deck.js): while the camera is there the walk's lights (shared by the whole ship) ease down and warm, so
// the pods' strip lights and the coffee bar glow. The pods' mattresses are rest spots like any bed (rest.js).
// Pod side (ship frame): x -88..-64, z 5..25, floor y 36.3.
const SIDE=new T.Box3(new T.Vector3(-88,36,5),new T.Vector3(-64,39.8,25));
// The lights' share of their usual strength there, and their colours.
const MOOD={hemi:.4,fill:.2,env:.3,sky:0xffc48a,ground:0x3a2c38};

export function createRecoveryMood(ship,light){
 if(!light||!ship.root.getObjectByName('Area_d20-recovery-aft'))return null;
 const {hemi,fill,scene}=light,base={hemi:hemi.intensity,fill:fill.intensity,env:scene.environmentIntensity,sky:hemi.color.clone(),ground:hemi.groundColor.clone()};
 const sky=new T.Color(MOOD.sky),ground=new T.Color(MOOD.ground);let mood=0,shown=0;
 function setMood(t){const f=(a,b)=>a+(b-a)*t;
  hemi.intensity=f(base.hemi,base.hemi*MOOD.hemi);fill.intensity=f(base.fill,base.fill*MOOD.fill);scene.environmentIntensity=f(base.env,base.env*MOOD.env);
  hemi.color.lerpColors(base.sky,sky,t);hemi.groundColor.lerpColors(base.ground,ground,t);}
 return {
  update(dt,eye){
   mood+=((SIDE.containsPoint(eye)?1:0)-mood)*(1-Math.exp(-4*dt));
   if(Math.abs(mood-shown)>.002||(mood<.002&&shown)){shown=mood<.002?0:mood;setMood(shown);}
  },
  get mood(){return shown;},
 };
}
