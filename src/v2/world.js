import * as T from 'three';
import {buildSteps as originalSteps,prepareExteriorForWalking as originalExterior,outsideOnly,cutOut,RESIDENTIAL} from '../walk/world.js?legacy';
import {Colliders,solid,meshTriangles} from '../walk/collision.js';
import {fitV2Structure} from './model.js';
import {placements,cabinKey,template} from './cabins.js';
export {outsideOnly,cutOut,RESIDENTIAL};
export function* buildSteps(ship,options){yield* originalSteps(ship,options);}
export function buildAll(ship,options){for(const step of buildSteps(ship,options));}
export const cabinPlacements=placements;
export const cabinTemplate=()=>{const out=[];const g=template('twin--1');g.updateMatrixWorld(true);g.traverse(o=>{if(solid(o))meshTriangles(o,out);});return out;};
export function prepareExteriorForWalking(ship){
 // Accepted room dressing/cuts run in its authoring frame before world-space v2 shells.
 // Saved generated guards are restored unchanged, matching Node's after-preparation guard stage.
 const generated=ship.inside.children.filter(o=>o.name==='Walk_railings'||o.name==='Walk_partitions');for(const o of generated)o.removeFromParent();const dropped=originalExterior(ship);clearWingIntrusions(ship);fitV2Structure(ship);for(const o of generated)ship.inside.add(o);return dropped;
}
export function buildColliders(ship,{extra=[],filter=solid,into=new Colliders()}={}){
 const col=into;ship.root.updateMatrixWorld(true);col.addStatic(ship.inside,filter);for(const root of extra)col.addStatic(root,o=>filter(o)&&!outsideOnly(o));col.commit();
 const all=placements();for(const key of new Set(all.map(cabinKey))){const g=template(key),tris=[];g.updateMatrixWorld(true);g.traverse(o=>{if(solid(o))meshTriangles(o,tris);});col.addInstances('v2-cabins-'+key,tris,all.filter(c=>cabinKey(c)===key).map(c=>c.matrix));}
 return col;
}

function clearWingIntrusions(ship){
 const width=(points,x)=>{if(!points.length||x<points[0][0]||x>points.at(-1)[0])return 0;let a=0,b=points.length-1;while(b-a>1){const m=(a+b)>>1;if(points[m][0]<=x)a=m;else b=m;}const p=points[a],q=points[b];return p[1]+(q[1]-p[1])*(x-p[0])/(q[0]-p[0]);};
 const decks=ship.decks.map(d=>({y:d.userData.y+.3,points:d.getObjectByName('Deck_slab').userData.outline}));
 for(let i=0;i<decks.length-1;i++){const d=decks[i],up=decks[i+1];for(let x=-290;x<260;x+=8){const w=Math.min(width(d.points,x),width(d.points,x+8),width(up.points,x),width(up.points,x+8));if(w<1)continue;cutOut(ship.exterior,new T.Box3(new T.Vector3(x,d.y-.01,-w),new T.Vector3(x+8,up.y-.01,w)),o=>/^(Blended_double_delta|Wing_thermal_edge)$/.test(o.name));}}
}
