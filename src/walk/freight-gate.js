import {roomObject} from '../plan/rooms.js';
import {walkCanvas,hasWalkCanvas} from './canvas.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Deck 1's Aft spares & bulk stores on foot, fitted out as the aft freight gate (from tester feedback). Freight comes
// and goes through an iris in the middle of the floor: eight steel blades in an octagonal bolted bezel with an orange
// LED strip, ringed by yellow and black hazard stripes. Over it, a low gantry hung flush under the ceiling on two steel
// I-beams carries a claw-game style claw: it lifts an in-bound crate up through the iris and sets it on the left lane's
// conveyor, then takes an out-bound crate from the right lane's conveyor and lowers it down through the iris. The two
// lanes are painted teal (in-bound, left as you come in) and orange (out-bound, right), with hanging signs, short
// barricades along the conveyors and Mars Cat worker-safety posters on the walls. By the doorway, a logistics console
// with a chair for the attending cat (you can sit in it). The gantry runs on the clock, so every visitor sees the same
// cycle; it holds still for reduced motion. The iris and lane paint are flush and walkable; the claw and its crates
// pass overhead and are drawn only.
// Room frame (Area_d01-spares-aft): floor y=0, ceiling underside y=3.35, aft bulkhead face x=-21.84, entry wall face
// x=21.84 (doorway |z|<3), side wall faces |z|=14.84. Racks at x -16,-6,4,14 (each ±2.7) and z 9.1..10.9 either side,
// pallet stacks at x -11,-1,9 and z ±10, the packing bench at x 9.5..14.5, z 4.2..5.8, the amber aisle lines at z ±2.7,
// the cross aisles at x -20 and 18 (±0.7), ceiling light strips at x -17,-9,-1,7,15 (4 m long) and z -11,0,11.
const ROOM='Area_d01-spares-aft';
const GX=-1,IRIS=1.25,PAD=6.5,BELT=.5,HIGH=2.38,LOW=-.12,ON_BELT=BELT+.55,CRATE=[.75,.55,.75];
const RAIL_X=[-3.4,1.4],RAIL_Z=8.6,TROLLEY=2.8;
const BELT_X=[-7.1,-.1],TUNNEL_X=[-7.4,-5.4],INSIDE=-6.4,CYCLE=56;
const IN=0x19c4b6,OUT=0xf07a1a,LED=0xff8a1e;
export const CONSOLE={x:19.9,z:-7.5};
const font=(weight,size)=>`${weight} ${size}px "Archivo", system-ui, sans-serif`;
const hex=c=>'#'+c.toString(16).padStart(6,'0');

function canvasTexture(w,h,paint,repeat=false){
 const canvas=walkCanvas();canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;if(repeat)t.wrapS=T.RepeatWrapping;return t;
}
// A plane showing the part u0..u1, v0..v1 of its texture.
function plane(w,h,[u0,u1,v0,v1]=[0,1,0,1]){const g=new T.PlaneGeometry(w,h);g.setAttribute('uv',new T.Float32BufferAttribute([u0,v1,u1,v1,u0,v0,u1,v0],2));return g;}
function stripes(g,x,y,w,h,step,ink='#15171a',paper='#f2c21b'){
 g.fillStyle=paper;g.fillRect(x,y,w,h);g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.fillStyle=ink;
 for(let s=x-h;s<x+w+h;s+=step*2){g.beginPath();g.moveTo(s,y+h);g.lineTo(s+step,y+h);g.lineTo(s+step+h,y);g.lineTo(s+h,y);g.closePath();g.fill();}
 g.restore();
}
// A Mars Cat's head in a warning triangle: ears, round face, eyes and whiskers.
function catSign(g,x,y,r,ink='#15171a',paper='#f2c21b'){
 g.fillStyle=paper;g.strokeStyle=ink;g.lineWidth=r*.12;g.lineJoin='round';
 g.beginPath();g.moveTo(x,y-r);g.lineTo(x+r*1.08,y+r*.82);g.lineTo(x-r*1.08,y+r*.82);g.closePath();g.fill();g.stroke();
 g.fillStyle=ink;const cy=y+r*.28,hr=r*.34;
 for(const s of [-1,1]){g.beginPath();g.moveTo(x+s*hr*.95,cy-hr*.2);g.lineTo(x+s*hr*.8,cy-hr*1.35);g.lineTo(x+s*hr*.15,cy-hr*.85);g.closePath();g.fill();}
 g.beginPath();g.arc(x,cy,hr,0,Math.PI*2);g.fill();
 g.fillStyle=paper;for(const s of [-1,1]){g.beginPath();g.ellipse(x+s*hr*.38,cy-hr*.1,hr*.14,hr*.2,0,0,Math.PI*2);g.fill();}
 g.strokeStyle=ink;g.lineWidth=r*.03;for(const s of [-1,1])for(const d of [-.12,.08]){g.beginPath();g.moveTo(x+s*hr*.7,cy+hr*.3);g.lineTo(x+s*hr*1.55,cy+hr*(.3+d*2));g.stroke();}
}
function paw(g,x,y,r,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y+r*.35,r*.62,r*.5,0,0,Math.PI*2);g.fill();
 for(const [dx,dy] of [[-.62,-.38],[-.22,-.72],[.22,-.72],[.62,-.38]]){g.beginPath();g.ellipse(x+dx*r,y+dy*r,r*.2,r*.26,dx*.5,0,Math.PI*2);g.fill();}}

