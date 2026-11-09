// 4B "Hanging gardens": the daylight the atrium's opaque sky panel paints, and the dappled shade under its trees.
// Plain 2D-canvas drawing only (gradients and fills, no filters), so the browser and the authoring
// canvas paint alike, and both survive the Basic-material swap of the distant and phone atrium copies.
const seeded=seed=>()=>{seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

// One soft puff: a radial gradient squeezed into an ellipse.
function puff(g,x,y,rx,ry,angle,alpha,colour='255,255,255'){
 g.save();g.translate(x,y);g.rotate(angle);g.scale(1,ry/rx);
 const r=g.createRadialGradient(0,0,0,0,0,rx);r.addColorStop(0,`rgba(${colour},${alpha})`);r.addColorStop(.55,`rgba(${colour},${alpha*.45})`);r.addColorStop(1,`rgba(${colour},0)`);
 g.fillStyle=r;g.beginPath();g.arc(0,0,rx,0,Math.PI*2);g.fill();g.restore();
}

// A stylised low-poly cloud, like the walk's faceted trees: a row of lumps, each a fan of flat facets lit from above
// (white on top, pale blue-grey underneath), cut flat along a common base. Opaque facets, each stroked in its own
// colour so no seam of sky shows between them. Drawn in the cloud's own frame (x along the row, y down to the base)
// turned onto the panel so the row lies across the atrium and the base faces the bow, as concept A has them from the
// floor.
function lowPolyCloud(g,rnd,cx,cy,size){
 g.save();g.transform(0,1,1,0,cx,cy);
 const lumps=3+(rnd()*3|0),base=size*.35;g.lineJoin='round';g.lineWidth=1;
 for(let l=0;l<lumps;l++){
  const t=l/(lumps-1)-.5,r=size*(.6+rnd()*.35)*(1-Math.abs(t)*.6),lx=t*size*2.1+(rnd()-.5)*size*.3,ly=base-r*.62,n=7+(rnd()*3|0),pts=[];
  for(let k=0;k<n;k++){const a=(k+rnd()*.4)/n*Math.PI*2,s=.8+rnd()*.32;pts.push([lx+Math.cos(a)*r*s,Math.min(base,ly+Math.sin(a)*r*.85*s)]);}
  const hub=[lx+(rnd()-.5)*r*.3,ly-r*.15];
  for(let k=0;k<n;k++){const a=pts[k],b=pts[(k+1)%n],lit=Math.max(0,Math.min(1,.62-((a[1]+b[1])/2-hub[1])/r+(rnd()-.5)*.2));
   const col=`rgb(${Math.round(196+59*lit)},${Math.round(214+41*lit)},${Math.round(236+19*lit)})`;
   g.fillStyle=g.strokeStyle=col;g.beginPath();g.moveTo(...hub);g.lineTo(...a);g.lineTo(...b);g.closePath();g.fill();g.stroke();}
 }
 g.restore();
}

// The panel's texture runs along the ship (u, aft to bow) and across the atrium (v, edge to edge). Sky concept A: a
// clear, deep blue, brightening toward the bow where the sun is, with a few faceted low-poly clouds. It stays blue right
// to the long edges (no white haze), so the panel meets the top decks crisply, with a thin warm rim of sunlight there.
export function paintDaylightSky(c){
 const W=2048,H=256;c.width=W;c.height=H;const g=c.getContext('2d'),rnd=seeded(4182);
 const along=g.createLinearGradient(0,0,W,0);
 for(const[at,col]of[[0,'#1a50b0'],[.45,'#2462c2'],[.8,'#4287d8'],[1,'#72aee8']])along.addColorStop(at,col);
 g.fillStyle=along;g.fillRect(0,0,W,H);
 const sun=g.createRadialGradient(W,H*.5,0,W,H*.5,W*.32);sun.addColorStop(0,'rgba(255,250,236,.4)');sun.addColorStop(1,'rgba(255,250,236,0)');
 g.fillStyle=sun;g.fillRect(0,0,W,H);
 for(let x=40+rnd()*60;x<W-30;x+=90+rnd()*120)lowPolyCloud(g,rnd,x,H*(.22+rnd()*.56),18+rnd()*24);
 for(const y of[0,H]){const rim=g.createLinearGradient(0,y,0,y?y-10:10);rim.addColorStop(0,'rgba(255,170,84,1)');rim.addColorStop(1,'rgba(255,170,84,0)');
  g.fillStyle=rim;g.fillRect(0,y?y-10:0,W,10);}
 return c;
}

// A tree's dappled shade (RGBA, for a transparent decal under its canopy): warm dark shadow, densest under the crown
// and fading to nothing at the rim, with irregular sun flecks cut out of it.
export function paintTreeShade(c,seed=1){
 const S=256;c.width=S;c.height=S;const g=c.getContext('2d'),rnd=seeded(seed);g.clearRect(0,0,S,S);
 const r=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);r.addColorStop(0,'rgba(58,44,26,1)');r.addColorStop(.6,'rgba(58,44,26,.85)');r.addColorStop(1,'rgba(58,44,26,0)');
 g.fillStyle=r;g.fillRect(0,0,S,S);g.globalCompositeOperation='destination-out';
 for(let i=0;i<34;i++){const cx=rnd()*S,cy=rnd()*S,n=2+(rnd()*5|0);for(let k=0;k<n;k++)puff(g,cx+(rnd()-.5)*24,cy+(rnd()-.5)*24,3+rnd()*8,3+rnd()*6,rnd()*3,.7+rnd()*.3);}
 g.globalCompositeOperation='source-over';return c;
}
