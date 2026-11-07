// The cockpit bow (Jay, 2026-11-06): the bridge, the voyage forum and the nose commons cafes trade their regular 3 m panes
// at a 3.3 m pitch for a few wide, round-cornered panes, drawn from his reference and measured on the hull. Each entry
// lists a patch's openings in its own chart ([u0,u1,y0,y1,radius]; the head and cafe charts run u along +z, the side rows
// along +x). A side row keeps its regular windows aft of keepBelow, so only its forward end changes. The observation
// lounge (its own carrier over the shoulders) is not here yet.
const R=.6,SILL=.5,TOP=2.7,pane=(u0,u1)=>[u0,u1,SILL,TOP,R];
// A centre pane and mirrored flanks, port to starboard.
const centred=(c,...flanks)=>[...flanks.map(([a,b])=>pane(-b,-a)).reverse(),pane(-c,c),...flanks.map(([a,b])=>pane(a,b))];
const NOSE=centred(3.4,[5.9,10.2]),BRIDGE_SIDE={keepBelow:175,openings:[pane(176,182.5)]};
export const BOW_GLAZING={
 'd20-bridge-9--head':{openings:centred(7.4,[9.9,19.4])},
 'd20-bridge-9--side-1-0':BRIDGE_SIDE,
 'd20-bridge-9--side1-1':BRIDGE_SIDE,
 'd16-voyage-forum-bow--head':{openings:centred(10.7,[15.5,25.8])},
 ...Object.fromEntries(Array.from({length:10},(_,i)=>['nose-commons-'+String(i+1).padStart(2,'0'),{openings:NOSE}])),
};
// Every opening of a profiled patch must sit on actual skin and lining across its whole extent (the glass grid samples
// every 0.25 m node of its bounding rect), so a pane that does not fit fails the build instead of quietly vanishing.
export function bowOpenings(p,depth){const profile=BOW_GLAZING[p.id];if(!profile)return null;
 for(const o of profile.openings){const nx=Math.ceil((o[1]-o[0])/.25),ny=Math.ceil((o[3]-o[2])/.25);
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=o[0]+(o[1]-o[0])*i/nx,y=o[2]+(o[3]-o[2])*j/ny;try{depth(p.surface,u,y);depth(p.inner,u,y);}catch(e){throw Error('Bow pane '+p.id+' '+JSON.stringify(o)+' leaves the skin at '+[u,y].map(v=>v.toFixed(2)),{cause:e});}}}
 return profile;}
export const isBowOpening=(p,r)=>!!BOW_GLAZING[p.id]?.openings.some(o=>o.length===r.length&&o.every((v,i)=>Math.abs(v-r[i])<1e-9));
