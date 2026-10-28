import * as T from 'three';
import {BODY} from '../src/walk/collision.js';
import {LOUNGE} from '../src/hydro-nip-lounge.js';
import {loadWalkShip,fitForWalking} from './walk-plan.mjs';

// The Hydro-Nip Lounge on foot (HYDRO_NIP_LOUNGE.md, phases 2-3), as check-walk's 2 m walker in the walk's own world.
// From the commons entrance: the maze's platforms, both tubes and the galleries they land on, the dome and every
// hammock. Then from just inside the maze's door, kept inside the tower: the maze alone leads up to both platforms.
// `npm run check:lounge`, a couple of minutes.
const t0=Date.now(),log=(...a)=>console.log(((Date.now()-t0)/1000).toFixed(0)+'s',...a);
const ship=await loadWalkShip();
const {colliders:col,prepared}=fitForWalking(ship);
log('world built');
// The lounge is built in the commons template's frame; Neighborhood 1 moves it 224 m aft and mirrors it across the
// centreline (model.js createGardenCommons).
const W=([x,y,z])=>[x-224,y,-z];
const {FLOOR,LEVELS,DOME,MAZE,SPLIT,TUBES}=LOUNGE;
// The world is prepared as the page prepares it (scripts/walk-plan.mjs): the lounge's sliding doors are solid and open
// for a walker near them (lounge.js), so open them all, as walkers standing all over the lounge would.
{const near=[];for(let x=100;x<=170;x++)for(let z=0;z<=60;z++)for(const y of [FLOOR,...LEVELS])near.push(new T.Vector3(...W([x,y,z])));
 prepared.lounge.update(10,near,new T.Vector3(0,-999,0));}

const {radius:R,height:H,step:STEP}=BODY,G=.25,MIN_NY=Math.cos(BODY.maxSlope*Math.PI/180);
const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3(new T.Vector3(),new T.Vector3());
const FEET=[[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]];
const probe=(x,y,z,up,down)=>{ray.origin.set(x,y+up,z);ray.direction.set(0,-1,0);const h=col.raycast(ray,down);return h&&h.normal.y>=MIN_NY?h.point.y:null;};
const floorAt=(x,y,z,up=STEP+.05,down=2*STEP+.1)=>{const c=probe(x,y,z,up,down);if(c!==null&&Math.abs(c-y)<=STEP)return c;let best=c;for(const [dx,dz] of FEET.slice(1)){const h=probe(x+dx,y,z+dz,up,down);if(h!==null&&(best===null||h>best))best=h;}return best;};
const stands=(x,y,z)=>{seg.start.set(x,y+STEP+R,z);seg.end.set(x,y+H-R,z);return !col.overlaps(seg,R);};
const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

// Flood from `from` (template frame) over every position the walker reaches inside `box` (world), stepping and
// dropping as check-walk does (no jumps).
function flood(from,box){
 const [sx,sy,sz]=W(from),y0=floorAt(sx,sy,sz,1,3);if(y0===null)throw new Error(`no floor at ${from}`);
 const seen=new Set(),X=[],Y=[],Z=[],key=(x,y,z)=>`${Math.round(x/G)},${Math.round(z/G)},${Math.round(y*2)}`;
 const push=(x,y,z)=>{const k=key(x,y,z);if(seen.has(k))return;seen.add(k);X.push(x);Y.push(y);Z.push(z);};
 push(sx,y0,sz);
 for(let i=0;i<X.length;i++)for(const [dx,dz] of DIRS){
  const nx=X[i]+dx*G,nz=Z[i]+dz*G;if(!box.containsPoint(new T.Vector3(nx,Y[i],nz)))continue;
  let fy=floorAt(nx,Y[i],nz);
  if(fy===null&&!dx!==!dz&&stands(nx,Y[i],nz)){ray.origin.set(nx,Y[i]+STEP,nz);const h=col.raycast(ray,20);fy=h&&h.normal.y>=MIN_NY?h.point.y:null;}
  if(fy===null||fy-Y[i]>STEP||!stands(nx,fy,nz))continue;
  push(nx,fy,nz);
 }
 const reached=([x,y,z],r=.5)=>{const [wx,wy,wz]=W([x,y,z]);for(let i=0;i<X.length;i++)if(Math.abs(Y[i]-wy)<.35&&Math.hypot(X[i]-wx,Z[i]-wz)<=r)return true;return false;};
 return {count:X.length,reached};
}
const worldBox=(a,b)=>{const p=W(a),q=W(b);return new T.Box3(new T.Vector3(Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.min(p[2],q[2])),new T.Vector3(Math.max(p[0],q[0]),Math.max(p[1],q[1]),Math.max(p[2],q[2])));};

