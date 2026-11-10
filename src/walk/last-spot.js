// Where this visitor last stood, kept by this browser so a reload (or a page opened again after the link dropped)
// within KEEP_MS puts them back there instead of the arrival hall. The page writes it every few seconds and as it is
// left: {at, yaw, pitch, view} on foot in a public area (public-area.js), or {at:null} after a restricted area or in a
// game, which always comes back to the arrival hall. Where they stand is checked again on the way back (main.js).
// A spot is tried once: taking it marks it, and the page writes a fresh one once its walk is up. A start that was cut
// off there (a phone short of memory) leaves it marked, so the next start is in the arrival hall, not the same spot.
const KEY='leo-walk-last-spot',KEEP_MS=10*60*1000;
const write=v=>{try{localStorage.setItem(KEY,JSON.stringify(v));}catch{}};

// spot: {at, yaw, pitch, view} or null for the arrival hall; t: when it was kept.
export function keepSpot(spot,t=Date.now()){
 const at=spot?.at?.map(v=>Math.round(v*100)/100)??null;
 write(at?{t,at,yaw:spot.yaw,pitch:spot.pitch,view:spot.view==='first'?'first':'third'}:{t,at:null});
}

// The spot kept less than KEEP_MS ago and not tried yet, as {at, yaw, pitch, view, t}, marked as tried; or null (none,
// too old, tried, or the arrival hall). keepSpot(spot, spot.t) puts it back untried.
export function takeSpot(now=Date.now()){
 let s=null;try{s=JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}
 if(!s||s.tried||!Number.isFinite(s.t)||now-s.t>KEEP_MS||s.t-now>60000)return null;
 if(!Array.isArray(s.at)||s.at.length!==3||!s.at.every(Number.isFinite))return null;
 write({...s,tried:true});
 const angle=(v,d)=>Number.isFinite(v)?v:d;
 return {at:s.at,yaw:angle(s.yaw,Math.PI/2),pitch:angle(s.pitch,-.18),view:s.view==='first'?'first':'third',t:s.t};
}
