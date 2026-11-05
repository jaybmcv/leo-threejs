// The colliders the rail planner asks, wrapped so the reach of every question is kept: 0.5 m cells, as [i, j, k] each
// (walk-plan.json railProbes). A change whose triangles keep out of all of them can't move a rail or a void guard
// (scripts/fast-dressing-v2.mjs). Raycasts reach from near to far along the ray; overlaps the segment plus the radius.
export const RAIL_PROBE_CELL=.5;
export function recordQueries(col,cells){
 const box=(ax,ay,az,bx,by,bz,r=0)=>{const c=RAIL_PROBE_CELL,lo=[ax,ay,az].map((v,i)=>Math.floor((Math.min(v,[bx,by,bz][i])-r)/c)),hi=[ax,ay,az].map((v,i)=>Math.floor((Math.max(v,[bx,by,bz][i])+r)/c));
  // A question this far-reaching would cover the ship; the lane then declines every feature.
  if(hi.some((v,i)=>v-lo[i]>100)){cells.unbounded=true;return;}
  for(let i=lo[0];i<=hi[0];i++)for(let j=lo[1];j<=hi[1];j++)for(let k=lo[2];k<=hi[2];k++)cells.add(i+','+j+','+k);};
 const ray=f=>(r,far=1e4,near=0)=>{const o=r.origin,d=r.direction;box(o.x+d.x*near,o.y+d.y*near,o.z+d.z*near,o.x+d.x*far,o.y+d.y*far,o.z+d.z*far);return f.call(col,r,far,near);};
 const out=Object.create(col);out.raycast=ray(col.raycast);if(col.raycastGround)out.raycastGround=ray(col.raycastGround);
 out.overlaps=(s,r)=>{box(s.start.x,s.start.y,s.start.z,s.end.x,s.end.y,s.end.z,r);return col.overlaps(s,r);};
 return out;
}
export const railProbeList=cells=>cells.unbounded?{cell:RAIL_PROBE_CELL,unbounded:true}:{cell:RAIL_PROBE_CELL,cells:[...cells].flatMap(k=>k.split(',').map(Number))};
