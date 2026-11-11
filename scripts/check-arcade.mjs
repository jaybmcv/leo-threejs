// The Deck 17 arcade row (src/walk/arcade.js): Invasion and Pool cabinets at the stair end, Paws Off's treadmill past the
// far end, in the current lounge layout. Positions only; the cabinets' art needs a canvas, so the browser checks see that.
// Run: node scripts/check-arcade.mjs (reads output/leo-interior-v02/layout.json, which a build writes). Passes on the plan's layout too.
import {arcadeRow,arcadeTreadmill,liveArcadeStations} from '../src/walk/arcade.js';

let bad=0;
const ok=(cond,what)=>{console.log((cond?'ok   ':'FAIL ')+what);if(!cond)bad++;};
const st=liveArcadeStations(),mill=arcadeTreadmill(),row=arcadeRow();
ok(!!st.invasion&&!!st.pool,'Alien Cat Invasion and Paw Pool stations are in the row');
ok(Math.abs(st.invasion[1]-mill.floor)<.01&&Math.abs(st.pool[1]-mill.floor)<.01,'the cabinets\' stations are at the arcade floor');
// Distances along the wall from the row's stair end (its first cabinet), and out from the wall into the room (all on the floor plane).
const xz=(a,b)=>{const v=[b[0]-a[0],b[2]-a[2]],n=Math.hypot(...v);return n?[v[0]/n,v[1]/n,n]:[0,0,0];};
const P=v=>[v.x,v.y,v.z],axis=xz(P(row.start),P(row.end)),out=xz(P(row.wall),P(row.room));
const along=p=>(p[0]-row.start.x)*axis[0]+(p[2]-row.start.z)*axis[1],reach=p=>(p[0]-row.wall.x)*out[0]+(p[2]-row.wall.z)*out[1];
const rowEnd=along(P(row.end)),near=along(P(row.towerNear)),far=along(P(row.towerFar)),m=along(P(mill.centre));
ok(rowEnd>8&&rowEnd<14,'the row of cabinets runs '+rowEnd.toFixed(2)+' m along the wall');
ok(Math.abs(axis[0]*out[0]+axis[1]*out[1])<1e-6,'the wall direction and the way out into the room are square');
const ia=along(st.invasion),pa=along(st.pool);
ok(ia>0&&ia<pa&&pa<rowEnd,'Invasion then Pool stand along the row from the stair end ('+ia.toFixed(2)+', '+pa.toFixed(2)+' m)');
ok(near>=rowEnd+.5,'the treadmill\'s tower starts past the last cabinet, with a gap ('+(near-rowEnd).toFixed(2)+' m)');
ok(Math.abs(far-near-1.5)<1e-6&&m>near&&m<far,'the treadmill\'s deck is centred on its tower, at the row\'s far end');
// A runner faces the wall: the way they face is the way into the wall, and their deck is out in the room from it.
ok(mill.front.x*out[0]+mill.front.z*out[1]<-.999,'a runner faces the wall (not the room or along the row)');
ok(reach(P(mill.centre))>.5&&reach(P(mill.centre))<3.5,'the deck stands out from the wall ('+reach(P(mill.centre)).toFixed(2)+' m)');
ok(Math.abs(mill.length-2.6)<1e-6&&Math.abs(mill.width-1.3)<1e-6,'its deck is as long and wide as the Deck 16 treadmills\'');
ok(mill.place==='Arcade','its results card names the Arcade');
// Prompts: no cabinet's station is within reach of the treadmill, so each shows only its own game.
for(const [k,s] of Object.entries(st))ok(Math.hypot(s[0]-mill.centre.x,s[2]-mill.centre.z)>2.5,k+'\'s station is clear of the treadmill\'s deck');
console.log(bad?'FAIL':'PASS');
process.exit(bad?1:0);
