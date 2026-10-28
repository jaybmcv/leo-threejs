import * as T from 'three';

// A catnip-happy face for the Hydro-Nip Lounge (from tester feedback): heavy, dreamy upper lids half over the eyes, a
// soft blush and a small content smile. Cosmo's face has no lids, mouth or morphs, so they are laid on it: one mesh on
// the head bone, in the body's own material (so it is lit as the fur is), its UVs on single texels of Cosmo's texture:
// the fur for the lids, the lashes' dark for the lid line and the mouth, the nose's pink for the cheeks. Every vertex
// sits just off the face, found by a ray along the face's front in the rig's bind pose. The shapes at a few strengths
// are worked out once a page (they are the same for every walker); a walker eases between them.
const KEYS=6,LIFT=.0025,COLS=24,ROWS=7;
// In the bind pose (metres, Cosmo facing +z, his left +x): the heights searched for the eyes, how far the lid starts
// above an eye's top, how much of the eye it covers at the middle (a little lower at the outer corner, where a drowsy
// lid droops), the thickness of its dark line, then the mouth and the cheeks.
const LID={top:1.4,bottom:1.22,over:.003,shut:.45,droop:.01,line:.004},MOUTH={y:1.221,half:.045,dip:.009,lift:.018,width:.0048};
const CHEEK={x:.122,y:1.214,r:.019};
let shape=null;

// The face's front surface as the camera meets it: the eyes and the body near the head.
function faceSurface(asset){
 const eyes=asset.meshes.find(m=>m.name==='eyes'),body=asset.meshes.find(m=>m.name==='body'),side=new T.MeshBasicMaterial({side:T.DoubleSide});
 const near=g=>{const p=g.attributes.position,idx=g.index?g.index.array:[...Array(p.count).keys()],out=[];
  for(let i=0;i<idx.length;i+=3){const t=[idx[i],idx[i+1],idx[i+2]];if(t.every(k=>p.getY(k)>1.12&&p.getZ(k)>.04&&Math.abs(p.getX(k))<.3))for(const k of t)out.push(p.getX(k),p.getY(k),p.getZ(k));}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(out,3));return new T.Mesh(geometry,side);};
 const eye=near(eyes.geometry),skin=near(body.geometry),ray=new T.Raycaster(),from=new T.Vector3(),down=new T.Vector3(0,0,-1);
 // {p, eye}: the point just off the surface at (x, y), and whether it is on an eye.
 return (x,y)=>{ray.set(from.set(x,y,1),down);const hit=ray.intersectObjects([eye,skin],false)[0];
  return hit?{p:hit.point.setZ(hit.point.z+LIFT),eye:hit.object===eye}:{p:new T.Vector3(x,y,0),eye:false};};
}

