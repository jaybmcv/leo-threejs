import * as T from 'three';
import {canvasTexture,seeded,oakFloor,standard,glow} from './polish-kit.js';
import {stylizedTree,plantClumps} from './stylized-plants.js';

// Art pass for the home tour's last two stops: the forward promenade (a ramp up from the garden deck) and the
// observation lounge at the bow. Only meshes inside these bounds are restyled; walk-only extras go in `walkOnly`.
const PROMENADE={minX:132,maxX:170.2,halfZ:4.1,minY:23.5,maxY:31};
const LOUNGE={minX:169.8,maxX:213,halfZ:42,minY:25.5,maxY:34.5};
const RAMP={x0:146,x1:170},LEVEL_RUNNER_X=132.2,ART_SIZE=1.6,ART_CENTRE=2.15;// frame bottom 1.27 m, wainscot top 1.1 m
// Framed Mars Cats Voyage artwork (from the website's own images) along the promenade's right wall.
const PROMENADE_ART=['art-close-encounter.jpg','art-astronaut-cat.jpg','art-spacesuit-cat.jpg','art-anniversary.jpg'];
const artTexture=name=>{const t=new T.TextureLoader().load('brand/'+name);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;};
export const artMaterial=name=>{const map=artTexture(name);return new T.MeshStandardMaterial({map,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.35,roughness:.6});};
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
const fiberStars=()=>canvasTexture(1024,1024,(g,w,h)=>{
 g.fillStyle='#0b1422';g.fillRect(0,0,w,h);const rnd=seeded(88);
 for(let i=0;i<700;i++){const a=.25+rnd()*.75;g.fillStyle=`rgba(${rnd()<.2?'255,214,168':'230,238,255'},${a})`;g.beginPath();g.arc(rnd()*w,rnd()*h,.8+rnd()*1.6,0,Math.PI*2);g.fill();}
},[1,1]);

// The "Lounge / 24 m" sign stood on a post with half its width buried in the 5.4 m corridor's wall. Hang it from the
// ceiling instead, centred and scaled to fit.
function hangLoungeSign(root,ceilingAt){
 const sign=root.getObjectByName('Wayfinding_LOUNGE__/__24_M');if(!sign)return;
 const b=new T.Box3().setFromObject(sign),x=b.getCenter(new T.Vector3()).x,scale=Math.min(1,3.4/(b.max.z-b.min.z)),top=ceilingAt(x);
 const origin=sign.getWorldPosition(new T.Vector3()),offset=(b.getCenter(new T.Vector3()).z-origin.z)*scale;
 sign.position.copy(sign.parent.worldToLocal(new T.Vector3(origin.x,top-.55,-offset)));sign.scale.multiplyScalar(scale);
 root.traverse(o=>{if(o.name==='Promenade_sign_post'&&Math.abs(o.getWorldPosition(new T.Vector3()).x-x)<1)o.visible=false;});
 const rod=standard(0x6b4a2c,{roughness:.35,metalness:.6});sign.updateMatrixWorld(true);const hung=new T.Box3().setFromObject(sign);
 for(const z of [hung.min.z+.3,hung.max.z-.3]){const m=new T.Mesh(new T.CylinderGeometry(.015,.015,top-hung.max.y),rod);m.name='Lounge_sign_hanger';m.position.set(x,(top+hung.max.y)/2,z);root.add(m);}
}

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
// Give a UV-less surface top-down UVs in metres (x, z), for ceilings built from bare position strips.
function planarUV(mesh){
 const pos=mesh.geometry.attributes.position,uv=new Float32Array(pos.count*2);
 for(let i=0;i<pos.count;i++){uv[i*2]=pos.getX(i);uv[i*2+1]=pos.getZ(i);}
 mesh.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
}
// Repeat a map so one tile spans `metres`, whether the mesh's UVs are in metres or 0..1 (bare meshes get top-down UVs).
function tileMetres(mesh,texture,metres){
 if(!mesh.geometry.attributes.uv)planarUV(mesh);const uv=mesh.geometry.attributes.uv;const b=new T.Box2();for(let i=0;i<uv.count;i++)b.expandByPoint(new T.Vector2(uv.getX(i),uv.getY(i)));
 const size=b.getSize(new T.Vector2()),box=new T.Box3().setFromObject(mesh).getSize(new T.Vector3());
 if(size.x>2)texture.repeat.set(1/metres,1/metres);else texture.repeat.set(Math.max(box.x,box.z)/metres,Math.min(box.x,box.z)/metres);
}

