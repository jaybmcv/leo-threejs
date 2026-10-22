import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Sculpted relief traced from the small insignia in the supplied illustration.
 * The reference resolves a cat in a round helmet, antenna, and an oval surround.
 * Curves between those visible landmarks are interpreted; there is no bitmap.
 */
export function createCatHelmetBadge(mat) {
  const badge=new THREE.Group();badge.name='Gold cat helmet insignia';
  const gold=mat.gold.clone();gold.name='Insignia antique gold';gold.color.setHex(0xe9a322);gold.metalness=.72;gold.roughness=.43;
  const charcoal=mat.dark.clone();charcoal.name='Insignia charcoal cloth';charcoal.color.setHex(0x1e2022);charcoal.roughness=.94;
  const add=(geometry,material,name)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
    mesh.castShadow=true;mesh.receiveShadow=true;badge.add(mesh);return mesh;
  };
  const oval=(x,y,rx,ry,rz,z,material,name)=>{
    const g=new THREE.SphereGeometry(1,32,20);g.scale(rx,ry,rz);g.translate(x,y,z);
    return add(g,material,name);
  };
  const cord=(points,r,material,name,closed=false)=>add(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal'),
    closed?128:48,r,8,closed),material,name);
  const relief=(shape,z,material,name,bevel=.004,depth=.009)=>{
    const raw=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:24});
    raw.translate(0,0,z);
    // Interior sampling matters here: every layer is subsequently bent around
    // the crown. Long cap triangles would otherwise bridge over its curvature.
    const dense=new TessellateModifier(.035,10).modify(raw);raw.dispose();
    dense.deleteAttribute('normal');dense.deleteAttribute('uv');
    const g=mergeVertices(dense,.000001);dense.dispose();g.computeVertexNormals();
    return add(g,material,name);
  };
  oval(0,0,.344,.416,.023,0,mat.dark,'Dark bound insignia edge');
  oval(0,0,.335,.405,.027,.018,gold,'Oval gold badge mount');
  const field=new THREE.Shape();field.absellipse(0,0,.315,.382,0,Math.PI*2,false,0);
  relief(field,.019,charcoal,'Charcoal insignia field',.003,.022);
  const perimeter=[];
  for(let i=0;i<128;i++){const a=i/128*Math.PI*2;perimeter.push([.323*Math.sin(a),.391*Math.cos(a),.029]);}
  cord(perimeter,.006,mat.bright,'Fine oval gold border',true);

  // Round helmet shell with a flattened brow and the low, rounded chin ring.
  const shell=new THREE.Shape();
  shell.moveTo(0,.170);shell.bezierCurveTo(-.118,.170,-.213,.097,-.219,.018);
  shell.bezierCurveTo(-.258,-.006,-.260,-.086,-.227,-.105);
  shell.bezierCurveTo(-.220,-.270,-.119,-.342,0,-.342);
  shell.bezierCurveTo(.133,-.342,.217,-.258,.224,-.106);
  shell.bezierCurveTo(.260,-.082,.256,-.014,.223,.008);
  shell.bezierCurveTo(.218,.094,.118,.168,0,.170);
  relief(shell,.045,gold,'Helmet outer silhouette',.006,.051);

  // A real ellipsoidal half-cap. Interior vertices follow the curvature rather
  // than spanning the entire stamped face with a few flat extrusion triangles.
  const capPositions=[0,.018,.175],capIndices=[],arcs=64,rings=20;
  for(let j=1;j<=rings;j++){
    const r=Math.sin(j/rings*Math.PI/2);
    for(let i=0;i<=arcs;i++){
      const a=i/arcs*Math.PI;
      capPositions.push(.210*r*Math.cos(a),.018+.151*r*Math.sin(a),.108+.067*Math.cos(j/rings*Math.PI/2));
    }
  }
  for(let i=0;i<arcs;i++)capIndices.push(0,i+1,i+2);
  for(let j=0;j<rings-1;j++)for(let i=0;i<arcs;i++){
    const a=1+j*(arcs+1)+i,b=a+1,c=a+arcs+1,d=c+1;
    capIndices.push(a,c,b,b,c,d);
  }
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(capPositions,3));cap.setIndex(capIndices);cap.computeVertexNormals();
  add(cap,gold,'Convex gold helmet canopy');
  const capLip=[];for(let i=0;i<=64;i++){
    const a=i/64*Math.PI;capLip.push([.210*Math.cos(a),.018+.151*Math.sin(a),.107]);
  }
  cord(capLip,.006,gold,'Supported canopy edge');

  const window=new THREE.Shape();
  window.moveTo(-.188,.012);window.bezierCurveTo(-.114,.025,.118,.025,.187,.009);
  window.bezierCurveTo(.208,-.025,.197,-.198,.151,-.259);
  window.bezierCurveTo(.102,-.320,-.101,-.320,-.154,-.260);
  window.bezierCurveTo(-.198,-.180,-.208,-.025,-.188,.012);
  relief(window,.098,charcoal,'Recessed helmet face opening',.003,.027);
  cord([[-.194,.003,.136],[-.198,-.112,.138],[-.150,-.260,.138],[0,-.323,.139],[.150,-.260,.138],[.199,-.112,.137],[.193,.003,.136]],.0065,mat.bright,'Helmet window lip');
  cord([[-.205,.014,.124],[-.13,.017,.160],[0,.018,.175],[.13,.017,.160],[.205,.011,.124]],.006,mat.etch,'Dark helmet brow');
  // Small antenna with a spherical tip, fine stem, and broad mounting hub.
  oval(0,.190,.033,.026,.022,.111,mat.bright,'Antenna mounting boss');
  cord([[0,.205,.115],[0,.284,.111]],.006,gold,'Antenna stem');
  oval(0,.296,.013,.017,.012,.113,mat.bright,'Antenna ball');
  // Side pads protrude beside the opening as in the reference.
  for(const s of [-1,1]){
    oval(s*.226,-.060,.025,.057,.018,.112,gold,'Helmet side pad');
    cord([[s*.220,-.021,.133],[s*.225,-.071,.134],[s*.209,-.120,.133]],.005,mat.bright,'Side pad highlight');
  }
  // Face landmarks follow the supplied 700px illustration (badge centre near
  // 399,175). Keep the slightly uneven eyes and squarer, low whisker pads;
  // mirroring a generic round cat icon loses these small but visible traits.
  const firstCatPart=badge.children.length;
  const cat=new THREE.Shape();
  cat.moveTo(-.120,-.206);cat.lineTo(-.104,-.062);
  cat.quadraticCurveTo(-.102,-.044,-.093,-.057);cat.lineTo(-.067,-.096);
  cat.quadraticCurveTo(-.010,-.083,.058,-.090);cat.lineTo(.087,-.048);
  cat.quadraticCurveTo(.097,-.033,.101,-.051);cat.lineTo(.118,-.197);
  cat.lineTo(.141,-.228);cat.quadraticCurveTo(.146,-.243,.132,-.259);
  cat.lineTo(.116,-.272);cat.quadraticCurveTo(.070,-.294,.012,-.296);
  cat.quadraticCurveTo(-.055,-.294,-.105,-.279);
  cat.lineTo(-.131,-.264);cat.quadraticCurveTo(-.146,-.248,-.134,-.231);
  cat.lineTo(-.120,-.206);
  const face=relief(cat,.115,gold,'Gold cat face and pointed ears',.006,.047);
  const denseFace=new TessellateModifier(.018,9).modify(face.geometry);
  face.geometry.dispose();face.geometry=denseFace;
  for(const s of [-1,1]){
    const ear=new THREE.Shape();
    if(s<0){ear.moveTo(-.099,-.068);ear.lineTo(-.094,-.112);ear.lineTo(-.077,-.102);}
    else {ear.moveTo(.094,-.061);ear.lineTo(.074,-.098);ear.lineTo(.101,-.109);}
    ear.closePath();
    relief(ear,.168,mat.etch,'Dark triangular inner ear',.001,.008);
    const eye=s<0?[-.044,-.181,.020,.026]:[.061,-.171,.019,.025];
    oval(...eye,.007,.174,mat.dark,'Dark round cat eye');
    const mx=s<0?-.019:.040,my=s<0?-.246:-.242;
    oval(mx,my,.032,.022,.007,.174,gold,'Raised cat muzzle pad');
    for(let j=0;j<2;j++){
      const innerY=-.247-j*.026+(s>0?.004:0);
      cord([[s*.057+.008,innerY,.169],[s*.106,innerY-.003,.169],[s*.155,innerY+.002,.169]],.0034,mat.etch,'Engraved cheek whisker');
    }
  }
  const nose=new THREE.Shape();nose.moveTo(-.009,-.207);nose.quadraticCurveTo(.008,-.201,.025,-.207);nose.quadraticCurveTo(.022,-.223,.008,-.228);nose.quadraticCurveTo(-.006,-.224,-.009,-.207);
  relief(nose,.167,mat.etch,'Small triangular cat nose',.001,.022);
  cord([[.008,-.226,.188],[.009,-.246,.181],[-.006,-.253,.180],[-.021,-.250,.180]],.0027,mat.etch,'Cat mouth left');
  cord([[.009,-.246,.181],[.025,-.251,.180],[.041,-.247,.180]],.0027,mat.etch,'Cat mouth right');
  // Low, open cheek contours replace the two closed moustache-like loops.
  for(const s of [-1,1]){
    const mx=s<0?-.019:.040,my=s<0?-.246:-.242;
    const contour=[[s*.025,.006],[s*.029,-.003],[s*.017,-.017],[-s*.004,-.020]]
      .map(([dx,dy])=>[mx+dx,my+dy,.1735+.007*Math.sqrt(Math.max(0,1-(dx/.032)**2-(dy/.022)**2))]);
    cord(contour,.0017,mat.etch,'Fine engraved muzzle contour');
  }
  // The whole little face is a softly convex stamping. Applying the same
  // offset to the eyes, ears and muzzle keeps their relief attached to it.
  for(const part of badge.children.slice(firstCatPart)){
    const p=part.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i);
      const weight=part===face?THREE.MathUtils.clamp((p.getZ(i)-.115)/.047,0,1):1;
      p.setZ(i,p.getZ(i)+weight*.037*Math.exp(-((x/.120)**2)-(((y+.178)/.137)**2)));
    }
    if(part===face){
      part.geometry.deleteAttribute('normal');part.geometry.deleteAttribute('uv');
      const smooth=mergeVertices(part.geometry,.000001);part.geometry.dispose();part.geometry=smooth;
    }
    part.geometry.computeVertexNormals();
  }
  // A tiny gold fitting in the top-right of the dark window is visible in the art.
  oval(.160,-.023,.012,.014,.009,.135,mat.gold,'Small window fitting');
  // A shallow stamped emblem rather than a miniature freestanding sculpture.
  // Compress every layer together, including bevels and engraved details, so
  // support contacts survive and the silhouette still follows the cloth.
  const reliefDepth=.23;
  badge.traverse(part=>{
    if(!part.isMesh)return;
    part.geometry.scale(1,1,reliefDepth);
    part.geometry.computeVertexNormals();
  });
  badge.userData.reliefDepthScale=reliefDepth;
  return badge;
}
