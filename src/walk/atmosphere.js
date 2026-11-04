import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {roomObject} from '../plan/rooms.js';
import {walkCanvas} from './canvas.js';

const ROOM='d04-air-1',STAGES=[[-17,'01  INTAKE FILTERS & FANS'],[-6,'02  HUMIDITY CONTROL'],[5,'03  CO2 REMOVAL'],[16,'04  HEPA SYSTEM']];
// These endpoints stop at the doorway for the corridor services to continue.
export const ATMOSPHERE_PORTS=[[-3,3.08,16.84],[3,3.08,16.84]];
export function stripAtmosphere(ship){
 const room=roomObject(ship,ROOM),fit=room?.getObjectByName('Room_fittings');if(!fit)return false;
 // The generic banks and seated desk give way to the room's new fitout descriptors.
 for(const o of [...fit.children])if(!/^(Finished_floor|Area_identity_panel|Wayfinding_text|Resident_scale_1_75m)$/.test(o.name))o.removeFromParent();
 return true;
}
function texture(w,h,paint){
 const c=walkCanvas();c.width=w;c.height=h;const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;
 const draw=()=>{paint(c.getContext('2d'),w,h);t.needsUpdate=true;};draw();globalThis.document?.fonts?.ready.then(draw);return {texture:t,draw};
}
function label(text,colour='#f4b45f'){
 const {texture:map}=texture(1024,160,(g,w,h)=>{
  g.fillStyle='#122b39';g.fillRect(0,0,w,h);g.fillStyle=colour;g.fillRect(0,0,12,h);
  g.textAlign='center';g.textBaseline='middle';g.fillStyle='#f2f3e9';g.font='bold 52px sans-serif';g.fillText(text,w/2,h/2,w-64);
 });return new T.MeshBasicMaterial({map});
}
// Values are an illustrative loop, not ship telemetry. The trend uses the same pressure function as the readout.
export function atmosphereReadings(t){return {pressure:14.68+.012*Math.sin(t/120),o2:20.9+.025*Math.sin(t/23),n2:78.4-.025*Math.sin(t/23),co2:2.4+.04*Math.sin(t/19),temp:22.1+.08*Math.sin(t/31),rh:43+.4*Math.sin(t/29)};}
function monitor(){
 let time=0;
 const face=texture(1280,768,(g,w,h)=>{
  const v=atmosphereReadings(time);g.fillStyle='#081e2a';g.fillRect(0,0,w,h);
  const text=(s,x,y,size=26,col='#bcd7df')=>{g.fillStyle=col;g.font=`${size>=36?'bold ':''}${size}px sans-serif`;g.fillText(s,x,y);};
  text('LEO  /  ATMOSPHERE PROCESSING',40,58,36,'#f6b45a');text('ILLUSTRATIVE SENSOR LOOP',40,98,22);
  g.strokeStyle='#2c6575';g.strokeRect(28,120,1224,607);
  text('SHIP-WIDE PRESSURE',54,167);text(v.pressure.toFixed(2)+' PSIA',54,252,74,'#f6b45a');
  text('CONCEPT STATUS: NOMINAL',54,299,24,'#58dfcd');
  const rows=[['O2',v.o2.toFixed(2)+' %  /  3.07 PSIA'],['N2',v.n2.toFixed(2)+' %'],['CO2',v.co2.toFixed(2)+' mmHg'],['LOCAL TEMP',v.temp.toFixed(1)+' C'],['LOCAL RH',v.rh.toFixed(1)+' %']];
  rows.forEach(([k,n],i)=>{const y=360+i*66;text(k,54,y,26);text(n,250,y,34,'#58dfcd');g.fillStyle='#193b4b';g.fillRect(54,y+14,490,3);});
  text('PROCESS LINES',630,167);text('A  MAIN       ACTIVE',630,215,30,'#58dfcd');text('B  BACKUP     READY',630,262,30,'#58dfcd');
  text('O2 TANK  32.1 PSIA',630,321);text('N2 TANK  28.7 PSIA',630,360);text('WATER RESERVE  /  AVAILABLE',630,399);
  text('PRESSURE TREND  /  LAST 60 MIN',630,462,24);
  for(let i=0;i<5;i++){const y=490+i*36;g.strokeStyle='#214653';g.beginPath();g.moveTo(680,y);g.lineTo(1210,y);g.stroke();text((14.72-i*.02).toFixed(2),599,y+7,18);}
  g.strokeStyle='#f6b45a';g.lineWidth=3;g.beginPath();
  for(let i=0;i<=90;i++){const x=680+i/90*530,y=562-(atmosphereReadings(time-3600+i*40).pressure-14.68)*1800;if(i)g.lineTo(x,y);else g.moveTo(x,y);}g.stroke();
  text('-60 MIN',680,665,20);text('NOW',1160,665,20);text('SIMULATED DATA  /  NO OPERATING CONTROLS',54,710,21,'#f6b45a');
 });return {...face,setTime:t=>{time=t;face.draw();}};
}

