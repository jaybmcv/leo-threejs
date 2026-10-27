import * as T from 'three';
import {roomObject} from '../plan/rooms.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ARENA_ID,TRIGGERS,PODIUMS,STAGE,COUNTER,VAULT,STANDEE,STANDEES,FLOOR_COIN,WALL_COINS,GALLERY,PACK_FOILS} from '../mudwater-arena.js';

// Mudwater Arena on Deck 16 (MUDWATER_ARENA.md): the game's link and the pack counter's card for the walk, the
// hologram cards on the stage board turning slowly, and the brand kit's art on the room. E at the match screen, or on
// the board in front of either podium, opens Mudwater's own game page in a new tab; E at the pack counter shows the
// giveaway card (walk.html's #mudwater-sheet). The holograms leave the room for a group of their own before the ship
// is merged, so they can turn.
// The art (src/walk/art/mudwater-*, captured from the Mudwater Community Brand Kit, hashed into the build by
// scripts/walk-page.mjs) is drawn on thin panels in front of the room's own surfaces, loaded once a walker comes within
// NEAR metres: the badge wordmark over the end wall's name, the base wordmark on the pack counter, the skull medallion
// on the vault door, the primary skull on the podiums, the pack on the standees and the packs on the counter, the gold
// coin in the floor and either side of the screen, the rope frame round every gallery card, and the medallion in each
// hologram.
// Where a panel stands in for the room's own lettering or handle, that piece is hidden, but only when its art exists.
// Outside, the door gets a brass surround and the badge goes on the arena's outer wall beside it, and a third pack
// standee faces the door from across the corridor, so the arena is seen before it is entered.
export const GAME_URL='https://mudwater.bayc.com/game/';
export const MUDWATER_ART=['mudwater-badge.png','mudwater-wordmark.png','mudwater-skull.png','mudwater-medallion.png','mudwater-pack.jpg','mudwater-cartouche.png','mudwater-coin-gold.png'];
const REACH=1.3,SPIN=.25,BOB=.03,NEAR=45;
// The entrance from the side corridor, in room coordinates: the door's corridor face (x −26, opening z −2…2, 2.8 m
// high, the entry header above it) and, across the 7 m corridor, its far wall (x −33), where a pack standee faces the door
// (a little aft of it, clear of the service door on that wall).
const DOOR={x:-26.02,half:2,h:2.8},CORRIDOR_STANDEE=[-32.55,-1.2];
const LABEL={mudwater:'Play Mudwater',packs:'Booster packs'};

// One panel's geometry: a plane `w` by `h` centred on `at` (room coordinates), facing `normal`, turned `roll` about it.
function panel(w,h,at,normal,roll=0){
 const g=new T.PlaneGeometry(w,h);if(roll)g.rotateZ(roll);
 const o=new T.Object3D();o.position.set(...at);o.lookAt(o.position.clone().add(new T.Vector3(...normal)));o.updateMatrix();
 return g.applyMatrix4(o.matrix);
}

