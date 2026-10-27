import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {COMMONS} from '../model.js';
import {SPRITES,spriteCanvas} from './invasion/sprites.js';
import {newGame,colorOf,striped} from './pool/rules.js';
import {newGame as newRun,step,press,beltAt} from './paws-off/rules.js';

// The arcade row in Neighborhood 1's commons (the Hydro-Nip Lounge, Deck 17), from tester feedback: eight cabinets
// along the forward wall, between the lounge's front gallery and the foot of its stair. The first two play the ship's
// games: Alien Cat Invasion (as the telescope does) and Paw Pool (as the Recreation Hall's table does), each dressed in
// its game's own art. The rest are grey "coming soon" cabinets, kept for games still to come. Shapes and neon vary
// cabinet to cabinet. Past the row's far end from the stair, a second Paws Off station: an arcade treadmill, nose to the
// wall under a cabinet-style screen and marquee (Paws Off itself, paws-off/game.js, lays the belt and runs the game).
// Neon is glowing materials and soft additive glows on the wall; no real lights.
// Everything is the walk's own: the ship's models and exports are unchanged. The row is built in its own frame: x along
// the wall (toward the commons' entrance side), y up from the floor, z out from the wall into the room.
// The wall's face is at template x 154.44 (the commons template, model.js); the stair's foot at template z 34.85.
const FLOOR=24.3,WALL=22.44,REACH=1.3;
const PINK=0xff4fd8,CYAN=0x45e3ff,GREEN=0x6dff7a,AMBER=0xffc266,ORANGE=0xf85800,PURPLE=0xa77bff;
// Cabinet shapes: width, depth, control panel height and reach, screen (bottom, top, lean back), marquee overhang, top.
const SHAPES={
 upright:{w:.8,d:.72,ph:.95,po:.2,sb:1.12,st:1.62,lean:.3,mo:.02,top:1.95},
 wide:{w:1.15,d:.8,ph:.92,po:.26,sb:1.08,st:1.6,lean:.28,mo:.04,top:1.98},
 tall:{w:.72,d:.66,ph:1,po:.16,sb:1.2,st:1.78,lean:.16,mo:.06,top:2.12},
 low:{w:.84,d:.9,ph:.86,po:.14,sb:.96,st:1.36,lean:.42,mo:0,top:1.66},
 // The treadmill's screen tower: shallow, with its screen up at a runner's eye.
 tower:{w:1.5,d:.45,ph:.9,po:.06,sb:1.2,st:2,lean:.16,mo:.04,top:2.42},
};
// The row, from the stair end: what each plays, its shape, colours and neon.
const ROW=[
 {game:'invasion',label:'Play Alien Cat Invasion',shape:'upright',body:0x3a1d5a,side:0x4d2a78,neon:[ORANGE,GREEN]},
 {game:'pool',label:'Play Paw Pool',shape:'wide',body:0x24405a,side:0x2f5370,neon:[CYAN,ORANGE]},
 {shape:'tall',body:0x9a9fa7,side:0x80858d,neon:[PINK,PINK]},
 {shape:'low',body:0xa4a9b0,side:0x8a8f96,neon:[CYAN,CYAN]},
 {shape:'upright',body:0x959aa2,side:0x7b8088,neon:[AMBER,AMBER]},
 {shape:'wide',body:0x9fa4ab,side:0x858a92,neon:[GREEN,GREEN]},
 {shape:'tall',body:0x989da5,side:0x7e838b,neon:[PURPLE,PURPLE]},
 {shape:'upright',body:0xa1a6ad,side:0x878c94,neon:[PINK,CYAN]},
];
const GAP=.95,START=-4.25,ROW_END=ROW.reduce((x,c)=>x+SHAPES[c.shape].w+GAP,START)-GAP;
// Paws Off's arcade treadmill: its tower, a little further on than the cabinets are spaced, and its deck in front, as
// long, wide and high as the Deck 16 treadmills' (areas.js), so a run here plays as one there does.
const MILL={body:0x15303a,side:0x1d4552,neon:[ORANGE,CYAN],gap:1.3,deck:{w:1.3,l:2.6,h:.26,at:.55}};
const MX=ROW_END+MILL.gap+SHAPES.tower.w/2,END=MX+SHAPES.tower.w/2;

