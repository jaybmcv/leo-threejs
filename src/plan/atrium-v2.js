// Phase 6 accepted programme. Geometry stays in the existing atrium and room envelopes.
export const ATRIUM_PROTOTYPE={stage:2,cafe:'nose-commons-05',interiorReach:4,fogFar:650,skyY:40.02,waterDepth:.16};
const rect=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
export const ATRIUM_ZONES=[
 {id:'atrium6-lobby',name:'Arrival lobby',bounds:[-123,-96,-32,32],colour:0xdacdb8},
 {id:'atrium6-park',name:'Voyager park',bounds:[-90,-4,-56,-6],colour:0x789974},
 {id:'atrium6-lake',name:'Reflection lake',bounds:[4,120,-56,-6],colour:0x71aeb3},
 {id:'atrium6-food',name:'Atrium food hall',bounds:[-90,58,6,56],colour:0xd6bea0},
 {id:'atrium6-stage',name:'Common stage',bounds:[66,122,6,56],colour:0xb6b8b0}
].map(z=>({...z,polygon:rect(...z.bounds)}));
export const ATRIUM_LAKE_BRIDGE={deck:6,bounds:[58.5,61.5,-57,-5],rise:.22};
export const ATRIUM_TERRACES=Array.from({length:10},(_,i)=>[-1,1].map(side=>({id:'p6-terrace-'+(i+6)+'-'+(side<0?'port':'starboard'),name:'Neighborhood '+(i+1)+' dining terrace',deck:i+6,side,polygon:rect(-126,-123.8,...(side<0?[-17,-10.4]:[10.4,17]))}))).flat();
export function phase6Owners(layout){return [...ATRIUM_ZONES.map(z=>({...z,deck:6,y:layout.decks[5].y,height:8,visibilityYMin:layout.decks[5].y-.2,visibilityPolygons:[z.polygon],phase6Atrium:true})),...ATRIUM_TERRACES.map(t=>({...t,y:layout.decks[t.deck-1].y,height:3.4,visibilityPolygons:[t.polygon],phase6Atrium:true,showFromBelow:true})),{id:'p6-crew-gallery',name:'Crew service gallery',deck:20,y:layout.decks[19].y,height:3.4,polygon:rect(127.8,136.2,-16,16),phase6Atrium:true}];}
export const BOW_CAFE_THEMES=['Oak & cream','Sage reading nook','Clay & resident art','Family corner','Teal listening room','Board-game coffee','Tea & quiet','Workshop coffee','Community table','Botanical coffee'];

const lakes=new WeakMap();
// Keep a dry perimeter beside the inward wing notches as well as the main
// boulevard. The three-metre square reservation is conservative at corners.
export function phase6LakePolygon(ring){let cached=lakes.get(ring);if(cached)return cached;const border=x=>{let z=-1000;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(Math.abs(b[0]-a[0])<1e-9||x<Math.min(a[0],b[0])-1e-7||x>Math.max(a[0],b[0])+1e-7)continue;const q=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);if(q<0)z=Math.max(z,q);}return z;},lower=[];for(let x=4;x<=120.0001;x+=.5){const xs=[x-3.2,x+3.2,...ring.filter(p=>p[0]>=x-3.2&&p[0]<=x+3.2).map(p=>p[0])],z=Math.max(-56,...xs.map(border).map(z=>z+3.2));lower.push([x,z]);}cached=[...lower,[120,-6],[4,-6]];lakes.set(ring,cached);return cached;}
