import * as T from 'three';
import {DECKS} from '../model.js';
import {LIFTS,carTriangles} from './lifts.js';
import {liftState,callLift,stepLift,applyLiftWire} from './lift-motion.js';
import {liftDisplay,stopShort,landingSigns,liftDisplayMount,callLight} from './signs.js';

// Working lifts for walk mode. Each shaft gets a car that travels between its stops and a pair of sliding landing doors
// at every stop; both are movable colliders, so a closed door is a wall and the car floor carries the walker.
// Doors open when the car rests at a stop and close before it moves (lift-motion.js, shared with the multiplayer
// server). Call a car from a landing; choose a stop inside.
// Every landing has a deck plaque, a call light that stays lit until the car arrives, and a display of where the car is.
const LEAF_T=.08,DOOR_H=2.75;
const mats={
 floor:new T.MeshStandardMaterial({name:'Lift_floor',color:0xc4b89e,roughness:.7}),
 wall:new T.MeshStandardMaterial({name:'Lift_panel',color:0xffffff,roughness:.6,emissive:0xffffff,emissiveIntensity:.7}),
 glass:new T.MeshStandardMaterial({name:'Lift_glass',color:0xb4d4de,roughness:.1,metalness:.1,transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide}),
 roof:new T.MeshStandardMaterial({name:'Lift_roof',color:0x294858,roughness:.7}),
 glow:new T.MeshStandardMaterial({name:'Lift_glow',color:0xfff2d8,emissive:0xffe6bd,emissiveIntensity:1.1}),
 door:new T.MeshStandardMaterial({name:'Lift_door',color:0x8b9ea6,roughness:.38,metalness:.6}),
 panel:new T.MeshStandardMaterial({name:'Lift_call_panel',color:0x1b2830,emissive:0xf85800,emissiveIntensity:.55}),
};
// The car walls are a black starfield, with a big Mars on the back wall. Both are drawn once on small canvases.
function starTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');let seed=4401;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 g.fillStyle='#03050b';g.fillRect(0,0,512,512);
 for(let i=0;i<420;i++){const r=rnd()**4*1.8+.4,b=150+rnd()*105|0;g.fillStyle=`rgba(${b},${b},${Math.min(255,b+20)},${.5+rnd()*.5})`;g.beginPath();g.arc(rnd()*512,rnd()*512,r,0,Math.PI*2);g.fill();}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(2,2);return t;
}
function marsTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d'),r=256;let seed=1976;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 g.beginPath();g.arc(r,r,r,0,Math.PI*2);g.clip();
 const base=g.createLinearGradient(0,0,0,512);base.addColorStop(0,'#c98a5e');base.addColorStop(.5,'#c0643a');base.addColorStop(1,'#b8764e');g.fillStyle=base;g.fillRect(0,0,512,512);
 // Dark albedo regions, Valles Marineris and the polar caps, as on the big Mars outside (mars.js).
 g.filter='blur(8px)';
 for(let i=0;i<26;i++){g.fillStyle=`rgba(${70+rnd()*30|0},${28+rnd()*14|0},${14+rnd()*10|0},${.2+rnd()*.3})`;g.beginPath();g.ellipse(rnd()*512,130+rnd()*250,20+rnd()*90,10+rnd()*40,rnd()*Math.PI,0,Math.PI*2);g.fill();}
 g.filter='blur(3px)';g.strokeStyle='rgba(60,22,10,.55)';g.lineWidth=7;g.beginPath();g.moveTo(150,276);g.bezierCurveTo(210,258,280,300,360,284);g.stroke();
 g.fillStyle='rgba(246,240,232,.9)';g.beginPath();g.ellipse(r,8,150,34,0,0,Math.PI*2);g.fill();g.beginPath();g.ellipse(r,506,110,22,0,0,Math.PI*2);g.fill();
 // Sunlit from the upper left, with a dark night side.
 g.filter='none';const sh=g.createRadialGradient(170,160,40,220,220,330);sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(.6,'rgba(0,0,0,.15)');sh.addColorStop(1,'rgba(0,0,0,.88)');
 g.fillStyle=sh;g.fillRect(0,0,512,512);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
