import {planHalfWidth} from './plan-profile.js';
// Shared metre-scale loft. Horizontal contours control both the pressure envelope
// and window placement, so the glazing lives on the sloped facade rather than the roof.
export const LEVELS=[
  [-55,0,248],[-52,58,273],[-45,84,292],[-34,93,298],
  [-25,94,300],[-16,94,296],[-5,92,284],[4,88,271],
  [13,83.5,253],[23,77,241],[33,65.7,230],
  [37,62,226],[38.5,59,222],[39.5,54,218],[40,0,214]
].map(([y,w,x])=>[y,w*88/94,x]);
export const WINDOW_ROWS=[{bottom:42,top:47,arc:1.62,panesPerSide:6},{bottom:31,top:36,arc:1.62,panesPerSide:6},{bottom:20,top:25,arc:1.3,panesPerSide:5}];
// The aft neck stays narrow until the swept wing roots, as in the reference plan.
const AFT=[[-300,40,-18,18],[-280,42,-28,26],[-235,46,-35,31],[-195,56,-44,36],[-160,74,-52,39],[-126,84,-55,40],[-100,88,-55,40],[200,88,-55,40]];
function interp(rows,x,k){
  const slope=j=>(rows[j+1][k]-rows[j][k])/(rows[j+1][0]-rows[j][0]);
  function tangent(i){if(i===0)return slope(0);if(i===rows.length-1)return slope(i-1);const a=slope(i-1),b=slope(i);if(a*b<=0)return 0;const h0=rows[i][0]-rows[i-1][0],h1=rows[i+1][0]-rows[i][0];return 3*(h0+h1)/((2*h1+h0)/a+(h1+2*h0)/b);}
  let i=rows.findIndex((r,j)=>j<rows.length-1&&x>=r[0]&&x<=rows[j+1][0]);if(i<0)return x<rows[0][0]?rows[0][k]:rows.at(-1)[k];
  const a=rows[i],b=rows[i+1],h=b[0]-a[0],t=(x-a[0])/h;
  return (2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*h*tangent(i)+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*h*tangent(i+1);
}
export const widthAtLevel=y=>interp(LEVELS,y,1);
const FRONT=[[-55,248],[-52,273],[-45,292],[-34,298],[-25,300],[-16,296],[-5,284],[4,277],[12,268],[20,259],[30,247],[40,235],[48,227],[52,224],[52.8,220]];
export const frontAtLevel=y=>interp(FRONT,y,1);
const FORE=[[-55,0,200],[-52,54.3,200],[-45,78.6,200],[-34,87,200],[-25,88,200],[-16,88,200],[-5,84,195],[4,76,192],[13,68,186],[23,62,178],[33,56,170],[37,54,168],[38.5,51,167],[39.5,47,166],[40,0,165]];
export const frontWidthAtLevel=y=>interp(FORE,y,1);
export const frontCentreAtLevel=y=>y>=12?168:y>-8?interp(FORE,-8,2)*(12-y)/20+168*(y+8)/20:interp(FORE,y,2);
function baseWidth(x,y){
  if(x< -300||x>300)return 0;
  const crownBlend=Math.max(0,Math.min(1,(y-17)/10)),taperStart=128-98*crownBlend*crownBlend*(3-2*crownBlend);
  if(x<taperStart){const bottom=interp(AFT,x,2),top=interp(AFT,x,3);if(y<bottom||y>top)return 0;return interp(AFT,x,1)/88*widthAtLevel((y-bottom)/(top-bottom)*95-55);}
  if(y< -55||y>40)return 0;
  const centre=frontCentreAtLevel(y),width=frontWidthAtLevel(y);
  if(x<=centre){const t=Math.max(0,Math.min(1,(x-taperStart)/(centre-taperStart))),blend=t*t*(3-2*t);return widthAtLevel(y)*(1-blend)+width*blend;}
  const radius=frontAtLevel(y)-centre,t=(x-centre)/radius;
  return t>1?0:width*Math.sqrt(Math.max(0,1-t*t));
}
const diamond=[[-180,0],[-146,0],[-139,12],[-118,34],[-91,61],[-72,70],[-64,70],[-48,60],[-28,39],[-8,7],[0,0],[10,0]];
export const diamondHalfWidth=x=>x< -180||x>10?0:interp(diamond,x,1);
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
function previousWidth(x,y){const maximum=x<=200?interp(AFT,x,1):baseWidth(x,-25);return maximum>1e-9?baseWidth(x,y)*planHalfWidth(x)/maximum:0;}
// Ruled side planes run from the lower shoulder to a narrow capsule crown.
// The diamond and crown have separate plateau heights; no vent-shaped dents.
export function upperWidth(x,y){
  if(y<12||y>52.8||x< -180||x>frontAtLevel(y))return 0;
  const roofBlend=Math.max(0,Math.min(1,(y-12)/40)),rail=Math.min(planHalfWidth(x),82*.985);
  let crown=rail*(1-roofBlend)+34*roofBlend;
  if(x>168){const radius=frontAtLevel(y)-168;crown*=Math.sqrt(Math.max(0,1-((x-168)/radius)**2));}
  if(x< -4){const rear=-180+140*roofBlend;crown*=Math.sqrt(Math.max(0,1-((-4-x)/(-4-rear))**2));}
  if(y>52)crown*=1-(y-52)/.8;
  let shoulder=0;
  if(x<=10&&y<=40.8){const u=Math.min(1,(y-12)/28);shoulder=rail*(1-u)+diamondHalfWidth(x)*u;if(y>40)shoulder*=1-(y-40)/.8;}
  return Math.min(planHalfWidth(x),Math.max(0,crown,shoulder));
}
function rawWidth(x,y){
  if(x< -300||x>300||y< -55||y>52.8||x>frontAtLevel(y))return 0;
  const old=previousWidth(x,y);
  if(x<=-180||y<=-8)return old;
  const blend=smooth(-180,-146,x);
  const flat=(xx,yy)=>previousWidth(xx,-8)*(12-yy)/20+upperWidth(xx,12)*(yy+8)/20;
  let next;
  if(y<12){const centre=frontCentreAtLevel(y);next=x<=centre?flat(x,y):flat(centre,y)*Math.sqrt(Math.max(0,1-((x-centre)/(frontAtLevel(y)-centre))**2));}
  else{const top=interp(AFT,x,3)*(1-blend)+40.8*blend,mapped=x< -146?12+(y-12)*28.8/(top-12):y;next=upperWidth(x,mapped);}
  return old*(1-blend)+next*blend;
}
function computeHullAt(x){
  if(x< -300||x>300)return null;
  let bottom=x<=200?interp(AFT,x,2):-55;
  if(x>frontAtLevel(-55)){let lo=-55,hi=-25;for(let i=0;i<36;i++){const m=(lo+hi)/2;if(frontAtLevel(m)>=x)hi=m;else lo=m;}bottom=hi;}
  let lo=Math.max(bottom+1e-6,-25),hi=52.8;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(rawWidth(x,m)>1e-7)lo=m;else hi=m;}
  return {w:planHalfWidth(x),top:lo,bottom};
}
const hullCache=new Map();
export function hullAt(x){if(!hullCache.has(x))hullCache.set(x,computeHullAt(x));return hullCache.get(x);}
export function halfWidth(x,y,allowance=0){const h=hullAt(x);if(!h||y<h.bottom+allowance||y>h.top-allowance)return 0;return Math.max(0,Math.min(rawWidth(x,y-allowance),rawWidth(x,y+allowance))-allowance);}
export function roofY(x,z,offset=0){const h=hullAt(x);if(!h)return 0;let lo=Math.max(h.bottom,-24),hi=h.top;for(let i=0;i<35;i++){const m=(lo+hi)/2;if(rawWidth(x,m)>=Math.abs(z))lo=m;else hi=m;}return lo+offset;}
export function frontPoint(y,angle,side,offset=0){const centre=frontCentreAtLevel(y),radius=frontAtLevel(y)-centre;if(angle>Math.PI/2){const x=centre-radius*(angle-Math.PI/2);return [x,y,side*(rawWidth(x,y)+offset)];}const x=centre+radius*Math.cos(angle);return [Math.min(300-.85*offset,x+offset*Math.cos(angle)),y,side*(rawWidth(x,y)+offset*Math.sin(angle))];}
export function shellPoint(x,theta,s,offset=0){const h=hullAt(x),y=(h.top+h.bottom)/2+(h.top-h.bottom)/2*Math.sin(theta);return [x,y,s*(halfWidth(x,y)+offset)];}
