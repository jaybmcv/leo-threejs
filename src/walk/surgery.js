import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Deck 5's Surgical suite on foot (from tester feedback): each of the six bays' plain bed and ceiling light gives way
// to a sculpted medical bed and a robot arm hung from the ceiling above it. The bed is a white shell on a dark
// pedestal with a blue glow line round it, a padded mattress, a clear canopy over the head end, a control console at
// the foot and a side screen, with a floating vitals panel beside it. The arm turns and flexes slowly over the bed,
// its tool head lit, the same for every visitor (it follows the clock). The bed stays a bed you can lie on.
// Room frame (Area_d05-surgery-2): bays at x -15, 0, 15 and z ±9, each bed along z with its pillow toward +z, the
// bedside cabinet at x+0.95 and the instrument cart (kept) at x+2, z-1; the ceiling at y=3.3, its light strips at z ±6, ±12.
const ROOM='Area_d05-surgery-2';
export const BAYS=[-15,0,15].flatMap(x=>[-9,9].map(z=>[x,z]));
const CEILING=3.3;
// The old bed's parts, removed whole, and the build's polish batches, cropped round each bay.
const OLD=/^(Patient_bed_base|Mattress|Blanket|Pillow|Bedside_cabinet|Patient_monitor|IV_stand|Surgical_light_arm|Surgical_light)$/;
const BATCHED=/^(Refined_patient_services|Refined_display_graphics|Polish_tailored_seam|Polish_instrument_bezel)$/;
const inBay=(x,y,z)=>y>.02&&y<CEILING-.1&&BAYS.some(([bx,bz])=>x>bx-1&&x<bx+1.3&&Math.abs(z-bz)<1.2);

