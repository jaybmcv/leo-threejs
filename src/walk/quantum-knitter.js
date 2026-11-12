import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {mergeByMaterial} from './merge-by-material.js';

// The decorative quantum knitter in the Aft maintenance workshop's aft-starboard corner. Its solid plinth is a room
// fit-out part (`knitter_plinth`); this is the machine on it. Everything it moves stays inside REACH metres of the
// plinth's centre, so the whole machine, arms included, fits a 2.1 m square footprint round the plinth's `at`.
export const KNITTER_REACH=1.1;
export const KNITTER_TOP=.5,BALL_Y=2.3;
const ARMS=4,L1=.7,L2=.7,SHOULDER_Y=1.58,SHOULDER_R=.22,BALL_R=.4;
const UP=new T.Vector3(0,1,0);

export function createQuantumKnitter(parent,[x,z]){
 const group=new T.Group();group.name='Quantum_knitter';group.position.set(x,0,z);parent.add(group);
 const steel=new T.MeshStandardMaterial({color:0x61777b,metalness:.65,roughness:.4});
 const dark=new T.MeshStandardMaterial({color:0x182a30,metalness:.45,roughness:.5});
 const brass=new T.MeshStandardMaterial({color:0xb88e50,metalness:.6,roughness:.4});
 const glow=color=>new T.MeshBasicMaterial({color,toneMapped:false});
 const cyan=glow(0x51ecf5),magenta=glow(0xff58d2),orange=glow(0xffad50);
 const mesh=(geo,mat,at,root=group)=>{const o=new T.Mesh(geo,mat);o.position.set(...at);root.add(o);return o;};
 const ring=(r,t,y,mat)=>{const o=mesh(new T.TorusGeometry(r,t,6,40),mat,[0,y,0]);o.rotation.x=Math.PI/2;return o;};
 // The base: a turntable plate with an inlaid ring, a mast with two collars, and the hub the four arms hang from.
 mesh(new T.CylinderGeometry(.92,.92,.04,28),dark,[0,KNITTER_TOP+.02,0]);
 ring(.78,.012,KNITTER_TOP+.045,cyan);ring(.5,.012,KNITTER_TOP+.045,orange);
 mesh(new T.CylinderGeometry(.14,.2,1.04,14),steel,[0,KNITTER_TOP+.54,0]);
 for(const y of [.8,1.3])ring(.2,.03,y,brass);
 mesh(new T.CylinderGeometry(.25,.25,.12,18),brass,[0,SHOULDER_Y+.02,0]);
 mesh(new T.CylinderGeometry(.03,.03,BALL_Y-SHOULDER_Y,6),dark,[0,(BALL_Y+SHOULDER_Y)/2,0]);
 // Light strips along the plinth's four faces (the plinth is 2 m square).
 for(let i=0;i<4;i++){const a=i*Math.PI/2,o=mesh(new T.BoxGeometry(1.5,.035,.02),i%2?orange:cyan,[Math.sin(a)*1.012,.3,Math.cos(a)*1.012]);o.rotation.y=a;}
 mesh(new T.SphereGeometry(.22,12,10),dark,[0,BALL_Y,0]);mesh(new T.SphereGeometry(.12,10,8),orange,[0,BALL_Y,0]);
 mergeByMaterial(group);
 // The ball: three sets of tilted rings in cyan, magenta and orange, each turning at its own slow rate so they interlace.
 const sets=[[cyan,[[.3,.2,.5],[1.1,.6,1.9],[2.1,1.3,.2],[.7,2.4,1.1]],.33],[magenta,[[.9,.1,1.2],[1.7,.9,.4],[2.5,.4,2.2]],-.27],[orange,[[.2,1.1,2.4],[1.4,2.0,1.0]],.21]].map(([mat,tilts,rate],s)=>{
  const geo=mergeGeometries(tilts.map(([a,b,c],i)=>{const g=new T.TorusGeometry(BALL_R-.014*((s+i)%3),.014,4,40);g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(a,b,c)));return g;}));
  const spin=new T.Mesh(geo,mat);spin.name='Knitter_ring_set';spin.position.set(0,BALL_Y,0);group.add(spin);return {spin,rate,tilts};
 });
 // Instanced so each part type is one draw: arm links, joints, strand threads and tip nozzles.
 const instanced=(geo,mat,count)=>{const o=new T.InstancedMesh(geo,mat,count);o.frustumCulled=false;group.add(o);return o;};
 const links=instanced(new T.CylinderGeometry(.04,.04,1,8),steel,ARMS*2);links.name='Knitter_links';
 const joints=instanced(new T.SphereGeometry(1,10,8),brass,ARMS*3);joints.name='Knitter_joints';
 const threads=instanced(new T.CylinderGeometry(.007,.007,1,4),new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),ARMS*2);threads.name='Knitter_threads';
 const tips=instanced(new T.SphereGeometry(.045,8,6),orange,ARMS);tips.name='Knitter_tips';
 const threadColours=[0x51ecf5,0xff58d2,0xffad50,0x51ecf5].map(c=>new T.Color(c));threadColours.forEach((c,i)=>{threads.setColorAt(i*2,c);threads.setColorAt(i*2+1,c);});
 // Each thread is fed from a spot on one of the ball's rings; its anchor is that spot, turned with the ring.
 const anchors=Array.from({length:ARMS},(_,i)=>{const set=sets[i%3],[a,b,c]=set.tilts[0],p=new T.Vector3(BALL_R*Math.cos(i*1.7),BALL_R*Math.sin(i*1.7),0);return {set,local:p.applyEuler(new T.Euler(a,b,c))};});
 const m=new T.Matrix4(),q=new T.Quaternion(),s=new T.Vector3(),mid=new T.Vector3(),dir=new T.Vector3(),pole=new T.Vector3(),
  shoulder=new T.Vector3(),tip=new T.Vector3(),elbow=new T.Vector3(),anchor=new T.Vector3(),sag=new T.Vector3();
 const segment=(mesh,i,a,b,w)=>{dir.subVectors(b,a);const len=dir.length()||1e-3;mid.addVectors(a,b).multiplyScalar(.5);q.setFromUnitVectors(UP,dir.divideScalar(len));m.compose(mid,q,s.set(w,len,w));mesh.setMatrixAt(i,m);};
 const place=(mesh,i,p,r)=>{m.compose(p,q.identity(),s.set(r,r,r));mesh.setMatrixAt(i,m);};
 function update(time){
  for(const {spin,rate} of sets){spin.rotation.set(0,time*rate,Math.sin(time*.3)*.12);}
  for(let i=0;i<ARMS;i++){
   const base=i*Math.PI/2+Math.PI/4,phase=i*Math.PI/2+time*.55;
   shoulder.set(Math.cos(base)*SHOULDER_R,SHOULDER_Y,Math.sin(base)*SHOULDER_R);
   // The tips circle the ball a quarter turn apart, rising and falling on their own beat, so the arms reach across each other.
   const r=.64+.06*Math.sin(time*1.3+i);
   tip.set(Math.cos(phase)*r,BALL_Y+.16*Math.sin(phase*2+i*.9)+.03*Math.sin(time*2.1+i),Math.sin(phase)*r);
   // Two-bone reach: the elbow bends outward from the mast.
   dir.subVectors(tip,shoulder);const d=Math.min(dir.length(),L1+L2-.02);dir.normalize();
   pole.set(Math.cos(base),0,Math.sin(base));pole.addScaledVector(dir,-pole.dot(dir)).normalize();
   const a=(L1*L1-L2*L2+d*d)/(2*d);elbow.copy(shoulder).addScaledVector(dir,a).addScaledVector(pole,Math.sqrt(Math.max(L1*L1-a*a,0)));
   segment(links,i*2,shoulder,elbow,1.5);segment(links,i*2+1,elbow,tip,1.1);
   place(joints,i*3,shoulder,.09);place(joints,i*3+1,elbow,.08);place(joints,i*3+2,tip,.06);place(tips,i,tip,1);
   // The thread hangs a little from tip to ring and sways side to side.
   const set=anchors[i].set;anchor.copy(anchors[i].local).applyEuler(set.spin.rotation).add(sag.set(0,BALL_Y,0));
   sag.crossVectors(sag.subVectors(anchor,tip),UP).normalize().multiplyScalar(.05*Math.sin(time*2.4+i*1.6));sag.y-=.04;
   mid.addVectors(tip,anchor).multiplyScalar(.5).add(sag);elbow.copy(mid);
   segment(threads,i*2,tip,elbow,1.4);segment(threads,i*2+1,elbow,anchor,1.4);
  }
  for(const o of [links,joints,threads,tips])o.instanceMatrix.needsUpdate=true;
 }
 update(0);
 return {group,update,reach:KNITTER_REACH};
}