// The row's frame in the ship (see createArcade).
function frame(){
 const c=COMMONS[0],g=new T.Group();g.position.set(c.x+WALL,FLOOR,c.z);g.rotation.y=-Math.PI/2;
 if(c.z>0)g.scale.x=-1;g.updateMatrixWorld(true);return g;
}
// The arcade treadmill as Paws Off takes it, in the ship's frame: its deck's centre on top, the way a runner faces (the
// wall), its length and width, the floor round it and the place its results card names. Node can read it too
// (scripts/check-live.mjs).
export function arcadeTreadmill(at=frame()){
 const {w,l,h,at:z0}=MILL.deck,centre=at.localToWorld(new T.Vector3(MX,h,z0+l/2)),ahead=at.localToWorld(new T.Vector3(MX,h,z0+l/2-1));
 return {place:'Arcade',floor:FLOOR,centre,top:centre.y,front:ahead.sub(centre).setY(0).normalize(),length:l,width:w};
}

const canvas=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;};
const font=(weight,size)=>`${weight} ${size}px "Archivo", system-ui, sans-serif`;
const glowText=(g,text,x,y,color,blur=18)=>{g.shadowColor=color;g.shadowBlur=blur;g.fillStyle=color;g.fillText(text,x,y);g.shadowBlur=0;};
// A paw print `r` across its toes, centred on its pad.
const paw=(g,x,y,r,color)=>{g.fillStyle=color;g.beginPath();g.ellipse(x,y+r*.35,r*.62,r*.5,0,0,Math.PI*2);g.fill();
 for(const [dx,dy] of [[-.62,-.38],[-.22,-.72],[.22,-.72],[.62,-.38]]){g.beginPath();g.ellipse(x+dx*r,y+dy*r,r*.2,r*.26,dx*.5,0,Math.PI*2);g.fill();}};

