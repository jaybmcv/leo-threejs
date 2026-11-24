import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {paint,stem,clump,GREENS} from './foliage.js';
import {seeded} from '../polish-kit.js';
import layout from '../plan/selected-layout.js';
import {unanchorPoint} from '../plan/rooms.js';
import {contains} from '../plan/geometry-v2.js';

// Neighborhood 10 only, in the blossom garden's commons frame. The original slab stays intact.
export const ZEN_POND=[[116.5,20],[118,17],[123,16.8],[128,17.5],[133,17],[138,17.4],[144,17],[147,18.8],[147.5,21.8],[145,24],[139,24.5],[135,24],[133.5,26],[134,30],[132,33.8],[128,35],[123,34.5],[120,33.5],[117.5,31],[116,27]];
export const ZEN_BRIDGES=[{x:123,z0:14.5,z1:37,width:2.6,rise:.9},{x:131,z0:14.5,z1:35.5,width:2.6,rise:.85},{x:142,z0:14.5,z1:25,width:2.6,rise:.65}];
export const ZEN_BRIDGE=ZEN_BRIDGES[0];
const FLOOR=24.3,WATER=FLOOR+.3;
export const ZEN_GROUND=layout.rooms.find(r=>r.id==='commons-10').polygon.map(([x,z])=>{const p=unanchorPoint('commons-10',[x,FLOOR,z]);return [p[0],p[2]];});
const shapeOf=ring=>{const s=new T.Shape();ring.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();return s;};
const pondGeometry=(height,base)=>new T.ExtrudeGeometry(shapeOf(ZEN_POND),{depth:height,bevelEnabled:false,steps:1,curveSegments:1}).rotateX(-Math.PI/2).translate(0,base,0);

