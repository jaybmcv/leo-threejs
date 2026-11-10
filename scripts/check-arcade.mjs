// The Deck 17 arcade row (src/walk/arcade.js): Invasion and Pool cabinets at the stair end, Paws Off's treadmill past the
// far end, in the current lounge layout. Positions only; the cabinets' art needs a canvas, so the browser checks see that.
import {arcadeTreadmill,liveArcadeStations} from '../src/walk/arcade.js';

let bad=0;
const ok=(cond,what)=>{console.log((cond?'ok   ':'FAIL ')+what);if(!cond)bad++;};
const st=liveArcadeStations(),mill=arcadeTreadmill();
ok(!!st.invasion&&!!st.pool,'Alien Cat Invasion and Paw Pool stations are in the row');
const [ix,iy,iz]=st.invasion,[px,py,pz]=st.pool,mz=mill.centre;
ok(Math.abs(iy-mill.floor)<.01&&Math.abs(py-mill.floor)<.01,'the cabinets\' stations are at the arcade floor');
// The row runs along one axis of the wall; the stair end is where Invasion stands.
const along=Math.abs(iz-pz)>Math.abs(ix-px)?2:0,a=[ix,iy,iz][along],b=[px,py,pz][along],m=[mz.x,mz.y,mz.z][along];
ok(Math.abs(b-a)>.8&&Math.abs(b-a)<2.2,'Pool is the next cabinet along from Invasion ('+Math.abs(b-a).toFixed(2)+' m)');
ok(Math.sign(m-a)===Math.sign(b-a),'the treadmill is on the far side of Pool from the stair, not in the third slot');
ok(Math.abs(m-a)>5,'the treadmill stands past the whole row ('+Math.abs(m-a).toFixed(2)+' m from Invasion)');
ok(Math.abs(mill.length-2.6)<1e-6&&Math.abs(mill.width-1.3)<1e-6,'its deck is as long and wide as the Deck 16 treadmills\'');
ok(mill.place==='Arcade'&&Math.abs(mill.front.length()-1)<1e-6,'its results card names the Arcade and a runner faces the wall');
console.log(bad?'FAIL':'PASS');
process.exit(bad?1:0);
