import * as T from 'three';

// Select actual finished-bake triangles. Door/window/atrium cuts remain cuts;
// never close a room using a box inferred from its footprint.
const STRUCTURE=/^(Deck_slab|V2_(room_ceiling|outer_room_(wall|floor|ceiling)|distribution_ceiling|pressure_lining|lower_hull_wall_return|shuttle_ceiling)|Stair_(outer_wall|end_wall|gallery_wall|top_ceiling|lobby_partition)|Refined_corridor_lining|Room_end_wall|Outboard_wall|Wall_(sill|header|pier|mullion)|Side_wall|Entry_wall|Closed_end_wall|End_wall|Ceiling|Atrium_ceiling|Truss_ceiling_plate|Crown_roof|Roof_mission)$/;
export function structuralRange(r){
 return !r.userData?.collisionOnly && (r.userData?.hullSkinSurface ||
 r.userData?.batchedEnvelope || r.userData?.hullEnvelopeBatch ||
 /^Smooth_pressure_envelope/.test(r.name) || STRUCTURE.test(r.name));
}
export async function installDistantArchitecture(ship,baked,haze){
 const yieldWork=()=>new Promise(resolve=>setTimeout(resolve,0));let checkpoint=performance.now(),processed=0;
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
 ship.facade?.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!(/^(P6_atrium_floor_actual|P6_sky_ceiling|P6_sky_tip|P6_tower_architecture)$/.test(o.name))||o.material.transparent)return;o.updateWorldMatrix(true,false);const copy=new T.Mesh(o.geometry,farMaterial(o.material));copy.name='V2_distant_'+o.name;copy.matrixAutoUpdate=false;copy.matrix.copy(o.matrixWorld);copy.userData.noCollide=true;root.add(copy);const count=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;sources.set(o.name,(sources.get(o.name)||0)+count);triangles+=count;});
 for(const [deck,b] of buckets){
  const positions=new Float32Array(b.count*3),colors=new Uint8Array(b.count*3);let at=0;
  for(const {o,start,count,matrix} of b.parts){
   const p=o.geometry.attributes.position,c=o.geometry.attributes.color,ix=o.geometry.index,m=o.material,tint=m.color||new T.Color(1,1,1);
   for(let i=start*3;i<(start+count)*3;i++){
    const j=ix?ix.getX(i):i;point.fromBufferAttribute(p,j).applyMatrix4(matrix);positions[at]=point.x;positions[at+1]=point.y;positions[at+2]=point.z;
    colors[at++]=Math.round(255*Math.min(1,tint.r*(m.vertexColors&&c?c.getX(j):1)));
    colors[at++]=Math.round(255*Math.min(1,tint.g*(m.vertexColors&&c?c.getY(j):1)));
    colors[at++]=Math.round(255*Math.min(1,tint.b*(m.vertexColors&&c?c.getZ(j):1)));
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
