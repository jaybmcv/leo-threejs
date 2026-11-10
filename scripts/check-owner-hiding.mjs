// The walk's side of the owner bake (src/v2/owner-hiding.js): matching baked parts to the scene, and hiding them only
// where, when and while the bake allows.
import assert from 'node:assert/strict';
import * as T from 'three';
import {createOwnerHiding,ownerBakeFile,ownerKey,ownerCell,ownerPath,ownerPrint,emptyOwnerBake,nearCorner,pruneOwnerBake,ownerBakeProblem,OWNER_BAKE_VERSION} from '../src/v2/owner-hiding.js';
import {PVS_GRID} from '../src/v2/atrium-pvs.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const mesh=(name,x=0,z=-10)=>{const m=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({name:name+'_mat'}));m.name=name;m.position.set(x,0,z);return m;};
function world(){
 const scene=new T.Scene(),band=new T.Group();band.name='Walk_band_7';scene.add(band);
 const wall=mesh('Wall',0,-5),a=mesh('Lamp'),b=mesh('Lamp',3),cabins=mesh('Cabin_fit',6);band.add(wall,a,b,cabins);
 cabins.userData.currentCabinIds=['A','B'];scene.updateMatrixWorld(true);return {scene,band,wall,a,b,cabins};
}
const KEY=ownerKey('walk.ab12.js','desk'),grid={x0:PVS_GRID.x0,z0:PVS_GRID.z0,step:PVS_GRID.step,y0:PVS_GRID.y0};
const camAt=(x,y,z,near=.1)=>{const c=new T.PerspectiveCamera(50,1,near,100);c.position.set(x,y,z);c.updateMatrixWorld(true);return c;};
function bake(w,over={}){
 const parts=[w.a,w.b,w.cabins].map(o=>[ownerPath(o,w.scene),ownerPrint(o)]),conds=[[ownerPath(w.wall,w.scene),ownerPrint(w.wall)],[ownerPath(w.band,w.scene),ownerPrint(w.band)]];
 const [i,k,j]=ownerCell(new T.Vector3(0,1,10));
 return {version:OWNER_BAKE_VERSION,key:KEY,grid,nearMargin:.5,parts,conds,entries:[[0,[0,1]],[1,[0]],[2,[0],['A','B','C']]],blocks:[[i-1,k,j-1,i+1,k,j+1,[0,1,2]]],...over};
}
const make=(w,over)=>{const h=createOwnerHiding(bake(w,over),{key:KEY,scene:w.scene});h.resolve();return h;};
// What `around` hides while drawing.
const during=(h,camera,objs)=>{let seen;h.around(camera,()=>{seen=objs.map(o=>o.visible);});return seen;};
const at=()=>camAt(0,1,10);

assert.equal(ownerBakeFile('walk.9935122f97.js'),'walk-owner-bake.9935122f97.json');assert.equal(ownerBakeFile('main.js'),null);pass('the bake file is named after the walk script');
{const w=world();assert.equal(createOwnerHiding(bake(w),{key:ownerKey('walk.other.js','desk'),scene:w.scene}),null);assert.equal(createOwnerHiding(bake(w),{key:ownerKey('walk.ab12.js','phone'),scene:w.scene}),null);
 assert.equal(createOwnerHiding({...bake(w),grid:{...grid,step:4}},{key:KEY,scene:w.scene}),null);pass('a bake for another build, configuration or grid is not used');}
{const w=world();assert.equal(createOwnerHiding(bake(w,{entries:[[9,[0]]]}),{key:KEY,scene:w.scene}),null);assert.equal(createOwnerHiding(bake(w,{blocks:[[0,0,0,1,1,1,[7]]]}),{key:KEY,scene:w.scene}),null);
 assert.equal(createOwnerHiding(bake(w,{nearMargin:undefined}),{key:KEY,scene:w.scene}),null);pass('a bake that is not whole is not used');}
{const e=emptyOwnerBake('walk.ab12.js','desk'),w=world(),h=createOwnerHiding(e,{key:KEY,scene:w.scene});assert.ok(h);h.resolve();assert.deepEqual(during(h,at(),[w.a]),[true]);pass('the build\'s empty bake is valid and hides nothing');}
{const w=world();assert.equal(ownerPath(w.a,w.scene),'[["Walk_band_7",0],["Lamp",0]]');assert.equal(ownerPath(w.b,w.scene),'[["Walk_band_7",0],["Lamp",1]]');pass('same-named siblings keep apart by their order');
 const odd=new T.Group();odd.name='a/b';w.scene.add(odd);const nest=new T.Group();nest.name='a';const leaf=new T.Group();leaf.name='b';nest.add(leaf);w.scene.add(nest);assert.notEqual(ownerPath(odd,w.scene),ownerPath(leaf,w.scene));pass('names with separators cannot collide');}
{const w=world(),before=ownerPrint(w.wall);w.wall.rotation.y=Math.PI/2;w.wall.updateMatrixWorld(true);assert.notEqual(ownerPrint(w.wall),before);pass('a turned part no longer matches its print');}
{const w=world(),h=make(w);
 assert.deepEqual(during(h,at(),[w.a,w.b,w.cabins,w.wall]),[false,false,false,true]);assert.deepEqual([w.a,w.b,w.cabins].map(o=>o.visible),[true,true,true]);pass('in a baked cell the proven parts hide for the draw and come back after');
 assert.deepEqual(during(h,camAt(40,1,10),[w.a,w.b,w.cabins]),[true,true,true]);pass('outside the baked cells nothing hides');}
