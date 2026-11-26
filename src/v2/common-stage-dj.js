import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import layout from '../plan/selected-layout.js';
import {Colliders} from '../walk/collision.js';
import {createStageDjSound} from './common-stage-dj-sound.js';

// The stage faces -X. In the booth frame +Z faces the audience and X spans the desk.
export const STAGE_DJ={at:[108.25,layout.decks[5].y+.36,30],yaw:-Math.PI/2,width:5.6,bpm:134};
const PINK=0xff238f,ORANGE=0xff702a,CYAN=0x36efff,DARK=0x111821,STEEL=0x8fa9b8;
const bow=x=>.15+.5*(1-(x/2.8)**2);
const point=(x,y,z)=>new T.Vector3(x,y,z);

export function stageDjCollider(){
 const list=[];
 for(let i=0;i<8;i++){const x=-2.45+i*.7;list.push(new T.BoxGeometry(.7,1.26,1.05).translate(x,.63,bow(x)));}
 list.push(new T.BoxGeometry(1.45,2.9,1.3).translate(.2,1.45,-1.05));
 const g=mergeGeometries(list);list.forEach(g=>g.dispose());return g;
}

export function createStageDj({colliders,phone=false,still=false}={}){
 const group=new T.Group();group.name='Common_stage_octopus_DJ';group.position.set(...STAGE_DJ.at);group.rotation.y=STAGE_DJ.yaw;
 const metal=new T.MeshStandardMaterial({vertexColors:true,metalness:.6,roughness:.38});
 const skin=new T.MeshStandardMaterial({vertexColors:true,emissive:PINK,emissiveIntensity:.28,roughness:.55,flatShading:true});
 const glow=new T.MeshStandardMaterial({color:CYAN,emissive:CYAN,emissiveIntensity:1.5,roughness:.3});
 const padsMat=glow.clone(),orange=new T.MeshStandardMaterial({color:ORANGE,emissive:ORANGE,emissiveIntensity:.5,flatShading:true});
 const glass=new T.MeshStandardMaterial({color:0x172339,metalness:.95,roughness:.12});
 const buckets=new Map();
 function put(parent,mat,g,colour=0xffffff){
  if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}
  if(mat.vertexColors){const c=new T.Color(colour),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3)c.toArray(a,i);g.setAttribute('color',new T.BufferAttribute(a,3));}
  let byMat=buckets.get(parent);if(!byMat)buckets.set(parent,byMat=new Map());let list=byMat.get(mat);if(!list)byMat.set(mat,list=[]);list.push(g);
 }
 const box=(p,m,size,at,c=DARK,tilt=0)=>put(p,m,new T.BoxGeometry(...size).rotateX(tilt).translate(...at),c);
 const ball=(p,m,size,at,c=PINK)=>put(p,m,new T.SphereGeometry(1,12,8).scale(...size).translate(...at),c);
 function bar(p,m,a,b,r=.035,c=STEEL){const d=b.clone().sub(a);put(p,m,new T.CylinderGeometry(r,r,d.length(),6).applyQuaternion(new T.Quaternion().setFromUnitVectors(point(0,1,0),d.normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray()),c);}
 const seat=point(.2,1.6,-.98),head=new T.Group(),arms=new T.Group(),stool=new T.Group();
 head.position.copy(seat);stool.position.set(seat.x,0,seat.z);
 stool.name='Common_stage_DJ_stool';group.add(head,arms,stool);
 // The stool fits inside the existing DJ collider.
 put(stool,metal,new T.CylinderGeometry(.23,.23,.09,16).translate(0,seat.y-.045,0),0x263541);
 put(stool,metal,new T.CylinderGeometry(.205,.205,.055,16).translate(0,seat.y-.1175,0),DARK);
 for(const x of[-1,1])for(const z of[-1,1]){
  bar(stool,metal,point(x*.13,seat.y-.135,z*.13),point(x*.24,.025,z*.24),.035,0x475864);
  put(stool,metal,new T.CylinderGeometry(.06,.06,.05,8).translate(x*.24,.025,z*.24),DARK);
 }
 put(stool,metal,new T.TorusGeometry(.297,.023,6,24).rotateX(Math.PI/2).translate(0,.53,0),0x527783);
 // A continuous curved worktop and an open triangular lattice beneath it.
 const shape=new T.Shape();shape.moveTo(-2.8,bow(-2.8)-.525);
 for(let i=0;i<=24;i++){const x=-2.8+i*5.6/24;shape.lineTo(x,bow(x)-.525);}
 for(let i=24;i>=0;i--){const x=-2.8+i*5.6/24;shape.lineTo(x,bow(x)+.525);}shape.closePath();
 put(group,metal,new T.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false}).rotateX(Math.PI/2).translate(0,1.26,0),0x263541);
 for(const zoff of[-.42,.42]){
  for(const h of[.12,1.13])for(let i=0;i<8;i++){const a=-2.8+i*.7,b=a+.7;bar(group,metal,point(a,h,bow(a)+zoff),point(b,h,bow(b)+zoff));}
  for(let i=0;i<=8;i++){const x=-2.8+i*.7;bar(group,metal,point(x,.12,bow(x)+zoff),point(x,1.13,bow(x)+zoff));if(i<8)bar(group,metal,point(x,.12,bow(x)+zoff),point(x+.7,1.13,bow(x+.7)+zoff),.026);}
 }
 for(const x of[-2.7,0,2.7])bar(group,metal,point(x,.12,bow(x)-.42),point(x,.12,bow(x)+.42));
 // Four decks, with tonearms, platters and small illuminated transport buttons.
 for(const x of[-2.15,-1.2,1.2,2.15]){
  const z=bow(x);box(group,metal,[.79,.09,.75],[x,1.305,z],0x0e1722);
  put(group,metal,new T.CylinderGeometry(.29,.29,.035,24).translate(x,1.367,z),STEEL);
  put(group,metal,new T.CylinderGeometry(.235,.235,.039,24).translate(x,1.37,z),0x10151c);
  put(group,glow,new T.CylinderGeometry(.065,.065,.042,12).translate(x,1.374,z));
  bar(group,metal,point(x+.29,1.39,z-.25),point(x+.18,1.39,z+.12),.012);
  box(group,glow,[.08,.018,.04],[x-.27,1.365,z+.29]);
 }
 box(group,metal,[.52,.12,.65],[0,1.32,.59]);
 for(let i=0;i<4;i++){box(group,metal,[.025,.02,.29],[-.18+i*.12,1.39,.57],STEEL);box(group,glow,[.06,.025,.04],[-.18+i*.12,1.41,.51+i*.035]);}
 // Two sixteen-pad controllers and two open, unbranded laptops.
 for(const x of[-.64,.64]){
  box(group,metal,[.48,.075,.48],[x,1.3,.7]);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)box(group,padsMat,[.082,.025,.082],[x-.15+i*.1,1.35,.55+j*.1]);
 }
 // The lids hinge on the audience edge, with the screens facing the DJ at -Z.
 const tilt=.2,screen=point(0,Math.sin(tilt),-Math.cos(tilt)).multiplyScalar(.024);
 for(const x of[-2.12,2.12]){
  const z=bow(x)-.41;box(group,metal,[.66,.035,.39],[x,1.4,z]);
  box(group,metal,[.68,.44,.035],[x,1.62,z+.2],DARK,tilt);
  box(group,glow,[.59,.34,.012],[x,1.62+screen.y,z+.2+screen.z],CYAN,tilt);
  for(let j=0;j<3;j++)box(group,metal,[.5,.008,.014],[x,1.422,z+.08-j*.065],STEEL);
 }
 // Cables stay inside the booth footprint, away from every walking route.
 for(const x of[-2.4,2.4])for(let i=0;i<3;i++){
  put(group,metal,new T.TorusGeometry(.17+i*.045,.016,4,20).translate(x,.55,bow(x)+.46),DARK);
  put(group,metal,new T.TorusGeometry(.21+i*.045,.016,4,20).rotateX(Math.PI/2).translate(x,.025,bow(x)),DARK);
  bar(group,metal,point(x,.78,bow(x)+.46),point(x,1.17,bow(x)+.46),.016,DARK);
 }
 // Eight separate curved arms fan out from the mantle and finish on eight controls.
 const targets=[[-2.15,bow(-2.15)],[-1.2,bow(-1.2)],[-.64,.7],[-.16,.64],[.16,.6],[.64,.7],[1.2,bow(1.2)],[2.15,bow(2.15)]];
 targets.forEach(([x,z],i)=>{
  // Lift the two lowest arm roots just above the seat rim.
  const a=(i/8)*Math.PI*2,lift=i===5||i===6?.12:0,start=point(.2+Math.cos(a)*.42,1.73+Math.sin(a)*.12+lift,-1.05+Math.sin(a)*.36);
  // The outside arms clear the open laptop lids before dropping onto the decks.
  const outside=i===0||i===7,curve=new T.CatmullRomCurve3([start,point(x*.65,outside?2.16:1.85+(i%3)*.08,-.55-(i%2)*.19),...(outside?[point(x,2.12,-.26),point(x*1.08,2.01,z+.09)]:[point(x*1.08,1.62,z-.35)]),point(x,1.43,z)]);
  // A tapered tube with flat faces; cups are merged into a single cyan mesh for all eight arms.
  const g=new T.TubeGeometry(curve,16,.15,6,false),pos=g.attributes.position;
  for(let j=0;j<=16;j++){const centre=curve.getPointAt(j/16),scale=1-.8*j/16;for(let k=0;k<=6;k++){const n=j*7+k;pos.setXYZ(n,centre.x+(pos.getX(n)-centre.x)*scale,centre.y+(pos.getY(n)-centre.y)*scale,centre.z+(pos.getZ(n)-centre.z)*scale);}}
  g.computeVertexNormals();put(arms,skin,g,i%2?ORANGE:PINK);
  for(let j=2;j<16;j+=2){const p=curve.getPointAt(j/16),r=.07*(1-.6*j/16);for(const side of[-1,1])put(arms,glow,new T.TorusGeometry(r,.017,4,8).rotateX(Math.PI/2).translate(p.x+side*r*.65,p.y-.13*(1-.8*j/16),p.z));}
 });
 ball(head,skin,[.65,.58,.55],[.2,2.2,-1.05]);
 ball(head,orange,[.47,.21,.43],[.2,1.81,-.98]);
 // Wide mirrored shades with a bridge, a black snapback and a thick headphone band.
 for(const x of[-.07,.47]){box(head,metal,[.5,.26,.12],[x,2.26,-.535]);box(head,glass,[.43,.18,.022],[x,2.27,-.463]);box(head,glow,[.28,.018,.014],[x,2.31,-.447]);}
 box(head,metal,[.12,.07,.1],[.2,2.3,-.52]);
 put(head,metal,new T.SphereGeometry(.64,12,5,0,Math.PI*2,0,Math.PI/2).scale(1,.52,.9).translate(.2,2.62,-1.05),0x0b1018);
 box(head,metal,[.95,.065,.49],[.2,2.63,-1.57],0x0b1018,.08);
 box(head,metal,[.22,.12,.035],[.2,2.67,-.465],STEEL);
 put(head,metal,new T.TorusGeometry(.67,.065,5,16,Math.PI).translate(.2,2.18,-1.05),DARK);
 for(const x of[-.49,.89]){ball(head,metal,[.14,.29,.25],[x,2.2,-1.05],DARK);ball(head,glow,[.15,.17,.14],[x,2.2,-1.05]);}
 for(const [parent,mats] of buckets)for(const [mat,list] of mats){
  const g=mergeGeometries(list);list.forEach(g=>g.dispose());
  if(parent===head)g.translate(-seat.x,-seat.y,-seat.z);
  const mesh=new T.Mesh(g,mat);mesh.userData.noCollide=true;parent.add(mesh);
 }
 group.updateMatrixWorld(true);
 if(colliders){
  // Local fittings own their small BVH; prepared collider factories only accept baked entries.
  const g=stageDjCollider(),flat=g.toNonIndexed(),mover=new Colliders().addMover('Common_stage_DJ_solid',flat.attributes.position.array,group.matrixWorld);
  colliders.movers.push(mover);g.dispose();flat.dispose();
 }
 const sound=createStageDjSound(STAGE_DJ),at=new T.Vector3(...STAGE_DJ.at);let time=0;
 return {group,head,arms,sound,targets,update(dt,p,on,camera){
  sound.update(p,on,camera);time+=dt;const near=p.distanceToSquared(at)<32**2;
  if(still||phone||!near)return;
  const beat=sound.beat??time*STAGE_DJ.bpm/60,pulse=Math.sin(beat*Math.PI*2);
  // Sway from the seat so the body stays in contact with it.
  head.rotation.z=.025*pulse;arms.position.y=.018*pulse;arms.rotation.z=.008*Math.sin(beat*Math.PI);
  padsMat.emissiveIntensity=1.1+.8*(.5+.5*Math.sin(beat*Math.PI*4));
 }};
}
