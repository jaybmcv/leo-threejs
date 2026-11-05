import {RecordGeometry,recordMerged} from "../v2/prepared-geometry-record.js";
import {roomObject} from '../plan/rooms.js';
import {capsuleBubbles} from './capsule-bubbles.js';
import {walkCanvas} from './canvas.js';
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
 const canvas=walkCanvas();if(!canvas)return null;canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);
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
 add('Surgery_bed_plinth_glow',new RecordGeometry("src/walk/surgery.js:0",T.BoxGeometry,.97,.015,1.72),M.glow,[0,.03,0]).castShadow=false;
 add('Surgery_bed_column',rbox(.5,.34,1.1,.08),M.dark,[0,.25,0]);
 // The shell: a deep rounded tub, a glow band along each side and round the foot, raised a little at the head.
 add('Surgery_bed_shell',rbox(1.12,.22,2.24,.1),M.shell,[0,.52,0]);
 for(const s of [-1,1])add('Surgery_bed_glow',new RecordGeometry("src/walk/surgery.js:1",T.BoxGeometry,.012,.025,1.9),M.glow,[s*.565,.5,0]).castShadow=false;
 add('Surgery_bed_glow',new RecordGeometry("src/walk/surgery.js:2",T.BoxGeometry,.9,.025,.012),M.glow,[0,.5,-1.125]).castShadow=false;
 add('Surgery_bed_headrest',rbox(1.12,.16,.42,.07),M.shell,[0,.66,.91]);
 // The mattress and pillow: named as the walk's beds are, so it is somewhere to lie (rest.js).
 add('Mattress',rbox(.92,.1,1.9,.04),M.pad,[0,.68,-.08]);
 add('Pillow',rbox(.6,.09,.3,.04),M.pillow,[0,.785,.86]);
 // A clear canopy arched over the head end on a white hoop.
 add('Surgery_bed_canopy',new RecordGeometry("src/walk/surgery.js:3",T.CylinderGeometry,.56,.56,.7,28,1,true,-Math.PI/2,Math.PI),M.canopy,[0,.82,.72],[-Math.PI/2,0,0]).castShadow=false;
 add('Surgery_bed_canopy_hoop',new RecordGeometry("src/walk/surgery.js:4",T.TorusGeometry,.56,.025,8,28,Math.PI),M.shell,[0,.82,.37]);
 // The foot console, angled up toward the staff, and a screen on an arm at the cabinet side.
 add('Surgery_bed_console',rbox(.7,.5,.18,.06),M.shell,[0,.42,-1.2],[.25,0,0]);
 add('Surgery_bed_console_screen',new RecordGeometry("src/walk/surgery.js:5",T.PlaneGeometry,.56,.2),M.glow,[0,.57,-1.262],[.25,Math.PI,0]).castShadow=false;
 add('Surgery_bed_screen_post',new RecordGeometry("src/walk/surgery.js:6",T.CylinderGeometry,.025,.025,.6,10),M.steel,[.68,.75,.45]);
 add('Surgery_bed_side_screen',rbox(.05,.32,.48,.02),M.screen,[.7,1.1,.45]);
 add('Surgery_bed_side_screen_glow',new RecordGeometry("src/walk/surgery.js:7",T.PlaneGeometry,.42,.26),M.glow,[.669,1.1,.45],[0,-Math.PI/2,0]).castShadow=false;
 // The floating vitals panel beside the bed, facing across it, with nothing to bump into.
 const holo=add('Surgery_vitals_graphics',new RecordGeometry("src/walk/surgery.js:8",T.PlaneGeometry,.95,.6),panel,[-.85,1.65,.1],[0,Math.PI/2-.2,0]);holo.castShadow=false;holo.receiveShadow=false;
}

// The old bed parts out and the new beds into the room's fittings, before the colliders are built and the room is
// merged. Returns false if the room is missing.
export function dressSurgery(ship){
 const room=roomObject(ship,ROOM);if(!room)return false;
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
 CAPSULES.forEach(([x,z,face],i)=>capsule(fit,x,z,face,i));
 return true;
}

