import {wingFlight} from './structure-v2.js';
import {bounds,contains,distanceToSegment,rectangle,overlaps} from './geometry-v2.js';
// Routes are measured on the planned floor, with 1.2 m clear branches and the 2.6 m ring retained.
export function connectPlan({h,decks,rooms,cabins,shuttles,circulation,issues}){
 const nodes=[],edges=[],corridors=[],landings=[];
 for(const d of decks){
  const ramps=circulation.ramps.filter(r=>r.deck===d.number);
  const floorHoles=d.slab.holes.filter(o=>o.id!=='atrium').map(o=>({...o,kind:'floor void'}));
  const solids=[...floorHoles,...ramps,...rooms.filter(r=>!r.aggregate&&r.y<d.y+2&&r.y+r.height>d.y+.1),...cabins.filter(c=>c.deck===d.number),...shuttles.filter(s=>s.deck===d.number),...d.openings,...circulation.stairs.filter(s=>s.deck===d.number&&!d.openings.some(o=>o.id===s.id))];
  const buckets=new Map();for(const o of solids){o._navBounds=bounds(o.polygon);const b=o._navBounds;for(let x=Math.floor((b.x0-.82)/4);x<=Math.floor((b.x1+.82)/4);x++)for(let z=Math.floor((b.z0-.82)/4);z<=Math.floor((b.z1+.82)/4);z++){const key=x+':'+z;(buckets.get(key)??buckets.set(key,[]).get(key)).push(o);}}
  const Q=2,X0=-560,X1=510,Z0=-180,Z1=180,W=X1-X0+1,N=W*(Z1-Z0+1),free=new Uint8Array(N),parent=new Int32Array(N).fill(-2),queue=new Int32Array(N),aperture=d.atrium?.outline,allowed=[...circulation.bridges.filter(b=>b.deck===d.number&&b.access!=='crew'),...circulation.towers.filter(b=>b.deck===d.number),...(circulation.balconies||[]).filter(b=>b.deck===d.number)];
  const ix=(x,z)=>(z-Z0)*W+x-X0,point=i=>[(i%W+X0)/Q,(Math.floor(i/W)+Z0)/Q],near=(x,z)=>buckets.get(Math.floor(x/4)+':'+Math.floor(z/4))||[];
  const clear=(x,z)=>{for(const o of near(x,z)){const b=o._navBounds;if(x<b.x0-.82||x>b.x1+.82||z<b.z0-.82||z>b.z1+.82)continue;if(contains(o.polygon,[x,z]))return false;for(let i=0;i<o.polygon.length;i++)if(distanceToSegment([x,z],o.polygon[i],o.polygon[(i+1)%o.polygon.length])<.8)return false;}return true;};
  const inVoid=(x,z)=>{const s=d.atrium?.samples;if(!s||x<s[0][0]||x>s.at(-1)[0])return false;const f=(x-s[0][0])*2,i=Math.min(s.length-2,Math.floor(f)),w=s[i][1]+(s[i+1][1]-s[i][1])*(f-i);return w>.001&&Math.abs(z)<=w;};
  for(let x=X0;x<=X1;x++){
   const px=x/Q,half=Math.min(h.minimum(px-.65,px+.65,d.y+.05,d.y+2.15,-1)-.7,h.minimum(px-.65,px+.65,d.y+.05,d.y+2.15,1)-.7)-.65;if(half<=0)continue;
   for(let z=Math.max(Z0,Math.ceil(-half*Q));z<=Math.min(Z1,Math.floor(half*Q));z++){const pz=z/Q;
    if(d.number>6&&aperture&&[[0,0],[-.8,-.8],[-.8,.8],[.8,-.8],[.8,.8]].some(([dx,dz])=>inVoid(px+dx,pz+dz)&&!allowed.some(a=>contains(a.polygon,[px+dx,pz+dz]))))continue;
    if(clear(px,pz))free[ix(x,z)]=1;
   }
  }
  const closest=(p,max=3)=>{let best=-1,dist=max*max;for(let x=Math.max(X0,Math.floor((p[0]-max)*Q));x<=Math.min(X1,Math.ceil((p[0]+max)*Q));x++)for(let z=Math.max(Z0,Math.floor((p[1]-max)*Q));z<=Math.min(Z1,Math.ceil((p[1]+max)*Q));z++){const i=ix(x,z),dd=(x/Q-p[0])**2+(z/Q-p[1])**2;if(free[i]&&dd<dist){dist=dd;best=i;}}return best;};
  const root=closest([132,3.5]);if(root<0){issues.push({kind:'circulation-root',deck:d.number});continue;}
  let head=0,tail=0;queue[tail++]=root;parent[root]=-1;
  while(head<tail){const i=queue[head++],x=i%W,z=Math.floor(i/W);for(const [dx,dz]of [[-1,0],[1,0],[0,-1],[0,1]]){
   if(x+dx<0||x+dx>=W||z+dz<0||z+dz>Z1-Z0)continue;const j=i+dx+dz*W;if(!free[j]||parent[j]!==-2||dx&&dz&&(!free[i+dx]||!free[i+dz*W]))continue;parent[j]=i;queue[tail++]=j;
  }}
  const terminals=[];
  for(const r of [...rooms.filter(r=>r.deck===d.number&&!r.aggregate),...cabins.filter(c=>c.deck===d.number),...rooms.flatMap(r=>(r.galleryDoors??[]).filter(g=>g.deck===d.number).map(g=>({...r,y:d.y,door:g,row:'gallery'})))]){
   if(!r.door)continue;const p=[r.door.center[0],r.door.center[2]],vx=p[0]-r.x,vz=p[1]-r.z,len=Math.hypot(vx,vz)||1,out=r.door.outward??[vx/len,vz/len];r.door.outward=out;
   const ramp=ramps.find(s=>s.owner===r.id),base=ramp?.points[0];terminals.push({id:r.door.id,owner:r.id,kind:'door',room:r,ramp,at:p,approach:base?[base[0]-.8,base[2]]:[p[0]+out[0]*.8,p[1]+out[1]*.8],y:r.y});
  }
  for(const o of [...circulation.lifts.filter(o=>o.deck===d.number),...circulation.stairs.filter(o=>o.deck===d.number)]){
   const b=bounds(o.polygon),x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2,p=o.kind==='lift'?[x,z-Math.sign(z)*2.6]:o.wing!==undefined?[x-4.2,(d.number===15?wingFlight(circulation.stairs.find(s=>s.wing===o.wing&&s.side===o.side&&s.deck===14),circulation.stairs).z:wingFlight(o,circulation.stairs).outer)]:[b.x0-1,z];terminals.push({id:'d'+d.number+'-'+o.id+'-landing',kind:o.kind,at:p,approach:p,y:d.y});
  }
  const used=new Set(),failed=[];
  for(const t of terminals){const reachableClosest=(p,max)=>{let best=-1,dist=max*max;for(let x=Math.max(X0,Math.floor((p[0]-max)*Q));x<=Math.min(X1,Math.ceil((p[0]+max)*Q));x++)for(let z=Math.max(Z0,Math.floor((p[1]-max)*Q));z<=Math.min(Z1,Math.ceil((p[1]+max)*Q));z++){const j=ix(x,z),dd=(x/Q-p[0])**2+(z/Q-p[1])**2;if(free[j]&&parent[j]!==-2&&dd<dist){const len=Math.sqrt(dd),poly=len>.001?rectangle((x/Q+p[0])/2,(z/Q+p[1])/2,len,1.2,-Math.atan2(z/Q-p[1],x/Q-p[0])):null,box=poly&&bounds(poly),obs=new Set();if(box)for(let xx=Math.floor(box.x0/4);xx<=Math.floor(box.x1/4);xx++)for(let zz=Math.floor(box.z0/4);zz<=Math.floor(box.z1/4);zz++)for(const o of buckets.get(xx+':'+zz)||[])obs.add(o);if(poly&&[...obs].some(o=>overlaps(poly,o.polygon)))continue;dist=dd;best=j;}}return best;};let start=reachableClosest(t.approach,2);
   if(start<0&&t.room&&!t.room.row){const r=t.room;for(let e=0;e<r.polygon.length;e++){const a=r.polygon[e],b=r.polygon[(e+1)%r.polygon.length],p=[(a[0]+b[0])/2,(a[1]+b[1])/2],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<r.door.width+1)continue;let n=[(b[1]-a[1])/l,-(b[0]-a[0])/l];if(n[0]*(p[0]-r.x)+n[1]*(p[1]-r.z)<0)n=n.map(v=>-v);const approach=[p[0]+n[0]*.8,p[1]+n[1]*.8],j=reachableClosest(approach,1.2);if(j<0)continue;r.door.center=[p[0],r.y,p[1]];r.door.outward=n;t.at=p;t.approach=approach;start=j;break;}}
   if(start<0||parent[start]===-2){failed.push(t.id);continue;}
   if(t.room){const p=t.ramp?[t.ramp.points[0][0],t.ramp.points[0][2]]:t.at,b=t.approach,l=Math.hypot(b[0]-p[0],b[1]-p[1]);if(l>.0001)landings.push({id:t.id+'-landing-strip',door:t.id,owner:t.owner,deck:d.number,kind:t.room.row==='outer'||t.room.row==='inner'?'hull-ring doorway':'wall-normal doorway',width:1.1,points:[p,b],polygon:rectangle((p[0]+b[0])/2,(p[1]+b[1])/2,l,1.1,-Math.atan2(b[1]-p[1],b[0]-p[0]))});}
   const route=[];let i=start;while(i>=0&&!used.has(i)){used.add(i);route.push(point(i));i=parent[i];}if(i>=0)route.push(point(i));
   const gridId=i=>'d'+d.number+'-grid-'+i;
   nodes.push({id:t.id,deck:d.number,kind:t.kind,owner:t.owner,position:[t.at[0],t.y,t.at[1]]});edges.push({a:t.id,b:gridId(start),kind:t.ramp?'ramp':'landing',deck:d.number,width:1.2,points:t.ramp?[t.ramp.points[1],t.ramp.points[0],[point(start)[0],d.y,point(start)[1]]]:undefined});
   const grid=point(start),elbows=[[grid[0],t.approach[1]],[t.approach[0],grid[1]]],elbow=elbows.find(p=>clear(p[0],p[1]))??elbows[0],points=[t.approach,...(elbow?[elbow]:[]),grid,...route.slice(1)],simple=[];
   for(let k=0;k<points.length;k++){const p=points[k],a=simple.at(-2),b=simple.at(-1);if(b&&Math.hypot(p[0]-b[0],p[1]-b[1])<1e-7)continue;if(a&&(Math.abs(b[0]-a[0])<1e-10&&Math.abs(p[0]-b[0])<1e-10||Math.abs(b[1]-a[1])<1e-10&&Math.abs(p[1]-b[1])<1e-10))simple.pop();simple.push(p);}
   if(simple.length>1)corridors.push({id:t.id+'-approach',deck:d.number,kind:'architectural-route',width:1.2,points:simple,owner:t.owner});
   if(t.owner){if(t.room?.row==='gallery'){t.room.door.node=t.id;t.room.door.corridor=t.id+'-approach';continue;}const r=rooms.find(r=>r.id===t.owner)??cabins.find(c=>c.id===t.owner);r.door.node=t.id;r.door.corridor=t.id+'-approach';}
  }
  for(const i of used){const p=point(i);nodes.push({id:'d'+d.number+'-grid-'+i,deck:d.number,kind:'corridor',position:[p[0],d.y,p[1]]});if(parent[i]>=0)edges.push({a:'d'+d.number+'-grid-'+i,b:'d'+d.number+'-grid-'+parent[i],deck:d.number,kind:'corridor',width:1.2});}
  if(failed.length)issues.push({kind:'circulation-unreachable',deck:d.number,count:failed.length,ids:failed});
  d.navigation={grid:.5,clearBranchWidth:1.2,reached:terminals.length-failed.length,terminals:terminals.length,visitedCells:tail};
  for(const o of solids)delete o._navBounds;
 }
 // The cafe closes the ring at the nose; retain only clear sections of its 2.6 m approach.
 const planned=[];for(const c of circulation.corridors){if(c.kind!=='ring'){planned.push(c);continue;}const obstacles=[...rooms.filter(r=>r.deck===c.deck&&!r.aggregate),...circulation.stairs.filter(r=>r.deck===c.deck)];let part=[];
 for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]),poly=rectangle((a[0]+b[0])/2,(a[1]+b[1])/2,l,c.width,-Math.atan2(b[1]-a[1],b[0]-a[0]));if(obstacles.some(o=>overlaps(poly,o.polygon))){if(part.length>1)planned.push({...c,id:c.id+'-'+planned.length,points:part});part=[];}else{if(!part.length)part.push(a);part.push(b);}}
 if(part.length>1)planned.push({...c,id:c.id+'-'+planned.length,points:part});}
 circulation.corridors=planned;
 const shafts=new Map();for(const n of nodes.filter(n=>n.kind==='lift'||n.kind==='stairs')){const key=n.id.replace(/^d\d+-/,'').replace(/^d\d+-/,'').replace(/-landing$/,'');(shafts.get(key)??shafts.set(key,[]).get(key)).push(n);}for(const group of shafts.values()){group.sort((a,b)=>a.deck-b.deck);for(let i=1;i<group.length;i++)if(group[i].deck===group[i-1].deck+1)edges.push({a:group[i-1].id,b:group[i].id,kind:group[i].kind==='lift'?'lift travel':'stair travel',vertical:true});}
 circulation.nodes=nodes;circulation.edges=edges;circulation.doorLandings=landings;circulation.corridors.push(...corridors);
 circulation.regions=[];
 for(const c of circulation.corridors){c.regions=[];for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1e-7)continue;const id=c.id+'-region-'+i,kind=c.kind==='ring'?'hull ring':Math.abs(b[0]-a[0])<1e-7?'cross corridor':c.deck<=5&&Math.abs(a[1])<4&&Math.abs(b[1])<4?'centre spine':'longitudinal ring';circulation.regions.push({id,deck:c.deck,kind,polygon:rectangle((a[0]+b[0])/2,(a[1]+b[1])/2,length,c.width,-Math.atan2(b[1]-a[1],b[0]-a[0]))});c.regions.push(id);}}

 for(const d of decks)d.corridors=circulation.corridors.filter(c=>c.deck===d.number);
}
