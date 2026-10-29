import {roomObject} from '../plan/rooms.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Young explorers on Deck 16 as a kitten playroom. Its green play furniture (activity tables, low benches and play blocks)
// goes, and all six play rugs become kitten habitats: carpeted climbing trees, step towers a visitor can climb too, a
// crinkle tunnel, cushion dens with teepees, cardboard boxes and ball-track toys, with fifteen Cosmo kittens at play
// among balls, toy mice, yarn and feather wands. The kittens are the Cosmo kit's baked kitten poses (cosmo-pose.js
// KITTEN_POSES) at a third of his size, sharing their meshes; each gets its own fur and hoodie colour.
// Room frame (Area_d16-childcare-6): rugs 9 x 8 m centred at x -16, -3, 10 and z -9, 9; the entrance at x -26 (|z|<2),
// the service counter at x 18..24, z 10.4..11.6, the ceiling at 3.3 m. Wall shelves sit beyond the rugs, clear of the aisles.
const ROOM='Area_d16-childcare-6',FLOOR=.035,KITTEN=.3;
export const KITTEN_POSE_NAMES=['sit','pounce','bat'];
const OLD=/^(Activity_table|Low_bench|Play_block)$/;

// Take the room's green play furniture out before the colliders and rest spots are found. Returns false if the room is
// missing.
export function stripPlayFurniture(ship){
 const room=roomObject(ship,ROOM);if(!room)return false;
 const old=[];room.traverse(o=>{if(o.isMesh&&OLD.test(o.name))old.push(o);});
 for(const o of old){o.removeFromParent();o.geometry.dispose();}
 return true;
}

