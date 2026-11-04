import * as T from 'three';
import {toWorld,toLocal,yawToWorld,frame} from '../plan/rooms.js';
import {findStand} from './places.authoring.js';
import {CHARGE_BAYS} from './mct-bay.js';
import {CART_WHEELS,createCartMesh} from './transporter-mesh.js';
export {createCartMesh} from './transporter-mesh.js';

// Mars Cat Transporters (from tester feedback): six three-seat carts parked in Deck 1's Cargo maintenance charging
// bays, numbered MCT-01 to MCT-06. E at the front takes the centred driver's seat (one driver per cart; with
// Leo live the server says who has it: server/transporters.mjs). W and S drive at walking pace; hold Shift to run.
// A and D steer the front wheels. E gets out, leaving the cart parked where it stopped. E at the back takes a rear seat.
// It faces backwards and rides along. The carts stay on Deck 1's floor and out of the lifts, Container hold A and Aft
// spares (their noses stop in the doorway). Each visitor drives their own copy without Leo live; with it, others see
// the driver seated and the cart moving under them, and a cart parked where its driver left it, until the daily reset sends it home.
//
// A cart's frame: the origin is on the floor under the driver's hips, +z is forward, +x the driver's left. It is solid
// to walkers as its plan rectangle; driving, it collides with the ship as three circles along its length.
const HOME_ROOM='d01-workshop-5';
// The charging bays' centres, noses toward the aisle, with room behind the rear seats to board and get out.
const HOME_Z=13.7,HOME_YAW=Math.PI;
// These rooms keep their existing cart restrictions.
const FENCED=['d01-cargo-1','d01-spares-aft'];
export const MCT={
 // Walking pace forward and slower back; m/s. Run is a multiplier; accel and brake are m/s^2. Steering uses radians.
 speed:2.25,reverse:1.2,runMultiplier:1.5,accel:2.2,brake:5,steer:.6,steerRate:2.2,
 ...CART_WHEELS,
 // The plan: half its width, its rear and front ends; the collision circles' centres along it and their radius.
 half:.75,rear:-2,front:1.3,circles:[.55,-.35,-1.25],radius:.75,
 // Seats: the cushion's top centre and the way its sitter faces (+1 forward, -1 backward).
 seats:{driver:{at:[0,.62,-.02],face:1},rear:[{at:[.31,.62,-1.33],face:-1},{at:[-.31,.62,-1.33],face:-1}]},
 // How close in plan a walker must be to use it.
 reach:1.1};

// Homes in ship coordinates: [{at:[x,y,z],yaw}].
export function homes(){return CHARGE_BAYS.map(x=>({at:toWorld(HOME_ROOM,[x+.25,0,HOME_Z]),yaw:yawToWorld(HOME_ROOM,HOME_YAW)}));}

// A point in a cart's frame, in ship coordinates, and back (plan only).
export function cartPoint(c,l,out=new T.Vector3()){const s=Math.sin(c.yaw),k=Math.cos(c.yaw);return out.set(c.pos.x+l[0]*k+l[2]*s,c.pos.y+l[1],c.pos.z-l[0]*s+l[2]*k);}
export function cartLocal(c,p){const dx=p.x-c.pos.x,dz=p.z-c.pos.z,s=Math.sin(c.yaw),k=Math.cos(c.yaw);return [dx*k-dz*s,dx*s+dz*k];}
// The push that takes a circle (plan centre p, radius r) out of a cart's rectangle, or null if clear.
export function outOfCart(c,p,r){
 const [x,z]=cartLocal(c,p),cx=(MCT.front+MCT.rear)/2,hz=(MCT.front-MCT.rear)/2+r,hx=MCT.half+r,dx=x,dz=z-cx;
 if(Math.abs(dx)>=hx||Math.abs(dz)>=hz)return null;
 // Out the nearest side.
 const ox=(hx-Math.abs(dx))*(Math.sign(dx)||1),oz=(hz-Math.abs(dz))*(Math.sign(dz)||1),s=Math.sin(c.yaw),k=Math.cos(c.yaw);
 return Math.abs(ox)<Math.abs(oz)?{x:ox*k,z:-ox*s}:{x:oz*s,z:oz*k};
}

// A cart's state: where it is, which way it faces, its speed, the front wheels' angle and how far the wheels have turned.
export function createCart(i,home){return {i,home,pos:new T.Vector3(...home.at),yaw:home.yaw,speed:0,steer:0,roll:0,d:null};}

