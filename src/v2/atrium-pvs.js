// Precomputed atrium visibility (scripts/walk-atrium-pvs.mjs): per 2 m cell, whether any part of the open atrium can be
// seen from it. Cells are centred on the x/z grid points and stacked in 2 m slabs from the Deck 1 floor, two per deck.
// 0 = no data (the caller keeps its own sight test), 1 = the atrium is hidden from everywhere in the cell, 2 = it may show.
import {BAND} from '../walk/collision.js';
export const PVS_GRID={x0:-300,z0:-150,nx:283,nz:151,step:2,y0:-39.7,ny:42};
export const PVS_UNKNOWN=0,PVS_HIDDEN=1,PVS_VISIBLE=2;
// A visible cell also says which heights its sight reaches (ranges.lo/hi, bytes: y0 + span * byte / 255), so the walk
// draws those decks, not every atrium deck: a glimpse up a glass stair drew Decks 6 to 20 (1,700 draws). A file without
// ranges, or with other units, leaves the walk drawing the whole atrium as before.
export const PVS_RANGE={y0:-45,span:180};
// Each bound reads a byte out (rounding) and a whole band more: the bake's heights come from colliders, while render-only
// pieces (glass, plants) can stand a little above or below them (Codex review).
const RANGE_PAD=PVS_RANGE.span/255+BAND.height;

// Runs of equal values as [value, length] varint pairs, base64 encoded: the cells are long stretches of one state.
export function encodeCells(cells){
 const bytes=[],varint=n=>{while(n>127){bytes.push(n&127|128);n>>>=7;}bytes.push(n);};
 for(let i=0;i<cells.length;){let j=i;while(j<cells.length&&cells[j]===cells[i])j++;varint(cells[i]);varint(j-i);i=j;}
 let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.slice(i,i+8192));
 return btoa(text);
}
export function decodeCells(text,length,max=PVS_VISIBLE){
 const raw=atob(text),cells=new Uint8Array(length);let at=0,i=0;
 const varint=()=>{let n=0,shift=0,b;do{b=raw.charCodeAt(at++);n+=(b&127)*2**shift;shift+=7;}while(b&128);return n;};
 // A state this code does not know would read as hidden; refuse the file so the rays answer instead.
 while(at<raw.length){const value=varint(),run=varint();if(value>max||!(run>0))throw Error('Atrium PVS holds an unknown state or empty run');if(i+run>length)throw Error('Atrium PVS overruns its grid');cells.fill(value,i,i+run);i+=run;}
 if(i!==length)throw Error('Atrium PVS does not fill its grid');
 return cells;
}

/** `data` as written by scripts/walk-atrium-pvs.mjs; `source.key` the atrium PVS key (src/v2/atrium-pvs-key.js) of the
 * walk being shown, which the public build works out from its prepared walk. Returns null when the data was baked from
 * other geometry, so a stale file can only cost speed, never hide the atrium. */
export function createAtriumPvs(data,source){
 if(data?.version!==1||!data.cells||!source?.key||data.source?.key!==source.key)return null;
 const g=data.grid;if(['x0','z0','nx','nz','step','y0','ny'].some(k=>g?.[k]!==PVS_GRID[k]))return null;
 const cells=decodeCells(data.cells,g.nx*g.nz*g.ny),r=data.ranges;
 const ranges=r?.y0===PVS_RANGE.y0&&r.span===PVS_RANGE.span&&r.lo&&r.hi?{lo:decodeCells(r.lo,cells.length,255),hi:decodeCells(r.hi,cells.length,255)}:null;
 const index=p=>{const i=Math.round((p.x-g.x0)/g.step),j=Math.round((p.z-g.z0)/g.step),k=Math.floor((p.y-g.y0)/2);
  return i<0||i>=g.nx||j<0||j>=g.nz||k<0||k>=g.ny?-1:(k*g.nx+i)*g.nz+j;};
 return {cells,at(p){const c=index(p);return c<0?PVS_UNKNOWN:cells[c];},
  // [low, high] the sight from a visible cell reaches, or null (no ranges: the whole atrium).
  range(p){const c=index(p);if(!ranges||c<0||cells[c]!==PVS_VISIBLE)return null;const b=v=>PVS_RANGE.y0+PVS_RANGE.span*v/255;return [b(ranges.lo[c])-RANGE_PAD,b(ranges.hi[c])+RANGE_PAD];}};
}
