import * as THREE from 'three';
import { DEFAULT_DLCAT_TUNING, type DLCatTuning } from './dlCatTuning.js';
import { cosmoRunBlend } from './cosmoRunCycle.js';
// DLCat's short legs need their own visual cadence and foot trajectory.
// Game travel speed is unchanged; this is a stylized, in-place animation.
const tau = Math.PI * 2;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x: number) => { x = clamp(x); return x*x*(3-2*x); };
const mix = (a: number, b: number, t: number) => a+(b-a)*t;

// Lengthen the walk step instead of racing a tiny in-place shuffle. Cadence
// edits trade step length for frequency while preserving ground-relative speed.
function walkingTuning(tuning:DLCatTuning['locomotion']):DLCatTuning['locomotion'] {
  return {...tuning,strideScale:tuning.strideScale*1.625/Math.sqrt(Math.max(.1,tuning.cadenceScale))};
}

export function dlCatStride(phase: number, speed: number, upper: number, lower: number, tuning: DLCatTuning["locomotion"] = DEFAULT_DLCAT_TUNING.locomotion) {
  const moving = ease(speed / 1.2), run = ease((speed-4.5)/3);
  // Long body suspension must not collapse the planted-foot interval.
  const contact = mix(.64, .5*(1-Math.min(.64,tuning.runFlightFraction)), run);
  const flightContact = mix(.64, .5*(1-Math.min(1,tuning.runFlightFraction)), run);
  // Extended editor ranges remain bounded by this rig's measured reach.
  const stride = Math.min((upper+lower)*.8,mix(.16, .25, run) * moving * tuning.strideScale);
  const foot = (p: number) => {
    p = ((p % 1)+1)%1;
    if (p < contact) {
      const t = p/contact;
      return {z: mix(stride,-stride,t), lift:0,
        pitch: (-mix(.08,.2,run)*(1-ease(t/.2)) + mix(.18,.34,run)*ease((t-.75)/.25))*moving,
        heel:0,planted:true};
    }
    const t = (p-contact)/(1-contact);
    // Heel recovery peaks behind the hips and finishes before forward contact.
    // Duration stretches the recovery window; reserve the last 5% for planting.
    const heelEnd=Math.min(.95,.78*tuning.heelFlickDuration);
    const heelRise=Math.min(.2/tuning.heelFlickSpeed,heelEnd*.45);
    // Once recovery fills the swing, extra duration extends the raised hold.
    const holdExtension=1-Math.exp(-Math.max(0,tuning.heelFlickDuration-1));
    const heelRelease=Math.max(heelRise,heelEnd*((.28/.78)+.5*holdExtension));
    const heel=Math.min(1.55,mix(1.05,1.45,run)*tuning.heelFlickScale)*tuning.heelFlickEnabled*moving*ease(t/heelRise)*(1-ease((t-heelRelease)/(heelEnd-heelRelease)));
    return {z: mix(-stride,stride,ease(t)) - (2*stride*(1-contact)/Math.max(.25,contact)*ease(contact/.1))*t*(1-t)*(1-2*t),
      // Walk recovery peaks behind the body and descends before reaching forward.
      // The old symmetric arc kept the advancing shoe raised like a stair step.
      lift: mix((729/16)*t*t*(1-t)**4,Math.sin(Math.PI*t)**2,run) * mix(.025,.10,run)*moving*tuning.footLiftScale+(upper+lower)*.45*Math.sin(heel),
      pitch: mix(mix(.18,.3,run),-mix(.08,.2,run),ease(t))*moving, heel, planted:false};
  };
  const left = foot(phase), right = foot(phase+.5);
  const flightPhase = flightContact < .5 ? clamp((((phase%1)+1)%1% .5-flightContact)/(.5-flightContact)) : 0;
  // Broader crest with smooth lift-off/landing, keeping the same peak height.
  const flightArc = 16*flightPhase**2*(1-flightPhase)**2;
  // Keep pelvis height independent of which leg is currently farther forward.
  // Changing the support leg must not create an extra hop at mid-stride.
  const reach = upper+lower-.003;
  const baseDown = Math.sqrt(Math.max(.01, reach*reach-stride*stride));
  // Adjust support height and re-solve both hips and knees together, so added
  // bend does not simply kick the feet backward under the character.
  const restKnee=Math.acos(clamp((baseDown*baseDown-upper*upper-lower*lower)/(2*upper*lower),-1,1));
  const bentKnee=clamp(restKnee+THREE.MathUtils.degToRad(tuning.kneeBend),.02,2.6);
  // A straighter-knee edit cannot raise the hip beyond the front/back foot reach.
  const down=Math.min(baseDown,Math.sqrt(Math.max(.01,upper*upper+lower*lower+2*upper*lower*Math.cos(bentKnee))));
  const leg = (f: ReturnType<typeof foot>) => {
    const y = down-Math.min(down*.8,f.lift);
    const d = clamp(Math.hypot(y,f.z),Math.abs(upper-lower)+.001,upper+lower-.001);
    const knee = Math.PI-Math.acos(clamp((upper*upper+lower*lower-d*d)/(2*upper*lower),-1,1));
    const hip = Math.atan2(f.z,y)+Math.acos(clamp((upper*upper+d*d-lower*lower)/(2*upper*d),-1,1));
    return {hip:-hip,knee,ankle:f.pitch};
  };
  const l=leg(left),r=leg(right),swing=Math.cos(phase*tau);
  const arm = mix(.32,.65,run)*moving*tuning.armSwingScale;
  const armPhase=phase*tau-.12*tuning.armLooseness;
  const relaxedSwing=Math.cos(armPhase)+Math.sin(3*armPhase)*.025*tuning.armLooseness;
  // Follow the actual asymmetric foot trajectory, including edited flight timing.
  // Positive arm angle swings backward, opposite the forward leg on that side.
  const oppositeLegSwing=stride>1e-6?Math.sin(clamp((left.z-right.z)/(2*stride),-1,1)*Math.PI/2):relaxedSwing;
  const armSwing=mix(relaxedSwing,oppositeLegSwing,run);
  const elbowPhase=armPhase-.55*tuning.elbowLag;
  const elbow = mix(.58,1.18,run)*moving*tuning.elbowBendScale + .2*(1-moving);
  return {hipL:l.hip,hipR:r.hip,kneeL:l.knee,kneeR:r.knee,
    ankleL:l.ankle,ankleR:r.ankle,heelL:left.heel,heelR:right.heel,legSpread:tuning.stanceWidth,
    armL:arm*armSwing,armR:-arm*armSwing,
    elbowL:elbow+(1-Math.cos(elbowPhase))*.15*moving,
    elbowR:elbow+(1+Math.cos(elbowPhase))*.15*moving,
    armSpreadL:.14+Math.sin(armPhase)*.025*moving*tuning.armLooseness,armSpreadR:.14-Math.sin(armPhase)*.025*moving*tuning.armLooseness,
    lean:mix(.025,.12,run)*moving*tuning.leanScale+THREE.MathUtils.degToRad(tuning.pelvisTilt),hipRoll:Math.sin(phase*tau)*tuning.hipSway*moving,
    hipTurn:swing*tuning.hipTwist*moving,spineTurn:-swing*tuning.chestCounterTwist*moving,
    // Counter pelvis rotation in the spine so torso bend stays independent.
    spinePitch:THREE.MathUtils.degToRad(tuning.torsoBend-tuning.pelvisTilt),
    headPitch:-mix(.025,.12,run)*moving-THREE.MathUtils.degToRad(tuning.torsoBend),
    // A full, smooth flight arc per step; zero velocity at lift-off and landing.
    flight:tuning.bodyBob*.065*run*flightArc};
}

