import * as T from 'three';

// Every seat and bed aboard, found by name in the built interior (and through the instance transforms of the repeated
// cabins and lifeboat seating). A seat spot is a point on a seat's top with the way a sitter faces; benches and sofas
// get a spot every 0.65 m. A bed spot is the mattress top with the head toward the pillow.
const SEAT=/^(Repeated_)?(Seat|Seat_cushion|Soft_seat|Passenger_bench|Garden_bench_cushion|Low_bench|Reading_bench|Shelter_bench|Airlock_preparation_bench|Bench_cushion|Child_stool|Meditation_cushion|Crown_bar_stool_seat|Crown_curved_banquette_seat|Gaming_curved_couch_seat|Atrium_curved_seat|Evacuation_seat|Forum_audience_seat|Crew_seat|Captain_command_seat|Command_chair_seat|Chair)$/;
// Parts that sit under a cushion: used only where no cushion covers them.
const SEAT_BASE=/^(Seat_base|Garden_bench|Passenger_bench_seat)$/;
const BACK=/(^|_)(Back|back)$|_back_|Seat_back|Bench_back|banquette_back/;
const BED=/^(Repeated_)?(Single_mattress|Mattress|Hammock)$/;
const PILLOW=/^(Repeated_)?Pillow$/;
export const SPACING=.65;
const worldVisible=o=>{for(let p=o;p;p=p.parent)if(!p.visible&&!p.userData.baked)return false;return true;};

// Oriented top face of a mesh (or one instance): centre, the two plan axes with their half lengths, and the top height.
function topFace(o,matrix){
 const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox;
 const c=b.getCenter(new T.Vector3()).setY(b.max.y).applyMatrix4(matrix);
 const ax=new T.Vector3().setFromMatrixColumn(matrix,0).multiplyScalar((b.max.x-b.min.x)/2),az=new T.Vector3().setFromMatrixColumn(matrix,2).multiplyScalar((b.max.z-b.min.z)/2);
 ax.y=0;az.y=0;return {c,ax,az};
}
const instances=o=>Array.from({length:o.count},(_,i)=>{const m=new T.Matrix4();o.getMatrixAt(i,m);return m.premultiply(o.matrixWorld);});

