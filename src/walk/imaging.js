import {roomObject} from '../plan/rooms.js';
import {visionGlass} from '../room-glazing.js';
import {walkCanvas,hasWalkCanvas} from './canvas.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Deck 5's Diagnostics & imaging on foot (from tester feedback): each of the two scanner bays' grey ring and bench
// gives way to a sculpted scanner, a glowing patient bed on a lit floor plinth that slides through a slim white gantry
// with a glowing bore, under an arched scanner head. The plain control partitions become glass, and a glass screen
// stands between each bay and the main aisle; every divider carries a holographic scan of a patient cat on both faces,
// its skeleton drawn to Cosmo's own proportions (the walk's avatar) from the front and the side, with a scan line
// sweeping over it. A resting patient gives way to visitors who lie on the bed.
// Room frame (Area_d05-imaging-6): the entry at x -26, the main aisle along z -2..2, the bays at z ±10 with the ring at
// x 8 and the bench at x 5, an operator desk at x -5 and the control partition at x -12 (z 5..15 or -15..-5).
const ROOM='Area_d05-imaging-6';
export const BAYS=[-10,10];
const OLD=/^(Diagnostic_scanner|Scanner_patient_table|Scanner_control_partition)$/;
const BATCHED=/^(Refined_|Polish_)/;
// Where each new divider stands: its centre, its length and whether it runs along x. The control partition's spot is
// kept; the aisle screen runs beside the bay, clear of the aisle and open toward the operator desk.
const dividers=z=>[{x:-12,z,length:10,alongX:false,faces:[1,-1]},{x:6,z:Math.sign(z)*4,length:9,alongX:true,faces:[Math.sign(z),-Math.sign(z)]}];
export const DIVIDERS=BAYS.flatMap(dividers);
const GLASS_H=2.4;

const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Imaging_'+name,color,roughness:.35,...o});
const M={
 shell:mat('shell',0xf1f4f6,{roughness:.25}),dark:mat('plinth',0x1f262c,{roughness:.35,metalness:.3}),
 frame:mat('frame',0xdfe5e9,{roughness:.3,metalness:.2}),pillow:mat('pillow',0xe6ecf0,{roughness:.8}),
 glow:new T.MeshBasicMaterial({name:'Imaging_glow',color:0x5fd4ff,toneMapped:false}),
 pad:new T.MeshStandardMaterial({name:'Imaging_bed_pad',color:0x3aa8e0,emissive:0x2a9fe0,emissiveIntensity:.9,roughness:.3}),
};
const rbox=(w,h,d,r)=>new RoundedBoxGeometry(w,h,d,3,r);

