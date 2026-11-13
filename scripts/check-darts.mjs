// The Recreation Hall's nine-dart challenge (src/walk/darts/rules.js), played headless: every sector's number, the ring
// edges, both bulls and misses; a held throw key, presses while a dart is in the air and presses after the ninth dart
// each leaving no extra dart; nine throws making exactly one round. Then the darts as dressed (recreation-hall.js) in the
// selected layout's hall: boards on the aft glass partition behind air hockey, lanes inside the hall and clear of the
// other games, nothing left at the old window-side spot, and the E prompt at each throwing line (darts/lanes.js).
import {createCanvas} from '@napi-rs/canvas';
import * as T from 'three';
import {NUMBERS,RING,DARTS,FLIGHT,score,newRound,step,press,release} from '../src/walk/darts/rules.js';

const problems=[],log=(...a)=>console.log(...a);
const expect=(ok,what)=>{if(!ok)problems.push(what);log(ok?'ok  ':'FAIL',what);};
// A point at `r` mm from the bull, `deg` degrees clockwise from straight up.
const at=(r,deg)=>{const a=deg*Math.PI/180;return [r*Math.sin(a),r*Math.cos(a)];};

// Each sector's centre, single bed: its number. The board goes 20, 1, 18 … clockwise from the top.
{let ok=true;NUMBERS.forEach((n,i)=>{const s=score(...at(60,i*18));if(s.points!==n||s.mult!==1)ok=false;});expect(ok,'every sector scores its own number in the single bed');
 expect(score(...at(60,0)).points===20&&score(...at(60,18)).points===1&&score(...at(60,-18)).points===5&&score(...at(60,180)).points===3,'20 at the top, 1 to its right, 5 to its left, 3 at the bottom');
 expect(score(...at(60,8.9)).points===20&&score(...at(60,9.1)).points===1,'the wire between 20 and 1 sits 9 degrees round');}
// The rings and their edges: a ring's edge counts as that ring.
expect(score(...at(103,0)).points===60&&score(...at(103,0)).label==='T20','the triple ring triples (T20 = 60)');
expect(score(...at(RING.trebleIn,0)).points===60&&score(...at(RING.trebleOut,0)).points===60,'both edges of the triple ring triple');
expect(score(...at(RING.trebleIn-.01,0)).points===20&&score(...at(RING.trebleOut+.01,0)).points===20,'just inside and just outside the triple ring score single');
expect(score(...at(166,18*13)).points===32&&score(...at(166,18*13)).label==='D16','the double ring doubles (D16 = 32)');
expect(score(...at(RING.doubleIn,90)).points===12&&score(...at(RING.doubleOut,90)).points===12&&score(...at(RING.doubleIn-.01,90)).points===6,'both edges of the double ring double; just inside is single');
expect(score(...at(RING.doubleOut+.01,0)).points===0&&score(...at(RING.doubleOut+.01,0)).label==='MISS'&&score(...at(220,45)).points===0&&score(500,500).points===0,'past the double ring is a miss worth 0');
expect(score(0,0).points===50&&score(...at(RING.bull,0)).points===50&&score(...at(RING.bull-.01,123)).points===50,'the inner bull, edge included, is 50');
expect(score(...at(RING.bull+.01,10)).points===25&&score(...at(RING.outer,0)).points===25&&score(...at(RING.outer-.01,300)).points===25,'the outer bull, edge included, is 25');
expect(score(...at(RING.outer+.01,0)).points===20,'just past the outer bull is the single bed');

// Throwing: a round where the hand is still, so each dart goes exactly where it is aimed.
const still=()=>{const r=newRound(7);r.still=true;return r;};
const fly=r=>{let d=null;for(let i=0;i<100&&!d;i++)d=step(r,FLIGHT/10+.001);return d;};
{const r=still();expect(r.phase==='aim'&&r.darts.length===0&&r.total===0,'a new round: aiming, no darts thrown, total 0');
 expect(press(r)===true&&r.phase==='flight','Space throws a dart');
 expect(press(r,true)===false&&press(r)===false,'a held key (its repeats) and a press while the dart flies do not throw');
 const d=fly(r);expect(d&&d.points===50&&r.darts.length===1&&r.total===50&&r.phase==='aim','the dart lands at the aim: a bull, 50');
 expect(press(r)===false&&r.darts.length===1&&r.phase==='aim','still held after landing: no second dart until the key comes up');
 release(r);expect(press(r)===true,'let go and press again: the next dart');fly(r);release(r);
 // The arrows move the aim; held up for a while it reaches the 20s.
 step(r,.68,{up:true});const y=r.aim.y;expect(y>95&&y<110,`holding up moves the aim up the board (${y.toFixed(1)} mm)`);
 press(r);fly(r);release(r);expect(r.darts.at(-1).points===60,'aimed at the triple 20: 60');
 step(r,5,{up:true,right:true});expect(Math.hypot(r.aim.x,r.aim.y)<=210.01,'the aim stays on the board');
 press(r);fly(r);release(r);expect(r.darts.at(-1).points===0,'aimed off the board: a miss for 0');
 while(r.phase!=='done'){press(r);fly(r);release(r);}
 expect(r.darts.length===DARTS&&r.total===r.darts.reduce((a,d)=>a+d.points,0),'nine darts make one round, its total the sum of the nine');
 expect(press(r)===false&&r.darts.length===DARTS,'no tenth dart after the round ends');}
