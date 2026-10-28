import {roomObject} from '../plan/rooms.js';
import {walkCanvas} from './canvas.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GREENS,SHAPES,blade,orient,paint,stem} from './foliage.js';

// Deck 3's Hydroponic garden A gains a chinampa tank (tester feedback): the Aztec way of farming on water, shown with
// hydroponics. A square glass tank of bubbling water on a plinth lit white round its foot holds a raised bed of soil in a
// woven wattle fence, its stakes driven down to the tank floor and roots hanging into the water below. The bed is
// planted with the "three sisters": corn reaching up toward the ceiling, bean vines climbing the corn, and squash
// sprawling over the soil with yellow flowers. A square light panel as big as the tank shines down on it from the
// ceiling. Along the end wall behind it stand the water plant: filter vessels, a pump skid, a control cabinet, a UV
// steriliser and an aeration blower, with hoses across the floor into the tank. Two lectern signs in front of the tank
// open the reading sheets below (Read).
// It stands in the main aisle between the last racks and the end wall, so the aisles either side stay open (4.7 m to
// the racks) and there is 4.7 m to walk between the tank and the machines.
// Room frame (Area_d03-farm-1): x -26 (the entry) to 26, z -17 to 17, the floor at 0 and the ceiling's underside at 3.3
// (its light strip down the middle at z 0 hangs to 3.25). The end wall's face is at x 25.84, its name panel from y 2.2
// up over |z| < 7; the racks stand at |z| 6.2 and out, the last pair from x 15.5 to 20.5.
const ROOM='Area_d03-farm-1',TAU=Math.PI*2;
// The tank: its centre, half width, the plinth's top, the glass's top, the water's surface; the bed's half width,
// its underside and its soil's top.
const TANK={x:18.5,z:0,half:1.6,plinth:.14,top:1.1,water:.9},BED={half:1.2,under:.74,soil:1},WALL=25.84,CEILING=3.3;
const FENCE=BED.half-.05;
// The lectern signs in front of the tank [z, the sheet they open], and how near a walker must stand to read one.
const SIGNS=[[-.85,'chinampa'],[.85,'sisters']],SIGN_X=TANK.x-TANK.half-.6,REACH=1.25;
const FONT='"Archivo", "Sora", sans-serif',MONO='"JetBrains Mono", ui-monospace, monospace';

// The reading sheets, in our own words. Facts only: what chinampas and the three sisters are.
export const INFO={
 chinampa:{prompt:'Read about chinampas',where:'Hydroponic garden A · Deck 3',title:'Chinampas: farming on water',
  intro:'Chinampas are raised fields built up out of shallow lake water. Farmers in the Valley of Mexico made them for centuries, and the Aztecs farmed them on a great scale around their island city, Tenochtitlan. They are often called floating gardens, but each one is fixed to the lake bed.',
  points:[
   ['Building one','Farmers marked out a long, narrow plot with wooden stakes and wove a fence of reeds and branches between them. They filled it with layers of mud from the lake bottom and rotting water plants until it stood above the water, and planted willows along the edges, whose roots held the banks together.'],
   ['Water all round','Canals ran between the plots. Water seeping in from them kept the soil damp from below, so the crops rarely went thirsty, and farmers moved along them by canoe.'],
   ['Feeding the soil','Farmers scooped rich mud up from the canals onto the beds, which kept them fertile enough for several harvests a year.'],
   ['Still farmed','Chinampas are still worked today in Xochimilco, on the southern edge of Mexico City.'],
  ],
  note:'This tank shows the idea with hydroponics: the filters, pumps, steriliser and blower on the wall behind it keep the water round the bed moving, clean and full of air.'},
 sisters:{prompt:'Read about the three sisters',where:'Hydroponic garden A · Deck 3',title:'The three sisters',
  intro:'Corn, beans and squash grown together in one bed: a planting used by Indigenous farmers across Mesoamerica and North America. In Mexico the mixed field is called a milpa; the name "three sisters" comes from Haudenosaunee (Iroquois) tradition. Each crop helps the others.',
  points:[
   ['Corn','Grows tall and stiff, a living pole for the beans to climb.'],
   ['Beans','Bacteria in small nodules on their roots take nitrogen from the air and fix it in a form plants can use, helping to keep the soil fed for the hungry corn and squash.'],
   ['Squash','Its broad leaves spread over the ground, shading out weeds and keeping the soil moist, and its prickly stems put off some pests.'],
   ['Together','Eaten together they make a balanced meal: starch from the corn, protein from the beans and vitamins from the squash.'],
  ]},
};

