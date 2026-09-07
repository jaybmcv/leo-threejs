import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createShip,physicalX} from '../src/model.js';
import {WINDOW_ROWS,frontPoint,upperWidth,diamondHalfWidth} from '../src/hull-profile.js';

// Project actual model triangles, not a second hand-written model outline.
// Half-metre cells provide a stable silhouette guard for later height-only edits.
const step=.5,nx=1200,nz=600,mask=new Uint8Array(nx*nz),columns=Array.from({length:nx},()=>[]);
const major=/^(Smooth_pressure_envelope_|Sculpted_nacelle_shell$|Nacelle_exhaust_bulkhead$|Nacelle_chamfered_nose_face$|Engine_shroud$|Engine_bell$|Engine_nozzle_lip$|Engine_throat$|Blended_double_delta$|Wing_thermal_edge$|Swept_cat_tail$|Swept_tail_cap$|Tail_root_dorsal_fairing$|Contoured_aft_pressure_frame$)/;
const ship=createShip();ship.exterior.updateMatrixWorld(true);
ship.exterior.traverse(o=>{
  if(!o.isMesh||!major.test(o.name))return;
  const a=o.geometry.attributes.position,idx=o.geometry.index;
  const pts=Array.from({length:a.count},(_,i)=>new Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));
  const count=idx?.count||a.count;
  for(let k=0;k<count;k+=3){
    const t=[0,1,2].map(j=>pts[idx?idx.getX(k+j):k+j]);
    const lo=Math.max(0,Math.ceil((Math.min(...t.map(p=>p.x))+300)/step-.5));
    const hi=Math.min(nx-1,Math.floor((Math.max(...t.map(p=>p.x))+300)/step-.5));
    for(let i=lo;i<=hi;i++){
      const x=-300+(i+.5)*step,z=[];
      for(let j=0;j<3;j++){const p=t[j],q=t[(j+1)%3];if(Math.abs(q.x-p.x)<1e-9)continue;const u=(x-p.x)/(q.x-p.x);if(u>=0&&u<=1)z.push(p.z+(q.z-p.z)*u);}
      if(z.length>=2)columns[i].push([Math.min(...z),Math.max(...z)]);
    }
  }
});
for(let i=0;i<nx;i++)for(const [lo,hi] of columns[i]){
  const a=Math.max(0,Math.ceil((lo+150)/step-.5)),b=Math.min(nz-1,Math.floor((hi+150)/step-.5));
  for(let j=a;j<=b;j++)mask[i*nz+j]=1;
}
const packed=[];for(let i=0;i<nx;i++){const spans=[];for(let j=0;j<nz;j++){if(!mask[i*nz+j])continue;const start=j;while(j+1<nz&&mask[i*nz+j+1])j++;spans.push([start,j]);}packed.push(spans);}
const glazing=WINDOW_ROWS.flatMap(r=>[r.bottom,r.top].flatMap(y=>Array.from({length:65},(_,i)=>{const p=frontPoint(y,r.arc*i/64,1);return [physicalX(p[0]),p[2]];})));
const upperForms=Array.from({length:405},(_,i)=>{const x=-180+i;return [physicalX(x),upperWidth(x,52),diamondHalfWidth(x)];});
const sidePlaneMaxDeviationM=Math.max(...[20,30,40,48].map(y=>{const widths=[32,64,96,128,160].map(x=>upperWidth(x,y));return Math.max(...widths)-Math.min(...widths);}));
assert.ok(sidePlaneMaxDeviationM<.01,'The main side planes have developed a recess or bulge');
const baselinePath='concepts/v15/top-plan-lock.json',out='output/leo-interior-v01';
await fs.mkdir(out,{recursive:true});
if(process.argv.includes('--set-baseline')){await fs.mkdir('concepts/v15',{recursive:true});await fs.writeFile(baselinePath,JSON.stringify({step,nx,nz,columns:packed,glazing,upperForms},null,2),{flag:'wx'});}
const saved=await fs.readFile(baselinePath,'utf8').catch(e=>{if(e.code==='ENOENT'&&process.argv.includes('--preview'))return null;throw e;});
const baseline=saved?JSON.parse(saved):{columns:packed,glazing},old=new Uint8Array(nx*nz);
for(let i=0;i<nx;i++)for(const [a,b] of baseline.columns[i])for(let j=a;j<=b;j++)old[i*nz+j]=1;
let changed=0,area=0;for(let i=0;i<mask.length;i++){changed+=old[i]!==mask[i]?1:0;area+=mask[i];}
assert.equal(glazing.length,baseline.glazing.length,'Top-view glazing sample count changed');
const glassError=Math.max(...glazing.map((p,i)=>Math.hypot(p[0]-baseline.glazing[i][0],p[1]-baseline.glazing[i][1])));
assert.equal(upperForms.length,baseline.upperForms.length,'Upper-form sample count changed');
const upperError=Math.max(...upperForms.flatMap((p,i)=>p.map((v,j)=>Math.abs(v-baseline.upperForms[i][j]))));
const report={status:!saved?'DRAFT':changed===0&&glassError<.01&&upperError<.01?'PASS':'FAIL',scope:'Major exterior silhouette, crown, diamond and glazing X/Z projection versus the v15 top-view baseline. This checks preservation, not exact agreement with the artwork.',gridSpacingM:step,changedCells:changed,changedAreaM2:changed*step*step,projectedAreaM2:area*step*step,maxGlazingPlanDisplacementM:glassError,maxUpperFormPlanDisplacementM:upperError,sidePlaneMaxDeviationM};
await fs.writeFile(out+'/top-plan-report.json',JSON.stringify(report,null,2));
// Plot the raster boundary as a vector over the unchanged original concept.
const px=i=>877+i*step*314/300,py=j=>668+j*step*314/300;
let path='';const edge=(i,j,k,l)=>{path+=`M${px(i).toFixed(2)},${py(j).toFixed(2)}L${px(k).toFixed(2)},${py(l).toFixed(2)}`;};
for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)if(mask[i*nz+j]){
  if(i===0||!mask[(i-1)*nz+j])edge(i,j,i,j+1);
  if(i===nx-1||!mask[(i+1)*nz+j])edge(i+1,j,i+1,j+1);
  if(j===0||!mask[i*nz+j-1])edge(i,j,i+1,j);
  if(j===nz-1||!mask[i*nz+j+1])edge(i,j+1,i+1,j+1);
}
const html=await fs.readFile('src/top-plan-review.html','utf8');await fs.writeFile(out+'/top-plan-review.html',html.replace('<!-- MODEL_OUTLINE -->',`<path id="outline" d="${path}"/>`));
console.log(JSON.stringify(report,null,2));if(saved)assert.equal(report.status,'PASS','Top view changed: preserve the established X/Z silhouette and window curves.');
