import * as T from 'three';
import {anchorObject,roomObject} from '../plan/rooms.js';

// Deck 20's Communications room on foot: a navigation star map wraps the back wall and both end walls, its plotted
// courses running on across the corners, and each of the six stations gets a screen of its own. Concept graphics only,
// drawn once on canvases (and again when the web fonts arrive).
// Room (Area_d20-communications-3, ship frame): x 39..67, z -33..-9, floor y 36.3. The back wall's face is at z=-32.84,
// the end walls' at x=39.16 and 66.84; the consoles stand at x 45/53/61, z -27/-16, their raised displays facing +z.
const ROOM='Area_d20-communications-3';
const FLOOR=36.3,PX=128,H=2,MID=FLOOR+2;
const FONT={display:'"Archivo", "Sora", sans-serif',mono:'"JetBrains Mono", ui-monospace, monospace'};
const INK='#06121c',GRID='rgba(110,190,220,.16)',TEXT='#d8eef5',DIM='#7fa9b8',TEAL='#5fd4e6',ORANGE='#ff9a4a',GOLD='#f2c96b',PINK='#e77bd0';

function rng(seed){return ()=>(seed=(seed*16807)%2147483647)/2147483647;}

// The wraparound in panorama metres: left end wall (0..13), back wall (13..40.4), right end wall (40.4..53.4). The back
// panel stands just proud of the old mission display strip, which it covers.
const WALLS=[
 {name:'left',w:13,at:[39.2,MID,-26.2],ry:Math.PI/2},
 {name:'back',w:27.4,at:[53,MID,-32.62],ry:0},
 {name:'right',w:13,at:[66.8,MID,-26.2],ry:-Math.PI/2},
];
// Courses as panorama points [u metres, v 0 top..1 bottom], and the bodies they join.
const COURSES=[
 {label:'COURSE A · MARS TRANSFER',color:ORANGE,pts:[[2,.72],[9,.55],[16,.48],[24,.42],[31,.36],[38.5,.3]]},
 {label:'COURSE B · CERES RELAY',color:TEAL,pts:[[5,.3],[12,.38],[20,.6],[27,.66],[35,.62],[44,.5],[50,.42]]},
 {label:'COURSE C · JOVIAN LOOP',color:PINK,pts:[[18,.82],[25,.76],[33,.78],[41,.7],[47,.6],[51.3,.66]]},
];
const BODIES=[[2,.72,'EARTH','#6fb7ff',.16],[38.5,.3,'MARS','#ff7a4d',.13],[50,.42,'CERES','#c9c0b0',.08],[51.3,.66,'JUPITER','#e8b98a',.2],[5,.3,'LUNA','#d0d4da',.07]];

function canvasFor(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}

