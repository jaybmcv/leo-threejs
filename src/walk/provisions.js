import {roomObject} from '../plan/rooms.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Deck 3's Refrigerated provisions, dressed as a cold room on foot: the shared locker cabinets go, and stainless
// fridges and freezers line the side walls and the back wall's corners (clear of the room title), wire shelving
// stocked with cardboard boxes flanks the centre aisle, a clipboard lies on the pickup counter and a clear PVC strip
// curtain hangs in the doorway. The strips part round anyone walking through them, so the doorway stays passable.
// Room frame (Area_d03-cold-6): the title end at +x, the entrance at x=-25.92 (doorway |z|<2, 2.8 m high), side walls'
// faces at |z|=16.84, the pickup counter at x -23.5..-16.5, z 3.4..4.6, the main aisle between the amber lines at |z|<2.
const ROOM='Area_d03-cold-6';
const SIDE=16.84,BACK=25.84,ENTRY=-25.84,DOOR=2,RAIL=2.78;
const OLD=/^(Insulated_storage|Cabinet_door|Status_display|Refined_cabinet_hardware|Refined_display_graphics|Polish_instrument_bezel)$/;

function rng(seed){return ()=>(seed=(seed*16807)%2147483647)/2147483647;}

// Take the room's old cabinets out before the colliders are built. Returns false if the room is missing.
export function stripProvisions(ship){
 const room=roomObject(ship,ROOM);if(!room)return false;
 const old=[];room.traverse(o=>{if(o.isMesh&&OLD.test(o.name))old.push(o);});
 for(const o of old){o.removeFromParent();o.geometry.dispose();}
 return true;
}

