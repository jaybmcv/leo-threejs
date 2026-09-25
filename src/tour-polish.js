import * as T from 'three';

// Art pass for the guided tour's first stops: the walkthrough cabin and the corridor outside it on Deck 15. Other
// cabins keep their shared materials: meshes here get new materials, shared ones are never edited.
const CABIN={minX:118.4,maxX:123,minZ:1.9,maxZ:8.5,minY:15.9,maxY:20};
const FLOOR_Y=16.3,CEILING_Y=19.6,CORRIDOR_END_X=134;

function canvasTexture(w,h,draw,repeat=[1,1]){
 const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=4;return t;
}
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

const oakFloor=()=>canvasTexture(512,512,(g,w,h)=>{
 const rnd=seeded(11),planks=6;
 for(let i=0;i<planks;i++){const y=i*h/planks,tone=180+rnd()*26;g.fillStyle=`rgb(${tone},${tone*.74|0},${tone*.52|0})`;g.fillRect(0,y,w,h/planks);
  for(let k=0;k<40;k++){g.strokeStyle=`rgba(90,56,30,${.05+rnd()*.08})`;g.lineWidth=1+rnd()*2;g.beginPath();const yy=y+rnd()*h/planks;g.moveTo(0,yy);g.bezierCurveTo(w*.3,yy+rnd()*6-3,w*.7,yy+rnd()*6-3,w,yy);g.stroke();}
  g.fillStyle='rgba(60,38,22,.55)';g.fillRect(0,y,w,2);const joint=rnd()*w;g.fillRect(joint,y,2,h/planks);}
},[2,3]);
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

const standard=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.82,metalness:0,...extra});
const glow=(color,intensity)=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.5});

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

// The tour's first stops render the ship's Neighborhood 10 detail. Cabin furnishings apply to its one sample cabin;
// the lights and the corridor bulkhead go in the returned group, which the viewer shows only in walk mode.
export function polishTourDeck(root){
 root.updateMatrixWorld(true);const walkOnly=new T.Group();walkOnly.name='Tour_walk_only';walkOnly.visible=false;
 polishCabin(root,walkOnly);polishCorridor(root,walkOnly);root.add(walkOnly);return walkOnly;
}