function random(seed){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function canvasTexture(w,h,paint){
 const c=walkCanvas();c.width=w;c.height=h;const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
 const draw=()=>{const g=c.getContext('2d');g.clearRect(0,0,w,h);paint(g,w,h);t.needsUpdate=true;};
 draw();globalThis.document?.fonts?.ready.then(draw);return t;
}
// A lectern's face: a small heading, the title, a line under it and a hint to read it.
function signFace(eyebrow,title,sub,motif){
 return canvasTexture(512,352,(g,w,h)=>{
  g.fillStyle='#123036';g.beginPath();g.roundRect(0,0,w,h,22);g.fill();
  g.strokeStyle='#2fd6c5';g.lineWidth=5;g.beginPath();g.roundRect(10,10,w-20,h-20,15);g.stroke();
  g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle='#f8a35c';g.font=`600 22px ${MONO}`;g.letterSpacing='4px';g.fillText(eyebrow,40,70);
  g.fillStyle='#f4f0e8';g.letterSpacing='0px';let size=50;do{g.font=`700 ${size}px ${FONT}`;}while(g.measureText(title).width>w-80&&--size>24);g.fillText(title,40,135);
  g.fillStyle='#c9e4df';g.font=`500 28px ${FONT}`;g.fillText(sub,40,182);
  motif(g,w,h);
  g.fillStyle='#2fd6c5';g.font=`600 20px ${MONO}`;g.letterSpacing='3px';g.fillText('STEP UP TO READ',40,h-42);g.letterSpacing='0px';
 });
}
// The control cabinet's screen: the loop's water readings, concept graphics only.
function screenFace(){
 return canvasTexture(512,288,(g,w,h)=>{
  g.fillStyle='#071a1e';g.fillRect(0,0,w,h);
  g.fillStyle='#2fd6c5';g.font=`600 20px ${MONO}`;g.letterSpacing='3px';g.textAlign='left';g.fillText('CHINAMPA LOOP',24,40);
  g.fillStyle='#8fe8a0';g.textAlign='right';g.fillText('● RUNNING',w-24,40);g.letterSpacing='0px';
  const rows=[['WATER TEMP','22.0 °C',.55],['pH','6.2',.48],['DISSOLVED O2','8.1 mg/L',.8],['FLOW','36 L/min',.66],['UV DOSE','OK',.9]];
  rows.forEach(([k,v,f],i)=>{const y=86+i*42;g.textAlign='left';g.fillStyle='#9fb9bd';g.font=`500 18px ${MONO}`;g.fillText(k,24,y);
   g.textAlign='right';g.fillStyle='#f4f0e8';g.font=`600 20px ${MONO}`;g.fillText(v,w-24,y);
   g.fillStyle='#16353a';g.fillRect(24,y+9,w-48,6);g.fillStyle='#2fd6c5';g.fillRect(24,y+9,(w-48)*f,6);});
 });
}
// A soft top-to-bottom fade for the light falling from the panel (an alpha map: its grey is the opacity).
function fade(){
 const c=walkCanvas();c.width=8;c.height=128;const g=c.getContext('2d'),r=g.createLinearGradient(0,0,0,128);
 r.addColorStop(0,'#ffffff');r.addColorStop(.6,'#595959');r.addColorStop(1,'#000000');g.fillStyle=r;g.fillRect(0,0,8,128);
 return new T.CanvasTexture(c);
}

// The plants, each built once about its base at the soil and drawn instanced.
// Corn: a stalk with long arching leaves on alternate sides, a tassel on top and a husked ear or two; on most, a bean
// vine winds up the stalk with heart-shaped leaves, a few pods and white flowers.
function corn(out,rnd,beans){
 const H=1.85;
 out.push(stem([[0,0,0],[.012,H*.35,0],[0,H*.7,.012],[.004,H,0]],.022,0x6f9a3c,5));
 for(let i=0;i<10;i++){const y=.14+i*.165,len=.78-i*.035,yaw=i*Math.PI+(rnd()-.5)*.6;
  out.push(orient(blade(len,.075,{segs:4,shape:SHAPES.lance,fold:.25,droop:.65,base:0x3d7a2e,mid:0x6aa84a,tip:0x9cc860}),[0,y,0],yaw,.85,0));}
 for(let i=0;i<7;i++)out.push(orient(blade(.2,.014,{segs:2,shape:SHAPES.strap,fold:0,droop:.4,base:0xb7a35c,mid:0xd8c27a,tip:0xe6d394}),[0,H-.02,0],i/7*TAU,i?1.05:1.5,0));
 for(const [y,yaw] of [[.85,.5],[1.05,3.7]].slice(0,rnd()<.5?1:2)){
  const ear=paint(new T.CylinderGeometry(.03,.038,.2,7).translate(0,.1,0).rotateZ(-.45).rotateY(-yaw).translate(0,y,0),0x9cbf5f);out.push(ear);
  out.push(orient(blade(.07,.03,{segs:2,shape:SHAPES.lance,fold:0,droop:.6,base:0xc9a24a,mid:0xd7b25a,tip:0xb08a3a}),[Math.cos(yaw)*.08,y+.18,Math.sin(yaw)*.08],yaw,.9,0));
 }
 if(!beans)return;
 const turn=rnd()*TAU,pts=[];for(let i=0;i<=24;i++){const t=i/24,a=turn+t*TAU*2.6;pts.push([Math.cos(a)*.045,.03+t*1.45,Math.sin(a)*.045]);}
 out.push(stem(pts,.006,0x4f8a35,3));
 for(let i=2;i<24;i+=3){const [x,y,z]=pts[i],a=Math.atan2(z,x);out.push(orient(blade(.1,.085,{segs:3,shape:SHAPES.heart,fold:.25,droop:.35,base:GREENS.dark,mid:GREENS.bright,tip:GREENS.mid}),[x,y,z],a+(rnd()-.5)*.8,.2,0));}
 for(const i of [6,11,15,19]){const [x,y,z]=pts[i],a=Math.atan2(z,x);out.push(paint(new T.CylinderGeometry(.007,.009,.13,5).translate(0,-.065,0).rotateZ(.25).rotateY(-a).translate(x*1.6,y,z*1.6),0x6e9e3a));}
 for(const i of [9,17,22]){const [x,y,z]=pts[i];out.push(paint(new T.OctahedronGeometry(.013,0).translate(x*1.7,y+.01,z*1.7),0xf3efe2));}
}
// Squash: big lobed leaves on short stalks low over the soil, yellow star flowers and a ripening fruit.
function squash(out,rnd,fruitColour){
 for(let i=0;i<6;i++){const yaw=i/6*TAU+rnd()*.4,r=.1+rnd()*.06,len=.24+rnd()*.06;
  out.push(stem([[0,0,0],[Math.cos(yaw)*r*.6,.1,Math.sin(yaw)*r*.6],[Math.cos(yaw)*r,.12,Math.sin(yaw)*r]],.007,0x5c8a3a,3));
  out.push(orient(blade(len,len*.95,{segs:4,shape:SHAPES.heart,fold:.18,droop:.3,base:GREENS.deep,mid:GREENS.mid,tip:GREENS.dark}),[Math.cos(yaw)*r,.12,Math.sin(yaw)*r],yaw,.15,0));}
 for(let f=0;f<2;f++){const a=f*2.6+rnd(),at=[Math.cos(a)*.16,.16,Math.sin(a)*.16];
  for(let k=0;k<5;k++)out.push(orient(blade(.065,.05,{segs:2,shape:SHAPES.oval,fold:.3,droop:-.2,base:0xe8961a,mid:0xf6c12e,tip:0xf8d548}),at,k/5*TAU,.55,0));
  out.push(paint(new T.OctahedronGeometry(.014,0).translate(...at),0xd9781a));}
 // The fruit lies on the soil out at the edge of the leaves, striped round its ribs.
 const a=rnd()*TAU,fx=Math.cos(a)*.3,fz=Math.sin(a)*.3,[c1,c2]=fruitColour;
 out.push(paint(new T.SphereGeometry(.085,10,7).scale(1,.72,1).translate(fx,.06,fz),p=>{const k=Math.floor((Math.atan2(p.z-fz,p.x-fx)+Math.PI)/TAU*10)%2;return new T.Color(k?c1:c2).toArray();}));
 out.push(stem([[0,.02,0],[fx*.5,.05,fz*.5],[fx,.12,fz]],.008,0x5c8a3a,3));
}
const instanced=(name,material,geo,list)=>{
 const mesh=new T.InstancedMesh(geo,material,list.length);mesh.name=name;mesh.receiveShadow=true;const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3(),s=new T.Vector3();
 list.forEach(({p,yaw,k},i)=>mesh.setMatrixAt(i,m.compose(v.set(...p),q.setFromEuler(e.set(0,yaw,0)),s.set(k,k,k))));
 mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;
};

// The tank, its planting, its light, the machines and the signs in ship coordinates: `group` draws (with its deck
// band), `solid` holds the tank, the machines and the lecterns as plain boxes for the colliders. `update` keeps the
// bubbles rising while a walker is near (unless motion is reduced); `near` offers a sign to read. Returns null if the
// room is missing.
export function createChinampa(ship,{still=false}={}){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Chinampa_tank';room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Chinampa_tank_colliders';room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const std=(name,color,o={})=>new T.MeshStandardMaterial({name:'Chinampa_'+name,color,roughness:.5,...o});
 const lit=(name,color,o={})=>new T.MeshBasicMaterial({name:'Chinampa_'+name,color,toneMapped:false,...o});
 const M={plinth:std('plinth',0x262d31,{roughness:.4,metalness:.4}),steel:std('steel',0xa3adb2,{roughness:.3,metalness:.75}),
  gravel:std('gravel',0x3f3b33,{roughness:.95}),soil:std('soil',0x4a3626,{roughness:1}),stake:std('wattle',0x7a6244,{roughness:.9}),
  withy:std('withy',0x8d7550,{roughness:.9}),root:std('roots',0xb9a77a,{roughness:.9}),
  enamel:std('enamel',0xe6ebed,{roughness:.35,metalness:.1}),graphite:std('graphite',0x2a3338,{roughness:.5,metalness:.3}),
  teal:std('teal',0x1f978f,{roughness:.35,metalness:.2}),hoseTeal:std('hose_supply',0x23a39a,{roughness:.45}),hoseDark:std('hose_return',0x33414a,{roughness:.5}),hoseAir:std('hose_air',0xdfe6e8,{roughness:.5}),
  led:lit('led_base',0xf2f8ff),panel:lit('light_panel',0xfff2da),gauge:lit('sight_glass',0x5fe6d6),status:lit('status_light',0x4fe3cf),uv:lit('uv_window',0xa47dff),
  glass:std('glass',0xe6f4f6,{roughness:.05,metalness:.1,transparent:true,opacity:.14,depthWrite:false}),
  water:std('water',0x6fb9c4,{roughness:.1,transparent:true,opacity:.3,depthWrite:false}),
  bubble:new T.MeshBasicMaterial({name:'Chinampa_bubbles',color:0xeefaff,transparent:true,opacity:.6,depthWrite:false}),
  beam:new T.MeshBasicMaterial({name:'Chinampa_light_beam',color:0xfff1d6,alphaMap:fade(),transparent:true,opacity:.06,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false}),
  screen:new T.MeshBasicMaterial({name:'Chinampa_screen',map:screenFace(),toneMapped:false}),
  plants:new T.MeshStandardMaterial({name:'Chinampa_plants',color:0xffffff,vertexColors:true,flatShading:true,side:T.DoubleSide,roughness:.75})};
 const parts=new Map(),piece=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g.index?g.toNonIndexed():g);};
 const box=(m,[w,h,d],[x,y,z])=>piece(m,new T.BoxGeometry(w,h,d).translate(x,y,z));
 const cyl=(m,r,h,[x,y,z],seg=16,r2=r)=>piece(m,new T.CylinderGeometry(r,r2,h,seg).translate(x,y,z));
 const block=([w,h,d],[x,y,z])=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d));o.position.set(x,y,z);solid.add(o);};
 const tube=(m,r,points,seg=24,radial=8)=>piece(m,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),seg,r,radial,false));
 const {x:X,z:Z,half:S}=TANK,rnd=random(1720);

 // The tank: a dark plinth with a white light strip round its foot, a gravel floor, four glass walls in steel corner
 // posts and a rim, and the water.
 box(M.plinth,[2*S+.1,TANK.plinth,2*S+.1],[X,TANK.plinth/2,Z]);
 for(const s of [-1,1]){box(M.led,[2*S+.112,.03,.02],[X,.1,Z+s*(S+.051)]);box(M.led,[.02,.03,2*S+.112],[X+s*(S+.051),.1,Z]);}
 box(M.gravel,[2*S-.04,.05,2*S-.04],[X,TANK.plinth+.025,Z]);
 const G=TANK.top-TANK.plinth,gy=TANK.plinth+G/2;
 for(const s of [-1,1]){box(M.glass,[2*S,G,.02],[X,gy,Z+s*(S-.01)]);box(M.glass,[.02,G,2*S-.04],[X+s*(S-.01),gy,Z]);}
 for(const sx of [-1,1])for(const sz of [-1,1])box(M.steel,[.05,G,.05],[X+sx*(S-.02),gy,Z+sz*(S-.02)]);
 for(const s of [-1,1]){box(M.steel,[2*S,.04,.05],[X,TANK.top,Z+s*(S-.02)]);box(M.steel,[.05,.04,2*S],[X+s*(S-.02),TANK.top,Z]);}
 const W=TANK.water-TANK.plinth-.05;box(M.water,[2*S-.05,W,2*S-.05],[X,TANK.plinth+.05+W/2,Z]);
 block([2*S+.1,TANK.top+.02,2*S+.1],[X,(TANK.top+.02)/2,Z]);

 // The chinampa: a bed of soil standing out of the water inside a fence of stakes driven to the tank floor, woven
 // through with withies in three courses, and roots hanging from its underside into the water.
 const B=BED.half,soilH=BED.soil-BED.under;box(M.soil,[2*B,soilH,2*B],[X,BED.under+soilH/2,Z]);
 const posts=[],per=Math.round(2*FENCE/.22);
 for(let side=0;side<4;side++)for(let i=0;i<per;i++){const t=-FENCE+i*(2*FENCE/per),[px,pz]=[[t,-FENCE],[FENCE,t],[-t,FENCE],[-FENCE,-t]][side];posts.push([X+px,Z+pz]);}
 posts.forEach(([px,pz])=>{const h=1.2+rnd()*.12-TANK.plinth-.05;cyl(M.stake,.02,h,[px,TANK.plinth+.05+h/2,pz],6,.017);});
 for(const [row,y] of [1.04,1.1,1.16].entries())posts.forEach(([ax,az],i)=>{const [bx,bz]=posts[(i+1)%posts.length],o=((i+row)%2?1:-1)*.018,
  cx=X+((ax+bx)/2-X)*(1+o/FENCE),cz=Z+((az+bz)/2-Z)*(1+o/FENCE),len=Math.hypot(bx-ax,bz-az)+.03;
  piece(M.withy,new T.BoxGeometry(len,.024,.024).rotateY(-Math.atan2(bz-az,bx-ax)).translate(cx,y,cz));});
 for(let i=0;i<46;i++){const rx=X+(rnd()-.5)*2*(B-.1),rz=Z+(rnd()-.5)*2*(B-.1),d=.2+rnd()*.3,w=()=>(rnd()-.5)*.08;
  tube(M.root,.006,[[rx,BED.under+.01,rz],[rx+w(),BED.under-d*.4,rz+w()],[rx+w(),BED.under-d*.75,rz+w()],[rx+w(),BED.under-d,rz+w()]],6,3);}

 // The planting: nine corn in a loose grid, most with a bean vine, and squash round the edge of the bed.
 const cornA=[],cornB=[],sq=[[],[]];
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){const k=.9+rnd()*.14;((i+j)%3===1?cornB:cornA).push({p:[X+(i-1)*.68+(rnd()-.5)*.14,BED.soil,Z+(j-1)*.68+(rnd()-.5)*.14],yaw:rnd()*TAU,k});}
 for(let i=0;i<10;i++){const a=i/10*TAU+.3,r=.86+rnd()*.12,p=[X+Math.cos(a)*r*1.05,BED.soil,Z+Math.sin(a)*r*1.05];
  p[0]=Math.max(X-B+.2,Math.min(X+B-.2,p[0]));p[2]=Math.max(Z-B+.2,Math.min(Z+B-.2,p[2]));sq[i%2].push({p,yaw:a+Math.PI/2+(rnd()-.5)*.6,k:.9+rnd()*.25});}
 const plant=(name,build,list,seed)=>{if(!list.length)return;const out=[],r=random(seed);build(out,r);const geo=mergeGeometries(out);out.forEach(g=>g.dispose());group.add(instanced(name,M.plants,geo,list));};
 plant('Chinampa_corn_beans',(o,r)=>corn(o,r,true),cornA,11);plant('Chinampa_corn',(o,r)=>corn(o,r,false),cornB,12);
 plant('Chinampa_squash_green',(o,r)=>squash(o,r,[0x3f6e2c,0x7fa24a]),sq[0],13);plant('Chinampa_squash_orange',(o,r)=>squash(o,r,[0xd9822b,0xe9a548]),sq[1],14);

 // The light: a square panel as big as the tank, flush under the ceiling, a louvred glow in a dark frame, and the
 // light falling from it as a faint column down to the corn.
 const LY=CEILING-.05;box(M.plinth,[2*S+.1,.1,2*S+.1],[X,LY,Z]);box(M.panel,[2*S-.1,.006,2*S-.1],[X,LY-.053,Z]);
 for(let i=-2;i<=2;i++){box(M.plinth,[.025,.012,2*S-.1],[X+i*(2*S-.1)/6,LY-.058,Z]);box(M.plinth,[2*S-.1,.012,.025],[X,LY-.058,Z+i*(2*S-.1)/6]);}
 {const h=LY-.06-TANK.top,beam=[];for(let s=0;s<4;s++)beam.push(new T.PlaneGeometry(2*S-.12,h).translate(0,0,S-.06).rotateY(s*Math.PI/2));
  const o=new T.Mesh(mergeGeometries(beam),M.beam);o.name='Chinampa_light_beam';o.position.set(X,TANK.top+h/2,Z);o.renderOrder=3;o.userData.noCollide=true;group.add(o);beam.forEach(g=>g.dispose());}

 // The water plant along the end wall (|z| < 5, under its name panel), from -z: two filter vessels, the pump skid, the
 // control cabinet, the UV steriliser over the aeration blower, and two more vessels; a header pipe runs over them.
 const vessel=(z,r,h,band)=>{const x=WALL-r-.08;cyl(M.graphite,r*.85,.12,[x,.06,z],16);cyl(M.enamel,r,h,[x,.12+h/2,z],24);
  piece(M.steel,new T.SphereGeometry(r,24,8,0,TAU,0,Math.PI/2).translate(x,.12+h,z));cyl(band,r+.006,.07,[x,.12+h*.78,z],24);cyl(band,r+.006,.04,[x,.12+h*.2,z],24);
  box(M.gauge,[.012,h*.55,.06],[x-r-.004,.12+h*.45,z]);box(M.graphite,[.02,h*.6,.1],[x-r+.004,.12+h*.45,z]);
  cyl(M.steel,.045,2.03-(.12+h+r*.9),[x,(2.03+.12+h+r*.9)/2,z],10);block([2*r,.12+h+r,2*r],[x,(.12+h+r)/2,z]);};
 vessel(-4.55,.32,1.45,M.teal);vessel(-3.75,.3,1.3,M.teal);vessel(3.75,.3,1.3,M.graphite);vessel(4.55,.34,1.4,M.graphite);
 // The pump skid: two pumps, each a finned motor and a teal pump head facing the room, on a dark base.
 const PX=WALL-.48,HX={teal:WALL-.45,steel:WALL-.3};box(M.graphite,[.9,.14,1.2],[PX,.07,-2.25]);block([.9,.75,1.2],[PX,.375,-2.25]);
 for(const z of [-2.55,-1.95]){piece(M.enamel,new T.CylinderGeometry(.14,.14,.46,16).rotateZ(Math.PI/2).translate(PX+.12,.36,z));
  for(let f=0;f<5;f++)piece(M.graphite,new T.CylinderGeometry(.152,.152,.02,16).rotateZ(Math.PI/2).translate(PX+.24-f*.07,.36,z));
  piece(M.teal,new T.CylinderGeometry(.18,.18,.14,18).rotateZ(Math.PI/2).translate(PX-.18,.36,z));
  box(M.status,[.004,.03,.03],[PX-.252,.5,z]);tube(M.steel,.04,[[PX-.18,.5,z],[PX-.18,1.6,z],[PX-.14,1.98,z],[HX.steel,2.13,z]],16,8);}
 // The control cabinet with its screen and a row of status lights.
 const CX=WALL-.28;box(M.enamel,[.55,1.95,1.6],[CX,.975,0]);box(M.graphite,[.02,1.6,1.4],[CX-.28,1.05,0]);block([.56,1.95,1.6],[CX,.975,0]);
 piece(M.screen,new T.PlaneGeometry(1.2,.675).rotateY(-Math.PI/2).translate(CX-.292,1.42,0));
 for(let i=0;i<6;i++)box(i===4?M.uv:M.status,[.006,.03,.05],[CX-.293,.88,-.45+i*.18]);
 for(let i=0;i<5;i++)box(M.plinth,[.006,.02,1.1],[CX-.292,.45+i*.07,0]);
 // The UV steriliser: two steel tubes along the wall with violet windows, over the aeration blower.
 for(const y of [1.15,1.5]){piece(M.steel,new T.CylinderGeometry(.11,.11,1.1,18).rotateX(Math.PI/2).translate(WALL-.22,y,2.15));
  box(M.uv,[.01,.04,.7],[WALL-.334,y,2.15]);for(const z of [1.7,2.6])box(M.graphite,[.25,.05,.06],[WALL-.12,y-.11,z]);}
 box(M.enamel,[.6,.62,.95],[WALL-.32,.31,2.15]);for(let i=0;i<6;i++)box(M.graphite,[.006,.025,.75],[WALL-.623,.12+i*.08,2.15]);
 box(M.status,[.006,.04,.04],[WALL-.624,.56,2.5]);block([.6,1.7,1.1],[WALL-.32,.85,2.15]);
 // The header pipes along the wall over the machines, under the room's name, and the drops into them.
 for(const [y,m,r,x] of [[2.03,M.teal,.05,HX.teal],[2.13,M.steel,.04,HX.steel]])piece(m,new T.CylinderGeometry(r,r,10.2,12).rotateX(Math.PI/2).translate(x,y,0));
 for(const z of [-.5,.5])cyl(M.steel,.035,.2,[HX.steel,2.04,z],10);
 tube(M.steel,.035,[[WALL-.22,1.6,2.15],[WALL-.22,1.9,2.15],[HX.steel,2.13,2.15]],10,8);
 // Hoses on the floor from the machines to the back of the tank, up its glass and over the rim into the water: two
 // supply lines from the pumps, a return to the steriliser and an air line from the blower.
 const back=X+S;
 for(const [m,r,z0,x0,y0,z1] of [[M.hoseTeal,.035,-2.55,PX-.26,.36,-.85],[M.hoseTeal,.035,-1.95,PX-.26,.36,-.3],[M.hoseDark,.04,1.9,WALL-.63,.25,.35],[M.hoseAir,.018,2.4,WALL-.63,.42,.95]]){
  const run=x0-back,pts=[[x0+.02,y0,z0],[x0-.18,r+.02,z0+(z1-z0)*.05],[back+run*.55,r,z0+(z1-z0)*.55],[back+.35,r,z1],[back+.07,.2,z1],[back+.05,TANK.top-.1,z1],[back+.02,TANK.top+.1,z1],[back-.1,TANK.top+.08,z1],[back-.15,TANK.water-.12,z1]];
  tube(m,r,pts,40,8);}

 // The lecterns: a steel post on a foot, the sign tilted back toward a walker coming up the aisle.
 const faces={chinampa:std('sign_chinampa',0xffffff,{map:signFace('AZTEC FARMING','CHINAMPAS','Farming on water',(g,w)=>{g.strokeStyle='#5fc6d6';g.lineWidth=4;for(let k=0;k<3;k++){g.beginPath();for(let x=0;x<=130;x+=5){const y=228+k*16+Math.sin(x/10+k)*5;x?g.lineTo(w-170+x,y):g.moveTo(w-170+x,y);}g.stroke();}
   g.fillStyle='#7a5a38';g.fillRect(w-150,200,90,22);g.fillStyle='#6aa84a';for(let x=0;x<3;x++){g.beginPath();g.moveTo(w-140+x*30,200);g.lineTo(w-128+x*30,150);g.lineTo(w-116+x*30,200);g.fill();}}),roughness:.6}),
  sisters:std('sign_sisters',0xffffff,{map:signFace('COMPANION PLANTING','THE THREE SISTERS','Corn, beans and squash',(g,w)=>{[['#f2c230',w-150],['#6aa84a',w-105],['#e8862a',w-60]].forEach(([c,x])=>{g.fillStyle=c;g.beginPath();g.arc(x,236,18,0,TAU);g.fill();});}),roughness:.6})};
 const signs=SIGNS.map(([z,key])=>{
  box(M.graphite,[.36,.03,.36],[SIGN_X,.015,Z+z]);box(M.steel,[.06,.86,.06],[SIGN_X,.46,Z+z]);
  const tilt=.6,panel=new T.Group();panel.position.set(SIGN_X,.98,Z+z);panel.rotation.set(0,-Math.PI/2,0);
  const back=new T.Mesh(new T.BoxGeometry(.66,.46,.03),M.graphite),face=new T.Mesh(new T.PlaneGeometry(.62,.426),faces[key]);face.position.z=.016;
  const tip=new T.Group();tip.rotation.x=-tilt;tip.add(back,face);panel.add(tip);back.name='Chinampa_sign_back';face.name='Chinampa_sign_'+key;group.add(panel);
  block([.3,1.2,.66],[SIGN_X,.6,Z+z]);
  // Where a walker stands to read it, just in front of the lectern.
  return {key,info:INFO[key],at:new T.Vector3(SIGN_X-.55,0,Z+z).applyMatrix4(room.matrixWorld)};
 });

 for(const [m,gs] of parts){const o=new T.Mesh(mergeGeometries(gs),m);o.name=m.name;o.receiveShadow=true;o.userData.noCollide=true;
  if(m===M.water)o.renderOrder=1;if(m===M.glass)o.renderOrder=4;group.add(o);gs.forEach(g=>g.dispose());}
 for(const o of solid.children)o.name='Chinampa_tank_solid';

 // The bubbles: rising from the tank floor to the underside of the bed or the surface round it, thickest along the
 // glass where the air stones are.
 const N=180,bubbles=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),M.bubble,N);bubbles.name='Chinampa_bubbles';bubbles.renderOrder=2;
 const floorY=TANK.plinth+.06,inner=S-.06,list=[];
 for(let i=0;i<N;i++){let bx,bz;if(i%5<3){const side=i%4,t=(rnd()-.5)*2*inner,d=inner-rnd()*.18;[bx,bz]=[[t,-d],[d,t],[t,d],[-d,t]][side];}else{bx=(rnd()-.5)*2*(B-.05);bz=(rnd()-.5)*2*(B-.05);}
  const under=Math.abs(bx)<B&&Math.abs(bz)<B,top=(under?BED.under:TANK.water)-.02;
  list.push({x:X+bx,z:Z+bz,top,y:floorY+rnd()*(top-floorY),speed:.18+rnd()*.22,r:.008+rnd()*.016,phase:rnd()*TAU});}
 const m4=new T.Matrix4(),v=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
 const place=t=>{list.forEach((b,i)=>bubbles.setMatrixAt(i,m4.compose(v.set(b.x+Math.sin(t*3+b.phase)*.008,b.y,b.z+Math.cos(t*2.5+b.phase)*.008),q,s.setScalar(b.r))));bubbles.instanceMatrix.needsUpdate=true;};
 place(0);bubbles.computeBoundingBox();bubbles.computeBoundingSphere();group.add(bubbles);
 const centre=new T.Vector3(X,0,Z).applyMatrix4(room.matrixWorld);let time=0;

 return {group,solid,targets:signs.map(sg=>({name:'Chinampa_sign_'+sg.key,at:sg.at})),
  update(dt,p){
   if(still||Math.abs(p.y-centre.y)>3||Math.hypot(p.x-centre.x,p.z-centre.z)>30)return;time+=dt;
   for(const b of list){b.y+=b.speed*dt;if(b.y>b.top)b.y=floorY;}place(time);
  },
  // The reading prompt for the sign a walker stands at, on the garden's floor.
  near(p){
   let best=null,d=REACH;for(const sg of signs){if(Math.abs(p.y-sg.at.y)>1.5)continue;const e=Math.hypot(p.x-sg.at.x,p.z-sg.at.z);if(e<d){d=e;best=sg;}}
   return best&&{kind:'read',info:best.info,label:best.info.prompt};
  },
 };
}

// Fill the reading sheet with one entry of INFO and show it.
export function showInfo(sheet,info){
 const $=s=>sheet.querySelector(s),body=$('.info-body');
 $('.info-where').textContent=info.where;$('.info-title').textContent=info.title;body.textContent='';
 const p=(text,cls)=>{const e=document.createElement('p');if(cls)e.className=cls;e.textContent=text;body.appendChild(e);};
 p(info.intro);
 const list=document.createElement('dl');for(const [term,text] of info.points)list.append(Object.assign(document.createElement('dt'),{textContent:term}),Object.assign(document.createElement('dd'),{textContent:text}));body.appendChild(list);
 if(info.note)p(info.note,'info-note');
 sheet.hidden=false;sheet.querySelector('[data-close]')?.focus();
}
