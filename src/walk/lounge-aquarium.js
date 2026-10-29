import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture,seeded} from '../polish-kit.js';
import {cutOut} from '../cut-out.js';
import {COMMONS} from '../model.js';

// The Hydro-Nip Lounge's aquarium (from tester feedback): its front wall, the one the galleries run along and the jaguar
// gate opens through, becomes a fish tank the depth of the strip behind it (between the lounge and the Deck 17-19
// promenade), from the floor to the ceiling, three storeys in one. Glowing coral, kelp and an octopus sit on its rocks,
// schools of glowing fish swim loops through it, kelp sways and bubbles rise. The jaguar's glass throat (jaguar-gate.js)
// runs through it as the way in, so you walk in with the tank either side and over you. The galleries stay as they were,
// with their rails in front of the glass. Walk only: both glass faces, the ends and the throat's sides are solid;
// inside, everything is the walk's own drawing (unlit colours, no real lights).
// Built in the commons template's own frame (HYDRO_NIP_LOUNGE.md): x along the wall, z from the promenade side (4) to the
// lounge (8), y up from the Deck 17 floor (24.3). The throat is the jaguar gate's: 4 m wide at x 137.25, 3.68 m high.
export const AQUARIUM={x0:113.7,x1:154.3,back:4.07,glass:7.82,front:7.9,floor:24.3,bed:24.62,top:35.5,deck18:28,tunnel:{x0:135.25,x1:139.25,top:28.04}};
const A=AQUARIUM,TUN=A.tunnel,WATER=new T.Color(0x05203f);
const C=hex=>new T.Color(hex);
const NEON=[0xff3fd0,0xff7a3d,0x8dff5a,0x3df0ff,0xa66bff,0xffe44d,0xff4f7a,0x4dffc3].map(C);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// Further from the glass, a colour sinks toward the water's.
const fog=(c,z)=>c.clone().lerp(WATER,clamp((A.glass-z)/3.7,0,1)*.45);
const inTunnel=(x,pad=0)=>x>TUN.x0-pad&&x<TUN.x1+pad;

// The front wall's partitions that the glass replaces (the walk plan's, partitions.js), in the world: Neighborhood 1's
// commons is the template moved aft and mirrored across the centreline (model.js createGardenCommons).
export function aquariumFront(){
 const c=COMMONS[0],s=c.z<0?-1:1,x=v=>v+c.x-132,z=v=>c.z-27*s+s*v,za=z(A.glass-.15),zb=z(8.15);
 return {x0:x(A.x0),x1:x(A.x1),z0:Math.min(za,zb),z1:Math.max(za,zb),y0:A.floor,y1:A.top+.6};
}

// Solid parts, as boxes [x0,x1,y0,y1,z0,z1]: both glass faces (above the throat too), both ends, and the throat's sides and roof.
const SOLIDS=[
 [A.x0,TUN.x0,A.floor,A.top,A.glass,A.front],[TUN.x1,A.x1,A.floor,A.top,A.glass,A.front],[TUN.x0,TUN.x1,TUN.top-.06,A.top,A.glass,A.front],
 [A.x0,TUN.x0,A.floor,A.top,3.97,A.back],[TUN.x1,A.x1,A.floor,A.top,3.97,A.back],[TUN.x0,TUN.x1,TUN.top,A.top,3.97,A.back],
 [A.x0-.1,A.x0,A.floor,A.top,3.97,A.front],[A.x1,A.x1+.1,A.floor,A.top,3.97,A.front],
 [TUN.x0,TUN.x0+.05,A.floor,TUN.top,A.back,A.glass],[TUN.x1-.05,TUN.x1,A.floor,TUN.top,A.back,A.glass],[TUN.x0,TUN.x1,TUN.top-.06,TUN.top,A.back,A.glass],
];
const boxGeometry=([x0,x1,y0,y1,z0,z1])=>new T.BoxGeometry(x1-x0,y1-y0,z1-z0).translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
const at=(x,y,z,ry=0,s=1,rx=0,rz=0)=>new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),typeof s==='number'?new T.Vector3(s,s,s):new T.Vector3(...s));

