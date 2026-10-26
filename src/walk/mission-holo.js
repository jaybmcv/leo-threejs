import * as T from 'three';

// Deck 20's Mission control on foot: a round holographic table stands in the open floor between the two rows of flight
// consoles. Above its glass top a green hologram plots Leo's transfer from Earth to Mars round a small sun, with the
// Moon, Phobos and Deimos circling, Jupiter and a slow asteroid belt farther out, and meteors streaking through. Leo's
// marker runs the course on a loop. Concept graphics only.
// Room (Area_d20-mission-2, ship frame): x -5..23, z -33..-9, floor y 36.3; the consoles stand at x 1/9/17, z -27/-16
// with their chairs on the +z side, which leaves z -25.4..-16.5 clear down the middle.
const ROOM='Area_d20-mission-2';
const FLOOR=36.3,AT={x:9,z:-21},R=1.3,TOP=.9,HOLO=1.5,NEAR=30;
const GREEN=0x5dff9a,TEAL=0x5fd4e6,FONT='"JetBrains Mono", ui-monospace, monospace';
// The plot in table metres: Earth's and Mars's orbits, and the half-ellipse transfer between them.
const EARTH=.5,MARS=.86,JUPITER=1.18,LOOP=14;
const A=(EARTH+MARS)/2,E=(MARS-EARTH)/(MARS+EARTH);
const course=t=>{const th=t*Math.PI,r=A*(1-E*E)/(1+E*Math.cos(th));return new T.Vector3(Math.cos(th)*r,.04*Math.sin(th),-Math.sin(th)*r);};

function rng(seed){return ()=>(seed=(seed*16807)%2147483647)/2147483647;}
const glow=(color,opacity=1,extra={})=>new T.MeshBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,...extra});
const lineGlow=(color,opacity=1)=>new T.LineBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
const ring=(r,color,opacity,n=96)=>new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:n},(_,i)=>new T.Vector3(Math.cos(i/n*Math.PI*2)*r,0,Math.sin(i/n*Math.PI*2)*r))),lineGlow(color,opacity));

// The emitter face under the glass: range rings, bearings and a title running round the rim.
function paintFace(c){
 const w=c.canvas.width,m=w/2;c.clearRect(0,0,w,w);
 const g=c.createRadialGradient(m,m,0,m,m,m);g.addColorStop(0,'rgba(60,255,150,.35)');g.addColorStop(.7,'rgba(20,120,90,.18)');g.addColorStop(1,'rgba(0,40,40,0)');c.fillStyle=g;c.fillRect(0,0,w,w);
 c.strokeStyle='rgba(93,255,154,.55)';c.lineWidth=2;for(let k=1;k<=5;k++){c.beginPath();c.arc(m,m,m*k/5.6,0,7);c.stroke();}
 c.strokeStyle='rgba(95,212,230,.35)';for(let a=0;a<24;a++){const t=a/24*Math.PI*2;c.beginPath();c.moveTo(m+Math.cos(t)*m*.18,m+Math.sin(t)*m*.18);c.lineTo(m+Math.cos(t)*m*.9,m+Math.sin(t)*m*.9);c.stroke();}
 c.fillStyle='rgba(216,238,245,.9)';c.font=`600 26px ${FONT}`;c.textAlign='center';c.textBaseline='middle';
 const text='LEO · EARTH → MARS TRANSFER · MISSION CONTROL · COURSE A · ';
 for(let i=0;i<text.length;i++){const t=i/text.length*Math.PI*2;c.save();c.translate(m+Math.cos(t)*m*.95,m+Math.sin(t)*m*.95);c.rotate(t+Math.PI/2);c.fillText(text[i],0,0);c.restore();}
}

