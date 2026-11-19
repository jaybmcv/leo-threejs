import * as T from 'three';
import {toWorld} from '../plan/rooms.js';
import {walkCanvas} from './canvas.js';
import {createPortableSelfie} from './portable-selfie.js';
import {createPrankTiming} from './prank-timing.js';
import {faceSurface} from './catnip-face.js';

// A local prank on the open Deck 6 floor. Nothing here is sent to Leo live.
export const PRANK={at:toWorld('circulation-6',[125,0,4.5]),yaw:27*Math.PI/180,portraitYaw:-33*Math.PI/180,behind:1.8,reach:1.45};
const white=0xfaf4df,green=0x75f500,yellow=0xffbf13;
const material=(color,roughness=.65)=>new T.MeshStandardMaterial({color,roughness});
function mesh(parent,geometry,mat,at,scale){const o=new T.Mesh(geometry,mat);o.position.set(...at);if(scale)o.scale.set(...scale);parent.add(o);return o;}
function dispose(root){if(!root)return;root.removeFromParent();const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[]))materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose();}}
function warning(){
 const canvas=walkCanvas();if(!canvas)return null;canvas.width=640;canvas.height=800;const c=canvas.getContext('2d');
 const paint=()=>{
 c.fillStyle='#303438';c.fillRect(0,0,640,800);c.fillStyle='#f3edda';c.fillRect(18,18,604,764);
 for(const x of [9,631])for(const y of [10,400,790]){c.fillStyle='#a5a49a';c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();}
 c.textAlign='center';c.fillStyle='#171b1c';c.font='800 122px Archivo, sans-serif';c.fillText('DO',320,157);
 c.fillStyle='#bb2420';c.font='900 204px Archivo, sans-serif';c.fillText('NOT',320,365);
 c.fillStyle='#171b1c';c.font='800 79px Archivo, sans-serif';c.fillText('PRESS THE',320,523);c.font='900 123px Archivo, sans-serif';c.fillText('BUTTON',320,693);
 };paint();const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 if(typeof document!=='undefined')document.fonts?.ready.then(()=>{paint();texture.needsUpdate=true;});return texture;
}
export function prankFittings(){
 const group=new T.Group();group.name='Do_not_press_button';group.position.set(...PRANK.at);group.rotation.y=PRANK.yaw;
 const grey=material(0x777b78,.95),dark=material(0x393f3e),red=material(0xc8201b,.3),metal=material(0x92968e);
 const box=(w,h,d,at,mat=grey)=>mesh(group,new T.BoxGeometry(w,h,d),mat,at);
 box(.7,.1,.7,[0,.05,0],dark);box(.52,.87,.52,[0,.515,0]);box(.64,.08,.64,[0,.99,0],dark);
 mesh(group,new T.CylinderGeometry(.12,.12,.05,24),metal,[0,1.055,0]);const button=mesh(group,new T.CylinderGeometry(.09,.09,.06,24),red,[0,1.105,0]);
 // Scratches are inset on the front face, with no extra clue above the button.
 for(let i=0;i<9;i++)box(.055+i%3*.016,.007,.003,[(i%3-1)*.15,.2+Math.floor(i/3)*.24,-.262],metal);
 for(const x of [-.48,.48]){box(.055,1.65,.055,[x,.825,PRANK.behind],dark);box(.24,.04,.3,[x,.02,PRANK.behind],dark);}
 box(1.28,1.6,.07,[0,1.75,PRANK.behind],dark);
 const sign=mesh(group,new T.PlaneGeometry(1.28,1.6),new T.MeshBasicMaterial({map:warning(),color:0xffffff}),[0,1.75,PRANK.behind-.037]);sign.rotation.y=Math.PI;
 group.updateMatrixWorld(true);
 // A separate mover keeps this small fitting out of the prepared ship's geometry.
 const triangles=[];group.traverse(o=>{if(!o.isMesh||o===sign)return;const g=o.geometry.toNonIndexed(),p=g.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);triangles.push(v.x,v.y,v.z);}g.dispose();});
 return {group,button,triangles};
}

