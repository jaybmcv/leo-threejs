import * as T from 'three';
import {walkCanvas} from './canvas.js';
import {floorY} from '../transit.js';

// Deck 4's lower tank bay behind a lever panel (from tester feedback). The doorway at the aft end of the Deck 4 access
// corridor is covered wall to wall by an engineering panel: a screen over five levers, each flipped up (on) or down
// (off) with E. Set them right and the screen turns green and the whole panel sinks into the floor, clipped at the
// deck, opening the way through. Once the walker is inside the bay it rises again quickly behind them and the levers
// drop back to off; from inside, E at the doorway lowers it again to let them out. Nothing says what the setting is.
// Walk only, and for now each visitor's own: the panel's state is not shared through Leo live.
// World frame: the corridor ends at x=-175.37 (the stowed door leaves' faces) between its side walls at |z|=3.94; the
// doorway itself is |z|<1.875, 3.06 m high, in the tank bay's bulkhead at x=-176. Facing the panel (looking aft, -x),
// left is +z, so the levers run left to right from +z to -z.
const FLOOR=floorY(4),FACE=-175.2,DEPTH=.16,HALF=3.94,HEIGHT=3.66,CODE=[1,0,0,1,1];
const LEVERS=[.8,.4,0,-.4,-.8],LEVER_Y=1.18,TILT=.55,REACH=1.8;
// Where a walker counts as inside the bay, back in the corridor, or in the doorway (where the panel never rises).
const INSIDE_X=-176.15,OUTSIDE_X=-174.9,DOOR={x0:-176.3,x1:-174.6,z:2.1};
// The panel takes a second to sink, a third of one to rise; it waits this long for someone to go through.
const SINK=1.1,RISE=.35,WAIT=20;
// For the ship map (deck-map.js): the panel stands across the corridor's end, so the map shows no way in.
export const SEAL={deck:4,x:FACE-DEPTH/2,z0:-HALF,z1:HALF};
const FONT='"Archivo", "Sora", sans-serif',MONO='"JetBrains Mono", ui-monospace, monospace';

function canvasTexture(w,h,paint){
 const c=walkCanvas();c.width=w;c.height=h;const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
 let last=[];const draw=(...a)=>{last=a;const g=c.getContext('2d');g.clearRect(0,0,w,h);paint(g,w,h,...a);t.needsUpdate=true;};
 draw();globalThis.document?.fonts?.ready.then(()=>draw(...last));t.userData.draw=draw;return t;
}
// Yellow and black diagonal stripes.
const hazard=()=>canvasTexture(512,32,(g,w,h)=>{g.fillStyle='#d8a51c';g.fillRect(0,0,w,h);g.fillStyle='#1b1d20';
 for(let x=-h;x<w+h;x+=32){g.beginPath();g.moveTo(x,h);g.lineTo(x+16,h);g.lineTo(x+16+h,0);g.lineTo(x+h,0);g.closePath();g.fill();}});
