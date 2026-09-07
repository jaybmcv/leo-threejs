import {planHalfWidth} from './plan-profile.js';
import {bowHeight} from './diagonal-profile.js';
import {hullAt,halfWidth as pressureWidth} from './hull-profile.js';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Zero first and second derivatives at patch boundaries prevent a visible
// curvature break where the relaxed shoulder rejoins the established surface.
const fairFade=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(6*t-15)+10);};
// Cosmetic wing-root fairing, integrated into the outer shell. The pressure
// envelope used by the deck fit stays inside it and retains the established baseline.
export function shoulderOffset(x,y){
  if(x<=-262||x>=-80||y>=12)return 0;
  const t=(x+262)/182,top=hullAt(x).top-2;
  return 14*Math.sin(Math.PI*t)**2*smooth(-20,4,y)*(1-smooth(4,12,y));
}
export const exteriorWidth=(x,y)=>Math.min(planHalfWidth(x),pressureWidth(x,y)+shoulderOffset(x,y));
export const chineY=x=>{const h=hullAt(x),t=smooth(140,178,x);return Math.min(h.top,(h.bottom+(h.top-h.bottom)*.46)*(1-t)-11*t);};
// Continue the same straight cross-section used by the forward main body.
// The small crown closure and lower shoulder match that existing section.
const sideRail=82*.985,lowerRail=pressureWidth(64,-8);
export function straightSideRoof(z){
  const a=Math.abs(z);
  if(a<=34)return 52.8-.8*a/34;
  if(a<=sideRail)return 52-40*(a-34)/(sideRail-34);
  return 12-20*(a-sideRail)/(lowerRail-sideRail);
}
// Height-only fairing: retain every approved plan vertex while replacing the
// diamond's abrupt flat shelf with a longitudinal ramp and rounded shoulders.
function aftUpperTarget(x,z){
  // One continuous upper cross-section replaces the old crown/diamond shelves.
  // At the outer shoulder its height matches the unmodified lower surface.
  const centre=36+16.8*smooth(-190,20,x),rail=exteriorWidth(x,4);
  const lateral=Math.min(1,Math.abs(z)/rail);
  // Roll the outer aft shoulder earlier instead of holding a broad shelf
  // followed by a steep drop above the wing. Keep its chine tangent fixed.
  const roll=fairFade(-220,-165,x)*(1-fairFade(-90,-35,x))*fairFade(42,58,Math.abs(z))*(1-fairFade(.88,1,lateral));
  const shoulderPower=5.4-.6*roll;
  const ramp=4+(centre-4)*(1-lateral**shoulderPower);
  // Flat along the long body; rounding grows slowly only toward the tail.
  const rounding=1-smooth(-220,-70,x);
  // Retain the established lower edge so the new plane cannot fold over the
  // unchanged chine. Only the final narrow shoulder eases into that edge.
  const planeWeight=(1-rounding)*(1-smooth(Math.min(75,rail*.88),rail,Math.abs(z)));
  let target=ramp+(straightSideRoof(z)-ramp)*planeWeight;
  // Restore the short capsule crown: rear centre -4, rear radius 36, beam 68.
  // A low continuous deck replaces the two extended crown creases behind it.
  const q=Math.hypot(z,Math.min(0,x+4)*34/36);
  const cap=52.8-.8*q/34,returnSlope=52-40*(q-34)/(sideRail-34);
  const edgeBlend=Math.max(0,1-Math.abs(cap-returnSlope)/1.2);
  const crown=Math.min(cap,returnSlope)-.3*edgeBlend*edgeBlend;
  const deckCentre=36+13.6*smooth(-190,-4,x);
  const deck=4+(deckCentre-4)*(1-lateral**shoulderPower);
  const h=Math.max(0,1-Math.abs(crown-deck)/1.2);
  const roundedRoof=Math.max(crown,deck)+.3*h*h;
  // Spread the return to the straight side plane over a long run, rather than
  // leaving a transverse ridge alongside the capsule's rounded rear edge.
  const aftBlendStart=-12-100*smooth(34,60,Math.abs(z));
  const roofWeight=(1-smooth(aftBlendStart,-4,x))*(1-smooth(Math.min(60,rail*.75),rail,Math.abs(z)));
  target+=(roundedRoof-target)*roofWeight;
  return target;
}
export function aftSurfaceY(x,y,z){
  const blend=smooth(-250,-190,x)*(1-smooth(0,55,x))*smooth(-8,4,y);
  if(!blend)return y;
  let target=aftUpperTarget(x,z);
  // Relax only the marked diagonal shoulders. The rounded crown boundary,
  // outer chine and straight forward side planes remain outside this patch.
  const q=Math.hypot(z,Math.min(0,x+4)*34/36),a=Math.abs(z);
  // Carry the relaxed surface farther aft, easing into the narrow tail neck
  // before reaching the broader wing shoulder rather than ending mid-ramp.
  const relaxation=fairFade(-238,-170,x)*(1-fairFade(-42,-4,x))*fairFade(18,34,a)*(1-fairFade(58,74,a))*fairFade(35,46,q);
  if(relaxation){
    let fair=0;
    const weights=[1,4,6,4,1];
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)fair+=weights[i+2]*weights[j+2]*aftUpperTarget(x+14*i,z+4.5*j)/256;
    // A small inward pull removes the inflated shoulder without cutting a
    // groove. Both ends fade into the existing roof and tail tangents.
    target+=(fair-target-1)*relaxation;
  }
  return y+(target-y)*blend;
}
// A shallow crown inside the existing capsule perimeter. Both height and
// tangent go to zero at its edge, so the approved plan and rear rim stay fixed.
function roofCamber(x,y,z){
  const end=x<-4?(x+4)/36:x>168?(x-168)/56:0;
  const inside=Math.max(0,1-(z/34)**2-end**2);
  return 1.4*inside*inside*smooth(49,52.8,y);
}
export function exteriorShellPoint(x,theta,side,offset=0){
  const h=hullAt(x),seam=-Math.PI/8,roof=Math.PI/2,chine=chineY(x);
  const sample=a=>{let y;if(a<=seam){const t=(a+Math.PI/2)/(seam+Math.PI/2);y=h.bottom+(chine-h.bottom)*(1-Math.cos(t*Math.PI/2));}else{const t=(a-seam)/(roof-seam);y=chine+(h.top-chine)*Math.sin(t*Math.PI/2);}return [y,exteriorWidth(x,y)];};
  // Subdivide the established 96-segment plan edges, rather than changing them.
  const f=(theta+Math.PI/2)/Math.PI*96,i=Math.min(95,Math.floor(f)),t=f-i;
  const a=sample(-Math.PI/2+i/96*Math.PI),b=sample(-Math.PI/2+(i+1)/96*Math.PI);
  const y=a[0]+(b[0]-a[0])*t;
  let z=side*(a[1]+(b[1]-a[1])*t);
  // Redistribute the former shelf's crowded vertices across the smooth roof.
  // Its outer edge stays fixed; this avoids long, thin triangles in the fairing.
  const remesh=smooth(-230,-190,x)*(1-smooth(0,45,x));
  if(y>=4&&remesh){
    const regular=side*exteriorWidth(x,4)*(1-(y-4)/(h.top-4));
    z+=(regular-z)*remesh;
    return [x,exteriorRoofY(x,z),z+side*offset];
  }
  const shaped=aftSurfaceY(x,y,z);
  return [x,shaped+roofCamber(x,shaped,z),z+side*offset];
}
export function exteriorRoofY(x,z,offset=0){
  const h=hullAt(x);if(!h)return 0;
  let lo=Math.max(h.bottom,-3),hi=h.top;
  for(let i=0;i<35;i++){const m=(lo+hi)/2;if(exteriorWidth(x,m)>=Math.abs(z))lo=m;else hi=m;}
  const shaped=aftSurfaceY(x,lo,z);
  return shaped+roofCamber(x,shaped,z)+offset;
}
export const finishedRoofY=(x,z)=>bowHeight(x,exteriorRoofY(x,z));
