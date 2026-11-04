import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {Controller} from '../src/walk/controller.js';
import {Controller as AuthoringController} from '../src/walk/controller.authoring.js';
import {Colliders,BODY} from '../src/walk/collision.js';
import {BALL_BOUNCE,ballBounce,ballDismount} from '../src/walk/ball-bounce.js';

const dt=1/120,y=24.3,body={...BODY,radius:.8,jump:5,jumps:1},zero=new T.Vector3();
function world(boxes=[]){
 const root=new T.Group(),col=new Colliders();
 for(const [size,p]of [[[40,.2,40],[0,y-.1,0]],...boxes]){const m=new T.Mesh(new T.BoxGeometry(...size));m.position.set(...p);root.add(m);}
 col.addStatic(root,()=>true);col.commit();return col;
}
const wall=world([[[.08,4,40],[3,y+2,0]]]),limit=3-.04-body.radius;
for(const C of [Controller,AuthoringController]){
 const start=(col=wall,x=limit-.05)=>{const c=new C(col,body);c.place(new T.Vector3(x,y,0));return c;};
 for(const inside of [false,true])for(const deck of [1,16,17,18,19]){
  const c=start(),profile=ballBounce(inside,deck);c.velocity.x=12;c.step(dt,new T.Vector3(12,0,0),false,profile);
  assert(c.position.x<=limit+1e-5,'thin wall stays solid');assert.equal(c.velocity.y,0,'no upward kick');
  if(inside&&deck===17){assert(c.velocity.x<0);assert(c.speed<=BALL_BOUNCE.maxSpeed+1e-6);}
  else{assert.equal(profile,null);assert.equal(c.velocity.x,0,'ordinary wall slide stays unchanged');}
 }
 const c=start();c.velocity.set(12,0,5);c.step(dt,new T.Vector3(12,0,5),false,BALL_BOUNCE);
 assert(c.velocity.x<0&&c.speed<=2.4+1e-6,'glancing impacts also have a capped total rebound');
 const before=c.position.x,speed=c.speed;c.step(dt,new T.Vector3(12,0,5),false,BALL_BOUNCE);
 assert(c.position.x<before&&c.speed<speed,'held steering cannot cancel the first recoil frame');
 for(let i=0;i<600;i++){c.step(dt,new T.Vector3(12,0,5),false,BALL_BOUNCE);assert(c.position.x<=limit+1e-5);assert(c.speed<=13.01);assert(Math.abs(c.position.y-y)<1e-5);}
 c.place(new T.Vector3(limit-.0001,y,0));c.velocity.x=.2;c.step(dt,new T.Vector3(.2,0,0),false,BALL_BOUNCE);assert.equal(c.bounceS,0,'soft contacts do not chatter');assert(Math.abs(c.velocity.x)<1e-8);
 c.place(new T.Vector3(limit-.05,y,0));c.velocity.x=12;c.step(.1,new T.Vector3(12,0,0),false,BALL_BOUNCE);
 assert(c.velocity.x<0&&c.position.x<limit,'remaining substeps follow the rebound, not the old incoming travel');
 c.place(new T.Vector3(0,y,0));assert.equal(c.bounceS,0);assert.equal(c.speed,0,'placing or teleporting clears recoil');
 const plain=start(world(),0),bouncing=start(world(),0);let top=y;
 for(let i=0;i<180;i++){
  const held=i<35;plain.step(dt,new T.Vector3(1,0,0),held);bouncing.step(dt,new T.Vector3(1,0,0),held,BALL_BOUNCE);
  assert(plain.position.distanceTo(bouncing.position)<1e-8,'open-floor travel and the existing hop are unchanged');top=Math.max(top,bouncing.position.y);
 }
 assert(top>y+.4&&top<y+.65,'the existing single low hop remains');
 const stairs=world([[[1.5,.2,4],[1.25,y+.1,0]],[[1.5,.4,4],[2.75,y+.2,0]],[[1.5,.6,4],[4.25,y+.3,0]]]),walker=start(stairs,0),roller=start(stairs,0);
 for(let i=0;i<360;i++){walker.step(dt,new T.Vector3(1.5,0,0));roller.step(dt,new T.Vector3(1.5,0,0),false,BALL_BOUNCE);assert(walker.position.distanceTo(roller.position)<1e-8);assert.equal(roller.bounceS,0,'ordinary stair risers do not bounce');}
 assert(roller.position.y>y+.5,'the existing step-up behaviour remains');
 const ramp=start();ramp.colliders={resolve:()=>new T.Vector3(-.02,.04,0),raycast:()=>null};ramp.velocity.x=4;
 ramp.step(dt,new T.Vector3(4,0,0),false,BALL_BOUNCE);assert.equal(ramp.bounceS,0,'upward ground/ramp corrections do not rebound');
}

