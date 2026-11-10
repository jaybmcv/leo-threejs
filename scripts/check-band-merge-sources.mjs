import assert from 'node:assert/strict';
import * as T from 'three';
import {mergePhoneBands} from '../src/v2/phone-bands.js';

// The band merge's copied sources (src/v2/phone-bands.js), without a GPU: a band's children whose every drawable was
// copied move into one hidden group in that band, in the same place in the world; the band itself stays as it was; a
// part hidden by other code, and a group mixing copied and other parts, stay where they are.
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
const material=new T.MeshStandardMaterial({name:'Walk_finish_check'}),other=new T.MeshStandardMaterial({name:'Walk_other_check',color:0xff0000});
const box=(m,x)=>{const o=new T.Mesh(new T.BoxGeometry(1,1,1),m);o.position.set(x,0,0);o.updateMatrix();return o;};
const scene=new T.Scene(),bands=new Map();
const band=n=>{const g=new T.Group();g.name='Walk_band_'+n;g.userData.band=n;g.position.set(0,n*4,0);bands.set(n,g);scene.add(g);return g;};
const b1=band(1),b2=band(2);
const a=box(material,0),c=box(material,10);b1.add(a);b2.add(c);
// A group of parts the merge copies (a deck's guides), a part hidden for now by other code, and a group with both.
const guides=new T.Group();guides.name='Guides';guides.userData.bandMergeParts=true;const g1=box(material,20),g2=box(material,30);guides.add(g1,g2);b1.add(guides);
const later=box(other,40);later.visible=false;b2.add(later);
const mixed=new T.Group();mixed.name='Mixed';mixed.userData.bandMergeParts=true;const m1=box(material,50),m2=box(other,60);m2.visible=false;mixed.add(m1,m2);b2.add(mixed);
scene.updateMatrixWorld(true);
const world=new Map([a,c,g1,g2,later,m1].map(o=>[o,o.getWorldPosition(new T.Vector3())]));
const merged=await mergePhoneBands({bands},scene,{});
assert.equal(merged.root.children.length,1);assert([a,c,g1,g2,m1].every(o=>o.userData.bandMerged&&!o.visible));pass('the merge copies and hides the material\'s parts');
const kept1=b1.children.find(o=>o.userData.mergedSources),kept2=b2.children.find(o=>o.userData.mergedSources);
assert(kept1&&kept2&&!kept1.visible&&!kept2.visible);assert.equal(kept1.name,'Walk_band_1_merged_sources');
assert(a.parent===kept1&&guides.parent===kept1&&c.parent===kept2);pass('copied parts, and a group of only copied parts, move into a hidden group in their band');
assert(later.parent===b2&&mixed.parent===b2);pass('a part hidden by other code, and a group with any such part, stay where they are');
assert(b1.visible&&b2.visible&&b1.children.length===1&&b2.children.length===3);pass('the bands stay visible, each holding what it did');
scene.updateMatrixWorld(true);for(const [o,p] of world)assert(o.getWorldPosition(new T.Vector3()).distanceTo(p)<1e-9,'moved in the world: '+o.position.x);pass('everything keeps its place in the world');
// A desktop's pieces (piece): every triangle lands in exactly one piece, in band order; a piece shows only the bands
// showBands shows, bounded by them, view-culled, and kept out of the fog cull.
{const scene=new T.Scene(),bands=new Map(),mat=new T.MeshStandardMaterial({name:'Walk_square_check'}),parts=[];
 for(const n of [1,2,3]){const g=new T.Group();g.name='Walk_band_'+n;g.userData.band=n;g.position.set(0,n*4,0);bands.set(n,g);scene.add(g);
  for(const x of [-35,-5,5,25,61]){const o=new T.Mesh(new T.BoxGeometry(2,1,2),mat);o.position.set(x+n,0,n*7-14);g.add(o);parts.push([o,n]);}}
 scene.updateMatrixWorld(true);
 const tri=(a,i)=>[0,1,2].map(j=>[a.getX(i[j]),a.getY(i[j]),a.getZ(i[j])].map(v=>v.toFixed(4)).join(',')).join(' ');
 const before=new Map();for(const [o] of parts){const g=o.geometry.clone().applyMatrix4(o.matrixWorld),ix=g.index.array;for(let k=0;k<ix.length;k+=3){const t=tri(g.attributes.position,[ix[k],ix[k+1],ix[k+2]]);before.set(t,(before.get(t)||0)+1);}}
 const merged=await mergePhoneBands({bands},scene,{piece:24}),meshes=merged.root.children;
 assert(meshes.length>=8&&meshes.every(m=>m.geometry.index.count/3<=24));assert.equal(merged.proof.meshes,1);assert.equal(merged.proof.regions,meshes.length);
 assert(meshes.every(m=>m.frustumCulled&&m.userData.fogBackdrop&&m.name==='V2_low_deck_merged_Walk_square_check'));pass('a desktop merge splits into view-culled pieces of at most the given triangles, kept out of the fog cull');
 const after=new Map(),bandOf=new Map();
 for(const m of meshes){const g=m.geometry,ix=g.index.array;for(let k=0;k<ix.length;k+=3){const t=tri(g.attributes.position,[ix[k],ix[k+1],ix[k+2]]);after.set(t,(after.get(t)||0)+1);}}
 assert.deepEqual([...after].sort(),[...before].sort());pass('every triangle is drawn by exactly one piece, in place');
 bands.get(2).visible=false;merged.update();
 for(const m of meshes){const g=m.geometry,ix=g.index.array,box=new T.Box3(),v=new T.Vector3();let shown=0;
  for(const gr of g.groups)for(let k=gr.start;k<gr.start+gr.count;k++){v.fromBufferAttribute(g.attributes.position,ix[k]);box.expandByPoint(v);shown++;
   assert(Math.abs(v.y-8)>1,'a hidden band drawn');}
  if(!shown){assert(!m.visible);continue;}
  assert(m.visible&&g.boundingBox.equals(box),'piece bounds are its shown bands');{const s=g.boundingSphere;assert(s.center.distanceTo(box.min)<=s.radius+1e-9&&s.center.distanceTo(box.max)<=s.radius+1e-9,"piece sphere holds its box");}
  let last=-1;for(const gr of g.groups){assert(gr.start>last);last=gr.start;}}
 pass('a piece draws only the shown bands, in order, and is bounded by them');
 bands.get(2).visible=true;merged.update();assert.equal(meshes.reduce((n,m)=>n+m.geometry.groups.reduce((c,gr)=>c+gr.count,0),0)/3,[...before.values()].reduce((a,b)=>a+b,0));pass('showing the band again draws every triangle');}
console.log(`band merge sources: ${checks} checks passed`);