export function createZenGarden(koiGeometry){
 const group=new T.Group(),solid=new T.Group();group.name='Zen_garden';solid.name='Zen_garden_colliders';
 const rnd=seeded(417),pieces=[],wood=[],glows=[],pose=new T.Object3D();
 const mat=new T.MeshStandardMaterial({name:'Zen_stone_and_planting',vertexColors:true,roughness:.92,flatShading:true});
 const timber=new T.MeshStandardMaterial({name:'Zen_bridge_oak',vertexColors:true,color:0xffffff,roughness:.75});
 const add=(name,g,material)=>{const o=new T.Mesh(g,material);o.name=name;o.receiveShadow=true;group.add(o);return o;};
 const box=(name,w,h,d,x,y,z,angle=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d));o.name=name;o.position.set(x,y,z);o.rotation.z=angle;solid.add(o);return o;};
 const rock=(x,y,z,sx,sy,sz)=>pieces.push(paint(new T.IcosahedronGeometry(1,0).scale(sx,sy,sz).rotateY(rnd()*6).translate(x,y,z),[0x7f867e,0x93988a,0x727c73][rnd()*3|0]));
 // Moss keeps its upper surface; buried undersides need no rendering geometry.
 const moss=(x,z,r,y=FLOOR+.015)=>{const g=new T.SphereGeometry(1,10,4).scale(r,.14,r*.8).translate(x,y,z);pieces.push(paint(new T.SphereGeometry(1,10,2,0,Math.PI*2,0,Math.PI/2).scale(r,.14,r*.8).translate(x,y,z),0x76915a));
  if(y<FLOOR+.1){const o=new T.Mesh(g.clone());o.name='Zen_moss_floor';solid.add(o);}};
 // A thin gravel finish, never a replacement slab. Skip rake lines hidden by the pond bed.
 add('Zen_gravel_floor',new T.ShapeGeometry(shapeOf(ZEN_GROUND)).rotateX(-Math.PI/2).translate(0,FLOOR+.018,0),new T.MeshStandardMaterial({name:'Zen_pale_gravel',color:0xc5bfaa,roughness:1}));
 const grooves=[];
 for(let r=2;r<34;r+=.5){const pts=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2,x=124+Math.cos(a)*r,z=26+Math.sin(a)*r*.7;pts.push([x,z]);}
  for(let i=0;i<pts.length-1;i++){const [x,z]=pts[i],[xx,zz]=pts[i+1];if(!contains(ZEN_GROUND,[x,z])||!contains(ZEN_GROUND,[xx,zz])||contains(ZEN_POND,[x,z])&&contains(ZEN_POND,[xx,zz]))continue;
   const l=Math.hypot(xx-x,zz-z);grooves.push(new T.PlaneGeometry(l+.008,.025).rotateX(-Math.PI/2).rotateY(-Math.atan2(zz-z,xx-x)).translate((x+xx)/2,FLOOR+.021,(z+zz)/2));}}
 add('Zen_raked_curves',mergeGeometries(grooves),new T.MeshStandardMaterial({name:'Zen_gravel_grooves',color:0x9fa18b,roughness:1}));grooves.forEach(g=>g.dispose());
 add('Zen_pond_bed',pondGeometry(.08,FLOOR+.02),new T.MeshStandardMaterial({name:'Zen_pond_pebbles',color:0x506e61,roughness:1}));
 const water=add('Zen_pond_water',new T.ShapeGeometry(shapeOf(ZEN_POND)).rotateX(-Math.PI/2).translate(0,WATER,0),new T.MeshStandardMaterial({name:'Zen_aqua_water',color:0x66c9bb,transparent:true,opacity:.48,depthWrite:false,roughness:.24,metalness:.05}));
 // Shallow water keeps the original floor. Low continuous edges can be stepped over in either direction.
 const pondWall=new T.Mesh(pondGeometry(.08,FLOOR));pondWall.name='Zen_pond_bed_floor';solid.add(pondWall);
 for(let e=0;e<ZEN_POND.length;e++){
  const [ax,az]=ZEN_POND[e],[bx,bz]=ZEN_POND[(e+1)%ZEN_POND.length],len=Math.hypot(bx-ax,bz-az),n=Math.ceil(len/.48);
  const edge=box('Zen_rim_floor',len+.3,.32,.5,(ax+bx)/2,FLOOR+.16,(az+bz)/2);edge.rotation.y=-Math.atan2(bz-az,bx-ax);
  for(let i=0;i<n;i++){const t=(i+.5)/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
   if(ZEN_BRIDGES.some(b=>Math.abs(x-b.x)<1.5&&z>b.z0&&z<b.z1))continue;
   rock(x,FLOOR+.22,z,.3+rnd()*.18,.18,.28+rnd()*.13);if(i%3===0)moss(x,z,.4,FLOOR+.24);
  }
 }
 // Broad tiered falls face the balcony along -X, below the next gallery's underside.
 const tiers=[[128.5,3.05,2.05,4.8],[127.5,2.05,1.1,5.4],[126.5,1.1,.3,6]];
 const falling=new T.MeshStandardMaterial({name:'Zen_falling_water',color:0x9ae7db,emissive:0x235b53,emissiveIntensity:.18,transparent:true,opacity:.72,side:T.DoubleSide,roughness:.25,depthWrite:false});
 for(const [x,top,bottom,width] of tiers){
  for(const z of [-1,-.5,0,.5,1])rock(x+.35,FLOOR+top-.25,26+z*width*.43,.8,.55,.8);
  add('Zen_waterfall_tier',new T.PlaneGeometry(width,top-bottom).rotateY(-Math.PI/2).translate(x-.35,FLOOR+(top+bottom)/2,26),falling);
  box('Zen_waterfall_wall',1.4,top+.35,width+1,x+.3,FLOOR+(top+.35)/2,26);
 }
 const streaks=new T.InstancedMesh(new T.BoxGeometry(.025,.14,.035),new T.MeshBasicMaterial({name:'Zen_falls_glints',color:0xe2fff4}),30);streaks.name='Zen_falls_flow';streaks.frustumCulled=false;group.add(streaks);
 // A broad arched deck, continuous invisible rail panels, and visible timber posts and rails.
 const beam=(a,b,w,h)=>{const d=new T.Vector3().subVectors(b,a),g=new T.BoxGeometry(w,h,d.length()+.02);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),d.normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray());wood.push(paint(g,0x805234));};
 for(const B of ZEN_BRIDGES){
 const span=B.z1-B.z0,deck=z=>FLOOR+.045+B.rise*Math.sin(Math.PI*(z-B.z0)/span),N=Math.ceil(span/.3);
 for(let i=0;i<N;i++){
  const z=B.z0+(i+.5)*span/N,a=Math.atan2(deck(z+.01)-deck(z-.01),.02),g=new T.BoxGeometry(B.width,.09,span/N+.015).rotateX(-a).translate(B.x,deck(z)-.045,z);wood.push(paint(g,i%4?0x9a6c44:0xb18556));
  const plank=new T.Mesh(g.clone());plank.name='Zen_bridge_floor';solid.add(plank);
 }
 for(const side of [-1,1]){
  const x=B.x+side*(B.width/2+.05),rail=new T.Group();rail.name='Zen_bridge_rail';solid.add(rail);
  for(let i=0;i<24;i++){
   const za=B.z0+i*span/24,zb=B.z0+(i+1)*span/24,ya=deck(za),yb=deck(zb);
   for(const h of [.46,.96])beam(new T.Vector3(x,ya+h,za),new T.Vector3(x,yb+h,zb),.09,.09);
   const o=new T.Mesh(new T.BoxGeometry(.12,1.12,span/24+.03).rotateX(-Math.atan2(yb-ya,zb-za)).translate(x,(ya+yb)/2+.48,(za+zb)/2));o.name='Zen_bridge_rail_wall';rail.add(o);
  }
  for(let i=0;i<=8;i++){const z=B.z0+i*span/8;wood.push(paint(new T.BoxGeometry(.13,1.13,.13).translate(x,deck(z)+.47,z),0x68472f));}
 }
 }
 // Sculpted pines reuse the ship's low-poly foliage builder. Only their trunks obstruct walking.
 for(const [i,[x,z,h]] of [[112.5,24,2.6],[120,12.8,3.1],[135,13,2.8],[112,32,2.3],[151,24,3.2],[135.2,24.8,1.7],[145.5,25,1.9]].entries()){
  moss(x,z,1.7);pieces.push(stem([[x,FLOOR,z],[x+.35,FLOOR+h*.3,z-.2],[x-.28,FLOOR+h*.65,z+.18],[x+.12,FLOOR+h,z+.1]],.18,0x67503a,6));
  for(let k=0;k<3;k++){const a=k/3*Math.PI*2;pieces.push(stem([[x,FLOOR+.2,z],[x+Math.cos(a)*.7,FLOOR+.04,z+Math.sin(a)*.7]],.08,0x67503a,4));}
  for(let k=0;k<4;k++){const y=FLOOR+h*(.4+k*.16),side=(k%2?-.65:.65)*h/3;
   pieces.push(stem([[x,y-.25,z],[x+side,y,z+.15]],.08,0x67503a,5));clump(pieces,[x+side,y,z+.15],{r:(1.3-k*.16)*h/3,rnd:seeded(417+i*11+k),leaves:0,detail:0,squash:.26,palette:[GREENS.dark,GREENS.mid,GREENS.bright]});}
  const trunk=new T.Mesh(new T.CylinderGeometry(.42,.42,h,6));trunk.name='Zen_pine_trunk';trunk.position.set(x,FLOOR+h/2,z);solid.add(trunk);
 }
 // Lanterns sit on the moss islands; no additional real lights or isolated collision gaps.
 for(const [x,z,rise=0] of [[113,24],[120.5,12.8],[135.5,13],[112.5,32],[151.5,24],[135.5,24.8],[145.8,25]]){
  const base=FLOOR+rise;moss(x,z,.75,base+.015);pieces.push(paint(new T.CylinderGeometry(.32,.42,.18,6).translate(x,base+.09,z),0x8d9487),paint(new T.CylinderGeometry(.12,.18,.48,6).translate(x,base+.4,z),0x8d9487));
  pieces.push(paint(new T.BoxGeometry(.48,.08,.48).translate(x,base+.67,z),0x9ba18e),paint(new T.ConeGeometry(.48,.28,4).rotateY(Math.PI/4).translate(x,base+1.13,z),0x747e70));
  for(const dx of [-.19,.19])for(const dz of [-.19,.19])pieces.push(paint(new T.BoxGeometry(.07,.32,.07).translate(x+dx,base+.86,z+dz),0x747e70));
  glows.push(new T.BoxGeometry(.3,.26,.3).translate(x,base+.84,z));box('Zen_lantern',.65,1.27,.65,x,base+.635,z);
 }
 for(const [x,z] of [[112,20],[125.8,12.5],[151,29],[115.5,35.5],[151,17]]){rock(x,FLOOR+.3,z,.6,.3,.5);rock(x+.5,FLOOR+.18,z+.35,.4,.18,.4);box('Zen_boulder',1.8,.6,1.5,x+.2,FLOOR+.3,z+.15);moss(x,z,1.2);}
 // Broad stone approaches join both banks, the cherry planter and the cafe aisle.
 for(const [x,z,sx,sz] of [[115.5,12,3,1.6],[151,20,2,3],[112,29,1.5,4],[145,12,3,1.4]])pieces.push(paint(new T.CircleGeometry(1,12).rotateX(-Math.PI/2).scale(sx,1,sz).translate(x,FLOOR+.023,z),0x76915a));
 const paths=[];
 const path=(x,z,w,d)=>paths.push(new T.PlaneGeometry(w,d).rotateX(-Math.PI/2).translate(x,FLOOR+.026,z));
 path(125,13.8,25,1.5);path(124,36,24,1.4);path(114,20,1.6,12);path(135.2,32,1.6,12);path(141,37.2,12,1.5);path(141,24.9,5,1.3);path(144.5,20,1.4,11);path(150,25,1.5,29);
 add('Zen_stone_paths',mergeGeometries(paths),new T.MeshStandardMaterial({name:'Zen_path_stone',color:0xb4b7a7,roughness:1}));paths.forEach(g=>g.dispose());
 // Lily pads share one geometry and material; all remain clear of the bridge decks.
 for(const [x,z,r] of [[118,23,.35],[119,29,.42],[125,19,.4],[129,32,.45],[134,21,.38],[139,19,.35],[145,21,.4],[125,32,.3]]){
  pieces.push(paint(new T.CircleGeometry(r,9).rotateX(-Math.PI/2).translate(x,WATER+.008,z),0x59845c));
 }
 add('Zen_rocks_moss_and_pines',mergeGeometries(pieces),mat).castShadow=true;pieces.forEach(g=>g.dispose());
 add('Zen_wooden_bridge',mergeGeometries(wood),timber).castShadow=true;wood.forEach(g=>g.dispose());
 add('Zen_lantern_glow',mergeGeometries(glows),new T.MeshBasicMaterial({name:'Zen_warm_lantern',color:0xffd18b,toneMapped:false}));glows.forEach(g=>g.dispose());
 const koi=new T.InstancedMesh(koiGeometry(),new T.MeshStandardMaterial({name:'Zen_koi',vertexColors:true,roughness:.5,side:T.DoubleSide}),24);koi.name='Zen_koi';koi.frustumCulled=false;group.add(koi);
 const rings=new T.InstancedMesh(new T.RingGeometry(.9,1,32).rotateX(-Math.PI/2),new T.MeshBasicMaterial({name:'Zen_water_ripples',color:0xc2f7e6,transparent:true,opacity:.24,depthWrite:false}),4);rings.name='Zen_pond_ripples';rings.frustumCulled=false;group.add(rings);
 const swims=[[120.5,25.5,2.5,5.5],[128,20,2,1.5],[139.8,20.7,5.1,1.6],[126,32.5,3.2,.7]];
 group.traverse(o=>{o.userData.noCollide=true;});
 let time=0;
 function update(dt){
  time+=Math.min(dt,.1);water.material.opacity=.48+Math.sin(time*.6)*.025;
  for(let i=0;i<koi.count;i++){const [cx,cz,rx,rz]=swims[i%swims.length],a=time*(.065+i*.002)+i*2.4;pose.position.set(cx+Math.cos(a)*rx,WATER-.1,cz+Math.sin(a)*rz);pose.rotation.set(0,Math.atan2(-rx*Math.sin(a),rz*Math.cos(a))+Math.sin(time*3+i)*.08,0);pose.scale.setScalar(1.8);pose.updateMatrix();koi.setMatrixAt(i,pose.matrix);}
  for(let i=0;i<30;i++){const [x,top,bottom,width]=tiers[i%3],f=(time*(.65+i*.003)+i*.31)%1;pose.position.set(x-.37,FLOOR+top-(top-bottom)*f,26+Math.sin(i*9)*width*.43);pose.rotation.set(0,0,0);pose.scale.set(1,.7+f,1);pose.updateMatrix();streaks.setMatrixAt(i,pose.matrix);}
  for(let i=0;i<4;i++){const r=.3+((time*.2+i*.25)%1)*1.3;pose.position.set(125.8-i*.3,WATER+.008,26+(i%2-.5)*1.4);pose.scale.set(r,1,r);pose.updateMatrix();rings.setMatrixAt(i,pose.matrix);}
  koi.instanceMatrix.needsUpdate=streaks.instanceMatrix.needsUpdate=rings.instanceMatrix.needsUpdate=true;
 }
 update(0);return {group,solid,update};
}