const seg=new T.Line3(new T.Vector3(),new T.Vector3()),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),q=new T.Vector3();
// Can the cart stand here? On Deck 1's floor under every circle, out of every lift car and the fenced rooms.
export function cartFits(c,{colliders,lifts}){
 for(const z of MCT.circles){
  cartPoint(c,[0,0,z],q);
  ray.origin.set(q.x,c.pos.y+.45,q.z);ray.direction.set(0,-1,0);const hit=colliders.raycast(ray,.9);
  if(!hit||hit.normal.y<.7||Math.abs(hit.point.y-c.home.at[1])>.3)return false;
  for(const id of FENCED){const f=frame(id),[x,,lz]=toLocal(id,[q.x,f.origin[1],q.z]);if(Math.abs(x)<f.size[0]/2+.2&&Math.abs(lz)<f.size[2]/2+.2)return false;}
  for(const l of lifts?.lifts||[]){const car=l.spec.car;if(l.stops.some(s=>Math.abs(s.y-c.home.at[1])<1)&&Math.abs(q.x-car.x)<car.width/2+MCT.radius&&Math.abs(q.z-car.z)<car.depth/2+MCT.radius)return false;}
 }
 return true;
}
// Out of walls and other carts: the circles are pushed clear, a few passes, and the cart with them.
function clear(c,{colliders,others}){
 let pushed=0;
 for(let pass=0;pass<3;pass++){
  let moved=false;
  for(const z of MCT.circles){
   cartPoint(c,[0,0,z],q);const y=c.pos.y+.4+MCT.radius;seg.start.set(q.x,y,q.z);seg.end.set(q.x,y+.05,q.z);
   const p=colliders.resolve(seg,MCT.radius,2);let px=p.x,pz=p.z;
   for(const o of others||[]){if(o===c)continue;const out=outOfCart(o,q,MCT.radius);if(out){px+=out.x;pz+=out.z;}}
   if(px*px+pz*pz>1e-8){c.pos.x+=px;c.pos.z+=pz;pushed+=Math.hypot(px,pz);moved=true;}
  }
  if(!moved)break;
 }
 return pushed;
}
// Does anything (a wall, another cart) stand within the cart's circles? For checks: a parked cart should be clear.
export function cartBlocked(c,{colliders,others}){
 for(const z of MCT.circles){
  cartPoint(c,[0,0,z],q);const y=c.pos.y+.4+MCT.radius;seg.start.set(q.x,y,q.z);seg.end.set(q.x,y+.05,q.z);
  if(colliders.resolve(seg,MCT.radius,1).lengthSq()>1e-4||(others||[]).some(o=>o!==c&&outOfCart(o,q,MCT.radius)))return true;
 }
 return false;
}
// One step of driving: throttle and steering in [-1,1] (W/S and D/A). The front wheels steer and the cart turns about
// its rear axle (a bicycle model); a wall stops it rather than sliding it far, and anywhere it may not go turns it back.
export function driveCart(c,dt,throttle,steering,world,running=false){
 const pace=running?MCT.runMultiplier:1,want=throttle>0?throttle*MCT.speed*pace:throttle*MCT.reverse*pace;
 const slowing=Math.abs(want)<Math.abs(c.speed)||(want*c.speed<0);
 c.speed+=T.MathUtils.clamp(want-c.speed,-(slowing?MCT.brake:MCT.accel)*dt,(slowing?MCT.brake:MCT.accel)*dt);
 c.steer+=T.MathUtils.clamp(-steering*MCT.steer-c.steer,-MCT.steerRate*dt,MCT.steerRate*dt);
 if(Math.abs(c.speed)<1e-4){c.speed=0;return c;}
 const was={x:c.pos.x,z:c.pos.z,yaw:c.yaw},back=MCT.rearAxle,travel=c.speed*dt;
 const rx=c.pos.x+Math.sin(c.yaw)*(back+travel),rz=c.pos.z+Math.cos(c.yaw)*(back+travel);
 c.yaw+=travel*Math.tan(c.steer)/MCT.wheelbase;c.yaw=Math.atan2(Math.sin(c.yaw),Math.cos(c.yaw));
 c.pos.x=rx-Math.sin(c.yaw)*back;c.pos.z=rz-Math.cos(c.yaw)*back;
 const pushed=clear(c,world);
 if(!cartFits(c,world)){c.pos.x=was.x;c.pos.z=was.z;c.yaw=was.yaw;c.speed=0;return c;}
 // Into a wall the push undoes most of the move: the cart stops there.
 if(pushed>Math.abs(travel)*.5)c.speed*=.5;
 c.roll+=Math.hypot(c.pos.x-was.x,c.pos.z-was.z)*Math.sign(c.speed)/MCT.wheel;
 return c;
}

