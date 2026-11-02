import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {objectRoom} from '../plan/rooms.js';
import {glass,metal} from './geometry.js';
// The retained hangar boarding stairs rise 1.5 m. Their sides are real internal
// drops, unlike the removed raster guards at former slabs and hull windows.
export function buildBoardingGuards(ship){
 if(ship.v2BoardingGuards)return ship.v2BoardingGuards;
 ship.root.updateMatrixWorld(true);const steps=[];ship.inside.traverse(o=>{if(!o.isMesh||o.name!=='Boarding_step')return;const b=new T.Box3().setFromObject(o,true),size=b.getSize(new T.Vector3()),axis=size.x>size.z?'z':'x',across=axis==='z'?'x':'z';steps.push({room:objectRoom(o),axis,across,lo:b.min[axis],hi:b.max[axis],a:b.min[across],b:b.max[across],y:b.max.y,floor:b.min.y});});
 const groups=[];for(const s of steps.sort((a,b)=>a.lo-b.lo)){let g=groups.find(g=>g.room===s.room&&g.axis===s.axis&&Math.abs(g.a-s.a)<.01&&Math.abs(g.b-s.b)<.01&&Math.abs(g.floor-s.floor)<.01&&s.lo<=g.hi+.025);if(!g){g={...s,steps:[]};groups.push(g)}g.steps.push(s);g.hi=Math.max(g.hi,s.hi)}
 const root=new T.Group();root.name='V2_boarding_balustrades';const bins=new Map();
 for(const g of groups){if(g.steps.length<2)continue;g.steps.sort((a,b)=>a.lo-b.lo);const first=g.steps[0],last=g.steps.at(-1),length=g.hi-g.lo,slope=(last.y-first.y)/(length-(first.hi-first.lo)),mid=(g.lo+g.hi)/2,y=(first.y+last.y)/2,deck=Math.max(1,Math.min(20,Math.round((g.floor+39.7)/4)+1));let bin=bins.get(deck);if(!bin)bins.set(deck,bin={panes:[],caps:[]});for(const at of[g.a-.025,g.b+.025]){const transform=geometry=>{const p=geometry.attributes.position;for(let i=0;i<p.count;i++){const along=p.getZ(i),up=p.getY(i)+slope*along;p.setXYZ(i,g.axis==='z'?at+p.getX(i):mid+along,y+.55+up,g.axis==='z'?mid+along:at+p.getX(i))}geometry.computeVertexNormals();delete geometry.parameters;return geometry;};bin.panes.push(transform(new T.BoxGeometry(.07,1.1,length)));const cap=transform(new T.BoxGeometry(.07,.045,length));cap.translate(0,.55,0);bin.caps.push(cap)}}
 for(const[deck,bin]of bins)for(const[k,material]of[['panes',glass],['caps',metal]]){const o=new T.Mesh(mergeGeometries(bin[k]),material);o.name=k==='panes'?'V2_boarding_guard_glass':'V2_boarding_guard_cap';o.userData={v2Deck:deck,boardingGuard:true};root.add(o);bin[k].forEach(g=>g.dispose())}
 (ship.inside.getObjectByName('V2_structure')||ship.inside).add(root);root.userData={flights:groups.length,v2Deck:2};ship.v2BoardingGuards=root;return root;
}
