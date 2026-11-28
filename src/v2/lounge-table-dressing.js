import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const RADIUS=.35,HEIGHT=.5;
const lathe=points=>new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),14);
const ring=(r,t,y)=>new T.TorusGeometry(r,t,5,18).rotateX(-Math.PI/2).translate(0,y,0);
const cylinder=(r,b,h,y,n=14)=>new T.CylinderGeometry(r,b,h,n).translate(0,y,0);
function merged(parts){const g=mergeGeometries(parts);for(const part of parts)part.dispose();return g;}

// Each profile folds back into the mouth, so the lip reads as glass with an open neck.
const PIPES=[
 {name:'Beaker',color:0x58ecd8,base:[[.108,.018],[.102,.06],[.044,.181]],top:.39},
 {name:'Straight',color:0xc196ff,base:[[.078,.018],[.078,.032],[.044,.048]],top:.34},
 {name:'Rocket',color:0xff80bf,base:[[.062,.016],[.087,.064],[.078,.134],[.046,.222]],top:.41},
];
function pipeGeometry({base,top},rocket){
 const parts=[lathe([[0,0],[base[0][0]-.007,0],...base,[.044,top-.02],[.053,top-.012],[.053,top],[.037,top],[.037,top-.042]]),
  cylinder(.016,.017,.071,0,9).rotateZ(-.67).translate(.059,.151,0),
  lathe([[.014,0],[.028,.018],[.029,.03],[.019,.03],[.014,.016]]).rotateZ(-.67).translate(.081,.179,0)];
 if(rocket)for(let i=0;i<3;i++)parts.push(new T.BoxGeometry(.018,.081,.041).rotateX(.46).translate(0,.051,.068).rotateY(i*Math.PI*2/3));
 return merged(parts);
}

export function addLoungeTableDressing(root,rugs,sideTables){
 const std=(name,color,options)=>new T.MeshStandardMaterial({name,color,...options});
 const glass=(name,color,opacity)=>std(name,color,{transparent:true,opacity,depthWrite:false,roughness:.19,metalness:.12,emissive:color,emissiveIntensity:.17});
 const glow=(name,color)=>new T.MeshBasicMaterial({name,color,toneMapped:false});
 const offset=(matrix,x,y,z)=>matrix.clone().multiply(new T.Matrix4().makeTranslation(x,y,z));
 const batch=(name,geometry,material,placements)=>{
  if(!placements.length){geometry.dispose();return;}
  const mesh=new T.InstancedMesh(geometry,material,placements.length);mesh.name='Lounge_'+name;mesh.userData.noCollide=true;
  placements.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
 };

 const bases=sideTables.map(([x,y,z])=>new T.Matrix4().makeTranslation(x,y,z));
 if(bases.length){
  batch('table_frame',merged([cylinder(.21,.23,.035,.0175),cylinder(.029,.04,.445,.248),cylinder(.13,.038,.04,.454)]),
   std('Lounge_table_frame',0x28243a,{roughness:.37,metalness:.48}),bases);
  batch('table_edge',ring(RADIUS-.009,.009,HEIGHT-.015),glow('Lounge_table_edge',0xc898ff),bases);
  batch('table_glass',cylinder(RADIUS-.01,RADIUS-.01,.026,HEIGHT-.013,20),glass('Lounge_table_glass',0x9fe8ff,.43),bases);
  const shape=cylinder(RADIUS,RADIUS,HEIGHT,HEIGHT/2,12);
  for(const matrix of bases){const proxy=new T.Mesh(shape);proxy.name='Lounge_side_table_collider';proxy.applyMatrix4(matrix);
   proxy.visible=false;proxy.userData={baked:true,collisionOnly:true};root.add(proxy);}
 }

 const pipes=PIPES.map(()=>[]),trays=[];
 [...rugs,...bases.map(m=>offset(m,0,HEIGHT,0))].forEach((m,i)=>{
  const rug=i<rugs.length;
  // Leave the centre of each wooden top clear for its catnip pot.
  pipes[i%PIPES.length].push(rug?offset(m,.22,0,-.24):offset(m,.14,0,0));
  trays.push(rug?offset(m,-.23,0,.22):offset(m,-.16,0,0));
 });
 PIPES.forEach(({name,color,...shape},i)=>batch('Water_pipe_'+name,pipeGeometry(shape,i===2),glass('Lounge_pipe_'+name,color,.61),pipes[i]));
 batch('ashtray',lathe([[0,0],[.087,0],[.105,.016],[.102,.032],[.078,.034],[.068,.014],[0,.014]]),
  std('Lounge_ashtray',0x526b81,{roughness:.37,metalness:.35,emissive:0x203340,emissiveIntensity:.25}),trays);
 const joint=cylinder(.007,.011,.137,0,8).rotateZ(-Math.PI/2).rotateY(-.35).translate(0,.023,0);
 batch('rolled_joint',joint,std('Lounge_joint_paper',0xffe5c9,{roughness:.85,emissive:0x7d644d,emissiveIntensity:.37}),trays);
 const tip=[.0685*Math.cos(.35),.023,.0685*Math.sin(.35)];
 batch('joint_ember',new T.IcosahedronGeometry(.010,1).translate(...tip),glow('Lounge_joint_ember',0xff873c),trays);
 root.userData.tableSmoke=trays.map(m=>new T.Vector3(...tip).applyMatrix4(m).toArray());
}
