import {bounds,contains,distanceToSegment,rectangle} from '../plan/geometry-v2.js';
import {TRANSIT_CORES} from '../plan/v1.js';

// Legacy circulation frames overlap at deck boundaries; determine the floor from Y,
// never from circulation-N's registry id. Yaw here is walk yaw: 0 = +Z, PI/2 = +X.
export function legacyDeck(layout,at){
 let best=null;for(const d of layout.decks)if(!best||Math.abs(d.y-at[1])<=Math.abs(best.y-at[1])+1e-7)best=d;
 return best&&Math.abs(best.y-at[1])<=2.05?best:null;
}
export const isLegacyCirculation=room=>!room||/^(circulation-|lift-|stairs-|service-lift-)/.test(room);
const distance=(poly,p)=>Math.min(...poly.map((a,i)=>distanceToSegment(p,a,poly[(i+1)%poly.length])));
const bounded=poly=>({polygon:poly,...bounds(poly)});
const near=(b,p,r)=>p[0]>=b.x0-r&&p[0]<=b.x1+r&&p[1]>=b.z0-r&&p[1]<=b.z1+r;
const insideDisc=(poly,p,r)=>contains(poly,p)&&distance(poly,p)>=r;
const touches=(b,p,r)=>near(b,p,r)&&(contains(b.polygon,p)||distance(b.polygon,p)<r);

