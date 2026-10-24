import * as T from 'three';

// The Deck 16 community theatre's concession stand: an L-shaped counter in the entrance corner by the stair lobby, with
// glowing gold fins, a popcorn case, a bulb-lit marquee, a menu board and two pendant lamps. The glow is baked into
// unlit materials, so it adds no lights.
// Room frame (Area_d16-theater-5): the stage end at +x, the entrance at x=-25.84 (doors at |z|<2.2), the stair lobby
// notch at x<-12, z<-9. The stand keeps .35 m off the walls for drapes and 2.7 m clear of the doorway.
const ROOM='Area_d16-theater-5';
const WALL={x:-25.49,z:-8.65},CORNER={x:-22.6,z:-4.9},H=1.08,D=.62;

function rng(seed){return ()=>(seed=(seed*16807)%2147483647)/2147483647;}
function canvasTexture(w,h,paint){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
// Vertical gold fins between dark walnut, lit from below like a lamp behind each.
function fins(g,w,h){
 g.fillStyle='#1c120b';g.fillRect(0,0,w,h);
 for(let x=0;x<w;x+=32){
  const glow=g.createLinearGradient(0,h,0,0);glow.addColorStop(0,'#ffd27a');glow.addColorStop(.55,'#e39a2c');glow.addColorStop(1,'#7a4612');
  g.fillStyle=glow;g.fillRect(x+6,10,20,h-20);
  g.fillStyle='rgba(255,240,200,.55)';g.fillRect(x+14,10,3,h-20);
 }
 g.fillStyle='#d9a441';g.fillRect(0,0,w,6);g.fillRect(0,h-6,w,6);
}
// A row of warm bulbs round a dark board, with text in the middle.
function bulbs(g,w,h,step){
 for(let x=step/2;x<w;x+=step)for(const y of [step/2,h-step/2])bulb(g,x,y,step*.28);
 for(let y=step*1.5;y<h-step;y+=step)for(const x of [step/2,w-step/2])bulb(g,x,y,step*.28);
}
function bulb(g,x,y,r){
 const halo=g.createRadialGradient(x,y,0,x,y,r*2.4);halo.addColorStop(0,'rgba(255,236,180,1)');halo.addColorStop(.4,'rgba(255,190,90,.7)');halo.addColorStop(1,'rgba(255,160,60,0)');
 g.fillStyle=halo;g.fillRect(x-r*2.4,y-r*2.4,r*4.8,r*4.8);
}
function marquee(g,w,h){
 const bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#2a0d0f');bg.addColorStop(1,'#120607');g.fillStyle=bg;g.fillRect(0,0,w,h);
 g.strokeStyle='#d9a441';g.lineWidth=8;g.strokeRect(34,34,w-68,h-68);
 bulbs(g,w,h,40);
 g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ffd27a';g.shadowColor='#ff9a2a';g.shadowBlur=24;
 g.font='700 104px "Archivo", "Sora", sans-serif';g.fillText('CONCESSIONS',w/2,h/2+6);g.shadowBlur=0;
}
function menu(g,w,h){
 g.fillStyle='#0e0a0a';g.fillRect(0,0,w,h);bulbs(g,w,h,36);
 g.strokeStyle='#d9a441';g.lineWidth=5;g.strokeRect(40,40,w-80,h-80);
 g.textBaseline='middle';g.fillStyle='#ffd27a';g.textAlign='center';g.font='700 64px "Archivo", "Sora", sans-serif';g.fillText('NOW SERVING',w/2,108);
 const items=[['Popcorn','4'],['Nachos','5'],['Star candy','3'],['Fizzy soda','3'],['Hot cocoa','3']];
 g.font='500 46px "Sora", sans-serif';
 items.forEach(([name,price],i)=>{const y=196+i*62;g.fillStyle='#f4ead6';g.textAlign='left';g.fillText(name,100,y);g.fillStyle='#ffb347';g.textAlign='right';g.fillText(price+' cr',w-100,y);
  g.fillStyle='rgba(217,164,65,.35)';g.fillRect(100,y+28,w-200,2);});
}

// The stand, placed in `ship`'s theatre. Returns a group in ship coordinates with its origin on the theatre floor, or
// null if the room is missing.
export function createConcession(ship){
 const room=ship.root.getObjectByName(ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Concession_stand';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const walnut=new T.MeshStandardMaterial({name:'Concession_walnut',color:0x3a2416,roughness:.55});
 const top=new T.MeshStandardMaterial({name:'Concession_top',color:0x0c0b0d,roughness:.18,metalness:.4});
 const gold=new T.MeshStandardMaterial({name:'Concession_gold',color:0xd9a441,roughness:.3,metalness:.85,emissive:0x3a2405});
 const glow=new T.MeshBasicMaterial({name:'Concession_glow',color:0xffc768,toneMapped:false});
 const red=new T.MeshStandardMaterial({name:'Concession_red',color:0x8e1c1c,roughness:.4,metalness:.2});
 const shadeGold=gold.clone();shadeGold.name='Concession_shade';shadeGold.side=T.DoubleSide;
 const glass=new T.MeshStandardMaterial({name:'Concession_glass',color:0xfff4dc,roughness:.05,transparent:true,opacity:.18,depthWrite:false});
 const add=(name,geo,material,at=[0,0,0])=>{const o=new T.Mesh(geo,material);o.name=name;o.position.set(...at);group.add(o);return o;};
 const box=(name,[sx,sy,sz],[x,y,z],material)=>add(name,new T.BoxGeometry(sx,sy,sz),material,[x,y,z]);
 // The L: one leg facing the room (+x), one facing the doorway (+z), meeting at CORNER.
 const a={x:CORNER.x-D/2,z0:WALL.z,z1:CORNER.z},b={z:CORNER.z-D/2,x0:WALL.x,x1:CORNER.x-D};
 const lenA=a.z1-a.z0,lenB=b.x1-b.x0;
 box('Concession_counter',[D,H-.05,lenA],[a.x,(H-.05)/2,(a.z0+a.z1)/2],walnut);
 box('Concession_counter',[lenB,H-.05,D],[(b.x0+b.x1)/2,(H-.05)/2,b.z],walnut);
 box('Concession_counter_top',[D+.08,.05,lenA+.08],[a.x+.04,H-.025,(a.z0+a.z1)/2+.04],top);
 box('Concession_counter_top',[lenB,.05,D+.08],[(b.x0+b.x1)/2,H-.025,b.z+.04],top);
 box('Concession_top_edge',[.03,.03,lenA+.08],[CORNER.x+.08,H-.04,(a.z0+a.z1)/2+.04],gold);
 box('Concession_top_edge',[lenB+.08+D,.03,.03],[(b.x0+CORNER.x+.08)/2,H-.04,CORNER.z+.08],gold);
 // The gold fin fronts and a glowing kick strip under each.
 const finsA=canvasTexture(1024,256,fins),finsB=finsA.clone();finsA.repeat.set(lenA/2.4,1);finsB.repeat.set((lenB+D)/2.4,1);
 for(const t of [finsA,finsB]){t.wrapS=T.RepeatWrapping;t.needsUpdate=true;}
 const front=t=>new T.MeshBasicMaterial({name:'Concession_fins',map:t,toneMapped:false});
 const fa=add('Concession_fins',new T.PlaneGeometry(lenA,H-.2),front(finsA),[CORNER.x+.005,.12+(H-.2)/2,(a.z0+a.z1)/2]);fa.rotation.y=Math.PI/2;
 add('Concession_fins',new T.PlaneGeometry(lenB+D,H-.2),front(finsB),[(b.x0+CORNER.x)/2,.12+(H-.2)/2,CORNER.z+.005]);
 box('Concession_kick_light',[.02,.03,lenA],[CORNER.x+.01,.05,(a.z0+a.z1)/2],glow);
 box('Concession_kick_light',[lenB+D,.03,.02],[(b.x0+CORNER.x)/2,.05,CORNER.z+.01],glow);
 // A popcorn case on the room leg: gold frame, glass, a heap of popcorn.
 const caseAt={x:a.x,z0:a.z0+.35,z1:a.z0+1.85,y:H,h:.5},cw=caseAt.z1-caseAt.z0;
 box('Concession_case_base',[.5,.06,cw],[caseAt.x,caseAt.y+.03,(caseAt.z0+caseAt.z1)/2],gold);
 box('Concession_case_glass',[.48,caseAt.h,cw-.02],[caseAt.x,caseAt.y+.06+caseAt.h/2,(caseAt.z0+caseAt.z1)/2],glass);
 box('Concession_case_lid',[.52,.04,cw+.02],[caseAt.x,caseAt.y+.08+caseAt.h,(caseAt.z0+caseAt.z1)/2],gold);
 const r=rng(81),kernel=new T.IcosahedronGeometry(.032,0),n=420;
 const corn=new T.InstancedMesh(kernel,new T.MeshStandardMaterial({name:'Concession_popcorn',color:0xffe9a8,roughness:.8,emissive:0x4a3008}),n);corn.name='Concession_popcorn';
 const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),s=new T.Vector3();
 for(let i=0;i<n;i++){
  const u=r(),v=r(),z=caseAt.z0+.05+u*(cw-.1),x=caseAt.x-.2+v*.4,heap=.12+.16*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
  q.setFromEuler(e.set(r()*6,r()*6,r()*6));s.setScalar(.7+r()*.6);
  corn.setMatrixAt(i,m.compose(new T.Vector3(x,caseAt.y+.08+r()*heap,z),q,s));
 }
 group.add(corn);
 // A till on the doorway leg.
 box('Concession_till',[.34,.12,.3],[b.x0+.7,H+.06,b.z],top);
 const screen=box('Concession_till_screen',[.3,.2,.02],[b.x0+.7,H+.24,b.z-.08],new T.MeshBasicMaterial({name:'Concession_till_screen',color:0x4fd0ff}));screen.rotation.x=-.3;
 // The back bar along the lobby wall: a red popcorn machine and a cup stack on a walnut cabinet.
 box('Concession_back_bar',[WALL.x-CORNER.x+D,.9,.5].map(Math.abs),[(WALL.x+CORNER.x-D)/2,.45,WALL.z+.25],walnut);
 box('Concession_back_bar_top',[Math.abs(WALL.x-CORNER.x+D),.04,.54],[(WALL.x+CORNER.x-D)/2,.92,WALL.z+.27],top);
 const mx=WALL.x+.75;
 box('Concession_popper_cart',[.7,.5,.44],[mx,.94+.25,WALL.z+.25],red);
 box('Concession_popper_glass',[.66,.56,.42],[mx,1.44+.28,WALL.z+.25],glass);
 box('Concession_popper_roof',[.74,.12,.48],[mx,2.06,WALL.z+.25],red);
 box('Concession_popper_crest',[.5,.12,.04],[mx,2.18,WALL.z+.45],gold);
 add('Concession_popper_kettle',new T.CylinderGeometry(.13,.1,.14,16),gold,[mx,1.86,WALL.z+.25]);
 const heap=new T.InstancedMesh(kernel,corn.material,120);heap.name='Concession_popper_corn';
 for(let i=0;i<120;i++){q.setFromEuler(e.set(r()*6,r()*6,r()*6));heap.setMatrixAt(i,m.compose(new T.Vector3(mx-.28+r()*.56,1.46+r()*r()*.24,WALL.z+.08+r()*.34),q,s.setScalar(.8+r()*.5)));}
 group.add(heap);
 for(let i=0;i<4;i++)add('Concession_cups',new T.CylinderGeometry(.06,.045,.16,12),red,[WALL.x+1.6+i*.16,1.02,WALL.z+.25]);
 // The menu board on the entrance wall, facing the room, and the marquee over the doorway leg.
 const board=add('Concession_menu',new T.PlaneGeometry(2.4,1.1),new T.MeshBasicMaterial({name:'Concession_menu',map:canvasTexture(1024,470,menu),toneMapped:false}),[WALL.x+.03,1.95,(WALL.z+CORNER.z)/2-.2]);board.rotation.y=Math.PI/2;
 box('Concession_menu_frame',[.04,1.18,2.48],[WALL.x,1.95,(WALL.z+CORNER.z)/2-.2],gold);
 add('Concession_marquee',new T.PlaneGeometry(2.6,.62),new T.MeshBasicMaterial({name:'Concession_marquee',map:canvasTexture(1024,244,marquee),toneMapped:false}),[(b.x0+CORNER.x)/2,2.62,CORNER.z+.02]);
 box('Concession_marquee_back',[2.7,.7,.06],[(b.x0+CORNER.x)/2,2.62,CORNER.z-.02],walnut);
 for(const dx of [-1.1,1.1])box('Concession_marquee_rod',[.02,.36,.02],[(b.x0+CORNER.x)/2+dx,3.1,CORNER.z-.02],gold);
 // Two gold pendant lamps over the room leg.
 for(const z of [a.z0+.9,a.z1-.9]){
  box('Concession_pendant_cord',[.012,.62,.012],[a.x,2.97,z],top);
  add('Concession_pendant',new T.CylinderGeometry(.06,.2,.2,20,1,true),shadeGold,[a.x,2.56,z]);
  add('Concession_pendant_bulb',new T.CircleGeometry(.17,20),glow,[a.x,2.47,z]).rotation.x=Math.PI/2;
 }
 return group;
}