// The worker-safety posters, side by side in one texture.
const POSTERS=[
 ['PAWS CLEAR','OF THE IRIS','Never stand on the ring while its lights flash.','#f2c21b'],
 ['WATCH','THE CLAW','Loads pass overhead. Look up, step back.','#f2c21b'],
 ['NO NAPPING','ON CONVEYORS','Warm rollers are not a bed.','#f2c21b'],
 ['KEEP TO','YOUR LANE','In-bound left, out-bound right.','#dfe9ea'],
 ['NINE LIVES','IS NOT A PLAN','Hard hat on, ears and all.','#f2c21b'],
];
function posterSheet(g,W,H){
 const w=W/POSTERS.length;
 POSTERS.forEach(([a,b,small,paper],i)=>{
  const x=i*w;g.fillStyle=paper;g.fillRect(x,0,w,H);
  stripes(g,x,0,w,34,22);stripes(g,x,H-34,w,34,22);
  g.fillStyle='#15171a';g.fillRect(x+18,46,w-36,62);
  g.fillStyle='#f2c21b';g.textAlign='center';g.textBaseline='middle';g.font=font(800,34);g.fillText('WORKER SAFETY',x+w/2,78);
  if(i===3){
   // Lane poster: the two lane colours with arrows.
   for(const [k,c,label] of [[0,IN,'IN'],[1,OUT,'OUT']]){const bx=x+24+k*(w-48)/2,bw=(w-48)/2-8;g.fillStyle=hex(c);g.fillRect(bx,138,bw,190);
    g.fillStyle='#15171a';g.font=font(800,44);g.fillText(label,bx+bw/2,200);g.font=font(800,60);g.fillText(k?'▶':'◀',bx+bw/2,280);}
  }else catSign(g,x+w/2,236,104);
  g.fillStyle='#15171a';g.font=font(900,44);g.fillText(a,x+w/2,388);g.fillText(b,x+w/2,436);
  g.font=font(600,21);const words=small.split(' ');let line='',y=488;
  for(const word of words){const next=line?line+' '+word:word;if(g.measureText(next).width>w-56){g.fillText(line,x+w/2,y);y+=28;line=word;}else line=next;}
  g.fillText(line,x+w/2,y);
  paw(g,x+w-46,H-62,16,'#15171a');g.font=font(700,16);g.textAlign='left';g.fillText('AFT FREIGHT GATE',x+24,H-56);
 });
}
// Floor paint for a lane, seen from the doorway: the canvas's top is aft (-x) and its right is toward -z.
function lanePaint(g,W,H,{color,label,sub,arrowFrom,arrowTo,arrowY}){
 g.fillStyle=hex(color);g.globalAlpha=.16;g.fillRect(0,0,W,H);g.globalAlpha=1;
 g.strokeStyle=hex(color);g.lineWidth=16;g.strokeRect(8,8,W-16,H-16);
 g.textAlign='center';g.textBaseline='middle';g.fillStyle=hex(color);
 let size=86;do g.font=font(900,size-=4);while(g.measureText(label).width>W-70);g.fillText(label,W/2,H-100);
 g.font=font(700,30);g.fillText(sub,W/2,H-40);
 // Chevrons along the claw's path, pointing the way the freight goes.
 g.fillStyle=hex(color);const dir=Math.sign(arrowTo-arrowFrom);
 for(let x=arrowFrom+dir*30;dir*(arrowTo-x)>30;x+=dir*58){g.beginPath();g.moveTo(x+dir*22,arrowY);g.lineTo(x-dir*10,arrowY-30);g.lineTo(x-dir*26,arrowY-30);g.lineTo(x+dir*6,arrowY);g.lineTo(x-dir*26,arrowY+30);g.lineTo(x-dir*10,arrowY+30);g.closePath();g.fill();}
}
function laneSign(g,W,H){
 [[IN,'IN-BOUND','LANE A · RECEIVING'],[OUT,'OUT-BOUND','LANE B · DISPATCH']].forEach(([c,a,b],i)=>{
  const y=i*H/2,h=H/2;g.fillStyle='#16191c';g.fillRect(0,y,W,h);g.fillStyle=hex(c);g.fillRect(0,y,30,h);g.fillRect(W-30,y,30,h);
  g.textAlign='center';g.textBaseline='middle';g.font=font(900,64);g.fillText(a,W/2,y+h*.42);
  g.fillStyle='#dfe7ea';g.font=font(600,24);g.fillText(b,W/2,y+h*.8);
 });
}
// The console's three screens, side by side: in-bound queue, the iris and gantry, out-bound queue.
function consoleScreens(g,W,H){
 const w=W/3,lists=[['IN-BOUND',IN,['MC-2231  NIP PODS','MC-2232  SEED STOCK','MC-2236  FILTERS','MC-2240  YARN ×40']],null,['OUT-BOUND',OUT,['MC-1187  EMPTY CASES','MC-1190  RECYCLING','MC-1193  RETURNS','MC-1194  CORE SAMPLE']]];
 for(let i=0;i<3;i++){
  const x=i*w;g.fillStyle='#0b1418';g.fillRect(x,0,w,H);g.strokeStyle='#2a3b42';g.lineWidth=4;g.strokeRect(x+6,6,w-12,H-12);
  g.textBaseline='middle';
  if(lists[i]){const [title,c,rows]=lists[i];g.fillStyle=hex(c);g.fillRect(x+16,18,w-32,40);g.fillStyle='#0b1418';g.font=font(800,26);g.textAlign='left';g.fillText(title,x+28,39);
   g.font=font(600,20);rows.forEach((r,j)=>{g.fillStyle=j===0?hex(c):'#b9c8cc';g.fillText(r,x+24,88+j*36);});}
  else{
   g.textAlign='center';g.fillStyle='#ff8a1e';g.font=font(800,22);g.fillText('AFT FREIGHT GATE',x+w/2,34);
   const cx=x+w/2,cy=H*.56,r=H*.27;g.strokeStyle='#ff8a1e';g.lineWidth=5;g.beginPath();
   for(let k=0;k<=8;k++){const a=k*Math.PI/4;g[k?'lineTo':'moveTo'](cx+Math.cos(a)*r,cy+Math.sin(a)*r);}g.stroke();
   g.strokeStyle='#5d6f75';g.lineWidth=3;for(let k=0;k<8;k++){const a=k*Math.PI/4;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*r*.92,cy+Math.sin(a)*r*.92);g.stroke();}
   g.fillStyle=hex(IN);g.fillRect(x+16,cy-8,22,16);g.fillStyle=hex(OUT);g.fillRect(x+w-38,cy-8,22,16);
   g.fillStyle='#b9c8cc';g.font=font(600,18);g.fillText('IRIS · GANTRY · CLAW',x+w/2,H-24);
  }
 }
}

