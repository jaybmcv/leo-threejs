import * as T from 'three';

// The Leo street-cat longboard, ported from the approved Longboard Studio prop (leo-longboard-threejs, dist/model.js):
// the curved deck with concave, lifted tips, bevelled edges, seven maple plies and inked rims; the cast trucks with
// risers, baseplates, bolts, kingpins, bushings and axles; four rounded coral wheels with bearings. The underside
// carries the concept sheet's deck graphic (art/longboard-deck.jpg, cropped from the sheet), the grip its redrawn cat,
// cross and MEOW OR NEVER. Walkers ride it down a long drop (glide.js).
// Object coordinates as in the studio: X is length (10 units, nose at +X), Y is width, +Z is the illustrated underside.
// Geometry is shared by every board on the page; `createLongboard` returns a fresh group.
export const LONGBOARD_ART=['longboard-deck.jpg'];
const L=10,W=2.18;
const bend=(x,y)=>-.23*Math.pow(x/5,8)-.085*Math.pow(y/(W/2),2);
const bevelScale=z=>1-.009*Math.pow(Math.abs(z)/.071,4);
function outline(){
 const s=new T.Shape();s.moveTo(-5,0);
 s.bezierCurveTo(-3.8,.89,-2.25,1.09,0,1.09);
 s.bezierCurveTo(2.4,1.09,4.15,.91,5,0);
 s.bezierCurveTo(4.1,-.88,2.3,-1.09,0,-1.09);
 s.bezierCurveTo(-2.3,-1.09,-3.8,-.87,-5,0);
 return s.getPoints(48).slice(0,-1);
}
let points=null;
function faceGeometry(z,back=false){
 const pos=[],uv=[],ind=[],N=points.length,rings=10;
 pos.push(0,0,z);uv.push(.5,.5);
 for(let r=1;r<=rings;r++)for(const p of points){const x=p.x*r/rings*bevelScale(z),y=p.y*r/rings*bevelScale(z);pos.push(x,y,z+bend(x,y));uv.push(x/L+.5,back?.5-y/W:y/W+.5);}
 for(let i=0;i<N;i++)ind.push(0,1+i,1+(i+1)%N);
 for(let r=1;r<rings;r++)for(let i=0;i<N;i++){const a=1+(r-1)*N+i,b=1+(r-1)*N+(i+1)%N,c=1+r*N+i,d=1+r*N+(i+1)%N;ind.push(a,c,b,b,c,d);}
 // Outline order is clockwise as viewed from +Z.
 if(!back)for(let i=0;i<ind.length;i+=3)[ind[i+1],ind[i+2]]=[ind[i+2],ind[i+1]];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();return g;
}
function sideGeometry(lo,hi){
 const p=[],uv=[],idx=[],N=points.length;
 for(const q of points)for(const z of [lo,hi]){const s=bevelScale(z);p.push(q.x*s,q.y*s,z+bend(q.x*s,q.y*s));uv.push(q.x/L+.5,z);}
 for(let i=0;i<N;i++){const a=2*i,b=2*((i+1)%N);idx.push(a,a+1,b,a+1,b+1,b);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function edgeGeometry(z,r){
 const s=bevelScale(z),curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p.x*s,p.y*s,z+bend(p.x*s,p.y*s))),true,'centripetal');
 return new T.TubeGeometry(curve,160,r,5,true);
}
function rng(seed=37){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
// Grain for the satin wood, the gritty grip and the soft urethane: a roughness map and a normal map from one noise field.
function grainMaps(base=180,strength=35){
 const random=rng(),size=128,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d'),d=ctx.createImageData(size,size),heights=[];
 for(let i=0;i<size*size;i++){const n=base+(random()-.5)*strength;heights.push(n);d.data.set([n,n,n,255],i*4);}ctx.putImageData(d,0,0);
 const rough=new T.CanvasTexture(c);rough.wrapS=rough.wrapT=T.RepeatWrapping;rough.repeat.set(7,2);
 const nc=document.createElement('canvas');nc.width=nc.height=size;const nx=nc.getContext('2d'),nd=nx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x;const dx=(heights[y*size+(x+1)%size]-heights[i])*.5,dy=(heights[((y+1)%size)*size+x]-heights[i])*.5;nd.data.set([128-dx,128-dy,254,255],i*4);}nx.putImageData(nd,0,0);
 const normal=new T.CanvasTexture(nc);normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.repeat.copy(rough.repeat);return {rough,normal};
}
// The grip artwork, redrawn as in the studio at half its resolution: purple cross, green cat, MEOW OR NEVER, maple flecks.
function gripTexture(){
 const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d'),random=rng(9);
 ctx.scale(.5,.5);
 ctx.fillStyle='#28272e';ctx.fillRect(0,0,2048,512);
 for(let i=0;i<40000;i++){const n=25+random()*45;ctx.fillStyle=`rgba(${n},${n},${n+3},.65)`;ctx.fillRect(random()*2048,random()*512,2.4,2.4);}
 ctx.save();ctx.translate(380,260);ctx.rotate(-.2);ctx.strokeStyle='#a966c4';ctx.lineWidth=14;ctx.lineCap='square';
 for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(-43+i*3,-58);ctx.lineTo(45+i*3,58);ctx.moveTo(43+i*3,-58);ctx.lineTo(-45+i*3,58);ctx.stroke();}ctx.restore();
 ctx.save();ctx.translate(1030,265);ctx.strokeStyle='#76c68a';ctx.lineWidth=7;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(-93,-35);ctx.lineTo(-90,-106);ctx.lineTo(-41,-66);ctx.quadraticCurveTo(0,-82,43,-66);ctx.lineTo(89,-106);ctx.lineTo(91,-30);ctx.bezierCurveTo(120,84,-109,98,-93,-35);ctx.stroke();
 for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(s*25,-5);ctx.lineTo(s*66,-14);ctx.lineTo(s*40,8);ctx.closePath();ctx.fillStyle='#76c68a';ctx.fill();for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(s*78,14+i*12);ctx.lineTo(s*143,2+i*23);ctx.stroke();}}
 ctx.beginPath();ctx.moveTo(-9,27);ctx.lineTo(9,27);ctx.lineTo(0,36);ctx.closePath();ctx.fill();ctx.restore();
 ctx.save();ctx.translate(1585,265);ctx.rotate(.14);ctx.fillStyle='#a86bd0';ctx.beginPath();ctx.roundRect(-82,-98,164,196,10);ctx.fill();ctx.fillStyle='#2c213b';ctx.font='italic 900 35px sans-serif';ctx.textAlign='center';['MEOW','OR','NEVER'].forEach((s,i)=>ctx.fillText(s,0,-40+i*44));ctx.restore();
 ctx.strokeStyle='#b99864';ctx.lineWidth=2;for(let i=0;i<24;i++){const x=random()<.5?random()*120:1928+random()*120;const y=220+random()*80;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*23,y+random()*8);ctx.stroke();}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
