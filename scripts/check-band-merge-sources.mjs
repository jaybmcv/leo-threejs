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
console.log(`band merge sources: ${checks} checks passed`);
