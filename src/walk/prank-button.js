import * as T from 'three';
import {toWorld} from '../plan/rooms.js';
import {walkCanvas} from './canvas.js';
import {createPortableSelfie} from './portable-selfie.js';
import {createPrankTiming} from './prank-timing.js';
import {faceSurface} from './catnip-face.js';
import {Colliders} from './collision.js';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';

// A local prank on the open Deck 6 floor. Nothing here is sent to Leo live.
export const PRANK={at:toWorld('circulation-6',[125,0,4.5]),yaw:27*Math.PI/180,portraitYaw:-33*Math.PI/180,behind:1.8,reach:1.45};
const white=0xfaf4df,green=0x75f500,yellow=0xffbf13;
const material=(color,roughness=.65)=>new T.MeshStandardMaterial({color,roughness});
function mesh(parent,geometry,mat,at,scale){const o=new T.Mesh(geometry,mat);o.position.set(...at);if(scale)o.scale.set(...scale);parent.add(o);return o;}
function dispose(root){if(!root)return;root.removeFromParent();const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry&&!o.isSprite)geometries.add(o.geometry);for(const m of [].concat(o.material||[]))materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose();}}
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
 const grey=material(0x9a9d96,.95),dark=material(0x393f3e),red=material(0xc8201b,.3),metal=material(0x92968e);
 // Keep the utility grey readable in the deep shade beneath the lift landing.
 grey.emissive.copy(grey.color);grey.emissiveIntensity=.5;dark.emissive.copy(dark.color);dark.emissiveIntensity=.3;
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

export function attachPrankCollider(colliders,triangles){
 // Prepared addMover consumes baked entries. This local fitting owns its small runtime BVH.
 const mover=new Colliders().addMover('Do_not_press_button',triangles);colliders.movers.push(mover);return mover;
}