for(const [name,undo] of [['not shown',w=>{w.wall.visible=false;}],['on another layer',w=>{w.wall.layers.set(1);}],['with its material switched off',w=>{w.wall.material.visible=false;}],['taken out of the scene',w=>{w.band.remove(w.wall);}]]){
 const w=world(),h=make(w);undo(w);assert.deepEqual(during(h,at(),[w.a,w.b]),[true,true]);pass('a part stays while the wall that hid it is '+name);}
{const w=world(),data=bake(w);w.a.position.x+=.5;w.a.updateMatrixWorld(true);const h=createOwnerHiding(data,{key:KEY,scene:w.scene});h.resolve();
 assert.deepEqual(during(h,at(),[w.a,w.b]),[true,false]);pass('a part that moved since the bake is not used');}
{const w=world(),h=make(w);w.a.position.x+=.5;w.a.updateMatrixWorld(true);assert.deepEqual(during(h,at(),[w.a,w.b]),[true,false]);pass('a part that moves after it was matched is dropped');
 w.wall.position.y+=1;w.wall.updateMatrixWorld(true);assert.deepEqual(during(h,at(),[w.b]),[true]);pass('so is a wall that moves');}
{const w=world(),h=make(w);
 assert.deepEqual(during(h,at(),[w.cabins]),[false]);w.cabins.userData.currentCabinIds=['A','D'];assert.deepEqual(during(h,at(),[w.cabins]),[true]);
 delete w.cabins.userData.currentCabinIds;assert.deepEqual(during(h,at(),[w.cabins]),[true]);pass('a cabin part hides only while every cabin it shows was proven (none listed: it stays)');}
{const w=world(),h=make(w);assert.ok(nearCorner(camAt(0,1,10,.6))>.5);assert.deepEqual(during(h,camAt(0,1,10,.6),[w.a]),[true]);pass('a camera whose near plane reaches past the bake\'s margin hides nothing');}
{const w=world(),h=make(w);w.a.visible=false;during(h,at(),[w.a]);assert.equal(w.a.visible,false);pass('a part the walk had hidden stays hidden');}
{const w=world(),h=createOwnerHiding(bake(w),{key:KEY,scene:w.scene});assert.deepEqual(during(h,at(),[w.a]),[true]);pass('before resolve() nothing hides');}
{const w=world(),h=make(w);let threw=false;try{h.around(at(),()=>{throw Error('draw failed');});}catch{threw=true;}
 assert.ok(threw);assert.deepEqual([w.a,w.b,w.cabins].map(o=>o.visible),[true,true,true]);pass('a failed draw still restores every part');}
{const w=world(),dup=mesh('Lamp');w.band.add(dup);w.scene.updateMatrixWorld(true);const h=make(w);assert.deepEqual(during(h,at(),[w.a]),[false]);pass('a later sibling of the same name does not take an earlier one\'s place');}
{const w=world(),data=bake(w);w.wall.position.y+=1;w.wall.updateMatrixWorld(true);const {data:d,dropped}=pruneOwnerBake(data,w.scene);
 assert.deepEqual(dropped,{parts:0,conds:1,entries:3,blocks:1});assert.equal(d.entries.length,0);assert.equal(ownerBakeProblem(d,KEY),null);pass('pruning drops every entry relying on a wall that moved');}
{const w=world(),data=bake(w);w.b.position.x+=1;w.b.updateMatrixWorld(true);const {data:d,dropped}=pruneOwnerBake(data,w.scene);
 assert.deepEqual(dropped,{parts:1,conds:0,entries:1,blocks:0});assert.equal(d.parts.length,2);assert.equal(ownerBakeProblem(d,KEY),null);
 const h=createOwnerHiding(d,{key:KEY,scene:w.scene});h.resolve();assert.equal(h.stats.resolved,h.stats.parts);assert.deepEqual(during(h,at(),[w.a,w.b,w.cabins]),[false,true,false]);pass('pruned data stays whole, matches fully and still hides the rest');}
{const w=world(),h=make(w);assert.deepEqual(during(h,at(),[w.a]),[false]);
 w.a.position.z=20;// moved in front of everything, and nothing has updated its world matrix (the walk does not while it is hidden)
 assert.deepEqual(during(h,at(),[w.a]),[true]);assert.equal(h.stats.dropped,1);pass('a hidden part that moves is caught before its world matrix is updated for it');}
{const w=world(),h=make(w);assert.deepEqual(during(h,at(),[w.b]),[false]);
 w.band.position.x=.5;// its band moves; no world matrix below it is updated
 assert.deepEqual(during(h,at(),[w.b]),[true]);assert.ok(h.stats.dropped>=1);pass('a hidden part whose parent moves is caught from the parent\'s transform');}
{const w=world();w.b.matrixAutoUpdate=false;const h=make(w);assert.deepEqual(during(h,at(),[w.b]),[false]);
 w.b.matrix.makeTranslation(3,0,30);assert.deepEqual(during(h,at(),[w.b]),[true]);pass('a part placed by a hand-set matrix is caught when that matrix changes');}
{const w=world(),data=bake(w);w.b.position.z=30;// moved while hidden, before the walk matched the bake: its world matrix is stale
 const h=createOwnerHiding(data,{key:KEY,scene:w.scene});h.resolve();assert.equal(h.stats.resolved,2);assert.deepEqual(during(h,at(),[w.b]),[true]);
 pass('a part that moved before resolve() does not match by its stale world matrix');}
{const w=world();w.b.matrixWorldAutoUpdate=false;const h=make(w);assert.deepEqual(during(h,at(),[w.b]),[false]);
 w.b.matrixWorld.makeTranslation(3,0,30);// its world matrix is set by hand; its transform does not change
 assert.deepEqual(during(h,at(),[w.b]),[true]);pass('a part whose world matrix is set by hand is caught when that changes');}
{const w=world();w.b.matrixAutoUpdate=false;const data=bake(w);w.b.matrix.makeTranslation(3,0,30);// its matrix changes and nothing marks it
 const before=w.b.matrixWorld.clone(),h=createOwnerHiding(data,{key:KEY,scene:w.scene});h.resolve();assert.equal(h.stats.resolved,2);
 assert.ok(w.b.matrixWorld.equals(before),'matching wrote no world matrix');pass('a hand-set matrix changed before resolve() does not match, and matching writes nothing');}
{const w=world(),h=make(w),halo=new T.Sprite(new T.SpriteMaterial());halo.scale.set(3,3,1);w.a.add(halo);// a gem's glow, bigger than the gem: nothing proved it hidden
 assert.deepEqual(during(h,at(),[w.a,w.b]),[true,false]);assert.equal(h.stats.dropped,0);pass('a part with something attached stays: hiding it would hide that too');
 w.a.remove(halo);assert.deepEqual(during(h,at(),[w.a]),[false]);pass('and it hides again once nothing is attached (it was held, not dropped)');}
{const w=world();w.a.add(new T.Group());const h=make(w);assert.equal(h.stats.resolved,h.stats.parts);assert.deepEqual(during(h,at(),[w.a,w.b]),[true,false]);pass('so does one that already had a child when the bake was made and matched');}
{const w=world(),h=make(w);w.wall.add(new T.Sprite(new T.SpriteMaterial()));assert.deepEqual(during(h,at(),[w.a,w.b]),[false,false]);pass('a wall with something attached is still a wall: it is only looked at, never hidden');}
console.log(`owner hiding: ${passed} checks passed`);