// Geometry lists by material. put(): a local shape placed by `m`, coloured per vertex by colour(world point, normal,
// local point), and swaying by sway(world point, local point) metres (0 for none).
function lists(){
 const out={life:[],fish:[],bubbles:[],halos:[],rays:[],steel:[],lines:[]};
 const v=new T.Vector3(),q=new T.Vector3(),n=new T.Vector3();
 out.put=(list,g,m,colour,sway=null,phase=0)=>{
  g=g.index?g.toNonIndexed():g.clone();const local=g.attributes.position.clone();g.applyMatrix4(m);if(!g.attributes.normal)g.computeVertexNormals();
  const p=g.attributes.position,nn=g.attributes.normal,k=p.count,c=new Float32Array(k*3),s=new Float32Array(k),ph=new Float32Array(k).fill(phase);
  for(let i=0;i<k;i++){v.fromBufferAttribute(p,i);q.fromBufferAttribute(local,i);n.fromBufferAttribute(nn,i);const cc=colour(v,n,q);c[i*3]=cc.r;c[i*3+1]=cc.g;c[i*3+2]=cc.b;s[i]=sway?sway(v,q):0;}
  for(const a of Object.keys(g.attributes))if(a!=='position')g.deleteAttribute(a);
  g.setAttribute('color',new T.BufferAttribute(c,3));g.setAttribute('aSway',new T.BufferAttribute(s,1));g.setAttribute('aPhase',new T.BufferAttribute(ph,1));(out[list]||list).push(g);
 };
 return out;
}

// Shapes, each with its base at the origin.
function rockShape(r,seed){
 const g=new T.IcosahedronGeometry(1,1),p=g.attributes.position,v=new T.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const f=1+.2*Math.sin(v.x*5.1+seed)*Math.sin(v.y*4.3+seed*2)+.12*Math.sin(v.z*6.7+seed*3);p.setXYZ(i,v.x*f*r[0],v.y*f*r[1]+r[1]*.55,v.z*f*r[2]);}
 g.computeVertexNormals();return g;
}
function branchShape(rnd,h){
 const parts=[],up=new T.Vector3(0,1,0);
 const limb=(from,dir,len,r,depth)=>{
  const g=new T.CylinderGeometry(r*.7,r,len,5,1,true).translate(0,len/2,0);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,dir)).translate(from.x,from.y,from.z);parts.push(g);
  const end=from.clone().addScaledVector(dir,len);
  if(depth>=3){parts.push(new T.IcosahedronGeometry(r*1.5,0).translate(end.x,end.y,end.z));return;}
  for(let k=0;k<2+(rnd()<.4?1:0);k++){const d=dir.clone().applyAxisAngle(new T.Vector3(rnd()-.5,0,rnd()-.5).normalize(),.35+rnd()*.45).normalize();limb(end,d,len*(.6+rnd()*.2),r*.72,depth+1);}
 };
 limb(new T.Vector3(),up.clone(),h*.38,.06*h+.02,0);
 return mergeGeometries(parts.map(g=>g.index?g.toNonIndexed():g));
}
function tubeShape(rnd){
 const parts=[];for(let k=0;k<7;k++){const h=.18+rnd()*.32,a=rnd()*6.3,d=rnd()*.16;parts.push(new T.CylinderGeometry(.05,.04,h,7,1,true).translate(Math.cos(a)*d,h/2,Math.sin(a)*d));}
 return mergeGeometries(parts.map(g=>g.toNonIndexed()));
}
function fanShape(r){
 const s=new T.Shape();s.moveTo(-r,0);s.absarc(0,0,r,Math.PI,0,true);s.lineTo(-r,0);
 const parts=[new T.ShapeGeometry(s,10).toNonIndexed()];
 for(let k=0;k<7;k++){const a=Math.PI*(k+.5)/7;parts.push(new T.BoxGeometry(.025,r*.97,.03).translate(0,r*.97/2,0).rotateZ(a-Math.PI/2).toNonIndexed());}
 parts[0].deleteAttribute('uv');parts[0].deleteAttribute('normal');for(const g of parts.slice(1)){g.deleteAttribute('uv');g.deleteAttribute('normal');}
 return mergeGeometries(parts);
}
function anemoneShape(){
 const parts=[new T.CylinderGeometry(.13,.16,.16,9).translate(0,.08,0).toNonIndexed()];
 for(let k=0;k<16;k++){const a=k/16*Math.PI*2,r=k%2?.07:.11;parts.push(new T.ConeGeometry(.022,.34,4).translate(0,.17,0).rotateZ(.5+(k%2)*.3).rotateY(-a).translate(Math.cos(a)*r,.15,Math.sin(a)*r).toNonIndexed());}
 return mergeGeometries(parts);
}
function starShape(r){
 const s=new T.Shape();for(let k=0;k<10;k++){const a=k/10*Math.PI*2+Math.PI/2,d=k%2?r*.42:r;k?s.lineTo(Math.cos(a)*d,Math.sin(a)*d):s.moveTo(Math.cos(a)*d,Math.sin(a)*d);}
 return new T.ExtrudeGeometry(s,{depth:.035,bevelEnabled:false}).rotateX(-Math.PI/2);
}
// A ribbon of kelp, h tall, twisting as it rises.
function kelpShape(h,w,rnd){
 const N=Math.max(6,Math.round(h*2.2)),pos=[],idx=[],ph=rnd()*6;
 for(let i=0;i<=N;i++){const t=i/N,y=t*h,x=Math.sin(t*5+ph)*.18*t,tw=t*2.6+ph,hw=w*(1-.55*t)/2;
  pos.push(x-Math.cos(tw)*hw,y,-Math.sin(tw)*hw,x+Math.cos(tw)*hw,y,Math.sin(tw)*hw);
  if(i<N)idx.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);return g;
}
function grassShape(rnd){
 const pos=[];for(let k=0;k<7;k++){const a=rnd()*6.3,h=.25+rnd()*.35,l=(rnd()-.5)*.3,x=Math.cos(a)*.06,z=Math.sin(a)*.06,c=Math.cos(a+1.6)*.025,s=Math.sin(a+1.6)*.025;
  pos.push(x-c,0,z-s,x+c,0,z+s,x+Math.cos(a)*l,h,z+Math.sin(a)*l);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));return g;
}
// The octopus: a mantle, two eyes, and eight tapering arms curling out over its rock, ringed with neon suckers.
function octopusParts(put,m,phase){
 const body=C(0xb02cff),top=C(0xff4fd8),arm=C(0x8a2be2),tip=C(0xff7ad9),spot=C(0x3df0ff);
 put('life',new T.SphereGeometry(.42,14,10).scale(1,1.3,.95).rotateX(-.35).translate(0,.78,-.08),m,(p,n,l)=>fog(body.clone().lerp(top,clamp((l.y-.4)/.9,0,1)),p.z),(p,l)=>.025*clamp(l.y-.4,0,1),phase);
 for(const sx of [-1,1]){
  put('life',new T.SphereGeometry(.1,10,8).translate(sx*.2,.66,.3),m,()=>C(0xfff3a0));
  put('life',new T.SphereGeometry(.05,8,6).translate(sx*.2,.66,.385),m,()=>C(0x120022));
 }
 for(let k=0;k<8;k++){
  const a=(k+.5)/8*Math.PI*2,dir=k%2?1:-1,pts=[];
  for(let j=0;j<=5;j++){const t=j/5,r=.25+t*1.1,b=a+dir*t*t*.9;pts.push(new T.Vector3(Math.sin(b)*r,.34-.3*Math.sin(t*Math.PI*.8)+t*t*(.25+.15*Math.sin(k*1.7)),Math.cos(b)*r));}
  const curve=new T.CatmullRomCurve3(pts),seg=24,rad=6,g=new T.TubeGeometry(curve,seg,.085,rad,false),p=g.attributes.position,v=new T.Vector3();
  for(let j=0;j<=seg;j++){const c=curve.getPointAt(j/seg),k2=1-.82*j/seg;for(let i=0;i<=rad;i++){const ix=j*(rad+1)+i;v.fromBufferAttribute(p,ix).sub(c).multiplyScalar(k2).add(c);p.setXYZ(ix,v.x,v.y,v.z);}}
  const sway=(w,l)=>.13*clamp(Math.hypot(l.x,l.z)-.3,0,1.2);
  put('life',g,m,(w,n,l)=>fog(arm.clone().lerp(tip,clamp(Math.hypot(l.x,l.z)/1.3,0,1)),w.z),sway,phase+k*.8);
  for(let j=3;j<seg;j+=3){const c=curve.getPointAt(j/seg);put('life',new T.IcosahedronGeometry(.035*(1-.6*j/seg),0).translate(c.x,c.y-.05*(1-j/seg),c.z),m,()=>spot,sway,phase+k*.8);}
 }
}

