import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// The Deck 20 Captain's office on foot: a gold sword case stands in front of Orange Haze #15 (paintings.js), centred on
// it. A black lacquer plinth with gold bands carries a gold tray lined with red velvet, a sword resting on two small
// gold cradles, and a glass cover in a gold frame. A gold spotlight on the ceiling above points straight down at the
// sword; its lens, beam and the pool of light on the velvet are unlit materials, so it adds no lights.
// Room (Area_d20-captain-7, ship frame): x 39..67, z 9..33, floor y 36.3, ceiling 39.6; the painting's frames stand
// on the outboard wall (z 32.76) from x 48.9 to 57.1. The meeting table and its chairs end at x 51.6 and z 27, the two
// loose chairs stand at x 60-64, so the case at z 30.7 leaves 1.6 m to walk behind it and the room open in front.
const ROOM='Area_d20-captain-7';
const FLOOR=36.3,CEILING=39.6,AT={x:53,z:30.7};
// The plinth's top, the velvet's top, the glass cover's top; the case's footprint.
const PLINTH=.78,BED=.87,GLASS=1.14,L=1.6,D=.6;

// A soft warm oval: where the spotlight falls on the velvet.
function pool(){
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);
 r.addColorStop(0,'rgba(255,214,150,.3)');r.addColorStop(.6,'rgba(255,190,120,.1)');r.addColorStop(1,'rgba(255,180,110,0)');g.fillStyle=r;g.fillRect(0,0,128,128);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}

// The sword in its own frame: lying flat along +x, hilt toward -x, 1.2 m long, its centre line at the origin.
function sword(gold){
 const steel=new T.MeshStandardMaterial({name:'Sword_blade',color:0xe2e7ec,roughness:.18,metalness:.95});
 const leather=new T.MeshStandardMaterial({name:'Sword_grip',color:0x2b1a12,roughness:.8});
 const g=new T.Group();g.name='Sword';
 const add=(name,geo,material,at,rot)=>{const o=new T.Mesh(geo,material);o.name=name;o.position.set(...at);if(rot)o.rotation.set(...rot);g.add(o);return o;};
 // The blade: a long flat taper to the point, with a darker fuller down its middle.
 const outline=new T.Shape([new T.Vector2(-.33,-.026),new T.Vector2(.46,-.02),new T.Vector2(.57,0),new T.Vector2(.46,.02),new T.Vector2(-.33,.026)]);
 const blade=new T.ExtrudeGeometry(outline,{depth:.004,bevelEnabled:true,bevelThickness:.002,bevelSize:.003,bevelSegments:1});blade.rotateX(Math.PI/2);blade.translate(0,.002,0);
 add('Sword_blade',blade,steel,[0,0,0]);
 add('Sword_fuller',new T.BoxGeometry(.6,.002,.008),new T.MeshStandardMaterial({name:'Sword_fuller',color:0x8f979e,roughness:.3,metalness:.9}),[-.02,.0045,0]);
 // The cross-guard with round ends, the wrapped grip with gold wire rings, and the pommel.
 add('Sword_guard',new T.BoxGeometry(.035,.03,.26),gold,[-.345,0,0]);
 for(const s of [-1,1])add('Sword_guard_end',new T.SphereGeometry(.02,12,8),gold,[-.345,0,s*.13]);
 add('Sword_grip',new T.CylinderGeometry(.017,.019,.2,16),leather,[-.465,0,0],[0,0,Math.PI/2]);
 for(const x of [-.53,-.49,-.44,-.4])add('Sword_grip_wire',new T.TorusGeometry(.0185,.003,6,20),gold,[x,0,0],[0,Math.PI/2,0]);
 add('Sword_pommel',new T.SphereGeometry(.032,16,12),gold,[-.59,0,0]).scale.set(.8,1,1);
 return g;
}

