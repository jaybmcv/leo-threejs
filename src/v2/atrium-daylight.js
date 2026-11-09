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

// The panel's texture runs along the ship (u) and across the atrium (v, edge to edge). Pale blue-white: deepest blue
// down the middle, fading to a hazy white at both long edges, with drifting wisps of cloud.
export function paintDaylightSky(c){
 const W=2048,H=256;c.width=W;c.height=H;const g=c.getContext('2d'),rnd=seeded(4182);
 const across=g.createLinearGradient(0,0,0,H);
 for(const[at,col]of[[0,'#d3e6f3'],[.22,'#93c2ec'],[.5,'#5d9fdc'],[.78,'#93c2ec'],[1,'#d3e6f3']])across.addColorStop(at,col);
 g.fillStyle=across;g.fillRect(0,0,W,H);
 // A soft sunlit brightening toward the bow, so the panel is not one flat strip.
 const glow=g.createRadialGradient(W*.68,H*.42,0,W*.68,H*.42,W*.42);glow.addColorStop(0,'rgba(255,251,238,.22)');glow.addColorStop(1,'rgba(255,251,238,0)');
 g.fillStyle=glow;g.fillRect(0,0,W,H);
 // Wisps: chains of soft puffs along gently curving, slightly diagonal paths.
 for(let i=0;i<34;i++){
  const x0=rnd()*W,y0=H*(.12+rnd()*.76),len=120+rnd()*360,angle=(rnd()-.5)*.35,bend=(rnd()-.5)*.5,n=8+(len/26|0),thick=5+rnd()*11,alpha=.08+rnd()*.12;
  for(let k=0;k<n;k++){const t=k/(n-1),a=angle+bend*(t-.5),x=x0+Math.cos(angle)*len*t,y=y0+Math.sin(angle)*len*t+Math.sin(t*Math.PI)*bend*28,taper=Math.sin(Math.PI*Math.min(1,.12+t*.88))**.7;
   puff(g,x,y,(18+rnd()*22)*(.5+taper),thick*(.55+taper*.6),a,alpha*(.55+taper*.6));}
 }
 // Cumulus: clusters of bright rounded puffs, denser and whiter on top, softer at a flattened base.
 for(let i=0;i<26;i++){const cx=rnd()*W,cy=H*(.18+rnd()*.64),size=26+rnd()*34,n=6+(rnd()*8|0);
  for(let k=0;k<n;k++){const a=rnd()*Math.PI*2,d=size*Math.sqrt(rnd())*1.4,px=cx+Math.cos(a)*d*1.8,py=cy+Math.sin(a)*d*.55,rad=size*(.45+rnd()*.5);puff(g,px,py,rad*1.25,rad*.8,0,.42+rnd()*.3);}
  puff(g,cx,cy-size*.15,size*1.6,size*.7,0,.35);}
 // A few fine cirrus streaks on top.
 g.lineCap='round';
 for(let i=0;i<8;i++){const x=rnd()*W,y=H*(.1+rnd()*.8),len=40+rnd()*150,a=(rnd()-.5)*.3,lift=(rnd()-.5)*14;
  g.strokeStyle=`rgba(255,255,255,${.06+rnd()*.1})`;g.lineWidth=1+rnd()*2.4;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+Math.cos(a)*len*.5,y+Math.sin(a)*len*.5+lift,x+Math.cos(a)*len,y+Math.sin(a)*len);g.stroke();}
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

// The boulevard's travertine (concept B, "inlaid promenade"): large-format pavers, 1.3 x 0.65 m, in a running bond laid
// along the ship. A texture on the existing paving faces (atrium-surfaces.js) that multiplies their vertex colour, so the
// floor, its height and its colliders (and the atrium PVS key) stay as they were. Rows fall at z = 0.325 + 0.65k, so the
// brass-edged centre stripe (|z| < 0.975) and the edge bands (|z| > 4.875, atrium-gardens.js) meet whole rows. One tile
// of the texture covers 10.4 x 5.2 m (8 pavers by 8 rows).
export const PAVER={length:1.3,row:.65,tile:[10.4,5.2],rowOffset:.325};
export const pavingUV=(x,z)=>[x/PAVER.tile[0],(z-PAVER.rowOffset)/PAVER.tile[1]];
// Faces that are not paving sample the middle of the tile's first paver, kept pure white, so lawns, water, the food
// hall and the stage keep exactly their own colours.
export const PAVING_PLAIN_UV=[.0625,.9375];
export function paintTravertine(c){
 const W=1024,H=512,N=8,pw=W/N,ph=H/N,g=c.getContext('2d'),rnd=seeded(6406);c.width=W;c.height=H;
 g.fillStyle='#fff';g.fillRect(0,0,W,H);
 for(let row=0;row<N;row++)for(let k=0;k<N;k++){
  const x0=k*pw+(row%2?pw/2:0),y0=row*ph,plain=!row&&!k,tone=plain?1:.9+rnd()*.1,warm=plain?0:(rnd()-.5)*.03;
  const rgb=[tone*(1+warm),tone,tone*(1-warm*1.5)].map(v=>Math.round(255*Math.min(1,v)));
  // Each paver is drawn twice, a tile apart, so the odd rows' last paver wraps round to the first column.
  for(const dx of[0,-W]){
   g.save();g.beginPath();g.rect(x0+dx,y0,pw,ph);g.clip();g.fillStyle=`rgb(${rgb})`;g.fillRect(x0+dx,y0,pw,ph);
   if(!plain){
    // Travertine, not timber: soft cloudy mottling, one faint band along the bedding, and small pits.
    const vr=seeded(row*31+k*7+1);
    for(let i=0;i<7;i++){const dark=vr()<.6;puff(g,x0+dx+vr()*pw,y0+vr()*ph,12+vr()*30,6+vr()*12,(vr()-.5)*.4,dark?.08+vr()*.1:.12+vr()*.14,dark?'150,118,84':'255,252,244');}
    g.fillStyle=`rgba(140,108,76,${.04+vr()*.05})`;g.fillRect(x0+dx,y0+8+vr()*(ph-16),pw,2+vr()*5);
    for(let i=0;i<10;i++){g.fillStyle=`rgba(110,82,56,${.12+vr()*.14})`;g.beginPath();g.ellipse(x0+dx+vr()*pw,y0+vr()*ph,1+vr()*2.2,.6+vr(),0,0,Math.PI*2);g.fill();}
   }
   g.restore();
  }
  // Joints: each paver's left (aft) edge, 2 px (2 cm); the rows' edges follow.
  g.fillStyle='rgb(196,184,168)';for(const dx of[0,-W])g.fillRect(x0+dx,y0,2,ph);
 }
 g.fillStyle='rgb(196,184,168)';for(let row=0;row<N;row++)g.fillRect(0,row*ph,W,2);
 return c;
}
