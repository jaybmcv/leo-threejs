import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Young explorers on Deck 16 gets three of its green play rugs dressed as kitten habitats, with four Cosmo kittens at
// play: a carpeted climbing tree where two kittens bat at each other, a crinkle tunnel with a kitten crouched to pounce
// on a ball, and a cushion den with a teepee where one sits with a ball of yarn. The kittens are the Cosmo kit's baked
// kitten poses (cosmo-pose.js KITTEN_POSES) at a third of his size, sharing their meshes; each gets its own fur and
// hoodie colour. Everything stays on the rugs, clear of the activity table, its benches and blocks, and the aisles.
// Room frame (Area_d16-childcare-6): rugs 9 x 8 m centred at x -16, -3, 10 and z -9, 9; on each, the table and benches
// fill |x|<1.6, |z|<1.9 and the play blocks x -3.3..-0.3 at z 2.4..3, so the free floor is the -z strip and the sides.
const ROOM='Area_d16-childcare-6',FLOOR=.035,KITTEN=.3;
export const KITTEN_POSE_NAMES=['sit','pounce','bat'];

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

export function createKittens(ship,kit){
 const room=ship.root.getObjectByName(ROOM);if(!room||!kit)return null;
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
  yarn:mat('yarn',0xff6fb0,{roughness:1}),mouse:mat('toy_mouse',0x9a9aa2,{roughness:.9}),feather:mat('feather',0x5ad1c9,{roughness:.8})};
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

 // The kittens: fur and hoodie colours, shared posed meshes.
 const looks=[[null,null],[0xd8873f,0x7ad6b0],[0x8c8f99,0xf29ac0],[0xeadcc0,0x8a6ad8]];
 const dressed=looks.map(([f,h],i)=>{const body=new Map();return o=>{
  if(f===null)return o.material;
  const key=o.material.name;if(!body.has(key))body.set(key,key==='body'?recolour(o.material,'Kitten_fur_'+i,fur(f)):key==='clothes'?recolour(o.material,'Kitten_hoodie_'+i,hoodie(h)):o.material);
  return body.get(key);};});
 function kitten(pose,look,x,z,face,y=FLOOR){
  const g=kit.figure(pose);g.name='Kitten_'+pose;g.scale.setScalar(KITTEN);g.position.set(x,y,z);g.rotation.y=face;
  for(const m of g.children)m.material=dressed[look](m);
  group.add(g);block([.3,.45,.3],[x,y+.22,z]);
  return g;
 }

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

 for(const [m,list] of parts){const o=new T.Mesh(mergeGeometries(list),m);o.name=m.name;o.castShadow=true;o.receiveShadow=true;group.add(o);}
 return {group,solid};
}
