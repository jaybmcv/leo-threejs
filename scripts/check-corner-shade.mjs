// Corner shading (src/walk/corner-shade.js): which collider faces become wall lines, and the distance grid they make.
//   LEO_LAYOUT=2 node scripts/check-corner-shade.mjs
import assert from 'node:assert/strict';
import * as T from 'three';
import {CORNER_DECKS as D,cornerGrid,installCornerShade,rasterWalls,wallLines} from '../src/walk/corner-shade.js';

const DECK=5,y=D.Y0+DECK*D.GAP;
// A 4 m wall on deck 5 along z=0, 3 m tall; a 1 m upstand on a 1 m platform (foot off the floor); a floor slab.
const parts=[new T.PlaneGeometry(4,3).translate(2,y+1.5,0),new T.PlaneGeometry(2,1).translate(-10,y+1.5,0),
 new T.PlaneGeometry(4,4).rotateX(-Math.PI/2).translate(2,y,2)].map(g=>g.toNonIndexed());
const band=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(parts.flatMap(g=>[...g.attributes.position.array]),3));
// A 0.4 m pedestal, 0.7 m tall, placed by matrix twice: on deck 5, and 0.5 m above it (no line).
const pedestal=new T.BoxGeometry(.4,.7,.4).translate(0,.35,0),move=(x,yy,z)=>new T.Matrix4().makeTranslation(x,yy,z);
const colliders={bands:new Map([['test',{geometry:band}]]),groups:[{bvh:{geometry:pedestal},items:[{matrix:move(10,y,10)},{matrix:move(20,y+.5,10)}]}]};

const found=await wallLines(colliders),segs=found.segs,lines=[];
for(let i=0;i<segs.length;i+=5)lines.push([...segs.slice(i,i+5)]);
assert.equal(lines.length,2+8,'the wall (2 triangles) and the grounded pedestal (4 sides x 2), nothing else');
assert.ok(lines.every(l=>l[0]===DECK),'every line is on deck 5');
assert.ok(lines.slice(0,2).every(l=>Math.abs(l[2])<1e-6&&Math.abs(l[4])<1e-6),'the wall lies along z=0');
assert.ok(lines.slice(2).every(l=>[l[1],l[3]].every(x=>Math.abs(x-10)<=.2+1e-6)),'the pedestal lines are round x=10');

const G=cornerGrid(found),field=rasterWalls({segs,...G});
assert.ok(G.NX*G.RES<40&&G.NZ*G.RES<20,'the grid spans only the wall lines');
// Outside the grid the shader reads its edge (clamped), which is always clear: 255.
const raw=(x,z,d=DECK)=>{const ix=Math.floor((x-G.X0)/G.RES),iz=Math.floor((z-G.Z0)/G.RES);return ix<0||iz<0||ix>=G.NX||iz>=G.NZ?255:field[d*G.NX*G.NZ+iz*G.NX+ix];},dist=(x,z,d)=>raw(x,z,d)/254*G.R;
assert.ok(dist(2,.1)<G.RES,'next to the wall the distance is within a cell');
assert.ok(dist(2,.6)>dist(2,.1),'it grows away from the wall');
assert.equal(raw(2,5),255,'5 m away nothing darkens');
assert.equal(raw(-10,.1),255,'the raised upstand makes no line');
assert.equal(raw(20,10),255,'nor the pedestal standing off the floor');
assert.ok(dist(10,10)<.3,'the grounded pedestal darkens round its foot');
{const b=DECK*G.NX*G.NZ;for(let i=0;i<G.NX;i++)assert.ok(field[b+i]===255&&field[b+(G.NZ-1)*G.NX+i]===255,'the grid edge is clear');
 for(let i=0;i<G.NZ;i++)assert.ok(field[b+i*G.NX]===255&&field[b+i*G.NX+G.NX-1]===255,'the grid edge is clear');}
for(const d of [DECK-1,DECK+1])assert.ok(field.subarray(d*G.NX*G.NZ,(d+1)*G.NX*G.NZ).every(v=>v===255),`deck ${d} is untouched`);
// Materials: a lit opaque interior one is patched; one an exterior mesh shares, a transparent one and an unlit one are not.
const box=new T.BoxGeometry(),[shared,own,clear,flat]=[new T.MeshStandardMaterial(),new T.MeshStandardMaterial(),new T.MeshStandardMaterial({transparent:true}),new T.MeshBasicMaterial()];
const scene=new T.Scene(),hull=new T.Group();hull.name='V2_hull';hull.add(new T.Mesh(box,shared));
scene.add(hull,new T.Mesh(box,shared),new T.Mesh(box,own),new T.Mesh(box,clear),new T.Mesh(box,flat));
const shade=installCornerShade(scene);
assert.equal(shade.stats.materials,1,'only the interior-only lit opaque material is patched');
assert.ok(own.customProgramCacheKey().endsWith('|corner')&&!shared.customProgramCacheKey().endsWith('|corner'),'the shared one keeps its program');
console.log(`PASS corner shading: ${lines.length} wall lines, wall foot ${dist(2,.1).toFixed(2)} m, grid ${G.NX}x${G.NZ}x${G.DECKS}`);