export function createSwordCase(ship){
 if(!ship.root.getObjectByName(ROOM))return null;
 const gold=new T.MeshStandardMaterial({name:'Sword_case_gold',color:0xd4a33a,roughness:.3,metalness:.9});
 const lacquer=new T.MeshStandardMaterial({name:'Sword_case_lacquer',color:0x16110f,roughness:.35,metalness:.1});
 const velvet=new T.MeshStandardMaterial({name:'Sword_case_velvet',color:0x5e0812,emissive:0x2a0308,emissiveIntensity:.6,roughness:1});
 const glass=new T.MeshStandardMaterial({name:'Sword_case_glass',color:0xe8f4f6,roughness:.05,metalness:.1,transparent:true,opacity:.16,depthWrite:false});
 // The group stands at floor height so it joins Deck 20's band; its pieces are placed relative to the case's foot.
 const group=new T.Group();group.name='Sword_case';group.position.set(AT.x,FLOOR,AT.z);
 const add=(name,geo,material,at)=>{const o=new T.Mesh(geo,material);o.name=name;o.position.set(...at);group.add(o);return o;};
 const box=(name,size,material,at)=>add(name,new T.BoxGeometry(...size),material,at);
 // The plinth: a gold toe, a black body and a gold cap.
 box('Sword_case_plinth_toe',[1.5,.08,.5],gold,[0,.04,0]);
 box('Sword_case_plinth',[1.42,.64,.42],lacquer,[0,.4,0]);
 box('Sword_case_plinth_cap',[1.52,.06,.52],gold,[0,PLINTH-.03,0]);
 // The gold tray: a floor and four rims, lined with a padded velvet bed that sits 3 cm under the rim.
 box('Sword_case_tray',[L,.04,D],gold,[0,PLINTH+.02,0]);
 for(const s of [-1,1]){box('Sword_case_rim',[L,.12,.05],gold,[0,PLINTH+.06,s*(D-.05)/2]);box('Sword_case_rim',[.05,.12,D-.1],gold,[s*(L-.05)/2,PLINTH+.06,0]);}
 add('Sword_case_velvet',new RoundedBoxGeometry(L-.1,BED-PLINTH-.04,D-.1,2,.015),velvet,[0,(BED+PLINTH+.04)/2,0]);
 {const o=add('Sword_case_light_pool',new T.PlaneGeometry(1.36,.42),new T.MeshBasicMaterial({name:'Sword_case_light_pool',map:pool(),transparent:true,depthWrite:false,toneMapped:false}),[.02,BED+.002,0]);o.rotation.x=-Math.PI/2;}
 // The sword on two cradles, one under the blade and one under the grip.
 const y=BED+.024;
 for(const x of [.15,-.46])box('Sword_case_cradle',[.03,.016,.09],gold,[x,BED+.008,0]);
 const blade=sword(gold);blade.position.set(-.01,y,0);blade.rotation.y=.04;group.add(blade);
 // The glass cover, framed in gold at its edges.
 box('Sword_case_glass',[L-.04,GLASS-PLINTH-.12,D-.04],glass,[0,(GLASS+PLINTH+.12)/2,0]);
 const h=GLASS-PLINTH-.12,cy=(GLASS+PLINTH+.12)/2;
 for(const sx of [-1,1])for(const sz of [-1,1])box('Sword_case_glass_post',[.025,h,.025],gold,[sx*(L-.04)/2,cy,sz*(D-.04)/2]);
 for(const s of [-1,1]){box('Sword_case_glass_rail',[L-.015,.025,.025],gold,[0,GLASS,s*(D-.04)/2]);box('Sword_case_glass_rail',[.025,.025,D-.015],gold,[s*(L-.04)/2,GLASS,0]);}
 // The spotlight: a gold canopy and stem on the ceiling, and a gold can pointing straight down, its warm lens and a
 // faint beam spreading over the case.
 const top=CEILING-FLOOR;
 add('Sword_case_lamp_canopy',new T.CylinderGeometry(.08,.08,.03,24),gold,[0,top-.015,0]);
 add('Sword_case_lamp_stem',new T.CylinderGeometry(.012,.012,.1,10),gold,[0,top-.08,0]);
 add('Sword_case_lamp_knuckle',new T.SphereGeometry(.026,14,10),gold,[0,top-.13,0]);
 add('Sword_case_lamp_can',new T.CylinderGeometry(.06,.075,.2,24),gold,[0,top-.25,0]);
 add('Sword_case_lamp_lens',new T.CircleGeometry(.064,24),new T.MeshBasicMaterial({name:'Sword_case_lamp_lens',color:0xfff1c8,toneMapped:false}),[0,top-.351,0]).rotation.x=Math.PI/2;
 {const len=top-.352-GLASS,beam=new T.CylinderGeometry(.03,.3,len,32,1,true);beam.scale(2.5,1,1);
  add('Sword_case_lamp_beam',beam,new T.MeshBasicMaterial({name:'Sword_case_lamp_beam',color:0xffdc9a,transparent:true,opacity:.06,depthWrite:false,side:T.DoubleSide,toneMapped:false}),[0,GLASS+len/2,0]);}
 // Solid as one plain box, too tall to step onto.
 const solid=new T.Group();solid.name='Sword_case_colliders';
 {const o=new T.Mesh(new T.BoxGeometry(L+.02,GLASS+.02,D+.02));o.position.set(AT.x,FLOOR+(GLASS+.02)/2,AT.z);solid.add(o);}
 return {group,solid};
}
