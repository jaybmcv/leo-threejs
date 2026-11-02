// Acceptance-only contracts; these do not alter the generated ship or browser budget.
export function roomWindowValid(w, tolerance=1e-5) {
 const observation=w.roomId==='observation-lounge';
 const expected=observation?{kind:'public',width:3,height:6.65,sill:.45,pitch:3.3}:w.kind==='working'?{kind:'working',width:3,height:1.4,sill:.9,pitch:3.3}:{kind:'public',width:3,height:2.2,sill:.5,pitch:3.3};
 return w.kind===expected.kind&&(w.shuttleId?['width','height','sill']:['width','height','sill','pitch']).every(k=>Number.isFinite(w[k])&&Math.abs(w[k]-expected[k])<tolerance);
}
export function prototypeRoomWindowValid(p,r,windows) {
 const matches=windows.filter(w=>w.prototype===p.id&&w.clearPrototypeRect?.every((v,i)=>Math.abs(v-r[i])<1e-5));
 if(matches.length!==1)return false;
 const w=matches[0];
 return roomWindowValid(w)&&(w.shuttleId||w.roomId)===(p.kind==='bay'?p.id:(p.ownerId||p.id))&&(p.kind==='room'||p.kind==='bay')&&(w.roomId!=='observation-lounge'||p.roomKind==='lounge')&&Math.abs(r[1]-r[0]-w.width)<1e-5&&Math.abs(r[3]-r[2]-w.height)<1e-5&&Math.abs(r[2]-w.sill)<1e-5;
}
export function checkGeneratedRoomWindows(L) {
 const roomIds=new Set(L.rooms.filter(r=>r.kind!=='garden').map(r=>r.id));
 const windows=L.windows.filter(w=>roomIds.has(w.roomId)),issues=[];
 for(const w of windows)if(!roomWindowValid(w))issues.push({kind:'generated room window dimensions',id:w.id});
 const obs=windows.filter(w=>w.roomId==='observation-lounge'),counts=new Map();
 for(const w of obs)counts.set(w.prototype,(counts.get(w.prototype)||0)+1);
 const expected=[['observation-lounge--side-1-0',10],['observation-lounge--side1-1',10],['observation-lounge--head',4]];
 if(obs.length!==24||counts.size!==3||expected.some(([id,n])=>counts.get(id)!==n))issues.push({kind:'observation window count and faces',id:'observation-lounge'});
 for(const [id] of expected){const row=obs.filter(w=>w.prototype===id).sort((a,b)=>a.clearPrototypeRect[0]-b.clearPrototypeRect[0]);for(let i=1;i<row.length;i++)if(Math.abs(row[i].clearPrototypeRect[0]-row[i-1].clearPrototypeRect[0]-3.3)>1e-5)issues.push({kind:'observation window pitch',id});}
 return issues;
}
