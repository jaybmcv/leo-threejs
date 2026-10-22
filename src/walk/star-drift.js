import * as T from 'three';

// Nearer stars that drift slowly aft past the windows, so space outside reads as a ship in cruise. The fixed star sphere
// stays as the distant sky; these sit in a shell around the ship's axis, clear of the line of sight to Mars ahead.
const SPAN=2400,INNER=420,OUTER=2000;
export function createStarDrift({count=520,still=false}={}){
 let seed=2209;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const p=new Float32Array(count*3),speed=new Float32Array(count);
 for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=INNER+(OUTER-INNER)*Math.sqrt(random());
  p[i*3]=(random()*2-1)*SPAN;p[i*3+1]=r*Math.sin(a);p[i*3+2]=r*Math.cos(a);speed[i]=18+random()*42;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p,3));
 const points=new T.Points(g,new T.PointsMaterial({color:0xdde8f0,size:1.4,sizeAttenuation:false,transparent:true,opacity:.55,depthWrite:false}));
 points.name='Star_drift';points.frustumCulled=false;
 // Each star moves toward -X (aft) at its own pace and comes back in ahead of the nose. Reduced motion keeps them still.
 function update(dt){
  if(still||!dt)return;
  for(let i=0;i<count;i++){let x=p[i*3]-speed[i]*dt;if(x<-SPAN)x+=SPAN*2;p[i*3]=x;}
  g.attributes.position.needsUpdate=true;
 }
 return {points,update};
}
