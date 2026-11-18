import * as T from 'three';
import {canvasTexture,seeded} from '../polish-kit.js';

export function loungeCarpet(){
 // Fine pile catches the light without drawing artwork across the floor.
 const map=canvasTexture(256,256,(g,w,h)=>{
  g.fillStyle='#b2b2b2';g.fillRect(0,0,w,h);const rnd=seeded(380);
  for(let i=0;i<22000;i++){const v=169+Math.floor(rnd()*18);g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(rnd()*w,rnd()*h,1,1+rnd()*2);}
 });
 map.name='Lounge_velvet_pile';map.repeat.set(12,12);
 const material=new T.MeshPhysicalMaterial({name:'Lounge_velvet_carpet',color:0x1b191e,map,bumpMap:map,bumpScale:.0015,roughness:.96,metalness:0,sheen:.25,sheenColor:0x77717d,sheenRoughness:.85,envMapIntensity:.35});
 material.userData.preserveWalkFinish=true;return material;
}
