// Frame-time study: compares the virtual-clock captures of two builds (scripts/walk-frame-bench.mjs --shots), view by
// view. "changed" is the share of pixels whose largest channel difference exceeds --threshold (of 255); also reports
// the mean absolute difference and PSNR. Usage: node scripts/walk-frame-diff.mjs --a=base --b=cand [--threshold=8]
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadImage,createCanvas} from '@napi-rs/canvas';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const a=arg('a','base'),b=arg('b','candidate'),threshold=Number(arg('threshold',8)),root=path.resolve('output/perf-walk/shots');
const pixels=async file=>{const img=await loadImage(await fs.readFile(file)),c=createCanvas(img.width,img.height),g=c.getContext('2d');g.drawImage(img,0,0);return g.getImageData(0,0,img.width,img.height).data;};
const rows=[];
for(const name of (await fs.readdir(path.join(root,a))).filter(n=>n.endsWith('.png')).sort()){
 const pa=await pixels(path.join(root,a,name)),pb=await pixels(path.join(root,b,name));let changed=0,sum=0,sq=0;const n=pa.length/4;
 for(let i=0;i<pa.length;i+=4){let m=0;for(let c=0;c<3;c++){const d=Math.abs(pa[i+c]-pb[i+c]);sum+=d;sq+=d*d;if(d>m)m=d;}if(m>threshold)changed++;}
 const mse=sq/(n*3);rows.push({view:path.parse(name).name,changedPct:100*changed/n,meanAbs:sum/(n*3),psnr:mse?10*Math.log10(255*255/mse):Infinity});
}
const worst=Math.max(...rows.map(r=>r.changedPct)),result={a,b,threshold,worstChangedPct:worst,meanChangedPct:rows.reduce((s,r)=>s+r.changedPct,0)/rows.length,pass:worst<1,rows};
await fs.mkdir('output/perf-walk/results',{recursive:true});await fs.writeFile(`output/perf-walk/results/diff-${a}-${b}.json`,JSON.stringify(result,null,1));
for(const r of rows)console.log(r.view.padEnd(22),'changed',r.changedPct.toFixed(3)+'%','meanAbs',r.meanAbs.toFixed(3),'psnr',r.psnr.toFixed(1));
console.log('worst',worst.toFixed(3)+'%',result.pass?'PASS (<1%)':'FAIL');