function canvasTexture(w,h,paint){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
// Concept graphics for the floating panel: a heart trace, a ring gauge and a few bars, cyan on a faint blue glass.
function vitals(g,w,h){
 g.fillStyle='rgba(40,140,200,.22)';g.fillRect(0,0,w,h);
 g.strokeStyle='rgba(120,220,255,.9)';g.lineWidth=4;g.strokeRect(6,6,w-12,h-12);
 g.shadowColor='#6fdcff';g.shadowBlur=10;g.strokeStyle='#8fe6ff';g.lineWidth=5;g.beginPath();
 for(let x=24;x<w*.62;x+=4){const t=(x-24)%110,y=h*.32-(t>50&&t<58?60:t>58&&t<64?-28:t>64&&t<70?14:0)+Math.sin(x*.05)*3;x===24?g.moveTo(x,y):g.lineTo(x,y);}
 g.stroke();
 g.lineWidth=12;g.strokeStyle='rgba(120,220,255,.3)';g.beginPath();g.arc(w*.8,h*.32,52,0,Math.PI*2);g.stroke();
 g.strokeStyle='#8fe6ff';g.beginPath();g.arc(w*.8,h*.32,52,-Math.PI/2,Math.PI*.95);g.stroke();
 g.shadowBlur=0;g.fillStyle='rgba(143,230,255,.85)';
 for(let i=0;i<9;i++){const bh=20+((i*37)%60);g.fillRect(30+i*34,h*.88-bh,20,bh);}
 g.fillStyle='rgba(143,230,255,.55)';for(let i=0;i<4;i++)g.fillRect(w*.62,h*.62+i*22,w*.3-i*24,8);
}

const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Surgery_'+name,color,roughness:.35,...o});
const M={
 shell:mat('shell',0xeef1f4,{roughness:.28}),dark:mat('pedestal',0x2a3036,{roughness:.4,metalness:.3}),
 pad:mat('mattress',0xc9d4dc,{roughness:.7}),pillow:mat('pillow',0xe6ecf0,{roughness:.8}),
 steel:mat('steel',0xb9c2c8,{metalness:.7,roughness:.3}),screen:mat('screen',0x0d1a24,{roughness:.2}),
 glow:new T.MeshBasicMaterial({name:'Surgery_glow',color:0x5fd4ff,toneMapped:false}),
 canopy:new T.MeshStandardMaterial({name:'Surgery_canopy',color:0xcfeaf5,roughness:.08,transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide}),
};

// One bed in the room's fittings, centred at (x,z), its pillow toward +z.
function bed(fit,x,z,panel){
 const g=new T.Group();g.name='Surgery_bed';g.position.set(x,0,z);fit.add(g);
 const add=(name,geo,m,at,rot)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...at);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const rbox=(w,h,d,r)=>new RoundedBoxGeometry(w,h,d,3,r);
 // The pedestal: a wide foot plate with its glow line, and a narrower column under the shell.
 add('Surgery_bed_plinth',rbox(.95,.08,1.7,.03),M.dark,[0,.04,0]);
 add('Surgery_bed_plinth_glow',new T.BoxGeometry(.97,.015,1.72),M.glow,[0,.088,0]).castShadow=false;
 add('Surgery_bed_column',rbox(.5,.34,1.1,.08),M.dark,[0,.25,0]);
 // The shell: a deep rounded tub, a glow band along each side and round the foot, raised a little at the head.
 add('Surgery_bed_shell',rbox(1.12,.22,2.24,.1),M.shell,[0,.52,0]);
 for(const s of [-1,1])add('Surgery_bed_glow',new T.BoxGeometry(.012,.025,1.9),M.glow,[s*.565,.5,0]).castShadow=false;
 add('Surgery_bed_glow',new T.BoxGeometry(.9,.025,.012),M.glow,[0,.5,-1.125]).castShadow=false;
 add('Surgery_bed_headrest',rbox(1.12,.16,.42,.07),M.shell,[0,.66,.91]);
 // The mattress and pillow: named as the walk's beds are, so it is somewhere to lie (rest.js).
 add('Mattress',rbox(.92,.1,1.9,.04),M.pad,[0,.68,-.08]);
 add('Pillow',rbox(.6,.09,.3,.04),M.pillow,[0,.785,.86]);
 // A clear canopy arched over the head end on a white hoop.
 add('Surgery_bed_canopy',new T.CylinderGeometry(.56,.56,.7,28,1,true,-Math.PI/2,Math.PI),M.canopy,[0,.82,.72],[-Math.PI/2,0,0]).castShadow=false;
 add('Surgery_bed_canopy_hoop',new T.TorusGeometry(.56,.025,8,28,Math.PI),M.shell,[0,.82,.37]);
 // The foot console, angled up toward the staff, and a screen on an arm at the cabinet side.
 add('Surgery_bed_console',rbox(.7,.5,.18,.06),M.shell,[0,.42,-1.2],[.25,0,0]);
 add('Surgery_bed_console_screen',new T.PlaneGeometry(.56,.2),M.glow,[0,.57,-1.262],[.25,Math.PI,0]).castShadow=false;
 add('Surgery_bed_screen_post',new T.CylinderGeometry(.025,.025,.6,10),M.steel,[.68,.75,.45]);
 add('Surgery_bed_side_screen',rbox(.05,.32,.48,.02),M.screen,[.7,1.1,.45]);
 add('Surgery_bed_side_screen_glow',new T.PlaneGeometry(.42,.26),M.glow,[.669,1.1,.45],[0,-Math.PI/2,0]).castShadow=false;
 // The floating vitals panel beside the bed, facing across it, with nothing to bump into.
 const holo=add('Surgery_vitals_graphics',new T.PlaneGeometry(.95,.6),panel,[-.85,1.65,.1],[0,Math.PI/2-.2,0]);holo.castShadow=false;holo.receiveShadow=false;
}

// The old bed parts out and the new beds into the room's fittings, before the colliders are built and the room is
// merged. Returns false if the room is missing.
export function dressSurgery(ship){
 const room=ship.root.getObjectByName(ROOM);if(!room)return false;
 const fit=room.getObjectByName('Room_fittings');if(!fit)return false;
 room.updateWorldMatrix(true,true);
 const toRoom=room.matrixWorld.clone().invert(),v=new T.Vector3(),old=[],batched=[];
 room.traverse(o=>{if(!o.isMesh)return;if(OLD.test(o.name))old.push(o);else if(BATCHED.test(o.name))batched.push(o);});
 for(const o of old)o.removeFromParent();
 // A batch spans every bay: keep only its triangles that lie outside them.
 for(const o of batched){
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),p=g.attributes.position,m=new T.Matrix4().multiplyMatrices(toRoom,o.matrixWorld),keep=[];
  for(let i=0;i<p.count;i+=3){v.set(0,0,0);for(let j=0;j<3;j++)v.add(new T.Vector3().fromBufferAttribute(p,i+j));v.multiplyScalar(1/3).applyMatrix4(m);if(!inBay(v.x,v.y,v.z))keep.push(i);}
  if(!keep.length){o.removeFromParent();continue;}
  const out=new T.BufferGeometry();
  for(const [name,a] of Object.entries(g.attributes)){const s=a.itemSize,arr=new a.array.constructor(keep.length*3*s);keep.forEach((i,k)=>arr.set(a.array.subarray(i*s,(i+3)*s),k*3*s));out.setAttribute(name,new T.BufferAttribute(arr,s,a.normalized));}
  o.geometry=out;
 }
 const panel=new T.MeshBasicMaterial({name:'Surgery_vitals',map:canvasTexture(512,320,vitals),transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false});
 for(const [x,z] of BAYS)bed(fit,x,z,panel);
 return true;
}

