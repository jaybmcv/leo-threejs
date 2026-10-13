import * as T from 'three';
import {DECKS} from '../model.js';
import {LIFTS,carTriangles} from './lifts.js';

// Working lifts for walk mode. Each shaft gets a car that travels between its stops and a pair of sliding landing doors
// at every stop; both are movable colliders, so a closed door is a wall and the car floor carries the walker.
// Doors open when the car rests at a stop and close before it moves. Call a car from a landing; choose a stop inside.
const SPEED=5.5,ACCEL=2.6,DOOR_TIME=.9,LEAF_T=.08,DOOR_H=2.75;
const mats={
 floor:new T.MeshStandardMaterial({name:'Lift_floor',color:0xc4b89e,roughness:.7}),
 wall:new T.MeshStandardMaterial({name:'Lift_panel',color:0xe6e8e2,roughness:.5,metalness:.2}),
 roof:new T.MeshStandardMaterial({name:'Lift_roof',color:0x294858,roughness:.7}),
 glow:new T.MeshStandardMaterial({name:'Lift_glow',color:0xfff2d8,emissive:0xffe6bd,emissiveIntensity:1.1}),
 door:new T.MeshStandardMaterial({name:'Lift_door',color:0x8b9ea6,roughness:.38,metalness:.6}),
 panel:new T.MeshStandardMaterial({name:'Lift_call_panel',color:0x1b2830,emissive:0xf85800,emissiveIntensity:.55}),
};
const deckName=n=>DECKS.find(d=>d.number===n)?.name;
export const stopLabel=s=>s.deck?`Deck ${s.deck} · ${deckName(s.deck)}`:s.label;

function boxMesh(name,[w,h,d],[x,y,z],m,parent){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);parent.add(o);return o;}
const boxTris=(w,h,d)=>{const g=new T.BoxGeometry(w,h,d).toNonIndexed();g.translate(0,h/2,0);return Array.from(g.attributes.position.array);};

