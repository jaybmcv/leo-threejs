// Mudwater Arena (src/mudwater-arena.js, src/walk/mudwater.js), built headless: the room is the renamed Deck 16 hall
// with its stage, board, podiums, tiers, tables, counter, screen and gallery; everything stays under the ceiling; the
// steps up to the stage and the tiers are walkable; every bench, chair and stool gives a seat; the walk's triggers
// stand on open floor inside the room; and the room stays within its triangle budget.
import {Box3,Vector3} from 'three';
import {SHIP_AREAS,createShipArea} from '../src/areas.js';
import {ARENA_ID,STAGE,TABLES,TRIGGERS} from '../src/mudwater-arena.js';
import {GAME_URL} from '../src/walk/mudwater.js';
import {findRestSpots} from '../src/walk/rest.js';
import {BODY,solid,meshTriangles} from '../src/walk/collision.js';

const problems=[],log=(...a)=>console.log(...a);
const expect=(ok,what)=>{if(!ok)problems.push(what);log(ok?'ok  ':'FAIL',what);};

const area=SHIP_AREAS.find(a=>a.id===ARENA_ID);
expect(area&&area.name==='Mudwater Arena'&&area.deck===16&&area.kind==='arena','Deck 16 has the Mudwater Arena in place of the learning center');
expect(!SHIP_AREAS.some(a=>a.kind==='classroom'),'no learning center is left aboard');
const room=createShipArea(area),root=room.root;root.updateMatrixWorld(true);
const named=n=>{const out=[];root.traverse(o=>{if(o.name===n)out.push(o);});return out;};
const counts=Object.fromEntries(['Mudwater_stage','Mudwater_podium','Mudwater_hologram','Match_table','Mudwater_pack_counter','Mudwater_pack_vault','Mudwater_match_screen','Card_frame','Bench_cushion'].map(n=>[n,named(n).length]));
expect(counts.Mudwater_stage===1&&counts.Mudwater_podium===2&&counts.Mudwater_hologram===5&&counts.Match_table===TABLES.length&&counts.Mudwater_pack_counter===1&&counts.Mudwater_pack_vault===1&&counts.Mudwater_match_screen===1&&counts.Card_frame===1&&counts.Bench_cushion===6,`the arena's pieces are all there (${JSON.stringify(counts)})`);

// Under the ceiling (3.37 m above the floor) and inside the footprint.
const [cx,cy,cz]=area.center,b=new Box3().setFromObject(root);
expect(b.max.y<=cy+3.5+1e-6&&b.min.x>=cx-26.01&&b.max.x<=cx+26.01&&b.min.z>=cz-17.01&&b.max.z<=cz+17.01,'the arena stays inside its room');
let high=0;root.traverse(o=>{if(!o.isMesh||/^(Ceiling|Ceiling_light|Side_wall|End_wall|Entry_wall|Entry_header|Stair_lobby|Polish_|Refined_)/.test(o.name)||o.parent?.name==='Walls_and_ceiling')return;const t=new Box3().setFromObject(o).max.y-cy;if(t>3.37+1e-6)high++;});
expect(high===0,`no fitting pokes through the ceiling (${high})`);

// Walkable: each rise (floor, step, stage; floor, tier, tier) is within the walker's step, and the top tier and the
// stage leave a 2 m walker standing room.
const rises=[.22,STAGE.h-.22,.35,.35];
expect(rises.every(r=>r>0&&r<=BODY.step),`every rise is a step a walker takes (${rises.map(r=>r.toFixed(2))} m, step ${BODY.step} m)`);
expect(3.37-.7>=BODY.height&&3.37-STAGE.h-.04>=BODY.height,'the top tier and the stage leave standing room');

// Seats: three benches a side, a chair each side of every table and a stool behind each podium.
const spots=findRestSpots(root).filter(s=>s.kind==='sit'),inside=s=>Math.abs(s.point.x-cx)<26&&Math.abs(s.point.z-cz)<17;
const arena=spots.filter(inside),faced=arena.filter(s=>s.facing).length;
expect(arena.length>=6*17+TABLES.length*2+2,`spectators, players and podium stools all have seats (${arena.length})`);
expect(faced===arena.length,`every seat faces away from its back (${faced}/${arena.length})`);
const benchFacing=arena.filter(s=>Math.abs(s.point.z-cz)>10&&Math.abs(s.point.x-cx-8)<6);
expect(benchFacing.length>0&&benchFacing.every(s=>Math.sign(s.facing.z)===-Math.sign(s.point.z-cz)),'the tiers face the stage');

// Triggers: inside the room, with none of the walk's solid triangles (collision.js) in the walker's capsule above
// step height.
const tris=[];root.traverse(o=>{if(solid(o))meshTriangles(o,tris);});
for(const t of TRIGGERS){const p=root.localToWorld(new Vector3(...t.at)),r=BODY.radius;
 const cap=new Box3(new Vector3(p.x-r,p.y+BODY.step,p.z-r),new Vector3(p.x+r,p.y+BODY.height,p.z+r)),tb=new Box3();let hit=0;
 for(let i=0;i<tris.length;i+=9){tb.makeEmpty();for(let k=0;k<9;k+=3)tb.expandByPoint(new Vector3(tris[i+k],tris[i+k+1],tris[i+k+2]));if(tb.intersectsBox(cap))hit++;}
 expect(hit===0&&Math.abs(p.x-cx)<25.5&&Math.abs(p.z-cz)<16.5,`the ${t.kind} trigger at ${t.at} stands clear inside the room (${hit} triangles in the way)`);}
expect(GAME_URL==='https://mudwater.bayc.com/game/','Play Mudwater opens the game page');

// Budget: the furnished room, shell and finishing passes included.
let count=0;root.traverse(o=>{if(o.isMesh){const g=o.geometry;count+=(g.index?g.index.count:g.attributes.position.count)/3;}});
expect(count<=50000,`the furnished arena is within budget (${Math.round(count)} triangles)`);

if(problems.length){console.log(`\n${problems.length} problem(s)`);process.exit(1);}
console.log('\nMudwater Arena: all checks passed');
