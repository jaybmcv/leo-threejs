import {roomObject} from '../plan/rooms.js';
import {walkCanvas} from './canvas.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Deck 4's Life-support control shows its services on foot: a warm orange air (O₂) line over a teal water line runs
// high along each side wall on steel clamps, and turns along the far wall into a supply cabinet beside the outer
// systems displays, its plates marked O₂, H₂O and CO₂ scrubber. Short branches drop to regulator boxes with pressure
// gauges, water and air in turn down each wall. Everything hugs the walls above the desks, so the desks, consoles,
// centre aisle and doorway stay as they were.
// Room frame (Area_d04-control-8): the doorway at x=-25.92 (|z|<2), the side walls' faces at |z|=16.84, the far
// wall's face at x=25.84 with the systems displays at |z|<11.8 (y 0.58-2.03) under the room title (|z|<7, y 2.2-2.9),
// and the ceiling at y=3.3 with its light strips out to |z|=12.1.
const ROOM='Area_d04-control-8';
const SIDE=16.84,BACK=25.84,A=.14,B=.38,START=-24.6;
const AIR={y:2.95,r:.085},WATER={y:2.68,r:.075};
// Regulator stations down each side wall, and the supply cabinet's span beside the outer display.
const STATIONS=[-16,-6,4,14],BOX=[.36,.44,.22],BOX_Y=1.45,CAB={z0:12.05,z1:13.55,y0:.58,y1:2.03,d:.22},DROP={air:12.45,water:13.15};
const FONT='"Archivo", "Sora", sans-serif',MONO='"JetBrains Mono", ui-monospace, monospace';

function canvasTexture(w,h,paint){
 const c=walkCanvas();c.width=w;c.height=h;const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
 const draw=()=>{const g=c.getContext('2d');g.clearRect(0,0,w,h);paint(g,w,h);t.needsUpdate=true;};
 draw();globalThis.document?.fonts?.ready.then(draw);return t;
}
// "H2O" with its digits set as subscripts, centred on (x, y).
function formula(g,text,x,y,size,font){
 const parts=[...text].map(ch=>({ch,sub:/\d/.test(ch)})),set=p=>{g.font=font.replace('SIZE',Math.round(p.sub?size*.62:size)+'px');};
 let w=0;for(const p of parts){set(p);w+=g.measureText(p.ch).width;}
 let cx=x-w/2;g.textAlign='left';g.textBaseline='middle';
 for(const p of parts){set(p);g.fillText(p.ch,cx,p.sub?y+size*.24:y);cx+=g.measureText(p.ch).width;}
}
// A printed plate in the line's colour: the formula large, what it carries small beneath it.
function plate(colour,name,caption){
 return canvasTexture(256,128,(g,w,h)=>{
  g.fillStyle=colour;g.beginPath();g.roundRect(0,0,w,h,14);g.fill();
  g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=4;g.beginPath();g.roundRect(7,7,w-14,h-14,9);g.stroke();
  g.fillStyle='#ffffff';formula(g,name,w/2,h*.42,54,`700 SIZE ${FONT}`);
  g.textAlign='center';g.font=`600 17px ${MONO}`;g.letterSpacing='3px';g.fillText(caption,w/2,h*.8);g.letterSpacing='0px';
 });
}
// A pressure gauge's face: white dial, ticks, a coloured band at the top of the range and the needle mid-scale.
function dial(colour){
 return canvasTexture(128,128,(g,w,h)=>{
  const c=w/2,r=w/2-4;g.fillStyle='#f4f2ec';g.beginPath();g.arc(c,c,r,0,Math.PI*2);g.fill();
  g.strokeStyle=colour;g.lineWidth=9;g.beginPath();g.arc(c,c,r-14,-Math.PI*.15,Math.PI*.25);g.stroke();
  g.strokeStyle='#20282c';g.lineWidth=3;
  for(let i=0;i<=10;i++){const a=Math.PI*(.75+i*.15),l=i%5?8:14;g.beginPath();g.moveTo(c+Math.cos(a)*(r-8),c+Math.sin(a)*(r-8));g.lineTo(c+Math.cos(a)*(r-8-l),c+Math.sin(a)*(r-8-l));g.stroke();}
  const a=Math.PI*1.45;g.lineWidth=5;g.strokeStyle='#b8322a';g.beginPath();g.moveTo(c,c);g.lineTo(c+Math.cos(a)*(r-20),c+Math.sin(a)*(r-20));g.stroke();
  g.fillStyle='#20282c';g.beginPath();g.arc(c,c,8,0,Math.PI*2);g.fill();
 });
}

