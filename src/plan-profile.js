// Top-view baseline traced from concepts/v05/user-reference.png.
// Legacy logical plan: 590 px length and 314 px span. The exterior root
// maps X by 0.94*x-18 to a 564 m physical length and near-uniform artwork scale.
// Height is intentionally absent: later diagonal/side edits must retain this plan.
export const registration={left:877,right:1467,centre:825,halfSpan:157};
export const planX=px=>(px-877)*600/590-300;
export const planZ=py=>(825-py)*300/314;
export const hullTracePixels=[
  [877,807],[879,794],[886,787],[904,783],[941,779],
  [965,776],[988,772],[1015,759],[1047,746],[1080,740],
  [1110,739],[1338,739],[1370,740],[1390,742],[1410,747],
  [1430,757],[1447,774],[1458,794],[1465,813],[1467,825]
];
const points=hullTracePixels.map(([x,y])=>[planX(x),planZ(y)]);
// Monotone cubic interpolation avoids overshooting the traced boundary.
export function planHalfWidth(x){
  if(x< -300||x>300)return 0;
  const slope=i=>(points[i+1][1]-points[i][1])/(points[i+1][0]-points[i][0]);
  const tangent=i=>{if(i===0)return slope(0);if(i===points.length-1)return slope(i-1);const a=slope(i-1),b=slope(i);return a*b<=0?0:2*a*b/(a+b);};
  let i=points.findIndex((p,j)=>j<points.length-1&&x>=p[0]&&x<=points[j+1][0]);if(i<0)return 0;
  const a=points[i],b=points[i+1],h=b[0]-a[0],t=(x-a[0])/h;
  return (2*t**3-3*t*t+1)*a[1]+(t**3-2*t*t+t)*h*tangent(i)+(-2*t**3+3*t*t)*b[1]+(t**3-t*t)*h*tangent(i+1);
}
