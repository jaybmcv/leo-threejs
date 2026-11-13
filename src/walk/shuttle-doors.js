import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import layout from '../plan/selected-layout.js';

// Deck 2's seated shuttle cabins (from tester feedback): a thin casing round each cabin's open entrance and two sliding
// leaves on the cabin side of it. The leaves close when nobody is near and open as a cat approaches from either side;
// the clear opening, the glass and the seats are untouched, and nothing here collides: a leaf that stuck or a failed
// update leaves the way through as it was. Each visitor's page moves its own doors from its own cat.
export const DECK=2,HALF=.9,HEIGHT=3.08,CASING=.09,DEEP=.14,LEAF=.05,LEAF_AT=.1;
// How far from the doorway a cat opens it: along the wall, out into the walkway, and in among the seats. A moving cat
// opens it that much earlier (its speed times the time a leaf takes), so a run still finds the way open.
export const REACH={along:1.5,outside:3.2,inside:2.4,above:2.5},HOLD=.8,OPEN_TIME=.45,CLOSE_TIME=.7,SLIDE=HALF*1.05;
const casingMaterial=new T.MeshStandardMaterial({name:'V2_shuttle_door_casing',color:0x52666c,roughness:.8,metalness:0});
const leafMaterial=new T.MeshStandardMaterial({name:'V2_shuttle_door_leaf',color:0x8b9da6,roughness:.55,metalness:.3});
const ease=t=>t*t*(3-2*t);
// The doorways: the cabin's near end, where its wall is left open (model.js), with the way into the cabin.
export function shuttleDoorways(shuttles=layout.shuttles){const out=[];
 for(const s of shuttles){if(s.deck!==DECK||!s.hullEnvelope)continue;
  const a=s.polygon[3],b=s.polygon[0],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1)continue;
  const m=[(a[0]+b[0])/2,(a[1]+b[1])/2],ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
  // Local x runs along the wall, local z into the cabin.
  let yaw=Math.atan2(-uz,ux);if((-uz)*(s.center[0]-m[0])+ux*(s.center[2]-m[1])<0)yaw+=Math.PI;
  out.push({id:s.id,x:m[0],y:s.y,z:m[1],yaw});}
 return out;}
export function createShuttleDoors(toBand,doorways=shuttleDoorways()){
 if(!doorways.length)return null;
 const group=new T.Group(),y0=doorways[0].y;group.name='V2_shuttle_doors';group.position.y=y0;
 const box=(w,h,d,x,y,z)=>new T.BoxGeometry(w,h,d).translate(x,y,z);
 // Casing: two jambs and a head, as deep as the glass and its trim, standing on the floor with a flush bottom edge.
 const jambs=[-1,1].map(s=>box(CASING,HEIGHT+.02,DEEP,s*(HALF+CASING/2),HEIGHT/2-.01,0)),head=box(HALF*2+CASING*2,.12,DEEP,0,HEIGHT+.06,0),frame=mergeGeometries([...jambs,head]);
 const m4=new T.Matrix4(),parts=[];
 for(const d of doorways){const g=frame.clone();m4.makeRotationY(d.yaw).setPosition(d.x,d.y-y0,d.z);g.applyMatrix4(m4);parts.push(g);}
 const casing=new T.Mesh(mergeGeometries(parts),casingMaterial);casing.name='V2_shuttle_door_casings';casing.userData.noCollide=true;group.add(casing);
 parts.forEach(g=>g.dispose());
 // Two leaves a doorway, each just over half the opening so they meet in the middle; the geometry is shared.
 const w=HALF+.03,leafGeo=box(w,HEIGHT,LEAF,0,HEIGHT/2,0),doors=[];
 for(const d of doorways){const root=new T.Group();root.name='V2_shuttle_door_'+d.id;root.position.set(d.x,d.y-y0,d.z);root.rotation.y=d.yaw;
  const leaves=[-1,1].map(s=>{const o=new T.Mesh(leafGeo,leafMaterial);o.name='V2_shuttle_door_leaf';o.userData.noCollide=true;o.position.set(s*w/2,0,LEAF_AT);root.add(o);return {o,s};});
  group.add(root);doors.push({...d,root,leaves,open:0,target:0,hold:0,cos:Math.cos(d.yaw),sin:Math.sin(d.yaw)});}
 toBand(group);
 let broken=false;
 const place=d=>{const e=ease(d.open);for(const {o,s} of d.leaves)o.position.x=s*(w/2+SLIDE*e)};
 let lastX=NaN,lastZ=NaN;
 const inside=(d,p,ahead)=>{const dx=p.x-d.x,dz=p.z-d.z,lx=dx*d.cos-dz*d.sin,lz=dx*d.sin+dz*d.cos;
  return Math.abs(p.y-d.y)<REACH.above&&Math.abs(lx)<REACH.along+ahead&&lz>-REACH.outside-ahead&&lz<REACH.inside+ahead;};
 return {group,doors,casing,
  // Steps every doorway. Only doorways with the cat near, or still moving, do any work.
  update(dt,p){if(broken)return;try{
   // Speed from the last frame; a jump of several metres is a teleport or a fall, not walking.
   const step=Math.hypot(p.x-lastX,p.z-lastZ),ahead=dt>0&&step<4?Math.min(12,step/dt)*OPEN_TIME:0;lastX=p.x;lastZ=p.z;
   for(const d of doors){const near=inside(d,p,ahead);
    if(near){d.hold=HOLD;d.target=1;}else if(d.hold>0){d.hold-=dt;if(d.hold<=0)d.target=0;}
    if(d.open===d.target)continue;
    const step=dt/(d.target?OPEN_TIME:CLOSE_TIME);d.open=d.target?Math.min(1,d.open+step):Math.max(0,d.open-step);place(d);}
  }catch(e){broken=true;for(const d of doors)d.root.visible=false;console.warn('shuttle doors stopped',e);}},
  get broken(){return broken;},
  // The doorways' state for tests: 0 shut to 1 wide.
  state(){return doors.map(d=>({id:d.id,open:d.open,target:d.target}));}};
}
