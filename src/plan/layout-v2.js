import {gardenGalleryDoors} from './gallery-entries-v2.js';
import {escapeSeatPlan} from './shuttle-seats-v2.js';
import {mapCabins} from './cabin-map-v2.js';
import {addStructuralOpenings} from './structure-v2.js';
import {completeProgramme} from './programme-v2.js';
import {connectPlan as connectCirculation} from './navigation-v2.js';
import {DECKS,CABINS,COMMONS} from '../model.js';
import {SHIP_AREAS} from '../areas.js';
import {loungeFacade} from '../lounge.js';
import {NOSE_COMMONS} from '../nose-commons.js';
import {aftOpenings} from '../aft-layout.js';
import {transitOpenings,floorY} from '../transit.js';
import {hullV2} from './hull-v2.js';
import {rectangle,rectPoly,bounds,overlaps,area,pathLength,pathAt} from './geometry-v2.js';

export const PLAN_V2={version:2,option:'C',inset:2.5,cabin:{width:3.18,depth:7.4,height:3.5,pitch:3.3,corridor:2.6},wingXs:[-104,-58,-12,34,80],wingLength:24,bayCandidates:[-111.06,-63.12,-15.18,32.76,80.70]};
export const PLAN_V2_PIN={cabins:5028,berths:10000,perDeck:[534,521,521,515,512,505,484,486,477,473],shuttles:100,seats:10000,windowsByKind:{cabin:2213,public:694,working:362,garden:160}};
const sourceRooms=SHIP_AREAS.filter(a=>a.deck<=5||a.deck>=16);
export const V1_ROOMS=sourceRooms;
function hullPath(h,y,height,start=-150,margin=.5){
 const pts=[];for(let x=start;x<=265;x+=.5){const w=Math.min(h.roomHalf(x,y,height,-1),h.roomHalf(x,y,height,1))-margin;if(w>.8)pts.push([x,w]);else if(pts.length&&x>100)break;}
 const poly=[...pts.map(([x,w])=>[x,-w]),...pts.slice().reverse().map(([x,w])=>[x,w])];
 const normals=poly.map((p,i)=>{const a=poly[Math.max(0,i-2)],b=poly[Math.min(poly.length-1,i+2)],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [-(b[1]-a[1])/l,(b[0]-a[0])/l];});
 const off=d=>poly.map((p,i)=>[p[0]+d*normals[i][0],p[1]+d*normals[i][1]]);
 const half=x=>{const i=Math.max(0,Math.min(pts.length-2,Math.floor((x-start)*2))),a=pts[i],b=pts[i+1];return !a||x<a[0]||x>pts.at(-1)[0]?0:a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);};
 return {poly,normals,off,half,tip:pts.at(-1)?.[0]??150};
}
function floorOutline(h,y){const p=[];for(let x=-298;x<=265;x+=.25){const w=Math.min(h.skin(x,y,-1),h.skin(x,y,1))-2.5;if(w>.01)p.push([x,w]);}return [...p.map(([x,z])=>[x,-z]),...p.reverse()];}
function makeRoom(a,x,z,yaw=0,extra={}){
 const y=a.center?.[1]??floorY(a.deck),width=a.width,depth=a.depth,height=a.height??3.5;
 return {id:a.id,name:a.name,deck:a.deck,kind:a.kind,frame:{origin:[x,y,z],yaw},center:[x,y,z],x,y,z,yaw,width,depth,height,polygon:rectangle(x,z,width,depth,yaw),size:[width,height,depth],v1:a.center?{origin:a.center,width:a.width,depth:a.depth,height:a.height,area:width*depth}:null,reason:'Rigid room translation/rotation preserves contents and clear dimensions.',...extra};
}
const hit=(poly,items)=>items.some(o=>overlaps(poly,o.polygon??rectPoly(o)));
function addDoor(room,at,outward){room.door={id:room.id+'-door',center:[at[0],room.y,at[1]],width:Math.min(4,room.width/3),outward};}
function residential(d,h,H,openings){
 const y=d.y+.3,cabins=[],cores=[],corridors=[],bridges=[],ring=H.off(8.7),ringBuckets=new Map();
 for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<1e-7)continue;const p=rectangle((a[0]+b[0])/2,(a[1]+b[1])/2,l,2.6,-Math.atan2(b[1]-a[1],b[0]-a[0])),box=bounds(p);for(let x=Math.floor(box.x0/5);x<=Math.floor(box.x1/5);x++)for(let z=Math.floor(box.z0/5);z<=Math.floor(box.z1/5);z++){const k=x+':'+z;(ringBuckets.get(k)??ringBuckets.set(k,[]).get(k)).push(p);}}
 const ringHit=p=>{const b=bounds(p),near=new Set();for(let x=Math.floor(b.x0/5);x<=Math.floor(b.x1/5);x++)for(let z=Math.floor(b.z0/5);z<=Math.floor(b.z1/5);z++)for(const q of ringBuckets.get(x+':'+z)||[])near.add(q);return [...near].some(q=>overlaps(p,q));};
 for(const side of [-1,1]){
  const end=H.half(132)-8.7;bridges.push({id:'d'+d.number+'-bridge-'+side,deck:d.number,polygon:rectangle(132,side*(end+9)/2,8.4,end-9),width:8.4,points:[[132,side*9],[132,side*end]]});
 }
 const tower={id:'d'+d.number+'-tower',deck:d.number,polygon:rectangle(134.6,0,24,18)};
 for(const x of PLAN_V2.wingXs)for(const side of [-1,1]){
  const e=H.half(x)-17.4;
  cores.push({id:'d'+d.number+'-wing-stair-'+x+'-'+side,deck:d.number,kind:'stairs',polygon:rectangle(x+5,side*(e+3.2),6.8,6),x:x+5,z:side*(e+3.2),wing:x,side});
  cores.push({id:'d'+d.number+'-housekeeping-'+x+'-'+side,deck:d.number,kind:'housekeeping',polygon:rectangle(x-5,side*(e+3.2),6.8,6),x:x-5,z:side*(e+3.2),wing:x,side});
  corridors.push({id:'d'+d.number+'-wing-'+x+'-'+side,deck:d.number,kind:'wing',width:2.6,points:[[x,side*(e+8.7)],[x,side*(e-24)]]});
  for(const f of [-1,1])for(let v=0;v+3.3<=24+1e-6;v+=3.3){
   const z=side*(e-v-1.65),cx=x+f*5,yaw=f>0?-Math.PI/2:Math.PI/2,poly=rectangle(cx,z,3.18,7.4,yaw);
   cabins.push({deck:d.number,x:cx,y,z,yaw,width:3.18,depth:7.4,height:3.5,row:'wing',view:'atrium',polygon:poly,door:{center:[x+f*1.3,y,z],width:1.2},corridor:'d'+d.number+'-wing-'+x+'-'+side});
  }
 }
 for(const row of ['outer','inner']){
  const dep=row==='outer'?3.55:13.85,doorDepth=row==='outer'?7.4:10,points=H.off(doorDepth),s=pathLength(points),centres=H.off(dep);
  for(let v=1;v+3.3<s.at(-1)-1;v+=3.3){
   const dc=pathAt(points,s,v+1.65),a=pathAt(points,s,v+.2),b=pathAt(points,s,v+3.1),yaw=-Math.atan2(b[1]-a[1],b[0]-a[0]),c=[dc[0]+Math.sin(yaw)*(dep-doorDepth),dc[1]+Math.cos(yaw)*(dep-doorDepth)];
   if(c[0]<-124||c[0]>H.tip-24&&Math.abs(c[1])<18)continue;
   if(row==='inner'&&PLAN_V2.wingXs.some(x=>Math.abs(c[0]-x)<10.3))continue;
   const poly=rectangle(c[0],c[1],3.18,7.4,yaw),door=[c[0]+Math.sin(yaw)*(row==='outer'?3.7:-3.7),c[1]+Math.cos(yaw)*(row==='outer'?3.7:-3.7)];
   if(hit(poly,[...openings,...cores,...bridges,tower])||!h.fits(poly,y,3.5)||hit(poly,cabins)||ringHit(poly))continue;
   cabins.push({deck:d.number,x:c[0],y,z:c[1],yaw,width:3.18,depth:7.4,height:3.5,row,view:row==='outer'?'space':'atrium',polygon:poly,door:{center:[door[0],y,door[1]],width:1.2},corridor:'d'+d.number+'-ring'});
  }
 }
 const zmax=H.half(-125)-17.6;
 for(const side of [-1,1])for(let z=17.7;z+3.3<=zmax;z+=3.3){const cz=side*(z+1.59),poly=rectangle(-129.7,cz,3.18,7.4,Math.PI/2);
  if(!hit(poly,[...openings,...cabins])&&h.fits(poly,y,3.5)&&!ringHit(poly))cabins.push({deck:d.number,x:-129.7,y,z:cz,yaw:Math.PI/2,width:3.18,depth:7.4,height:3.5,row:'cross',view:'atrium',polygon:poly,door:{center:[-133.4,y,cz],width:1.2},corridor:'d'+d.number+'-cross'});
 }
 corridors.push({id:'d'+d.number+'-ring',deck:d.number,kind:'ring',width:2.6,points:H.off(8.7)});
 corridors.push({id:'d'+d.number+'-cross',deck:d.number,kind:'cross-band',width:2.6,points:[[-138,-(H.half(-138)-8.7)],[-138,H.half(-138)-8.7]]});
 return {cabins,cores,corridors,bridges,tower};
}

