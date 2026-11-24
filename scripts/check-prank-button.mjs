import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {contains} from '../src/plan/geometry-v2.js';
import {plannedStanding} from '../src/v2/standing.js';
import {Colliders} from '../src/walk/collision.js';
import {prankFittings,attachPrankCollider,stainWeights,stainSources,createPrankMess,photoCrop,PRANK} from '../src/walk/prank-button.js';
import {installPreparedColliders} from '../src/v2/prepared-codec.public.js';
import {createPrankTiming,PRANK_TIME} from '../src/walk/prank-timing.js';
import {LIFTS} from '../src/walk/lifts.js';

let checks=0;const pass=s=>{checks++;console.log('PASS '+s);};
{
 // Embedded textures need no decoding for these geometry and skinning probes.
 const load=T.ImageLoader.prototype.loadAsync;let asset;
 try{T.ImageLoader.prototype.loadAsync=async()=>({width:1,height:1});const {createDLCat}=await import('../src/vendor/cosmo/DLCat.js');asset=await createDLCat({height:1.75});}finally{T.ImageLoader.prototype.loadAsync=load;}
 assert.deepEqual(stainSources(asset).map(m=>m.userData.originalName).sort(),['body','hoodie.001','hoodie.002']);
 const mess=createPrankMess({figure:{asset}});assert(mess.body.length>=12);assert(mess.body.some(o=>o.userData.prankSurface==='hoodie.001'),'stains sit on the outer hoodie');assert(mess.body.some(o=>o.userData.prankSurface==='hoodie.002'),'stains also follow the raised pocket');
 for(const o of mess.body){assert(o.isSkinnedMesh);assert(o.geometry.attributes.skinWeight);assert(o.geometry.attributes.position.array.every(Number.isFinite));}
 mess.dispose();asset.dispose();pass('the real avatar uses original clothing names and receives skinned stains on its hoodie and pocket');
}
{
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,1,0,0,0,1,0,0,0,1,0,0],4));g.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,.35,.65,0,0,0,1,0,0],4));
 const face={a:0,b:1,c:2},skin=stainWeights(g,{face,point:new T.Vector3(.25,.5,0)}),weight=id=>skin.weights.reduce((n,w,k)=>n+(skin.ids[k]===id?w:0),0);assert(Math.abs(weight(0)-.3375)<1e-6);assert(Math.abs(weight(1)-.6625)<1e-6);
 const root=new T.Group(),a=new T.Bone(),b=new T.Bone();a.add(b);root.add(a);const source=new T.SkinnedMesh(g,new T.MeshBasicMaterial());root.add(source);source.add(a);source.bind(new T.Skeleton([a,b]));
 const v=new T.Vector3().fromBufferAttribute(g.attributes.position,1),atVertex=stainWeights(g,{face,point:v}),overlay=new T.BufferGeometry();overlay.setAttribute('position',new T.Float32BufferAttribute(v.toArray(),3));overlay.setAttribute('skinIndex',new T.Uint16BufferAttribute(atVertex.ids,4));overlay.setAttribute('skinWeight',new T.Float32BufferAttribute(atVertex.weights,4));const stain=new T.SkinnedMesh(overlay,new T.MeshBasicMaterial());root.add(stain);stain.bind(source.skeleton,source.bindMatrix);
 for(const angle of [0,.4,-.6]){b.rotation.y=angle;b.position.set(.1,angle,.2);root.updateMatrixWorld(true);source.skeleton.update();assert(source.getVertexPosition(1,new T.Vector3()).distanceTo(stain.getVertexPosition(0,new T.Vector3()))<1e-6,'stain follows the clothing through blended bone poses');}
 g.dispose();overlay.dispose();source.material.dispose();stain.material.dispose();pass('stains inherit surface bone weights and follow the clothing through torso poses');
}
function clock(overrides={}){
 let now=1000,id=0;const jobs=new Map(),events=[];
 const hooks=Object.fromEntries(['begin','photo','release','reset','clean','error'].map(k=>[k,()=>events.push(k)]));
 const timing=createPrankTiming({...hooks,...overrides},{now:()=>now,set:(fn,ms)=>{jobs.set(++id,{fn,at:now+ms});return id;},clear:id=>jobs.delete(id)});
 return {timing,events,advance(ms){const end=now+ms;for(;;){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;jobs.delete(next[0]);next[1].fn();}now=end;},get jobs(){return jobs.size;}};
}
{
 let c;c=clock({begin(){c.advance(800);}});assert(c.timing.start());assert.equal(c.timing.elapsed,0);c.advance(2000);assert.equal(c.timing.elapsed,2);assert(c.timing.locked);assert(!c.events.includes('photo'));c.advance(500);assert(c.events.includes('photo'));c.advance(500);assert(!c.timing.locked);c.timing.dispose();
 pass('effect setup time cannot put the animation clock ahead of its photo and release timers');
}
{
 const c=clock(),t=c.timing;assert.equal(c.jobs,0);assert(!t.locked&&!t.messy);assert(t.start());assert(t.locked&&t.messy);assert(!t.start());
 c.advance(PRANK_TIME.photo);assert(c.events.includes('photo'));assert(t.locked);c.advance(PRANK_TIME.release-PRANK_TIME.photo);assert(!t.locked&&t.cooling);assert.equal(c.events.filter(e=>e==='release').length,1);
 c.advance(PRANK_TIME.reset-PRANK_TIME.release);assert(!t.cooling);assert(c.events.includes('reset'));assert(t.messy);assert(t.start());c.advance(PRANK_TIME.mess-1);assert(t.messy);c.advance(1);assert(!t.messy);assert(c.events.includes('clean'));assert.equal(c.jobs,0);
 pass('photo at 2.5 s, guaranteed release at 3 s, reset at 7 s, repeat restarts the full five minutes');
}
for(const point of ['begin','photo']){
 const c=clock({[point](){throw Error('capture unavailable');}});c.timing.start();c.advance(PRANK_TIME.photo);assert(!c.timing.locked&&!c.timing.cooling);assert(c.events.includes('release'));assert(c.events.includes('reset'));assert(c.events.includes('error'));c.advance(300000);
 pass(point+' error releases and resets without leaving a pending sequence');
}
{
 const c=clock();c.timing.start();c.advance(1000);c.timing.cancel();assert(!c.timing.locked);c.advance(3000);assert(!c.events.includes('photo'));assert.equal(c.events.filter(e=>e==='release').length,1);c.timing.dispose();assert(!c.timing.messy);assert.equal(c.jobs,0);
 pass('Escape or navigation cancels capture; disposal clears every timer and attached mess');
}
const f=prankFittings(),colliders=new Colliders(),prepared=new Colliders();prepared.v2PreparedMovers=new Map();prepared.v2Ground=new Colliders();prepared.v2Ground.movers=prepared.movers;
installPreparedColliders(colliders,prepared);
assert.throws(()=>colliders.addMover('Do_not_press_button',f.triangles),/Missing prepared movable collision/);
const mover=attachPrankCollider(colliders,f.triangles);assert.equal(colliders.movers[0],mover);assert.equal(colliders.v2Ground.movers[0],mover);assert.equal(colliders.v2PreparedMovers.size,0);
pass('local collider attaches to the public prepared world and shared ground queries without a baked mover entry');
const [x,y,z]=PRANK.at,c=Math.cos(PRANK.yaw),s=Math.sin(PRANK.yaw),world=(u,v)=>[x+c*u+s*v,y,z-s*u+c*v];
const blocked=p=>colliders.overlaps(new T.Line3(new T.Vector3(p[0],p[1]+.35,p[2]),new T.Vector3(p[0],p[1]+1.65,p[2])),.35);
assert(blocked(PRANK.at),'pedestal is solid');
const deck=layout.decks.find(d=>d.number===6);assert.equal(Math.round(y*10),Math.round(deck.y*10));
for(const p of [PRANK.at,world(0,PRANK.behind),world(0,-1),world(0,.94)]){assert(plannedStanding(layout,...p));assert(contains(deck.slab.outline,[p[0],p[2]]));}
for(let u=-3;u<=3;u+=.1)assert(!blocked(world(u,.94)),'standing capsule fits between pedestal and sign');
pass('pedestal collides, both fittings stand on Deck 6, and the full capsule fits through the gap');
for(const lift of LIFTS.filter(l=>l.id.startsWith('forward-'))){const stop=lift.stops.find(s=>s.deck===6);for(let dx=-1;dx<=1;dx+=.25)for(let out=.4;out<=3;out+=.25){const p=[lift.car.x+dx,stop.y,lift.car.z+lift.door.sign*(lift.car.depth/2+out)];assert(!blocked(p));}}
pass('both forward lift entrances and their three-metre approaches stay clear of the new fitting');
for(const suffix of ['', '.public', '.prepared', '.authoring']){const source=fs.readFileSync(new URL('../src/walk/main'+suffix+'.js',import.meta.url),'utf8');for(const hook of ['prank=createPrankButton','prank?.locked?prank.camera','prank?.near(p)','prank?.update()','prank.cancel()'])assert(source.includes(hook),suffix+' '+hook);}
pass('all four walk entry points install the same station, camera, prompt, update and cancellation');
{
 // The souvenir's photo window is 1012×620. Phones held upright (and wide desktops) crop to it rather than squeeze.
 for(const [w,h] of [[1080,1920],[1170,2532],[1920,1080],[2560,1080],[1012,620]]){
  const [x,y,cw,ch]=photoCrop(w,h,1012,620);
  assert(Math.abs(cw/ch-1012/620)<1e-9,'the crop keeps the photo window shape, so nothing is stretched');
  assert(x>=0&&y>=0&&x+cw<=w+1e-9&&y+ch<=h+1e-9,'the crop stays inside the capture');
  assert(Math.abs(x+cw/2-w/2)<1e-9&&Math.abs(y+ch/2-h/2)<1e-9,'the crop is centred where the lens aims');
  assert(Math.abs(cw-w)<1e-9||Math.abs(ch-h)<1e-9,'the crop uses the full width or the full height');
 }
 pass('the souvenir photo crops portrait and wide captures to its window instead of stretching them');
}
console.log('prank button: '+checks+' checks passed');