// One scanner in the room's fittings, centred on its bay at z.
function scanner(fit,z){
 const g=new T.Group();g.name='Imaging_scanner';g.position.set(0,0,z);fit.add(g);
 const add=(name,geo,m,at,rot,scale)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...at);if(rot)o.rotation.set(...rot);if(scale)o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 // The floor plinth: a low dark oval with a glowing rim, low enough to step onto.
 add('Imaging_plinth',new T.CylinderGeometry(1,1,.05,56),M.dark,[5.3,.035,0],null,[3.1,1,1.35]);
 add('Imaging_plinth_glow',new T.CylinderGeometry(1,1,.02,56),M.glow,[5.3,.012,0],null,[3.16,1,1.4]).castShadow=false;
 // The bed: a slim pedestal, a white shell with glow bands along its sides, a glowing pad and a pillow at the gantry
 // end, so whoever lies on it lies head-first in the bore.
 add('Imaging_bed_pedestal',rbox(1.7,.5,.42,.1),M.shell,[4.4,.3,0]);
 add('Imaging_bed_shell',rbox(4.5,.14,.8,.06),M.shell,[5.2,.62,0]);
 for(const s of [-1,1])add('Imaging_bed_glow',new T.BoxGeometry(4.2,.022,.012),M.glow,[5.2,.6,s*.403]).castShadow=false;
 add('Mattress',rbox(4,.07,.62,.03),M.pad,[5.25,.72,0]);
 add('Pillow',rbox(.3,.08,.5,.035),M.pillow,[6.55,.79,0]);
 // The gantry: a deep white ring the bed passes through, lit round its bore on both faces and round its rim, on a foot.
 const ring=new T.Shape();ring.absarc(0,0,1.1,0,Math.PI*2,false);const bore=new T.Path();bore.absarc(0,0,.82,0,Math.PI*2,true);ring.holes.push(bore);
 const ringGeo=new T.ExtrudeGeometry(ring,{depth:.42,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:3,curveSegments:48}).translate(0,0,-.21);
 add('Imaging_gantry',ringGeo,M.shell,[7.1,1.16,0],[0,Math.PI/2,0]);
 for(const s of [-1,1]){
  add('Imaging_gantry_glow',new T.TorusGeometry(.8,.018,6,64),M.glow,[7.1+s*.26,1.16,0],[0,Math.PI/2,0]).castShadow=false;
  add('Imaging_gantry_glow',new T.TorusGeometry(1.0,.012,6,64),M.glow,[7.1+s*.26,1.16,0],[0,Math.PI/2,0]).castShadow=false;
 }
 add('Imaging_gantry_foot',rbox(.62,.16,1.5,.06),M.shell,[7.1,.08,0]);
 // The arch over the bed's outer half, with a downward lit scanner head at its crown.
 add('Imaging_arch',new T.TorusGeometry(1.25,.05,10,48,Math.PI),M.frame,[3.7,.05,0],[0,Math.PI/2,0],[1,1.4,1]);
 add('Imaging_arch_glow',new T.TorusGeometry(1.2,.012,6,48,Math.PI),M.glow,[3.7,.05,0],[0,Math.PI/2,0],[1,1.4,1]).castShadow=false;
 add('Imaging_arch_head',rbox(.34,.12,.34,.05),M.shell,[3.7,1.72,0]);
 add('Imaging_arch_lamp',new T.CircleGeometry(.11,24),M.glow,[3.7,1.655,0],[Math.PI/2,0,0]).castShadow=false;
}

// One glass divider: a white floor rail and head rail, posts at the ends and every few metres, and the pane between.
function divider(fit,{x,z,length,alongX}){
 const g=new T.Group();g.name='Imaging_glass_divider';g.position.set(x,0,z);if(!alongX)g.rotation.y=Math.PI/2;fit.add(g);
 const add=(name,geo,m,at)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...at);o.castShadow=m!==visionGlass;o.receiveShadow=true;g.add(o);return o;};
 add('Imaging_divider_rail',rbox(length,.1,.14,.03),M.frame,[0,.05,0]);
 add('Imaging_divider_rail_glow',new T.BoxGeometry(length-.1,.015,.15),M.glow,[0,.085,0]).castShadow=false;
 add('Imaging_divider_head',rbox(length,.08,.1,.03),M.frame,[0,GLASS_H+.04,0]);
 const posts=Math.max(2,Math.round(length/3)+1);
 for(let i=0;i<posts;i++)add('Imaging_divider_post',new T.BoxGeometry(.07,GLASS_H,.09),M.frame,[-length/2+.035+(length-.07)*i/(posts-1),GLASS_H/2,0]);
 add('Imaging_glass_pane',new T.BoxGeometry(length-.1,GLASS_H-.1,.02),visionGlass,[0,GLASS_H/2+.05,0]);
}

