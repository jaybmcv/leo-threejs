import * as T from 'three';

// The grapple hook. Q or the right mouse button (the Hook button on touch screens) fires a neon yarn line at whatever
// sits in the middle of the view, up to HOOK.range metres from Cosmo's hand (controller.js HOOK). The line flies out
// at HOOK.shot m/s; if the key is still held when it arrives, its claw bites and the controller swings him under it
// (controller.latch). Letting go or jumping lets go, as does the line staying blocked well short of the claw (around a
// corner): it may graze a ledge near the claw, as a swing past a balcony's lip does. The line winds back into his paw. A miss flies out to full reach and winds back.
// Others aboard see the same line from their hand to the claw (remotes.js, a pose's `hook`).

const UP=new T.Vector3(0,1,0);
const cord=new T.MeshStandardMaterial({name:'Walk_grapple_line',color:0xff4fa8,emissive:0xff2f8f,emissiveIntensity:.6,roughness:.7});
const steel=new T.MeshStandardMaterial({name:'Walk_grapple_claw',color:0x2b2f38,metalness:.85,roughness:.32,emissive:0xff2f8f,emissiveIntensity:.08});
// A unit cord along +y from its foot, scaled to length; a three-pronged claw pointing along +y.
const CORD=new T.CylinderGeometry(1,1,1,6,1,true).translate(0,.5,0);
function clawGeometry(){
 const parts=[new T.ConeGeometry(.045,.12,8).translate(0,.02,0),new T.CylinderGeometry(.018,.018,.08,6).translate(0,-.06,0)];
 for(let i=0;i<3;i++){const g=new T.TorusGeometry(.055,.012,5,10,Math.PI*.9).rotateY(i*Math.PI*2/3);g.translate(0,.01,0);parts.push(g);}
 // Merged by hand: the walk does not ship BufferGeometryUtils.
 const pos=[],idx=[];let base=0;
 for(const g of parts){const gi=g.index?g.toNonIndexed():g,p=gi.attributes.position;for(let i=0;i<p.count;i++)pos.push(p.getX(i),p.getY(i),p.getZ(i));for(let i=0;i<p.count;i++)idx.push(base+i);base+=p.count;}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(pos,3));out.setIndex(idx);out.computeVertexNormals();return out;
}
let CLAW=null;

// The line and its claw, drawn from a hand towards a target: `update(dt, hand, target|null)` reels the tip out towards
// the target (or back in to the hand with none) and returns true once the tip has reached the target.
export function createGrappleLine(scene,{shot=160}={}){
 CLAW??=clawGeometry();
 const line=new T.Mesh(CORD,cord),claw=new T.Mesh(CLAW,steel),group=new T.Group();
 line.name='Walk_grapple_line';claw.name='Walk_grapple_claw';group.add(line,claw);group.visible=false;scene.add(group);
 const dir=new T.Vector3(),tip=new T.Vector3(),last=new T.Vector3(0,0,1);let out=0;
 return {
  get out(){return out;},
  update(dt,hand,target){
   let reach=0;
   if(target){dir.subVectors(target,hand);reach=dir.length();if(reach>1e-4)last.copy(dir).divideScalar(reach);out=Math.min(reach,out+shot*dt);}
   else out=Math.max(0,out-shot*1.4*dt);
   group.visible=out>.05;if(!group.visible)return false;
   tip.copy(hand).addScaledVector(last,out);
   line.position.copy(hand);line.quaternion.setFromUnitVectors(UP,last);line.scale.set(.016,out,.016);
   claw.position.copy(tip);claw.quaternion.copy(line.quaternion);
   return !!target&&out>=reach-1e-3;
  },
  hide(){out=0;group.visible=false;},
  dispose(){group.removeFromParent();},
 };
}

// The visitor's own grapple. `hook` is the controller's HOOK; `walker.hand(out)` gives the paw the line leaves from.
export function createGrapple(scene,{camera,colliders,controller,walker,hook}){
 const view=createGrappleLine(scene,{shot:hook.shot}),ray=new T.Ray(),hand=new T.Vector3(),target=new T.Vector3(),fwd=new T.Vector3(),to=new T.Vector3();
 // 'idle' | 'out' (flying to a bite) | 'miss' (flying to nothing) | 'held' (swinging) | 'back' (winding in).
 let state='idle',holding=false,sight=0,blocked=0;
 // Blocked further than BLOCK_M short of the claw for BLOCK_S seconds lets go.
 const BLOCK_M=5,BLOCK_S=.5;
 const paw=()=>walker.hand?walker.hand(hand):hand.copy(controller.position).setY(controller.position.y+hook.hand);
 // What the middle of the view points at within reach of the hand, or null.
 function aimAt(out){
  camera.getWorldPosition(ray.origin);camera.getWorldDirection(fwd);ray.direction.copy(fwd);paw();
  const behind=Math.max(0,fwd.dot(to.subVectors(hand,ray.origin))),hit=colliders.raycast(ray,behind+hook.range);
  if(!hit||hit.distance<behind*.5||hit.point.distanceTo(hand)>hook.range)return null;
  return out.copy(hit.point).addScaledVector(hit.normal,.03);
 }
 const let_go=()=>{if(state==='held'||state==='out'||state==='miss'){controller.unhook();state='back';}};
 return {
  get state(){return state;},
  fire(){
   if(state==='out'||state==='held')return;
   holding=true;
   if(aimAt(target))state='out';
   else{paw();camera.getWorldDirection(fwd);target.copy(hand).addScaledVector(fwd,hook.range);state='miss';}
  },
  release(){holding=false;if(state==='held'||state==='out')let_go();},
  // After the walker is posed (its hand is where it is drawn this frame).
  update(dt){
   paw();
   if(state==='held'&&!controller.hook)state='back';
   if(state==='held'){
    // A line held up by something between paw and claw lets go, rather than pull through a wall.
    if((sight+=dt)>.1){to.subVectors(controller.hook,hand);const len=to.length();ray.origin.copy(hand);ray.direction.copy(to.divideScalar(len));
     const hit=len>BLOCK_M&&colliders.raycast(ray,len-BLOCK_M);blocked=hit?blocked+sight:0;sight=0;if(blocked>=BLOCK_S)let_go();}
   }
   const aimed=state==='out'||state==='miss'||state==='held'?(state==='held'&&controller.hook?controller.hook:target):null;
   const arrived=view.update(dt,hand,aimed);
   if(arrived&&state==='out'){if(holding){controller.latch(target);state='held';sight=blocked=0;}else state='back';}
   else if(arrived&&state==='miss')state='back';
   if(state==='back'&&view.out===0)state='idle';
  },
  reset(){holding=false;controller.unhook();view.hide();state='idle';},
 };
}