function stand(col,at){
 const p=new T.Vector3(...at),hit=col.raycast(new T.Ray(p.clone().add(new T.Vector3(0,.5,0)),new T.Vector3(0,-1,0)),1);
 if(!hit||hit.normal.y<.7)return null;p.y=hit.point.y;
 const s=new T.Line3(p.clone().add(new T.Vector3(0,BODY.step+BODY.radius,0)),p.clone().add(new T.Vector3(0,BODY.height-BODY.radius,0)));
 return col.overlaps(s,BODY.radius)?null:p;
}
const p=new T.Vector3(0,y,0),reach=1.1+BODY.radius,open=world(),out=ballDismount(p,0,reach,at=>stand(open,at));
assert(out&&out.distanceTo(p)>reach,'dismount clears the parked shell');
const partition=world([[[40,4,.08],[0,y+2,.8]]]),side=ballDismount(p,0,reach,at=>stand(partition,at));
assert(side&&side.z<.8,'dismount cannot skip a thin partition to a clear point beyond it');
const closet=world([[[.1,4,5],[1.2,y+2,0]],[[.1,4,5],[-1.2,y+2,0]],[[5,4,.1],[0,y+2,1.2]],[[5,4,.1],[0,y+2,-1.2]]]);
assert.equal(ballDismount(p,0,reach,at=>stand(closet,at)),null,'an enclosed space chooses the safe fallback');
assert.equal(ballDismount(p,0,reach,()=>null),null,'a gap cannot be used for dismount');
assert.equal(ballDismount(p,0,reach,at=>new T.Vector3(at[0],y+4,at[2])),null,'no dismount onto another deck');

// Exercise the real dismount handler in every page variant without booting its renderer.
for(const suffix of ['', '.public', '.prepared', '.authoring']){
 const source=await fs.readFile('src/walk/main'+suffix+'.js','utf8'),start=source.indexOf('function leaveBall(at=null)'),end=source.indexOf('// The Deck 1 transporters',start),handler=source.slice(start,end);
 assert(start>=0&&end>start);
 const leave=new Function('controller','ball','ballHome','BODY','ballDismount','heading','BALL','findStand','colliders','at',`let inBall=true;${handler}\nleaveBall(at);return inBall;`);
 for(const exit of [out,null]){
  const c=new Controller(open,body);c.place(p);c.velocity.set(-2,0,0);c.bounceS=.18;const ball={mesh:{position:p.clone()}},home=new T.Vector3(10,y,0);
  assert.equal(leave(c,ball,home,BODY,()=>exit,0,{radius:1.1},()=>null,open,null),false);
  assert.equal(c.body,BODY);assert(c.velocity.equals(zero));assert.equal(c.bounceS,0);assert(c.position.distanceTo(exit||p)<1e-5);assert(ball.mesh.position.distanceTo(exit?p:home)<1e-5);
 }
 const c=new Controller(open,body);c.place(p);const ball={mesh:{position:p.clone()}},destination=new T.Vector3(5,y,0),home=new T.Vector3(10,y,0);
 assert.equal(leave(c,ball,home,BODY,()=>{throw Error('teleport must not search for a local dismount');},0,{radius:1.1},()=>null,open,destination),false);assert(c.position.distanceTo(destination)<1e-5);
}
console.log('PASS ball bounce: both controllers, Deck 17 gate, capped/damped impacts, thin walls, soft contacts, unchanged hop and steps, ramp exclusion, safe dismount and all four page handlers');
