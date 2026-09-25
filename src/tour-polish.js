import * as T from 'three';
import {encloseNeighborhoodTour} from './tour-enclosures.js';
import {canvasTexture,seeded,oakFloor,standard,glow} from './polish-kit.js';
import {polishForwardDeck,artMaterial} from './forward-polish.js';
import {stylizedTree,plantClumps,EMBERS} from './stylized-plants.js';

// Art pass for the guided tour's stops in Neighborhood 10: the walkthrough cabin, the Deck 15 corridor and the garden
// commons. Other cabins keep their shared materials: meshes here get new materials, shared ones are never edited.
const CABIN={minX:118.4,maxX:123,minZ:1.9,maxZ:8.5,minY:15.9,maxY:20};
const FLOOR_Y=16.3,CEILING_Y=19.6,CORRIDOR_END_X=134;
const GARDEN={minX:109.5,maxX:154.5,minZ:8,maxZ:46,floor:24.3,ceiling:35.5};

const runner=()=>canvasTexture(256,512,(g,w,h)=>{
 g.fillStyle='#2a3440';g.fillRect(0,0,w,h);const rnd=seeded(5);
 for(let i=0;i<2600;i++){g.fillStyle=`rgba(255,255,255,${rnd()*.04})`;g.fillRect(rnd()*w,rnd()*h,2,2);}
 g.strokeStyle='#f85800';g.lineWidth=6;g.strokeRect(18,18,w-36,h-36);g.strokeStyle='rgba(244,240,232,.35)';g.lineWidth=2;g.strokeRect(34,34,w-68,h-68);
});
const weave=(base,stripe)=>canvasTexture(256,256,(g,w,h)=>{
 g.fillStyle=base;g.fillRect(0,0,w,h);const rnd=seeded(3);
 for(let y=0;y<h;y+=3){g.fillStyle=`rgba(0,0,0,${.03+rnd()*.05})`;g.fillRect(0,y,w,1);}
 for(let x=0;x<w;x+=3){g.fillStyle=`rgba(255,255,255,${.02+rnd()*.03})`;g.fillRect(x,0,1,h);}
 if(stripe){g.fillStyle=stripe;g.fillRect(0,h*.78,w,h*.06);g.fillStyle='rgba(244,240,232,.8)';g.fillRect(0,h*.86,w,h*.015);}
});
const starScreen=()=>canvasTexture(1024,512,(g,w,h)=>{
 const sky=g.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#02030a');sky.addColorStop(1,'#0b1024');g.fillStyle=sky;g.fillRect(0,0,w,h);
 const rnd=seeded(1703);for(let i=0;i<420;i++){g.fillStyle=`rgba(225,236,255,${.25+rnd()*.7})`;g.beginPath();g.arc(rnd()*w,rnd()*h,.4+rnd()*1.4,0,Math.PI*2);g.fill();}
 const mars=g.createRadialGradient(w*.74,h*.42,4,w*.72,h*.45,h*.22);mars.addColorStop(0,'#f0a46a');mars.addColorStop(.6,'#c45a2c');mars.addColorStop(1,'#5c2410');
 g.fillStyle=mars;g.beginPath();g.arc(w*.72,h*.45,h*.2,0,Math.PI*2);g.fill();
 g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.arc(w*.76,h*.47,h*.2,0,Math.PI*2);g.fill();
});
const bulkheadSign=()=>canvasTexture(1024,256,(g,w,h)=>{
 g.fillStyle='#101923';g.fillRect(0,0,w,h);g.fillStyle='#f85800';g.fillRect(56,h-38,120,6);
 g.fillStyle='#f4f0e8';g.font='600 86px "Archivo", "Arial", sans-serif';g.textBaseline='alphabetic';g.fillText('Quiet Grove',56,122);
 g.fillStyle='#a6a5b4';g.font='400 34px "JetBrains Mono", monospace';g.fillText('NOSE COMMONS  ·  DECK 15  →',60,190);
});


function inCabin(o){const p=new T.Box3().setFromObject(o).getCenter(new T.Vector3());return p.x>CABIN.minX&&p.x<CABIN.maxX&&p.z>CABIN.minZ&&p.z<CABIN.maxZ&&p.y>CABIN.minY&&p.y<CABIN.maxY;}

