import {CanvasTexture,DataTexture,LinearFilter,SRGBColorSpace,Vector3} from 'three';
// LEO's nose is +X. Project the opposite travel vector into the current
// camera so trails continue aft when orbiting, rolling or changing views.
// `width` is the backdrop's (createSpaceBackdrop), so trails follow the ship on screens of any shape.
export function aftScreenFlow(camera,target,width=1536){
 camera.updateMatrixWorld();
 const a=target.clone().project(camera),b=target.clone().add(new Vector3(-1,0,0)).project(camera);
 const x=(b.x-a.x)*width,y=-(b.y-a.y)*864,length=Math.hypot(x,y);
 const view=new Vector3(-1,0,0).transformDirection(camera.matrixWorldInverse),strength=Math.hypot(view.x,view.y);
 // A zero-size viewport projects to NaN; treat it like no motion instead of throwing every frame.
 return !Number.isFinite(length)||length<1e-8?{x:0,y:0,strength:0}:{x:x/length,y:y/length,strength};
}
// Drawn in a space 864 tall and as wide as the screen's shape (1536 at 16:9). The background fills the viewport, so a
// fixed 16:9 canvas was stretched on other screens: ~3.6× tall on an upright phone, where its stars drew as streaks.
// The 1536-wide star field is centred and repeats sideways on wider screens. `scale` shrinks the canvas (phones use .5)
// and `fps` caps how often it is redrawn and re-uploaded to the GPU; the streaks keep moving at full rate either way.
// Static stars are painted once per screen shape (resize).
// `pixels` (phones) hands the GPU the canvas's pixels instead of the canvas itself. A Galaxy S9 (Mali) showed the
// canvas-to-texture copy as smeared blue-white garbage across the whole background; plain pixel uploads take the
// ordinary path. The canvas then lives in memory (willReadFrequently), so reading it back is cheap.
export function createSpaceBackdrop({scale=1,fps=0,pixels=false}={}){
 const canvas=document.createElement('canvas'),starLayer=document.createElement('canvas');
 const ctx=canvas.getContext('2d',pixels?{willReadFrequently:true}:undefined),starCtx=starLayer.getContext('2d');
 const texture=pixels?new DataTexture(new Uint8Array(4),1,1):new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
 // Canvas rows run top down; a canvas texture is flipped on upload, so these are too.
 if(pixels)Object.assign(texture,{flipY:true,magFilter:LinearFilter,minFilter:LinearFilter,generateMipmaps:false});
 let seed=1703;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const stars=Array.from({length:270},()=>({x:random()*1536,y:random()*864,r:.35+random()*1.1,a:.25+random()*.7}));
 const lines=Array.from({length:42},()=>({x:random()*2496-480,y:random()*1824-480,len:70+random()*380,speed:340+random()*560,a:.12+random()*.3}));
 const interval=fps>0?1/fps:0;let width=0,sinceDraw=Infinity,lastFlow={x:-1,y:0,strength:0};
 function draw(flow){
  ctx.drawImage(starLayer,0,0,width,864);
  for(const l of lines){
   if(flow.strength<.01)continue;
   const len=l.len*flow.strength,tx=l.x-flow.x*len,ty=l.y-flow.y*len;
   const gradient=ctx.createLinearGradient(l.x,l.y,tx,ty);gradient.addColorStop(0,'rgba(228,243,255,'+l.a+')');gradient.addColorStop(1,'rgba(143,196,255,0)');
   ctx.strokeStyle=gradient;ctx.lineWidth=1.7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(l.x,l.y);ctx.lineTo(tx,ty);ctx.stroke();
  }
  if(pixels)texture.image.data.set(ctx.getImageData(0,0,canvas.width,canvas.height).data);
  texture.needsUpdate=true;
 }
 // `aspect` is the viewport's width over its height.
 function resize(aspect){
  const next=Math.max(64,Math.round(864*(aspect>0&&Number.isFinite(aspect)?aspect:16/9)));if(next===width)return;
  // Trails keep their place across the screen as it changes shape.
  if(width)for(const l of lines)l.x=(l.x+480)/(width+960)*(next+960)-480;
  width=next;
  // Resizing a canvas clears it and its transform; a texture of a new size needs new GPU storage (three allocates it
  // again on the next upload).
  canvas.width=starLayer.width=Math.round(width*scale);canvas.height=starLayer.height=Math.round(864*scale);texture.dispose();
  if(pixels)texture.image={data:new Uint8Array(canvas.width*canvas.height*4),width:canvas.width,height:canvas.height};
  ctx.setTransform(scale,0,0,scale,0,0);starCtx.setTransform(scale,0,0,scale,0,0);
  starCtx.fillStyle='#000000';starCtx.fillRect(0,0,width,864);
  const shift=(width-1536)/2;
  for(const s of stars)for(let x=s.x+shift-Math.ceil((s.x+shift+2)/1536)*1536;x<width+2;x+=1536){if(x<-2)continue;
   starCtx.fillStyle='rgba(221,236,255,'+s.a+')';starCtx.beginPath();starCtx.arc(x,s.y,Math.max(s.r,.5/scale),0,Math.PI*2);starCtx.fill();}
  sinceDraw=0;draw(lastFlow);
 }
 function update(dt,moving,flow={x:-1,y:0,strength:1}){
  const wrap=(v,size)=>((v+480)%(size+960)+(size+960))%(size+960)-480;
  if(moving)for(const l of lines){l.x=wrap(l.x+flow.x*l.speed*dt*flow.strength,width);l.y=wrap(l.y+flow.y*l.speed*dt*flow.strength,864);}
  lastFlow=flow;sinceDraw+=dt;if(sinceDraw<interval)return;sinceDraw=0;draw(flow);
 }
 resize(16/9);update(0,false);
 return {texture,update,resize,get width(){return width;}};
}