function paintMap(c,wall,u0){
 const w=c.canvas.width,h=c.canvas.height,s=PX,x=u=>(u-u0)*s,y=v=>v*h;
 c.fillStyle=INK;c.fillRect(0,0,w,h);
 const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'rgba(40,70,120,.35)');sky.addColorStop(.5,'rgba(10,30,50,0)');sky.addColorStop(1,'rgba(60,30,90,.3)');c.fillStyle=sky;c.fillRect(0,0,w,h);
 // A faint galactic band and the plotting grid, both continuous across the corners.
 c.fillStyle='rgba(150,170,230,.07)';c.beginPath();for(let u=u0;u<=u0+wall.w;u+=.5)c.lineTo(x(u),y(.45+.18*Math.sin(u/8)));for(let u=u0+wall.w;u>=u0;u-=.5)c.lineTo(x(u),y(.62+.18*Math.sin(u/8)));c.fill();
 c.strokeStyle=GRID;c.lineWidth=1.5;
 for(let u=Math.ceil(u0);u<=u0+wall.w;u++){c.beginPath();c.moveTo(x(u),0);c.lineTo(x(u),h);c.stroke();}
 for(let v=.125;v<1;v+=.125){c.beginPath();c.moveTo(0,y(v));c.lineTo(w,y(v));c.stroke();}
 // Stars, seeded per metre so the same sky shows whichever wall is painted.
 for(let m=Math.floor(u0);m<u0+wall.w;m++){const r=rng(m*7919+11);for(let i=0;i<34;i++){const u=m+r(),v=r(),b=r();c.fillStyle=`rgba(${b>.9?'255,220,180':'220,235,255'},${.3+b*.7})`;c.beginPath();c.arc(x(u),y(v),.6+b*b*2.2,0,7);c.fill();}}
 // Courses: dashed track, waypoints, and their labels where they start on this wall.
 for(const k of COURSES){
  c.strokeStyle=k.color;c.lineWidth=4;c.setLineDash([18,10]);c.beginPath();
  k.pts.forEach(([u,v],i)=>i?c.lineTo(x(u),y(v)):c.moveTo(x(u),y(v)));c.stroke();c.setLineDash([]);
  c.fillStyle=k.color;for(const [u,v] of k.pts){c.beginPath();c.arc(x(u),y(v),6,0,7);c.fill();}
  const [u,v]=k.pts[1];if(u>=u0&&u<u0+wall.w){c.font=`500 20px ${FONT.mono}`;c.fillText(k.label,x(u)+12,y(v)-14);}
 }
 for(const [u,v,name,color,r] of BODIES){
  const g=c.createRadialGradient(x(u)-r*s*.3,y(v)-r*s*.3,1,x(u),y(v),r*s);g.addColorStop(0,'#fff');g.addColorStop(.25,color);g.addColorStop(1,'rgba(0,0,0,.6)');
  c.fillStyle=g;c.beginPath();c.arc(x(u),y(v),r*s,0,7);c.fill();
  c.fillStyle=TEXT;c.font=`600 22px ${FONT.mono}`;c.fillText(name,x(u)+r*s+10,y(v)+8);
 }
 // Leo, part way along course A.
 const lu=20,lv=.45;c.strokeStyle=GOLD;c.lineWidth=3;c.beginPath();c.arc(x(lu),y(lv),16,0,7);c.stroke();
 c.fillStyle=GOLD;c.beginPath();c.moveTo(x(lu)+12,y(lv));c.lineTo(x(lu)-8,y(lv)-8);c.lineTo(x(lu)-8,y(lv)+8);c.fill();
 if(lu>=u0&&lu<u0+wall.w){c.font=`600 22px ${FONT.mono}`;c.fillText('LEO · ON COURSE A',x(lu)+26,y(lv)+34);}
 // Header strip with the title on the back wall and range scales on the ends.
 c.fillStyle='rgba(6,18,28,.85)';c.fillRect(0,0,w,30);c.fillStyle=TEAL;c.fillRect(0,30,w,2);
 c.fillStyle=DIM;c.font=`500 18px ${FONT.mono}`;c.textBaseline='middle';
 if(wall.name==='back'){c.textAlign='center';c.fillStyle=TEXT;c.font=`600 22px ${FONT.display}`;c.letterSpacing='8px';c.fillText('NAVIGATION · STAR MAP · PLOTTED COURSES',w/2,16);c.letterSpacing='0px';}
 c.textAlign='left';c.fillStyle=DIM;c.font=`500 18px ${FONT.mono}`;
 for(let u=Math.ceil(u0/4)*4;u<u0+wall.w;u+=4)if(wall.name!=='back'||Math.abs(x(u)-w/2)>420)c.fillText(`${String(u*15).padStart(3,'0')}°`,x(u)+6,16);
 c.textBaseline='alphabetic';
 // Course legend low on each end wall.
 if(wall.name!=='back'){COURSES.forEach((k,i)=>{const lx=(wall.name==='left'?6.5:2)*PX,ly=h-24-i*28;c.fillStyle=k.color;c.fillRect(lx,ly-12,30,6);c.fillStyle=TEXT;c.font=`500 19px ${FONT.mono}`;c.fillText(k.label,lx+44,ly-4);});}
 c.strokeStyle='rgba(255,255,255,.2)';c.lineWidth=4;c.strokeRect(2,2,w-4,h-4);
}

