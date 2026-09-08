import {CanvasTexture,SRGBColorSpace,Vector3} from 'three';
// LEO's nose is +X. Project the opposite travel vector into the current
// camera so trails continue aft when orbiting, rolling or changing views.
export function aftScreenFlow(camera,target){
 camera.updateMatrixWorld();
 const a=target.clone().project(camera),b=target.clone().add(new Vector3(-1,0,0)).project(camera);
 const x=(b.x-a.x)*1536,y=-(b.y-a.y)*864,length=Math.hypot(x,y);
 const view=new Vector3(-1,0,0).transformDirection(camera.matrixWorldInverse),strength=Math.hypot(view.x,view.y);
 return length<1e-8?{x:0,y:0,strength:0}:{x:x/length,y:y/length,strength};
}
export function createSpaceBackdrop(){
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=864;
 const ctx=canvas.getContext('2d'),texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
 let seed=1703;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const stars=Array.from({length:270},()=>({x:random()*1536,y:random()*864,r:.35+random()*1.1,a:.25+random()*.7}));
 const lines=Array.from({length:42},()=>({x:random()*2016-240,y:random()*1344-240,len:35+random()*190,speed:170+random()*280,a:.12+random()*.3}));
 function update(dt,moving,flow={x:-1,y:0,strength:1}){
  const wrap=(v,size)=>((v+240)%(size+480)+(size+480))%(size+480)-240;
  ctx.fillStyle='#000000';ctx.fillRect(0,0,1536,864);
  for(const s of stars){ctx.fillStyle='rgba(221,236,255,'+s.a+')';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}
  for(const l of lines){
   if(moving){l.x=wrap(l.x+flow.x*l.speed*dt*flow.strength,1536);l.y=wrap(l.y+flow.y*l.speed*dt*flow.strength,864);}
   if(flow.strength<.01)continue;
   const len=l.len*flow.strength,tx=l.x-flow.x*len,ty=l.y-flow.y*len;
   const gradient=ctx.createLinearGradient(l.x,l.y,tx,ty);gradient.addColorStop(0,'rgba(228,243,255,'+l.a+')');gradient.addColorStop(1,'rgba(143,196,255,0)');
   ctx.strokeStyle=gradient;ctx.lineWidth=1.7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(l.x,l.y);ctx.lineTo(tx,ty);ctx.stroke();
  }
  texture.needsUpdate=true;
 }
 update(0,false);return {texture,update};
}
