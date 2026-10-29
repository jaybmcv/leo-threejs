import * as T from 'three';
import {anchorObject} from '../plan/rooms.js';
import {cutOut} from '../cut-out.js';
import {VAULT_LIFT as V} from './vault.js';
import {liftState,callLift,stepLift} from './lift-motion.js';
import {walkCanvas,hasWalkCanvas} from './canvas.js';

// The clubhouse's own tube lift. Small enclosed landings are ready for the later upper floors.
// Like the vault door, this lift belongs to each visitor; it does not join the public lift shafts.
const R=1.7,CAR=1.56,H=2.6,TOP=10.9,FRONT=1.3,WIDTH=1.9,END=3.7;
const frame=()=>{const g=new T.Group();g.position.set(V.x,V.y,V.z);anchorObject(g,'commons-1');g.updateMatrixWorld(true);return g;};

// Only the tube's footprint is opened through the existing plates, before any colliders are gathered.
export function prepareVaultLift(ship){
 const g=frame(),box=new T.Box3(new T.Vector3(-R-.1,.25,-R-.1),new T.Vector3(R+.1,TOP,R+.1));
 cutOut(ship.inside,box,()=>true,g.matrixWorld.clone().invert());
}

export function createVaultLift(colliders){
 const group=frame();group.name='Clubhouse_tube_lift';group.userData.keepLive=true;
 const solid=frame();solid.name='Clubhouse_tube_colliders';
 const metal=new T.MeshStandardMaterial({name:'Clubhouse_lift_metal',color:0x111b29,metalness:.75,roughness:.32});
 const glass=new T.MeshStandardMaterial({name:'Clubhouse_lift_glass',color:0x479cda,transparent:true,opacity:.18,depthWrite:false,roughness:.15,side:T.DoubleSide});
 const blue=new T.MeshBasicMaterial({name:'Clubhouse_lift_glow',color:0x27cfff,toneMapped:false});
 const gateMat=glass.clone();gateMat.name='Clubhouse_lift_gate';gateMat.opacity=.5;
 const mesh=(name,geo,mat,parent=group)=>{const o=new T.Mesh(geo,mat);o.name=name;parent.add(o);return o;};
 const box=(name,w,h,d,x,y,z,mat=metal,parent=group)=>mesh(name,new T.BoxGeometry(w,h,d).translate(x,y,z),mat,parent);
 const proxy=(geo)=>mesh('Clubhouse_lift_solid',geo,metal,solid);
 const ring=(y,r=R,parent=group)=>mesh('Clubhouse_lift_glow',new T.TorusGeometry(r,.035,8,64).rotateX(Math.PI/2).translate(0,y,0),blue,parent);
 // A curved glass tube, with a wide portal facing inboard on each level.
 const shell=new T.CylinderGeometry(R,R,TOP,64,1,true,.65,Math.PI*2-1.3).translate(0,TOP/2,0);
 mesh('Clubhouse_lift_glass',shell,glass);proxy(shell.clone());
 for(const y of [0,4,8]){
  ring(y+.06);ring(y+H+.08);
  const cap=new T.CylinderGeometry(R,R,4-H,16,1,true,-.65,1.3).translate(0,y+(4+H)/2,0);
  if(y<8){mesh('Clubhouse_lift_glass',cap,glass);proxy(cap.clone());}
  for(const x of [-WIDTH/2,WIDTH/2])box('Clubhouse_lift_frame',.08,H,.09,x,y+H/2,FRONT);
  // The later clubhouse floors will replace these small glass enclosures; no open edge or public entrance yet.
  if(y){
   box('Clubhouse_lift_landing',2.4,.12,END-FRONT,0,y-.06,(END+FRONT)/2);
   proxy(new T.BoxGeometry(2.4,.12,END-FRONT).translate(0,y-.06,(END+FRONT)/2));
   for(const [w,h,d,x,dy,z] of [[.08,H,END-FRONT,-1.2,H/2,(END+FRONT)/2],[.08,H,END-FRONT,1.2,H/2,(END+FRONT)/2],[2.4,H,.08,0,H/2,END],[2.4,.08,END-FRONT,0,H,(END+FRONT)/2]]){
    box('Clubhouse_lift_landing_glass',w,h,d,x,y+dy,z,glass);proxy(new T.BoxGeometry(w,h,d).translate(x,y+dy,z));}
   // Close the cut plate's square corners around the circular shaft.
   const shape=new T.Shape([new T.Vector2(-R-.1,-R-.1),new T.Vector2(R+.1,-R-.1),new T.Vector2(R+.1,R+.1),new T.Vector2(-R-.1,R+.1)]);
   shape.holes.push(new T.Path().absarc(0,0,R,0,Math.PI*2,true));
   const collar=new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,y,0);mesh('Clubhouse_lift_collar',collar,metal);proxy(collar.clone());
  }
 }
 for(const a of [.8,Math.PI,Math.PI*2-.8])box('Clubhouse_lift_glow',.035,TOP,.035,Math.sin(a)*(R+.02),TOP/2,Math.cos(a)*(R+.02),blue);
 const car=new T.Group();car.name='Clubhouse_lift_platform';group.add(car);
 const floor=new T.CylinderGeometry(CAR,CAR,.16,64).translate(0,-.08,0);
 mesh('Clubhouse_lift_floor',floor,metal,car);ring(-.03,CAR,car);
 const wall=new T.CylinderGeometry(CAR,CAR,H,48,1,true,.65,Math.PI*2-1.3).translate(0,H/2,0);
 mesh('Clubhouse_lift_car_glass',wall,glass,car);
 const roof=new T.CylinderGeometry(CAR,CAR,.08,48).translate(0,H+.04,0);mesh('Clubhouse_lift_roof',roof,glass,car);
 ring(H,CAR,car);
 const spec={name:'Clubhouse tube lift',parked:17,stops:V.stops},lift={spec,stops:V.stops,...liftState(spec)};
 group.updateMatrixWorld(true);solid.updateMatrixWorld(true);
 const matrix=new T.Matrix4(),at=(x,y,z)=>matrix.copy(group.matrixWorld).multiply(new T.Matrix4().makeTranslation(x,y,z));
 const triangles=geo=>{const g=geo.index?geo.toNonIndexed():geo;return g.attributes.position.array;};
 const carGeo=[floor,wall,roof].map(g=>g.index?g.toNonIndexed():g),positions=[];
 for(const g of carGeo)positions.push(...g.attributes.position.array);
 const mover=colliders.addMover('clubhouse-lift-car',positions);
 const gateGeo=new T.BoxGeometry(WIDTH,H,.08).translate(0,H/2,FRONT),gates=[];
 for(const y of [0,4,8])gates.push({y,mesh:mesh('Clubhouse_lift_gate',gateGeo.clone(),gateMat),mover:colliders.addMover('clubhouse-lift-gate',triangles(gateGeo),at(0,y,0))});
 const carGate={mesh:mesh('Clubhouse_lift_car_gate',gateGeo.clone(),gateMat),mover:colliders.addMover('clubhouse-lift-car-gate',triangles(gateGeo))};
 let display=null;
 if(hasWalkCanvas()){
  const c=walkCanvas();c.width=512;c.height=256;const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  const mat=new T.MeshBasicMaterial({name:'Clubhouse_lift_display',map:tex,toneMapped:false});
  for(const y of [0,4,8]){const o=mesh('Clubhouse_lift_display',new T.PlaneGeometry(1.5,.75),mat);o.position.set(0,y+H+.48,FRONT+.03);}
  const o=mesh('Clubhouse_lift_controls',new T.PlaneGeometry(.75,.375),mat,car);o.position.set(0,1.35,-CAR+.04);
  display=()=>{const g=c.getContext('2d'),level=lift.stops.reduce((a,s,i)=>Math.abs(s.y-lift.y)<Math.abs(lift.stops[a].y-lift.y)?i:a,0);
   g.fillStyle='#07131f';g.fillRect(0,0,512,256);g.fillStyle='#46d8ff';g.textAlign='center';g.font='bold 32px sans-serif';g.fillText('CLUBHOUSE',256,64);
   g.font='bold 50px sans-serif';g.fillText(`DECK ${lift.stops[level].deck}`,256,132);g.font='24px sans-serif';g.fillText(lift.phase==='moving'?'IN TRANSIT':'17 / 18 / 19',256,190);tex.needsUpdate=true;};
 }
 let shown='';
 const place=()=>{
  car.position.y=lift.y-V.y;car.updateMatrixWorld(true);mover.place(car.matrixWorld);
  const setGate=(g,y,open)=>{g.mesh.position.y=y+H*open;g.mesh.scale.y=1-open;g.mesh.visible=open<.999;g.mover.place(at(0,y,0));g.mover.enabled=open<.99;};
  gates.forEach((g,i)=>setGate(g,g.y,i===lift.at&&lift.phase!=='moving'?lift.doors:0));
  setGate(carGate,lift.y-V.y,lift.phase==='moving'?0:lift.doors);
  const key=`${Math.round(lift.y)}|${lift.phase}`;if(key!==shown){shown=key;display?.();}
 };
 const q=new T.Vector3(),inverse=group.matrixWorld.clone().invert(),local=p=>q.copy(p).applyMatrix4(inverse);
 const inside=p=>{const p0=local(p);return Math.hypot(p0.x,p0.z)<CAR-.12&&Math.abs(p0.y-(lift.y-V.y))<.6;};
 const api={group,solid,lift,inside,
  get riding(){return lift.phase==='moving'&&carried;},
  call(l,index,opts){if(l!==lift||!Number.isInteger(index)||index<0||index>=3)return;callLift(lift,index,opts);},
  stopsOf:()=>lift.stops.map((s,i)=>({index:i,label:`Deck ${s.deck}`,here:i===lift.at&&lift.phase!=='moving'})),
  nearest(p){
   if(inside(p))return {kind:lift.phase==='moving'?'riding':'clubhouse-inside',lift,label:'Choose a clubhouse deck'};
   const v=local(p),i=lift.stops.findIndex(s=>Math.abs(v.y-(s.y-V.y))<.6);
   if(i<0||Math.abs(v.x)>.85||v.z<FRONT||v.z>END-.15)return null;
   if(i===lift.at&&lift.phase!=='moving'&&lift.doors>.99)return null;
   return {kind:'clubhouse-call',lift,stop:i,label:lift.calls.has(i)?'Clubhouse lift coming':'Call the clubhouse lift'};
  },
  update(dt,w){
   carried=inside(w.position);const v=local(w.position),y=lift.y-V.y;
   // Wait for a walker straddling the sill before closing either gate.
   const blocked=Math.abs(v.x)<WIDTH/2+.35&&Math.abs(v.z-FRONT)<.5&&Math.abs(v.y-y)<.6;
   if(blocked&&(lift.phase==='closing'||lift.phase==='open'&&lift.calls.size)){lift.phase='open';lift.doors=1;lift.dwell=0;place();return;}
   const rose=stepLift(lift,lift.stops,dt);if(carried&&rose){w.position.y+=rose;w.velocity.set(0,0,0);}
   place();
  },
 };
 let carried=false;place();return api;
}
