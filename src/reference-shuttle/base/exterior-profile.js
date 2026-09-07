import {planHalfWidth} from './plan-profile.js';
import {bowHeight} from './diagonal-profile.js';
import {hullAt,halfWidth as pressureWidth} from './hull-profile.js';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Cosmetic wing-root fairing, integrated into the outer shell. The pressure
// envelope used by the deck fit stays inside it and retains the established baseline.
export function shoulderOffset(x,y){
  if(x<=-262||x>=-80||y>=12)return 0;
  const t=(x+262)/182,top=hullAt(x).top-2;
  return 14*Math.sin(Math.PI*t)**2*smooth(-20,4,y)*(1-smooth(4,12,y));
}
export const exteriorWidth=(x,y)=>Math.min(planHalfWidth(x),pressureWidth(x,y)+shoulderOffset(x,y));
export const chineY=x=>{const h=hullAt(x),t=smooth(140,178,x);return Math.min(h.top,(h.bottom+(h.top-h.bottom)*.46)*(1-t)-11*t);};
// Height-only fairing: retain every approved plan vertex while replacing the
// diamond's abrupt flat shelf with a longitudinal ramp and rounded shoulders.
export function aftSurfaceY(x,y,z){
  const blend=smooth(-185,-140,x)*(1-smooth(-25,28,x))*smooth(12,32,y);
  if(!blend)return y;
  const centre=36+16.8*smooth(-185,5,x),rail=Math.min(planHalfWidth(x),82*.985);
  const lateral=Math.min(1,Math.abs(z)/rail);
  const ramp=centre-(centre-12)*lateral**3.6;
  return y+(ramp-y)*blend;
}
export function exteriorShellPoint(x,theta,side,offset=0){
  const h=hullAt(x),seam=-Math.PI/8,roof=Math.PI/2,chine=chineY(x);
  const sample=a=>{let y;if(a<=seam){const t=(a+Math.PI/2)/(seam+Math.PI/2);y=h.bottom+(chine-h.bottom)*(1-Math.cos(t*Math.PI/2));}else{const t=(a-seam)/(roof-seam);y=chine+(h.top-chine)*Math.sin(t*Math.PI/2);}return [y,exteriorWidth(x,y)];};
  // Subdivide the established 96-segment plan edges, rather than changing them.
  const f=(theta+Math.PI/2)/Math.PI*96,i=Math.min(95,Math.floor(f)),t=f-i;
  const a=sample(-Math.PI/2+i/96*Math.PI),b=sample(-Math.PI/2+(i+1)/96*Math.PI);
  const y=a[0]+(b[0]-a[0])*t,z=side*(a[1]+(b[1]-a[1])*t);
  return [x,aftSurfaceY(x,y,z),z+side*offset];
}
export function exteriorRoofY(x,z,offset=0){
  const h=hullAt(x);if(!h)return 0;
  let lo=Math.max(h.bottom,-3),hi=h.top;
  for(let i=0;i<35;i++){const m=(lo+hi)/2;if(exteriorWidth(x,m)>=Math.abs(z))lo=m;else hi=m;}
  return aftSurfaceY(x,lo,z)+offset;
}
export const finishedRoofY=(x,z)=>bowHeight(x,exteriorRoofY(x,z));
