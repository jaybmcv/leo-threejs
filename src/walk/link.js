// A link to a spot on the walk: walk.html?at=x,y,z&yaw=90&pitch=-10&view=first (ship metres, degrees). The page drops
// the walker there (nudged to the nearest spot a walker fits), so a report or a shared link opens where it was taken.
const DEG=180/Math.PI;
export function readSpot(search=location.search){
 const p=new URLSearchParams(search),at=(p.get('at')||'').split(',').map(Number);
 if(at.length!==3||!at.every(Number.isFinite))return null;
 const angle=(name,fallback)=>{const v=Number(p.get(name));return p.has(name)&&Number.isFinite(v)?v/DEG:fallback;};
 return {at,yaw:angle('yaw',Math.PI/2),pitch:angle('pitch',-.18),view:p.get('view')==='first'?'first':'third'};
}
export function spotLink({position,yaw,pitch,view}){
 const url=new URL(location.href),p=new URLSearchParams();
 p.set('at',[position.x,position.y,position.z].map(v=>v.toFixed(2)).join(','));
 p.set('yaw',String(Math.round(yaw*DEG)));p.set('pitch',String(Math.round(pitch*DEG)));if(view==='first')p.set('view','first');
 url.search=p.toString().replace(/%2C/g,',');url.hash='';return url.href;
}
