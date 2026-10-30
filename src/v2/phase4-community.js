import layout from 'v2-layout';
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<.055);
export function arrivalArtWall(){const r=layout.rooms.find(r=>r.id==='d02-arrival-1');return[r.door.center[0]-1.75,r.y+1.665,r.door.center[2]];}
export function phase4PaintingPoint(name,fallback){return name==='Orange_Haze_5'?arrivalArtWall():fallback;}
export function fitPhase4Painting(group,p){if(p.name!=='Orange_Haze_5')return;const at=arrivalArtWall();group.position.set(at[0],layout.decks[1].y,at[2]);group.rotation.y=Math.PI/2;group.userData.phase4Fit='arrival-branch-wall';}
function local(r,p){const f=r.fittingFrame||r.frame,c=Math.cos(f.yaw||0),s=Math.sin(f.yaw||0);return[f.origin[0]+c*p[0]+s*p[2],f.origin[1]+p[1],f.origin[2]-s*p[0]+c*p[2]];}
function nearestLane(deck,p){let best;for(const c of layout.circulation.corridors.filter(c=>c.deck===deck&&(deck!==15||c.kind==='ring')))for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],dx=b[0]-a[0],dz=b[1]-a[1],n=dx*dx+dz*dz;if(n<16)continue;const t=Math.max(.03,Math.min(.97,((p[0]-a[0])*dx+(p[2]-a[1])*dz)/n)),at=[a[0]+dx*t,layout.decks[deck-1].y,a[1]+dz*t],d=Math.hypot(at[0]-p[0],at[2]-p[2]);if(!best||d<best.d)best={at,d,yaw:Math.atan2(dx,dz),corridor:c.id};}return best;}
export function phase4LegacySpot(spot){
 if(!spot||spot.resolved||spot.lv!==undefined&&spot.lv!==1)return null;
 let patch;
 if(same(spot.at,[-139.8,-35.7,-38.15])){const r=layout.rooms.find(r=>r.id==='d02-arrival-1'),p=arrivalArtWall();patch={at:[p[0]+3.25,r.y,p[2]],yaw:-Math.PI/2,pitch:0,room:r.id,feature:'anniversary-art-approach'};}
 else if(same(spot.at,[167,-34.2,-21.6])){const r=layout.rooms.find(r=>r.id==='d02-hangar-9');patch={at:local(r,[-29,0,-9]),yaw:(r.frame.yaw||0)+Math.atan2(43,35),room:r.id,feature:'transfer-shuttle-approach'};}
 else if(same(spot.at,[-145.31,-39.7,32.93]))patch={...nearestLane(1,spot.at),feature:'deck1-hex-floor'};
 else if(same(spot.at,[40,16.3,26])){const a=layout.cabins.find(c=>c.id==='N10-271'),b=layout.cabins.find(c=>c.id==='N10-272'),n=a.door.outward;patch={at:[(a.door.center[0]+b.door.center[0])/2+n[0]*1.2,a.y,(a.door.center[2]+b.door.center[2])/2+n[1]*1.2],yaw:Math.atan2(-n[0],-n[1]),corridor:a.door.corridor,anchors:[a.id,b.id],feature:'halloween-lane'};}
 else if(same(spot.at,[-12.33,-27.68,62.33])){const s=layout.shuttles.filter(s=>s.deck===4).sort((a,b)=>Math.hypot(a.x-spot.at[0],a.z-spot.at[2])-Math.hypot(b.x-spot.at[0],b.z-spot.at[2]))[0],p=s.seats[0];patch={at:[p.center[0],s.y,p.center[2]],yaw:s.yaw+Math.PI/2,room:s.roomId,component:s.id,feature:'deck4-escape-seat-reservation'};}
 return patch?{...spot,...patch,lv:2,resolved:true}:null;
}
