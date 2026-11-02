import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture,seeded} from '../polish-kit.js';

// The selected Retro Voyage finish belongs to this room, never the shared
// V2 lining/floor materials used by the lounge, corridors or outer shell.
function finishes(){
 const terrazzo=canvasTexture(512,512,(c,w,h)=>{
  c.fillStyle='#c5bba9';c.fillRect(0,0,w,h);const r=seeded(2304);
  for(let i=0;i<2500;i++){const x=r()*w,y=r()*h,s=.7+r()*3;c.fillStyle=['#e4dccb','#ac9276','#7f817d','#ded0b8'][i%4];c.beginPath();c.moveTo(x,y);c.lineTo(x+s,y+r()*s);c.lineTo(x+s*.4,y+s);c.closePath();c.fill();}
 });
 const walnut=canvasTexture(512,256,(c,w,h)=>{
  c.fillStyle='#76523b';c.fillRect(0,0,w,h);const r=seeded(442);
  for(let i=0;i<350;i++){const y=r()*h;c.strokeStyle=i%3?'rgba(41,24,17,.15)':'rgba(231,183,121,.20)';c.lineWidth=.4+r()*1.2;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(w*.3,y+r()*8-4,w*.7,y+r()*10-5,w,y);c.stroke();}
 });
 const textile=canvasTexture(256,256,(c,w,h)=>{
  c.fillStyle='#c0642c';c.fillRect(0,0,w,h);
  for(let x=0;x<w;x+=8){c.fillStyle='#ad5024';c.fillRect(x,0,2,h);c.fillStyle='#cf773c';c.fillRect(x+3,0,2,h);}
  for(let y=0;y<h;y+=3){c.fillStyle='rgba(65,27,13,.13)';c.fillRect(0,y,w,1);}
 });
 const m=(name,color,options={})=>new T.MeshStandardMaterial({name:'Arrival_Retro_'+name,color,roughness:.7,...options});
 return {
  terrazzo:m('terrazzo',0xffffff,{map:terrazzo,roughness:.46}),
  walnut:m('walnut',0xffffff,{map:walnut,roughness:.6}),
  upholstery:m('burnt_orange_corduroy',0xffffff,{map:textile,roughness:.94}),
  porcelain:m('warm_porcelain',0xe8deca,{roughness:.55}),
  brass:m('brushed_brass',0xb99a5c,{metalness:.7,roughness:.37}),
  bronze:m('dark_bronze',0x504638,{metalness:.55,roughness:.48}),
  ceiling:m('twilight_ceiling',0x67747c,{roughness:.88}),
  seam:m('terrazzo_joint',0xa39a87,{roughness:.8}),
  amber:m('amber_diffuser',0xffd9a0,{emissive:0xffb75b,emissiveIntensity:1.7,roughness:.45}),
  teal:m('teal_guide',0x70c9c7,{emissive:0x38aaaa,emissiveIntensity:1.05,roughness:.5}),
  sky:m('twilight_oculus',0xa0bac2,{emissive:0x85b7d1,emissiveIntensity:.22,roughness:.9}),
 };
}

