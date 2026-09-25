import * as T from 'three';
import {canvasTexture,seeded,oakFloor,standard,glow} from './polish-kit.js';

// Art pass for the home tour's last two stops: the forward promenade (a ramp up from the garden deck) and the
// observation lounge at the bow. Only meshes inside these bounds are restyled; walk-only extras go in `walkOnly`.
const PROMENADE={minX:132,maxX:170.2,halfZ:4.1,minY:23.5,maxY:31};
const LOUNGE={minX:169.8,maxX:213,halfZ:42,minY:25.5,maxY:34.5};
const RAMP={x0:146,x1:170};
const within=(b,o)=>{const c=new T.Box3().setFromObject(o).getCenter(new T.Vector3());return c.x>b.minX&&c.x<b.maxX&&Math.abs(c.z)<b.halfZ&&c.y>b.minY&&c.y<b.maxY;};

const runnerStripes=()=>canvasTexture(512,128,(g,w,h)=>{
 g.fillStyle='#2a3440';g.fillRect(0,0,w,h);const rnd=seeded(9);for(let i=0;i<900;i++){g.fillStyle=`rgba(255,255,255,${rnd()*.04})`;g.fillRect(rnd()*w,rnd()*h,2,2);}
 g.fillStyle='#f85800';g.fillRect(0,10,w,5);g.fillRect(0,h-15,w,5);g.fillStyle='rgba(244,240,232,.35)';g.fillRect(0,22,w,2);g.fillRect(0,h-24,w,2);
});
const oakSlats=()=>canvasTexture(512,128,(g,w,h)=>{
 const rnd=seeded(31);for(let x=0;x<w;x+=16){const t=150+rnd()*30;g.fillStyle=`rgb(${t},${t*.7|0},${t*.46|0})`;g.fillRect(x,0,13,h);g.fillStyle='rgba(40,24,12,.8)';g.fillRect(x+13,0,3,h);}
},[8,1]);
// The voyage in one line: Earth to Mars, lit in the site's orange, with the ship marked just past midcourse.
const voyageLine=()=>canvasTexture(2048,128,(g,w,h)=>{
 g.fillStyle='#0d1620';g.fillRect(0,0,w,h);const y=64,stops=[['EARTH ORBIT',.04],['DEPARTURE',.2],['MIDCOURSE',.5],['MARS APPROACH',.8],['MARS',.96]];
 g.strokeStyle='rgba(244,240,232,.25)';g.lineWidth=2;g.beginPath();g.moveTo(w*.04,y);g.lineTo(w*.96,y);g.stroke();
 g.strokeStyle='#f85800';g.lineWidth=5;g.beginPath();g.moveTo(w*.04,y);g.lineTo(w*.58,y);g.stroke();
 g.font='400 22px "JetBrains Mono", monospace';g.textBaseline='top';
 for(const [label,t] of stops){g.fillStyle=t<=.58?'#f85800':'#f4f0e8';g.beginPath();g.arc(w*t,y,8,0,Math.PI*2);g.fill();g.fillStyle='#a6a5b4';g.fillText(label,w*t-g.measureText(label).width/2,y+18);}
 g.fillStyle='#f4f0e8';g.beginPath();g.moveTo(w*.58+16,y);g.lineTo(w*.58-10,y-12);g.lineTo(w*.58-10,y+12);g.fill();
 g.font='500 26px "Archivo", Arial, sans-serif';g.fillText('Leo is here',w*.58-70,y-50);
},[1,1]);
function marsVista(seed){
 return canvasTexture(512,320,(g,w,h)=>{
  const rnd=seeded(seed),sky=g.createLinearGradient(0,0,0,h*.7);sky.addColorStop(0,'#e7b98f');sky.addColorStop(1,'#c77c52');g.fillStyle=sky;g.fillRect(0,0,w,h);
  g.fillStyle='rgba(255,244,220,.9)';g.beginPath();g.arc(w*(.2+rnd()*.6),h*(.18+rnd()*.15),9,0,Math.PI*2);g.fill();
  for(let layer=0;layer<3;layer++){const base=h*(.5+layer*.13),tone=[150,120,88][layer];g.fillStyle=`rgb(${tone+40},${tone*.55|0},${tone*.35|0})`;g.beginPath();g.moveTo(0,h);
   const phase=rnd()*6,swell=rnd()*3;for(let x=0;x<=w;x+=8)g.lineTo(x,base-Math.sin(x*.012+phase)*18*(3-layer)-Math.sin(x*.031+swell)*5);g.lineTo(w,h);g.fill();}
 });
}
const fiberStars=()=>canvasTexture(1024,1024,(g,w,h)=>{
 g.fillStyle='#0b1422';g.fillRect(0,0,w,h);const rnd=seeded(88);
 for(let i=0;i<700;i++){const a=.25+rnd()*.75;g.fillStyle=`rgba(${rnd()<.2?'255,214,168':'230,238,255'},${a})`;g.beginPath();g.arc(rnd()*w,rnd()*h,.8+rnd()*1.6,0,Math.PI*2);g.fill();}
},[1,1]);