function polishCabin(root,walkOnly){
 const looks={
  Cabin_back_wall:standard(0x1f2e3a,{roughness:.9}),
  Cabin_side_wall:standard(0xebe5d9,{roughness:.92}),
  Cabin_24m2_floor:standard(0xffffff,{map:oakFloor(),roughness:.62}),
  Cabin_runner:standard(0xffffff,{map:runner(),roughness:.95}),
  Bed_cover:standard(0xffffff,{map:weave('#6d8c7c','#f85800'),roughness:.95}),
  Upholstered_headboard:standard(0xffffff,{map:weave('#2b3a47'),roughness:.9}),
  Desk_pinboard:new T.MeshStandardMaterial({color:0x000000,emissive:0xffffff,emissiveMap:starScreen(),emissiveIntensity:1.1,roughness:.3}),
  Desk_task_light:glow(0xffd2a0,2.2),Reading_light:glow(0xffd2a0,2.2),Cabin_ceiling_light:glow(0xfff0dc,1.6),Ceiling_cove_diffuser:glow(0xffd6a8,2),
 };
 root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&looks[o.name]&&inCabin(o))o.material=looks[o.name];});
 // Warm practical light: the ceiling cove, the desk lamp and the reading light.
 const lights=new T.Group();lights.name='Tour_cabin_lights';walkOnly.add(lights);
 for(const [x,y,z,intensity,distance,color] of [[121.4,19.2,5.2,7,8,0xffe2c0],[120.7,18.05,7.85,2.2,3.2,0xffc890],[122.1,18.1,6.85,1.6,2.6,0xffc890]]){
  const l=new T.PointLight(color,intensity,distance,2);l.position.set(x,y,z);lights.add(l);
 }
 // Stand the cabin's crew cat on the runner, facing the door, so the first stop opens on Cosmo instead of a cropped ear.
 root.traverse(o=>{if(o.name!=='Mars_cat_1.75m')return;const p=o.getWorldPosition(new T.Vector3());if(Math.abs(p.x-119.45)<1.2&&Math.abs(p.z-3.55)<1.2){o.position.x+=120.35-p.x;o.position.z+=5.7-p.z;o.rotation.y=Math.PI*.92;}});
}

function polishCorridor(root,walkOnly){
 // Close the forward end of the corridor (the tour deck has no nose commons, so it opened onto space).
 const end=new T.Group();end.name='Tour_corridor_bulkhead';walkOnly.add(end);
 const wall=standard(0xe6e0d4,{roughness:.9}),navy=standard(0x1c2c38,{roughness:.6,metalness:.2});
 const add=(size,pos,mat)=>{const m=new T.Mesh(new T.BoxGeometry(...size),mat);m.position.set(...pos);m.receiveShadow=true;end.add(m);return m;};
 const h=CEILING_Y-FLOOR_Y,cy=FLOOR_Y+h/2,x=CORRIDOR_END_X+.1;
 add([.2,h+.2,108],[x,cy,0],wall);
 add([.12,2.5,.12],[x-.12,FLOOR_Y+1.25,-1.3],navy);add([.12,2.5,.12],[x-.12,FLOOR_Y+1.25,1.3],navy);add([.12,.12,2.72],[x-.12,FLOOR_Y+2.5,0],navy);
 add([.04,2.38,1.18],[x-.1,FLOOR_Y+1.2,-.62],new T.MeshStandardMaterial({color:0xd8e4e8,emissive:0xffd9ae,emissiveIntensity:.55,roughness:.25,transparent:true,opacity:.92}));
 add([.04,2.38,1.18],[x-.1,FLOOR_Y+1.2,.62],new T.MeshStandardMaterial({color:0xd8e4e8,emissive:0xffd9ae,emissiveIntensity:.55,roughness:.25,transparent:true,opacity:.92}));
 add([.06,2.38,.05],[x-.14,FLOOR_Y+1.2,0],navy);
 const signMap=bulkheadSign();
 add([.04,.62,2.5],[x-.12,FLOOR_Y+2.98,0],new T.MeshStandardMaterial({color:0x000000,emissive:0xffffff,emissiveMap:signMap,emissiveIntensity:.9,roughness:.4}));
 // Warm pools of light along the corridor ceiling.
 const lights=new T.Group();lights.name='Tour_corridor_lights';walkOnly.add(lights);
 for(const lx of [112,119,126,131]){const l=new T.PointLight(0xffe0bc,3.5,8,2);l.position.set(lx,CEILING_Y-1,0);lights.add(l);}
 // Warm sconces either side of the Quiet Grove door wash the bulkhead.
 for(const z of [-2.2,2.2]){add([.1,.34,.18],[x-.12,FLOOR_Y+1.9,z],glow(0xffcf9a,2.4));const l=new T.PointLight(0xffc890,2.2,4,2);l.position.set(x-.6,FLOOR_Y+1.9,z);lights.add(l);}
 // The cabin's navy-and-orange runner continues down the corridor to the door.
 const runnerMap=canvasTexture(512,128,(g,w,h)=>{g.fillStyle='#2a3440';g.fillRect(0,0,w,h);const rnd=seeded(9);for(let i=0;i<900;i++){g.fillStyle=`rgba(255,255,255,${rnd()*.04})`;g.fillRect(rnd()*w,rnd()*h,2,2);}
  g.fillStyle='#f85800';g.fillRect(0,10,w,5);g.fillRect(0,h-15,w,5);g.fillStyle='rgba(244,240,232,.35)';g.fillRect(0,22,w,2);g.fillRect(0,h-24,w,2);},[6,1]);
 const floorRun=new T.Mesh(new T.PlaneGeometry(CORRIDOR_END_X-113,1.6),standard(0xffffff,{map:runnerMap,roughness:.95}));floorRun.rotation.x=-Math.PI/2;floorRun.position.set((CORRIDOR_END_X+113)/2,FLOOR_Y+.05,0);floorRun.receiveShadow=true;end.add(floorRun);
 root.traverse(o=>{if(o.isMesh&&o.name==='Residential_corridor_diffusers')o.material=glow(0xfff0dc,1.4);});
}

