import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rectangle} from '../plan/geometry-v2.js';
import {polygonGeometry,mesh,strip,floor,bounds} from './geometry.js';
import {removeBuriedSlabSides} from './atrium-floor-finish.js';

// Crossing approaches on Decks 1 and 2 share one physical floor. Partition
// their union before extrusion; remove only caps covered on both sides.
export function buildCorridorFloors(structure,layout,roomHoles,holeBounds){
 const states=new Map(),laidByDeck=new Map(),cell=16,keys=b=>{const out=[];for(let x=Math.floor(b.x0/cell);x<=Math.floor(b.x1/cell);x++)for(let z=Math.floor(b.z0/cell);z<=Math.floor(b.z1/cell);z++)out.push(x+','+z);return out;};
 for(const c of layout.circulation.corridors)for(let i=1;i<c.points.length;i++){
  const a=c.points[i-1],b=c.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)continue;
  const poly=rectangle((a[0]+b[0])/2,(a[1]+b[1])/2,len,c.width,-Math.atan2(b[1]-a[1],b[0]-a[0])),bb=bounds(poly),holes=[...roomHoles[c.deck-1],...holeBounds[c.deck-1]].filter(h=>h.box.x0<bb.x1&&h.box.x1>bb.x0&&h.box.z0<bb.z1&&h.box.z1>bb.z0).map(h=>h.polygon);
  if(c.deck===6)holes.push(layout.decks[5].atrium.outline);
  if(c.deck!==1&&c.deck!==2){
   // Door approaches run along their spines and along each other: only the stretch no earlier collinear floor at least as
   // wide already covers is laid, or the two coplanar tops (and the hex finish over each) fight. Uncovered runs are unchanged.
   const lay=(a,b,poly,holes)=>{if(holes.length)mesh(structure,'V2_corridor_floor',polygonGeometry(poly,holes,layout.decks[c.deck-1].y+.008,.06),floor);else strip(structure,'V2_corridor_floor',a,b,layout.decks[c.deck-1].y+.008,c.width,.06,floor);};
   const ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,along=p=>(p[0]-a[0])*ux+(p[1]-a[1])*uz,laid=laidByDeck.get(c.deck)||laidByDeck.set(c.deck,[]).get(c.deck);let spans=[[0,len]];
   for(const s of laid){if(s.width<c.width-1e-6||Math.abs(ux*s.uz-uz*s.ux)>1e-6||Math.abs((a[0]-s.a[0])*s.uz-(a[1]-s.a[1])*s.ux)>1e-4)continue;const lo=Math.min(along(s.a),along(s.b)),hi=Math.max(along(s.a),along(s.b));if(Math.min(hi,len)-Math.max(lo,0)<=.001)continue;spans=spans.flatMap(([x,z])=>hi<=x||lo>=z?[[x,z]]:[[x,Math.max(x,lo)],[Math.min(z,hi),z]].filter(([x,z])=>z-x>.001));}
   laid.push({a,b,ux,uz,width:c.width});
   if(spans.length===1&&spans[0][0]===0&&spans[0][1]===len){lay(a,b,poly,holes);continue;}
   for(const [lo,hi] of spans){const pa=[a[0]+ux*lo,a[1]+uz*lo],pb=[a[0]+ux*hi,a[1]+uz*hi],piece=rectangle((pa[0]+pb[0])/2,(pa[1]+pb[1])/2,hi-lo,c.width,-Math.atan2(b[1]-a[1],b[0]-a[0])),pbb=bounds(piece),pieceHoles=[...roomHoles[c.deck-1],...holeBounds[c.deck-1]].filter(h=>h.box.x0<pbb.x1&&h.box.x1>pbb.x0&&h.box.z0<pbb.z1&&h.box.z1>pbb.z0).map(h=>h.polygon);if(c.deck===6)pieceHoles.push(layout.decks[5].atrium.outline);lay(pa,pb,piece,pieceHoles);}
   continue;
  }
  let state=states.get(c.deck);if(!state)states.set(c.deck,state={bins:new Map(),pieces:[]});const{bins,pieces}=state;
  const nearby=new Set(keys(bb).flatMap(k=>bins.get(k)||[]));for(const r of nearby)if(r.box.x0<bb.x1&&r.box.x1>bb.x0&&r.box.z0<bb.z1&&r.box.z1>bb.z0)holes.push(r.polygon);
  const g=polygonGeometry(poly,holes,layout.decks[c.deck-1].y+.008,.06);if(!g.attributes.position.count){g.dispose();continue;}pieces.push(g);const record={polygon:poly,box:bb};for(const k of keys(bb))(bins.get(k)||bins.set(k,[]).get(k)).push(record);
 }
 for(const[deck,{pieces}]of states)if(pieces.length){const merged=mergeGeometries(pieces),fixed=removeBuriedSlabSides(merged,layout.decks[deck-1].y+.008);mesh(structure,'V2_corridor_floor',fixed.geometry,floor);if(fixed.geometry!==merged)merged.dispose();pieces.forEach(g=>g.dispose());}
}
