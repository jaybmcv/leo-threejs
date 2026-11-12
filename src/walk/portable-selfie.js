import * as T from 'three';

// The portable selfie camera (from tester feedback): the Camera button in the tools opens it anywhere the walker can
// stand. Its lens sits in front of the cat, looking back at it, and is drawn and taken the way the booth's and the photo
// spots' lenses are (selfie.js, photo-spots.js; main.js takePhoto): a 2:1 crop of the canvas, 52 degrees top to bottom
// unless the visitor zooms. Everything here is this page's alone: no shared countdown, nothing sent to the server.
// Side is the lens's turn round the cat in degrees, dist its metres back from the cat and height its metres above the
// cat's chest; fov is the 2:1 picture's degrees top to bottom; timer is the countdown's seconds (0 takes it at once).
export const LIMITS={side:[-60,60],dist:[.8,4],height:[-.6,1.4],fov:[30,80]};
export const TIMERS=[0,3,5,10];
const DEFAULTS={side:0,dist:1.8,height:.2,fov:52,timer:0};
const ASPECT=2,GAP=.25;

export function createPortableSelfie(){
 const camera=new T.PerspectiveCamera(DEFAULTS.fov,ASPECT,.05,400);
 const settings={...DEFAULTS};
 let open=false,ends=0;
 const clamp=(key,v)=>{const [lo,hi]=LIMITS[key];return Math.min(hi,Math.max(lo,Number.isFinite(v)?v:DEFAULTS[key]));};
 const target=new T.Vector3(),want=camera.position,ray=new T.Ray();
 return {
  camera,settings,
  get active(){return open;},
  get counting(){return ends>0;},
  // The place the photo is filed under (the sheet and the file name).
  place(frame){return {frame,name:'Portable camera',slug:'portable-selfie'};},
  open(){open=true;},
  // Closing cancels a countdown that is still running, so nothing is taken after it.
  close(){open=false;ends=0;},
  set(key,v){if(key==='timer'){const t=Number(v);settings.timer=TIMERS.includes(t)?t:0;}else if(key in LIMITS)settings[key]=clamp(key,Number(v));},
  // The lens in front of a cat standing at `feet` facing `yaw` (walk yaw: 0 faces +Z), looking at its chest `chest` m up.
  // A wall between the cat and the lens brings the lens in to just this side of it.
  point(feet,yaw,chest,colliders){
   target.set(feet.x,feet.y+chest,feet.z);
   const a=yaw+settings.side*Math.PI/180;
   want.set(target.x+Math.sin(a)*settings.dist,target.y+settings.height,target.z+Math.cos(a)*settings.dist);
   const length=want.distanceTo(target);ray.origin.copy(target);ray.direction.subVectors(want,target).divideScalar(length);
   const hit=colliders?.raycast(ray,length+GAP);
   if(hit&&hit.distance<length+GAP)want.copy(ray.origin).addScaledVector(ray.direction,Math.max(.3,hit.distance-GAP));
   camera.lookAt(target);camera.updateMatrixWorld();
  },
  start(now=performance.now()){if(!open||ends)return false;if(!settings.timer)return false;ends=now+settings.timer*1000;return true;},
  // Each frame: the seconds left, and true once the countdown is done and the photo is due.
  update(now){
   if(!ends)return {left:0,due:false};
   if(now<ends)return {left:Math.max(0,Math.ceil((ends-now)/1000)),due:false};
   ends=0;return {left:0,due:true};
  },
  // As the booth's aim (selfie.js): the 2:1 crop of a w×h canvas shows `fov` degrees top to bottom.
  aim(w,h){const crop=Math.min(h,w/ASPECT);camera.aspect=w/h;camera.fov=2*Math.atan(Math.tan(settings.fov*Math.PI/360)*h/crop)*180/Math.PI;camera.updateProjectionMatrix();},
 };
}
