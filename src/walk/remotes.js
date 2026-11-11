import * as T from 'three';
import {bandOf} from './collision.js';
import {wearHat} from './hat.js';
import {createBallMesh} from './hamster-ball.js';
import {createGlide} from './glide.js';
import {createGrappleLine} from './grapple.js';
import {createCrowdDraw} from './crowd-draw.js';
import {createRigBudget} from './rig-budget.js';
import {createCrowdTier} from './crowd-tier.js';

// Other visitors aboard, drawn as Cosmo (avatar.js) and moved by the poses Leo live passes on (net/live.js). The
// easing follows Voyager's Reach's remote players (packages/client/src/scene/remotePlayers.ts): a body eases toward its
// latest pose; poses arriving at an even, sparse rate (server/live-core.mjs: every 200 or 400 ms some way off, every
// second farther, and slower still for a page in a dense crowd, to 4 s) are crossed at an even pace rather than chased;
// a stride is worked out from successive positions and dies away when the poses stop moving; someone not heard from for
// 12 s is gone.
//
// Only the nearest visitors on the decks being drawn get a body, from a small pool that is kept and reused: as many as the
// budget for their rigs carries (rig-budget.js: its tier, up to MAX_RIGS; all MAX_RIGS until the crowd is here). The
// rest, up to CROWD_MOST (CROWD_SLOW on a page that can carry few bodies), are the crowd, drawn without a rig, playing
// loops recorded from it (crowd-tier.js: fetched, with a body to copy, the first time there is anyone beyond the
// nearest). A body standing in a lift car stands on its floor as this page draws the car, so a rider never sinks or
// floats.
const STALE_MS=12000,EASE_PER_S=10,GLIDE_MIN_MS=200,GLIDE_MAX_MS=4500,STOPPED_AFTER_MS=185,STRIDE_HALF_LIFE_MS=100;
const RUN_ON_BELT=5,HAT_M=35,MAX_RIGS=24,HOLD_RANKS=3,CROWD_MOST=1000,CROWD_SLOW=150,SLOW_TIER=12,CROWD_RETRY_MS=[5e3,3e4,12e4],LABEL_M=30,LABELS=16,REST_S=.7,PILLOW_TILT=.12,SAY_MS=8000;
// Each body's rig solve (avatar.js) costs about 0.1 ms on a desktop and several times that on a phone: a body outside
// the camera's view (a sphere of IN_VIEW_M round its middle, enough for one lying down or on a board) solves as a 20 fps
// machine would (avatar.js unseen, rig-pace.js), keeping pace, so it is current the frame it comes into view. In view,
// by its height on screen, at most: every frame from FULL_PX, at 30 fps from HALF_PX, below that at 20 fps (at 1080p,
// about 10 m and 17 m off). Every frame while its grapple line is out (the line can cross the view from its paw) or the
// selfie booth counts down (its lens may see the body). Within that, the budget (rig-budget.js) gives the biggest on
// screen the most, and no body less than 20 fps. A body draws as one skinned mesh per material (merged-skin.js): 4
// draws, not 15.
const IN_VIEW_M=2.5,viewFrustum=new T.Frustum(),viewMatrix=new T.Matrix4(),bodySphere=new T.Sphere();
const BODY_M=1.75,FULL_PX=160,HALF_PX=90,HALF_S=1/30,THIRD_S=.05;

