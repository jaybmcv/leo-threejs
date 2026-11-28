// The stern paint grid uses ship metres along X and Z. Both the walk and the server paint into it.
export const STERN={floor:32.3,top:34.5,x0:-237,x1:-216,z0:-24,z1:24};
export const SECTION={w:200,h:1400,count:16};
export const WALL={w:SECTION.w*SECTION.count,h:SECTION.h};
export const LEGACY={w:120,h:224,section:5,u:40,v:840};
export const PALETTE=['#f4f1ea','#15161a','#e0262b','#f85800','#ffd21f','#7bd23c','#13915a','#2fd6c5','#2a6fdb','#8a3ffc','#ff5fb4','#7a4a2a'];
// Nozzle radii in cells. Each cell is about 1.5 cm on the slope.
export const NOZZLES=[2,4,7];
export const STROKE_POINTS=24,STROKE_TRAVEL=1800;
const SIZE=SECTION.w*SECTION.h;
export const sectionId=id=>Number.isInteger(id)&&id>=0&&id<SECTION.count;
export const sectionOf=u=>Math.floor(u/SECTION.w);
const speck=(u,v)=>{let h=Math.imul(u*73856093^v*19349663,0x9e3779b1);h^=h>>>15;return (h>>>0)/4294967296;};

export function readStroke(msg){
 const c=msg?.c,s=msg?.s,p=msg?.p;
 if(!Number.isInteger(c)||c<1||c>PALETTE.length||!Number.isInteger(s)||s<0||s>=NOZZLES.length)return null;
 if(!Array.isArray(p)||p.length<2||p.length>STROKE_POINTS*2||p.length%2)return null;
 let length=0;
 for(let i=0;i<p.length;i+=2){
  const u=p[i],v=p[i+1];if(!Number.isInteger(u)||!Number.isInteger(v)||u<0||u>=WALL.w||v<0||v>=WALL.h)return null;
  if(i)length+=Math.hypot(u-p[i-2],v-p[i-1]);
 }
 return length<=STROKE_TRAVEL?{c,s,p}:null;
}

// Rasterize in the shared grid, then route each brush cell to its section, including overspray across joins.
export function paintStroke(sections,{c,s,p},changed){
 const r=NOZZLES[s],r2=r*r,rim=(r*.62)**2;let n=0;
 const dab=(cu,cv)=>{
  for(let v=Math.max(0,Math.round(cv)-r);v<=Math.min(WALL.h-1,Math.round(cv)+r);v++)for(let u=Math.max(0,Math.round(cu)-r);u<=Math.min(WALL.w-1,Math.round(cu)+r);u++){
   const d=(u-cu)**2+(v-cv)**2;if(d>r2||d>rim&&speck(u,v)>.55)continue;
   const id=sectionOf(u),x=u%SECTION.w;let cells=sections.get(id);
   if(!cells){cells=new Uint8Array(SIZE);sections.set(id,cells);}
   const i=v*SECTION.w+x;if(cells[i]===c)continue;cells[i]=c;n++;changed?.(id,x,v,cells);
  }
 };
 if(p.length===2)dab(p[0],p[1]);
 for(let i=2;i<p.length;i+=2){
  const u0=p[i-2],v0=p[i-1],u1=p[i],v1=p[i+1],steps=Math.max(1,Math.ceil(Math.hypot(u1-u0,v1-v0)/Math.max(1,r*.5)));
  for(let k=i===2?0:1;k<=steps;k++)dab(u0+(u1-u0)*k/steps,v0+(v1-v0)*k/steps);
 }
 return n;
}

const bytesToText=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
function rawCells(text,size){
 const s=atob(text);if(s.length!==size)return null;
 const cells=new Uint8Array(size);for(let i=0;i<size;i++){const c=s.charCodeAt(i);if(c>PALETTE.length)return null;cells[i]=c;}return cells;
}
// Sparse paint compresses in runs. Dense paint is bounded by the original grid size.
export function sectionToText(cells){
 const runs=new Uint8Array(cells.length);let n=0;
 for(let i=0;i<cells.length;){const c=cells[i];let j=i+1;while(j<cells.length&&j-i<256&&cells[j]===c)j++;
  if(n+2>=cells.length)return bytesToText(cells);runs[n++]=j-i-1;runs[n++]=c;i=j;
 }
 return '~'+bytesToText(runs.subarray(0,n));
}
export function sectionFromText(text){
 try{
  if(typeof text!=='string'||text.length>Math.ceil(SIZE/3)*4+1)return null;
  if(!text.startsWith('~'))return rawCells(text,SIZE);
  const runs=atob(text.slice(1)),cells=new Uint8Array(SIZE);let at=0;
  if(runs.length%2)return null;
  for(let i=0;i<runs.length;i+=2){
   const end=at+runs.charCodeAt(i)+1,c=runs.charCodeAt(i+1);
   if(end>SIZE||c>PALETTE.length)return null;cells.fill(c,at,end);at=end;
  }
  return at===SIZE?cells:null;
 }catch{return null;}
}

// Copy the old panel, cell for cell, onto a similarly sized patch left of the centre obstruction.
export function migrateLegacy(saved){
 try{
  if(saved?.w!==LEGACY.w||saved.h!==LEGACY.h)return null;
  const old=rawCells(saved.cells,LEGACY.w*LEGACY.h);if(!old)return null;
  const cells=new Uint8Array(SIZE);
  // The old grid ran rightward as seen from the lobby. Ship Z runs leftward in the aft view.
  for(let v=0;v<LEGACY.h;v++)for(let u=0;u<LEGACY.w;u++)cells[(v+LEGACY.v)*SECTION.w+LEGACY.u+LEGACY.w-1-u]=old[v*LEGACY.w+u];
  return cells;
 }catch{return null;}
}
