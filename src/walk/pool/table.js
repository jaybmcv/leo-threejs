import * as T from 'three';
import {TABLE,R,POCKETS,MOUTH,HEAD,rack,colorOf,striped} from './rules.js';

// Paw Pool's table in the Recreation Hall (POOL.md): a pool table laid flat on the activity floor and filling it, low
// navy rails a little over knee height (too high to step over, so it is solid to walk into), six pockets, and the
// sixteen soccer-pattern balls racked. The turf carries pitch markings: a halfway line, a centre circle and the spots.
// E beside it opens the game (game.js). Everything here is the walk's own: the ship's models and exports are unchanged.
const RAIL_H=.45,FELT=.04,REACH=1.4;
const ICOSA=[[90,0],[-90,0],...[0,1,2,3,4].map(k=>[26.57,k*72]),...[0,1,2,3,4].map(k=>[-26.57,k*72+36])];

// A ball's skin, wrapped round the sphere: its colour (a band of it for 9-15), twelve pentagon panels and its number
// in a white disc on each side.
function ballTexture(n){
 const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');
 const color=colorOf(n),base=n===0||striped(n)?'#f4f0e8':color;
 g.fillStyle=base;g.fillRect(0,0,256,128);
 if(striped(n)){g.fillStyle=color;g.fillRect(0,40,256,48);}
 g.fillStyle=n===0?'#1a1c20':n===8?'#3a3e46':striped(n)?color:'rgba(10,12,16,.38)';
 for(const [lat,lon] of ICOSA){
  if(Math.abs(lat)===90){g.fillRect(0,lat>0?0:120,256,8);continue;}
  const cx=lon/360*256,cy=(90-lat)/180*128,s=1/Math.cos(lat*Math.PI/180);
  for(const shift of [-256,0,256]){g.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;g.lineTo(cx+shift+Math.cos(a)*11*s,cy+Math.sin(a)*11);}g.closePath();g.fill();}
 }
 if(n)for(const cx of [64,192]){g.fillStyle='#f4f0e8';g.beginPath();g.arc(cx,64,15,0,Math.PI*2);g.fill();
  g.fillStyle='#15171a';g.font='700 17px "Archivo", sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),cx,65);}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
// The turf: mown stripes across the table and white pitch lines.
function turfTexture(){
 const c=document.createElement('canvas'),k=64;c.width=TABLE.w*k;c.height=TABLE.h*k;const g=c.getContext('2d');
 for(let i=0;i<14;i++){g.fillStyle=i%2?'#2e8b45':'#35994e';g.fillRect(i*c.width/14,0,c.width/14+1,c.height);}
 g.strokeStyle='rgba(244,240,232,.55)';g.lineWidth=.06*k;
 g.beginPath();g.moveTo(c.width/2,0);g.lineTo(c.width/2,c.height);g.stroke();
 g.beginPath();g.arc(c.width/2,c.height/2,1.5*k,0,Math.PI*2);g.stroke();
 g.fillStyle='rgba(244,240,232,.7)';for(const x of [HEAD.x,0,-HEAD.x]){g.beginPath();g.arc((x+TABLE.w/2)*k,c.height/2,.1*k,0,Math.PI*2);g.fill();}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
}

// `carpet`: the hall's Activity_floor mesh. The table sits on it, centred, its long side along the hall.
export function createPoolTable(carpet){
 carpet.updateWorldMatrix(true,false);carpet.geometry.computeBoundingBox();
 const box=carpet.geometry.boundingBox.clone().applyMatrix4(carpet.matrixWorld),centre=box.getCenter(new T.Vector3()),floor=box.max.y;
 const group=new T.Group();group.name='Paw_pool';group.position.set(centre.x,floor,centre.z);
 const navy=new T.MeshStandardMaterial({name:'Paw_pool_navy',color:0x233b4b,roughness:.6});
 const bronze=new T.MeshStandardMaterial({name:'Paw_pool_bronze',color:0x9d7950,roughness:.4,metalness:.65});
 const cushion=new T.MeshStandardMaterial({name:'Paw_pool_cushion',color:0x24703a,roughness:.9});
 const well=new T.MeshBasicMaterial({name:'Paw_pool_pocket',color:0x06080b});
 const add=(name,geometry,material,x,y,z,solid=true)=>{const o=new T.Mesh(geometry,material);o.name=name;o.position.set(x,y,z);o.userData.noCollide=!solid;group.add(o);return o;};
 const box3=(name,w,h,d,material,x,y,z,solid)=>add(name,new T.BoxGeometry(w,h,d),material,x,y,z,solid);
 const hw=TABLE.w/2,hh=TABLE.h/2,rw=TABLE.rail;
 // The turf, a little proud of the carpet.
 box3('Paw_pool_turf',TABLE.w,FELT,TABLE.h,new T.MeshStandardMaterial({name:'Paw_pool_turf',map:turfTexture(),roughness:.95}),0,FELT/2,0);
 // A rail: the navy body, a bronze inlay along its top and a green cushion facing the turf.
 const rail=(len,x,z,along)=>{
  const [w,d]=along==='x'?[len,rw]:[rw,len],inward=along==='x'?[0,-Math.sign(z)]:[-Math.sign(x),0];
  box3('Paw_pool_rail',w,RAIL_H,d,navy,x,RAIL_H/2,z);
  box3('Paw_pool_rail_inlay',along==='x'?len:rw*.45,.012,along==='x'?rw*.45:len,bronze,x,RAIL_H+.006,z,false);
  box3('Paw_pool_cushion',along==='x'?len:.07,.16,along==='x'?.07:len,cushion,x+inward[0]*(rw/2+.035),FELT+.08,z+inward[1]*(rw/2+.035));
 };
 const long=hw-MOUTH.corner-MOUTH.side;
 for(const s of [-1,1]){
  for(const side of [-1,1])rail(long,side*(MOUTH.side+long/2),s*(hh+rw/2),'x');
  rail(TABLE.h-2*MOUTH.corner,s*(hw+rw/2),0,'z');
 }
 // The pockets: dark wells with bronze rims, corner blocks behind the corner pockets and a housing behind each side
 // pocket, which also keeps a walker from slipping through the gap there.
 const rim=r=>new T.RingGeometry(r,r+.06,40).rotateX(-Math.PI/2),disc=r=>new T.CircleGeometry(r,40).rotateX(-Math.PI/2);
 for(const p of POCKETS){
  add('Paw_pool_pocket',disc(p.r),well,p.x,FELT+.004,p.y,false);
  add('Paw_pool_pocket_inlay',rim(p.r),bronze,p.x,FELT+.006,p.y,false);
  if(p.corner)box3('Paw_pool_corner',rw,RAIL_H,rw,navy,Math.sign(p.x)*(hw+rw/2),RAIL_H/2,Math.sign(p.y)*(hh+rw/2));
  else box3('Paw_pool_pocket_housing',2*MOUTH.side+.1,RAIL_H,rw*.5,navy,0,RAIL_H/2,Math.sign(p.y)*(hh+rw*.75));
 }
 // The balls, racked at the foot with the cue ball on the head spot, each turned so a number shows.
 const sphere=new T.SphereGeometry(R,32,16);
 for(const b of [{n:0,x:HEAD.x,y:HEAD.y},...rack(80)]){
  const ball=add('Paw_pool_ball_'+b.n,sphere,new T.MeshStandardMaterial({name:'Paw_pool_ball',map:ballTexture(b.n),roughness:.35}),b.x,FELT+R,b.y,false);
  ball.rotation.set(.9+((b.n*37)%7)*.08,Math.PI/2+((b.n*53)%9-4)*.12,0,'YXZ');
 }
 const reach=[hw+rw,hh+rw];
 return {
  group,
  // The game's use prompt, standing beside the table on the hall floor.
  near(p){
   if(Math.abs(p.y-floor)>1.5)return null;
   const dx=Math.max(0,Math.abs(p.x-centre.x)-reach[0]),dz=Math.max(0,Math.abs(p.z-centre.z)-reach[1]);
   return Math.hypot(dx,dz)<REACH?{kind:'pool',label:'Play Paw Pool'}:null;
  },
 };
}