const problems=[],results={};
const expect=(name,ok)=>{results[name]=ok;if(!ok)problems.push(name);};
// 1. From the entrance, over the whole commons.
const room=flood([132,FLOOR,9.6],worldBox([108,FLOOR-1,6],[156,LEVELS[1]+3,48]));
log('commons flood:',room.count,'positions');
const mid=t=>(t.from+t.to)/2;
expect('maze lower platform',room.reached([119.4,LEVELS[0],22.5]));
expect('maze upper platform',room.reached([117.5,LEVELS[1],30]));
expect('front tube',room.reached([TUBES[0].x,TUBES[0].level,mid(TUBES[0])]));
expect('front gallery past the tube',room.reached([TUBES[0].x,TUBES[0].level,10]));
expect('rear tube',room.reached([TUBES[1].x,TUBES[1].level,mid(TUBES[1])]));
expect('rear gallery past the tube',room.reached([TUBES[1].x,TUBES[1].level,44]));
expect('dome middle',room.reached([DOME.x,FLOOR,DOME.z]));
// 2. From just inside the maze's door, kept inside the tower: the maze leads up to both platforms and both tubes.
const cx=(MAZE.x0+MAZE.x1)/2,maze=flood([cx,FLOOR,MAZE.z0+.6],worldBox([MAZE.x0,FLOOR-1,MAZE.z0+.1],[MAZE.x1,MAZE.top,MAZE.z1-.1]));
log('maze flood:',maze.count,'positions');
expect('maze: way through the ground floor',maze.reached([115,FLOOR,32.2]));
expect('maze: lower platform from inside',maze.reached([119.4,LEVELS[0],20]));
expect('maze: upper platform from inside',maze.reached([TUBES[1].x,LEVELS[1],MAZE.z1-.6]));
// 3. Every hammock can be lain in: a spot on its cloth, with somewhere to stand within reach.
// The rest spots the page uses: found before the lounge takes the hammocks into its swinging mesh (prepare.js).
const spots=prepared.seats.filter(s=>s.hammock);
const standsNear=s=>{for(let a=0;a<16;a++)for(const r of [.9,1.2,1.45]){const x=s.point.x+Math.cos(a/16*Math.PI*2)*r,z=s.point.z+Math.sin(a/16*Math.PI*2)*r,fy=floorAt(x,FLOOR,z,.5,1);
 if(fy!==null&&Math.abs(fy-FLOOR)<.05&&stands(x,fy,z)&&room.reached([x+224,fy,-z],.3))return true;}return false;};
const usable=spots.filter(standsNear).length;
expect(`hammocks: 9 found (${spots.length})`,spots.length===9);
expect(`hammocks: all usable (${usable}/${spots.length})`,usable===spots.length&&spots.length>0);
// 4. The waterfall pond (src/walk/lounge-falls.js, from tester feedback): the causeway leads through the falls to the
// landing, whose bench seats three facing the falls; the water off the causeway is out of reach; and the floor either
// side of the pond, by the tasting deck and by the stair, stays open.
const STONE=FLOOR+.36,falls=prepared.loungeFalls;
expect('falls: built',!!falls);
expect('falls: causeway mid-pond',room.reached([137,STONE,38]));
expect('falls: landing behind the falls',room.reached([137,STONE,44.6]));
const wet=[[133,38],[141,38],[134.5,36],[139.5,41],[132,40]].filter(([x,z])=>room.reached([x,FLOOR+.11,z],.45));
expect(`falls: water off the causeway out of reach (${wet.length} wet spots reached)`,wet.length===0);
expect('falls: floor between the tasting deck and the pond',room.reached([129,FLOOR,40]));
expect('falls: floor between the pond and the stair',room.reached([145.5,FLOOR,40]));
const bench=falls?prepared.seats.filter(s=>s.point.distanceTo(falls.bench)<1.6):[];
expect(`falls: bench seats (${bench.length})`,bench.length>=3);
expect('falls: bench faces the falls',bench.length>0&&bench.every(s=>s.facing&&s.facing.z>.9));
const report={status:problems.length?'FAIL':'PASS',results,problems,hammockHeights:spots.map(s=>+s.height.toFixed(2))};
console.log(JSON.stringify(report,null,1));
log(report.status);if(problems.length)process.exitCode=1;
