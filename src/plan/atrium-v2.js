// Phase 6 accepted programme. Geometry stays in the existing atrium and room envelopes.
export const ATRIUM_PROTOTYPE={stage:2,cafe:'nose-commons-05',interiorReach:4,fogFar:650,skyY:40.02,waterDepth:.16};
const rect=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
export const ATRIUM_ZONES=[
 {id:'atrium6-lobby',name:'Arrival lobby',bounds:[-123,-96,-32,32],colour:0xdacdb8},
 {id:'atrium6-park',name:'Voyager park',bounds:[-90,-4,-56,-6],colour:0x789974},
 {id:'atrium6-lake',name:'Reflection lake',bounds:[4,120,-56,-6],colour:0x71aeb3},
 {id:'atrium6-food',name:'Atrium food hall',bounds:[-90,58,6,56],colour:0xd6bea0},
 {id:'atrium6-stage',name:'Common stage',bounds:[66,122,6,56],colour:0xb6b8b0},
 {id:'atrium6-commons',name:'Voyage Commons',bounds:[150,174,-18,18],colour:0xd9d3c4}
].map(z=>({...z,polygon:rect(...z.bounds)}));
export const ATRIUM_LAKE_BRIDGE={deck:6,bounds:[58.5,61.5,-57,-5],rise:.22};
export const ATRIUM_TERRACES=Array.from({length:10},(_,i)=>[-1,1].map(side=>({id:'p6-terrace-'+(i+6)+'-'+(side<0?'port':'starboard'),name:'Neighborhood '+(i+1)+' dining terrace',deck:i+6,side,polygon:rect(-126,-123.8,...(side<0?[-17,-10.4]:[10.4,17]))}))).flat();
export function phase6Owners(layout){return [...ATRIUM_ZONES.map(z=>({...z,deck:6,y:layout.decks[5].y,height:8,visibilityYMin:layout.decks[5].y-.2,visibilityPolygons:[z.polygon],phase6Atrium:true})),...ATRIUM_TERRACES.map(t=>({...t,y:layout.decks[t.deck-1].y,height:3.4,visibilityPolygons:[t.polygon],phase6Atrium:true,showFromBelow:true})),{id:'p6-crew-gallery',name:'Crew service gallery',deck:20,y:layout.decks[19].y,height:3.4,polygon:rect(127.8,136.2,-16,16),phase6Atrium:true}];}
export const BOW_CAFE_THEMES=['Oak & cream','Sage reading nook','Clay & resident art','Family corner','Teal listening room','Board-game coffee','Tea & quiet','Workshop coffee','Community table','Botanical coffee'];

const lakes=new WeakMap();
// 4B: the lake's boulevard side is a rounded shoreline set back behind soft lawn banks (up to ~3.3 m), as in the
// concept. It stays straight at z=-6 across the reflection-terrace bays (x 30, 46, 78, 94), the bridge (x 60) and
// the lake's ends, so those keep their water edge. Sampled every 0.5 m, like the far bank.
const BANK_CLEAR=[[22.5,37.5],[38.5,53.5],[55,65],[70.5,85.5],[86.5,101.5]];
export function phase6LakeShore(x){
 if(x<=7||x>=117)return -6;let m=Math.min(1,(x-7)/4,(117-x)/4);
 for(const[a,b]of BANK_CLEAR){if(x>a-3&&x<b+3)m=Math.min(m,x<=a||x>=b?Math.min(1,Math.abs(x<=a?a-x:x-b)/3):0);}
 const bank=1.4+1.3*(.5+.5*Math.sin(x/6.1+.7))+.6*Math.sin(x/2.7);return -6-Math.max(0,m*bank);
}
// The lawn banks between the boulevard (z=-6) and that shoreline, one polygon per run, sharing the shoreline's vertices.
export function phase6LakeBanks(){const banks=[];let run=[];const flush=()=>{if(run.length>1){const a=run[0][0]-.5,b=run.at(-1)[0]+.5;banks.push([[a,-6],[b,-6],...run.slice().reverse()]);}run=[];};
 for(let x=4.5;x<120;x+=.5){const z=phase6LakeShore(x);if(z<-6.001)run.push([x,z]);else flush();}flush();return banks;}
