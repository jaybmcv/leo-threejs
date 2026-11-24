import {joinStaticTints} from './static-tints.js';
import * as T from 'three';
import {anchorObject} from '../plan/rooms.js';
import {cutOut} from '../cut-out.js';
import {VAULT_LIFT as V,vaultPassword} from './vault.authoring.js';
import {clubhouseDockMatrix} from '../v2/vault-lift-fit.js';
import {liftState,callLift,stepLift} from './lift-motion.js';
import {walkCanvas,hasWalkCanvas} from './canvas.js';

// The clubhouse's lounge cab connects to its existing enclosed upper landings.
// Like the vault door, this lift belongs to each visitor; it does not join the public lift shafts.
const R=1.7,CAR=1.56,H=2.6,TOP=10.9,FRONT=1.3,WIDTH=1.9,END=3.7;
const frame=()=>{const g=new T.Group();g.position.set(V.x,V.y,V.z);anchorObject(g,'commons-1');g.updateMatrixWorld(true);return g;};

// Keep the upper arrival collars; restore the old ground walls and leave the lounge galleries intact.
export function prepareVaultLift(ship){
 const g=frame(),box=new T.Box3(new T.Vector3(-R-.1,3.7,-R-.1),new T.Vector3(R+.1,TOP,R+.1));
 cutOut(ship.inside,box,()=>true,g.matrixWorld.clone().invert());
 // The new cab and its approach must also clear fitted interior partitions before collision is baked.
 const entry=new T.Box3(new T.Vector3(-R-.02,.01,-R-.02),new T.Vector3(R+.02,3.5,3.3));
 cutOut(ship.inside,entry,o=>/wall|lining|partition/i.test(o.name)&&!/hull|pressure|outer_room|aquarium/i.test(o.name)&&!o.userData.noCollide,clubhouseDockMatrix(V,0).invert());
}

