/** Damped angular springs, advanced in bounded substeps for frame-rate stability. */
export class TailSpring {
  private angles=Array.from({length:5},()=>[0,0]);
  private velocities=Array.from({length:5},()=>[0,0]);
  private ready=false;
  // stepMax: the longest step taken whole, still in 240 Hz substeps (a
  // distant cat posed every few frames hands on the time between)
  step(targets:number[][],dt:number,stiffness:number,damping:number,reset=false,stepMax=.05){
    if(!this.ready||reset){this.angles=targets.map(a=>a.slice());this.velocities=targets.map(()=>[0,0]);this.ready=true;}
    const count=Math.max(1,Math.ceil(Math.min(stepMax,Math.max(0,dt))*240));
    const h=Math.min(stepMax,Math.max(0,dt))/count;
    for(let step=0;step<count;step++)for(let i=0;i<5;i++)for(let axis=0;axis<2;axis++){
      const k=stiffness/(1+i*.22),drag=2*Math.sqrt(k)*damping;
      const a=this.angles[i]!,v=this.velocities[i]!;
      v[axis]!+=(k*(targets[i]![axis]!-a[axis]!)-drag*v[axis]!)*h;
      a[axis]!+=v[axis]!*h;
      // Limit accumulated bend and suppress energy at the stop.
      const limit=axis===0?1.1:.45;
      if(Math.abs(a[axis]!)>limit){a[axis]=Math.sign(a[axis]!)*limit;v[axis]=0;}
    }
    return this.angles;
  }
}
