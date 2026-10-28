import {roomObject} from '../plan/rooms.js';
import {walkCanvas} from './canvas.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Deck 1's Cargo maintenance becomes the depot for the ship's Mars Cat Transporters (MCTs), small grey utility
// vehicles (from tester feedback). Six charging bays line the outboard wall, each with a wall-mounted power unit, its
// heavy charging cable and an orange coolant umbilical, a wheel stop and a lit sign, MCT-01 CHARGING to MCT-06
// CHARGING. Four are charging; the two empty bays' cables hang coiled on their units. Two service bays sit in front of
// the tool cabinets, MCT-01 SERVICE and MCT-02 SERVICE: in the first an MCT stands raised on yellow jack stands beside
// a mechanic's tool trolley (an open drawer, torque wrenches and two diagnostic tablets with telemetry); in the second
// one stands on low hydraulic lift pads. Road markings on the floor (a dashed centre line, lane legends at the
// entrance, dashed lead-in curves and painted bay numbers) guide vehicles from the doorway into their bays. The old
// repair benches go to make room; the tool cabinets, the centre aisle and the doorway stay as they were.
// Room frame (Area_d01-workshop-5): the doorway at x=-25.92 (|z|<2), the amber aisle lines at z=±2, the outboard wall's
// face at z=16.84, the tool cabinets along z=-15 (front faces at z=-14.45, 2.6 m high), the room title on the far wall
// at x=25.84 (|z|<7), the ceiling at y=3.3 with light strips at z=0, ±6 and ±12.
const ROOM='Area_d01-workshop-5';
const WALL=16.84,CEIL=3.3;
// The old benches, their tools and tool boards, and the benches' merged board fittings.
const OLD=/^(Service_counter|Countertop|Tool|Tool_board|Refined_tool_storage)$/;
// Charging bays (x centres, 3.7 m apart, outboard side) and service bays (x centres, cabinet side).
export const CHARGE_BAYS=[-2.5,1.2,4.9,8.6,12.3,16];
export const SERVICE_BAYS=[-11.5,-4.5];
const BAY_W=3.7,MOUTH=10.7,SERVICE={w:6.2,z0:-14.2,z1:-6.8};
// Which vehicle stands where: four charging, MCT-03 and MCT-06 in the service bays.
const CHARGING={0:1,1:2,3:4,4:5},IN_SERVICE=[3,6];
// The vehicle: length along its own z (nose toward +z), width along x, and how far the service bays raise it.
const MCT={L:3.24,W:1.6,H:1.66,wheel:.36,axle:1.05,track:.78};
const FONT='"Archivo", "Sora", sans-serif',MONO='"JetBrains Mono", ui-monospace, monospace';

