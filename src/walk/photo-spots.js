import * as T from 'three';
import {walkCanvas} from './canvas.js';
import {toWorld} from '../plan/rooms.js';

// Scenic photo spots (from tester feedback): a marker on the floor in three places aboard, each with a fixed camera
// that frames the walker against that place's own scenery. Press E on a marker and start the countdown: the photo is
// taken, framed and offered the same way as the crown lounge's selfie camera takes it (selfie.js; main.js takePhoto).
// Each camera is this page's alone: no shared countdown and nothing sent to the server. The original booth is untouched.
// Points are in their room's frame (src/plan/rooms.js; metres, y up from its floor): `stand` is the marker's centre on
// the floor, `lens` the camera and `look` the point it aims at. Chosen on the live layout 2 plan; docs/photo-spots.md
// has each spot's ship coordinates and walk links.
export const PHOTO_SPOTS=[
 // The crown lounge's nose (frame origin x -247): the cat stands before the forward panoramic windows, the camera 5.8 m
 // aft between the two forward seating groups.
 {id:'crown-windows',name:'Crown lounge windows',place:'CROWN LOUNGE WINDOWS',room:'crown',stand:[49,0,0],lens:[43.2,1.15,0],look:[51,1.45,0]},
 // Deck 6 (ship x and z), the Toybox Park path from the lift tower to the tree's ring: past the park sign, with the
 // trunk, ramp and platforms behind the cat.
 {id:'cat-tree',name:'The Great Cat Tree',place:'DECK 6 · GREAT CAT TREE',room:'circulation-6',stand:[171,0,-2.2],lens:[165.6,1.3,-.4],look:[176,3.1,-1.5]},
 // Deck 17, the Hydro-Nip Lounge (Neighborhood 1's mirrored commons): its floor in front of the aquarium glass, between
 // the hammock dome and the Munchies Converger's counter.
 {id:'aquarium',name:'Hydro-Nip aquarium',place:'DECK 17 · HYDRO-NIP AQUARIUM',room:'commons-1',stand:[11,0,-13],lens:[11.1,1.55,-7.6],look:[11,1.35,-15]},
];
// A room point in ship metres, to the millimetre.
const world=(room,p)=>toWorld(room,p).map(v=>Math.round(v*1000)/1000);
// The same photo as the booth's: 2:1, 52 degrees top to bottom, five seconds to get into place.
const FOV=52,ASPECT=2,COUNT=5,REACH=1.6;
const ORANGE='#f85800',CREAM='#f4f0e8',NAVY='#233b4b';

// A camera glyph, w across, centred on (x,y).
function glyph(c,x,y,w,colour){
 const h=w*.62;c.fillStyle=colour;c.beginPath();c.roundRect(x-w/2,y-h/2,w,h,w*.1);c.fill();
 c.beginPath();c.roundRect(x-w*.18,y-h/2-w*.12,w*.36,w*.16,w*.04);c.fill();
 c.globalCompositeOperation='destination-out';c.beginPath();c.arc(x,y+h*.04,h*.32,0,Math.PI*2);c.fill();c.globalCompositeOperation='source-over';
 c.beginPath();c.arc(x,y+h*.04,h*.2,0,Math.PI*2);c.fill();
}
function texture(paint){const canvas=walkCanvas();if(!canvas)return null;canvas.width=canvas.height=256;paint(canvas.getContext('2d'),256);const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}

export function createPhotoSpots(){
 // The floor marker: a navy disc in an orange ring with the camera and PHOTO SPOT; and over it a small orange badge
 // with the camera that always faces the viewer, to find it from across the room.
 const disc=new T.MeshBasicMaterial({name:'Photo_spot_marker',transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
  map:texture((c,s)=>{c.fillStyle='rgba(35,59,75,.82)';c.beginPath();c.arc(s/2,s/2,s*.47,0,Math.PI*2);c.fill();c.strokeStyle=ORANGE;c.lineWidth=s*.05;c.stroke();
   glyph(c,s/2,s*.44,s*.36,CREAM);c.fillStyle=ORANGE;c.font=`600 ${s*.09}px "JetBrains Mono", ui-monospace, monospace`;c.textAlign='center';c.fillText('PHOTO SPOT',s/2,s*.78);})});
 const badge=new T.SpriteMaterial({name:'Photo_spot_badge',transparent:true,
  map:texture((c,s)=>{c.fillStyle=ORANGE;c.beginPath();c.arc(s/2,s/2,s*.46,0,Math.PI*2);c.fill();c.strokeStyle=CREAM;c.lineWidth=s*.04;c.stroke();glyph(c,s/2,s*.53,s*.48,CREAM);})});
 if(!disc.map)disc.color.set(NAVY);
 const floorGeometry=new T.CircleGeometry(.75,40).rotateX(-Math.PI/2);
 // Each spot in ship metres, through its room's frame as the plan places it now.
 const spots=PHOTO_SPOTS.map(s=>({...s,stand:world(s.room,s.stand),lens:world(s.room,s.lens),look:world(s.room,s.look)}));
 const groups=spots.map(s=>{
  const g=new T.Group();g.name='Photo_spot_'+s.id;g.position.set(...s.stand);
  // The disc reads upright to someone walking up from the camera's side.
  const m=new T.Mesh(floorGeometry,disc);m.name='Photo_spot_marker';m.position.y=.02;m.rotation.y=Math.atan2(s.lens[0]-s.stand[0],s.lens[2]-s.stand[2]);m.renderOrder=1;g.add(m);
  const b=new T.Sprite(badge);b.name='Photo_spot_badge';b.position.y=2.6;b.scale.set(.5,.5,1);g.add(b);
  return g;});
 const camera=new T.PerspectiveCamera(FOV,ASPECT,.05,400);
 let ends=0,spot=null;
 // Each countdown aims the camera at its own spot, so nothing of another spot's framing is left.
 const point=s=>{camera.position.set(...s.lens);camera.lookAt(...s.look);camera.updateMatrixWorld();};
 return {
  spots,groups,camera,
  get counting(){return ends>0;},
  // The spot of the countdown running or the last photo taken.
  get spot(){return spot;},
  // The marker's use prompt within REACH of its centre, or the countdown while it runs there.
  near(p){
   const s=spots.find(s=>Math.abs(p.y-s.stand[1])<1.5&&Math.hypot(p.x-s.stand[0],p.z-s.stand[2])<REACH);if(!s)return null;
   if(ends)return s===spot?{kind:'waiting',label:'Photo in '+Math.max(1,Math.ceil((ends-performance.now())/1000))+'…'}:null;
   return {kind:'photo-spot',spot:s,label:'Take a photo · '+s.name};
  },
  start(s,now=performance.now()){if(ends||!spots.includes(s))return false;spot=s;point(s);ends=now+COUNT*1000;return true;},
  // Each frame: the seconds left, and true once the photo is due.
  update(now){
   if(!ends)return {left:0,due:false};
   if(now<ends)return {left:Math.max(0,Math.ceil((ends-now)/1000)),due:false};
   ends=0;return {left:0,due:true};
  },
  // As the booth's aim (selfie.js): the 2:1 crop of a w×h canvas shows FOV degrees top to bottom.
  aim(w,h){const crop=Math.min(h,w/ASPECT);camera.aspect=w/h;camera.fov=2*Math.atan(Math.tan(FOV*Math.PI/360)*h/crop)*180/Math.PI;camera.updateProjectionMatrix();},
  // The markers stay out of the photo.
  show(on){for(const g of groups)g.visible=on;},
 };
}