let carArt=null;
const art=()=>{if(!carArt){const stars=starTexture();mats.wall.map=mats.wall.emissiveMap=stars;mats.wall.needsUpdate=true;
 carArt=new T.MeshBasicMaterial({name:'Lift_mars',map:marsTexture()});}return carArt;};
const deckName=n=>DECKS.find(d=>d.number===n)?.name;
export const stopLabel=s=>s.deck?`Deck ${s.deck} · ${deckName(s.deck)}`:s.label;

function boxMesh(name,[w,h,d],[x,y,z],m,parent){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);parent.add(o);return o;}
const boxTris=(w,h,d)=>{const g=new T.BoxGeometry(w,h,d).toNonIndexed();g.translate(0,h/2,0);return Array.from(g.attributes.position.array);};

export function createLifts(scene,colliders){
 // Signs go on the walls before this lift's doors exist, so a ray finds the wall and not a door leaf.
 const signs=new T.Group();signs.name='Walk_lift_signs';scene.add(signs);
 const lifts=LIFTS.map(spec=>{
  const {car:c}=spec,root=new T.Group();root.name='Walk_lift_'+spec.id;root.userData.keepLive=true;scene.add(root);
  // The car: floor, panelled walls, a lit roof and a control panel. A car opens on every face one of its stops uses
  // (the crown lift opens on its side at the fin platforms and at the front in the crown lounge). In the passenger lifts
  // the wall opposite the main doors is glass, so riders watch the decks (or the fin) go by.
  const car=new T.Group();root.add(car);
  const faceOf=d=>d.axis+d.sign,faces=[];
  for(const d of [spec.door,...spec.stops.map(s=>s.door).filter(Boolean)])if(!faces.some(f=>faceOf(f.door)===faceOf(d)))faces.push({door:d});
  boxMesh('Car_floor',[c.width,.2,c.depth],[0,-.1,0],mats.floor,car);
  boxMesh('Car_roof',[c.width,.12,c.depth],[0,c.height+.06,0],mats.roof,car);
  boxMesh('Car_light',[c.width*.6,.03,c.depth*.6],[0,c.height-.02,0],mats.glow,car);
  const glass=spec.id==='aft-service'?null:faceOf({axis:spec.door.axis,sign:-spec.door.sign});
  for(const [a,sg] of [['x',-1],['x',1],['z',-1],['z',1]]){if(faces.some(f=>faceOf(f.door)===a+sg))continue;const m=a+sg===glass?mats.glass:mats.wall;
   if(a==='x')boxMesh('Car_wall',[.08,c.height,c.depth],[sg*(c.width/2-.04),c.height/2,0],m,car);else boxMesh('Car_wall',[c.width,c.height,.08],[0,c.height/2,sg*(c.depth/2-.04)],m,car);}
  // Mars fills most of a starfield wall, just in front of its inner face, facing `b`: opposite the crown lounge door on
  // the crown lift, where riders board it; on a side wall where the wall opposite the door is the glass.
  {const t=faces.at(-1).door,b=faceOf({axis:t.axis,sign:-t.sign})===glass?{axis:t.axis==='x'?'z':'x',sign:-1}:t;
   const across=b.axis==='x'?c.depth:c.width,mars=new T.Mesh(new T.CircleGeometry(Math.min(across,c.height)*.4,64),art());
   mars.name='Car_mars';mars.position.y=c.height*.52;mars.position[b.axis]=-b.sign*((b.axis==='x'?c.width:c.depth)/2-.085);
   mars.rotation.y=b.axis==='x'?b.sign*Math.PI/2:(b.sign>0?0:Math.PI);car.add(mars);}
  // Car doors on each open face slide with the landing doors; a gate mover closes the face while they're shut.
  for(const f of faces){
   const d=f.door;f.side=d.axis==='z'?new T.Vector3(1,0,0):new T.Vector3(0,0,1);f.front=d.axis==='z'?new T.Vector3(0,0,d.sign):new T.Vector3(d.sign,0,0);
   f.half=(d.axis==='z'?c.depth:c.width)/2-.06;
   f.leaves=[-1,1].map(sg=>{const m=boxMesh('Car_door',d.axis==='z'?[d.width/2,c.height-.05,.05]:[.05,c.height-.05,d.width/2],[0,0,0],mats.door,car);m.geometry.translate(0,(c.height-.05)/2,0);return {s:sg,mesh:m};});
   f.gate=colliders.addMover(spec.id+'_gate',boxTris(...(d.axis==='z'?[c.width,c.height,.06]:[.06,c.height,c.depth])));
  }
  const main=faces[0],panel=boxMesh('Car_panel',main.door.axis==='z'?[.24,.5,.05]:[.05,.5,.24],[0,0,0],mats.panel,car);
  panel.position.copy(main.side).multiplyScalar((main.door.axis==='z'?c.width:c.depth)/2-.35).addScaledVector(main.front,main.half-.06).setY(1.25);
  const display=liftDisplay();
  const landings=spec.stops.map(stop=>{
   const d=stop.door||spec.door,frontOf=d.axis==='z'?new T.Vector3(0,0,d.sign):new T.Vector3(d.sign,0,0),along=d.axis==='z'?new T.Vector3(1,0,0):new T.Vector3(0,0,1);
   const half=(d.axis==='z'?c.depth:c.width)/2,base=new T.Vector3(c.x,stop.y,c.z).addScaledVector(frontOf,half+.14),at={base,front:frontOf,along,width:d.width};
   landingSigns(signs,colliders,stop,at);liftDisplayMount(signs,colliders,display.material,at);
   return {d,frontOf,along,base,light:callLight(signs,colliders,at)};
  });
  const carMover=colliders.addMover(spec.id+'_car',carTriangles(spec,faces.map(f=>f.door)));
  // Landing doors: two leaves per stop, each its own mover so they can slide apart.
  const stops=spec.stops.map((stop,i)=>{
   const {d,frontOf,along,base,light}=landings[i];
   const leaves=[-1,1].map(s=>{
    const size=d.axis==='z'?[d.width/2,DOOR_H,LEAF_T]:[LEAF_T,DOOR_H,d.width/2];
    const mesh=boxMesh('Landing_door',size,[0,0,0],mats.door,root);mesh.geometry.translate(0,DOOR_H/2,0);
    const mover=colliders.addMover(spec.id+'_door',boxTris(...size));
    return {s,mesh,mover};
   });
   return {...stop,base,along,leaves,light,callAt:base.clone().addScaledVector(frontOf,.9),width:d.width,frontOf,face:faceOf(d)};
  });
  const lift={spec,root,car,carMover,faces,faceOf,stops,display,...liftState(spec)};
  place(lift);return lift;
 });
 function place(l){
  // Nothing to move while the car rests with its doors still.
  const key=`${l.y}|${l.doors}|${l.phase}|${l.at}|${[...l.calls]}`;if(l.placed===key)return;l.placed=key;
  const c=l.spec.car;l.car.position.set(c.x,l.y,c.z);l.car.updateMatrixWorld(true);
  l.carMover.place(new T.Matrix4().makeTranslation(c.x,l.y,c.z));
  const here=l.stops[l.at];
  for(const f of l.faces){
   const shut=l.phase!=='moving'&&here.face===l.faceOf(f.door)?1-l.doors:1,dw=f.door.width;
   for(const leaf of f.leaves)leaf.mesh.position.copy(f.front).multiplyScalar(f.half).addScaledVector(f.side,leaf.s*(dw/4+(1-shut)*dw/2*.98));
   f.gate.enabled=shut>.5;const g=f.front.clone().multiplyScalar(f.half);f.gate.place(new T.Matrix4().makeTranslation(c.x+g.x,l.y,c.z+g.z));
  }
  l.stops.forEach((s,i)=>{const open=i===l.at&&l.phase!=='moving'?l.doors:0;
   s.light?.lit(l.calls.has(i));
   for(const leaf of s.leaves){const p=s.base.clone().addScaledVector(s.along,leaf.s*(s.width/4+open*s.width/2*.98));leaf.mesh.position.copy(p);leaf.mesh.updateMatrixWorld(true);leaf.mover.place(new T.Matrix4().makeTranslation(p.x,p.y,p.z));}
  });
 }
 const inside=(l,p)=>{const c=l.spec.car;return Math.abs(p.x-c.x)<c.width/2-.1&&Math.abs(p.z-c.z)<c.depth/2-.1&&p.y>l.y-.6&&p.y<l.y+1.2;};
 // The stop the car is at or passing.
 const level=l=>l.stops.reduce((b,s,i)=>Math.abs(s.y-l.y)<Math.abs(l.stops[b].y-l.y)?i:b,0);
 let walker=null;
 const rides={
  lifts,inside,signs,level,
  // Called with each call this page makes (the multiplayer link passes it to the server).
  onCall:null,
  // Send a lift to stop `index`; its call light there stays lit until the car arrives. `now`: chosen in the car.
  call(l,index,opts){callLift(l,index,opts);rides.onCall?.(l,index,opts);},
  // A lift's state as the server has it (multiplayer). The server's car is a little ahead of or behind this page's,
  // so its word moves the car; whoever stands in it moves too. Left behind, a rider 0.7 m under a car the server put
  // higher stopped counting as aboard and fell down the shaft (feedback-inbox #50, #52, #73-#75).
  apply(id,wire){
   const l=lifts.find(l=>l.spec.id===id);if(!l)return;
   const aboard=walker&&inside(l,walker.position),before=l.y;applyLiftWire(l,wire);
   if(aboard&&l.y!==before){walker.position.y+=l.y-before;walker.velocity.y=0;}
  },
  // Advance the cars and doors; `w` is the controller, carried along when standing in a moving car.
  update(dt,w){
   walker=w;
   for(const l of lifts){
    const riding=inside(l,walker.position),rose=stepLift(l,l.stops,dt);
    if(riding&&rose){walker.position.y+=rose;walker.velocity.y=0;}
    l.display.show(stopShort(l.stops[level(l)]),l.phase==='moving'?(l.stops[l.target].y>l.y?'up':'down'):'');
    place(l);
   }
  },
  // What the walker could use: a call button at a landing, or the panel inside a car.
  nearest(p){
   let best=null;
   for(const l of lifts){
    if(inside(l,p))return l.phase==='moving'?{lift:l,kind:'riding'}:{lift:l,kind:'inside',label:'Choose a deck'};
    l.stops.forEach((s,i)=>{const d=Math.hypot(p.x-s.callAt.x,p.z-s.callAt.z);
     if(d<2.2&&Math.abs(p.y-s.y)<.6&&(!best||d<best.d)&&!(i===l.at&&l.phase!=='moving'&&l.doors>0)){
      // Once called, the prompt follows the car until it arrives.
      const coming=l.calls.has(i),from=l.stops[level(l)];
      best=coming?{lift:l,kind:'waiting',stop:i,d,label:l.phase==='moving'?`Lift coming · ${from.deck?'Deck '+from.deck:from.label}`:'Lift coming'}:{lift:l,kind:'call',stop:i,d,label:'Call the lift'};
     }});
   }
   return best;
  },
  stopsOf:l=>l.stops.map((s,i)=>({index:i,label:stopLabel(s),here:i===l.at&&l.phase!=='moving'})),
 };
 return rides;
}
