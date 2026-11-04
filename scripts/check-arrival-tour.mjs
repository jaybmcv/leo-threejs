import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {toWorld,setFrameOverride,clearFrameOverrides} from '../src/plan/rooms.js';
import {createArrivalTour,ARRIVAL_TOUR} from '../src/walk/arrival-tour.js';

// A small DOM fixture exercises the actual tour without loading the full ship.
class Element{
 constructor(){this.children=[];this.hidden=false;this.style={};this.listeners={};this.classList={toggle(){}};}
 append(...kids){this.children.push(...kids);}
 setAttribute(){}
 addEventListener(name,fn){this.listeners[name]=fn;}
 blur(){}
 get firstChild(){return this.children[0];}
 get lastChild(){return this.children.at(-1);}
}
const body=new Element(),names=new Element();let touch=false;
globalThis.document={body,createElement:()=>new Element(),getElementById:id=>id==='names'?names:null};
globalThis.matchMedia=()=>({matches:touch});globalThis.innerWidth=1280;globalThis.innerHeight=720;
const tour=createArrivalTour({figure:()=>new T.Group()}),card=body.lastChild;
const [count,title,text,controls,distance,buttons]=card.children,[back,next,skip]=buttons.children;
const marker=names.lastChild,p=new T.Vector3(...toWorld('d02-arrival-1',[-20,0,0]));
const camera=new T.PerspectiveCamera(65,1280/720,.1,1000);
camera.position.copy(p).add(new T.Vector3(-3,2,0));camera.lookAt(tour.group.position);camera.updateMatrixWorld(true);
const original=p.clone();tour.update(p,camera,false);assert(card.hidden,'No offer behind loading or another panel');
tour.update(p,camera,true);assert(!card.hidden);assert.equal(title.textContent,'Welcome aboard Leo');
assert.equal(tour.near(tour.group.position).kind,'arrival-tour');
assert.equal(tour.near(tour.group.position.clone().add(new T.Vector3(0,4,0))),null,'No interaction from another deck');
assert.equal(tour.stops.length,5);assert.equal(ARRIVAL_TOUR.length,5);
next.onclick();tour.update(p,camera,true);assert.match(count.textContent,/1 \/ 5/);assert(back.disabled);assert(!marker.hidden);
assert.equal(marker.lastChild.textContent,`${Math.round(p.distanceTo(tour.stops[0].point))} m · follow the marker`);
assert.match(marker.style.transform,/translate\([\d.]+px,[\d.]+px\)/);assert(!/NaN|Infinity/.test(marker.style.transform));
assert.match(controls.textContent,/WASD/);
tour.update(p,camera,false);assert(card.hidden&&marker.hidden,'Other panels hide the tour');
tour.update(p,camera,true);assert(!card.hidden&&!marker.hidden,'Closing another panel resumes the tour');
next.onclick();assert.match(title.textContent,/yarn/);back.onclick();assert.match(count.textContent,/1 \/ 5/);
touch=true;next.onclick();assert.match(controls.textContent,/joystick/,'Touch has its own instructions');
for(let i=1;i<5;i++){
 tour.update(tour.stops[i].point,camera,true);assert.match(distance.textContent,/At this stop/);
 next.onclick();
}
assert.equal(title.textContent,'Ready to explore');tour.update(p,camera,true);assert(marker.hidden);
next.onclick();assert.match(count.textContent,/1 \/ 5/,'Replay resets the route');
tour.update(p.clone().add(new T.Vector3(0,4,0)),camera,true);assert.match(distance.textContent,/Deck 2/);
skip.onclick();tour.update(p,camera,true);assert(card.hidden&&marker.hidden,'Skip stays dismissed on approach');
tour.open();next.onclick();assert.match(count.textContent,/1 \/ 5/);tour.close();tour.update(p,camera,true);assert(card.hidden);
assert.deepEqual(p,original,'The tour never moves the walker');
let stopped=false;card.listeners.keydown({code:'Enter',stopPropagation(){stopped=true;}});assert(stopped,'Button activation does not also Use');
// Ownership follows the room even when the production fitting frame is rotated for review.
setFrameOverride('d02-arrival-1',{dx:8,dz:-3,yawDeg:90});
const moved=createArrivalTour({figure:()=>new T.Group()});
assert.deepEqual(moved.group.position.toArray(),toWorld('d02-arrival-1',[-16,0,-3]));
for(const [i,s]of moved.stops.entries())assert.deepEqual(s.point.toArray(),toWorld('d02-arrival-1',ARRIVAL_TOUR[i].at));
clearFrameOverrides();
for(const suffix of ['', '.public','.prepared','.authoring']){
 const source=await fs.readFile(`src/walk/main${suffix}.js`,'utf8');
 for(const hook of ["from './arrival-tour.js'",'arrivalTour=createArrivalTour(cosmoKit)','arrivalTour?.update(p,camera',"t.kind==='arrival-tour'",'arrivalTour?.close()','arrivalTour?.open()'])assert(source.includes(hook),`${suffix||'default'} entry: ${hook}`);
}
console.log('PASS arrival tour: offer, five stops, waypoint projection, controls, panel coexistence, skip, replay, room frames and all four entry points');
