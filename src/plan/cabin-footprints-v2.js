
import {bounds,overlaps,rectangle,contains,distanceToSegment} from './geometry-v2.js';
import {wingFlight} from './structure-v2.js';
// Clear finished cabin faces are the footprint, not the shared 12 cm party-wall construction.
export function cabinFootprintIssues(layout){
 const issues=[],buckets=new Map(),put=o=>{const b=bounds(o.polygon);o={...o,b};for(let x=Math.floor(b.x0/8);x<=Math.floor(b.x1/8);x++)for(let z=Math.floor(b.z0/8);z<=Math.floor(b.z1/8);z++){const k=o.deck+','+x+','+z;(buckets.get(k)||buckets.set(k,[]).get(k)).push(o);}},near=c=>{const b=bounds(c.polygon),out=new Set();for(let x=Math.floor(b.x0/8);x<=Math.floor(b.x1/8);x++)for(let z=Math.floor(b.z0/8);z<=Math.floor(b.z1/8);z++)for(const o of buckets.get(c.deck+','+x+','+z)||[])out.add(o);return [...out];};
 for(const c of layout.circulation.corridors)for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],length=Math.hypot(a[0]-b[0],a[1]-b[1]);if(length>1e-6)put({id:c.id,deck:c.deck,kind:'corridor',polygon:rectangle((a[0]+b[0])/2,(a[1]+b[1])/2,length,c.width,-Math.atan2(b[1]-a[1],b[0]-a[0]))});}
 for(const s of layout.circulation.stairs){put({...s,kind:'stair'});if(s.wing!==undefined&&s.deck<15){const f=wingFlight(s,layout.circulation.stairs);put({id:s.id+'-physical-return',deck:s.deck+1,kind:'stair',polygon:f.portal});}}
 for(const c of layout.cabins){
  for(const o of near(c))if(overlaps(c.polygon,o.polygon))issues.push({cabin:c.id,kind:o.kind,other:o.id});
  put({...c,kind:'cabin'});
  const p=[c.door.center[0],c.door.center[2]],local=[Math.cos(c.yaw)*(p[0]-c.x)-Math.sin(c.yaw)*(p[1]-c.z),Math.sin(c.yaw)*(p[0]-c.x)+Math.cos(c.yaw)*(p[1]-c.z)];
  if(Math.abs(local[0])>1e-5||Math.abs(Math.abs(local[1])-3.7)>1e-5)issues.push({cabin:c.id,kind:'door transform',local});
  if(!layout.circulation.doorLandings.some(l=>l.owner===c.id&&distanceToSegment(p,l.points[0],l.points[1])<.01))issues.push({cabin:c.id,kind:'missing corridor threshold'});
 }
 return issues;
}
export function requireCabinFootprints(layout){const issues=cabinFootprintIssues(layout);if(issues.length)throw Error('V2 cabin footprint overlaps or invalid entry: '+JSON.stringify(issues.slice(0,15))+' ('+issues.length+' total)');return {cabins:layout.cabins.length,overlaps:0,doorTransforms:layout.cabins.length,corridorThresholds:layout.cabins.length};}
