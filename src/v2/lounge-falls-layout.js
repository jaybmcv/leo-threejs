import layout from '../plan/selected-layout.js';
import fitoutOverrides from '../plan/room-fitout-overrides-v2.json' with {type:'json'};

// Source-frame metres. The pond sits halfway between the dome rim and stair planter.
const {pond:POND,path:PATH,landing:LANDING,fall:FALL,bench:BENCH}=fitoutOverrides['commons-1'].loungeFalls;
export {POND,PATH,LANDING,FALL,BENCH};
const room=layout.rooms.find(r=>r.id==='commons-1');
const gallery=room.components.galleries.find(g=>g.id==='commons-1-rear-8');
export const frameX=room.x-132,frameZ=room.z+27;
// Read the pond-side edge, including its curve, from the unchanged upper gallery.
export function galleryEdge(x){
 const hits=[],p=gallery.polygon;
 for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(a[0]===b[0]||x<Math.min(a[0],b[0])||x>Math.max(a[0],b[0]))continue;hits.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}
 if(!hits.length)throw Error('Waterfall outside the upper gallery');return Math.min(...hits);
}
export const fallZ=x=>frameZ-galleryEdge(x+frameX)+.12;
