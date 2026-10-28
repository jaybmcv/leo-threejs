import assert from 'node:assert/strict';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {createShipArea,SHIP_AREAS} from '../src/areas.js';
import {createGardenCommons,createResidentialDeck,SAMPLE} from '../src/model.js';
import {deferRoomFrames,resolveRoomFrames,setFrameOverride,clearFrameOverrides,deltaMatrix,anchoredPoint} from '../src/plan/rooms.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {openArrivalAtrium} from '../src/walk/arrival-atrium.js';
import {dressHydroponics} from '../src/walk/hydroponics.js';
import {createMissionHolo} from '../src/walk/mission-holo.js';
import {createSwordCase} from '../src/walk/sword-case.js';
import {createConcession} from '../src/walk/concession.js';
import {createTheatre,placeAttendant} from '../src/walk/theatre.js';
import {prepareBlossomBed,createBlossomGarden} from '../src/walk/blossom.js';
import {prepareLoungeFalls,createLoungeFalls} from '../src/walk/lounge-falls.js';
import {createArcade} from '../src/walk/arcade.js';
import {createJaguarGate} from '../src/walk/jaguar-gate.js';
import {findRestSpots} from '../src/walk/rest.js';
import {CABINS} from '../src/plan/v1.js';
import {solid,meshTriangles} from '../src/walk/collision.js';
installWalkCanvas(createCanvas);
const cases=[['arrival-assembly',['d02-arrival-1','d03-farm-1']],['d16-theater-5',['d16-theater-5']],['commons-1',[]],['d20-mission-2',['d20-mission-2']],['d20-captain-7',['d20-captain-7']],['d20-recovery-aft',['d20-recovery-aft']]];
function build(id,ids){deferRoomFrames();const root=new T.Group(),inside=new T.Group();root.add(inside);const ship={root,inside};
 for(const room of ids)inside.add(createShipArea(SHIP_AREAS.find(a=>a.id===room)).root);
 if(id==='arrival-assembly'){openArrivalAtrium(ship);dressHydroponics(ship);}
 if(id==='commons-1'){inside.add(createGardenCommons(1).root);prepareBlossomBed(ship);prepareLoungeFalls(ship);}
 if(id==='d16-theater-5')placeAttendant(ship);
 resolveRoomFrames(root);const extra=[],put=o=>{if(!o)return;if(o.isObject3D){extra.push(o);return;}for(const k of ['group','solid'])if(o[k]&&!o[k].parent)extra.push(o[k]);};
 if(id==='d20-mission-2')put(createMissionHolo(ship));
 if(id==='d20-captain-7')put(createSwordCase(ship));
 if(id==='d16-theater-5'){put(createConcession(ship));put(createTheatre(ship,{url:''}));}
 if(id==='commons-1'){put(createBlossomGarden(ship));put(createLoungeFalls(ship));put(createArcade());put(createJaguarGate());}
 if(extra.length)root.add(...extra);root.updateMatrixWorld(true);const untouched=createShipArea(SHIP_AREAS.find(a=>a.id==='d16-library-2')).root;return {root,inside,untouched};
}
function snapshot(root){root.updateMatrixWorld(true);const meshes=[],colliders=[];root.traverse(o=>{if(!o.isMesh)return;const positions=[],v=new T.Vector3(),p=o.geometry.attributes.position;
 if(o.isInstancedMesh){const m=new T.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);const basis=o.matrixWorld.clone().multiply(m);for(let j=0;j<p.count;j++)positions.push(...v.fromBufferAttribute(p,j).applyMatrix4(basis).toArray());}}
 else for(let j=0;j<p.count;j++)positions.push(...v.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld).toArray());
 meshes.push({name:o.name,positions});if(solid(o))meshTriangles(o,colliders);
 });return {meshes,colliders};}
