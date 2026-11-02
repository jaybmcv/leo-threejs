import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {LAYOUT_V2 as L} from '../src/plan/layout-v2.js';
import {hullV2} from '../src/plan/hull-v2.js';
import {bounds,contains} from '../src/plan/geometry-v2.js';
const sharp=createRequire(import.meta.url)('sharp'),out=new URL('../output/plan-v2/',import.meta.url);await fs.mkdir(out,{recursive:true});
const C={page:'#f6f3ec',plate:'#e9e4d8',space:'#b7a1d2',atrium:'#8fc4a6',void:'#cfe6f3',corr:'#e9bd69',room:'#e9be77',garden:'#83bd83',cmd:'#92a8c6',medical:'#86c5d8',shuttle:'#2b435a',door:'#f08141',window:'#00a3d4',shaft:'#4b6eaf'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),S=4.6,W=2700,H=1150,X=x=>(x+300)*S+30,Z=z=>z*S+590;
const poly=(p,fill,stroke='none',width=0,extra='')=>'<polygon points="'+p.map(([x,z])=>X(x).toFixed(2)+','+Z(z).toFixed(2)).join(' ')+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'" '+extra+'/>';
const path=(p,color,width=1,extra='')=>'<polyline points="'+p.map(([x,z])=>X(x).toFixed(2)+','+Z(z).toFixed(2)).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" '+extra+'/>';
const label=(x,z,s,size=13,color='#24313d')=>'<text x="'+X(x)+'" y="'+Z(z)+'" font-family="Segoe UI,Arial" font-size="'+size+'" fill="'+color+'" text-anchor="middle" dominant-baseline="middle">'+esc(s)+'</text>';
function roomLabel(r){const b=bounds(r.polygon),words=r.name.split(' '),lines=[''];for(const w of words){if((lines.at(-1)+' '+w).length>23)lines.push(w);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+w;}return lines.slice(0,3).map((s,i)=>label((b.x0+b.x1)/2,(b.z0+b.z1)/2+(i-(lines.length-1)/2)*2.5,s,r.kind==='housekeeping'?9:11)).join('');}
function deckSVG(d){
 const clip='<defs><clipPath id="deck-floor">'+poly(d.slab.outline,'white')+'</clipPath></defs>';
 const p=[clip,'<rect width="'+W+'" height="'+H+'" fill="'+C.page+'"/>',poly(d.slab.outline,C.plate,'#354553',2)];
 p.push('<g clip-path="url(#deck-floor)">');for(const zone of d.programme.zones.slice().reverse()){p.push(poly(zone.polygon,zone.category==='terrace'?'#b9cc9c':zone.category==='corridor'?'#efd49a':'#ddd9cf'));}p.push('</g>');
 if(d.atrium)p.push(poly(d.atrium.outline,d.number===6?'#b4d592':C.void,'#4386ac',1.8,'stroke-dasharray="7 5"'));
 p.push('<g clip-path="url(#deck-floor)">');for(const o of d.slab.holes.filter(o=>o.id!=='atrium'))p.push(poly(o.polygon,C.void,'#839aae',.6));p.push('</g>');
 for(const ramp of L.circulation.ramps.filter(r=>r.deck===d.number))p.push(poly(ramp.polygon,'#ead2a2','#a88953',.7));
 for(const c of d.corridors)p.push(path(c.points,C.corr,Math.max(.8,c.width*S), 'stroke-linejoin="round"'));
 for(const b of L.circulation.bridges.filter(b=>b.deck===d.number))p.push(poly(b.polygon,'#c5d4de','#537d99',1));
 for(const b of L.circulation.towers.filter(b=>b.deck===d.number))p.push(poly(b.polygon,'#f1f5f5','#537d99',1));
 const rs=L.rooms.filter(r=>!r.aggregate&&r.y<=d.y+2.1&&r.y+r.height>d.y+.1);
 for(const source of rs){const r={...source,polygon:source.envelope?.find(s=>d.y-source.y>=s.rise-1e-7&&d.y-source.y<s.rise+s.height)?.polygon??source.polygon};const color=r.kind==='garden'?C.garden:r.deck===20?C.cmd:r.deck===5?C.medical:C.room;p.push(poly(r.polygon,color,r.status==='unfitted'?'#d33':'#fff',r.status==='unfitted'?3:1));if(r.deck!==d.number&&r.components)for(const g of [...r.components.galleries,...r.components.links,...r.components.landings].filter(g=>Math.abs(g.center[1]-d.y)<.2))p.push(poly(g.polygon,'#b8d4a7','#4c7e4f',.6));}
 for(const r of rs.filter(r=>r.components)){
  for(const g of r.components.galleries.filter(g=>Math.abs(g.center[1]-d.y)<.2))p.push(poly(g.polygon,'#bfd3a2','#6d8d62',.6));
  for(const f of r.components.pieces.filter(f=>f.center[1]<=d.y+2.1&&f.center[1]+f.size[1]>d.y+.1)){p.push(poly(f.polygon,'none','#365e4c',.8));if(d.number===17&&f.name!=='glossy floor')p.push(label(f.center[0],f.center[2],f.name,8,'#234838'));}
  for(const t of r.components.stairs)if(t.center[1]>=d.y&&t.center[1]<d.y+4)p.push(poly([[t.center[0]-1.5,t.center[2]-.15],[t.center[0]+1.5,t.center[2]-.15],[t.center[0]+1.5,t.center[2]+.15],[t.center[0]-1.5,t.center[2]+.15]],'#d5dfc2','#64815c',.3));
 }
 for(const c of L.cabins.filter(c=>c.deck===d.number))p.push(poly(c.polygon,c.view==='space'?C.space:C.atrium,'#fff',.6));
 for(const c of L.shuttles.filter(c=>c.deck===d.number)){
  p.push(poly(c.polygon,C.shuttle,C.door,1.4));for(const s of c.seats)p.push('<circle cx="'+X(s.center[0])+'" cy="'+Z(s.center[2])+'" r="1" fill="#d7e5eb"/>');p.push(path(c.door.corners.slice(0,2).map(p=>[p[0],p[2]]),C.door,4));
 }
 for(const s of [...d.openings,...L.circulation.stairs.filter(s=>s.deck===d.number)])p.push(poly(s.polygon,s.kind==='lift'?C.shaft:'#916d49','#fff',.6));
 for(const w of L.windows.filter(w=>w.deck===d.number))p.push(path(w.corners.slice(0,2).map(p=>[p[0],p[2]]),C.window,w.kind==='cabin'?2:3));
 for(const source of rs){const r={...source,polygon:source.envelope?.find(s=>d.y-source.y>=s.rise-1e-7&&d.y-source.y<s.rise+s.height)?.polygon??source.polygon};if(r.kind!=='garden'||d.number!==17)p.push(roomLabel(r));if(r.door&&r.deck===d.number)p.push('<circle cx="'+X(r.door.center[0])+'" cy="'+Z(r.door.center[2])+'" r="2.4" fill="#8f5037"/>');}
 p.push(path([...d.roomLine.outline,d.roomLine.outline[0]],'#a96756',.8,'stroke-dasharray="5 5"'));
 const stats=L.summary.perDeck[d.number-1];
 p.push('<text x="30" y="42" font-family="Segoe UI,Arial" font-size="30" font-weight="700">Deck '+d.number+' · '+esc(d.name)+'</text>');
 p.push('<text x="30" y="78" font-family="Segoe UI,Arial" font-size="18">'+(stats.cabins?stats.cabins+' cabins · '+stats.twins+' twins + '+stats.singles+' singles · '+stats.berths+' berths':stats.rooms+' room records')+' · physical coordinates · faired full-height fit · option C candidate</text>');
 if(d.atrium){p.push(label(5,0,(d.number===6?'ATRIUM FLOOR':'ATRIUM VOID')+' · '+d.atrium.widthMid.toFixed(2)+' m at x=0',15,'#275c7c'));p.push('<text x="30" y="111" font-family="Segoe UI,Arial" font-size="16" fill="#805244">Downward nesting; upper funnel step ≤10 m per side. Clear midships width: '+(d.atrium.roomFitWidthMid??d.atrium.widthMid).toFixed(2)+' m.</text>');}
 for(const zone of d.programme.zones.filter(z=>z.category==='terrace'&&z.id!=='atrium-floor')){const b=bounds(zone.polygon),x=(b.x0+b.x1)/2;const q=zone.polygon.filter(p=>Math.abs(p[0]-x)<.6),z=q.length?q.reduce((s,p)=>s+p[1],0)/q.length:(b.z0+b.z1)/2;p.push(label(x,z,zone.name,10,'#435b34'));}
 for(let x=-250;x<=250;x+=50)p.push(label(x,-99,x+' m',12,'#76808b'));
 const legend=[['Space cabin',C.space],['Atrium cabin',C.atrium],['Corridor',C.corr],['Public / service room',C.room],['Garden',C.garden],['Void',C.void],['Hull aperture',C.window]];
 legend.forEach(([s,c],i)=>p.push('<rect x="'+(30+i*355)+'" y="1087" width="22" height="16" fill="'+c+'"/>'+'<text x="'+(62+i*355)+'" y="1100" font-family="Segoe UI,Arial" font-size="15">'+s+'</text>'));
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'">'+p.join('')+'</svg>';
}
function sectionSVG(){
 const h=hullV2(),w=1260,height=1180,scale=9,xx=z=>630+z*5.7,yy=y=>100+(53-y)*scale,parts=['<rect width="'+w+'" height="'+height+'" fill="'+C.page+'"/>'];
 const edge=[];for(let y=-54;y<=52.5;y+=.25){const half=h.skin(0,y);if(half>0)edge.push([-half,y]);}const shell=[...edge,...edge.slice().reverse().map(([z,y])=>[-z,y])];
 parts.push('<polygon points="'+shell.map(([z,y])=>xx(z)+','+yy(y)).join(' ')+'" fill="'+C.plate+'" stroke="#354553" stroke-width="3"/>');
 const rect=(a,b,y0,y1,c)=>'<rect x="'+xx(a)+'" y="'+yy(y1)+'" width="'+((b-a)*5.7)+'" height="'+((y1-y0)*scale)+'" fill="'+c+'"/>';
 const intervals=p=>{const z=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a[0]<=0&&b[0]>0)||(b[0]<=0&&a[0]>0))z.push(a[1]+(b[1]-a[1])*(-a[0])/(b[0]-a[0]));}return z.sort((a,b)=>a-b);};
 for(const r of [...L.rooms.filter(r=>!r.aggregate),...L.cabins])for(const section of r.envelope??[{rise:0,height:r.height,polygon:r.polygon}]){const zs=intervals(section.polygon);for(let i=1;i<zs.length;i+=2)parts.push(rect(zs[i-1],zs[i],r.y+section.rise,r.y+section.rise+section.height,r.row?r.view==='space'?C.space:C.atrium:r.kind==='garden'?C.garden:r.deck===20?C.cmd:C.room));}
 for(const d of L.decks){const half=h.roomHalf(0,d.y,0),v=d.atrium?.widthMid/2??0;if(v&&d.number>6)parts.push(rect(-v,v,d.y,d.y+4,C.void));let spans=[[-half,half]];for(const hole of d.slab.holes){const zs=intervals(hole.polygon);for(let k=1;k<zs.length;k+=2){const a=zs[k-1],b=zs[k];spans=spans.flatMap(([l,r])=>r<=a||l>=b?[[l,r]]:[...(l<a?[[l,a]]:[]),...(r>b?[[b,r]]:[])]);}}for(const r of L.rooms.filter(r=>r.components))for(const g of r.components.galleries.filter(g=>Math.abs(g.center[1]-d.y)<.2)){const z=intervals(g.polygon);for(let k=1;k<z.length;k+=2)spans.push([z[k-1],z[k]]);}for(const [a,b]of spans)parts.push('<line x1="'+xx(a)+'" y1="'+yy(d.y)+'" x2="'+xx(b)+'" y2="'+yy(d.y)+'" stroke="#4e5d67" stroke-width="2"/>');parts.push('<text x="35" y="'+yy(d.y+1.2)+'" font-family="Segoe UI,Arial" font-size="16">D'+d.number+'</text>');}
 parts.push('<text x="30" y="40" font-family="Segoe UI,Arial" font-size="27" font-weight="700">Midships section · x = 0 · looking forward</text><text x="30" y="75" font-family="Segoe UI,Arial" font-size="17">Finished loft; nested atrium 40 m on D16–19, 28 m on D20 · sectioned room envelopes shown</text>');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+height+'">'+parts.join('')+'</svg>';
}
const arg=process.argv.indexOf('--deck'),decks=arg>=0?L.decks.filter(d=>d.number===+process.argv[arg+1]):L.decks;
for(const d of decks){const name='deck-'+String(d.number).padStart(2,'0'),svg=deckSVG(d);await fs.writeFile(new URL(name+'.svg',out),svg);await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL(name+'.png',out)));console.log('rendered',name);}
const section=sectionSVG();await fs.writeFile(new URL('section.svg',out),section);await sharp(Buffer.from(section)).png().toFile(fileURLToPath(new URL('section.png',out)));
await fs.writeFile(new URL('summary.json',out),JSON.stringify({summary:L.summary,upperFits:L.rooms.filter(r=>r.deck>=16).map(({id,deck,frame,size,area,reason,shape,movedPieces,components})=>({id,deck,frame,size,area,reason,shape,movedPieces,pieces:components?.pieces})),atrium:L.decks.filter(d=>d.atrium).map(d=>({deck:d.number,width:d.atrium.widthMid,roomFitCap:d.atrium.roomFitWidthMid})),bays:L.shuttles.map(({id,deck,bay,bayCenter,originalBayCenter,center,yaw,movedReason})=>({id,deck,bay,bayCenter,originalBayCenter,center,yaw,movedReason}))},null,2));
await fs.writeFile(new URL('index.html',out),'<!doctype html><meta charset="utf-8"><title>LEO v2 plan review</title><style>body{font:16px system-ui;background:#f6f3ec;margin:24px}img{display:block;width:100%;margin:22px 0;border:1px solid #ccc}a{margin-right:12px}</style><h1>LEO v2 plan review</h1><p>Revised option C candidate: wide residential atrium, programmed upper terraces and sloped hull-facing gardens. No viewer cutover or release.</p>'+L.decks.map(d=>'<a href="#d'+d.number+'">D'+d.number+'</a>').join('')+'<img src="section.png">'+L.decks.map(d=>'<div id="d'+d.number+'"><img src="deck-'+String(d.number).padStart(2,'0')+'.png"></div>').join(''));
console.log('review output/plan-v2/index.html');