const pavers=()=>canvasTexture(512,512,(g,w,h)=>{
 const rnd=seeded(23),n=4,s=w/n;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){const t=214+rnd()*18;g.fillStyle=`rgb(${t},${t*.94|0},${t*.86|0})`;g.fillRect(i*s,j*s,s,s);
  for(let k=0;k<160;k++){g.fillStyle=`rgba(120,100,80,${rnd()*.06})`;g.fillRect(i*s+rnd()*s,j*s+rnd()*s,2,2);}}
 g.strokeStyle='rgba(120,104,88,.55)';g.lineWidth=3;for(let i=0;i<=n;i++){g.beginPath();g.moveTo(i*s,0);g.lineTo(i*s,h);g.stroke();g.beginPath();g.moveTo(0,i*s);g.lineTo(w,i*s);g.stroke();}
},[45/6,38/6]);
const daylight=()=>canvasTexture(1024,1024,(g,w,h)=>{
 const sky=g.createRadialGradient(w*.55,h*.45,20,w*.5,h*.5,w*.75);sky.addColorStop(0,'#fdf8ee');sky.addColorStop(.45,'#dcebf4');sky.addColorStop(1,'#a9c7da');g.fillStyle=sky;g.fillRect(0,0,w,h);
 const rnd=seeded(41);for(let i=0;i<46;i++){const x=rnd()*w,y=rnd()*h,r=40+rnd()*110,c=g.createRadialGradient(x,y,0,x,y,r);c.addColorStop(0,'rgba(255,255,255,.55)');c.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=c;g.fillRect(x-r,y-r,r*2,r*2);}
});
const livingWall=()=>canvasTexture(1024,1024,(g,w,h)=>{
 g.fillStyle='#24402c';g.fillRect(0,0,w,h);const rnd=seeded(77),greens=['#2f5a38','#3f7446','#5a8f4e','#7aa65a','#35603f','#8fb86a'];
 for(let i=0;i<5200;i++){const x=rnd()*w,y=rnd()*h,r=5+rnd()*13;g.fillStyle=greens[rnd()*greens.length|0];g.beginPath();g.ellipse(x,y,r,r*.55,rnd()*Math.PI,0,Math.PI*2);g.fill();}
 for(let i=0;i<260;i++){g.fillStyle=rnd()<.6?'#f85800':'#f4f0e8';g.beginPath();g.arc(rnd()*w,rnd()*h,2+rnd()*3,0,Math.PI*2);g.fill();}
},[3,1]);

function inGarden(o){const b=new T.Box3().setFromObject(o),c=b.getCenter(new T.Vector3());return c.x>GARDEN.minX-1&&c.x<GARDEN.maxX+1&&c.z>GARDEN.minZ-1&&c.z<GARDEN.maxZ+1&&c.y>GARDEN.floor-1&&c.y<GARDEN.ceiling+1;}

