// What an atrium PVS (scripts/walk-atrium-pvs.mjs) was baked from, as one key. A PVS stays valid for any walk with the same
// key, whatever else was rebuilt (lighting, materials, labels). The key covers every static collider triangle, window and
// collision-only ones with their flag (the bake sees through those but finds floors on them), plus the void, spans and
// sampling it marks against. Triangles count as an unordered set rounded to a
// millimetre, so a repacked BVH or a rebuild on another PC keeps the key.
import {BAND} from '../walk/collision.js';
import {PVS_GRID} from './atrium-pvs.js';
import {shutLandingDoors} from '../walk/lifts.js';

// Bump when the bake's rules change (scripts/walk-atrium-pvs.page.js), so data made under the old rules stops matching.
export const PVS_BAKE_VERSION=3;
// Eye heights above each floor: the lower cell holds the first-person eye (1.62 m), the upper one a raised third-person camera.
export const PVS_HEIGHTS=[.35,1.65,3];
// span() in src/walk/main.public.js draws at least 3 m below to 4 m above the walker's floor, whatever the atrium does.
export const PVS_LOCAL_SPAN=[-3,4];

/** The bake's inputs besides the colliders. `envelope` is atriumEnvelope(layout) from src/v2/atrium-sight.js: the atrium as
 * the sight rays bound it. Its prism floor sits 5 cm above deck 6's, so a picture of the gallery beneath it, through
 * the prism's polygon offset, does not count as the atrium. */
export function pvsSetup(layout,envelope){
 const deck6=layout.decks.find(d=>d.number===6).y;
 // The shut landing doors the bake draws (scripts/walk-atrium-pvs.page.js) are inputs too: moved lifts mean a new bake.
 return {version:PVS_BAKE_VERSION,grid:PVS_GRID,heights:PVS_HEIGHTS,levels:[[envelope.envelope,deck6+.05,envelope.high]],
  atriumSpan:[envelope.low,envelope.high],localSpan:PVS_LOCAL_SPAN,band:BAND,doors:shutLandingDoors()};
}

const SEEDS=[0x9747b28c,0x2c1b3c6d,0x5bd1e995];
const mix=(h,k)=>{k=Math.imul(k,0xcc9e2d51);k=k<<15|k>>>17;h^=Math.imul(k,0x1b873593);h=h<<13|h>>>19;return Math.imul(h,5)+0xe6546b64|0;};
const finish=(h,n)=>{h^=n;h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);return (h^h>>>16)>>>0;};
// A multiset hash: three independently seeded hashes of each member summed, plus the count, so order never matters.
function lanes(){
 const sum=[0,0,0];let count=0;
 return {
  add(q,n){for(let s=0;s<3;s++){let h=SEEDS[s];for(let i=0;i<n;i++)h=mix(h,q[i]);sum[s]=sum[s]+finish(h,n)>>>0;}count++;},
  words(){return [...sum,count];},
  hex(){return this.words().map(w=>(w>>>0).toString(16).padStart(8,'0')).join('');},
 };
}
const mm=v=>Math.round(v*1000);

// Each triangle starts at the vertex that makes its list of coordinates least (winding kept), so the same face hashes
// alike wherever its vertices were listed; its window flag follows.
const before=(v,a,b)=>{for(let i=0;i<9;i++){const x=v[(a*3+i)%9],y=v[(b*3+i)%9];if(x!==y)return x<y;}return false;};
function addTriangles(set,geometry,flags){
 const p=geometry.attributes.position.array,index=geometry.index?.array,n=(index?index.length:p.length/3)/3,q=new Int32Array(10),v=new Int32Array(9);
 for(let f=0;f<n;f++){
  for(let k=0;k<3;k++){const i=index?index[f*3+k]:f*3+k;v[k*3]=mm(p[i*3]);v[k*3+1]=mm(p[i*3+1]);v[k*3+2]=mm(p[i*3+2]);}
  let first=0;for(let k=1;k<3;k++)if(before(v,k,first))first=k;
  for(let i=0;i<9;i++)q[i]=v[(first*3+i)%9];q[9]=flags?.[f]?1:0;
  set.add(q,10);
 }
}

/** The colliders' share of the key. `colliders` is the walk's static collision ({bands: Map of {bvh}, groups: [{bvh,
 * items: [{matrix}]}]}), as read by the bake (window.__walk.colliders) or decoded from the prepared walk in Node. Movers are
 * left out because the bake treats them as open. */
export function colliderDigest(colliders){
 const bands=lanes(),groups=lanes(),q=new Int32Array(20);
 for(const band of colliders.bands.values())addTriangles(bands,band.bvh.geometry,band.bvh.leoWindowFlags);
 for(const group of colliders.groups){
  const local=lanes();addTriangles(local,group.bvh.geometry,group.bvh.leoWindowFlags);
  const words=local.words();for(let i=0;i<4;i++)q[i]=words[i]|0;
  for(const item of group.items){const e=item.matrix.elements;for(let i=0;i<16;i++)q[4+i]=i>=12&&i<15?mm(e[i]):Math.round(e[i]*1e5);groups.add(q,20);}
 }
 return bands.hex()+'.'+groups.hex();
}
/** The whole key, from colliderDigest and pvsSetup. */
export function pvsKey(digest,setup){
 const text=JSON.stringify(setup,(k,v)=>typeof v==='number'?mm(v):v),settings=lanes(),chars=new Int32Array(text.length);
 for(let i=0;i<text.length;i++)chars[i]=text.charCodeAt(i);settings.add(chars,chars.length);
 return [setup.version,digest,settings.hex()].join('.');
}
export const atriumPvsKey=(colliders,setup)=>pvsKey(colliderDigest(colliders),setup);