// Who of those shown (nearest first) has a body: up to `tier`, held steady at its edge (each change of hands is a pop:
// a body from the pool takes up where the crowd left off, or the crowd where a body did). One with a body keeps it while
// among the nearest tier+hold; one without gets one when among the nearest tier-hold, in place of the farthest kept
// beyond the tier, or among the nearest tier when there is room. So someone walking to and fro across the edge does not
// change hands every few frames.
export function tierOf(shown,tier,hold=HOLD_RANKS){
 const chosen=[],near=[],edge=[];
 for(let i=0;i<shown.length&&i<tier+hold;i++){if(shown[i].walker)chosen.push(i);else if(i<tier-hold)near.push(i);else if(i<tier)edge.push(i);}
 for(const i of near){
  if(chosen.length<tier){chosen.push(i);continue;}
  let far=-1;for(let k=0;k<chosen.length;k++)if(chosen[k]>=tier&&(far<0||chosen[k]>chosen[far]))far=k;
  if(far<0)break;chosen[far]=i;
 }
 chosen.sort((a,b)=>a-b);if(chosen.length>tier)chosen.length=tier;
 for(const i of edge){if(chosen.length>=tier)break;chosen.push(i);}
 return chosen.sort((a,b)=>a-b).map(i=>shown[i]);
}

export class RemotePlayers{
 // make(): a new walker (avatar.js createWalker); colliders: for hiding names behind walls; lifts: lift-ride.js.
 // hatUrl: the captain's hat that testers wear (hat.js). running(position): standing on a Paws Off treadmill's belt
 // (paws-off/game.js), where someone playing runs on the spot. hammock(position): lying in one of the Hydro-Nip
 // Lounge's hammocks (rest.js hammockAt), where they take its pose: the wire says only that they lie. catnip(position):
 // in the Hydro-Nip Lounge (lounge.js inside), where they wear its catnip face (catnip-face.js), as they see themselves.
 // artUrls: the build's art names (__ART_URLS__), for the longboard someone rides down a drop (glide.js). crowd: draw the
 // bodies together, one instanced draw per body part (crowd-draw.js; the bodies need cacheBones: avatar.js). budget:
 // false gives every body its natural rate and MAX_RIGS bodies, whatever they cost (this.budget may also be set to null
 // later, as a probe does to compare). crowdMotion: the URL of the crowd's recorded loops (crowd-motion.json; none: no
 // crowd, only the nearest MAX_RIGS drawn). lean: their bodies shaded cheaply, near and in the crowd alike (crowd-draw.js
 // leanMaterial: a phone's).
 constructor(scene,{make,colliders,lifts,labels,hatUrl,artUrls,running,hammock,catnip,swimming,tube,crowd=false,budget=true,crowdMotion=null,lean=false}){
  Object.assign(this,{scene,make,colliders,lifts,labelLayer:labels,hatUrl,artUrls,running,hammock,catnip,swimming,tube,crowdMotion,lean});
  this.crowdTier=null;this.crowdLoading=false;this.crowdTries=0;this.crowdAfter=0;
  this.budget=budget?createRigBudget({most:MAX_RIGS}):null;
  this.crowd=crowd?createCrowdDraw(scene,{slots:MAX_RIGS,lean}):null;
  this.remotes=new Map();this.pool=[];this.making=false;this.labels=[];this.ray=new T.Ray();this.v=new T.Vector3();
 }
 get count(){return this.remotes.size;}