export function createAtmosphere(ship,{still=false}={}){
 const room=roomObject(ship,ROOM);if(!room)return null;room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Atmosphere_process_plant';room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Atmosphere_tank_colliders';room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const mat=(color,metalness=.4)=>new T.MeshStandardMaterial({color,metalness,roughness:.45});
 const M={steel:mat(0xa2b0b5,.7),dark:mat(0x203744),air:mat(0xd78035),water:mat(0x299eac),red:mat(0xc64b38),green:mat(0x4c9584),led:new T.MeshBasicMaterial({color:0x60e3d3})};
 const parts=new Map(),piece=(m,g)=>{let a=parts.get(m);if(!a)parts.set(m,a=[]);a.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();};
 const box=(m,s,p)=>piece(m,new T.BoxGeometry(...s).translate(...p));
 function pipe(m,r,a,b){const d=new T.Vector3(...b).sub(new T.Vector3(...a)),len=d.length();if(len<1e-6)return;
  const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());piece(m,new T.CylinderGeometry(r,r,len,12).applyQuaternion(q).translate(...a.map((x,i)=>(x+b[i])/2)));
 }
 const joint=(m,r,p)=>piece(m,new T.SphereGeometry(r,12,8).translate(...p));
 function run(m,r,points){for(let i=1;i<points.length;i++)pipe(m,r,points[i-1],points[i]);for(const p of points.slice(1,-1))joint(m,r*1.04,p);}
 function face(m,w,h,p,yaw=0){const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.position.set(...p);o.rotation.y=yaw;o.userData.noCollide=true;group.add(o);return o;}
 function valve(x,y,z,yaw=0){
  const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw);
  piece(M.red,new T.TorusGeometry(.19,.035,6,18).applyQuaternion(q).translate(x,y,z));
  for(const a of [0,Math.PI/2])piece(M.red,new T.BoxGeometry(.38,.04,.04).rotateZ(a).applyQuaternion(q).translate(x,y,z));
  face(label('ISOLATE'),.9,.18,[x,y-.4,z],yaw);
 }
 const labels=STAGES.map(([,name])=>label(name)),main=label('LINE A  /  MAIN'),backup=label('LINE B  /  BACKUP');
 for(const s of [-1,1]){
  const z=s*12.2,front=s*9.185,yaw=s<0?0:Math.PI;
  STAGES.forEach(([x],i)=>{
   face(labels[i],6.5,.75,[x,1.82,front],yaw);face(s<0?main:backup,3.5,.35,[x,2.45,front],yaw);
   for(const dx of [-3.5,3.5])for(const dz of [-2.5,2.5])box(M.dark,[.3,.18,.3],[x+dx,.09,z+dz]);
   if(i===0)for(const dx of [-1.8,1.8]){
    const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw),p=[x+dx,.75,front-s*.05];
    piece(M.dark,new T.TorusGeometry(.53,.07,6,24).applyQuaternion(q).translate(...p));
    for(let a=0;a<4;a++)piece(M.steel,new T.BoxGeometry(.85,.14,.06).rotateZ(a*Math.PI/4).applyQuaternion(q).translate(...p));
    joint(M.dark,.14,p);
   }else for(let j=0;j<13;j++)box(i===1?M.water:M.dark,[i===3?.12:.25,.8,.06],[x-3+j*.5,.65,front]);
   box(M.led,[.75,.08,.07],[x+2.8,1.3,front]);
   // Silver return ducts join each stage above its housing; orange collars mark the flow direction.
   if(i<3){const end=x+7;pipe(M.steel,.28,[x+4,2.1,z],[end,2.1,z]);for(const dx of [4.1,6.9])pipe(M.air,.32,[x+dx-.05,2.1,z],[x+dx+.05,2.1,z]);run(M.steel,.06,[[x+5.5,2.1,z],[x+5.5,1.65,z],[x+5.5,1.65,z-s*.5]]);valve(x+5.5,1.65,z-s*.5,yaw);}
  });
  // A floor intake and a valved water drop run outside the cabinet faces, leaving the service aisle clear.
  run(M.steel,.28,[[-20,0,s*15.55],[-20,2.7,s*15.55],[-17,2.7,s*15.55],[-17,2.35,z]]);
  run(M.water,.09,[[-6,2.35,z],[-6,3.08,z],[s*24.8,3.08,z],[s*24.8,3.08,16.55],[s*3,3.08,16.55],ATMOSPHERE_PORTS[s<0?0:1]]);
  run(M.steel,.27,[[16,2.35,z],[16,2.75,z],[24.5,2.75,z],[24.5,2.75,s*15.9],[-24.5,2.75,s*15.9]]);
  for(let x=-23;x<25;x+=4)box(M.steel,[.12,.5,.12],[x,2.88,s*15.9]);
  face(label('H2O  /  HALL SERVICE'),3,.3,[s*5,2.8,16.38],Math.PI);
 }
 // The tank farm is at the room end. A clear cross aisle separates it from the process lines.
 const tankLabels=[label('O2  /  REGULATED RESERVE'),label('N2  /  REGULATED RESERVE'),label('WATER  /  RESERVE')];
 for(const [i,z]of [-4,0,4].entries()){
  const x=23.2,m=i===2?M.water:i===0?M.green:M.steel;
  pipe(m,.85,[x,.9,z],[x,2.25,z]);joint(m,.85,[x,.9,z]);joint(m,.85,[x,2.25,z]);
  for(const y of [.5,2.3])pipe(M.steel,.94,[x,y-.04,z],[x,y+.04,z]);
  box(M.dark,[2.1,.16,2.1],[x,.08,z]);face(tankLabels[i],2.9,.45,[x-1.01,1.5,z],-Math.PI/2);
  const proxy=new T.Mesh(new T.BoxGeometry(2.1,3.15,2.1));proxy.position.set(x,1.575,z);solid.add(proxy);
  run(M.air,.075,[[x,2.8,z],[x-1.15,2.8,z],[x-1.15,2.3,z]]);
  box(M.steel,[.3,.3,.3],[x-1.15,2.65,z]);valve(x-1.15,2.3,z,-Math.PI/2);
  face(label('EMERGENCY SHUTOFF'),2.4,.28,[x-1.16,1.05,z],-Math.PI/2);
 }
 pipe(M.air,.075,[22.05,2.8,-4],[22.05,2.8,7]);
 const display=monitor(),screen=face(new T.MeshBasicMaterial({map:display.texture}),3.6,2.16,[-16.79,1.93,0],-Math.PI/2);
 screen.name='Atmosphere_illustrative_monitor';
 for(const [m,gs]of parts){const o=new T.Mesh(mergeGeometries(gs),m);o.name='Atmosphere_fittings';o.userData.noCollide=true;group.add(o);gs.forEach(g=>g.dispose());}
 let elapsed=0,last=-Infinity;const origin=room.getWorldPosition(new T.Vector3());
 return {group,solid,update(dt,p){if(still)return;elapsed+=dt;if(elapsed-last<2||Math.abs(p.y-origin.y)>4||Math.hypot(p.x-origin.x,p.z-origin.z)>45)return;last=elapsed;display.setTime(elapsed);}};
}