// ---- the cart to draw ----------------------------------------------------------------------------------------------
// ---- the six carts aboard --------------------------------------------------------------------------------------------
// Who drives each: nobody (null), this visitor, or another visitor's id, as Leo live says. A cart someone else drives
// sits under their seated body (their pose is the driver's seat), so it moves as smoothly as they do; one nobody drives
// stands where it was parked. Without Leo live (or with a server from before the carts) every page has its own six.
// `groups` are to draw (all on Deck 1's band); main.js seats the walker (rest-style) through spot() and exit().
export function createTransporters({colliders,lifts}){
 const list=homes(),carts=list.map((h,i)=>Object.assign(createCart(i,h),{mesh:createCartMesh(i+1),parked:{at:h.at,yaw:h.yaw},view:null}));
 const groups=carts.map(c=>c.mesh.group),world={colliders,lifts,others:carts};
 let link=null,linked=false,mine=null,pending=null,sentAt=0,askedAt=0;
 const name=c=>'MCT-0'+(c.i+1);
 const me=()=>link?.id?.()||null;
 // A remote visitor sitting in a seat of this cart (their body within 0.3 m of it in plan).
 const seatPoint=(c,s)=>cartPoint(c,[s.at[0],s.at[1],s.at[2]+.04*s.face]);
 const taken=(c,s,remotes)=>{if(!remotes)return false;const at=seatPoint(c,s);for(const r of remotes.remotes.values())if(r.tgt?.rest==='sit'&&Math.abs(r.cur.y-at.y)<1.2&&Math.hypot(r.cur.x-at.x,r.cur.z-at.z)<.3)return true;return false;};
 const driven=(c,remotes)=>(c.d&&c.d!==me())||taken(c,MCT.seats.driver,remotes);
 function place(c){c.mesh.group.position.copy(c.pos);c.mesh.group.rotation.set(0,c.yaw,0);c.mesh.pose(c.steer,c.roll);}
 function park(c,at,yaw){c.pos.set(...at);c.yaw=yaw;c.speed=0;c.view=null;}
 for(const c of carts)place(c);
 const api={carts,groups,
  get mine(){return mine;},
  // Called when Leo live grants this visitor a driver's seat it asked for, and when it gives theirs to someone else.
  granted:null,lost:null,
  // Leo live's half: send(msg) passes {e, i, ...} on (false when not connected); id() is this visitor's id.
  link(l){link=l;},
  // What a walker at `p` could use: the driver's seat from the front half, a rear seat from the back.
  near(p,remotes){
   if(pending)return {kind:'waiting',label:'Starting '+name(pending)+'…'};
   let best=null;
   for(const c of carts){
    if(c===mine||Math.abs(p.y-c.pos.y)>1.2)continue;
    const [x,z]=cartLocal(c,p),d=Math.hypot(Math.max(0,Math.abs(x)-MCT.half),Math.max(0,z-MCT.front,MCT.rear-z));
    if(d>MCT.reach||(best&&d>=best.d))continue;
    if(z>-.75)best=driven(c,remotes)?{kind:'waiting',d,label:name(c)+' has a driver'}:{kind:'mct',cart:c,seat:'driver',d,label:'Drive '+name(c)};
    else{const free=[0,1].filter(k=>!taken(c,MCT.seats.rear[k],remotes)).sort((a,b)=>seatPoint(c,MCT.seats.rear[a]).distanceTo(p)-seatPoint(c,MCT.seats.rear[b]).distanceTo(p));
     best=free.length?{kind:'mct',cart:c,seat:free[0],d,label:'Ride in the back of '+name(c)}:{kind:'waiting',d,label:name(c)+'’s back seats are taken'};}
   }
   return best;
  },
  // The driver's seat: true at once without Leo live; with it, asked for, and granted() is called if the server agrees.
  take(c){
   if(!linked){mine=c;c.d=null;return true;}
   if(link.send({e:'take',i:c.i})){pending=c;askedAt=performance.now();return false;}
   mine=c;return true;
  },
  // Out of the driver's seat: the cart stays where it is, and Leo live hears where.
  park(c){
   if(mine!==c)return;mine=null;c.speed=0;c.parked={at:c.pos.toArray(),yaw:c.yaw};
   if(linked)link.send({e:'park',i:c.i,at:c.pos.toArray().map(v=>Math.round(v*100)/100),yaw:Math.round(c.yaw*1000)/1000});
  },
  // A seat as a rest spot (main.js settle): its cushion top centre, the way its sitter faces, and which cart and seat.
  spot(c,seat){
   const s=seat==='driver'?MCT.seats.driver:MCT.seats.rear[seat],point=cartPoint(c,s.at),f=s.face;
   return {kind:'sit',point,height:point.y,facing:new T.Vector3(Math.sin(c.yaw)*f,0,Math.cos(c.yaw)*f),mct:{cart:c,seat}};
  },
  // Where to stand on getting out: beside the driver's seat (the left, else the right), or behind a rear seat; the
  // first of these a walker fits at, clear of every cart.
  exit(c,seat){
   const x=seat==='driver'?0:MCT.seats.rear[seat].at[0],tries=seat==='driver'?[[1.3,-.1],[-1.3,-.1],[0,2.2],[0,-2.7]]:[[x,-2.75],[Math.sign(x)*1.3,-1.35],[-Math.sign(x)*1.3,-1.35],[1.3,-.1]];
   for(const [lx,lz] of tries){const at=cartPoint(c,[lx,0,lz]),q=findStand(colliders,at.toArray(),{radius:.5});
    if(q&&carts.every(o=>!outOfCart(o,q,.3)))return {pos:q,heading:c.yaw+(seat==='driver'?0:Math.PI)};}
   return {pos:cartPoint(c,[1.3,0,-.1]),heading:c.yaw};
  },
  // Driving the cart this visitor has: throttle and steering in [-1,1], plus run.
  drive(dt,throttle,steering,running=false){
   if(!mine)return;for(let left=dt;left>1e-6;left-=.05)driveCart(mine,Math.min(.05,left),throttle,steering,world,running);
   const now=performance.now();if(linked&&now-sentAt>1000){sentAt=now;link.send({e:'at',i:mine.i,at:mine.pos.toArray().map(v=>Math.round(v*100)/100),yaw:Math.round(mine.yaw*1000)/1000});}
  },
  // Keep a walker (plan point p, body radius r) out of every cart.
  push(p,r){for(const c of carts){if(Math.abs(p.y-c.pos.y)>1.5)continue;const out=outOfCart(c,p,r);if(out){p.x+=out.x;p.z+=out.z;}}},
  // Every frame: carts others drive follow their seated bodies (hip: the walker's hip height, as main.js seats one).
  update(dt,remotes,hip){
   if(pending&&performance.now()-askedAt>4000)pending=null;
   const lift=MCT.seats.driver.at[1]+.06-hip;
   for(const c of carts){
    if(c!==mine&&c.d&&c.d!==me()){
     const r=remotes?.remotes.get(c.d);
     if(r&&r.tgt?.rest==='sit'&&r.rest>.99&&Math.abs(r.cur.y-lift-c.parked.at[1])<1.5){
      const yaw=r.cur.yaw,x=r.cur.x-.02*Math.sin(yaw),z=r.cur.z-.02*Math.cos(yaw),dx=x-c.pos.x,dz=z-c.pos.z;
      const ahead=dx*Math.sin(c.yaw)+dz*Math.cos(c.yaw),turn=Math.atan2(Math.sin(yaw-c.yaw),Math.cos(yaw-c.yaw));
      if(c.view&&dt>0){c.speed=T.MathUtils.damp(c.speed,ahead/dt,8,dt);c.roll+=ahead/MCT.wheel;
       const want=Math.abs(c.speed)>.2?T.MathUtils.clamp(Math.atan(turn/dt*MCT.wheelbase/c.speed),-MCT.steer,MCT.steer):c.steer;c.steer=T.MathUtils.damp(c.steer,want,6,dt);}
      c.pos.set(x,c.parked.at[1],z);c.yaw=yaw;c.view=r;
     }else if(c.view)park(c,c.parked.at,c.parked.yaw);
    }
    place(c);
   }
  },
  // Leo live's carts: [{d, at, yaw}] (at null: at home), in the welcome and whenever one changes; anything else (a
  // server from before the carts) leaves this page with its own six.
  apply(list){
   if(!Array.isArray(list)){linked=false;return;}
   linked=true;const id=me();
   list.forEach((s,i)=>{const c=carts[i];if(!c||!s)return;
    c.parked=Array.isArray(s.at)&&s.at.length===3&&Number.isFinite(s.yaw)?{at:s.at,yaw:s.yaw}:{at:c.home.at,yaw:c.home.yaw};
    c.d=typeof s.d==='string'?s.d:null;
    if(pending===c){if(c.d===id){pending=null;mine=c;api.granted?.(c);return;}if(c.d)pending=null;}
    if(mine===c){
     // Ours: the server forgot (it restarted, or we were away), so ask again; or someone else has it now.
     if(!c.d&&performance.now()-askedAt>1000){askedAt=performance.now();link.send({e:'take',i:c.i});}
     else if(c.d&&c.d!==id){mine=null;api.lost?.(c);park(c,c.parked.at,c.parked.yaw);}
    }else if(!c.d||!c.view)park(c,c.parked.at,c.parked.yaw);
   });
  },
  // Leo live gone: every cart stays where it is drawn, and this page drives its own until it is back.
  offline(){linked=false;pending=null;for(const c of carts)if(c!==mine){c.d=null;c.parked={at:c.pos.toArray(),yaw:c.yaw};c.view=null;}},
 };
 return api;
}