/** Native Three.js clips share a normalized foot phase. The mixer blends
 * editable, measured gait channels; the rig adapter converts them to bones. */
export class DLCatLocomotion {
  private phase=0;
  private speed=0;
  private speedRate=0;
  private signature='';
  private lastTuning:DLCatTuning['locomotion']|null=null;
  private lengths='';
  private keys:Array<keyof ReturnType<typeof dlCatStride>>=[];
  private readonly channels=new THREE.Object3D() as THREE.Object3D & ReturnType<typeof dlCatStride>;
  readonly mixer=new THREE.AnimationMixer(this.channels);
  private clips:THREE.AnimationClip[]=[];
  private actions:THREE.AnimationAction[]=[];
  setPhase(phase:number){if(Number.isFinite(phase))this.phase=((phase%1)+1)%1;}
  get currentSpeed(){return this.speed;}
  get currentPhase(){return this.phase;}
  get state(){return {engine:'Three.js AnimationMixer',phase:this.phase,speed:this.speed,clips:this.clips.map(c=>c.name),weights:this.actions.map(a=>a.getEffectiveWeight())};}
  private bake(upper:number,lower:number,tuning:DLCatTuning['locomotion']){
    this.mixer.stopAllAction();for(const clip of this.clips)this.mixer.uncacheClip(clip);
    Object.assign(this.channels,dlCatStride(0,0,upper,lower,tuning));
    const keys=this.keys=Object.keys(dlCatStride(0,0,upper,lower,tuning)) as Array<keyof ReturnType<typeof dlCatStride>>;
    this.clips=[0,4.5,7.5].map((speed,index)=>{
      const clipTuning=index===1?walkingTuning(tuning):tuning;
      const samples=Array.from({length:121},(_,i)=>dlCatStride(i/120,speed,upper,lower,clipTuning));
      // Identical endpoint guarantees a closed loop for every editable channel.
      samples[120]=samples[0]!;
      const times=Array.from({length:121},(_,i)=>i/120);
      return new THREE.AnimationClip('dlcat:'+['idle','walk','run'][index],1,keys.map(key=>new THREE.NumberKeyframeTrack('.'+key,times,samples.map(f=>f[key]))));
    });
    this.actions=this.clips.map(clip=>{const a=this.mixer.clipAction(clip);a.play();a.paused=true;return a;});
  }
  // stepMax: the longest step taken whole (AvatarPose.stepMax)
  step(speed:number,active:boolean,dt:number,upper:number,lower:number,tuning:DLCatTuning['locomotion']=DEFAULT_DLCAT_TUNING.locomotion,stepMax=.05,referenceRunRate?:number){
    dt=Number.isFinite(dt)?Math.max(0,Math.min(stepMax,dt)):0;
    const lengths=upper+':'+lower;
    if(tuning!==this.lastTuning||lengths!==this.lengths){
      this.lastTuning=tuning;this.lengths=lengths;
      const signature=JSON.stringify([upper,lower,tuning]);
      if(signature!==this.signature){this.signature=signature;this.bake(upper,lower,tuning);}
    }
    // Critically damped response preserves velocity when a transition is interrupted.
    // Use a longer stop so the final stride settles instead of abruptly losing weight.
    const target=active&&Number.isFinite(speed)?Math.max(0,speed):0;
    const response=tuning.blendSeconds*(target<this.speed?1.3:1);
    const omega=4/response,decay=Math.exp(-omega*dt);
    const offset=this.speed-target,impulse=this.speedRate+omega*offset;
    this.speed=target+(offset+impulse*dt)*decay;
    this.speedRate=(this.speedRate-omega*impulse*dt)*decay;
    if(this.speed<0){this.speed=0;this.speedRate=0;}
    if(Math.abs(this.speed-target)<.001&&Math.abs(this.speedRate)<.01){this.speed=target;this.speedRate=0;}
    // Ordinary walking tops out near 1.5 m/s; faster travel blends into a jog.
    const run=ease((this.speed-1.5)/3),moving=ease(this.speed/.18);
    // Beyond a full airborne step, stretch the whole run cycle to keep limbs synchronized.
    const flightTimeScale=mix(1,Math.max(1,tuning.runFlightFraction),run);
    const walkStride=Math.min((upper+lower)*.8,.16*walkingTuning(tuning).strideScale);
    // During support, -2*stride/contact local travel cancels forward body travel.
    const walkRate=walkStride>.001?this.speed*.64/(2*walkStride):0;
    const runStride=Math.min((upper+lower)*.8,.25*tuning.strideScale);
    const runContact=.5*(1-Math.min(.64,tuning.runFlightFraction));
    const jogRate=runStride>.001?this.speed*runContact/(2*runStride):0;
    const sprint=ease((this.speed-4.5)/3);
    const runRate=mix(jogRate,1.55*tuning.cadenceScale*Math.max(1,this.speed/7.5)/flightTimeScale,sprint);
    const cycleRate=referenceRunRate===undefined?mix(walkRate,runRate,run):mix(mix(walkRate,runRate,run),referenceRunRate,cosmoRunBlend(this.speed));
    this.phase=(this.phase+dt*cycleRate*moving)%1;
    const weights=[1-moving,moving*(1-run),moving*run];
    this.actions.forEach((a,i)=>{a.time=this.phase;a.setEffectiveWeight(weights[i]!);});
    this.mixer.update(0);
    const result={} as ReturnType<typeof dlCatStride>;
    for(const key of this.keys)result[key]=this.channels[key];
    // Keep normal movement relaxed; retain the stronger sprint arm drive.
    const armDrive=mix(tuning.walkArmDrive,tuning.runArmDrive,sprint);
    result.armL*=armDrive;result.armR*=armDrive;
    const elbowDrive=mix(tuning.walkElbowBend,tuning.runElbowBend,sprint);
    result.elbowL*=elbowDrive;result.elbowR*=elbowDrive;
    return result;
  }
  dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.channels);this.clips=[];this.actions=[];}
}