// Attach overlays in the skin's bind frame, as the lounge's catnip face does.
function onBone(walker,bone,root){
 const body=walker.figure.asset.meshes.find(m=>m.name==='body'),s=body.skeleton,b=walker.figure.bones.get(bone),i=s.bones.indexOf(b);
 if(i<0)throw Error('Prank overlay is missing '+bone);root.matrixAutoUpdate=false;root.matrix.copy(s.boneInverses[i]).multiply(body.bindMatrix);b.add(root);return root;
}
function catMess(walker){
 const head=new T.Group(),body=new T.Group(),hat=new T.Group(),sphere=new T.SphereGeometry(1,12,8),slime=material(green,.16),flour=material(white,1),yolk=material(yellow,.2);
 const side=new T.MeshBasicMaterial({side:T.DoubleSide}),surfaces=walker.figure.asset.meshes.filter(m=>['body','hoodie.001'].includes(m.name)).map(m=>new T.Mesh(m.geometry,side)),ray=new T.Raycaster();
 // Keep the centre of the face readable; blobs follow the head, torso and hat without changing their materials.
 for(let i=0;i<18;i++){const a=i*2.4,x=Math.sin(a)*.19,z=Math.cos(a)*.16,y=1.43+(i%3)*.045;
  mesh(head,sphere,slime,[x,y,z],[.055,.045+(i%4)*.025,.045]);}
 for(let i=0;i<15;i++){const x=(i%3-1)*.12,y=.65+Math.floor(i/3)*.13;ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));const z=(ray.intersectObjects(surfaces,false)[0]?.point.z??.19)+.022;
  mesh(body,sphere,i%3===0?yolk:i%3===1?flour:slime,[x,y,z],[.07,.06,.025]);}
 side.dispose();
 mesh(head,sphere,flour,[-.17,1.38,.14],[.09,.035,.035]);mesh(head,sphere,yolk,[.19,1.4,.13],[.05,.07,.027]);
 // The hat's actual bounds determine the splats, including a hat changed while messy.
 let lastHat=null;
 const fitHat=()=>{const mount=walker.hat?.mount;if(lastHat===mount||!mount?.children.length)return;lastHat=mount;
  for(const o of [...hat.children])hat.remove(o);mount.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(mount),inv=mount.matrixWorld.clone().invert();box.applyMatrix4(inv);
  const size=box.getSize(new T.Vector3()),top=box.max.y,centre=box.getCenter(new T.Vector3());
  for(let i=0;i<8;i++)mesh(hat,sphere,i%3===0?flour:i%3===1?yolk:slime,[centre.x+Math.sin(i*2.4)*size.x*.28,top-size.y*.05,centre.z+Math.cos(i*2.4)*size.z*.25],[size.x*.09,size.y*.12,size.z*.1]);
  mount.add(hat);};
 onBone(walker,'spine.006',head);onBone(walker,'spine.003',body);fitHat();
 return {head,body,hat,update:fitHat,dispose(){dispose(head);dispose(body);dispose(hat);}};
}
function shockedFace(walker){
 const root=new T.Group(),dark=new T.MeshBasicMaterial({color:0x291c20}),cream=new T.MeshBasicMaterial({color:0xfffbed}),sphere=new T.SphereGeometry(1,16,10),surface=faceSurface(walker.figure.asset);
 // Wide whites and small pupils, raised brows and clenched teeth over the existing face.
 for(const s of [-1,1]){mesh(root,sphere,cream,[s*.079,1.317,.186],[.049,.057,.025]);mesh(root,sphere,dark,[s*.079,1.316,.212],[.014,.022,.008]);
  const brow=mesh(root,new T.BoxGeometry(.067,.009,.009),dark,[s*.085,1.389,.178]);brow.rotation.z=-s*.25;}
 mesh(root,sphere,dark,[0,1.207,.178],[.066,.025,.012]);mesh(root,sphere,cream,[0,1.207,.188],[.053,.016,.007]);
 for(const x of [-.027,0,.027])mesh(root,new T.BoxGeometry(.003,.022,.004),dark,[x,1.207,.195]);
 for(const s of [-1,1]){const corner=mesh(root,new T.BoxGeometry(.027,.006,.007),dark,[s*.06,1.195,.19]);corner.rotation.z=-s*.5;}
 for(const o of root.children){const p=surface(o.position.x,o.position.y).p;o.position.z=p.z+o.position.z-.171;}surface.dispose();
 onBone(walker,'spine.006',root);return root;
}
function effects(scene,feet){
 const root=new T.Group(),air=new T.Group(),floor=new T.Group();root.name='Prank_mess';root.position.copy(feet);root.add(air,floor);scene.add(root);
 const sphere=new T.SphereGeometry(1,10,7),slime=material(green,.12),dust=material(white,1),yolk=material(yellow,.16),shell=material(white,.9);
 dust.transparent=true;dust.opacity=.55;dust.depthWrite=false;
 const stream=mesh(air,new T.CylinderGeometry(.11,.16,1,12),slime,[0,2.9,0],[1,2.8,1]);
 const puffs=Array.from({length:16},(_,i)=>mesh(air,sphere,dust,[0,1.25,0],[.15,.15,.15]));
 const eggs=Array.from({length:5},(_,i)=>mesh(air,sphere,shell,[Math.sin(i*2.4)*.22,3.2,Math.cos(i*2.4)*.18],[.07,.095,.07]));
 const shards=Array.from({length:12},(_,i)=>mesh(air,new T.TetrahedronGeometry(.045),shell,[0,1.55,0]));
 mesh(floor,sphere,slime,[0,.018,0],[.59,.02,.52]);
 for(let i=0;i<14;i++){const a=i*2.4,r=.17+(i%4)*.12,x=Math.sin(a)*r,z=Math.cos(a)*r;
  mesh(floor,sphere,i%3===0?yolk:i%3===1?dust:shell,[x,.035+i%3*.008,z],[.08+i%2*.04,.018,.065]);}
 return {root,air,floor,update(t){
  stream.visible=t<1.1;stream.scale.x=stream.scale.z=.85+Math.sin(t*33)*.12;
  for(let i=0;i<puffs.length;i++){const o=puffs[i],v=t-.8-i*.025;o.visible=v>0&&v<1.2;const r=Math.max(0,v)*.52,a=i*2.4;o.position.set(Math.sin(a)*r,1.15+v*.45,Math.cos(a)*r);o.scale.setScalar(.12+Math.max(0,v)*.21);}
  for(let i=0;i<eggs.length;i++){const o=eggs[i],v=t-1.5-i*.13;o.visible=v>=0&&v<.43;o.position.y=3.5-Math.max(0,v)*4.7;}
  for(let i=0;i<shards.length;i++){const o=shards[i],v=t-1.9-(i%4)*.12,a=i*2.4;o.visible=v>=0&&v<.8;o.position.set(Math.sin(a)*(.12+v*.35),1.53-v*1.6,Math.cos(a)*(.12+v*.35));o.rotation.set(v*6,i,v*4);}
  floor.visible=t>.3;for(let i=1;i<floor.children.length;i++)floor.children[i].visible=t>(i%3===1?.8:1.9);
 },dispose(){dispose(root);}};
}

