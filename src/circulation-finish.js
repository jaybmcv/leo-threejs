import * as T from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from './assets/helvetiker-bold.json' with {type:'json'};
import {detailKit,FINISH_M as M} from './area-finish.js';
import {polishInterior} from './interior-polish.js';
const font=new FontLoader().parse(fontData);
export function fixtureText(k,o,label,sign=1){
 const {c,s}=k.bounds(o),axis=s.x<s.z?'x':'z',w=axis==='x'?s.z:s.x;
 const size=Math.min(.17,s.y*.28,w/(label.length*.85));
 const geo=new TextGeometry(label,{font,size,depth:.001,curveSegments:1});geo.computeBoundingBox();geo.translate(-(geo.boundingBox.max.x+geo.boundingBox.min.x)/2,-size*.42,0);
 if(axis==='x')geo.rotateY(sign*Math.PI/2);else if(sign<0)geo.rotateY(Math.PI);
 const p=c.clone();p[axis]+=sign*(s[axis]/2+.012);geo.translate(...p.toArray());k.add(o,geo,M.ink,'wayfinding');
}
export function finishCirculation(root,shell,label,deck){
 const wallKit=detailKit(shell,label,true),k=detailKit(root,label,true),meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const o of meshes){
  if(/wall/i.test(o.name)&&o.geometry.parameters.width){
   for(const s of [-1,1]){const f=wallKit.face(o,s);if(f.w<1||f.h<1)continue;f.panel(0,-f.h*.3,f.w*.96,.075,M.oak,'corridor_lining');f.panel(0,-f.h*.43,f.w*.96,.08,M.dark,'corridor_lining');}
  }
  if(/(?:Room_entry_header|Entry_header|Lift_landing_header|Aft_lift_header|Crown_lift_platform_header)$/.test(o.name)){
   let d=deck;for(let p=o;p;p=p.parent)if(p.userData.deck)d=p.userData.deck;
   const z=o.getWorldPosition(new T.Vector3()).z;
   const text=o.name==='Crown_lift_platform_header'?Math.round(o.position.y-2.85)+' M':d?'DECK '+String(d).padStart(2,'0'):'LIFT';
   fixtureText(k,o,text,o.name==='Crown_lift_platform_header'?1:z>0?-1:1);
  }
  if(/^(Closed_lift_landing_door|Aft_lift_landing_door|Crown_lift_platform_door)$/.test(o.name)){
   for(const s of [-1,1]){const f=k.face(o,s);f.panel(0,-f.h*.34,f.w*.84,.055,M.steel,'lift_door_trim');}
  }
  if(o.name==='Lift_call_panel'){
   for(const s of [-1,1]){const f=k.face(o,s);f.panel(0,.04,.045,.045,M.dark,'lift_controls');f.panel(0,-.06,.045,.045,M.dark,'lift_controls');}
  }
  if(/^(Stair_tread_up|Stair_tread_return|Aft_stair_up|Aft_stair_return)$/.test(o.name)){
   const {b,c,s}=k.bounds(o);for(const dz of [-.25,.25])k.box(o,[s.x*.94,.006,Math.min(.025,s.z*.09)],[c.x,b.max.y+.004,c.z+dz*s.z],M.dark,'stair_grip');
  }
 }
 const a=k.finish(),b=wallKit.finish();root.userData.refinement={revision:1,label,features:{...a,...b}};polishInterior(root,label);return root.userData.refinement;
}