// Fish, nose along +x: a body, a tail and a top fin, with the body's colours in bands along it or across it.
const SPECIES=[
 {n:30,len:.17,h:.42,w:.32,top:0x2fd6ff,low:0xff2f6e,fin:0x9ff6ff,school:10},
 {n:10,len:.34,h:.42,w:.3,top:0xff4fd8,low:0xff9be8,fin:0xffe44d},
 {n:6,len:.32,h:1.1,w:.18,top:0xc7a3ff,low:0xffffff,fin:0xa66bff,bands:0x5b2ad6},
 {n:8,len:.24,h:.5,w:.36,top:0xff8a1f,low:0xffb04d,fin:0xff8a1f,bands:0xffffff},
 {n:10,len:.28,h:.38,w:.3,top:0x8dff5a,low:0xe4ff8a,fin:0x4dffc3},
 {n:4,len:.44,h:.85,w:.2,top:0xffe44d,low:0xfff3a0,fin:0x3df0ff},
];
function fishShape(sp){
 const L=sp.len,H=L*sp.h,W=L*sp.w,parts=[new T.SphereGeometry(1,9,6).scale(L/2,H/2,W/2).toNonIndexed()];
 const tri=(a,b,c)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...a,...b,...c],3));return g;};
 parts.push(tri([-L*.4,0,0],[-L*.82,H*.5,0],[-L*.82,-H*.5,0]),tri([L*.05,H*.45,0],[-L*.3,H*.45,0],[-L*.32,H*.85,0]));
 if(sp.h>.8)parts.push(tri([L*.05,-H*.45,0],[-L*.3,-H*.45,0],[-L*.32,-H*.9,0]));
 for(const g of parts){g.deleteAttribute('uv');g.deleteAttribute('normal');}
 return mergeGeometries(parts);
}