// Stylized trees replace the blockout ones: the main tree stands where the old trunk did, and a smaller Mars-orange
// ornamental grows at the far end of each bed. Beds get denser clumps, grasses and flowers.
function plantGarden(root){
 const beds=[],trunks=[],old=[];
 root.traverse(o=>{if(!o.isMesh||!inGarden(o))return;if(o.name==='Planting_bed')beds.push(new T.Box3().setFromObject(o));if(o.name==='Tree_trunk')trunks.push(new T.Box3().setFromObject(o));if(o.name==='Tree_trunk'||o.name==='Tree_canopy')old.push(o);});
 old.forEach(o=>{o.visible=false;});
 trunks.forEach((t,i)=>{const c=t.getCenter(new T.Vector3());root.add(stylizedTree(new T.Vector3(c.x,t.min.y,c.z),{height:7.2,spread:5.8,seed:40+i}));});
 beds.forEach((b,i)=>{const c=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3()),along=size.x>size.z?'x':'z',tree=trunks.find(t=>b.containsPoint(t.getCenter(new T.Vector3()).setY(c.y)));
  const end=c.clone();end[along]=tree&&tree.getCenter(new T.Vector3())[along]>c[along]?b.min[along]+1.6:b.max[along]-1.6;end.y=b.max.y;
  root.add(stylizedTree(end,{height:3.6,spread:2.8,palette:EMBERS,seed:70+i}));});
 plantClumps(root,beds,{seed:509,density:1});
}

function polishGarden(root,walkOnly){
 const plaster=standard(0xe9dfcf,{roughness:.95});
 const looks={
  Commons_floor:standard(0xffffff,{map:pavers(),roughness:.78}),
  Commons_ceiling:new T.MeshStandardMaterial({color:0x000000,emissive:0xffffff,emissiveMap:daylight(),emissiveIntensity:.95,roughness:1}),
  Commons_end_wall:plaster,Commons_rear_wall:plaster,
  Circadian_light:glow(0xfff4e0,2.4),Cafe_pendant_diffuser:glow(0xffcf9a,2.6),Gallery_warm_light:glow(0xffd6a8,2),
 };
 root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&looks[o.name]&&inGarden(o))o.material=looks[o.name];});
 plantGarden(root);
 // The Deck 17 lift lobby wall, seen across the garden, carries a launch mural (from the website's hero art).
 const mural=new T.Mesh(new T.PlaneGeometry(10.2,4.37),artMaterial('art-launch.jpg'));mural.name='Garden_lobby_mural';mural.position.set(121,GARDEN.floor+4.6,-8.07);walkOnly.add(mural);
 const muralFrame=new T.Mesh(new T.BoxGeometry(10.44,4.61,.03),standard(0x2a3440,{roughness:.5,metalness:.3}));muralFrame.name='Garden_lobby_mural_frame';muralFrame.position.set(121,GARDEN.floor+4.6,-8.1);walkOnly.add(muralFrame);
 // The stair block's garden face, a blank wall four metres from the garden stop: the Mars Cats poster, framed
 // between the wall's stripes and the gallery above (the bright crew artwork; the Mars poster read as a dark slab).
 const poster=new T.Mesh(new T.PlaneGeometry(2.7,1.91),artMaterial('art-crew.jpg'));poster.name='Garden_stair_poster';poster.position.set(143.4,GARDEN.floor+2.62,7.965);walkOnly.add(poster);
 const posterFrame=new T.Mesh(new T.BoxGeometry(2.86,2.07,.02),standard(0x2a3440,{roughness:.5,metalness:.3}));posterFrame.name='Garden_stair_poster_frame';posterFrame.position.set(143.4,GARDEN.floor+2.62,7.945);walkOnly.add(posterFrame);
 // A two-storey living wall dresses the garden's new forward end wall (walk mode only, like the wall itself).
 const wall=new T.Mesh(new T.PlaneGeometry(29.4,11),standard(0xffffff,{map:livingWall(),roughness:.95}));wall.name='Garden_living_wall';
 wall.rotation.y=-Math.PI/2;wall.position.set(GARDEN.maxX+.03,GARDEN.floor+5.5,27);walkOnly.add(wall);
 // Warm pools of light over the beds and the café (three, to keep phones quick).
 const lights=new T.Group();lights.name='Tour_garden_lights';walkOnly.add(lights);
 for(const [x,z] of [[124,24],[141,24],[132,39]]){const l=new T.PointLight(0xffdcb4,6,18,2);l.position.set(x,GARDEN.floor+4.6,z);lights.add(l);}
}

// The home tour renders the ship's Neighborhood 10 detail. Cabin furnishings apply to its one sample cabin and the
// garden dressing to its commons; the lights, walls and bulkhead go in the returned group, shown only in walk mode.
export function polishTourDeck(root){
 root.updateMatrixWorld(true);const walkOnly=new T.Group();walkOnly.name='Tour_walk_only';walkOnly.visible=false;
 polishCabin(root,walkOnly);polishCorridor(root,walkOnly);polishGarden(root,walkOnly);polishForwardDeck(root,walkOnly);walkOnly.add(encloseNeighborhoodTour(root));
 root.add(walkOnly);return walkOnly;
}