// Each removed part's room-frame bounds, a little enlarged: the polish batches lose their triangles inside them.
function boundsInRoom(o,toRoom){
 const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();
 const b=g.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(toRoom,o.matrixWorld)).expandByScalar(.08);
 // Never down to the floor, whose seams run under everything.
 b.min.y=Math.max(b.min.y,.02);return b;
}
function crop(o,toRoom,boxes){
 const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),p=g.attributes.position,m=new T.Matrix4().multiplyMatrices(toRoom,o.matrixWorld),keep=[],v=new T.Vector3(),w=new T.Vector3();
 for(let i=0;i<p.count;i+=3){v.set(0,0,0);for(let j=0;j<3;j++)v.add(w.fromBufferAttribute(p,i+j));v.multiplyScalar(1/3).applyMatrix4(m);if(!boxes.some(b=>b.containsPoint(v)))keep.push(i);}
 if(keep.length*3===p.count)return;
 if(!keep.length){o.removeFromParent();return;}
 const out=new T.BufferGeometry();
 for(const [name,a] of Object.entries(g.attributes)){const s=a.itemSize,arr=new a.array.constructor(keep.length*3*s);keep.forEach((i,k)=>arr.set(a.array.subarray(i*s,(i+3)*s),k*3*s));out.setAttribute(name,new T.BufferAttribute(arr,s,a.normalized));}
 o.geometry=out;
}

// The old scanners, benches and partitions out and the new scanners and glass dividers into the room's fittings,
// before the colliders are built and the room is merged. Returns false if the room is missing.
export function dressImaging(ship){
 const room=roomObject(ship,ROOM);if(!room)return false;
 const fit=room.getObjectByName('Room_fittings');if(!fit)return false;
 room.updateWorldMatrix(true,true);
 const toRoom=room.matrixWorld.clone().invert(),old=[],batched=[];
 room.traverse(o=>{if(!o.isMesh)return;if(OLD.test(o.name))old.push(o);else if(BATCHED.test(o.name)&&!o.isInstancedMesh)batched.push(o);});
 const boxes=old.map(o=>boundsInRoom(o,toRoom));
 for(const o of old)o.removeFromParent();
 for(const o of batched)crop(o,toRoom,boxes);
 for(const z of BAYS)scanner(fit,z);
 for(const d of DIVIDERS)divider(fit,d);
 return true;
}

