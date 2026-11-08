// Rounded window outlines (src/plan/window-outline-v2.js) and the cockpit bow panes (src/plan/bow-glazing-v2.js).
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {hydrateHullLayout} from '../src/plan/envelope-data-v2.js';
import {clipPolygon,triangulate} from '../src/plan/hull-skin-v2.js';
import {glazingGrid,weldCentreSeam} from '../src/v2/hull-prototypes.js';
import {glazingGrid as glazingGridAuthoring,weldCentreSeam as weldCentreSeamAuthoring} from '../src/v2/hull-prototypes.authoring.js';
import {cornerPlanes,cornerChartPlanes,outlinePoints,outlineArea,insideOutline,clipToOutline,subtractOutline,growOpening} from '../src/plan/window-outline-v2.js';
import {BOW_GLAZING,isBowOpening} from '../src/plan/bow-glazing-v2.js';
import {hullPlanChecks} from './hull-plan-check-v2.mjs';
import {checkGeneratedRoomWindows} from './window-contract-v2.mjs';
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0))/2;
// The pre-outline subtractRect, kept here as the reference for square openings.
const subtractRect=(poly,rect)=>{const outside=[];let inside=poly;for(const [axis,at,s]of [[0,rect[0],1],[0,rect[1],-1],[1,rect[2],1],[1,rect[3],-1]]){if(!inside.length)break;const piece=clipPolygon(inside,axis,at,-s);if(piece.length>2)outside.push(piece);inside=clipPolygon(inside,axis,at,s);}return outside;};
{
 const sq=[[-5,0,0,1],[5,0,0,2],[5,3,0,3],[-5,3,0,4]];
 // Square openings: no extra planes and exactly the old pieces, so cabins and regular windows are unchanged.
 for(const o of [[-1.5,1.5,.5,2.7],[-1.5,1.5,.5,2.7,0]]){assert.equal(cornerPlanes(o).length,0);assert.equal(cornerChartPlanes(o).length,0);assert.deepEqual(subtractOutline(sq,o),subtractRect(sq,o));assert.deepEqual(growOpening(o,.012),[-1.512,1.512,.488,2.712]);}
 // Rounded: the inside and outside pieces partition the polygon, the outline is convex and inside its own planes.
 const o=[-3.4,3.4,.5,2.7,.6],inside=area(clipToOutline(sq,o)),outside=subtractOutline(sq,o).reduce((s,p)=>s+area(p),0);
 assert(Math.abs(inside-outlineArea(o))<1e-9);assert(Math.abs(inside+outside-30)<1e-9);
 assert(Math.abs(outlineArea(o)-(6.8*2.2-(4-Math.PI)*.36))<.02,'six chords per quarter stay within 2 cm² of the true arc');
 assert(outlinePoints(o).every(q=>insideOutline(q,o,1e-9)));assert(!insideOutline([-3.39,.51],o));assert(insideOutline([0,1.6],o));
 // Attributes beyond (u,y) interpolate through the corner clips.
 for(const p of subtractOutline(sq,o))for(const q of p)assert.equal(q.length,4);
 assert.deepEqual(growOpening(o,.012),[-3.412,3.412,.488,2.712,.612]);
}
// The generated ship: every profiled patch carries exactly its profile panes (side rows keep only their aft windows),
// the plan checks pass, and moving or squaring a bow pane is caught.
{
 const L=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8')),real=hydrateHullLayout(structuredClone(L)),byId=new Map(real.hullPrototypes.prototypes.map(p=>[p.id,p]));
 let panes=0;
 for(const [id,profile]of Object.entries(BOW_GLAZING)){const p=byId.get(id);assert(p,'profiled patch '+id);const bow=p.openings.filter(r=>r.length>4);
  assert.deepEqual(bow,profile.openings,id);assert(p.openings.filter(r=>r.length<=4).every(r=>profile.keepBelow!==undefined&&r[1]<=profile.keepBelow),id+' keeps only aft windows');panes+=bow.length;
  const ws=real.windows.filter(w=>w.prototype===id&&w.bowProfile);assert.equal(ws.length,bow.length,id);for(const w of ws)assert(isBowOpening(p,w.clearPrototypeRect));}
 assert.equal(hullPlanChecks(real).status,'PASS');assert.deepEqual(checkGeneratedRoomWindows(L),[]);
 const negatives=[];
 for(const [name,mutate]of [
  ['bow pane moved',m=>{const p=m.hullPrototypes.prototypes.find(p=>p.id==='d16-voyage-forum-bow--head'),r=p.openings.find(r=>r.length>4);r[0]+=.1;r[1]+=.1;}],
  ['bow pane squared',m=>{const p=m.hullPrototypes.prototypes.find(p=>p.id==='nose-commons-05'),r=p.openings.find(r=>r.length>4);r[4]=0;}],
 ]){const m=structuredClone(real);mutate(m);assert(hullPlanChecks(m).issues.some(i=>i.kind==='room window dimensions'),name);negatives.push(name);}
 // The phone skin leaves a sub-millimetre seam at the centreline, right under a symmetric pane's middle: a rounded
 // pane's glass must still grid across it (the exact fallback would keep the seam), while square openings are unchanged.
 const seam=(patch,w=.0003)=>patch.flatMap(t=>[...triangulate(clipPolygon(t,0,-w,-1)),...triangulate(clipPolygon(t,0,w,1))]);
 for(const grid of [glazingGrid,glazingGridAuthoring]){const p0=byId.get('nose-commons-05'),p={...p0,surface:seam(p0.surface),inner:seam(p0.inner)},o=growOpening(p0.openings.find(r=>r.length>4&&r[0]<0&&r[1]>0),.012);
  assert(grid(p,o,q=>q).index.count>0);assert.throws(()=>grid(p,o.slice(0,4),q=>q),/No actual skin/);}
  // The exact fallback (the phone's usual path for a coarse skin) welds the seam so the pane's centre is glazed.
 const at=(ts,q)=>ts.some(([a,b,c])=>{const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)return false;const s=((b[1]-c[1])*(q[0]-c[0])+(c[0]-b[0])*(q[1]-c[1]))/d,t=((c[1]-a[1])*(q[0]-c[0])+(a[0]-c[0])*(q[1]-c[1]))/d;return Math.min(s,t,1-s-t)>=-1e-5;}),seamed=[.0003,.004].map(w=>seam(byId.get('nose-commons-05').surface,w));
 for(const seamPatch of seamed){assert(!at(seamPatch,[0,1.6]));for(const weld of [weldCentreSeam,weldCentreSeamAuthoring]){const w=weld(seamPatch);assert(at(w,[0,1.6]));assert(w.every(t=>t.every(q=>q.length===seamPatch[0][0].length)));}}
 console.log(JSON.stringify({status:'PASS',bowPatches:Object.keys(BOW_GLAZING).length,bowPanes:panes,negatives}));
}