// The new fittings, in ship coordinates. `group` draws (with its deck band), `solid` holds plain boxes for the
// colliders, and update() parts the curtain round nearby walkers.
export function createProvisions(ship){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Provisions_cold_room';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Provisions_colliders';
 room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Provisions_'+name,color,roughness:.35,...o});
 const M={steel:mat('steel',0xc4ccd0,{metalness:.75,roughness:.28}),panel:mat('door',0xd8dee1,{metalness:.6,roughness:.22}),
  dark:mat('dark',0x22282c,{roughness:.6}),grille:mat('grille',0x6e777c,{metalness:.5}),wire:mat('wire',0x9aa5aa,{metalness:.7,roughness:.4}),
  card:mat('cardboard',0xb88a55,{roughness:.9}),card2:mat('cardboard_dark',0x9c7040,{roughness:.9}),tape:mat('tape',0xd9c79a,{roughness:.5}),
  label:mat('label',0xf2efe6,{roughness:.8}),board:mat('clipboard',0x6b4a2c,{roughness:.6}),paper:mat('paper',0xfaf8f2,{roughness:.9}),
  cold:new T.MeshBasicMaterial({name:'Provisions_fridge_readout',color:0x7fe3ff,toneMapped:false}),
  frost:new T.MeshBasicMaterial({name:'Provisions_freezer_readout',color:0x9ab8ff,toneMapped:false})};
 const parts=new Map();
 const piece=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g);};
 // A box in the room frame, turned `ry` about a pivot at (px,pz).
 const box=(m,[w,h,d],[x,y,z],ry=0,px=0,pz=0)=>piece(m,new T.BoxGeometry(w,h,d).translate(x,y,z).rotateY(ry).translate(px,0,pz));
 const block=([w,h,d],[x,y,z],ry=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d));o.position.set(x,y,z);o.rotation.y=ry;solid.add(o);};

 // An upright reach-in unit on castors, its front facing +z in its own frame: three doors for a fridge, two for a
 // freezer, a louvred kick grille and a readout in the header.
 const W=2.05,H=2.15,D=.82;
 function unit(x,z,ry,freezer){
  const doors=freezer?2:3,dw=(W-.12)/doors,f=(m,s,p)=>box(m,s,p,ry,x,z);
  f(M.steel,[W,H-.42,D-.04],[0,.42+(H-.42)/2,0]);
  f(M.steel,[W,.08,D],[0,H-.04,0]);
  for(let i=0;i<doors;i++){
   const cx=-W/2+.06+dw*(i+.5);
   f(M.panel,[dw-.03,H-.72,.04],[cx,.5+(H-.72)/2,D/2]);
   f(M.dark,[.05,.42,.06],[cx+(i<doors/2?1:-1)*(dw/2-.16),1.25,D/2+.05]);
  }
  f(M.dark,[W-.1,.16,.02],[0,H-.17,D/2-.01]);
  f(freezer?M.frost:M.cold,[.22,.07,.01],[W/2-.3,H-.17,D/2+.005]);
  f(M.steel,[W,.3,D-.1],[0,.27,0]);
  for(let j=0;j<4;j++)f(M.grille,[W-.2,.025,.02],[0,.16+j*.065,D/2-.04]);
  for(const sx of [-1,1])for(const sz of [-1,1])f(M.dark,[.09,.12,.09],[sx*(W/2-.12),.06,sz*(D/2-.14)]);
  block([W,H,D],[x,H/2,z],ry);
 }
 // Side walls: units face the aisle, from just inside the doorway to the back wall.
 let k=0;
 for(const s of [-1,1])for(let x=-23.6;x+W/2<=BACK-D-.15;x+=W+.1)unit(x,s*(SIDE-D/2-.06),s>0?Math.PI:0,(k++)%3===2);
 // Back wall: three either side of the title panel (|z|<7), facing the doorway.
 for(const s of [-1,1])for(const z of [9.2,11.35,13.5])unit(BACK-D/2-.06,s*z,-Math.PI/2,z===11.35);

 // Wire shelving, four levels, in two runs flanking the centre aisle with gaps to cross between them.
 const r=rng(101),L=4.6,SD=1.1,SH=2.1;
 function shelving(x,z){
  for(const sx of [-1,1])for(const sz of [-1,1])box(M.wire,[.05,SH,.05],[x+sx*(L/2-.03),SH/2,z+sz*(SD/2-.03)]);
  for(let level=0;level<4;level++){
   const y=.18+level*.62;
   box(M.wire,[L,.03,SD],[x,y,z]);
   for(const sz of [-1,1])box(M.wire,[L,.04,.02],[x,y+.03,z+sz*(SD/2-.01)]);
   // Cardboard boxes: a row along each face of the shelf, a few gaps, the odd smaller one stacked on top.
   for(const side of [-1,1]){
    let bx=x-L/2+.08;
    for(;;){
     const w=.38+r()*.3,h=.24+r()*.22,d=.4+r()*.08;if(bx+w>x+L/2-.06)break;
     if(r()<.12){bx+=w*.6;continue;}
     const cx=bx+w/2,cz=z+side*(SD/4),m=r()<.4?M.card2:M.card;
     box(m,[w,h,d],[cx,y+.015+h/2,cz]);
     box(M.tape,[.07,.004,d+.004],[cx,y+.017+h,cz]);
     if(r()<.55)box(M.label,[.14,.1,.004],[cx-w*.18,y+.015+h*.55,cz+side*(d/2+.002)]);
     if(level<3&&h<.34&&r()<.35){const w2=w*.7,h2=.18;box(m===M.card?M.card2:M.card,[w2,h2,d*.8],[cx,y+.015+h+h2/2,cz]);}
     bx+=w+.04;
    }
   }
  }
  block([L,SH,SD],[x,SH/2,z]);
 }
 for(const z of [-7,7])for(const x of [-10,-3.8,2.4,8.6,14.8])shelving(x,z);

 // The clipboard on the pickup counter (its top at y=0.98), with a pen beside it.
 {const cx=-19.2,cz=3.75,ry=.25,y=.98,f=(m,s,p)=>box(m,s,[p[0],p[1],p[2]],ry,cx,cz);
  f(M.board,[.24,.012,.33],[0,y+.006,0]);
  f(M.paper,[.21,.004,.27],[0,y+.014,.015]);
  for(let j=0;j<6;j++)f(M.dark,[.15-(j%3)*.03,.001,.006],[-.01,y+.0165,-.06+j*.035]);
  f(M.steel,[.11,.02,.05],[0,y+.02,-.14]);
  piece(M.dark,new T.CylinderGeometry(.006,.006,.15,8).rotateX(Math.PI/2).rotateY(-.4).translate(cx+.2,y+.006,cz+.05));}

 for(const [m,gs] of parts){const o=new T.Mesh(mergeGeometries(gs),m);o.name=m.name;o.receiveShadow=true;group.add(o);gs.forEach(g=>g.dispose());}

 // The strip curtain: overlapping clear strips on a steel rail just inside the doorway. Each strip's lower part
 // swings aside from a walker near it; its top stays on the rail.
 const CX=ENTRY+.12,SW=.22,STEP=.18,ROWS=6,strips=[];
 {const g=new T.BoxGeometry(.08,.08,2*DOOR+.2).translate(CX,RAIL+.04,0),o=new T.Mesh(g,M.steel);o.name='Provisions_curtain_rail';group.add(o);}
 const pos=[],idx=[];
 for(let z=-DOOR+SW/2,i=0;z<=DOOR-SW/2+.001;z+=STEP,i++){
  const x=CX+(i%2?.012:-.012),base=pos.length/3;strips.push({z,x,base,swing:0});
  for(let j=0;j<=ROWS;j++){const y=RAIL-j*RAIL/ROWS;pos.push(x,y,z-SW/2,x,y,z+SW/2);}
  for(let j=0;j<ROWS;j++){const a=base+j*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
 }
 const cg=new T.BufferGeometry();cg.setAttribute('position',new T.Float32BufferAttribute(pos,3));cg.setIndex(idx);cg.computeVertexNormals();
 const base=cg.attributes.position.array.slice();
 const pvc=new T.MeshStandardMaterial({name:'Provisions_strip_curtain',color:0xcfe6ee,roughness:.12,metalness:0,transparent:true,opacity:.32,depthWrite:false,side:T.DoubleSide});
 const curtain=new T.Mesh(cg,pvc);curtain.name='Provisions_strip_curtain';curtain.userData.noCollide=true;curtain.frustumCulled=false;group.add(curtain);
 group.updateMatrixWorld(true);
 const toRoom=group.matrixWorld.clone().invert(),local=new T.Vector3();
 let moving=true;
 // Bodies are world positions (feet). A strip within reach of one swings its foot away, sideways and through.
 function update(dt,bodies){
  const near=[];
  for(const b of bodies){local.copy(b).applyMatrix4(toRoom);if(Math.abs(local.x-CX)<.9&&Math.abs(local.z)<DOOR+.6&&local.y>-.5&&local.y<2.5)near.push({x:local.x,z:local.z});}
  if(!near.length&&!moving)return;
  moving=false;const a=cg.attributes.position.array,ease=1-Math.exp(-dt*9);
  for(const s of strips){
   let tz=0,tx=0;
   for(const b of near){const dz=s.z-b.z,reach=.55-Math.abs(dz);if(reach<=0)continue;const push=reach*Math.max(0,1-Math.abs(b.x-CX)/.9);tz+=Math.sign(dz||1)*push;tx+=(b.x<CX?1:-1)*push*.6;}
   s.swing+=(tz-s.swing)*ease;s.lean=(s.lean||0)+(tx-(s.lean||0))*ease;
   if(Math.abs(s.swing)>.002||Math.abs(s.lean)>.002)moving=true;
   for(let j=0;j<=ROWS;j++){const t=j/ROWS,w=t*t,i=(s.base+j*2)*3;
    for(const v of [0,3]){a[i+v]=base[i+v]+s.lean*w;a[i+v+2]=base[i+v+2]+s.swing*w;}}
  }
  cg.attributes.position.needsUpdate=true;
 }
 return {group,solid,update};
}