// The screens and marquees, drawn from each game's own art.
const ART={
 invasion:{
  screen:()=>canvas(256,320,(g,w,h)=>{g.fillStyle='#05070d';g.fillRect(0,0,w,h);
   g.imageSmoothingEnabled=false;
   g.drawImage(spriteCanvas(SPRITES.mothership.rows,SPRITES.mothership.palette,2),w/2-30,34);
   [['scout',0],['tabby',1],['tabby',2],['brute',3]].forEach(([k,r])=>{const s=SPRITES[k],c=spriteCanvas(s.frames[0],s.palette,2);for(let i=0;i<5;i++)g.drawImage(c,22+i*44,72+r*30);});
   const sh=spriteCanvas(SPRITES.shield.rows,SPRITES.shield.palette,1);for(let i=0;i<4;i++)g.drawImage(sh,18+i*60,236,22,8);
   g.drawImage(spriteCanvas(SPRITES.leo.rows,SPRITES.leo.palette,2),w/2-15,262);
   g.fillStyle='#3fd0a0';g.fillRect(0,h-14,w,2);
   g.font=font(700,15);g.textAlign='left';g.fillStyle='#f4f0e8';g.fillText('SCORE 01280',10,20);g.textAlign='right';g.fillStyle='#f85800';g.fillText('HI 09990',w-10,20);}),
  marquee:()=>canvas(512,160,(g,w,h)=>{g.fillStyle='#160a24';g.fillRect(0,0,w,h);
   g.imageSmoothingEnabled=false;const s=SPRITES.scout,c=spriteCanvas(s.frames[0],s.palette,6);g.drawImage(c,14,20);g.drawImage(c,w-14-c.width,20);
   g.textAlign='center';g.textBaseline='middle';g.font=font(800,40);glowText(g,'ALIEN CAT',w/2,52,'#f85800');g.font=font(800,46);glowText(g,'INVASION',w/2,108,'#b6ff5c');}),
  side:()=>canvas(128,128,(g,w,h)=>{g.imageSmoothingEnabled=false;const s=SPRITES.brute,c=spriteCanvas(s.frames[0],s.palette,9);g.drawImage(c,(w-c.width)/2,(h-c.height)/2);}),
 },
 pool:{
  screen:()=>canvas(320,256,(g,w,h)=>{g.fillStyle='#05070d';g.fillRect(0,0,w,h);
   const x0=26,y0=58,tw=w-52,th=158;g.fillStyle='#1b2f3d';g.fillRect(x0-10,y0-10,tw+20,th+20);
   for(let i=0;i<14;i++){g.fillStyle=i%2?'#2e8b45':'#35994e';g.fillRect(x0+i*tw/14,y0,tw/14+1,th);}
   g.strokeStyle='rgba(244,240,232,.55)';g.lineWidth=2;g.beginPath();g.moveTo(x0+tw/2,y0);g.lineTo(x0+tw/2,y0+th);g.stroke();g.beginPath();g.arc(x0+tw/2,y0+th/2,22,0,Math.PI*2);g.stroke();
   for(const [px,py] of [[0,0],[.5,0],[1,0],[0,1],[.5,1],[1,1]]){g.fillStyle='#06080b';g.beginPath();g.arc(x0+px*tw,y0+py*th,8,0,Math.PI*2);g.fill();g.strokeStyle='#9d7950';g.stroke();}
   // The cue ball and the rack, as the game lays them out, on a table 14 by 8.
   for(const b of newGame(7).balls){const bx=x0+(b.x/14+.5)*tw,by=y0+(b.y/8+.5)*th,c=colorOf(b.n);
    g.fillStyle=b.n===0||striped(b.n)?'#f4f0e8':c;g.beginPath();g.arc(bx,by,4,0,Math.PI*2);g.fill();
    if(striped(b.n)){g.fillStyle=c;g.fillRect(bx-4,by-1.5,8,3);}}
   g.font=font(700,15);g.textAlign='left';g.fillStyle='#f4f0e8';g.fillText('BALLS 15',12,24);g.textAlign='right';g.fillStyle='#2fd6c5';g.fillText('BEST 1:42',w-12,24);}),
  marquee:()=>canvas(512,160,(g,w,h)=>{g.fillStyle='#0b1822';g.fillRect(0,0,w,h);
   for(let i=0;i<16;i++){g.fillStyle=i%2?'#163a26':'#1a4a2e';g.fillRect(i*w/16,h-26,w/16+1,26);}
   g.textAlign='center';g.textBaseline='middle';g.font=font(800,64);glowText(g,'PAW POOL',w/2,66,'#2fd6c5',22);
   for(const [x,n] of [[40,8],[w-40,11]]){g.fillStyle=n===8?'#15171a':'#f4f0e8';g.beginPath();g.arc(x,66,26,0,Math.PI*2);g.fill();
    if(striped(n)){g.fillStyle=colorOf(n);g.fillRect(x-26,58,52,16);}g.fillStyle='#f4f0e8';g.beginPath();g.arc(x,66,10,0,Math.PI*2);g.fill();g.fillStyle='#15171a';g.font=font(700,13);g.fillText(String(n),x,67);}}),
  side:()=>canvas(128,128,(g,w,h)=>{g.fillStyle='#f4f0e8';g.beginPath();g.arc(w/2,h/2,52,0,Math.PI*2);g.fill();g.fillStyle='#15171a';
   for(let i=0;i<6;i++){const a=i/5*Math.PI*2,r=i?34:0,x=w/2+Math.cos(a)*r,y=h/2+Math.sin(a)*r;g.beginPath();for(let k=0;k<5;k++){const b=-Math.PI/2+k*Math.PI*2/5;g.lineTo(x+Math.cos(b)*13,y+Math.sin(b)*13);}g.closePath();g.fill();}}),
 },
 // Paws Off: a run as its heads-up display shows it, with a prompt as the game deals one a little way in, its first key
 // typed; paw prints run under it.
 paws:{
  screen:()=>canvas(384,200,(g,w,h)=>{g.fillStyle='#05070d';g.fillRect(0,0,w,h);
   const run=newRun(9);while(run.t<26){for(const c of run.prompt)press(run,c);step(run,1);}
   g.textBaseline='middle';g.font=font(700,15);g.textAlign='left';g.fillStyle='#f85800';g.fillText('PAWS OFF',14,20);
   g.textAlign='right';g.fillStyle='#f4f0e8';g.fillText(`${run.t.toFixed(1)} S · BELT ${beltAt(run.t).toFixed(1)} M/S`,w-14,20);
   const n=run.prompt.length,tw=62,th=72,gap=12,x0=(w-n*tw-(n-1)*gap)/2,y0=44;g.textAlign='center';
   [...run.prompt].forEach((c,i)=>{const x=x0+i*(tw+gap),done=i<1,next=i===1;
    g.fillStyle=done?'rgba(47,214,197,.18)':'#14171d';g.strokeStyle=done?'#2fd6c5':next?'#f85800':'rgba(244,240,232,.25)';g.lineWidth=next?4:2;
    g.beginPath();g.roundRect(x,y0,tw,th,10);g.fill();g.stroke();g.font=font(700,40);g.fillStyle=done?'#2fd6c5':'#f4f0e8';g.fillText(c,x+tw/2,y0+th/2+2);});
   g.fillStyle='rgba(255,255,255,.14)';g.fillRect(70,136,w-140,8);g.fillStyle='#2fd6c5';g.fillRect(70,136,(w-140)*.62,8);
   for(let i=0;i<8;i++)paw(g,26+i*47,178-(i%2)*8,9,'rgba(248,88,0,.6)');}),
  marquee:()=>canvas(704,160,(g,w,h)=>{g.fillStyle='#0c1a20';g.fillRect(0,0,w,h);
   g.textAlign='left';g.textBaseline='middle';g.font=font(800,84);const a='PAWS ',wa=g.measureText(a).width,x=(w-wa-g.measureText('OFF').width)/2;
   glowText(g,a,x,h/2+4,'#f85800',22);glowText(g,'OFF',x+wa,h/2+4,'#2fd6c5',22);paw(g,62,84,28,'#f85800');paw(g,w-62,84,28,'#2fd6c5');}),
  side:()=>canvas(128,128,(g)=>paw(g,64,72,44,'#f85800')),
 },
 soon:{
  screen:()=>canvas(256,256,(g,w,h)=>{g.fillStyle='#030406';g.fillRect(0,0,w,h);g.textAlign='center';g.textBaseline='middle';
   g.font=font(800,36);glowText(g,'COMING',w/2,h/2-22,'#c9ccd2',10);glowText(g,'SOON',w/2,h/2+22,'#c9ccd2',10);}),
  marquee:()=>canvas(512,160,(g,w,h)=>{g.fillStyle='#2c2f34';g.fillRect(0,0,w,h);g.textAlign='center';g.textBaseline='middle';g.font=font(800,60);g.fillStyle='#9a9fa7';g.fillText('? ? ?',w/2,h/2+4);}),
 },
};

