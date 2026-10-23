import * as T from 'three';
import {BODY} from './collision.js';

// A big neon pink ball of yarn in a corner of the Deck 2 arrival hall, there to be pushed about. Walking into it shoves
// it ahead of the walker; it rolls, slows on the floor, bounces off walls and furniture and drops down stairs. Lost
// below the decks, or on a respawn, it goes back to its corner. Each visitor has their own; Leo live does not share it.
export const YARN={home:[-139.9,-35.7,-22.1],radius:.55,kick:1.15,roll:1.6,bounce:.4,gravity:22};
const STEP=1/120;

export function createYarn(colliders){
 const r=YARN.radius,home=new T.Vector3(YARN.home[0],YARN.home[1]+r+.01,YARN.home[2]);
 const ball=new T.Group();ball.name='Walk_yarn_ball';
 const pink=new T.MeshStandardMaterial({name:'Walk_yarn',color:0xff3fb4,emissive:0xff1f9a,emissiveIntensity:.55,roughness:.85});
 const strand=new T.MeshStandardMaterial({name:'Walk_yarn_strand',color:0xff7acb,emissive:0xff3fb0,emissiveIntensity:.6,roughness:.9});
 ball.add(new T.Mesh(new T.SphereGeometry(r,32,20),pink));
 // Wound strands: thin rings at many angles over the core.
 let seed=4471;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const ring=new T.TorusGeometry(r*1.005,.022,5,56);
 for(let i=0;i<14;i++){const m=new T.Mesh(ring,strand);m.rotation.set(random()*Math.PI,random()*Math.PI,0);ball.add(m);}
 // A loose end trailing onto the floor.
 const tail=new T.CatmullRomCurve3([new T.Vector3(0,-.1,r),new T.Vector3(.12,-.4,r+.12),new T.Vector3(.05,-r+.03,r+.4),new T.Vector3(.3,-r+.03,r+.75)]);
 ball.add(new T.Mesh(new T.TubeGeometry(tail,24,.022,5),strand));
 const position=ball.position.copy(home),velocity=new T.Vector3(),seg=new T.Line3(new T.Vector3(),new T.Vector3()),ray=new T.Ray(),
  n=new T.Vector3(),wall=new T.Vector3(),axis=new T.Vector3(),spin=new T.Quaternion();
 let grounded=false,acc=0;
 function reset(){position.copy(home);velocity.set(0,0,0);}
 // Push the ball away from the walker (its feet `p`, velocity `v`); if the ball cannot give way, the walker is held back.
 function shove(p,v,move){
  if(p.y>position.y+r-.1||p.y+BODY.height<position.y-r)return;
  n.set(position.x-p.x,0,position.z-p.z);const d=n.length(),reach=r+BODY.radius;if(d>=reach)return;
  if(d<1e-4)n.set(1,0,0);else n.divideScalar(d);
  const gap=reach-d;
  if(move){position.addScaledVector(n,gap);const into=(v.x*n.x+v.z*n.z)*YARN.kick,along=velocity.x*n.x+velocity.z*n.z;if(into>along){velocity.x+=n.x*(into-along);velocity.z+=n.z*(into-along);}}
  else{p.addScaledVector(n,-gap);const into=v.x*n.x+v.z*n.z;if(into>.2)pressed=true;if(into>0){v.x-=n.x*into;v.z-=n.z*into;}}
 }
 // Held against a wall or into a corner for a moment, the ball squirts out to the most open side, rolling past the
 // walker's feet if it must (no shoving while it gets clear), so it never sticks.
 const side=new T.Vector3(),DIRS=Array.from({length:8},(_,i)=>new T.Vector3(Math.cos(i*Math.PI/4),0,Math.sin(i*Math.PI/4)));
 let pressed=false,held=0,loose=0;
 function squirt(){
  let best=-1;
  for(const dir of DIRS){if(dir.dot(n)>.3)continue;ray.origin.copy(position);ray.direction.copy(dir);
   const d=Math.min(3,colliders.raycast(ray,3)?.distance??3)-(dir.dot(n)<-.8?1:0);if(d>best){best=d;side.copy(dir);}}
  if(best<r+.1)return;
  velocity.x=side.x*2.5;velocity.z=side.z*2.5;loose=.6;held=0;
 }
 function step(dt){
  if(!grounded)velocity.y=Math.max(-30,velocity.y-YARN.gravity*dt);
  position.addScaledVector(velocity,dt);
  seg.start.set(position.x,position.y-.01,position.z);seg.end.set(position.x,position.y+.01,position.z);
  const push=colliders.resolve(seg,r);
  if(push.lengthSq()>1e-12){position.add(push);wall.copy(push).normalize();const into=velocity.dot(wall);if(into<0)velocity.addScaledVector(wall,-(1+YARN.bounce)*into);}
  // The floor: a short ray down from the centre.
  ray.origin.copy(position);ray.direction.set(0,-1,0);const g=velocity.y>.5?null:colliders.raycast(ray,r+.08);
  grounded=!!g&&g.normal.y>.7;
  if(grounded){position.y=g.point.y+r;velocity.y=0;const s=Math.hypot(velocity.x,velocity.z),k=s>1e-6?Math.max(0,s-YARN.roll*dt)/s:0;velocity.x*=k;velocity.z*=k;}
 }
 // `walker` is {position, velocity} of the walker's feet, or null while it sits, lies or rides a lift.
 function update(dt,walker){
  acc+=dt;loose=Math.max(0,loose-dt);if(loose)walker=null;
  while(acc>=STEP){acc-=STEP;if(walker)shove(walker.position,walker.velocity,true);step(STEP);}
  pressed=false;if(walker)shove(walker.position,walker.velocity,false);
  held=pressed?held+dt:0;if(held>.35)squirt();
  if(position.y<home.y-12)reset();
  // Rolling: turn about the axis across the motion, by the distance covered over the radius.
  const s=Math.hypot(velocity.x,velocity.z);
  if(s>1e-3&&dt>0){axis.set(velocity.z,0,-velocity.x).divideScalar(s);spin.setFromAxisAngle(axis,s*dt/r);ball.quaternion.premultiply(spin);}
 }
 return {mesh:ball,update,reset,get position(){return position;},get velocity(){return velocity;}};
}
