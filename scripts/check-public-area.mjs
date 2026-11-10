// Public areas (src/walk/public-area.js): where the walk may put a visitor down without their walking in, as used when
// a visitor comes back after a reload (src/walk/last-spot.js). Rules only, no ship build: the module and the Go to list
// are bundled against the selected layout, the landing search runs on a stand-in floor.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {buildLiveV2} from './build-live-v2.mjs';
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};

const area=await import((await buildLiveV2({entry:'src/walk/public-area.js',outfile:'output/launch-h/public-area-v2.mjs'})).href);
const way=await import((await buildLiveV2({entry:'src/v2/wayfinding.js',outfile:'output/launch-h/wayfinding-v2.mjs'})).href);
const probe=await import((await buildLiveV2({entry:'scripts/fixtures/public-area-probe.js',outfile:'output/launch-h/public-area-probe-v2.mjs'})).href);
const {restrictedAt,publicStand,ZONES}=area,{layout,VAULT_PLAN,VAULT_LIFT,LIFTS,MAZE_ROOM,MAZE_START,MAZE_BUTTON,PANEL,SWIM,toWorld,swimWorld}=probe;

// Every Go to place is public: Go to already leaves out the crew gallery and closed rooms, and stops outside the
// clubhouse door, the lever panel and the maze.
const places=way.V2_PLACES,closed=places.filter(p=>restrictedAt(p.at));
assert.deepEqual(closed.map(p=>[p.id,restrictedAt(p.at)]),[]);assert(places.length>500);
pass(`all ${places.length} Go to places are public`);
assert.equal(restrictedAt(toWorld('d02-arrival-1',[-20,0,0])),null);pass('the arrival hall is public');

// Areas from the layout: the crew service gallery's bridges and the closed crew rooms, on their own decks only.
const deckY=n=>layout.decks.find(d=>d.number===n).y,centre=poly=>[poly.reduce((s,p)=>s+p[0],0)/poly.length,poly.reduce((s,p)=>s+p[1],0)/poly.length];
const crewBridges=layout.circulation.bridges.filter(b=>b.access==='crew'),crewRooms=[...layout.rooms,...(layout.fixedRooms||[])].filter(r=>!r.aggregate&&(r.closed||r.access==='crew'));
assert(crewBridges.length>0&&crewRooms.length>0);
for(const b of crewBridges){const [x,z]=centre(b.polygon);assert.equal(restrictedAt([x,deckY(b.deck),z]),'crew',b.id);assert.equal(restrictedAt([x,deckY(b.deck)-4,z]),null,b.id+' deck below');}
for(const r of crewRooms){const [x,z]=centre(r.polygon);assert.equal(restrictedAt([x,r.y,z]),'crew',r.id);}
assert.equal(ZONES.filter(z=>z.name==='crew').length,crewBridges.length+crewRooms.length);
pass(`crew only: ${crewBridges.length} gallery bridges and ${crewRooms.length} closed rooms, read from the layout`);

// The password clubhouse, its vault door's room and its tube lift on every stop.
const [l0,l1]=VAULT_PLAN.lines,clubFloor=deckY(VAULT_PLAN.deck);
assert.equal(restrictedAt([(l0[0].x+l1[1].x)/2,clubFloor,(l0[0].z+l1[1].z)/2]),'clubhouse');
const lift=probe.vaultLiftWorld;for(const s of VAULT_LIFT.stops)assert.equal(restrictedAt([lift[0],s.y,lift[2]]),'clubhouse','tube at deck '+s.deck);
assert.equal(restrictedAt([lift[0],VAULT_LIFT.stops[1].y,lift[2]+2.5]),'clubhouse','upper landing');
pass('the password clubhouse, and its tube lift and landings on decks '+VAULT_LIFT.stops.map(s=>s.deck).join(', '));

// Deck 4's tank bay behind the lever panel, and its doorway; the corridor in front is public.
assert.equal(restrictedAt([PANEL.inside-2,PANEL.floor,0]),'lever-panel');assert.equal(restrictedAt([(PANEL.door.x0+PANEL.door.x1)/2,PANEL.floor,0]),'lever-panel');
assert.equal(restrictedAt([PANEL.face+1,PANEL.floor,0]),null);pass('the lever-panel bay and its doorway; the corridor in front is public');

// Inside the Container Maze; its way in and the space in front are public.
assert.equal(restrictedAt(toWorld(MAZE_ROOM,MAZE_BUTTON)),'maze');assert.equal(restrictedAt(toWorld(MAZE_ROOM,MAZE_START)),null);
assert.equal(restrictedAt(toWorld(MAZE_ROOM,[MAZE_START[0]-2,0,MAZE_START[2]])),null);pass('inside the Container Maze; its way in is public');