// Factory accepts the trimmed v2-layout used by the public walk. No deck.corridors,
// navigation grids, meshes or regenerated model are needed to resolve a saved link.
export function createLegacyCorridorRemapper(layout,legacyCabins){
 const indexed=new Map(),cabins=new Map(layout.cabins.map(c=>[c.id,c]));
 function index(deck){
  if(indexed.has(deck.number))return indexed.get(deck.number);
  const solids=[...layout.cabins,...layout.rooms.filter(r=>!r.aggregate)].filter(r=>r.y<deck.y+2&&r.y+r.height>deck.y+.4).map(r=>({...bounded(r.polygon),id:r.id}));
  // Match the forward stair's actual outer walls, including its landing width.
  const core=TRANSIT_CORES.find(c=>c.id==='forward');
  if(deck.number<=core.lastDeck)for(const side of[-1,1]){const gallery=deck.number>=17&&deck.number<=19;solids.push({...bounded(rectangle(core.stairX+(gallery?1:0),side*(core.stairZ+2.57),gallery?7:9,.14)),id:'forward-stair-outer-wall-'+side});}
  const holes=deck.slab.holes.map(h=>bounded(h.polygon));
  const supports=[...layout.circulation.bridges,...layout.circulation.towers,...(layout.circulation.balconies||[])].filter(r=>r.deck===deck.number).map(r=>bounded(r.polygon));
  const segments=[];
  for(const c of layout.circulation.corridors.filter(c=>c.deck===deck.number&&!/^N\d{2}-\d{3}-door-approach$/.test(c.id)))for(let i=1;i<c.points.length;i++){
   const a=c.points[i-1],b=c.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(length>.01&&(c.kind==='ring'||length>=2.4)&&c.width>=.9)segments.push({id:c.id,kind:c.kind,width:c.width,a,b,dx:dx/length,dz:dz/length,length});
  }
  const data={solids,holes,supports,segments};indexed.set(deck.number,data);return data;
 }
 function safe(deck,p,radius=.45){
  const data=index(deck),covered=data.supports.some(s=>near(s,p,0)&&insideDisc(s.polygon,p,radius));
  if(!contains(deck.slab.outline,p)||distance(deck.slab.outline,p)<radius)return false;
  if(!covered&&data.holes.some(h=>touches(h,p,radius)))return false;
  if(data.solids.some(s=>touches(s,p,radius)))return false;
  // Also leave headroom at structural openings and return stairs from below.
  if(layout.circulation.stairs.some(s=>s.deck===deck.number&&s.polygon&&touches(bounded(s.polygon),p,radius)))return false;
  return true;
 }
 function laneAnchor(spot,deck){
  if(deck.number<6||deck.number>15||Math.abs(spot.at[0])>126)return null;
  const lanes=[-52,-26,0,26,52],lane=lanes.reduce((a,b)=>Math.abs(b-spot.at[2])<Math.abs(a-spot.at[2])?b:a);
  if(Math.abs(spot.at[2]-lane)>2.3)return null;
  let old=null,score=Infinity;
  for(const c of legacyCabins){if(c.deck!==deck.number)continue;const d=Math.hypot(c.x-spot.at[0],c.z-spot.at[2]);if(d<score){score=d;old=c;}}
  const current=old&&cabins.get(layout.cabinIdMap[old.id]);
  if(!current||current.deck!==deck.number)return null;
  const n=current.door.outward;
  return {legacy:old.id,cabin:current.id,at:[current.door.center[0]+n[0]*1.05,current.door.center[2]+n[1]*1.05]};
 }
 function remap(spot,room){
  if(!spot||spot.resolved||spot.lv!==undefined&&spot.lv!==1||!isLegacyCirculation(room))return null;
  const deck=legacyDeck(layout,spot.at);if(!deck)return null;
  const anchor=laneAnchor(spot,deck),aim=anchor?.at||[spot.at[0],spot.at[2]],candidates=[];
  for(const s of index(deck).segments){
   const margin=Math.min(.8,s.length/2),d=Math.max(margin,Math.min(s.length-margin,(aim[0]-s.a[0])*s.dx+(aim[1]-s.a[1])*s.dz));
   // Tiny ring segments are valid when joined to their neighbours. Short
   // architectural nubs at stair portals are excluded above. Larger search
   // offsets move off a shaft, door jamb or a stair opening onto that same route.
   for(const offset of s.length<=1.6?[0]:[0,-1,1,-2,2,-4,4]){
    const along=Math.max(margin,Math.min(s.length-margin,d+offset)),p=[s.a[0]+s.dx*along,s.a[1]+s.dz*along];
    const score=Math.hypot(p[0]-aim[0],p[1]-aim[1]);candidates.push({s,p,score});
   }
  }
  candidates.sort((a,b)=>a.score-b.score||a.s.id.localeCompare(b.s.id));
  for(const {s,p} of candidates){
   if(!safe(deck,p))continue;
   let direction=Math.sin(spot.yaw??0)*s.dx+Math.cos(spot.yaw??0)*s.dz<0?-1:1;
   const ahead=k=>safe(deck,[p[0]+s.dx*k*1.2,p[1]+s.dz*k*1.2]);
   if(!ahead(direction)){direction=-direction;if(!ahead(direction))continue;}
   const yaw=Math.atan2(s.dx*direction,s.dz*direction);
   return {...spot,at:[p[0],deck.y,p[1]],yaw,lv:2,resolved:true,corridor:s.id,legacyCorridor:{deck:deck.number,...(anchor?{legacyCabin:anchor.legacy,cabin:anchor.cabin}:{} )}};
  }
  return null;
 }
 return {remap,safe,laneAnchor};
}

export function legacyFeatureSpot(spot){
 // One historical fin-root photo is below any retained floor. Use the first
 // inspection platform, also used by that entry's existing Go-there link.
 if(spot&&!spot.resolved&&(spot.lv===undefined||spot.lv===1)&&spot.at.every((v,i)=>Math.abs(v-[-229.36,35.32,-2.24][i])<.055))return {...spot,at:[-229.36,46.86,0],yaw:Math.PI/2,lv:2,resolved:true,feature:'fin-inspection-approach'};
 // Hydro-Nip wall and sign photos taken about 5 m up, over the open floor. Nothing is walkable
 // up there in v2, so stand on the lounge floor beneath the same spot (commons-1 moved -22.5,-16).
 if(spot&&!spot.resolved&&(spot.lv===undefined||spot.lv===1)&&spot.at[1]>28.9&&spot.at[1]<31&&spot.at[0]>-101&&spot.at[0]<-88.5&&spot.at[2]>-41&&spot.at[2]<-20)return {...spot,at:[spot.at[0]-22.5,24.3,spot.at[2]-16],lv:2,resolved:true,feature:'hydro-nip-high-shot'};
 return null;
}
