import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture} from '../polish-kit.js';
import {fitLoungeEntrance} from './community-routes.js';
import layout from '../plan/selected-layout.js';

// The Deck 19 doorway frame: +z is plaza, -x is the painting side. Collision stays in that local frame.
export function createLoungeVipSeating(){
 const group=new T.Group();group.name='Lounge_VIP_seating';
 const solid=new T.Group();solid.name='Lounge_VIP_seating_solid';
 const gold=new T.MeshStandardMaterial({name:'VIP_seating_gold',color:0xdcb361,metalness:.78,roughness:.28});
 const velvet=new T.MeshPhysicalMaterial({name:'VIP_seating_velvet',color:0x45105e,roughness:.96,sheen:1,sheenColor:0xa052b8,sheenRoughness:.8});
 const cushion=new T.MeshPhysicalMaterial({name:'VIP_seating_cushions',color:0x732f89,roughness:1,sheen:1,sheenColor:0xcd88dc});
 const dark=new T.MeshStandardMaterial({name:'VIP_seating_planter',color:0x181323,roughness:.65,metalness:.25});
 const green=new T.MeshStandardMaterial({name:'VIP_seating_foliage',color:0x185739,roughness:.78,side:T.DoubleSide});
 const glow=(name,color)=>new T.MeshBasicMaterial({name,color,toneMapped:false});
 const rims=[glow('VIP_frond_pink',0xff58ba),glow('VIP_frond_purple',0xa562ff),glow('VIP_frond_green',0x65f6a0)];
 const warm=glow('VIP_candle_flame',0xffcf78),wax=new T.MeshStandardMaterial({name:'VIP_candle_wax',color:0xffe6b5,roughness:.85});
 const glass=new T.MeshStandardMaterial({name:'VIP_candle_glass',color:0xffe3b6,transparent:true,opacity:.3,roughness:.18,metalness:.1,depthWrite:false});
 const crystal=new T.MeshStandardMaterial({name:'VIP_chandelier_crystal',color:0xffe8ca,emissive:0xffd5a0,emissiveIntensity:.28,roughness:.12,metalness:.25});
 const marble=canvasTexture(512,512,(g,w,h)=>{
  g.fillStyle='#17141f';g.fillRect(0,0,w,h);
  for(let i=0;i<22;i++){g.beginPath();g.strokeStyle=i%3?'#8c7f9266':'#e1c8b999';g.lineWidth=i%3?.7:1.6;
   for(let y=0;y<=h;y+=4){const x=i*39-160+y*.42+16*Math.sin(y*.023+i)+5*Math.sin(y*.085+i*3);if(!y)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();}
 });
 const stone=new T.MeshStandardMaterial({name:'VIP_dark_veined_marble',map:marble,roughness:.28,metalness:.12});
 const batches=new Map(),add=(m,g)=>{if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);};
 const box=(m,s,p,r=0,soft=0)=>{const g=soft?new RoundedBoxGeometry(...s,2,soft):new T.BoxGeometry(...s);add(m,g.rotateY(r).translate(...p));};
 const tube=(m,points,r=.025)=>add(m,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,r,6,false));
 const proxy=(name,s,p,r=0)=>{const o=new T.Mesh(new T.BoxGeometry(...s));o.name=name;o.position.set(...p);o.rotation.y=r;o.userData.collisionOnly=true;solid.add(o);};
 const sofa=(x,z,width,yaw)=>{
  const p=(a,y,b)=>[x+Math.cos(yaw)*a+Math.sin(yaw)*b,y,z-Math.sin(yaw)*a+Math.cos(yaw)*b];
  const b=(m,s,a,y,c,soft=0)=>box(m,s,p(a,y,c),yaw,soft);
  b(gold,[width,.075,.98],0,.25,0,.025);
  b(velvet,[width-.1,.23,.94],0,.4,0,.09);
  b(velvet,[width,.43,.2],0,.525,-.4,.075);
  for(const side of [-1,1]){
   b(velvet,[.2,.33,.95],side*(width-.2)/2,.5,0,.07);
   for(const depth of [-.35,.35])b(gold,[.045,.23,.045],side*(width-.2)/2,.145,depth);
  }
  const seats=Math.round(width/1.1);
  for(let i=0;i<seats;i++)b(cushion,[(width-.46)/seats-.035,.12,.67],(i-(seats-1)/2)*(width-.46)/seats,.55,.07,.055);
  for(const side of [-1,1])b(cushion,[.38,.31,.18],side*(width/2-.48),.59,-.21,.065);
  proxy('VIP_sofa_collider',[width,.72,.98],[x,.39,z],yaw);
 };
 sofa(-5.4,.86,3.6,0);sofa(-8,2.85,2.65,Math.PI/2);
 const candles=[];
 for(const x of [-6.15,-3.85]){
  box(gold,[1.08,.055,.94],[x,.46,3]);box(stone,[1.12,.09,.98],[x,.53,3],0,.035);
  for(const a of [-.42,.42])for(const b of [-.34,.34])box(gold,[.045,.42,.045],[x+a,.25,3+b]);
  proxy('VIP_table_collider',[1.12,.55,.98],[x,.305,3]);
  candles.push([x-.23,.575,3],[x+.23,.575,3.13]);
 }

 // Keep the painting's centre bare and the whole canopy 1.2 m beyond the nearest post base.
 const plants=[[-8.35,.95,1.85],[-3.25,.95,1.7],[-8.65,4.8,1.55],[-3.35,4.55,1.45],[-7.8,5.2,1.2]];
 plants.forEach(([x,z,h],i)=>{
  add(dark,new T.CylinderGeometry(.29,.23,.5,12).translate(x,.28,z));
  add(gold,new T.TorusGeometry(.285,.018,5,20).rotateX(Math.PI/2).translate(x,.52,z));
  proxy('VIP_planter_collider',[.58,.53,.58],[x,.295,z]);
  tube(green,[[x,.52,z],[x+.04,h*.65,z],[x,h,z]],.035);
  for(let j=0;j<9;j++){
   const a=j*Math.PI*2/9+i*.7,reach=i%2?.53:.6,top=h*(.78+(j%3)*.1),pts=[];
   for(let k=0;k<=8;k++){const t=k/8;pts.push([x+Math.cos(a)*reach*t,top+.27*Math.sin(t*Math.PI)-.28*t,z+Math.sin(a)*reach*t]);}
   tube(green,pts,.014);
   if(j%3===0)tube(rims[(i+j/3)%3],pts,.02);
   // Paired tapered leaflets give both palms and lower ferns a full, feathered silhouette.
   for(let k=1;k<8;k++)for(const side of [-1,1]){
    const p=pts[k],len=(i%2?.22:.29)*Math.sin(k/8*Math.PI),dx=-Math.sin(a)*side*len,dz=Math.cos(a)*side*len;
    const vertices=[...p,p[0]+dx,p[1]-.06,p[2]+dz,...pts[k+1]];
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1],2));g.computeVertexNormals();add(green,g);
   }
  }
 });

 // The Deck 20 slab is overhead here. Hang below its real underside without adding a ceiling.
 const hanger=new T.Group();hanger.name='VIP_chandelier';group.add(hanger);
 const ceiling=layout.decks[19].y-.24-layout.decks[18].y;
 const rod=new T.CylinderGeometry(.035,.035,ceiling-3.4,10).translate(-5,(ceiling+3.4)/2,2.6);
 const cap=new T.CylinderGeometry(.16,.16,.045,16).translate(-5,ceiling-.0225,2.6);
 const support=new T.Mesh(mergeGeometries([rod,cap]),gold);support.name='VIP_chandelier_support';support.userData.noCollide=true;group.add(support);
 const crystals=[];
 for(let ring=0;ring<2;ring++){
  const radius=ring?.62:1.1,y=ring?3.4:3.55;
  add(gold,new T.TorusGeometry(radius,.026,6,40).rotateX(Math.PI/2).translate(-5,y,2.6));
  for(let j=0;j<(ring?16:24);j++){
   const a=j*Math.PI*2/(ring?16:24),x=-5+Math.cos(a)*radius,z=2.6+Math.sin(a)*radius;
   crystals.push([x,y-.15,z]);if(j%2===0)crystals.push([x,ring?3.2:3.27,z]);
  }
 }
 for(let j=0;j<8;j++){
  const a=j*Math.PI/4,x=-5+Math.cos(a)*1.1,z=2.6+Math.sin(a)*1.1;
  tube(gold,[[-5,3.55,2.6],[-5+Math.cos(a)*.5,3.38,2.6+Math.sin(a)*.5],[x,3.4,z],[x,3.48,z]],.027);
  candles.push([x,3.48,z]);
 }
 crystals.push([-5,3.2,2.6]);
 const instances=(name,g,m,points)=>{const o=new T.InstancedMesh(g,m,points.length);o.name=name;o.userData.noCollide=true;
  points.forEach((p,i)=>o.setMatrixAt(i,new T.Matrix4().makeTranslation(...p)));hanger.add(o);return o;};
 instances('VIP_crystal_drops',new T.OctahedronGeometry(.09).scale(.65,1.55,.65),crystal,crystals);
 instances('VIP_candle_bodies',new T.CylinderGeometry(.045,.045,.15,8).translate(0,.075,0),wax,candles);
 instances('VIP_candle_holders',new T.CylinderGeometry(.073,.073,.19,10,1,true).translate(0,.095,0),glass,candles);
 instances('VIP_candle_flames',new T.SphereGeometry(.034,8,6).scale(.75,1.8,.75).translate(0,.185,0),warm,candles);
 for(const [m,list] of batches){const o=new T.Mesh(mergeGeometries(list.map(g=>g.index?g.toNonIndexed():g)),m);o.name=m.name;o.userData.noCollide=true;group.add(o);}
 fitLoungeEntrance(group,19);return {group,solid};
}
