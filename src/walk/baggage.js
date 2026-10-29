import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {roomObject} from '../plan/rooms.js';
import {walkCanvas} from './canvas.js';

// Four corner carousels leave the entrance and the middle of Baggage reclaim open. The wall-side hoods cover a
// section of each return belt, so packs emerge from a dispenser and pass back through it on every lap.
const ROOM='Area_d02-baggage-5',HALF=2.8,RADIUS=2.5,WIDTH=1.5,LAP=4*HALF+2*Math.PI*RADIUS;
const BAYS=[[-19,-12.5],[19,-12.5],[-19,12.5],[19,12.5]],SLATS=128,BAGS=8,SPEED=.36;
const OLD=/^(Baggage_conveyor|Luggage|Service_counter|Countertop|Refined_conveyor_detail|Refined_counter_hardware)$/;

export function stripBaggage(ship){
 const room=roomObject(ship,ROOM);if(!room)return false;
 const old=[];room.traverse(o=>{if(o.isMesh&&OLD.test(o.name))old.push(o);});
 for(const o of old)o.removeFromParent();
 return true;
}

// Distance along a stadium loop, with its tangent. Both straight runs and both turns have the same speed.
export function baggagePoint(distance){
 let s=((distance%LAP)+LAP)%LAP;
 if(s<2*HALF)return {x:-HALF+s,z:RADIUS,yaw:0};s-=2*HALF;
 if(s<Math.PI*RADIUS){const a=Math.PI/2-s/RADIUS;return {x:HALF+RADIUS*Math.cos(a),z:RADIUS*Math.sin(a),yaw:Math.PI/2-a};}s-=Math.PI*RADIUS;
 if(s<2*HALF)return {x:HALF-s,z:-RADIUS,yaw:Math.PI};s-=2*HALF;
 const a=-Math.PI/2-s/RADIUS;return {x:-HALF+RADIUS*Math.cos(a),z:RADIUS*Math.sin(a),yaw:Math.PI/2-a};
}
function outline(r){
 const s=new T.Shape();s.moveTo(-HALF,-r);s.lineTo(HALF,-r);s.absarc(HALF,0,r,-Math.PI/2,Math.PI/2,false);
 s.lineTo(-HALF,r);s.absarc(-HALF,0,r,Math.PI/2,Math.PI*1.5,false);s.closePath();return s;
}
function shell(outer,inner,height,y){
 const s=outline(outer);if(inner)s.holes.push(new T.Path(outline(inner).getPoints(32)));
 return new T.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:24}).rotateX(-Math.PI/2).translate(0,y,0);
}
function pack(){
 const parts=[],put=(color,size,p,round=false)=>{
  const g=(round?new RoundedBoxGeometry(...size,1,.045):new T.BoxGeometry(...size)).translate(...p),a=g.attributes.position;
  const c=new T.Color(color),colors=[];for(let i=0;i<a.count;i++)colors.push(c.r,c.g,c.b);
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));parts.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();
 };
 put(0x143b79,[1.14,.46,.7],[0,.25,0],true);
 put(0xff690e,[.87,.07,.53],[0,.51,0],true);
 for(const x of [-.47,.47])for(const z of [-.28,.28])put(0x252e36,[.23,.52,.2],[x,.27,z],true);
 for(const x of [-.32,.32]){put(0x87969c,[.075,.025,.58],[x,.56,0]);put(0xe5b53c,[.12,.07,.09],[x,.54,.29]);}
 put(0x202b34,[.3,.04,.14],[0,.57,-.14]);put(0x59ef91,[.22,.015,.07],[0,.6,-.14]);
 for(const x of [-.2,.2])put(0x242c34,[.06,.06,.16],[x,.28,.42]);
 put(0x242c34,[.45,.06,.055],[0,.28,.49]);
 for(let i=0;i<4;i++)put(0x151e29,[.025,.035,.38],[.577,.15+i*.06,0]);
 put(0x202b34,[.22,.24,.055],[-.25,.3,-.38]);put(0x59ef91,[.14,.16,.015],[-.25,.31,-.415]);
 const g=mergeGeometries(parts);for(const p of parts)p.dispose();return g;
}
function numberFace(n){
 const c=walkCanvas();c.width=512;c.height=160;const g=c.getContext('2d');
 g.fillStyle='#142b3b';g.fillRect(0,0,512,160);g.fillStyle='#ffba4c';g.fillRect(0,0,9,160);
 g.font='bold 116px sans-serif';g.fillText(String(n),28,123);g.fillStyle='#f3f5ef';g.font='bold 32px sans-serif';
 g.fillText('BAGGAGE',132,70);g.fillText('RECLAIM',132,113);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:t});
}