function canvasTexture(w,h,paint){
 const c=walkCanvas();c.width=w;c.height=h;const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
 const draw=()=>{const g=c.getContext('2d');g.clearRect(0,0,w,h);paint(g,w,h);t.needsUpdate=true;};
 draw();globalThis.document?.fonts?.ready.then(draw);return t;
}
// A texture of `rows` equal strips; uv(row) maps a plane onto one of them.
function atlas(w,rowH,rows,paint){
 const tex=canvasTexture(w,rowH*rows,(g)=>{for(let r=0;r<rows;r++){g.save();g.translate(0,r*rowH);g.beginPath();g.rect(0,0,w,rowH);g.clip();paint(g,r,w,rowH);g.restore();}});
 return {tex,uv(geo,row){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,1-(row+1-uv.getY(i))/rows);return geo;}};
}
const bolt=(g,x,y,s)=>{g.beginPath();g.moveTo(x+s*.15,y-s*.5);g.lineTo(x-s*.25,y+s*.06);g.lineTo(x+.02*s,y+s*.06);g.lineTo(x-s*.12,y+s*.5);g.lineTo(x+s*.28,y-s*.08);g.lineTo(x+.01*s,y-s*.08);g.closePath();g.fill();};
function wrench(g,x,y,s){g.save();g.translate(x,y);g.rotate(-Math.PI/4);g.fillRect(-s*.07,-s*.32,s*.14,s*.62);g.beginPath();g.arc(0,-s*.36,s*.17,0,Math.PI*2);g.fill();g.globalCompositeOperation='destination-out';g.fillRect(-s*.06,-s*.56,s*.12,s*.2);g.restore();}
// The bay signs: a navy plate with a yellow rim, the bay name in white and a green bolt or a yellow wrench.
function signAtlas(){
 const names=[...CHARGE_BAYS.map((_,i)=>`MCT-0${i+1}`),...SERVICE_BAYS.map((_,i)=>`MCT-0${i+1}`)];
 return atlas(1024,192,names.length,(g,r,w,h)=>{
  const service=r>=CHARGE_BAYS.length;
  g.fillStyle='#16283a';g.fillRect(0,0,w,h);g.strokeStyle='#f2b631';g.lineWidth=10;g.strokeRect(9,9,w-18,h-18);
  g.fillStyle=service?'#f2b631':'#3ee08a';if(service)wrench(g,96,h/2,110);else bolt(g,96,h/2,120);
  g.fillStyle='#ffffff';g.textAlign='left';g.textBaseline='middle';g.font=`700 92px ${FONT}`;g.fillText(names[r],180,h/2+4);
  g.fillStyle=service?'#f2b631':'#3ee08a';g.font=`700 64px ${MONO}`;g.textAlign='right';g.fillText(service?'SERVICE':'CHARGING',w-40,h/2+4);
 });
}
// Painted floor legends and bay numbers: yellow on clear, slightly worn.
function floorAtlas(){
 const rows=[['▶ CHARGING 01–06','lane'],['▶ SERVICE 1–2','lane'],...CHARGE_BAYS.map((_,i)=>[`MCT-0${i+1}`,'bay']),...SERVICE_BAYS.map((_,i)=>[`SERVICE ${i+1}`,'bay'])];
 return atlas(1024,256,rows.length,(g,r,w,h)=>{
  const [text,kind]=rows[r];g.fillStyle=kind==='lane'?'#f4f1e6':'#f2b631';g.textAlign='center';g.textBaseline='middle';
  g.font=`800 ${kind==='lane'?150:190}px ${FONT}`;let size=kind==='lane'?150:190;
  while(g.measureText(text).width>w-60&&size>40){size-=8;g.font=`800 ${size}px ${FONT}`;}
  g.fillText(text,w/2,h/2+8);
  // Wear: a scatter of small clear flecks.
  g.globalCompositeOperation='destination-out';let s=r*977+13;for(let i=0;i<260;i++){s=(s*16807)%2147483647;const x=s%w;s=(s*16807)%2147483647;const y=s%h;g.fillRect(x,y,3+(s%4),2+(s%3));}
 });
}
// The vehicles' unit numbers, white on clear, for their sides and tails.
function numberAtlas(){
 return atlas(512,128,6,(g,r,w,h)=>{g.fillStyle='#f1f3f2';g.textAlign='center';g.textBaseline='middle';g.font=`700 96px ${FONT}`;g.fillText(`MCT-0${r+1}`,w/2,h/2+4);});
}
// The power units' screens: the bay, what it is doing and the charge.
function unitAtlas(){
 const charge=[82,47,0,96,64,0];
 return atlas(256,192,6,(g,r,w,h)=>{
  const on=charge[r]>0;g.fillStyle='#071419';g.fillRect(0,0,w,h);
  g.fillStyle='#7fe3ff';g.font=`700 26px ${MONO}`;g.textAlign='left';g.textBaseline='top';g.fillText(`BAY 0${r+1}`,16,14);
  g.fillStyle=on?'#3ee08a':'#f2b631';g.font=`700 24px ${MONO}`;g.fillText(on?'CHARGING':'READY',16,50);
  g.strokeStyle='#7fe3ff';g.lineWidth=3;g.strokeRect(16,94,190,46);g.fillRect(206,108,8,18);
  if(on){g.fillStyle='#3ee08a';g.fillRect(21,99,180*charge[r]/100,36);g.fillStyle='#e8fbff';g.font=`700 26px ${MONO}`;g.fillText(charge[r]+'%',20,150);g.fillText('48 kW',130,150);}
  else{g.fillStyle='#8aa3ad';g.font=`600 20px ${MONO}`;g.fillText('IN SERVICE BAY',16,152);}
 });
}
// The diagnostic tablets: a battery-cell grid with one warm cell and a motor trace, and a wheel-nut torque log.
function telemetry(kind){
 return canvasTexture(512,320,(g,w,h)=>{
  g.fillStyle='#08161d';g.fillRect(0,0,w,h);g.fillStyle='#12303b';g.fillRect(0,0,w,40);
  g.fillStyle='#7fe3ff';g.font=`700 22px ${MONO}`;g.textBaseline='middle';g.textAlign='left';g.fillText(kind==='cells'?'MCT-03  DIAGNOSTICS':'MCT-03  TORQUE LOG',14,21);
  g.fillStyle='#3ee08a';g.textAlign='right';g.fillText(kind==='cells'?'LIFT OK':'4/4 ✓',w-14,21);g.textAlign='left';
  if(kind==='cells'){
   for(let i=0;i<24;i++){const x=14+(i%8)*36,y=56+Math.floor(i/8)*40;g.fillStyle=i===13?'#f2b631':'#2fbf74';g.fillRect(x,y,30,32);}
   g.fillStyle='#cfe9f2';g.font=`600 17px ${MONO}`;g.fillText('PACK 92%  412 V',310,70);g.fillText('CELL 14  41°C',310,100);g.fillText('MOTOR  OK',310,130);
   g.strokeStyle='#26505e';g.lineWidth=1;for(let y=190;y<=300;y+=27)g.beginPath(),g.moveTo(14,y),g.lineTo(w-14,y),g.stroke();
   g.strokeStyle='#7fe3ff';g.lineWidth=3;g.beginPath();for(let x=0;x<=w-28;x+=6){const y=250-28*Math.sin(x/38)-12*Math.sin(x/11);x?g.lineTo(14+x,y):g.moveTo(14,y);}g.stroke();
  }else{
   g.font=`600 24px ${MONO}`;[['FRONT LEFT','145 N·m'],['FRONT RIGHT','145 N·m'],['REAR LEFT','145 N·m'],['REAR RIGHT','145 N·m'],['JACK STANDS','LOCKED']].forEach(([a,b],i)=>{
    const y=72+i*48;g.fillStyle='#cfe9f2';g.fillText(a,18,y);g.fillStyle='#3ee08a';g.textAlign='right';g.fillText(b+'  ✓',w-18,y);g.textAlign='left';
    g.fillStyle='#173540';g.fillRect(14,y+22,w-28,2);});
  }
 });
}
// Diagonal yellow and black hazard stripes, repeating.
function stripeTexture(){
 const t=canvasTexture(64,64,(g,w,h)=>{g.fillStyle='#f2b631';g.fillRect(0,0,w,h);g.fillStyle='#1b1f22';for(const o of [-64,0,64]){g.beginPath();g.moveTo(o,0);g.lineTo(o+32,0);g.lineTo(o+96,h);g.lineTo(o+64,h);g.closePath();g.fill();}});
 t.wrapS=t.wrapT=T.RepeatWrapping;return t;
}