function buildShape(asset,fur){
 const at=faceSurface(asset),eyes=asset.meshes.find(m=>m.name==='eyes').geometry.attributes.position;
 const dark=asset.meshes.find(m=>m.name==='male_eyelash').geometry.attributes.uv,pink=asset.meshes.find(m=>m.name==='nose').geometry.attributes.uv;
 const uvOf={fur:[fur.x,fur.y],dark:[dark.getX(0),dark.getY(0)],pink:[pink.getX(0),pink.getY(0)]};
 // Each eye as the camera sees it, column by column across it: where its white shows from and to.
 const eyeOf=s=>{let lo=Infinity,hi=-Infinity;for(let i=0;i<eyes.count;i++){const x=eyes.getX(i);if(Math.sign(x)===s){lo=Math.min(lo,x);hi=Math.max(hi,x);}}
  const cols=[];for(let i=0;i<=COLS;i++){const x=s<0?hi-(hi-lo)*i/COLS:lo+(hi-lo)*i/COLS;let top=null,bottom=null;
   for(let y=LID.top;y>LID.bottom;y-=.001)if(at(x,y).eye){top??=y;bottom=y;}
   // A sliver of eye showing through the skin is not the eye.
   if(top!=null&&top-bottom<.015)top=bottom=null;cols.push({x,top,bottom,outer:Math.abs(x)>Math.abs((lo+hi)/2)?Math.abs(x-(lo+hi)/2)/((hi-lo)/2):0});}
  const mid=cols[COLS/2];return {cols,line:mid.top-LID.shut*(mid.top-mid.bottom)};};
 const eyeShapes=[1,-1].map(eyeOf);
 // Parts are built for strength w: a list of strips, each a list of columns of [x, y] with one texel. The lid comes down
 // from the top of each column of the eye, the dark of its line under it.
 const uvs=[],index=[],keys=[];
 const parts=w=>{const strips=[];
  for(const {cols,line:dreamy} of eyeShapes){
   const lid=[],line=[];
   for(const {x,top,bottom,outer} of cols){
    const t=top??dreamy,e=Math.min(t,T.MathUtils.lerp(t,dreamy-LID.droop*outer,w)),from=top==null?e:t+LID.over;
    const col=[];for(let r=0;r<=ROWS;r++)col.push([x,T.MathUtils.lerp(from,e,r/ROWS)]);lid.push(col);
    line.push([[x,e+.001],[x,e-LID.line*w*(top==null||e>=t||e<bottom+.004?0:1),'onEye']]);}
   // The line sits a hair proud of the lid it overlaps.
   strips.push({texel:'fur',grid:lid},{texel:'dark',grid:line,proud:.0008});
  }
  // The mouth: a soft "w" under the nose, its two halves dipping and its corners turned up.
  const mouth=[];for(let i=0;i<=24;i++){const s=i/12-1,u=Math.abs(s),x=s*MOUTH.half*(.4+.6*w),y=MOUTH.y-w*(MOUTH.dip*Math.sin(Math.PI*Math.min(1,u*1.15))-MOUTH.lift*u**3);mouth.push([x,y]);}
  strips.push({texel:'dark',grid:mouth.map(([x,y],i)=>{const a=mouth[Math.max(0,i-1)],b=mouth[Math.min(mouth.length-1,i+1)],nx=-(b[1]-a[1]),ny=b[0]-a[0],l=Math.hypot(nx,ny)||1,h=MOUTH.width/2*w/l;return [[x+nx*h,y+ny*h],[x-nx*h,y-ny*h]];})});
  // Cheeks: a pink disc on each, as rings round its middle.
  for(const s of [1,-1]){const ring=[];for(let i=0;i<=12;i++){const a=i/12*Math.PI*2;ring.push([[s*CHEEK.x,CHEEK.y],[s*CHEEK.x+Math.cos(a)*CHEEK.r*w,CHEEK.y+Math.sin(a)*CHEEK.r*.7*w]]);}strips.push({texel:'pink',grid:ring});}
  return strips;};
 for(let k=0;k<KEYS;k++){
  const w=k/(KEYS-1),pos=[];let base=0;
  for(const {texel,grid,proud=0} of parts(Math.max(w,.001))){
   const rows=grid[0].length;
   for(const col of grid){
    // A lid-line vertex off the eye goes to its partner on the fold.
    const hits=col.map(([x,y,only])=>({...at(x,y),only}));
    hits.forEach((h,r)=>{const q=h.only&&!h.eye?hits[r-1].p:h.p;pos.push(q.x,q.y,q.z+proud);if(k===0)uvs.push(...uvOf[texel]);});
   }
   if(k===0)for(let i=0;i<grid.length-1;i++)for(let r=0;r<rows-1;r++){const a=base+i*rows+r,b=a+rows;index.push(a,b,a+1,a+1,b,b+1);}
   base+=grid.length*rows;
  }
  keys.push(new Float32Array(pos));
 }
 // Every triangle faces out of the face (+z in the bind pose), whichever way its strip ran.
 const full=keys[KEYS-1],v=i=>new T.Vector3().fromArray(full,i*3);
 for(let i=0;i<index.length;i+=3){const [a,b,c]=[v(index[i]),v(index[i+1]),v(index[i+2])];if(b.sub(a).cross(c.sub(a)).z<0)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];}
 return {keys,uvs:new Float32Array(uvs),index};
}

// `asset` is the walker's Cosmo (figure.asset); `fur` the UV of his fur (avatar.js). Returns {mesh, set(strength 0-1)}.
export function catnipFace(asset,fur){
 shape||=buildShape(asset,fur);
 const eyes=asset.meshes.find(m=>m.name==='eyes'),head=eyes.skeleton.bones[eyes.geometry.attributes.skinIndex.getX(0)];
 const g=new T.BufferGeometry(),pos=new T.BufferAttribute(shape.keys[0].slice(),3);
 g.setAttribute('position',pos);g.setAttribute('uv',new T.BufferAttribute(shape.uvs,2));g.setIndex(shape.index);
 const body=asset.meshes.find(m=>m.name==='body'),mesh=new T.Mesh(g,body.material);mesh.name='Catnip_face';
 // On the head bone, where the skin's bind pose puts the face: the bone's inverse bind matrix undoes its rest pose.
 mesh.matrixAutoUpdate=false;mesh.matrix.copy(eyes.skeleton.boneInverses[eyes.skeleton.bones.indexOf(head)]).multiply(eyes.bindMatrix);mesh.frustumCulled=false;mesh.visible=false;
 head.add(mesh);
 let shown=-1;
 return {mesh,set(w){
  if(Math.abs(w-shown)<.002)return;shown=w;mesh.visible=w>.01;if(!mesh.visible)return;
  const f=w*(KEYS-1),i=Math.min(KEYS-2,Math.floor(f)),t=f-i,a=shape.keys[i],b=shape.keys[i+1],p=pos.array;
  for(let j=0;j<p.length;j++)p[j]=a[j]+(b[j]-a[j])*t;
  pos.needsUpdate=true;g.computeVertexNormals();
 }};
}