const close=(a,b,label)=>{assert.equal(a.length,b.length,label+' count');for(let i=0;i<a.length;i++)assert(Math.abs(a[i]-b[i])<.00011,label+' '+i+': '+a[i]+' != '+b[i]);};
function moved(a,m){const out=[],v=new T.Vector3();for(let i=0;i<a.length;i+=3)out.push(...v.fromArray(a,i).applyMatrix4(m).toArray());return out;}
for(const [id,ids] of cases){clearFrameOverrides();const baseline=build(id,ids),before=snapshot(baseline.root),rest=findRestSpots(baseline.inside),unchanged=snapshot(baseline.untouched);
 for(const change of [{dx:7,dz:-3},{yawDeg:37},{mirror:true}]){setFrameOverride(id,change);const after=build(id,ids),snap=snapshot(after.root),m=deltaMatrix(id);assert.equal(snap.meshes.length,before.meshes.length,id+' meshes');
  for(let i=0;i<snap.meshes.length;i++){assert.equal(snap.meshes[i].name,before.meshes[i].name);close(snap.meshes[i].positions,moved(before.meshes[i].positions,m),id+'/'+snap.meshes[i].name);}
  close(snap.colliders,moved(before.colliders,m),id+' collider triangles');
  const spots=findRestSpots(after.inside);assert.equal(spots.length,rest.length,id+' rest spots');for(let i=0;i<spots.length;i++){close(spots[i].point.toArray(),rest[i].point.clone().applyMatrix4(m).toArray(),id+' rest '+i);for(const key of ['facing','head'])if(rest[i][key])close(spots[i][key].toArray(),rest[i][key].clone().transformDirection(m).toArray(),id+' rest '+key+' '+i);}
  assert.deepEqual(snapshot(after.untouched),unchanged,id+' moved unrelated library');clearFrameOverrides();
 }
 console.log(id+': independent translation, rotation and mirror carry every mesh, instance, collider and rest point.');
}
clearFrameOverrides();

// Cabin instances keep their individual CABINS id, including on the translated deck copies.
const cabin='N03-067',sampleId=SAMPLE.id.replace('N10','N03'),list=CABINS.filter(c=>c.neighborhood===3&&c.id!==sampleId),index=list.findIndex(c=>c.id===cabin);
function cabinMatrices(){deferRoomFrames();const {root}=createResidentialDeck(3);resolveRoomFrames(root);const out=[];root.traverse(o=>{if(o.isInstancedMesh&&o.count===499){o.updateWorldMatrix(true,false);const m=new T.Matrix4();out.push(Array.from({length:o.count},(_,i)=>{o.getMatrixAt(i,m);return o.matrixWorld.clone().multiply(m);}));}});return out;}
clearFrameOverrides();const cabinBase=cabinMatrices();for(const change of [{dx:7,dz:-3},{yawDeg:37},{mirror:true}]){setFrameOverride(cabin,change);const after=cabinMatrices(),delta=deltaMatrix(cabin);for(let n=0;n<after.length;n++)for(let i=0;i<after[n].length;i++)close(after[n][i].elements,(i===index?delta.clone().multiply(cabinBase[n][i]):cabinBase[n][i]).elements,'cabin '+n+':'+i);clearFrameOverrides();}
console.log(cabin+': only its instances move; all other cabin instances stay put.');

// Automatic door colliders keep their orientation as well as their centre.
const {createLounge}=await import('../src/walk/lounge.js'),{Colliders}=await import('../src/walk/collision.js');
function doors(){deferRoomFrames();const root=new T.Group(),inside=new T.Group();root.add(inside);inside.add(createGardenCommons(1).root);resolveRoomFrames(root);const col=new Colliders();createLounge({root,inside},col);return col.movers.map(m=>m.matrix.clone());}
clearFrameOverrides();const doorBase=doors();for(const change of [{dx:7,dz:-3},{yawDeg:37},{mirror:true}]){setFrameOverride('commons-1',change);const current=doors(),delta=deltaMatrix('commons-1');assert.equal(current.length,doorBase.length);for(let i=0;i<current.length;i++)close(current[i].elements,delta.clone().multiply(doorBase[i]).elements,'lounge door '+i);clearFrameOverrides();}
console.log('commons-1: automatic door collider orientation and position follow independently.');
