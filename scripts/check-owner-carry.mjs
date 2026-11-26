// Carrying a full owner bake to a later walk build (scripts/walk-owner-carry.mjs, walk-owner-carry-rows.mjs): a page-only
// rebuild keeps it; a scene change drops what relied on the changed part or wall, including changes a print does not see,
// and one every proof relies on empties it. Scenes are built here as a walk would build them twice (fresh objects).
import assert from 'node:assert/strict';
import * as T from 'three';
import {createOwnerHiding,ownerBakeProblem,ownerCell,ownerKey,ownerPath,ownerPrint,OWNER_BAKE_VERSION} from '../src/v2/owner-hiding.js';
import {PVS_GRID} from '../src/v2/atrium-pvs.js';
import {tableDigests} from './walk-owner-bake.scene.js';
import {carryProblem,carryRows,keyConfig,keyScript} from './walk-owner-carry-rows.mjs';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const CONFIG='merge200000',BAKED=ownerKey('walk.aaaa000001.js',CONFIG),LATER=ownerKey('walk.bbbb000002.js',CONFIG),CODE='page-bundle-sha';
const grid={x0:PVS_GRID.x0,z0:PVS_GRID.z0,step:PVS_GRID.step,y0:PVS_GRID.y0};
const box=(name,x,z)=>{const m=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({name:name+'_mat'}));m.name=name;m.position.set(x,1,z);return m;};

// The walk's scene, built afresh each call: a wall (10 x 4 m, 2 x 1 segments: a vertex in its middle) at z -5 with a lamp
// behind it, and a band whose two merge sources (drawn by a merged piece under the merges' root) stand in front of a
// second lamp. `change` edits it before matrices settle, as a page change would.
function ship(change=()=>{}){
 const scene=new T.Scene(),room=new T.Group();room.name='Room_A';scene.add(room);
 const wall=new T.Mesh(new T.PlaneGeometry(10,4,2,1),new T.MeshStandardMaterial({name:'wall'}));wall.name='Atrium_wall';wall.position.set(0,2,-5);room.add(wall);
 const lamp=box('Lamp',0,-10);room.add(lamp);
 const band=new T.Group();band.name='Walk_band_3';scene.add(band);
 const kept=new T.Group();kept.name='Walk_band_3_merged_sources';kept.visible=false;kept.userData={mergedSources:true};band.add(kept);
 const quad=(x,name)=>{const m=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshStandardMaterial({name:'deck'}));m.name=name;m.position.set(x,2,-5);return m;};
 const s1=quad(18,'Deck_wall_a'),s2=quad(22,'Deck_wall_b');kept.add(s1,s2);
 const root=new T.Group();root.name='V2_phone_band_merges';scene.add(root);
 const piece=new T.Mesh(new T.PlaneGeometry(8,4),[new T.MeshStandardMaterial({name:'merged'})]);piece.name='V2_deck_merged_wall';piece.userData={sources:[s1.uuid,s2.uuid]};piece.position.set(20,2,-5);root.add(piece);
 const lamp2=box('Lamp',20,-10);band.add(lamp2);
 const w={scene,room,wall,lamp,band,kept,s1,s2,root,piece,lamp2};change(w);scene.updateMatrixWorld(true);return w;
}
const rowOf=(o,scene)=>[ownerPath(o,scene),ownerPrint(o)];
// A full bake of ship(): the lamp behind the wall, the second lamp behind the band (which needs the merges' root drawn),
// in one block round the camera cell, with its row digests as walk-owner-bake.mjs keeps them.
function fullBake(w,{cafe=false}={}){
 const [i,k,j]=ownerCell(new T.Vector3(0,1,10));
 const data={version:OWNER_BAKE_VERSION,key:BAKED,made:'2026-11-26T11:09:40.691Z',grid,nearMargin:.5,
  parts:[rowOf(w.lamp,w.scene),rowOf(w.lamp2,w.scene)],conds:[rowOf(w.wall,w.scene),rowOf(w.band,w.scene),rowOf(w.root,w.scene)],
  entries:[[0,[0]],[1,[1,2]]],blocks:[[i-1,k,j-1,i+1,k,j+1,[0,1]]]};
 const main=tableDigests(w.scene,data);
 return {...data,carry:{code:CODE,seed:{at:[0,0,0],yaw:0},cafeSeed:cafe?{at:[1,0,0],yaw:0}:null,main,cafe:cafe?main:null}};
}
const camAt=()=>{const c=new T.PerspectiveCamera(50,1,.1,100);c.position.set(0,1,10);c.updateMatrixWorld(true);return c;};
const hiddenBy=(data,w)=>{const h=createOwnerHiding(data,{key:LATER,scene:w.scene});assert.ok(h,'the walk uses it: '+ownerBakeProblem(data,LATER));h.resolve();
 assert.equal(h.stats.resolved,h.stats.parts,'every carried part matches');assert.equal(h.stats.condsResolved,h.stats.conds,'every carried wall matches');
 let seen;h.around(camAt(),()=>{seen=[w.lamp,w.lamp2].map(o=>o.visible);});return seen;};
