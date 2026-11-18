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
 coilover:()=>ring(32,6,4)+ring(32,58,4)+rect(28,13,8,38,'#5f6b73')+line('25,16 39,21 25,26 39,31 25,36 39,41 25,46','#e8782c',4),
 steerrack:()=>line('7,35 57,35','#9aa6ab',5)+rect(21,28,22,14)+[12,45].map(x=>rect(x,27,8,16,'#22292d')+[0,3,6].map(d=>line(`${x+d},28 ${x+d},42`,'#9aa6ab',1)).join('')).join('')+ring(5,35,3)+ring(59,35,3)+line('33,28 39,12','#9aa6ab',5),
 fusebox:()=>rect(6,10,52,46,'#22292d')+[0,1,2,3,4,5].map(i=>rect(11+i%3*9,16+Math.floor(i/3)*17,6,11,['#b02020','#e8782c','#19c4b6'][i%3])).join('')+rect(41,16,12,14)+rect(41,36,12,14),
 fan:()=>rect(5,5,54,54)+circle(32,32,23,'#1c2023')+[0,1,2,3].map(i=>`<g transform="rotate(${i*90} 32 32)">${rect(29,12,12,21,'#9aa6ab')}</g>`).join('')+circle(32,32,6,'#19c4b6'),
 pedals:()=>rect(10,9,44,7)+line('21,16 21,41 17,46')+line('43,16 43,39 47,45')+rect(9,43,17,14,'#22292d')+rect(38,42,17,14,'#22292d')+line('13,48 22,48 22,52 13,52','#9aa6ab',2),
 strobe:()=>rect(5,40,54,8)+rect(7,24,50,16,'#e8782c')+[16,32,48].map(x=>rect(x-5,27,10,10,'#ff9a32')).join(''),
 mirror:()=>rect(7,45,13,13)+line('14,50 22,25 32,25')+rect(29,9,28,30,'#9aa6ab')+rect(32,12,22,24,'#3f6d72')+line('35,27 48,16','#bbc8c8',2),
 cluster:()=>rect(5,16,54,34,'#5f6b73')+rect(9,20,46,26,'#22292d')+'<text x="13" y="35" fill="#fff4dc" font-size="14" font-family="monospace">42</text>'+rect(39,25,11,3,'#19c4b6')+rect(39,32,8,3,'#e8782c')+rect(13,40,37,2,'#19c4b6'),
 hitch:()=>rect(12,8,40,18)+[18,46].map(x=>circle(x,17,3,'#22292d')).join('')+line('32,25 32,34 44,40 41,53 26,56 20,45 26,38','#9aa6ab',7),
 reservoir:()=>rect(16,18,32,36,'#bbc8c8')+rect(23,10,18,8,'#22292d')+rect(19,35,26,16,'#e8782c')+line('23,25 23,31','#fff4dc',2),
 compressor:()=>'<rect x="6" y="26" width="52" height="24" rx="12" fill="#5f6b73"/>'+rect(13,49,8,7,'#22292d')+rect(43,49,8,7,'#22292d')+line('32,26 32,20')+circle(32,14,9,'#9aa6ab')+circle(32,14,6,'#22292d')+line('32,14 35,10','#e8782c',2),
 fluidfilter:()=>rect(18,18,28,36,'#b02020')+rect(16,10,32,12,'#22292d')+[21,28,35,42].map(x=>line(`${x},12 ${x},19`,'#9aa6ab',2)).join('')+rect(23,32,18,6,'#e8782c'),
 radiator:()=>rect(7,10,50,44,'#22292d')+[17,23,29,35,41,47].map(y=>line(`13,${y} 51,${y}`,'#9aa6ab',3)).join('')+line('8,11 56,11 56,53 8,53 8,11','#5f6b73',5),
 valves:()=>rect(8,30,48,22)+[16,32,48].map(x=>line(`${x},30 ${x},20`)+circle(x,16,5,'#e8782c')+circle(x,42,3,'#19c4b6')).join(''),
 hose:()=>'<path d="M10 48 V32 C10 6 54 6 54 32 V48" fill="none" stroke="#22292d" stroke-width="10"/>'+[10,54].map(x=>rect(x-6,45,12,11,'#9aa6ab')+line(`${x-5},49 ${x+5},49`,'#5f6b73',2)).join(''),
 mastercyl:()=>rect(9,32,46,15)+rect(6,28,6,23,'#9aa6ab')+[17,38].map(x=>rect(x,18,14,15,'#bbc8c8')+rect(x-1,14,16,5,'#22292d')).join('')+line('55,39 60,39','#9aa6ab',4),
 moisture:()=>'<rect x="19" y="23" width="26" height="31" rx="9" fill="#bbc8c8" fill-opacity=".25" stroke="#9aa6ab" stroke-width="2"/>'+rect(23,43,18,8,'#3f6d72')+rect(15,14,34,10,'#e8782c')+line('7,19 15,19 49,19 57,19','#9aa6ab',6)+line('25,28 25,37','#fff4dc',2),
 latch:()=>rect(6,20,36,28)+line('10,34 48,34','#9aa6ab',5)+line('17,28 20,40 24,28 28,40 32,28','#22292d',2)+ring(53,34,7,'#e8782c',4),
 anchor:()=>rect(14,25,36,36)+[20,44].map(x=>circle(x,54,2,'#22292d')).join('')+ring(32,24,16,'#9aa6ab',6),
 snorkel:()=>rect(14,49,30,9)+line('27,49 27,16','#22292d',11)+line('17,16 17,10 41,10 45,19','#5f6b73',7),
 winch:()=>rect(5,16,54,5)+rect(5,45,54,7)+rect(7,20,7,25)+rect(17,22,27,22,'#22292d')+[20,25,30,35,40].map(x=>line(`${x},24 ${x},42`,'#9aa6ab',2)).join('')+rect(46,23,12,20,'#e8782c')+line('34,44 34,56 42,56','#9aa6ab',3),
 skidplate:()=>rect(7,15,50,35,'#9aa6ab')+[22,32,42].map(x=>line(`${x},24 ${x},41`,'#5f6b73',3)).join('')+[13,51].map(x=>[21,44].map(y=>circle(x,y,2,'#22292d')).join('')).join(''),
 triangle:()=>line('32,7 59,53 5,53 32,7','#b02020',6),
 barrier:()=>rect(7,7,50,50,'#22292d')+[16,24,32,40,48].map(n=>line(`${n},10 ${n},54`,'#9aa6ab',1.5)+line(`10,${n} 54,${n}`,'#9aa6ab',1.5)).join('')+line('8,8 56,8 56,56 8,56 8,8','#5f6b73',4),
 leafspring:()=>[0,1,2].map(i=>`<path d="M${9+i*5} ${25+i*4} Q32 ${47+i*3} ${55-i*5} ${25+i*4}" fill="none" stroke="#9aa6ab" stroke-width="3"/>`).join('')+ring(7,24,4)+ring(57,24,4)+rect(28,31,8,17,'#5f6b73'),
 tailgate:()=>rect(7,19,50,28)+[15,49].map(x=>circle(x,33,4,'#22292d')).join('')+rect(25,24,14,18,'#9aa6ab')+rect(29,27,14,8,'#22292d'),
 auxbattery:()=>rect(8,20,48,33,'#22292d')+rect(14,13,10,8,'#b02020')+rect(40,13,10,8,'#9aa6ab')+rect(19,31,26,13,'#e8782c')+line('23,37 28,37 25,34 25,40','#fff4dc',1.5),
};
const paw=(x,y,c)=>circle(x,y,6,c)+circle(x-8,y-8,3,c)+circle(x,y-11,3,c)+circle(x+8,y-8,3,c);
const debris={
 chargeplug:()=>'<path d="M44 43 C8 64 2 27 22 23 C37 20 38 34 28 38" fill="none" stroke="#19c4b6" stroke-width="6"/>'+line('28,38 37,33','#19c4b6',6)+rect(35,21,17,17,'#22292d')+line('40,21 40,12')+line('48,21 48,12'),
 extinguisher:()=>rect(20,16,24,42,'#b02020')+rect(25,8,14,9,'#22292d')+line('28,8 43,8','#9aa6ab',3)+rect(23,31,18,13,'#fff4dc')+line('39,16 50,20 50,44 55,49','#22292d',5),
 floorjack:()=>wheel(18,51,7)+wheel(48,51,5)+line('10,44 50,44','#9aa6ab',9)+line('23,41 39,29 48,29','#5f6b73',7)+rect(38,24,17,5,'#22292d')+line('14,42 9,12','#e8782c',5),
 lugwrench:()=>line('12,12 52,52','#9aa6ab',7)+line('12,52 52,12','#9aa6ab',7)+[12,52].map(x=>[12,52].map(y=>circle(x,y,5,'#5f6b73')+circle(x,y,2,'#22292d')).join('')).join(''),
 toolbox:()=>line('23,21 23,12 41,12 41,21','#9aa6ab',5)+rect(7,21,50,34)+rect(7,21,50,11,'#8a9399')+line('9,33 55,33','#22292d',2)+[17,42].map(x=>rect(x,28,6,11,'#e8782c')).join(''),
 cone:()=>rect(6,51,52,7,'#22292d')+'<path d="M16 51 L28 8 H36 L48 51Z" fill="#e8782c"/><path d="M22 29 H42 L45 40 H19Z" fill="#fff4dc"/>',
 towhook:()=>ring(32,13,7,'#9aa6ab',7)+'<path d="M32 20 V34 C12 28 11 54 30 56 C44 58 52 49 47 37" fill="none" stroke="#9aa6ab" stroke-width="9" stroke-linecap="round"/>',
 diagscanner:()=>'<path d="M34 11 C34 1 56 5 54 17" fill="none" stroke="#22292d" stroke-width="4"/>'+'<path d="M18 12 H46 L42 55 H22Z" fill="#5f6b73"/>'+rect(23,18,18,17,'#19c4b6')+line('26,29 29,25 32,28 38,22','#285e64',2)+circle(27,43,3,'#e8782c')+circle(37,43,3,'#22292d'),
 ratchetstrap:()=>line('7,14 20,14 20,50 56,50','#e8782c',8)+rect(16,24,29,19,'#9aa6ab')+rect(22,28,17,11,'#22292d')+line('31,32 50,16 55,21','#5f6b73',5),
 laser:()=>'<path d="M42 19 L62 1 L55 25Z" fill="#ec71b8" fill-opacity=".18"/>'+line('13,51 42,22','#9aa6ab',10)+line('36,28 42,22','#ec71b8',10)+circle(23,40,2,'#22292d'),
 tunacan:()=>rect(10,20,44,29,'#9aa6ab')+'<ellipse cx="32" cy="20" rx="22" ry="8" fill="#bbc8c8"/><ellipse cx="32" cy="49" rx="22" ry="5" fill="#5f6b73"/>'+rect(11,28,42,16,'#22292d')+line('22,36 29,32 40,36 29,40 22,36','#19c4b6',2)+ring(32,19,5,'#5f6b73',2),
 collar:()=>'<path d="M14 43 C-1 2 65 2 50 43" fill="none" stroke="#19c4b6" stroke-width="8"/>'+rect(9,37,13,10,'#9aa6ab')+ring(32,43,4,'#9aa6ab',2)+'<path d="M22 49 H42 L32 61Z" fill="#ec71b8"/>',
 yarnball:()=>circle(29,29,23,'#22292d')+'<path d="M11 17 Q31 13 49 30 M8 29 Q31 22 46 42 M15 46 Q26 17 41 10" fill="none" stroke="#ec71b8" stroke-width="3"/>'+'<path d="M16 10 Q18 35 38 49 M7 36 Q30 47 49 21" fill="none" stroke="#e8782c" stroke-width="3"/>'+'<path d="M28 6 Q49 31 24 51 C20 62 56 64 57 49" fill="none" stroke="#19c4b6" stroke-width="3"/>',
 keycard:()=>'<g transform="rotate(-18 32 32)">'+rect(6,15,52,35,'#22292d')+rect(12,22,12,10,'#d9bb57')+line('18,22 18,32','#a28c67',1)+paw(42,36,'#e8782c')+'</g>',
 visor:()=>'<path d="M8 20 L8 7 L24 19 H40 L56 7 V38 Q32 58 8 38Z" fill="#3f6d72" stroke="#19c4b6" stroke-width="3"/>'+line('18,28 28,35 22,39','#bbc8c8',2)+line('34,25 44,33','#bbc8c8',2),
 fishpuck:()=>'<path d="M16 48 L9 14 H55 L48 48Z" fill="#19c4b6" fill-opacity=".08"/>'+'<path d="M12 23 Q28 7 42 23 L54 14 V32 L42 23 Q28 39 12 23Z" fill="none" stroke="#19c4b6" stroke-width="2" stroke-dasharray="2 3"/>'+circle(22,21,2,'#19c4b6')+'<ellipse cx="32" cy="51" rx="25" ry="9" fill="#22292d"/>'+'<ellipse cx="32" cy="48" rx="21" ry="4" fill="#3f6d72"/>',
 nippouch:()=>'<path d="M15 13 H49 L46 25 L54 56 H10 L18 25Z" fill="#8a9399"/>'+rect(15,13,34,9,'#e8782c')+circle(32,39,11,'#19c4b6')+line('28,44 35,33 36,41','#285e64',3),
 pawpad:()=>rect(13,52,38,7,'#5f6b73')+line('32,49 32,37','#9aa6ab',6)+'<ellipse cx="31" cy="35" rx="13" ry="11" fill="#ec71b8"/>'+circle(15,25,6,'#ec71b8')+circle(26,14,6,'#ec71b8')+circle(41,17,6,'#ec71b8')+circle(49,30,6,'#ec71b8'),
 fishbowl:()=>'<path d="M17 12 C-6 51 15 59 32 59 C52 59 69 48 47 12Z" fill="#19c4b6" fill-opacity=".12" stroke="#9aa6ab" stroke-width="2"/>'+line('16,12 48,12','#bbc8c8',3)+line('12,33 52,33','#3f6d72',2)+'<path d="M20 40 Q31 27 43 40 Q31 53 20 40 L13 33 V47Z" fill="#e8782c"/>'+circle(36,38,2,'#22292d')+ring(41,24,2,'#19c4b6',1),
 headphones:()=>'<path d="M11 39 V28 C11 1 53 1 53 28 V39" fill="none" stroke="#22292d" stroke-width="9"/>'+line('13,18 10,4 25,11','#ec71b8',3)+line('39,11 54,4 51,18','#ec71b8',3)+rect(6,29,14,27,'#22292d')+rect(44,29,14,27,'#22292d')+line('17,34 17,50','#ec71b8',3)+line('47,34 47,50','#ec71b8',3),
 robomouse:()=>'<path d="M45 35 C64 30 58 11 49 16 C41 21 60 23 59 9" fill="none" stroke="#e8782c" stroke-width="3"/>'+'<path d="M5 39 Q21 13 41 25 Q55 34 47 44 H11Z" fill="#9aa6ab"/>'+circle(24,24,8,'#5f6b73')+circle(14,35,2,'#22292d')+wheel(20,47,6)+wheel(42,47,6),
 hydropod:()=>'<path d="M12 43 V26 A20 20 0 0 1 52 26 V43Z" fill="#19c4b6" fill-opacity=".12" stroke="#9aa6ab" stroke-width="2"/>'+line('32,43 32,22','#6ca66b',3)+'<path d="M32 31 Q14 32 19 19 Q34 18 32 31 M32 25 Q29 12 44 14 Q46 26 32 25" fill="#6ca66b"/>'+rect(10,43,44,13,'#22292d')+rect(16,55,32,5,'#5f6b73'),
 scratchpost:()=>rect(8,51,48,8,'#22292d')+rect(24,8,16,44,'#a28c67')+Array.from({length:9},(_,i)=>line(`25,${12+i*4} 39,${8+i*4}`,'#e8782c',2)).join('')+line('26,26 17,23 13,29','#a28c67',2)+line('38,40 49,42 53,37','#a28c67',2),
 milkcarton:()=>'<path d="M18 19 L26 6 H40 L48 19 V58 H18Z" fill="#fff4dc"/>'+line('26,6 32,19 32,57','#9aa6ab',2)+line('19,19 47,19','#9aa6ab',2)+rect(18,29,30,14,'#19c4b6')+rect(25,8,16,3,'#bbc8c8'),
 chewedbox:()=>'<path d="M12 26 L32 17 L52 26 V53 L32 60 L12 51Z" fill="#a28c67"/><path d="M13 27 L32 20 L50 27 L32 35Z" fill="#22292d"/><path d="M12 26 L4 15 L12 17 L17 12 L22 16 L25 12 L32 18 L25 34Z M32 18 L47 9 L60 23 L50 30Z" fill="#a28c67"/>'+line('32,35 32,57','#5f6b73',2)+paw(44,44,'#5f6b73'),
 featherdrone:()=>line('8,56 32,29','#9aa6ab',3)+line('8,56 18,45','#e8782c',7)+ring(37,24,8,'#9aa6ab',2)+line('39,17 38,9 32,5','#9aa6ab',2)+'<path d="M33 7 Q17 8 22 23 Q34 25 33 7" fill="#e8782c"/><path d="M41 10 Q56 5 58 20 Q47 26 41 10" fill="#19c4b6"/><path d="M45 25 Q60 25 56 40 Q42 40 45 25" fill="#ec71b8"/>',
 kibblebowl:()=>'<path d="M8 31 H56 L50 53 Q32 61 14 53Z" fill="#9aa6ab"/>'+'<ellipse cx="32" cy="31" rx="24" ry="9" fill="#22292d"/>'+[[15,30],[22,24],[31,21],[39,24],[48,30],[25,33],[36,32]].map(([x,y])=>circle(x,y,5,'#a28c67')+line(`${x-1},${y-1} ${x+1},${y+1}`,'#5f6b73',1)).join('')+line('15,46 49,46','#5f6b73',2),
};
// Bench debris has its own silhouettes, distinct from the named replacement parts.
export function partArt(id){
 const draw=fittings[id]||debris[id];if(draw)return svg(draw());
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
