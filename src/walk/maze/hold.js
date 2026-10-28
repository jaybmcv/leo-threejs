import {roomObject} from '../../plan/rooms.js';
import {walkCanvas} from '../canvas.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MAZE,X0,END,SIDE,WALL,HEIGHT,CELL_X,CELL_Z,GOAL,cellX0,cellZ0} from './layout.js';

// Container hold A on foot (CONTAINER_MAZE.md): the hold's ten big container stacks and the aisle lines go, and a
// maze of small shipping containers fills it from the end wall to 9.8 m short of the doorway. Its walls are rows of
// corrugated containers in mixed colours, door ends out; some corridors run through containers open at both ends, and
// some dead ends are containers open at one end. A START header and a striped line mark the way in, a sign beside it
// explains the game, and in the middle cell a red button on a striped console stops the clock (run.js).
// Room frame (Area_d01-cargo-1): see layout.js. The desk by the doorway and the parked trolley (cargo-trolley.js) stay.
const ROOM='Area_d01-cargo-1';
const OLD=/^(Secured_cargo_container|Container_reinforcement|Cargo_restraint_rail|Refined_cargo_restraints|Main_aisle_edge)$/;
const COLOURS=[0xa8432f,0xd0612b,0x2a8a82,0x2f5577,0xc39a3a,0x5d8456,0x8b9598,0x7a3b52];
const REACH=1.4,SIGN_REACH=2.2;

// Take the hold's old container stacks, their restraint rails and the amber aisle lines out before the colliders are
// built. Returns false if the room is missing.
export function stripHold(ship){
 const room=roomObject(ship,ROOM);if(!room)return false;
 const old=[];room.traverse(o=>{if(o.isMesh&&OLD.test(o.name))old.push(o);});
 for(const o of old){o.removeFromParent();o.geometry.dispose();}
 return true;
}

function rng(seed){return ()=>(seed=(seed*16807)%2147483647)/2147483647;}
const canvasTexture=(w,h,draw,repeat=false)=>{const c=walkCanvas();if(!c)return null;c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t;};
// Corrugated steel: ridges every 0.3 m (the texture spans two), shaded light to dark, multiplied by each colour.
const corrugation=()=>canvasTexture(128,32,(g,w,h)=>{for(let x=0;x<w;x++){const s=.5+.5*Math.cos(x/w*Math.PI*4);g.fillStyle=`rgb(${Math.round(150+105*s)},${Math.round(150+105*s)},${Math.round(150+105*s)})`;g.fillRect(x,0,1,h);}
 g.fillStyle='rgba(0,0,0,.18)';g.fillRect(0,0,w,2);g.fillRect(0,h-2,w,2);},true);
const hazard=()=>canvasTexture(128,128,(g,w,h)=>{g.fillStyle='#f2c230';g.fillRect(0,0,w,h);g.fillStyle='#1a1c1f';for(let k=-4;k<4;k++){g.beginPath();g.moveTo(k*32,h);g.lineTo(k*32+32,h);g.lineTo(k*32+32+h,0);g.lineTo(k*32+h,0);g.fill();}},true);
const checker=()=>canvasTexture(64,64,(g,w,h)=>{for(let i=0;i<4;i++)for(let j=0;j<4;j++){g.fillStyle=(i+j)%2?'#1a1c1f':'#ece8de';g.fillRect(i*16,j*16,16,16);}},true);
// A sign: lines of [text, size, colour] on a dark panel with an orange rule down its left.
function signTexture(w,h,lines,{rule=true}={}){
 return canvasTexture(w,h,(g)=>{g.fillStyle='#14181c';g.fillRect(0,0,w,h);if(rule){g.fillStyle='#f85800';g.fillRect(0,0,Math.round(w*.018),h);}
  let y=h*.12;for(const [text,size,colour,gap=.5] of lines){g.fillStyle=colour;g.font=`600 ${size}px "Archivo", sans-serif`;g.textBaseline='top';g.textAlign=rule?'left':'center';g.fillText(text,rule?w*.07:w/2,y);y+=size*(1+gap);}});
}

