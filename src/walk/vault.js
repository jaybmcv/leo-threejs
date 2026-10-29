import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {walkCanvas,hasWalkCanvas} from './canvas.js';
import {anchorObject} from '../plan/rooms.js';
import {COMMONS} from '../model.js';
import {floorY} from '../transit.js';
import {HEADER} from './commons-hall.js';

// A hidden clubhouse behind the Deck 17 arcade (from tester feedback), first step: its ground floor. The bare plate
// between Neighborhood 1's commons (the Hydro-Nip Lounge) and Neighborhood 3's, opened into the commons hall, is closed
// off again by thin walls: one along the backs of the arcade cabinets, one where Neighborhood 3's end wall was cut
// back, one on the corridor side and one outboard. In the arcade wall, past the Paws Off treadmill, is a round vault door
// of black metal with a gold wheel, in a black frame ringed with gold. E at the door (or at the keypad beside it) asks
// for the password; the right one turns the wheel and swings the door in. Once the walker is inside and clear of it,
// the door shuts behind them; from inside, E at the door opens it to let them out. The tube lift is in vault-lift.js.
// Walk only, and each visitor's own: the door's state is not shared through Leo live.
// Built in the arcade row's frame (arcade.js): x along the wall toward the corridor (world +z), y up from the floor,
// z out from the wall into the lounge (world -x), so the room behind lies at negative z.
const C=COMMONS[0],NEXT=COMMONS[2],FLOOR=floorY(17),WALL=22.44,H=HEADER-FLOOR,THICK=.12;
// The room: from just inside the lounge's rear wall line to the line of its corridor-side columns, and back to where
// Neighborhood 3's end wall stood.
const XA=-C.depth/2+.1,XB=C.depth/2,ZF=-(NEXT.x-NEXT.width/2-(C.x+WALL));
// The door: its centre along the wall, the opening's radius and centre height, and the door's own radius (it closes
// against the room side of the wall, hinged on its corridor side). The keypad stands to its right.
const DX=15.5,R=1.25,CY=1.35,RD=1.36,DOOR_T=.34,HINGE=DX+RD,KX=DX+2.05;
// The way through as the colliders see it: narrower and lower than the round opening, so a walker never brushes its rim.
const GAP={half:.9,top:2.35};
// The wheel takes a second to turn; the door swings in over 1.8 s, and shuts over 1.4.
const SPIN=1,SWING=1.8,SHUT=1.4,OPEN_ANGLE=-100*Math.PI/180,WAIT=20,REACH=2.4;
// A game code, not a credential: anyone reading the page's script can find it.
const CODE='9lives';

// The room's walls on the ship map (deck-map.js), in world coordinates.
const world=(x,z)=>({x:C.x+WALL-z,z:C.z+x});
export const VAULT_PLAN={deck:17,lines:[[world(XA,0),world(XB,0)],[world(XA,ZF),world(XB,ZF)],[world(XA,0),world(XA,ZF)],[world(XB,0),world(XB,ZF)]]};
// The next step's tube sits at the outboard end, clear of all four walls and the vault door.
export const VAULT_LIFT={...world(XA+3.7,ZF/2),y:FLOOR,stops:[17,18,19].map(deck=>({deck,y:floorY(deck),label:`Deck ${deck}`}))};

const FONT='"Archivo", system-ui, sans-serif',MONO='"JetBrains Mono", ui-monospace, monospace';
// The keypad's face: a small screen over twelve keys. `mode` is 'locked', 'denied' or 'open'.
function keypadTexture(){
 const c=walkCanvas();c.width=256;c.height=384;const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
 let last='locked';
 const draw=(mode=last)=>{last=mode;const g=c.getContext('2d'),w=c.width,h=c.height;
  g.fillStyle='#0b0c0e';g.fillRect(0,0,w,h);
  const ink=mode==='open'?'#5dff8a':mode==='denied'?'#ff4a3d':'#e0b04a';
  g.fillStyle='#050607';g.beginPath();g.roundRect(18,18,w-36,108,10);g.fill();g.strokeStyle=ink;g.lineWidth=3;g.stroke();
  g.textAlign='center';g.textBaseline='middle';g.fillStyle=ink;g.shadowColor=ink;g.shadowBlur=12;
  g.font=`700 ${mode==='open'?34:38}px ${FONT}`;g.fillText(mode==='open'?'UNLOCKED':mode==='denied'?'DENIED':'LOCKED',w/2,62);
  g.shadowBlur=0;g.font=`500 15px ${MONO}`;g.fillText(mode==='open'?'WELCOME BACK':'PASSWORD',w/2,102);
  const keys=['1','2','3','4','5','6','7','8','9','*','0','#'];
  keys.forEach((k,i)=>{const x=34+(i%3)*68,y=146+Math.floor(i/3)*58;
   g.fillStyle='#1b1d21';g.beginPath();g.roundRect(x,y,52,46,8);g.fill();g.strokeStyle='#c99a3a';g.lineWidth=2;g.stroke();
   g.fillStyle='#f1d790';g.font=`700 24px ${FONT}`;g.fillText(k,x+26,y+24);});
  t.needsUpdate=true;};
 draw();globalThis.document?.fonts?.ready.then(()=>draw());t.userData.draw=draw;return t;
}