export function createVaultLift(colliders){
 const group=frame();group.name='Clubhouse_tube_lift';group.userData.keepLive=true;
 const docks=V.stops.map((_,i)=>clubhouseDockMatrix(V,i)),inverseRoot=group.matrixWorld.clone().invert();
 const dockLocal=docks.map(m=>inverseRoot.clone().multiply(m));
 const lounge=new T.Group();lounge.matrixAutoUpdate=false;lounge.matrix.copy(dockLocal[0]);group.add(lounge);
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
 const shell=new T.CylinderGeometry(R,R,TOP-4,64,1,true,.65,Math.PI*2-1.3).translate(0,(TOP+4)/2,0);
 mesh('Clubhouse_lift_glass',shell,glass);proxy(shell.clone());
 for(const y of [4,8]){
  ring(y+.06);ring(y+H+.08);
  const cap=new T.CylinderGeometry(R,R,4-H,16,1,true,-.65,1.3).translate(0,y+(4+H)/2,0);
  if(y<8){mesh('Clubhouse_lift_glass',cap,glass);proxy(cap.clone());}
  for(const x of [-WIDTH/2,WIDTH/2])box('Clubhouse_lift_frame',.08,H,.09,x,y+H/2,FRONT);
  // The later clubhouse floors will replace these small glass enclosures; no open edge or public entrance yet.
  if(y){
   box('Clubhouse_lift_landing',2.4,.12,END-FRONT,0,y-.06,(END+FRONT)/2);
   proxy(new T.BoxGeometry(2.4,.12,END-FRONT).translate(0,y-.06,(END+FRONT)/2));
   for(const [w,h,d,x,dy,z] of [[.08,H,.58,-1.2,H/2,FRONT+.29],[.08,H,.38,-1.2,H/2,END-.19],[.08,.25,1.44,-1.2,H-.125,2.6],[.08,H,END-FRONT,1.2,H/2,(END+FRONT)/2],[2.4,H,.08,0,H/2,END],[2.4,.08,END-FRONT,0,H,(END+FRONT)/2]]){
    box('Clubhouse_lift_landing_glass',w,h,d,x,y+dy,z,glass);proxy(new T.BoxGeometry(w,h,d).translate(x,y+dy,z));}
   // Close the cut plate's square corners on top, underneath and along the shaft's rim.
   const shape=new T.Shape([new T.Vector2(-R-.1,-R-.1),new T.Vector2(R+.1,-R-.1),new T.Vector2(R+.1,R+.1),new T.Vector2(-R-.1,R+.1)]);
   shape.holes.push(new T.Path().absarc(0,0,R,0,Math.PI*2,true));
   const collar=new T.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:false,curveSegments:32}).rotateX(-Math.PI/2).translate(0,y-.3,0);mesh('Clubhouse_lift_collar',collar,metal);proxy(collar.clone());
  }
 }
 for(const a of [.8,Math.PI,Math.PI*2-.8])box('Clubhouse_lift_glow',.035,TOP-4,.035,Math.sin(a)*(R+.02),(TOP+4)/2,Math.cos(a)*(R+.02),blue);
 const lowerShell=new T.CylinderGeometry(R,R,H+.08,64,1,true,.65,Math.PI*2-1.3).translate(0,(H+.08)/2,0);
 mesh('Clubhouse_lounge_casing',lowerShell,glass,lounge);
 const lowerRoof=new T.CylinderGeometry(R,R,.1,64).translate(0,H+.13,0);mesh('Clubhouse_lounge_roof',lowerRoof,metal,lounge);proxy(lowerRoof.clone().applyMatrix4(dockLocal[0]));
 proxy(lowerShell.clone().applyMatrix4(dockLocal[0]));
 for(const x of [-WIDTH/2,WIDTH/2])box('Clubhouse_lift_frame',.08,H,.09,x,H/2,FRONT,metal,lounge);
 // The landing frames, collars and glow strips have independent walk colliders.
 joinStaticTints(group, [metal]);
 joinStaticTints(group, [blue]);
 joinStaticTints(lounge, [metal]);
 const car=new T.Group();car.name='Clubhouse_lift_platform';group.add(car);
 const floor=new T.CylinderGeometry(CAR,CAR,.16,64).translate(0,-.08,0);
 mesh('Clubhouse_lift_floor',floor,metal,car);ring(-.03,CAR,car);
 const wall=new T.CylinderGeometry(CAR,CAR,H,48,1,true,.65,Math.PI*2-1.3).translate(0,H/2,0);
 mesh('Clubhouse_lift_car_glass',wall,glass,car);
 const roof=new T.CylinderGeometry(CAR,CAR,.08,48).translate(0,H+.04,0);mesh('Clubhouse_lift_roof',roof,glass,car);
 ring(H,CAR,car);
 const spec={name:'Clubhouse tube lift',parked:17,stops:V.stops},lift={spec,stops:V.stops,...liftState(spec)};
 group.updateMatrixWorld(true);solid.updateMatrixWorld(true);
 const at=(i)=>docks[i];
 const triangles=geo=>{const g=geo.index?geo.toNonIndexed():geo;return g.attributes.position.array;};
 const carGeo=[floor,wall,roof].map(g=>g.index?g.toNonIndexed():g),positions=[];
 for(const g of carGeo)positions.push(...g.attributes.position.array);
 const mover=colliders.addMover('clubhouse-lift-car',positions);
 const gateGeo=new T.BoxGeometry(WIDTH,H,.08).translate(0,H/2,FRONT),gates=[];
 for(let i=0;i<3;i++)gates.push({mesh:mesh('Clubhouse_lift_gate',gateGeo.clone(),gateMat),mover:colliders.addMover('clubhouse-lift-gate',triangles(gateGeo),at(i))});
 const carGate={mesh:mesh('Clubhouse_lift_car_gate',gateGeo.clone(),gateMat),mover:colliders.addMover('clubhouse-lift-car-gate',triangles(gateGeo))};
 let display=null;
 if(hasWalkCanvas()){
  const c=walkCanvas();c.width=512;c.height=256;const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  const mat=new T.MeshBasicMaterial({name:'Clubhouse_lift_display',map:tex,toneMapped:false});
  for(let i=0;i<3;i++){const o=mesh('Clubhouse_lift_display',new T.PlaneGeometry(1.5,.75),mat),m=dockLocal[i].clone().multiply(new T.Matrix4().makeTranslation(0,H+.48,FRONT+.03));o.applyMatrix4(m);}
  const o=mesh('Clubhouse_lift_controls',new T.PlaneGeometry(.75,.375),mat,car);o.position.set(0,1.35,-CAR+.04);
  display=()=>{const g=c.getContext('2d'),level=lift.stops.reduce((a,s,i)=>Math.abs(s.y-lift.y)<Math.abs(lift.stops[a].y-lift.y)?i:a,0);
   g.fillStyle='#07131f';g.fillRect(0,0,512,256);g.fillStyle='#46d8ff';g.textAlign='center';g.font='bold 32px sans-serif';g.fillText('CLUBHOUSE',256,64);
   g.font='bold 50px sans-serif';g.fillText(`DECK ${lift.stops[level].deck}`,256,132);g.font='24px sans-serif';g.fillText(lift.phase==='moving'?'IN TRANSIT':'17 / 18 / 19',256,190);tex.needsUpdate=true;};
 }
 let shown='',dock=0,authorized=false,returning=false;
 const place=()=>{
  car.matrixAutoUpdate=false;car.matrix.copy(dockLocal[dock]);car.updateMatrixWorld(true);mover.place(car.matrixWorld);
  const setGate=(g,i,open)=>{g.mesh.matrixAutoUpdate=false;g.mesh.matrix.copy(dockLocal[i]).multiply(new T.Matrix4().makeTranslation(0,H*open,0)).multiply(new T.Matrix4().makeScale(1,1-open,1));g.mesh.visible=open<.999;g.mover.place(at(i));g.mover.enabled=open<.99;};
  gates.forEach((g,i)=>setGate(g,i,i===lift.at&&lift.phase!=='moving'&&(i>0||authorized)?lift.doors:0));
  setGate(carGate,dock,lift.phase==='moving'||dock===0&&!authorized?0:lift.doors);
  const key=`${lift.at}|${lift.phase}`;if(key!==shown){shown=key;display?.();}
 };
 const q=new T.Vector3(),local=(p,i=dock)=>q.copy(p).applyMatrix4(docks[i].clone().invert());
 const inside=p=>{const p0=local(p);return Math.hypot(p0.x,p0.z)<CAR-.12&&Math.abs(p0.y)<.6;};
 const api={group,solid,lift,inside,docks,
  get authorized(){return authorized;},
  unlock(code){if(!vaultPassword(code))return false;authorized=true;callLift(lift,0);place();return true;},
  get riding(){return lift.phase==='moving'&&carried;},
  // Upper landings may summon the locked cab; in-car departures still require access.
  call(l,index,opts){if(!authorized&&dock===0&&index>0&&opts?.now)return;if(l!==lift||!Number.isInteger(index)||index<0||index>=3)return;callLift(lift,index,opts);},
  stopsOf:()=>lift.stops.map((s,i)=>({index:i,label:`Deck ${s.deck}`,here:i===lift.at&&lift.phase!=='moving'})),
  nearest(p){
   const ground=local(p,0);
   if(!authorized&&Math.abs(ground.y)<.6&&Math.abs(ground.x)<.85&&ground.z>.2&&ground.z<END-.15)return {kind:'clubhouse-password',label:'Enter the vault password'};
   if(inside(p))return {kind:lift.phase==='moving'?'riding':'clubhouse-inside',lift,label:'Choose a clubhouse deck'};
   const i=lift.stops.findIndex((s,i)=>Math.abs(local(p,i).y)<.6&&Math.abs(q.x)<.85&&q.z>=FRONT&&q.z<=END-.15),v=i<0?q:local(p,i);
   if(i<0||Math.abs(v.x)>.85||v.z<FRONT||v.z>END-.15)return null;
   if(i===lift.at&&lift.phase!=='moving'&&lift.doors>.99)return null;
   return {kind:'clubhouse-call',lift,stop:i,label:lift.calls.has(i)?'Clubhouse lift coming':'Call the clubhouse lift'};
  },
  update(dt,w){
   carried=inside(w.position);if(carried&&dock>0)authorized=true;const v=local(w.position).clone(),y=0;
   if(returning&&!carried&&v.z>FRONT+.6){authorized=false;returning=false;}
   // Wait for a walker straddling the sill before closing either gate.
   const blocked=Math.abs(v.x)<WIDTH/2+.35&&Math.abs(v.z-FRONT)<.5&&Math.abs(v.y-y)<.6;
   if(blocked&&(lift.phase==='closing'||lift.phase==='open'&&lift.calls.size)){lift.phase='open';lift.doors=1;lift.dwell=0;place();return;}
   stepLift(lift,lift.stops,dt);
   // Transfer only with both gates shut; never cut a shaft through the lounge galleries.
   if(lift.phase==='opening'&&dock!==lift.at){const old=dock;dock=lift.at;if(dock===0)returning=true;if(carried){w.position.applyMatrix4(docks[old].clone().invert()).applyMatrix4(docks[dock]);w.velocity.set(0,0,0);w.top=w.position.y;}}
   place();
  },
 };
 let carried=false;place();return api;
}