// Attach overlays in the skin's bind frame, as the lounge's catnip face does.
function onBone(walker,bone,root){
 const body=walker.figure.asset.meshes.find(m=>m.name==='body'),s=body.skeleton,b=walker.figure.bones.get(bone),i=s.bones.indexOf(b);
 if(i<0)throw Error('Prank overlay is missing '+bone);root.matrixAutoUpdate=false;root.matrix.copy(s.boneInverses[i]).multiply(body.bindMatrix);b.add(root);return root;
}
export function stainWeights(geometry,hit){
 const p=geometry.attributes.position,ids=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight,{a,b,c}=hit.face,bary=T.Triangle.getBarycoord(hit.point,new T.Vector3().fromBufferAttribute(p,a),new T.Vector3().fromBufferAttribute(p,b),new T.Vector3().fromBufferAttribute(p,c),new T.Vector3()),mix=new Map();
 for(const [v,w] of [[a,bary.x],[b,bary.y],[c,bary.z]])for(let k=0;k<4;k++){const id=ids.getComponent(v,k);mix.set(id,(mix.get(id)||0)+w*weights.getComponent(v,k));}
 const best=[...mix].sort((a,b)=>b[1]-a[1]).slice(0,4),total=best.reduce((s,v)=>s+v[1],0);return {ids:Array.from({length:4},(_,k)=>best[k]?.[0]||0),weights:Array.from({length:4},(_,k)=>(best[k]?.[1]||0)/total)};
}
function powderTexture(){
 const canvas=walkCanvas();if(!canvas)return null;canvas.width=canvas.height=128;const c=canvas.getContext('2d'),fade=c.createRadialGradient(64,64,12,64,64,64);fade.addColorStop(0,'#fff');fade.addColorStop(.65,'#ffffffc0');fade.addColorStop(1,'#ffffff00');c.fillStyle=fade;c.fillRect(0,0,128,128);
 c.globalCompositeOperation='destination-out';for(let i=0;i<180;i++){c.globalAlpha=.2+Math.sin(i*7)**2*.45;c.beginPath();c.arc(64+Math.sin(i*2.4)*61,64+Math.cos(i*3.7)*61,.5+i%3,0,Math.PI*2);c.fill();}
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
export const stainSources=asset=>asset.meshes.filter(m=>['body','hoodie.001','hoodie.002'].includes(m.userData.originalName??m.name));
export function createPrankMess(walker){
 const head=[],body=[],hat=new T.Group(),sphere=new T.SphereGeometry(1,12,8),slime=material(green,.16),flour=new T.MeshBasicMaterial({color:white,transparent:true,depthWrite:false,toneMapped:false}),yolk=material(yellow,.2);
 slime.emissive.copy(slime.color);slime.emissiveIntensity=.2;yolk.emissive.copy(yolk.color);yolk.emissiveIntensity=.25;
 const side=new T.MeshBasicMaterial({side:T.DoubleSide}),surfaces=stainSources(walker.figure.asset).map(m=>{const g=m.geometry.clone();g.boundsTree=new MeshBVH(g,{indirect:true});const proxy=new T.Mesh(g,side);proxy.userData.source=m;proxy.raycast=acceleratedRaycast;return proxy;}),ray=new T.Raycaster();ray.firstHitOnly=true;
 const surface=(x,y,back,objects=surfaces)=>{ray.set(new T.Vector3(x,y,back?-1:1),new T.Vector3(0,0,back?1:-1));return ray.intersectObjects(objects,false)[0];};
 // Irregular stains follow the clothing and fur surface instead of sitting on it as round beads.
 function splat(parent,mat,x,y,w,h,seed,back=false){
  const centre=surface(x,y,back);if(!centre)return;const positions=[],uvs=[],skinIndex=[],skinWeight=[],index=[],n=40,offset=(back?-1:1)*(mat===flour ? .026 : .023),source=centre.object.userData.source;
  const point=(px,py)=>{const hit=surface(px,py,back,[centre.object])||centre,skin=stainWeights(centre.object.geometry,hit);positions.push(px,py,hit.point.z+offset);uvs.push(.5+(px-x)/(w*2.7),.5+(py-y)/(h*3.2));skinIndex.push(...skin.ids);skinWeight.push(...skin.weights);};
  point(x,y);
  for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,r=1+.17*Math.sin(a*5+seed)+.12*Math.cos(a*9-seed),drip=mat===slime?Math.max(0,-Math.sin(a))**7*(.45+.3*Math.sin(a*3+seed)**2):0;
   point(x+Math.cos(a)*w*r,y+Math.sin(a)*h*r-drip*h);if(i<n)index.push(0,back?i+2:i+1,back?i+1:i+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));g.setIndex(index);g.computeVertexNormals();
  // Follow the same blended bones as the clothing, including the torso's bends.
  const stain=new T.SkinnedMesh(g,mat);stain.userData.prankSurface=source.userData.originalName??source.name;stain.position.copy(source.position);stain.quaternion.copy(source.quaternion);stain.scale.copy(source.scale);stain.frustumCulled=false;source.parent.add(stain);stain.bind(source.skeleton,source.bindMatrix);parent.push(stain);
 }
 // Powder has a soft, grainy edge; the wet slime and yolk remain glossy.
 flour.map=powderTexture();
 for(const back of [false,true]){
  for(const [x,y,w,h,seed] of [[-.105,1.44,.09,.042,1],[.07,1.46,.1,.05,3],[.16,1.38,.037,.08,5]])splat(head,slime,x,y,w,h,seed,back);
  splat(head,flour,-.15,1.37,.055,.065,7,back);splat(head,yolk,.18,1.4,.035,.048,9,back);
  for(const [x,y,w,h,seed] of [[-.13,.91,.07,.18,2],[.06,.83,.065,.11,4],[.12,1.04,.065,.08,6]])splat(body,slime,x,y,w,h,seed,back);
  for(const [x,y,w,h,seed] of [[-.05,1.03,.14,.1,3],[.13,.73,.09,.07,7],[-.14,.69,.08,.09,9]])splat(body,flour,x,y,w,h,seed,back);
  splat(body,yolk,.09,.94,.07,.049,4,back);splat(body,yolk,-.08,.74,.047,.036,8,back);
 }
 for(const o of surfaces){o.geometry.boundsTree=null;o.geometry.dispose();}surfaces.length=0;side.dispose();
 // The hat's actual bounds determine the splats, including a hat changed while messy.
 let lastHat=null;
 const fitHat=()=>{const mount=walker.hat?.mount;if(lastHat===mount||!mount?.children.length)return;lastHat=mount;
  for(const o of [...hat.children])hat.remove(o);mount.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(mount),inv=mount.matrixWorld.clone().invert();box.applyMatrix4(inv);
  const size=box.getSize(new T.Vector3()),top=box.max.y,centre=box.getCenter(new T.Vector3());
  for(let i=0;i<8;i++)mesh(hat,sphere,i%3===0?flour:i%3===1?yolk:slime,[centre.x+Math.sin(i*2.4)*size.x*.28,top-size.y*.025,centre.z+Math.cos(i*2.4)*size.z*.25],[size.x*(.1+i%2*.03),size.y*.035,size.z*.13]);
  mount.add(hat);};
 fitHat();
 return {head,body,hat,update:fitHat,dispose(){for(const o of [...head,...body])dispose(o);dispose(hat);sphere.dispose();}};
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
 const sphere=new T.SphereGeometry(1,10,7),slime=material(green,.12),dust=new T.MeshBasicMaterial({color:white,toneMapped:false}),yolk=material(yellow,.16),shell=material(white,.9),puff=new T.SpriteMaterial({color:0xffffff,map:powderTexture(),transparent:true,opacity:.5,depthWrite:false,toneMapped:false});
 const stream=mesh(air,new T.CylinderGeometry(.11,.16,1,12),slime,[0,2.9,0],[1,2.8,1]);
 const puffs=Array.from({length:16},()=>{const o=new T.Sprite(puff);air.add(o);return o;});
 const eggs=Array.from({length:5},(_,i)=>mesh(air,sphere,shell,[Math.sin(i*2.4)*.22,3.2,Math.cos(i*2.4)*.18],[.07,.095,.07]));
 const shards=Array.from({length:12},(_,i)=>mesh(air,new T.TetrahedronGeometry(.045),shell,[0,1.55,0]));
 mesh(floor,sphere,slime,[0,.018,0],[.59,.02,.52]);
 for(let i=0;i<14;i++){const a=i*2.4,r=.17+(i%4)*.12,x=Math.sin(a)*r,z=Math.cos(a)*r;
  mesh(floor,sphere,i%3===0?yolk:i%3===1?dust:shell,[x,.035+i%3*.008,z],[.08+i%2*.04,.018,.065]);}
 return {root,air,floor,update(t){
  stream.visible=t<1.1;stream.scale.x=stream.scale.z=.85+Math.sin(t*33)*.12;
  puff.opacity=.5*T.MathUtils.clamp((2.8-t)/1.1,0,1);
  for(let i=0;i<puffs.length;i++){const o=puffs[i],v=t-.8-i*.025;o.visible=v>0&&v<1.65;const r=Math.max(0,v)*.35,a=i*2.4;o.position.set(Math.sin(a)*r,1.15+v*.24,Math.cos(a)*r);o.scale.setScalar(.25+Math.max(0,v)*.14);}
  for(let i=0;i<eggs.length;i++){const o=eggs[i],v=t-1.5-i*.13;o.visible=v>=0&&v<.43;o.position.y=3.5-Math.max(0,v)*4.7;}
  for(let i=0;i<shards.length;i++){const o=shards[i],v=t-1.9-(i%4)*.12,a=i*2.4;o.visible=v>=0&&v<.8;o.position.set(Math.sin(a)*(.12+v*.35),1.53-v*1.6,Math.cos(a)*(.12+v*.35));o.rotation.set(v*6,i,v*4);}
  floor.visible=t>.3;for(let i=1;i<floor.children.length;i++)floor.children[i].visible=t>(i%3===1?.8:1.9);
 },dispose(){dispose(root);}};
}

