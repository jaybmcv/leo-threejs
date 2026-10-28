
import {contains} from '../plan/geometry-v2.js';
// Go-to links choose actual interior floors, never the exterior hull or the top of a glass guard.
export function plannedStanding(layout,x,y,z,radius=.35){
 if(x<-170||y>layout.decks.at(-1).y+3.5)return true; // Retained aft/fin/crown use their original detailed circulation.
 const inside=p=>contains(p,[x,z]),near=h=>Math.abs(y-h)<.13;
 for(const p of layout.hullPrototypes?.prototypes||[])if(near(p.chart.origin[1])&&inside(p.polygon)&&!p.floorHoles?.some(h=>inside(h.polygon)))return true;
 for(const c of layout.cabins)if(near(c.y)&&inside(c.polygon))return true;
 for(const r of layout.rooms){if(r.aggregate)continue;if(near(r.y)&&inside(r.polygon))return true;
  for(const o of [...(r.components?.galleries||[]),...(r.components?.links||[]),...(r.components?.landings||[])])if(near(o.center[1])&&inside(o.polygon))return true;
  for(const o of r.components?.stairs||[])if(near(o.center[1])&&Math.abs(x-o.center[0])<=o.size[0]/2&&Math.abs(z-o.center[2])<=o.size[2]/2)return true;
 }
 for(const r of layout.circulation.ramps){const a=r.points[0],height=a[1]+(x-a[0])/r.run*r.rise;if(inside(r.polygon)&&near(height))return true;}
 for(const d of layout.decks)if(near(d.y)){
  if([...layout.circulation.bridges,...layout.circulation.towers].some(p=>p.deck===d.number&&inside(p.polygon)))return true;
  if([[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([dx,dz])=>contains(d.slab.outline,[x+dx,z+dz])&&!d.slab.holes.some(h=>contains(h.polygon,[x+dx,z+dz]))))return true;
 }
 // Fixed forward/aft stairs are intentionally between two deck levels.
 return layout.circulation.stairs.some(s=>s.wing===undefined&&inside(s.polygon)&&y>=layout.decks[s.deck-1].y-.02&&y<=layout.decks[s.deck-1].y+4.05);
}
