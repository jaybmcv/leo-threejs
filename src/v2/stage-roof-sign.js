import * as T from 'three';
import {ATRIUM_STAGE_LINES} from '../plan/atrium-v2.js';
import {walkCanvas} from '../walk/canvas.js';
import {paint} from '../walk/foliage.js';
import {STAGE_ROOF,stageRoofTop} from './stage-concert.js';

function neonFace(canvas){
 const w=1024,h=224;canvas.width=w;canvas.height=h;
 const g=canvas.getContext('2d'),metal=g.createLinearGradient(0,0,0,h);
 metal.addColorStop(0,'#29252a');metal.addColorStop(.5,'#16151a');metal.addColorStop(1,'#201b22');
 g.fillStyle=metal;g.fillRect(0,0,w,h);
 g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
 const lines=[[78,108,880,'#ff4921','#ff642d','#ff9a53','#ffe0ad'],
  [165,69,505,'#ff302f','#ff4838','#ff7859','#ffc7a8']];
 lines.forEach(([y,size,width,halo,low,high,core],i)=>{
  const text=ATRIUM_STAGE_LINES[i];
  g.save();g.font='bold '+size+'px sans-serif';g.translate(w/2,y);g.scale(width/g.measureText(text).width,1);
  const tube=g.createLinearGradient(0,-size/2,0,size/2);tube.addColorStop(0,high);tube.addColorStop(1,low);
  g.shadowColor=halo;g.shadowBlur=20;g.strokeStyle=halo;g.lineWidth=12;g.strokeText(text,0,0);
  g.shadowBlur=0;g.strokeStyle=tube;g.lineWidth=7;g.strokeText(text,0,0);
  g.strokeStyle=core;g.lineWidth=2.6;g.strokeText(text,0,0);g.restore();
 });
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
}

// The hardware shares the static garden draw. The luminous face is a single one-sided card.
export function addStageRoofSign(root,decor,floor){
 const {front,centre:z}=STAGE_ROOF,x=front+.32,width=15.4,height=3.2;
 const bottom=floor+stageRoofTop(z)+.37,y=bottom+height/2;
 const box=(size,at,colour)=>{
  const g=new T.BoxGeometry(...size).translate(...at);decor.push(paint(g,colour));g.dispose();
 };
 box([.32,height,width],[x,y,z],0x202329);
 for(const side of [-1,1]){
  box([.39,.09,width+.09],[x,y+side*(height-.09)/2,z],0x4c4547);
  box([.39,height-.18,.09],[x,y,z+side*width/2],0x4c4547);
  const legZ=z+side*5.5,base=floor+stageRoofTop(legZ)-.008,top=bottom+.15;
  box([.36,top-base,.22],[x,(base+top)/2,legZ],0x34363b);
  box([.50,.08,.43],[x+.04,base+.04,legZ],0x45484d);
 }
 const canvas=walkCanvas();if(!canvas)return;
 const face=new T.Mesh(new T.PlaneGeometry(width-.20,height-.20).rotateY(-Math.PI/2).translate(x-.163,y,z),
  new T.MeshBasicMaterial({name:'P6_stage_roof_neon',map:neonFace(canvas),toneMapped:false}));
 face.name='P6_stage_roof_sign_face';face.userData={noCollide:true,phase6Architecture:true,gardenDecor:true};root.add(face);
}