// Cosmo's skeleton for the scans, in metres from his relaxed stand (cosmo-pose.js, 1.75 m tall, his feet at 0): the
// front view in x (his left to the right of the picture) and the side view in z (his nose to the right).
const SIDE_TAIL=[[-.087,.648],[-.068,.556],[-.091,.441],[-.197,.391],[-.35,.399],[-.485,.365]];
function skeleton(g,P,s,view){
 const line=(pts,w,alpha=1)=>{
  const path=()=>{g.beginPath();pts.forEach((p,i)=>{const [x,y]=P(...p);i?g.lineTo(x,y):g.moveTo(x,y);});};
  g.lineCap='round';g.lineJoin='round';
  path();g.strokeStyle=`rgba(150,232,255,${.95*alpha})`;g.lineWidth=w*s;g.stroke();
  if(w*s>5){path();g.strokeStyle=`rgba(20,70,110,${.75*alpha})`;g.lineWidth=w*s*.42;g.stroke();}
 };
 const knob=(x,y,r)=>{const [px,py]=P(x,y);g.beginPath();g.arc(px,py,r*s,0,Math.PI*2);g.fillStyle='rgba(150,232,255,.95)';g.fill();};
 const oval=(x,y,rx,ry,fill,w=.012)=>{const [px,py]=P(x,y);g.beginPath();g.ellipse(px,py,rx*s,ry*s,0,0,Math.PI*2);if(fill){g.fillStyle=fill;g.fill();}g.lineWidth=w*s;g.strokeStyle='rgba(150,232,255,.95)';g.stroke();};
 const shape=(pts,fill)=>{g.beginPath();pts.forEach((p,i)=>{const [x,y]=P(...p);i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();if(fill){g.fillStyle=fill;g.fill();}g.lineWidth=.012*s;g.strokeStyle='rgba(150,232,255,.95)';g.stroke();};
 const vertebra=(x,y,w,h)=>{const [px,py]=P(x,y);g.fillStyle='rgba(150,232,255,.9)';g.fillRect(px-w*s/2,py-h*s/2,w*s,h*s);};
 const bone='rgba(120,215,255,.22)';
 if(view==='front'){
  // The skull: a broad round cranium with big eye sockets, cheekbones, a short muzzle with teeth, and the ear cartilage.
  for(const k of [-1,1])shape([[k*.11,1.57],[k*.215,1.73],[k*.27,1.5]],'rgba(120,215,255,.08)');
  oval(0,1.42,.25,.205,bone,.016);
  for(const k of [-1,1]){oval(k*.1,1.41,.07,.078,'rgba(5,25,45,.85)');line([[k*.165,1.33],[k*.235,1.385]],.018);}
  shape([[-.025,1.325],[.025,1.325],[0,1.295]],'rgba(5,25,45,.85)');
  oval(0,1.245,.12,.055,bone,.014);
  for(let i=-3;i<=3;i++)line([[i*.025,1.235],[i*.025,1.21]],.009);
  for(let i=0;i<3;i++)vertebra(0,1.135+i*.022,.05,.014);
  // The spine, collarbones, ribs and breastbone.
  for(let y=.66;y<1.11;y+=.04)vertebra(0,y,.045,.024);
  for(const k of [-1,1]){line([[0,1.08],[k*.16,1.045]],.022);for(let i=0;i<6;i++){const y=1.045-i*.033,w=.15-i*.007;g.beginPath();const [a,b]=P(k*.012,y),[c,d]=P(k*(w+.02),y+.01),[e,f]=P(k*(w-.015),y-.055);g.moveTo(a,b);g.quadraticCurveTo(c,d,e,f);g.lineWidth=.016*s;g.strokeStyle='rgba(150,232,255,.9)';g.stroke();}}
  line([[0,1.06],[0,.88]],.022);
  // The arms, hanging relaxed: upper arm, the two forearm bones and the paw.
  for(const k of [-1,1]){
   line([[k*.16,1.045],[k*.19,.87]],.034);knob(k*.16,1.045,.026);knob(k*.19,.87,.022);
   line([[k*.18,.86],[k*.2,.645]],.018);line([[k*.2,.865],[k*.222,.648]],.016);knob(k*.21,.63,.02);
   for(let j=0;j<4;j++){const dx=-.03+j*.02;line([[k*(.205+dx*.4),.615],[k*(.205+dx),.56],[k*(.2+dx*1.2),.51]],.01);}
  }
  // The pelvis and the legs: thigh bones, knee caps, shin bones and the hind paws.
  for(const k of [-1,1]){
   shape([[k*.02,.705],[k*.135,.715],[k*.125,.62],[k*.055,.575],[k*.01,.6]],bone);oval(k*.07,.625,.025,.02,'rgba(5,25,45,.85)',.008);
   line([[k*.1,.64],[k*.116,.325]],.038);knob(k*.1,.645,.03);oval(k*.118,.31,.02,.02,'rgba(150,232,255,.9)');
   line([[k*.11,.295],[k*.112,.11]],.03);line([[k*.138,.29],[k*.132,.115]],.012);knob(k*.115,.085,.03);
   for(let j=0;j<4;j++){const dx=-.03+j*.02;line([[k*(.115+dx*.4),.07],[k*(.115+dx*1.3),.012]],.01);}
  }
  shape([[0,.67],[.03,.62],[-.03,.62]],bone);
 }else{
  // The skull in profile: cranium, eye socket, muzzle and jaw, and the ear.
  shape([[.0,1.57],[.07,1.75],[.15,1.585]],'rgba(120,215,255,.08)');
  oval(.06,1.42,.22,.2,bone,.016);
  oval(.18,1.41,.055,.072,'rgba(5,25,45,.85)');
  shape([[.2,1.36],[.31,1.315],[.3,1.255],[.17,1.24]],bone);
  line([[.28,1.235],[.13,1.215],[.02,1.24]],.02);
  for(let i=0;i<4;i++)line([[.27-i*.03,1.25],[.27-i*.03,1.228]],.008);
  for(let i=0;i<3;i++)vertebra(-.005,1.135+i*.022,.035,.016);
  // The spine with its spines pointing back, the shoulder blade, the ribcage from the side.
  const spine=[[-.045,.64],[-.035,.74],[-.025,.86],[-.03,.98],[-.01,1.1]];
  for(let i=0;i<spine.length-1;i++)for(let t=0;t<1;t+=.34){const x=spine[i][0]+(spine[i+1][0]-spine[i][0])*t,y=spine[i][1]+(spine[i+1][1]-spine[i][1])*t;vertebra(x,y,.032,.024);line([[x-.016,y],[x-.04,y-.012]],.008);}
  shape([[-.07,1.07],[-.02,1.06],[-.05,.95]],bone);
  for(let i=0;i<6;i++){const y=1.04-i*.032;g.beginPath();const [a,b]=P(-.03,y),[c,d]=P(.06,y+.01),[e,f]=P(.1-i*.008,y-.07);g.moveTo(a,b);g.quadraticCurveTo(c,d,e,f);g.lineWidth=.016*s;g.strokeStyle='rgba(150,232,255,.9)';g.stroke();}
  // The near arm and leg, as Cosmo stands: elbow back a touch, paw forward; knee soft, the hind paw flat.
  line([[0,1.045],[-.01,.87]],.034);knob(0,1.045,.026);knob(-.01,.87,.022);
  line([[-.012,.86],[.085,.64]],.018);line([[.005,.865],[.1,.645]],.014);knob(.092,.63,.02);
  for(let j=0;j<3;j++)line([[.095,.615],[.13+j*.012,.55],[.15+j*.015,.505]],.01);
  shape([[-.11,.705],[.03,.7],[.045,.6],[-.06,.57]],bone);oval(-.02,.625,.025,.02,'rgba(5,25,45,.85)',.008);
  line([[-.01,.64],[.012,.325]],.038);knob(-.01,.645,.03);oval(.035,.315,.02,.022,'rgba(150,232,255,.9)');
  line([[.01,.3],[-.045,.11]],.03);line([[-.01,.295],[-.06,.115]],.012);knob(-.047,.09,.03);
  line([[-.065,.06],[-.035,.012]],.022);for(let j=0;j<3;j++)line([[-.03,.075],[.09,.045-j*.008],[.2+j*.01,.03-j*.008]],.01);
  // The tail, hanging low and curling back.
  const tail=new T.CatmullRomCurve3(SIDE_TAIL.map(([z,y])=>new T.Vector3(z,y,0))).getPoints(14);
  line(tail.map(p=>[p.x,p.y]),.014,.7);tail.forEach((p,i)=>vertebra(p.x,p.y,.034-i*.0012,.03-i*.0011));
 }
}
// The scan panel: a front and a side view of the patient cat inside reticles, with a heart trace, gauges and bars,
// cyan on faint blue glass. `seed` varies the readouts between panels.
export function paintScan(g,w,h,seed,occupied=false){
 g.clearRect(0,0,w,h);
 const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'rgba(18,70,120,.55)');grad.addColorStop(1,'rgba(12,50,95,.42)');g.fillStyle=grad;g.fillRect(0,0,w,h);
 g.strokeStyle='rgba(130,220,255,.85)';g.lineWidth=3;g.strokeRect(5,5,w-10,h-10);
 g.fillStyle='rgba(130,220,255,.9)';g.fillRect(5,5,w-10,40);
 g.fillStyle='rgba(8,30,50,.95)';g.font='bold 24px sans-serif';g.textBaseline='middle';g.fillText('FELINE SKELETAL SCAN',22,26);
 g.textAlign='right';g.fillText(`BAY ${seed+1}`,w-22,26);g.textAlign='left';
 g.shadowColor='#6fdcff';g.shadowBlur=8;
 const s=250,base=h-40,cy=base-.86*s,R=215;
 // Each figure in its reticle; the side view sits off centre, its tail reaching back.
 for(const [rx,cx,view] of [[240,240,'front'],[660,683,'side']]){
  g.strokeStyle='rgba(120,215,255,.35)';g.lineWidth=2;g.beginPath();g.arc(rx,cy,R,0,Math.PI*2);g.stroke();
  g.strokeStyle='rgba(120,215,255,.8)';g.lineWidth=5;g.beginPath();g.arc(rx,cy,R,-2.4,-.7);g.stroke();g.beginPath();g.arc(rx,cy,R,.75,2.3);g.stroke();
  for(let i=0;i<36;i++){const a=i*Math.PI/18,r0=R-10,r1=i%9?R-18:R-30;g.beginPath();g.moveTo(rx+Math.cos(a)*r0,cy+Math.sin(a)*r0);g.lineTo(rx+Math.cos(a)*r1,cy+Math.sin(a)*r1);g.lineWidth=2;g.stroke();}
  skeleton(g,(x,y)=>[cx+x*s,base-y*s],s,view);
  g.font='bold 18px sans-serif';g.fillStyle='rgba(150,232,255,.9)';g.fillText(view==='front'?'FRONT':'SIDE',rx-R+6,cy-R+20);
 }
 // The readouts down the right-hand side.
 const x0=w-134;let r=seed*7919+13;const rand=()=>((r=(r*9301+49297)%233280)/233280);
 g.strokeStyle='#8fe6ff';g.lineWidth=3;g.beginPath();
 for(let x=x0;x<w-18;x+=3){const t=(x-x0+seed*30)%60,y=110-(t>24&&t<28?34:t>28&&t<32?-16:0)+Math.sin(x*.07)*2;x===x0?g.moveTo(x,y):g.lineTo(x,y);}g.stroke();
 g.lineWidth=9;g.strokeStyle='rgba(120,220,255,.3)';g.beginPath();g.arc(x0+60,215,42,0,Math.PI*2);g.stroke();
 g.strokeStyle='#8fe6ff';g.beginPath();g.arc(x0+60,215,42,-Math.PI/2,-Math.PI/2+Math.PI*2*(.55+rand()*.35));g.stroke();
 g.shadowBlur=0;g.fillStyle='rgba(143,230,255,.8)';
 for(let i=0;i<6;i++){const bh=18+rand()*70;g.fillRect(x0+i*20,400-bh,13,bh);}
 for(let i=0;i<6;i++)g.fillRect(x0,430+i*26,40+rand()*80,8);
 g.font='bold 18px sans-serif';g.fillText(occupied?'VISITOR ON BED':'PATIENT PREVIEW',22,h-17);
 g.textAlign='right';g.fillText('ILLUSTRATIVE SCAN',w-22,h-17);g.textAlign='left';
}

function canvasTexture(w,h,paint,anisotropy){
 const canvas=walkCanvas();canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=anisotropy;return t;
}

// The scans on the dividers, the scan lines sweeping them and a line of light passing along each bed's pad, drawn with their
// deck band. update() moves them only while the walker is on Deck 5 near the room, and keeps them still for reduced
// motion.
export function createImagingScans(ship,{still=false,anisotropy=4,kit=null}={}){
 const room=roomObject(ship,ROOM);if(!room||!hasWalkCanvas())return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Imaging_scans';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const toRoom=room.matrixWorld.clone().invert(),local=new T.Vector3(),patients=[];
 if(kit)for(const z of BAYS){
  const patient=kit.figure('scanPatient');patient.name='Imaging_patient';
  // Head toward the pillow and gantry, back on the pad. Shared baked meshes need no animated rig.
  patient.rotation.set(0,-Math.PI/2,0);const body=new T.Group();body.rotation.x=-Math.PI/2;
  body.add(...patient.children.slice());patient.add(body);
  patient.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(patient,true);
  patient.position.set(6.7-bounds.max.x,.755-bounds.min.y,z-(bounds.min.z+bounds.max.z)/2);
  group.add(patient);patients.push(patient);
 }
 const panels=[0,1].map(seed=>new T.MeshBasicMaterial({name:'Imaging_scan',map:canvasTexture(1024,640,(g,w,h)=>paintScan(g,w,h,seed),anisotropy),transparent:true,depthWrite:false,toneMapped:false}));
 const sweep=new T.MeshBasicMaterial({name:'Imaging_sweep',color:0x5fd4ff,transparent:true,opacity:.85,depthWrite:false,toneMapped:false});
 const beam=new T.MeshBasicMaterial({name:'Imaging_beam',color:0x5fd4ff,toneMapped:false});
 const PW=3.2,PH=2,PY=1.3,lines=[],beams=[];
 DIVIDERS.forEach((d,i)=>{
  const bay=BAYS.indexOf(Math.sign(d.z)*10);
  for(const f of d.faces){
   const holder=new T.Group();holder.position.set(d.x+(d.alongX?0:f*.06),0,d.z+(d.alongX?f*.06:0));holder.rotation.y=d.alongX?(f>0?0:Math.PI):(f>0?Math.PI/2:-Math.PI/2);group.add(holder);
   const p=new T.Mesh(new T.PlaneGeometry(PW,PH),panels[bay]);p.name='Imaging_scan_graphics';p.position.y=PY;p.renderOrder=2;holder.add(p);
   const l=new T.Mesh(new T.PlaneGeometry(PW*.83,.025),sweep);l.name='Imaging_scan_line_graphics';l.position.set(-PW*.06,PY,.005);l.renderOrder=3;holder.add(l);lines.push({l,phase:i*1.3+f});
  }
 });
 for(const [i,z] of BAYS.entries()){
  const b=new T.Mesh(new T.BoxGeometry(.03,.012,.66),beam);b.name='Imaging_scan_beam_graphics';b.position.set(5,.762,z);b.renderOrder=3;group.add(b);beams.push({b,phase:i*2.1});
 }
 const centre=room.getWorldPosition(new T.Vector3());
 const pose=t=>{
  // The line climbs the figures from the feet to the ears and drops back; the beam travels the bed to the gantry and back.
  for(const {l,phase} of lines){const k=(t*.18+phase)%1;l.position.y=PY-PH*.44+PH*.69*(k<.85?k/.85:1-(k-.85)/.15);}
  for(const {b,phase} of beams)b.position.x=5.2+1.5*Math.sin(t*.5+phase);
 };
 pose(0);
 const occupied=BAYS.map(()=>false);
 function update(dt,p,resting=null,remotes=null){
  if(Math.abs(p.y-centre.y)>4||Math.abs(p.x-centre.x)>40||Math.abs(p.z-centre.z)>30)return;
  for(const [i,z] of BAYS.entries()){
   const atBed=point=>{local.copy(point).applyMatrix4(toRoom);return Math.abs(local.y-.885)<.5&&local.x>3.8&&local.x<6.2&&Math.abs(local.z-z)<.6;};
   let used=!!(resting?.lie&&atBed(resting.to.pos));
   if(!used&&remotes)for(const r of remotes.values())if(r.restKind==='lie'&&r.rest>0&&atBed(r.cur)){used=true;break;}
   if(patients[i])patients[i].visible=!used;
   if(used!==occupied[i]){occupied[i]=used;const t=panels[i].map,c=t.image;paintScan(c.getContext('2d'),c.width,c.height,i,used);t.needsUpdate=true;}
  }
  if(still)return;
  pose(performance.now()/1000);
 }
 return {group,update};
}
