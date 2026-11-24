import * as T from 'three';
import {walkCanvas} from '../walk/canvas.js';
import {AQUARIUM} from '../walk/lounge-aquarium.js';

// Finish rectangles only partition existing top faces. They never add floor or collision.
export function loungeWalkwayPlan(layout,number=19){
 const deck=layout.decks[number-1],room=layout.rooms.find(r=>r.id==='commons-1');
 // Deck 17 shares the aft lobby but enters the lounge through the aquarium throat.
 const door=room.galleryDoors.find(d=>d.deck===Math.max(18,number));
 const lifts=deck.slab.holes.filter(h=>/^aft_lift_/.test(h.id)),centre=p=>p.reduce((n,q)=>n+q[1],0)/p.length,mid=lifts.reduce((n,h)=>n+centre(h.polygon),0)/lifts.length;
 const front=Math.max(...room.polygon.map(p=>p[1])),end=room.x-132+AQUARIUM.x1;
 const edge=deck.atrium.outline.filter(p=>p[0]>door.center[0]&&p[0]<end&&p[1]<0),balcony=Math.min(...edge.map(p=>p[1])),width=balcony-front;
 // A straight return of the same hall width reaches the aft door's outer jamb.
 const outer=[door.center[0]-width,end,door.center[2]-door.width/2,mid],tile=[-138,-122,-3.94,3.94],strip=.065;
 // The two-metre main landing lies just aft of the selected stair opening (transit.js).
 const landings=deck.slab.holes.filter(h=>/^aft_stairs_/.test(h.id)).map(h=>{const xs=h.polygon.map(p=>p[0]),zs=h.polygon.map(p=>p[1]);return [Math.min(...xs)-2,Math.min(...xs),Math.min(...zs),Math.max(...zs)];});
 // Trim only open edges: the long glass/wall and the actual balcony edge stay bare.
 const bands=[
  [outer[0],outer[0]+strip,outer[2],mid],
  [outer[0]+strip,end,outer[2],outer[2]+strip],
  [outer[0]+strip,end,mid-strip,mid],
  [end-strip,end,outer[2]+strip,mid-strip],
  [tile[0]-strip,tile[1]+strip,tile[2]-strip,tile[2]],
  [tile[0]-strip,tile[0],tile[2],mid],
  [tile[1],tile[1]+strip,tile[2],mid],
  ...landings.filter(r=>r[2]<mid).map(r=>[r[0],r[1],r[3],r[3]+strip]),
 ];
 const masks=[tile,...landings];
 if(number===room.deck)masks.push([Math.min(...room.polygon.map(p=>p[0])),end,outer[2],front]);
 return {deck:number,y:deck.y,outer,tile,bands,strip,front,balcony,door:(number===room.deck?room.door:door).center,landings,masks};
}

// Split a convex polygon at a coordinate, interpolating every vertex attribute.
function split(poly,axis,at){
 const inside=[],outside=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=a[axis]-at,db=b[axis]-at;
  if(da>=0)inside.push(a);if(da<=0)outside.push(a);
  if((da>0&&db<0)||(da<0&&db>0)){const t=da/(da-db),q=a.map((v,k)=>v+(b[k]-v)*t);inside.push(q);outside.push(q);}
 }
 return [inside,outside];
}
function take(poly,rect){
 let kept=poly;const rest=[];
 for(const [axis,at,sign] of [[0,rect[0],1],[0,rect[1],-1],[2,rect[2],1],[2,rect[3],-1]]){
  if(kept.length<3)break;const parts=split(kept,axis,at);kept=parts[sign===1?0:1];const other=parts[sign===1?1:0];if(other.length>=3)rest.push(other);
 }
 return {kept,rest};
}

function walkwayPieces(poly,plan,keepFloor){
 const zone=take(poly,plan.outer);for(const q of zone.rest)keepFloor(q);if(zone.kept.length<3)return [];
 let carpet=[zone.kept];for(const mask of plan.masks){const next=[];for(const q of carpet){const cut=take(q,mask);keepFloor(cut.kept);next.push(...cut.rest);}carpet=next;}
 return carpet;
}

// Clip floor markings at the same edges as the finish, including the gold strip.
export function loungeWalkwayBorderRects(rect,plan){
 const [x0,x1,z0,z1]=rect,[a,b,c,d]=plan.outer;
 if(x1<=a||x0>=b||z1<=c||z0>=d)return [rect];
 const kept=[];
 walkwayPieces([[x0,0,z0],[x1,0,z0],[x1,0,z1],[x0,0,z1]],plan,poly=>{
  if(poly.length<3)return;
  const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[2]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
  if(x1-x0>1e-6&&z1-z0>1e-6)kept.push([x0,x1,z0,z1]);
 });
 return kept;
}

