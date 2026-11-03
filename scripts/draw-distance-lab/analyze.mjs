import fs from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve('.qa/draw-distance-results');
const files=(await fs.readdir(dir)).filter(n=>n.endsWith('.jsonl'));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function stats(a){a=a.filter(Number.isFinite).sort((x,y)=>x-y);const q=p=>{if(!a.length)return null;const i=(a.length-1)*p,j=Math.floor(i);return a[j]+(a[Math.min(j+1,a.length-1)]-a[j])*(i-j);};return{n:a.length,mean:mean(a),p50:q(.5),p95:q(.95),p99:q(.99)};}
const reports=[];
for(const file of files){
 const entries=(await fs.readFile(path.join(dir,file),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse),rows=entries.map(e=>e.row),meta=entries[0]?.meta;
 if(!rows.length)continue;
 const profiles={};
 for(const id of [...new Set(rows.map(r=>r.profile))]){
  const a=rows.filter(r=>r.profile===id),metrics={};
  for(const metric of ['cpu','gpu','frame','drawCalls','triangles','span','phase4']){
   const raw=a.flatMap(r=>r.raw[metric]||[]);metrics[metric]={...stats(raw),equalSegmentMean:mean(a.map(r=>stats(r.raw[metric]||[]).mean).filter(Number.isFinite))};
  }
  profiles[id]={segments:a.length,valid:a.every(r=>r.valid),hiddenFrames:a.reduce((s,r)=>s+r.hiddenFrames,0),gpuIssued:a.reduce((s,r)=>s+r.gpuIssued,0),gpuInvalid:a.reduce((s,r)=>s+r.gpuInvalid,0),events:a.flatMap(r=>r.events),metrics};
 }
 const comparisons={};
 for(const id of Object.keys(profiles).filter(x=>x!=='current')){
  const pairs=rows.filter(r=>r.profile===id).map(row=>({row,baseline:rows.find(b=>b.profile==='current'&&b.round===row.round&&b.view===row.view&&b.motion===row.motion)})).filter(p=>p.baseline);
  const metrics={};for(const metric of ['cpu','gpu','frame','calls','triangles']){
   const valid=pairs.filter(p=>Number.isFinite(p.row[metric]?.mean)&&Number.isFinite(p.baseline[metric]?.mean));
   metrics[metric]={pairs:valid.length,deltaMean:mean(valid.map(p=>p.row[metric].mean-p.baseline[metric].mean)),meanPercentChange:mean(valid.map(p=>100*(p.row[metric].mean/p.baseline[metric].mean-1))),deltas:valid.map(p=>({round:p.row.round,view:p.row.view,motion:p.row.motion,baseline:p.baseline[metric].mean,candidate:p.row[metric].mean,delta:p.row[metric].mean-p.baseline[metric].mean}))};
  }comparisons[id]=metrics;
 }
 const byView={};for(const view of [...new Set(rows.map(r=>r.view))])for(const motion of ['still','look']){
  const key=view+'/'+motion;byView[key]={};for(const id of Object.keys(profiles)){const a=rows.filter(r=>r.view===view&&r.motion===motion&&r.profile===id);byView[key][id]={segments:a.length,...Object.fromEntries(['cpu','gpu','frame','calls','triangles'].map(k=>[k,{mean:mean(a.map(r=>r[k]?.mean).filter(Number.isFinite)),p95:mean(a.map(r=>r[k]?.p95).filter(Number.isFinite)),repeatMeans:a.map(r=>r[k]?.mean)}]))};}
 }
 reports.push({file,meta,segments:rows.length,expectedSegments:meta.protocol.segments,profiles,comparisons,byView});
}
await fs.writeFile(path.join(dir,'analysis.json'),JSON.stringify(reports,null,2));
for(const report of reports){console.log(JSON.stringify({file:report.file,resolution:report.meta.drawingBuffer,gpu:report.meta.gpu,segments:report.segments,expected:report.expectedSegments,profiles:Object.fromEntries(Object.entries(report.profiles).map(([id,p])=>[id,{valid:p.valid,gpuInvalid:p.gpuInvalid,...Object.fromEntries(['cpu','gpu','frame','triangles'].map(k=>[k,{mean:p.metrics[k].equalSegmentMean,p95:p.metrics[k].p95}]))}])),deltas:Object.fromEntries(Object.entries(report.comparisons).map(([id,c])=>[id,Object.fromEntries(Object.entries(c).map(([k,v])=>[k,v.deltaMean]))]))},null,2));}