// A section is conservative over its entire rise; horizontal setback does not invent a vertical setback.
function band(h,x0,x1,inner,y,height,side,sloped=false){
 const xs=[x0];for(let x=x0+.5;x<x1;x+=.5)xs.push(x);xs.push(x1);
 const outside=xs.map(x=>[x,side*Math.max(inner,h.minimum(x-.26,x+.26,y-(sloped?0:2.5),y+height+(sloped?0:2.5),side)-2.52)]);
 return [[x0,side*inner],...outside,[x1,side*inner]];
}
function bowRoom(h,a,rear,anchor,height){
 const envelope=[];for(let rise=0;rise<height-1e-8;rise+=.25){const dep=Math.min(.25,height-rise),p=[];
  for(let x=rear;x<=235;x+=.25){const w=h.minimum(x-.13,x+.13,a.center[1]+rise,a.center[1]+rise+dep)-2.52;if(w>.3)p.push([x,w]);else if(p.length)break;}
  envelope.push({rise,height:dep,polygon:[...p.map(([x,z])=>[x,-z]),...p.slice().reverse()]});
 }
 const r=makeRoom(a,anchor,0,0,{outer:true,side:1,polygon:envelope[0].polygon,envelope,reason:'Original bow anchor and fittings retained; floor and sloped glazing follow the finished hull.'});
 r.glazingAnchor=a.center.slice();return r;
}
function growOuterRooms({h,rooms,shuttles}){
 const old=rooms.filter(r=>!r.aggregate).map(r=>({id:r.id,deck:r.deck,y:r.y,height:r.height,polygon:r.polygon}));
 for(const r of rooms.filter(r=>r.outer&&!r.aggregate&&!r.envelope&&r.kind!=='cafe')){
  const b=bounds(r.polygon),centered=b.z0<0&&b.z1>0,sides=centered?[-1,1]:[r.side],others=[...old.filter(o=>o.id!==r.id&&o.y<r.y+r.height&&o.y+o.height>r.y),...shuttles.filter(o=>o.deck===r.deck).flatMap(o=>[o,{polygon:o.launch.polygon}])],xs=[b.x0,b.x1];
  for(let x=b.x0+.5;x<b.x1;x+=.5)xs.push(x);
  for(const o of others){const q=bounds(o.polygon);for(const x of [q.x0-.15,q.x0,q.x1,q.x1+.15])if(x>b.x0&&x<b.x1)xs.push(x);}xs.sort((a,b)=>a-b);
  let contacts=0;
  const section=(rise,height)=>{const walls=[];
   for(const side of sides){const inner=centered?0:side<0?-b.z1:b.z0,outer=side<0?-b.z0:b.z1,wall=[];
    for(const x of xs){const hull=h.minimum(x-.26,x+.26,r.y+rise,r.y+rise+height,side)-2.52;let edge=hull;
     for(const o of others){const q=bounds(o.polygon);if(x<q.x0-.12||x>q.x1+.12)continue;const near=side<0?-q.z1:q.z0,far=side<0?-q.z0:q.z1;if(far>outer+.05&&near>inner+.05)edge=Math.min(edge,Math.max(outer,near-2.6));}
     if(centered&&side===-1&&others.some(o=>{const q=bounds(o.polygon);return q.x1>b.x0&&q.x0<b.x1&&q.z1<b.z0;}))edge=outer;
     edge=Math.max(outer,edge);if(rise===0&&Math.abs(edge-hull)<.01)contacts++;wall.push([x,side*edge]);
    }walls.push(wall);
   }
   const inner=r.side<0?b.z1:b.z0;return centered?[...walls[0],...walls[1].slice().reverse()]:[[b.x0,inner],...walls[0],[b.x1,inner]];
  };
  r.envelope=[];for(let rise=0;rise<r.height-1e-7;rise+=.5){const height=Math.min(.5,r.height-rise);r.envelope.push({rise,height,polygon:section(rise,height)});}r.polygon=r.envelope[0].polygon;
  r.hullGrowth={contacts,sourcePolygon:old.find(o=>o.id===r.id).polygon};r.reason+=' Window-side floor and sloped facade grow to the hull between launch bays; entry-side fittings retain their frame.';
 }
}
function gardenPieces(r,h){
 const s=r.side,{x0,x1}=r.shape,x=(x0+x1)/2,inner=24;
 r.components={galleries:[],stairs:[],pieces:[]};
 // Galleries retain their 4 m clear depth; perimeter lengths follow the longer room.
 for(const rise of [4,8]){
  const outer=Math.min(...[x0+2,x,x1-2].map(q=>h.sectionHalf(q,r.y+rise,2.3,s)))-.5;
  for(const [name,cx,z,w,dep]of [['front',x,inner+2,x1-x0-4,4],['rear',x,outer-2,x1-x0-4,4],['end',x0+2,(inner+outer)/2,4,outer-inner-8]])r.components.galleries.push({id:r.id+'-'+name+'-'+rise,center:[cx,r.y+rise,s*z],size:[w,.28,dep],polygon:rectangle(cx,s*z,w,dep)});
  const rear=r.components.galleries.at(-2),xs=[];for(let q=x0+2;q<=x1-2;q+=.5)xs.push(q);const edge=xs.map(q=>[q,h.minimum(q-.26,q+.26,r.y+rise,r.y+rise+2.3,s)-2.7]);rear.polygon=[...edge.map(([q,z])=>[q,s*(z-4)]),...edge.slice().reverse().map(([q,z])=>[q,s*z])];rear.reason='Four-metre gallery follows the sloped hull rather than the narrowest end of the room.';rear.center[2]=s*(edge[Math.floor(edge.length/2)][1]-2);const end=r.components.galleries.at(-1),dep=edge[0][1]-inner-8+.25;end.center[2]=s*(inner+edge[0][1]+.25)/2;end.size[2]=dep;end.polygon=rectangle(x0+2,end.center[2],4,dep);
 }
 // The two flights keep all treads, their rise and run, and move to the inboard end.
 for(let level=0;level<2;level++)for(let i=0;i<24;i++){const cx=x1-4-level*3.3,z=inner+23+(level===0?i*.3:6.9-i*.3),rise=level*4+(i+1)/6;r.components.stairs.push({id:r.id+'-tread-'+level+'-'+i,center:[cx,r.y+rise,s*z],size:[3,(i+1)/6,.3]});}
 const defs=r.neighborhood===1?[
 ['geodesic hammock dome',2,12,15,15,9],['Haze Maze tower',-15,11,6.5,14,10.9],['Terpene Tasting Deck',-10,24,9.2,4,3.5],['munchies converger',16,11,6,6,11.2],['arcade row with Paws Off treadmill',23,12,3.4,18,2.5],['hammocks',2,12,12,12,3],['jaguar gate',0,2.8,8.8,5.5,4],['glossy floor',0,18,49,30,.05],['shared kitchen and reading services',8,27,18,6,3]
 ]:[['planting and trees',0,17,20,15,8],['cafe and shared services',10,7,16,8,3],['benches and hammocks',-12,8,15,6,3],...(r.neighborhood===10?[['blossom garden assembly',9,22,9,9,8]]:[])];
 for(const [name,dx,dz,w,dep,height]of defs){let z=inner+dz;const cx=x+dx,cap=h.minimum(cx-w/2,cx+w/2,r.y,r.y+height,s)-2.7;z=Math.min(z,cap-dep/2);z=Math.max(inner+dep/2+.2,z);r.components.pieces.push({id:r.id+'-'+name.replaceAll(' ','-'),name,center:[cx,r.y,s*z],size:[w,height,dep],polygon:rectangle(cx,s*z,w,dep),movement:'Translation within reshaped garden; dimensions and internal geometry retained.'});}
 if(r.neighborhood===10){const p=r.components.pieces.find(p=>p.name==='blossom garden assembly');p.source='src/walk/blossom.js';p.children=[{name:'koi pond',local:[-2.85,0,2.85],size:[3.3,.3,3.3]},{name:'waterfall',local:[-1.6,0,1.72],size:[1.2,1.32,1.2]},{name:'red bridge',local:[-2.75,0,3],size:[3.6,1.5,1.2]},{name:'blossom bench',local:[.15,0,2.8],size:[.7,1,2]},{name:'bonsai cherry, stone bed, flowers, petals and butterflies',local:[0,0,0],size:[9,8,9]}];}
 if(r.neighborhood===1){const maze=r.components.pieces.find(p=>p.name==='Haze Maze tower'),rear=r.components.galleries.find(g=>g.id.includes('-rear-8'));const q=rear.polygon.filter(p=>Math.abs(p[0]-maze.center[0])<1),to=q.length?q.reduce((a,p)=>a+Math.abs(p[1]),0)/q.length:44;r.components.mazeTubes=[{id:r.id+'-maze-front-tube',rise:4,x:maze.center[0]+2.15,from:s*28,to:s*26,radius:1.35},{id:r.id+'-maze-rear-tube',rise:8,x:maze.center[0]+.75,from:s*42,to:s*to,radius:1.35}];}
 r.components.links=[4,8].map((rise,i)=>({id:r.id+'-gallery-link-'+rise,center:[x1-4-i*3.3,r.y+rise,s*(inner+(i===0?16:13))],size:[3.2,.28,i===0?29:23],polygon:rectangle(x1-4-i*3.3,s*(inner+(i===0?16:13)),3.2,i===0?29:23)}));
 r.components.landings=[{id:r.id+'-stair-turn',center:[x1-5.65,r.y+4,s*(inner+29.9)],size:[6.5,.28,2],polygon:rectangle(x1-5.65,s*(inner+29.9),6.5,2)}];
 r.galleryDoors=gardenGalleryDoors(r,x0,s);
 r.contentContract={source:'src/model.js:createGardenCommons; src/garden-finish.js',canonicalFrame:[132,24.3,27],scale:[1,1,1],retain:'All source fittings, shared kitchen, laundry, reading nook, lighting, rails and gallery services remain in the assembly.',exceptions:[],pieceMoves:r.components.pieces.map(p=>({name:p.name,center:p.center,scale:[1,1,1]}))};
 if(r.neighborhood===1)r.contentContract.source+='; src/hydro-nip-lounge.js:createHydroNipLounge; src/walk/arcade.js; src/walk/jaguar-gate.js';if(r.neighborhood===10)r.contentContract.source+='; src/walk/blossom.js:createBlossomGarden';
 r.movedPieces=r.components.pieces.map(p=>p.name).concat(['front/rear/end galleries on both levels','two broad stair flights and gallery links']);
}

