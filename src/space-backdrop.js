import {CanvasTexture,SRGBColorSpace} from 'three';
export function createSpaceBackdrop(){
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=864;
 const ctx=canvas.getContext('2d'),texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
 let seed=1703;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const stars=Array.from({length:270},()=>({x:random()*1536,y:random()*864,r:.35+random()*1.1,a:.25+random()*.7}));
 const lines=Array.from({length:42},()=>({x:random()*1900,y:random()*864,len:35+random()*190,speed:170+random()*280,a:.12+random()*.3}));
 let elapsed=0;
 function update(dt,moving){
  if(moving)elapsed+=dt;
  ctx.fillStyle='#000000';ctx.fillRect(0,0,1536,864);
  for(const s of stars){ctx.fillStyle='rgba(221,236,255,'+s.a+')';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}
  for(const l of lines){const x=((l.x-elapsed*l.speed)%1900+1900)%1900-240;
   const gradient=ctx.createLinearGradient(x,l.y,x+l.len,l.y);gradient.addColorStop(0,'rgba(228,243,255,'+l.a+')');gradient.addColorStop(1,'rgba(143,196,255,0)');
   ctx.strokeStyle=gradient;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x,l.y);ctx.lineTo(x+l.len,l.y);ctx.stroke();
  }
  texture.needsUpdate=true;
 }
 update(0,false);return {texture,update};
}
