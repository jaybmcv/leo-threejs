import * as T from 'three';
import {roomObject} from '../plan/rooms.js';
import fitouts from '../plan/room-fitout-overrides-v2.json' with {type:'json'};
import {walkCanvas} from './canvas.js';
import {mergeByMaterial} from './merge-by-material.js';

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
 const engine=createEngine(group);
 // Physical fittings and collision come from the room overrides; runtime dressing animates here.
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
  engine.update(clock);
  for(const {orbit,side} of orbits)orbit.rotation.y=clock*side*.3;
  for(const {scan,side} of rings){const f=(clock*.45+(side+1)/4)%1;scan.position.y=.05+f*.6;scan.material.opacity=.5*(1-f);}
 }
 return {group,update};
}

// The engine fills the bulkhead opposite the v2 entrance at the reference's proportions.
// Its feeds stay overhead until they reach the timer's existing supports.
function createEngine(parent){
 const group=new T.Group();group.name='Mission_timer_engine';parent.add(group);
 const face=new T.Group();face.position.set(28.68,1.7,0);face.rotation.y=-Math.PI/2;group.add(face);
 const steel=new T.MeshStandardMaterial({color:0x61777b,metalness:.65,roughness:.4});
 const dark=new T.MeshStandardMaterial({color:0x182a30,metalness:.45,roughness:.5});
 const brass=new T.MeshStandardMaterial({color:0xb88e50,metalness:.6,roughness:.4});
 const green=new T.MeshStandardMaterial({color:0x2c9460,emissive:0x36cf7c,emissiveIntensity:.8,roughness:.3});
 const light=new T.MeshBasicMaterial({color:0xa0ffd0,toneMapped:false});
 const amber=new T.MeshBasicMaterial({color:0xffc471,toneMapped:false});
 const mesh=(geo,mat,at,root=face)=>{const o=new T.Mesh(geo,mat);o.position.set(...at);root.add(o);return o;};
 const box=(size,at,mat,root=face)=>mesh(new T.BoxGeometry(...size),mat,at,root);
 const ring=(r,t,at,mat,root=face)=>mesh(new T.TorusGeometry(r,t,6,32),mat,at,root);
 const bolt=new T.CylinderGeometry(.045,.045,.045,6);bolt.rotateX(Math.PI/2);
 for(const y of [-1.35,1.35]){
  box([5.35,.06,.08],[0,y,.015],steel);
  for(const x of [-2.5,-1.5,-.5,.5,1.5,2.5])mesh(bolt,brass,[x,y,.08]);
 }
 for(const x of [-2.55,2.55])box([.06,2.7,.08],[x,0,.015],steel);
 // A closed green manifold wraps the mechanical core without a copied decal.
 const loop=new T.CatmullRomCurve3([[-2.25,-1.02,.14],[-2.45,-.7,.14],[-2.45,.72,.14],[-2.15,1.06,.14],[2.15,1.06,.14],[2.45,.72,.14],[2.45,-.72,.14],[2.15,-1.06,.14]].map(p=>new T.Vector3(...p)),true,'centripetal');
 mesh(new T.TubeGeometry(loop,96,.105,8,true),green,[0,0,0]);
 for(const x of [-1.85,1.85])for(const y of [-1.06,1.06]){
  const collar=ring(.125,.035,[x,y,.14],brass);collar.rotation.y=Math.PI/2;
 }
 for(const [x,y,r]of [[-.95,-.05,.65],[.35,-.2,.4]]){
  mesh(new T.CylinderGeometry(r,r,.1,32).rotateX(Math.PI/2),dark,[x,y,.07]);
  ring(r*.78,.055,[x,y,.15],steel);ring(r*.3,.055,[x,y,.16],brass);
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2,o=box([.12,.13,.08],[x+Math.cos(a)*r,y+Math.sin(a)*r,.1],steel);o.rotation.z=a-Math.PI/2;}
  for(let i=0;i<4;i++){const a=i/4*Math.PI,o=box([r*1.45,.045,.045],[x,y,.14],steel);o.rotation.z=a;}
 }
 // The handwheel rocks by a few degrees, with only millimetres of vibration.
 const valve=new T.Group();valve.name='Mission_engine_valve';valve.position.set(-.95,-.05,.24);face.add(valve);
 ring(.34,.035,[0,0,0],brass,valve);
 for(let i=0;i<3;i++){const o=box([.63,.035,.035],[0,0,0],brass,valve);o.rotation.z=i*Math.PI/3;}
 mesh(new T.SphereGeometry(.085,10,6),steel,[0,0,.025],valve);
 for(const x of [.85,1.7]){
  mesh(new T.CircleGeometry(.26,24),dark,[x,.55,.09]);ring(.26,.035,[x,.55,.1],brass);
  for(let i=0;i<7;i++){const a=Math.PI*.15+i/6*Math.PI*.7,o=box([.018,.05,.012],[x+Math.cos(a)*.19,.55+Math.sin(a)*.19,.115],amber);o.rotation.z=a-Math.PI/2;}
  const needle=box([.018,.2,.018],[x+.035,.6,.13],light);needle.rotation.z=-.65;
 }
 const canvas=walkCanvas();canvas.width=1024;canvas.height=256;
 const c=canvas.getContext('2d');c.fillStyle='#12262b';c.fillRect(0,0,1024,256);c.textAlign='center';
 c.fillStyle='#e8f3ec';c.font=`600 48px ${FONT}`;c.fillText('MISSION TIMER',512,80);
 c.fillStyle='#87e3af';c.font=`500 36px ${FONT}`;c.fillText('POWER FEED / ONLINE',512,145);
 c.fillStyle='#36b573';c.fillRect(96,193,832,12);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
 mesh(new T.PlaneGeometry(1.8,.45),new T.MeshBasicMaterial({map,toneMapped:false}),[1.25,-.42,.1]);
 const feeds=new T.Group();feeds.name='Mission_engine_feeds';group.add(feeds);const paths=[];
 for(const side of [-1,1]){
  const points=[[28.54,2.76,side*1.85],[28.1,3.12,side*2.6],[26.8,3.12,side*3.9],[.4,3.12,side*3.9],[-.5,2.85,side*3.9],[-.5,.88,side*3.9]];
  // Rounded bends stop the hoses dipping into the central walking aisle.
  const corners=points.map(p=>new T.Vector3(...p)),path=new T.CurvePath();let cursor=corners[0];
  for(let i=1;i<corners.length-1;i++){
   const p=corners[i],before=p.clone().lerp(corners[i-1],Math.min(.3/p.distanceTo(corners[i-1]),.45)),after=p.clone().lerp(corners[i+1],Math.min(.3/p.distanceTo(corners[i+1]),.45));
   path.add(new T.LineCurve3(cursor,before));path.add(new T.QuadraticBezierCurve3(before,p,after));cursor=after;
  }
  path.add(new T.LineCurve3(cursor,corners.at(-1)));paths.push(path);
  mesh(new T.TubeGeometry(path,120,.065,8,false),green,[0,0,0],feeds);
  for(const x of [26,18,10,2])box([.12,.16,.2],[x,3.12,side*3.9],steel,group);
  box([.22,.16,.22],[-.5,.88,side*3.9],brass,group);
 }
 const flow=new T.InstancedMesh(new T.SphereGeometry(.04,6,4),light,36);flow.name='Mission_engine_flow';flow.frustumCulled=false;group.add(flow);
 const matrix=new T.Matrix4(),point=new T.Vector3();
 mergeByMaterial(face);mergeByMaterial(valve);mergeByMaterial(feeds);mergeByMaterial(group);
 function update(time){
  valve.rotation.z=Math.sin(time*9)*.045;valve.position.x=-.95+Math.sin(time*29)*.003;
  green.emissiveIntensity=.8+Math.sin(time*2)*.06;
  for(let i=0;i<36;i++){paths[i<18?0:1].getPointAt((i%18/18+time*.06)%1,point);matrix.makeTranslation(point.x,point.y,point.z);flow.setMatrixAt(i,matrix);}
  flow.instanceMatrix.needsUpdate=true;
 }
 update(0);return {update};
}
