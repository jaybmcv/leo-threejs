import * as T from 'three';

// Faceted, vertex-coloured greenery for the walk's arrival atrium (arrival-atrium.js). Leaves are creased blades, darker
// at the stem and lighter along the midrib and toward the tip, folded and drooping; stems are thin tubes. A handful of
// species read differently at a glance: broad-leaved aroids, palms, ferns, snake plants, flowering shrubs, grass tufts,
// trailing pothos, and leafy clumps for canopies. Every builder pushes non-indexed geometries (position, normal, uv,
// colour) in the caller's frame into `out`, to be merged under one vertex-coloured, double-sided material. `rnd` is
// the caller's seeded random sequence, so the planting is the same on every visit.
export const GREENS={deep:0x2b5629,dark:0x386c33,mid:0x4c873d,bright:0x67a64a,lime:0x8fc25a,pale:0xbfd57a,cream:0xe7e3b6};
export const BLOOMS=[0xf08fb2,0xf6f0e4,0xf3c74c,0xf28a34,0xc98be0];

// Half-width profiles along a blade, 0 at the stem to 1 at the tip.
export const SHAPES={
 heart:t=>Math.sin(Math.PI*Math.pow(t,.62))**.85,
 oval:t=>Math.sin(Math.PI*t)**.8,
 lance:t=>Math.sin(Math.PI*t)**1.4,
 strap:t=>t<.72?1:(1-t)/.28,
};
const tmp=new T.Color(),tmp2=new T.Color();
const mix=(a,b,t)=>{tmp.set(a).lerp(tmp2.set(b),t);return [tmp.r,tmp.g,tmp.b];};

function finish(p,c,idx){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));
 if(idx)g.setIndex(idx);const n=idx?g.toNonIndexed():g;n.computeVertexNormals();
 n.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(n.attributes.position.count*2),2));return n;
}
// A geometry made non-indexed and painted one colour (or by a function of each vertex).
export function paint(g,color){
 const n=g.index?g.toNonIndexed():g,pos=n.attributes.position,a=new Float32Array(pos.count*3),v=new T.Vector3();
 for(let i=0;i<pos.count;i++){const c=typeof color==='function'?color(v.fromBufferAttribute(pos,i),i):mix(color,color,0);a.set(c,i*3);}
 n.setAttribute('color',new T.BufferAttribute(a,3));if(!n.attributes.uv)n.setAttribute('uv',new T.BufferAttribute(new Float32Array(pos.count*2),2));
 for(const k of Object.keys(n.attributes))if(!['position','normal','uv','color'].includes(k))n.deleteAttribute(k);
 return n;
}
// A blade along +x from the origin, `len` long and `wid` across at its widest: three points a row (edge, midrib, edge),
// `segs` rows, the edges raised by `fold` about the midrib and the whole sagging by `droop` toward the tip.
export function blade(len,wid,{segs=4,shape=SHAPES.oval,fold=.35,droop=.35,base=GREENS.dark,mid=GREENS.bright,tip=GREENS.lime,edge=null}={}){
 const p=[],c=[],idx=[];edge??=base;
 for(let i=0;i<=segs;i++){const t=i/segs,w=wid/2*shape(t),x=len*t,y=-droop*len*t*t,ey=y+w*Math.sin(fold);
  p.push(x,ey,-w*Math.cos(fold),x,y,0,x,ey,w*Math.cos(fold));
  const e=mix(edge,tip,t*.8),m=mix(mid,tip,t*.6);c.push(...e,...m,...e);}
 for(let i=0;i<segs;i++){const a=i*3,b=a+3;idx.push(a,a+1,b,a+1,b+1,b,a+1,a+2,b+1,a+2,b+2,b+1);}
 return finish(p,c,idx);
}
// Turn a blade (built along +x) to point `yaw` round the vertical, raised `lift` above level, rolled `roll` about
// itself, and move it to `at`.
export const orient=(g,at,yaw,lift=0,roll=0)=>g.rotateX(roll).rotateZ(lift).rotateY(-yaw).translate(at[0],at[1],at[2]);
// A stem through points, `r` thick.
export function stem(points,r,color=GREENS.dark,radial=4){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
 return paint(new T.TubeGeometry(curve,Math.max(2,points.length),r,radial,false),color);
}