const carry=(stored,w)=>{assert.equal(carryProblem(stored,{code:CODE,key:LATER}),null);return carryRows(stored,{key:LATER,main:tableDigests(w.scene,stored),cafe:stored.carry.cafe?tableDigests(w.scene,stored):null});};

assert.equal(keyScript(BAKED),'walk.aaaa000001.js');assert.equal(keyConfig(BAKED),CONFIG);assert.equal(keyConfig(ownerKey('walk.ab.js','batch1')),'batch1');assert.equal(keyConfig('main.js'),null);
pass('a key\'s walk script and build configuration read back as ownerKey wrote them');

{const stored=fullBake(ship()),later=ship(w=>{const sign=box('Selfie_booth_sign',60,30);w.scene.add(sign);w.lamp.userData.note='page-only';});
 const {data,dropped}=carry(stored,later);assert.deepEqual(dropped,{parts:0,conds:0,entries:0,blocks:0});
 assert.equal(data.key,LATER);assert.equal(data.carry,undefined,'the row digests stay in the store');assert.deepEqual(data.carried,{from:BAKED,made:stored.made});
 assert.deepEqual(hiddenBy(data,later),[false,false]);pass('a page-only rebuild (fresh objects, a new prop elsewhere) keeps every proof, keyed to the new script');}