// The centred part of a w×h capture with the shape of a dw×dh window, as [x,y,width,height]. The selfie lens is aimed
// at the middle of the canvas (portable-selfie.js aim), so a tall phone canvas keeps the cat in its middle band
// instead of being squeezed whole into the wide photo.
export function photoCrop(w,h,dw,dh){const s=Math.min(w/dw,h/dh),cw=dw*s,ch=dh*s;return [(w-cw)/2,(h-ch)/2,cw,ch];}
function framePhoto(background,cat,name){
 const out=document.createElement('canvas');out.width=1200;out.height=1000;const c=out.getContext('2d');c.fillStyle='#243b40';c.fillRect(0,0,1200,1000);
 c.save();c.translate(600,500);c.rotate(-.035);c.fillStyle='#fff5d9';c.fillRect(-548,-450,1096,900);
 c.save();c.beginPath();c.rect(-506,-315,1012,620);c.clip();c.filter='blur(24px)';c.drawImage(background,...photoCrop(background.width,background.height,1070,670),-535,-340,1070,670);
 c.filter='none';c.drawImage(cat,...photoCrop(cat.width,cat.height,1012,620),-506,-315,1012,620);c.restore();
 c.fillStyle='#28402b';c.font='900 100px Archivo, sans-serif';c.textAlign='center';c.fillText("Ha! Gottem'",0,-346);
 c.font='800 49px Archivo, sans-serif';c.fillText(name,0,390,930);
 for(let i=0;i<14;i++){const x=-515+i*78,y=-304;c.fillStyle='#75d900';c.beginPath();c.roundRect(x,y,20,25+(i%4)*14,10);c.fill();}
 for(const [x,y] of [[-503,313],[502,-330],[489,304]]){c.fillStyle='#fff';for(let i=0;i<6;i++){c.beginPath();c.arc(x+Math.sin(i*2.4)*28,y+Math.cos(i*2.4)*22,17,0,Math.PI*2);c.fill();}c.fillStyle='#ffbe18';c.beginPath();c.ellipse(x,y,24,18,.3,0,Math.PI*2);c.fill();}
 c.restore();return out;
}

export function createPrankButton({scene,colliders,renderer,draw,walker:cat,controller,input,follow,name,onBegin}){
 const fitting=prankFittings();attachPrankCollider(colliders,fitting.triangles);
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
   mess?.dispose();mess=createPrankMess(cat());dispose(face);face=shockedFace(cat());fx?.dispose();fx=effects(scene,controller.position);point();},
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