// Where the i-th of n parts points: all round, or spread over `arc` radians about `facing` (to spill one way only).
const around=(i,n,rnd,facing,arc)=>arc>=Math.PI*2?i/n*Math.PI*2+rnd()*.5:facing+((i+.5)/n-.5)*arc+(rnd()-.5)*.2;
// A broad-leaved aroid (philodendron, anthurium): heart-shaped leaves on long arching stems from one crown.
export function aroid(out,[x,y,z],{size=1,leaves=9,rnd,palette=[GREENS.deep,GREENS.dark,GREENS.mid],facing=0,arc=Math.PI*2}){
 for(let i=0;i<leaves;i++){
  const yaw=around(i,leaves,rnd,facing,arc),up=.55+rnd()*.6,reach=size*(.3+rnd()*.3),c=Math.cos(yaw),s=Math.sin(yaw);
  const tip=[x+c*reach*Math.cos(up),y+reach*Math.sin(up),z+s*reach*Math.cos(up)];
  out.push(stem([[x,y,z],[x+c*reach*.3,y+reach*.55,z+s*reach*.3],tip],.012*size,GREENS.dark,3));
  const len=size*(.32+rnd()*.18),base=palette[rnd()*palette.length|0];
  out.push(orient(blade(len,len*.62,{segs:5,shape:SHAPES.heart,fold:.32,droop:.32,base,mid:GREENS.bright,tip:GREENS.mid}),tip,yaw,up-1.05-rnd()*.3,(rnd()-.5)*.3));
 }
}
// A palm: a few slim canes, each crowned with arching fronds of drooping leaflets.
export function palm(out,[x,y,z],{height=1.6,canes=3,rnd}){
 for(let k=0;k<canes;k++){
  const a=rnd()*Math.PI*2,lean=.06+rnd()*.12,h=height*(.55+rnd()*.35),top=[x+Math.cos(a)*h*lean,y+h,z+Math.sin(a)*h*lean];
  out.push(stem([[x,y,z],[x+Math.cos(a)*h*lean*.4,y+h*.5,z+Math.sin(a)*h*lean*.4],top],.022,0x6f8a3c,4));
  for(let f=0;f<3;f++){
   const yaw=a+f/3*Math.PI*2+rnd()*.6,c=Math.cos(yaw),s=Math.sin(yaw),L=height*(.38+rnd()*.12),pts=[];
   for(let j=0;j<=4;j++){const t=j/4;pts.push([top[0]+c*L*t,top[1]+L*(.35*t-.55*t*t),top[2]+s*L*t]);}
   out.push(stem(pts,.008,GREENS.mid,3));
   for(let j=1;j<=7;j++){const t=j/8,q=[top[0]+c*L*t,top[1]+L*(.35*t-.55*t*t),top[2]+s*L*t],len=L*.42*(1-t*.55);
    for(const side of [-1,1])out.push(orient(blade(len,len*.16,{segs:2,shape:SHAPES.lance,fold:.15,droop:.5,base:GREENS.dark,mid:GREENS.bright,tip:GREENS.lime}),q,yaw+side*1.05,-.25-t*.4,0));}
  }
 }
}
// A fern: arching fronds from a crown, each a midrib of paired leaflets shrinking toward the tip.
export function fern(out,[x,y,z],{spread=.7,fronds=10,pairs=6,rnd,droop=1,facing=0,arc=Math.PI*2}){
 for(let f=0;f<fronds;f++){
  const yaw=around(f,fronds,rnd,facing,arc),c=Math.cos(yaw),s=Math.sin(yaw),L=spread*(.75+rnd()*.35),rise=.55+rnd()*.3,at=t=>[x+c*L*t,y+L*(rise*t-droop*.95*t*t),z+s*L*t];
  out.push(stem([0,.33,.66,1].map(at),.006,GREENS.dark,3));
  for(let j=1;j<=pairs;j++){const t=j/(pairs+1),len=L*.26*(1-t*.6);
   for(const side of [-1,1])out.push(orient(blade(len,len*.34,{segs:2,shape:SHAPES.lance,fold:.1,droop:.3,base:GREENS.mid,mid:GREENS.bright,tip:GREENS.lime}),at(t),yaw+side*1.2,.1-t*.9,0));}
 }
}
// A snake plant: upright, pointed straps, dark green with pale yellow-green edges.
export function snakePlant(out,[x,y,z],{height=.9,blades=7,rnd}){
 for(let i=0;i<blades;i++){const yaw=rnd()*Math.PI*2,h=height*(.6+rnd()*.4),off=.05+rnd()*.07;
  out.push(orient(blade(h,h*.21,{segs:4,shape:SHAPES.strap,fold:.25,droop:-.02,base:GREENS.deep,mid:0x2e4f2c,tip:GREENS.dark,edge:0xb9c46a}),
   [x+Math.cos(yaw)*off,y,z+Math.sin(yaw)*off],yaw,1.35+rnd()*.15,rnd()*1.2));}
}
// A small flower: five petals round a yellow heart, facing up and out.
export function flower(out,[x,y,z],{r=.05,color=BLOOMS[0],tilt=.35,yaw=0}){
 const pale=mix(color,0xffffff,.45);tmp.setRGB(pale[0],pale[1],pale[2]);const light=tmp.getHex();
 for(let i=0;i<5;i++)out.push(orient(blade(r,r*.75,{segs:2,shape:SHAPES.oval,fold:.15,droop:.25,base:color,mid:light,tip:light}).rotateZ(tilt).rotateY(-i/5*Math.PI*2),[x,y,z],yaw));
 out.push(paint(new T.IcosahedronGeometry(r*.28,0).translate(x,y+r*.08,z),0xf2c94c));
}
// A leafy clump: a lumpy, faceted ball, lighter on top, with blades poking out of it to break its outline.
export function clump(out,[x,y,z],{r=.4,rnd,palette=[GREENS.deep,GREENS.dark,GREENS.mid,GREENS.bright],squash=.8,leaves=5,detail=1}){
 const g=new T.IcosahedronGeometry(r,detail),pos=g.attributes.position,jit=new Map(),v=new T.Vector3();
 for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);const key=`${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
  if(!jit.has(key))jit.set(key,.82+rnd()*.36);v.multiplyScalar(jit.get(key));pos.setXYZ(i,v.x,v.y*squash,v.z);}
 g.computeVertexNormals();
 const faces=pos.count/3,colors=[];
 for(let f=0;f<faces;f++){const y0=(pos.getY(f*3)+pos.getY(f*3+1)+pos.getY(f*3+2))/3/r,base=palette[rnd()*palette.length|0],c=mix(base,GREENS.lime,Math.max(0,y0)*.45);colors.push(...c,...c,...c);}
 out.push(paint(g.translate(x,y,z),(p,i)=>colors.slice(i*3,i*3+3)));
 for(let k=0;k<leaves;k++){const yaw=rnd()*Math.PI*2,up=rnd()*.9-.2,d=r*.8,at=[x+Math.cos(yaw)*Math.cos(up)*d,y+Math.sin(up)*d*squash,z+Math.sin(yaw)*Math.cos(up)*d];
  out.push(orient(blade(r*.75,r*.4,{segs:3,shape:SHAPES.oval,fold:.3,droop:.3,base:GREENS.dark,mid:GREENS.bright,tip:GREENS.lime}),at,yaw,up,rnd()-.5));}
}
// A flowering shrub: a mound of leafy clumps dotted with flowers.
export function flowerBush(out,[x,y,z],{spread=.6,rnd,color=BLOOMS[0],blooms=9}){
 for(let k=0;k<4;k++){const a=k/4*Math.PI*2+rnd(),d=spread*.25;clump(out,[x+Math.cos(a)*d,y+spread*.3+rnd()*.1,z+Math.sin(a)*d],{r:spread*(.28+rnd()*.08),rnd,leaves:3});}
 clump(out,[x,y+spread*.52,z],{r:spread*.3,rnd,leaves:3});
 for(let k=0;k<blooms;k++){const a=rnd()*Math.PI*2,u=rnd(),d=spread*.42*Math.sqrt(u);
  flower(out,[x+Math.cos(a)*d,y+spread*(.5+.25*(1-u))+.05,z+Math.sin(a)*d],{r:.045+rnd()*.02,color,yaw:a,tilt:.2+u*.6});}
}
// A tuft of grass blades.
export function tuft(out,[x,y,z],{height=.25,blades=6,rnd}){
 for(let i=0;i<blades;i++)out.push(orient(blade(height*(.6+rnd()*.5),.03,{segs:2,shape:SHAPES.lance,fold:.2,droop:.6,base:GREENS.dark,mid:GREENS.bright,tip:GREENS.pale}),[x,y,z],rnd()*Math.PI*2,1.05+rnd()*.35,0));
}
// A trailing pothos: a stem swaying down `length` from `top`, heart leaves alternating along it, some marbled cream.
export function pothos(out,[x,y,z],{length=1.2,rnd,spacing=.12,size=1}){
 const n=Math.max(2,Math.ceil(length/.3)),phase=rnd()*6,sway=.05+rnd()*.05,pts=[];
 for(let i=0;i<=n;i++){const t=i/n;pts.push([x+Math.sin(phase+t*3)*sway*t,y-length*t,z+Math.cos(phase+t*2.3)*sway*t]);}
 out.push(stem(pts,.006,0x4e7a3a,3));
 const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),marbled=rnd()<.35;
 for(let i=1,count=Math.floor(length/spacing);i<=count;i++){const t=i/(count+.5),p=curve.getPoint(t),len=size*(.07+.07*(1-t)+rnd()*.03),yaw=phase+i*2.4;
  out.push(orient(blade(len,len*.78,{segs:2,shape:SHAPES.heart,fold:.28,droop:.25,base:GREENS.dark,mid:marbled&&i%2?GREENS.cream:GREENS.bright,tip:GREENS.mid}),[p.x,p.y,p.z],yaw,-.45-rnd()*.5,(rnd()-.5)*.6));}
}
