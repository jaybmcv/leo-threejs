import * as T from 'three';
import {ATRIUM_STAGE,ATRIUM_STAGE_LINES} from '../plan/atrium-v2.js';
import {walkCanvas} from './canvas.js';

function canvas(w,h){const c=walkCanvas();c.width=w;c.height=h;return c;}
function texture(c){const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
function type(g,s,x,y,size,colour,weight=700){g.font=weight+' '+size+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle=colour;g.fillText(s,x,y);}
function panel(g,colour,x,y,w,h){g.fillStyle=colour;g.fillRect(x,y,w,h);}
function ellipse(g,colour,x,y,rx,ry){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=colour;g.fill();}

// A front-on illustration of the stage, with its arched truss, line arrays and timber apron.
export function makeStageLoop(){
 const c=canvas(1024,128),plate=canvas(1024,128),bg=plate.getContext('2d'),g=c.getContext('2d'),map=texture(c);
 const wash=bg.createLinearGradient(0,0,0,128);wash.addColorStop(0,'#100b20');wash.addColorStop(1,'#271735');panel(bg,wash,0,0,1024,128);
 const backdrop=bg.createRadialGradient(512,66,4,512,66,360);backdrop.addColorStop(0,'#222f58');backdrop.addColorStop(1,'#101124');panel(bg,backdrop,126,29,772,71);
 panel(bg,'#684253',126,93,772,7);panel(bg,'#ac7151',126,100,772,6);panel(bg,'#3b2639',114,106,796,9);
 for(let x=128;x<=896;x+=16)panel(bg,'#85584d',x,100,1,6);
 for(let row=0;row<2;row++)for(let side of [-1,1]){
  const x=512+side*(297+row*35);
  panel(bg,'#382a49',x-17,51+row*17,34,43-row*16);
  for(let i=0;i<4-row;i++){panel(bg,'#141825',x-14,54+i*8+row*17,28,7);panel(bg,'#5ebdd1',x-10,56+i*8+row*17,2,2);}
 }
 bg.beginPath();bg.moveTo(126,95);bg.lineTo(126,30);bg.quadraticCurveTo(512,-9,898,30);bg.lineTo(898,95);
 bg.strokeStyle='#d7a27c';bg.lineWidth=2.5;bg.stroke();
 bg.beginPath();bg.moveTo(132,37);bg.quadraticCurveTo(512,-2,892,37);bg.strokeStyle='#63364c';bg.lineWidth=1.5;bg.stroke();
 for(let i=0;i<=43;i++){
  const t=i/43,x=132+760*t,y=30-76*t*(1-t);
  bg.beginPath();bg.moveTo(x,y+1);bg.lineTo(x+(i%2?7:-7),y+8);bg.strokeStyle='#a37566';bg.lineWidth=1;bg.stroke();
 }
 type(bg,ATRIUM_STAGE_LINES[0],62,46,14,'#ecc7ab');type(bg,ATRIUM_STAGE_LINES[1],62,66,13,'#ecc7ab');type(bg,'ATRIUM / D06',62,87,8,'#e0a5bb');
 type(bg,'SET LOOP',958,57,15,'#e0bcdf');type(bg,'LEO',958,80,10,'#8fdcd6');
 const colours=['#59ddff','#ee6cb9','#ffc382','#ae83ff'];
 function draw(t){
  g.drawImage(plate,0,0);
  for(let i=0;i<14;i++){
   const x=175+i*52,y=23+((x-512)/360)**2*14,target=x+Math.sin(t+i*.72)*62,color=colours[i%4];
   const beam=g.createLinearGradient(x,y,target,96);beam.addColorStop(0,color+'70');beam.addColorStop(1,color+'0b');
   g.beginPath();g.moveTo(x-2,y);g.lineTo(target-20,96);g.lineTo(target+20,96);g.lineTo(x+2,y);g.fillStyle=beam;g.fill();
   ellipse(g,color,x,y,2.5,1.8);
  }
  const bob=Math.sin(t*2)*2,cy=59+bob;
  g.lineCap='round';
  for(let i=0;i<8;i++){
   const dx=(i-3.5)*11,ex=512+dx*1.6,ey=77+Math.sin(t*3+i*.9)*5;
   g.beginPath();g.moveTo(512+dx*.24,cy+7);g.bezierCurveTo(512+dx*.9,cy+23,ex,ey-13,ex,ey);
   g.strokeStyle='#b5338e';g.lineWidth=7;g.stroke();g.strokeStyle=i%2?'#ff68b2':'#ff93d2';g.lineWidth=3;g.stroke();
   ellipse(g,'#72f5ed',ex,ey,2.1,1.4);
  }
  ellipse(g,'#9b3299',512,cy-1,19,17);
  ellipse(g,'#f853ac',510,cy-4,16,15);
  ellipse(g,'#ff9fcf',506,cy-13,6,2.5);
  for(const s of [-1,1]){ellipse(g,'#fbdbdc',512+s*6,cy,3.8,5);ellipse(g,'#36204c',512+s*6.7,cy+.5,1.9,3.1);ellipse(g,'#56eae6',512+s*17,cy-1,2.7,5.3);}
  panel(g,'#201329',461,81,102,15);panel(g,'#432752',465,84,94,9);panel(g,'#75f9eb',461,81,102,2);
  for(let i=0;i<17;i++){const h=2+Math.abs(Math.sin(t*4+i*.62))*5;panel(g,colours[i%4],470+i*5.1,93-h,2.5,h);}
  panel(g,'#d073ae',462,96,100,1);
  map.needsUpdate=true;
 }
 draw(0);
 return {map,draw};
}

// All framed prints and room lettering share this atlas.
export function makeGreenRoomPrints(){
 const c=canvas(1024,512),g=c.getContext('2d'),tiles={};
 function tile(name,x,y,w,h,paint){
  tiles[name]=[x,y,w,h];g.save();g.translate(x,y);paint(w,h);g.restore();
 }
 tile('play',0,0,400,96,(w,h)=>{
  panel(g,'#281523',0,0,w,h);type(g,'PLAY LOUD',w/2,h*.57,62,'#ff459b');
  g.shadowColor='#ff268c';g.shadowBlur=14;type(g,'PLAY LOUD',w/2,h*.54,60,'#ffd2e7');g.shadowBlur=0;
 });
 tile('bar',406,0,320,92,(w,h)=>{
  panel(g,'#281f2e',0,0,w,h);type(g,'BACKSTAGE BAR',w/2,33,30,'#ffe6ad');type(g,ATRIUM_STAGE.name,w/2,68,16,'#f3ad8e');
 });
 tile('restroom',734,0,284,92,(w,h)=>{
  panel(g,'#242333',0,0,w,h);type(g,'RESTROOM',w/2,47,42,'#ffdbad');
 });
 tile('mural',0,101,612,243,(w,h)=>{
  panel(g,'#2b273a',0,0,w,h);
  for(let i=0;i<16;i++){
   const x=15+i*38,y=70+40*Math.sin(i*2.2);
   g.beginPath();g.moveTo(x-23,y+93);g.lineTo(x+20,y-21);g.lineTo(x+41,y+64);
   g.strokeStyle=['#426986','#9c4c86','#d26a77','#508875'][i%4];g.lineWidth=14;g.stroke();
  }
  for(let i=0;i<100;i++){const x=(i*73)%w,y=(i*47)%h;ellipse(g,i%2?'#fab989':'#6cdac2',x,y,1+i%4,1+i%3);}
  g.save();g.translate(w/2,h*.56);g.rotate(-.105);type(g,'AFTERBURN',5,7,86,'#261c37');type(g,'AFTERBURN',0,0,86,'#87ffe0');g.restore();
 });
 const posters=[['LOW','ORBIT','#f29d6c','#503c71'],['VELVET','COMETS','#d8b3fa','#683b64'],['STATIC','PAWS','#7cedcb','#275360']];
 posters.forEach(([a,b,ink,base],i)=>tile('poster'+i,618+i*134,101,127,203,(w,h)=>{
  panel(g,base,0,0,w,h);panel(g,ink,5,5,w-10,h-10);panel(g,base,8,8,w-16,h-16);
  ellipse(g,ink,w/2,77,38,40);ellipse(g,base,w/2+10,67,32,29);ellipse(g,ink,w/2+30,49,3,3);
  type(g,a,w/2,135,23,ink);type(g,b,w/2,158,22,ink);type(g,'D06  /  LEO',w/2,183,11,ink);
 }));
 ['LOW ORBIT','VELVET COMETS','STATIC PAWS','NOVA ENCORE'].forEach((s,i)=>tile('disc'+i,i*146,353,140,153,(w,h)=>{
  panel(g,'#83663e',0,0,w,h);panel(g,'#171421',5,5,w-10,h-10);
  for(let r=51;r>8;r-=1.9)ellipse(g,r%4<2?'#e8ba63':'#b68345',70,63,r,r);
  ellipse(g,'#552d43',70,63,13,13);ellipse(g,'#ddd19c',70,63,2.1,2.1);
  panel(g,'#b1844f',21,122,98,19);type(g,s,70,132,10,'#1d1c20');
 }));
 tile('drum',617,351,123,122,(w,h)=>{
  panel(g,'#171524',0,0,w,h);ellipse(g,'#9f4d92',w/2,h/2,49,49);ellipse(g,'#171524',w/2,h/2,45,45);
  type(g,'STATIC',w/2,49,22,'#fad0e2');type(g,'PAWS',w/2,73,25,'#fad0e2');
 });
 tile('fridge',750,351,268,65,(w,h)=>{
  panel(g,'#1c2830',0,0,w,h);type(g,'ORBIT SODA',w/2,h/2,39,'#9bf7d4');
 });
 return {map:texture(c),tiles};
}
