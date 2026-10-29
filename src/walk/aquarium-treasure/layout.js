import {AQUARIUM as A} from '../lounge-aquarium.js';
import {toWorld,toLocal} from '../../plan/rooms.js';

// The same tank and room frame as the reef. Points here use the lounge template's coordinates.
export const SWIM={speed:4,reach:1.15,radius:1.05,offset:.8,door:[130.8,32.3,9.2],entry:[130.8,32.4,5.95],chest:[134,29.7,6],
 gems:[[116.5,26.8,6],[121.5,31.4,5.7],[128,26.6,6.2],[134,33.2,6],[142.5,30.5,5.7],[148,26.8,6.2],[151.5,33.5,6]],
 colors:[0xff526b,0xffa33d,0xffe85b,0x71ff85,0x45e5ff,0x668aff,0xdc6dff]};
export const swimWorld=p=>toWorld('commons-1',[p[0]-132,p[1]-A.floor,p[2]-27]);
export function swimLocal(p){const q=toLocal('commons-1',p);return [q[0]+132,q[1]+A.floor,q[2]+27];}
export const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
// The swimmer's origin is below its middle. A full horizontal body clears the glass and the tunnel.
export function limitSwim(p,camera=false){
 const r=camera?.22:SWIM.radius,q=[...p],clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 q[0]=clamp(q[0],A.x0+r,A.x1-r);q[2]=clamp(q[2],A.back+r,A.glass-r);
 q[1]=clamp(q[1],camera?A.bed+.22:A.bed+.25,camera?A.top-.22:A.top-1.45);
 if(q[0]>A.tunnel.x0-r&&q[0]<A.tunnel.x1+r)q[1]=Math.max(q[1],A.tunnel.top+(camera?.22:.3));
 return q;
}
export function inWater(p){
 return p[0]>A.x0&&p[0]<A.x1&&p[1]>A.bed&&p[1]<A.top&&p[2]>A.back&&p[2]<A.glass&&
  !(p[0]>A.tunnel.x0&&p[0]<A.tunnel.x1&&p[1]<A.tunnel.top);
}
export const gemNear=(p,g,r=SWIM.reach)=>distance([p[0],p[1]+SWIM.offset,p[2]],g)<r;