// Without the build's art (a page built without __ART_URLS__), a plain maple deck with LEO on it.
function fallbackArt(){
 const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');
 ctx.fillStyle='#f0a531';ctx.fillRect(0,0,512,128);ctx.fillStyle='#28222c';ctx.font='900 64px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('LEO',256,66);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
function hangerGeometry(){
 const s=new T.Shape();s.moveTo(-.66,.49);s.lineTo(-.66,.59);s.quadraticCurveTo(-.4,.62,-.19,.70);s.quadraticCurveTo(0,.78,.19,.70);s.quadraticCurveTo(.4,.62,.66,.59);s.lineTo(.66,.49);s.lineTo(.22,.47);s.quadraticCurveTo(0,.32,-.22,.47);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth:.17,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:10});const a=g.attributes.position;
 for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);a.setXYZ(i,.065+z-.085,x,y);}g.computeVertexNormals();return g;
}
function plateGeometry(){
 const ps=new T.Shape();ps.moveTo(-.235,-.25);ps.lineTo(.235,-.25);ps.quadraticCurveTo(.285,-.25,.285,-.20);ps.lineTo(.285,.20);ps.quadraticCurveTo(.285,.25,.235,.25);ps.lineTo(-.235,.25);ps.quadraticCurveTo(-.285,.25,-.285,.20);ps.lineTo(-.285,-.20);ps.quadraticCurveTo(-.285,-.25,-.235,-.25);
 return new T.ExtrudeGeometry(ps,{depth:.065,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.012});
}

