// 4B "Hanging gardens": the daylight the atrium's opaque sky panel paints, and the dappled light it throws on the
// Deck 6 floor. Plain 2D-canvas drawing only (gradients and fills, no filters), so the browser and the authoring
// canvas paint alike, and both maps survive the Basic-material swap of the distant and phone atrium copies.
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

// Dappled floor light (light through a canopy), as two tileable maps painted from the same seed: a shade map (a soft
// grey base, white sun flecks) multiplies the floor, and a glow map (black base, the same flecks) lights the flecks
// through the material's warm emissive. Both are linear data. Material colours stay <= 1 so they serialize intact.
export const DAPPLE={tile:13,turn:.37,shade:.84,glow:0xffd9a3,glowIntensity:.32};
export function paintDapple(c,base=DAPPLE.shade){
 const S=512;c.width=S;c.height=S;const g=c.getContext('2d'),rnd=seeded(77),v=Math.round(base*255);
 g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(0,0,S,S);
 const wrap=(x,y,draw)=>{for(const dx of[-S,0,S])for(const dy of[-S,0,S])if(x+dx>-80&&x+dx<S+80&&y+dy>-80&&y+dy<S+80)draw(x+dx,y+dy);};
 // Broad, faint light pools, then clusters of crisp flecks.
 for(let i=0;i<14;i++){const x=rnd()*S,y=rnd()*S,r=40+rnd()*50,ry=r*(.6+rnd()*.4),a=.12+rnd()*.1,turn=rnd()*3;wrap(x,y,(px,py)=>puff(g,px,py,r,ry,turn,a));}
 for(let i=0;i<46;i++){const cx=rnd()*S,cy=rnd()*S,n=3+(rnd()*7|0);
  for(let k=0;k<n;k++){const x=cx+(rnd()-.5)*46,y=cy+(rnd()-.5)*46,r=4+rnd()*11,ry=r*(.55+rnd()*.45),a=.5+rnd()*.45,turn=rnd()*3;wrap(x,y,(px,py)=>puff(g,px,py,r,ry,turn,a));}}
 return c;
}
// World-space floor UVs for the dapple map: a turned square tile, so it never lines up with the paving or the ship.
export function dappleUV(g){
 const p=g.attributes.position,uv=new Float32Array(p.count*2),c=Math.cos(DAPPLE.turn),s=Math.sin(DAPPLE.turn);
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);uv[i*2]=(x*c-z*s)/DAPPLE.tile;uv[i*2+1]=(x*s+z*c)/DAPPLE.tile;}
 return uv;
}
