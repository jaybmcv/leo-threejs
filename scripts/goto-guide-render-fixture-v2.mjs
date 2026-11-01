import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import * as T from 'three';
import layout from 'v2-layout';
export {V2_PLACES as runtimePlaces} from '../src/v2/wayfinding.js';
import {bandOf} from '../src/walk/collision.js';
import {addWayfindingGuides} from '../src/v2/wayfinding-guides.js';
import {guideSchedule} from '../src/v2/wayfinding-guide-data.js';
export function checkGuideRendering(){
 const original=globalThis.document;globalThis.document={createElement:()=>createCanvas(1,1)};
 try{const parent=new T.Group(),roots=addWayfindingGuides(parent),schedule=new Map(guideSchedule(layout).map(r=>[r.id,r]));assert.equal(parent.children.length,20,'Guides must be attached per deck');assert.equal(roots.length,20);
 const bandErrors=()=>roots.filter(g=>bandOf(g.position.y)!==g.userData.deck-1);
 assert.equal(bandErrors().length,0,'Guides assigned to the wrong walk band');
 const moved=roots[4],y=moved.position.y;moved.position.y=0;assert(bandErrors().includes(moved),'Cross-deck root mutation escaped render-band check');moved.position.y=y;
 parent.updateMatrixWorld(true);let labels=0,boards=0,arrows=0;
 for(const root of roots)for(const mesh of root.children){if(mesh.name==='V2_lobby_deck_directory'){boards++;assert.equal(bandOf(mesh.getWorldPosition(new T.Vector3()).y),root.userData.deck-1);}
 if(mesh.name==='V2_floor_guides'){arrows++;assert.deepEqual(mesh.userData.destinations,[...schedule.values()].filter(r=>r.deck===root.userData.deck).map(r=>r.id),'Every scheduled room needs its floor guide');const n=mesh.geometry.attributes.normal;for(let i=0;i<n.count;i++)assert(n.getY(i)>.999,'Floor guide faces into the slab');}
 if(mesh.name!=='V2_corridor_room_guides')continue;const position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal;
 for(const [i,label]of mesh.userData.labels.entries()){const r=schedule.get(label.id),centre=new T.Vector3();for(let j=0;j<4;j++)centre.add(new T.Vector3().fromBufferAttribute(position,i*4+j));centre.multiplyScalar(.25).applyMatrix4(mesh.matrixWorld);assert(centre.distanceTo(new T.Vector3(...r.at))<.0001,'Plaque moved in world space '+r.id);const face=new T.Vector3(normal.getX(i*4),normal.getY(i*4),normal.getZ(i*4));assert(face.dot(new T.Vector3(Math.sin(r.yaw),0,Math.cos(r.yaw)))>.999,'Plaque faces away from corridor');labels++;}
 }
 assert.equal(labels,schedule.size);assert.equal(boards,39);assert.equal(arrows,new Set([...schedule.values()].map(r=>r.deck)).size,'Exactly one arrow batch per deck with scheduled rooms');return {status:'PASS',deckRoots:roots.length,labels,boards,arrowBatches:arrows,negativeFixture:'A single zero-height cross-deck root is rejected'};
 }finally{globalThis.document=original;}
}
