import {W,H,R,ARCH,ARCH_END,FLIPPERS,BUMPERS,LANES,DIVIDERS,LANE_TOP,LANE_BOTTOM,DROPS,SAUCER,SLINGS,LANE,PLUNGE,GATE,MULT_MAX,tip} from './rules.js';

// Pinball's look, drawn on a 2D canvas: the table (the game's screen draws it every frame; the machine in the
// Recreation Hall wears it under its glass) and the backglass. Only the canvas's own drawing calls, so the walk's
// texture canvases and the page's both work.
export const C={back:'#05070d',field:'#0c1a33',text:'#f4f0e8',dim:'#a6a5b4',orange:'#f85800',teal:'#2fd6c5',navy:'#233b4b',
 chrome:'#c9d2d8',mars:'#c8552e',gold:'#ffc266',pink:'#ff4fd8'};
export const FONT={display:'"Archivo", "Sora", system-ui, sans-serif',mono:'"JetBrains Mono", ui-monospace, monospace'};
const TAU=Math.PI*2;

// The table at `k` canvas pixels per unit, its top-left at the context's origin. `g` is the game's state (rules.js)
// or null for a table at rest; `now` (ms) pulses the lights.
export function drawTable(x,k,g=null,now=0){
 const lit=g?.lanes||[false,false,false],drops=g?.drops||[true,true,true],flash=g?.flash||{},mult=g?.mult||1;
 x.save();x.scale(k,k);x.lineCap='round';x.lineJoin='round';
 // The field: deep blue, a scatter of stars and Mars low in the middle.
 const bg=x.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#13254a');bg.addColorStop(1,'#060b18');
 x.fillStyle=bg;x.beginPath();x.moveTo(10,H);x.lineTo(10,112);x.lineTo(...ARCH_END);x.arc(ARCH.x,ARCH.y,ARCH.r,ARCH.from,TAU);x.lineTo(230,H);x.closePath();x.fill();
 let s=7;const r=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
 for(let i=0;i<70;i++){x.fillStyle=`rgba(244,240,232,${.25+r()*.5})`;x.fillRect(12+r()*196,20+r()*330,.8,.8);}
 const mars=x.createRadialGradient(98,252,4,111,265,52);mars.addColorStop(0,'#e0773f');mars.addColorStop(.7,'#a4401f');mars.addColorStop(1,'rgba(90,30,14,0)');
 x.fillStyle=mars;x.beginPath();x.arc(111,265,50,0,TAU);x.fill();
 x.fillStyle='rgba(60,18,8,.35)';for(const [ex,ey,er] of [[96,258,9],[124,280,6],[118,248,4]]){x.beginPath();x.ellipse(ex,ey,er*1.6,er,.3,0,TAU);x.fill();}
 // The multiplier lights across Mars.
 x.textAlign='center';x.textBaseline='middle';x.font=`800 8px ${FONT.display}`;
 for(let m=2;m<=MULT_MAX;m++){const mx=111+(m-3.5)*22,on=mult>=m;
  x.fillStyle=on?C.gold:'rgba(255,194,102,.18)';x.beginPath();x.arc(mx,312,8,0,TAU);x.fill();x.fillStyle=on?'#2a1606':'rgba(244,240,232,.45)';x.fillText(m+'X',mx,312.5);}
 // The top lanes' lights, L E O; the lit ones glow.
 LANES.forEach((lx,i)=>{const on=lit[i]||flash.lanes>0&&((now/120|0)%2===0);
  if(on){x.fillStyle='rgba(248,88,0,.35)';x.beginPath();x.arc(lx,88,10,0,TAU);x.fill();}
  x.fillStyle=on?C.orange:'rgba(248,88,0,.22)';x.beginPath();x.arc(lx,88,6.5,0,TAU);x.fill();
  x.fillStyle=on?C.text:'rgba(244,240,232,.5)';x.font=`800 8px ${FONT.display}`;x.fillText('LEO'[i],lx,88.5);});
 // The saucer: a crater with MARS round it, glowing while it holds the ball.
 {const on=flash.saucer>0;x.fillStyle=on?'rgba(248,88,0,.45)':'rgba(200,85,46,.25)';x.beginPath();x.arc(SAUCER.x,SAUCER.y,14,0,TAU);x.fill();
  x.fillStyle='#05070d';x.beginPath();x.arc(SAUCER.x,SAUCER.y,SAUCER.r,0,TAU);x.fill();x.strokeStyle=on?C.gold:C.mars;x.lineWidth=1.5;x.stroke();
  x.fillStyle=on?C.gold:'rgba(244,240,232,.6)';x.font=`700 6px ${FONT.display}`;x.fillText('MARS',SAUCER.x,SAUCER.y+21);}
 // The slingshots: teal rubber faces on dark plastics, bright while kicking.
 SLINGS.forEach((p,i)=>{x.fillStyle=flash['sling'+i]>0?'rgba(47,214,197,.55)':'rgba(47,214,197,.16)';x.beginPath();p.forEach(q=>x.lineTo(...q));x.closePath();x.fill();
  x.strokeStyle=C.teal;x.lineWidth=4;x.beginPath();x.moveTo(...p[0]);x.lineTo(...p[2]);x.stroke();x.strokeStyle=C.chrome;x.lineWidth=2;x.beginPath();x.moveTo(...p[0]);x.lineTo(...p[1]);x.lineTo(...p[2]);x.stroke();});
 // The walls and the lane: chrome rails.
 x.strokeStyle=C.chrome;x.lineWidth=2.4;
 x.beginPath();x.moveTo(230,H);x.lineTo(230,ARCH.y);x.arc(ARCH.x,ARCH.y,ARCH.r,0,ARCH.from,true);x.lineTo(10,112);x.lineTo(10,327);x.lineTo(66,369);x.stroke();
 x.beginPath();x.moveTo(LANE.x0,LANE.floor);x.lineTo(LANE.x0,LANE.top);x.stroke();x.beginPath();x.moveTo(212,327);x.lineTo(156,369);x.stroke();
 x.lineWidth=1;x.strokeStyle='rgba(201,210,216,.6)';x.beginPath();x.moveTo(...GATE[0]);x.lineTo(...GATE[1]);x.stroke();
 x.lineWidth=4;x.strokeStyle=C.chrome;for(const dx of DIVIDERS){x.beginPath();x.moveTo(dx,LANE_TOP);x.lineTo(dx,LANE_BOTTOM);x.stroke();}
 // The plunger: a spring drawn back as it is pulled, its tip under the ball.
 {const pull=g?.pull||0,top=LANE.floor+pull*14;x.strokeStyle=C.dim;x.lineWidth=1;x.beginPath();
  for(let i=0;i<=8;i++)x.lineTo(LANE.x0+3+(i%2)*12,top+i*(H-top)/8);x.stroke();x.fillStyle=C.orange;x.fillRect(LANE.x0+2,top-2,LANE.x1-LANE.x0-4,4);}
 // The drop targets: orange while up, dark slots once down.
 DROPS.forEach((t,i)=>{x.fillStyle=drops[i]?(flash.bank>0?C.gold:C.orange):'#1a2230';x.fillRect(t.x-t.r,t.y-t.half-t.r,t.r*2,t.half*2+t.r*2);});
 // The pop bumpers: a rubber ring, a cap and a star, flashing when struck.
 BUMPERS.forEach((p,i)=>{const on=flash['bumper'+i]>0;
  if(on){x.fillStyle='rgba(255,194,102,.35)';x.beginPath();x.arc(p.x,p.y,p.r+7,0,TAU);x.fill();}
  x.fillStyle=C.teal;x.beginPath();x.arc(p.x,p.y,p.r,0,TAU);x.fill();
  x.fillStyle=on?C.gold:C.orange;x.beginPath();x.arc(p.x,p.y,p.r-3,0,TAU);x.fill();
  x.fillStyle=on?'#2a1606':C.text;x.beginPath();for(let j=0;j<10;j++){const a=-Math.PI/2+j*Math.PI/5,rr=j%2?2.4:5.5;x.lineTo(p.x+Math.cos(a)*rr,p.y+Math.sin(a)*rr);}x.fill();});
 // The flippers, at their angles.
 FLIPPERS.forEach((f,i)=>{const a=g?g.flips[i].a:f.rest,[tx,ty]=tip(f,a),n=[-Math.sin(a),Math.cos(a)];
  x.fillStyle=C.text;x.strokeStyle=C.orange;x.lineWidth=1.6;x.beginPath();
  x.arc(f.x,f.y,f.r0,a+Math.PI/2,a-Math.PI/2);x.lineTo(tx+n[0]*-f.r1,ty+n[1]*-f.r1);x.arc(tx,ty,f.r1,a-Math.PI/2,a+Math.PI/2);x.closePath();x.fill();x.stroke();
  x.fillStyle=C.orange;x.beginPath();x.arc(f.x,f.y,2,0,TAU);x.fill();});
 // The ball: polished steel.
 {const b=g?.b||{x:PLUNGE.x,y:PLUNGE.y},by=b.y+(g&&b.lane&&!b.launching?(g.pull||0)*14:0);
  const shine=x.createRadialGradient(b.x-1.8,by-2,.5,b.x,by,R);shine.addColorStop(0,'#ffffff');shine.addColorStop(.5,'#b8c2c8');shine.addColorStop(1,'#4b5560');
  x.fillStyle=shine;x.beginPath();x.arc(b.x,by,R,0,TAU);x.fill();}
 x.restore();
}

