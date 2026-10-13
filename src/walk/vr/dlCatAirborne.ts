import { MathUtils } from 'three';
import { GRAVITY } from './worldCore.js';
import { jumpPose } from './gait.js';

/** Unfold after the apex; vertical velocity supplies a continuous descent clock. */
export function airborneLegs(age:number, rise:number, jumpCount:number, tuck:number, duration:number) {
  const descent=Math.max(0,-rise)/Math.abs(GRAVITY);
  const extension=MathUtils.smoothstep(descent,0,duration);
  const pose=jumpPose(Math.max(0,rise),age,jumpCount);
  const amount=tuck*(1-extension);
  return {
    hipL:MathUtils.clamp(-.12+(pose.hipL+.12)*amount,-1.8,0),
    hipR:MathUtils.clamp(-.08+(pose.hipR+.08)*amount,-1.8,0),
    kneeL:MathUtils.clamp(.2+(pose.kneeL-.2)*amount,.2,2.6),
    kneeR:MathUtils.clamp(.24+(pose.kneeR-.24)*amount,.24,2.6),
  };
}
