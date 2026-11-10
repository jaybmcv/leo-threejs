import {RecordGeometry,recordMerged} from "../v2/prepared-geometry-record.js";
import {walkCanvas} from './canvas.js';
import * as T from 'three';
import {CROWN} from '../fin-crown.js';
import {shapePoint} from '../concept-shape.js';

// The selfie booth in the crown lounge: a Mars backdrop across the aft end of the centre aisle and a camera on a tripod
// facing it. Use the camera and it counts down 5 seconds, time to join the others in front of the backdrop, then takes
// the photo from the lens and frames it in Mars Cats Voyage colours.
// The photo is 2:1, wide enough for the whole 9.6 m backdrop (about 11 m across at its plane) and a group spread along it.
const BACK_X=-272.5,LENS_X=-265.5,WIDTH=9.6,HEIGHT=4.4,FOV=46,ASPECT=2,COUNT=5,REACH=1.9;
const OUT={w:1600,margin:40,band:150};
const FONT={display:'"Archivo", "Sora", sans-serif',mono:'"JetBrains Mono", ui-monospace, monospace'};
const ORANGE='#f85800';

const mark=typeof Image==='undefined'?Promise.resolve(null):new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='brand/mark.png';});

// Stars over a deep-space gradient, Mars rising on the right and the voyage's name across the top.
function backdropTexture(){
 const canvas=walkCanvas();canvas.width=2048;canvas.height=Math.round(2048*HEIGHT/WIDTH);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 let selected=0,loadedLogo=null;
 const paint=logo=>{
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const colours=[['#05080d','#152434'],['#250e29','#df683c'],['#071822','#155a59'],['#130c2b','#393067'],['#080d25','#321d55']][selected];
  const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,colours[0]);sky.addColorStop(1,colours[1]);c.fillStyle=sky;c.fillRect(0,0,w,h);
  let seed=37;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<700;i++){c.fillStyle=`rgba(230,238,245,${.35+random()*.6})`;c.beginPath();c.arc(random()*w,random()*h,.8+random()*2.4,0,Math.PI*2);c.fill();}
  if(selected===0){
  const mx=w*.8,my=h*.78,mr=h*.42,mars=c.createRadialGradient(mx-mr*.35,my-mr*.4,mr*.1,mx,my,mr);
  mars.addColorStop(0,'#f08a4b');mars.addColorStop(.6,'#c4532a');mars.addColorStop(1,'#6e2412');
  c.fillStyle=mars;c.beginPath();c.arc(mx,my,mr,0,Math.PI*2);c.fill();
  }else if(selected===1){
   const sun=c.createRadialGradient(w*.8,h*.47,0,w*.8,h*.47,h*.3);sun.addColorStop(0,'#ffe5a4');sun.addColorStop(1,'#f07840');c.fillStyle=sun;c.beginPath();c.arc(w*.8,h*.47,h*.3,0,Math.PI*2);c.fill();
   c.fillStyle='#512338';c.beginPath();c.moveTo(0,h);c.lineTo(0,h*.83);c.lineTo(w*.18,h*.66);c.lineTo(w*.35,h*.84);c.lineTo(w*.57,h*.64);c.lineTo(w*.78,h*.85);c.lineTo(w,h*.72);c.lineTo(w,h);c.fill();
  }else if(selected===2){
   c.lineWidth=32;for(let i=0;i<5;i++){c.strokeStyle=`rgba(76,239,192,${.13+i*.035})`;c.beginPath();c.moveTo(-30,h*(.25+i*.1));c.bezierCurveTo(w*.25,h*(-.1+i*.1),w*.65,h*(.75+i*.06),w+30,h*(.12+i*.1));c.stroke();}
  }else if(selected===3){
   c.strokeStyle='#bca6ff';c.lineWidth=8;c.beginPath();c.ellipse(w*.8,h*.58,h*.42,h*.13,-.35,0,Math.PI*2);c.stroke();c.fillStyle='#ed9e70';c.beginPath();c.arc(w*.8,h*.58,h*.19,0,Math.PI*2);c.fill();
   c.strokeStyle='rgba(187,177,255,.5)';c.lineWidth=3;for(let i=0;i<5;i++){c.beginPath();c.arc(w*.8,h*.58,h*(.26+i*.08),0,Math.PI*2);c.stroke();}
  }else{
   c.strokeStyle='rgba(255,127,107,.55)';c.lineWidth=3;for(let i=0;i<13;i++){c.beginPath();c.moveTo(w*.5,h*.58);c.lineTo(w*i/12,h);c.stroke();}for(let i=0;i<6;i++){const y=h*(.62+.38*(i/5)**2);c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  }

  c.textAlign='center';c.fillStyle='#f4f0e8';c.font=`500 112px ${FONT.display}`;c.fillText('MARS CATS VOYAGE',w*.42,h*.34);
  c.fillStyle=ORANGE;c.font=`400 34px ${FONT.mono}`;c.fillText('LEO  ·  CROWN LOUNGE',w*.42,h*.34+70);
  if(logo){const s=150;c.drawImage(logo,w*.42-s/2,h*.34-112-s,s,s*logo.height/logo.width);}
  texture.needsUpdate=true;
 };
 paint(null);
 // The brand fonts and mark may still be loading: paint again once they're in.
 Promise.all([mark,globalThis.document?.fonts?.ready]).then(([logo])=>{loadedLogo=logo;paint(loadedLogo);});
 return {texture,canvas,set(index){if(Number.isInteger(index)&&index>=0&&index<5){selected=index;paint(loadedLogo);}}};
}