export function createBaggage(ship,{still=false}={}){
 const room=roomObject(ship,ROOM);if(!room)return null;room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Baggage_carousels';room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Baggage_colliders';room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const mat=(color,metalness=0)=>new T.MeshStandardMaterial({color,roughness:.42,metalness});
 const M={steel:mat(0xaebdc7,.7),navy:mat(0x213e55,.3),belt:mat(0x19242f),rubber:mat(0x313e48),
  led:new T.MeshBasicMaterial({color:0x57dcff}),dark:mat(0x101923)};
 const parts=new Map(),piece=(m,g)=>{if(!parts.has(m))parts.set(m,[]);parts.get(m).push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();};
 const box=(m,s,p)=>piece(m,new T.BoxGeometry(...s).translate(...p));
 const block=(s,p)=>{const o=new T.Mesh(new T.BoxGeometry(...s));o.position.set(...p);solid.add(o);};
 BAYS.forEach(([x,z],i)=>{
  const side=Math.sign(z),back=z+side*RADIUS;
  // The skirt ends where the silver rim begins, so their outer faces never overlap.
  piece(M.navy,shell(RADIUS+WIDTH/2,0,.53,.12).translate(x,0,z));
  piece(M.steel,shell(RADIUS+WIDTH/2,RADIUS+WIDTH/2-.12,.18,.65).translate(x,0,z));
  piece(M.steel,shell(RADIUS-WIDTH/2+.1,RADIUS-WIDTH/2,.18,.65).translate(x,0,z));
  piece(M.belt,shell(RADIUS+WIDTH/2-.12,RADIUS-WIDTH/2+.1,.05,.75).translate(x,0,z));
  piece(M.steel,shell(RADIUS-WIDTH/2,0,.09,.74).translate(x,0,z));
  for(const sx of [-1,1])for(const sz of [-1,1]){
   box(M.dark,[.45,.18,.45],[x+sx*3.8,.09,z+sz*2.4]);
   box(M.led,[.75,.06,.025],[x+sx*2,.4,z+sz*(RADIUS+WIDTH/2+.012)]);
  }
  // Compact loops leave more floor to walk on; curved colliders keep their end clearances usable too.
  const body=new T.Mesh(shell(RADIUS+WIDTH/2,0,.83,0));body.position.set(x,0,z);solid.add(body);
  // The dispenser backs onto the side wall; its open ends let the belt run through beneath the hood.
  box(M.steel,[3.6,.18,3.5],[x,2.18,side*15]);
  for(const edge of [-1,1])box(M.navy,[3.6,1.38,.12],[x,1.4,side*15+edge*1.69]);
  box(M.dark,[3.3,.1,1.25],[x,2.03,back]);
  block([3.6,2.27,3.5],[x,1.135,side*15]);
  box(M.navy,[.12,1.05,.12],[x,1.3,z]);
  box(M.navy,[3.3,.95,.18],[x,2.05,z]);
  block([3.3,.95,.18],[x,2.05,z]);
  const face=numberFace(i+1);
  for(const s of [-1,1]){const o=new T.Mesh(new T.PlaneGeometry(3.16,.88),face);o.position.set(x,2.05,z+s*.096);if(s<0)o.rotation.y=Math.PI;group.add(o);}
 });
 for(const [material,gs] of parts){const o=new T.Mesh(mergeGeometries(gs),material);o.name='Baggage_fittings';group.add(o);for(const g of gs)g.dispose();}
 const slats=new T.InstancedMesh(new T.BoxGeometry(.045,.018,WIDTH-.25),M.rubber,BAYS.length*SLATS);
 const bags=new T.InstancedMesh(pack(),new T.MeshStandardMaterial({vertexColors:true,roughness:.48,metalness:.25}),BAYS.length*BAGS);
 slats.name='Baggage_moving_slats';bags.name='Baggage_suit_packs';
 for(const o of [slats,bags]){o.instanceMatrix.setUsage(T.DynamicDrawUsage);o.frustumCulled=false;group.add(o);}
 const dummy=new T.Object3D();let travel=0;
 function pose(distance){
  for(const [mesh,count,y] of [[slats,SLATS,.81],[bags,BAGS,.83]]){
   BAYS.forEach(([x,z],bay)=>{for(let i=0;i<count;i++){
    const p=baggagePoint(distance+LAP*i/count+bay*.7);dummy.position.set(x+p.x,y,z+p.z);dummy.rotation.y=p.yaw;dummy.updateMatrix();mesh.setMatrixAt(bay*count+i,dummy.matrix);
   }});mesh.instanceMatrix.needsUpdate=true;
  }
 }
 pose(0);const centre=room.getWorldPosition(new T.Vector3());
 function update(dt,p){
  if(still||Math.abs(p.y-centre.y)>4||p.distanceToSquared(centre)>65*65)return;
  travel=(travel+Math.min(dt,.1)*SPEED)%LAP;pose(travel);
 }
 return {group,solid,update};
}
