import * as T from 'three';

// Shared helpers for the tour art passes: seeded canvas textures and simple materials.
export function canvasTexture(w,h,draw,repeat=[1,1]){
 const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=4;return t;
}
export function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

export const oakFloor=()=>canvasTexture(512,512,(g,w,h)=>{
 const rnd=seeded(11),planks=6;
 for(let i=0;i<planks;i++){const y=i*h/planks,tone=180+rnd()*26;g.fillStyle=`rgb(${tone},${tone*.74|0},${tone*.52|0})`;g.fillRect(0,y,w,h/planks);
  for(let k=0;k<40;k++){g.strokeStyle=`rgba(90,56,30,${.05+rnd()*.08})`;g.lineWidth=1+rnd()*2;g.beginPath();const yy=y+rnd()*h/planks;g.moveTo(0,yy);g.bezierCurveTo(w*.3,yy+rnd()*6-3,w*.7,yy+rnd()*6-3,w,yy);g.stroke();}
  g.fillStyle='rgba(60,38,22,.55)';g.fillRect(0,y,w,2);const joint=rnd()*w;g.fillRect(joint,y,2,h/planks);}
},[2,3]);
export const standard=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.82,metalness:0,...extra});
export const glow=(color,intensity)=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.5});