// ON over each lever slot and OFF under it, on the console's face.
const legends=()=>canvasTexture(1024,384,(g,w,h)=>{
 g.font=`700 44px ${MONO}`;g.textAlign='center';g.textBaseline='middle';
 for(const [i,z] of LEVERS.entries()){const x=w/2-z/2.4*w;
  g.fillStyle='#16191c';g.fillRect(x-58,8,116,62);g.fillRect(x-62,h-70,124,62);
  g.fillStyle='#e4a640';g.fillText('ON',x,40);g.fillStyle='#d2492e';g.fillText('OFF',x,h-38);
  g.fillStyle='rgba(220,226,230,.55)';g.font=`500 22px ${MONO}`;g.fillText(String(i+1).padStart(2,'0'),x+86,h/2);g.font=`700 44px ${MONO}`;}
});
// The screen: a dim amber status display while sealed (with a pip for each lever as it stands), bright green once open.
function screen(){
 return canvasTexture(768,360,(g,w,h,levers=[0,0,0,0,0],open=false)=>{
  g.fillStyle=open?'#0c3a1a':'#0b1410';g.fillRect(0,0,w,h);
  const ink=open?'#6dff8e':'#d9a441';g.strokeStyle=open?'rgba(109,255,142,.35)':'rgba(217,164,65,.16)';g.lineWidth=1;
  for(let x=0;x<w;x+=24){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
  for(let y=0;y<h;y+=24){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
  g.fillStyle=ink;g.textAlign='left';g.textBaseline='middle';g.font=`600 22px ${MONO}`;
  g.fillText('SECTOR 4 · AFT',24,30);g.textAlign='right';g.fillText(open?'UNLOCKED':'LOCKED',w-24,30);
  g.textAlign='center';g.font=`700 ${open?64:56}px ${FONT}`;g.fillText(open?'ACCESS GRANTED':'SEALED',w/2,h*.45);
  for(const [i,on] of levers.entries()){const x=w/2+(i-2)*70;g.strokeStyle=ink;g.lineWidth=3;g.strokeRect(x-22,h-92,44,44);if(on){g.fillStyle=ink;g.fillRect(x-14,h-84,28,28);}}
  // Scan lines over it all.
  g.fillStyle='rgba(0,0,0,.18)';for(let y=0;y<h;y+=4)g.fillRect(0,y,w,2);
 });
}

// The panel, its collider and its state. `colliders` gets one movable collider across the doorway.
export function createLeverPanel(colliders){
 const group=new T.Group();group.name='Lever_panel';group.position.set(FACE,FLOOR,0);
 // Everything that sinks with the panel; below the deck it is clipped away.
 const panel=new T.Group();group.add(panel);
 const clip=[new T.Plane(new T.Vector3(0,1,0),-FLOOR)];
 const mat=(name,o)=>new T.MeshStandardMaterial({name:'Lever_panel_'+name,clippingPlanes:clip,...o});
 const M={
  base:mat('base',{color:0x3a4248,roughness:.55,metalness:.55}),plate:mat('plate',{color:0x6d777d,roughness:.42,metalness:.7}),
  seam:mat('seam',{color:0x15191c,roughness:.7}),slot:mat('slot',{color:0x0e1013,roughness:.6}),
  steel:mat('steel',{color:0xb9c1c6,roughness:.28,metalness:.85}),grip:mat('grip',{color:0x2a2c2e,roughness:.5,metalness:.3}),
  stripe:mat('stripe',{map:hazard(),roughness:.6}),legend:mat('legend',{map:legends(),transparent:true,roughness:.6}),
 };
 const screenTex=screen(),glass=new T.MeshBasicMaterial({name:'Lever_panel_screen',map:screenTex,toneMapped:false,clippingPlanes:clip});
 const lamps=LEVERS.map(()=>new T.MeshBasicMaterial({name:'Lever_panel_lamp',color:0x2a1a08,toneMapped:false,clippingPlanes:clip}));
 // Boxes in the panel's frame: x out from its face (+x into the corridor), y up from the floor, z along the wall.
 const box=(name,[w,h,d],[x,y,z],m,parent=panel)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.userData.noCollide=true;parent.add(o);return o;};
 const face=(name,w,h,[x,y,z],m)=>{const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.name=name;o.rotation.y=Math.PI/2;o.position.set(x,y,z);panel.add(o);return o;};
 box('Lever_panel_base',[DEPTH,HEIGHT,HALF*2],[-DEPTH/2,HEIGHT/2,0],M.base);
 // Cladding: seams between plates, hazard bands top and bottom, a vent low on either side.
 for(const z of [-2.9,-1.6,1.6,2.9])box('Lever_panel_seam',[.012,HEIGHT-.1,.03],[.006,HEIGHT/2,z],M.seam);
 for(const y of [.32,3.2])box('Lever_panel_seam',[.012,.03,HALF*2-.1],[.006,y,0],M.seam);
 for(const y of [.18,3.38]){const s=face('Lever_panel_stripe',HALF*2-.2,.12,[.008,y,0],M.stripe);s.material.map.wrapS=T.RepeatWrapping;s.material.map.repeat.set(5,1);}
 for(const s of [-1,1]){box('Lever_panel_vent',[.03,.5,.9],[.015,.75,s*2.4],M.slot);for(let i=0;i<6;i++)box('Lever_panel_vent_slat',[.04,.035,.84],[.03,.55+i*.08,s*2.4],M.plate);}
 // The console: a raised plate with the screen in its bezel at the top and the five lever slots beneath.
 box('Lever_panel_console',[.06,2.3,2.8],[.03,1.6,0],M.plate);
 box('Lever_panel_bezel',[.05,.98,1.98],[.075,2.22,0],M.seam);
 face('Lever_panel_screen',1.8,.84,[.102,2.22,0],glass);
 face('Lever_panel_legends',2.4,.9,[.062,LEVER_Y,0],M.legend);
 const levers=LEVERS.map((z,i)=>{
  box('Lever_panel_slot',[.03,.5,.13],[.075,LEVER_Y,z],M.slot);
  const lamp=new T.Mesh(new T.SphereGeometry(.03,10,8),lamps[i]);lamp.name='Lever_panel_lamp';lamp.position.set(.08,LEVER_Y+.36,z+.13);panel.add(lamp);
  // The handle turns about the slot's axis (along the wall): up for on, down for off.
  const pivot=new T.Group();pivot.position.set(.09,LEVER_Y,z);panel.add(pivot);
  box('Lever_panel_arm',[.3,.05,.05],[.15,0,0],M.steel,pivot);
  const knob=new T.Mesh(new T.CylinderGeometry(.045,.045,.12,14),M.grip);knob.name='Lever_panel_grip';knob.rotation.x=Math.PI/2;knob.position.set(.31,0,0);pivot.add(knob);
  pivot.rotation.z=-TILT;return {z,pivot,on:0,shown:0};
 });
 // The screen's pips and lamps follow the levers.
 const repaint=()=>{screenTex.userData.draw(levers.map(l=>l.on),state==='open'||state==='exit');
  levers.forEach((l,i)=>lamps[i].color.setHex(state==='open'||state==='exit'?0x38ff6a:l.on?0xffb43a:0x2a1a08));};
 // One collider across the doorway, there while the panel is up.
 const half=[DEPTH/2,HEIGHT/2,2.2],corners=[];for(let i=0;i<8;i++)corners.push([(i&4?1:-1)*half[0],(i&2?1:-1)*half[1],(i&1?1:-1)*half[2]]);
 const tris=[];for(const f of [[0,1,3],[0,3,2],[4,6,7],[4,7,5],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,2,6],[0,6,4],[1,5,7],[1,7,3]])for(const i of f)tris.push(...corners[i]);
 const mover=colliders?.addMover('lever-panel',tris,new T.Matrix4().makeTranslation(FACE-DEPTH/2,FLOOR+HEIGHT/2,0));
 // 'sealed' (the levers work), 'open' (set right: sinking or down, waiting for someone to go in), 'exit' (lowered from
 // inside), and how far down the panel is, 0 to 1.
 let state='sealed',down=0,wait=0,delay=0;
 const inDoor=p=>p.x>DOOR.x0&&p.x<DOOR.x1&&Math.abs(p.z)<DOOR.z;
 const seal=()=>{state='sealed';for(const l of levers)l.on=0;repaint();};
 repaint();
 return {
  group,
  get state(){return state;},get down(){return down;},levers,
  // E in front of the console works the lever the walker stands before; from inside the bay, E at the doorway lowers
  // the panel.
  near(p){
   if(Math.abs(p.y-FLOOR)>1)return null;
   if(state==='sealed'&&p.x>FACE&&p.x<FACE+REACH&&Math.abs(p.z)<1.3){
    let i=0;for(let k=1;k<LEVERS.length;k++)if(Math.abs(p.z-LEVERS[k])<Math.abs(p.z-LEVERS[i]))i=k;
    return {kind:'lever',lever:i,label:`Lever ${i+1}: ${levers[i].on?'pull down':'push up'}`};
   }
   if(down===0&&state==='sealed'&&p.x<FACE-DEPTH&&p.x>FACE-2.6&&Math.abs(p.z)<1.9)return {kind:'lever-exit',label:'Open the panel'};
   return null;
  },
  flip(i){if(state!=='sealed'||!levers[i])return;levers[i].on^=1;
   if(levers.every((l,k)=>l.on===CODE[k])){state='open';wait=WAIT;delay=.6;}
   repaint();},
  release(){if(state!=='sealed')return;state='exit';wait=WAIT;delay=.2;repaint();},
  // Each frame, with the walker's position.
  update(dt,p){
   for(const l of levers){l.shown+=((l.on?1:-1)*TILT-l.shown)*(1-Math.exp(-14*dt));l.pivot.rotation.z=l.shown;}
   if(state==='open'||state==='exit'){
    if((delay-=dt)<=0)down=Math.min(1,down+dt/SINK);
    wait-=dt;
    // In: up again behind them at once. Out (lowered from inside): up once they are back in the corridor. Nobody
    // through in time: up again, unless someone stands in the doorway.
    const through=state==='open'?p.x<INSIDE_X:p.x>OUTSIDE_X;
    if(down>=1&&(through||wait<=0)&&!inDoor(p))seal();
   }else down=Math.max(0,down-dt/RISE);
   panel.position.y=-down*HEIGHT;panel.visible=down<1;
   if(mover)mover.enabled=down<.85;
  },
 };
}
