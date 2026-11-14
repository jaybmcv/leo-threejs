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

// Overlapping soft lobes, shaded blue-grey underneath and warm white above. Each cluster has its own outline.
// Turn the row across the atrium so the long panel still reads as a sky from the floor.
function softCloud(g,rnd,cx,cy,size){
 g.save();g.transform(0,1,1,0,cx,cy);
 const lumps=3+(rnd()*5|0),lobes=[],angle=(rnd()-.5)*.3;
 const lobe=(x,y,r,h,colour)=>{
  g.save();g.translate(x,y);g.scale(1,h/r);const fill=g.createRadialGradient(0,0,0,0,0,r);
  for(const[at,alpha]of[[0,.96],[.6,.9],[.82,.45],[1,0]])fill.addColorStop(at,`rgba(${colour},${alpha})`);
  g.fillStyle=fill;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.restore();
 };
 g.rotate(angle);
 for(let l=0;l<lumps;l++){
  const t=l/(lumps-1)-.5,r=size*(.65+rnd()*.5)*(1-Math.abs(t)*.45);
  lobes.push({x:t*size*2.4,y:(rnd()-.5)*size*.6,r,h:r*(.8+rnd()*.45)});
 }
 for(const {x,y,r,h}of lobes)lobe(x,y+h*.25,r*1.12,h,'187,207,225');
 for(const {x,y,r,h}of lobes)lobe(x,y-h*.22,r,h*.82,'255,253,247');
 g.restore();
}

// The panel runs aft to bow along u, edge to edge along v. Muted blue overhead fades into haze at its edges and bow.
// Painted once at the existing resolution; the day/night blend and the distant and phone copies share this picture.
export function paintDaylightSky(c){
 const W=2048,H=256;c.width=W;c.height=H;const g=c.getContext('2d'),rnd=seeded(4182);
 const along=g.createLinearGradient(0,0,W,0);
 for(const[at,col]of[[0,'#769ac0'],[.38,'#6f96bf'],[.75,'#8db0cd'],[1,'#b8d0df']])along.addColorStop(at,col);
 g.fillStyle=along;g.fillRect(0,0,W,H);
 const haze=g.createLinearGradient(0,0,0,H);
 for(const[at,alpha]of[[0,.65],[.2,.22],[.5,0],[.8,.22],[1,.65]])haze.addColorStop(at,`rgba(216,230,236,${alpha})`);
 g.fillStyle=haze;g.fillRect(0,0,W,H);
 const sun=g.createRadialGradient(W,H*.5,0,W,H*.5,W*.32);sun.addColorStop(0,'rgba(255,250,236,.18)');sun.addColorStop(1,'rgba(255,250,236,0)');
 g.fillStyle=sun;g.fillRect(0,0,W,H);
 for(let x=55+rnd()*60;x<W-45;x+=65+rnd()*155)softCloud(g,rnd,x,H*(.18+rnd()*.64),10+rnd()*25);
 return c;
}

// A tree's dappled shade (RGBA, for a transparent decal under its canopy): warm dark shadow, densest under the crown
// and fading to nothing at the rim, with irregular sun flecks cut out of it. Two variants side by side: the left half
// under a tree's crown, the right half lighter and more broken, for the open boulevard between the trees.
export const SHADE_HALVES={tree:0,dapple:.5};
export function paintTreeShade(c,seed=1){
 const S=256;c.width=S*2;c.height=S;const g=c.getContext('2d'),rnd=seeded(seed);g.clearRect(0,0,S*2,S);
 for(const[ox,core,flecks]of[[0,1,34],[S,.9,110]]){
  g.save();g.beginPath();g.rect(ox,0,S,S);g.clip();
  const r=g.createRadialGradient(ox+S/2,S/2,0,ox+S/2,S/2,S/2);r.addColorStop(0,`rgba(58,44,26,${core})`);r.addColorStop(.6,`rgba(58,44,26,${core*.85})`);r.addColorStop(1,'rgba(58,44,26,0)');
  g.fillStyle=r;g.fillRect(ox,0,S,S);g.globalCompositeOperation='destination-out';
  for(let i=0;i<flecks;i++){const cx=ox+rnd()*S,cy=rnd()*S,n=2+(rnd()*5|0);for(let k=0;k<n;k++)puff(g,cx+(rnd()-.5)*24,cy+(rnd()-.5)*24,3+rnd()*8,3+rnd()*6,rnd()*3,.7+rnd()*.3);}
  g.restore();
 }
 return c;
}