// Fur is the body texture's flat blue; the hoodie is near black and the shorts orange in the clothes texture.
function recolour(material,name,code){
 const m=material.clone();m.name=name;
 m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+code);};
 m.customProgramCacheKey=()=>name;
 return m;
}
const glsl=c=>{c=new T.Color(c);return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`;};
const fur=c=>`{vec3 c=diffuseColor.rgb;float f=smoothstep(.08,.2,c.b-max(c.r,c.g));diffuseColor.rgb=mix(c,${glsl(c)}*clamp(c.b/.63,.35,1.1),f);}`;
const hoodie=c=>`{vec3 c=diffuseColor.rgb;float shorts=step(.12,c.r-c.b);diffuseColor.rgb=mix(${glsl(c)}*(.75+c.g*2.),c,shorts);}`;

// The kittens' looks, fur and hoodie colours (the first is Cosmo's own); each look's recoloured materials are shared.
const LOOKS=[[null,null],[0xd8873f,0x7ad6b0],[0x8c8f99,0xf29ac0],[0xeadcc0,0x8a6ad8],[0x3b3a42,0xf6c945],[0xf4efe6,0x3d8be0]];
const dressed=LOOKS.map(([f,h],i)=>{const body=new Map();return o=>{
 if(f===null)return o.material;
 const key=o.material.name;if(!body.has(key))body.set(key,key==='body'?recolour(o.material,'Kitten_fur_'+i,fur(f)):key==='clothes'?recolour(o.material,'Kitten_hoodie_'+i,hoodie(h)):o.material);
 return body.get(key);};});
// One of the Cosmo kit's posed kittens (shared meshes) at a third of his size, in one of the LOOKS; also used on the
// arrival hall's cat tree (arrival-atrium.js).
export function kittenFigure(kit,pose,look){
 const g=kit.figure(pose);g.name='Kitten_'+pose;g.scale.setScalar(KITTEN);
 for(const m of g.children)m.material=dressed[look](m);
 return g;
}

export function createKittens(ship,kit){
 const room=roomObject(ship,ROOM);if(!room)return null;kit||={figure:()=>new T.Group()};
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Young_explorers_kittens';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Young_explorers_kitten_colliders';
 room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Kitten_'+name,color,roughness:.8,...o});
 const M={carpet:mat('carpet',0xc9b79a,{roughness:1}),carpet2:mat('carpet_rose',0xd99a9a,{roughness:1}),post:mat('sisal',0xb59a6a,{roughness:1}),
  tunnel:mat('tunnel',0x6a4fb0,{roughness:.55,side:T.DoubleSide}),rim:mat('tunnel_rim',0xf2c14e,{roughness:.6}),cushion:mat('cushion',0x4fa3a5,{roughness:.95}),
  cushion2:mat('cushion_coral',0xf08a6c,{roughness:.95}),canvas:mat('teepee',0xf1e6cf,{roughness:.9}),pole:mat('teepee_pole',0x8a6a45),
  red:mat('ball_red',0xe8473c,{roughness:.45}),yellow:mat('ball_yellow',0xf6c945,{roughness:.45}),blue:mat('ball_blue',0x3d8be0,{roughness:.45}),
  yarn:mat('yarn',0xff6fb0,{roughness:1}),yarn2:mat('yarn_lime',0xb6e05a,{roughness:1}),card:mat('cardboard',0xb88a55,{roughness:.9}),
  carpet3:mat('carpet_teal',0x8fc4bf,{roughness:1}),track:mat('ball_track',0xf2efe6,{roughness:.5}),mouse:mat('toy_mouse',0x9a9aa2,{roughness:.9}),feather:mat('feather',0x5ad1c9,{roughness:.8}),
  wood:mat('shelf_wood',0xc48b52,{roughness:.65}),bracket:mat('shelf_bracket',0x54565d,{metalness:.5,roughness:.45})};
 const parts=new Map();
 const piece=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g.index?g.toNonIndexed():g);};
 const at=(g,x,y,z,ry=0)=>g.rotateY(ry).translate(x,y,z);
 const block=([w,h,d],[x,y,z],ry=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d));o.position.set(x,y,z);o.rotation.y=ry;solid.add(o);};
 const ball=(m,r,x,z)=>piece(m,new T.SphereGeometry(r,16,10).translate(x,FLOOR+r,z));

 // A climbing tree: a carpeted base and den box, three sisal posts and three platforms stepping up to 1.4 m.
 function tree(x,z){
  piece(M.carpet,new T.BoxGeometry(1.3,.08,1.1).translate(x,FLOOR+.04,z));
  piece(M.carpet2,new T.BoxGeometry(.6,.45,.55).translate(x-.3,FLOOR+.305,z+.2));
  piece(M.yellow,new T.CylinderGeometry(.13,.13,.02,20).rotateX(Math.PI/2).translate(x-.3,FLOOR+.3,z+.48));
  for(const [px,pz,h] of [[.35,-.3,1.4],[-.35,-.25,.95],[.3,.3,.6]])piece(M.post,new T.CylinderGeometry(.06,.06,h,12).translate(x+px,FLOOR+.08+h/2,z+pz));
  for(const [px,pz,h,r] of [[.35,-.3,1.4,.3],[-.35,-.25,.95,.26],[.3,.3,.6,.24]])piece(M.carpet,new T.CylinderGeometry(r,r,.06,20).translate(x+px,FLOOR+.08+h+.03,z+pz));
  // A feather toy dangling from the top platform on a cord.
  piece(M.pole,new T.CylinderGeometry(.006,.006,.5,4).translate(x+.55,FLOOR+1.2,z-.3));
  piece(M.feather,new T.ConeGeometry(.04,.16,8).rotateX(Math.PI).translate(x+.55,FLOOR+.9,z-.3));
  block([1.3,1.5,1.1],[x,FLOOR+.75,z]);
 }
 // A crinkle tunnel: a half-buried tube with bright rims at both mouths, lying along x.
 function tunnel(x,z,len=2){
  const r=.28,y=FLOOR+r*.38;piece(M.tunnel,new T.CylinderGeometry(r,r,len,20,6,true,-Math.PI*.125,Math.PI*1.25).rotateZ(Math.PI/2).translate(x,y,z));
  for(const s of [-1,1])piece(M.rim,new T.TorusGeometry(r,.03,8,24,Math.PI*1.25).rotateZ(-Math.PI*.125).rotateY(Math.PI/2).translate(x+s*len/2,y,z));
  block([len,r*1.4,r*2.1],[x,FLOOR+r*.7,z]);
 }
 // A cushion den: a little teepee over a round cushion, and a second cushion beside it.
 function den(x,z){
  piece(M.cushion,new T.CylinderGeometry(.45,.48,.14,24).translate(x,FLOOR+.07,z));
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2,pole=new T.CylinderGeometry(.015,.015,1.45,6).translate(0,.72,0).rotateX(-.33).rotateY(a);piece(M.pole,pole.translate(x,FLOOR,z));}
  const tent=new T.ConeGeometry(.5,1.2,5,1,true,.3,Math.PI*1.6).translate(0,.6,0);piece(M.canvas,at(tent,x,FLOOR,z,0));
  piece(M.cushion2,new T.CylinderGeometry(.32,.34,.12,20).translate(x-.1,FLOOR+.06,z-1.05));
  block([1.1,1.25,1.1],[x,FLOOR+.62,z]);
 }
 // A toy mouse: a grey teardrop with a cord tail.
 function mouse(x,z,ry){
  piece(M.mouse,at(new T.SphereGeometry(.05,10,8).scale(1,.75,1.6),x,FLOOR+.035,z,ry));
  piece(M.pole,at(new T.CylinderGeometry(.004,.004,.14,4).rotateX(Math.PI/2).translate(0,.01,-.14),x,FLOOR+.01,z,ry));
 }

 // A step tower: a sisal trunk with a perch on top and three carpeted pads round it, stepping up 0.35 m at a time so a
 // visitor can climb it too. `a` turns the first, lowest pad; the rest follow a quarter turn apart, touching. Returns
 // the perch's top.
 function climber(x,z,a=0){
  const TRUNK=1.7,R=.7,PAD=.5,pads=[M.carpet,M.carpet2,M.carpet3];
  piece(M.post,new T.CylinderGeometry(.1,.12,TRUNK,14).translate(x,FLOOR+TRUNK/2,z));
  piece(M.carpet2,new T.CylinderGeometry(.3,.3,.06,20).translate(x,FLOOR+TRUNK+.03,z));
  block([.22,TRUNK,.22],[x,FLOOR+TRUNK/2,z]);
  for(let i=0;i<3;i++){
   const t=a+i*Math.PI/2,px=x+Math.cos(t)*R,pz=z+Math.sin(t)*R,top=.35*(i+1);
   piece(pads[i],new T.CylinderGeometry(PAD,PAD,.08,24).translate(px,FLOOR+top-.04,pz));
   piece(M.post,new T.CylinderGeometry(.05,.05,top-.08,10).translate(px,FLOOR+(top-.08)/2,pz));
   block([1,top,1],[px,FLOOR+top/2,pz],-t);
  }
  // A ball on a cord hanging from the perch over the open quarter, for batting.
  const hx=x+Math.cos(a-Math.PI/2)*.28,hz=z+Math.sin(a-Math.PI/2)*.28;
  piece(M.pole,new T.CylinderGeometry(.006,.006,.6,4).translate(hx,FLOOR+TRUNK-.3,hz));
  piece(M.red,new T.SphereGeometry(.05,12,8).translate(hx,FLOOR+TRUNK-.65,hz));
  return [x,FLOOR+TRUNK+.06,z];
 }
 // A ball-track toy: three stacked ring tracks round a post, a ball in each.
 function track(x,z){
  piece(M.track,new T.CylinderGeometry(.34,.36,.05,24).translate(x,FLOOR+.025,z));
  piece(M.track,new T.CylinderGeometry(.03,.03,.36,8).translate(x,FLOOR+.18,z));
  [M.red,M.yellow,M.blue].forEach((m,i)=>{const y=FLOOR+.09+i*.11,t=i*2.1,r=.26-i*.04;
   piece(M.track,new T.TorusGeometry(r,.035,8,28).rotateX(Math.PI/2).translate(x,y,z));
   piece(m,new T.SphereGeometry(.03,10,8).translate(x+Math.cos(t)*r,y+.02,z+Math.sin(t)*r));});
  block([.72,.36,.72],[x,FLOOR+.18,z]);
 }
 // An open cardboard box with its flaps folded out; a kitten often sits in it.
 function carton(x,z,ry=0){
  const W=.62,D=.48,H=.36,t=.015,g=[new T.BoxGeometry(W,t,D).translate(0,t/2,0)];
  for(const s of [-1,1]){g.push(new T.BoxGeometry(W,H,t).translate(0,H/2,s*D/2),new T.BoxGeometry(t,H,D).translate(s*W/2,H/2,0),
   new T.BoxGeometry(W,t,.22).translate(0,0,s*.11).rotateX(s*.5).translate(0,H,s*D/2));}
  for(const b of g)piece(M.card,at(b,x,FLOOR,z,ry));
  block([W+.1,H+.1,D+.1],[x,FLOOR+H/2,z],ry);
 }
 // A feather wand lying on the rug: a stick, a cord and the feather.
 function wand(x,z,ry){
  piece(M.pole,at(new T.CylinderGeometry(.008,.008,.7,6).rotateZ(Math.PI/2),x,FLOOR+.008,z,ry));
  piece(M.pole,at(new T.CylinderGeometry(.003,.003,.4,4).rotateZ(Math.PI/2).translate(.55,0,0),x,FLOOR+.004,z,ry));
  piece(M.feather,at(new T.ConeGeometry(.035,.14,8).rotateZ(Math.PI/2).translate(.82,0,0),x,FLOOR+.03,z,ry));
 }
 // A ball of yarn with a loose loop of thread.
 function yarn(m,x,z){
  piece(m,new T.SphereGeometry(.07,14,10).translate(x,FLOOR+.07,z));
  piece(m,new T.TorusGeometry(.12,.006,4,24,4).rotateX(Math.PI/2).translate(x-.12,FLOOR+.006,z-.2));
 }

 // Five wall-mounted steps rise and fall in 0.35 m increments. Their 1.2 m depth fits the walker's whole footprint;
 // the highest carpet is at 1.085 m, leaving a standing 2 m visitor clear of the unchanged 3.3 m ceiling.
 function shelves(x,side){
  const z=side*16.24,pads=[M.carpet2,M.carpet,M.carpet3,M.carpet,M.carpet2];
  for(let i=0;i<5;i++){
   const px=x+(i-2)*1.6,top=FLOOR+.35*(3-Math.abs(i-2));
   piece(M.wood,new T.BoxGeometry(1.8,.08,1.2).translate(px,top-.065,z));
   piece(pads[i],new T.BoxGeometry(1.76,.025,1.16).translate(px,top-.0125,z));
   for(const dx of [-.6,.6]){
    piece(M.bracket,new T.BoxGeometry(.08,.28,.04).translate(px+dx,top-.22,side*16.82));
    piece(M.bracket,new T.BoxGeometry(.08,.04,.95).translate(px+dx,top-.125,side*16.345));
   }
   block([1.8,.105,1.2],[px,top-.0525,z]);
   solid.children.at(-1).name='Kitten_wall_shelf';
  }
 }

 function kitten(pose,look,x,z,face,y=FLOOR){
  const g=kittenFigure(kit,pose,look);g.position.set(x,y,z);g.rotation.y=face;
  group.add(g);block([.3,.45,.3],[x,y+.22,z]);
  return g;
 }
 // A kitten sitting on a step tower's perch: dressing only, so it never blocks a climber.
 function perched(look,[x,y,z],face){const g=kittenFigure(kit,'sit',look);g.position.set(x,y,z);g.rotation.y=face;group.add(g);}

 // Rug A (-16,-9): the climbing tree on the +x side, two kittens squaring up to play-fight in the -z strip.
 tree(-16+3.1,-9+.6);
 kitten('bat',0,-16-.35,-9-2.9,Math.PI/2);kitten('bat',1,-16+.35,-9-2.9,-Math.PI/2);
 ball(M.blue,.06,-16-1.4,-9-3.3);mouse(-16+1.2,-9-3.4,.6);
 // Rug B (-3,-9): the tunnel along the -z strip, a kitten crouched at its mouth after a ball.
 tunnel(-3-1.2,-9-2.9);
 kitten('pounce',2,-3+1.55,-9-2.9,-Math.PI/2);ball(M.red,.07,-3+.65,-9-2.85);ball(M.yellow,.05,-3+2.9,-9-1.4);
 // Rug C (-16,9): the cushion den on the +x side, a kitten sitting with a ball of yarn in the -z strip, facing the aisle.
 den(-16+3.1,9+.4);
 kitten('sit',3,-16+.6,9-2.7,Math.PI+.35);
 piece(M.yarn,new T.SphereGeometry(.07,14,10).translate(-16+.52,FLOOR+.07,9-2.95));
 piece(M.yarn,new T.TorusGeometry(.12,.006,4,24,4).rotateX(Math.PI/2).translate(-16+.4,FLOOR+.006,9-3.15));
 mouse(-16-.8,9-3.2,2.2);

 // The rugs' freed middles: a step tower on every rug, a kitten on each perch looking toward the aisle.
 perched(4,climber(-16-1.6,-9+1.2,Math.PI*.5),0);
 perched(5,climber(-3+.4,-9+1,Math.PI),0);
 perched(1,climber(-16-1.5,9-.6,-Math.PI*.5),Math.PI);
 perched(2,climber(10+1.4,-9+.9,0),0);
 perched(3,climber(-3+.3,9-.4,Math.PI*.5),Math.PI);
 perched(0,climber(10-1.2,9-.4,-Math.PI),Math.PI);
 // Rug A: a ball track by the tower.
 track(-16+1.2,-9+2.8);
 // Rug B: a second climbing tree at -x, a kitten batting at a mouse beside it, and a feather wand.
 tree(-3-3.1,-9+.6);
 kitten('bat',4,-3-3.2,-9-1.1,0);mouse(-3-3.25,-9-.7,1.4);wand(-3+2.2,-9+2.6,.4);
 // Rug C: a ball track on the aisle side and a lime ball of yarn.
 track(-16-3.3,9-2.6);yarn(M.yarn2,-16+2,9-3.1);
 // Rug D: a climbing tree at +x, a kitten in a cardboard box, and two more squaring up over a ball.
 tree(10+3.1,-9-.4);
 carton(10-2.6,-9-2.4,.3);kitten('sit',5,10-2.6,-9-2.4,Math.PI*.15);
 kitten('bat',2,10-.5,-9-2.9,Math.PI/2);kitten('bat',3,10+.25,-9-2.9,-Math.PI/2);ball(M.yellow,.06,10-.12,-9-3.4);
 mouse(10-3.4,-9+2.6,-.8);wand(10-1,-9+3,2.6);
 // Rug E: a tunnel along the wall side with a kitten crouched at its mouth, and a cushion den at +x.
 tunnel(-3-1.6,9+2.9);kitten('pounce',1,-3+1.15,9+2.9,-Math.PI/2);ball(M.blue,.06,-3+.25,9+2.95);
 den(-3+3.1,9+.6);yarn(M.yarn,-3-3,9-2.8);
 // Rug F: a climbing tree at +x, a box, a ball track with a kitten crouched at it, and a toy mouse.
 tree(10+3.1,9+.8);
 carton(10-3.2,9+2.6,-.4);track(10+1.6,9-2.7);kitten('pounce',4,10+.5,9-2.9,Math.PI/2);
 mouse(10-3,9-3,2.6);ball(M.red,.07,10+2.9,9-2.4);

 // Three runs on each side wall, behind the six habitats and away from the entrance and service counter.
 for(const side of [-1,1])for(const x of [-16,-3,10])shelves(x,side);

 for(const [m,list] of parts){const o=new T.Mesh(mergeGeometries(list),m);o.name=m.name;o.castShadow=true;o.receiveShadow=true;group.add(o);}
 return {group,solid};
}
