import fs from'node:fs/promises';import{createCanvas}from'@napi-rs/canvas';import{ATRIUM_ZONES}from'../src/plan/atrium-v2.js';
const L=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json')),c=createCanvas(1600,840),g=c.getContext('2d');g.fillStyle='#102331';g.fillRect(0,0,1600,840);g.fillStyle='#f5eee1';g.font='bold 32px sans-serif';g.fillText('LEO · Deck 6 atrium / stage-1 plan',42,48);g.font='18px sans-serif';g.fillStyle='#b9d2d9';g.fillText('A continuous floor, five places, open routes and an uninterrupted view up to the sky ceiling.',42,80);
const X=x=>100+(x+140)*3.3,Z=z=>420+z*3.3;
function poly(p,fill,stroke){g.beginPath();p.forEach(([x,z],i)=>i?g.lineTo(X(x),Z(z)):g.moveTo(X(x),Z(z)));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}}
poly(L.decks[5].atrium.outline,'#e9dfcf','#9ebac3');
const colours={park:'#789974',lake:'#71aeb3',food:'#d6bea0',stage:'#b6b8b0',lobby:'#dacdb8'};
for(const a of ATRIUM_ZONES){poly(a.polygon,colours[a.kind||a.id?.split('-').at(-1)]||'#c7c1ac','#fff6');const b=a.bounds||[Math.min(...a.polygon.map(p=>p[0])),Math.max(...a.polygon.map(p=>p[0])),Math.min(...a.polygon.map(p=>p[1])),Math.max(...a.polygon.map(p=>p[1]))];g.fillStyle='#18333e';g.font='bold 19px sans-serif';g.fillText(a.label||a.name||a.id,X(b[0]+2),Z(b[2]+5));}
g.strokeStyle='#f9fcff';g.lineWidth=4;g.setLineDash([12,8]);g.beginPath();g.moveTo(X(-122),Z(0));g.lineTo(X(124),Z(0));g.moveTo(X(140),Z(0));g.lineTo(X(236),Z(0));g.moveTo(X(2),Z(-34));g.lineTo(X(2),Z(34));g.moveTo(X(-79),Z(-34));g.lineTo(X(-79),Z(34));g.stroke();g.setLineDash([]);
g.fillStyle='#b58353';g.fillRect(X(40.5),Z(-33),3*3.3,26*3.3);
for(const x of[-66,-48,-28,-10])for(const z of[-27,-17]){g.beginPath();g.arc(X(x),Z(z),10,0,Math.PI*2);g.fillStyle='#3d6549';g.fill();}
for(const x of[-28,-10,8,26])for(const z of[12,19,26]){g.fillStyle='#8d6645';g.fillRect(X(x)-7,Z(z)-5,14,10);g.fillStyle='#368686';for(const[dx,dz]of[[0,-1.02],[0,1.02],[-1.15,0],[1.15,0]])g.fillRect(X(x+dx)-3,Z(z+dz)-3,6,6);}
for(const x of[-25,-7,11,29]){g.fillStyle='#8d6645';g.fillRect(X(x-4),Z(30),8*3.3,3.3);g.fillStyle='#526472';g.fillRect(X(x-4),Z(31.7),8*3.3,2.6);}
g.fillStyle='#9d7953';g.fillRect(X(94),Z(16),14*3.3,18*3.3);for(const x of[70,75,80,85])for(const z of[15,18.3,21.6,24.9,28.2,31.5]){g.fillStyle='#368686';g.fillRect(X(x)-3,Z(z)-3,6,6);}
g.fillStyle='#d1b28d';g.fillRect(X(-110),Z(-7.5),6*3.3,3.3);
g.strokeStyle='#55cfe3';g.lineWidth=3;g.strokeRect(X(127.8),Z(-9),8.4*3.3,18*3.3);g.fillStyle='#18333e';g.font='16px sans-serif';g.fillText('Existing lift tower',X(139),Z(-8));g.fillText('Bow café / D6',X(214),Z(12));
g.fillStyle='#f5eee1';g.font='bold 20px sans-serif';g.fillText('KEY',42,690);g.font='18px sans-serif';for(const[t,i]of['White dash: unobstructed boulevard and cross routes','Teal: seats · green: trees · timber: counters and stage','Lake: 0.16 m recess; shallow edge and a supported 3 m bridge','Prototype café: Deck 10, nose-commons-05; ten locations in PLAN.md'].map((t,i)=>[t,i]))g.fillText(t,42,722+i*27);
g.fillStyle='#b9d2d9';g.font='16px sans-serif';g.fillText('Plan coordinates in metres. +x / bow →     +z / starboard ↓',900,786);g.fillText('Stage 1: zones block out; park + food hall dressed.',900,812);
await fs.mkdir('output/phase6',{recursive:true});await fs.writeFile('output/phase6/floor-plan.png',c.toBuffer('image/png'));console.log('Floor plan saved');