// A box's corners, with UVs in metres along each face (u across, v up), so the corrugation keeps its pitch on any size.
function box(w,h,d,x,y,z){
 const g=new T.BoxGeometry(w,h,d).translate(x,y,z),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
  uv.setXY(i,(nx>.5?p.getZ(i):p.getX(i))/.6,(ny>.5?p.getZ(i):p.getY(i))/HEIGHT);}
 return g;
}
// A box in a container's own axes: `a` along it, `c` across it.
const along=(axis,a0,a1,c0,c1,y0,y1)=>{[a0,a1]=[Math.min(a0,a1),Math.max(a0,a1)];return axis==='x'?box(a1-a0,y1-y0,c1-c0,(a0+a1)/2,(y0+y1)/2,(c0+c1)/2):box(c1-c0,y1-y0,a1-a0,(c0+c1)/2,(y0+y1)/2,(a0+a1)/2);};

// The maze in ship coordinates. `group` draws (with its deck band); `solid` holds plain boxes for the colliders.
export function createMazeHold(ship){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Container_maze';room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Container_maze_colliders';room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const corrugated=corrugation(),stripes=hazard();
 const paint=COLOURS.map((color,i)=>new T.MeshStandardMaterial({name:'Container_maze_paint_'+i,color,map:corrugated,roughness:.55,metalness:.25}));
 const M={steel:new T.MeshStandardMaterial({name:'Container_maze_steel',color:0x6c7579,roughness:.4,metalness:.65}),
  seam:new T.MeshStandardMaterial({name:'Container_maze_seam',color:0x1b2125,roughness:.8}),
  floor:new T.MeshStandardMaterial({name:'Container_maze_plywood',color:0x6b5038,roughness:.85}),
  label:new T.MeshStandardMaterial({name:'Container_maze_label',color:0xe9e4d6,roughness:.8}),
  hazard:new T.MeshStandardMaterial({name:'Container_maze_hazard',color:0xffffff,map:stripes,roughness:.6})};
 const parts=new Map(),put=(m,g)=>{if(!parts.has(m))parts.set(m,[]);parts.get(m).push(g);};
 const collider=(g,name)=>{const o=new T.Mesh(g);o.name=name;solid.add(o);};
 const random=rng(1151);
 // Door details on a container end at `a` (facing `s`, +1 or -1 along its axis), across c0..c1: the seam between the
 // two leaves, four locking bars and the header and sill.
 const doors=(axis,a,s,c0,c1)=>{const c=(c0+c1)/2,w=c1-c0,o=a+s*.012;
  put(M.seam,along(axis,o-.012,o+.012,c-.015,c+.015,.06,HEIGHT-.06));
  for(const f of [-.36,-.14,.14,.36])put(M.steel,along(axis,o-.015,o+.015,c+f*w-.022,c+f*w+.022,.12,HEIGHT-.12));
  for(const y of [.06,HEIGHT-.06])put(M.steel,along(axis,o-.015,o+.015,c0+.05,c1-.05,y-.05,y+.05));
 };
 // Corner castings at the eight corners of a container.
 const castings=(axis,a0,a1,c0,c1)=>{for(const a of [a0,a1])for(const c of [c0,c1])for(const y of [.09,HEIGHT-.09]){const da=a===a0?.09:-.09,dc=c===c0?.09:-.09;put(M.steel,along(axis,a+da-.1,a+da+.1,c+dc-.1,c+dc+.1,y-.1,y+.1));}};

 // The walls: each rectangle (layout.js) cut into containers of about 3 m, a hand's width apart, kept off the room's
 // own walls (the hold's name plate on the end wall stands 4 cm proud).
 for(const r of MAZE.walls){
  const axis=r.along,[a0,a1]=axis==='x'?[r.x0,Math.min(r.x1,END-.1)]:[Math.max(r.z0,-SIDE+.05),Math.min(r.z1,SIDE-.05)],[c0,c1]=axis==='x'?[r.z0,r.z1]:[r.x0,r.x1];
  collider(along(axis,a0,a1,c0+.02,c1-.02,0,HEIGHT),'Container_maze_wall_solid');
  const n=Math.max(1,Math.round((a1-a0)/3)),len=(a1-a0)/n;
  for(let k=0;k<n;k++){
   const b0=a0+k*len+(k?.03:0),b1=a0+(k+1)*len-(k<n-1?.03:0),m=paint[Math.floor(random()*paint.length)];
   put(m,along(axis,b0,b1,c0+.02,c1-.02,0,HEIGHT));doors(axis,b0,-1,c0+.02,c1-.02);doors(axis,b1,1,c0+.02,c1-.02);castings(axis,b0,b1,c0+.02,c1-.02);
   // A white data plate on each long side.
   const at=b0+(b1-b0)*(.25+random()*.5);for(const c of [c0+.012,c1-.012])put(M.label,along(axis,at-.22,at+.22,c-.012,c+.012,1.5,1.82));
  }
 }
 // Walk-through and walk-in containers: two sides and a roof (solid), a plywood floor, closed doors inside a dead end's
 // back, and at each open end the two leaves swung right round, flat against the containers either side.
 const T_=.08,HALF=WALL/2;
 for(const h of MAZE.hollows){
  const axis=h.along,c0=h.c-HALF,c1=h.c+HALF,m=paint[Math.floor(random()*paint.length)];
  for(const [s0,s1] of [[c0,c0+T_],[c1-T_,c1]]){const g=along(axis,h.a0,h.a1,s0,s1,0,HEIGHT);put(m,g);collider(g.clone(),'Container_maze_hollow_solid');}
  {const g=along(axis,h.a0,h.a1,c0,c1,HEIGHT-T_,HEIGHT);put(m,g);collider(g.clone(),'Container_maze_hollow_solid');}
  put(M.floor,along(axis,h.a0+.02,h.a1-.02,c0+T_,c1-T_,0,.03));
  castings(axis,h.a0,h.a1,c0,c1);
  h.open.forEach((isOpen,e)=>{const a=e?h.a1:h.a0,s=e?1:-1;
   if(!isOpen){const g=along(axis,a-s*T_,a,c0,c1,0,HEIGHT);put(m,g.clone());collider(g,'Container_maze_hollow_solid');doors(axis,a-s*T_,-s,c0+T_,c1-T_);return;}
   for(const side of [-1,1]){const hinge=side<0?c0:c1;put(m,along(axis,a+s*.02,a+s*.07,side<0?hinge-HALF:hinge,side<0?hinge:hinge+HALF,.05,HEIGHT-.05));}
  });
 }
 // The way in: a START header over the gap in the front row and a striped start line on the floor.
 const {z0:e0,z1:e1}=MAZE.entrance,ez=(e0+e1)/2;
 put(M.hazard,box(.32,.006,e1-e0,X0-.18,.003,ez));
 const header=new T.Mesh(new T.BoxGeometry(.14,.42,e1-e0+.3).translate(X0-.08,HEIGHT-.25,ez),new T.MeshStandardMaterial({name:'Container_maze_start',color:0xffffff,
  map:signTexture(512,96,[['START  ▸',54,'#f2c230',0]],{rule:false}),roughness:.6}));
 header.name='Container_maze_start_header';header.userData.noCollide=true;
 // The header's text only on the face toward the doorway: its other faces are plain dark.
 header.material=[header.material,...Array(5).fill(new T.MeshStandardMaterial({name:'Container_maze_header',color:0x14181c,roughness:.6}))];
 {const g=header.geometry,groups=g.groups;groups.forEach((q,i)=>{q.materialIndex=i===1?0:1;});}
 group.add(header);
 // The sign beside the way in, on the front row's face.
 const signAt={x:X0-.03,y:1.6,z:e1+2.6},sign=new T.Mesh(new T.PlaneGeometry(2.6,1.45),new T.MeshStandardMaterial({name:'Container_maze_sign',color:0xffffff,
  map:signTexture(1040,580,[['CONTAINER MAZE',92,'#f85800',.35],['Find the red button in the middle.',46,'#f4f0e8',.45],['The clock starts as you step in,',46,'#f4f0e8',.25],
   ['and stops when you press it.',46,'#f4f0e8',.6],['Fastest times: press E here',38,'#2fd6c5',.3]]),roughness:.7}));
 sign.name='Container_maze_sign';sign.position.set(signAt.x,signAt.y,signAt.z);sign.rotation.y=-Math.PI/2;sign.userData.noCollide=true;group.add(sign);
 // The middle: a chequered floor, and the console with its red button against the cell's closed side.
 const [gx0,gz0]=[cellX0(GOAL.i),cellZ0(GOAL.j)],floorMat=new T.MeshStandardMaterial({name:'Container_maze_finish_floor',color:0xffffff,map:checker(),roughness:.8});
 if(floorMat.map)floorMat.map.repeat.set(CELL_X/1.2,CELL_Z/1.2);
 const finish=new T.Mesh(new T.PlaneGeometry(CELL_X-.1,CELL_Z-.1).rotateX(-Math.PI/2),floorMat);finish.name='Container_maze_finish_floor';
 finish.position.set(gx0+CELL_X/2,.004,gz0+CELL_Z/2);finish.userData.noCollide=true;group.add(finish);
 const b=MAZE.button,yaw=Math.atan2(b.face[0],b.face[1]),console_=new T.Group();console_.name='Container_maze_console';
 console_.position.set(b.x,0,b.z);console_.rotation.y=yaw;group.add(console_);
 const piece=(name,g,m)=>{const o=new T.Mesh(g,m);o.name=name;console_.add(o);return o;};
 piece('Container_maze_console_body',new T.BoxGeometry(.7,.95,.5).translate(0,.475,0),M.hazard);
 piece('Container_maze_console_top',new T.BoxGeometry(.74,.06,.54).translate(0,.98,0),M.steel);
 piece('Container_maze_button_collar',new T.CylinderGeometry(.17,.17,.04,24).translate(0,1.03,.02),new T.MeshStandardMaterial({name:'Container_maze_collar',color:0xf2c230,roughness:.5}));
 const red=new T.MeshStandardMaterial({name:'Container_maze_red_button',color:0xd81e1e,emissive:0x8a0a0a,emissiveIntensity:.6,roughness:.3});
 const cap=piece('Container_maze_red_button',new T.SphereGeometry(.13,24,12,0,Math.PI*2,0,Math.PI/2).scale(1,.55,1),red);cap.position.set(0,1.05,.02);
 const plate=new T.Mesh(new T.PlaneGeometry(1.3,.42),new T.MeshStandardMaterial({name:'Container_maze_finish_sign',color:0xffffff,
  map:signTexture(620,200,[['PRESS TO STOP',62,'#f4f0e8',.15],['THE CLOCK',62,'#f2c230',0]],{rule:false}),roughness:.7}));
 plate.name='Container_maze_finish_sign';plate.position.set(0,1.75,-.27);plate.userData.noCollide=true;console_.add(plate);
 collider(new T.BoxGeometry(.74,1.0,.54).applyMatrix4(new T.Matrix4().compose(new T.Vector3(b.x,.5,b.z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw),new T.Vector3(1,1,1))),'Container_maze_console_solid');
 for(const [m,gs] of parts){const o=new T.Mesh(mergeGeometries(gs),m);o.name=m.name;o.userData.noCollide=true;group.add(o);gs.forEach(g=>g.dispose());}
 group.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});
 solid.traverse(o=>{if(o.isMesh)o.visible=false;});

 group.updateMatrix();const toRoom=new T.Matrix4().copy(group.matrix).invert(),local=new T.Vector3();
 let pressed=-1;
 return {
  group,solid,
  // A ship point in the room's frame, its y from the hold's floor.
  toLocal(p){return local.copy(p).applyMatrix4(toRoom);},
  // A room point in ship coordinates.
  toShip(x,y,z){return new T.Vector3(x,y,z).applyMatrix4(group.matrix);},
  // What E reaches here: the red button, or the sign's best times.
  near(p){const q=this.toLocal(p);if(Math.abs(q.y)>1.5)return null;
   if(Math.hypot(q.x-b.x,q.z-b.z)<REACH)return 'button';
   if(Math.hypot(q.x-signAt.x,q.z-signAt.z)<SIGN_REACH&&q.x<X0)return 'sign';
   return null;},
  press(now){pressed=now;},
  // The button goes down and comes back up after a press.
  update(now){const t=pressed<0?1:(now-pressed)/300;cap.position.y=1.05-(t<1?Math.sin(t*Math.PI)*.045:0);},
 };
}