export function findRestSpots(root){
 root.updateMatrixWorld(true);
 const seats=[],bases=[],backs=[],beds=[],pillows=[];
 root.traverse(o=>{
  if(!o.isMesh||!worldVisible(o))return;
  const list=SEAT.test(o.name)?seats:SEAT_BASE.test(o.name)?bases:BED.test(o.name)?beds:PILLOW.test(o.name)?pillows:BACK.test(o.name)?backs:null;if(!list)return;
  for(const m of o.isInstancedMesh?instances(o):[o.matrixWorld])list.push({o,face:topFace(o,m),m});
 });
 // Backs and pillows by plan position, for facing.
 const grid=new Map(),cell=p=>`${Math.floor(p.x/2)},${Math.floor(p.y/2)},${Math.floor(p.z/2)}`;
 const index=(list,kind)=>{for(const it of list){it.kind=kind;const k=cell(it.face.c);(grid.get(k)||grid.set(k,[]).get(k)).push(it);}};
 index(backs,'back');index(pillows,'pillow');index(seats,'seat');
 const near=(p,kind,r)=>{let best=null,bd=r;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)for(const it of grid.get(`${Math.floor(p.x/2)+i},${Math.floor(p.y/2)+j},${Math.floor(p.z/2)+k}`)||[]){if(it.kind!==kind)continue;const d=it.face.c.distanceTo(p);if(d<bd){bd=d;best=it;}}return best;};
 const spots=[];
 const seatSpots=(it)=>{
  const {c,ax,az}=it.face,lx=ax.length(),lz=az.length();if(lx<.12||lz<.12)return;
  const long=lx>=lz?ax:az,half=long.length(),dir=long.clone().normalize();
  const back=near(c,'back',1.1);
  let facing=null;
  // Face along whichever seat axis points away from the back: a chair can be deeper than it is wide.
  if(back){const away=c.clone().sub(back.face.c);away.y=0;const nx=ax.clone().normalize(),nz=az.clone().normalize(),n=Math.abs(nx.dot(away))>=Math.abs(nz.dot(away))?nx:nz;facing=n.multiplyScalar(Math.sign(n.dot(away))||1);}
  const count=half*2>1.25?Math.max(1,Math.floor((half*2-.15)/SPACING)):1;
  for(let i=0;i<count;i++){const t=count===1?0:(-(count-1)/2+i)*SPACING;spots.push({kind:'sit',point:c.clone().addScaledVector(dir,t),facing,height:c.y,instanced:it.o.isInstancedMesh});}
 };
 // A curved banquette rings its table: spots follow the arc between the front edge and the back, facing the table. A
 // curved seat round a planter has its back on the inside instead (the arrival hall's, arrival-atrium.js): it faces out.
 const plan=(o,m,O)=>{const p=o.geometry.attributes.position,v=new T.Vector3(),out=[];for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);out.push([v.x-O.x,v.z-O.z]);}return out;};
 const arcSpots=(it)=>{
  const O=new T.Vector3().setFromMatrixPosition(it.m),c=it.face.c,mid=Math.atan2(c.z-O.z,c.x-O.x);
  let rIn=Infinity,rOut=0,a0=Infinity,a1=-Infinity;
  for(const [x,z] of plan(it.o,it.m,O)){const r=Math.hypot(x,z),a=Math.atan2(z,x)-mid,d=Math.atan2(Math.sin(a),Math.cos(a));rIn=Math.min(rIn,r);rOut=Math.max(rOut,r);a0=Math.min(a0,d);a1=Math.max(a1,d);}
  const back=near(c,'back',1.1);let rBack=rOut;
  if(back)for(const [x,z] of plan(back.o,back.m,O))rBack=Math.min(rBack,Math.hypot(x,z));
  const out=rBack<rIn,r=out?(rIn+rOut)/2:(rIn+Math.min(rBack,rOut))/2,end=.35/r,span=a1-a0-2*end;if(span<=0)return;
  const count=Math.max(1,Math.floor(span*r/SPACING)+1),step=count>1?span/(count-1):0;
  for(let i=0;i<count;i++){const a=mid+a0+end+(count>1?i*step:span/2),dir=new T.Vector3(Math.cos(a),0,Math.sin(a));
   spots.push({kind:'sit',point:O.clone().addScaledVector(dir,r).setY(c.y),facing:out?dir:dir.negate(),height:c.y});}
 };
 for(const it of seats)(/curved/i.test(it.o.name)&&!it.o.isInstancedMesh?arcSpots:seatSpots)(it);
 // A base counts only where no cushion or seat already covers it.
 for(const it of bases)if(!near(it.face.c.clone().setY(it.face.c.y+.15),'seat',.5))seatSpots(it);
 for(const it of beds){
  const {c,ax,az}=it.face,long=ax.length()>=az.length()?ax:az;const pillow=near(c,'pillow',1.4);
  let head=long.clone().normalize();if(pillow&&pillow.face.c.clone().sub(c).dot(head)<0)head.negate();
  // A hammock (the Hydro-Nip Lounge's dome) hangs from its rim: you lie in the bottom of its sag, which is the mesh's
  // own origin less the sag, and it can swing (the walk's lounge.js), so the spot keeps the mesh.
  if(it.o.name==='Hammock'){const b=it.o.geometry.boundingBox,low=c.clone();low.y=new T.Vector3(0,b.min.y,0).applyMatrix4(it.m).y;
   if(it.o.userData.head){head=new T.Vector3(...it.o.userData.head).transformDirection(it.m);head.y=0;head.normalize();}
   spots.push({kind:'lie',point:low,head,length:long.length()*2,height:low.y,hammock:it.o});continue;}
  spots.push({kind:'lie',point:c.clone(),head,length:long.length()*2,height:c.y});
 }
 return spots;
}

// Spots near a point, from a plan grid of all spots.
export function spotIndex(spots){
 const grid=new Map(),key=(x,z)=>`${Math.floor(x/3)},${Math.floor(z/3)}`;
 for(const s of spots){const k=key(s.point.x,s.point.z);(grid.get(k)||grid.set(k,[]).get(k)).push(s);}
 return {
  // The best spot within `reach` of p (same level), preferring the one the walker faces.
  pick(p,forward,reach=1.5){
   let best=null,bs=Infinity;
   for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const s of grid.get(`${Math.floor(p.x/3)+i},${Math.floor(p.z/3)+j}`)||[]){
    if(s.height<p.y-.2||s.height>p.y+1.2)continue;
    const dx=s.point.x-p.x,dz=s.point.z-p.z,d=Math.hypot(dx,dz);if(d>reach)continue;
    const score=d-.5*(d>1e-3?(dx*forward.x+dz*forward.z)/d:1);if(score<bs){bs=score;best=s;}
   }
   return best;
  },
  // The hammock a body lying at p is in (main.js settle puts it half a body from the spot, toward the feet), or null.
  // Others aboard are only sent that they lie, so this is how their page knows a hammock from a bed (remotes.js).
  hammockAt(p,reach=1.2){
   for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const s of grid.get(`${Math.floor(p.x/3)+i},${Math.floor(p.z/3)+j}`)||[])
    if(s.hammock&&Math.abs(s.height+.13-p.y)<.4&&Math.hypot(s.point.x-p.x,s.point.z-p.z)<reach)return s;
   return null;
  },
  count:spots.length,
 };
}

// Keep spots that really have a seat or mattress under them (a curved banquette's plan centre is in the air). An
// instanced seat is its own proof: the lifeboat seating isn't in the colliders, so a ray there has nothing to hit.
export function solidSpots(spots,colliders){
 const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0));
 return spots.filter(s=>{if(s.instanced)return true;ray.origin.set(s.point.x,s.height+.3,s.point.z);const hit=colliders.raycast(ray,.45);return hit&&Math.abs(hit.point.y-s.height)<.12;});
}