export function buildLayoutV2(){
 const h=hullV2(),decks=[],cabins=[],rooms=[],shuttles=[],windows=[],circulation={corridors:[],stairs:[],bridges:[],towers:[],lifts:[],ramps:[],nodes:[],edges:[]},issues=[];
 for(const d of DECKS){
  const y=floorY(d.number),H=hullPath(h,y,3.5),openings=transitOpenings(d.number).map(o=>({...o,deck:d.number,kind:o.id.includes('stairs')?'stairs':'lift',polygon:rectPoly(o)}));
  if(d.number>=4&&d.number<=17)openings.push({id:'aft-service',deck:d.number,kind:'lift',polygon:rectangle(-156,8,4,4)});
  if(d.number>4&&d.number<=17)openings.push({id:'aft-service-stair',deck:d.number,kind:'stairs',polygon:rectangle(-166,-10,7,5)});
  if(d.number===1)openings.push(...transitOpenings(2).filter(o=>o.id.includes('stairs')).map(o=>({...o,deck:1,kind:'stairs',ground:true,polygon:rectPoly(o)})));
  const deck={number:d.number,name:d.name,y,roomLine:{height:3.5,outline:floorOutline(h,y),policy:'Deck-level section; room envelopes check the sloped line over their full height.'},slab:{outline:floorOutline(h,y),holes:[...openings.filter(o=>!o.ground).map(o=>({id:o.id,polygon:o.polygon})),...aftOpenings(d.number).map((r,i)=>({id:'aft-opening-'+i,polygon:rectPoly(r)}))]},openings,corridors:[],atrium:null};
  for(const o of openings)(o.kind==='lift'?circulation.lifts:circulation.stairs).push(o);
  if(d.number>=6&&d.number<=15){const r=residential(d,h,H,openings);cabins.push(...r.cabins);circulation.stairs.push(...r.cores.filter(c=>c.kind==='stairs'));circulation.corridors.push(...r.corridors);circulation.bridges.push(...r.bridges);circulation.towers.push(r.tower);deck.corridors.push(...r.corridors);deck.slab.holes.push(...r.cores.filter(c=>c.kind==='stairs').map(c=>({id:c.id,polygon:c.polygon})));
   for(const core of r.cores.filter(c=>c.kind==='housekeeping')){const b=bounds(core.polygon),a={id:core.id,name:'Wing housekeeping',deck:d.number,width:b.x1-b.x0,depth:b.z1-b.z0,height:3.5};const room=makeRoom(a,core.x,core.z,0,{outer:false,reason:'Housekeeping core at each wing root.'});addDoor(room,[b.x1,core.z],[1,0]);rooms.push(room);}
  }
  decks.push(deck);
 }
 for(const r of rooms)r.area=area(r.polygon);
 // These routines also produce failure records; unplaced programme is never silently dropped.
 placeRooms({h,decks,rooms,shuttles,circulation,issues});
 growOuterRooms({h,rooms,shuttles});
 finishAtrium({h,decks,rooms,cabins,circulation,issues});
 for(const r of rooms.filter(r=>!r.aggregate)){
  r.area=area(r.polygon);
  if(r.height>4)for(const d of decks.filter(d=>d.y>r.y+.1&&d.y<r.y+r.height))if(!d.slab.holes.some(p=>p.assembly===r.assembly&&r.assembly))d.slab.holes.push({id:r.id+'-upper-void',assembly:r.assembly,polygon:r.envelope?.find(s=>d.y-r.y>=s.rise-1e-7&&d.y-r.y<s.rise+s.height)?.polygon??r.polygon});
  if(r.kind==='garden')gardenPieces(r,h);
 }
 allocateBerths(cabins,rooms,issues);
 const cabinIdMap=mapCabins(CABINS,cabins);
 const observation=rooms.find(r=>r.id==='observation-lounge');if(observation){const b=bounds(observation.polygon);observation.fittingFrame={origin:[observation.door.center[0],observation.y,0],yaw:0,bounds:[[-24,-2.31,b.z0],[b.x1-observation.door.center[0],observation.height,b.z1]],reason:'The plan centre stays at X190; the immutable Phase 0 authoring frame is the entry at X170.'};const top=observation.door.center,base=[top[0]-24,floorY(17),top[2]];circulation.ramps.push({id:'observation-lounge-ramp',deck:17,owner:observation.id,width:4,rise:2,run:24,points:[base,top],polygon:rectangle((base[0]+top[0])/2,0,24,4)});}
 // Runtime integration: the last part of the 1:12 ramp rises into Deck 18's headroom.
 // Its floor opening is part of the same plan as the ramp, before programme coverage.
 addStructuralOpenings({decks,circulation,rooms});
 scheduleWindows({h,decks,rooms,cabins,windows,issues});
 const lounge=rooms.find(r=>r.id==='commons-1');lounge.door.center[0]=lounge.x+5.25;lounge.door.label='Jaguar throat';circulation.balconies=[{id:'hydro-nip-promenade-balcony',owner:'commons-1',deck:17,polygon:rectangle(lounge.x,-18.5,53,3),width:3,reason:'Jay round 3: guarded garden-edge approach to the unchanged aquarium and jaguar throat; no centre crossing.'}];
 /* Main's automatic freight airlock is on the forward bulkhead. Keep the aft planned access and reserve its full existing six-metre opening in the rebuilt shell too. */
 const freight=rooms.find(r=>r.id==='d01-spares-aft');freight.fittingDoor={id:'aft-freight-airlock',center:[freight.x+freight.width/2,freight.y,freight.z],width:6,height:2.5,reason:'Main eb079b7 automatic freight airlock; leaves and movers stay unchanged.'};
 connectCirculation({h,decks,rooms,cabins,shuttles,circulation,issues});
 for(const c of circulation.corridors.filter(c=>c.deck===20))Object.assign(c,{access:'crew',label:'Crew service circulation'});for(const b of circulation.bridges.filter(b=>b.deck===20))Object.assign(b,{access:'crew',name:'Crew service gallery'});
 completeProgramme({decks,rooms,cabins,shuttles,circulation});
 const summary={allocation:{slots:cabins.length,twins:cabins.filter(c=>c.type==='twin').length,singles:cabins.filter(c=>c.type==='single').length,unused:0},areaExceptions:rooms.filter(r=>r.areaException).map(r=>({id:r.id,reason:r.areaException})),perDeck:decks.map(d=>({deck:d.number,cabins:cabins.filter(c=>c.deck===d.number).length,twins:cabins.filter(c=>c.deck===d.number&&c.type==='twin').length,singles:cabins.filter(c=>c.deck===d.number&&c.type==='single').length,berths:cabins.filter(c=>c.deck===d.number).reduce((s,c)=>s+c.berths,0),rooms:rooms.filter(r=>r.deck===d.number).length,atriumWidth:d.atrium?.widthMid??0})),cabins:cabins.length,berths:cabins.reduce((s,c)=>s+c.berths,0),shuttles:shuttles.length,seats:shuttles.reduce((s,c)=>s+c.seats.length,0),windows:windows.length,windowsByKind:Object.fromEntries([...new Set(windows.map(w=>w.kind))].map(k=>[k,windows.filter(w=>w.kind===k).length])),issues};
 const assemblies=[{id:'arrival-garden',frame:rooms.find(r=>r.id==='d02-arrival-1').frame,members:['d02-arrival-1','d03-farm-1'],opening:{localCenter:[-4,4,0],halfAxes:[10.1,4.7],deck:3}},...rooms.filter(r=>r.kind==='garden').map(r=>({id:r.assembly,neighborhood:r.neighborhood,frame:{...r.frame,mirror:r.mirror},members:[r.id],components:r.components}))];
 const fixedRooms=SHIP_AREAS.filter(a=>!rooms.some(r=>r.id===a.id)).map(a=>makeRoom(a,a.center[0],a.center[2],0,{fixed:true,reason:'Retained aft engineering/support room; selected v2 frame is unchanged.'}));
 return {cabinIdMap,fixedRooms,version:2,option:'C',units:'metres',coordinates:'X forward; Y up; Z starboard; yaw is Three.js rotation.y',hull:h.provenance,decks,cabins,rooms,assemblies,shuttles,windows,circulation,summary};
}

