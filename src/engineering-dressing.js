import * as T from 'three';
import {canvasTexture,seeded,standard,glow} from './polish-kit.js';

// Walk-only dressing for the engineering tour: a stair core at the Deck 8 arrival, and heat-shield bulkheads where the
// drive trains and the pod drive chambers meet the aft walls (the thrusters are on the other side, so those walls read
// as hot, heavy metal: shield plating, sleeves and bolted flanges, a faint glow at each seam).

const box=(g,name,[x0,y0,z0],[x1,y1,z1],material)=>{const m=new T.Mesh(new T.BoxGeometry(x1-x0,y1-y0,z1-z0),material);m.name=name;m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);m.receiveShadow=true;g.add(m);return m;};
const bounds=(root,name)=>{const out=[];root.traverse(o=>{if(o.isMesh&&o.name===name)out.push(new T.Box3().setFromObject(o));});return out;};

function label(text,sub,w=1024,h=256){
 return canvasTexture(w,h,(g)=>{g.fillStyle='#16222d';g.fillRect(0,0,w,h);g.fillStyle='#f85800';g.fillRect(40,h-44,110,6);
  g.fillStyle='#f4f0e8';g.font='600 76px "Archivo", Arial, sans-serif';g.textBaseline='alphabetic';g.fillText(text,40,112);
  g.fillStyle='#a6a5b4';g.font='400 30px "JetBrains Mono", monospace';g.fillText(sub,44,172);});
}
const signMaterial=map=>new T.MeshStandardMaterial({color:0x000000,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.9,roughness:.4});
// A sign on a wall facing +x (the room side), centred at (x, y, z).
function signFacingX(g,x,y,z,width,height,map){const m=new T.Mesh(new T.PlaneGeometry(width,height),signMaterial(map));m.name='Engineering_sign';m.rotation.y=Math.PI/2;m.position.set(x,y,z);g.add(m);return m;}

// Deck 8 arrival: the switchback stair ran through the new floor and ceiling in the open. A walled core with a doorway
// at its landing, a sign over the door, the machinery-hall sign and a teal route band to the entry.
export function dressArrival(g,m,A){
 const S={x0:-174.2,x1:-162.2,z1:-7.2,door:[-173.7,-171.1],doorTop:A.floor+2.5};
 box(g,'Stair_core_wall',[S.x0-.2,A.floor,A.z0],[S.x0,A.ceiling,S.z1+.2],m.wall);
 box(g,'Stair_core_wall',[S.x1,A.floor,A.z0],[S.x1+.2,A.ceiling,S.z1+.2],m.wall);
 box(g,'Stair_core_wall',[S.door[1],A.floor,S.z1],[S.x1,A.ceiling,S.z1+.2],m.wall);
 box(g,'Stair_core_wall',[S.x0,S.doorTop,S.z1],[S.door[1],A.ceiling,S.z1+.2],m.wall);
 box(g,'Stair_core_wall',[S.x0,A.floor,S.z1],[S.door[0],A.ceiling,S.z1+.2],m.wall);
 const sign=new T.Mesh(new T.PlaneGeometry(2.4,.6),signMaterial(label('Stairs','DECKS 4 – 17')));sign.name='Engineering_sign';sign.position.set((S.door[0]+S.door[1])/2,S.doorTop+.45,S.z1+.21);g.add(sign);
 signFacingX(g,-177.85,A.floor+2.2,6.2,3.6,.9,label('Engineering','DECK 8 · MACHINERY HALL →'));
 box(g,'Engineering_route_band',[-177.5,A.floor+.04,-.18],[-150,A.floor+.055,.18],standard(0x2fd6c5,{emissive:0x2fd6c5,emissiveIntensity:.12,roughness:.6}));
}

