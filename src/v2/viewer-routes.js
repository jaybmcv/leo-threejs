import {contains} from '../plan/geometry-v2.js';
import {edgeDistance,roomPolygonAt} from './viewer-data.js';
// Each shot is linear in a single verified volume; the player CUTS between shots.
// Yaw is the walk convention: atan2(dx,dz), 0 faces +z, pi/2 faces +x.
export const walkYaw=(a,b)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function roomShot(layout,id){const r=layout.rooms.find(r=>r.id===id&&!r.aggregate);if(!r?.door)throw Error('Missing v2 tour room '+id);const [x,y,z]=r.door.center,[nx,nz]=r.door.outward;const a=[x-nx*1.4,y+1.7,z-nz*1.4],b=[x-nx*3.4,y+1.7,z-nz*3.4],target=[x-nx*8,y+1.7,z-nz*8];return {id,room:id,deck:r.deck,label:r.name,from:a,to:b,target,duration:7};}
export function viewerRoutes(layout){
 const atrium={id:'atrium-flight',volume:'atrium',label:'Open atrium',deck:17,from:[-106,30,0],to:[105,30,0],target:[122,33,0],duration:32};
 return {ROUTE:{name:'Life aboard LEO',shots:[roomShot(layout,'d02-arrival-1'),roomShot(layout,'d02-new-1'),atrium,roomShot(layout,'commons-10')]},LOUNGE_TOUR:{name:'Gardens & observation lounge',shots:[roomShot(layout,'commons-2'),roomShot(layout,'commons-10'),roomShot(layout,'observation-lounge')]},ATRIUM_TOUR:{name:'Atrium fly-through',shots:[atrium]}};
}
export function sampleShot(shot,t){return {position:lerp(shot.from,shot.to,Math.max(0,Math.min(1,t))),target:shot.target};}
export function checkTourPoint(layout,shot,p,{shells=[]}={}){
 if(!p.every(Number.isFinite))throw Error('Non-finite tour position '+shot.id);
 if(shot.room){const r=layout.rooms.find(r=>r.id===shot.room&&!r.aggregate);if(!r)throw Error('Retired tour room '+shot.id);const poly=roomPolygonAt(r,p[1]);if(p[1]<r.y+.4||p[1]>r.y+r.height-.4||!contains(poly,[p[0],p[2]])||edgeDistance(poly,[p[0],p[2]])<.45)throw Error('Tour intersects room wall '+shot.id);const s=shells.find(s=>s.id===r.id);if(s&&(!contains(s.polygon,[p[0],p[2]])||edgeDistance(s.polygon,[p[0],p[2]])<.45))throw Error('Tour intersects walk shell '+shot.id);
 }else if(shot.volume==='atrium'){
 const lower=layout.decks.filter(d=>d.y<=p[1]).at(-1),hole=lower?.slab.holes.find(h=>h.id==='atrium');if(!hole||!contains(hole.polygon,[p[0],p[2]])||edgeDistance(hole.polygon,[p[0],p[2]])<.5||p[1]>layout.decks.at(-1).y)throw Error('Tour leaves atrium volume '+shot.id);
 for(const k of ['towers','bridges','balconies'])for(const c of layout.circulation[k]||[]){const d=layout.decks.find(d=>d.number===c.deck);if(c.polygon&&d&&((k==='towers')||Math.abs(p[1]-d.y)<.6)&&contains(c.polygon,[p[0],p[2]]))throw Error('Tour intersects atrium structure '+shot.id);}
 }else throw Error('Unknown tour volume '+shot.id);
 // Catch another room's wall, including multi-height shells; do not log room names.
 for(const r of layout.rooms){if(r.aggregate||r.id===shot.room||p[1]<r.y||p[1]>r.y+r.height)continue;const poly=roomPolygonAt(r,p[1]);if(edgeDistance(poly,[p[0],p[2]])<.25)throw Error('Tour intersects adjacent wall '+shot.id);}
}
export function checkViewerRoutes(layout,routes,options={}){let samples=0;for(const route of Object.values(routes))for(const shot of route.shots){const steps=Math.max(2,Math.ceil(Math.hypot(...shot.to.map((v,i)=>v-shot.from[i]))/.2));for(let i=0;i<=steps;i++){checkTourPoint(layout,shot,sampleShot(shot,i/steps).position,options);samples++;}}return samples;}

export function tourWalkSpot(layout,shot){const p=shot.volume==='atrium'?[0,layout.decks.find(d=>d.number===6).y,0]:[shot.from[0],shot.from[1]-1.7,shot.from[2]];return {at:p,yaw:walkYaw(p,shot.target)*180/Math.PI};}

export function exteriorFlightOffset(angle,radius){const scale=radius/Math.hypot(1,.36);return [Math.cos(angle)*scale,.36*scale,Math.sin(angle)*scale];}
