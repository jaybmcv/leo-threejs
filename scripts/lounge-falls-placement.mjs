// Verify the built target against the unchanged galleries, dome, planter and stairs.
import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {POND,PATH,LANDING,FALL,BENCH,frameX,frameZ,fallZ,galleryEdge} from '../src/v2/lounge-falls-layout.js';

const room=layout.rooms.find(r=>r.id==='commons-1');
const edgeAt=(g,x,near)=>{const zs=[];for(let i=0;i<g.polygon.length;i++){const a=g.polygon[i],b=g.polygon[(i+1)%g.polygon.length];if(a[0]===b[0]||x<Math.min(a[0],b[0])||x>Math.max(a[0],b[0]))continue;zs.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}return near?Math.max(...zs):Math.min(...zs);};
const point=(x,y,z)=>new T.Vector3(x+frameX,y,frameZ-z);

export function assertWaterfallPlacement(feature){
 const lower=room.components.galleries.find(g=>g.id==='commons-1-rear-4'),upper=room.components.galleries.find(g=>g.id==='commons-1-rear-8');
 const foot=room.components.stairs[0],planterX=147.25+(foot.center[0]-room.x+132-151.8)+frameX,domeX=134+frameX,domeZ=frameZ-25,domeR=7.45;
 const cx=POND.x+frameX,cz=frameZ-POND.z;
 assert(Math.abs(cx-(domeX+domeR+planterX)/2)<.01,'Centre must bisect the dome-rim to planter gap');
 assert(Math.abs(FALL.lip-upper.center[1]+upper.size[1])<.001,'Water starts at Deck 19 underside');
 assert(FALL.x1-FALL.x0>=7.39&&FALL.x1-FALL.x0<=8.8,'Keep the sheet close to its original width');
 let domeClearance=Infinity,planterClearance=Infinity,lowerClearance=Infinity;
 for(let i=0;i<=360;i++){const t=i/360*Math.PI*2,c=Math.cos(t),s=Math.sin(t),x=cx+(POND.a+.45)*Math.sign(c)*Math.abs(c)**(2/POND.n),z=cz-(POND.b+.45)*Math.sign(s)*Math.abs(s)**(2/POND.n);
  domeClearance=Math.min(domeClearance,Math.hypot(x-domeX,z-domeZ)-domeR);planterClearance=Math.min(planterClearance,planterX-x);}
 assert(domeClearance>=1,'Walk around the pond on the dome side');assert(planterClearance>=.95,'Walk around the pond on the planter side');
 const samples=[];
 for(let i=0;i<=64;i++){const x=FALL.x0+(FALL.x1-FALL.x0)*i/64;
  for(let j=0;j<=40;j++){const t=j/40;samples.push(point(x,FALL.lip-t*(FALL.lip-24.57),fallZ(x)-FALL.reach*t**3));}}
 if(feature){const sheet=feature.group.getObjectByName('Lounge_falls_sheet');assert(sheet,'Falling water must be present');feature.group.updateMatrixWorld(true);samples.length=0;const p=sheet.geometry.attributes.position;for(let i=0;i<p.count;i++)samples.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(sheet.matrixWorld));
  assert(feature.centre.distanceTo(point(POND.x,24.3,POND.z))<.001,'Pond centre follows the target');assert(feature.bench.distanceTo(point(BENCH.x,LANDING.top,BENCH.z))<.001,'Bench follows the pond');
  for(const [key,x]of [['a',FALL.x0],['b',FALL.x1]])assert(feature.soundLine[key].distanceTo(point(x,24.3,fallZ(x)))<.001,'Sound follows the sheet');
  const box=new T.Box3().setFromObject(feature.solid);assert(box.min.x>-104.1,'No pond collision left at the old location');
 }
 let top=0,bottom=0;
 for(const p of samples){const t=(FALL.lip-p.y)/(FALL.lip-24.57),edge=galleryEdge(p.x);
  if(t<.01)assert(p.z<edge-.10,'Water starts on the pond side of Deck 19');
  assert(p.z>edgeAt(lower,p.x,true)+.3,'Water clears the Deck 18 rail');
  assert(!room.components.stairs.some(s=>Math.abs(p.x-s.center[0])<s.size[0]/2+.35&&Math.abs(p.z-s.center[2])<s.size[2]/2+.35),'Water clears stairs');
  if(Math.abs(p.y-FALL.lip)<.001){top++;assert(Math.abs(p.z-(edge-.12))<.002,'Lip follows the actual gallery edge');}
  if(Math.abs(p.y-24.57)<.001){bottom++;assert((Math.abs(p.x-cx)/POND.a)**POND.n+(Math.abs(p.z-cz)/POND.b)**POND.n<1,'Entire sheet lands in the pond');}
  assert(t>-.001&&t<1.001,'Full-height sheet ends at pond level');
  lowerClearance=Math.min(lowerClearance,p.z-edgeAt(lower,p.x,true));
 }
 assert(top>1&&bottom>1,'Sheet reaches both gallery and water');
 assert(PATH.top-24.3<=.4&&PATH.z0>PATH.step&&PATH.x1-PATH.x0>1.5,'Bridge has a walkable step and width');
 assert(PATH.z1>LANDING.z0&&LANDING.z1>BENCH.z,'Bridge joins the landing and bench');
 assert(cx-POND.a-.45>-108,'Old pond site is empty');
 return {centre:[cx,24.3,cz],height:FALL.lip-24.57,width:FALL.x1-FALL.x0,domeClearance,planterClearance,lowerClearance,bridge:[point(POND.x,PATH.top,PATH.step).toArray(),point(POND.x,PATH.top,LANDING.z1).toArray()]};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/lounge-falls-placement.mjs'))console.log(JSON.stringify(assertWaterfallPlacement(),null,2));