// A key held down through a whole round's time throws one dart only; tapping nine times throws nine.
{const r=still();press(r);for(let i=0;i<200;i++){press(r,true);step(r,.05);}expect(r.darts.length===1,'Space held for ten seconds: one dart');}
{const r=newRound(11);let n=0;for(let i=0;i<30&&r.phase!=='done';i++){if(press(r))n++;press(r,true);fly(r);release(r);}
 expect(n===DARTS&&r.darts.length===DARTS&&r.phase==='done','nine taps with the hand swaying: nine darts, round over');}

// The darts as dressed in the hall, in the selected layout's frame.
globalThis.document={createElement:()=>createCanvas(1,1)};
const layout=(await import('../src/plan/selected-layout.js')).default;
const {dressRecreationHall}=await import('../src/walk/recreation-hall.js'),{createDartsLanes,LANES}=await import('../src/walk/darts/lanes.js');
const {v1Frame}=await import('../src/plan/rooms.js');
const hall=layout.rooms.find(r=>r.id==='d16-recreation-4');
const root=new T.Group(),room=new T.Group(),old=v1Frame('d16-recreation-4');room.name='Area_d16-recreation-4';room.position.fromArray(old.origin);room.rotation.y=old.yaw;root.add(room);
const fit=new T.Group();fit.name='Room_fittings';room.add(fit);dressRecreationHall({root,inside:root});
const lanes=createDartsLanes({root,inside:root});root.updateMatrixWorld(true);
const box=o=>new T.Box3().setFromObject(o),darts=root.getObjectByName('Recreation_darts'),air=root.getObjectByName('Recreation_air_hockey');
const xs=hall.polygon.map(p=>p[0]),aft=Math.min(...xs),inHall=(x,z)=>{let c=false;const P=hall.polygon;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,zi]=P[i],[xj,zj]=P[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
const boards=[];darts.traverse(o=>{if(o.name==='Recreation_dartboard')boards.push(box(o));});
expect(boards.length===3,'three dartboards');
expect(boards.every(b=>b.min.x-aft<.4&&b.min.x>aft),`the boards hang on the aft partition (x ${boards.map(b=>b.min.x.toFixed(2)).join(', ')}; wall ${aft})`);
const ah=box(air),db=box(darts);
expect(boards.every(b=>b.max.z>ah.min.z-4&&b.min.z<ah.max.z+4),'the boards are behind the air hockey table');
expect(db.max.x<ah.min.x-1.5,`the lanes end ${(ah.min.x-db.max.x).toFixed(1)} m short of air hockey`);
expect([db.min,db.max].every(p=>inHall(p.x+(p.x===db.min.x?.05:0),p.z))&&inHall(db.min.x+.05,db.max.z)&&inHall(db.max.x,db.min.z),'the darts lie inside the hall');
// Nothing else in the hall stands in the lanes or where the players stand.
const play=db.clone();play.max.x+=1.5;play.min.y=0;let hit=[];
fit.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p===darts)return;if(box(o).intersectsBox(play))hit.push(o.name);});
expect(!hit.length,'nothing else stands in the lanes or behind the lines'+(hit.length?': '+[...new Set(hit)].join(', '):''));
// The old darts spot by the window wall is empty.
const oldSpot=new T.Box3(new T.Vector3(...room.localToWorld(new T.Vector3(-19,0,-17.2)).toArray()),new T.Vector3(...room.localToWorld(new T.Vector3(-10,3,-13)).toArray()));
hit=[];fit.traverse(o=>{if(o.isMesh&&/dart|oche|lane_inlay/i.test(o.name)&&box(o).intersectsBox(oldSpot))hit.push(o.name);});
expect(!hit.length,'nothing of the darts is left at the old window-side spot');
// The prompt: at each throwing line, and not by air hockey or the hall's middle.
expect(lanes&&lanes.spots.length===LANES.length&&lanes.spots.every((s,i)=>lanes.near(s)?.kind==='darts'&&lanes.near(s).lane===i),'E at each throwing line offers darts, that lane');
const mid=ah.getCenter(new T.Vector3());mid.y=lanes.spots[0].y;
expect(!lanes.near(mid)&&!lanes.near(room.localToWorld(new T.Vector3(0,0,0))),'no darts prompt at air hockey or the hall centre');

if(problems.length){console.error(`\n${problems.length} problem(s)`);process.exit(1);}
console.log('\nDarts: all checks pass.');