function polishPromenade(root,walkOnly){
 const surfaces={floor:[],ceiling:[]};
 root.traverse(o=>{if(!o.isMesh||!within(PROMENADE,o))return;
  if(o.name==='Lounge_access_ramp'){const map=runnerStripes();map.repeat.set(5,1);o.material=standard(0xffffff,{map,roughness:.95});}
  if(o.name==='Lounge_access_ramp'||o.name==='Promenade_level_floor')surfaces.floor.push(o);
  if(o.name==='Ramped_promenade_ceiling'||o.name==='Level_promenade_ceiling')surfaces.ceiling.push(o);
  if(o.name==='Ramp_handrail')o.material=standard(0xa8743f,{roughness:.45});
  if(o.name==='Ramp_rail_post')o.material=standard(0x6b4a2c,{roughness:.35,metalness:.6});
  if(o.name==='Promenade_floor_light'||o.name==='Passage_cove_light')o.material=glow(0xffe2bc,1.8);
 });
 const floorAt=x=>surfaceY(surfaces.floor,x,0,32,true)??24.3,ceilingAt=x=>surfaceY(surfaces.ceiling,x,0,floorAt(x)+.5,false)??floorAt(x)+3.9;
 const extras=new T.Group();extras.name='Tour_promenade_dressing';walkOnly.add(extras);
 // The level walkway shares its height with two other floors (they flickered once one was patterned), so its runner
 // is a separate strip laid just above them.
 const levelRunner=runnerStripes();levelRunner.repeat.set(3,1);
 const run=new T.Mesh(new T.PlaneGeometry(RAMP.x0-LEVEL_RUNNER_X,5),standard(0xffffff,{map:levelRunner,roughness:.95}));run.name='Promenade_level_runner';run.rotation.x=-Math.PI/2;run.position.set((RAMP.x0+LEVEL_RUNNER_X)/2,floorAt(RAMP.x0-1)+.015,0);run.receiveShadow=true;extras.add(run);
 hangLoungeSign(root,ceilingAt);
 // Oak wainscot on both walls and the lit voyage line on the left, all following the ramp.
 const slats=standard(0xffffff,{map:oakSlats(),roughness:.7});
 for(const s of [-1,1])extras.add(wallStrip(RAMP.x0,RAMP.x1,s*3.97,x=>floorAt(x)+.02,x=>floorAt(x)+1.1,-s,slats,'Promenade_oak_wainscot'));
 extras.add(wallStrip(RAMP.x0+1.5,RAMP.x1-1.5,-3.96,x=>floorAt(x)+1.45,x=>floorAt(x)+1.95,1,new T.MeshStandardMaterial({color:0x000000,emissive:0xffffff,emissiveMap:voyageLine(),emissiveIntensity:1,roughness:.4}),'Promenade_voyage_line'));
 // Four framed artworks on the right wall, hung level with their lower edge clear of the wainscot.
 const frame=standard(0x2a3440,{roughness:.5,metalness:.3});
 [150.5,156,161.5,167].forEach((x,i)=>{
  const y=floorAt(x)+ART_CENTRE,art=new T.Mesh(new T.PlaneGeometry(ART_SIZE,ART_SIZE),artMaterial(PROMENADE_ART[i]));
  art.name='Promenade_artwork';art.rotation.y=Math.PI;art.position.set(x,y,3.93);extras.add(art);
  const back=new T.Mesh(new T.BoxGeometry(ART_SIZE+.16,ART_SIZE+.16,.05),frame);back.name='Promenade_art_frame';back.position.set(x,y,3.965);extras.add(back);
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

// The lounge's back wall: two framed murals above the oak battens, each under a picture light.
const LOUNGE_MURALS=[{name:'art-mars-cats.jpg',z:12.5,width:6.4,height:3.6},{name:'art-crew.jpg',z:-12.5,width:5.1,height:3.6}];
function dressRearWall(walkOnly){
 const g=new T.Group();g.name='Lounge_rear_wall_art';walkOnly.add(g);const frame=standard(0x2a3440,{roughness:.5,metalness:.3}),light=glow(0xfff0dc,2.2);
 for(const {name,z,width,height} of LOUNGE_MURALS){
  const y=29.35+height/2,art=new T.Mesh(new T.PlaneGeometry(width,height),artMaterial(name));art.name='Lounge_mural';art.rotation.y=Math.PI/2;art.position.set(170.27,y,z);g.add(art);
  const back=new T.Mesh(new T.BoxGeometry(.05,height+.2,width+.2),frame);back.name='Lounge_mural_frame';back.position.set(170.23,y,z);g.add(back);
  const bar=new T.Mesh(new T.BoxGeometry(.18,.06,width*.8),light);bar.name='Lounge_picture_light';bar.position.set(170.45,y+height/2+.18,z);g.add(bar);
 }
}
// Fuller planting in the lounge planters, each with a small tree.
function plantLounge(root){
 const planters=[];root.traverse(o=>{if(o.isMesh&&o.name==='Lounge_planter'&&within(LOUNGE,o))planters.push(new T.Box3().setFromObject(o));});
 plantClumps(root,planters,{seed:611,density:1.4,flowers:true});
 planters.forEach((b,i)=>{const c=b.getCenter(new T.Vector3());root.add(stylizedTree(new T.Vector3(c.x,b.max.y,c.z),{height:3.2,spread:2.4,seed:90+i}));});
}

export function polishForwardDeck(root,walkOnly){root.updateMatrixWorld(true);polishPromenade(root,walkOnly);polishLounge(root);dressRearWall(walkOnly);plantLounge(root);}

// The fin crown bar, the fin tour's destination, gets the lounge's finishes: oak floor, a starlit ceiling, glowing
// lamps and halo, and stylized trees in its two planters. Runs once on the aft model, so the aft view matches.
const CROWN={minX:-279,maxX:-190,halfZ:17,minY:128,maxY:139};
export function polishCrown(root){
 root.updateMatrixWorld(true);const planters=[],lamp=glow(0xffc58a,2.4);
 root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!within(CROWN,o))return;const side=o.material.side;
  if(o.name==='Crown_observation_floor'){const map=oakFloor();tileMetres(o,map,3);o.material=standard(0xffffff,{map,roughness:.55,side});}
  if(o.name==='Crown_roof'){const map=fiberStars();tileMetres(o,map,9);o.material=new T.MeshStandardMaterial({color:0x0b1422,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.9,roughness:.9,side});}
  if(o.name==='Crown_bar_light_halo'||o.name==='Crown_ceiling_light')o.material=glow(0xfff0dc,2);
  if(o.name==='Crown_finish_Table_lamp_shade')o.material=lamp;
  if(o.name==='Crown_plant')o.visible=false;
  if(o.name==='Crown_planter')planters.push(new T.Box3().setFromObject(o));
 });
 plantClumps(root,planters,{seed:733,density:1.6,flowers:true});
 planters.forEach((b,i)=>{const c=b.getCenter(new T.Vector3());root.add(stylizedTree(new T.Vector3(c.x,b.max.y,c.z),{height:2.6,spread:1.8,seed:120+i}));});
}
