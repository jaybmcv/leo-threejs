import {NUMBERS,RING} from './rules.js';

// A standard dartboard drawn to rules.js's measurements, shared by the boards on the wall and the game on screen.
// (cx, cy) is the bull and k the pixels per millimetre; the black surround reaches RING.edge with the numbers on it.
export function drawBoard(g,cx,cy,k){
 const ring=(lo,hi,a,b,color)=>{g.beginPath();g.arc(cx,cy,hi*k,a,b);g.arc(cx,cy,lo*k,b,a,true);g.closePath();g.fillStyle=color;g.fill();};
 g.fillStyle='#19242c';g.beginPath();g.arc(cx,cy,RING.edge*k,0,Math.PI*2);g.fill();
 for(let i=0;i<20;i++){
  // Canvas angles run clockwise from +x; sector 0 (20) is centred straight up.
  const a=-Math.PI/2-Math.PI/20+i*Math.PI/10,b=a+Math.PI/10,light=i%2===1,band=light?'#3a9b70':'#d85540';
  ring(RING.outer,RING.doubleOut,a,b,light?'#e9ddbd':'#1b2428');
  ring(RING.trebleIn,RING.trebleOut,a,b,band);ring(RING.doubleIn,RING.doubleOut,a,b,band);
  const mid=(a+b)/2;g.fillStyle='#f7eed8';g.font=`600 ${Math.max(8,Math.round(26*k))}px sans-serif`;g.textAlign='center';g.textBaseline='middle';
  g.fillText(String(NUMBERS[i]),cx+Math.cos(mid)*196*k,cy+Math.sin(mid)*196*k);
 }
 // The wires between sectors and round each ring.
 g.strokeStyle='#8a9b9e';g.lineWidth=Math.max(1,.8*k);
 for(let i=0;i<20;i++){const a=-Math.PI/2-Math.PI/20+i*Math.PI/10;g.beginPath();g.moveTo(cx+Math.cos(a)*RING.outer*k,cy+Math.sin(a)*RING.outer*k);g.lineTo(cx+Math.cos(a)*RING.doubleOut*k,cy+Math.sin(a)*RING.doubleOut*k);g.stroke();}
 for(const r of [RING.outer,RING.trebleIn,RING.trebleOut,RING.doubleIn,RING.doubleOut]){g.beginPath();g.arc(cx,cy,r*k,0,Math.PI*2);g.stroke();}
 g.beginPath();g.arc(cx,cy,RING.outer*k,0,Math.PI*2);g.fillStyle='#42a477';g.fill();g.stroke();
 g.beginPath();g.arc(cx,cy,RING.bull*k,0,Math.PI*2);g.fillStyle='#df5941';g.fill();g.stroke();
}
