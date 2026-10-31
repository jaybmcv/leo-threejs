// Phase 6 stage 1: reviewable programme, not a full ten-café rollout.
export const ATRIUM_PROTOTYPE={stage:1,cafe:'nose-commons-05',interiorReach:8,skyY:40.02,waterDepth:.16};
const rect=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
export const ATRIUM_ZONES=[
 {id:'atrium6-lobby',name:'Arrival lobby',bounds:[-118,-78,-12,12],colour:0xdacdb8},
 {id:'atrium6-park',name:'Voyager park',bounds:[-76,0,-34,-8],colour:0x789974},
 {id:'atrium6-lake',name:'Reflection lake',bounds:[8,78,-32,-8],colour:0x71aeb3},
 {id:'atrium6-food',name:'Atrium food hall',bounds:[-40,46,8,34],colour:0xd6bea0},
 {id:'atrium6-stage',name:'Common stage',bounds:[64,112,12,34],colour:0xb6b8b0}
].map(z=>({...z,polygon:rect(...z.bounds)}));
export function phase6Owners(layout){return ATRIUM_ZONES.map(z=>({...z,deck:6,y:layout.decks[5].y,height:8,visibilityYMin:layout.decks[5].y-.2,visibilityPolygons:z.id==='atrium6-lake'?[z.polygon,rect(6.4,78.25,-33.1,-6.9)]:[z.polygon],phase6Atrium:true}));}
export const BOW_CAFE_THEMES=['Oak & cream','Sage reading nook','Clay & resident art','Family corner','Teal listening room','Board-game coffee','Tea & quiet','Workshop coffee','Community table','Botanical coffee'];