// Six station screens, numbered as the consoles' COMMS 01..06 labels: x 45/53/61, the far row (z -27) first.
const STATIONS=[[45,-27],[45,-16],[53,-27],[53,-16],[61,-27],[61,-16]];
const SW=1.62,SH=.52,SPX=[640,206];
function paintStation(c,i){
 const w=SPX[0],h=SPX[1],r=rng(101+i*37);
 c.fillStyle=INK;c.fillRect(0,0,w,h);c.strokeStyle='rgba(95,212,230,.35)';c.lineWidth=3;c.strokeRect(2,2,w-4,h-4);
 const titles=['DEEP-SPACE LINK','ANTENNA ARRAY','SIGNAL SPECTRUM','CREW CHANNELS','RELAY NETWORK','COURSE UPLINK'];
 c.fillStyle=TEAL;c.font=`600 22px ${FONT.mono}`;c.textBaseline='middle';c.fillText(`COMMS ${String(i+1).padStart(2,'0')} · ${titles[i]}`,16,22);
 c.fillStyle=i%2?GOLD:'#7be38f';c.textAlign='right';c.fillText(i===3?'4 OPEN':'LOCKED',w-16,22);c.textAlign='left';
 c.fillStyle='rgba(95,212,230,.3)';c.fillRect(16,40,w-32,2);
 const top=52,bh=h-top-14;
 if(i===0){c.strokeStyle='#7be38f';c.lineWidth=3;c.beginPath();for(let x=16;x<w-16;x+=4)c.lineTo(x,top+bh/2+Math.sin(x/18)*bh*.32*Math.sin(x/140));c.stroke();c.fillStyle=DIM;c.font=`500 18px ${FONT.mono}`;c.fillText('EARTH DSN · 14.2 MIN LAG',16,h-20);}
 if(i===1){for(let k=0;k<3;k++){const cx=110+k*190,cy=top+bh*.62;c.strokeStyle=TEAL;c.lineWidth=3;c.beginPath();c.arc(cx,cy,48,Math.PI*1.1,Math.PI*1.9);c.stroke();c.beginPath();c.moveTo(cx,cy-20);c.lineTo(cx+(k-1)*30,cy-90);c.strokeStyle=ORANGE;c.stroke();c.fillStyle=TEXT;c.font=`500 17px ${FONT.mono}`;c.textAlign='center';c.fillText(`DISH ${k+1} · ${[42,58,71][k]}°`,cx,h-18);c.textAlign='left';}}
 if(i===2){for(let x=0;x<40;x++){const v=.15+.8*Math.abs(Math.sin(x*.37)*Math.cos(x*.11))*(.6+.4*r());c.fillStyle=v>.7?ORANGE:TEAL;c.fillRect(20+x*15,top+bh*(1-v),11,bh*v);}}
 if(i===3){const ch=['BRIDGE','ENGINEERING','MEDICAL','CROWN LOUNGE'];c.font=`500 19px ${FONT.mono}`;ch.forEach((n,k)=>{const y=top+18+k*33;c.fillStyle='#7be38f';c.beginPath();c.arc(26,y,6,0,7);c.fill();c.fillStyle=TEXT;c.fillText(n,44,y);c.fillStyle=TEAL;c.fillRect(300,y-5,60+r()*200,10);});}
 if(i===4){const n=[[80,.3],[200,.75],[330,.25],[450,.7],[570,.4]].map(([x,v])=>[x,top+v*bh]);c.strokeStyle='rgba(95,212,230,.6)';c.lineWidth=2;for(let a=0;a<n.length;a++)for(let b=a+1;b<Math.min(n.length,a+3);b++){c.beginPath();c.moveTo(...n[a]);c.lineTo(...n[b]);c.stroke();}c.font=`500 16px ${FONT.mono}`;n.forEach(([x,y],k)=>{c.fillStyle=k===2?ORANGE:TEAL;c.beginPath();c.arc(x,y,9,0,7);c.fill();c.fillStyle=TEXT;c.fillText(`R${k+1}`,x+13,y+4);});}
 if(i===5){for(let k=0;k<70;k++){c.fillStyle=`rgba(220,235,255,${.3+r()*.7})`;c.fillRect(16+r()*(w-32),top+r()*bh,2,2);}c.strokeStyle=ORANGE;c.lineWidth=3;c.setLineDash([12,7]);c.beginPath();c.moveTo(40,top+bh*.8);c.quadraticCurveTo(w/2,top,w-60,top+bh*.35);c.stroke();c.setLineDash([]);c.fillStyle=GOLD;c.font=`500 18px ${FONT.mono}`;c.fillText('UPLINK COURSE A → BRIDGE',16,h-20);}
 c.textBaseline='alphabetic';
}

export function createCommsDisplays(ship,{anisotropy=8}={}){
 if(!roomObject(ship,ROOM))return null;
 // The group stands at floor height so it joins Deck 20's band; its pieces are placed relative to that.
 const group=new T.Group();group.name='Comms_displays';group.position.y=FLOOR;const paints=[];
 const plane=(w,h,cw,ch,at,ry,paint)=>{
  const canvas=canvasFor(cw,ch),c=canvas.getContext('2d'),map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=anisotropy;
  const o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({name:'Comms_display',map,toneMapped:false}));o.name='Comms_display';o.position.set(at[0],at[1]-FLOOR,at[2]);o.rotation.y=ry;group.add(o);
  const draw=()=>{paint(c);map.needsUpdate=true;};draw();paints.push(draw);
 };
 let u0=0;for(const wall of WALLS){const u=u0;plane(wall.w,H,Math.round(wall.w*PX),H*PX,wall.at,wall.ry,c=>paintMap(c,wall,u));u0+=wall.w;}
 STATIONS.forEach(([x,z],i)=>plane(SW,SH,...SPX,[x,FLOOR+1.26,z-.235],0,c=>paintStation(c,i)));
 document.fonts?.ready.then(()=>{for(const d of paints)d();});
 anchorObject(group,'d20-communications-3');return {group};
}