// A healing capsule in each bay (from tester feedback), between the bed and the bay's partition: a glass tube of
// glowing blue fluid on a dark pedestal, hoses hanging from its crown to where a body stands, and a life-support unit
// beside it, piped in, its screen showing that bay's body readings. Its floor is a place to stand (rest.js): stepping
// in holds the walker there until they leave (main.js). The glass, fluid, crown and hoses are not solid, so the
// camera can follow a walker inside; the pedestal and the unit are. Each faces the suite's middle aisle.
// [x, z, the way the capsule faces along z] in the room frame.
export const CAPSULES=BAYS.map(([x,z])=>[x-3.3,z,-Math.sign(z)]);
export const CAPSULE_FLOOR=.24;
const C={
 glass:new T.MeshStandardMaterial({name:'Capsule_glass',color:0xc8f0ff,roughness:.05,metalness:.1,transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide}),
 fluid:new T.MeshBasicMaterial({name:'Capsule_fluid_glow',color:0x2a8cff,transparent:true,opacity:.32,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),
 hose:mat('hose',0x1d2329,{roughness:.55}),
 red:new T.MeshBasicMaterial({name:'Capsule_red_glow',color:0xff3040,toneMapped:false}),
 green:new T.MeshBasicMaterial({name:'Capsule_green_glow',color:0x30ff70,toneMapped:false}),
};
// Body readings for one capsule's screen, a little different in every bay: heart, oxygen, temperature, healing.
function readings(g,w,h,seed){
 const r=k=>((Math.sin(seed*12.9898+k*78.233)*43758.5453)%1+1)%1;
 g.fillStyle='#04121c';g.fillRect(0,0,w,h);g.strokeStyle='rgba(95,212,255,.8)';g.lineWidth=3;g.strokeRect(5,5,w-10,h-10);
 g.font='600 22px monospace';g.fillStyle='#8fe6ff';g.fillText('PATIENT '+(seed+1).toString().padStart(2,'0'),18,38);
 const rows=[['HEART',Math.round(68+r(1)*40)+' bpm','#ff6070'],['O2 SAT',Math.round(95+r(2)*4)+' %','#7dffa8'],['TEMP',(38.1+r(3)*.9).toFixed(1)+' C','#ffd36a'],['HEALING',Math.round(20+r(4)*75)+' %','#8fe6ff']];
 rows.forEach(([k,v,c],i)=>{const y=86+i*84;g.font='500 17px monospace';g.fillStyle='rgba(143,230,255,.7)';g.fillText(k,18,y);g.font='700 30px monospace';g.fillStyle=c;g.fillText(v,18,y+32);
  // A trace beside each reading.
  g.strokeStyle=c;g.lineWidth=2.5;g.beginPath();for(let x=0;x<100;x+=4){const t=(x+r(i+5)*60)%50,yy=y+10-(i===0?(t>22&&t<26?22:t>26&&t<29?-10:0):Math.sin((x+r(i+7)*40)*.12)*8);x?g.lineTo(w-120+x,yy):g.moveTo(w-120+x,yy);}g.stroke();});
 // The healing bar.
 g.fillStyle='rgba(143,230,255,.2)';g.fillRect(18,h-34,w-36,14);g.fillStyle='#5fd4ff';g.fillRect(18,h-34,(w-36)*(.2+r(4)*.75),14);
}
function capsule(fit,x,z,face,i){
 const g=new T.Group();g.name='Healing_capsule';g.position.set(x,0,z);if(face<0)g.rotation.y=Math.PI;fit.add(g);
 const add=(name,geo,m,at,rot,solid=false)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...at);if(rot)o.rotation.set(...rot);o.castShadow=solid;o.receiveShadow=true;if(!solid)o.userData.noCollide=true;g.add(o);return o;};
 const R=.6,TOP=2.45;
 // The pedestal with its glow ring, and the round floor plate stood on inside.
 add('Healing_capsule_base',new RecordGeometry("src/walk/surgery.js:9",T.CylinderGeometry,.74,.8,.22,36),M.dark,[0,.11,0],null,true);
 add('Healing_capsule_base_glow',new RecordGeometry("src/walk/surgery.js:10",T.TorusGeometry,.75,.018,6,40),M.glow,[0,.2,0],[Math.PI/2,0,0]);
 const floor=add('Healing_capsule_floor',new RecordGeometry("src/walk/surgery.js:11",T.CylinderGeometry,.56,.56,.04,32),M.steel,[0,CAPSULE_FLOOR-.02,0],null,true);
 floor.userData.facing=[0,0,1];
 // The tube: clear glass, the glowing fluid inside it, and three ribs at the back holding up the crown.
 add('Healing_capsule_glass',new RecordGeometry("src/walk/surgery.js:12",T.CylinderGeometry,R,R,TOP-CAPSULE_FLOOR,40,1,true),C.glass,[0,(TOP+CAPSULE_FLOOR)/2,0]);
 add('Healing_capsule_fluid',new RecordGeometry("src/walk/surgery.js:13",T.CylinderGeometry,R-.04,R-.04,TOP-CAPSULE_FLOOR-.05,40,1,true),C.fluid,[0,(TOP+CAPSULE_FLOOR)/2,0]);
 for(const a of [Math.PI*.75,Math.PI,Math.PI*1.25])add('Healing_capsule_rib',new RecordGeometry("src/walk/surgery.js:14",T.CylinderGeometry,.03,.03,TOP-CAPSULE_FLOOR,8),M.steel,[Math.sin(a)*(R+.03),(TOP+CAPSULE_FLOOR)/2,Math.cos(a)*(R+.03)]);
 for(const y of [CAPSULE_FLOOR+.03,TOP-.03])add('Healing_capsule_ring_glow',new RecordGeometry("src/walk/surgery.js:15",T.TorusGeometry,R+.01,.022,6,40),M.glow,[0,y,0],[Math.PI/2,0,0]);
 // The crown: a dark cap with a lamp under it and red and green status lights round its rim.
 add('Healing_capsule_crown',new RecordGeometry("src/walk/surgery.js:16",T.CylinderGeometry,.66,.76,.3,36),M.dark,[0,TOP+.15,0]);
 add('Healing_capsule_crown_band',new RecordGeometry("src/walk/surgery.js:17",T.CylinderGeometry,.765,.765,.05,36,1,true),M.shell,[0,TOP+.08,0]);
 add('Healing_capsule_lamp',new RecordGeometry("src/walk/surgery.js:18",T.CircleGeometry,.5,28),C.fluid,[0,TOP-.005,0],[Math.PI/2,0,0]);
 [-.5,-.2,.2,.5].forEach((a,k)=>add('Healing_capsule_status_light',new RecordGeometry("src/walk/surgery.js:19",T.SphereGeometry,.03,10,8),k%2?C.green:C.red,[Math.sin(a)*.77,TOP+.2,Math.cos(a)*.77]));
 // Hoses from the crown to where a body stands: shoulders, sides and back, none across the face (the first person view).
 const tube=(name,pts,r,m)=>add(name,new RecordGeometry("src/walk/surgery.js:20",T.TubeGeometry,new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),24,r,8),m,[0,0,0]);
 for(const [a,y,d] of [[1.1,1.25,.2],[-1.1,1.25,.2],[Math.PI,1.15,.2],[2.3,1.0,.2],[-2.3,1.05,.2]]){
  const s=Math.sin(a),c=Math.cos(a),top=[s*.38,TOP,c*.38],end=[s*d,CAPSULE_FLOOR+y,c*d];
  tube('Healing_capsule_hose',[top,[s*.42,TOP-.45,c*.42],[s*(d+.12),end[1]+.35,c*(d+.12)],end],.018,C.hose);
  add('Healing_capsule_hose_tip_glow',new RecordGeometry("src/walk/surgery.js:21",T.SphereGeometry,.03,10,8),M.glow,end);
 }
 // The life-support unit on the partition side of the capsule, its readings screen facing the aisle, piped into the
 // pedestal and crown. The capsule turns to face the aisle, so its sides swap: s keeps the unit toward the partition.
 const s=face,ux=-1.45*s;
 add('Healing_capsule_unit',new RoundedBoxGeometry(.7,1.5,.8,3,.06),M.shell,[ux,.75,0],null,true);
 add('Healing_capsule_unit_plinth',new RecordGeometry("src/walk/surgery.js:22",T.BoxGeometry,.72,.08,.82),M.dark,[ux,.04,0],null,true);
 add('Healing_capsule_unit_bezel',new RecordGeometry("src/walk/surgery.js:23",T.BoxGeometry,.6,.78,.02),M.screen,[ux,1.02,.405]);
 const tex=canvasTexture(256,384,(c,w,h)=>readings(c,w,h,i));
 add('Healing_capsule_readings_graphics',new RecordGeometry("src/walk/surgery.js:24",T.PlaneGeometry,.54,.72),tex?new T.MeshBasicMaterial({name:'Capsule_readings',map:tex,toneMapped:false}):M.glow,[ux,1.02,.417]);
 for(let k=0;k<3;k++)add('Healing_capsule_unit_glow',new RecordGeometry("src/walk/surgery.js:25",T.BoxGeometry,.5,.015,.012),M.glow,[ux,.28+k*.1,.405]);
 tube('Healing_capsule_hose',[[ux+.36*s,.5,.15],[ux+.62*s,.3,.25],[-.82*s,.14,.2],[-.74*s,.14,.08]],.035,C.hose);
 tube('Healing_capsule_hose',[[ux+.36*s,.75,-.15],[ux+.66*s,.5,-.3],[-.82*s,.16,-.25],[-.72*s,.16,-.15]],.035,C.hose);
 tube('Healing_capsule_hose',[[ux,1.5,-.2],[ux+.1*s,2.4,-.25],[-.85*s,2.75,-.2],[-.7*s,TOP+.18,-.1]],.03,C.hose);
}