// The pipework in ship coordinates: `group` draws (with its deck band) and `solid` holds the regulator boxes and the
// supply cabinets as plain boxes for the colliders. Returns null if the room is missing.
export function createLifeSupportPipes(ship){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Life_support_pipework';room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Life_support_pipework_colliders';room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const std=(name,color,o={})=>new T.MeshStandardMaterial({name:'Pipework_'+name,color,roughness:.4,metalness:.25,...o});
 const M={air:std('air',0xd8742c),water:std('water',0x1f978f),steel:std('steel',0x9aa5aa,{metalness:.7,roughness:.35}),
  dark:std('dark',0x2a3338,{roughness:.55}),body:std('regulator',0x4b5a63,{roughness:.45,metalness:.35}),
  o2:std('o2_plate',0xffffff,{map:plate('#c8642a','O2','AIR SUPPLY'),metalness:0,roughness:.5}),
  h2o:std('h2o_plate',0xffffff,{map:plate('#17877f','H2O','WATER SUPPLY'),metalness:0,roughness:.5}),
  co2:std('co2_plate',0xffffff,{map:canvasTexture(512,128,(g,w,h)=>{
   g.fillStyle='#5d7d70';g.beginPath();g.roundRect(0,0,w,h,14);g.fill();
   g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=4;g.beginPath();g.roundRect(7,7,w-14,h-14,9);g.stroke();
   g.fillStyle='#ffffff';formula(g,'CO2',w*.27,h*.5,62,`700 SIZE ${FONT}`);
   g.textAlign='left';g.font=`600 30px ${MONO}`;g.letterSpacing='4px';g.fillText('SCRUBBER',w*.45,h*.5);g.letterSpacing='0px';
  }),metalness:0,roughness:.5}),
  airDial:std('air_gauge',0xffffff,{map:dial('#d8742c'),metalness:0,roughness:.3}),
  waterDial:std('water_gauge',0xffffff,{map:dial('#1f978f'),metalness:0,roughness:.3})};
 const parts=new Map(),piece=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g);};
 const box=(m,[w,h,d],[x,y,z])=>piece(m,new T.BoxGeometry(w,h,d).translate(x,y,z));
 const block=([w,h,d],[x,y,z])=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d));o.position.set(x,y,z);solid.add(o);};
 // A straight run between two points that differ along one axis, and a ball joint where runs meet.
 function pipe(m,r,a,b){
  const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],len=Math.hypot(...d),g=new T.CylinderGeometry(r,r,len,12);
  if(Math.abs(d[0])>1e-6)g.rotateZ(Math.PI/2);else if(Math.abs(d[2])>1e-6)g.rotateX(Math.PI/2);
  piece(m,g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2));
 }
 const joint=(m,r,[x,y,z])=>piece(m,new T.SphereGeometry(r*1.3,12,8).translate(x,y,z));
 // A flat face turned to look along `n` (+z, -z or -x) into the room.
 const face=(geo,n,[x,y,z])=>geo.rotateY(n==='-x'?-Math.PI/2:n==='-z'?Math.PI:0).translate(x,y,z);
 // A gauge on a short stem, its dial facing `n`.
 function gauge(m,[x,y,z],n,r=.08){
  const out=n==='-x'?[-1,0,0]:n==='-z'?[0,0,-1]:[0,0,1],at=k=>[x+out[0]*k,y,z+out[2]*k];
  const body=new T.CylinderGeometry(r,r,.035,20).rotateX(Math.PI/2);if(n==='-x')body.rotateY(Math.PI/2);
  piece(M.steel,body.translate(...at(.018)));piece(m,face(new T.CircleGeometry(r*.86,24),n,at(.037)));
 }
 // A clamp: a strap on the wall and a collar round each line. `along` is the run's axis ('x' or 'z').
 function clamp(along,u,s){
  const mid=(AIR.y+WATER.y)/2,wall=along==='x'?[u,mid,s*(SIDE-.0125)]:[BACK-.0125,mid,s*u];
  box(M.steel,along==='x'?[.06,.48,.025]:[.025,.48,.06],wall);
  for(const L of [AIR,WATER]){
   const c=new T.CylinderGeometry(L.r+.014,L.r+.014,.05,12),p=along==='x'?[u,L.y,s*(SIDE-A)]:[BACK-A,L.y,s*u];
   piece(M.steel,(along==='x'?c.rotateZ(Math.PI/2):c.rotateX(Math.PI/2)).translate(...p));
   box(M.steel,along==='x'?[.04,.035,A]:[A,.035,.04],along==='x'?[u,L.y,s*(SIDE-A/2)]:[BACK-A/2,L.y,s*u]);
  }
 }
 // A hand-wheel valve on a vertical drop at standoff A, its wheel facing into the room.
 function valve(x,y,s){
  const z=s*(SIDE-A);box(M.dark,[.1,.12,.1],[x,y,z]);
  piece(M.dark,new T.CylinderGeometry(.012,.012,.13,8).rotateX(Math.PI/2).translate(x,y,z-s*.1));
  piece(M.dark,new T.TorusGeometry(.07,.011,6,18).translate(x,y,z-s*.165));
  for(const a of [0,Math.PI/2])piece(M.dark,new T.BoxGeometry(.14,.014,.014).rotateZ(a).translate(x,y,z-s*.165));
 }

 for(const s of [-1,1]){
  const n=s>0?'-z':'+z',at=(x,y,off=A)=>[x,y,s*(SIDE-off)],end=(z,y)=>[BACK-A,y,s*z];
  for(const [L,m,drop] of [[AIR,M.air,DROP.air],[WATER,M.water,DROP.water]]){
   // Out of the side wall near the doorway, along it to the far corner, then along the far wall to its drop.
   pipe(M.steel,L.r*1.9,[START,L.y,s*SIDE],[START,L.y,s*(SIDE-.03)]);
   pipe(m,L.r,[START,L.y,s*SIDE],at(START,L.y));joint(m,L.r,at(START,L.y));
   pipe(m,L.r,at(START,L.y),at(BACK-A,L.y));joint(m,L.r,at(BACK-A,L.y));
   pipe(m,L.r,end(SIDE-A,L.y),end(drop,L.y));joint(m,L.r,end(drop,L.y));
   pipe(m,L.r,end(drop,L.y),end(drop,CAB.y1));
   gauge(m===M.air?M.airDial:M.waterDial,[BACK-A-L.r,2.3,s*drop],'-x');
  }
  for(let x=START+1.4;x<BACK-.6;x+=3)if(STATIONS.every(q=>Math.abs(q-x)>.5))clamp('x',x,s);
  for(const z of [15.6,14.3])clamp('z',z,s);
  // Regulator stations: water and air in turn, each a box with its gauge, plate and colour band, fed by a valved drop.
  // The air line runs above the water line, so an air drop steps out round it.
  STATIONS.forEach((x,i)=>{
   const air=(i+(s>0?1:0))%2===1,L=air?AIR:WATER,m=air?M.air:M.water,top=BOX_Y+BOX[1]/2,front=BOX[2];
   joint(m,L.r,at(x,L.y));
   if(air){pipe(m,L.r,at(x,L.y),at(x,L.y,B));joint(m,L.r,at(x,L.y,B));pipe(m,L.r,at(x,L.y,B),at(x,2.42,B));joint(m,L.r,at(x,2.42,B));
    pipe(m,L.r,at(x,2.42,B),at(x,2.42));joint(m,L.r,at(x,2.42));pipe(m,L.r,at(x,2.42),at(x,top));}
   else pipe(m,L.r,at(x,L.y),at(x,top));
   valve(x,2.08,s);
   box(M.body,BOX,at(x,BOX_Y,BOX[2]/2));block(BOX,at(x,BOX_Y,BOX[2]/2));
   box(m,[BOX[0]+.006,.04,BOX[2]+.006],at(x,top-.035,BOX[2]/2));
   gauge(air?M.airDial:M.waterDial,at(x,1.52,front),n);
   piece(air?M.o2:M.h2o,face(new T.PlaneGeometry(.24,.12),n,at(x,1.32,front+.003)));
  });
  // The supply cabinet beside the outer display: the two lines enter its top over their plates, the CO₂ scrubber's
  // plate and intake grille below.
  const cz=(CAB.z0+CAB.z1)/2,ch=CAB.y1-CAB.y0,cab=[CAB.d,ch,CAB.z1-CAB.z0],cx=BACK-CAB.d/2,fx=BACK-CAB.d-.003;
  box(M.body,cab,[cx,CAB.y0+ch/2,s*cz]);block(cab,[cx,CAB.y0+ch/2,s*cz]);
  box(M.steel,[CAB.d+.01,.03,CAB.z1-CAB.z0+.01],[cx,CAB.y1-.015,s*cz]);
  piece(M.o2,face(new T.PlaneGeometry(.5,.25),'-x',[fx,1.78,s*DROP.air]));
  piece(M.h2o,face(new T.PlaneGeometry(.5,.25),'-x',[fx,1.78,s*DROP.water]));
  piece(M.co2,face(new T.PlaneGeometry(1.2,.3),'-x',[fx,1.38,s*cz]));
  for(let j=0;j<6;j++)box(M.dark,[.02,.035,1.1],[fx-.008,.78+j*.07,s*cz]);
 }

 for(const [m,gs] of parts){const o=new T.Mesh(mergeGeometries(gs),m);o.name=m.name;o.receiveShadow=true;o.userData.noCollide=true;group.add(o);gs.forEach(g=>g.dispose());}
 return {group,solid};
}
