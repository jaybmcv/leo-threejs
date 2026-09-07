import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Box3,Vector3} from 'three';
import {CABINS,COMMONS,SPEC,DECKS,ROUTE,insideHull,halfWidth,createShip,logicalX} from '../src/model.js';
import {WINDOW_ROWS,frontPoint,frontAtLevel,hullAt as logicalHullAt,halfWidth as logicalHalfWidth} from '../src/hull-profile.js';
import {finishedRoofY as exteriorRoofY} from '../src/exterior-profile.js';
import {bowHeight} from '../src/diagonal-profile.js';
const issues=[];
// Check the finished surface, not just the legacy loft: the long sloped sides
// must be planar before the bow and gradual aft rounding begin.
let maximumFinishedSideDeviation=0;
// Exclude the rounded crown return and the intentional lower shoulder blend.
for(const [x0,z0] of [[0,40]])for(let x=x0;x<=110;x+=5)for(let z=z0;z<=70;z+=3){
  const expected=exteriorRoofY(80,z0)+(z-z0)*(exteriorRoofY(80,70)-exteriorRoofY(80,z0))/(70-z0);
  maximumFinishedSideDeviation=Math.max(maximumFinishedSideDeviation,Math.abs(exteriorRoofY(x,z)-expected));
}
assert.ok(maximumFinishedSideDeviation<.001,`Main side surface deviates from plane: ${maximumFinishedSideDeviation}`);
console.log(JSON.stringify({maximumFinishedSideDeviationM:maximumFinishedSideDeviation}));
let minimumExteriorRoofMargin=Infinity;
for(const c of [...CABINS,...COMMONS])for(const sx of [-1,1])for(const sz of [-1,1]){
  const x=logicalX(c.x+sx*c.width/2),z=c.z+sz*c.depth/2;
  minimumExteriorRoofMargin=Math.min(minimumExteriorRoofMargin,exteriorRoofY(x,z)-c.y-c.height);
}
assert.ok(minimumExteriorRoofMargin>=SPEC.shellAllowance,`Smoothed fairing infringes occupied volume: ${minimumExteriorRoofMargin}`);
assert.equal(CABINS.length,5000);assert.equal(CABINS.reduce((n,c)=>n+c.berths,0),10000);assert.equal(new Set(CABINS.map(c=>c.id)).size,5000);
let minimumSideMargin=Infinity;
for(const c of CABINS){
  for(let sx of [-1,1])for(let sy of [0,1])for(let sz of [-1,1]){
    const x=c.x+sx*c.width/2,y=c.y+sy*c.height,z=c.z+sz*c.depth/2;
    if(!insideHull(x,y,z))issues.push(`Cabin ${c.id} exceeds usable hull`);
    minimumSideMargin=Math.min(minimumSideMargin,halfWidth(x,y,SPEC.shellAllowance)-Math.abs(z));
  }
}
let closestCabinSeparation=Infinity;
for(let n=1;n<=10;n++){
  const rows=CABINS.filter(c=>c.neighborhood===n);assert.equal(rows.length,500);
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    const a=rows[i],b=rows[j],dx=Math.abs(a.x-b.x)-(a.width+b.width)/2,dz=Math.abs(a.z-b.z)-(a.depth+b.depth)/2;
    if(dx<-.0001&&dz<-.0001)issues.push(`Overlap: ${a.id}, ${b.id}`);
    closestCabinSeparation=Math.min(closestCabinSeparation,Math.max(dx,dz));
  }
}
for(const c of COMMONS)for(let sx of [-1,1])for(let sy of [0,1])for(let sz of [-1,1]){
  if(!insideHull(c.x+sx*c.width/2,c.y+sy*c.height,c.z+sz*c.depth/2))issues.push(`Commons ${c.neighborhood} exceeds usable hull`);
}
for(const r of ROUTE)if(!insideHull(...r.position))issues.push(`Route stop ${r.name} outside usable hull`);
assert.equal(DECKS.length,20);assert.equal(DECKS.filter(d=>d.residential).length,10);
assert.equal(issues.length,0,issues.slice(0,20).join('\n'));
const ship=createShip();const ext=new Box3().setFromObject(ship.exterior),size=ext.getSize(new Vector3());
let windowContourSamples=0,maxWindowContourResidual=0;
for(const row of WINDOW_ROWS)for(let j=0;j<=8;j++)for(let k=0;k<=32;k++){
  const y=row.bottom+(row.top-row.bottom)*j/8,p=frontPoint(y,row.arc*k/32,1);
  maxWindowContourResidual=Math.max(maxWindowContourResidual,Math.abs(logicalHalfWidth(p[0],p[1])-p[2]));windowContourSamples++;
}
assert.ok(maxWindowContourResidual<.01,`Window facade residual ${maxWindowContourResidual}`);
let maxRoofClosure=0;for(let x=-299;x<299;x+=.5)maxRoofClosure=Math.max(maxRoofClosure,logicalHalfWidth(x,logicalHullAt(x).top));assert.ok(maxRoofClosure<.01,'Hull roof leaves an open centre seam');
const glazing={rows:WINDOW_ROWS.length,panes:WINDOW_ROWS.reduce((n,r)=>n+2*r.panesPerSide,0),windowContourSamples,maxWindowContourResidualM:maxWindowContourResidual,centrelineRakeDegreesFromDeck:WINDOW_ROWS.map(r=>Number((Math.atan2(bowHeight(frontAtLevel(r.top),r.top)-bowHeight(frontAtLevel(r.bottom),r.bottom),(frontAtLevel(r.bottom)-frontAtLevel(r.top))*.94)*180/Math.PI).toFixed(2))),scope:'Angles describe this model interpretation, not a measurement from the reference image.'};
await fs.mkdir('output/leo-interior-v01',{recursive:true});await fs.writeFile('output/leo-interior-v01/glazing-report.json',JSON.stringify(glazing,null,2));console.log(JSON.stringify(glazing,null,2));
assert.ok(Math.abs(size.x-564)<.1,`Length ${size.x}`);assert.ok(Math.abs(size.z-300)<.1,`Span ${size.z}`);
let meshes=0,triangles=0;ship.root.traverse(o=>{if(!o.isMesh)return;meshes++;const p=o.geometry.attributes.position;for(let i=0;i<p.array.length;i++)assert.ok(Number.isFinite(p.array[i]),`Invalid vertex ${o.name}`);triangles+=(o.geometry.index?.count||p.count)/3;});
const report={status:'PASS',minimumExteriorRoofClearanceM:Number(minimumExteriorRoofMargin.toFixed(3)),scope:'Spatial blockout geometry only. No life-support, propulsion, structural, evacuation, or collision-navigation validation.',cabins:5000,berths:10000,residentialDecks:10,totalDecks:20,clearCabinAreaM2:120000,cabinEnvelopeAreaM2:140800,cabinCornerSamples:40000,minimumLateralHullClearanceAfter2_5mAllowance:Number(minimumSideMargin.toFixed(3)),minimumCabinEnvelopeSeparation:Number(closestCabinSeparation.toFixed(3)),commonsChecked:10,routeStopsChecked:ROUTE.length,exteriorLengthM:Number(size.x.toFixed(2)),exteriorSpanM:Number(size.z.toFixed(2)),exteriorHeightIncludingTailM:Number(size.y.toFixed(2)),meshes,triangles,issues};
await fs.mkdir('output/leo-interior-v01',{recursive:true});await fs.writeFile('output/leo-interior-v01/fit-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

await import('./check-top-plan.mjs');
