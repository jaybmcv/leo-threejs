import * as T from 'three';
import {rectangle,contains} from '../plan/geometry-v2.js';
import {polygonGeometry,mesh,mergeBoxes,bounds} from './geometry.js';

// Finish only the plate outside the rooms. The selected slabs keep every void open.
export function commonsHallPlan(layout){
 const deck=layout.decks[16],above=layout.decks[17],gardens=layout.rooms.filter(r=>r.kind==='garden'&&r.deck===17),rooms=layout.rooms.filter(r=>r.deck===17&&!r.aggregate),promenades=layout.circulation.corridors.filter(c=>c.deck===17&&c.id.startsWith('d17-garden-promenade-'));
 const b=bounds(gardens.flatMap(r=>r.polygon)),inner=Math.min(...promenades.flatMap(c=>c.points.map(p=>Math.abs(p[1])-c.width/2))),outer=Math.max(Math.abs(b.z0),Math.abs(b.z1)),banks=[];
 for(const side of [-1,1]){
  const z0=side<0?-outer:inner,z1=side<0?-inner:outer,rect=(x0,x1,z0,z1)=>rectangle((x0+x1)/2,(z0+z1)/2,x1-x0,z1-z0),masks=[rect(-1000,b.x0,-1000,1000),rect(b.x1,1000,-1000,1000),rect(-1000,1000,-1000,z0),rect(-1000,1000,z1,1000),...rooms.map(r=>r.polygon)];
  banks.push({side,floor:{outline:deck.slab.outline,holes:[...masks,...deck.slab.holes.map(h=>h.polygon)]},ceiling:{outline:above.slab.outline,holes:[...masks,...above.slab.holes.map(h=>h.polygon)]}});
 }
 return {y:deck.y,banks,gardens,promenades};
}

export function buildCommonsHallFinish(structure,layout){
 const plan=commonsHallPlan(layout),group=new T.Group();group.name='V2_commons_hall_finish';group.userData={v2Deck:17,room:'circulation-17',noCollide:true};structure.add(group);
 const floor=new T.MeshStandardMaterial({name:'Commons_hall_matte_floor',color:0xdce1db,roughness:.88}),ceiling=new T.MeshStandardMaterial({name:'Commons_hall_ceiling',color:0xe4dfd4,roughness:.9}),light=new T.MeshBasicMaterial({name:'Commons_hall_warm_light',color:0xffdeb0,toneMapped:false}),lights=[];
 const put=(name,g,mat)=>{const o=mesh(group,name,g,mat);o.userData={v2Deck:17,room:'circulation-17',noCollide:true};return o;};
 for(const bank of plan.banks){
  put('V2_commons_hall_floor_finish',polygonGeometry(bank.floor.outline,bank.floor.holes,plan.y+.014,.002),floor);
  put('V2_commons_hall_ceiling',polygonGeometry(bank.ceiling.outline,bank.ceiling.holes,plan.y+3.60,.06),ceiling);
  const covered=(x,z)=>contains(bank.ceiling.outline,[x,z])&&!bank.ceiling.holes.some(p=>contains(p,[x,z]));
  const strip=(x,z,yaw=0)=>{const size=[1.8,.025,.18],poly=rectangle(x,z,size[0],size[2],yaw);
   if(!poly.every(([x,z])=>covered(x,z)))return;
   lights.push([size,[x,plan.y+3.505,z],yaw]);};
  for(const c of plan.promenades)for(let i=1;i<c.points.length;i++){
   const a=c.points[i-1],b=c.points[i];if(Math.sign(a[1])!==bank.side)continue;
   const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.ceil(length/12);for(let k=0;k<count;k++){const t=(k+.5)/count;strip(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,-Math.atan2(b[1]-a[1],b[0]-a[0]));}
  }
  const gardens=plan.gardens.filter(r=>Math.sign(r.z)===bank.side).map(r=>bounds(r.polygon)).sort((a,b)=>a.x0-b.x0);
  for(let i=1;i<gardens.length;i++){const a=gardens[i-1],b=gardens[i],x=(a.x1+b.x0)/2;if(b.x0-a.x1<2)continue;
   for(let z=28;z<Math.min(Math.max(Math.abs(a.z0),Math.abs(a.z1)),Math.max(Math.abs(b.z0),Math.abs(b.z1)));z+=10)strip(x,bank.side*z,Math.PI/2);
  }
 }
 const o=mergeBoxes(group,'V2_commons_hall_lights',lights,light);if(o)o.userData={v2Deck:17,room:'circulation-17',noCollide:true};group.userData.lightStrips=lights.length;return group;
}