// Rooms whose door moves along its wall from the middle (m, world x). Container hold A's maze (src/walk/maze) fills the
// hold from 9.8 m inside its aft end, so the door opens onto that open aft strip rather than into the maze.
const DOOR_ALONG={'d01-cargo-1':-21};

const NEW_PROGRAM={
 1:['Dockside crew mess','Rover & suit workshop','Quartermaster & supply office','Crew lounge','Container hold C','Spare-parts racks','Cold stores B'],
 2:['Arrival food hall','Welcome desk & lockers','Airlock stores','Shuttle crew ready room','Baggage handling','Emergency stores','Shuttle spares'],
 3:['Farm-to-table restaurant','Bakery & pastry kitchen','Nutrient & water room','Harvest cold room','Galley prep','Leaf-crop racks'],
 4:['Engineers’ canteen','Thermal control room','Power distribution control','Systems stores','Spare air & gas','Crew rest lounge'],
 5:['Recovery garden & café','Maternity & family care','Dental & eye care','Wellness & spa','Clinic treatment rooms','Medical stores','Staff rest','Sterile services'],
 16:['Quiet study & co-working','Atrium food court']
};
const INNER=/cargo|stores|cold|surgery|pharmacy|imaging|shelter|baggage|^air$|^water$|^thermal$|^recycle$|^power$/;
function placeRooms({h,decks,rooms,shuttles,circulation,issues}){
 const blocked=d=>[...decks[d-1].openings,...rooms.filter(r=>!r.aggregate&&r.y<floorY(d)+3.5&&r.y+r.height>floorY(d)+.1),...shuttles.filter(s=>s.deck===d),...circulation.bridges.filter(b=>b.deck===d),...circulation.towers.filter(b=>b.deck===d)];
 const outerAt=(a,x,side,yaw)=>{
  const width=Math.abs(Math.cos(yaw))*a.width+Math.abs(Math.sin(yaw))*a.depth,depth=Math.abs(Math.sin(yaw))*a.width+Math.abs(Math.cos(yaw))*a.depth,y=a.center?.[1]??floorY(a.deck);
  let edge=Infinity;for(let xx=x-width/2;xx<=x+width/2+.1;xx+=Math.min(2,width))edge=Math.min(edge,h.roomHalf(xx,y,a.height??3.5,side));edge=Math.min(edge,h.roomHalf(x+width/2,y,a.height??3.5,side));
  return makeRoom(a,x,side*(edge-depth/2-.15),yaw,{outer:true,side});
 };
 // Arrival and its opening move by one common matrix, including the garden above.
 const hall=sourceRooms.find(a=>a.id==='d02-arrival-1'),garden=sourceRooms.find(a=>a.id==='d03-farm-1');
 const edge=h.minimum(-141,-89,floorY(2)-2.5,floorY(3)+3.5+2.5,-1)-2.5,z=-(edge-17-.15);
 for(const a of [hall,garden]){const r=makeRoom(a,-115,z,0,{outer:true,side:-1,assembly:'arrival-garden',reason:'Shared rigid translation preserves arrival tree, oval opening, bridge and balustrade.'});addDoor(r,[-141,z],[-1,0]);rooms.push(r);}
 decks[2].slab.holes.push({id:'arrival-garden-opening',assembly:'arrival-garden',polygon:rectangle(-119,z,20.2,9.4)});
 for(let deck=1;deck<=5;deck++)for(const side of [-1,1])for(let bay=0;bay<5;bay++){
  const original=PLAN_V2.bayCandidates[bay],preferred=[-166,-78,-20,38,96][bay],candidates=[preferred,original,...Array.from({length:46},(_,i)=>-216+i*10)].sort((a,b)=>a===preferred?-1:b===preferred?1:Math.abs(a-preferred)-Math.abs(b-preferred));let chosen=null;
  for(const bx of candidates){const craft=[];
   for(const dx of [-5,5]){const x=bx+dx,y=floorY(deck),w=h.minimum(x-4,x+4,y-2.5,y+3.2+2.5,side)-2.5-.15,z=side*(w-11),yaw=-side*Math.PI/2,polygon=rectangle(x,z,22,8,yaw);craft.push({x,y,z,yaw,polygon});}
   if(craft.some(c=>Math.abs(c.z)<14||hit(c.polygon,blocked(deck))||!h.fits(c.polygon,c.y,3.2))||overlaps(craft[0].polygon,craft[1].polygon))continue;chosen={bx,craft};break;
  }
  if(!chosen){issues.push({kind:'shuttle-packing',deck,side,bay});continue;}
  for(let k=0;k<2;k++){
   const c=chosen.craft[k],id='d'+deck+'-escape-'+(side<0?'p':'s')+'-'+(bay*2+k+1),bayId='d'+deck+'-bay-'+side+'-'+bay;
   const seats=escapeSeatPlan(c,id);
   const door={id:id+'-hull-door',deck,craft:id,width:8.8,height:3.4,center:[c.x,c.y+1.7,side*h.skin(c.x,c.y+1.7,side)],side,corners:[[-4.4,0],[4.4,0],[4.4,3.4],[-4.4,3.4]].map(([dx,dy])=>[c.x+dx,c.y+dy,side*h.skin(c.x+dx,c.y+dy,side)])};
   shuttles.push({id,roomId:'d0'+deck+'-lifeboats-10',deck,bay:bayId,bayCenter:chosen.bx,originalBayCenter:original,movedReason:chosen.bx===original?null:'Packing clears rigid arrival assembly and neighbouring craft/shafts.',...c,center:[c.x,c.y,c.z],length:22,beam:8,height:3.2,seats,door,launch:{direction:[0,0,side],width:8.8,polygon:rectangle(c.x,side*(Math.abs(c.z)+11+h.skin(c.x,c.y,side))/2,8.8,Math.max(1,h.skin(c.x,c.y,side)-Math.abs(c.z)-11))}});
  }
 }
 function place(a,{outer=true,preferX=a.center?.[0]??0,preferSide=Math.sign(a.center?.[2]??1)||1,rigidX=false}={}){
  const obstacles=blocked(a.deck),ys=outer?[0,Math.PI/2]:[0],xs=rigidX?[preferX]:[preferX,...Array.from({length:231},(_,i)=>-240+i*2)].sort((a,b)=>Math.abs(a-preferX)-Math.abs(b-preferX));
  let found=null;
  for(const side of [preferSide,-preferSide]){for(const yaw of ys){for(const x of xs){
   const candidates=outer?[outerAt(a,x,side,yaw)]:[4+a.depth/2,8+a.depth/2,12+a.depth/2].map(z=>makeRoom(a,x,side*z,yaw,{outer:false,side}));
   for(const r of candidates){if(!Number.isFinite(r.z)||outer&&Math.abs(r.z)<(Math.abs(Math.sin(yaw))*a.width+Math.abs(Math.cos(yaw))*a.depth)/2+4||obstacles.some(o=>overlaps(r.polygon,o.polygon,1.8)))continue;
    if(!h.fits(r.polygon,r.y,r.height))continue;found=r;break;
   }if(found)break;
  }if(found)break;}if(found)break;}
  if(!found){found=makeRoom(a,preferX,a.center?.[2]??0,0,{outer,side:preferSide,status:'unfitted',reason:'No collision-free full-height rigid fit found in the deterministic search.'});issues.push({kind:'room-unfitted',id:a.id,deck:a.deck,width:a.width,depth:a.depth,height:a.height});}
  const b=bounds(found.polygon),along=DOOR_ALONG[a.id]??0;if(along&&found.yaw!==0)throw new Error(a.id+': DOOR_ALONG assumes the room lies along x');addDoor(found,[found.x+along,found.side<0?b.z1:b.z0],[0,-found.side]);rooms.push(found);return found;
 }
 // Fixed-size bow and aft fitted rooms precede the flexible band packing.
 for(const a of sourceRooms.filter(a=>a.deck<=5&&!a.id.includes('lifeboats')&&!rooms.some(r=>r.id===a.id)).sort((a,b)=>Number(/bow|hangar|aft/.test(b.id))-Number(/bow|hangar|aft/.test(a.id))||Number(INNER.test(a.kind))-Number(INNER.test(b.kind)))){
  if(/bow|hangar|aft/.test(a.id)){
   const r=makeRoom(a,...[a.center[0],a.center[2]],0,{outer:!INNER.test(a.kind),side:Math.sign(a.center[2])||1});
   if(h.fits(r.polygon,r.y,r.height)&&!hit(r.polygon,blocked(a.deck))){addDoor(r,[r.x-r.width/2,r.z],[-1,0]);rooms.push(r);continue;}
  }
  place(a,{outer:!INNER.test(a.kind)});
 }
 for(const a of sourceRooms.filter(a=>a.deck>=16).sort((a,b)=>Number(b.center[2]===0)-Number(a.center[2]===0))){
  if(a.commandAft){
   const side=Math.sign(a.center[2]),r=makeRoom(a,-80,side*34,0,{outer:true,side,reason:'Entry-side fitting frame slides outward; sloping hull glazing preserves a broad command-deck atrium.'});
   r.envelope=Array.from({length:7},(_,i)=>({rise:i*.5,height:.5,polygon:band(h,-106,-54,24,r.y+i*.5,.5,side,true)}));r.polygon=r.envelope[0].polygon;r.fittingEnvelope={polygon:rectangle(-80,side*34,52,20),height:2,reason:'Planning table, sleeping pods, seating and counters retain their clear 52 × 20 m fitting frame.'};addDoor(r,[-80,side*24],[0,-side]);rooms.push(r);continue;
  }
  if(a.id==='d20-bridge-9'){
   const r=bowRoom(h,a,150,177,9);for(const section of r.envelope)section.polygon=[[156,-9.2],[150,-9.2],...section.polygon,[150,9.2],[156,9.2]];r.polygon=r.envelope[0].polygon;r.reason+=' Side alcoves extend 6 m aft of the existing entry to preserve the descriptor floor area.';r.fittingReservations=[];
   for(const x of [160,165,170])for(const z of [-24,24])r.fittingReservations.push({kind:'console and chair',source:[x,r.y,z],center:[x,r.y,z],width:2.8,depth:3.2,height:2});
   for(const [x,z,w,dep]of [[186,-7,3.2,2.8],[186,7,3.2,2.8],[179,-14,3.2,2.8],[179,14,3.2,2.8],[170,0,6,7],[182.4,0,2.6,2.6]])r.fittingReservations.push({kind:'command fitting',source:[x,r.y,z],center:[x,r.y,z],width:w,depth:dep,height:2});
   addDoor(r,[156,0],[-1,0]);rooms.push(r);continue;
  }
  if(a.center[2]===0){
   let found=null;for(const x of [a.center[0],...Array.from({length:40},(_,i)=>a.center[0]-i)]){if(x-a.width/2<147)continue;const r=makeRoom(a,x,0,0,{outer:true,side:1,reason:'Rigid forward room retained between tower and bow.'});if(!hit(r.polygon,blocked(a.deck))&&h.fits(r.polygon,r.y,r.height)){found=r;break;}}
   if(found){addDoor(found,[found.x-found.width/2,0],[-1,0]);rooms.push(found);continue;}
  }place(a,{outer:true});
 }

 // Reshape along the ship; the inboard face and fittings do not follow the sloping skin.
 for(const c of COMMONS){
  const i=Math.floor((c.neighborhood-1)/2),x0=-141+i*55,x1=x0+53,side=Math.sign(c.z),x=(x0+x1)/2,a={id:'commons-'+c.neighborhood,name:'Neighborhood '+c.neighborhood+' sky garden',deck:17,kind:'garden',center:[c.x,c.y,c.z],width:53,depth:38,height:11.2};
  const r=makeRoom(a,x,side*43,0,{outer:true,side,neighborhood:c.neighborhood,mirror:side<0,assembly:'garden-'+c.neighborhood,reason:'Longer garden with a 24 m inboard face and sloped hull glazing; contents are scheduled individually.'});
  r.v1.width=45;r.v1.area=1710;r.envelope=Array.from({length:23},(_,i)=>{const rise=i*.5,height=Math.min(.5,11.2-rise);return {rise,height,polygon:band(h,x0,x1,24,r.y+rise,height,side,true)};});r.polygon=r.envelope[0].polygon;r.frame.mirror=r.mirror;r.area=area(r.polygon);r.shape={x0,x1,inboard:24,hull:'section room line',setback:2.5};
  addDoor(r,[x,side*24],[0,-side]);rooms.push(r);
  for(const deck of [18,19])decks[deck-1].slab.holes.push({id:r.id+'-assembly-opening',assembly:r.assembly,polygon:r.envelope.find(s=>s.rise===4*(deck-17)).polygon});
 }
 const loungeEdge=Array.from({length:73},(_,i)=>loungeFacade(31,-.81+1.62*i/72,1.4)),oldOutline=[[170,loungeEdge[0][2]],...loungeEdge.map(p=>[p[0],p[2]]),[170,loungeEdge.at(-1)[2]]],bb=bounds(oldOutline),lounge={id:'observation-lounge',name:'Forward observation lounge',deck:17,kind:'lounge',center:[190,26.3,0],width:bb.x1-bb.x0,depth:bb.z1-bb.z0,height:7.5};
 const lr=bowRoom(h,lounge,170,190,7.5);lr.v1.area=area(oldOutline);addDoor(lr,[170,0],[-1,0]);rooms.push(lr);
 for(const [d,names]of Object.entries(NEW_PROGRAM))for(let i=0;i<names.length;i++){
  const name=names[i],outer=!/stores|racks|hold|prep|services|handling|spares|gas|rooms$/.test(name),a={id:'d'+String(d).padStart(2,'0')+'-new-'+(i+1),name,deck:+d,kind:'new',width:outer?20:18,depth:outer?16:14,height:3.5};
  place(a,{outer,preferX:-120+i*40,preferSide:i%2?-1:1});
 }
 // The old whole-deck bank is an aggregate, not a room that can overlap all its children.
 for(let d=1;d<=5;d++){
  const a=sourceRooms.find(a=>a.id==='d0'+d+'-lifeboats-10'),children=shuttles.filter(s=>s.deck===d);
  rooms.push({...makeRoom(a,0,0),aggregate:true,children:children.map(c=>c.id),polygon:[],reason:'Whole-deck lifeboat descriptor replaced by twenty individually packed escape craft; its bounding rectangle is not floor area.',areaException:'The v1 bank was an overlapping whole-deck descriptor, not an enclosed room.'});
 }
 // Neighbourhood dining and household services stay behind the cross row.
 for(let d=6;d<=15;d++){
  const y=floorY(d),H=hullPath(h,y,3.5),edge=H.half(-149)-18;
  for(const side of [-1,1]){const a={id:'neighborhood-'+(d-5)+(side<0?'-dining':'-cafe'),name:side<0?'Neighborhood dining terrace':'Neighborhood café & bar',deck:d,kind:'dining',width:9,depth:edge-18,height:3.5};const r=makeRoom(a,-145,side*(edge+18)/2,0,{outer:false,view:'atrium',neighborhood:d-5});addDoor(r,[-140.5,r.z],[1,0]);rooms.push(r);}
  for(const [name,z]of [['Laundry',-6],['Linen',0],['Parcels',6]]){const a={id:'neighborhood-'+(d-5)+'-'+name.toLowerCase(),name,deck:d,kind:'service',width:8,depth:4,height:3.5},r=makeRoom(a,-145,z,0,{outer:false,neighborhood:d-5});addDoor(r,[-141,z],[1,0]);rooms.push(r);}
 }
 // A small nose cafe replaces the former residential nose commons programme.
 for(const a of NOSE_COMMONS){
  const H=hullPath(h,floorY(a.deck),3.5),x=H.tip-12,room={id:'nose-commons-'+String(a.number).padStart(2,'0'),name:a.name+' · bow café',deck:a.deck,kind:'cafe',width:16,depth:12,height:3.5,center:[x,floorY(a.deck),0]};
  const r=makeRoom(room,x,0,0,{outer:true,side:1,replaces:'Nose_commons_'+String(a.number).padStart(2,'0'),reason:'Option C replaces the nose commons with a small bow cafe; former fittings require Phase 4 curation.'});
  if(!h.fits(r.polygon,r.y,r.height)){r.status='unfitted';issues.push({kind:'bow-cafe-unfitted',id:r.id});}addDoor(r,[x-8,0],[-1,0]);rooms.push(r);
 }
}
function allocateBerths(cabins,rooms,issues){
 cabins.sort((a,b)=>a.deck-b.deck||a.x-b.x||a.z-b.z||a.row.localeCompare(b.row));
 const n=cabins.length;let twins=Math.min(n,Math.max(0,10000-n));
 if(n<5000||n>10000)issues.push({kind:'berth-capacity',slots:n,maximum:2*n,required:10000});
 const used=new Set(),extra=[];
 for(let d=6;d<=15;d++){let k=0;for(const c of cabins.filter(c=>c.deck===d)){c.neighborhood=d-5;const id='N'+String(d-5).padStart(2,'0')+'-'+String(++k).padStart(3,'0');if(k<=500){c.id=id;c.legacyId=id;used.add(id);}else extra.push(c);}}
 const remaining=CABINS.filter(c=>!used.has(c.id));
 for(const c of extra){const old=remaining.shift();c.id=old?.id??'v2-d'+c.deck+'-'+extra.indexOf(c);c.legacyId=old?.id??null;}
 for(const c of cabins){c.center=[c.x,c.y,c.z];c.type=twins-->0?'twin':'single';c.berths=c.type==='twin'?2:1;c.door.id=c.id+'-door';}
}
function finishAtrium({h,decks,rooms,cabins,circulation,issues}){
 const natural=new Map();
 const cross=(p,x)=>{const out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(x<Math.min(a[0],b[0])-1e-8||x>Math.max(a[0],b[0])+1e-8)continue;if(Math.abs(a[0]-b[0])<1e-8)out.push(a[1],b[1]);else out.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}return out;};
 for(const d of decks.filter(d=>d.number>=6)){
  const occupying=[...circulation.corridors.filter(c=>c.deck===d.number&&c.kind==='wing').map(c=>({polygon:rectangle(c.points[0][0],(c.points[0][1]+c.points[1][1])/2,17.4,Math.abs(c.points[0][1]-c.points[1][1]))})),...cabins.filter(c=>c.deck===d.number),...rooms.filter(r=>!r.aggregate&&r.y<=d.y+.01&&r.y+r.height>d.y)];
  const samples=[];for(let x=-126;x<=260;x+=.5){let edge=d.number<=15?h.roomHalf(x,d.y,3.5)-17.6:x>148?0:d.number===20?14:20;
   for(const r of occupying){const p=r.envelope?.find(s=>d.y-r.y>=s.rise-1e-8&&d.y-r.y<s.rise+s.height)?.polygon??r.polygon,bb=bounds(p),guard=d.number>=16?4:.55,z=x>=bb.x0-guard&&x<=bb.x1+guard?cross(p,Math.max(bb.x0,Math.min(bb.x1,x))):[];if(!z.length)continue;const lo=Math.min(...z),hi=Math.max(...z);if(lo<=0&&hi>=0)edge=0;else edge=Math.min(edge,(d.number<=15?Math.min(Math.abs(bb.z0),Math.abs(bb.z1)):Math.min(Math.abs(lo),Math.abs(hi)))-(d.number>=16?4:.08));}
   samples.push([x,Math.max(0,edge)]);
  }natural.set(d.number,samples);d.residentialFront=samples.map(p=>p.slice());
 }
 for(let n=7;n<=20;n++)for(let i=0;i<natural.get(n).length;i++)natural.get(n)[i][1]=Math.min(natural.get(n)[i][1],natural.get(n-1)[i][1]);
 // Downward containment permits overhangs; the upper funnel changes by at most 10 m per side.
 for(let n=20;n>=6;n--){const d=decks[n-1],s=natural.get(n),up=n<20?decks[n].atrium.samples:null;
  for(let i=0;i<s.length;i++)if(up){if(n>=13)s[i][1]=Math.min(s[i][1],up[i][1]+10);if(s[i][1]+.01<up[i][1])issues.push({kind:'atrium-nesting-conflict',deck:n,x:s[i][0],available:s[i][1],above:up[i][1]});}
  let end=s.length-1;while(end>0&&s[end-1][1]===0)end--;const boundary=s.slice(0,end+1),outline=[...boundary.map(([x,w])=>[x,-w]),...boundary.slice().reverse().map(([x,w])=>[x,w])];
  d.atrium={outline,widthMid:2*s.find(p=>p[0]===0)[1],floor:n===6,policy:'Nested downward; 10 m maximum step per side from Deck 13.',samples:s};if(n>6)d.slab.holes.push({id:'atrium',polygon:outline});
  if(n>=16){const tower={id:'d'+n+'-tower',deck:n,polygon:rectangle(134.6,0,24,18)};circulation.towers.push(tower);const width=s.find(p=>p[0]===132)[1],end=Math.max(11,width+2);
   for(const side of [-1,1])circulation.bridges.push({id:'d'+n+'-bridge-'+side,deck:n,polygon:rectangle(132,side*(end+9)/2,8.4,end-9),points:[[132,side*9],[132,side*end]],width:8.4,reason:'Short bridge lands on the inboard promenade; original bow rooms retain their anchors.'});
  }
  d.atrium.roomFitWidthMid=d.atrium.widthMid;
  d.roomLines=[...new Set([3.5,...rooms.filter(r=>r.deck===n&&!r.aggregate).map(r=>r.height)])].map(height=>({height,outline:hullPath(h,d.y,height,-298,0).poly}));
 }
}
function scheduleWindows({h,decks,rooms,cabins,windows,issues}){
 const normal=(x,y,side)=>{const dx=(h.skin(x+.02,y,side)-h.skin(x-.02,y,side))/.04,dy=(h.skin(x,y+.02,side)-h.skin(x,y-.02,side))/.04,l=Math.hypot(dx,dy,1);return [-dx/l,-dy/l,side/l];};
 const project=(p,n,y)=>{
  let lo=0,hi=2;const inside=t=>{const x=p[0]+n[0]*t,z=p[1]+n[1]*t;return Math.abs(z)<=h.skin(x,y,Math.sign(z)||1);};
  while(hi<128&&inside(hi))hi*=2;if(hi>=128)return null;
  for(let k=0;k<40;k++){const m=(lo+hi)/2;if(inside(m))lo=m;else hi=m;}
  const q=[p[0]+n[0]*lo,y,p[1]+n[1]*lo];return h.onSurface(q)?q:h.ray([p[0],y,p[1]],[n[0],0,n[1]]);
 };
 for(const c of cabins.filter(c=>c.view==='space')){
  const tangent=[Math.cos(c.yaw),-Math.sin(c.yaw)],out=[-Math.sin(c.yaw),-Math.cos(c.yaw)],base=[c.x+out[0]*3.7,c.z+out[1]*3.7],bottom=c.y+.8,top=bottom+1.3;
  const corners=[[-1.1,bottom],[1.1,bottom],[1.1,top],[-1.1,top]].map(([u,y])=>project([base[0]+tangent[0]*u,base[1]+tangent[1]*u],out,y)),center=project(base,out,(bottom+top)/2),id=c.id+'-window';
  if(!center||corners.some(p=>!p)){issues.push({kind:'window-fit',id});continue;}
  const w={id,deck:c.deck,cabinId:c.id,kind:'cabin',center,size:[2.2,1.3],width:2.2,height:1.3,sill:.8,normal:normal(center[0],center[1],Math.sign(center[2])),corners,roomWallOpening:{id:id+'-lining',owner:c.id,aperture:id,center:[base[0],(bottom+top)/2,base[1]],width:2.2,height:1.3,corners:[[-1.1,bottom],[1.1,bottom],[1.1,top],[-1.1,top]].map(([u,y])=>[base[0]+tangent[0]*u,y,base[1]+tangent[1]*u])}};
  w.surface={columns:3,rows:3,points:[0,.5,1].flatMap(v=>[-1.1,0,1.1].map(u=>project([base[0]+tangent[0]*u,base[1]+tangent[1]*u],out,bottom+v*1.3)))};windows.push(w);c.window=id;
 }
 const at=(poly,x,side)=>{const z=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(x<Math.min(a[0],b[0])-1e-8||x>Math.max(a[0],b[0])+1e-8)continue;if(Math.abs(a[0]-b[0])<1e-8)z.push(side*a[1],side*b[1]);else z.push(side*(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])));}return side*Math.max(...z);};
 for(const r of rooms.filter(r=>r.outer&&!r.aggregate)){
  const b=bounds(r.polygon),working=r.deck<=5&&!/arrival|ward|clinic|counseling|isolation|restaurant|café|canteen|mess|lounge|food|maternity|spa/i.test(r.kind+' '+r.name),kind=r.kind==='garden'?'garden':working?'working':'public',height=kind==='garden'?r.height:working?1.4:2.2,sill=kind==='garden'?0:working?.9:.5;
  r.windows=[];
  for(const side of b.z0<0&&b.z1>0?[-1,1]:[r.side||Math.sign(r.z)||1]){
   const y=r.y+sill+height/2,profile=[];for(let x=b.x0;x<b.x1;x+=.02)profile.push([x,side*h.skin(x,y,side)]);profile.push([b.x1,side*h.skin(b.x1,y,side)]);
   const arc=pathLength(profile),xx=u=>pathAt(profile,arc,u)[0];
   for(let u=1.65;u+1.5<arc.at(-1);u+=3.3){
    const x=xx(u),left=xx(u-1.5),right=xx(u+1.5),z=at(r.envelope?.find(s=>y-r.y>=s.rise&&y-r.y<=s.rise+s.height)?.polygon??r.polygon,x,side),center=[x,y,side*h.skin(x,y,side)],id=r.id+'-window-'+(r.windows.length+1),corners=[[left,-height/2],[right,-height/2],[right,height/2],[left,height/2]].map(([x,dy])=>[x,y+dy,side*h.skin(x,y+dy,side)]);
    const wallCorners=[[left,-height/2],[right,-height/2],[right,height/2],[left,height/2]].map(([x,dy])=>[x,y+dy,at(r.envelope?.find(s=>y+dy-r.y>=s.rise&&y+dy-r.y<=s.rise+s.height)?.polygon??r.polygon,x,side)]);
    if(wallCorners.some(p=>p.some(v=>!Number.isFinite(v))))continue;
    if(r.hullGrowth&&[left,x,right].some(q=>Math.abs(at(r.polygon,q,side))<h.roomHalf(q,r.y,r.height,side)-.7))continue;
    windows.push({id,deck:r.deck,roomId:r.id,kind,center,size:[3,height],width:3,height,sill,pitch:3.3,widthDatum:'facade arc at centre height',facadeArc:u,arcEdges:[u-1.5,u+1.5],normal:normal(x,y,side),corners,surface:{columns:3,rows:3,points:[-height/2,0,height/2].flatMap(dy=>[left,x,right].map(x=>[x,y+dy,side*h.skin(x,y+dy,side)]))},roomWallOpening:{id:id+'-lining',owner:r.id,aperture:id,center:[x,y,z],width:right-left,height,corners:wallCorners}});r.windows.push(id);
   }
  }
 }
}

export const LAYOUT_V2=buildLayoutV2();