export function createLifts(scene,colliders){
 const lifts=LIFTS.map(spec=>{
  const {car:c}=spec,root=new T.Group();root.name='Walk_lift_'+spec.id;root.userData.keepLive=true;scene.add(root);
  // The car: floor, panelled walls, a lit roof and a control panel. A car opens on every face one of its stops uses
  // (the crown lift opens on its side at the fin platforms and at the front in the crown lounge).
  const car=new T.Group();root.add(car);
  const faceOf=d=>d.axis+d.sign,faces=[];
  for(const d of [spec.door,...spec.stops.map(s=>s.door).filter(Boolean)])if(!faces.some(f=>faceOf(f.door)===faceOf(d)))faces.push({door:d});
  boxMesh('Car_floor',[c.width,.2,c.depth],[0,-.1,0],mats.floor,car);
  boxMesh('Car_roof',[c.width,.12,c.depth],[0,c.height+.06,0],mats.roof,car);
  boxMesh('Car_light',[c.width*.6,.03,c.depth*.6],[0,c.height-.02,0],mats.glow,car);
  for(const [a,sg] of [['x',-1],['x',1],['z',-1],['z',1]]){if(faces.some(f=>faceOf(f.door)===a+sg))continue;
   if(a==='x')boxMesh('Car_wall',[.08,c.height,c.depth],[sg*(c.width/2-.04),c.height/2,0],mats.wall,car);else boxMesh('Car_wall',[c.width,c.height,.08],[0,c.height/2,sg*(c.depth/2-.04)],mats.wall,car);}
  // Car doors on each open face slide with the landing doors; a gate mover closes the face while they're shut.
  for(const f of faces){
   const d=f.door;f.side=d.axis==='z'?new T.Vector3(1,0,0):new T.Vector3(0,0,1);f.front=d.axis==='z'?new T.Vector3(0,0,d.sign):new T.Vector3(d.sign,0,0);
   f.half=(d.axis==='z'?c.depth:c.width)/2-.06;
   f.leaves=[-1,1].map(sg=>{const m=boxMesh('Car_door',d.axis==='z'?[d.width/2,c.height-.05,.05]:[.05,c.height-.05,d.width/2],[0,0,0],mats.door,car);m.geometry.translate(0,(c.height-.05)/2,0);return {s:sg,mesh:m};});
   f.gate=colliders.addMover(spec.id+'_gate',boxTris(...(d.axis==='z'?[c.width,c.height,.06]:[.06,c.height,c.depth])));
  }
  const main=faces[0],panel=boxMesh('Car_panel',main.door.axis==='z'?[.24,.5,.05]:[.05,.5,.24],[0,0,0],mats.panel,car);
  panel.position.copy(main.side).multiplyScalar((main.door.axis==='z'?c.width:c.depth)/2-.35).addScaledVector(main.front,main.half-.06).setY(1.25);
  const carMover=colliders.addMover(spec.id+'_car',carTriangles(spec,faces.map(f=>f.door)));
  // Landing doors: two leaves per stop, each its own mover so they can slide apart.
  const stops=spec.stops.map(stop=>{
   const d=stop.door||spec.door,frontOf=d.axis==='z'?new T.Vector3(0,0,d.sign):new T.Vector3(d.sign,0,0),along=d.axis==='z'?new T.Vector3(1,0,0):new T.Vector3(0,0,1);
   const half=(d.axis==='z'?c.depth:c.width)/2,base=new T.Vector3(c.x,stop.y,c.z).addScaledVector(frontOf,half+.14);
   const leaves=[-1,1].map(s=>{
    const size=d.axis==='z'?[d.width/2,DOOR_H,LEAF_T]:[LEAF_T,DOOR_H,d.width/2];
    const mesh=boxMesh('Landing_door',size,[0,0,0],mats.door,root);mesh.geometry.translate(0,DOOR_H/2,0);
    const mover=colliders.addMover(spec.id+'_door',boxTris(...size));
    return {s,mesh,mover};
   });
   return {...stop,base,along,leaves,callAt:base.clone().addScaledVector(frontOf,.9),width:d.width,frontOf,face:faceOf(d)};
  });
  const parked=Math.max(0,spec.stops.findIndex(s=>s.deck===spec.parked));// the crown lift waits at its lowest stop
  const lift={spec,root,car,carMover,faces,faceOf,stops,y:stops[parked].y,v:0,at:parked,target:parked,doors:1,phase:'open'};
  place(lift);return lift;
 });
 function place(l){
  // Nothing to move while the car rests with its doors still.
  const key=`${l.y}|${l.doors}|${l.phase}|${l.at}`;if(l.placed===key)return;l.placed=key;
  const c=l.spec.car;l.car.position.set(c.x,l.y,c.z);l.car.updateMatrixWorld(true);
  l.carMover.place(new T.Matrix4().makeTranslation(c.x,l.y,c.z));
  const here=l.stops[l.at];
  for(const f of l.faces){
   const shut=l.phase!=='moving'&&here.face===l.faceOf(f.door)?1-l.doors:1,dw=f.door.width;
   for(const leaf of f.leaves)leaf.mesh.position.copy(f.front).multiplyScalar(f.half).addScaledVector(f.side,leaf.s*(dw/4+(1-shut)*dw/2*.98));
   f.gate.enabled=shut>.5;const g=f.front.clone().multiplyScalar(f.half);f.gate.place(new T.Matrix4().makeTranslation(c.x+g.x,l.y,c.z+g.z));
  }
  l.stops.forEach((s,i)=>{const open=i===l.at&&l.phase!=='moving'?l.doors:0;
   for(const leaf of s.leaves){const p=s.base.clone().addScaledVector(s.along,leaf.s*(s.width/4+open*s.width/2*.98));leaf.mesh.position.copy(p);leaf.mesh.updateMatrixWorld(true);leaf.mover.place(new T.Matrix4().makeTranslation(p.x,p.y,p.z));}
  });
 }
 const inside=(l,p)=>{const c=l.spec.car;return Math.abs(p.x-c.x)<c.width/2-.1&&Math.abs(p.z-c.z)<c.depth/2-.1&&p.y>l.y-.6&&p.y<l.y+1.2;};
 return {
  lifts,inside,
  // Send a lift to stop `index`.
  call(l,index){if(index===l.at&&l.phase!=='moving'){if(l.doors<1)l.phase='opening';return;}l.target=index;if(l.phase!=='moving')l.phase='closing';},
  // Advance the cars and doors; `walker` is the controller, carried along when standing in a moving car.
  update(dt,walker){
   for(const l of lifts){
    const riding=inside(l,walker.position);
    if(l.phase==='closing'){l.doors=Math.max(0,l.doors-dt/DOOR_TIME);if(!l.doors)l.phase=l.target!==l.at?'moving':'closed';}
    else if(l.phase==='opening'){l.doors=Math.min(1,l.doors+dt/DOOR_TIME);if(l.doors===1)l.phase='open';}
    else if(l.phase==='moving'){
     const goal=l.stops[l.target].y,dir=Math.sign(goal-l.y),dist=Math.abs(goal-l.y);
     const vmax=Math.min(SPEED,Math.sqrt(2*ACCEL*dist)+.05);l.v=Math.min(vmax,l.v+ACCEL*dt);
     const prev=l.y;l.y+=dir*Math.min(dist,l.v*dt);
     if(riding){walker.position.y+=l.y-prev;walker.velocity.y=0;}
     if(Math.abs(goal-l.y)<1e-4){l.y=goal;l.v=0;l.at=l.target;l.phase='opening';}
    }
    place(l);
   }
  },
  // What the walker could use: a call button at a landing, or the panel inside a car.
  nearest(p){
   let best=null;
   for(const l of lifts){
    if(inside(l,p))return l.phase==='moving'?{lift:l,kind:'riding'}:{lift:l,kind:'inside',label:'Choose a deck'};
    l.stops.forEach((s,i)=>{const d=Math.hypot(p.x-s.callAt.x,p.z-s.callAt.z);
     if(d<2.2&&Math.abs(p.y-s.y)<.6&&(!best||d<best.d)&&!(i===l.at&&l.phase!=='moving'&&l.doors>0))best={lift:l,kind:'call',stop:i,d,label:'Call the lift'};});
   }
   return best;
  },
  stopsOf:l=>l.stops.map((s,i)=>({index:i,label:stopLabel(s),here:i===l.at&&l.phase!=='moving'})),
 };
}
