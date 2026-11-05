import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {Colliders} from '../src/walk/collision.js';
import {BRIDGES,createCatTree} from '../src/walk/cat-tree.js';
import {phase6Programme} from '../src/v2/phase6-programme.js';
import {planVoidGuards} from '../src/v2/void-guards.js';
import {polygonGeometry} from '../src/v2/geometry.js';
const parts=phase6Programme(layout).parts,tree=createCatTree(null);

// Each Great Cat Tree bridge lands on its bow cafe's aft wall: the cafe's real shell (src/v2/room-shell.js) must leave a
// doorway a walker fits through where the bridge meets it, while the rest of that wall stays solid.
const cafe={9:'nose-commons-04',12:'nose-commons-07',15:'nose-commons-10'};
for(const b of BRIDGES){
 const r=layout.rooms.find(r=>r.id===cafe[b.deck]),door=(r.galleryDoors||[]).find(d=>/cat-tree-bridge/.test(d.id));
 assert(door,`${r.id} has no Great Cat Tree doorway`);
 const root=new T.Group(),ship={root,inside:root,cutaway:new Set()},structure=new T.Group();root.add(structure);buildRoomShell(ship,r,structure);root.updateMatrixWorld(true);
 const col=new Colliders();col.addStatic(root);col.commit();
 const seg=new T.Line3(),clear=(x,z)=>{seg.start.set(x,r.y+.75,z);seg.end.set(x,r.y+1.65,z);return !col.overlaps(seg,.35);};
 const x0=door.center[0];
 for(const z of [-.4,0,.4])for(let x=b.x1-.6;x<=x0+1.5;x+=.1)assert(clear(x,z),`Deck ${b.deck}: wall blocks the bridge doorway at x ${x.toFixed(1)}, z ${z}`);
 assert(!clear(x0,4)&&!clear(x0,-4),`Deck ${b.deck}: the cafe's aft wall is missing beside the doorway`);
 assert(Math.abs(b.x1-x0)<.5,`Deck ${b.deck}: bridge ends ${(x0-b.x1).toFixed(2)} m short of the cafe wall`);
 // nothing of the cafe's fit-out stands in the 2.5 m inside the doorway
 const inside=parts.filter(p=>p.room===r.id&&!p.noCollide&&p.at[0]-p.size[0]/2<x0+2.5&&p.at[0]+p.size[0]/2>x0&&Math.abs(p.at[2])-p.size[2]/2<door.width/2+.3);
 assert.equal(inside.length,0,`Deck ${b.deck}: cafe fit-out blocks the doorway: ${inside.map(p=>p.part).join(', ')}`);
 // and the atrium edge's guard stops at the bridge's sides instead of crossing its end: plan the void guards on this deck with its slab, the cafe and the tree
 const d=layout.decks[b.deck-1],slab=new T.Mesh(polygonGeometry(d.slab.outline,d.slab.holes.map(h=>h.polygon),d.y,.3));slab.name='Deck_floor';root.add(slab);root.add(tree.solid);root.updateMatrixWorld(true);
 const all=new Colliders();all.addStatic(root,o=>o.isMesh);all.commit();
 const rows=planVoidGuards({...layout,decks:[d]},all).filter(row=>{const [,ax,a0,a1,at,,z1]=row,xa=ax===1?at:a0,xb=ax===1?at:a1,za=ax===2?at:ax===1?a0:at,zb=ax===2?z1:ax===1?a1:at;return Math.min(xa,xb)<b.x1+1&&Math.max(xa,xb)>b.x1-1.5&&Math.min(za,zb)<b.width/2-.1&&Math.max(za,zb)>-b.width/2+.1;});
 assert.equal(rows.length,0,`Deck ${b.deck}: an atrium-edge guard crosses the bridge's landing: ${JSON.stringify(rows)}`);
 console.log(`PASS Deck ${b.deck} bridge lands in a ${door.width} m doorway in ${r.id} (wall solid either side, no fit-out or edge guard in the way)`);
}