// The backglass, `w` by `h` pixels: the title over Mars, Leo crossing in front, and a scatter of stars.
export function drawBackglass(x,w,h){
 const bg=x.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#1a0f33');bg.addColorStop(1,'#05070d');x.fillStyle=bg;x.fillRect(0,0,w,h);
 let s=3;const r=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
 for(let i=0;i<90;i++){x.fillStyle=`rgba(244,240,232,${.3+r()*.6})`;const z=1+r()*1.5;x.fillRect(r()*w,r()*h,z,z);}
 const mars=x.createRadialGradient(w*.62,h*.66,h*.05,w*.68,h*.74,h*.42);mars.addColorStop(0,'#ef8a4c');mars.addColorStop(.75,'#a4401f');mars.addColorStop(1,'rgba(80,24,10,0)');
 x.fillStyle=mars;x.beginPath();x.arc(w*.68,h*.74,h*.42,0,TAU);x.fill();
 // Leo, a slim white ship with an orange engine glow, crossing.
 x.save();x.translate(w*.3,h*.7);x.rotate(-.18);x.fillStyle='#e8ecef';x.beginPath();x.moveTo(w*.17,0);x.quadraticCurveTo(0,-h*.05,-w*.14,-h*.025);x.lineTo(-w*.14,h*.025);x.quadraticCurveTo(0,h*.05,w*.17,0);x.fill();
 x.fillStyle='#233b4b';x.fillRect(-w*.02,-h*.012,w*.1,h*.024);x.fillStyle=C.orange;x.shadowColor=C.orange;x.shadowBlur=h*.05;x.beginPath();x.ellipse(-w*.16,0,w*.03,h*.02,0,0,TAU);x.fill();x.restore();
 x.textAlign='center';x.textBaseline='middle';
 const glow=(t,y,size,color)=>{x.font=`800 ${size}px ${FONT.display}`;x.shadowColor=color;x.shadowBlur=size*.4;x.fillStyle=color;x.fillText(t,w/2,y);x.shadowBlur=0;};
 glow('LEO',h*.2,h*.2,C.orange);glow('PINBALL',h*.38,h*.13,C.teal);
}
