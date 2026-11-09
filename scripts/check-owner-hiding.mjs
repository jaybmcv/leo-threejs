// The walk's side of the owner bake (src/v2/owner-hiding.js): matching baked parts to the scene, and hiding them only
// where, when and while the bake allows.
import assert from 'node:assert/strict';
import * as T from 'three';
import {createOwnerHiding,ownerBakeFile,ownerKey,ownerCell,ownerPath,ownerPrint,OWNER_BAKE_VERSION} from '../src/v2/owner-hiding.js';
import {PVS_GRID} from '../src/v2/atrium-pvs.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const mesh=(name,x=0,z=-10)=>{const m=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({name:name+'_mat'}));m.name=name;m.position.set(x,0,z);return m;};
function world(){
 const scene=new T.Scene(),band=new T.Group();band.name='Walk_band_7';scene.add(band);
 const wall=mesh('Wall',0,-5),a=mesh('Lamp'),b=mesh('Lamp',3),cabins=mesh('Cabin_fit',6);band.add(wall,a,b,cabins);
 cabins.userData.currentCabinIds=['A','B'];scene.updateMatrixWorld(true);return {scene,band,wall,a,b,cabins};
}
const grid={x0:PVS_GRID.x0,z0:PVS_GRID.z0,step:PVS_GRID.step,y0:PVS_GRID.y0};
const camAt=(x,y,z)=>{const c=new T.PerspectiveCamera();c.position.set(x,y,z);c.updateMatrixWorld(true);return c;};
function bake(w,{key='1.walk.ab12.js',entries,blocks}={}){
 const parts=[w.a,w.b,w.cabins].map(o=>[ownerPath(o,w.scene),ownerPrint(o)]),conds=[[ownerPath(w.wall,w.scene),ownerPrint(w.wall)],[ownerPath(w.band,w.scene),ownerPrint(w.band)]];
 const [i,k,j]=ownerCell(new T.Vector3(0,1,10));
 return {version:OWNER_BAKE_VERSION,key,grid,parts,conds,entries:entries??[[0,[0,1]],[1,[0]],[2,[0],['A','B','C']]],blocks:blocks??[[i-1,k,j-1,i+1,k,j+1,[0,1,2]]]};
}
// What `around` hides while drawing.
const during=(h,camera,objs)=>{let seen;h.around(camera,()=>{seen=objs.map(o=>o.visible);});return seen;};

assert.equal(ownerBakeFile('walk.9935122f97.js'),'walk-owner-bake.9935122f97.json');assert.equal(ownerBakeFile('main.js'),null);pass('the bake file is named after the walk script');
{const w=world();assert.equal(createOwnerHiding(bake(w),{key:ownerKey('walk.other.js'),scene:w.scene}),null);
 assert.equal(createOwnerHiding({...bake(w),grid:{...grid,step:4}},{key:'1.walk.ab12.js',scene:w.scene}),null);pass('a bake for another build or grid is not used');}
{const w=world();assert.equal(ownerPath(w.a,w.scene),'Walk_band_7#0/Lamp#0');assert.equal(ownerPath(w.b,w.scene),'Walk_band_7#0/Lamp#1');pass('same-named siblings keep apart by their order');}
{const w=world(),h=createOwnerHiding(bake(w),{key:'1.walk.ab12.js',scene:w.scene});h.resolve();
 assert.deepEqual(during(h,camAt(0,1,10),[w.a,w.b,w.cabins,w.wall]),[false,false,false,true]);
 assert.deepEqual([w.a,w.b,w.cabins].map(o=>o.visible),[true,true,true]);pass('in a baked cell the proven parts hide for the draw and come back after');
 assert.deepEqual(during(h,camAt(40,1,10),[w.a,w.b,w.cabins]),[true,true,true]);pass('outside the baked cells nothing hides');}
{const w=world(),h=createOwnerHiding(bake(w),{key:'1.walk.ab12.js',scene:w.scene});h.resolve();w.wall.visible=false;
 assert.deepEqual(during(h,camAt(0,1,10),[w.a,w.b]),[true,true]);pass('a part stays while the wall that hid it is not drawn');
 w.wall.visible=true;assert.deepEqual(during(h,camAt(0,1,10),[w.a]),[false]);pass('and hides again once it is');}
{const w=world(),data=bake(w);w.a.position.x+=.5;w.a.updateMatrixWorld(true);const h=createOwnerHiding(data,{key:'1.walk.ab12.js',scene:w.scene});h.resolve();
 assert.deepEqual(during(h,camAt(0,1,10),[w.a,w.b]),[true,false]);pass('a part that moved since the bake is not used');}
{const w=world(),h=createOwnerHiding(bake(w),{key:'1.walk.ab12.js',scene:w.scene});h.resolve();
 assert.deepEqual(during(h,camAt(0,1,10),[w.cabins]),[false]);w.cabins.userData.currentCabinIds=['A','D'];assert.deepEqual(during(h,camAt(0,1,10),[w.cabins]),[true]);pass('a cabin part hides only while every cabin it shows was proven');}
{const w=world(),h=createOwnerHiding(bake(w),{key:'1.walk.ab12.js',scene:w.scene});h.resolve();w.a.visible=false;during(h,camAt(0,1,10),[w.a]);assert.equal(w.a.visible,false);pass('a part the walk had hidden stays hidden');}
{const w=world(),h=createOwnerHiding(bake(w),{key:'1.walk.ab12.js',scene:w.scene});assert.deepEqual(during(h,camAt(0,1,10),[w.a]),[true]);pass('before resolve() nothing hides');}
{const w=world(),h=createOwnerHiding(bake(w),{key:'1.walk.ab12.js',scene:w.scene});h.resolve();let threw=false;try{h.around(camAt(0,1,10),()=>{throw Error('draw failed');});}catch{threw=true;}
 assert.ok(threw);assert.deepEqual([w.a,w.b,w.cabins].map(o=>o.visible),[true,true,true]);pass('a failed draw still restores every part');}
console.log(`owner hiding: ${passed} checks passed`);