export function partitionLoungeWalkway(geometry,plan,matteTop=null){
 const attrs=Object.entries(geometry.attributes),ordered=[['position',geometry.attributes.position],...attrs.filter(([k])=>k!=='position')],sizes=ordered.map(([,a])=>a.itemSize),outputs={floor:[],carpet:[],gold:[]},p=geometry.attributes.position;
 // Corridors already stand 8 mm above the slab. Replace both hex tops in place.
 const heights=matteTop===null?[plan.y+.002,plan.y+.010]:[matteTop];
 const vertex=i=>ordered.flatMap(([,a])=>Array.from({length:a.itemSize},(_,k)=>a.array[i*a.itemSize+k]));
 const emit=(kind,poly)=>{for(let i=1;i<poly.length-1;i++){const t=[poly[0],poly[i],poly[i+1]],area=(t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]);if(Math.abs(area)>1e-10)outputs[kind].push(...t.flat());}};
 const keepFloor=poly=>emit('floor',poly);
 for(let i=0;i<p.count;i+=3){
  const tri=[vertex(i),vertex(i+1),vertex(i+2)],xs=tri.map(v=>v[0]),zs=tri.map(v=>v[2]),r=plan.outer;
  if(!heights.some(y=>tri.every(v=>Math.abs(v[1]-y)<.001))){if(matteTop!==null)outputs.floor.push(...tri.flat());else emit('floor',tri);continue;}
  if(Math.max(...xs)<=r[0]||Math.min(...xs)>=r[1]||Math.max(...zs)<=r[2]||Math.min(...zs)>=r[3]){emit('floor',tri);continue;}
  let carpet=walkwayPieces(tri,plan,keepFloor);
  for(const band of plan.bands){const next=[];for(const poly of carpet){const cut=take(poly,band);emit('gold',cut.kept);next.push(...cut.rest);}carpet=next;}
  for(const poly of carpet)emit('carpet',poly);
 }
 const stride=sizes.reduce((n,v)=>n+v,0),result={};
 for(const [kind,values]of Object.entries(outputs)){
  if(!values.length)continue;const g=new T.BufferGeometry();let offset=0;
  for(const [name,a]of ordered){const data=new Float32Array(values.length/stride*a.itemSize);for(let i=0;i<values.length/stride;i++)for(let k=0;k<a.itemSize;k++)data[i*a.itemSize+k]=values[i*stride+offset+k];g.setAttribute(name,new T.BufferAttribute(data,a.itemSize));offset+=a.itemSize;}
  if(kind!=='floor'){
   const pos=g.attributes.position,uv=g.attributes.uv||new T.BufferAttribute(new Float32Array(pos.count*2),2);g.setAttribute('uv',uv);
   if(kind==='carpet')for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/.7,pos.getZ(i)/.7);
  }
  result[kind]=g;
 }
 return result;
}

// After collision is built, remove only covered corridor tops from the drawing.
// Otherwise the bake's overlap nudges can lift their plain backing through the finish.
export function retireLoungeWalkwayBacking(root,layout){
 const plans=[17,18,19].map(n=>loungeWalkwayPlan(layout,n)),sources=[];root.updateMatrixWorld(true);
 root.traverse(o=>{if(o.isMesh&&o.name==='V2_corridor_floor'&&o.material?.name==='V2_floor'&&!o.userData.loungeWalkwayBackingRetired)sources.push(o);});
 let retired=0;
 for(const o of sources){
  const original=o.geometry,box=new T.Box3().setFromObject(o),plan=plans.find(p=>Math.abs(box.max.y-p.y-.008)<.001);
  if(!plan)continue;const r=plan.outer;
  if(box.max.x<=r[0]||box.min.x>=r[1]||box.max.z<=r[2]||box.min.z>=r[3])continue;
  const flat=(original.index?original.toNonIndexed():original.clone()).applyMatrix4(o.matrixWorld).translate(0,.002,0),pieces=partitionLoungeWalkway(flat,plan);flat.dispose();
  if(!pieces.carpet&&!pieces.gold){pieces.floor?.dispose();continue;}
  o.geometry=pieces.floor||new T.BufferGeometry();o.geometry.translate(0,-.002,0).applyMatrix4(o.matrixWorld.clone().invert());
  o.userData.loungeWalkwayBackingRetired=true;pieces.carpet?.dispose();pieces.gold?.dispose();retired++;
 }
 return retired;
}

let materials;
export function loungeWalkwayMaterials(){
 if(materials)return materials;const canvas=walkCanvas();let nap=null;
 if(canvas){canvas.width=canvas.height=128;const g=canvas.getContext('2d'),image=g.createImageData(128,128);let seed=19;
  // Fine pile varies in both directions and fades into the mipmaps at a distance.
  for(let i=0;i<image.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=184+(seed>>>26);image.data.set([n,n,n,255],i);}g.putImageData(image,0,0);
  if(typeof canvas.data==='function')Object.defineProperty(canvas,'data',{value:undefined});nap=new T.CanvasTexture(canvas);nap.colorSpace=T.SRGBColorSpace;nap.wrapS=nap.wrapT=T.RepeatWrapping;nap.anisotropy=4;
 }
 const depth={polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1};
 // A white texel keeps the gold's depth bias when the walk batches plain materials.
 const goldMap=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);goldMap.needsUpdate=true;
 const carpet=new T.MeshPhysicalMaterial({name:'Lounge_walkway_black_velvet',color:0x18161a,map:nap,roughness:.96,metalness:0,sheen:.5,sheenColor:0x6d6475,sheenRoughness:.78,envMapIntensity:.35,...depth});
 carpet.userData.preserveWalkFinish=true;
 materials={carpet,gold:new T.MeshStandardMaterial({name:'Lounge_walkway_gold_transition',color:0xb99845,map:goldMap,roughness:.42,metalness:.55,...depth})};
 return materials;
}
