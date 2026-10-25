import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Communal dining on Deck 16 gets three serving robots: a white column with three dark trays behind it, a violet glow
// round its base, a tuxedo painted down its front and a cat-eared screen for a head showing a Mars Cats face (heavy
// lids, a sideways smirk, tabby stripes). They stand at fixed spots so every visitor sees the same room: one greeting
// at the entrance, two among the tables. The screens and glow are baked into unlit materials, so they add no lights.
// Room frame (Area_d16-dining-7): the entrance at x=-25.92 (doorway |z|<2), the main aisle |z|<2, tables at
// x -17, -6, 5, 16 and z ±5, ±10 with chairs out to 1.7 m in x, and the buffet counter along z=15.
const ROOM='Area_d16-dining-7';
// [x, z, the point it faces]
export const ROBOT_SPOTS=[[-22.6,3.4,[-25,0]],[-.4,7.5,[-4,6]],[10.5,-7.5,[14,-6]]];

function canvasTexture(w,h,paint){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
// The face: Mars-orange line art on a dark screen, eyes half shut under flat lids for the Mars Cats' unbothered look.
function face(g,w,h){
 const bg=g.createRadialGradient(w/2,h/2,10,w/2,h/2,w*.6);bg.addColorStop(0,'#14233a');bg.addColorStop(1,'#060a12');g.fillStyle=bg;g.fillRect(0,0,w,h);
 g.lineCap='round';g.lineJoin='round';g.shadowColor='#ff7a2a';g.shadowBlur=18;
 // Tabby stripes on the forehead.
 g.strokeStyle='#ff9a4d';g.lineWidth=9;
 for(const [x,l] of [[-40,34],[0,44],[40,34]]){g.beginPath();g.moveTo(w/2+x,28);g.lineTo(w/2+x*.8,28+l);g.stroke();}
 for(const s of [-1,1]){
  const cx=w/2+s*118,cy=h*.47;
  // Iris, then the lid cut flat across it, tilted down toward the nose.
  g.save();g.beginPath();g.moveTo(cx-66,cy+6+14*s);g.lineTo(cx+66,cy+6-14*s);g.lineTo(cx+70,cy+70);g.lineTo(cx-70,cy+70);g.closePath();g.clip();
  g.fillStyle='#ffd27a';g.beginPath();g.ellipse(cx,cy+8,58,40,0,0,Math.PI*2);g.fill();
  g.fillStyle='#0a0f18';g.beginPath();g.ellipse(cx+s*-10,cy+16,13,28,0,0,Math.PI*2);g.fill();
  g.restore();
  g.strokeStyle='#ff8a3d';g.lineWidth=10;g.beginPath();g.moveTo(cx-66,cy+6+14*s);g.lineTo(cx+66,cy+6-14*s);g.stroke();
  // Whiskers.
  g.lineWidth=5;for(const k of [-1,0,1]){g.beginPath();g.moveTo(w/2+s*70,h*.78+k*14);g.lineTo(w/2+s*(190+Math.abs(k)*10),h*.76+k*30);g.stroke();}
 }
 // Nose and a lopsided smirk.
 g.fillStyle='#ff8fb3';g.beginPath();g.moveTo(w/2-16,h*.7);g.lineTo(w/2+16,h*.7);g.lineTo(w/2,h*.7+16);g.closePath();g.fill();
 g.strokeStyle='#ff8a3d';g.lineWidth=8;g.beginPath();g.moveTo(w/2,h*.7+16);g.quadraticCurveTo(w/2-10,h*.86,w/2-34,h*.82);g.moveTo(w/2,h*.7+16);g.quadraticCurveTo(w/2+18,h*.9,w/2+52,h*.8);g.stroke();
}
// The tuxedo: black lapels over a white shirt front, a bow tie and three studs. The rest is clear.
function tuxedo(g,w,h){
 g.fillStyle='#14151a';
 for(const s of [-1,1]){const x=v=>w/2+s*v;g.beginPath();g.moveTo(x(18),h*.1);g.lineTo(x(w*.5),h*.06);g.lineTo(x(w*.5),h*.8);g.lineTo(x(10),h*.92);g.lineTo(x(56),h*.42);g.closePath();g.fill();}
 g.beginPath();g.moveTo(w/2,h*.12);g.lineTo(w/2-46,h*.05);g.lineTo(w/2-46,h*.19);g.closePath();g.moveTo(w/2,h*.12);g.lineTo(w/2+46,h*.05);g.lineTo(w/2+46,h*.19);g.closePath();g.fill();
 g.beginPath();g.arc(w/2,h*.12,11,0,Math.PI*2);g.fill();
 for(const y of [.3,.42,.54]){g.beginPath();g.arc(w/2,h*y,8,0,Math.PI*2);g.fill();}
}

// One robot in its own frame: feet at the origin, facing +z, 1.8 m to the ear tips.
function robot(){
 const white=new T.MeshStandardMaterial({name:'Dining_robot_shell',color:0xf2f0ea,roughness:.3});
 const dark=new T.MeshStandardMaterial({name:'Dining_robot_dark',color:0x1b1e24,roughness:.35,metalness:.2});
 const tray=new T.MeshStandardMaterial({name:'Dining_robot_tray',color:0x5a2a2e,roughness:.9});
 const glow=new T.MeshBasicMaterial({name:'Dining_robot_glow',color:0xa77bff,toneMapped:false,side:T.DoubleSide});
 const g=new T.Group();g.name='Dining_robot';
 const add=(name,geo,material,at,rot)=>{const o=new T.Mesh(geo,material);o.name=name;o.position.set(...at);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 // The drive base with its glow band.
 add('Dining_robot_base',new T.CylinderGeometry(.3,.33,.17,32),white,[0,.085,0]);
 add('Dining_robot_glow',new T.CylinderGeometry(.31,.31,.05,32,1,true),glow,[0,.195,0]).castShadow=false;
 add('Dining_robot_deck',new T.CylinderGeometry(.28,.3,.06,32),white,[0,.25,0]);
 // Three trays behind the front column, carried on two dark posts at the back.
 for(const y of [.52,.8,1.08]){add('Dining_robot_tray',new T.CylinderGeometry(.27,.27,.035,32),dark,[0,y,-.04]);add('Dining_robot_tray_mat',new T.CylinderGeometry(.24,.24,.01,32),tray,[0,y+.022,-.04]);}
 for(const s of [-1,1])add('Dining_robot_post',new T.CylinderGeometry(.025,.025,.95,10),dark,[s*.17,.75,-.24]);
 // The column runs up the front to the head.
 const column=new T.CapsuleGeometry(.13,.92,6,20);column.scale(1,1,.45);
 add('Dining_robot_column',column,white,[0,.82,.2]);
 add('Dining_robot_tuxedo',new T.PlaneGeometry(.2,.46),new T.MeshStandardMaterial({name:'Dining_robot_tuxedo',map:canvasTexture(128,296,tuxedo),transparent:true,alphaTest:.5,roughness:.4,polygonOffset:true,polygonOffsetFactor:-2}),[0,.98,.262]);
 // The head: a dark rounded screen housing with two ears and a white chin.
 add('Dining_robot_head',new RoundedBoxGeometry(.52,.36,.2,4,.07),dark,[0,1.52,.14]);
 add('Dining_robot_chin',new T.CylinderGeometry(.07,.11,.1,16),white,[0,1.33,.18]);
 for(const s of [-1,1])add('Dining_robot_ear',new T.ConeGeometry(.08,.16,4),dark,[s*.18,1.75,.14],[0,Math.PI/4,-s*.25]);
 add('Dining_robot_screen',new T.PlaneGeometry(.44,.28),new T.MeshBasicMaterial({name:'Dining_robot_screen',map:canvasTexture(512,326,face),toneMapped:false}),[0,1.52,.242]).castShadow=false;
 return g;
}

export function createDiningRobots(ship){
 const room=ship.root.getObjectByName(ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Dining_robots';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Dining_robot_colliders';
 room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const model=robot();
 for(const [x,z,[fx,fz]] of ROBOT_SPOTS){
  const r=model.clone();r.position.set(x,0,z);r.rotation.y=Math.atan2(fx-x,fz-z);group.add(r);
  const o=new T.Mesh(new T.BoxGeometry(.66,1.8,.66));o.position.set(x,.9,z);o.rotation.y=r.rotation.y;solid.add(o);
 }
 return {group,solid};
}
