import * as T from 'three';

// Brings the saved exterior's form closer to the concept sheet, as concept-paint.js does for its finish. The top and
// side silhouettes already match the sheet within a few metres; what differs is how some parts are shaped:
// - the fin stands ~12 m taller than drawn, so the fin and its crown lounge sit lower (the fin drop);
// - the fin's leading edge is swept further, reaching ~48 m further forward along the hull top;
// - each engine pod's bow curves back under itself instead of ending in a tall vertical navy face;
// - the bow's upper part leans back further, as drawn.
// The pod bow and the fin drop are smooth warps of space applied to whole parts, so attached details travel with their
// surfaces. The fin drop also moves everything built inside the fin: the aft interiors (shapeAft), tour stops and cameras (shapePoint).

const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};

// Fin drop: from the cap underside (124.2 m) up, the crown moves down rigidly; the fin between 40 m (just above the
// hull at the fin) and the cap compresses linearly. A linear squash keeps straight edges straight, so the fin skin's
// long, non-conforming triangles can't open cracks. Nothing else on the ship rises above 40 m aft of x -150.
export const FIN_DROP=12;
const DROP_FROM=40,DROP_TO=124.2,FIN_AFT_OF=-150;
const DROP_REGION=new T.Box3(new T.Vector3(-Infinity,DROP_FROM,-Infinity),new T.Vector3(FIN_AFT_OF+10,Infinity,Infinity));
const dropAt=(x,y)=>FIN_DROP*Math.max(0,Math.min(1,(y-DROP_FROM)/(DROP_TO-DROP_FROM)))*smooth(FIN_AFT_OF+10,FIN_AFT_OF-10,x);
const dropFin=v=>{v.y-=dropAt(v.x,v.y);};
// Where the drop is a plain translation (the crown, the hull below) normals keep their direction.
dropFin.rigid=v=>v.y<=DROP_FROM||v.x>=FIN_AFT_OF+10||v.y>=DROP_TO&&v.x<=FIN_AFT_OF-10;
export const shapePoint=([x,y,z])=>[x,y-dropAt(x,y),z];
// The fin's own parts (skin, windows, fillet) take one even squash over their whole height, from below the skin's
// buried root, so none of the skin's long triangles crosses a bend either. It matches the drop at the cap; lower down
// the skin sits up to ~2 m lower than the clamped drop, sliding along its own flat sides (the fillet covers the edge).
const FIN_ROOT=24.5,FIN_PART=/^(Upright_tail_assembly|V34_fin_)/;
export const shapeFinPoint=([x,y,z])=>[x,y-FIN_DROP*(y-FIN_ROOT)/(DROP_TO-FIN_ROOT),z];
const dropFinPart=v=>{v.y-=FIN_DROP*(v.y-FIN_ROOT)/(DROP_TO-FIN_ROOT);};
// The hull never reaches the drop's zone; skipping its 265k vertices keeps the pass quick.
const HULL=/^(Smooth_pressure_envelope|Hull_panel_seams)/;
// Tour stops and camera views name the crown's height in their text; keep it true to the lowered crown.
const CROWN_FLOOR=132.3,crownText=s=>s?.replace(`${CROWN_FLOOR} m`,`${(CROWN_FLOOR-FIN_DROP).toFixed(1)} m`);
export function shapeView(view){
 const out={...view};for(const key of ['position','target','eye','look'])if(view[key])out[key]=shapePoint(view[key]);
 for(const key of ['detail','location','description'])if(view[key])out[key]=crownText(view[key]);
 return out;
}