// The room's walls, the door's frame and the door, in Neighborhood 1's commons. Returns {group (drawn), solid
// (plain boxes for the colliders), ...} with the door's controls; attach(colliders) makes the door solid (the page does
// this; the Node checks leave the way in open, as they do the lounge's doors).
export function createVault(ship){
 const frame=()=>{const g=new T.Group();g.position.set(C.x+WALL,FLOOR,C.z);g.rotation.y=-Math.PI/2;anchorObject(g,'commons-1');g.updateMatrixWorld(true);return g;};
 const group=frame();group.name='Deck17_vault';
 const solid=frame();solid.name='Deck17_vault_colliders';
 const plaster=ship?.inside?.getObjectByName('Commons_end_wall')?.material||new T.MeshStandardMaterial({name:'Vault_wall',color:0xeeeeea,roughness:.85});
 const M={
  black:new T.MeshStandardMaterial({name:'Vault_black_metal',color:0x0c0d10,roughness:.32,metalness:.85}),
  steel:new T.MeshStandardMaterial({name:'Vault_dark_steel',color:0x2a2d32,roughness:.4,metalness:.75}),
  gold:new T.MeshStandardMaterial({name:'Vault_gold',color:0xe2b24c,roughness:.24,metalness:1}),
 };
 const parts=new Map();
 const piece=(m,g,into=parts)=>{(into.get(m)||into.set(m,[]).get(m)).push(g.index?g.toNonIndexed():g);};
 const build=(into,parent,prefix)=>{for(const [m,gs] of into){const o=new T.Mesh(mergeGeometries(gs),m);
  o.name=prefix+'_'+(m===plaster?'wall':m.name.replace(/^Vault_/,''));o.castShadow=o.receiveShadow=true;parent.add(o);gs.forEach(g=>g.dispose());}};
 // Solid boxes [x0,x1,y0,y1,z0,z1].
 const block=(name,[x0,x1,y0,y1,z0,z1])=>{const o=new T.Mesh(new T.BoxGeometry(x1-x0,y1-y0,z1-z0));o.name=name;o.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);solid.add(o);};
 const slab=(m,[x0,x1,y0,y1,z0,z1])=>piece(m,new T.BoxGeometry(x1-x0,y1-y0,z1-z0).translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2));
 // A flat outline with a round hole, extruded `depth` back from z=0.
 const holed=(x0,x1,y0,y1,depth)=>{const s=new T.Shape([new T.Vector2(x0,y0),new T.Vector2(x1,y0),new T.Vector2(x1,y1),new T.Vector2(x0,y1)]);
  const hole=new T.Path();hole.absarc(DX,CY,R,0,Math.PI*2,true);s.holes.push(hole);return new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:48});};

 // The walls: the arcade wall (the cabinets' backs touch its face) with the round opening, the far wall where
 // Neighborhood 3's end wall was cut, the corridor side and the outboard end. All rise to the deck above's underside.
 piece(plaster,holed(XA,XB,0,H,THICK).translate(0,0,-THICK));
 slab(plaster,[XA,XB,0,H,ZF-.1,ZF+.1]);
 slab(plaster,[XB-THICK,XB,0,H,ZF+.1,-THICK]);
 slab(plaster,[XA,XA+THICK,0,H,ZF+.1,-THICK]);
 block('Vault_wall_solid',[XA,DX-GAP.half,0,H,-THICK,.1]);block('Vault_wall_solid',[DX+GAP.half,XB,0,H,-THICK,.1]);
 block('Vault_wall_solid',[DX-GAP.half,DX+GAP.half,GAP.top,H,-THICK,.1]);
 block('Vault_wall_solid',[XA,XB,0,H,ZF-.1,ZF+.1]);block('Vault_wall_solid',[XB-THICK,XB,0,H,ZF,0]);block('Vault_wall_solid',[XA,XA+THICK,0,H,ZF,0]);
 // The door's frame on the lounge side: a black plate round the opening, a gold ring and gold rivets, the opening
 // lined in dark steel, and a low sill to step over.
 piece(M.black,holed(DX-1.6,DX+1.6,0,3.1,.1));
 piece(M.gold,new T.TorusGeometry(R+.07,.035,10,72).translate(DX,CY,.1));
 for(let i=0;i<20;i++){const a=i/20*Math.PI*2,y=CY+Math.sin(a)*1.47;if(y<.08)continue;piece(M.gold,new T.SphereGeometry(.032,8,6).translate(DX+Math.cos(a)*1.47,y,.1));}
 piece(M.steel,new T.CylinderGeometry(R,R,THICK+.1,72,1,true).rotateX(Math.PI/2).translate(DX,CY,(.1-THICK)/2));
 slab(M.steel,[DX-GAP.half,DX+GAP.half,0,.08,-THICK,.1]);block('Vault_sill_solid',[DX-GAP.half,DX+GAP.half,0,.08,-THICK,.1]);
 // The keypad, to the right of the door.
 slab(M.black,[KX-.17,KX+.17,1.02,1.54,0,.06]);
 for(const [x0,x1,y0,y1] of [[KX-.18,KX+.18,1.53,1.56],[KX-.18,KX+.18,1,1.03],[KX-.18,KX-.15,1,1.56],[KX+.15,KX+.18,1,1.56]])slab(M.gold,[x0,x1,y0,y1,0,.07]);
 const pad=hasWalkCanvas()?keypadTexture():null;
 if(pad){const face=new T.Mesh(new T.PlaneGeometry(.28,.42),new T.MeshBasicMaterial({name:'Vault_keypad_screen',map:pad,toneMapped:false}));face.name='Vault_keypad_screen';face.position.set(KX,1.28,.063);group.add(face);}
 build(parts,group,'Vault');

 // The door turns on a pivot at its hinge, on the room side of the wall; the gold wheel on its face turns on its own.
 const pivot=new T.Group();pivot.name='Vault_door';pivot.position.set(HINGE,0,-THICK);group.add(pivot);
 const door=new Map(),wheels=[];
 const disc=(m,r,depth,z)=>piece(m,new T.CylinderGeometry(r,r,depth,72).rotateX(Math.PI/2).translate(-RD,CY,z),door);
 disc(M.black,RD,DOOR_T,-DOOR_T/2);
 disc(M.steel,.86,.04,.02);
 for(const [r,t] of [[1.04,.02],[.9,.016]])piece(M.steel,new T.TorusGeometry(r,t,8,72).translate(-RD,CY,.005),door);
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;piece(M.gold,new T.CylinderGeometry(.04,.04,.04,12).rotateX(Math.PI/2).translate(-RD+Math.cos(a)*1.2,CY+Math.sin(a)*1.2,.02),door);}
 // The hinge knuckles, on the room side.
 for(const y of [.5,1.35,2.2])piece(M.gold,new T.CylinderGeometry(.075,.075,.34,16).translate(0,y,-.06),door);
 build(door,pivot,'Vault_door');
 // A spoked gold wheel with a knob at each spoke's end: `r` across its rim, facing +z (or -z on the door's back).
 const wheel=(r,side)=>{const w=new T.Group();w.name='Vault_wheel';w.position.set(-RD,CY,side>0?0:-DOOR_T);w.rotation.y=side>0?0:Math.PI;pivot.add(w);
  const g=[];
  g.push(new T.CylinderGeometry(r*.24,r*.28,.16,24).rotateX(Math.PI/2).translate(0,0,.08));
  g.push(new T.TorusGeometry(r,r*.075,12,64).translate(0,0,.15));
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2+Math.PI/2,c=Math.cos(a),s=Math.sin(a);
   g.push(new T.CylinderGeometry(r*.05,r*.05,r*1.36,10).rotateZ(a-Math.PI/2).translate(c*r*.68,s*r*.68,.15));
   g.push(new T.SphereGeometry(r*.11,14,10).translate(c*r*1.38,s*r*1.38,.15));}
  const o=new T.Mesh(mergeGeometries(g.map(x=>{x=x.index?x.toNonIndexed():x;x.deleteAttribute('uv');return x;})),M.gold);o.name='Vault_wheel';o.castShadow=true;w.add(o);g.forEach(x=>x.dispose());wheels.push(w);};
 wheel(.44,1);wheel(.3,-1);
 group.updateMatrixWorld(true);solid.updateMatrixWorld(true);

 // 'locked'; 'opening' (the wheel turns, then the door swings in); 'open' (waiting for the walker to go through);
 // 'closing' (the door swings shut, then the wheel turns back). `why` is 'in' when opened with the password from the
 // lounge, 'out' when opened from inside.
 let state='locked',why='in',spin=0,swing=0,wait=0,denied=0,mover=null;
 const doorShape=new T.CylinderGeometry(RD,RD,DOOR_T,16).rotateX(Math.PI/2).translate(-RD,CY,-DOOR_T/2).toNonIndexed();
 const local=new T.Vector3(),inverse=new T.Matrix4();
 const toLocal=p=>local.copy(p).applyMatrix4(inverse.copy(group.matrixWorld).invert());
 // In the opening, or where the door swings: the door never shuts on a walker there.
 const inDoor=q=>Math.abs(q.x-DX)<1.4&&q.z>-.8&&q.z<.7;
 const inSwing=q=>q.z<0&&Math.hypot(q.x-HINGE,q.z+THICK)<2*RD+.45;
 const show=mode=>pad?.userData.draw(mode);
 const place=()=>{pivot.rotation.y=OPEN_ANGLE*T.MathUtils.smootherstep(swing,0,1);for(const w of wheels)w.rotation.z=spin*Math.PI*3;
  pivot.updateMatrixWorld(true);if(!mover)return;mover.place(pivot.matrixWorld);
  // Solid while shut and once wide open; while it swings it passes through a walker rather than shoving them aside.
  mover.enabled=swing===0||swing===1;};
 const start=w=>{state='opening';why=w;wait=WAIT;show('open');};
 return {
  group,solid,
  get state(){return state;},get swing(){return swing;},
  attach(colliders){mover=colliders.addMover('vault-door',doorShape.attributes.position.array,pivot.matrixWorld.clone());place();return mover;},
  // E at the door or keypad from the lounge asks for the password; from inside, E at the door lets the walker out.
  near(p){
   if(state!=='locked'||Math.abs(p.y-FLOOR)>1.2)return null;const q=toLocal(p);
   if(q.z>0&&q.z<REACH&&q.x>DX-1.7&&q.x<KX+.6)return {kind:'vault',label:'Enter the vault password'};
   if(q.z<-THICK&&q.z>-2.8&&Math.abs(q.x-DX)<1.6)return {kind:'vault-exit',label:'Open the vault door'};
   return null;
  },
  // The password, as typed: true if it opens the door.
  unlock(code){if(state!=='locked')return state!=='closing';
   if(String(code||'').trim().toLowerCase()===CODE){start('in');return true;}
   denied=1.6;show('denied');return false;},
  release(){if(state==='locked')start('out');},
  // Each frame, with the walker's position.
  update(dt,p){
   if(denied>0&&(denied-=dt)<=0&&state==='locked')show('locked');
   if(state==='locked')return;
   const q=toLocal(p);
   if(state==='opening'){if(spin<1)spin=Math.min(1,spin+dt/SPIN);else swing=Math.min(1,swing+dt/SWING);if(swing>=1)state='open';}
   else if(state==='open'){wait-=dt;
    // Through: inside and clear of the door, or back out in the lounge. Nobody through in time: it shuts anyway, unless
    // someone stands in its way.
    const through=why==='in'?q.z<-.5&&!inSwing(q):q.z>.7;
    if((through||wait<=0)&&!inDoor(q)&&!inSwing(q))state='closing';}
   else if(state==='closing'){if(swing>0){if(inDoor(q)||inSwing(q)){state='open';wait=4;}else swing=Math.max(0,swing-dt/SHUT);}
    else if((spin=Math.max(0,spin-dt/SPIN))===0){state='locked';show('locked');}}
   place();
  },
 };
}
