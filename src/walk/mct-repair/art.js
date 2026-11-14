const rect=(x,y,w,h,c='#5f6b73')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c}"/>`;
const line=(points,c='#9aa6ab',w=4)=>`<polyline points="${points}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const ring=(x,y,r,c='#9aa6ab',w=4)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
const wheel=(x,y,r)=>circle(x,y,r,'#1c2023')+circle(x,y,r*.48,'#3f6d72')+circle(x,y,r*.17,'#9aa6ab');
const svg=(body,box='0 0 64 64')=>`<svg viewBox="${box}" aria-hidden="true">${body}</svg>`;
export const PART_SPOTS={front:{bumper:[50,73],hood:[48,43],steer:[49,23],ecu:[62,50],pedals:[32,62],steerrack:[52,67],fan:[36,47],cluster:[61,33],radiator:[38,57],mastercyl:[40,64],winch:[51,55],skidplate:[50,79]},side:{wheel:[22,72],skirt:[43,66],fender:[76,62],pump:[61,51],brake:[75,74],coilover:[24,59],mirror:[32,37],reservoir:[41,46],fluidfilter:[56,60],hose:[57,45],snorkel:[34,28],leafspring:[68,74]},rear:{lights:[65,55],axle:[49,71],motor:[48,50],harness:[57,44],fusebox:[39,49],hitch:[50,80],compressor:[64,50],valves:[60,61],moisture:[37,61],latch:[58,68],triangle:[38,49],barrier:[50,31],tailgate:[49,63],auxbattery:[61,66]},top:{cage:[50,64],seat:[50,53],battery:[65,41],relay:[59,45],swheel:[50,40],strobe:[50,23],anchor:[41,75]}};
const teeth=()=>Array.from({length:7},(_,i)=>line(`${14+i*6},22 ${14+i*6},44`,'#22292d',2)).join('');
const battery=(color='#19c4b6')=>rect(8,20,48,30)+rect(15,14,9,6,'#9aa6ab')+rect(40,14,9,6,'#9aa6ab')+line('31,25 25,35 34,35 30,44',color,3);
const coil=()=>line('27,8 37,15 23,22 41,29 23,36 41,43 27,50 37,57','#e8782c',4);
const board=()=>rect(9,14,46,38,'#285e64')+rect(23,23,18,19,'#22292d')+teeth();
const fittings={
 wheel:()=>wheel(32,32,26),cage:()=>line('12,53 12,12 52,12 52,53','#e8782c',6)+line('12,45 24,53 40,53 52,45','#e8782c'),
 steer:()=>ring(32,20,14)+line('32,20 32,40')+rect(8,41,48,10)+rect(16,44,16,3,'#19c4b6'),
 seat:()=>rect(14,9,17,36,'#8a9399')+rect(14,39,40,13,'#8a9399')+rect(18,52,8,6,'#22292d'),
 bumper:()=>rect(5,27,54,12,'#22292d')+rect(11,28,12,6,'#fff4dc')+rect(41,28,12,6,'#fff4dc'),
 lights:()=>rect(6,22,52,14,'#22292d')+rect(10,25,10,7,'#b02020')+rect(44,25,10,7,'#b02020')+rect(12,40,40,7,'#9aa6ab'),
 skirt:()=>rect(5,24,54,19)+rect(9,39,46,4,'#19c4b6')+line('9,29 55,29','#e8782c',2),
 hood:()=>line('7,41 18,20 49,20 57,41 7,41','#77838c',7)+line('19,24 46,24','#19c4b6',3),
 fender:()=>line('8,45 8,27 19,18 46,18 57,28 57,45','#5f6b73',10),battery:()=>battery(),
 harness:()=>line('10,13 25,24 25,40 49,52','#e8782c')+line('25,24 53,13','#19c4b6')+line('25,40 10,53')+rect(5,7,10,10)+rect(48,7,10,10)+rect(44,49,12,9),
 relay:()=>rect(15,12,34,32,'#22292d')+line('22,44 22,54 42,54 42,44')+rect(22,20,20,9,'#e8782c'),
 pump:()=>rect(12,27,38,24)+circle(31,27,15,'#9aa6ab')+line('48,32 57,32 57,19','#e8782c'),
 motor:()=>rect(12,18,40,32)+circle(12,34,10,'#3f6d72')+rect(48,29,12,10,'#9aa6ab')+teeth(),
 axle:()=>line('8,32 56,32','#9aa6ab',8)+circle(32,32,14,'#5f6b73')+rect(5,18,7,28,'#22292d')+rect(52,18,7,28,'#22292d'),
 swheel:()=>ring(32,32,24,'#22292d',7)+line('12,20 32,32 52,20')+line('32,32 32,54'),
 brake:()=>circle(30,32,23,'#9aa6ab')+ring(30,32,13,'#5f6b73')+rect(43,18,14,30,'#e8782c'),ecu:board,
 coilover:()=>line('32,5 32,59')+coil(),steerrack:()=>line('5,33 59,33','#9aa6ab',7)+rect(20,24,25,18)+line('33,24 33,11'),
 fusebox:()=>rect(8,13,48,40,'#22292d')+[0,1,2,3,4,5].map(i=>rect(15+i%3*13,21+Math.floor(i/3)*15,8,9,i%2?'#e8782c':'#19c4b6')).join(''),
 fan:()=>ring(32,32,26)+[0,1,2,3].map(i=>`<g transform="rotate(${i*90} 32 32)">${rect(29,9,15,23,'#22292d')}</g>`).join('')+circle(32,32,7,'#19c4b6'),
 pedals:()=>line('20,12 20,46 42,46 42,12')+rect(10,8,18,21,'#22292d')+rect(34,8,18,21,'#22292d'),
 strobe:()=>rect(13,46,38,7)+rect(19,16,26,29,'#ff9a32')+line('7,16 12,20 9,8','#e8782c',2),
 mirror:()=>line('14,53 14,19 29,19')+rect(27,9,27,24,'#9aa6ab')+rect(30,12,21,18,'#3f6d72'),
 cluster:()=>rect(5,20,54,27,'#22292d')+ring(21,33,9,'#19c4b6',2)+ring(43,33,9,'#19c4b6',2)+line('21,33 25,27 43,33 46,28','#fff4dc',2),
 hitch:()=>rect(10,23,20,18)+line('28,31 48,31 48,48 35,48 35,39','#9aa6ab',7),
 reservoir:()=>rect(16,18,32,36,'#bbc8c8')+rect(23,10,18,8,'#22292d')+rect(19,35,26,16,'#19c4b6'),
 compressor:()=>rect(8,31,47,20)+rect(14,14,27,17)+line('44,15 52,15 52,31')+teeth(),
 fluidfilter:()=>rect(20,14,24,39,'#9aa6ab')+rect(17,12,30,7,'#e8782c')+line('32,5 32,12 32,53 32,60'),
 radiator:()=>rect(7,13,50,38)+teeth()+line('7,13 57,13 57,51 7,51 7,13','#9aa6ab',3),
 valves:()=>rect(8,29,48,15)+[16,32,48].map(x=>line(`${x},29 ${x},16`)+circle(x,14,5,'#e8782c')).join(''),
 hose:()=>line('8,50 8,22 20,13 44,13 56,24 56,49','#22292d',11)+line('8,48 8,52 56,48 56,52','#9aa6ab',12),
 mastercyl:()=>rect(10,30,43,14)+rect(21,17,27,13,'#bbc8c8')+line('8,27 8,48 53,37 60,37'),
 moisture:()=>rect(19,22,26,31,'#3f6d72')+rect(13,14,38,9)+line('32,5 32,14 32,53 32,60'),
 latch:()=>rect(10,24,21,25)+coil()+line('40,48 53,48 53,33'),anchor:()=>ring(32,25,18)+rect(17,44,30,10),
 snorkel:()=>line('16,55 16,17 46,17','#22292d',12)+rect(41,9,16,16),
 winch:()=>rect(7,20,50,28)+rect(18,23,28,22,'#22292d')+teeth()+line('45,45 50,55 58,55','#e8782c',3),
 skidplate:()=>line('7,18 57,18 50,48 14,48 7,18','#9aa6ab',7)+line('20,26 19,40 32,26 32,40 44,26 45,40','#22292d',3),
 triangle:()=>line('32,7 59,53 5,53 32,7','#e8782c',6)+line('32,24 32,36','#fff4dc',4)+circle(32,44,2,'#fff4dc'),
 barrier:()=>rect(5,14,54,38,'#5f6b73')+line('9,19 55,47 55,19 9,47','#22292d',4),
 leafspring:()=>[0,1,2].map(i=>line(`8,${19+i*7} 23,${29+i*7} 41,${29+i*7} 56,${19+i*7}`,'#9aa6ab',3)).join(''),
 tailgate:()=>rect(8,20,48,26)+line('15,20 15,47 49,47 49,20','#9aa6ab',3)+rect(26,27,12,6,'#22292d'),auxbattery:()=>battery('#e8782c'),
};
// Bench debris has its own silhouettes, distinct from the named replacement parts.
export function partArt(id){
 const draw=fittings[id];if(draw)return svg(draw());
 let n=0;for(const c of id)n+=c.charCodeAt(0);
 const shapes=[()=>line('12,13 26,27 26,50 38,50 38,27 52,13','#9aa6ab',7),()=>ring(32,32,19,'#9aa6ab',9)+ring(32,32,7,'#22292d'),()=>rect(12,16,40,34,'#a28c67')+line('32,16 32,50','#22292d',3),()=>coil(),()=>line('9,48 16,16 48,40 54,12','#e8782c',6),()=>line('9,44 24,14 55,24 43,51 9,44','#5f6b73',9)];
 return svg(shapes[n%shapes.length]());
}
export function cartArt(view){
 let drawing='';
 if(view==='side'){
  drawing=rect(42,139,372,13,'#22292d')+rect(51,103,100,42)+line('51,103 75,77 144,88 151,103','#5f6b73',9)+rect(144,128,132,19)+rect(278,113,117,33)+rect(304,88,84,12,'#8a9399')+rect(302,63,11,36,'#8a9399')+rect(214,80,12,43,'#8a9399')+rect(182,118,44,12,'#8a9399')+line('247,130 247,27 267,27 277,29 277,127','#e8782c',7)+line('248,83 293,128','#e8782c',4)+line('168,123 154,90','#9aa6ab',3)+line('144,85 166,89','#22292d',6)+wheel(101,151,30)+wheel(352,151,30)+rect(54,98,25,7,'#fff4dc')+rect(141,132,38,4,'#19c4b6')+rect(69,118,44,12,'#d9dee0');
 }else if(view==='top'){
  drawing=rect(124,19,212,167,'#22292d')+rect(133,28,194,43)+rect(137,74,186,65,'#3a4247')+rect(133,143,194,34)+rect(204,92,52,36,'#8a9399')+rect(157,148,147,21,'#8a9399')+line('142,133 318,133','#e8782c',7)+ring(230,84,14,'#9aa6ab',3)+rect(151,38,158,5,'#19c4b6');
  for(const x of [114,328])for(const y of [36,149])drawing+=rect(x,y,18,31,'#1c2023');
 }else{
  drawing=line('146,133 146,28 314,28 314,133','#e8782c',7)+rect(130,93,200,60)+rect(142,145,176,13,'#22292d')+rect(116,118,19,58,'#1c2023')+rect(325,118,19,58,'#1c2023');
  if(view==='front')drawing+=line('143,95 162,76 298,76 317,95','#5f6b73',12)+rect(163,107,29,9,'#fff4dc')+rect(268,107,29,9,'#fff4dc')+rect(166,83,128,5,'#19c4b6')+rect(209,127,42,13,'#d9dee0');
  else drawing+=rect(156,70,148,30,'#8a9399')+rect(152,112,18,7,'#b02020')+rect(290,112,18,7,'#b02020')+rect(157,150,146,8,'#9aa6ab')+rect(179,128,102,3,'#19c4b6');
 }
 return `<svg viewBox="0 0 460 210" role="img" aria-label="MCT ${view} view: grey utility cart with orange roll hoop, dark wheels and teal lights">${drawing}<text x="230" y="203" text-anchor="middle" fill="#9cbdc9" font-size="11" font-family="monospace">MARS CAT TRANSPORTER · ${view.toUpperCase()}</text></svg>`;
}