// One ceiling arm, hung at the origin of its frame: a turning mount, a shoulder, two links and a lit tool head.
function arm(){
 const root=new T.Group();root.name='Surgery_robot_arm';
 const add=(parent,name,geo,m,at,rot)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...at);if(rot)o.rotation.set(...rot);o.castShadow=true;parent.add(o);return o;};
 add(root,'Surgery_arm_mount',new T.CylinderGeometry(.26,.3,.08,28),M.shell,[0,-.04,0]);
 add(root,'Surgery_arm_mount_glow',new T.CylinderGeometry(.27,.27,.015,28,1,true),M.glow,[0,-.085,0]).castShadow=false;
 const yaw=new T.Group();root.add(yaw);
 add(yaw,'Surgery_arm_column',new T.CylinderGeometry(.1,.12,.32,20),M.shell,[0,-.24,0]);
 const shoulder=new T.Group();shoulder.position.set(0,-.42,0);yaw.add(shoulder);
 add(shoulder,'Surgery_arm_joint',new T.CylinderGeometry(.11,.11,.22,20),M.steel,[0,0,0],[Math.PI/2,0,0]);
 add(shoulder,'Surgery_arm_joint_glow',new T.TorusGeometry(.112,.012,6,24),M.glow,[0,0,.1]).castShadow=false;
 add(shoulder,'Surgery_arm_upper',new T.CapsuleGeometry(.07,.55,6,14),M.shell,[0,-.35,0]);
 const elbow=new T.Group();elbow.position.set(0,-.7,0);shoulder.add(elbow);
 add(elbow,'Surgery_arm_joint',new T.CylinderGeometry(.09,.09,.18,20),M.steel,[0,0,0],[Math.PI/2,0,0]);
 add(elbow,'Surgery_arm_joint_glow',new T.TorusGeometry(.092,.01,6,24),M.glow,[0,0,.08]).castShadow=false;
 add(elbow,'Surgery_arm_fore',new T.CapsuleGeometry(.055,.45,6,14),M.shell,[0,-.3,0]);
 const wrist=new T.Group();wrist.position.set(0,-.6,0);elbow.add(wrist);
 add(wrist,'Surgery_arm_wrist',new T.CylinderGeometry(.06,.08,.12,16),M.steel,[0,-.04,0]);
 add(wrist,'Surgery_arm_head',new T.CylinderGeometry(.12,.09,.1,20),M.shell,[0,-.14,0]);
 add(wrist,'Surgery_arm_lamp',new T.CircleGeometry(.08,20),M.glow,[0,-.191,0],[Math.PI/2,0,0]).castShadow=false;
 for(const a of [0,2.1,4.2]){const t=add(wrist,'Surgery_arm_tool',new T.CylinderGeometry(.012,.02,.2,8),M.steel,[Math.cos(a)*.1,-.25,Math.sin(a)*.1]);t.rotation.set(Math.sin(a)*.3,0,-Math.cos(a)*.3);}
 return {root,yaw,shoulder,elbow,wrist};
}

// The six arms over the beds, drawn with their deck band. update() moves them only while the walker is on Deck 5
// near the suite, and keeps them still for reduced motion.
export function createSurgeryArms(ship,{still=false}={}){
 const room=ship.root.getObjectByName(ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Surgery_robot_arms';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const arms=BAYS.map(([x,z],i)=>{const a=arm();a.root.position.set(x,CEILING,z+.15);a.phase=i*1.7;group.add(a.root);return a;});
 const centre=room.getWorldPosition(new T.Vector3());
 let t=0;
 const pose=()=>{for(const a of arms){const k=t+a.phase;
  a.yaw.rotation.y=.6+.35*Math.sin(k*.31);a.shoulder.rotation.z=.9+.12*Math.sin(k*.47);a.elbow.rotation.z=-1.6+.16*Math.sin(k*.61+1);
  // The tool head stays pointing down at the bed.
  a.wrist.rotation.z=-(a.shoulder.rotation.z+a.elbow.rotation.z);}};
 pose();
 function update(dt,p){
  if(still||Math.abs(p.y-centre.y)>4||Math.abs(p.x-centre.x)>40||Math.abs(p.z-centre.z)>30)return;
  t=performance.now()/1000;pose();
 }
 return {group,update};
}
