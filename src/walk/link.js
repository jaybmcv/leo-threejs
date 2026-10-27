// A link to a spot on the walk: walk.html?at=x,y,z&yaw=90&pitch=-10&view=first (ship metres, degrees). The page drops
// the walker there (nudged to the nearest spot a walker fits), so a report or a shared link opens where it was taken.
import {LAYOUT_VERSION,roomAt,anchoredPoint,anchoredYaw} from '../plan/rooms.js';
const DEG=180/Math.PI;
export function remapSpot(spot){if(!spot||spot.resolved)return spot;if(spot.lv!==undefined&&spot.lv!==1)return {...spot,resolved:true};const room=spot.room||roomAt(spot.at,{legacy:true});return {...spot,at:room?anchoredPoint(room,spot.at):spot.at,yaw:room?anchoredYaw(room,spot.yaw):spot.yaw,lv:spot.lv??1,resolved:true};}

export function readSpot(search=location.search){
 const p=new URLSearchParams(search),at=(p.get('at')||'').split(',').map(Number);
 if(at.length!==3||!at.every(Number.isFinite))return null;
 const angle=(name,fallback)=>{const v=Number(p.get(name));return p.has(name)&&Number.isFinite(v)?v/DEG:fallback;};
 const lv=p.has('lv')?Number(p.get('lv')):1;if(!Number.isInteger(lv)||lv<1)return null;
 return {at,lv,yaw:angle('yaw',Math.PI/2),pitch:angle('pitch',-.18),view:p.get('view')==='first'?'first':'third'};
}
export function spotLink({position,yaw,pitch,view}){
 const url=new URL(location.href),p=new URLSearchParams();
 p.set('lv',String(LAYOUT_VERSION));p.set('at',[position.x,position.y,position.z].map(v=>v.toFixed(2)).join(','));
 p.set('yaw',String(Math.round(yaw*DEG)));p.set('pitch',String(Math.round(pitch*DEG)));if(view==='first')p.set('view','first');
 url.search=p.toString().replace(/%2C/g,',');url.hash='';return url.href;
}
