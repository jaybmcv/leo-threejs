import layout from'../plan/selected-layout.js';import{contains}from'../plan/geometry-v2.js';
const roomLabels=layout.rooms.filter(r=>!r.aggregate).flatMap(r=>{const xs=r.polygon.map(p=>p[0]),zs=r.polygon.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);return layout.decks.filter(d=>d.y>=r.y-.1&&d.y<r.y+r.height-.5).map(d=>({id:r.id,name:r.name,kind:r.kind,center:[(x0+x1)/2,d.y,(z0+z1)/2],width:x1-x0,depth:z1-z0,polygon:r.polygon}));});
export const mapRooms=[...roomLabels,...layout.shuttles.map(s=>{const p=layout.hullPrototypes.prototypes.find(p=>p.kind==='bay'&&(p.id===s.id||p.ownerId===s.id));if(!p)throw Error('Missing planned bay outline '+s.id);const xs=p.polygon.map(q=>q[0]),zs=p.polygon.map(q=>q[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);return{id:s.id,name:'Escape shuttle '+s.id.split('-').slice(-2).join('').toUpperCase(),kind:'escape-bay',center:[(x0+x1)/2,s.y,(z0+z1)/2],width:x1-x0,depth:z1-z0,polygon:p.polygon};})];
const placeLists=new WeakMap();
export function currentMapPlaces(places){
 const cached=placeLists.get(places);
 if(cached&&cached.rows.length===places.length&&cached.rows.every((r,i)=>{const p=places[i];return r[0]===p&&r[1]===p.room&&r[2]===p.name&&r[3].length===p.at.length&&r[3].every((v,k)=>v===p.at[k]);}))return cached.filtered;
 const seen=new Set(),filtered=places.filter(p=>{const room=layout.rooms.find(r=>!r.aggregate&&Math.abs(p.at[1]-r.y)<1&&contains(r.polygon,[p.at[0],p.at[2]]));if(room&&(/-new-/.test(room.id)||/^neighborhood-\d+-(dining|cafe)$/.test(room.id))&&p.room!==room.id)return false;const key=p.room+'|'+p.name+'|'+p.at.join(',');if(seen.has(key))return false;seen.add(key);return true;});
 // PLACES is currently built once. Retain value snapshots so other callers may edit a list in place.
 placeLists.set(places,{rows:places.map(p=>[p,p.room,p.name,p.at.slice()]),filtered});return filtered;
}