function label(text,color){
 const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
 const draw=()=>{x.clearRect(0,0,256,64);x.font=`600 30px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.fillStyle=color;x.fillText(text,128,32);map.needsUpdate=true;};
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;draw();document.fonts?.ready.then(draw);
 const s=new T.Sprite(new T.SpriteMaterial({map,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));s.scale.set(.32,.08,1);return s;
}

function planet(r,color,{wire=GREEN}={}){
 const g=new T.Group();
 g.add(new T.Mesh(new T.SphereGeometry(r,20,14),glow(color,.55)));
 g.add(new T.Mesh(new T.SphereGeometry(r*1.06,14,10),glow(wire,.35,{wireframe:true})));
 return g;
}

export function createMissionHolo(ship,{anisotropy=8,still=false}={}){
 if(!ship.root.getObjectByName(ROOM))return null;
 // The group stands at floor height so it joins Deck 20's band; its pieces are placed relative to the table's foot.
 const group=new T.Group();group.name='Mission_holo_table';group.position.set(AT.x,FLOOR,AT.z);
 const metal=new T.MeshStandardMaterial({color:0x26343c,roughness:.45,metalness:.6}),trim=new T.MeshStandardMaterial({color:0x8fa3ab,roughness:.35,metalness:.8});
 const add=(geo,mat,y)=>{const o=new T.Mesh(geo,mat);o.position.y=y;group.add(o);return o;};
 add(new T.CylinderGeometry(1.05,1.15,.08,48),metal,.04);
 add(new T.CylinderGeometry(.62,.85,.74,40),metal,.45);
 add(new T.CylinderGeometry(R,R*.92,.1,64),metal,TOP-.05);
 add(new T.TorusGeometry(R,.035,10,96),trim,TOP).rotation.x=Math.PI/2;
 add(new T.TorusGeometry(R-.06,.014,8,96),glow(GREEN,.9),TOP+.012).rotation.x=Math.PI/2;
 add(new T.TorusGeometry(.95,.02,8,72),glow(TEAL,.7),.3).rotation.x=Math.PI/2;
 // The emitter face, lit from within under a smoked glass top.
 {const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=anisotropy;
  const draw=()=>{paintFace(canvas.getContext('2d'));map.needsUpdate=true;};draw();document.fonts?.ready.then(draw);
  add(new T.CircleGeometry(R-.07,96),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false}),TOP+.006).rotation.x=-Math.PI/2;
  add(new T.CircleGeometry(R-.04,96),new T.MeshStandardMaterial({color:0x0b1a1c,transparent:true,opacity:.35,roughness:.05,metalness:.3,depthWrite:false}),TOP+.014).rotation.x=-Math.PI/2;}
 // A faint beam rising from the glass to the plot.
 add(new T.CylinderGeometry(R-.1,R-.12,HOLO-TOP,64,1,true),glow(GREEN,.05,{side:T.DoubleSide}),(HOLO+TOP)/2);

 // The plot itself.
 const holo=new T.Group();holo.position.y=HOLO;group.add(holo);
 const sun=planet(.06,0xffd27a,{wire:0xffe6a8});holo.add(sun);
 for(const [r,color,o] of [[EARTH,TEAL,.5],[MARS,GREEN,.5],[JUPITER,TEAL,.35]])holo.add(ring(r,color,o));
 holo.add(ring(.3,GREEN,.2,64));
 // The transfer course: a bright track with a dashed shadow on the plane below it.
 const pts=Array.from({length:81},(_,i)=>course(i/80));
 holo.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),lineGlow(GREEN,1)));
 holo.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),80,.008,6),glow(GREEN,.55)));
 {const l=new T.Line(new T.BufferGeometry().setFromPoints(pts.map(p=>new T.Vector3(p.x,-.12,p.z))),new T.LineDashedMaterial({color:GREEN,dashSize:.04,gapSize:.03,transparent:true,opacity:.4,depthWrite:false,toneMapped:false}));l.computeLineDistances();holo.add(l);}
 const earth=planet(.07,0x3fa9ff);earth.position.copy(course(0));holo.add(earth);
 const mars=planet(.06,0xff6a3d);mars.position.copy(course(1));holo.add(mars);
 const jupiter=planet(.1,0xe8b98a,{wire:TEAL});jupiter.position.set(Math.cos(2.2)*JUPITER,0,Math.sin(2.2)*JUPITER);holo.add(jupiter);
 const moons=[[earth,.13,.018,0xd0d4da,1.2],[mars,.1,.012,0xc9c0b0,2.4],[mars,.15,.01,0xc9c0b0,-1.5],[jupiter,.17,.016,0xe8e0c8,.9]].map(([host,r,size,color,speed])=>{
  const m=new T.Mesh(new T.SphereGeometry(size,10,8),glow(color,.9));host.add(m);host.add(ring(r,GREEN,.18,48));return {m,r,speed,a:speed*3};});
 for(const [p,name,color] of [[earth,'EARTH','#7fd0ff'],[mars,'MARS','#ff9a7a'],[jupiter,'JUPITER','#f2d9a8'],[sun,'SOL','#ffe6a8']]){const s=label(name,color);s.position.y=.17;p.add(s);}
 // Leo's marker, its heading along the course, and a halo so it reads at a glance.
 const leo=new T.Group();holo.add(leo);
 {const hull=new T.Mesh(new T.ConeGeometry(.022,.09,10),glow(0xeafff2,1));hull.rotation.z=-Math.PI/2;leo.add(hull);
  const halo=new T.Mesh(new T.TorusGeometry(.05,.004,6,32),glow(GREEN,.9));halo.rotation.x=Math.PI/2;leo.add(halo);
  const s=label('LEO','#b8ffd2');s.position.y=.11;leo.add(s);}
 // The asteroid belt between Mars and Jupiter, turning slowly.
 const belt=new T.Group();holo.add(belt);
 {const r=rng(7),p=[];for(let i=0;i<260;i++){const a=r()*Math.PI*2,d=1+r()*.1;p.push(Math.cos(a)*d,(r()-.5)*.04,Math.sin(a)*d);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  belt.add(new T.Points(g,new T.PointsMaterial({color:0xc9e8d6,size:.012,transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false})));}
 // Meteors: a bright head and a fading tail, each crossing the plot and starting again elsewhere.
 const rand=rng(31),meteors=Array.from({length:7},()=>{
  const g=new T.Group(),tail=new T.Mesh(new T.CylinderGeometry(.002,.007,.22,6),glow(0xb8ffd2,.55));tail.position.x=-.11;tail.rotation.z=Math.PI/2;
  g.add(new T.Mesh(new T.SphereGeometry(.012,8,6),glow(0xffffff,1)),tail);holo.add(g);return {g,from:new T.Vector3(),dir:new T.Vector3(),t:0,len:1};});
 const launch=(m,t=0)=>{const a=rand()*Math.PI*2,b=a+Math.PI+(rand()-.5)*1.2,y=(rand()-.3)*.5;
  m.from.set(Math.cos(a)*1.25,y,Math.sin(a)*1.25);m.dir.set(Math.cos(b)*1.25,y+(rand()-.5)*.3,Math.sin(b)*1.25).sub(m.from);m.len=m.dir.length();m.dir.normalize();
  m.speed=.35+rand()*.45;m.t=t*m.len;m.g.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),m.dir);};
 meteors.forEach((m,i)=>launch(m,i/meteors.length));
 // Rings of light scan up from the glass now and then.
 const scans=[0,.5].map(s=>{const o=new T.Mesh(new T.TorusGeometry(R-.12,.006,6,96),glow(GREEN,.6));o.rotation.x=Math.PI/2;group.add(o);return {o,s};});

 const solid=new T.Group();solid.name='Mission_holo_colliders';
 {const o=new T.Mesh(new T.CylinderGeometry(R,R,TOP,16));o.position.set(AT.x,FLOOR+TOP/2,AT.z);solid.add(o);}
 let clock=0,leoT=0;const here=new T.Vector3(AT.x,FLOOR+1,AT.z),p=new T.Vector3(),q=new T.Vector3();
 const place=()=>{
  const t=leoT%1;leo.position.copy(course(t));q.copy(course(Math.min(t+.01,1))).sub(course(Math.max(t-.01,0))).normalize();
  leo.rotation.set(0,Math.atan2(-q.z,q.x),0);
 };
 place();
 function update(dt,walker){
  if(still||walker.distanceTo(here)>NEAR)return;
  dt=Math.min(dt,.1);clock+=dt;leoT+=dt/LOOP;place();
  holo.rotation.y+=dt*.04;belt.rotation.y+=dt*.06;
  for(const p of [earth,mars,jupiter,sun])p.children[1].rotation.y+=dt*.5;
  for(const m of moons){m.a+=dt*m.speed;m.m.position.set(Math.cos(m.a)*m.r,0,Math.sin(m.a)*m.r);}
  for(const m of meteors){m.t+=dt*m.speed;if(m.t>m.len)launch(m);m.g.position.copy(p.copy(m.dir).multiplyScalar(m.t).add(m.from));}
  for(const s of scans){const f=(clock*.35+s.s)%1;s.o.position.y=TOP+.02+f*(HOLO-TOP+.4);s.o.material.opacity=.6*(1-f);}
  holo.children[0].children[0].material.opacity=.5+.1*Math.sin(clock*3);
 }
 return {group,solid,update};
}