// Changes a print does not see: the old key (the walk script's hash) was what caught them.
{const stored=fullBake(ship()),later=ship(w=>{const p=w.wall.geometry.attributes.position;for(let n=0;n<p.count;n++)if(p.getX(n)===0)p.setX(n,1.5);});
 assert.equal(ownerPrint(later.wall),stored.conds[0][1],'same count, box and transform: the print is unchanged');
 const {data,dropped,changed}=carry(stored,later);assert.deepEqual(dropped,{parts:0,conds:1,entries:1,blocks:0});assert.deepEqual(data.parts,[stored.parts[1]]);assert.deepEqual(changed,{parts:[],conds:[0]});
 assert.deepEqual(hiddenBy(data,later),[true,false]);pass('a wall whose inner vertex moved inside its box drops what it proved, and only that');}
{const stored=fullBake(ship()),later=ship(w=>{w.wall.material.alphaTest=.5;});
 assert.equal(ownerPrint(later.wall),stored.conds[0][1],'alphaTest is not in the print');
 const {data,dropped}=carry(stored,later);assert.equal(dropped.entries,1);assert.deepEqual(hiddenBy(data,later),[true,false]);pass('a wall that became a cut-out is no wall any more');}
{const stored=fullBake(ship()),later=ship(w=>{w.s1.position.y+=.5;});
 assert.equal(ownerPrint(later.band),stored.conds[1][1],'a band\'s print is its children\'s names');
 const {data,dropped}=carry(stored,later);assert.deepEqual(dropped,{parts:0,conds:1,entries:1,blocks:0});assert.deepEqual(hiddenBy(data,later),[false,true]);pass('a band whose merge source moved drops what it proved');}
{const stored=fullBake(ship()),later=ship(w=>{w.piece.userData.sources=[w.s2.uuid,w.s1.uuid];});
 const {dropped}=carry(stored,later);assert.ok(dropped.entries>=1);pass('so does a merged piece that draws its sources otherwise');}
{const stored=fullBake(ship()),later=ship(w=>{const p=w.piece.geometry.attributes.position;p.setY(0,p.getY(0)-.5);});// what is drawn, not what the bake read
 assert.equal(ownerPrint(later.piece),ownerPrint(ship().piece),'a merged piece\'s print has no bounds');
 const {data,dropped}=carry(stored,later);assert.deepEqual(dropped,{parts:0,conds:1,entries:1,blocks:0});assert.deepEqual(hiddenBy(data,later),[false,true]);
 pass('and a merged piece whose geometry changed drops what the bands it draws proved, though its sources did not change');}
{const stored=fullBake(ship()),later=ship();later.piece.position.x+=1;// the walk leaves a hidden branch's world matrices stale
 assert.equal(ownerPrint(later.piece),ownerPrint(ship().piece),'its world matrix still says where it was');
 const {dropped}=carry(stored,later);assert.deepEqual(dropped,{parts:0,conds:1,entries:1,blocks:0});pass('a merged piece is read where it will be drawn, not where a stale world matrix puts it');}
{const stored=fullBake(ship()),later=ship(w=>{const g=w.lamp2.geometry;g.translate(0,0,.4);g.computeBoundingBox();});
 const {dropped}=carry(stored,later);assert.deepEqual(dropped,{parts:1,conds:0,entries:1,blocks:0});pass('a part whose boxes changed is not carried');}
{const stored=fullBake(ship()),later=ship(w=>{w.lamp.castShadow=true;});const {dropped}=carry(stored,later);assert.equal(dropped.parts,1);pass('nor one the bake would no longer hide (a shadow caster)');}
{const stored=fullBake(ship()),later=ship(w=>{w.scene.position.x=3;});
 // The merges' root keeps its row (its print is its pieces' names; they count for the bands they draw), nothing relies on it alone.
 const {data,dropped}=carry(stored,later);assert.deepEqual(dropped,{parts:2,conds:2,entries:2,blocks:1});assert.equal(data.blocks.length,0);assert.equal(data.entries.length,0);
 assert.equal(ownerBakeProblem(data,LATER),null,'what is left is still a whole bake: an empty one');pass('a scene change every proof relies on empties it');}

{const stored=fullBake(ship(),{cafe:true}),later=ship();stored.carry.cafe.conds[0]='Atrium_wall#seen otherwise from the café';
 const {dropped}=carry(stored,later);assert.deepEqual(dropped,{parts:0,conds:1,entries:1,blocks:0});pass('a row must match where the café was proven from too');}
{const stored=fullBake(ship());stored.carry.main.parts[0]=null;
 const {dropped}=carryRows(stored,{key:LATER,main:{...tableDigests(ship().scene,stored),parts:[null,tableDigests(ship().scene,stored).parts[1]]}});
 assert.equal(dropped.parts,1);pass('a row with no digest where it was baked never matches, not even another missing one');}

{const stored=fullBake(ship());
 assert.match(carryProblem(stored,{code:'other',key:LATER}),/bake page changed/);
 assert.match(carryProblem(stored,{code:CODE,key:ownerKey('walk.bbbb000002.js','batch200000')}),/another build configuration/);
 assert.match(carryProblem({...stored,carry:undefined},{code:CODE,key:LATER}),/no row digests/);
 assert.match(carryProblem({...stored,blocks:[]},{code:CODE,key:LATER}),/proves nothing/);
 assert.match(carryProblem({...stored,version:1},{code:CODE,key:LATER}),/format/);
 assert.match(carryProblem({...stored,carry:{...stored.carry,main:{parts:[],conds:[]}}},{code:CODE,key:LATER}),/do not fit/);
 assert.throws(()=>carryRows(stored,{key:LATER,main:{parts:[],conds:[]}}),/do not fit/);
 pass('another bake page (proof rules, scene reading, hiding), configuration or format, or no digests: nothing is carried');}
console.log(`owner carry: ${passed} checks passed`);