// One cabinet's side profile (z out, y up), from the back at the floor round the front to the back at the top.
function profile(s){
 const {d,ph,po,sb,st,lean,mo,top}=s;
 return [[0,0],[d,0],[d,ph-.14],[d+po,ph-.04],[d+po,ph+.02],[d-.02,ph+.12],[d-.08,sb],[d-lean,st],[d+mo,st+.04],[d+mo,top],[0,top]];
}

// The row stands in Neighborhood 1's commons (model.js COMMONS). Returns null without a canvas (Node).
export function createArcade(){
 if(typeof document==='undefined')return null;
 // The row's frame: on the wall, facing into the room. x runs along the wall toward the commons' entrance side
 // (template z falling), which with Neighborhood 1's mirroring is world +z.
 const group=frame();group.name='Deck17_arcade_row';
 const solid=new T.Group();solid.name='Deck17_arcade_colliders';solid.position.copy(group.position);solid.rotation.copy(group.rotation);solid.scale.copy(group.scale);
 // Geometry merged per material, coloured per vertex.
 const std=(name,o={})=>new T.MeshStandardMaterial({name,color:0xffffff,vertexColors:true,roughness:.5,metalness:.2,...o});
 const mats={body:std('Arcade_body',{roughness:.55,metalness:.05}),trim:std('Arcade_trim',{roughness:.3,metalness:.7}),
  neon:new T.MeshBasicMaterial({name:'Arcade_neon',vertexColors:true,toneMapped:false})};
 const glowTex=canvas(128,128,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);r.addColorStop(0,'rgba(255,255,255,.9)');r.addColorStop(.35,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
 mats.glow=new T.MeshBasicMaterial({name:'Arcade_wall_glow',vertexColors:true,map:glowTex,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 const lists=new Map();
 // (Only the glows keep their texture coordinates.)
 const put=(m,color,geo)=>{const g=geo.index?geo.toNonIndexed():geo;if(m!=='glow')g.deleteAttribute('uv');
  const col=new T.Color(color),n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++)col.toArray(a,i*3);g.setAttribute('color',new T.BufferAttribute(a,3));
  if(!lists.has(m))lists.set(m,[]);lists.get(m).push(g);};
 const box=(m,color,[w,h,d],[x,y,z])=>put(m,color,new T.BoxGeometry(w,h,d).translate(x,y,z));
 const rod=(m,color,a,b,r=.012)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),len=A.distanceTo(B);
  const g=new T.CylinderGeometry(r,r,len,5,1,true);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),B.clone().sub(A).normalize()));
  put(m,color,g.translate((A.x+B.x)/2,(A.y+B.y)/2,(A.z+B.z)/2));};
 // A textured panel: a plane `w` by `h` centred on `at`, tilted back by `tilt` (radians) from facing +z.
 const panels=new Map();
 const panel=(key,make,w,h,at,tilt=0,ry=0)=>{
  if(!panels.has(key))panels.set(key,{material:new T.MeshBasicMaterial({name:'Arcade_'+key,map:make(),toneMapped:false,transparent:key.endsWith('side'),alphaTest:key.endsWith('side')?.1:0}),gs:[]});
  const g=new T.PlaneGeometry(w,h).rotateX(-tilt).rotateY(ry).translate(...at);panels.get(key).gs.push(g);};
 const spots=[];
 // One cabinet, centred at `cx` along the row; without `controls`, no joystick, buttons or coin door.
 function cabinet(cab,cx,controls=true){
  const s=SHAPES[cab.shape],{w,d,ph,po,sb,st,lean,mo,top}=s,art=cab.game||'soon';
  // The body: the profile extruded across the cabinet, with side panels in a second colour either side.
  const shape=new T.Shape(profile(s).map(([z,y])=>new T.Vector2(z,y)));
  const extrude=width=>new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false}).rotateY(-Math.PI/2);
  put('body',cab.body,extrude(w-.08).translate(cx+(w-.08)/2,0,0));
  for(const sd of [-1,1])put('body',cab.side,extrude(.04).translate(cx+sd*(w/2-.02)+.02,0,0));
  // Neon along the front edge of both side panels, and across the kick plate and the panel's lip.
  const edge=profile(s).slice(1,10);
  for(const sd of [-1,1])for(let i=0;i<edge.length-1;i++)rod('neon',i<5?cab.neon[0]:cab.neon[1],[cx+sd*(w/2+.005),edge[i][1],edge[i][0]+.006],[cx+sd*(w/2+.005),edge[i+1][1],edge[i+1][0]+.006]);
  box('neon',cab.neon[0],[w-.1,.03,.01],[cx,.06,d+.006]);box('neon',cab.neon[1],[w-.06,.02,.01],[cx,ph-.01,d+po+.006]);
  // The screen, sunk in a black bezel on the sloping face.
  const sz=(d-.08+d-lean)/2,sy=(sb+st)/2,len=Math.hypot(st-sb,lean-.08),tilt=Math.atan2(lean-.08,st-sb),out=[0,Math.sin(tilt),Math.cos(tilt)];
  put('body',0x07080b,new T.PlaneGeometry(w-.1,len-.02).rotateX(-tilt).translate(cx,sy+out[1]*.004,sz+out[2]*.004));
  panel(art+'-screen',ART[art].screen,w-.2,len-.12,[cx,sy+out[1]*.008,sz+out[2]*.008],tilt);
  // The marquee, lit, framed in neon.
  const mh=top-st-.1,my=st+.04+mh/2+.03,mz=d+mo+.006;
  panel(art+'-marquee',ART[art].marquee,w-.08,mh,[cx,my,mz]);
  for(const yy of [my-mh/2-.01,my+mh/2+.01])box('neon',cab.neon[1],[w-.04,.022,.012],[cx,yy,mz]);
  // A top cap overhanging a little.
  box('trim',0x15161a,[w+.03,.04,d+mo+.04],[cx,top+.02,(d+mo)/2]);
  // Controls: a joystick and buttons on the panel (two sets on the wide cabinet), and the coin door.
  if(controls){const py=ph+.07,pz=d+po/2-.02,sets=w>1?[-w/4,w/4]:[0];
   for(const off of sets){const jx=cx+off-.12;
    put('trim',0x15161a,new T.CylinderGeometry(.012,.012,.12,6).translate(jx,py+.06,pz));put('neon',cab.neon[0],new T.SphereGeometry(.028,8,6).translate(jx,py+.13,pz));
    [[.04,0],[.1,.02],[.16,0],[.07,-.05],[.13,-.03]].forEach(([bx,bz],i)=>put('neon',i%2?cab.neon[1]:cab.neon[0],new T.CylinderGeometry(.018,.018,.02,10).translate(cx+off+bx,py+.01,pz+bz)));}
   box('trim',0x2a2c31,[.22,.3,.02],[cx,.48,d+.01]);for(const ox of [-.05,.05])box('neon',cab.neon[0],[.012,.06,.012],[cx+ox,.55,d+.022]);}
  // The game's own art on the outside of both side panels.
  if(cab.game)for(const sd of [-1,1])panel(art+'-side',ART[art].side,.42,.42,[cx+sd*(w/2+.008),1.3,d*.45],0,sd*Math.PI/2);
  // A soft glow on the wall behind and the floor in front, in the cabinet's neon.
  put('glow',cab.neon[0],new T.PlaneGeometry(w+1.1,2.4).translate(cx,1.25,.012));
  put('glow',cab.neon[1],new T.PlaneGeometry(w+.6,1.1).rotateX(-Math.PI/2).translate(cx,.012,d+.55));
  // Solid as one plain box.
  const b=new T.Mesh(new T.BoxGeometry(w,top,d+po));b.position.set(cx,top/2,(d+po)/2);solid.add(b);
 }
 let x=START;
 for(const cab of ROW){const {w,d,po}=SHAPES[cab.shape];cabinet(cab,x+w/2);
  if(cab.game)spots.push({kind:cab.game==='pool'?'pool':'play',label:cab.label,at:new T.Vector3(x+w/2,0,d+po+.35)});
  x+=w+GAP;}
 // Paws Off's treadmill: the screen tower, then the deck in front of it. The deck's top is dark round the belt Paws Off
 // lays on it, with neon strips either side; a motor hood at its nose, uprights to a dash, and handrails.
 {cabinet({game:'paws',shape:'tower',...MILL},MX,false);
  const {w,l,h,at}=MILL.deck,cz=at+l/2,[A,B]=MILL.neon;
  box('body',0x1b1f27,[w,h,l],[MX,h/2,cz]);
  box('body',0x1b1f27,[w,.12,.3],[MX,h+.06,at+.15]);box('neon',B,[w-.1,.02,.01],[MX,h+.08,at+.306]);
  box('neon',A,[w-.1,.03,.01],[MX,.12,at+l+.006]);
  for(const sd of [-1,1]){const sx=MX+sd*.6,rx=MX+sd*.62;
   box('trim',0x2a2c31,[.14,.02,l-.12],[MX+sd*.57,h+.01,cz]);box('neon',B,[.02,.012,l-.3],[MX+sd*.57,h+.026,cz]);
   box('neon',A,[.01,.03,l-.1],[MX+sd*(w/2+.005),h-.07,cz]);
   rod('trim',0x2a2c31,[sx,h+.1,at+.16],[sx,1.2,at+.32],.03);
   rod('trim',0x2a2c31,[rx,1.08,at+.33],[rx,1.08,at+1.05],.022);rod('neon',A,[rx,1.106,at+.35],[rx,1.106,at+1.03],.008);
   rod('trim',0x2a2c31,[rx,1.08,at+1.05],[rx,h,at+1.15],.02);}
  box('trim',0x15161a,[1.36,.07,.16],[MX,1.22,at+.33]);box('neon',B,[1.3,.02,.01],[MX,1.19,at+.416]);
  put('glow',B,new T.PlaneGeometry(w+1.3,l+1.1).rotateX(-Math.PI/2).translate(MX,.012,cz+.2));
  // Solid as a plain box: the deck (low enough to step onto, as the Deck 16 treadmills are).
  const b=new T.Mesh(new T.BoxGeometry(w,h,l));b.position.set(MX,h/2,cz);solid.add(b);}
 // Neon on the wall above the row and the treadmill: a pink and a cyan line the length of them, and the arcade's sign
 // over the middle.
 box('neon',PINK,[END-START+.6,.035,.02],[(START+END)/2,2.42,.02]);box('neon',CYAN,[END-START+.6,.035,.02],[(START+END)/2,2.52,.02]);
 for(const xx of [START-.3,END+.3])box('neon',PURPLE,[.035,2.52,.02],[xx,1.26,.02]);
 panel('sign',()=>canvas(1024,256,(g,w,h)=>{g.clearRect(0,0,w,h);g.textAlign='center';g.textBaseline='middle';g.font=font(800,150);
  g.lineWidth=10;g.shadowColor='#ff4fd8';g.shadowBlur=30;g.strokeStyle='#ff4fd8';g.strokeText('ARCADE',w/2,h/2+6);g.shadowBlur=0;g.fillStyle='#ffe3f8';g.fillText('ARCADE',w/2,h/2+6);}),
  4.2,1.05,[(START+END)/2,3.25,.03]);
 // (The sign writes no depth, so the glow behind it shows through round the letters.)
 Object.assign(panels.get('sign').material,{transparent:true,depthWrite:false});
 put('glow',PINK,new T.PlaneGeometry(6,2.2).translate((START+END)/2,3.25,.015));
 for(const [m,gs] of lists){const o=new T.Mesh(mergeGeometries(gs),mats[m]);o.name=mats[m].name;o.castShadow=m==='body'||m==='trim';o.receiveShadow=m!=='glow';gs.forEach(g=>g.dispose());group.add(o);}
 for(const {material,gs} of panels.values()){const o=new T.Mesh(mergeGeometries(gs),material);o.name=material.name;gs.forEach(g=>g.dispose());group.add(o);}
 group.updateMatrixWorld(true);solid.updateMatrixWorld(true);
 for(const s of spots)group.localToWorld(s.at);
 return {group,solid,treadmill:arcadeTreadmill(group),
  // E in front of a playing cabinet: Invasion opens the telescope's game, Pool the Recreation Hall's.
  near(p){if(Math.abs(p.y-FLOOR)>1.5)return null;for(const s of spots)if(Math.hypot(p.x-s.at.x,p.z-s.at.z)<REACH)return {kind:s.kind,label:s.label};return null;},
 };
}