// Fin fillet: a blade around the fin's leading edge gives it the drawn sweep, one straight edge from under the crown
// (124 m) to 48 m ahead of the fin's root on the hull top. It is its own mesh (the fin skin's triangulation would
// crack under a warp). It becomes the fin's whole front edge: each band of height runs from 3 m inside the old edge (clear of the hatch outlines),
// 15 cm proud of the fin's flat sides (never coplanar with them), to at least 5 m ahead of it, so the old rounded
// edge stays covered. Its section is a superellipse: fin-thick along its length, rounding off at the nose. The root
// is buried in the hull.
const FILLET=48,FILLET_ROOT=37,FILLET_TOP=124.2,FILLET_BURY=31,FILLET_INSIDE=3,FILLET_AHEAD=5,FILLET_HALF=5.15,ROWS=36,ARC=18;
const FIN_SKIN=/^Swept_cat_tail/,FIN_GROUP='Upright_tail_assembly';
// The fin's leading edge is a straight swept line. Fit it to the skin's foremost point at each 2 m of height between
// the hull and the windows' top, found where the skin's triangle edges cross that height (its triangles are tall).
const EDGE_FROM=36,EDGE_TO=100;
function leadingEdge(skin,frame){
 const g=skin.geometry,p=g.attributes.position,ix=g.index,m=new T.Matrix4().multiplyMatrices(frame,skin.matrixWorld),q=[];
 for(let i=0;i<p.count;i++)q.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m));
 const corner=k=>q[ix?ix.getX(k):k],front=new Map();
 for(let t=0;t<(ix?ix.count:p.count);t+=3)for(let e=0;e<3;e++){
  const a=corner(t+e),b=corner(t+(e+1)%3),lo=Math.min(a.y,b.y),hi=Math.max(a.y,b.y);
  for(let y=Math.ceil(Math.max(lo,EDGE_FROM)/2)*2;y<=Math.min(hi,EDGE_TO);y+=2){const x=hi===lo?Math.max(a.x,b.x):a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y);front.set(y,Math.max(front.get(y)??-Infinity,x));}
 }
 let n=0,sy=0,sx=0,syy=0,sxy=0;for(const [y,x] of front){n++;sy+=y;sx+=x;syy+=y*y;sxy+=x*y;}
 const slope=(n*sxy-sx*sy)/(n*syy-sy*sy),at=(sx-slope*sy)/n;return y=>at+slope*y;
}
function addFinFillet(exterior,frame){
 const group=exterior.getObjectByName(FIN_GROUP),skin=group&&partsOf(group,null).find(o=>FIN_SKIN.test(o.name));if(!skin)return;
 const edge=leadingEdge(skin,frame),points=[],index=[];
 for(let r=0;r<=ROWS;r++){
  const y=FILLET_BURY+(FILLET_TOP-FILLET_BURY)*r/ROWS,front=edge(y),reach=Math.max(FILLET_AHEAD,FILLET*Math.min(1,Math.max(0,(FILLET_TOP-y)/(FILLET_TOP-FILLET_ROOT)))),back=front-FILLET_INSIDE;
  // Around the section: aft on one side, round the nose, aft on the other.
  for(let k=0;k<=2*ARC;k++){const side=k<ARC?1:-1,s=k<ARC?k/ARC:(2*ARC-k)/ARC;points.push(back+(front+reach-back)*s,y,side*FILLET_HALF*(1-s**4)**.25);}
 }
 const row=2*ARC+1;for(let r=0;r<ROWS;r++)for(let k=0;k<2*ARC;k++){const a=r*row+k,b=a+row;index.push(a,a+1,b,a+1,b+1,b);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));geometry.setIndex(index);
 geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(frame,group.matrixWorld).invert());geometry.computeVertexNormals();
 const fillet=new T.Mesh(geometry,skin.material);fillet.name='Fin_root_fillet';group.add(fillet);fillet.updateMatrixWorld(true);
}

// Bow rake: above 32 m the bow leans back, up to 16 m at the crown top where the bow is fully forward (eased in over the
// last 115 m), as drawn; the middle and lower bow already match. It is exterior-only: the bridge and observation
// lounge render without the exterior (walk, areas), and in the layout ghost and the Explode dial a metre or two at
// the bridge's top row doesn't show. The bow mesh is fine enough that the curved warp bends its triangles < 5 cm.
const RAKE=16,RAKE_FROM=32,RAKE_TO=54,BOW_FROM=120,BOW_TO=235;
const BOW_REGION=new T.Box3(new T.Vector3(BOW_FROM,RAKE_FROM,-Infinity),new T.Vector3(Infinity,Infinity,Infinity));
const rakeBow=v=>{v.x-=RAKE*smooth(RAKE_FROM,RAKE_TO,v.y)*smooth(BOW_FROM,BOW_TO,v.x);};
export const rakeBowPoint=([x,y,z])=>{const v=new T.Vector3(x,y,z);rakeBow(v);return v.toArray();};

// Pod bow: below 24 m under the pod's deck line the bow curves back, up to ~7 m at the keel, as drawn. This stays below
// the pod interiors' floor (-19.7 m).
const CHIN_FROM=-24,CHIN_CURVE=.04,POD_PART=/^(Port|Starboard)_nacelle$/;
const chinPod=v=>{const d=Math.max(0,CHIN_FROM-v.y);v.x-=CHIN_CURVE*d*d*smooth(-178,-146,v.x);};