// Easing between keyframes [time, value], over one cycle.
const ease=t=>t*t*(3-2*t),clamp=t=>Math.min(1,Math.max(0,t));
const track=keys=>t=>{for(let i=1;i<keys.length;i++){const [t1,v1]=keys[i];if(t<=t1){const [t0,v0]=keys[i-1];return t1===t0?v1:v0+(v1-v0)*ease((t-t0)/(t1-t0));}}return keys.at(-1)[1];};
// The cycle: up through the iris with an in-bound crate, onto the left conveyor; across to the right conveyor for an
// out-bound crate, back to the middle and down through the iris with it.
const BRIDGE=track([[0,0],[15,0],[20,PAD],[27,PAD],[33,-PAD],[40,-PAD],[45,0],[56,0]]);
const GRIP=track([[0,HIGH],[5,HIGH],[9,LOW],[10,LOW],[14,HIGH],[20,HIGH],[23,ON_BELT],[24,ON_BELT],[27,HIGH],[33,HIGH],[36,ON_BELT],[37,ON_BELT],[40,HIGH],[46,HIGH],[50,LOW],[51,LOW],[54,HIGH],[56,HIGH]]);
const OPEN=track([[0,1],[9,1],[10,0],[23,0],[24,1],[36,1],[37,0],[50,0],[51,1],[56,1]]);
const IRIS_OPEN=track([[0,0],[3,0],[5,1],[14,1],[15,0],[44,0],[46,1],[54,1],[55,0],[56,0]]);

