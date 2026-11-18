import assert from 'node:assert/strict';
import * as T from 'three';
import {loungeMoodRegion} from '../src/walk/lounge-mood.js';
import {setAtriumView,inOpenAtrium,fastAtriumSpan} from '../src/v2/atrium-visibility.js';
import {createAtriumMood} from '../src/walk/atrium-mood.js';
import {setTimeChoice} from '../src/walk/ship-time.js';

const inside=loungeMoodRegion();
// Sweep the whole glass and its approaches, including the thin strip the room
// polygon owns outside the pane. Feet and first-person eyes must agree.
for(const y of [24.3,28.3,32.3]){
 for(let x=-140.8;x<=-88.2;x+=.4)for(const z of [-23.12,-24.05,-24.149])for(const rise of [0,1.65]){
  const p={x,y:y+rise,z};setAtriumView(p);assert(inOpenAtrium(),'Atrium missing at '+JSON.stringify(p));
  assert(!inside(p),'Lounge spills past the glass at '+JSON.stringify(p));
  if(!rise)assert(fastAtriumSpan(p),'Walkway must keep the atrium visibility span');
 }
 for(const x of [-140,-130,-114.5,-100,-89])for(const z of [-24.151,-25,-35]){
  const p={x,y:y+1.65,z};setAtriumView(p);assert(!inOpenAtrium(),'Atrium spills inside at '+JSON.stringify(p));
  assert(inside(p),'Lounge missing inside at '+JSON.stringify(p));
 }
 console.log('PASS Deck '+(17+(y-24.3)/4)+' walkway and lounge meet at the outer aquarium pane');
}
// The reported approach and the two requested neighbouring views stay warm.
// Exercise the actual mood, holding each ship-time choice, without a renderer.
for(const choice of ['day','night']){
 setTimeChoice(choice,{persist:false});
 const scene=new T.Scene(),hemi=new T.HemisphereLight(0xeef4ff,0x4f5d68,1),fill=new T.DirectionalLight(0xf2f6ff,.55);
 scene.environmentIntensity=.65;const mood=createAtriumMood({hemi,fill,scene});
 for(const y of [24.3,28.3,32.3])for(const x of [-81.7,-82.7,-86.7,-92.7,-114.5,-140.8]){
  setAtriumView({x,y,z:-23.12});for(let i=0;i<60;i++)mood.update(.1);
  assert(mood.mood>.999);assert(hemi.color.r>hemi.color.b);
  assert(Math.abs(scene.environmentIntensity-.65*(choice==='day'?.55:.15))<1e-6);
 }
 setAtriumView({x:-114.5,y:24.3,z:-35});mood.update(.1);
 assert.equal(mood.mood,0);assert.equal(hemi.intensity,1);assert.equal(scene.environmentIntensity,.65);
 console.log('PASS '+choice+' atrium mood holds along all three decks and releases inside the lounge');
}