// Warp engine. Positions move through the warp; normals follow its local Jacobian (inverse transpose), so shading keeps
// the saved hard and soft edges. Warps work in the frame of the part's parent (ship coordinates). Instanced copies move
// rigidly with their origin.
const STEP=.05,J=new T.Matrix3(),c=[new T.Vector3(),new T.Vector3(),new T.Vector3()],ahead=new T.Vector3();
// p is the point before the warp and at its image after it; the Jacobian is sampled one step ahead on each axis.
function warpNormal(warp,p,at,n){
 for(let i=0;i<3;i++){ahead.copy(p).setComponent(i,p.getComponent(i)+STEP);warp(ahead);c[i].subVectors(ahead,at).divideScalar(STEP);}
 J.set(c[0].x,c[1].x,c[2].x,c[0].y,c[1].y,c[2].y,c[0].z,c[1].z,c[2].z);
 return n.applyMatrix3(J.invert().transpose()).normalize();
}
function warpGeometry(o,warp,frame){
 const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,m=new T.Matrix4().multiplyMatrices(frame,o.matrixWorld),inv=m.clone().invert();
 const toShip=new T.Matrix3().getNormalMatrix(m),toLocal=new T.Matrix3().setFromMatrix4(m).transpose();
 const pos=new Float32Array(p.count*3),nor=n&&new Float32Array(n.count*3),v=new T.Vector3(),w=new T.Vector3(),q=new T.Vector3();let moved=false;
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i).applyMatrix4(m);w.copy(v);warp(w);
  const shifted=w.distanceToSquared(v)>1e-10;if(shifted)moved=true;
  if(n){q.fromBufferAttribute(n,i);if(shifted&&!warp.rigid?.(v))warpNormal(warp,v,w,q.applyMatrix3(toShip).normalize()).applyMatrix3(toLocal).normalize();nor[i*3]=q.x;nor[i*3+1]=q.y;nor[i*3+2]=q.z;}
  w.applyMatrix4(inv);pos[i*3]=w.x;pos[i*3+1]=w.y;pos[i*3+2]=w.z;
 }
 if(!moved)return;
 o.geometry=g.clone();o.geometry.setAttribute('position',new T.BufferAttribute(pos,3));if(n)o.geometry.setAttribute('normal',new T.BufferAttribute(nor,3));
 o.geometry.deleteAttribute('tangent');o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
}
function warpInstances(o,warp,frame){
 const local=new T.Matrix4(),m=new T.Matrix4().multiplyMatrices(frame,o.matrixWorld),inv=m.clone().invert(),at=new T.Matrix4(),v=new T.Vector3(),d=new T.Vector3();let moved=false;
 for(let i=0;i<o.count;i++){o.getMatrixAt(i,local);at.multiplyMatrices(m,local);v.setFromMatrixPosition(at);d.copy(v);warp(d);d.sub(v);if(d.lengthSq()<1e-10)continue;
  moved=true;at.premultiply(new T.Matrix4().makeTranslation(d.x,d.y,d.z));o.setMatrixAt(i,local.multiplyMatrices(inv,at));}
 if(moved){o.instanceMatrix.needsUpdate=true;o.computeBoundingBox();o.computeBoundingSphere();}
}
const box=new T.Box3();
function warpParts(meshes,warp,frame,region){
 for(const o of meshes){
  if(region){box.copy(o.isInstancedMesh?(o.computeBoundingBox(),o.boundingBox):(o.geometry.boundingBox??(o.geometry.computeBoundingBox(),o.geometry.boundingBox))).applyMatrix4(new T.Matrix4().multiplyMatrices(frame,o.matrixWorld));if(!box.intersectsBox(region))continue;}
  (o.isInstancedMesh?warpInstances:warpGeometry)(o,warp,frame);
 }
}
// Meshes under root whose own or an ancestor's name (up to root) matches the pattern; all meshes without one.
function partsOf(root,pattern,skip){
 const out=[];root.traverse(o=>{if(!o.isMesh||skip?.test(o.name))return;if(!pattern){out.push(o);return;}for(let a=o;a&&a!==root.parent;a=a.parent)if(pattern.test(a.name)){out.push(o);return;}});return out;
}
const frameOf=root=>root.parent?root.parent.matrixWorld.clone().invert():new T.Matrix4();

export function applyConceptShape(exterior){
 exterior.updateMatrixWorld(true);const frame=frameOf(exterior);
 addFinFillet(exterior,frame);
 warpParts(partsOf(exterior,POD_PART),chinPod,frame);
 warpParts(partsOf(exterior),rakeBow,frame,BOW_REGION);
 const fin=new Set(partsOf(exterior,FIN_PART));warpParts([...fin],dropFinPart,frame);
 warpParts(partsOf(exterior,null,HULL).filter(o=>!fin.has(o)),dropFin,frame,DROP_REGION);
}
// The aft interiors (fin structure, lift and crown lounge) follow the fin drop.
export function shapeAft(root){root.updateMatrixWorld(true);warpParts(partsOf(root),dropFin,frameOf(root),DROP_REGION);}
