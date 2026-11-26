import {lightDistantPreset,installPhoneDistant} from './phone-distant.js';
import * as T from 'three';
import {yieldToPage} from './yield-to-page.js';
import {plainAttribute} from './draw-bounds.js';

// Select actual finished-bake triangles. Door/window/atrium cuts remain cuts;
// never close a room using a box inferred from its footprint.
const STRUCTURE=/^(Deck_slab|V2_(forum_upper_wall|room_ceiling|outer_room_(wall|floor|ceiling)|distribution_ceiling|pressure_lining|lower_hull_wall_return|shuttle_ceiling)|Stair_(outer_wall|end_wall|gallery_wall|top_ceiling|lobby_partition)|Refined_corridor_lining|Room_end_wall|Outboard_wall|Wall_(sill|header|pier|mullion)|Side_wall|Entry_wall|Closed_end_wall|End_wall|Ceiling|Atrium_ceiling|Truss_ceiling_plate|Crown_roof|Roof_mission)$/;
export function structuralRange(r){
 return !r.userData?.collisionOnly && (r.userData?.hullSkinSurface ||
 r.userData?.batchedEnvelope || r.userData?.hullEnvelopeBatch ||
 /^Smooth_pressure_envelope/.test(r.name) || STRUCTURE.test(r.name));
}
export async function installDistantArchitecture(ship,baked,haze,options={}){
 if(!globalThis.__leoPreparedBuild&&lightDistantPreset(options))return installPhoneDistant(ship,haze);
 const yieldWork=yieldToPage;let checkpoint=performance.now(),processed=0;
 const root=new T.Group();root.name='V2_distant_architecture';
 root.userData={noCollide:true,independentOfBands:true,apertures:'finished-bake-triangles'};
 const buckets=new Map(),sources=new Map(),point=new T.Vector3(),matrix=new T.Matrix4();
 const material=new T.MeshBasicMaterial({name:'V2_distant_opaque',vertexColors:true,side:T.DoubleSide});
 const bucket=y=>{const key=Math.max(1,Math.min(20,Math.floor((y+39.7)/4)+1));let b=buckets.get(key);if(!b)buckets.set(key,b={parts:[],count:0});return b;};
 const add=(o,start,count,transform=o.matrixWorld)=>{
  if(!count)return;const p=o.geometry.attributes.position,ix=o.geometry.index;
  // Batches only: never use their deck height to hide distant structure.
  point.fromBufferAttribute(p,ix?ix.getX(start*3):start*3).applyMatrix4(transform);
  const b=bucket(point.y);b.parts.push({o,start,count,matrix:transform.clone()});b.count+=count*3;
 };
 for(const group of baked.bands.values()){group.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||!o.geometry?.attributes.position||[].concat(o.material).some(m=>m.transparent||m.opacity<1))return;
  o.updateWorldMatrix(true,false);
  for(const r of o.geometry.userData.preparedRanges||[])if(structuralRange(r)){
   add(o,r.start,r.count);sources.set(r.name,(sources.get(r.name)||0)+r.count);
  }
 });await yieldWork();}
 // Repeated cabin carcasses are outside the deck bake. Copy the real shell,
 // not furniture or privacy glazing; source instance buffers remain untouched.
 ship.inside.traverse(o=>{
  if(!o.isInstancedMesh||!o.geometry?.attributes.position||[].concat(o.material).some(m=>m.transparent||m.opacity<1))return;
  let shell=false;for(let p=o.parent;p;p=p.parent)if(p.name==='V2_cabin_shells')shell=true;
  if(!shell)return;o.updateWorldMatrix(true,false);
  const parts=(o.geometry.userData.finishParts||[]).filter(p=>/^Cabin_v2_(floor|ceiling|side|party_walls|hull_wall|window_(jamb|sill|head|reveal))$/.test(p.name));
  for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);const world=matrix.clone().premultiply(o.matrixWorld);for(const p of parts){add(o,p.start/3,p.count/3,world);sources.set(p.name,(sources.get(p.name)||0)+p.count/3);}}
 });
 let triangles=0,bytes=0;const farMaterials=new Map();
 const farMaterial=source=>{let m=farMaterials.get(source);if(!m){m=new T.MeshBasicMaterial({name:"V2_distant_"+source.name,color:source.color||0xffffff,map:source.map||null,vertexColors:!!source.vertexColors,side:source.side,fog:source.fog,toneMapped:source.toneMapped});farMaterials.set(source,m);}return m;};
 ship.facade?.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!(/^(P6_atrium_floor_actual|P6_sky_ceiling|P6_sky_tip|P6_tower_architecture|P6_tower_stairs)$/.test(o.name))||o.material.transparent)return;o.updateWorldMatrix(true,false);const copy=new T.Mesh(o.geometry,farMaterial(o.material));copy.name='V2_distant_'+o.name;copy.matrixAutoUpdate=false;copy.matrix.copy(o.matrixWorld);copy.userData.noCollide=true;root.add(copy);const count=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;sources.set(o.name,(sources.get(o.name)||0)+count);triangles+=count;});
 for(const [deck,b] of buckets){
  const positions=new Float32Array(b.count*3),colors=new Uint8Array(b.count*3);let at=0;
  for(const {o,start,count,matrix} of b.parts){
   const p=o.geometry.attributes.position,c=o.geometry.attributes.color,ix=o.geometry.index,m=o.material,tint=m.color||new T.Color(1,1,1);
   // Plain arrays are read directly and the matrix applied as Vector3.applyMatrix4 does it (the same sums in the same
   // order): the accessors were most of this copy's 0.8 s. Anything else (plainAttribute, draw-bounds.js) goes through
   // the accessors, as do vertex colours.
   const e=matrix.elements,pa=plainAttribute(p)?p.array:null,ps=p.itemSize,ia=ix&&plainAttribute(ix)&&ix.itemSize===1?ix.array:null,shaded=m.vertexColors&&c;
   const flatR=Math.round(255*Math.min(1,tint.r*1)),flatG=Math.round(255*Math.min(1,tint.g*1)),flatB=Math.round(255*Math.min(1,tint.b*1));
   for(let i=start*3;i<(start+count)*3;i++){
    const j=ia?ia[i]:ix?ix.getX(i):i;let x,y,z;
    if(pa){const q=j*ps;x=pa[q];y=pa[q+1];z=pa[q+2];}else{point.fromBufferAttribute(p,j);x=point.x;y=point.y;z=point.z;}
    const w=1/(e[3]*x+e[7]*y+e[11]*z+e[15]);
    positions[at]=(e[0]*x+e[4]*y+e[8]*z+e[12])*w;positions[at+1]=(e[1]*x+e[5]*y+e[9]*z+e[13])*w;positions[at+2]=(e[2]*x+e[6]*y+e[10]*z+e[14])*w;
    if(shaded){
     colors[at++]=Math.round(255*Math.min(1,tint.r*c.getX(j)));
     colors[at++]=Math.round(255*Math.min(1,tint.g*c.getY(j)));
     colors[at++]=Math.round(255*Math.min(1,tint.b*c.getZ(j)));
    }else{colors[at++]=flatR;colors[at++]=flatG;colors[at++]=flatB;}
    if((++processed&16383)===0&&performance.now()-checkpoint>24){await yieldWork();checkpoint=performance.now();}
   }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('color',new T.BufferAttribute(colors,3,true));g.computeBoundingSphere();await yieldWork();
  const o=new T.Mesh(g,material);o.name='V2_distant_deck_'+deck;o.userData.noCollide=true;root.add(o);triangles+=b.count/3;bytes+=positions.byteLength+colors.byteLength;
 }
 // Replace open proxies, duplicate transparent facades and partial end skin.
 // Their nearby equivalents remain in the main scene.
 ship.v2Haze?.removeFromParent();haze.add(root);
 root.userData.proof={draws:root.children.length,triangles,bytes,sources:Object.fromEntries(sources)};
 ship.v2DistantArchitecture=root;return root;
}
