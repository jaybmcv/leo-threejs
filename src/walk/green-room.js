import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {frame,toWorld} from '../plan/rooms.js';
import {GREEN_ROOM_ID} from '../plan/room-names-v2.js';
import {makeGreenRoomPrints,makeStageLoop} from './green-room-art.js';

const PI=Math.PI,side=-PI/2,end=PI;
const matte=(color,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const neon=color=>new T.MeshBasicMaterial({color,toneMapped:false});

export function createGreenRoom({still=false}={}){
 const group=new T.Group(),f=frame(GREEN_ROOM_ID);
 group.name='Green_Room';group.position.set(...toWorld(GREEN_ROOM_ID,[0,0,0]));group.rotation.y=f.yaw;
 const stage=makeStageLoop(),{map,tiles}=makeGreenRoomPrints(),ink=new T.MeshBasicMaterial({map,toneMapped:false});
 const black=matte(0x161722,.39,.28),brass=matte(0xba9855,.36,.57),mint=neon(0x8dffcf),rose=neon(0xff77be);
 const batches=new Map();
 function put(geometry,mat,at,yaw=0){
  const list=batches.get(mat)||[];if(!list.length)batches.set(mat,list);
  list.push(geometry.rotateY(yaw).translate(...at));
 }
 const box=(s,at,mat=black,yaw=0)=>put(new T.BoxGeometry(...s),mat,at,yaw);
 const cyl=(r,h,at,mat)=>put(new T.CylinderGeometry(r,r,h,12),mat,at);
 const ball=(s,at,mat)=>put(new T.SphereGeometry(1,8,5).scale(...s),mat,at);
 function print(id,w,h,at,yaw){
  const [x,y,tw,th]=tiles[id],geo=new T.PlaneGeometry(w,h),uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(x+.75+uv.getX(i)*(tw-1.5))/1024,1-(y+th-.75-uv.getY(i)*(th-1.5))/512);
  put(geo,ink,at,yaw);
 }
 const screen=new T.Mesh(new T.PlaneGeometry(23.22,2.85),new T.MeshBasicMaterial({map:stage.map,toneMapped:false}));
 screen.name='Green_room_stage_loop';screen.position.set(-25.805,1.79,0);screen.rotation.y=PI/2;group.add(screen);
 for(const y of [.323,3.257])box([.028,.022,23.39],[-25.794,y,0],mint);
 for(const [i,z] of [-13,-11.9,11.9,13].entries())print('disc'+i,.87,.95,[-25.927,1.91,z],PI/2);
 const leaf=matte(0x35795c),leafTip=matte(0x7ba065);
 for(const z of [-14,14])for(let i=0;i<9;i++){
  const a=i*2.39996,r=.13+i*.039,h=.63+(i%4)*.14,x=-24.25+r*Math.cos(a),zz=z+r*Math.sin(a);
  const blade=new T.SphereGeometry(1,7,4).scale(.13,.48-(i%3)*.05,.044).rotateZ((i%3-1)*.69);
  put(blade,i%3?leaf:leafTip,[x,h+.3,zz],a);
 }
 box([3.7,.64,.07],[-.25,3,-7.75]);
 for(const x of [-1.7,1.2])box([.027,.12,.027],[x,3.36,-7.75],brass);
 print('play',3.62,.58,[-.25,3,-7.791],end);
 print('bar',3.2,.92,[7.1,2.46,16.9],end);
 print('restroom',1.57,.51,[21,2.29,16.849],end);
 print('fridge',1.96,.48,[14.06,2.89,16.887],end);
 print('mural',4.9,1.58,[25.926,1.99,11.12],side);
 for(const [i,z] of [5.1,6.16,7.22].entries())print('poster'+i,.7,1.12,[25.923,2.18,z],side);
 // The kick drum head stays inside its round rim.
 print('drum',.53,.53,[21.566,.49,10.52],side);
 for(let i=0;i<26;i++)box([.053,.013,.26],[22.48,.999,12.49+i*.054],matteIvory);
 for(let i=0;i<25;i++)if(i%7!==2&&i%7!==6)box([.03,.021,.145],[22.54,1.009,12.516+i*.054]);
 for(const z of [6.04,7.42]){
  for(let i=0;i<5;i++)cyl(.022,.026,[24.11,.757,z-.33+i*.16],brass);
  box([.013,.024,.056],[24.061,.657,z+.42],mint);
 }
 // Vanity mirrors reflect the same baked environment as the ceiling.
 const mirror=matte(0x9193a6,.095,1);
 for(const z of [-9.13,-6.9,-4.67]){
  box([.06,1.38,1.43],[25.68,1.87,z],black);
  box([.021,1.24,1.29],[25.638,1.87,z],mirror);
  for(const s of [-1,1]){
   box([.022,1.33,.024],[25.62,1.87,z+s*.674],rose);
   box([.022,.024,1.37],[25.62,1.87+s*.665,z],rose);
  }
  cyl(.055,.25,[24.91,1.19,z+.39],brass);cyl(.049,.12,[24.89,1.13,z+.57],jade);
  box([.18,.052,.32],[24.87,1.094,z-.38],black);
 }
 const curtain=new T.MeshStandardMaterial({vertexColors:true,roughness:.3,metalness:.36,side:T.DoubleSide});
 for(const [bay,z] of [-.36,2.88].entries()){
  const g=new T.PlaneGeometry(2.76,2.71,48,1),p=g.attributes.position,colors=[];
  const a=new T.Color(bay?0x147f7b:0x8b2d79),b=new T.Color(bay?0x57d5bd:0xe987be);
  for(let i=0;i<p.count;i++){
   const t=(p.getX(i)+1.38)/2.76,fold=Math.sin(t*24*PI);
   p.setZ(i,.085*fold);p.setY(i,p.getY(i)+.03*Math.abs(fold));colors.push(...a.clone().lerp(b,.25+.36*fold*fold).toArray());
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();put(g,curtain,[24.96,1.49,z],side);
 }
 // Illuminated shelves and coloured cans show through the fridge's single pane.
 const drink=[matte(0xf59a63,.38,.42),jade,matte(0xc36db0,.43,.42),matte(0x8ca6e0,.39,.42)];
 for(const [row,y] of [.26,.83,1.4,1.97].entries())for(let i=0;i<10;i++){
  const x=13.13+i*.205;
  cyl(.064,.196,[x,y+.136,16.11],drink[(row+i)%4]);cyl(.058,.015,[x,y+.24,16.11],brass);
 }
 const glass=new T.MeshStandardMaterial({color:0xa0e1d0,transparent:true,opacity:.14,depthWrite:false,roughness:.2,metalness:.14});
 put(new T.PlaneGeometry(2.16,2.38),glass,[14.06,1.38,15.812],end);
 for(const x of [12.96,15.16])box([.05,2.46,.04],[x,1.39,15.805]);
 box([.056,.39,.068],[15.07,1.38,15.767],brass);
 for(const [i,x] of [-5.36,-4.26,-3.16,-2.06].entries()){
  box([.83,.035,.69],[x,.948,16.03],brass);
  for(let u=-1;u<=1;u++)for(const z of [15.87,16.14]){
   const pos=[x+u*.225,1,z];
   if(i%2)ball([.097,.055,.087],pos,drink[(i+u+4)%4]);
   else{box([.183,.066,.168],pos,matteBread);box([.18,.017,.172],[pos[0],1.02,z],leafTip);}
  }
 }
 for(const [x,y,z,mat] of [[4.1,1.145,16.05,jade],[4.35,1.145,16.05,drink[0]],[8.7,1.145,16.05,drink[2]],[9,1.145,16.05,drink[3]]])cyl(.07,.17,[x,y,z],mat);
 for(const [mat,list] of batches){
  const m=new T.Mesh(mergeGeometries(list),mat);m.name='Green_room_dressing';group.add(m);
  for(const g of list)g.dispose();
 }
 let elapsed=0,last=0;
 const update=(dt,p)=>{
  const y=p.y-f.origin[1];
  group.visible=y>=-.25&&y<f.size[1]+.25&&Math.abs(p.x-f.origin[0])<f.size[0]/2+8&&Math.abs(p.z-f.origin[2])<f.size[2]/2+8;
  if(still||!group.visible)return;
  elapsed=(elapsed+dt)%(Math.PI*2);
  if(Math.abs(elapsed-last)>=.125){stage.draw(elapsed);last=elapsed;}
 };
 return {group,update};
}
const matteIvory=matte(0xffe7d3),matteBread=matte(0xd8974b),jade=matte(0x4b9c83,.43,.23);
