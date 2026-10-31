import layout from'v2-layout';import{contains,distanceToSegment,bounds}from'../plan/geometry-v2.js';import{ATRIUM_PROTOTYPE}from'../plan/atrium-v2.js';
let position=null,classified;const architecture=[],owners=new Map();
for(const r of[...layout.cabins,...layout.rooms.filter(r=>!r.aggregate),...(layout.hullPrototypes?.prototypes||[]).map(p=>({polygon:p.polygon,y:p.chart.origin[1],height:p.rect[3],deck:p.deck}))]){
 if(!r.polygon)continue;const box=bounds(r.polygon),y=r.y,height=r.height||3.4;
 for(const d of layout.decks)if(d.y>=y-.1&&d.y<y+height){let list=owners.get(d.number);if(!list)owners.set(d.number,list=[]);list.push({polygon:r.polygon,box,y,height});}
}
export function registerAtriumArchitecture(root){root?.traverse(o=>{if(o.name==='P6_bow_cafe_fronts'&&o.isInstancedMesh&&!architecture.some(a=>a.o===o))architecture.push({o,all:o.instanceMatrix.array.slice(),centres:Array.from({length:o.count},(_,i)=>new(o.position.constructor)(o.instanceMatrix.array[i*16+12],o.instanceMatrix.array[i*16+13],o.instanceMatrix.array[i*16+14]))});});}
export function setAtriumView(p){if(position&&(position.x-p.x)**2+(position.y-p.y)**2+(position.z-p.z)**2<1e-8)return;position={x:p.x,y:p.y,z:p.z};classified=undefined;for(const a of architecture){let n=0;for(let i=0;i<a.centres.length;i++){const c=a.centres[i];if((c.x-p.x)**2+(c.y-p.y)**2+(c.z-p.z)**2<=900)continue;a.o.instanceMatrix.array.set(a.all.subarray(i*16,i*16+16),n++*16);}a.o.count=n;a.o.instanceMatrix.needsUpdate=true;}}
function classify(){if(classified!==undefined)return classified;const p=position;if(!p)return null;const d=layout.decks.reduce((a,b)=>Math.abs(a.y-p.y)<Math.abs(b.y-p.y)?a:b);
 if(d.number<6||!d.atrium?.outline)return classified=null;
 const q=[p.x,p.z],ring=d.atrium.outline;
 if(Math.abs(p.y-d.y)>1.6||!contains(ring,q)&&!ring.some((a,i)=>distanceToSegment(q,a,ring[(i+1)%ring.length])<=3.5))return classified=null;
 if((owners.get(d.number)||[]).some(r=>p.y>=r.y-.1&&p.y<r.y+r.height&&p.x>=r.box.x0&&p.x<=r.box.x1&&p.z>=r.box.z0&&p.z<=r.box.z1&&contains(r.polygon,q)))return classified=null;
 return classified=[p.y-ATRIUM_PROTOTYPE.interiorReach,p.y+ATRIUM_PROTOTYPE.interiorReach];
}
export function fastAtriumSpan(p){setAtriumView(p);return classify();}
export function atriumSpan(low,high){const span=classify();return span?[Math.max(low,span[0]),Math.min(high,span[1])]:[low,high];}
export function onePassAtriumGlass(root){root.traverse(o=>{for(const m of[].concat(o.material||[]))if(m.transparent&&m.side===2&&/V2_(smart_glass|prototype_hull_glass)|P4_atrium_glass|V2_facade/.test(m.name))m.forceSinglePass=true;});}
