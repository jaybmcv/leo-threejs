import * as T from 'three';
import {bandOf} from './collision.js';
import {wearHat} from './hat.js';
import {createBallMesh} from './hamster-ball.js';

// Other visitors aboard, drawn as Cosmo (avatar.js) and moved by the poses Leo live passes on (net/live.js). The
// easing follows Voyager's Reach's remote players (packages/client/src/scene/remotePlayers.ts): a body eases toward its
// latest pose; poses arriving at an even, sparse rate (the server's twice a second for someone far off) are crossed at
// an even pace rather than chased; a stride is worked out from successive positions and dies away when the poses stop
// moving; someone not heard from for 12 s is gone.
//
// Only the nearest MAX_RIGS visitors on the decks being drawn get a body, from a small pool that is kept and reused. A
// body standing in a lift car stands on its floor as this page draws the car, so a rider never sinks or floats.
const STALE_MS=12000,EASE_PER_S=10,GLIDE_MIN_MS=200,GLIDE_MAX_MS=700,STOPPED_AFTER_MS=185,STRIDE_HALF_LIFE_MS=100;
const RUN_ON_BELT=5,HAT_M=35,MAX_RIGS=24,LABEL_M=30,LABELS=16,REST_S=.7,PILLOW_TILT=.12,SAY_MS=8000;

export class RemotePlayers{
 // make(): a new walker (avatar.js createWalker); colliders: for hiding names behind walls; lifts: lift-ride.js.
 // hatUrl: the captain's hat that testers wear (hat.js). running(position): standing on a Paws Off treadmill's belt
 // (paws-off/game.js), where someone playing runs on the spot. hammock(position): lying in one of the Hydro-Nip
 // Lounge's hammocks (rest.js hammockAt), where they take its pose: the wire says only that they lie.
 constructor(scene,{make,colliders,lifts,labels,hatUrl,running,hammock}){
  Object.assign(this,{scene,make,colliders,lifts,labelLayer:labels,hatUrl,running,hammock});
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
  r.prev=p;r.prevMs=now;r.tgt=p;r.seen=now;r.name=p.name||r.name;r.verified=!!p.verified;r.hat=!!p.hat;
 }
 gone(id){const r=this.remotes.get(id);if(!r)return;this.release(r);r.label?.remove();r.bubble?.remove();this.remotes.delete(id);}
 // A line of chat (chat.js), shown over the speaker's head for SAY_MS.
 say(id,text,now=performance.now()){const r=this.remotes.get(id);if(r)r.said={text,until:now+SAY_MS};}
 // Chat hidden: any bubble showing goes at once.
 hush(){for(const r of this.remotes.values())r.said=null;}
 clear(){for(const id of [...this.remotes.keys()])this.gone(id);}
 release(r){r.ball?.mesh.removeFromParent();if(!r.walker)return;r.walker.holder.removeFromParent();this.pool.push(r.walker);r.walker=null;}

 // view: {camera, low, high} — the heights of the deck bands being drawn (main.js cull).
 update(dt,{camera,low,high},now=performance.now()){
  camera.getWorldPosition(this.v);const eye=this.v.clone(),k=1-Math.exp(-EASE_PER_S*dt),shown=[];
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
  // Bodies for the nearest; the rest give theirs back to the pool.
  shown.sort((a,b)=>a.distance-b.distance);
  shown.slice(MAX_RIGS).forEach(r=>this.release(r));
  const bodied=shown.slice(0,MAX_RIGS);
  for(const r of bodied){
   if(!r.walker){
    const w=this.pool.pop();if(w)r.walker=w;else{this.grow();continue;}
    this.scene.add(r.walker.holder);
   }
   // A body from the pool may have worn someone else's hat.
   if(r.hat&&!r.walker.hat&&this.hatUrl)wearHat(r.walker,this.hatUrl);else if(!r.hat&&r.walker.hat)r.walker.hat.remove();
   this.pose(r,dt);
  }
  this.name(bodied,camera,now);
 }
 // One new body at a time (building one takes a moment); the pool keeps every body made.
 grow(){
  if(this.making||this.pool.length+[...this.remotes.values()].filter(r=>r.walker).length>=MAX_RIGS)return;
  this.making=true;this.make().then(w=>{this.pool.push(w);}).catch(()=>{}).finally(()=>{this.making=false;});
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
 pose(r,dt){
  const w=r.walker,c=r.cur;
  w.holder.position.set(c.x,c.y,c.z);w.holder.rotation.set(0,c.yaw,0);
  const turn=Math.atan2(Math.sin(c.yaw-r.lastYaw),Math.cos(c.yaw-r.lastYaw));r.lastYaw=c.yaw;
  if(dt>0)r.turnRate=T.MathUtils.damp(r.turnRate,turn/dt,10,dt);
  const e=r.rest*r.rest*(3-2*r.rest),lie=r.restKind==='lie';
  w.body.rotation.set(lie?(-Math.PI/2+PILLOW_TILT)*T.MathUtils.smoothstep(r.rest,.25,1):0,0,0);
  const t=r.tgt,belt=t.playing&&!t.rest&&this.running?.(c);
  // Rolling in a hamster ball (hamster-ball.js): standing inside one of this page's own, rolled by their stride.
  if(t.ball&&!t.rest){if(!r.ball)r.ball=createBallMesh();if(!r.ball.mesh.parent)this.scene.add(r.ball.mesh);r.ball.mesh.position.set(c.x,c.y,c.z);
   r.ball.roll(dt,Math.sin(c.yaw)*r.speed,Math.cos(c.yaw)*r.speed);}else r.ball?.mesh.removeFromParent();
  w.update(dt,{speed:r.rest?0:belt?RUN_ON_BELT:r.speed,grounded:t.grounded,stance:t.ball?'stand':t.stance,jumpCount:t.jumpCount,jumpS:t.jumpS,turnRate:r.turnRate,accel:0,rise:r.rise,
   emote:t.emote,rest:r.rest>0?{kind:lie?'lie':'sit',weight:e,seatHeight:w.hipHeight,hammock:lie&&!!this.hammock?.(c)}:null});
  // A captain's hat is ~200k triangles: past HAT_M it is a few pixels, and not drawn.
  if(w.hat&&r.distance>HAT_M)w.hat.mount.visible=false;
 }
 // Names over the nearest heads, hidden behind walls (checked a few times a second).
 name(bodied,camera,now){
  const near=bodied.filter(r=>r.distance<LABEL_M).slice(0,LABELS),eye=this.v,p=new T.Vector3(),rect=this.labelLayer.getBoundingClientRect();
  for(const r of this.remotes.values())if(r.label&&!near.includes(r)){r.label.hidden=true;if(r.bubble)r.bubble.hidden=true;}
  for(const r of near){
   p.set(r.cur.x,r.cur.y+(r.rest&&r.restKind==='lie'?.8:2.15),r.cur.z);
   if(now-r.clearAt>250){r.clearAt=now;const d=p.clone().sub(eye),len=d.length();this.ray.set(eye,d.divideScalar(len));const hit=this.colliders.raycast(this.ray,len);r.clear=!hit||hit.distance>len-.4;}
   p.project(camera);
   if(!r.label){r.label=document.createElement('div');r.label.className='remote-name';this.labelLayer.appendChild(r.label);}
   // At the lounge telescope's game, the name says so.
   const text=(r.name||'Voyager '+r.id.slice(-4))+(r.tgt?.playing?' · playing':'');if(r.label.textContent!==text)r.label.textContent=text;
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