// The boulevard's travertine (concept B, "inlaid promenade"): large-format pavers, 1.3 x 0.65 m, in a running bond laid
// along the ship. A texture on the existing paving faces (atrium-surfaces.js) that multiplies their vertex colour, so the
// floor, its height and its colliders (and the atrium PVS key) stay as they were. Rows fall at z = 0.325 + 0.65k, so the
// brass-edged centre stripe (|z| < 0.975) and the edge bands (|z| > 4.875, atrium-gardens.js) meet whole rows. One tile
// of the texture covers 10.4 x 5.2 m (8 pavers by 8 rows).
export const PAVER={length:1.3,row:.65,tile:[10.4,5.2],rowOffset:.325};
export const pavingUV=(x,z)=>[x/PAVER.tile[0],(z-PAVER.rowOffset)/PAVER.tile[1]];
// Faces that are not paving sample one spot in the tile's first paver, kept pure white, so lawns, water and the stage
// keep exactly their own colours.
export const PAVING_PLAIN_UV=[.0625,.9375];
export function paintTravertine(c){
 const W=1024,H=512,N=8,pw=W/N,ph=H/N,g=c.getContext('2d'),rnd=seeded(6406);c.width=W;c.height=H;
 g.fillStyle='#fff';g.fillRect(0,0,W,H);
 for(let row=0;row<N;row++)for(let k=0;k<N;k++){
  const x0=k*pw+(row%2?pw/2:0),y0=row*ph,tone=.94+rnd()*.06,warm=(rnd()-.5)*.02;
  const rgb=[tone*(1+warm),tone,tone*(1-warm*1.5)].map(v=>Math.round(255*Math.min(1,v)));
  // Each paver is drawn twice, a tile apart, so the odd rows' last paver wraps round to the first column.
  for(const dx of[0,-W]){
   g.save();g.beginPath();g.rect(x0+dx,y0,pw,ph);g.clip();g.fillStyle=`rgb(${rgb})`;g.fillRect(x0+dx,y0,pw,ph);
   {
    // Stone, not timber: round soft clouds, greyish dark and creamy light, and small pits. Nothing long and thin
    // along the paver, which reads as grain at a walker's low angle.
    const vr=seeded(row*31+k*7+1);
    for(let i=0;i<10;i++){const dark=vr()<.55,rx=10+vr()*24;puff(g,x0+dx+vr()*pw,y0+vr()*ph,rx,rx*(.65+vr()*.35),vr()*3,dark?.1+vr()*.1:.12+vr()*.14,dark?'168,148,130':'255,250,240');}
    for(let i=0;i<10;i++){g.fillStyle=`rgba(120,100,84,${.12+vr()*.14})`;g.beginPath();g.ellipse(x0+dx+vr()*pw,y0+vr()*ph,1+vr()*2.2,.8+vr(),0,0,Math.PI*2);g.fill();}
   }
   g.restore();
  }
  // Joints: each paver's left (aft) edge, 2 px (2 cm); the rows' edges follow.
  g.fillStyle='rgb(196,184,168)';for(const dx of[0,-W])g.fillRect(x0+dx,y0,2,ph);
 }
 g.fillStyle='rgb(196,184,168)';for(let row=0;row<N;row++)g.fillRect(0,row*ph,W,2);
 // The plain spot non-paving faces sample (PAVING_PLAIN_UV, always at full size): 8 cm of pure white.
 g.fillStyle='#fff';g.fillRect(W*PAVING_PLAIN_UV[0]-4,H*(1-PAVING_PLAIN_UV[1])-4,8,8);
 return c;
}