// Height of the first of `meshes` straight above or below (x, z), for fitting panels to the sloped ramp.
function surfaceY(meshes,x,z,fromY,down){
 const r=new T.Raycaster(new T.Vector3(x,fromY,z),new T.Vector3(0,down?-1:1,0),0,20);const hit=r.intersectObjects(meshes,false)[0];return hit?hit.point.y:null;
}
// A quad along a wall at `z`, from x0 to x1, between heights bottom(x) and top(x); `facing` is ±1 (the room side).
function wallStrip(x0,x1,z,bottom,top,facing,material,name){
 const g=new T.BufferGeometry(),p=[[x0,bottom(x0)],[x1,bottom(x1)],[x1,top(x1)],[x0,top(x0)]];
 g.setAttribute('position',new T.Float32BufferAttribute(p.flatMap(([x,y])=>[x,y,z]),3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
 g.setIndex(facing>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]);g.computeVertexNormals();
 const m=new T.Mesh(g,material);m.name=name;m.receiveShadow=true;return m;
}
// Repeat a map so one tile spans `metres`, whether the mesh's UVs are in metres or 0..1.
function tileMetres(mesh,texture,metres){
 const uv=mesh.geometry.attributes.uv;if(!uv)return;const b=new T.Box2();for(let i=0;i<uv.count;i++)b.expandByPoint(new T.Vector2(uv.getX(i),uv.getY(i)));
 const size=b.getSize(new T.Vector2()),box=new T.Box3().setFromObject(mesh).getSize(new T.Vector3());
 if(size.x>2)texture.repeat.set(1/metres,1/metres);else texture.repeat.set(Math.max(box.x,box.z)/metres,Math.min(box.x,box.z)/metres);
}

function polishPromenade(root,walkOnly){
 const surfaces={floor:[],ceiling:[]};
 root.traverse(o=>{if(!o.isMesh||!within(PROMENADE,o))return;
  if(o.name==='Lounge_access_ramp'||o.name==='Promenade_level_floor'){const map=runnerStripes();map.repeat.set(o.name==='Lounge_access_ramp'?5:3,1);o.material=standard(0xffffff,{map,roughness:.95});surfaces.floor.push(o);}
  if(o.name==='Ramped_promenade_ceiling'||o.name==='Level_promenade_ceiling')surfaces.ceiling.push(o);
  if(o.name==='Ramp_handrail')o.material=standard(0xa8743f,{roughness:.45});
  if(o.name==='Ramp_rail_post')o.material=standard(0x6b4a2c,{roughness:.35,metalness:.6});
  if(o.name==='Promenade_floor_light'||o.name==='Passage_cove_light')o.material=glow(0xffe2bc,1.8);
 });
 const floorAt=x=>surfaceY(surfaces.floor,x,0,32,true)??24.3,ceilingAt=x=>surfaceY(surfaces.ceiling,x,0,floorAt(x)+.5,false)??floorAt(x)+3.9;
 const extras=new T.Group();extras.name='Tour_promenade_dressing';walkOnly.add(extras);
 // Oak wainscot on both walls and the lit voyage line on the left, all following the ramp.
 const slats=standard(0xffffff,{map:oakSlats(),roughness:.7});
 for(const s of [-1,1])extras.add(wallStrip(RAMP.x0,RAMP.x1,s*3.97,x=>floorAt(x)+.02,x=>floorAt(x)+1.1,-s,slats,'Promenade_oak_wainscot'));
 extras.add(wallStrip(RAMP.x0+1.5,RAMP.x1-1.5,-3.96,x=>floorAt(x)+1.45,x=>floorAt(x)+1.95,1,new T.MeshStandardMaterial({color:0x000000,emissive:0xffffff,emissiveMap:voyageLine(),emissiveIntensity:1,roughness:.4}),'Promenade_voyage_line'));
 // Four framed Mars vistas on the right wall, hung level.
 const frame=standard(0x2a3440,{roughness:.5,metalness:.3});
 [150.5,156,161.5,167].forEach((x,i)=>{
  const y=floorAt(x)+1.75,art=new T.Mesh(new T.PlaneGeometry(2.4,1.5),new T.MeshStandardMaterial({color:0x000000,emissive:0xffffff,emissiveMap:marsVista(300+i),emissiveIntensity:.85,roughness:.5}));
  art.name='Promenade_mars_vista';art.rotation.y=Math.PI;art.position.set(x,y,3.94);extras.add(art);
  const back=new T.Mesh(new T.BoxGeometry(2.6,1.7,.05),frame);back.name='Promenade_vista_frame';back.position.set(x,y,3.97);extras.add(back);
 });
 // Light ribs across the ceiling every three metres.
 const rib=glow(0xfff0dc,1.5);
 for(let x=RAMP.x0+1.5;x<RAMP.x1;x+=3){const m=new T.Mesh(new T.BoxGeometry(.14,.05,7.6),rib);m.name='Promenade_light_rib';m.position.set(x,ceilingAt(x)-.03,0);extras.add(m);}
}

// The slanted side-return walls leave a sliver of open space above the floor along their base. A navy kick panel,
// standing just in front of each wall's lean, closes it.
const KICK_TOP=.65;
function closeSideReturns(root){
 const navy=standard(0x1c2c38,{roughness:.6,side:T.DoubleSide});
 root.traverse(o=>{if(o.name!=='Lounge_side_return'||!o.isMesh||!within(LOUNGE,o))return;
  const pos=o.geometry.attributes.position,pts=[];for(let i=0;i<pos.count;i++)pts.push(new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld));
  const floorY=Math.min(...pts.map(p=>p.y)),top=floorY+KICK_TOP,midX=pts.reduce((a,p)=>a+p.x,0)/pts.length;
  // Where each end of the wall passes the kick panel's top height, stepped 3 cm into the room.
  const end=side=>{const [a,b]=pts.filter(p=>(p.x<midX)===(side<0)).sort((p,q)=>p.y-q.y),t=(top-a.y)/((b.y-a.y)||1);return new T.Vector3(a.x+(b.x-a.x)*t,0,a.z+(b.z-a.z)*t-Math.sign(a.z)*.03);};
  const l=end(-1),r=end(1),g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute([l.x,floorY-.05,l.z,r.x,floorY-.05,r.z,r.x,top,r.z,l.x,top,l.z],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
  const kick=new T.Mesh(g,navy);kick.name='Lounge_kick_panel';kick.receiveShadow=true;root.add(kick);
 });
}

function polishLounge(root){
 const lamp=glow(0xffc58a,2.4);
 // Some lounge surfaces are single sheets drawn double-sided; replacements keep the original's side.
 root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!within(LOUNGE,o))return;const side=o.material.side;
  if(o.name==='Curved_lounge_floor'){const map=oakFloor();tileMetres(o,map,3);o.material=standard(0xffffff,{map,roughness:.55,side});}
  if(o.name==='Curved_lounge_ceiling'){const map=fiberStars();tileMetres(o,map,9);o.material=new T.MeshStandardMaterial({color:0x0b1422,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.9,roughness:.9,side});}
  if(o.name==='Lounge_side_return'||o.name==='Lounge_rear_wall')o.material=standard(0xe9dfcf,{roughness:.95,side});
  // The side returns lean in over the floor; their shadow read as a black gap along the wall.
  if(o.name==='Lounge_side_return')o.castShadow=false;
  if(o.name==='Window_cove_light')o.material=glow(0xfff0dc,2);
  if(o.name==='Warm_ceiling_ribbon')o.material=glow(0xffc88f,1.2);
  if(o.name==='Amber_table_lamp')o.material=lamp;
 });
 closeSideReturns(root);
 // The lounge's crew cat stood a metre from the tour camera; it now waits by the rail, looking out at Mars.
 root.traverse(o=>{if(o.name!=='Mars_cat_1.75m')return;const p=o.getWorldPosition(new T.Vector3());
  if(Math.abs(p.x-181)<1&&Math.abs(p.z-29)<1){o.position.copy(o.parent.worldToLocal(new T.Vector3(198.5,p.y,20)));o.rotation.y=1.65;}});
}

export function polishForwardDeck(root,walkOnly){root.updateMatrixWorld(true);polishPromenade(root,walkOnly);polishLounge(root);}
