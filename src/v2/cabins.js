import * as T from 'three';
import layout from 'v2-layout';
import {frame} from '../plan/rooms.js';
import {box,glass,lining,floor,metal} from './geometry.js';
export const placements=()=>layout.cabins.map(c=>{const f=frame(c.id);return {...c,matrix:new T.Matrix4().makeTranslation(...f.origin).multiply(new T.Matrix4().makeRotationY(f.yaw))};});
export const cabinKinds=new Map();
export function cabinKey(c){const dz=c.door.center[2]-c.z,dx=c.door.center[0]-c.x;return c.type+'-'+(Math.sin(c.yaw)*dx+Math.cos(c.yaw)*dz>0?1:-1);}
export function template(key){
 if(cabinKinds.has(key))return cabinKinds.get(key);const sign=key.includes('--')?-1:1,type=key.startsWith('twin')?'twin':'single',g=new T.Group();
 // Front is the corridor wall. The 1.1 m opening is kept clear through every layer.
 box(g,'Cabin_v2_floor',[3.18,.14,7.4],[0,-.07,0],floor);
 box(g,'Cabin_v2_ceiling',[3.18,.10,7.4],[0,3.45,0]);
 for(const s of [-1,1])box(g,'Cabin_v2_side',[.12,3.4,7.4],[s*1.53,1.7,0]);
 for(const s of [-1,1])box(g,'Cabin_v2_front_glass',[1.01,3.3,.1],[s*1.055,1.65,sign*3.65],glass);
 box(g,'Cabin_v2_front_lintel',[1.1,.7,.1],[0,3.05,sign*3.65],glass);
 // Opposite facade: real aperture at the small-window schedule; hull cutting remains Phase 5.
 for(const s of [-1,1])box(g,'Cabin_v2_window_jamb',[.49,3.3,.12],[s*1.345,1.65,-sign*3.65]);
 box(g,'Cabin_v2_window_sill',[2.2,.8,.12],[0,.4,-sign*3.65]);
 box(g,'Cabin_v2_window_head',[2.2,1.2,.12],[0,2.7,-sign*3.65]);
 box(g,'Cabin_v2_window',[2.2,1.3,.035],[0,1.45,-sign*3.65],glass);
 for(const s of type==='twin'?[-1,1]:[-1]){
  box(g,'Cabin_v2_bed_base',[.78,.4,2.1],[s*.99,.2,.25],metal);
  box(g,'Cabin_v2_mattress',[.78,.18,2.1],[s*.99,.49,.25],lining);
  box(g,'Cabin_v2_pillow',[.6,.12,.35],[s*.99,.64,1.05],lining);
 }
 box(g,'Cabin_v2_desk',[1.2,.10,.55],[0,.78,-sign*2.9],floor);
 for(const s of [-1,1])box(g,'Cabin_v2_desk_leg',[.08,.73,.5],[s*.52,.365,-sign*2.9],metal);
 cabinKinds.set(key,g);return g;
}
export function buildCabins(deck){
 const root=new T.Group();root.name='V2_cabin_instances';const walls=new T.Group();walls.name='V2_cabin_shells';root.add(walls);
 const list=placements().filter(c=>c.deck===deck),keys=[...new Set(list.map(cabinKey))];
 for(const key of keys){const cs=list.filter(c=>cabinKey(c)===key),fit=new T.Group(),shells=new T.Group();fit.name='V2_fit_'+key;shells.name='V2_cabin_shells';root.add(fit);walls.add(shells);for(const p of template(key).children){
  const o=new T.InstancedMesh(p.geometry,p.material,cs.length);o.name=p.name;const shell=/floor|ceiling|side|front|window/.test(p.name);(shell?shells:fit).add(o);
  cs.forEach((c,i)=>o.setMatrixAt(i,c.matrix.clone().multiply(p.matrixAutoUpdate?(p.updateMatrix(),p.matrix):p.matrix)));o.userData.cabinIds=cs.map(c=>c.id);o.userData.v2Cabins=true;o.computeBoundingSphere();
 }}
 return {root,walls,district:root,districtWalls:walls,number:deck-5};
}
export function berthSpots(){const out=[];for(const c of placements())for(const s of c.type==='twin'?[-1,1]:[-1]){const point=new T.Vector3(s*.99,.58,.25).applyMatrix4(c.matrix),head=new T.Vector3(0,0,1).transformDirection(c.matrix);out.push({id:c.id+'-bed-'+s,room:c.id,kind:'lie',point,height:point.y,head,length:2.1,instanced:true});}return out;}
