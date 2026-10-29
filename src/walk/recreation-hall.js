import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {roomObject} from '../plan/rooms.js';
import {walkCanvas,hasWalkCanvas} from './canvas.js';

// A furnishing pass for Deck 16. These games are display props; Paw Pool and pinball keep their own play prompts.
// All positions are in the hall's frame. The entry, central aisle and both sides of Paw Pool stay clear.
const ROOM='d16-recreation-4';
function texture(draw,w=512,h=256){
 if(!hasWalkCanvas())return null;
 const c=walkCanvas();c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
function pitch(g,w,h,color){
 g.fillStyle=color;g.fillRect(0,0,w,h);g.strokeStyle='#eef6ed';g.lineWidth=3;
 g.strokeRect(12,12,w-24,h-24);g.beginPath();g.moveTo(w/2,12);g.lineTo(w/2,h-12);g.stroke();
 g.beginPath();g.arc(w/2,h/2,h*.2,0,Math.PI*2);g.stroke();
 for(const x of [12,w-60])g.strokeRect(x,h*.3,48,h*.4);
}
function golf(g,w,h){
 g.fillStyle='#8bc9d9';g.fillRect(0,0,w,h);g.fillStyle='#52746d';
 g.beginPath();g.moveTo(0,h*.55);g.lineTo(w*.22,h*.18);g.lineTo(w*.45,h*.55);g.lineTo(w*.7,h*.25);g.lineTo(w,h*.6);g.fill();
 g.fillStyle='#39734c';g.fillRect(0,h*.52,w,h*.48);g.fillStyle='#8ebc6a';
 g.beginPath();g.moveTo(w*.1,h);g.lineTo(w*.52,h*.52);g.lineTo(w*.64,h*.52);g.lineTo(w*.9,h);g.fill();
 g.fillStyle='#e9d4a4';g.beginPath();g.ellipse(w*.7,h*.72,w*.1,h*.045,0,0,Math.PI*2);g.fill();
 g.strokeStyle='#fff8e8';g.lineWidth=3;g.beginPath();g.moveTo(w*.57,h*.65);g.lineTo(w*.57,h*.41);g.stroke();
 g.fillStyle='#ef713e';g.beginPath();g.moveTo(w*.57,h*.41);g.lineTo(w*.67,h*.45);g.lineTo(w*.57,h*.49);g.fill();
}

export function dressRecreationHall(ship){
 const room=roomObject(ship,ROOM),fit=room?.getObjectByName('Room_fittings');if(!fit||room.getObjectByName('Recreation_furnishings'))return false;
 // Remove the old social tables and their merged board squares and trim, leaving the hall and activity floor intact.
 for(const o of [...fit.children])if(/^(Shared_table|Table_leg|Chair|Game_board|Refined_.*|Polish_.*)$/.test(o.name))o.removeFromParent();
 const group=new T.Group();group.name='Recreation_furnishings';fit.add(group);
 const mat=(name,color,extra={})=>new T.MeshStandardMaterial({name:'Recreation_'+name,color,roughness:.65,...extra});
 const M={navy:mat('navy',0x233b4b),wood:mat('timber',0xb38b5d),cream:mat('ivory',0xe6e5d9),dark:mat('dark',0x16242c),
  teal:mat('teal',0x39acb0),red:mat('coral',0xd65a42),blue:mat('blue',0x3476b5),green:mat('turf',0x447b57),
  metal:mat('alloy',0xaabcc4,{metalness:.75,roughness:.3}),fabric:mat('upholstery',0x496a78,{roughness:.96})};
 const add=(root,name,geo,m,p,solid=true)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...p);o.userData.noCollide=!solid;o.castShadow=solid;o.receiveShadow=true;root.add(o);return o;};
 const box=(root,name,size,m,p,solid=true)=>add(root,name,new T.BoxGeometry(...size),m,p,solid);
 const soft=(root,name,size,m,p)=>add(root,name,new RoundedBoxGeometry(...size,2,.06),m,p);
 const cyl=(root,name,r,h,m,p,solid=false)=>add(root,name,new T.CylinderGeometry(r,r,h,20),m,p,solid);
 const station=(name,x,z)=>{const o=new T.Group();o.name=name;o.position.set(x,0,z);group.add(o);return o;};
 const panel=(root,name,w,h,draw,p,ry=0)=>{const map=texture(draw,512,Math.max(64,Math.round(512*h/w))),m=new T.MeshBasicMaterial({name:'Recreation_'+name,color:map?0xffffff:0x467c86,map,toneMapped:false});
  const o=add(root,name,new T.PlaneGeometry(w,h),m,p,false);o.rotation.y=ry;return o;};
 const label=(root,text,w,p,ry=0)=>panel(root,'Recreation_label',w,.27,(g,cw,ch)=>{g.fillStyle='#233b4b';g.fillRect(0,0,cw,ch);g.fillStyle='#f6eddb';g.font='600 43px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,cw/2,ch/2,cw-24);},p,ry);
 const topPicture=(root,name,w,d,draw,p)=>{const o=panel(root,name,w,d,draw,p);o.rotation.x=-Math.PI/2;return o;};
 const legs=(root,w,d,h)=>{for(const sx of [-1,1])for(const sz of [-1,1])box(root,'Recreation_table_leg',[.1,h,.1],M.metal,[sx*(w/2-.15),h/2,sz*(d/2-.15)]);};
 const table=(root,w,d,h=.84)=>{legs(root,w,d,h-.1);soft(root,'Recreation_table_body',[w,.2,d],M.navy,[0,h-.1,0]);};
 const rails=(root,w,d,h,m=M.cream)=>{for(const s of [-1,1]){box(root,'Recreation_table_rail',[w+.14,.12,.07],m,[0,h,s*(d/2+.035)]);box(root,'Recreation_table_rail',[.07,.12,d],m,[s*(w/2+.035),h,0]);}};

 // Three dartboards, each with its own throwing lane and oche, away from the table games.
 const darts=station('Recreation_darts',-14.5,-16.65),numbers=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
 for(const x of [-3.5,0,3.5]){
  cyl(darts,'Recreation_dart_surround',.5,.08,M.navy,[x,1.73,0]).rotation.x=Math.PI/2;
  const board=panel(darts,'Recreation_dartboard',.88,.88,(g,w,h)=>{
   const r=h*.39,cx=w/2,cy=h/2;g.fillStyle='#19242c';g.beginPath();g.arc(cx,cy,h/2,0,Math.PI*2);g.fill();
   for(let i=0;i<20;i++){const a=-Math.PI/2-Math.PI/20+i*Math.PI/10,b=a+Math.PI/10;
    for(const [lo,hi,color] of [[0,1,i%2?'#e9ddbd':'#1b2428'],[.9,1,i%2?'#3a9b70':'#d85540'],[.55,.63,i%2?'#3a9b70':'#d85540']]){
     g.beginPath();g.arc(cx,cy,r*hi,a,b);g.arc(cx,cy,r*lo,b,a,true);g.closePath();g.fillStyle=color;g.fill();g.strokeStyle='#8a9b9e';g.lineWidth=1;g.stroke();}
    const mid=(a+b)/2;g.fillStyle='#f7eed8';g.font='18px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(numbers[i]),cx+Math.cos(mid)*r*1.15,cy+Math.sin(mid)*r*1.15);
   }
   for(const [r0,color] of [[.08,'#42a477'],[.035,'#df5941']]){g.beginPath();g.arc(cx,cy,r*r0,0,Math.PI*2);g.fillStyle=color;g.fill();}
  },[x,1.73,.046]);
  board.material.transparent=true;board.material.alphaTest=.1;
  box(darts,'Recreation_oche',[2.5,.012,.055],M.teal,[x,.009,2.8],false);
  for(const s of [-1,1])box(darts,'Recreation_lane_inlay',[.025,.012,2.8],M.wood,[x+s*1.25,.009,1.4],false);
 }
 label(darts,'DARTS',3,[0,2.6,.06]);

 const air=station('Recreation_air_hockey',-15,-9);table(air,2.5,1.4,.86);rails(air,2.5,1.4,.89);
 topPicture(air,'Recreation_air_hockey_pitch',2.5,1.4,(g,w,h)=>{pitch(g,w,h,'#d9eee9');g.fillStyle='#7fabad';for(let x=22;x<w-20;x+=14)for(let y=22;y<h-20;y+=14)g.fillRect(x,y,1.5,1.5);},[0,.863,0]);
 for(const s of [-1,1]){box(air,'Recreation_goal',[.09,.13,.48],M.dark,[s*1.29,.83,0],false);cyl(air,'Recreation_mallet',.095,.035,s<0?M.red:M.blue,[s*.78,.886,s*.22]);cyl(air,'Recreation_mallet_grip',.035,.08,s<0?M.red:M.blue,[s*.78,.94,s*.22]);}
 cyl(air,'Recreation_puck',.055,.018,M.dark,[.12,.88,.1]);label(air,'AIR HOCKEY',1.75,[0,.69,.744]);

 const foo=station('Recreation_foosball',0,-9);table(foo,1.6,.95,.86);rails(foo,1.6,.95,.96,M.wood);
 topPicture(foo,'Recreation_foosball_pitch',1.6,.95,(g,w,h)=>pitch(g,w,h,'#3f805f'),[0,.863,0]);
 for(let i=0;i<8;i++){
  const x=-.68+i*.195,rod=cyl(foo,'Recreation_foosball_rod',.012,1.6,M.metal,[x,1.02,0]);rod.rotation.x=Math.PI/2;
  const side=i%2?1:-1;box(foo,'Recreation_foosball_grip',[.06,.06,.18],M.dark,[x,1.02,side*.76],false);
  for(let j=0;j<(i===0||i===7?1:3);j++){const z=i===0||i===7?0:(j-1)*.26,m=i%2?M.red:M.blue;
   box(foo,'Recreation_foosball_player',[.06,.17,.07],m,[x,.98,z],false);cyl(foo,'Recreation_foosball_head',.042,.065,m,[x,1.1,z]);}
 }
 for(const s of [-1,1])box(foo,'Recreation_goal',[.06,.15,.32],M.dark,[s*.82,.88,0],false);
 add(foo,'Recreation_foosball_ball',new T.SphereGeometry(.025,10,8),M.cream,[.25,.889,.12],false);label(foo,'FOOSBALL',1.3,[0,.69,.53]);

 const ping=station('Recreation_ping_pong',15,-9);table(ping,2.74,1.525,.76);
 topPicture(ping,'Recreation_ping_pong_pitch',2.74,1.525,(g,w,h)=>{g.fillStyle='#326e98';g.fillRect(0,0,w,h);g.strokeStyle='#f4f0dc';g.lineWidth=3;g.strokeRect(3,3,w-6,h-6);g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();},[0,.763,0]);
 const net=panel(ping,'Recreation_ping_pong_net',1.7,.153,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#e4e8dd';g.fillRect(0,0,w,12);for(let i=0;i<w;i+=15)g.fillRect(i,0,2,h);for(let i=0;i<h;i+=24)g.fillRect(0,i,w,2);},[0,.843,0],Math.PI/2);
 net.material.transparent=true;net.material.side=T.DoubleSide;net.material.alphaTest=.3;
 for(const s of [-1,1]){box(ping,'Recreation_net_post',[.025,.2,.025],M.metal,[0,.84,s*.81],false);cyl(ping,'Recreation_paddle',.095,.018,s<0?M.red:M.dark,[s*.97,.78,.35]);box(ping,'Recreation_paddle_handle',[.13,.018,.035],M.wood,[s*1.09,.78,.35],false);}
 add(ping,'Recreation_ping_pong_ball',new T.SphereGeometry(.02,12,8),M.cream,[.85,.79,.1],false);label(ping,'PING PONG',1.7,[0,.57,.8]);

 const shuffle=station('Recreation_shuffleboard',-15,9);table(shuffle,4.6,.85,.83);rails(shuffle,4.6,.85,.88,M.wood);
 topPicture(shuffle,'Recreation_shuffleboard_lane',4.6,.85,(g,w,h)=>{
  g.fillStyle='#d9b781';g.fillRect(0,0,w,h);g.strokeStyle='#725d43';g.lineWidth=2;
  for(const side of [-1,1])for(let i=0;i<3;i++){const x=side<0?18+i*30:w-48-i*30;g.strokeRect(x,8,30,h-16);g.fillStyle='#3c4547';g.font='32px sans-serif';g.textAlign='center';g.fillText(String(3-i),x+15,h/2+12);}
  g.beginPath();g.moveTo(w/2,0);g.lineTo(w/2,h);g.stroke();
 },[0,.833,0]);
 for(const [x,z,m] of [[-1.8,-.2,M.red],[-1.5,.13,M.red],[1.65,.18,M.blue],[1.85,-.14,M.blue]]){cyl(shuffle,'Recreation_shuffle_puck',.065,.025,M.metal,[x,.85,z]);cyl(shuffle,'Recreation_shuffle_cap',.055,.016,m,[x,.87,z]);}
 label(shuffle,'SHUFFLEBOARD',2.2,[0,.65,.48]);

 // A real 8 by 8 checkers setup, with twelve pieces on the dark squares at each end.
 const checkers=station('Recreation_checkers',0,9);table(checkers,3,1.6);box(checkers,'Recreation_board_frame',[1.05,.035,1.05],M.wood,[0,.86,0]);
 for(let x=0;x<8;x++)for(let z=0;z<8;z++){
  box(checkers,'Recreation_checker_square',[.12,.008,.12],(x+z)%2?M.dark:M.cream,[(x-3.5)*.12,.882,(z-3.5)*.12],false);
  if((x+z)%2&&(z<3||z>4)){const p=[(x-3.5)*.12,.902,(z-3.5)*.12];cyl(checkers,'Recreation_checker',.044,.03,z<3?M.red:M.cream,p);cyl(checkers,'Recreation_checker_rim',.034,.004,z<3?M.red:M.wood,[p[0],.92,p[2]]);}
 }
 const chair=(x,z,ry)=>{const c=new T.Group();c.name='Chair';c.position.set(x,0,z);c.rotation.y=ry;checkers.add(c);soft(c,'Seat',[.66,.16,.7],M.fabric,[0,.46,0]);soft(c,'Back',[.68,.65,.12],M.fabric,[0,.85,-.3]);legs(c,.64,.68,.38);};
 chair(-.7,-1.4,0);chair(.7,1.4,Math.PI);chair(-2.2,0,Math.PI/2);chair(2.2,0,-Math.PI/2);label(checkers,'CHECKERS',1.4,[0,.64,.84]);

 // Two small TV lounges. Seat and Back names let the existing rest system find their sitting direction.
 for(const x of [11,19]){
  const lounge=station('Recreation_tv_lounge',x,12);
  soft(lounge,'Recreation_couch_base',[3.2,.3,.98],M.navy,[0,.2,0]);soft(lounge,'Seat_cushion',[2.8,.18,.78],M.fabric,[0,.47,.03]);
  soft(lounge,'Back',[2.9,.65,.18],M.fabric,[0,.84,-.4]);for(const s of [-1,1])soft(lounge,'Recreation_couch_arm',[.2,.5,.98],M.fabric,[s*1.5,.53,0]);
  box(lounge,'Recreation_coffee_table',[1.8,.09,.65],M.wood,[0,.48,2.05]);box(lounge,'Recreation_coffee_base',[.8,.43,.4],M.navy,[0,.215,2.05]);
  soft(lounge,'Recreation_tv_bezel',[2.7,1.6,.12],M.dark,[0,1.72,4.65]);
  panel(lounge,'Recreation_tv_picture',2.55,1.44,golf,[0,1.72,4.58],Math.PI);label(lounge,'SPORTS LOUNGE',2.7,[0,2.72,4.57],Math.PI);
 }

 // A golf simulator bay with an original course picture, side nets, hitting mat, ball and club.
 const sim=station('Recreation_golf_simulator',22.8,-11);
 box(sim,'Recreation_golf_screen_frame',[.16,2.8,5.2],M.navy,[2.75,1.4,0]);
 panel(sim,'Recreation_golf_screen',4.8,2.45,golf,[2.658,1.48,0],-Math.PI/2);
 box(sim,'Recreation_hitting_mat',[2,.035,3.2],M.green,[-1.5,.022,0],false);
 const mesh=texture((g,w,h)=>{g.fillStyle='#345361';g.fillRect(0,0,w,h);g.clearRect(0,0,w,h);g.strokeStyle='#608292';g.lineWidth=2;for(let x=0;x<w;x+=16){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}for(let y=0;y<h;y+=16){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}});
 const netMat=new T.MeshStandardMaterial({name:'Recreation_golf_net',map:mesh,color:0x7e9ca4,transparent:true,alphaTest:.3,side:T.DoubleSide,roughness:1});
 for(const s of [-1,1]){
  add(sim,'Recreation_golf_side_net',new T.PlaneGeometry(5.2,2.7),netMat,[.1,1.35,s*2.6],false);
  for(const end of [-2.5,2.7])box(sim,'Recreation_golf_post',[.06,2.8,.06],M.navy,[end,1.4,s*2.6]);
  box(sim,'Recreation_golf_crossbar',[5.3,.06,.06],M.navy,[.1,2.8,s*2.6]);
 }
 add(sim,'Recreation_golf_ball',new T.SphereGeometry(.022,12,8),M.cream,[-1.2,.062,0],false);
 const club=cyl(sim,'Recreation_golf_club',.012,.95,M.metal,[-2.15,.52,1.2]);club.rotation.z=-.2;
 box(sim,'Recreation_golf_club_head',[.18,.05,.07],M.dark,[-2.06,.055,1.2],false);
 label(sim,'GOLF SIMULATOR',3,[-2.54,2.6,0],-Math.PI/2);
 room.updateMatrixWorld(true);return true;
}
