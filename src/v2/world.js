import {finishAtriumFloor} from './atrium-floor-finish.js';
import {buildPhase6Water} from './atrium-surfaces.js';
import {applyLoungeFloorFinish} from './lounge-floor-material.js';
import {finishMudwaterShell} from './community-finishes.js';
import {buildPhase4Fitout,addPhase4Colliders} from './phase4-fitout.js';
import {buildBoardingGuards} from './boarding-guards.js';
import {buildLowerLiningReturns} from './lining-returns.js';
import {captureFinishedSkinAuthority,finishedSkinAuthority} from './skin-authority.js';
import {retireLegacySkinGeometry} from './skin-retirement.js';
import {groundFor,installGround,groundMesh,exteriorGround} from './ground.js';
import layout from 'v2-layout';
import {applyPrototypeExterior,fitPrototypeStructure} from './hull-prototypes.js';
import * as T from 'three';
import {buildSteps as originalSteps,prepareExteriorForWalking as originalExterior,outsideOnly,cutOut,RESIDENTIAL} from '../walk/world.js?legacy';
import {Colliders,solid,meshTriangles} from '../walk/collision.js';
import {fitV2Structure} from './model.js';
import {placements,cabinKey,template,cabinDetails,loungeCollisionTemplate} from './cabins.js';
export {outsideOnly,cutOut,RESIDENTIAL};
const progress=message=>{if(typeof process!=='undefined'&&process.versions?.node)console.log('v2 '+message);};
export function* buildSteps(ship,options){yield* originalSteps(ship,options);}
export function buildAll(ship,options){for(const step of buildSteps(ship,options));}
export const cabinPlacements=placements;
export const cabinTemplate=()=>{const out=[];const g=template('twin--1');g.updateMatrixWorld(true);g.traverse(o=>{if(solid(o))meshTriangles(o,out);});return out;};
export function prepareExteriorForWalking(ship){
 const canonicalSkin=captureFinishedSkinAuthority(ship);progress('captured untouched finished web skin: '+canonicalSkin.components.find(c=>c.name==='pressure').geometry.attributes.position.count/3+' pressure triangles');
 // Accepted room dressing/cuts run in its authoring frame before world-space v2 shells.
 // Saved generated guards are restored unchanged, matching Node's after-preparation guard stage.
 const generated=ship.inside.children.filter(o=>o.name==='Walk_railings'||o.name==='Walk_partitions');for(const o of generated)o.removeFromParent();progress('preparing exterior and room finishes');const dropped=originalExterior(ship);progress('legacy room dressing complete');applyPrototypeExterior(ship.exterior,layout);clearWingIntrusions(ship);progress('wing intrusions trimmed');fitV2Structure(ship);progress('structural floors and corridors complete');applyLoungeFloorFinish(ship);finishMudwaterShell(ship);fitPrototypeStructure(ship,layout);progress('owned hull envelopes fitted');buildPhase4Fitout(ship,layout);buildPhase6Water(ship,layout);progress('Phase 4 rooms, escape craft and Phase 6 atrium prototypes furnished');for(const o of generated)ship.inside.add(o);return dropped;
}
export function buildColliders(ship,{extra=[],filter=solid,into=new Colliders()}={}){
 // The legacy room roots remain in authoring coordinates until prepareWalkWorld resolves their frames.
 const skinAuthority=finishedSkinAuthority(ship);ship.v2Retirements=retireLegacySkinGeometry(ship,layout,{authority:skinAuthority});const returns=buildLowerLiningReturns(ship,layout,skinAuthority);ship.v2Retirements.lowerWallReturns={decks:returns.children.map(o=>o.userData.v2Deck),triangles:returns.children.reduce((n,o)=>n+o.geometry.attributes.position.count/3,0),kneeHeight:.8,wallBuildUp:.2,maxReturnDepth:returns.userData.measuredMaxReturnDepth,profileJumpLimit:1};progress('old perimeter geometry retired: '+ship.v2Retirements.rows.length+' meshes, '+ship.v2Retirements.moved.length+' figures moved to existing galleries');
 ship.v2Retirements.atriumFloorFinish=finishAtriumFloor(ship,layout);progress('Deck6 buried slab side portions removed: '+ship.v2Retirements.atriumFloorFinish.removed+' whole faces; '+ship.v2Retirements.atriumFloorFinish.split+' split faces');
 buildBoardingGuards(ship);progress('building static collision bands');const col=into,ground=groundFor(col);ship.root.updateMatrixWorld(true);col.addStatic(ship.inside,o=>o.userData.batchedEnvelope||filter(o));ground.addStatic(ship.inside,o=>(o.userData.batchedEnvelope||filter(o))&&groundMesh(o));for(const root of extra){col.addStatic(root,o=>filter(o)&&!outsideOnly(o));ground.addStatic(root,o=>filter(o)&&!outsideOnly(o)&&exteriorGround(o));}col.commit();ground.commit();progress('static collision bands complete');
 // Variable shells are already deck/material static batches. The furnishing core keeps one shared BVH per base type.
 const all=placements(),baseKey=c=>cabinKey(c).split('|')[0],collect=(g,predicate)=>{const tris=[];g.updateMatrixWorld(true);g.traverse(o=>{if(solid(o)&&predicate(o))meshTriangles(o,tris);});return tris;};for(const key of new Set(all.map(baseKey))){const cs=all.filter(c=>baseKey(c)===key),base=template(key),core=collect(base,o=>!o.userData.shell);if(core.length)col.addInstances('v2-core-'+key,core,cs.map(c=>c.matrix));const groundCore=collect(base,o=>!o.userData.shell&&groundMesh(o));if(groundCore.length)ground.addInstances('v2-core-'+key,groundCore,cs.map(c=>c.matrix));const unchanged=cs.filter(c=>!c.hullPrototype),shell=collect(base,o=>!!o.userData.shell);if(unchanged.length&&shell.length)col.addInstances('v2-shell-'+key,shell,unchanged.map(c=>c.matrix));const floor=collect(base,o=>!!o.userData.shell&&groundMesh(o));if(unchanged.length&&floor.length)ground.addInstances('v2-shell-'+key,floor,unchanged.map(c=>c.matrix));}const classes=new Map();for(const c of all.filter(c=>c.hullPrototype)){const cls=cabinDetails(c).loungeClass,g=loungeCollisionTemplate(c);if(cls===undefined)continue;const key=baseKey(c)+'|'+cls;let batch=classes.get(key);if(!batch)classes.set(key,batch={g,cs:[]});batch.cs.push(c);}for(const [key,{g,cs}]of classes){const tris=collect(g,o=>!!o.userData.windowLounge);if(tris.length){col.addInstances('v2-lounge-'+key,tris,cs.map(c=>c.matrix));const floor=collect(g,o=>!!o.userData.windowLounge&&groundMesh(o));if(floor.length)ground.addInstances('v2-lounge-'+key,floor,cs.map(c=>c.matrix));}}

 addPhase4Colliders(ship,col,ground);progress('shared furnishing collision classes complete');return installGround(col,ground);
}

function clearWingIntrusions(ship){
 const width=(points,x)=>{if(!points.length||x<points[0][0]||x>points.at(-1)[0])return 0;let a=0,b=points.length-1;while(b-a>1){const m=(a+b)>>1;if(points[m][0]<=x)a=m;else b=m;}const p=points[a],q=points[b];return p[1]+(q[1]-p[1])*(x-p[0])/(q[0]-p[0]);};
 const decks=ship.decks.map(d=>({y:d.userData.y+.3,points:d.getObjectByName('Deck_slab').userData.outline}));
 for(let i=0;i<decks.length-1;i++){const d=decks[i],up=decks[i+1];for(let x=-290;x<260;x+=8){const w=Math.min(width(d.points,x),width(d.points,x+8),width(up.points,x),width(up.points,x+8));if(w<1)continue;cutOut(ship.exterior,new T.Box3(new T.Vector3(x,d.y-.01,-w),new T.Vector3(x+8,up.y-.01,w)),o=>/^(Blended_double_delta|Wing_thermal_edge)$/.test(o.name));}}
}
