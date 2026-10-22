import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCrownSurface } from './CrownSurface.js';
import { createCatHelmetBadge } from './CatHelmetBadge.js';

/** Native procedural geometry. +Y up, +Z forward. Pivot: center of the lower
 * sweatband opening. Nominal opening 2.76 x 1.94 scene units. Scale to wearer.
 * No reference-image projection, external model, texture, or runtime loader.
 */
export function createCaptainsHat({ scale = 1, optimized = true, foldStrength=1, lean=1, detail='medium', creaseTint=1, crownShape={} } = {}) {
  const hat = new THREE.Group();
  hat.name = 'CaptainsHat';
  const mat = {
    cloth: new THREE.MeshStandardMaterial({ name:'Ivory cotton', color:0xf4f3ef, roughness:0.91, vertexColors:true }),
    seam: new THREE.MeshStandardMaterial({ name:'Ivory stitching', color:0xd4d5da, roughness:0.92 }),
    navy: new THREE.MeshStandardMaterial({ name:'Midnight navy', color:0x111b36, roughness:0.51 }),
    visor: new THREE.MeshStandardMaterial({ name:'Navy leather visor', color:0x101832, roughness:0.47, metalness:0.0 }),
    dark: new THREE.MeshStandardMaterial({ name:'Interior and insignia felt', color:0x202621, roughness:0.87 }),
    gold: new THREE.MeshStandardMaterial({ name:'Warm braided gold', color:0xe4ab27, metalness:0.72, roughness:0.3 }),
    bright: new THREE.MeshStandardMaterial({ name:'Gold highlights', color:0xffd253, metalness:0.66, roughness:0.28 }),
    etch: new THREE.MeshStandardMaterial({ name:'Insignia engraving', color:0x48330c, metalness:0.35, roughness:0.46 }),
  };
  function add(geo, material, name, parent=hat) {
    if(material===mat.cloth&&!geo.getAttribute('color'))geo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count*3).fill(1),3));
    const mesh=new THREE.Mesh(geo,material); mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  function tube(points, radius, material, name, parent=hat, segments=80, closed=false) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');
    return add(new THREE.TubeGeometry(curve,segments,radius,6,closed),material,name,parent);
  }
  function ellipsoid(rx,ry,rz,material,name,parent=hat) {
    const g=new THREE.SphereGeometry(1,24,16); g.scale(rx,ry,rz); return add(g,material,name,parent);
  }
  function ring(rx,rz,y,radius,material,name) {
    const pts=[]; for(let i=0;i<128;i++){let a=i/128*Math.PI*2;pts.push([rx*Math.sin(a),y,rz*Math.cos(a)]);}
    return tube(pts,radius,material,name,hat,192,true);
  }
  const surface=createCrownSurface({foldStrength,lean,shape:crownShape});
  const crownPoint=surface.point;
  const tessellation=detail==='high'?{base:128,samples:9}:detail==='low'?{base:48,samples:5}:{base:96,samples:7};
  const ringAngles=t=>surface.angles(t,tessellation);
  const ts=surface.rings(detail),N=ringAngles(0).length-1,R=ts.length-1;
  function shell(inner) {
    const p=[],u=[],ix=[],colors=[];
    for(let j=0;j<R;j++)for(const a of ringAngles(ts[j])){
      p.push(...crownPoint(ts[j],a,inner));u.push(a/(Math.PI*2),ts[j]);
      const tint=inner?1:1-(1-surface.shade(ts[j],a))*creaseTint;colors.push(tint,tint,tint);
    }
    const top=p.length/3;p.push(...crownPoint(1,0,inner));u.push(.5,1);colors.push(1,1,1);
    for(let j=0;j<R-1;j++)for(let i=0;i<N;i++){
      let a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;
      if(inner)ix.push(a,c,b,b,c,d);else ix.push(a,b,c,b,d,c);
    }
    for(let i=0;i<N;i++){let a=(R-1)*(N+1)+i;if(inner)ix.push(a,top,a+1);else ix.push(a,a+1,top);}
    let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setIndex(ix);g.computeVertexNormals();
    const normals=g.attributes.normal;
    for(let j=0;j<R;j++){
      const a=j*(N+1),b=a+N,n=new THREE.Vector3().fromBufferAttribute(normals,a).add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();
      normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);
    }
    return g;
  }
  add(shell(false),mat.cloth,'Soft asymmetric crown');
  add(shell(true),mat.cloth,'Crown inner shell');
  // Close the exposed low-side cloth edge; the navy band hides most of this hem.
  {
    const p=[],ix=[];
    for(let j=0;j<2;j++)for(const a of ringAngles(0))p.push(...crownPoint(0,a,j===1));
    for(let i=0;i<N;i++){let a=i,b=i+1,c=i+N+1,d=c+1;ix.push(a,c,b,b,c,d);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();add(g,mat.cloth,'Turned cloth hem');
  }
  // Open elliptical band: outer wall, inner sweatband and closed edge bridges.
  function bandSurface(rx,rz,y0,y1,inward=false){
    const p=[],ix=[];for(let j=0;j<2;j++)for(let i=0;i<=128;i++){let a=i/128*Math.PI*2;p.push(rx*Math.sin(a),j?y1:y0,rz*Math.cos(a));}
    for(let i=0;i<128;i++){let a=i,b=i+1,c=i+129,d=c+1;if(inward)ix.push(a,c,b,b,c,d);else ix.push(a,b,c,b,d,c);}
    let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;
  }
  add(bandSurface(1.47,1.035,0,.325),mat.navy,'Navy headband');
  add(bandSurface(1.38,.97,0,.325,true),mat.dark,'Open inner sweatband');
  for(let y of [0,.325]){
    const p=[],ix=[];for(let j=0;j<2;j++)for(let i=0;i<=128;i++){let a=i/128*Math.PI*2;p.push((j?1.47:1.38)*Math.sin(a),y,(j?1.035:.97)*Math.cos(a));}
    for(let i=0;i<128;i++){let a=i,b=i+1,c=i+129,d=c+1;if(y)ix.push(a,c,b,b,c,d);else ix.push(a,b,c,b,d,c);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();add(g,mat.navy,'Band edge');
  }
  ring(1.476,1.04,.028,.018,mat.visor,'Lower band piping');
  ring(1.478,1.042,.315,.021,mat.visor,'Upper band piping');
  // Broad projecting visor, curved in both axes; top and underside share shape.
  const visorAt=(s,t,bottom=false)=>{
    let a=s*1.24,spread=.045+.79*Math.pow(Math.cos(s*Math.PI/2),.72);
    return [1.43*Math.sin(a)+t*spread*Math.sin(a)*.24,
      .045-.115*t-.055*t*t+.055*Math.sin(a)**2-(bottom?.055:0),
      1.025*Math.cos(a)+t*spread];
  };
  for(let bottom of [false,true]){
    const p=[],ix=[];let n=96,m=14;
    for(let j=0;j<=m;j++)for(let i=0;i<=n;i++)p.push(...visorAt(i/n*2-1,j/m,bottom));
    for(let j=0;j<m;j++)for(let i=0;i<n;i++){let a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;if(bottom)ix.push(a,b,c,b,d,c);else ix.push(a,c,b,b,c,d);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();add(g,bottom?mat.navy:mat.visor,bottom?'Visor underside':'Curved leather visor');
  }
  const edge=[];for(let i=0;i<=96;i++)edge.push(visorAt(i/96*2-1,1).map((v,k)=>k===1?v-.022:v));
  tube(edge,.033,mat.visor,'Rolled visor edge',hat,160);
  for(let t of [.91,.96]){const p=[];for(let i=0;i<=100;i++){let pt=visorAt(i/100*2-1,t);pt[1]+=.004;p.push(pt);}tube(p,.0035,mat.navy,'Visor stitch line',hat,128);}
  // Two genuinely helical gold cords, resting across the FRONT of the band.
  function ropePoint(t,phase,helix=true){
    const a=(t-.5)*2.34, x=1.482*Math.sin(a),z=1.06*Math.cos(a), y=.226-.061*Math.sin(Math.PI*t);
    const turn=t*56*Math.PI*2+phase,rr=helix?.018:0;
    return [x+Math.sin(a)*rr*Math.cos(turn),y+rr*Math.sin(turn),z+Math.cos(a)*(.038+rr*Math.cos(turn))];
  }
  for(let offset of [-.034,.028])for(let strand=0;strand<3;strand++){
    const pts=[];for(let i=0;i<=1250;i++){let p=ropePoint(i/1250,strand/3*Math.PI*2);p[1]+=offset;pts.push(p);}
    tube(pts,.012,strand===1?mat.bright:mat.gold,'Twisted gold chin cord',hat,720);
  }
  // The reference keeper sits left of the badge. Follow the curved braid
  // there, with every wrap enclosing both cords in the local radial plane.
  const keeperT=.261,keeperA=(keeperT-.5)*2.34;
  const keeperRadius=Math.hypot(1.482*Math.cos(keeperA),1.098*Math.sin(keeperA));
  for(let i=0;i<10;i++){
    const pts=[],a=keeperA+(i-4.5)*.016/keeperRadius,t=a/2.34+.5;
    const x=1.482*Math.sin(a),y=.223-.061*Math.sin(Math.PI*t),z=1.098*Math.cos(a);
    for(let j=0;j<64;j++){
      const turn=j/64*Math.PI*2,radial=.035*Math.cos(turn);
      pts.push([x+Math.sin(a)*radial,y+.064*Math.sin(turn),z+Math.cos(a)*radial]);
    }
    tube(pts,.0082,mat.gold,'Vertical braid keeper wrap',hat,64,true);
  }
  for(let side of [-1,1]){
    const b=new THREE.Group();b.name='Gold side button';b.position.set(side*1.36,.232,.455);b.rotation.y=side*1.17;hat.add(b);
    let disk=new THREE.CylinderGeometry(.091,.091,.032,32);disk.rotateX(Math.PI/2);add(disk,mat.gold,'Button base',b);
    const tor=new THREE.TorusGeometry(.068,.009,6,32);add(tor,mat.bright,'Button inset rim',b).position.z=.02;
    const face=ellipsoid(.046,.054,.01,mat.gold,'Button face',b);face.position.z=.025;
  }
  // Native gold cat-in-helmet relief from the supplied insignia.
  const badge=createCatHelmetBadge(mat);badge.position.set(0,.70,1.32);badge.scale.set(1.0,.93,1);hat.add(badge);
  // Conform the entire embroidered badge to the curved crown, including relief.
  // This keeps its bottom attached instead of floating off a flat tangent plane.
  const frontSurfaceZ=surface.frontZ;
  hat.updateMatrixWorld(true);
  badge.traverse(m=>{
    if(!m.isMesh)return;const p=m.geometry.attributes.position;
    const inverse=m.matrixWorld.clone().invert(),v=new THREE.Vector3();
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);
      v.z=frontSurfaceZ(v.x,v.y)+.008+(v.z-badge.position.z);
      v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);
    }
    p.needsUpdate=true;m.geometry.computeVertexNormals();
  });
  // A restrained welt follows the uneven turn of the top panel, rather than
  // crossing the middle of the crown as a level equatorial stripe.
  const welt=[];for(let i=0;i<224;i++){
    const a=i/224*Math.PI*2,t=.43+.07*Math.cos(a)+.018*Math.sin(2*a),p=crownPoint(t,a);
    p[0]+=.004*Math.sin(a);p[2]+=.004*Math.cos(a);p[1]+=.004;welt.push(p);
  }
  tube(welt,.005,mat.seam,'Uneven upper panel welt',hat,256,true);
  // A soft turned edge finishes the low, exposed cloth tuck without changing
  // the accepted roof profile or adding a second horizontal seam to the crown.
  const hem=[];for(let i=0;i<192;i++){
    const a=i/192*Math.PI*2,p=crownPoint(.004,a);
    p[0]+=.002*Math.sin(a);p[2]+=.002*Math.cos(a);p[1]+=.003;hem.push(p);
  }
  tube(hem,.007,mat.cloth,'Rounded turned cloth edge',hat,224,true);
  hat.updateMatrixWorld(true);
  if(optimized){
    // Merge by material to keep the many cord strands economical at runtime.
    const buckets=new Map();hat.traverse(o=>{if(!o.isMesh)return;const a=buckets.get(o.material)||[];a.push(o);buckets.set(o.material,a);});
    const merged=new THREE.Group();merged.name='CaptainsHat';
    for(const [material,meshes] of buckets){
      const geometries=meshes.map(m=>{let g=m.geometry.clone().applyMatrix4(m.matrixWorld);g.deleteAttribute('uv');if(g.index)g=g.toNonIndexed();return g;});
      const combined=mergeGeometries(geometries),g=mergeVertices(combined,1e-5);combined.dispose();geometries.forEach(g=>g.dispose());
      const mesh=new THREE.Mesh(g,material);mesh.name=material.name;mesh.castShadow=true;mesh.receiveShadow=true;merged.add(mesh);
    }
    hat.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
    merged.scale.setScalar(scale);setMetadata(merged);return merged;
  }
  hat.scale.setScalar(scale);setMetadata(hat);return hat;
}
function setMetadata(hat){
  hat.userData={asset:'Captain hat from supplied single-view illustration',forwardAxis:'+Z',upAxis:'+Y',mountOrigin:'Center of lower opening',nominalOpening:[2.76,1.94],interpretation:'Rear, underside, depth, and hidden construction interpreted from a single image.'};
  hat.dispose=()=>{const gs=new Set(),ms=new Set();hat.traverse(o=>{if(o.isMesh){gs.add(o.geometry);ms.add(o.material);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());};
}