let kit=null;
function parts(urls){
 if(kit)return kit;
 points=points||outline();
 const mat=(name,color,roughness=.65,metalness=0)=>new T.MeshStandardMaterial({name:'Walk_longboard_'+name,color,roughness,metalness});
 const woodGrain=grainMaps(205,30),grit=grainMaps(245,20),urethane=grainMaps(220,18);
 const art=new T.MeshPhysicalMaterial({name:'Walk_longboard_art',color:'#ffffff',roughness:.72,clearcoat:.1,clearcoatRoughness:.7});
 const file=urls?.[LONGBOARD_ART[0]];
 if(file){art.map=new T.TextureLoader().load(file);art.map.colorSpace=T.SRGBColorSpace;art.map.anisotropy=4;}else art.map=fallbackArt();
 art.roughnessMap=woodGrain.rough;art.normalMap=woodGrain.normal;art.normalScale.set(.13,.13);
 const grip=mat('grip','#ffffff',1);grip.map=gripTexture();grip.normalMap=grit.normal;grip.normalScale.set(.9,.9);
 const pink=mat('urethane','#ef8c94',.6);pink.roughnessMap=urethane.rough;pink.normalMap=urethane.normal;pink.normalScale.set(.25,.25);
 const m={art,grip,pink,ink:mat('ink','#28222c'),metal:mat('metal','#666e7a',.31,.73),light:mat('steel','#c5cbd0',.23,.8),rubber:mat('rubber','#302934',.95),
  pinkDark:mat('bushing','#b74d67',.65),cream:mat('paint','#ffd2c6',.5),wear:mat('wear','#e7c891',.86),plies:[mat('ply_dark','#724323'),mat('ply_light','#d6a048')]};
 const cyl=(r,r2=r)=>new T.CylinderGeometry(r2,r,1,12);
 const g={under:faceGeometry(.071),top:faceGeometry(-.071,true),plies:Array.from({length:7},(_,i)=>sideGeometry(-.07+i*.02,-.05+i*.02)),
  rimUnder:edgeGeometry(.071,.008),rimTop:edgeGeometry(-.071,.008),hanger:hangerGeometry(),plate:plateGeometry(),riser:new T.BoxGeometry(.58,.52,.035),
  slot:new T.BoxGeometry(.045,.009,.007),tread:new T.TorusGeometry(.331,.0015,4,18,.5),
  wheel:new T.LatheGeometry([[.085,-.155],[.25,-.155],[.30,-.14],[.326,-.11],[.332,-.07],[.332,.07],[.326,.11],[.30,.14],[.25,.155],[.085,.155],[.085,.115],[.11,.095],[.11,-.095],[.085,-.115],[.085,-.155]].map(p=>new T.Vector2(...p)),40),
  seal:new T.TorusGeometry(.091,.019,6,24),bearing:new T.TorusGeometry(.064,.014,6,24),sidewall:new T.TorusGeometry(.287,.005,4,32),paint:new T.TorusGeometry(.295,.007,5,10,.38),
  cyl};
 kit={m,g};return kit;
}