// Called after v2 shell replacement and room-frame resolution, before collision
// collection and the prepared-world bake. Only visual trim is added.
export function finishArrivalDesign(ship){
 const hall=ship.inside.getObjectByName('Area_d02-arrival-1');
 const shell=ship.inside.getObjectByName('V2_shell_d02-arrival-1');
 if(!hall||hall.userData.retroVoyage)return null;
 const M=finishes(),report={materials:0,trimMeshes:0,scope:'d02-arrival-1'},sided=new Map();
 const matchingSide=(material,side)=>{
  if(material.side===side)return material;
  const key=material.name+'|'+side;
  if(!sided.has(key)){const copy=material.clone();copy.name=material.name+'_side_'+side;copy.side=side;sided.set(key,copy);}
  return sided.get(key);
 };
 const planarUV=(o,scale=1)=>{
  const g=o.geometry=o.geometry.clone(),p=g.attributes.position,uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)/scale;uv[i*2+1]=p.getZ(i)/scale;}
  g.setAttribute('uv',new T.BufferAttribute(uv,2));
 };
 hall.traverse(o=>{
  if(!o.isMesh)return;
  const old=o.material?.name||'';let material;
  if(o.name==='Atrium_curved_seat')material=M.upholstery;
  else if(o.name==='Atrium_curved_back'||o.name==='Atrium_planter'||o.name==='Atrium_planter_rim'||o.name==='Atrium_seat_base')material=M.porcelain;
  else if(/Atrium_(trim|rim|lamp_frame)/.test(old))material=M.brass;
  else if(/Atrium_(wood|wood_dark|ceiling_slat)$/.test(old))material=M.walnut;
  else if(/Atrium_(ceiling|garden_ceiling)$/.test(old))material=M.ceiling;
  else if(/Atrium_(wall|cap|pot)$/.test(old))material=M.porcelain;
  else if(old==='Atrium_rug_sage')material=M.brass;
  else if(old==='Atrium_rug_cream')material=M.porcelain;
  else if(/Atrium_(light_strip|cove_glow|lamp_glow)$/.test(old))material=M.amber;
  else if(old==='Atrium_skylight_glow')material=M.sky;
  else if(old==='Atrium_floor'){material=M.terrazzo;planarUV(o,2);}
  else if(old==='Atrium_floor_seam')material=M.seam;
  if(material){o.material=matchingSide(material,o.material.side);report.materials++;}
 });
 shell?.traverse(o=>{
  if(!o.isMesh)return;
  if(o.name==='V2_room_floor'){o.material=M.terrazzo;planarUV(o,2);report.materials++;}
  else if(o.name==='V2_room_ceiling'){o.material=M.ceiling;report.materials++;}
  else if(o.material?.name==='V2_lining'){o.material=M.porcelain;report.materials++;}
 });
 const trim=new T.Group();trim.name='Arrival_Retro_visual_trim';trim.userData={noCollide:true,room:'d02-arrival-1'};hall.add(trim);
 const batches=new Map(),box=(name,material,size,at)=>{
  let b=batches.get(name);if(!b)batches.set(name,b={material,geometries:[]});
  b.geometries.push(new T.BoxGeometry(...size).translate(...at));
 };
 // Warm architectural light at the existing ceiling edges, with a restrained
 // cool guide close to the floor. Both stop before the circulation openings.
 for(const z of[-16.65,16.65]){
  box('Arrival_walnut_cove',M.walnut,[50.8,.18,.18],[0,3.12,z]);
  box('Arrival_amber_cove',M.amber,[50.6,.035,.055],[0,3.025,z-Math.sign(z)*.065]);
  for(const x of[-18,0,18])box('Arrival_teal_skirt',M.teal,[12,.025,.025],[x,.11,z-Math.sign(z)*.08]);
 }
 // Brass toe-kicks keep the furniture silhouette legible without enlarging
 // its collision footprint. The existing cushions and seats stay in place.
 for(const [x,z,r]of[[-13,-9.5,1.2],[-12.5,9.5,1.2],[13,-9.5,1.2],[13.5,9.5,1.2],[-2.5,2.2,2]]){
  const g=new T.CylinderGeometry(r+.743,r+.743,.055,64,1,true).translate(x,.045,z);
  let b=batches.get('Arrival_brass_toe_kick');if(!b)batches.set('Arrival_brass_toe_kick',b={material:M.brass,geometries:[]});b.geometries.push(g);
 }
 for(const [name,b]of batches){const o=new T.Mesh(mergeGeometries(b.geometries),b.material);o.name=name;o.userData.noCollide=true;trim.add(o);for(const g of b.geometries)g.dispose();report.trimMeshes++;}
 hall.userData.retroVoyage=report;return report;
}
