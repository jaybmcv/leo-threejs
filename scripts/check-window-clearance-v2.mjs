import assert from 'node:assert/strict';
import layout from '../src/plan/selected-layout.js';
import {createWindowClearance,GLASS_CLEARANCE} from '../src/plan/skin-clearance-v2.js';
import {loungeWalkwayWallGeometry} from '../src/v2/lounge-walkway-wall.js';

// The window clearance keeps 1.05 m clear of the glass itself (src/plan/skin-clearance-v2.js nearGlass, Jay 2026-11-24).
// A flat window of glass at depth 5 (clearance toward greater depth, wall build-up toward less), plus one tiny sliver
// face lying almost along the depth axis, like the ones in commons-1's garden skin near the floor.
const glass=[[[-2,0,5,0,0,1],[2,0,5,0,0,1],[2,3.5,5,0,0,1]],[[-2,0,5,0,0,1],[2,3.5,5,0,0,1],[-2,3.5,5,0,0,1]]];
const sliver=[[-.01,1.5,5,0,1,0],[.01,1.5,5,0,1,0],[.01,1.5001,4.98,0,1,0]];
const proto=faces=>({id:'fixture',kind:'room',ownerId:'fixture',wallBuildUp:.2,chart:{origin:[0,0,0],u:[1,0,0],v:[0,0,1]},window:{rect:[-1.1,1.1,.8,2.1]},surface:faces});
const check=faces=>{const c=createWindowClearance({hullPrototypes:{prototypes:[proto(faces)]}});return tri=>c.intersections(tri,c.windows[0]);};
// An upright wall triangle across the window at a given depth (world = chart here: origin 0, u = x, v = z).
const wall=depth=>[[-.5,1,depth],[.5,1,depth],[0,2,depth]];
const withGlass=check(glass),withSliver=check([...glass,sliver]);
assert(withGlass(wall(5.5)),'0.5 m inside the glass is blocked');
assert(withGlass(wall(4.9)),'Inside the wall build-up behind the glass is blocked');
assert(withSliver(wall(5.5)),'Still blocked with the sliver face present');
assert.equal(withGlass(wall(6.3)),null,'1.3 m from the glass is clear');
assert.equal(withSliver(wall(6.3)),null,'The sliver face does not reach 1.3 m');
assert.equal(withSliver(wall(10)),null,'The sliver face no longer sweeps a sheet 5 m into the room');
// Near the reach: just inside it blocks, well past it does not.
assert(withGlass(wall(5+GLASS_CLEARANCE-.02)),'Just inside 1.05 m is blocked');
assert.equal(withGlass(wall(5+GLASS_CLEARANCE+.15)),null,'Past 1.05 m plus the sampling step is clear');
console.log('PASS window clearance fixture: glass and build-up blocked, sliver faces no longer reach into the room');

// The real case: report #427's Deck 17 wall stands 5.6 m or more from commons-1's garden glass.
{const c=createWindowClearance(layout),r=layout.rooms.find(r=>r.id==='commons-1'),g=loungeWalkwayWallGeometry(r),p=g.attributes.position,windows=c.windows.filter(w=>w.p.id==='commons-1');
 let hits=0;for(let i=0;i<p.count;i+=3){const tri=[0,1,2].map(k=>[p.getX(i+k),p.getY(i+k),p.getZ(i+k)]);for(const w of windows)if(c.intersections(tri,w))hits++;}
 assert.equal(hits,0,'The #427 lounge wall is clear of the garden glass');console.log('PASS #427 lounge wall clear of commons-1 garden glass,',windows.length,'window(s),',p.count/3,'wall triangles');}