export function createLongboard(urls){
 const {m,g}=parts(urls),root=new T.Group();root.name='Walk_longboard';
 const add=(geo,mat,parent,name)=>{const a=new T.Mesh(geo,mat);a.name=name;a.castShadow=true;parent.add(a);return a;};
 const rod=(parent,a,b,r,mat,name,r2=r)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),v=vb.clone().sub(va);const o=add(g.cyl(r,r2),mat,parent,name);
  o.scale.y=v.length();o.position.copy(va).add(vb).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;};
 const deck=new T.Group();deck.name='Walk_longboard_deck';root.add(deck);
 add(g.under,m.art,deck,'Illustrated_Underside');add(g.top,m.grip,deck,'Grip');
 g.plies.forEach((p,i)=>add(p,m.plies[i%2?0:1],deck,'Maple_Ply'));
 add(g.rimUnder,m.ink,deck,'Underside_Rim');add(g.rimTop,m.ink,deck,'Grip_Rim');
 const random=rng(51);
 for(let i=0;i<16;i++){const k=(i%2?0:points.length/2|0)+Math.floor(random()*10);const p=points[k%points.length],q=points[(k+1)%points.length];rod(deck,[p.x*.996,p.y*.996,bend(p.x,p.y)],[q.x*.996,q.y*.996,bend(q.x,q.y)],.006+random()*.007,m.wear,'Maple_Edge_Scrape');}
 const wheels=[];
 for(const x of [-3.05,3.05]){
  const truck=new T.Group();truck.name=x<0?'Rear_Truck':'Front_Truck';truck.position.set(x,0,bend(x,0));root.add(truck);
  add(g.riser,m.rubber,truck,'Riser').position.set(0,0,.108);
  add(g.plate,m.metal,truck,'Baseplate').position.z=.13;
  for(const dx of [-.2,.2])for(const y of [-.18,.18]){
   rod(truck,[dx,y,.18],[dx,y,.225],.045,m.light,'Baseplate_Bolt');add(g.slot,m.ink,truck,'Bolt_Slot').position.set(dx,y,.25);
   rod(deck,[x+dx,y,-.08+bend(x+dx,y)],[x+dx,y,-.092+bend(x+dx,y)],.035,m.light,'Grip_Bolt');
  }
  rod(truck,[-.12,0,.19],[.11,0,.55],.10,m.metal,'Kingpin',.065);
  rod(truck,[.04,0,.29],[.10,0,.41],.145,m.pinkDark,'Bushing');
  rod(truck,[-.2,0,.19],[.04,0,.54],.075,m.metal,'Pivot');
  rod(truck,[.065,-.81,.55],[.065,.81,.55],.052,m.light,'Axle');
  add(g.hanger,m.metal,truck,'Hanger');
  rod(truck,[.18,0,.6],[.24,0,.66],.064,m.light,'Kingpin_Nut');
  for(const sign of [-1,1]){
   const wheel=new T.Group();wheel.name='Wheel';wheel.position.set(.065,sign*.82,.55);truck.add(wheel);wheels.push(wheel);
   add(g.wheel,m.pink,wheel,'Urethane');
   for(let i=0;i<3;i++){const t=add(g.tread,m.pinkDark,wheel,'Tread_Line');t.rotation.x=Math.PI/2;t.rotation.z=i*2.1;t.position.y=-.06+i*.05;}
   for(const side of [-1,1]){
    const ring=(geo,mat,y,name)=>{const o=add(geo,mat,wheel,name);o.rotation.x=Math.PI/2;o.position.y=y;return o;};
    ring(g.seal,m.rubber,side*.157,'Bearing_Seal');ring(g.bearing,m.light,side*.162,'Bearing');ring(g.sidewall,m.pinkDark,side*.147,'Sidewall');
    rod(wheel,[0,side*.15,0],[0,side*.185,0],.039,m.metal,'Axle_Nut');
    const mark=ring(g.paint,m.cream,side*.145,'Sidewall_Paint');mark.rotation.z=.9;
   }
  }
 }
 // Spin the wheels by `turns` radians (they turn about the axle, the object's Y).
 return {root,spin(a){for(const w of wheels)w.rotation.y+=a;}};
}
