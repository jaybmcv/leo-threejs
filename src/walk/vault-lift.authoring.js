import {joinStaticTints} from './static-tints.js';
import * as T from 'three';
import {VAULT_LIFT as V,vaultPassword} from './vault.authoring.js';
import {CLUBHOUSE_SHAFT,clubhouseDockMatrix} from '../v2/vault-lift-fit.js';
import {liftState,callLift,stepLift} from './lift-motion.js';
import {walkCanvas,hasWalkCanvas} from './canvas.js';

// The clubhouse lift is local to each visitor.
const {radius:R,carRadius:CAR,doorWidth:WIDTH,front:FRONT,reach:REACH}=CLUBHOUSE_SHAFT;
const H=2.6,TOP=10.8,ANGLE=Math.asin((WIDTH+.08)/2/R);
const frame=()=>{const g=new T.Group();g.applyMatrix4(clubhouseDockMatrix(V,0));g.updateMatrixWorld(true);return g;};

export function createVaultLift(colliders){
 const group=frame();group.name='Clubhouse_tube_lift';group.userData.keepLive=true;
 const solid=frame();solid.name='Clubhouse_tube_colliders';
 const docks=V.stops.map((_,i)=>clubhouseDockMatrix(V,i)),base=V.stops[0].y;
 const levels=V.stops.map(s=>s.y-base);
 const inverse=group.matrixWorld.clone().invert();
 const metal=new T.MeshStandardMaterial({name:'Clubhouse_lift_metal',color:0x111b29,metalness:.75,roughness:.32});
 const glass=new T.MeshStandardMaterial({name:'Clubhouse_lift_glass',color:0x479cda,transparent:true,opacity:.18,depthWrite:false,roughness:.15,side:T.DoubleSide});
 const blue=new T.MeshBasicMaterial({name:'Clubhouse_lift_glow',color:0x27cfff,toneMapped:false});
 const gateMat=glass.clone();gateMat.name='Clubhouse_lift_gate';gateMat.opacity=.5;
 const mesh=(name,geo,mat,parent=group)=>{const o=new T.Mesh(geo,mat);o.name=name;parent.add(o);return o;};
 const box=(name,w,h,d,x,y,z,mat=metal)=>mesh(name,new T.BoxGeometry(w,h,d).translate(x,y,z),mat);
 const proxy=geo=>mesh('Clubhouse_lift_solid',geo,metal,solid);
 const ring=(y,r=R,parent=group)=>mesh('Clubhouse_lift_glow',new T.TorusGeometry(r,.035,8,64).rotateX(Math.PI/2).translate(0,y,0),blue,parent);
 const casing=geo=>{mesh('Clubhouse_lift_glass',geo,glass);proxy(geo.clone());};

 // One glass shell surrounds the cab, with a front opening at each deck.
 casing(new T.CylinderGeometry(R,R,TOP,64,1,true,ANGLE,Math.PI*2-2*ANGLE).translate(0,TOP/2,0));
 for(const [i,y] of levels.entries()){
  ring(y+.06);
  ring(y+H+.08);
  const header=(levels[i+1]??TOP)-y-H;
  casing(new T.CylinderGeometry(R,R,header,16,1,true,-ANGLE,2*ANGLE).translate(0,y+H+header/2,0));
  for(const x of [-WIDTH/2,WIDTH/2])box('Clubhouse_lift_frame',.10,H,.09,x,y+H/2,FRONT);
 }
 const cap=new T.CylinderGeometry(R,R,.08,64).translate(0,TOP-.04,0);
 mesh('Clubhouse_lift_cap',cap,metal);proxy(cap.clone());
 for(const a of [.8,Math.PI,Math.PI*2-.8])box('Clubhouse_lift_glow',.035,TOP,.035,Math.sin(a)*(R+.02),TOP/2,Math.cos(a)*(R+.02),blue);
 joinStaticTints(group,[metal,blue]);

 const car=new T.Group();car.name='Clubhouse_lift_platform';group.add(car);
 const floor=new T.CylinderGeometry(CAR,CAR,.16,64).translate(0,-.08,0);
 mesh('Clubhouse_lift_floor',floor,metal,car);ring(-.03,CAR,car);
 const carAngle=Math.asin((WIDTH-.08)/2/CAR);
 const wall=new T.CylinderGeometry(CAR,CAR,H,48,1,true,carAngle,Math.PI*2-2*carAngle).translate(0,H/2,0);
 mesh('Clubhouse_lift_car_glass',wall,glass,car);
 const roof=new T.CylinderGeometry(CAR,CAR,.08,48).translate(0,H+.04,0);mesh('Clubhouse_lift_roof',roof,glass,car);
 ring(H,CAR,car);
 const spec={name:'Clubhouse tube lift',parked:17,stops:V.stops},lift={spec,stops:V.stops,...liftState(spec)};
 group.updateMatrixWorld(true);solid.updateMatrixWorld(true);
 const triangles=geo=>(geo.index?geo.toNonIndexed():geo).attributes.position.array;
 const mover=colliders.addMover('clubhouse-lift-car',Float32Array.from([floor,wall,roof].flatMap(g=>Array.from(triangles(g)))));
 const gateGeo=new T.BoxGeometry(WIDTH,H,.08).translate(0,H/2,FRONT),gateTriangles=triangles(gateGeo);
 const gates=docks.map(at=>({mesh:mesh('Clubhouse_lift_gate',gateGeo,gateMat),mover:colliders.addMover('clubhouse-lift-gate',gateTriangles,at)}));
 const carGate={mesh:mesh('Clubhouse_lift_car_gate',gateGeo,gateMat,car),mover:colliders.addMover('clubhouse-lift-car-gate',gateTriangles)};
 let display=null;
 if(hasWalkCanvas()){
  const c=walkCanvas();c.width=512;c.height=256;const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  const mat=new T.MeshBasicMaterial({name:'Clubhouse_lift_display',map:tex,toneMapped:false});
  levels.forEach(y=>mesh('Clubhouse_lift_display',new T.PlaneGeometry(1.5,.75),mat).position.set(0,y+H+.4,FRONT+.03));
  mesh('Clubhouse_lift_controls',new T.PlaneGeometry(.75,.375),mat,car).position.set(0,1.35,-CAR+.04);
  display=(deck,status)=>{
   const g=c.getContext('2d');g.fillStyle='#07131f';g.fillRect(0,0,512,256);g.fillStyle='#46d8ff';g.textAlign='center';
   g.font='bold 32px sans-serif';g.fillText('CLUBHOUSE',256,64);g.font='bold 50px sans-serif';g.fillText('DECK '+deck,256,132);
   g.font='24px sans-serif';g.fillText(status,256,190);tex.needsUpdate=true;
  };
 }
 let shown='',authorized=false,returning=false,carried=false,passwordSummon=false;
 const place=()=>{
  car.position.y=lift.y-base;car.updateMatrixWorld(true);mover.place(car.matrixWorld);
  const setGate=(g,y,open)=>{g.mesh.position.y=y+H*open;g.mesh.scale.y=1-open;g.mesh.visible=open<.999;g.mover.enabled=open<.99;};
  gates.forEach((g,i)=>setGate(g,levels[i],i===lift.at&&lift.phase!=='moving'&&(i>0||authorized)?lift.doors:0));
  setGate(carGate,0,lift.phase==='moving'||lift.at===0&&!authorized?0:lift.doors);carGate.mover.place(car.matrixWorld);
  const moving=lift.phase==='moving',deck=lift.stops.reduce((a,s)=>Math.abs(s.y-lift.y)<Math.abs(a.y-lift.y)?s:a).deck;
  const key=deck+'|'+moving;if(key!==shown){shown=key;display?.(deck,moving?'IN TRANSIT':'17 / 18 / 19');}
 };
 const q=new T.Vector3(),local=p=>q.copy(p).applyMatrix4(inverse);
 const inside=p=>{const v=local(p);return Math.hypot(v.x,v.z)<CAR-.12&&Math.abs(p.y-lift.y)<.6;};
 const api={group,solid,lift,inside,docks,
  get authorized(){return authorized;},
  unlock(code){
   if(!vaultPassword(code))return false;
   authorized=true;passwordSummon=lift.at!==0||lift.phase==='moving';callLift(lift,0);place();return true;
  },
  get riding(){return lift.phase==='moving'&&carried;},
  // Upper landings may summon the locked cab. The lounge's password still controls entry there.
  call(l,index,opts){if(!authorized&&lift.at===0&&index>0&&opts?.now)return;if(l!==lift||!Number.isInteger(index)||index<0||index>=docks.length)return;callLift(lift,index,opts);},
  stopsOf:()=>lift.stops.map((s,i)=>({index:i,label:s.label,here:i===lift.at&&lift.phase!=='moving'})),
  nearest(p){
   const v=local(p),i=levels.findIndex(y=>Math.abs(v.y-y)<.6);
   if(i===0&&!authorized&&Math.abs(v.x)<.85&&v.z>.2&&v.z<REACH)return {kind:'clubhouse-password',label:'Enter the vault password'};
   if(inside(p))return {kind:lift.phase==='moving'?'riding':'clubhouse-inside',lift,label:'Choose a clubhouse deck'};
   if(i<0||Math.abs(v.x)>.85||v.z<FRONT||v.z>REACH)return null;
   if(i===lift.at&&lift.phase!=='moving'&&lift.doors>.99)return null;
   return {kind:'clubhouse-call',lift,stop:i,label:lift.calls.has(i)?'Clubhouse lift coming':'Call the clubhouse lift'};
  },
  update(dt,w){
   carried=inside(w.position);if(carried&&lift.at>0)authorized=true;
   const {x,y,z}=local(w.position);
   // Keep a password summon active while the caller waits beside the Deck 17 door.
   if(passwordSummon){
    if(carried)passwordSummon=false;
    else if(Math.abs(y)>=.6||Math.abs(x)>WIDTH/2+.35||z<.2||z>=REACH){authorized=false;passwordSummon=false;}
   }
   if(returning&&!carried&&(z>FRONT+.6||Math.abs(x)>WIDTH/2+.35)){authorized=false;returning=false;}
   // Wait for a walker straddling the sill before closing either gate.
   const blocked=Math.abs(x)<WIDTH/2+.35&&Math.abs(z-FRONT)<.5&&Math.abs(w.position.y-lift.y)<.6;
   if(blocked&&(lift.phase==='closing'||lift.phase==='open'&&lift.calls.size)){lift.phase='open';lift.doors=1;lift.dwell=0;place();return;}
   const phase=lift.phase,dy=stepLift(lift,lift.stops,dt);
   if(phase==='moving'&&lift.phase==='opening'&&lift.at===0){
    // Keep access for an exiting rider or a visitor who summoned the cab with the password.
    if(!carried&&!passwordSummon)authorized=false;
    returning=carried;
   }
   if(carried&&dy){w.position.y+=dy;w.velocity.set(0,0,0);w.top=w.position.y;}
   place();
  },
 };
 place();return api;
}
