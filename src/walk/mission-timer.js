import * as T from 'three';
import {roomObject} from '../plan/rooms.js';
import fitouts from '../plan/room-fitout-overrides-v2.json' with {type:'json'};
import {walkCanvas} from './canvas.js';

// Public LEO Walk launch, recorded to the minute; :00 seconds is the timer convention.
export const MISSION_START=1792710000000;
const ROOM='d02-maintenance-aft',FONT='"JetBrains Mono", ui-monospace, monospace';
export function missionElapsed(now=Date.now()){
 const seconds=Math.max(0,Math.floor((now-MISSION_START)/1000));
 return [Math.floor(seconds/86400),Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60];
}

export function createMissionTimer(ship,{anisotropy=1,still=false}={}){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Mission_timer';room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 // Physical fittings and collision come from the room overrides. Only the face and holograms move here.
 const display=fitouts[ROOM].add.find(p=>p.part==='mission_timer_display'),[depth,height,width]=display.size,[x,y,z]=display.at;
 const glow=(color,opacity=1)=>new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1,toneMapped:false});
 const cyan=glow(0x51ecf5),amber=glow(0xffad50),violet=glow(0xbf79ff);
 const box=(size,p,mat)=>{const o=new T.Mesh(new T.BoxGeometry(...size),mat);o.position.set(...p);group.add(o);return o;};
 for(const facing of [-1,1])for(const side of [-1,1]){
  const front=x+facing*(depth/2+.012);
  box([.035,.025,width-.12],[front,y+side*(height/2-.04),z],side<0?amber:cyan);
  box([.035,height-.1,.025],[front,y,z+side*(width/2-.04)],cyan);
 }
 for(const side of [-1,1]){
  box([2.9,.025,.025],[0,.29,side*4.08],side<0?amber:violet);
  box([.025,.025,7.8],[side*1.48,.29,0],cyan);
 }
 const canvas=walkCanvas();canvas.width=2048;canvas.height=360;
 const context=canvas.getContext('2d'),map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=anisotropy;
 let lastSecond=-1;
 function paint(now){
  const c=context,w=canvas.width,h=canvas.height,values=missionElapsed(now);
  c.fillStyle='#081820';c.fillRect(0,0,w,h);c.textAlign='center';c.textBaseline='middle';
  c.fillStyle='#b8f9ff';c.font=`600 32px ${FONT}`;c.fillText('MARS CATS VOYAGE  /  MISSION TIMER',w/2,37);
  values.forEach((value,i)=>{
   const at=256+i*512;c.fillStyle=i===0?'#51ecf5':'#ffb55c';c.font=`600 112px ${FONT}`;
   c.fillText(String(value).padStart(2,'0'),at,132,450);
   c.fillStyle='#b8f9ff';c.font=`600 25px ${FONT}`;c.fillText(['DAYS','HOURS','MINS','SECS'][i],at,209);
   if(i<3){c.fillStyle='#77b8c6';c.font=`600 72px ${FONT}`;c.fillText(':',512+i*512,132);}
  });
  c.strokeStyle='#327282';c.lineWidth=2;c.beginPath();c.moveTo(80,241);c.lineTo(w-80,241);c.stroke();
  c.fillStyle='#d8f6f7';c.font=`500 29px ${FONT}`;c.fillText("Mission elapsed · since LEO Walk's public launch",w/2,277);
  c.fillStyle='#85b6c5';c.font=`500 25px ${FONT}`;c.fillText('22 OCT 2026  /  18:00 EST  /  23:00 UTC',w/2,325);
  map.needsUpdate=true;lastSecond=Math.floor(now/1000);
 }
 paint(Date.now());globalThis.document?.fonts?.ready.then(()=>paint(Date.now()));
 // The v2 entrance is aft. Keep the opposite face readable from the original forward approach too.
 const faceMaterial=new T.MeshBasicMaterial({map,toneMapped:false}),faceGeometry=new T.PlaneGeometry(width-.22,height-.18);
 for(const facing of [-1,1]){
  const face=new T.Mesh(faceGeometry,faceMaterial);face.name=facing<0?'Mission_timer_readout':'Mission_timer_forward_readout';
  face.position.set(x+facing*(depth/2+.02),y,z);face.rotation.y=facing*Math.PI/2;group.add(face);
 }
 const rings=[],orbits=[],sphere=new T.SphereGeometry(.07,10,8);
 for(const side of [-1,1]){
  const emitter=new T.Group();emitter.position.set(.2,1.1,side*2.25);group.add(emitter);
  const ring=(radius,material)=>{const o=new T.Mesh(new T.TorusGeometry(radius,.014,6,64),material);o.rotation.x=Math.PI/2;emitter.add(o);return o;};
  ring(1.03,cyan);ring(.87,side<0?violet:amber);
  const orbit=new T.Group();orbit.rotation.set(side*.24,0,side*.18);emitter.add(orbit);
  const points=Array.from({length:80},(_,i)=>{const a=i/80*Math.PI*2;return new T.Vector3(Math.cos(a)*.94,.2,Math.sin(a)*.94);});
  orbit.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:side<0?0xbf79ff:0xffad50,toneMapped:false})));
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2,o=new T.Mesh(sphere,i?cyan:amber);o.position.set(Math.cos(a)*.94,.2,Math.sin(a)*.94);orbit.add(o);}
  const planet=new T.Mesh(new T.IcosahedronGeometry(.3,1),glow(side<0?0x58dce7:0xffa951,.65));planet.material.wireframe=true;planet.position.y=.22;orbit.add(planet);orbits.push({orbit,side});
  const beam=new T.Mesh(new T.CylinderGeometry(.9,.98,.65,32,1,true),glow(0x51ecf5,.07));beam.material.side=T.DoubleSide;beam.position.y=.2;emitter.add(beam);
  const scan=ring(.97,glow(0x91f9ff,.5));rings.push({scan,side});
 }
 const here=group.getWorldPosition(new T.Vector3());let clock=0;
 function update(dt,walker){
  if(walker&&(Math.abs(walker.y-here.y)>4||walker.distanceToSquared(here)>65*65))return;
  const now=Date.now();if(Math.floor(now/1000)!==lastSecond)paint(now);
  if(still)return;
  clock+=Math.min(dt,.1);
  for(const {orbit,side} of orbits)orbit.rotation.y=clock*side*.3;
  for(const {scan,side} of rings){const f=(clock*.45+(side+1)/4)%1;scan.position.y=.05+f*.6;scan.material.opacity=.5*(1-f);}
 }
 return {group,update};
}
