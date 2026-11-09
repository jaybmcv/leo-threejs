// Canvases for the atrium's day/night light (atrium-mood.js). They live with the walk rather than beside
// paintDaylightSky (src/v2/atrium-daylight.js) because they are made in the page from what it loaded: the prepared
// atrium geometry and its authored sky stay exactly as built.

// Concept C's dusk, made from the day sky itself so its clouds stay where they are: lavender over most of the panel,
// turning rose and then peach over the last stretch toward the bow (the panel runs aft to bow along u), so from the
// floor looking forward it reads purple overhead to peach at the far end. The day picture's light and shade are
// recoloured, then mostly covered by the same gradient: concept C's sky is a smooth wash with only a trace of cloud.
// Blend modes only, which every browser canvas has.
export function paintDuskSky(c,day){
 const W=day.width||day.naturalWidth,H=day.height||day.naturalHeight;c.width=W;c.height=H;
 const g=c.getContext('2d');g.drawImage(day,0,0,W,H);
 const along=g.createLinearGradient(0,0,W,0);
 for(const[at,col]of[[0,'#7c72c8'],[.7,'#9282d4'],[.86,'#e094b4'],[.95,'#f6aa92'],[1,'#fabc8c']])along.addColorStop(at,col);
 g.fillStyle=along;g.globalCompositeOperation='color';g.fillRect(0,0,W,H);
 g.globalCompositeOperation='source-over';g.globalAlpha=.7;g.fillRect(0,0,W,H);g.globalAlpha=1;return c;
}

// A downlight seen from below, with the warm pool it throws on the soffit round it: a bright core (the lamp, about the
// size of the old disc once the instance is scaled) fading softly to nothing at the rim. Drawn additively.
export function paintDownlightPool(c){
 const S=64;c.width=S;c.height=S;const g=c.getContext('2d'),r=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
 for(const[at,col]of[[0,'rgba(255,255,255,1)'],[.24,'rgba(255,248,232,1)'],[.32,'rgba(255,226,186,.5)'],[.6,'rgba(255,214,164,.16)'],[1,'rgba(255,206,150,0)']])r.addColorStop(at,col);
 g.clearRect(0,0,S,S);g.fillStyle=r;g.fillRect(0,0,S,S);return c;
}
