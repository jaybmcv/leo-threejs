import * as T from 'three';

// The fin root casing in the aft lift lobby on Deck 19. The fin's root fillet (Fin_root_fillet, concept-shape.js)
// comes down through the lobby ceiling as a bare white wedge, its nose by the lifts and its sides running aft past the
// stair approach. The walk boxes it in with flat clad walls standing on its floor outline (it leans in as it rises, so
// nothing pokes through), a few centimetres proud of it so the lobby keeps its footprint. The exterior is untouched.
// The forward face is the casing's main face: flat, square on to the lobby, lit by a wash strip, with its own 0-1 UVs.
const Y0=32.3,Y1=36.05;
// The outline's +z half from the forward face aft (the -z half mirrors it); the fillet's floor width plus 3 cm.
const HALF=[[-130.75,.9],[-133.85,3.53],[-135,3.73],[-136,3.93],[-137,4.1],[-138,4.22],[-138.6,4.29]];
const clad=new T.MeshStandardMaterial({name:'Walk_fin_casing_cladding',color:0xd6d9d6,roughness:.72,metalness:.04});
const face=new T.MeshStandardMaterial({name:'Walk_fin_casing_face',color:0xe9e8e2,roughness:.82});
const trim=new T.MeshStandardMaterial({name:'Walk_fin_casing_trim',color:0x58636c,roughness:.45,metalness:.5});
const wash=new T.MeshStandardMaterial({name:'Walk_fin_casing_wash',color:0xfff1dc,emissive:0xffe8c4,emissiveIntensity:1.2,roughness:.4});

// Vertical quads along a polyline, normals out from the casing's middle; u runs in metres along it, or 0-1 with `unit`.
function band(points,y0,y1,{out=0,unit=false}={}){
 const pos=[],nrm=[],uv=[];let u=0;const len=points.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
 for(let i=0;i<points.length-1;i++){
  const [ax,az]=points[i],[bx,bz]=points[i+1],l=Math.hypot(bx-ax,bz-az);let nx=bz-az,nz=ax-bx;
  if(nx*((ax+bx)/2+135)+nz*(az+bz)/2<0){nx=-nx;nz=-nz;}nx/=l;nz/=l;
  const a=[ax+nx*out,az+nz*out],b=[bx+nx*out,bz+nz*out],u0=unit?u/len:u,u1=unit?(u+l)/len:u+l,v0=unit?0:y0,v1=unit?1:y1;
  const quad=[[a,y0,u0,v0],[b,y0,u1,v0],[b,y1,u1,v1],[a,y0,u0,v0],[b,y1,u1,v1],[a,y1,u0,v1]];
  // Wind each quad to face out.
  if(nx*(b[1]-a[1])-nz*(b[0]-a[0])>0)quad.reverse();
  for(const [[x,z],y,qu,qv] of quad){pos.push(x,y,z);nrm.push(nx,0,nz);uv.push(qu,qv);}
  u+=l;
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nrm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 return g;
}
const mesh=(name,geometry,material)=>{const m=new T.Mesh(geometry,material);m.name=name;return m;};

export function createFinCasing(){
 const g=new T.Group();g.name='Walk_fin_root_casing';
 const side=s=>HALF.map(([x,z])=>[x,z*s]),front=[[HALF[0][0],-HALF[0][1]],[HALF[0][0],HALF[0][1]]];
 const ring=[...side(-1).reverse(),...side(1)],back=[ring.at(-1),ring[0]];
 // The main face, then the two cheeks and sides, then the aft end (behind the stair approach wall).
 g.add(mesh('Fin_root_casing_face',band(front,Y0,Y1,{unit:true}),face));
 g.add(mesh('Fin_root_casing_cladding',band(ring.slice(0,HALF.length),Y0,Y1),clad));
 g.add(mesh('Fin_root_casing_cladding',band(ring.slice(HALF.length),Y0,Y1),clad));
 g.add(mesh('Fin_root_casing_cladding',band(back,Y0,Y1),clad));
 // A dark skirting and ceiling band round the visible run, a hair proud of the cladding.
 const run=[...side(-1).reverse(),...side(1)];
 g.add(mesh('Fin_root_casing_skirting',band(run,Y0,Y0+.14,{out:.012}),trim));
 g.add(mesh('Fin_root_casing_cornice',band(run,35.82,Y1,{out:.012}),trim));
 // Upright trims at the main face's corners.
 for(const s of [-1,1]){const x=HALF[0][0],z=HALF[0][1]*s,p=new T.Mesh(new T.BoxGeometry(.06,Y1-Y0,.06),trim);p.position.set(x-.02,(Y0+Y1)/2,z);p.name='Fin_root_casing_corner';g.add(p);}
 // The wash strip under the cornice lights the main face; it is a light, so the walker passes under it.
 const strip=new T.Mesh(new T.BoxGeometry(.08,.05,HALF[0][1]*2-.2),wash);strip.position.set(HALF[0][0]+.06,35.76,0);strip.name='Fin_root_casing_wash_light';g.add(strip);
 g.userData.paintFace={x:HALF[0][0],z0:-HALF[0][1],z1:HALF[0][1],y0:Y0+.14,y1:35.82};
 return g;
}