 onPoses(poses,now=performance.now()){for(const p of poses)this.onPose(p,now);}
 onPose(p,now){
  let r=this.remotes.get(p.id);
  if(!r){r={id:p.id,cur:{x:p.pos[0],y:p.pos[1],z:p.pos[2],yaw:p.yaw},tgt:p,prev:p,prevMs:now,gapMs:0,glideMs:0,glideFrom:[...p.pos],speed:0,arrival:0,rise:0,
   turnRate:0,lastYaw:p.yaw,seen:now,walker:null,rest:p.rest?1:0,restKind:p.rest,label:null,clear:true,clearAt:0};this.remotes.set(p.id,r);}
  // The stride from the sender's own successive positions, smoothed: it wants to be steady rather than exact.
  const dt=Math.max(50,now-r.prevMs)/1000,dx=p.pos[0]-r.prev.pos[0],dz=p.pos[2]-r.prev.pos[2];
  r.speed=r.speed*.5+Math.hypot(dx,dz)/dt*.5;r.arrival=r.speed;r.rise=T.MathUtils.clamp((p.pos[1]-r.prev.pos[1])/dt,-100,100);
  // Sparse twice running is a rate, not a hiccup: glide across it.
  const gap=now-r.prevMs,sparse=ms=>ms>=GLIDE_MIN_MS&&ms<=GLIDE_MAX_MS;
  r.glideMs=sparse(gap)&&sparse(r.gapMs)?gap:0;r.glideFrom=[r.cur.x,r.cur.y,r.cur.z];r.gapMs=gap;
  r.prev=p;r.prevMs=now;r.tgt=p;r.seen=now;
  // Anonymous visitors stay generic instead of showing an account-id suffix.
  if(p.name)r.name=/^Voyager .{4}$/.test(p.name)?'Voyager':p.name;else r.name??='Voyager';r.verified=!!p.verified;r.hat=!!p.hat;
 }
 gone(id){const r=this.remotes.get(id);if(!r)return;this.release(r);r.line?.dispose();r.label?.remove();r.bubble?.remove();this.remotes.delete(id);}
 // A line of chat (chat.js), shown over the speaker's head for SAY_MS.
 say(id,text,now=performance.now()){const r=this.remotes.get(id);if(r)r.said={text,until:now+SAY_MS};}
 // Chat hidden: any bubble showing goes at once.
 hush(){for(const r of this.remotes.values())r.said=null;}
 clear(){for(const id of [...this.remotes.keys()])this.gone(id);}
 release(r){r.ball?.mesh.removeFromParent();r.tube?.removeFromParent();r.line?.hide();if(!r.walker)return;r.walker.holder.removeFromParent();this.pool.push(r.walker);r.walker=null;}