function framePhoto(background,cat,name){
 const out=document.createElement('canvas');out.width=1200;out.height=1000;const c=out.getContext('2d');c.fillStyle='#243b40';c.fillRect(0,0,1200,1000);
 c.save();c.translate(600,500);c.rotate(-.035);c.fillStyle='#fff5d9';c.fillRect(-548,-450,1096,900);
 c.save();c.beginPath();c.rect(-506,-315,1012,620);c.clip();c.filter='blur(24px)';c.drawImage(background,-535,-340,1070,670);c.filter='none';c.drawImage(cat,-506,-315,1012,620);c.restore();
 c.fillStyle='#28402b';c.font='900 100px Archivo, sans-serif';c.textAlign='center';c.fillText("Ha! Gottem'",0,-346);
 c.font='800 49px Archivo, sans-serif';c.fillText(name,0,390,930);
 for(let i=0;i<14;i++){const x=-515+i*78,y=-304;c.fillStyle='#75d900';c.beginPath();c.roundRect(x,y,20,25+(i%4)*14,10);c.fill();}
 for(const [x,y] of [[-503,313],[502,-330],[489,304]]){c.fillStyle='#fff';for(let i=0;i<6;i++){c.beginPath();c.arc(x+Math.sin(i*2.4)*28,y+Math.cos(i*2.4)*22,17,0,Math.PI*2);c.fill();}c.fillStyle='#ffbe18';c.beginPath();c.ellipse(x,y,24,18,.3,0,Math.PI*2);c.fill();}
 c.restore();return out;
}

