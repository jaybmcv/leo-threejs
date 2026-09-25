import * as T from 'three';

// Mars as seen from the forward lounge and the fin crown: a painted surface (dark albedo regions, Valles Marineris,
// craters, polar caps) lit from one side, with a thin dusty haze at the limb.
export const MARS_RADIUS=180;
const SUN=new T.Vector3(-.5,.3,.81).normalize();// Mars-to-sun, so the lounge sees a gibbous planet with a terminator

function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

function surfaceTexture(){
 const c=document.createElement('canvas');c.width=2048;c.height=1024;const g=c.getContext('2d'),w=c.width,h=c.height,rnd=seeded(1976);
 const base=g.createLinearGradient(0,0,0,h);base.addColorStop(0,'#c98a5e');base.addColorStop(.5,'#c0643a');base.addColorStop(1,'#b8764e');g.fillStyle=base;g.fillRect(0,0,w,h);
 // Broad dark albedo regions and bright dusty plains.
 g.filter='blur(18px)';
 for(let i=0;i<70;i++){g.fillStyle=`rgba(${70+rnd()*30|0},${28+rnd()*14|0},${14+rnd()*10|0},${.18+rnd()*.3})`;g.beginPath();g.ellipse(rnd()*w,h*.25+rnd()*h*.5,40+rnd()*220,20+rnd()*90,rnd()*Math.PI,0,Math.PI*2);g.fill();}
 for(let i=0;i<40;i++){g.fillStyle=`rgba(235,170,120,${.08+rnd()*.14})`;g.beginPath();g.ellipse(rnd()*w,rnd()*h,60+rnd()*200,30+rnd()*90,rnd()*Math.PI,0,Math.PI*2);g.fill();}
 // Valles Marineris: a long canyon system just south of the equator.
 g.filter='blur(5px)';g.strokeStyle='rgba(60,22,10,.5)';g.lineWidth=10;g.beginPath();g.moveTo(w*.42,h*.53);g.bezierCurveTo(w*.48,h*.5,w*.55,h*.57,w*.63,h*.55);g.stroke();
 g.lineWidth=4;g.strokeStyle='rgba(60,22,10,.35)';g.beginPath();g.moveTo(w*.45,h*.545);g.bezierCurveTo(w*.5,h*.53,w*.56,h*.585,w*.61,h*.57);g.stroke();
 // Craters, soft and sparse.
 g.filter='blur(1.5px)';
 for(let i=0;i<140;i++){const x=rnd()*w,y=h*.12+rnd()*h*.76,r=2+rnd()**3*18;g.strokeStyle=`rgba(70,30,14,${.08+rnd()*.12})`;g.lineWidth=1+r*.1;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();g.fillStyle=`rgba(240,190,150,${.04+rnd()*.06})`;g.beginPath();g.arc(x-r*.25,y-r*.25,r*.6,0,Math.PI*2);g.fill();}
 // Polar caps.
 g.filter='blur(6px)';
 for(const [y0,y1] of [[0,h*.07],[h*.95,h]]){g.fillStyle='rgba(246,240,232,.92)';g.fillRect(0,y0,w,y1-y0);}
 for(let i=0;i<30;i++){g.fillStyle='rgba(246,240,232,.6)';g.beginPath();g.ellipse(rnd()*w,rnd()<.5?h*.075:h*.945,30+rnd()*70,6+rnd()*14,0,0,Math.PI*2);g.fill();}
 // Turn the canyon side (the texture's middle) towards the ship, which looks at Mars along +x.
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;t.wrapS=T.RepeatWrapping;t.offset.x=.5;return t;
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
