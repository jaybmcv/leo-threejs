import * as T from 'three';

// Mars as seen from the forward lounge and the fin crown: a painted surface (mottled ground, dark albedo regions,
// the Tharsis volcanoes, Valles Marineris, craters, polar caps) lit from one side, with a thin dusty haze at the limb.
export const MARS_RADIUS=180;
const SUN=new T.Vector3(-.5,.3,.81).normalize();// Mars-to-sun, so the lounge sees a gibbous planet with a terminator

function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

// Fractal value noise that wraps east to west, so the mottling has no seam where the texture's edges meet.
function noiseLayer(w,h,rnd,cells=8,octaves=5){
 const lattice=new Float32Array(65536).map(()=>rnd()),at=(x,y)=>lattice[(y&255)*256+(x&255)];
 const smooth=t=>t*t*(3-2*t);
 function value(x,y,period){const xi=Math.floor(x),yi=Math.floor(y),fx=smooth(x-xi),fy=smooth(y-yi),x0=((xi%period)+period)%period,x1=(x0+1)%period;
  const a=at(x0,yi)+(at(x1,yi)-at(x0,yi))*fx,b=at(x0,yi+1)+(at(x1,yi+1)-at(x0,yi+1))*fx;return a+(b-a)*fy;}
 const out=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,amp=.5,f=cells;
  for(let o=0;o<octaves;o++){s+=amp*value(x/w*f,y/h*f*.5+o*7,f);amp*=.5;f*=2;}out[y*w+x]=s;}
 return out;
}

function surfaceTexture(){
 const c=document.createElement('canvas');c.width=2048;c.height=1024;const g=c.getContext('2d'),w=c.width,h=c.height,rnd=seeded(1976);
 const base=g.createLinearGradient(0,0,0,h);base.addColorStop(0,'#c98a5e');base.addColorStop(.5,'#c0643a');base.addColorStop(1,'#b8764e');g.fillStyle=base;g.fillRect(0,0,w,h);
 // Mottled ground: fractal noise darkens rocky ground to rust-brown and lifts dusty ground to ochre, at every scale.
 const nw=512,nh=256,n=noiseLayer(nw,nh,rnd),m=document.createElement('canvas');m.width=nw;m.height=nh;
 const mg=m.getContext('2d'),img=mg.createImageData(nw,nh);
 for(let i=0;i<n.length;i++){const v=(n[i]-.5)*2.2,dark=v<0;
  img.data.set(dark?[92,38,20,Math.min(255,-v*190)]:[236,176,122,Math.min(255,v*120)],i*4);}
 mg.putImageData(img,0,0);g.imageSmoothingQuality='high';g.drawImage(m,0,0,w,h);
 // Broad dark albedo regions and bright dusty plains.
 g.filter='blur(22px)';
 for(let i=0;i<45;i++){g.fillStyle=`rgba(${70+rnd()*30|0},${28+rnd()*14|0},${14+rnd()*10|0},${.12+rnd()*.22})`;g.beginPath();g.ellipse(rnd()*w,h*.25+rnd()*h*.5,40+rnd()*220,20+rnd()*90,rnd()*Math.PI,0,Math.PI*2);g.fill();}
 for(let i=0;i<30;i++){g.fillStyle=`rgba(235,170,120,${.06+rnd()*.12})`;g.beginPath();g.ellipse(rnd()*w,rnd()*h,60+rnd()*200,30+rnd()*90,rnd()*Math.PI,0,Math.PI*2);g.fill();}
 // The named dark regions on the side the ship faces: Acidalia to the north, Erythraeum and Aurorae to the south.
 for(const [x,y,rx,ry,a] of [[.47,.27,150,55,.4],[.56,.66,190,60,.35],[.6,.6,80,35,.3],[.5,.72,120,40,.25]]){
  g.fillStyle=`rgba(78,32,16,${a})`;g.beginPath();g.ellipse(w*x,h*y,rx,ry,(rnd()-.5)*.6,0,Math.PI*2);g.fill();}
 // Tharsis: a bright, dusty rise west of the canyons, with three shield volcanoes in a line and Olympus Mons beyond.
 g.fillStyle='rgba(238,184,136,.28)';g.beginPath();g.ellipse(w*.36,h*.46,160,110,0,0,Math.PI*2);g.fill();
 g.filter='blur(2px)';
 for(const [x,y,r] of [[.29,.4,34],[.355,.43,15],[.365,.48,17],[.375,.53,14]]){
  const dome=g.createRadialGradient(w*x-r*.3,h*y-r*.3,0,w*x,h*y,r*1.6);dome.addColorStop(0,'rgba(246,206,166,.55)');dome.addColorStop(.6,'rgba(222,160,112,.3)');dome.addColorStop(1,'rgba(150,80,44,0)');
  g.fillStyle=dome;g.beginPath();g.arc(w*x,h*y,r*1.6,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(120,56,30,.45)';g.lineWidth=1.5;g.beginPath();g.arc(w*x,h*y,r*1.45,0,Math.PI*2);g.stroke();
  g.fillStyle='rgba(84,36,18,.6)';g.beginPath();g.arc(w*x,h*y,r*.22,0,Math.PI*2);g.fill();}
 // Valles Marineris: a long canyon system just south of the equator, branching into Noctis Labyrinthus at its west end.
 g.filter='blur(4px)';g.strokeStyle='rgba(60,22,10,.55)';g.lineWidth=10;g.beginPath();g.moveTo(w*.42,h*.53);g.bezierCurveTo(w*.48,h*.5,w*.55,h*.57,w*.63,h*.55);g.stroke();
 g.lineWidth=4;g.strokeStyle='rgba(60,22,10,.38)';g.beginPath();g.moveTo(w*.45,h*.545);g.bezierCurveTo(w*.5,h*.53,w*.56,h*.585,w*.61,h*.57);g.stroke();
 g.filter='blur(2.5px)';g.lineWidth=2.5;
 for(let i=0;i<14;i++){const x=w*(.4+rnd()*.03),y=h*(.5+rnd()*.06),a=rnd()*Math.PI*2,l=8+rnd()*16;
  g.strokeStyle=`rgba(60,22,10,${.15+rnd()*.2})`;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l*.6);g.stroke();}
 // Light canyon walls along the north rim catch the sun.
 g.filter='blur(2px)';g.strokeStyle='rgba(240,190,146,.3)';g.lineWidth=2;g.beginPath();g.moveTo(w*.42,h*.522);g.bezierCurveTo(w*.48,h*.492,w*.55,h*.562,w*.63,h*.542);g.stroke();
 // Craters: many small and a few large, each with a darker floor, a shadowed rim on one side and a lit rim on the other.
 g.filter='blur(1.2px)';
 for(let i=0;i<360;i++){const x=rnd()*w,y=h*.1+rnd()*h*.8,r=1.5+rnd()**5*24,a=.05+rnd()*.09;
  g.fillStyle=`rgba(96,44,22,${a*.8})`;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
  g.lineWidth=Math.max(1,r*.14);
  g.strokeStyle=`rgba(64,26,12,${a*1.6})`;g.beginPath();g.arc(x,y,r,Math.PI*.75,Math.PI*1.75);g.stroke();
  g.strokeStyle=`rgba(246,200,158,${a*1.3})`;g.beginPath();g.arc(x,y,r,Math.PI*1.75,Math.PI*2.75);g.stroke();}
 // Faint dust streaks trailing from craters, all blown the same way.
 g.filter='blur(3px)';
 for(let i=0;i<60;i++){const x=rnd()*w,y=h*.2+rnd()*h*.6;g.fillStyle=`rgba(240,186,140,${.05+rnd()*.07})`;g.beginPath();g.ellipse(x+14,y+4,18+rnd()*26,3+rnd()*4,.25,0,Math.PI*2);g.fill();}
 // Polar caps with ragged edges and dark lanes spiralling in the north.
 g.filter='blur(6px)';
 for(const [y0,y1] of [[0,h*.07],[h*.95,h]]){g.fillStyle='rgba(246,240,232,.92)';g.fillRect(0,y0,w,y1-y0);}
 for(let i=0;i<60;i++){g.fillStyle=`rgba(246,240,232,${.35+rnd()*.35})`;g.beginPath();g.ellipse(rnd()*w,rnd()<.5?h*(.07+rnd()*.025):h*(.93+rnd()*.02),20+rnd()*70,5+rnd()*14,0,0,Math.PI*2);g.fill();}
 g.filter='blur(7px)';g.strokeStyle='rgba(170,116,88,.22)';g.lineWidth=8;
 for(let i=0;i<14;i++){const x=rnd()*w;g.beginPath();g.moveTo(x,h*.01);g.quadraticCurveTo(x+40,h*.04,x+90,h*.065);g.stroke();}
 g.filter='none';
 // Turn the canyon side (the texture's middle) towards the ship, which looks at Mars along +x.
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;t.wrapS=T.RepeatWrapping;t.offset.x=.5;return t;
}

