const ease=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
/** Constant-speed pull while supported, with a lifted, eased recovery. */
export function crawlStroke(phase:number){
  const p=((phase%1)+1)%1,contact=.68;
  if(p<contact)return {reach:.12*(1-2*p/contact),lift:0,push:Math.sin(Math.PI*p/contact)};
  const t=(p-contact)/(1-contact);
  return {reach:-.12+.24*ease(t),lift:.025*Math.sin(Math.PI*t)**2,push:0};
}
export function crawlArm(phase:number,upper:number,lower:number){
  const stroke=crawlStroke(phase),z=.20+stroke.reach,y=.19-stroke.lift;
  const d=Math.max(Math.abs(upper-lower)+.001,Math.min(upper+lower-.001,Math.hypot(y,z)));
  const clamp=(v:number)=>Math.max(-1,Math.min(1,v));
  const elbow=Math.PI-Math.acos(clamp((upper*upper+lower*lower-d*d)/(2*upper*lower)));
  const arm=Math.atan2(z,y)-Math.acos(clamp((upper*upper+d*d-lower*lower)/(2*upper*d)));
  return {arm:-arm,elbow};
}
