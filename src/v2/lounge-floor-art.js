import {canvasTexture,seeded} from '../polish-kit.js';
export const swirl=()=>canvasTexture(1024,1024,(g,w,h)=>{
 g.fillStyle='#07040d';g.fillRect(0,0,w,h);
 const rnd=seeded(116),colors=['#ff2fd0','#8a3dff','#2f7bff','#2fe0ff','#9dff2f','#ff2fd0','#5a2fff'];
 const angle=(x,y)=>{const u=2*Math.PI*x/w,v=2*Math.PI*y/h;return 1.6*Math.sin(u+2*Math.sin(v))+1.3*Math.cos(2*v-u)+.8*Math.sin(3*u+v);};
 g.lineCap=g.lineJoin='round';
 for(let i=0;i<34;i++){
  let x=rnd()*w,y=rnd()*h;const pts=[[x,y]],turn=rnd()<.5?0:Math.PI;
  for(let k=0;k<150;k++){const a=angle(x,y)+turn;x+=Math.cos(a)*5;y+=Math.sin(a)*5;pts.push([x,y]);}
  const width=10+rnd()*26,color=colors[i%colors.length];
  for(const [stroke,lw,alpha,blur] of [['#000',width+10,.85,0],[color,width,1,18],['#fff',width*.28,.45,0]]){
   g.strokeStyle=stroke;g.lineWidth=lw;g.globalAlpha=alpha;g.shadowColor=color;g.shadowBlur=blur;
   for(const ox of [-w,0,w])for(const oy of [-h,0,h]){g.beginPath();pts.forEach(([px,py],k)=>k?g.lineTo(px+ox,py+oy):g.moveTo(px+ox,py+oy));g.stroke();}}
 }
 g.globalAlpha=1;g.shadowBlur=0;
});