 // view: {camera, low, high, photo} — the heights of the deck bands being drawn (main.js cull); photo: the selfie booth is
 // counting down.
 update(dt,{camera,low,high,photo=false,height=0},now=performance.now()){
  camera.getWorldPosition(this.v);
  // A body's height on screen in pixels at 1 m of depth: the drawing height over the view's height there.
  const pxAt1m=height&&camera.isPerspectiveCamera?BODY_M*height/2/Math.tan(T.MathUtils.degToRad(camera.getEffectiveFOV()/2)):0;
  // Depth along the view, not distance: a body off to the side of the screen is drawn as tall as one ahead at that depth.
  const ce=camera.matrixWorld.elements,fx=-ce[8],fy=-ce[9],fz=-ce[10];const eye=this.v.clone(),k=1-Math.exp(-EASE_PER_S*dt),shown=[];
  const bandLow=bandOf(low),bandHigh=bandOf(high);
  for(const [id,r] of this.remotes){
   if(now-r.seen>STALE_MS){this.gone(id);continue;}
   this.ease(r,k,now-r.prevMs);
   // A still body's poses stop coming: its stride dies away.
   const quiet=now-r.prevMs;r.speed=quiet>STOPPED_AFTER_MS?r.arrival*Math.pow(.5,(quiet-STOPPED_AFTER_MS)/STRIDE_HALF_LIFE_MS):r.speed;
   r.rest=T.MathUtils.clamp(r.rest+(r.tgt.rest?1:-1)*dt/REST_S,0,1);if(r.tgt.rest)r.restKind=r.tgt.rest;
   r.distance=Math.hypot(r.cur.x-eye.x,r.cur.y-eye.y,r.cur.z-eye.z);
   const band=bandOf(r.cur.y+.5);
   if(band>=bandLow&&band<=bandHigh)shown.push(r);else this.release(r);
  }
  // Bodies for the nearest, as many as the budget carries once the crowd can draw the rest; those give theirs back to the
  // pool and join the crowd.
  const budget=this.budget,crowdTier=this.crowdTier;budget?.frame(dt);const tier=budget&&crowdTier?budget.tier:MAX_RIGS;
  shown.sort((a,b)=>a.distance-b.distance);
  const bodied=tierOf(shown,tier),inTier=new Set(bodied),posed=[];
  for(const r of shown)if(!inTier.has(r))this.release(r);
  // Bodies for those chosen, from the pool (bodies are made one at a time: grow); one still without is drawn in the crowd
  // meanwhile, not left out.
  for(const r of bodied)if(!r.walker){const w=this.pool.pop();if(!w){this.grow();break;}r.walker=w;this.scene.add(w.holder);}
  if(shown.length>tier&&!crowdTier)this.startCrowd();
  if(crowdTier){
   // (the cap is of those drawn: one out of view takes no place; the selfie booth's lens may see any of them)
   const most=budget&&budget.tier<SLOW_TIER?CROWD_SLOW:CROWD_MOST;crowdTier.begin(camera,{all:photo,most});
   for(let i=0;i<shown.length&&crowdTier.count<most;i++){const r=shown[i];if(!inTier.has(r)||!r.walker)crowdTier.place(r,dt,!!this.swimming?.(r.cur));}
   crowdTier.end();
  }
  viewFrustum.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  for(const r of bodied){
   if(!r.walker)continue;
   // A body from the pool may have worn someone else's hat.
   if(r.hat&&!r.walker.hat&&this.hatUrl)wearHat(r.walker,this.hatUrl);else if(!r.hat&&r.walker.hat)r.walker.hat.remove();
   const lined=!!r.tgt.hook||r.line?.out>0,forced=photo||lined;
   const unseen=!forced&&!viewFrustum.intersectsSphere(bodySphere.set(bodySphere.center.set(r.cur.x,r.cur.y+.6,r.cur.z),IN_VIEW_M));
   const depth=(r.cur.x-eye.x)*fx+(r.cur.y+BODY_M/2-eye.y)*fy+(r.cur.z-eye.z)*fz,px=pxAt1m/Math.max(depth,.1);
   posed.push({r,unseen,forced,px,natural:unseen?true:forced||!pxAt1m||px>=FULL_PX?0:px>=HALF_PX?HALF_S:THIRD_S});
  }
  // Those that must solve every frame first, then the biggest on screen, each at the rate the budget gives it; what
  // each update takes tells the budget what a solve costs this page.
  if(budget)posed.sort((a,b)=>(b.forced-a.forced)||(a.unseen-b.unseen)||(b.px-a.px));
  // Past the frame's cap (a frame on which many come due at once), the smaller wait a frame or two (rig-pace.js hold).
  const every=budget?budget.rates(posed):posed.map(p=>p.natural),cap=budget?budget.frameCap(posed.length):Infinity;let solved=0;
  for(let i=0;i<posed.length;i++){
   const p=posed[i],solves=this.pose(p.r,dt,p.unseen,every[i]===true?0:every[i],!p.forced&&solved>=cap);
   solved+=solves;budget?.spent(p.r.walker.solveMs,solves);
  }
  this.name(bodied,camera,now);
  // The selfie booth's camera may see a body the view does not: every body is drawn while it counts down.
  this.crowd?.update(camera,{all:photo});
 }
 // The crowd: its loops fetched and a body made to copy, once (crowd-tier.js). Without them, only the nearest are drawn.
 // A try that fails is tried again, CROWD_RETRY_MS later each time, then given up.
 startCrowd(now=performance.now()){
  if(this.crowdLoading||!this.crowdMotion||now<this.crowdAfter||this.crowdTries>CROWD_RETRY_MS.length)return;
  this.crowdLoading=true;this.crowdTries++;
  Promise.all([fetch(this.crowdMotion).then(r=>{if(!r.ok)throw Error('crowd motion '+r.status);return r.json();}),this.make()])
   .then(([motion,template])=>{this.crowdTier=createCrowdTier(this.scene,{template,motion,most:CROWD_MOST,lean:this.lean});})
   .catch(e=>{console.warn('Leo crowd unavailable:',e?.message||e);this.crowdAfter=performance.now()+(CROWD_RETRY_MS[this.crowdTries-1]??Infinity);})
   .finally(()=>{this.crowdLoading=false;});
 }
 // One new body at a time (building one takes a moment); the pool keeps every body made.
 grow(){
  if(this.making||this.pool.length+[...this.remotes.values()].filter(r=>r.walker).length>=MAX_RIGS)return;
  this.making=true;this.make().then(w=>{this.crowd?.add(w);this.pool.push(w);}).catch(()=>{}).finally(()=>{this.making=false;});
 }
 ease(r,k,quiet){
  const to=r.tgt.pos,c=r.cur;
  if(r.glideMs>0){const t=Math.min(1,quiet/r.glideMs);c.x=r.glideFrom[0]+(to[0]-r.glideFrom[0])*t;c.y=r.glideFrom[1]+(to[1]-r.glideFrom[1])*t;c.z=r.glideFrom[2]+(to[2]-r.glideFrom[2])*t;}
  else{c.x+=(to[0]-c.x)*k;c.y+=(to[1]-c.y)*k;c.z+=(to[2]-c.z)*k;}
  // Shortest way round, so a turn through north never spins the long way.
  let d=r.tgt.yaw-c.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));c.yaw+=d*k;
  // Standing in a lift car: on its floor, where this page draws the car.
  if(r.tgt.grounded&&!r.tgt.rest&&this.lifts)for(const l of this.lifts.lifts)if(this.lifts.inside(l,{x:c.x,y:to[1],z:c.z})){c.y=l.y;break;}
 }
 // Returns how many times its rig solved (avatar.js update).
 pose(r,dt,unseen=false,every=0,hold=false){
  const w=r.walker,c=r.cur;
  w.holder.position.set(c.x,c.y,c.z);w.holder.rotation.set(0,c.yaw,0);
  const turn=Math.atan2(Math.sin(c.yaw-r.lastYaw),Math.cos(c.yaw-r.lastYaw));r.lastYaw=c.yaw;
  if(dt>0)r.turnRate=T.MathUtils.damp(r.turnRate,turn/dt,10,dt);
  const e=r.rest*r.rest*(3-2*r.rest),lie=r.restKind==='lie';
  // A Keel Club tube rider sits leaning back into the ring (keel-club.js TUBE_SIT; tube = {make, y, recline}).
  const recline=r.restKind==='tube'&&this.tube?this.tube.recline:0;
  w.body.rotation.set(lie?(-Math.PI/2+PILLOW_TILT)*T.MathUtils.smoothstep(r.rest,.25,1):-recline*T.MathUtils.smoothstep(r.rest,.25,1),0,0);
  w.setFur(r.tgt.fur);
  const t=r.tgt,floating=t.emote==='healing_capsule',belt=t.playing&&!t.rest&&this.running?.(c);
  // Floating in a Keel Club tube (keel-club.js; tube = {make, y, recline}): seated leaning back, in a tube of this page's
  // own on the water. Their pose is the walker's origin, ahead of the hips by the recline, so the ring goes under the hips.
  if(t.rest==='tube'&&this.tube){if(!r.tube)r.tube=this.tube.make();if(!r.tube.parent)this.scene.add(r.tube);{const k=w.hipHeight*Math.sin(this.tube.recline);r.tube.position.set(c.x-Math.sin(c.yaw)*k,this.tube.y,c.z-Math.cos(c.yaw)*k);}}else r.tube?.removeFromParent();
  // Rolling in a hamster ball (hamster-ball.js): standing inside one of this page's own, rolled by their stride.
  if(t.ball&&!t.rest){if(!r.ball)r.ball=createBallMesh();if(!r.ball.mesh.parent)this.scene.add(r.ball.mesh);r.ball.mesh.position.set(c.x,c.y,c.z);
   r.ball.roll(dt,Math.sin(c.yaw)*r.speed,Math.cos(c.yaw)*r.speed);}else r.ball?.mesh.removeFromParent();
  // Riding the longboard down (glide.js): the body's own board, made on its first ride and put away as they land.
  const riding=!!t.glide&&!t.rest&&!t.ball;if(riding&&!w.glide)w.glide=createGlide(w,this.artUrls,{prebuild:false});
  const board=w.glide?w.glide.update(dt,{gliding:riding,speed:r.speed,rise:r.rise,turnRate:r.turnRate}):0;
  // On the grapple line (grapple.js): it reels out from their paw to where it bit, and back in when they let go.
  const hook=t.hook&&!t.rest&&!t.ball?(r.hookAt??=new T.Vector3()).fromArray(t.hook):null;if(hook&&!r.line)r.line=createGrappleLine(this.scene);
  const solves=w.update(dt,{unseen,solveEvery:every,hold,speed:r.rest?0:belt?RUN_ON_BELT:r.speed,grounded:t.grounded,stance:t.ball?'stand':t.stance,jumpCount:t.jumpCount,jumpS:t.jumpS,turnRate:r.turnRate,accel:0,rise:r.rise,
   emote:floating?null:t.emote,rest:floating?{kind:'float',weight:1,seatHeight:w.hipHeight}:r.rest>0?{kind:lie?'lie':'sit',weight:e,seatHeight:w.hipHeight,hammock:lie&&!!this.hammock?.(c),rim:r.restKind==='tube'?this.tube?.rim:null}:null,catnip:!!this.catnip?.(c),swimming:!t.rest&&!!this.swimming?.(c),board,hook});
  r.line?.update(dt,w.hand(this.v2??=new T.Vector3()),hook);
  // A captain's hat is ~200k triangles: past HAT_M it is a few pixels, and not drawn.
  if(w.hat&&r.distance>HAT_M)w.hat.mount.visible=false;
  return solves;
 }
 // Names over the nearest heads, hidden behind walls (checked a few times a second).
 name(bodied,camera,now){
  const near=bodied.filter(r=>r.distance<LABEL_M).slice(0,LABELS),eye=this.v,p=new T.Vector3(),rect=this.labelLayer.getBoundingClientRect();
  for(const r of this.remotes.values())if(r.label&&!near.includes(r)){r.label.hidden=true;if(r.bubble)r.bubble.hidden=true;}
  for(const r of near){
   p.set(r.cur.x,r.cur.y+(r.rest&&r.restKind==='lie'?.8:2.15),r.cur.z);
   if(now-r.clearAt>250){r.clearAt=now;const d=p.clone().sub(eye),len=d.length();this.ray.set(eye,d.divideScalar(len));
    // Aquarium glass stays solid to swimmers but should not hide their names.
    const hit=this.swimming?.(r.cur)?this.colliders.raycastSight(this.ray,len):this.colliders.raycast(this.ray,len);r.clear=!hit||hit.distance>len-.4;}
   p.project(camera);
   if(!r.label){r.label=document.createElement('div');r.label.className='remote-name';this.labelLayer.appendChild(r.label);}
   // At the lounge telescope's game, the name says so.
   const text=(r.name||'Voyager')+(r.tgt?.playing?' · playing':'');if(r.label.textContent!==text)r.label.textContent=text;
   // A teal dot: the name is their Discord name, vouched for by The Creamery.
   r.label.classList.toggle('verified',r.verified);
   r.label.hidden=!r.clear||p.z>1;
   const at=`translate(${(p.x+1)/2*rect.width}px,${(1-p.y)/2*rect.height}px)`;
   if(!r.label.hidden)r.label.style.transform=`${at} translate(-50%,-100%)`;
   // What they just said, in a bubble above the name.
   const saying=r.said&&now<r.said.until?r.said.text:'';
   if(saying&&!r.bubble){r.bubble=document.createElement('div');r.bubble.className='remote-say';this.labelLayer.appendChild(r.bubble);}
   if(r.bubble){if(r.bubble.textContent!==saying)r.bubble.textContent=saying;r.bubble.hidden=!saying||r.label.hidden;
    if(!r.bubble.hidden)r.bubble.style.transform=`${at} translate(-50%,calc(-100% - 28px))`;}
  }
 }
}
