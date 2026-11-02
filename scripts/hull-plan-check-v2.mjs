import {hullPlanChecks as baseHullPlanChecks} from '../src/plan/hull-plan-check-v2.js';
import {checkGeneratedRoomWindows,prototypeRoomWindowValid} from './window-contract-v2.mjs';
// Replace only the observation lounge short-window predicate; all standard-window and other hull assertions are retained.
export function hullPlanChecks(L){
 const report=baseHullPlanChecks(L);
 const approvedObservation=new Set(L.hullPrototypes.prototypes.filter(p=>p.ownerId==='observation-lounge'&&p.openings?.every(r=>prototypeRoomWindowValid(p,r,L.windows))).map(p=>p.id));
 const issues=report.issues.filter(i=>i.kind!=='room window dimensions'||!approvedObservation.has(i.id));
 issues.push(...checkGeneratedRoomWindows(L));
 for(const p of L.hullPrototypes.prototypes)if((p.kind!=='cabin'&&p.kind!=='garden')||p.ownerId==='observation-lounge')for(const rect of p.openings===undefined?[p.window.rect]:p.openings)if(!prototypeRoomWindowValid(p,rect,L.windows))issues.push({kind:'room window dimensions',id:p.id});
 return {...report,issues,status:issues.length?'FAIL':'PASS'};
}
