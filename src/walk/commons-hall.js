import * as T from 'three';
import {anchorObject} from '../plan/rooms.js';
import {COMMONS} from '../model.js';
import {floorY,TRANSIT_CORES} from '../transit.js';
import {cutOut} from '../cut-out.js';

// On foot, Deck 17's ten garden commons and the corridor between them open into one hall (from tester feedback). The
// bare deck plate between neighbouring commons, and between the corridor and the commons, counts as floor, so no
// partitions stand there (partitions.js) and it is floored to match; each commons' end wall is cut back to the deck
// above, where it stays as a header over the opening. The forward transit core (lifts and stairs) keeps its own walls.
const DECK=17,Y=floorY(DECK),CORRIDOR=4,CORE={x0:128,x1:147,z:8};
export const HEADER=floorY(DECK+1)-.3;
export const HALL={deck:DECK,x0:Math.min(...COMMONS.map(c=>c.x-c.width/2)),x1:Math.max(...COMMONS.map(c=>c.x+c.width/2)),z:Math.max(...COMMONS.map(c=>Math.abs(c.z)+c.depth/2))};
// The commons on the side of z that spans x, if any.
const commonsAt=(x,s)=>COMMONS.find(c=>Math.sign(c.z)===s&&Math.abs(x-c.x)<c.width/2);
// Whether a point on Deck 17's plan is inside the hall (the commons and the corridor included). Beside a commons the
// hall ends at its rear wall (two of them sit further inboard), so nothing opens up behind one.
export const inHall=(x,z)=>{const c=commonsAt(x,Math.sign(z));
 return x>HALL.x0&&x<HALL.x1&&Math.abs(z)<(c?Math.abs(c.z)+c.depth/2:HALL.z)&&!(x>CORE.x0&&x<CORE.x1&&Math.abs(z)<CORE.z);};

// The forward stairs' west end walls, on Deck 17: each shuts the stair's foot off from the garden walkway beside the
// lift (tester feedback: more open space). They are cut to the height of the promenade doorway headers, so the walkway
// and the stair landing run together; the walls stay on the decks above and below.
const STAIR=TRANSIT_CORES.find(c=>c.id==='forward'),END={x:STAIR.stairX-4.57,z0:STAIR.stairZ-2.6,z1:STAIR.stairZ+2.6,top:Y+3.2};

// The hall's new floor: rectangles {x0,x1,z0,z1} of the hall outside the commons, the corridor and the core.
export function hallFloors(){
 const out=[];
 for(const s of [-1,1]){
  const xs=[...new Set([HALL.x0,HALL.x1,CORE.x0,CORE.x1,...COMMONS.filter(c=>Math.sign(c.z)===s).flatMap(c=>[c.x-c.width/2,c.x+c.width/2])])].sort((a,b)=>a-b);
  for(let i=0;i+1<xs.length;i++){const a=xs[i],b=xs[i+1],m=(a+b)/2;if(m<HALL.x0||m>HALL.x1)continue;
   const p=m>CORE.x0&&m<CORE.x1?CORE.z:CORRIDOR,c=commonsAt(m,s),q=c?Math.abs(c.z)-c.depth/2:HALL.z;
   if(q-p>.01)out.push({x0:a,x1:b,z0:s>0?p:-q,z1:s>0?q:-p});}
 }
 return out;
}

// Open the hall in a built ship: cut the end walls (and the prints and sconces hung on them) back to the header, and
// lay the commons' floor over the bare plate between them.
export function openCommonsHall(ship){
 const hung=/^(Commons_end_wall|Commons_art_(frame|canvas|print)|Lounge_neon_glow|Lounge_sheen)$/;
 for(const c of COMMONS){const x=c.x-c.width/2,z0=Math.abs(c.z)-c.depth/2,z1=Math.abs(c.z)+c.depth/2,s=Math.sign(c.z);
  cutOut(ship.inside,new T.Box3(new T.Vector3(x-.2,Y+.02,s>0?z0:-z1),new T.Vector3(x+.6,HEADER,s>0?z1:-z0)),o=>hung.test(o.name));}
 for(const s of [-1,1])cutOut(ship.inside,new T.Box3(new T.Vector3(END.x-.3,Y+.02,s>0?END.z0:-END.z1),new T.Vector3(END.x+.3,END.top,s>0?END.z1:-END.z0)),o=>o.name==='Stair_end_wall');
 const material=ship.inside.getObjectByName('Commons_floor')?.material||new T.MeshStandardMaterial({color:0xe2dccd,roughness:.8});
 const floor=new T.Group();floor.name='Commons_hall_floor';
 for(const r of hallFloors()){const g=new T.PlaneGeometry(r.x1-r.x0,r.z1-r.z0).rotateX(-Math.PI/2).translate((r.x0+r.x1)/2,Y,(r.z0+r.z1)/2);
  const m=new T.Mesh(g,material);m.name='Commons_hall_floor';floor.add(m);}
 anchorObject(floor,'circulation-17');ship.inside.add(floor);
}
