import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {meshTriangles} from './collision.js';
import {FROG_AT,FROG_BODY_Y,frogInReach} from './frog-lick.js';

export {FROG_AT};
export const FROG_SIZE=[.46,.57,.96];
function marble(eye=false){
 const n=eye?64:256,data=new Uint8Array(n*n*4),colours=['#168aff','#ff640e','#f524dc','#39ee45'].map(c=>new T.Color(c)),c=new T.Color();
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n,v=y/n,r=Math.hypot(u-.5,v-.5),a=Math.atan2(v-.5,u-.5);
  const wave=eye?a*1.8+r*26:18*u+12*v+3*Math.sin(v*14+2*Math.sin(u*9))+2*Math.sin(18*r+a*3);
  const band=((wave/(Math.PI*2))%1+1)%1*4,k=Math.floor(band);c.copy(colours[k]).lerp(colours[(k+1)%4],T.MathUtils.smoothstep(band-k,.15,.85));
  if(!eye&&((x*73+y*151+x*y*7)%997)<5)c.set('#eeffff');
  // Texture bytes are sRGB; the material decodes them once.
  c.convertLinearToSRGB();const i=(y*n+x)*4;data[i]=c.r*255;data[i+1]=c.g*255;data[i+2]=c.b*255;data[i+3]=255;
 }
 const map=new T.DataTexture(data,n,n);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
}
export function createFrog(scene,colliders){
 const group=new T.Group();group.name='Common_stage_frog';group.position.set(...FROG_AT);
 const animal=new T.Group();animal.name='Common_stage_frog_body';animal.position.y=FROG_BODY_Y;group.add(animal);
 const skin=new T.MeshPhysicalMaterial({map:marble(),roughness:.19,clearcoat:1,clearcoatRoughness:.08,emissive:0x195b69,emissiveIntensity:.12});
 const moss=new T.MeshStandardMaterial({color:0x43962d,roughness:1}),wood=new T.MeshStandardMaterial({color:0xb08a54,roughness:1});
 const white=new T.MeshPhysicalMaterial({color:0xe7ffd9,roughness:.12,clearcoat:1}),iris=new T.MeshPhysicalMaterial({map:marble(true),roughness:.1,emissive:0x669999,emissiveIntensity:.18});
 const dark=new T.MeshStandardMaterial({color:0x07171c,roughness:.12}),parts=new Map();
 const put=(mat,g)=>{let a=parts.get(mat);if(!a)parts.set(mat,a=[]);a.push(g);};
 const oval=(mat,p,s)=>put(mat,new T.SphereGeometry(1,24,16).scale(...s).translate(...p));
 // A broken end and coarse bark ridges are geometry, so no outside image is needed.
 const bark=new T.MeshStandardMaterial({color:0x68442b,roughness:1});
 const log=new T.CylinderGeometry(.13,.15,.94,19,5);const p=log.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=p.getY(i),rough=1+.07*Math.sin(Math.atan2(z,x)*13+y*17);p.setXYZ(i,x*rough,y+(y>.46?.025*Math.sin(i*12.4):0),z*rough);}log.computeVertexNormals();put(bark,log.rotateX(Math.PI/2).translate(0,.15,0));
 for(const z of [-.474,.474])put(wood,new T.CircleGeometry(.12,24).rotateY(z<0?Math.PI:0).translate(0,.15,z));
 for(let i=0;i<18;i++){const a=i*2.399,z=.35*Math.sin(i*9);oval(moss,[.085*Math.cos(a),.235+.018*Math.sin(i),z],[.06,.025,.09]);}
 const assemble=(root,y)=>{for(const [mat,geometries] of parts){const g=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());root.add(new T.Mesh(g.translate(0,y,0),mat));}parts.clear();};
 assemble(group,0);
 // A low plump body, folded haunches and splayed front toes face the seats (-X).
 oval(skin,[.015,.345,0],[.19,.17,.18]);oval(skin,[-.105,.405,0],[.14,.105,.185]);
 for(const s of [-1,1]){
  oval(skin,[.09,.285,s*.18],[.13,.09,.105]);oval(skin,[-.09,.26,s*.2],[.12,.035,.045]);
  oval(skin,[-.17,.31,s*.115],[.035,.1,.035]);
  for(let i=0;i<3;i++)oval(skin,[-.205-i*.012,.23,s*(.12+i*.027)],[.045,.018,.014]);
  oval(skin,[-.12,.49,s*.115],[.075,.075,.07]);oval(white,[-.165,.493,s*.12],[.045,.055,.052]);
  oval(iris,[-.201,.495,s*.12],[.013,.041,.04]);oval(dark,[-.213,.496,s*.12],[.007,.03,.014]);
  oval(white,[-.218,.514,s*.12-.012],[.004,.009,.008]);
 }
 const smile=new T.CatmullRomCurve3([new T.Vector3(-.221,.392,-.125),new T.Vector3(-.244,.375,0),new T.Vector3(-.221,.392,.125)]);
 put(dark,new T.TubeGeometry(smile,20,.004,5,false));
 assemble(animal,-FROG_BODY_Y);
 scene.add(group);
 // A single small collider includes the frog's back, above the walker's step height.
 const box=new T.Mesh(new T.BoxGeometry(...FROG_SIZE)),triangles=[];meshTriangles(box,triangles);box.geometry.dispose();box.material.dispose();
 colliders.addMover('Common_stage_frog',triangles,new T.Matrix4().makeTranslation(FROG_AT[0],FROG_AT[1]+FROG_SIZE[1]/2,FROG_AT[2]));
 return {group,animal,near(p){return frogInReach(p.x,p.y,p.z)?{kind:'frog',label:'Lick the Frog'}:null;},
  show(holding,grip){
   const parent=holding&&grip?grip:group;
   if(animal.parent!==parent){parent.add(animal);animal.position.y=parent===group?FROG_BODY_Y:0;}
   animal.visible=!holding||!!grip;
  }};
}
