import { MathUtils } from 'three';

/** Preserve idle recovery, but let the stride take over a moving landing. */
export function movingLandingBlend(speed:number){return MathUtils.smoothstep(Math.abs(speed),.15,1.5);}

/** Visual contact envelope, independent of the simulation's fixed dip timer. */
export class LandingEnvelope {
  private airborne=false;
  private age=Infinity;
  step(airborne:boolean,standing:boolean,dt:number,recovery:number){
    if(standing&&this.airborne)this.age=0;
    else if(Number.isFinite(this.age))this.age+=Math.max(0,dt);
    this.airborne=airborne;
    if(!standing){this.age=Infinity;return 0;}
    const ease=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    // Compress after contact, then release without a hard pose handoff.
    return ease(this.age/.08)*(1-ease((this.age-.08)/recovery));
  }
}
