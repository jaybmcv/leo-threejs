import * as T from 'three';
import type { JointTuning } from './dlCatTuning.js';
const turn=Math.PI*2;
const near=(value:number,reference:number)=>value+turn*Math.round((reference-value)/turn);
/** Apply a local bind-relative edit without feeding that edit into next frame.
 * Choose the equivalent Euler representation nearest the previous source pose
 * so a full swim stroke does not wrap an amplitude edit at +/-180 degrees. */
export function tunedJointPose(rest:T.Quaternion,animated:T.Quaternion,tuning:JointTuning,previous?:T.Vector3){
  const delta=rest.clone().invert().multiply(animated).normalize();
  const e=new T.Euler().setFromQuaternion(delta,'XYZ');
  let angles=new T.Vector3(e.x,e.y,e.z);
  if(previous){
    const a=new T.Vector3(near(e.x,previous.x),near(e.y,previous.y),near(e.z,previous.z));
    const b=new T.Vector3(near(e.x+Math.PI,previous.x),near(Math.PI-e.y,previous.y),near(e.z+Math.PI,previous.z));
    angles=a.distanceToSquared(previous)<=b.distanceToSquared(previous)?a:b;
  }
  const values=angles.toArray().map((angle,i)=>{
    const degrees=T.MathUtils.radToDeg(angle)*tuning.gain[i]!+tuning.offset[i]!;
    return T.MathUtils.degToRad(tuning.limitsEnabled?T.MathUtils.clamp(degrees,tuning.min[i]!,tuning.max[i]!):degrees);
  });
  const q=rest.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(values[0],values[1],values[2],'XYZ'))).normalize();
  return {quaternion:q,angles};
}
