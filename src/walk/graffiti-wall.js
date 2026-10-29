// The graffiti wall on the fin root casing in Deck 19's aft lift lobby (fin-casing.js): what the paint is, shared by the
// page (graffiti.js) and Leo live (server/leo-live.mjs), so both lay a stroke down cell for cell the same way.
//
// The wall is a fixed grid of cells, W across and H down from the top-left as you face it, each one bare (0) or one of
// the palette's colours (1-12). A stroke is a colour, a nozzle size and a short run of cell points; painting it sets
// every cell the nozzle passes over to that colour, over whatever was there. So the stored wall never grows: old paint
// stays until someone paints over it, and the whole wall is W*H bytes however much is sprayed.
export const WALL={w:120,h:224};
// Spray can colours, 1-12 on the wire (0 is the bare casing).
export const PALETTE=['#f4f1ea','#15161a','#e0262b','#f85800','#ffd21f','#7bd23c','#13915a','#2fd6c5','#2a6fdb','#8a3ffc','#ff5fb4','#7a4a2a'];
// Nozzle radii in cells (a cell is about 1.5 cm): fine, medium, wide.
export const NOZZLES=[2,4,7];
// The most points one stroke message carries; the page sends a stroke every tenth of a second while the button is held.
export const STROKE_POINTS=24;

// A cell's speckle: the same for every page and the server, so a stroke's soft rim comes out identical everywhere.
const speck=(u,v)=>{let h=Math.imul(u*73856093^v*19349663,0x9e3779b1);h^=h>>>15;return (h>>>0)/4294967296;};
// One stroke {c, s, p:[u0,v0,u1,v1,...]} as checked from the wire, or null.
export function readStroke(msg){
 const c=msg?.c,s=msg?.s,p=msg?.p;
 if(!Number.isInteger(c)||c<1||c>PALETTE.length||!Number.isInteger(s)||s<0||s>=NOZZLES.length)return null;
 if(!Array.isArray(p)||p.length<2||p.length>STROKE_POINTS*2||p.length%2)return null;
 for(let i=0;i<p.length;i++){const n=p[i],max=i%2?WALL.h-1:WALL.w-1;if(!Number.isInteger(n)||n<0||n>max)return null;}
 return {c,s,p};
}
// Lays a stroke into `cells` (a Uint8Array of W*H). Calls changed(u,v) for each cell it sets; returns how many.
export function paintStroke(cells,{c,s,p},changed){
 const r=NOZZLES[s],r2=r*r,rim=(r*.62)**2;let n=0;
 const dab=(cu,cv)=>{
  for(let v=Math.max(0,Math.round(cv)-r);v<=Math.min(WALL.h-1,Math.round(cv)+r);v++)for(let u=Math.max(0,Math.round(cu)-r);u<=Math.min(WALL.w-1,Math.round(cu)+r);u++){
   const d=(u-cu)**2+(v-cv)**2;if(d>r2)continue;
   // The outer ring is a spray's overspray: only some of its cells take the colour.
   if(d>rim&&speck(u,v)>.55)continue;
   const i=v*WALL.w+u;if(cells[i]===c)continue;cells[i]=c;n++;changed?.(u,v);
  }
 };
 if(p.length===2)dab(p[0],p[1]);
 for(let i=2;i<p.length;i+=2){
  const u0=p[i-2],v0=p[i-1],u1=p[i],v1=p[i+1],steps=Math.max(1,Math.ceil(Math.hypot(u1-u0,v1-v0)/Math.max(1,r*.5)));
  for(let k=i===2?0:1;k<=steps;k++)dab(u0+(u1-u0)*k/steps,v0+(v1-v0)*k/steps);
 }
 return n;
}
// The wall as text for the wire and the file, and back (null if it is not a wall this size).
export function wallToText(cells){let s='';for(let i=0;i<cells.length;i+=8192)s+=String.fromCharCode(...cells.subarray(i,i+8192));return btoa(s);}
export function wallFromText(text){
 try{if(typeof text!=='string')return null;const s=atob(text);if(s.length!==WALL.w*WALL.h)return null;
  const cells=new Uint8Array(s.length);for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c>PALETTE.length)return null;cells[i]=c;}return cells;}catch{return null;}
}