// Things fixed to the room for the walk: the console desk and the attendant's chair. They go into the room's fittings
// before the colliders and seats are found, so the chair is solid and sittable like any other.
export function dressFreightGate(ship){
 const room=roomObject(ship,ROOM);if(!room)return false;
 const fit=room.getObjectByName('Room_fittings');if(!fit)return false;
 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Freight_gate_'+name,color,roughness:.5,...o});
 const M={desk:mat('console',0x2b3236,{metalness:.35,roughness:.4}),top:mat('console_top',0x8e999d,{metalness:.6,roughness:.3}),
  black:mat('chair',0x1c1f22,{roughness:.6}),metal:mat('chair_frame',0x6d777b,{metalness:.7,roughness:.35}),
  in:mat('lane_in',IN,{roughness:.45}),out:mat('lane_out',OUT,{roughness:.45})};
 const box=(name,size,pos,m,parent=fit,rot=0)=>{const o=new T.Mesh(new T.BoxGeometry(...size),m);o.name=name;o.position.set(...pos);o.rotation.y=rot;parent.add(o);return o;};
 const {x,z}=CONSOLE;
 // The desk runs across the room with its operator side toward the doorway; a pedestal at each end.
 box('Logistics_console_top',[.8,.05,2.6],[x,.76,z],M.top);
 for(const s of [-1,1])box('Logistics_console_pedestal',[.7,.735,.45],[x,.3675,z+s*1.05],M.desk);
 box('Logistics_console_modesty',[.05,.5,1.6],[x-.36,.48,z],M.desk);
 {const p=box('Logistics_console_panel',[.32,.04,2.2],[x+.12,.81,z],M.desk);p.rotation.z=-.18;}
 for(const [dz,m] of [[-.55,M.out],[-.4,M.out],[.4,M.in],[.55,M.in]])box('Logistics_console_button',[.06,.025,.06],[x+.14,.835,z+dz],m);
 // The chair: star base, lift, seat and back, turned to face the desk and the room beyond.
 const g=new T.Group();g.name='Logistics_console_chair';g.position.set(x+1.05,0,z);g.rotation.y=-Math.PI/2;fit.add(g);
 for(let i=0;i<5;i++){const a=i/5*Math.PI*2,leg=box('Chair_leg',[.05,.04,.32],[Math.sin(a)*.15,.06,Math.cos(a)*.15],M.metal,g);leg.rotation.y=a;}
 box('Chair_lift',[.06,.34,.06],[0,.25,0],M.metal,g);
 box('Seat',[.52,.09,.5],[0,.47,0],M.black,g);
 const back=box('Back',[.5,.7,.08],[0,.9,-.27],M.black,g);back.rotation.x=-.1;
 box('Chair_back_stripe',[.08,.66,.085],[0,.9,-.268],M.out,g).rotation.x=-.1;
 for(const sx of [-1,1]){box('Chair_arm_post',[.04,.2,.04],[sx*.29,.6,-.04],M.metal,g);box('Chair_arm',[.07,.04,.28],[sx*.29,.71,-.02],M.black,g);}
 return true;
}

