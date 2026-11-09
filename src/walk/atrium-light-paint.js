// Canvases for the atrium's day/night light (atrium-mood.js). They live with the walk rather than beside
// paintDaylightSky (src/v2/atrium-daylight.js) because they are made in the page from what it loaded: the prepared
// atrium geometry and its authored sky stay exactly as built.

// Concept C's dusk, made from the day sky itself so its clouds stay where they are: the day picture's light and shade,
// recoloured lavender down the middle of the panel and rose to peach at its long edges, warming toward the bow (the
// panel runs aft to bow along u, edge to edge across v). Blend modes only, which every browser canvas has.
export function paintDuskSky(c,day){
 const W=day.width||day.naturalWidth,H=day.height||day.naturalHeight;c.width=W;c.height=H;
 const g=c.getContext('2d');g.drawImage(day,0,0,W,H);
 g.globalCompositeOperation='color';
 const across=g.createLinearGradient(0,0,0,H);
 for(const[at,col]of[[0,'#f3ae8e'],[.24,'#e09cb4'],[.5,'#a497d6'],[.76,'#e09cb4'],[1,'#f3ae8e']])across.addColorStop(at,col);
 g.fillStyle=across;g.fillRect(0,0,W,H);
 const along=g.createLinearGradient(0,0,W,0);
 for(const[at,col]of[[0,'rgba(150,140,210,.5)'],[.45,'rgba(225,160,185,0)'],[1,'rgba(248,176,138,.6)']])along.addColorStop(at,col);
 g.fillStyle=along;g.fillRect(0,0,W,H);
 // Dusk is dimmer and richer than noon: the same colours multiplied in at half strength deepen the pale day sky.
 g.globalCompositeOperation='multiply';g.globalAlpha=.55;g.fillStyle=across;g.fillRect(0,0,W,H);g.globalAlpha=1;
 g.globalCompositeOperation='source-over';return c;
}

// A downlight seen from below, with the warm pool it throws on the soffit round it: a bright core (the lamp, about the
// size of the old disc once the instance is scaled) fading softly to nothing at the rim. Drawn additively.
export function paintDownlightPool(c){
 const S=64;c.width=S;c.height=S;const g=c.getContext('2d'),r=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
 for(const[at,col]of[[0,'rgba(255,255,255,1)'],[.24,'rgba(255,248,232,1)'],[.32,'rgba(255,226,186,.5)'],[.6,'rgba(255,214,164,.16)'],[1,'rgba(255,206,150,0)']])r.addColorStop(at,col);
 g.clearRect(0,0,S,S);g.fillStyle=r;g.fillRect(0,0,S,S);return c;
}
