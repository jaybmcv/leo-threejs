import {roomAt} from './rooms.js';
export function interactionTargets(w){const out=[],add=(kind,name,at,room=null,extra={})=>{if(!at)return;const p=at.toArray?at.toArray():at;out.push({kind,name,room:room||roomAt(p),at:p,...extra});};
 for(const l of w.lifts?.lifts||[])for(const [i,s] of l.stops.entries())add('lift',l.spec.id+':'+i,s.callAt,s.deck?'circulation-'+s.deck:'fin');
 for(const [i,s] of w.restSpots.entries())add(s.kind,'rest:'+i,s.point,null,{height:s.height,facing:s.facing?.toArray(),head:s.head?.toArray()});
 for(const [i,s] of (w.arcadeRow?.spots||[]).entries())add('arcade','cabinet:'+i,s.at,'commons-1');
 for(const [i,s] of (w.pawsOff?.mills||[]).entries())add('paws-off','treadmill:'+i,s.stand,s.place==='Arcade'?'commons-1':'d16-gym-3',{yaw:s.yaw});
 add('telescope','Alien Cat Invasion',w.scope,'observation-lounge');add('theatre','Community theatre',w.theatre?.group?.position,'d16-theater-5');add('pool','Paw Pool',w.poolTable?.centre,'d16-recreation-4');add('pinball','Leo Pinball',w.pinballMachine?.spot,'d16-recreation-4');
 for(const [i,s] of (w.mudwater?.spots||[]).entries())add(s.kind,'Mudwater:'+i,s.at,'d16-arena-1');
 for(const [i,s] of (w.changeLog?.targets||[]).entries())add('board','ship-log:'+i,s.at,i?'d02-arrival-1':'crown',{facing:s.facing.toArray()});
 for(const s of w.comics?.targets||[])add('comic',s.name,s.at,s.room);
 for(const s of w.chinampa?.targets||[])add('sign',s.name,s.at,'d03-farm-1');
 for(const s of w.paintings?.targets||[])add('painting',s.name,s.at,s.room);
 add('hologram','Mission control',w.missionHolo?.group?.position,'d20-mission-2');
 for(const p of w.places)add('go-to',p.name,p.at,p.room,{yaw:p.yaw});return out;
}