// Take the room's repair benches, tools and tool boards out before the colliders are built. Returns false if the
// room is missing.
export function stripCargoMaintenance(ship){
 const room=roomObject(ship,ROOM);if(!room)return false;
 const old=[];room.traverse(o=>{if(o.isMesh&&OLD.test(o.name))old.push(o);});
 for(const o of old){o.removeFromParent();o.geometry.dispose();}
 return true;
}

// The depot in ship coordinates: `group` draws (with its deck band) and `solid` holds plain boxes for the vehicles,
// power units, tool trolley and lift pump. Returns null if the room is missing.
export function createMctBay(ship){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Cargo_maintenance_MCT_bay';room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Cargo_maintenance_MCT_bay_colliders';room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const std=(name,color,o={})=>new T.MeshStandardMaterial({name:'MCT_bay_'+name,color,roughness:.55,metalness:.15,...o});
 const lit=(name,color)=>new T.MeshBasicMaterial({name:'MCT_bay_'+name,color,toneMapped:false});
 const paint=(name,map,o={})=>std(name,0xffffff,{map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,metalness:0,roughness:.8,...o});
 const signs=signAtlas(),floor=floorAtlas(),numbers=numberAtlas(),units=unitAtlas(),stripes=stripeTexture();
 const M={body:std('body',0x77838c,{roughness:.5,metalness:.3}),panel:std('panel',0x5d6870,{roughness:.5,metalness:.3}),dark:std('dark',0x22292e,{roughness:.6}),
  tyre:std('tyre',0x191c1e,{roughness:.9,metalness:0}),hub:std('hub',0x9aa5ab,{metalness:.6,roughness:.35}),glass:std('glass',0x12212b,{roughness:.15,metalness:.4}),
  steel:std('steel',0xa9b4b8,{metalness:.7,roughness:.32}),yellow:std('yellow',0xf2b631,{roughness:.45,metalness:.2}),unit:std('power_unit',0x3c4a54,{roughness:.45,metalness:.35}),
  cable:std('cable',0x15181a,{roughness:.7,metalness:0}),hose:std('hose',0xe2702a,{roughness:.55,metalness:0}),
  trolley:std('trolley',0x5f6a72,{roughness:.45,metalness:.35}),grip:std('grip',0x1d2427,{roughness:.85,metalness:0}),
  head:lit('headlight',0xfff3d6),tail:lit('taillight',0xff3b2f),beacon:lit('beacon',0xffa320),green:lit('status_green',0x3ee08a),amber:lit('status_amber',0xf2b631),
  stripe:std('hazard',0xffffff,{map:stripes,roughness:.5}),floorStripe:paint('floor_hazard',stripes,{transparent:false,depthWrite:true}),
  line:paint('floor_line',null,{color:0xf2b631,transparent:false,depthWrite:true}),white:paint('floor_white',null,{color:0xf4f1e6,transparent:false,depthWrite:true}),
  legend:paint('floor_legend',floor.tex),numbers:std('numbers',0xffffff,{map:numbers.tex,transparent:true,depthWrite:false,metalness:0}),
  sign:std('sign',0xffffff,{map:signs.tex,emissive:0xffffff,emissiveMap:signs.tex,emissiveIntensity:.55,metalness:0,roughness:.4}),
  screen:new T.MeshBasicMaterial({name:'MCT_bay_unit_screen',map:units.tex,toneMapped:false}),
  cells:new T.MeshBasicMaterial({name:'MCT_bay_tablet_cells',map:telemetry('cells'),toneMapped:false}),
  torque:new T.MeshBasicMaterial({name:'MCT_bay_tablet_torque',map:telemetry('torque'),toneMapped:false})};
 const parts=new Map(),piece=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g.index?g.toNonIndexed():g);};
 // Everything is placed through a frame: room coordinates, or a vehicle's or the trolley's own.
 let F=new T.Matrix4();
 const within=(x,y,z,ry,fn)=>{const keep=F;F=F.clone().multiply(new T.Matrix4().makeRotationY(ry).setPosition(x,y,z));fn();F=keep;};
 const put=(m,g)=>piece(m,g.applyMatrix4(F));
 const box=(m,[w,h,d],[x,y,z],rx=0,ry=0,rz=0)=>put(m,new T.BoxGeometry(w,h,d).rotateX(rx).rotateZ(rz).rotateY(ry).translate(x,y,z));
 const cyl=(m,r,h,[x,y,z],axis='y',seg=14)=>{const g=new T.CylinderGeometry(r,r,h,seg);if(axis==='x')g.rotateZ(Math.PI/2);if(axis==='z')g.rotateX(Math.PI/2);put(m,g.translate(x,y,z));};
 const tube=(m,pts,r,seg=28)=>put(m,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),seg,r,8));
 const rod=(m,a,b,r)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),g=new T.CylinderGeometry(r,r,va.distanceTo(vb),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),vb.clone().sub(va).normalize()));put(m,g.translate(...va.add(vb).multiplyScalar(.5).toArray()));};
 // A flat plane: `face` is 'up' (on the floor; ry turns which way its top edge points), or a facing direction on a wall.
 const plane=(m,[w,h],[x,y,z],ry=0,up=false,row=null,ref=null)=>{const g=new T.PlaneGeometry(w,h);if(ref&&row!==null)ref.uv(g,row);if(up)g.rotateX(-Math.PI/2);put(m,g.rotateY(ry).translate(x,y,z));};
 const block=([w,h,d],[x,y,z],ry=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d));o.position.set(x,y,z);o.rotation.y=ry;solid.add(o);};
 // A stripe-textured strip on the floor, its pattern repeating every 0.4 m.
 const hazard=(len,w,[x,z],ry)=>{const g=new T.PlaneGeometry(len,w),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*len/.4,uv.getY(i)*w/.4);put(M.floorStripe,g.rotateX(-Math.PI/2).rotateY(ry).translate(x,.005,z));};

 // One MCT in its own frame: floor at y=0, nose toward +z, raised by `lift` (wheels hanging) in the service bays.
 function vehicle(n,lift=0){
  const {L,W,H,wheel,axle,track}=MCT,b=.46+lift,h=y=>y+lift;
  for(const sz of [-1,1])for(const sx of [-1,1]){cyl(M.tyre,wheel,.28,[sx*track,h(wheel),sz*axle],'x',18);cyl(M.hub,.17,.3,[sx*track,h(wheel),sz*axle],'x',12);cyl(M.dark,.07,.32,[sx*track,h(wheel),sz*axle],'x',8);}
  box(M.dark,[1.2,.2,2.9],[0,h(.37),0]);
  for(const sz of [-1,1])box(M.dark,[1.1,.08,.12],[0,h(.36),sz*axle]);
  // The body from its side profile: a low rear box, a taller cab with a sloping nose.
  const s=new T.Shape([[-L/2,0],[L/2,0],[L/2,.66],[L/2-.47,H-.46],[.05,H-.46],[.05,H-.64],[-L/2,H-.64]].map(([z,y])=>new T.Vector2(z,y)));
  put(M.body,new T.ExtrudeGeometry(s,{depth:W,bevelEnabled:false}).translate(0,0,-W/2).rotateY(-Math.PI/2).translate(0,b,0));
  // Wheel-arch flares, skirts, bumpers, grille and lights.
  for(const sz of [-1,1])for(const sx of [-1,1])box(M.panel,[.34,.12,.86],[sx*(W/2+.05),b+.32,sz*axle]);
  for(const sx of [-1,1])box(M.panel,[.06,.22,.9],[sx*(W/2+.02),b+.12,0]);
  for(const sz of [-1,1])box(M.dark,[W+.1,.24,.16],[0,b+.08,sz*(L/2+.06)]);
  box(M.dark,[.9,.22,.03],[0,b+.42,L/2+.012]);
  for(let j=0;j<4;j++)box(M.steel,[.84,.018,.035],[0,b+.34+j*.05,L/2+.02]);
  for(const sx of [-1,1]){box(M.head,[.24,.11,.03],[sx*.56,b+.44,L/2+.012]);box(M.tail,[.18,.1,.03],[sx*.6,b+.48,-L/2-.012]);}
  for(let j=0;j<3;j++)for(const sx of [-1,1])box(M.yellow,[.08,.14,.02],[sx*(.18+j*.12),b+.57,L/2+.012],0,0,sx*.6);
  // Windscreen on the sloping nose and side windows on the cab.
  {const dz=.47,dy=H-.46-.66,a=Math.atan2(dz,dy);box(M.glass,[W-.2,Math.hypot(dz,dy)*.78,.02],[0,b+.66+dy/2+.006,L/2-dz/2+.01],-a);}
  for(const sx of [-1,1])box(M.glass,[.02,.34,.9],[sx*(W/2+.006),b+H-.68,.72]);
  // Hazard band on the rear box, the unit number on both sides and the tail, and the charge port (right side).
  for(const sx of [-1,1]){box(M.stripe,[.012,.12,1.3],[sx*(W/2+.004),b+.86,-.82]);
   const g=new T.PlaneGeometry(1.15,.29);numbers.uv(g,n-1);put(M.numbers,g.rotateY(sx*Math.PI/2).translate(sx*(W/2+.008),b+.62,-.82));}
  {const g=new T.PlaneGeometry(.7,.175);numbers.uv(g,n-1);put(M.numbers,g.rotateY(Math.PI).translate(0,b+.74,-L/2-.006));}
  box(M.dark,[.03,.22,.18],[-W/2-.01,b+.56,.58]);
  box(M.panel,[.02,.2,.16],[-W/2-.09,b+.56,.72],0,-.9);
  // Roof: an amber beacon on the cab, a rail and a service hatch on the rear box.
  box(M.dark,[.3,.05,.14],[0,b+H-.435,.6]);box(M.beacon,[.22,.07,.1],[0,b+H-.385,.6]);
  for(const sx of [-1,1])rod(M.steel,[sx*.6,b+H-.6,-1.45],[sx*.6,b+H-.6,-.15],.02);
  box(M.panel,[.7,.04,.6],[0,b+H-.62,-.8]);
 }
 // The vehicle's collider, and its plain box, in the current frame.
 const vehicleBlock=(x,z,ry,lift=0)=>block([MCT.W+.32,MCT.H+lift,MCT.L+.3],[x,(MCT.H+lift)/2,z],ry);

 // --- The charging bays, along the outboard wall.
 const zv=WALL-.3-.25-MCT.L/2;
 for(const [i,xc] of CHARGE_BAYS.entries()){
  const n=CHARGING[i],xu=xc-1.35,xv=xc+.25,zf=WALL-.15;
  // The wall-mounted power unit: its cabinet, conduit to the ceiling, the bay's screen and status strip.
  box(M.unit,[.7,1.5,.3],[xu,1.25,zf]);
  box(M.dark,[.6,.05,.02],[xu,1.98,zf-.155]);
  rod(M.steel,[xu,2,WALL-.08],[xu,CEIL,WALL-.08],.05);
  plane(M.screen,[.44,.33],[xu,1.62,zf-.152],Math.PI,false,i,units);
  box(n?M.green:M.amber,[.44,.035,.01],[xu,1.38,zf-.155]);
  box(M.dark,[.18,.12,.08],[xu,.6,zf-.18]);
  // The bay's sign over the vehicle, the wheel stop, the divider lines and its painted number.
  box(M.dark,[2.28,.5,.04],[xv,2.62,WALL-.02]);plane(M.sign,[2.2,.42],[xv,2.62,WALL-.045],Math.PI,false,i,signs);
  box(M.yellow,[1.4,.1,.14],[xv,.05,WALL-.67]);
  for(const s of [-1,1])if(s<0||i===CHARGE_BAYS.length-1)box(M.line,[.1,.004,WALL-.1-MOUTH],[xc+s*BAY_W/2,.004,(WALL-.1+MOUTH)/2]);
  plane(M.legend,[2.4,.6],[xv,.007,MOUTH+.75],Math.PI,true,2+i,floor);
  block([.78,1.6,.38],[xu,1.25,zf-.02]);
  if(n){
   // A vehicle on charge: the heavy cable from the unit's outlet along the floor to its port, the coolant umbilical
   // arcing from the unit's top to its roof coupler.
   within(xv,0,zv,0,()=>vehicle(n));vehicleBlock(xv,zv,0);
   const port=[xv-MCT.W/2-.03,.46+.56,zv+.58];
   tube(M.cable,[[xu,.6,zf-.24],[xu+.05,.12,zf-.45],[xu+.15,.045,zf-.9],[port[0]-.25,.045,port[2]+.2],[port[0]-.2,.5,port[2]+.02],[port[0]-.04,port[1],port[2]]],.045,40);
   box(M.dark,[.1,.14,.12],[port[0]-.04,port[1],port[2]]);
   const top=[xv-.45,.46+MCT.H-.42,zv+1.1],hose=[[xu+.36,1.8,zf-.05],[xu+.62,2.12,zf-.2],[top[0]-.3,2.15,top[2]+.35],[top[0],top[1]+.18,top[2]+.06],top];
   tube(M.hose,hose,.035,40);
   const curve=new T.CatmullRomCurve3(hose.map(p=>new T.Vector3(...p)));
   for(let t=.04;t<.97;t+=.045){const p=curve.getPointAt(t),d=curve.getTangentAt(t),g=new T.TorusGeometry(.038,.008,5,10);g.lookAt(d);put(M.hose,g.translate(p.x,p.y,p.z));}
   cyl(M.steel,.05,.1,top);
  }else{
   // An empty bay: the cable and hose hang coiled on the unit's hooks.
   box(M.steel,[.06,.06,.12],[xu,1.12,zf-.2]);
   put(M.cable,new T.TorusGeometry(.2,.04,8,24).translate(xu,.92,zf-.26));
   put(M.hose,new T.TorusGeometry(.15,.035,8,20).translate(xu+.42,1.45,zf-.12));
   box(M.dark,[.1,.14,.12],[xu-.12,.72,zf-.27]);
  }
 }
 // Lead-in curves from the roadway to each charging bay: yellow dashes on a quarter bend.
 const dashes=(x0,z0,x1,z1,cx,cz)=>{const c=new T.QuadraticBezierCurve(new T.Vector2(x0,z0),new T.Vector2(cx,cz),new T.Vector2(x1,z1)),n=Math.round(c.getLength()/.6);
  for(let k=0;k<n;k++){const p=c.getPointAt((k+.25)/n),d=c.getTangentAt((k+.25)/n);box(M.line,[.34,.004,.1],[p.x,.004,p.y],0,-Math.atan2(d.y,d.x));}};
 for(const xc of CHARGE_BAYS)dashes(xc-2.6,2.35,xc+.25,MOUTH-.15,xc+.25,2.35);

 // --- The service bays, in front of the tool cabinets: hazard-striped edges, a hanging sign and the painted name.
 for(const [i,xc] of SERVICE_BAYS.entries()){
  const {w,z0,z1}=SERVICE,zc=(z0+z1)/2;
  for(const s of [-1,1])hazard(z1-z0,.16,[xc+s*(w/2-.08),zc],Math.PI/2);
  hazard(w,.16,[xc,z1-.08],0);
  for(const s of [-1,1])rod(M.steel,[xc+s*1.1,2.86,z1+.1],[xc+s*1.1,CEIL,z1+.1],.015);
  box(M.dark,[2.7,.5,.05],[xc,2.62,z1+.1]);
  plane(M.sign,[2.6,.44],[xc,2.62,z1+.13],0,false,CHARGE_BAYS.length+i,signs);
  plane(M.sign,[2.6,.44],[xc,2.62,z1+.07],Math.PI,false,CHARGE_BAYS.length+i,signs);
  plane(M.legend,[2.6,.62],[xc,.007,z1-.75],0,true,2+CHARGE_BAYS.length+i,floor);
  dashes(xc-2.6,-2.35,xc,z1+.15,xc,-2.35);
 }
 const zs=-10.45;
 // Service bay 1: MCT-03 raised on four yellow jack stands, a side panel off and leaning on the cabinets, and the
 // mechanic's tool trolley at its right side.
 {const xc=SERVICE_BAYS[0],lift=.2;
  within(xc,0,zs,Math.PI,()=>{
   vehicle(IN_SERVICE[0],lift);
   for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=sx*.5,z=sz*.62,top=.46+lift-.2;
    box(M.yellow,[.34,.03,.34],[x,.015,z]);
    for(const a of [0,1,2,3]){const dx=(a%2?1:-1)*.15,dz=(a<2?1:-1)*.15;rod(M.yellow,[x+dx,.03,z+dz],[x+dx*.25,top-.12,z+dz*.25],.018);}
    box(M.yellow,[.08,.2,.08],[x,top-.06,z]);box(M.dark,[.14,.04,.12],[x,top+.02,z]);
    rod(M.steel,[x,top-.18,z],[x+.12,top-.08,z],.008);
   }
  });
  vehicleBlock(xc,zs,Math.PI,lift);
  // The removed side panel, leaning on the cabinets behind the nose.
  box(M.body,[1.1,.62,.03],[xc+.3,.315,-14.32],-.12);
  // The trolley: its drawers face the vehicle; the third is open with wrenches in its foam.
  within(xc+1.95,0,zs+.55,-Math.PI/2,()=>{
   const W=.98,D=.56,y0=.16,y1=.94;
   box(M.trolley,[W,y1-y0,D],[0,(y0+y1)/2,0]);
   box(M.trolley,[W+.04,.05,D+.04],[0,y1+.025,0]);
   for(const s of [-1,1])box(M.trolley,[W+.04,.05,.03],[0,y1+.07,s*(D/2+.005)]);
   for(const s of [-1,1])box(M.trolley,[.03,.05,D+.04],[s*(W/2+.005),y1+.07,0]);
   for(const sx of [-1,1])for(const sz of [-1,1]){box(M.dark,[.06,.06,.06],[sx*(W/2-.08),y0-.03,sz*(D/2-.08)]);cyl(M.grip,.055,.04,[sx*(W/2-.08),.055,sz*(D/2-.08)],'x',12);}
   rod(M.steel,[W/2+.02,.62,-.18],[W/2+.12,.62,-.18],.012);rod(M.steel,[W/2+.02,.62,.18],[W/2+.12,.62,.18],.012);rod(M.steel,[W/2+.12,.62,-.18],[W/2+.12,.62,.18],.015);
   const drawers=[[.82,.1],[.69,.12],[.53,.13],[.37,.15]];
   drawers.forEach(([y,hh],k)=>{
    const out=k===2?.34:0,z=D/2+.012+out;
    box(M.panel,[W-.08,hh-.015,.02],[0,y,z]);box(M.steel,[W*.5,.018,.025],[0,y+hh*.25,z+.02]);
    if(out){
     box(M.trolley,[W-.12,hh-.03,out+.02],[0,y-.005,D/2-.005+out/2]);
     box(M.dark,[W-.16,.01,out-.02],[0,y+hh/2-.04,D/2+out/2]);
     for(const [dx,len] of [[-.3,.42],[-.05,.36],[.2,.3]]){rod(M.steel,[dx-len/2,y+hh/2-.02,D/2+out*.55],[dx+len/2,y+hh/2-.02,D/2+out*.55],.012);box(M.steel,[.05,.02,.05],[dx+len/2,y+hh/2-.02,D/2+out*.55]);}
    }
   });
   box(M.panel,[W-.08,.16,.02],[0,.24,D/2+.012]);
   // Torque wrenches on the top: a long shaft, a ratchet head and a grip.
   for(const [dx,dz,len] of [[-.1,-.12,.62],[-.05,.02,.5]]){rod(M.steel,[dx-len/2,y1+.075,dz],[dx+len/2,y1+.075,dz],.013);box(M.dark,[.06,.035,.05],[dx+len/2,y1+.075,dz]);rod(M.grip,[dx-len/2,y1+.075,dz],[dx-len/2+.14,y1+.075,dz],.02);}
   // The diagnostic tablets: one on an arm at the back corner showing the cell readout, one lying flat with the torque log.
   rod(M.steel,[W/2-.12,y1+.05,-D/2+.08],[W/2-.12,y1+.42,-D/2+.08],.014);
   within(W/2-.12,y1+.48,-D/2+.1,Math.PI/2,()=>{box(M.dark,[.34,.24,.02],[0,0,0]);plane(M.cells,[.31,.2],[0,.003,.012],0,false);});
   within(.25,y1+.06,.14,.35,()=>{box(M.dark,[.3,.014,.21],[0,0,0]);put(M.torque,new T.PlaneGeometry(.27,.18).rotateX(-Math.PI/2).applyMatrix4(new T.Matrix4().makeTranslation(0,.0075,0)));});
  });
  {const o=new T.Mesh(new T.BoxGeometry(.6,1.1,1.05));o.position.set(xc+1.95,.55,zs+.55);solid.add(o);}
 }
 // Service bay 2: MCT-06 on four low hydraulic lift pads, their hoses to a small pump unit by the cabinets.
 {const xc=SERVICE_BAYS[1],lift=.1,pump=[xc+2.25,-13.5];
  within(xc,0,zs,Math.PI,()=>{
   vehicle(IN_SERVICE[1],lift);
   for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*.48,z=sz*.62;box(M.yellow,[.5,.07,.62],[x,.035,z]);box(M.dark,[.5,.012,.08],[x,.072,z-.2]);cyl(M.steel,.09,.2+lift,[x,.07+(.2+lift)/2,z]);box(M.dark,[.22,.03,.22],[x,.27+lift,z]);}
  });
  vehicleBlock(xc,zs,Math.PI,lift);
  box(M.yellow,[.55,.62,.42],[pump[0],.31,pump[1]]);box(M.dark,[.4,.12,.02],[pump[0],.48,pump[1]+.22]);box(M.green,[.06,.03,.01],[pump[0]+.14,.5,pump[1]+.232]);
  block([.6,.66,.46],[pump[0],.33,pump[1]]);
  for(const sx of [-1,1])for(const sz of [-1,1]){const x=xc-sx*.48,z=zs-sz*.62;tube(M.cable,[[pump[0]-.2,.12,pump[1]+.2],[pump[0]-.5,.03,pump[1]+.6],[x+.32,.025,z],[x+.25,.04,z]],.016,24);}
 }

 // --- The roadway: a dashed white centre line down the aisle, chevrons, and the lane legends inside the doorway.
 for(let x=-23.6;x<23;x+=1.6)box(M.white,[.9,.004,.1],[x,.004,0]);
 const chevron=(x,zc)=>{for(const s of [-1,1]){const dx=.3,dz=s*.35;box(M.white,[Math.hypot(dx,dz),.004,.1],[x+dx/2,.004,zc+dz/2],0,-Math.atan2(-dz,dx));}};
 for(const x of [-14,-2,10])for(const zc of [-1,1])chevron(x,zc);
 plane(M.legend,[1.7,1.1],[-21.2,.007,1],-Math.PI/2,true,0,floor);
 plane(M.legend,[1.7,1.1],[-21.2,.007,-1],-Math.PI/2,true,1,floor);

 for(const [m,gs] of parts){const o=new T.Mesh(mergeGeometries(gs),m);o.name=m.name;o.castShadow=!m.transparent&&!m.polygonOffset;o.receiveShadow=true;group.add(o);gs.forEach(g=>g.dispose());}
 return {group,solid};
}
