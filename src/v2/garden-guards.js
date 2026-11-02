
import {LOUNGE} from '../hydro-nip-lounge.js';
import {contains,bounds,rectangle} from '../plan/geometry-v2.js';
import {mergeBoxes,glass,metal} from './geometry.js';
export const galleryHoles=(r,o)=>(r.components.stairs||[]).filter(t=>t.center[1]<=o.center[1]+.02&&t.center[1]>o.center[1]-2.4).map(t=>rectangle(t.center[0],t.center[2],t.size[0]+.16,t.size[2]+.16));
export function buildGardenGuards(parent,r,layout){
 if(!r.components)return;
 const platforms=[...(r.components.galleries||[]),...(r.components.links||[]),...(r.components.landings||[])].map(p=>({...p,holes:galleryHoles(r,p)}));
 const stairs=(r.components.stairs||[]).map(t=>({...t,polygon:rectangle(t.center[0],t.center[2],t.size[0],t.size[2])}));
 const sourcePlatforms=[];if(r.id==='commons-1'){const at=(x,z)=>[r.x+x-132,r.z+r.side*(z-27)],poly=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>at(x,z)),m=LOUNGE.MAZE;for(const [i,y] of LOUNGE.LEVELS.entries())sourcePlatforms.push({y,polygon:poly(m.x0+.05,m.x1-.05,i?LOUNGE.SPLIT:m.z0,i?m.z1:LOUNGE.SPLIT)});for(const t of LOUNGE.TUBES)sourcePlatforms.push({y:t.level,polygon:poly(t.x-.875,t.x+.875,Math.min(t.from,t.to)-.1,Math.max(t.from,t.to)+.1)});}
 const panes=[],caps=[],add=(a,b,y)=>{const length=Math.hypot(a[0]-b[0],a[1]-b[1]);if(length<.04)return;const yaw=-Math.atan2(b[1]-a[1],b[0]-a[0]),at=[(a[0]+b[0])/2,y+.55,(a[1]+b[1])/2];panes.push([[length+.025,1.1,.07],at,yaw]);caps.push([[length+.025,.045,.07],[at[0],y+1.1,at[2]],yaw]);};
 const supported=(p,y,skip)=>sourcePlatforms.some(o=>Math.abs(o.y-y)<.13&&contains(o.polygon,p))||platforms.some(o=>o!==skip&&Math.abs(o.center[1]-y)<.42&&contains(o.polygon,p)&&!o.holes.some(h=>contains(h,p)))||stairs.some(t=>t.center[1]>=y-.42&&t.center[1]<=y+2.3&&contains(t.polygon,p))||layout.decks.some(d=>Math.abs(d.y-y)<.02&&contains(d.slab.outline,p)&&!d.slab.holes.some(h=>contains(h.polygon,p)));
 for(const o of platforms)for(const ring of [o.polygon,...o.holes])for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<1e-6)continue;const n=Math.ceil(length/.12),at=t=>[a[0]+dx*t,a[1]+dz*t];let start=null;
  for(let k=0;k<=n;k++){const t=(k+.5)/n,p=at(Math.min(1,t)),test=sign=>[p[0]+sign*dz/length*.09,p[1]-sign*dx/length*.09],own=p=>contains(o.polygon,p)&&!o.holes.some(h=>contains(h,p)),left=test(1),right=test(-1),outside=own(left)?right:left,needs=k<n&&own(left)!==own(right)&&!supported(outside,o.center[1],o);
   if(needs&&start===null)start=k/n;if(!needs&&start!==null){add(at(start),at(k/n),o.center[1]);start=null;}
  }
 }
 // Guard each flight side at that tread's own elevation, joining both galleries above cap height.
 for(const t of stairs)for(const side of [-1,1]){const x=t.center[0]+side*(t.size[0]/2+.035),z=t.center[2],half=t.size[2]/2+.02;add([x,z-half],[x,z+half],t.center[1]);}
 mergeBoxes(parent,'V2_garden_guard_glass',panes,glass);mergeBoxes(parent,'V2_garden_guard_cap',caps,metal);parent.userData.gardenGuardSegments=panes.length;
}
export function isGardenInternalGuard(row,layout){const [,axis,a,b,at,y]=row,p=axis?[at,(a+b)/2]:[(a+b)/2,at];return layout.rooms.some(r=>r.kind==='garden'&&y>=r.y-.02&&y<r.y+r.height&&contains(r.polygon,p));}
