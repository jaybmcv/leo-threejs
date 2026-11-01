import {HANGAR_MAINTENANCE_PLATFORMS} from '../plan/launch-b-v2.js';
import{ATRIUM_LAKE_BRIDGE}from'../plan/atrium-v2.js';
import {ARENA_ID,STAGE} from '../mudwater-arena.js';
import {toLocal} from '../plan/rooms.js';

import {contains} from '../plan/geometry-v2.js';
import {forumTerraces} from './launch-e-fitout.js';
const FORUM_TERRACES=forumTerraces();
// Go-to links choose actual interior floors, never the exterior hull or the top of a glass guard.
export function plannedStanding(layout,x,y,z,radius=.35){
 if(x<-170||y>layout.decks.at(-1).y+3.5)return true; // Retained aft/fin/crown use their original detailed circulation.
 const inside=p=>contains(p,[x,z]),near=h=>Math.abs(y-h)<.13;
 // Stream E's shallow Forum terraces and stage are planned floors too.
 const forum=layout.rooms.find(r=>r.id==='d16-voyage-forum-bow');
 if(forum){
  // As for room floors below, this is plan membership; gotoFloor checks all nine footprint samples against actual collision.
  if(FORUM_TERRACES.some(t=>near(forum.y+t.rise)&&inside(t.polygon)))return true;
  if(near(forum.y+.24)&&x>=155+radius&&x<=161-radius&&Math.abs(z)<=10-radius)return true;
 }
 for(const p of HANGAR_MAINTENANCE_PLATFORMS)if(near(p.y)&&[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([dx,dz])=>contains(p.polygon,[x+dx,z+dz])))return true;
 const b=ATRIUM_LAKE_BRIDGE;if(near(layout.decks[b.deck-1].y+b.rise)&&x>=b.bounds[0]+radius&&x<=b.bounds[1]-radius&&z>=b.bounds[2]+radius&&z<=b.bounds[3]-radius)return true;
 // Main's existing low stage/board and its two end steps are real interior floors. Keep the same height tolerance and a whole-capsule footprint.
 if(layout.rooms.some(r=>r.id===ARENA_ID)){const p=toLocal(ARENA_ID,[x,y,z]),onStage=p[0]>=STAGE.x0+radius&&p[0]<=STAGE.x1-radius&&Math.abs(p[2])<=STAGE.z-radius&&Math.abs(p[1]-STAGE.h)<.13,onStep=[STAGE.x0-.5,STAGE.x1+.5].some(cx=>Math.abs(p[0]-cx)<=.5-radius&&Math.abs(p[2])<=3-radius)&&Math.abs(p[1]-.22)<.13;if(onStage||onStep)return true;}
 for(const p of layout.hullPrototypes?.prototypes||[])if(near(p.chart.origin[1])&&inside(p.polygon)&&!p.floorHoles?.some(h=>inside(h.polygon)))return true;
 for(const c of layout.cabins)if(near(c.y)&&inside(c.polygon))return true;
 for(const r of layout.rooms){if(r.aggregate)continue;if(near(r.y)&&inside(r.polygon))return true;
  for(const o of [...(r.components?.galleries||[]),...(r.components?.links||[]),...(r.components?.landings||[])])if(near(o.center[1])&&inside(o.polygon))return true;
  for(const o of r.components?.stairs||[])if(near(o.center[1])&&Math.abs(x-o.center[0])<=o.size[0]/2&&Math.abs(z-o.center[2])<=o.size[2]/2)return true;
 }
 for(const r of layout.circulation.ramps){const a=r.points[0],height=a[1]+(x-a[0])/r.run*r.rise;if(inside(r.polygon)&&near(height))return true;}
 for(const d of layout.decks)if(near(d.y)){
  if((layout.circulation.balconies||[]).some(b=>b.deck===d.number&&[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([dx,dz])=>contains(b.polygon,[x+dx,z+dz]))))return true;
  if([...layout.circulation.bridges,...layout.circulation.towers].some(p=>p.deck===d.number&&inside(p.polygon)))return true;
  if([[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([dx,dz])=>contains(d.slab.outline,[x+dx,z+dz])&&!d.slab.holes.some(h=>contains(h.polygon,[x+dx,z+dz]))))return true;
 }
 // Fixed forward/aft stairs are intentionally between two deck levels.
 return layout.circulation.stairs.some(s=>s.wing===undefined&&inside(s.polygon)&&y>=layout.decks[s.deck-1].y-.02&&y<=layout.decks[s.deck-1].y+4.05);
}