// Dark steel plating with rivets and vent slots, one 6 m tile of four plates.
const shieldPlates=(w,h)=>canvasTexture(1024,1024,(g,cw,ch)=>{
 const rnd=seeded(211);g.fillStyle='#2b3138';g.fillRect(0,0,cw,ch);
 for(let i=0;i<2;i++)for(let j=0;j<2;j++){const x=i*cw/2,y=j*ch/2,t=40+rnd()*10;g.fillStyle=`rgb(${t+10},${t+16},${t+24})`;g.fillRect(x+6,y+6,cw/2-12,ch/2-12);
  g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x,y,cw/2,6);g.fillRect(x,y,6,ch/2);
  g.fillStyle='#8a939c';for(let k=0;k<10;k++){for(const [px,py] of [[x+22+k*48,y+22],[x+22+k*48,y+ch/2-22],[x+22,y+22+k*48],[x+cw/2-22,y+22+k*48]]){g.beginPath();g.arc(px,py,5,0,Math.PI*2);g.fill();}}
  if((i+j)%2===0){for(let s=0;s<9;s++){g.fillStyle='#101418';g.fillRect(x+110+s*34,y+150,16,210);g.fillStyle='rgba(180,190,200,.35)';g.fillRect(x+110+s*34,y+150,16,3);}}
 }
},[w/6,h/6]);
const hazard=()=>canvasTexture(512,64,(g,w,h)=>{g.fillStyle='#f2b01e';g.fillRect(0,0,w,h);g.fillStyle='#16181b';for(let x=-h;x<w;x+=64){g.beginPath();g.moveTo(x,h);g.lineTo(x+32,h);g.lineTo(x+32+h,0);g.lineTo(x+h,0);g.fill();}},[1,1]);
// Heat-tempered steel along a sleeve: blue and straw at the hot wall end, bright steel away from it.
const temper=()=>canvasTexture(64,512,(g,w,h)=>{const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#8e969e');grad.addColorStop(.55,'#9a8f78');grad.addColorStop(.8,'#b48a4a');grad.addColorStop(.92,'#5a4f8a');grad.addColorStop(1,'#3d4f86');g.fillStyle=grad;g.fillRect(0,0,w,h);},[1,1]);
const sleeveMaterial=()=>new T.MeshStandardMaterial({map:temper(),metalness:.75,roughness:.35});
const flangeMaterial=standard(0x3a4148,{metalness:.8,roughness:.4});
const seamGlow=new T.MeshStandardMaterial({color:0xff7a2a,emissive:0xff5a10,emissiveIntensity:1.6,roughness:.6});

// A shield face on a wall at `x` whose room side is +x, spanning the wall's z and y bounds, with a hazard band at the base.
function shieldWall(g,x,b,door){
 const w=b.max.z-b.min.z,h=b.max.y-b.min.y,plate=new T.Mesh(new T.PlaneGeometry(w,h),standard(0xffffff,{map:shieldPlates(w,h),metalness:.6,roughness:.5}));
 plate.name='Heat_shield_plating';plate.rotation.y=Math.PI/2;plate.position.set(x+.06,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2);g.add(plate);
 const bandMap=hazard();bandMap.repeat.set(w/4,1);
 const band=new T.Mesh(new T.PlaneGeometry(w,.7),standard(0xffffff,{map:bandMap,roughness:.7}));band.name='Heat_shield_hazard_band';band.rotation.y=Math.PI/2;band.position.set(x+.08,b.min.y+.35,(b.min.z+b.max.z)/2);g.add(band);
 if(!door)return;
 box(g,'Blast_door',[x+.06,door.y0,door.z0],[x+.22,door.y1,door.z1],standard(0x4a525a,{metalness:.7,roughness:.4}));
 const edge=standard(0xffffff,{map:hazard(),roughness:.7});box(g,'Blast_door_frame',[x+.06,door.y1,door.z0-.25],[x+.26,door.y1+.25,door.z1+.25],edge);
 for(const z of [door.z0-.25,door.z1])box(g,'Blast_door_frame',[x+.06,door.y0,z],[x+.26,door.y1,z+.25],edge);
}
// Where a drive cylinder (axis along x) meets the wall at `x`: a tempered sleeve out to `reach`, a bolted wall flange,
// a glowing seam, and a collar ring where the sleeve meets the cylinder.
function sleeve(g,x,cyl,reach){
 const c=cyl.getCenter(new T.Vector3()),r=(cyl.max.y-cyl.min.y)/2,len=Math.max(1.2,reach-x);
 const s=new T.Mesh(new T.CylinderGeometry(r*1.06,r*1.12,len,40,1,true),sleeveMaterial());s.name='Drive_thermal_sleeve';s.rotation.z=-Math.PI/2;s.position.set(x+len/2,c.y,c.z);g.add(s);
 const flange=new T.Mesh(new T.CylinderGeometry(r*1.42,r*1.42,.35,40),flangeMaterial);flange.name='Drive_wall_flange';flange.rotation.z=-Math.PI/2;flange.position.set(x+.25,c.y,c.z);g.add(flange);
 const seam=new T.Mesh(new T.TorusGeometry(r*1.13,.07,8,48),seamGlow);seam.name='Drive_hot_seam';seam.rotation.y=Math.PI/2;seam.position.set(x+.45,c.y,c.z);g.add(seam);
 const collar=new T.Mesh(new T.TorusGeometry(r*1.09,.16,10,48),flangeMaterial);collar.name='Drive_collar';collar.rotation.y=Math.PI/2;collar.position.set(x+len,c.y,c.z);g.add(collar);
 const bolts=new T.InstancedMesh(new T.CylinderGeometry(.07,.07,.2,8),standard(0x9aa3ab,{metalness:.8,roughness:.3}),24),mtx=new T.Matrix4(),q=new T.Quaternion().setFromEuler(new T.Euler(0,0,-Math.PI/2)),one=new T.Vector3(1,1,1);
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;bolts.setMatrixAt(i,mtx.compose(new T.Vector3(x+.5,c.y+Math.sin(a)*r*1.3,c.z+Math.cos(a)*r*1.3),q,one));}
 bolts.name='Drive_flange_bolts';bolts.instanceMatrix.needsUpdate=true;bolts.computeBoundingSphere();g.add(bolts);
}

export function dressDriveBulkheads(g,root){
 // Machinery hall: the three drive trains stop short of the aft bulkhead.
 const hall=bounds(root,'Machinery_aft_bulkhead');
 if(hall.length){const b=hall.reduce((a,c)=>a.union(c),new T.Box3()),x=b.max.x;
  shieldWall(g,x,b,{z0:-2,z1:2,y0:b.min.y,y1:-8.6});
  for(const t of bounds(root,'Central_drive_train'))sleeve(g,x,t,t.min.x+.8);}
 // Engine pods: each drive chamber runs into its pod's aft enclosure.
 for(const b of bounds(root,'Pod_aft_enclosure')){const x=b.max.x;shieldWall(g,x,b);
  for(const c of bounds(root,'Pod_drive_chamber'))if(c.max.z>b.min.z&&c.min.z<b.max.z)sleeve(g,x,c,x+1.6);}
}
