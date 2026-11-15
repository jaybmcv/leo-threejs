import * as T from 'three';
import {walkCanvas} from '../walk/canvas.js';
import {AQUARIUM} from '../walk/lounge-aquarium.js';

// Finish rectangles only partition existing top faces. They never add floor or collision.
export function loungeWalkwayPlan(layout){
 const deck=layout.decks.find(d=>d.number===19),room=layout.rooms.find(r=>r.id==='commons-1'),door=room.galleryDoors.find(d=>d.deck===19);
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
 return {deck:19,y:deck.y,outer,tile,bands,strip,front,balcony,door:door.center,landings};
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

export function partitionLoungeWalkway(geometry,plan){
 const attrs=Object.entries(geometry.attributes),ordered=[['position',geometry.attributes.position],...attrs.filter(([k])=>k!=='position')],sizes=ordered.map(([,a])=>a.itemSize),outputs={floor:[],carpet:[],gold:[]},p=geometry.attributes.position;
 // Corridors already stand 8 mm above the slab. Replace both hex tops in place.
 const heights=[plan.y+.002,plan.y+.010];
 const vertex=i=>ordered.flatMap(([,a])=>Array.from({length:a.itemSize},(_,k)=>a.array[i*a.itemSize+k]));
 const emit=(kind,poly)=>{for(let i=1;i<poly.length-1;i++){const t=[poly[0],poly[i],poly[i+1]],area=(t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]);if(Math.abs(area)>1e-10)outputs[kind].push(...t.flat());}};
 for(let i=0;i<p.count;i+=3){
  const tri=[vertex(i),vertex(i+1),vertex(i+2)],xs=tri.map(v=>v[0]),zs=tri.map(v=>v[2]),r=plan.outer;
  if(Math.max(...xs)<=r[0]||Math.min(...xs)>=r[1]||Math.max(...zs)<=r[2]||Math.min(...zs)>=r[3]||!heights.some(y=>tri.every(v=>Math.abs(v[1]-y)<.001))){emit('floor',tri);continue;}
  const zone=take(tri,r);for(const q of zone.rest)emit('floor',q);if(zone.kept.length<3)continue;
  let carpet=[zone.kept];for(const mask of [plan.tile,...plan.landings]){const next=[];for(const poly of carpet){const cut=take(poly,mask);emit('floor',cut.kept);next.push(...cut.rest);}carpet=next;}
  for(const band of plan.bands){const next=[];for(const poly of carpet){const cut=take(poly,band);emit('gold',cut.kept);next.push(...cut.rest);}carpet=next;}
  for(const poly of carpet)emit('carpet',poly);
 }
 const stride=sizes.reduce((n,v)=>n+v,0),result={};
 for(const [kind,values]of Object.entries(outputs)){
  if(!values.length)continue;const g=new T.BufferGeometry();let offset=0;
  for(const [name,a]of ordered){const data=new Float32Array(values.length/stride*a.itemSize);for(let i=0;i<values.length/stride;i++)for(let k=0;k<a.itemSize;k++)data[i*a.itemSize+k]=values[i*stride+offset+k];g.setAttribute(name,new T.BufferAttribute(data,a.itemSize));offset+=a.itemSize;}
  if(kind==='carpet'){const uv=g.attributes.uv,pos=g.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/.7,pos.getZ(i)/.7);}
  result[kind]=g;
 }
 return result;
}

let materials;
export function loungeWalkwayMaterials(){
 if(materials)return materials;const canvas=walkCanvas();let nap=null;
 if(canvas){canvas.width=canvas.height=128;const g=canvas.getContext('2d'),image=g.createImageData(128,128);let seed=19;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=24+(seed>>>29)+2*Math.sin(y*.31);image.data.set([n,n,n+2,255],(y*128+x)*4);}g.putImageData(image,0,0);
  if(typeof canvas.data==='function')Object.defineProperty(canvas,'data',{value:undefined});nap=new T.CanvasTexture(canvas);nap.colorSpace=T.SRGBColorSpace;nap.wrapS=nap.wrapT=T.RepeatWrapping;nap.anisotropy=4;
 }
 const depth={polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1};
 // A white texel keeps the gold's depth bias when the walk batches plain materials.
 const goldMap=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);goldMap.needsUpdate=true;
 materials={carpet:new T.MeshStandardMaterial({name:'Lounge_walkway_black_velvet',color:nap?0xffffff:0x1c1c1e,map:nap,roughness:.96,metalness:0,...depth}),gold:new T.MeshStandardMaterial({name:'Lounge_walkway_gold_transition',color:0xb99845,map:goldMap,roughness:.42,metalness:.55,...depth})};
 return materials;
}
