import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {contains} from '../src/plan/geometry-v2.js';
import {plannedStanding} from '../src/v2/standing.js';
import {Colliders} from '../src/walk/collision.js';
import {prankFittings,PRANK} from '../src/walk/prank-button.js';
import {createPrankTiming,PRANK_TIME} from '../src/walk/prank-timing.js';
import {LIFTS} from '../src/walk/lifts.js';

let checks=0;const pass=s=>{checks++;console.log('PASS '+s);};
function clock(overrides={}){
 let now=1000,id=0;const jobs=new Map(),events=[];
 const hooks=Object.fromEntries(['begin','photo','release','reset','clean','error'].map(k=>[k,()=>events.push(k)]));
 const timing=createPrankTiming({...hooks,...overrides},{now:()=>now,set:(fn,ms)=>{jobs.set(++id,{fn,at:now+ms});return id;},clear:id=>jobs.delete(id)});
 return {timing,events,advance(ms){const end=now+ms;for(;;){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;jobs.delete(next[0]);next[1].fn();}now=end;},get jobs(){return jobs.size;}};
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
const f=prankFittings(),colliders=new Colliders();colliders.addMover('prank',f.triangles);
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
console.log('prank button: '+checks+' checks passed');
