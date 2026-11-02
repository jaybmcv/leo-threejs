import fs from 'node:fs/promises';
import {hydrateHullLayout} from '../src/plan/envelope-data-v2.js';
import {ownerFootprint} from '../src/plan/envelope-ownership-v2.js';
import {worldPoint} from '../src/plan/hull-skin-v2.js';
import {hullV2} from '../src/plan/hull-v2.js';
import {contains,bounds,distanceToSegment} from '../src/plan/geometry-v2.js';
const B=hydrateHullLayout(JSON.parse(await fs.readFile('output/launch-f/layout-before.json'))),O=JSON.parse(await fs.readFile('output/launch-f/original-plan.json')),h=hullV2(),out='output/launch-f',rows=[];
const bb=p=>bounds(p),near=(p,q,d)=>contains(p,q)||p.some((a,i)=>distanceToSegment(q,a,p[(i+1)%p.length])<d);
const polygons=(l,r,y)=>[r.polygon,...l.hullPrototypes.prototypes.filter(p=>(p.ownerId||p.id)===r.id&&y<=p.rect[3]).map(p=>ownerFootprint(p,y).map(q=>{const w=worldPoint(p.chart,q);return[w[0],w[2]];}))];
const cross=(p,x)=>{const zs=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a[0]<=x&&b[0]>x)||(b[0]<=x&&a[0]>x))zs.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}return zs.sort((a,b)=>a-b);};
export function usable(l,r){const pp=polygons(l,r,2),b=pp.map(bb),lo=Math.min(...b.map(b=>b.x0)),hi=Math.max(...b.map(b=>b.x1));let sum=0;for(let x=lo+.01;x<hi;x+=.02){let end=-Infinity;const ints=pp.flatMap(p=>{const z=cross(p,x),a=[];for(let i=0;i+1<z.length;i+=2)a.push([z[i],z[i+1]]);return a;}).sort((a,b)=>a[0]-b[0]);for(const[a,b]of ints){sum+=Math.max(0,b-Math.max(a,end))*.02;end=Math.max(end,b);}}return sum;}
for(const r of B.rooms.filter(r=>r.kind==='cafe')){
 const d=r.deck,x0=r.launchE.legacyX0,tip=x0+31,orig={...r,polygon:O.rooms.find(q=>q.id===r.id).polygon},atrium=O.decks[d-1].atrium.outline;
 const fixed=B.cabins.filter(c=>c.deck===d).map(c=>({id:c.id,p:c.polygon,door:c.door})).concat(B.rooms.filter(q=>q.deck===d&&q.id!==r.id&&!q.aggregate).map(q=>({id:q.id,p:q.polygon,door:q.door})));
 const corridors=B.circulation.corridors.filter(c=>c.deck===d&&c.id!==r.id+'-door-approach').flatMap(c=>c.points.slice(1).map((p,i)=>({a:c.points[i],b:p,w:c.width,id:c.id})));
 const free=(x,z,margin=.4)=>{const q=[x,z];if(Math.abs(z)>h.roomHalf(x,r.y,2)-2.5-margin)return false;if(d>6&&near(atrium,q,margin))return false;if(d===6&&x<x0&&near(atrium,q,margin))return false;if(fixed.some(o=>{const b=bb(o.p);return x>=b.x0-margin&&x<=b.x1+margin&&z>=b.z0-margin&&z<=b.z1+margin&&near(o.p,q,margin)}))return false;if(corridors.some(c=>distanceToSegment(q,c.a,c.b)<c.w/2+margin))return false;return true;};
 const step=.5,minX=x0-25,maxX=tip,nx=Math.ceil((maxX-minX)/step),nz=240,freeGrid=new Uint8Array(nx*nz),queue=[],seen=new Set();
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const x=minX+(i+.5)*step,z=-60+(j+.5)*step;if(free(x,z))freeGrid[i*nz+j]=1;}
 const si=Math.round((x0+4-minX)/step),sj=120;queue.push([si,sj]);seen.add(si*nz+sj);for(let k=0;k<queue.length;k++){const[i,j]=queue[k];for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj,id=a*nz+b;if(a<0||a>=nx||b<0||b>=nz||seen.has(id)||!freeGrid[id])continue;seen.add(id);queue.push([a,b]);}}
 const cells=queue.map(([i,j])=>[minX+(i+.5)*step,-60+(j+.5)*step]);
 const side=cells.filter(q=>Math.abs(q[1])>6), before=usable(B,r),original=usable(B,orig);
 const sections=[];for(let x=x0;x<=x0+12;x+=.5){const widths=[];for(const s of[-1,1]){let z=6;while(z<28&&free(x,s*(z+.15),.65))z+=.25;widths.push(Math.max(6,z-.25));}sections.push({x,widths});}
 const row={deck:d,id:r.id,name:r.name,x0,original,streamE:before,centralStripArea:r.width*12,connectedSideArea:side.length*step*step,connectedTotal:cells.length*step*step,sections};rows.push(row);
 const X=x=>(x-(x0-25))*8+65,Z=z=>390-z*5,P=p=>p.map(q=>X(q[0])+','+Z(q[1])).join(' '),poly=(p,fill,stroke,w=1)=>'<polygon points="'+P(p)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'"/>',line=p=>'<polyline points="'+P(p)+'" fill="none" stroke="#e99c39" stroke-width="2"/>';
 let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="800" viewBox="0 0 1080 800"><rect width="1080" height="800" fill="#101a24"/><text x="30" y="32" fill="white" font-family="sans-serif" font-size="22">Deck '+d+' bow audit · '+r.name+'</text><text x="30" y="59" fill="#ddd" font-family="sans-serif" font-size="14">Solid cyan: floor interior · dashed: 2m head boundary · grey: fixed rooms/cabins · orange: routes/doors</text>';
 for(const y of[0,2]){const p=[];for(let x=x0-25;x<=tip;x+=.25)p.push([x,h.skin(x,r.y+y,1)-2.5]);svg+='<polyline points="'+P(p)+'" fill="none" stroke="#42d8e6" stroke-width="2" '+(y?'stroke-dasharray="5 4"':'')+'/>';svg+='<polyline points="'+P(p.map(q=>[q[0],-q[1]]))+'" fill="none" stroke="#42d8e6" stroke-width="2" '+(y?'stroke-dasharray="5 4"':'')+'/>';}
 svg+=poly(atrium,'#263f59','#5c8eaf');svg+=poly(r.polygon,'#7b3f5260','#c46e87');svg+=poly(orig.polygon,'#46785370','#79bd89');for(const p of polygons(B,orig,2).slice(1))svg+=poly(p,'#46785370','#79bd89');
 for(const q of side)svg+='<rect x="'+(X(q[0])-.7)+'" y="'+(Z(q[1])-.5)+'" width="1.4" height="1" fill="#bada66"/>';
 for(const o of fixed.filter(o=>bb(o.p).x1>x0-25&&bb(o.p).x0<tip)){svg+=poly(o.p,'#54616b','#87929a');if(o.door){const q=o.door.center;svg+='<circle cx="'+X(q[0])+'" cy="'+Z(q[2])+'" r="2" fill="#f8a13c"/>';}}
 for(const c of B.circulation.corridors.filter(c=>c.deck===d&&c.id!==r.id+'-door-approach'))svg+=line(c.points);
 for(const x of[x0-20,x0-10,x0,x0+10,x0+20])svg+='<text x="'+X(x)+'" y="760" fill="white" font-family="sans-serif" font-size="12">x'+x+'</text>';
 svg+='<text x="30" y="786" fill="white" font-family="sans-serif" font-size="15">Pre-E '+original.toFixed(1)+'m² · E '+before.toFixed(1)+'m² · connected side capacity at 0.5m grid: '+row.connectedSideArea.toFixed(1)+'m²</text></svg>';await fs.writeFile(out+'/audit-d'+d+'.svg',svg);
}
await fs.writeFile(out+'/audit.json',JSON.stringify({method:'Area: union of core + finished hull footprint at 2m, 0.02m integration. Connected capacity: 0.5m avatar-centre grid, 0.4m edge clearance; excludes fixed rooms, other circulation and restored atrium, x0-25..x0+31, |z|<=60.',rows},null,2));console.log(rows.map(({sections,...r})=>r));