export function createPrankButton({scene,colliders,renderer,draw,walker:cat,controller,input,follow,name,onBegin}){
 const fitting=prankFittings();colliders.addMover('Do_not_press_button',fitting.triangles);
 const lens=createPortableSelfie();lens.set('dist',3.2);lens.set('height',.1);lens.set('fov',52);
 let mess=null,face=null,fx=null,url=null,sheet=null,oldMode=null;
 const release=()=>{input.enabled=true;input.down.clear();if(oldMode!==null){follow.mode=oldMode;oldMode=null;}if(fx)fx.air.visible=false;};
 const close=()=>{if(sheet){sheet.remove();sheet=null;}if(url){URL.revokeObjectURL(url);url=null;}release();};
 const copy=()=>{const c=document.createElement('canvas');c.width=renderer.domElement.width;c.height=renderer.domElement.height;c.getContext('2d').drawImage(renderer.domElement,0,0);return c;};
 function capture(){
  const walker=cat(),shown=walker.holder.visible,hidden=[],alpha=renderer.getClearAlpha(),colour=renderer.getClearColor(new T.Color()),background=scene.background,priorTarget=renderer.getRenderTarget();
  const target=new T.WebGLRenderTarget(renderer.domElement.width,renderer.domElement.height);target.texture.colorSpace=T.SRGBColorSpace;
  let bg,sharp;
  try{
   lens.aim(renderer.domElement.width,renderer.domElement.height);lens.camera.layers.enableAll();
   walker.holder.visible=false;draw(lens.camera);bg=copy();walker.holder.visible=true;
   const belongs=o=>{for(let p=o;p;p=p.parent)if(p===walker.holder)return true;return false;};
   scene.traverse(o=>{if((o.isMesh||o.isLine||o.isPoints||o.isSprite)&&o.visible&&!belongs(o)){hidden.push(o);o.visible=false;}});
   // The walk's default framebuffer is opaque. An RGBA target gives a sharp cat cutout over the blurred scenery.
   scene.background=null;renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,lens.camera);
   const pixels=new Uint8Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,pixels);
   sharp=document.createElement('canvas');sharp.width=target.width;sharp.height=target.height;const c=sharp.getContext('2d'),data=c.createImageData(sharp.width,sharp.height),row=sharp.width*4;
   for(let y=0;y<sharp.height;y++)data.data.set(pixels.subarray((sharp.height-y-1)*row,(sharp.height-y)*row),y*row);c.putImageData(data,0,0);
  }finally{renderer.setRenderTarget(priorTarget);target.dispose();for(const o of hidden)o.visible=true;scene.background=background;renderer.setClearColor(colour,alpha);walker.holder.visible=shown;}
  const displayName=String(name()||'Voyager').slice(0,80),photo=framePhoto(bg,sharp,displayName);
  sheet=document.createElement('div');sheet.id='prank-photo';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label',"Ha! Gottem' souvenir");
  sheet.style.cssText='position:fixed;inset:0;z-index:1100;background:#142026e8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px';
  photo.id='prank-souvenir';photo.setAttribute('aria-label',`Ha! Gottem' — ${displayName}`);photo.style.cssText='max-width:min(92vw,850px);max-height:78vh;object-fit:contain';sheet.append(photo);
  const buttons=document.createElement('div');buttons.style.cssText='display:flex;gap:16px';
  for(const label of ['Download','Close']){const b=document.createElement('button');b.textContent=label;b.id='prank-'+label.toLowerCase();b.style.cssText='font:700 18px Archivo,sans-serif;padding:12px 28px;border:2px solid #364a32;border-radius:8px;background:#fff5d9;color:#243b40;cursor:pointer';buttons.append(b);}
  sheet.append(buttons);document.body.append(sheet);input.enabled=false;input.down.clear();input.releasePointer();
  sheet.querySelector('#prank-close').onclick=()=>{timing.cancel();close();};
  sheet.querySelector('#prank-download').onclick=()=>{photo.toBlob(blob=>{if(!blob||!sheet)return;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='leo-ha-gottem.png';a.click();},'image/png');};
  sheet.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const a=[...buttons.children],i=a.indexOf(document.activeElement);a[(i+(e.shiftKey?-1:1)+a.length)%a.length].focus();}});
  sheet.querySelector('#prank-close').focus();
 }
 const timing=createPrankTiming({
  begin(){onBegin();close();input.enabled=false;input.down.clear();controller.velocity.set(0,0,0);oldMode=follow.mode;follow.mode='third';
   mess?.dispose();mess=catMess(cat());dispose(face);face=shockedFace(cat());fx?.dispose();fx=effects(scene,controller.position);point();},
  photo:capture,
  release(){release();if(sheet)input.enabled=false;},
  reset(){fx?.dispose();fx=null;},
  clean(){mess?.dispose();mess=null;dispose(face);face=null;},
  error(error){close();console.warn('Prank reset safely',error);},
 });
 function point(){const walker=cat();lens.point(walker.holder.position,walker.holder.rotation.y,1.05,null);lens.camera.aspect=renderer.domElement.width/renderer.domElement.height;lens.camera.fov=52;lens.camera.updateProjectionMatrix();}
 const cancel=()=>{try{timing.cancel();}finally{close();}};
 addEventListener('pagehide',()=>{timing.dispose();close();});
 addEventListener('error',()=>{if(timing.locked||sheet)cancel();});
 addEventListener('unhandledrejection',()=>{if(timing.locked||sheet)cancel();});
 return {group:fitting.group,camera:lens.camera,timing,
  get locked(){return timing.locked;},get isOpen(){return !!sheet;},get messy(){return timing.messy;},get floorMess(){return !!fx;},get shocked(){return timing.shocked;},
  near(p){const dx=p.x-PRANK.at[0],dz=p.z-PRANK.at[2];if(Math.abs(p.y-PRANK.at[1])>.6||Math.hypot(dx,dz)>PRANK.reach||dx*Math.sin(PRANK.yaw)+dz*Math.cos(PRANK.yaw)>-.45)return null;return timing.cooling?{kind:'waiting',label:'Button resetting…'}:{kind:'prank-button',label:'Press the button'};},
  start(){return timing.start();},cancel,
  update(){try{if(face)face.visible=timing.shocked;mess?.update();if(timing.locked){point();fx?.update(timing.elapsed);}fitting.button.position.y=timing.cooling?1.075:1.105;}catch(error){cancel();console.warn('Prank reset safely',error);}},
 };
}