// Soft day side, a narrow twilight band, and a faintly visible night side.
function sunShading(geometry){
 const n=geometry.attributes.normal,colors=new Float32Array(n.count*3),v=new T.Vector3();
 for(let i=0;i<n.count;i++){const d=v.fromBufferAttribute(n,i).dot(SUN),lit=T.MathUtils.smoothstep(d,-.12,.35)*(.72+.28*Math.max(0,d)),s=.035+lit;colors[i*3]=s;colors[i*3+1]=s*.97;colors[i*3+2]=s*.94;}
 geometry.setAttribute('color',new T.BufferAttribute(colors,3));
}

function hazeTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d'),r=256,limb=r/1.14;
 const grad=g.createRadialGradient(r,r,limb*.96,r,r,r);grad.addColorStop(0,'rgba(255,190,140,0)');grad.addColorStop(.12,'rgba(255,176,128,.55)');grad.addColorStop(.35,'rgba(240,140,100,.18)');grad.addColorStop(1,'rgba(200,110,80,0)');
 g.fillStyle=grad;g.fillRect(0,0,512,512);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}

export function createMars(){
 const geometry=new T.SphereGeometry(MARS_RADIUS,128,64);sunShading(geometry);
 const mars=new T.Mesh(geometry,new T.MeshBasicMaterial({map:surfaceTexture(),vertexColors:true}));mars.name='Mars';
 // The haze billboard sits at the planet's centre, so the planet hides all of it but the ring past the limb.
 const haze=new T.Sprite(new T.SpriteMaterial({map:hazeTexture(),transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.75}));
 haze.name='Mars_haze';haze.scale.setScalar(MARS_RADIUS*2*1.14);mars.add(haze);
 return mars;
}