// Tagged as one dressing, so its collision, prepared templates and model nodes can be replaced alone
// (scripts/fast-dressing-v2.mjs).
export function createSelfieBooth(){
 const floor=shapePoint([BACK_X,CROWN.floor,0])[1],group=new T.Group();group.name='Selfie_booth';group.userData.fastDressing='selfie';
 const navy=new T.MeshStandardMaterial({name:'Selfie_navy',color:0x233b4b,roughness:.6});
 const bronze=new T.MeshStandardMaterial({name:'Selfie_bronze',color:0x9d7950,roughness:.4,metalness:.65});
 const black=new T.MeshStandardMaterial({name:'Selfie_camera_body',color:0x1a1c20,roughness:.45,metalness:.3});
 const box=(name,size,at,material)=>{const o=new T.Mesh(new RecordGeometry("src/walk/selfie.js:0",T.BoxGeometry,...size),material);o.name=name;o.position.set(...at);group.add(o);return o;};
 // The backdrop: a navy frame on a low plinth, the printed face flush on its forward side.
 box('Selfie_backdrop',[.2,HEIGHT+.2,WIDTH+.2],[BACK_X-.1,floor+.2+HEIGHT/2,0],navy);
 box('Selfie_backdrop_plinth',[.5,.2,WIDTH+.2],[BACK_X-.1,floor+.1,0],navy);
 const backdrop=backdropTexture();
 const art=new T.Mesh(new RecordGeometry("src/walk/selfie.js:1",T.PlaneGeometry,WIDTH,HEIGHT),new T.MeshBasicMaterial({map:backdrop.texture,toneMapped:false}));
 art.name='Selfie_backdrop_art';art.rotation.y=Math.PI/2;art.position.set(BACK_X+.01,floor+.3+HEIGHT/2,0);group.add(art);
 // The camera: a tripod, the body and lens facing the backdrop, a tally light that blinks through the countdown.
 const lensY=floor+1.2;
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3,leg=new T.Mesh(new RecordGeometry("src/walk/selfie.js:2",T.CylinderGeometry,.025,.025,1.2,8),bronze);leg.name='Selfie_tripod_leg';
  leg.position.set(LENS_X+Math.cos(a)*.18,floor+.55,Math.sin(a)*.18);leg.rotation.set(-Math.sin(a)*.28,0,Math.cos(a)*.28);group.add(leg);}
 box('Selfie_camera',[.22,.2,.32],[LENS_X,lensY,0],black);
 const lens=new T.Mesh(new RecordGeometry("src/walk/selfie.js:3",T.CylinderGeometry,.075,.085,.16,20),black);lens.name='Selfie_camera_lens';lens.rotation.z=Math.PI/2;lens.position.set(LENS_X-.18,lensY,0);group.add(lens);
 const tally=new T.Mesh(new RecordGeometry("src/walk/selfie.js:4",T.SphereGeometry,.025,10,8),new T.MeshBasicMaterial({color:0x3a1006}));tally.name='Selfie_tally_light';tally.position.set(LENS_X-.11,lensY+.07,.12);group.add(tally);
 // The photo's view: from the lens, tipped 5° up so a group standing 3 m out is in head to toe and the backdrop's name
 // is in above them.
 const camera=new T.PerspectiveCamera(FOV,ASPECT,.05,150);
 const setAngle=index=>{if(!Number.isInteger(index)||index<0||index>2)return;camera.position.set(LENS_X-.26,lensY,[0,-2.5,2.5][index]);camera.lookAt(BACK_X,lensY+(LENS_X-.26-BACK_X)*Math.tan(5*Math.PI/180),0);};
 setAngle(0);
 const stand=new T.Vector3(LENS_X+.2,floor,0);
 // Its origin on the floor, so main.js files it with the crown's deck band.
 for(const o of group.children)o.position.y-=floor;group.position.y=floor;
 let ends=0;
 return {
  group,camera,backdropCanvas:backdrop.canvas,
  setBackdrop(index){backdrop.set(index);},setAngle,
  get counting(){return ends>0;},
  // The camera's use prompt, or the countdown while it runs.
  near(p){if(Math.abs(p.y-floor)>1.5||Math.hypot(p.x-stand.x,p.z-stand.z)>REACH)return null;
   return ends?{kind:'waiting',label:'Photo in '+Math.max(1,Math.ceil((ends-performance.now())/1000))+'…'}:{kind:'selfie',label:'Set up a group photo'};},
  // A countdown with `left` ms to go: 5 s from a press here, less when it was pressed on another page (Leo live).
  start(left=COUNT*1000,now=performance.now()){if(!ends)ends=now+left;},
  // Each frame: the seconds left (for the on-screen count), and true once the photo is due.
  update(now){
   if(!ends)return {left:0,due:false};
   const left=Math.max(0,Math.ceil((ends-now)/1000));
   tally.material.color.setHex(left<=1||(ends-now)%1000>500?0xff2a10:0x3a1006);
   if(now<ends)return {left,due:false};
   ends=0;tally.material.color.setHex(0x3a1006);return {left:0,due:true};
  },
  // Set the camera for a canvas of w×h so the 2:1 crop taken from it shows FOV degrees top to bottom.
  aim(w,h){const crop=Math.min(h,w/ASPECT);camera.aspect=w/h;camera.fov=2*Math.atan(Math.tan(FOV*Math.PI/360)*h/crop)*180/Math.PI;camera.updateProjectionMatrix();},
  // Right after the photo is drawn into `source`: crop it to 2:1 and frame it. Resolves to a canvas.
  async frame(source,names=[],showNames=true){
   const w=source.width,h=source.height,cw=Math.min(w,h*ASPECT),ch=cw/ASPECT;
   const pw=OUT.w-OUT.margin*2,ph=Math.round(pw/ASPECT),out=walkCanvas();out.width=OUT.w;out.height=OUT.margin+ph+OUT.band;
   const logo=await mark;await globalThis.document?.fonts?.ready;
   const c=out.getContext('2d');c.drawImage(source,(w-cw)/2,(h-ch)/2,cw,ch,OUT.margin,OUT.margin,pw,ph);
   if(showNames){
    c.save();c.font=`500 24px ${FONT.display}`;c.textAlign='center';c.textBaseline='middle';
    for(const name of [...names].sort((a,b)=>b.z-a.z)){
     const sx=(name.x+1)*w/2-(w-cw)/2,sy=(1-name.y)*h/2-(h-ch)/2;
     if(sx<0||sx>cw||sy<0||sy>ch)continue;
     const raw=String(name.name||'').trim();let label=raw;if(!label)continue;
     while(c.measureText(label+'…').width>300&&label.length>1)label=label.slice(0,-1);
     if(label!==raw)label+='…';
     const boxH=40,boxW=Math.min(328,c.measureText(label).width+28),x=OUT.margin+sx/cw*pw,y=OUT.margin+sy/ch*ph-boxH-6;
     const left=Math.max(OUT.margin,Math.min(OUT.margin+pw-boxW,x-boxW/2)),top=Math.max(OUT.margin,Math.min(OUT.margin+ph-boxH,y));
     c.fillStyle='rgba(5,5,7,.78)';c.beginPath();c.roundRect(left,top,boxW,boxH,boxH/2);c.fill();
     c.fillStyle='#f4f0e8';c.fillText(label,left+boxW/2,top+boxH/2,300);
    }
    c.restore();
   }
   c.globalCompositeOperation='destination-over';c.fillStyle='#0b0b10';c.fillRect(0,0,out.width,out.height);c.globalCompositeOperation='source-over';
   c.fillStyle=ORANGE;c.fillRect(OUT.margin,OUT.margin+ph,pw,4);
   const y=OUT.margin+ph+OUT.band/2+4;let x=OUT.margin;
   if(logo){const s=86;c.drawImage(logo,x,y-s/2,s,s*logo.height/logo.width);x+=s+24;}
   c.textBaseline='alphabetic';c.fillStyle='#f4f0e8';c.font=`500 46px ${FONT.display}`;c.fillText('MARS CATS VOYAGE',x,y+4);
   c.fillStyle='#a6a5b4';c.font=`400 20px ${FONT.mono}`;
   c.fillText(`LEO · CROWN LOUNGE · ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}).toUpperCase()}`,x,y+38);
   c.textAlign='right';c.fillStyle=ORANGE;c.font=`400 20px ${FONT.mono}`;c.fillText('marscatsvoyage.com',OUT.margin+pw,y+38);
   return out;
  },
 };
}