// The aquarium's water (the treasure swim): every gem and the chest.
for(const g of [...SWIM.gems,SWIM.chest])assert.equal(restrictedAt(swimWorld(g)),'aquarium');pass('the aquarium water');

// Lift shafts at every stop; a step out of the car's door is public.
for(const l of LIFTS)for(const s of l.stops){assert.equal(restrictedAt([l.car.x,s.y,l.car.z]),'lift',l.id+' '+s.label);}
pass(`${LIFTS.length} lift shafts at all their stops`);
assert.equal(restrictedAt([NaN,0,0]),'invalid');pass('a point that is not a number is never public');

// The landing search (publicStand) on a stand-in: floor at y 0 where x < 2, a wall at x = 1 (rays stop there), and the
// clubhouse's own check through the real rule.
const stand=([x,y,z])=>x<2&&Math.abs(y)<1.6?new T.Vector3(x,0,z):null,check=()=>true;
const wall={raycast(ray,far){const t=(1-ray.origin.x)/ray.direction.x;return t>0&&t<=far?{distance:t}:null;}};
let q=publicStand([0,0,0],{colliders:wall,stand,check});assert(q&&q.x===0&&q.z===0);
q=publicStand([0,0,0],{colliders:wall,stand,check,away:1.2});assert(q&&Math.hypot(q.x,q.z)>=1.2&&q.x<1,'beside, not through the wall: '+q?.toArray());
q=publicStand([0,0,0],{colliders:wall,stand:([x,y,z])=>x>1.2&&x<2?new T.Vector3(x,0,z):null,check});assert.equal(q,null,'only floor beyond the wall: none');
q=publicStand([0,0,0],{colliders:wall,stand,check:([x,,z])=>Math.hypot(x,z)>.6});assert(q&&Math.hypot(q.x,q.z)>.6,'Go to check refuses the first spots');
const club=[(l0[0].x+l1[1].x)/2,clubFloor,(l0[0].z+l1[1].z)/2];
assert.equal(publicStand(club,{colliders:{raycast:()=>null},stand:([x,y,z])=>new T.Vector3(x,y,z),check}),null);
pass('landing search: nearest spot in sight, beside when asked, never through a wall, never from a restricted spot');

// The kept spot (last-spot.js): fresh, too old, from a future clock, tried once, arrival-only and malformed.
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))};
const {keepSpot,takeSpot}=await import('../src/walk/last-spot.js');const now=Date.now(),spot={at:[1.234,2,3],yaw:.5,pitch:-.1,view:'first'};
keepSpot(spot,now);assert.equal(takeSpot(now+10*60*1000+1),null);assert.equal(takeSpot(now-120000),null);
const taken=takeSpot(now+1000);assert.deepEqual(taken,{at:[1.23,2,3],yaw:.5,pitch:-.1,view:'first',t:now});
assert.equal(takeSpot(now+2000),null,'a spot is tried once: a start cut off there comes back to the arrival hall');
keepSpot(taken,taken.t);assert.deepEqual(takeSpot(now+3000),taken,'put back untried, with its own time');
keepSpot(null,now);assert.equal(takeSpot(now),null);
store.set('leo-walk-last-spot','{"t":'+now+',"at":[1,"x",3]}');assert.equal(takeSpot(now),null);store.set('leo-walk-last-spot','not json');assert.equal(takeSpot(now),null);
pass('the kept spot: 10 minutes, tried once, then the arrival hall; arrival-only and malformed spots give none');

// Every main variant keeps and restores the spot the same way.
for(const f of ['main','main.authoring','main.prepared','main.public']){const s=await fs.readFile(`src/walk/${f}.js`,'utf8');
 assert(s.includes("import {keepSpot,takeSpot} from './last-spot.js';"),f);assert(s.includes('back=spot?null:takeSpot()'),f);assert(s.includes('setInterval(noteSpot,2000)'),f);
 assert(s.includes(f==='main.authoring'?"from './public-area.authoring.js'":"from './public-area.js'"),f);}
const [plain,authoring]=await Promise.all(['src/walk/public-area.js','src/walk/public-area.authoring.js'].map(f=>fs.readFile(f,'utf8')));
assert.equal(authoring,plain.replace("'./lifts.js'","'./lifts.authoring.js'").replace("'./vault.js'","'./vault.authoring.js'").replace("'./aquarium-treasure/layout.js'","'./aquarium-treasure/layout.authoring.js'"));
pass('all four main variants keep and restore the spot; the authoring copy differs only in its imports');
console.log(`check-public-area: ${checks} checks passed`);