export function createLoungeAquarium(ship,frame,colliders){
 // The solid parts, in the world.
 const solid=new T.Group();solid.name='Lounge_aquarium_solid';
 for(const b of SOLIDS)solid.add(new T.Mesh(boxGeometry(b).applyMatrix4(frame)));
 colliders.addStatic(solid,()=>true);
 if(typeof document==='undefined')return null;
 // What the tank now holds (the deck plates and floors through it, railings planned round them) goes from drawing; the
 // commons' columns stay, as the glass's posts.
 {const box=new T.Box3().setFromPoints([new T.Vector3(A.x0+.05,A.floor+.05,A.back+.03),new T.Vector3(A.x1-.05,A.top-.05,A.glass-.02)].map(p=>p.applyMatrix4(frame)));
  cutOut(ship.inside,box,o=>o.name!=='Commons_column');}
 // Open the promenade partitions for drawing after their collision has been built.
 cutOut(ship.inside,new T.Box3(new T.Vector3(A.x0,A.floor,3.7),new T.Vector3(A.x1,A.top,4.2)),o=>o.name==='Partition_wall',frame.clone().invert());

 const L=lists(),put=L.put,rnd=seeded(125),r=(a,b)=>a+(b-a)*rnd(),pick=a=>a[Math.floor(rnd()*a.length)];
 const flat=c=>()=>c;
 // The water has a dark lid and a sand bed either side of the throat.
 put('life',new T.PlaneGeometry(A.x1-A.x0,A.glass-A.back).rotateX(Math.PI/2).translate((A.x0+A.x1)/2,A.top-.02,(A.back+A.glass)/2),new T.Matrix4(),flat(C(0x0c3b63)));
 for(const [x0,x1] of [[A.x0,TUN.x0],[TUN.x1,A.x1]]){
  const g=new T.PlaneGeometry(x1-x0,A.glass-A.back,Math.round((x1-x0)*2),6).rotateX(-Math.PI/2),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,.08*Math.sin(x*1.3)*Math.sin(z*2.1)+.05*Math.sin(x*3.7+z));}
  g.translate((x0+x1)/2,A.bed,(A.back+A.glass)/2);
  put('life',g,new T.Matrix4(),(p)=>fog(C(0x26325e).lerp(C(0x4f5f9a),clamp((p.y-A.bed+.08)*5,0,1)),p.z));
  // Its cut face either side of the throat.
  for(const x of [x0,x1])if(x===TUN.x0||x===TUN.x1)put('life',new T.PlaneGeometry(A.glass-A.back,A.bed-A.floor+.1).rotateY(Math.PI/2).translate(x,(A.floor+A.bed)/2,(A.back+A.glass)/2),new T.Matrix4(),flat(C(0x141c38)));
 }
 // The places things stand on the bed: anywhere along it but in the throat.
 const bedX=(pad=.4)=>{for(;;){const x=r(A.x0+.5,A.x1-.5);if(!inTunnel(x,pad))return x;}};
 const rockColour=(p,n)=>fog(C(0x16223f).lerp(C(0x45588c),clamp(n.y*.6+.3,0,1)).lerp(C(0x3a2766),clamp(-n.z,0,1)*.4),p.z);
 // A rock turns any way about its upright, so it keeps its widest reach clear of the glass and the back.
 const rock=(x,y,z,s,seed=rnd()*20)=>{const half=(A.glass-A.back)/2-.08,k=Math.min(1,half/(Math.max(s[0],s[2])*1.35));s=s.map(v=>v*k);const e=Math.max(s[0],s[2])*1.35;
  put('life',rockShape(s,seed),at(x,y,clamp(z,A.back+.08+e,A.glass-.08-e),rnd()*6),rockColour);};
 for(let i=0;i<60;i++){const s=r(.18,.55);rock(bedX(.5),A.bed-.08,r(A.back+.4,A.glass-.4),[s*r(1,1.6),s*r(.6,1),s]);}
 // Rock pinnacles rising to the galleries' heights, so each storey has a reef at eye level; the octopus sits on one.
 const PINNACLES=[[117.4,29.1,5.1],[126.5,33.0,5.0],[131.2,27.4,5.4],[144.6,29.2,5.7],[150.6,33.2,4.9]],tops=[];
 for(const [x,h,z] of PINNACLES){let y=A.bed-.1,s=1.05;while(y<h-.2){rock(x+r(-.25,.25),y,z+r(-.15,.15),[s*r(1,1.2),s*.8,s*.8]);y+=s*1.05;s=Math.max(.42,s*.9);}tops.push([x,y,z]);}
 // Over the throat: a rock lintel along each edge, clear in the middle to look up through.
 for(const z of [A.back+.35,A.glass-.35])for(let x=TUN.x0+r(.2,.5);x<TUN.x1-.1;x+=r(.55,1.1))rock(x,TUN.top-.05,z,[r(.2,.42),r(.14,.32),r(.18,.32)]);

 // Coral: branching, brain, tube, fan and anemones, each glowing in its own neon, brighter toward the tips.
 const glowAt=[];
 const coral=(x,y,z,s=1)=>{
  const c=pick(NEON),tip=c.clone().lerp(C(0xffffff),.45),kind=Math.floor(rnd()*5),ph=rnd()*6,m=at(x,y,z,rnd()*6,s*r(.8,1.2));
  const grad=h=>(p,n,l)=>fog(c.clone().multiplyScalar(.55).lerp(tip,clamp(l.y/h,0,1)),p.z);
  if(kind===0){const h=r(.6,1.1);put('life',branchShape(rnd,h),m,grad(h),(p,l)=>.03*l.y,ph);}
  else if(kind===1){const c2=pick(NEON);put('life',new T.SphereGeometry(r(.25,.4),14,8).scale(1,.62,1),m,(p,n,l)=>fog(Math.sin(l.x*26+Math.sin(l.z*21)*2.4)>0?c:c2.clone().multiplyScalar(.6),p.z));}
  else if(kind===2)put('life',tubeShape(rnd),m,(p,n,l)=>fog(l.y>.15?tip:c.clone().multiplyScalar(.5),p.z),(p,l)=>.02*l.y,ph);
  else if(kind===3){const h=r(.5,.8);put('life',fanShape(h),at(x,y,z,r(-.4,.4),s),(p,n,l)=>fog(c.clone().multiplyScalar(.45).lerp(tip,clamp(l.y/h,0,1)*.8),p.z),(p,l)=>.05*l.y,ph);}
  else put('life',anemoneShape(),m,(p,n,l)=>fog(l.y>.2?tip:c.clone().multiplyScalar(.6),p.z),(p,l)=>.12*clamp(l.y-.16,0,1),ph);
  glowAt.push([x,y+.35*s,z,c,s]);
 };
 for(let i=0;i<46;i++)coral(bedX(.6),A.bed,r(A.back+.6,A.glass-.35),r(.8,1.25));
 for(const [x,y,z] of tops)for(let k=0;k<4;k++)if(!(x===144.6&&k<2))coral(x+r(-.55,.55),y-.12,z+r(-.3,.5),r(.6,.9));
 for(let x=TUN.x0+.6;x<TUN.x1-.3;x+=1.3)coral(x,TUN.top+.1,A.glass-.45,r(.5,.7));
 // A reef close against the throat's glass either side, to walk in past.
 for(const side of [-1,1])for(let k=0;k<6;k++)coral(side<0?TUN.x0-r(.45,1.9):TUN.x1+r(.45,1.9),A.bed,r(A.back+.5,A.glass-.4),r(.8,1.2));
 // Sea grass tufts, starfish and kelp.
 const greens=[C(0x1f8f4a),C(0x167a6a),C(0x2a9a3a)],tips=[C(0x8dff5a),C(0x4dffc3),C(0xc6ff4d)];
 for(let i=0;i<40;i++){const k=Math.floor(rnd()*3),ph=rnd()*6;put('life',grassShape(rnd),at(bedX(.5),A.bed-.02,r(A.back+.3,A.glass-.25)),(p,n,l)=>fog(greens[k].clone().lerp(tips[k],clamp(l.y/.5,0,1)),p.z),(p,l)=>.12*l.y,ph);}
 for(let i=0;i<7;i++){const c=pick([NEON[0],NEON[1],NEON[5],NEON[6]]);put('life',starShape(r(.12,.2)),at(bedX(.5),A.bed+.03,r(A.glass-1.4,A.glass-.25),rnd()*6),(p)=>fog(c,p.z));}
 for(let i=0;i<30;i++){
  const k=Math.floor(rnd()*3),ph=rnd()*6,h=r(2.5,8.5),x=bedX(.7),z=r(A.back+.3,A.back+1.6);
  put('life',kelpShape(h,r(.16,.3),rnd),at(x,A.bed-.05,z,rnd()*6),(p,n,l)=>fog(greens[k].clone().multiplyScalar(.7).lerp(tips[k],clamp(l.y/h,0,1)),p.z),(p,l)=>.38*Math.pow(clamp(l.y/h,0,1),1.3),ph);
 }
 // The octopus, on the pinnacle beside the Deck 18 gallery, looking into the lounge.
 {const [x,y]=tops[3],z=(A.back+A.glass)/2;octopusParts(put,at(x,y-.15,z,0,1.1),1.7);glowAt.push([x,y+.6,z,C(0xff4fd8),1.6]);}

 // Fish: loops along the tank, out along the glass and back along the rocks, at every height. Below the throat's
 // roof a loop stays to one side of it.
 const fishPaths=[];
 for(const sp of SPECIES){
  const shape=fishShape(sp),schools=Math.ceil(sp.n/(sp.school||1));
  for(let s=0;s<schools;s++){
   const ax=r(1.5,6.5),az=r(.55,1.25),dir=rnd()<.5?-1:1,speed=dir*r(.32,.7)/((ax+az)/2),bob=r(.08,.3);
   let cx=r(A.x0+ax+.6,A.x1-ax-.6),cy=r(A.bed+.85,A.top-.75);
   if(cy-bob<TUN.top+.35&&cx-ax-.5<TUN.x1&&cx+ax+.5>TUN.x0)cy=r(TUN.top+.7,A.top-.6);
   const cz=(A.back+A.glass)/2+r(-.2,.2),ph=rnd()*6.28;
   for(let k=0;k<(sp.school||1);k++){
    const g=shape.clone(),n=g.attributes.position.count,top=C(sp.top),low=C(sp.low),fin=C(sp.fin),band=sp.bands?C(sp.bands):null,col=new Float32Array(n*3),p=g.attributes.position;
    for(let i=0;i<n;i++){const x=p.getX(i),y=p.getY(i);let c=x<-sp.len*.38||Math.abs(y)>sp.len*sp.h*.44?fin:low.clone().lerp(top,clamp(y/(sp.len*sp.h*.5)+.5,0,1));
     if(band&&Math.abs(x)<sp.len*.4&&Math.cos(x/sp.len*18)>.55)c=band;col.set([c.r,c.g,c.b],i*3);}
    const o=sp.school?[r(-.5,.5),r(-.35,.35),r(-.3,.3),r(-.35,.35)]:[0,0,0,0];
    g.setAttribute('color',new T.BufferAttribute(col,3));
    g.setAttribute('aPath',new T.Float32BufferAttribute(Array(n).fill([cx+o[0],cy+o[1],clamp(cz+o[2],A.back+az+.25,A.glass-az-.2),ph+o[3]]).flat(),4));
    g.setAttribute('aMove',new T.Float32BufferAttribute(Array(n).fill([ax,az,speed,bob]).flat(),4));
    L.fish.push(g);
   }
   fishPaths.push({cx,cy,cz,ax,az});
  }
 }
 // Bubbles: streams from vents in the bed, rising to the top and starting again.
 const bubble=new T.IcosahedronGeometry(1,0);bubble.deleteAttribute('uv');bubble.deleteAttribute('normal');
 for(const vx of [116.2,122.8,129.4,133.6,141.6,147.2,152.6]){const vz=r(A.back+.6,A.glass-.8);
  for(let k=0;k<26;k++){const g=bubble.clone(),n=g.attributes.position.count,s=r(.025,.06);g.scale(s,s,s);
   g.setAttribute('aBubble',new T.Float32BufferAttribute(Array(n).fill([vx+r(-.12,.12),vz+r(-.12,.12),rnd(),r(.5,.95)]).flat(),4));L.bubbles.push(g);}
  put('life',new T.CylinderGeometry(.12,.18,.12,8),at(vx,A.bed,vz),flat(C(0x1b2440)));
 }
 // Light from above: shafts falling down through the water.
 // Each fades out down its length and toward its edges.
 for(let i=0;i<9;i++){const x=bedX(1.2),w=r(.8,1.8),h=r(5,9),g=new T.PlaneGeometry(w,h,2,6).translate(0,-h/2,0);
  put('rays',g,at(x,A.top-.25,r(A.back+.8,A.glass-.8),r(-.3,.3),1,0,r(-.18,.18)),(p,n,l)=>{const d=1+l.y/h;return C(0x2a7fa0).multiplyScalar(.22*Math.pow(clamp(d,0,1),2)*clamp((1-d)*8,0,1)*(1-Math.abs(l.x)/(w/2)));});}
 // A soft glow round the brightest coral and the octopus.
 for(const [x,y,z,c,s] of glowAt)put('halos',new T.PlaneGeometry(1.5*s,1.5*s),at(x,y,z-.25),flat(c.clone().multiplyScalar(.55)));

 // The frame, room side: a dark steel plinth under the glass and a header over it, posts at the ends and cladding on
 // the commons' columns, with a cyan line along the plinth and the header.
 const steelBoxes=[[A.x0,TUN.x0,A.floor,A.bed,A.glass-.04,A.front+.06],[TUN.x1,A.x1,A.floor,A.bed,A.glass-.04,A.front+.06],[A.x0,A.x1,A.top-.2,A.top,A.front,A.front+.08],
  [A.x0-.12,A.x0+.12,A.floor,A.top,A.glass-.1,A.front+.08],[A.x1-.12,A.x1+.12,A.floor,A.top,A.glass-.1,A.front+.08],
  ...[121,132,143,154].map(x=>[x-.26,x+.26,A.bed,A.top,7.7,8.3]),
  [A.x0-.1,A.x0,A.floor,A.top,A.back,A.glass],[A.x1,A.x1+.1,A.floor,A.top,A.back,A.glass]];
 const steel=steelBoxes.map(b=>boxGeometry(b).toNonIndexed());
 const lineBoxes=[[A.x0,TUN.x0,A.bed-.05,A.bed-.01,A.front+.06,A.front+.08],[TUN.x1,A.x1,A.bed-.05,A.bed-.01,A.front+.06,A.front+.08],[A.x0,A.x1,A.top-.24,A.top-.2,A.front+.05,A.front+.08],
  // and two along its back on the promenade side, one low and one high.
  ...[[24.5,24.54],[27.7,27.74]].flatMap(([y0,y1])=>[[A.x0,TUN.x0-2.4,y0,y1,3.95,3.97],[TUN.x1+2.4,A.x1,y0,y1,3.95,3.97]])];

 // Materials and meshes. Everything sits in the template's frame, and the group carries it to the world.
 const uniforms={uTime:{value:0}},group=new T.Group();group.name='Walk_lounge_aquarium';group.matrixAutoUpdate=false;group.matrix.copy(frame);
 const head=`#include <common>
uniform float uTime;`;
 const life=new T.MeshBasicMaterial({name:'Aquarium_life',vertexColors:true,side:T.DoubleSide,toneMapped:false});
 life.onBeforeCompile=s=>{s.uniforms.uTime=uniforms.uTime;s.vertexShader=s.vertexShader.replace('#include <common>',head+'\nattribute float aSway;attribute float aPhase;')
  .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=aSway*sin(uTime*.9+aPhase+position.y*.35);transformed.z+=aSway*.4*cos(uTime*.7+aPhase*1.3);');};
 life.customProgramCacheKey=()=>'aquarium-life';
 const fish=new T.MeshBasicMaterial({name:'Aquarium_fish',vertexColors:true,side:T.DoubleSide,toneMapped:false});
 fish.onBeforeCompile=s=>{s.uniforms.uTime=uniforms.uTime;s.vertexShader=s.vertexShader.replace('#include <common>',head+'\nattribute vec4 aPath;attribute vec4 aMove;')
  .replace('#include <begin_vertex>',`float th=aPath.w+uTime*aMove.z;
vec3 c=vec3(aPath.x+aMove.x*sin(th),aPath.y+aMove.w*sin(th*2.+aPath.w*3.),aPath.z+aMove.y*cos(th));
vec2 d=normalize(vec2(aMove.x*cos(th),-aMove.y*sin(th))*sign(aMove.z)+1e-5);
vec3 p=position;p.z+=sin(uTime*7.+aPath.w*11.)*.9*max(0.,-p.x-.02)*max(0.,-p.x);
vec3 transformed=c+vec3(p.x*d.x-p.z*d.y,p.y,p.x*d.y+p.z*d.x);
#ifdef USE_COLOR
vColor.rgb=mix(vColor.rgb,vec3(${WATER.r.toFixed(4)},${WATER.g.toFixed(4)},${WATER.b.toFixed(4)}),clamp((${A.glass.toFixed(2)}-c.z)/3.7,0.,1.)*.45);
#endif`);};
 fish.customProgramCacheKey=()=>'aquarium-fish';
 const bubbles=new T.MeshBasicMaterial({name:'Aquarium_bubbles',color:0xbff4ff,transparent:true,opacity:.55,depthWrite:false,toneMapped:false});
 bubbles.onBeforeCompile=s=>{s.uniforms.uTime=uniforms.uTime;s.vertexShader=s.vertexShader.replace('#include <common>',head+'\nattribute vec4 aBubble;')
  .replace('#include <begin_vertex>',`float H=${(A.top-.15-A.bed).toFixed(2)},u=fract(aBubble.z+uTime*aBubble.w/H);
float k=smoothstep(0.,.03,u)*(1.-smoothstep(.95,1.,u))*(.7+u*.8);
vec3 transformed=vec3(aBubble.x+sin(uTime*2.3+aBubble.z*40.)*.06,${A.bed.toFixed(2)}+u*H,aBubble.y+cos(uTime*1.9+aBubble.z*31.)*.05)+position*k;`);};
 bubbles.customProgramCacheKey=()=>'aquarium-bubbles';
 const halo=canvasTexture(128,128,(g,w,h)=>{const f=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);f.addColorStop(0,'rgba(255,255,255,1)');f.addColorStop(.35,'rgba(255,255,255,.35)');f.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=f;g.fillRect(0,0,w,h);});
 halo.wrapS=halo.wrapT=T.ClampToEdgeWrapping;
 const add={transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false,vertexColors:true};
 const mats={
  halos:new T.MeshBasicMaterial({name:'Aquarium_glow',map:halo,...add}),
  rays:new T.MeshBasicMaterial({name:'Aquarium_light_shafts',...add}),
  glass:new T.MeshStandardMaterial({name:'Aquarium_glass',color:0x8fd8ff,roughness:.04,metalness:0,envMapIntensity:.7,transparent:true,opacity:.14,depthWrite:false,side:T.DoubleSide}),
  steel:new T.MeshStandardMaterial({name:'Aquarium_steel',color:0x1b2232,roughness:.38,metalness:.55}),
  line:new T.MeshBasicMaterial({name:'Aquarium_trim_glow',color:0x3df0ff,toneMapped:false}),
 };
 // Halos and shafts keep their UVs for the texture; the rest dropped them.
 const mesh=(name,list,mat,order=0)=>{if(!list.length)return;const g=mergeGeometries(list);const o=new T.Mesh(g,mat);o.name=name;o.frustumCulled=false;o.renderOrder=order;group.add(o);return o;};
 mesh('Walk_aquarium_life',L.life,life);mesh('Walk_aquarium_fish',L.fish,fish);
 mesh('Walk_aquarium_bubbles',L.bubbles,bubbles,1);
 // Halos: their UVs were dropped by put(), so give the merged quads theirs back (each quad six vertices, in PlaneGeometry's order).
 {const o=mesh('Walk_aquarium_glow',L.halos,mats.halos,1);if(o){const n=o.geometry.attributes.position.count,uv=new Float32Array(n*2),q=[0,1,0,0,1,1,0,0,1,0,1,1];for(let i=0;i<n;i++){uv[i*2]=q[(i%6)*2];uv[i*2+1]=q[(i%6)*2+1];}o.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));}}
 mesh('Walk_aquarium_shafts',L.rays,mats.rays,1);
 const panes=[A.front,A.back].flatMap(z=>[[A.x0,TUN.x0,A.bed],[TUN.x1,A.x1,A.bed],[TUN.x0,TUN.x1,TUN.top]].map(([x0,x1,y0])=>new T.PlaneGeometry(x1-x0,A.top-.2-y0).translate((x0+x1)/2,(y0+A.top-.2)/2,z)));
 for(const g of panes){g.deleteAttribute('uv');}
 mesh('Walk_aquarium_glass',panes,mats.glass,2);
 // Seen from inside the throat, the water tints whatever is beyond it: a pane of it against each side and over the roof.
 const water=[TUN.x0-.02,TUN.x1+.02].map(x=>new T.PlaneGeometry(A.glass-A.back,TUN.top-A.floor).rotateY(Math.PI/2).translate(x,(A.floor+TUN.top)/2,(A.back+A.glass)/2));
 water.push(new T.PlaneGeometry(TUN.x1-TUN.x0,A.glass-A.back).rotateX(-Math.PI/2).translate((TUN.x0+TUN.x1)/2,TUN.top+.02,(A.back+A.glass)/2));
 for(const g of water){g.deleteAttribute('uv');g.deleteAttribute('normal');}
 mesh('Walk_aquarium_water',water,new T.MeshBasicMaterial({name:'Aquarium_water',color:0x0a4f86,transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide,toneMapped:false}),2);
 for(const g of steel)g.deleteAttribute('uv');
 mesh('Walk_aquarium_frame',steel,mats.steel);
 const lines=lineBoxes.map(b=>{const g=boxGeometry(b).toNonIndexed();g.deleteAttribute('uv');g.deleteAttribute('normal');return g;});
 mesh('Walk_aquarium_trim_glow',lines,mats.line);
 group.updateMatrixWorld(true);
 const time=()=>performance.now()/1000;
 return {group,low:A.floor,top:A.top,fish:fishPaths.length,update(){uniforms.uTime.value=time();}};
}
