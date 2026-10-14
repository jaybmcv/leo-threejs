/** Editable calibration in rig-local, bind-relative axes. Joint angles are degrees;
 * gain scales authored rotation before offset. Optional limits clamp the result. */
export type JointTuning = {
  offset: [number, number, number];
  gain: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
  limitsEnabled: boolean;
};
export const DLCAT_LOCOMOTION_CONTROLS = [
  {key:'crouchDepth',label:'Crouch depth',min:0.5,max:1.4,step:.01},
  {key:'crouchTorso',label:'Crouch forward bend',min:0.3,max:1.4,step:.01},
  {key:'crawlKneeTuck',label:'Crawl knee tuck',min:0,max:1.8,step:.01},
  {key:'crawlHipFlexion',label:'Crawl hip flexion',min:0,max:1.8,step:.01},
  {key:'crawlPace',label:'Crawl cycle pace',min:0.25,max:2,step:.01},
  {key:'swimPace',label:'Swim stroke pace',min:0.25,max:2,step:.01},
  {key:'swimKick',label:'Swim kick amount',min:0,max:2,step:.01},

  {key:'strideScale',label:'Stride length',min:0,max:3,step:.01},
  {key:'cadenceScale',label:'Cadence',min:.1,max:3,step:.01},
  {key:'footLiftScale',label:'Foot clearance',min:0,max:4,step:.01},
  {key:'heelFlickEnabled',label:'Heel flick',min:0,max:1,step:1},
  {key:'heelFlickScale',label:'Heel flick strength',min:0,max:1.5,step:.01},
  {key:'heelFlickSpeed',label:'Heel flick speed',min:.02,max:10,step:.01},
  {key:'heelFlickDuration',label:'Heel flick duration',min:.02,max:5,step:.01},
  {key:'stanceWidth',label:'Stance width',min:0,max:.6,step:.001},
  {key:'hipSway',label:'Hip sway (radians)',min:-.5,max:.5,step:.001},
  {key:'hipTwist',label:'Hip twist (radians)',min:-.8,max:.8,step:.001},
  {key:'chestCounterTwist',label:'Chest counter twist (radians)',min:-1,max:1,step:.001},
  {key:'bodyBob',label:'Run rise height',min:0,max:5,step:.01},
  {key:'runFlightFraction',label:'Run flight duration',min:.08,max:2,step:.01},
  {key:'walkArmDrive',label:'Walk arm swing multiplier',min:0,max:3,step:.01},
  {key:'runArmDrive',label:'Run arm swing multiplier',min:0,max:3,step:.01},
  {key:'walkElbowBend',label:'Walk elbow bend multiplier',min:0,max:3,step:.01},
  {key:'runElbowBend',label:'Run elbow bend multiplier',min:0,max:3,step:.01},
  {key:'armSwingScale',label:'Arm swing',min:0,max:4,step:.01},
  {key:'armLooseness',label:'Arm looseness',min:0,max:5,step:.01},
  {key:'elbowLag',label:'Elbow lag',min:0,max:3,step:.01},
  {key:'wristFollow',label:'Wrist follow-through',min:0,max:5,step:.01},
  {key:'palmRotation',label:'Palm rotation (degrees)',min:-180,max:180,step:1},
  {key:'shoulderRotation',label:'Shoulder rotation (degrees)',min:-180,max:180,step:1},
  {key:'armSpacing',label:'Arm spacing (degrees)',min:-30,max:75,step:1},
  {key:'kneeBend',label:'Knee bend (degrees)',min:-30,max:100,step:1},
  {key:'turnLean',label:'Turn lean',min:0,max:4,step:.01},
  {key:'turnFollow',label:'Turn body follow',min:0,max:3,step:.01},
  {key:'swimEntry',label:'Swim entry duration (seconds)',min:.1,max:3,step:.01},
  {key:'swimRecovery',label:'Swim recovery duration (seconds)',min:.1,max:3,step:.01},
  {key:'slideEntry',label:'Slide entry duration (seconds)',min:.05,max:2,step:.01},
  {key:'slideRecovery',label:'Slide recovery duration (seconds)',min:.1,max:3,step:.01},
  {key:'proneDuration',label:'Prone transition duration (seconds)',min:.1,max:3,step:.01},
  {key:'stanceDuration',label:'Stance transition duration (seconds)',min:.05,max:2,step:.01},
  {key:'landingDepth',label:'Landing compression',min:0,max:2,step:.01},
  {key:'landingRecovery',label:'Landing recovery (seconds)',min:.1,max:2,step:.01},
  {key:'airborneTuck',label:'Airborne knee tuck',min:0,max:2,step:.01},
  {key:'airborneExtension',label:'Leg extension duration (seconds)',min:.05,max:1.5,step:.01},
  {key:'takeoffDepth',label:'Takeoff crouch depth',min:0,max:2,step:.01},
  {key:'takeoffDuration',label:'Takeoff duration (seconds)',min:.08,max:.4,step:.01},
  {key:'footAngle',label:'Foot angle (degrees)',min:-90,max:90,step:1},
  {key:'elbowBendScale',label:'Elbow bend',min:0,max:3,step:.01},
  {key:'leanScale',label:'Forward lean',min:-3,max:4,step:.01},
  {key:'pelvisTilt',label:'Pelvis tilt (degrees)',min:-45,max:45,step:1},
  {key:'torsoBend',label:'Torso bend (degrees)',min:-60,max:60,step:1},
  {key:'tailSway',label:'Tail sway amount',min:0,max:5,step:.01},
  {key:'tailSpeed',label:'Tail sway speed',min:0,max:4,step:.01},
  {key:'tailLift',label:'Tail resting lift (degrees)',min:-90,max:90,step:1},
  {key:'tailLag',label:'Tail follow-through',min:0,max:2,step:.01},
  {key:'tailTurnResponse',label:'Tail turn response',min:0,max:3,step:.01},
  {key:'tailStiffness',label:'Tail spring stiffness',min:10,max:160,step:1},
  {key:'tailDamping',label:'Tail spring damping',min:.2,max:2,step:.01},
  {key:'tailInfluence',label:'Tail body-motion influence',min:0,max:3,step:.01},
  {key:'tailCurl',label:'Tail resting curl (degrees)',min:-60,max:60,step:1},
  {key:'idleBreathing',label:'Idle breathing',min:0,max:15,step:.01},
  {key:'idleRelax',label:'Idle arm relaxation',min:0,max:10,step:.01},
  {key:'idleShift',label:'Idle weight shift',min:0,max:15,step:.01},
  {key:'blendSeconds',label:'Transition time (seconds)',min:.01,max:3,step:.01},
] as const;
export type LocomotionKey = typeof DLCAT_LOCOMOTION_CONTROLS[number]['key'];
export type DLCatTuning = {
  schemaVersion: 1;
  locomotion: Record<LocomotionKey, number>;
  joints: Record<string, JointTuning>;
};
function freezeDeep<T>(value:T):T {
  if(value && typeof value==='object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
export const DEFAULT_DLCAT_JOINT: JointTuning = freezeDeep({
  offset:[0,0,0],gain:[1,1,1],min:[-180,-180,-180],max:[180,180,180],limitsEnabled:false,
});
// Captured from the reviewed lab profile on 2026-09-17; elbows relaxed to 0.72.
export const DEFAULT_DLCAT_TUNING: DLCatTuning = freezeDeep({
  "schemaVersion": 1,
  "locomotion": {
    "crouchDepth": 1,
    "crouchTorso": 1,
    "crawlKneeTuck": 1,
    "crawlHipFlexion": 1,
    "crawlPace": 1,
    "swimPace": 1,
    "swimKick": 1,

    "strideScale": 1.06,
    "cadenceScale": 1.14,
    "footLiftScale": 0.22,
    "heelFlickEnabled": 1,
    "heelFlickScale": 0.47,
    "heelFlickSpeed": 0.42,
    "heelFlickDuration": 2.43,
    "stanceWidth": 0.126,
    "hipSway": -0.067,
    "hipTwist": 0.153,
    "chestCounterTwist": 0.177,
    "bodyBob": 2.2,
    "runFlightFraction": 0.89,
    "armSwingScale": 1.2,
    "walkArmDrive": .55,
    "runArmDrive": 1,
    "walkElbowBend": 1,
    "runElbowBend": 1,
    "armLooseness": 2.55,
    "elbowLag": 1.03,
    "wristFollow": 2.22,
    "palmRotation": -8,
    "shoulderRotation": 10,
    "armSpacing": 15,
    "kneeBend": -11,
    "turnLean": 1,
    "turnFollow": 1,
    "swimEntry": 0.6,
    "swimRecovery": 0.7,
    "slideEntry": 0.3,
    "slideRecovery": 0.55,
    "proneDuration": 0.9,
    "stanceDuration": 0.35,
    "landingDepth": 1.44,
    "landingRecovery": 0.63,
    "airborneTuck": 0.68,
    "airborneExtension": 0.39,
    "takeoffDepth": 1.21,
    "takeoffDuration": 0.16,
    "footAngle": 1,
    "elbowBendScale": 0.72,
    "leanScale": 1.42,
    "pelvisTilt": 2,
    "torsoBend": -15,
    "tailSway": 3.09,
    "tailSpeed": 1.75,
    "tailLift": -56,
    "tailLag": 1,
    "tailTurnResponse": 1,
    "tailStiffness": 55,
    "tailDamping": 0.8,
    "tailInfluence": 1,
    "tailCurl": 0,
    "idleBreathing": 4.77,
    "idleRelax": 1.44,
    "idleShift": 8.39,
    "blendSeconds": 0.2
  },
  "joints": {}
});
export const DLCAT_TUNING_STORAGE_KEY='reach.dlcat.tuning.v1';
export const DLCAT_TUNING_CHANGE_EVENT='dlcat-tuning-change';
const unsafeKeys=new Set(['__proto__','prototype','constructor']);
function record(value:unknown,label:string):Record<string,unknown> {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error(label+' must be an object');
  const proto=Object.getPrototypeOf(value);
  if(proto!==Object.prototype && proto!==null) throw new Error(label+' must be a plain object');
  for(const key of Object.keys(value)) {
    if(unsafeKeys.has(key)) throw new Error('Unsafe property: '+key);
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(!descriptor || !('value' in descriptor)) throw new Error('Accessor properties are not supported');
  }
  return value as Record<string,unknown>;
}
function keys(value:Record<string,unknown>,expected:readonly string[],label:string) {
  if(Object.keys(value).length!==expected.length || expected.some(key=>!Object.hasOwn(value,key)))
    throw new Error(label+' has missing or unknown properties');
}
function number(value:unknown,min:number,max:number,label:string):number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)
    throw new Error(label+' must be a finite number between '+min+' and '+max);
  return value;
}
function vector(value:unknown,min:number,max:number,label:string):[number,number,number] {
  if(!Array.isArray(value)||value.length!==3) throw new Error(label+' must contain three numbers');
  return [number(value[0],min,max,label),number(value[1],min,max,label),number(value[2],min,max,label)];
}
/** Strict import: reject malformed data instead of silently changing a calibration. */
export function validateDLCatTuning(input:unknown):DLCatTuning {
  const top=record(input,'Profile');keys(top,['schemaVersion','locomotion','joints'],'Profile');
  if(top.schemaVersion!==1) throw new Error('Unsupported DLCat tuning schema version');
  const original=record(top.locomotion,'Locomotion');
  // Additive v1 migration preserves every existing saved slider and joint edit.
  const source:Record<string,unknown>={crouchDepth:1,crouchTorso:1,crawlKneeTuck:1,crawlHipFlexion:1,crawlPace:1,swimPace:1,swimKick:1,walkArmDrive:.55,runArmDrive:1,walkElbowBend:1,runElbowBend:1,armLooseness:1,elbowLag:1,wristFollow:1,palmRotation:0,shoulderRotation:0,armSpacing:0,kneeBend:0,footAngle:0,turnLean:1,turnFollow:1,swimEntry:.6,swimRecovery:.7,slideEntry:.3,slideRecovery:.55,proneDuration:.9,stanceDuration:.35,landingDepth:1,landingRecovery:.35,airborneTuck:1,airborneExtension:.3,takeoffDepth:1,takeoffDuration:.22,heelFlickEnabled:1,heelFlickScale:1,heelFlickSpeed:1,heelFlickDuration:1,runFlightFraction:.32,pelvisTilt:0,torsoBend:0,tailSway:1,tailSpeed:1,tailLift:0,tailLag:1,tailTurnResponse:1,tailStiffness:55,tailDamping:.8,tailInfluence:1,tailCurl:0,idleBreathing:1,idleRelax:1,idleShift:1,...original};
  keys(source,DLCAT_LOCOMOTION_CONTROLS.map(c=>c.key),'Locomotion');
  const locomotion={} as DLCatTuning['locomotion'];
  for(const c of DLCAT_LOCOMOTION_CONTROLS) locomotion[c.key]=number(source[c.key],c.min,c.max,c.label);
  if(locomotion.heelFlickEnabled!==0&&locomotion.heelFlickEnabled!==1)throw new Error('Heel flick must be enabled or disabled');
  const inputJoints=record(top.joints,'Joints');
  if(Object.keys(inputJoints).length>256) throw new Error('Too many joint overrides');
  const joints:Record<string,JointTuning>={};
  for(const [name,value] of Object.entries(inputJoints)) {
    if(!name || name.length>128) throw new Error('Invalid joint name');
    const j=record(value,'Joint '+name);keys(j,['offset','gain','min','max','limitsEnabled'],'Joint '+name);
    if(typeof j.limitsEnabled!=='boolean') throw new Error('limitsEnabled must be boolean');
    const joint:JointTuning={offset:vector(j.offset,-360,360,'Offset'),gain:vector(j.gain,0,4,'Gain'),
      min:vector(j.min,-360,360,'Minimum'),max:vector(j.max,-360,360,'Maximum'),limitsEnabled:j.limitsEnabled};
    if(joint.min.some((v,i)=>v>joint.max[i]!)) throw new Error('Joint minimum exceeds maximum');
    joints[name]=joint;
  }
  return {schemaVersion:1,locomotion,joints};
}
export function parseDLCatTuning(json:string):DLCatTuning {return validateDLCatTuning(JSON.parse(json));}
export function cloneDLCatTuning(profile:DLCatTuning=DEFAULT_DLCAT_TUNING):DLCatTuning {return validateDLCatTuning(profile);}
export function getDLCatJointTuning(profile:DLCatTuning,name:string):JointTuning {
  return Object.hasOwn(profile.joints,name)?profile.joints[name]!:DEFAULT_DLCAT_JOINT;
}
let current:DLCatTuning=freezeDeep(cloneDLCatTuning());
let connectedWindow:Window|undefined;
function notify() {
  if(typeof window!=='undefined') window.dispatchEvent(new CustomEvent(DLCAT_TUNING_CHANGE_EVENT,{detail:getDLCatTuning()}));
}
function connectStorage() {
  if(typeof window==='undefined'||connectedWindow===window) return;
  connectedWindow=window;
  try {
    const saved=window.localStorage.getItem(DLCAT_TUNING_STORAGE_KEY);
    if(saved) current=freezeDeep(parseDLCatTuning(saved));
  } catch { /* Storage may be unavailable or contain a stale invalid profile. */ }
  window.addEventListener('storage',event=>{
    if(event.key!==DLCAT_TUNING_STORAGE_KEY && event.key!==null) return;
    try { current=freezeDeep(event.newValue?parseDLCatTuning(event.newValue):cloneDLCatTuning());notify(); }
    catch { /* Keep the last valid profile when another tab writes invalid data. */ }
  });
}
/** Stable frozen snapshot until the next edit. Clone before changing controls. */
export function getDLCatTuning():DLCatTuning {connectStorage();return current;}
export function setDLCatTuning(profile:DLCatTuning):DLCatTuning {
  const validated=validateDLCatTuning(profile);
  connectStorage();current=freezeDeep(validated);
  try {if(typeof window!=='undefined') window.localStorage.setItem(DLCAT_TUNING_STORAGE_KEY,JSON.stringify(current));} catch { /* In-memory editing still works. */ }
  notify();return cloneDLCatTuning(current);
}
export function resetDLCatTuning():DLCatTuning {return setDLCatTuning(cloneDLCatTuning());}
