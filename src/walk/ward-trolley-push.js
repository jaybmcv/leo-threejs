import * as T from 'three';
import {TROLLEY_BOX} from './ward-trolley.js';

// Pushing the Medical ward's supply trolley (ward-trolley.js), alone: E at its handle takes hold. Cosmo stands behind the
// handle and walks as always; W and S push and pull along the trolley's heading, A and D steer it round him. E or Esc
// lets go where it stands, R sends it back to its spot and puts Cosmo behind its handle. The state is this page's own:
// nobody else sees it move.
// Both the trolley's box and Cosmo must stay on clear floor inside ZONE (room frame: the aisle edge is z=2, and the
// trolley keeps off it; the bays' dividers and beds are solid anyway). A step that would break that is not taken (the
// cat is put back), so neither can end up inside a wall, a bed or the aisle.
export const PUSH={hold:.74,reach:1.1,turn:1.5,zone:{x:[-25.1,-12.4],z:[2.1,7.4]},margin:.02};
const HALF=[TROLLEY_BOX[0]/2,TROLLEY_BOX[2]/2];
// Probe points over the box: short upright capsules clear of the floor, so a wall, bed or divider within the box shows.
const PROBES=[-.25,-.083,.083,.25].flatMap(x=>[-.2,-.07,.07,.2].map(z=>[x,z]));
const CAT={bottom:.4,top:1.6,radius:.33};
export const PUSH_LABEL='W/S push · A/D steer · E or Esc let go · R send it back';

// The trolley used to be baked into the ship as a solid box at its first spot. A fast deploy that only patches the ward
// keeps that box until the nightly rebuild, and it would stay behind as an invisible wall once the trolley is pushed
// away. So the box is taken out of the collision here: the triangles whose three corners are the box's own corners are
// moved far below the ship and their bounds refitted. Nothing else can match, and after a rebuild nothing does.
function dropBakedBox(sets,toWorld,spot){
 const c=[];for(const x of [-1,1])for(const y of [0,1])for(const z of [-1,1])c.push(new T.Vector3(spot.x+x*HALF[0],y*TROLLEY_BOX[1],spot.z+z*HALF[1]).applyMatrix4(toWorld));
 const box=new T.Box3().setFromPoints(c).expandByScalar(.02);
 const corner=(a,i)=>c.some(p=>Math.abs(p.x-a[i])<.01&&Math.abs(p.y-a[i+1])<.01&&Math.abs(p.z-a[i+2])<.01);
 for(const col of sets)for(const band of col?.bands?.values()||[]){
  const a=band.geometry?.attributes.position?.array;if(!a||!band.bvh?.refit)continue;let moved=false;
  for(let i=0;i<a.length;i+=9){
   if(a[i]<box.min.x||a[i]>box.max.x||a[i+1]<box.min.y||a[i+1]>box.max.y||a[i+2]<box.min.z||a[i+2]>box.max.z)continue;
   if(corner(a,i)&&corner(a,i+3)&&corner(a,i+6)){a[i+1]-=1e4;a[i+4]-=1e4;a[i+7]-=1e4;moved=true;}
  }
  if(moved)band.bvh.refit();
 }
}

