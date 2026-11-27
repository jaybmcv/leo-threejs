
import {LOUNGE,mazePoint} from '../hydro-nip-lounge.js';
import * as T from 'three';
import {contains,bounds,rectangle} from '../plan/geometry-v2.js';
import {LOUNGE_MURAL_X,LOUNGE_UPPER_CONNECTOR} from '../plan/lounge-layout-v2.js';
import {mergeBoxes,glass,metal} from './geometry.js';
import {CLUBHOUSE_SHAFT} from './vault-lift-fit.js';
export const galleryHoles=(r,o)=>(r.components.stairs||[]).filter(t=>t.center[1]<=o.center[1]+.02&&t.center[1]>o.center[1]-2.4).map(t=>{
 // Keep the gallery flush with the final tread; padding belongs behind the arrival.
 const arrival=r.id==='commons-1'&&Math.abs(t.center[1]-o.center[1])<.02,dir=t.id.includes('-tread-0-')?-1:1;
 return rectangle(t.center[0],t.center[2]-(arrival?dir*.04:0),t.size[0]+.16,t.size[2]+(arrival?.08:.16));
});
export function buildGardenGuards(parent,r,layout){
 if(!r.components)return;
 const connector=r.components.galleries?.find(g=>g.id===LOUNGE_UPPER_CONNECTOR);
 const platforms=[...(r.components.galleries||[]),...(r.components.links||[]),...(r.components.landings||[])].filter(p=>p!==connector).map(p=>({...p,holes:galleryHoles(r,p)}));
 const stairs=(r.components.stairs||[]).map(t=>({...t,polygon:rectangle(t.center[0],t.center[2],t.size[0],t.size[2])}));
 const sourcePlatforms=[];if(r.id==='commons-1'){const at=(x,z)=>[r.x+x-132,r.z+r.side*(z-27)],poly=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>{const p=mazePoint([x,0,z]);return at(p[0],p[2]);}),m=LOUNGE.MAZE;for(const [i,y] of LOUNGE.LEVELS.entries())sourcePlatforms.push({y,polygon:poly(m.x0+.05,m.x1-.05,i?LOUNGE.SPLIT:m.z0,i?m.z1:LOUNGE.SPLIT)});for(const t of LOUNGE.TUBES)sourcePlatforms.push({y:t.level,polygon:[[Math.min(t.from,t.to)-.12,t.z-.875],[Math.max(t.from,t.to)+.12,t.z-.875],[Math.max(t.from,t.to)+.12,t.z+.875],[Math.min(t.from,t.to)-.12,t.z+.875]].map(([x,z])=>at(x,z))});}
 const panes=[],caps=[],feet=[],add=(a,b,y)=>{const length=Math.hypot(a[0]-b[0],a[1]-b[1]);if(length<.04)return;const yaw=-Math.atan2(b[1]-a[1],b[0]-a[0]),at=[(a[0]+b[0])/2,y+.55,(a[1]+b[1])/2];panes.push([[length+.025,1.1,.07],at,yaw]);caps.push([[length+.025,.045,.07],[at[0],y+1.1,at[2]],yaw]);if(r.id==='commons-1')feet.push([[length+.025,.04,.075],[at[0],y+.04,at[2]],yaw]);};
 const supported=(p,y,skip)=>sourcePlatforms.some(o=>Math.abs(o.y-y)<.13&&contains(o.polygon,p))||platforms.some(o=>o!==skip&&Math.abs(o.center[1]-y)<.42&&contains(o.polygon,p)&&!o.holes.some(h=>contains(h,p)))||stairs.some(t=>t.center[1]>=y-.42&&t.center[1]<=y+2.3&&contains(t.polygon,p))||layout.decks.some(d=>Math.abs(d.y-y)<.02&&contains(d.slab.outline,p)&&!d.slab.holes.some(h=>contains(h.polygon,p)));
 for(const o of platforms)for(const ring of [o.polygon,...o.holes])for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<1e-6)continue;
  // The mural and its backing wall close the wall edge and the short return behind it.
  if(o.id==='commons-1-end-8'&&ring===o.polygon&&(dx===0&&a[0]===LOUNGE_MURAL_X||dz===0&&Math.max(a[0],b[0])<=LOUNGE_MURAL_X))continue;
  const n=Math.ceil(length/.12),at=t=>[a[0]+dx*t,a[1]+dz*t];let start=null;
  const {edge,z,doorWidth}=CLUBHOUSE_SHAFT;
  const liftEdge=ring===o.polygon&&/^commons-1-end-[48]$/.test(o.id)&&dx===0&&Math.abs(a[0]-edge)<.001;
  // Cut the two joins at the floor vertices, between the usual guard samples.
  const join=ring===o.polygon&&connector?.joins[o.id],opening=join&&(join.axis===0?dx>0:dx===0&&a[0]===join.line)?
   join.range.map(q=>(q-a[join.axis])/(b[join.axis]-a[join.axis])).sort((a,b)=>a-b):
   liftEdge?[z-doorWidth/2,z+doorWidth/2].map(q=>(q-a[1])/dz).sort((a,b)=>a-b):null;
  for(let k=0;k<=n;k++){const t=(k+.5)/n,p=at(Math.min(1,t)),test=sign=>[p[0]+sign*dz/length*.09,p[1]-sign*dx/length*.09],own=p=>contains(o.polygon,p)&&!o.holes.some(h=>contains(h,p)),left=test(1),right=test(-1),outside=own(left)?right:left,needs=k<n&&own(left)!==own(right)&&!supported(outside,o.center[1],o);
   if(needs&&start===null)start=k/n;if(!needs&&start!==null){
    if(!opening)add(at(start),at(k/n),o.center[1]);
    else{const [lo,hi]=opening;if(start<lo)add(at(start),at(Math.min(k/n,lo)),o.center[1]);if(k/n>hi)add(at(Math.max(start,hi)),at(k/n),o.center[1]);}
    start=null;
   }
  }
 }
 if(connector)for(const run of connector.guardRuns)for(let i=1;i<run.length;i++)add(run[i-1],run[i],connector.center[1]);
 // Guard each flight side at that tread's own elevation, joining both galleries above cap height.
 for(const t of stairs)for(const side of [-1,1]){const x=t.center[0]+side*(t.size[0]/2+.035),z=t.center[2],half=t.size[2]/2+.02;add([x,z-half],[x,z+half],t.center[1]);}
 const orange=new T.MeshBasicMaterial({name:'Lounge_rail_glow',color:0xff6b20,toneMapped:false});mergeBoxes(parent,'V2_garden_guard_glass',panes,glass);mergeBoxes(parent,'V2_garden_guard_cap',caps,r.id==='commons-1'?orange:metal);const foot=mergeBoxes(parent,'Lounge_rail_glow',feet,orange);if(foot)foot.userData.noCollide=true;parent.userData.gardenGuardSegments=panes.length;
}
export function isGardenInternalGuard(row,layout){const [,axis,a,b,at,y]=row,p=axis?[at,(a+b)/2]:[(a+b)/2,at];return layout.rooms.some(r=>r.kind==='garden'&&y>=r.y-.02&&y<r.y+r.height&&contains(r.polygon,p));}