// These small effects stay outside the room bake so they can respond to the local walker.
function capsuleEffects(){
 const group=new T.Group();group.name='Healing_capsule_effects';group.visible=false;
 const lights=[-.5,-.2,.2,.5].map((a,k)=>{
  const material=new T.MeshBasicMaterial({color:k%2?0x30ff70:0xff3040,transparent:true,opacity:.18,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
  const mesh=new T.Mesh(new T.SphereGeometry(.05,10,8),material);mesh.position.set(Math.sin(a)*.77,2.65,Math.cos(a)*.77);group.add(mesh);
  return {mesh,material,phase:k*Math.PI/2};
 });
 const waves=Array.from({length:3},(_,i)=>{
  const material=new T.MeshBasicMaterial({color:0x73e6ff,transparent:true,opacity:.18,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
  const mesh=new T.Mesh(new T.TorusGeometry(.43,.012,4,32,Math.PI),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=CAPSULE_FLOOR+.18+(i+.18)*.58;group.add(mesh);
  return {mesh,material,phase:i/3};
 });
 return {group,lights,waves};
}

// One ceiling arm, hung at the origin of its frame: a turning mount, a shoulder, two links and a lit tool head.
function arm(){
 const root=new T.Group();root.name='Surgery_robot_arm';
 const add=(parent,name,geo,m,at,rot)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...at);if(rot)o.rotation.set(...rot);o.castShadow=true;parent.add(o);return o;};
 add(root,'Surgery_arm_mount',new RecordGeometry("src/walk/surgery.js:26",T.CylinderGeometry,.26,.3,.08,28),M.shell,[0,-.04,0]);
 add(root,'Surgery_arm_mount_glow',new RecordGeometry("src/walk/surgery.js:27",T.CylinderGeometry,.27,.27,.015,28,1,true),M.glow,[0,-.085,0]).castShadow=false;
 const yaw=new T.Group();root.add(yaw);
 add(yaw,'Surgery_arm_column',new RecordGeometry("src/walk/surgery.js:28",T.CylinderGeometry,.1,.12,.32,20),M.shell,[0,-.24,0]);
 const shoulder=new T.Group();shoulder.position.set(0,-.42,0);yaw.add(shoulder);
 add(shoulder,'Surgery_arm_joint',new RecordGeometry("src/walk/surgery.js:29",T.CylinderGeometry,.11,.11,.22,20),M.steel,[0,0,0],[Math.PI/2,0,0]);
 add(shoulder,'Surgery_arm_joint_glow',new RecordGeometry("src/walk/surgery.js:30",T.TorusGeometry,.112,.012,6,24),M.glow,[0,0,.1]).castShadow=false;
 add(shoulder,'Surgery_arm_upper',new RecordGeometry("src/walk/surgery.js:31",T.CapsuleGeometry,.07,.55,6,14),M.shell,[0,-.35,0]);
 const elbow=new T.Group();elbow.position.set(0,-.7,0);shoulder.add(elbow);
 add(elbow,'Surgery_arm_joint',new RecordGeometry("src/walk/surgery.js:32",T.CylinderGeometry,.09,.09,.18,20),M.steel,[0,0,0],[Math.PI/2,0,0]);
 add(elbow,'Surgery_arm_joint_glow',new RecordGeometry("src/walk/surgery.js:33",T.TorusGeometry,.092,.01,6,24),M.glow,[0,0,.08]).castShadow=false;
 add(elbow,'Surgery_arm_fore',new RecordGeometry("src/walk/surgery.js:34",T.CapsuleGeometry,.055,.45,6,14),M.shell,[0,-.3,0]);
 const wrist=new T.Group();wrist.position.set(0,-.6,0);elbow.add(wrist);
 add(wrist,'Surgery_arm_wrist',new RecordGeometry("src/walk/surgery.js:35",T.CylinderGeometry,.06,.08,.12,16),M.steel,[0,-.04,0]);
 add(wrist,'Surgery_arm_head',new RecordGeometry("src/walk/surgery.js:36",T.CylinderGeometry,.12,.09,.1,20),M.shell,[0,-.14,0]);
 add(wrist,'Surgery_arm_lamp',new RecordGeometry("src/walk/surgery.js:37",T.CircleGeometry,.08,20),M.glow,[0,-.191,0],[Math.PI/2,0,0]).castShadow=false;
 for(const a of [0,2.1,4.2]){const t=add(wrist,'Surgery_arm_tool',new RecordGeometry("src/walk/surgery.js:38",T.CylinderGeometry,.012,.02,.2,8),M.steel,[Math.cos(a)*.1,-.25,Math.sin(a)*.1]);t.rotation.set(Math.sin(a)*.3,0,-Math.cos(a)*.3);}
 return {root,yaw,shoulder,elbow,wrist};
}

// The six arms over the beds, drawn with their deck band. update() moves them only while the walker is on Deck 5
// near the suite, and keeps them still for reduced motion.
export function createSurgeryArms(ship,{still=false}={}){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Surgery_robot_arms';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const arms=BAYS.map(([x,z],i)=>{const a=arm();a.root.position.set(x,CEILING,z+.15);a.phase=i*1.7;group.add(a.root);return a;});
 const bubbles=capsuleBubbles(CAPSULES,still);group.add(bubbles.mesh);
 const effects=CAPSULES.map(([x,z,face])=>{const e=capsuleEffects();e.group.position.set(x,0,z);if(face<0)e.group.rotation.y=Math.PI;group.add(e.group);return e;});
 const toRoom=room.matrixWorld.clone().invert(),local=new T.Vector3();
 const centre=room.getWorldPosition(new T.Vector3());
 let t=0;
 const pose=()=>{for(const a of arms){const k=t+a.phase;
  a.yaw.rotation.y=.6+.35*Math.sin(k*.31);a.shoulder.rotation.z=.9+.12*Math.sin(k*.47);a.elbow.rotation.z=-1.6+.16*Math.sin(k*.61+1);
  // The tool head stays pointing down at the bed.
  a.wrist.rotation.z=-(a.shoulder.rotation.z+a.elbow.rotation.z);}};
 pose();
  function update(dt,p,remotes=null){
  if(!still&&Math.abs(p.y-centre.y)<=4&&Math.abs(p.x-centre.x)<=40&&Math.abs(p.z-centre.z)<=30){t=performance.now()/1000;pose();bubbles.update(t);}
  const occupied=CAPSULES.map(()=>false),mark=()=>CAPSULES.forEach(([x,z],i)=>{if(Math.abs(local.y-CAPSULE_FLOOR)<1.1&&Math.hypot(local.x-x,local.z-z)<.46)occupied[i]=true;});
  local.copy(p).applyMatrix4(toRoom);
  mark();
  if(remotes)for(const r of remotes.values())if(r.cur){local.set(r.cur.x,r.cur.y,r.cur.z).applyMatrix4(toRoom);mark();}
  effects.forEach((e,i)=>{
   e.group.visible=occupied[i];if(!occupied[i])return;
   for(const l of e.lights){const pulse=still ? .5 : .5+.5*Math.sin(t*2.2+l.phase);l.material.opacity=still ? .18 : .14+.24*pulse;l.mesh.scale.setScalar(still?1:.92+.24*pulse);}
   for(const w of e.waves){const progress=still?w.phase:(t*.3+w.phase)%1;w.mesh.position.y=CAPSULE_FLOOR+.18+progress*1.75;w.material.opacity=still ? .18 : .05+.34*Math.sin(progress*Math.PI);}
  });
 }
 return {group,update};
}
