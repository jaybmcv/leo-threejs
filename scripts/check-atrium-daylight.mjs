import assert from 'node:assert/strict';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import layout from '../src/plan/selected-layout.js';
import {contains} from '../src/plan/geometry-v2.js';
import {addDownlights,gardenGlowMaterial} from '../src/v2/atrium-gardens.js';
import {paintDaylightSky} from '../src/v2/atrium-daylight.js';

// Use the selected ship: upper galleries share outlines, unlike the lower stepped terraces.
const root=new T.Group();addDownlights(root,layout);
assert.equal(root.children.length,1,'all decks share one draw');
const lights=root.children[0],at=new T.Matrix4(),rows=new Map();let lower=0;
assert(lights.isInstancedMesh&&!lights.frustumCulled&&lights.userData.noCollide);
assert.equal(lights.material,gardenGlowMaterial);assert.equal(lights.material.color.getHex(),0xffe3b8);
assert.equal(lights.geometry.parameters.radius,.16);
for(let i=0;i<lights.count;i++){
 lights.getMatrixAt(i,at);const e=at.elements,x=e[12],y=e[13],z=e[14];
 const deck=layout.decks.find(d=>Math.abs(d.y-.389-y)<.001);assert(deck&&deck.number>=7&&deck.number<=20);
 assert(Math.abs(e[0]-1)<1e-6&&Math.abs(e[5]-1)<1e-6&&Math.abs(e[10]-1)<1e-6,'same lamp size on every deck');
 if(deck.number<=16){lower++;continue;}
 assert(contains(deck.slab.outline,[x,z])&&!contains(deck.atrium.outline,[x,z]),'upper lamps stay under the slab');
 assert(!(deck.slab.holes||[]).some(h=>h.id!=='atrium'&&contains(h.polygon,[x,z])),'no lamps across slab holes');
 assert(!layout.rooms.some(r=>!r.aggregate&&r.y<y+.05&&r.y+r.height>y+.02&&contains(r.polygon,[x,z])),'no lamps in enclosed rooms');
 const key=deck.number+':'+Math.sign(z);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(x);
}
assert.equal(lower,772,'the existing lower-deck lamps stay intact');
for(const deck of[17,18,19,20])for(const side of[-1,1]){
 const xs=rows.get(deck+':'+side);assert(xs?.length>60,'both upper sides have continuous rows: '+deck+':'+side);
 for(const [a,b]of[[-120,-65],[-65,-10],[-10,45],[45,100],[100,140]])assert(xs.some(x=>x>a&&x<b),'row reaches the full atrium length');
}
console.log('PASS downlights through Deck 20: lower lamps retained, upper rows on both sides, one instanced draw, no room or hole intrusions');

const sky=paintDaylightSky(createCanvas(1,1)),g=sky.getContext('2d');
assert.equal(sky.width,2048);assert.equal(sky.height,256);
const pixel=(x,y)=>Array.from(g.getImageData(x,y,1,1).data),edge=pixel(0,0),centre=pixel(0,128),bow=pixel(2047,128);
assert(edge[0]>centre[0]+35&&edge[1]>centre[1]+25,'edges fade into lighter haze');
assert(edge[2]-edge[0]<centre[2]-centre[0],'haze is less saturated than overhead');
assert(bow[0]>centre[0]+45,'gradient also softens toward the bow');
const pixels=g.getImageData(0,0,sky.width,sky.height).data;
assert.deepEqual(pixels,paintDaylightSky(createCanvas(1,1)).getContext('2d').getImageData(0,0,sky.width,sky.height).data,'authored sky is deterministic');
let soft=0,bright=0;const widths=[];let run=0;
for(let x=0;x<sky.width;x++){
 let cloud=false;for(let y=0;y<sky.height;y++){const i=(y*sky.width+x)*4;assert.equal(pixels[i+3],255);if(pixels[i]>225&&Math.abs(pixels[i]-pixels[i+1])<15){cloud=true;bright++;}if(pixels[i]>190&&pixels[i]<225&&pixels[i+2]>pixels[i])soft++;}
 if(cloud)run++;else if(run){widths.push(run);run=0;}
}
assert(bright>100&&soft>1000,'clouds have white cores and soft shaded transitions');
assert(widths.length>=8&&Math.max(...widths)>Math.min(...widths)*2,'clouds vary in size and spacing');
console.log('PASS opaque procedural sky: hazy gradient, varied soft clouds, unchanged texture size');
