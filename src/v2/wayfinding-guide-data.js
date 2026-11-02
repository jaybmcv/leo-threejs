import {deckDirectory} from './wayfinding-data.js';
export function guideSchedule(layout){
 const routes=new Map(layout.circulation.corridors.map(c=>[c.id,c]));
 return layout.rooms.filter(r=>!r.aggregate&&r.door&&!r.id.includes('-housekeeping-')).map(r=>{
  const n=r.door.outward,c=routes.get(r.door.corridor);if(!c)throw Error('Missing v2 room approach '+r.id);
  return {id:r.id,deck:r.deck,label:r.name,youAreHere:'You are here · Deck '+r.deck,at:[r.door.center[0]+n[0]*.9,r.y+2.75,r.door.center[2]+n[1]*.9],yaw:Math.atan2(n[0],n[1]),width:Math.min(3,Math.max(1.8,r.door.width-.3)),from:[r.door.center[0]+n[0]*1.9,r.y+.025,r.door.center[2]+n[1]*1.9],to:[r.door.center[0]+n[0]*.6,r.y+.025,r.door.center[2]+n[1]*.6],corridor:c.id};
 });
}
export const lobbySchedule=layout=>layout.decks.flatMap(d=>[135.7,...d.number<20?[-125.5]:[]].map(x=>({id:'directory-'+d.number+'-'+x,deck:d.number,at:[x,d.y+2.75,0],yaw:x>0?-Math.PI/2:Math.PI/2,youAreHere:'You are here · Deck '+d.number+' · '+d.name,rows:deckDirectory(layout).map(r=>r.title),note:d.number===20?'Public rooms · signed crew areas remain closed':'Public rooms: use Go to or the deck map'})));