// A winding 2.4 m stone path through the park lawn, from the lobby end of the grove to the crossing at x=-4.
export function phase6ParkPath(){const c=x=>-20.5+3*Math.sin((x+6)/8.5),top=[],bottom=[];for(let x=-88;x<=-3.9999;x+=1){top.push([x,c(x)+1.2]);bottom.push([x,c(x)-1.2]);}return [...bottom,...top.reverse()];}
// Keep a dry perimeter beside the inward wing notches as well as the main
// boulevard. The three-metre square reservation is conservative at corners.
export function phase6LakePolygon(ring){let cached=lakes.get(ring);if(cached)return cached;const border=x=>{let z=-1000;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(Math.abs(b[0]-a[0])<1e-9||x<Math.min(a[0],b[0])-1e-7||x>Math.max(a[0],b[0])+1e-7)continue;const q=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);if(q<0)z=Math.max(z,q);}return z;},lower=[];for(let x=4;x<=120.0001;x+=.5){const xs=[x-3.2,x+3.2,...ring.filter(p=>p[0]>=x-3.2&&p[0]<=x+3.2).map(p=>p[0])],z=Math.max(-56,...xs.map(border).map(z=>z+3.2));lower.push([x,z]);}const top=[];for(let x=120;x>=4-1e-4;x-=.5)top.push([x,phase6LakeShore(x)]);cached=[...lower,...top];lakes.set(ring,cached);return cached;}

// Garden footprints are candidates until validated against the actual notched deck.
export const ATRIUM_GARDEN_POCKETS=[-80,-34,12].flatMap((x,i)=>[-1,1].map(side=>({id:'atrium6-garden-'+i+'-'+(side<0?'port':'starboard'),x,z:side*44,width:12,depth:8,canopyHeight:[3.6,4.4,5.2][i]})));
// 4B signature trees. Each stands on an existing planted trunk (park grove or garden pocket), so the walk keeps that
// trunk as its collider; the small crown there gives way to the big canopy. Heights in metres above Deck 6.
export const ATRIUM_SIGNATURE_TREES=[
 {id:'park',x:-50,z:-27,height:13,spread:6.2,seed:11},
 {id:'lake',x:12,z:-45.1,height:12,spread:5.6,seed:23},
 {id:'food-aft',x:-34,z:42.9,height:13.5,spread:6.4,seed:37},
 {id:'food-fore',x:12,z:42.9,height:12.5,spread:5.8,seed:41},
];
// 4B waterfall (visual only), the lake's focal point as in the concept: at the far (east) end of its western basin,
// just short of the bridge and near the promenade, falling west back toward the boulevard so it faces the walker
// looking down the atrium. (x, z) is its rock line; yaw turns its local fall direction (+z) to world -x.
export const ATRIUM_WATERFALL={x:53.9,z:-17,width:8,yaw:-Math.PI/2};
// 4B pass 2: an avenue along the boulevard's park and food-hall/stage edges. Each run is a tree between two 2.4 m
// planters (4.8 m), with 7.2 m gaps between runs, centred between the food-hall stalls so a gap opens in front of
// each stall; the boulevard keeps 9.8 m clear. The cross routes at x=-79 and x=2 stay open, and so does the lake
// side, where the lawn shore and stones already edge the water.
export const ATRIUM_BOULEVARD_TREES=[...[-66,-54,-42,-30,-18].map(x=>({x,z:-5.45})),...[-66,-54,-42,-30,-18,-6,14,26,38,50,74,86,98,110].map(x=>({x,z:5.45}))].map(t=>({...t,canopyHeight:5.2}));
// Low brass lamps along the lake promenade edge, like the pairs at the reflection bays, every 8 m between the bays and
// the bridge.
export const ATRIUM_PROMENADE_LAMPS=Array.from({length:15},(_,i)=>6+i*8).filter(x=>[30,46,78,94].every(b=>Math.abs(x-b)>6.5)&&Math.abs(x-60)>4).map(x=>({x,z:-5.75}));
// Timber decks under the food hall's outer table courts (drawn by atrium-gardens.js). Most of each deck lies in a
// wing approach under Deck 7, so the string lights keep to open atrium: a scalloped run along each deck's front, on
// posts just off its near rim, and a criss-cross over the open fore end of the larger deck. Every post keeps the
// 2.4 m perimeter clearance (phase6-sanity) and stays clear of the tables and far-rim lanterns.
export const ATRIUM_TIMBER_DECKS=[{x0:22,x1:56,z0:35.4,z1:55.2,round:4},{x0:-72,x1:-44,z0:35.4,z1:55.2,round:4}];
export const ATRIUM_FESTOONS=[
 {posts:[[22.5,35],[30.75,35],[39,35],[47.25,35],[55.5,35],[47.25,54.8],[53.5,54.8]],strings:[[0,1],[1,2],[2,3],[3,4],[3,6],[4,5],[5,6]]},
 {posts:[[-71.5,35],[-62.5,35],[-53.5,35],[-44.5,35]],strings:[[0,1],[1,2],[2,3]]},
];
export function phase6GardenPolygons(){return ATRIUM_GARDEN_POCKETS.map(p=>rect(p.x-6,p.x+6,p.z-4,p.z+4));}
// A dry 2.4 m garden approach crosses the shallow edge; no deep tank is built.
export function phase6LakeIslands(){return [rect(6,18,-48,-40),rect(10.8,13.2,-56,-48)];}
