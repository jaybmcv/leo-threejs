import * as T from 'three';
import {toWorld} from '../plan/rooms.js';

// A clear hamster ball for Cosmo. One stands parked in the Deck 17 gardens; E climbs in, and Cosmo, standing upright
// inside, rolls it about the ship at twice a walker's pace, with a low hop on the jump key: through doors, into lifts and up to their buttons, which E still presses. With nothing to
// use in front of the ball, E climbs out and leaves it there. Each visitor has their own ball; others aboard see
// whoever is riding one in a ball of their own (net/wire.js BALL).
// The ball is 2.2 m across, so Cosmo (1.75 m, hat and all) stands in it. Its collision is a sphere of `body.radius` on
// the controller's floating capsule (controller.js), inside the glass so it still passes the lift doors (2.2 m wide).
// `jump` is the take-off speed of one hop: v squared over twice gravity (22) is about 0.6 m, and it has no second hop.
export const BALL={home:toWorld('commons-10',[5.4,0,-5.3]),radius:1.1,speed:8,run:12,eye:1.6,
 body:{radius:.8,height:2,step:.4,maxSlope:50,jump:5,jumps:1}};

const glass=new T.MeshPhysicalMaterial({name:'Walk_hamster_ball',color:0xe8f6ff,roughness:.05,metalness:0,transmission:0,transparent:true,opacity:.2,
 depthWrite:false,side:T.DoubleSide,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.4});
const rim=new T.MeshStandardMaterial({name:'Walk_hamster_ball_rim',color:0xdff4ff,roughness:.2,metalness:.3,transparent:true,opacity:.55});
let shell=null;
function parts(){
 if(shell)return shell;
 const r=BALL.radius;
 // The glass, two seams round it (so the roll reads) and a hatch ring where Cosmo climbs in.
 shell={sphere:new T.SphereGeometry(r,40,24),seam:new T.TorusGeometry(r*1.002,.012,6,72),hatch:new T.TorusGeometry(r*.42,.02,6,40)};
 return shell;
}

// A ball to draw: `mesh` sits on the floor at its feet point; roll(dt, vx, vz) turns it by the ground it covers.
export function createBallMesh(){
 const r=BALL.radius,p=parts(),group=new T.Group();group.name='Walk_hamster_ball';
 const spin=new T.Group();spin.position.y=r;group.add(spin);
 const sphere=new T.Mesh(p.sphere,glass);sphere.renderOrder=2;spin.add(sphere);
 for(const [x,z] of [[0,0],[Math.PI/2,0]]){const m=new T.Mesh(p.seam,rim);m.rotation.set(x,0,z);spin.add(m);}
 const hatch=new T.Mesh(p.hatch,rim);hatch.position.z=Math.sqrt(r*r-(r*.42)**2);spin.add(hatch);
 const axis=new T.Vector3(),q=new T.Quaternion();
 return {mesh:group,
  roll(dt,vx,vz){const s=Math.hypot(vx,vz);if(s<1e-3||dt<=0)return;axis.set(vz,0,-vx).divideScalar(s);spin.quaternion.premultiply(q.setFromAxisAngle(axis,s*dt/r));}};
}