// `group` is the drawn trolley's world group (ward-trolley.js): it carries the room's frame, and its first child is the model.
export function createWardPush(group,colliders){
 const model=group.getObjectByName('Ward_supply_trolley'),state={x:model.position.x,z:model.position.z,turn:model.rotation.y},start={...state},room=group,
  trolley={state,place(x,z,t){state.x=x;state.z=z;state.turn=t;model.position.set(x,0,z);model.rotation.y=t;}},toLocal=new T.Matrix4(),toWorld=new T.Matrix4(),seg=new T.Line3(new T.Vector3(),new T.Vector3()),ray=new T.Ray(),down=new T.Vector3(0,-1,0);
 const sync=()=>{room.updateWorldMatrix(true,false);toWorld.copy(room.matrixWorld);toLocal.copy(toWorld).invert();};
 sync();dropBakedBox([colliders,colliders.v2Ground],toWorld,start);
 const local=p=>p.clone().applyMatrix4(toLocal),world=(x,y,z)=>new T.Vector3(x,y,z).applyMatrix4(toWorld);
 // The trolley's heading in the world is its own plus the room's yaw.
 const roomYaw=()=>{sync();const d=new T.Vector3(0,0,1).transformDirection(toWorld);return Math.atan2(d.x,d.z);};
 const fwd=t=>[Math.sin(t),Math.cos(t)];
 // Cosmo stands behind the handle, on the trolley's axis.
 const standAt=(x,z,t,back=PUSH.hold)=>{const [sx,cz]=fwd(t);return [x-sx*back,z-cz*back];};
 const catClear=(x,y,z)=>{seg.start.copy(world(x,y+CAT.bottom,z));seg.end.copy(world(x,y+CAT.top,z));return !colliders.overlaps(seg,CAT.radius);};
 let engaged=false,turnWish=0,last=null;
 // Is the box at centre (x,z) facing t on clear floor inside the zone?
 function boxClear(x,z,t){
  const [sx,cz]=fwd(t),{zone:Z,margin}=PUSH;// forward is (sx,cz), the box's own x axis (cz,-sx)
  for(const a of [-1,1])for(const b of [-1,1]){const px=x+cz*a*HALF[0]+sx*b*HALF[1],pz=z-sx*a*HALF[0]+cz*b*HALF[1];
   if(px<Z.x[0]+margin||px>Z.x[1]-margin||pz<Z.z[0]+margin||pz>Z.z[1]-margin)return false;
   // Floor under each corner, level with the room's floor.
   const o=world(px,.5,pz);ray.set(o,down);const g=colliders.raycast(ray,1);if(!g||Math.abs(g.point.y-(o.y-.5))>.15)return false;}
  for(const [a,b] of PROBES){const px=x+cz*a+sx*b,pz=z-sx*a+cz*b;
   seg.start.copy(world(px,.22,pz));seg.end.copy(world(px,1.02,pz));if(colliders.overlaps(seg,.12))return false;}
  return true;
 }
 function release(){engaged=false;turnWish=0;}
 return {
  trolley,
  get engaged(){return engaged;},
  get yaw(){return trolley.state.turn+roomYaw();},
  // The prompt to take hold: Cosmo within reach of the handle's standing spot, on its handle side.
  near(p){
   if(engaged)return null;
   sync();const s=trolley.state,l=local(p),[x,z]=standAt(s.x,s.z,s.turn),[sx,cz]=fwd(s.turn);
   if(Math.abs(l.y)>1.2||Math.hypot(l.x-x,l.z-z)>PUSH.reach||(l.x-s.x)*sx+(l.z-s.z)*cz>-.3)return null;
   return {kind:'trolley-push',label:'Push the supply trolley · only you see it move'};
  },
  get holdTarget(){return {kind:'trolley-hold',label:PUSH_LABEL};},
  // E: take hold. Cosmo steps to the standing spot behind the handle; refused if that spot or the trolley is not clear.
  begin(controller){
   if(engaged)return false;
   sync();const s=trolley.state,[x,z]=standAt(s.x,s.z,s.turn),y=local(controller.position).y;
   if(!boxClear(s.x,s.z,s.turn)||!catClear(x,y,z))return false;
   controller.place(world(x,y,z));last=controller.position.clone();engaged=true;turnWish=0;return true;
  },
  release,
  // Each frame while held, after the walk has worked out its wish: the push or pull along the heading, at `speed`, and
  // the turn, kept for after(). No running, jumping or the grapple's hold.
  steer(k,wish,dt,speed){
   k.run=k.jump=k.held=false;turnWish=-k.x*PUSH.turn*dt;
   const f=fwd(this.yaw);wish.set(f[0],0,f[1]).multiplyScalar(Math.max(-1,Math.min(1,k.y))*speed);
  },
  // After the walk's step: take the step if the box is clear, or put the cat back and try just the turn.
  after(controller){
   if(!engaged)return;
   const p=controller.position;
   // Anything else that moved the cat far (a teleport, a lift, Respawn) lets go.
   if(p.distanceToSquared(last)>.36){release();return;}
   sync();const s=trolley.state,now=local(p),was=local(last);
   // The step as taken, then without the turn, then sliding along one of the room's axes (the dividers and the zone edge
   // lie along them), then not moving at all.
   const t1=s.turn+turnWish;
   for(const [x,z,t] of [[now.x,now.z,t1],[now.x,now.z,s.turn],[now.x,was.z,t1],[was.x,now.z,t1],[was.x,was.z,t1],[was.x,was.z,s.turn]]){
    const bx=x+Math.sin(t)*PUSH.hold,bz=z+Math.cos(t)*PUSH.hold,moved=x!==now.x||z!==now.z;
    if(!boxClear(bx,bz,t)||(moved&&!catClear(x,was.y,z)))continue;
    if(moved)controller.place(world(x,was.y,z));
    trolley.place(bx,bz,t);last=controller.position.clone();return;
   }
   // Not even where it was is clear (the world changed under it): let go.
   release();
  },
  // The parked trolley is solid to walk into: out of its box, as the hamster ball's shell is.
  push(p,radius){
   if(engaged)return;
   sync();const s=trolley.state,l=local(p),dx=l.x-s.x,dz=l.z-s.z,[sx,cz]=fwd(s.turn);
   if(l.y<-.5||l.y>TROLLEY_BOX[1])return;
   // In the box's own axes: u across (the box's x axis), v along it.
   const u=dx*cz-dz*sx,v=dx*sx+dz*cz,cu=Math.max(-HALF[0],Math.min(HALF[0],u)),cv=Math.max(-HALF[1],Math.min(HALF[1],v));
   let nu=u-cu,nv=v-cv,d=Math.hypot(nu,nv);
   if(d>=radius)return;
   // Centre inside the box: out through the nearest face.
   if(d<1e-6){const gu=HALF[0]-Math.abs(u),gv=HALF[1]-Math.abs(v);if(gu<gv){nu=Math.sign(u)||1;nv=0;d=-gu;}else{nu=0;nv=Math.sign(v)||1;d=-gv;}}else{nu/=d;nv/=d;}
   const out=radius-d;p.addScaledVector(new T.Vector3(nu*cz+nv*sx,0,-nu*sx+nv*cz).transformDirection(toWorld),out);
  },
  // R: the trolley back to its first spot, Cosmo put behind its handle on clear floor, and let go.
  reset(controller){
   sync();const y=local(controller.position).y;
   release();trolley.place(start.x,start.z,start.turn);
   for(const back of [PUSH.hold,PUSH.hold+.4,PUSH.hold+.8,PUSH.hold+1.2]){const [x,z]=standAt(start.x,start.z,start.turn,back);
    if(catClear(x,y,z)){controller.place(world(x,y,z));return true;}}
   return false;
  },
 };
}
