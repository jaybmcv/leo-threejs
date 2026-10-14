import {MathUtils} from 'three';
export class DLCatTurning {
  private body=0;
  private head=0;
  // stepMax: the longest step taken whole (AvatarPose.stepMax)
  step(rate:number,speed:number,active:boolean,dt:number,lean:number,follow:number,stepMax=.05){
    const target=active&&Number.isFinite(rate)?MathUtils.clamp(rate,-3,3):0;
    dt=MathUtils.clamp(Number.isFinite(dt)?dt:0,0,stepMax);
    this.body+=(target-this.body)*(1-Math.exp(-dt*5));
    this.head+=(target-this.head)*(1-Math.exp(-dt*12));
    const moving=MathUtils.smoothstep(speed,0,2);
    return {bank:MathUtils.clamp(this.body*speed*.018*lean,-.45,.45)*moving*.5,
      hip:this.body*.045*follow*moving*.5,chest:this.body*.075*follow*moving*.5,
      head:MathUtils.clamp(this.head*.20*follow,-.65,.65)*moving};
  }
}