// `ship`: the walk's ship (its rooms still unmerged); `urls`: the build's art names (__ART_URLS__).
export function createMudwater(ship,{urls={},anisotropy=1}={}){
 const room=roomObject(ship,ARENA_ID);if(!room)return null;
 room.updateMatrixWorld(true);
 const origin=room.getWorldPosition(new T.Vector3());
 const spots=TRIGGERS.map(t=>({kind:t.kind,at:room.localToWorld(new T.Vector3(...t.at))}));
 // (The group stands at the room's floor height, so it is drawn with that deck's band: main.js toBand. Its children
 // are in room coordinates.)
 const group=new T.Group();group.name='Mudwater_arena_walk';room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const cards=[];
 room.traverse(o=>{if(o.name==='Mudwater_hologram')cards.push(o);});
 for(const o of cards){const p=room.worldToLocal(o.getWorldPosition(new T.Vector3())),q=room.getWorldQuaternion(new T.Quaternion()).invert().multiply(o.getWorldQuaternion(new T.Quaternion()));
  o.removeFromParent();group.add(o);o.position.copy(p);o.quaternion.copy(q);o.userData.base={y:o.position.y,yaw:new T.Euler().setFromQuaternion(q,'YXZ').y};}

 // The corridor entrance: a brass surround on the door's corridor face and a pack standee across the corridor, solid as
 // plain boxes (main.js adds them to the colliders). Nothing narrows the 4 m opening or lowers its 2.8 m head.
 const solid=new T.Group();solid.name='Mudwater_entrance';group.add(solid);
 const black=new T.MeshStandardMaterial({name:'Mudwater_entrance_black',color:0x080806,roughness:.72}),brass=new T.MeshStandardMaterial({name:'Mudwater_entrance_brass',color:0xaea35d,metalness:.75,roughness:.32});
 const block=(name,size,at,m)=>{const o=new T.Mesh(new T.BoxGeometry(...size),m);o.name=name;o.position.set(...at);solid.add(o);return o;};
 for(const s of [-1,1])block('Mudwater_door_pilaster',[.1,DOOR.h+.05,.26],[DOOR.x-.05,(DOOR.h+.05)/2,s*(DOOR.half+.13)],brass);
 block('Mudwater_door_lintel',[.1,.14,2*DOOR.half+.52],[DOOR.x-.05,DOOR.h+.07,0],brass);
 {const [x,z]=CORRIDOR_STANDEE,{w,h,base}=STANDEE;
  block('Mudwater_corridor_standee',[.06,h,w],[x,base+h/2,z],black);block('Mudwater_corridor_standee_base',[.5,base,w+.1],[x,base/2,z],black);
  for(const s of [-1,1])block('Mudwater_corridor_standee_trim',[.08,h+.04,.03],[x,base+h/2,z+s*(w/2+.015)],brass);}
 group.updateMatrixWorld(true);

 // The brand art. Each texture's panels are merged into one mesh, hidden until the texture arrives.
 const art=new Map(),pieces=[];
 const dress=(file,geos,{opaque=false,glow=false,cut=.04,metal=.35,rough=.42}={})=>{
  if(!urls[file])return false;
  const material=glow?new T.MeshBasicMaterial({name:'Mudwater_art_'+file,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,opacity:.85})
   :new T.MeshStandardMaterial({name:'Mudwater_art_'+file,transparent:!opaque,alphaTest:opaque?0:cut,roughness:opaque?.55:rough,metalness:opaque?.1:metal,polygonOffset:true,polygonOffsetFactor:-2});
  const mesh=new T.Mesh(mergeGeometries(geos),material);mesh.name='Mudwater_brand_art';mesh.visible=false;group.add(mesh);
  if(!art.has(file))art.set(file,[]);art.get(file).push(mesh);return true;
 };
 const hide=test=>room.traverse(o=>{if(o.isMesh&&test(o))o.visible=false;});
 // The badge wordmark over the end wall's name, which it replaces.
 // (And one on the arena's outer wall beside the door, under its window, facing walkers coming down the corridor: the
 // corridor's ceiling hides the header over the door.)
 if(dress('mudwater-badge.png',[panel(3.6,3.6*147/543,[25.62,2.72,0],[-1,0,0]),panel(2.2,2.2*147/543,[DOOR.x-.01,.55,5.6],[-1,0,0])]))hide(o=>o.name==='Wayfinding_text'&&o.position.x>25);
 // The base wordmark on the pack counter's face, in place of its lettering.
 const front=COUNTER.z+.56;
 if(dress('mudwater-wordmark.png',[panel(2.4,2.4*100/527,[COUNTER.x,.7,front+.03],[0,0,1])]))hide(o=>o.name==='Wayfinding_text'&&Math.abs(o.position.z-front)<.1);
 // The skull medallion on the vault door, in place of its handle.
 if(dress('mudwater-medallion.png',[panel(VAULT.r*1.9,VAULT.r*1.9,[VAULT.x,VAULT.y,VAULT.z+.08],[0,0,1])]))hide(o=>o.name==='Vault_door_handle');
 // The primary skull on both long faces of each podium, toward the spectators.
 dress('mudwater-skull.png',PODIUMS.flatMap(x=>[-1,1].map(s=>panel(.62,.62*255/285,[x,STAGE.h+.55,s*.765],[0,0,s]))));
 // The pack on both faces of each standee, and on every pack fanned on the counter.
 if(dress('mudwater-pack.jpg',[
  ...[...STANDEES,CORRIDOR_STANDEE].flatMap(([x,z])=>[-1,1].map(s=>panel(STANDEE.w*.96,STANDEE.h*.96,[x+s*.032,STANDEE.base+STANDEE.h/2,z],[s,0,0]))),
  ...PACK_FOILS.map(({at:[x,y,z],turn})=>{const n=[Math.sin(turn),0,Math.cos(turn)];return panel(.15,.24,[x+n[0]*.016,y,z+n[2]*.016],n);}),
 ],{opaque:true}))hide(o=>o.name==='Pack_foil_logo_art');
 // The gold coin set in the floor inside the door, upright to a walker coming in, and either side of the screen.
 const floorCoin=new T.PlaneGeometry(FLOOR_COIN.r*2,FLOOR_COIN.r*2).rotateX(-Math.PI/2).rotateY(-Math.PI/2).translate(FLOOR_COIN.x,.022,FLOOR_COIN.z);
 // (Matte: the coin's art is already shaded, and the floor one would mirror the bright ceiling.)
 dress('mudwater-coin-gold.png',[floorCoin,...WALL_COINS.map(z=>panel(1.5,1.5,[25.7,1.35,z],[-1,0,0]))],{metal:0,rough:1});
 // The rope frame round every gallery card, 7 cm out from it: the bake (render-bake.js) steps each of the card art's
 // merged colours out a few millimetres from the next, so the art can stand well proud of its nominal face. (The
 // frame's fine lines thin out as the texture shrinks, so it keeps more of their edge.)
 dress('mudwater-cartouche.png',GALLERY.map(({p:[x,y,z],face,axis})=>panel(.7,1.0,axis==='x'?[x+face*.07,y,z]:[x,y,z+face*.07],axis==='x'?[face,0,0]:[0,0,face])),{cut:.005});
 // The medallion glowing in each hologram card, front and back.
 if(urls['mudwater-medallion.png'])for(const o of cards){
  const m=new T.Mesh(mergeGeometries([panel(.72,.72,[0,0,.02],[0,0,1]),panel(.72,.72,[0,0,-.02],[0,0,-1])]),
   new T.MeshBasicMaterial({name:'Mudwater_hologram_art',transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.9}));
  m.name='Mudwater_hologram_art';m.visible=false;o.add(m);
  art.get('mudwater-medallion.png').push(m);
 }

 let t=0,loading=false;const centre=origin.clone();
 return {
  group,spots,
  // The entrance's solid parts, for the colliders.
  solid,
  update(dt){t+=dt;cards.forEach((o,i)=>{const b=o.userData.base;o.rotation.set(0,b.yaw+t*SPIN*(i%2?-1:1),0);o.position.y=b.y+Math.sin(t*1.3+i*1.7)*BOB;});},
  // Called with the walker's position a few times a second: load the art once a walker is near.
  load(at){
   if(loading||!art.size||centre.distanceTo(at)>NEAR)return;loading=true;
   for(const [file,meshes] of art)new T.TextureLoader().load(urls[file],tex=>{tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=anisotropy;
    for(const m of meshes){m.material.map=tex;m.material.needsUpdate=true;m.visible=true;}});
  },
  // Whether a point (a walker's feet) is inside the arena.
  contains(p){const {x,y,z}=room.worldToLocal(p.clone());return Math.abs(x)<26&&Math.abs(z)<17&&y>-.5&&y<3;},
  // The giveaway card's wordmark, once its art exists.
  wordmark:urls['mudwater-wordmark.png']||null,
  // The use prompt: the nearest trigger within reach, on its own floor.
  near(p){
   let best=null,bd=REACH;
   for(const s of spots){if(Math.abs(p.y-s.at.y)>1.2)continue;const d=Math.hypot(p.x-s.at.x,p.z-s.at.z);if(d<bd){bd=d;best=s;}}
   return best?{kind:best.kind,label:LABEL[best.kind]}:null;
  },
  play(){window.open(GAME_URL,'_blank','noopener');},
 };
}