// The moving and painted parts, in ship coordinates: `group` draws (with its deck band), `solid` holds plain boxes for
// the colliders (conveyors, transfer hatches and barricades), and update() runs the gantry and the iris.
export function createFreightGate(ship,{still=false}={}){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Freight_gate';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Freight_gate_colliders';
 room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Freight_gate_'+name,color,roughness:.45,...o});
 const glow=(name,color)=>new T.MeshBasicMaterial({name:'Freight_gate_'+name,color,toneMapped:false});
 const M={steel:mat('steel',0x9aa4a8,{metalness:.75,roughness:.3}),dark:mat('dark_steel',0x3b4246,{metalness:.6,roughness:.4}),
  blade:mat('iris_blade',0x7d878b,{metalness:.8,roughness:.32,side:T.DoubleSide}),blade2:mat('iris_blade_alt',0x687276,{metalness:.8,roughness:.36,side:T.DoubleSide}),
  black:new T.MeshBasicMaterial({name:'Freight_gate_iris_well',color:0x050607}),yellow:mat('safety_yellow',0xf2c21b,{roughness:.5}),ink:mat('safety_black',0x17191b,{roughness:.6}),
  roller:mat('roller',0xb4bdc0,{metalness:.8,roughness:.25}),in:mat('lane_in',IN),out:mat('lane_out',OUT),
  card:mat('crate',0xc29a62,{roughness:.85}),strap:mat('crate_strap',0x2a2f33,{roughness:.6}),
  curtain:new T.MeshStandardMaterial({name:'Freight_gate_strip_curtain',color:0x4b5a60,roughness:.3,transparent:true,opacity:.82,side:T.DoubleSide}),
  led:glow('iris_led',LED),beacon:glow('beacon',LED),inGlow:glow('lane_in_glow',IN),outGlow:glow('lane_out_glow',OUT)};
 const parts=new Map();
 // Merged by material, so every piece goes in without an index (the bezel's extrusion has none).
 const piece=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g.index?g.toNonIndexed():g);};
 const box=(m,[w,h,d],[x,y,z],ry=0)=>piece(m,new T.BoxGeometry(w,h,d).rotateY(ry).translate(x,y,z));
 const block=([w,h,d],[x,y,z])=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d));o.position.set(x,y,z);solid.add(o);};
 const decal=(name,geo,map,y=.006)=>{const o=new T.Mesh(geo,new T.MeshStandardMaterial({name:'Freight_gate_'+name,map,transparent:true,roughness:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));o.name='Freight_gate_'+name;o.position.y=y;o.renderOrder=1;group.add(o);return o;};
 const canPaint=hasWalkCanvas();

 // The iris: an octagonal well, its bezel bolted round it with an LED strip, and the hazard ring on the deck.
 const octagon=(r,path=new T.Shape())=>{for(let i=0;i<8;i++){const a=i*Math.PI/4;path[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r);}path.closePath();return path;};
 const ring=(r0,r1)=>{const s=octagon(r1);s.holes.push(octagon(r0,new T.Path()));return s;};
 piece(M.black,new T.CircleGeometry(IRIS,8).rotateX(-Math.PI/2).translate(GX,.003,0));
 piece(M.steel,new T.ExtrudeGeometry(ring(IRIS-.06,1.75),{depth:.035,bevelEnabled:false}).rotateX(-Math.PI/2).translate(GX,0,0));
 const led=new T.Mesh(new T.ShapeGeometry(ring(1.3,1.37)).rotateX(-Math.PI/2).translate(GX,.037,0),M.led);led.name='Freight_gate_iris_led';group.add(led);
 for(let i=0;i<16;i++){const a=(i+.5)*Math.PI/8;piece(M.dark,new T.CylinderGeometry(.035,.035,.022,6).translate(GX+Math.cos(a)*1.52,.046,Math.sin(a)*1.52));}
 const blades=[];
 for(let i=0;i<8;i++){
  const a0=i*Math.PI/4,a1=a0+Math.PI/4,am=a0+Math.PI/8,rm=IRIS*Math.cos(Math.PI/8),px=Math.cos(am)*rm,pz=Math.sin(am)*rm;
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-px,0,-pz,IRIS*Math.cos(a0)-px,0,IRIS*Math.sin(a0)-pz,IRIS*Math.cos(a1)-px,0,IRIS*Math.sin(a1)-pz],3));
  g.setAttribute('normal',new T.Float32BufferAttribute([0,1,0,0,1,0,0,1,0],3));
  const o=new T.Mesh(g,i%2?M.blade2:M.blade);o.name='Freight_gate_iris_blade';o.position.set(GX+px,.006+(i%2)*.0025,pz);group.add(o);blades.push(o);
 }
 if(canPaint){
  const S=96,REPS=28,r0=1.85,r1=2.45,pos=[],uv=[],idx=[];
  for(let i=0;i<=S;i++){const a=i/S*Math.PI*2;pos.push(GX+Math.cos(a)*r0,0,Math.sin(a)*r0,GX+Math.cos(a)*r1,0,Math.sin(a)*r1);uv.push(i/S*REPS,0,i/S*REPS,1);}
  for(let i=0;i<S;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setAttribute('normal',new T.Float32BufferAttribute(pos.map((_,k)=>k%3===1?1:0),3));g.setIndex(idx);
  decal('hazard_ring',g,canvasTexture(128,64,(c,w,h)=>stripes(c,0,0,w,h,32),true)).material.side=T.DoubleSide;
 }

 // The lanes, painted on the deck either side of the iris: in-bound to the left (+z), out-bound to the right (-z).
 const LANE_X=[-8,1.6],LANE_Z=[2.9,8.7],lw=LANE_Z[1]-LANE_Z[0],ll=LANE_X[1]-LANE_X[0],lx=(LANE_X[0]+LANE_X[1])/2;
 // Canvas x from a lane's far edge (left) to its near edge; canvas y from aft (top) to forward.
 const canvasX=z=>{const z1=z>0?LANE_Z[1]:-LANE_Z[0];return (z1-z)/lw*512;},canvasY=x=>(x-LANE_X[0])/ll*848;
 for(const s of [1,-1]){
  const {color,label,sub}=s>0?{color:IN,label:'IN-BOUND',sub:'LANE A · RECEIVING'}:{color:OUT,label:'OUT-BOUND',sub:'LANE B · DISPATCH'};
  if(canPaint)decal(s>0?'lane_in_paint':'lane_out_paint',new T.PlaneGeometry(lw,ll).rotateX(-Math.PI/2).rotateY(Math.PI/2).translate(lx,0,s*(LANE_Z[0]+LANE_Z[1])/2),
   canvasTexture(512,848,(c,w,h)=>lanePaint(c,w,h,{color,label,sub,...(s>0?{arrowFrom:canvasX(LANE_Z[0]),arrowTo:canvasX(PAD-.9)}:{arrowFrom:canvasX(.9-PAD),arrowTo:canvasX(-LANE_Z[0])}),arrowY:canvasY(GX)})),.005);
  // The roller conveyor from under the gantry aft into a covered transfer hatch, its side rails in the lane colour.
  const z=s*PAD,len=BELT_X[1]-BELT_X[0],bx=(BELT_X[0]+BELT_X[1])/2,lane=s>0?M.in:M.out;
  for(const e of [-1,1])box(lane,[len,.1,.06],[bx,BELT-.05,z+e*.5]);
  for(let x=BELT_X[0]+.12;x<BELT_X[1];x+=.2)piece(M.roller,new T.CylinderGeometry(.04,.04,.94,10).rotateX(Math.PI/2).translate(x,BELT-.04,z));
  for(let x=BELT_X[0]+.3;x<BELT_X[1];x+=1.6)for(const e of [-1,1])box(M.dark,[.06,BELT-.08,.06],[x,(BELT-.08)/2,z+e*.46]);
  block([len,BELT,1.1],[bx,BELT/2,z]);
  const tx=(TUNNEL_X[0]+TUNNEL_X[1])/2,tl=TUNNEL_X[1]-TUNNEL_X[0];
  for(const e of [-1,1])box(M.dark,[tl,1.5,.06],[tx,.75,z+e*.72]);
  box(M.dark,[tl,.08,1.5],[tx,1.54,z]);box(M.dark,[.06,1.5,1.5],[TUNNEL_X[0]+.03,.75,z]);
  box(s>0?M.inGlow:M.outGlow,[.04,.06,1.44],[TUNNEL_X[1]+.02,1.45,z]);
  for(let k=0;k<7;k++)box(M.curtain,[.012,1.36,.2],[TUNNEL_X[1]-.03+(k%2)*.012,.7,z-.6+k*.2]);
  block([tl,1.58,1.5],[tx,.79,z]);
  // Barricades between the conveyor and the walkway: posts on feet with yellow and black boards.
  for(const x of [-4.6,-2.6]){
   const zb=s*(PAD-1.2);
   for(const e of [-1,1]){box(M.dark,[.05,1,.05],[x+e*.78,.5,zb]);box(M.dark,[.06,.04,.4],[x+e*.78,.02,zb]);}
   for(const y of [.5,.9])for(let k=0;k<6;k++)box(k%2?M.ink:M.yellow,[1.56/6,.12,.03],[x-.78+1.56/12+k*1.56/6,y,zb]);
   block([1.66,1,.42],[x,.5,zb]);
  }
 }

 // The gantry rails: two flush steel I-beams under the ceiling with hangers and striped end stops.
 for(const x of RAIL_X){
  box(M.steel,[.3,.03,RAIL_Z*2],[x,3.335,0]);box(M.steel,[.03,.2,RAIL_Z*2],[x,3.22,0]);box(M.steel,[.3,.03,RAIL_Z*2],[x,3.105,0]);
  for(const e of [-1,1]){box(M.yellow,[.32,.12,.06],[x,3.03,e*RAIL_Z]);box(M.ink,[.08,.122,.062],[x,3.03,e*RAIL_Z]);}
 }

 // Hanging lane signs ahead of the gantry, readable from both ends of the room.
 if(canPaint){
  const tex=canvasTexture(512,320,laneSign),signs=[];
  for(const s of [1,-1]){const z=s*PAD,uv=s>0?[0,1,.5,1]:[0,1,0,.5];
   for(const e of [1,-1])signs.push(plane(1.7,.53,uv).rotateY(e*Math.PI/2).translate(3.4+e*.012,2.5,z));
   box(M.dark,[.04,.04,1.78],[3.4,2.79,z]);for(const e of [-1,1])box(M.dark,[.02,.56,.02],[3.4,3.07,z+e*.75]);box(M.dark,[.016,.55,1.72],[3.4,2.5,z]);}
  const o=new T.Mesh(mergeGeometries(signs),new T.MeshStandardMaterial({name:'Freight_gate_lane_signs',map:tex,roughness:.5}));o.name='Freight_gate_lane_signs';group.add(o);
  // Worker-safety posters on the walls: the aft bulkhead either side of the room's name, the side walls between the
  // racks and the entry wall by the doorway. [poster, x, z, facing]
  const sheet=canvasTexture(2000,640,posterSheet),n=POSTERS.length,posters=[];
  for(const [i,x,z,ry] of [[0,-21.82,6,Math.PI/2],[1,-21.82,-6,Math.PI/2],[2,-11,14.82,Math.PI],[4,9,14.82,Math.PI],[1,-11,-14.82,0],[0,9,-14.82,0],[3,21.82,9,-Math.PI/2],[4,21.82,-10.6,-Math.PI/2]]){
   const nx=Math.sin(ry),nz=Math.cos(ry);
   posters.push(plane(.95,1.216,[i/n,(i+1)/n,0,1]).rotateY(ry).translate(x+nx*.006,1.75,z+nz*.006));box(M.dark,[1.03,1.3,.012],[x-nx*.006,1.75,z-nz*.006],ry);
  }
  const p=new T.Mesh(mergeGeometries(posters),new T.MeshStandardMaterial({name:'Freight_gate_posters',map:sheet,roughness:.7}));p.name='Freight_gate_posters';group.add(p);
  // The console's screens, on short stands at the desk's far edge, facing the chair.
  const scr=canvasTexture(1200,300,consoleScreens),screens=[];
  for(let i=0;i<3;i++){const dz=(i-1)*.66,turn=(1-i)*.22;
   screens.push(plane(.62,.36,[i/3,(i+1)/3,0,1]).rotateX(-.08).rotateY(Math.PI/2+turn).translate(CONSOLE.x-.18,1.08,CONSOLE.z-dz));
   box(M.dark,[.04,.42,.66],[CONSOLE.x-.225,1.08,CONSOLE.z-dz],turn);box(M.dark,[.05,.2,.05],[CONSOLE.x-.26,.88,CONSOLE.z-dz]);}
  const sc=new T.Mesh(mergeGeometries(screens),new T.MeshBasicMaterial({name:'Freight_gate_console_screens',map:scr,toneMapped:false}));sc.name='Freight_gate_console_screens';group.add(sc);
 }

 for(const [m,gs] of parts){const o=new T.Mesh(mergeGeometries(gs),m);o.name=m.name;o.receiveShadow=true;group.add(o);gs.forEach(g=>g.dispose());}

 // The moving gantry: end trucks, the bridge girder with striped faces, the trolley and its beacon, the two cables
 // and the claw, all riding along z together.
 const bridge=new T.Group();bridge.name='Freight_gate_bridge';group.add(bridge);
 const add=(parent,name,geo,m,at=[0,0,0])=>{const o=new T.Mesh(geo,m);o.name='Freight_gate_'+name;o.position.set(...at);o.castShadow=true;parent.add(o);return o;};
 {const len=RAIL_X[1]-RAIL_X[0]+.3,cx=(RAIL_X[0]+RAIL_X[1])/2,g=[],y=[],k=[];
  for(const x of RAIL_X)g.push(new T.BoxGeometry(.36,.12,.7).translate(x,3.03,0));
  g.push(new T.BoxGeometry(len,.12,.24).translate(cx,2.97,0),new T.BoxGeometry(.62,.12,.5).translate(GX,TROLLEY+.06,0));
  for(let i=0;i<10;i++)(i%2?k:y).push(new T.BoxGeometry(len/10,.1,.245).translate(cx-len/2+len/20+i*len/10,2.97,0));
  add(bridge,'bridge',mergeGeometries(g),M.steel);add(bridge,'bridge_stripes_yellow',mergeGeometries(y),M.yellow);add(bridge,'bridge_stripes_black',mergeGeometries(k),M.ink);}
 const beacon=add(bridge,'beacon',new T.CylinderGeometry(.05,.05,.06,12),M.beacon,[GX+.24,TROLLEY-.03,.18]);
 const cables=[-.07,.07].map(dz=>add(bridge,'cable',new T.CylinderGeometry(.012,.012,1,6).translate(0,-.5,0),M.dark,[GX,TROLLEY,dz]));
 // The claw, its grip point at the origin: a hub, a lit collar and four hinged prongs that close round a crate's top.
 const claw=new T.Group();claw.position.x=GX;bridge.add(claw);
 add(claw,'claw_hub',new T.CylinderGeometry(.15,.2,.18,16),M.dark,[0,.31,0]);
 add(claw,'claw_collar',new T.CylinderGeometry(.205,.205,.035,16,1,true),M.led,[0,.235,0]);
 const hinges=[];
 for(let i=0;i<4;i++){const a=i*Math.PI/2,pivot=new T.Group();pivot.position.set(Math.cos(a)*.17,.25,Math.sin(a)*.17);pivot.rotation.y=-a;claw.add(pivot);
  const hinge=new T.Group();pivot.add(hinge);hinges.push(hinge);
  add(hinge,'claw_prong',new T.BoxGeometry(.05,.38,.07).translate(0,-.19,0),M.steel);
  const finger=new T.Group();finger.position.y=-.38;finger.rotation.z=-.85;hinge.add(finger);
  add(finger,'claw_finger',new T.BoxGeometry(.05,.17,.07).translate(0,-.085,0),M.steel);
  add(hinge,'claw_knuckle',new T.SphereGeometry(.04,10,8),M.dark,[0,-.38,0]);}
 // Two crates: one in-bound (teal label), one out-bound (orange label).
 const crate=label=>{const c=new T.Group(),[w,h,d]=CRATE;group.add(c);
  add(c,'crate',new T.BoxGeometry(w,h,d),M.card);
  add(c,'crate_strap',new T.BoxGeometry(w+.012,h+.012,.06),M.strap);add(c,'crate_strap',new T.BoxGeometry(.06,h+.012,d+.012),M.strap);
  for(const e of [-1,1])add(c,'crate_label',new T.BoxGeometry(.22,.14,.008),label,[w/4,.06,e*(d/2+.004)]);
  return c;};
 const cargoIn=crate(M.in),cargoOut=crate(M.out);

 const centre=room.localToWorld(new T.Vector3(GX,0,0));
 function pose(t){
  const z=BRIDGE(t),y=GRIP(t),open=OPEN(t),iris=IRIS_OPEN(t),ch=CRATE[1]/2;
  bridge.position.z=z;claw.position.y=y;
  for(const h of hinges)h.rotation.z=.7+.35*open;
  for(const c of cables)c.scale.y=Math.max(.01,TROLLEY-(y+.4));
  const s=1-.95*iris;for(const b of blades){b.scale.set(s,1,s);b.rotation.y=iris*.55;}
  // On the belt a crate rolls at a steady pace; in the well or inside a hatch it is out of sight.
  cargoIn.visible=t>=9&&t<34;
  if(t<23)cargoIn.position.set(GX,y-ch,z);else cargoIn.position.set(GX+(INSIDE-GX)*clamp((t-24)/10),BELT+ch,PAD);
  cargoOut.visible=t>=12&&t<50;
  if(t<36)cargoOut.position.set(INSIDE+(GX-INSIDE)*clamp((t-12)/10),BELT+ch,-PAD);else cargoOut.position.set(GX,y-ch,z);
  // The iris strip flashes while the iris is open or moving; the trolley's beacon while the gantry moves.
  const flash=Math.floor(t*3)%2===0;
  M.led.color.setHex(iris>.001&&!flash?0x5a2a08:LED);
  const moving=Math.abs(BRIDGE(t+.1)-z)>1e-4||Math.abs(GRIP(t+.1)-y)>1e-4;
  M.beacon.color.setHex(moving&&flash?LED:0x3a1c06);
 }
 pose(18);
 function update(dt,p){
  if(still||Math.abs(p.y-centre.y)>4||Math.abs(p.x-centre.x)>40||Math.abs(p.z-centre.z)>30)return;
  pose(Date.now()/1000%CYCLE);
 }
 return {group,solid,update,pose};
}
