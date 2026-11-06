// In-page half of scripts/walk-atrium-pvs.mjs, evaluated in a debug walk (window.__walk). It installs
// globalThis.__atriumPvs with three steps the driver calls in batches:
//  setup(levels)  occluders: every static collider triangle the sight test treats as opaque (window and collision-only
//                 faces excluded), re-cut into world-space chunks so each cube face draws only what it can see. Movers
//                 (doors, gates, lift cars, shutters) are left out, so they count as open. The atrium void is drawn as
//                 the prisms of each deck's atrium outline.
//  columns(...)   walkable floors under a grid of (x, z) points.
//  run(samples)   per eye sample, whether any void prism face survives the occluders' depth in a cube map around it,
//                 or the nearest surface lies in the atrium span but outside the eye's own local span: the walk draws
//                 that only while the atrium counts as seen (another deck through a glass stair, say).
// Leaving geometry out only ever shows more of the void, so every simplification here errs towards "visible".
(()=>{
 const w=globalThis.__walk,T=w.T,col=w.colliders,renderer=w.renderer;
 // A lost context draws nothing, so its samples would all read hidden: run() reports it (the driver starts again), from
 // then on for the page's life, so a loss and restore between two runs is not missed.
 let lost=false;for(const e of ['webglcontextlost','webglcontextrestored'])renderer.domElement.addEventListener(e,()=>{lost=true;});
 // FAR: the whole ship's length, past the walk's own far camera (src/walk/main.public.js) at any eye.
 const CHUNK=24,MIN_AREA=.004,TILE=128,ATLAS=2048,PER_ROW=ATLAS/TILE,TILES=PER_ROW*PER_ROW,FAR=600;
 const FACES=[[1,0,0,0,-1,0],[-1,0,0,0,-1,0],[0,1,0,0,0,1],[0,-1,0,0,0,-1],[0,0,1,0,-1,0],[0,0,-1,0,-1,0]];
 let occluders,prisms,voidBox,rt,cameras,pixels,atriumSpan,localSpan;
 function chunked(){
  const chunks=new Map(),t=new Float32Array(9),v=new T.Vector3();let kept=0,skipped=0;
  const add=key=>{let c=chunks.get(key);if(!c)chunks.set(key,c={values:new Float32Array(4096),length:0});if(c.length+9>c.values.length){const g=new Float32Array(c.values.length*2);g.set(c.values);c.values=g;}c.values.set(t,c.length);c.length+=9;};
  const triangle=(p,index,face,matrix)=>{
   for(let k=0;k<3;k++){const i=index?index[face*3+k]:face*3+k;v.set(p[i*3],p[i*3+1],p[i*3+2]);if(matrix)v.applyMatrix4(matrix);t[k*3]=v.x;t[k*3+1]=v.y;t[k*3+2]=v.z;}
   const ax=t[3]-t[0],ay=t[4]-t[1],az=t[5]-t[2],bx=t[6]-t[0],by=t[7]-t[1],bz=t[8]-t[2],cx=ay*bz-az*by,cy=az*bx-ax*bz,cz=ax*by-ay*bx;
   if(Math.sqrt(cx*cx+cy*cy+cz*cz)/2<MIN_AREA){skipped++;return;}
   add([0,1,2].map(a=>Math.floor((t[a]+t[a+3]+t[a+6])/3/CHUNK)).join(','));kept++;
  };
  const each=(bvh,matrices)=>{const g=bvh.geometry,p=g.attributes.position.array,index=g.index?.array,flags=bvh.leoWindowFlags,n=(index?index.length:p.length/3)/3;for(const m of matrices)for(let f=0;f<n;f++)if(!flags?.[f])triangle(p,index,f,m);};
  for(const band of col.bands.values())each(band.bvh,[null]);
  for(const group of col.groups)each(group.bvh,group.items.map(item=>item.matrix));
  // Each surface marks itself when it lies in the atrium span (band.xy) but outside the eye's local span (band.zw); the
  // nearest one wins the depth test, so a marked pixel is such a surface in plain view.
  const material=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{band:{value:new T.Vector4()}},
   // The walk's renderer keeps a logarithmic depth buffer; without its chunks this depth would not compare with the void's.
   vertexShader:'#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying float wy;\nvoid main(){vec4 w=modelMatrix*vec4(position,1.);wy=w.y;gl_Position=projectionMatrix*viewMatrix*w;\n#include <logdepthbuf_vertex>\n}',
   fragmentShader:'#include <logdepthbuf_pars_fragment>\nuniform vec4 band;varying float wy;\nvoid main(){\n#include <logdepthbuf_fragment>\ngl_FragColor=vec4(wy>=band.x&&wy<=band.y&&(wy<band.z||wy>band.w)?1.:0.,0.,0.,1.);}'});
  const scene=new T.Scene();
  for(const c of chunks.values()){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(c.values.slice(0,c.length),3));g.computeBoundingSphere();const m=new T.Mesh(g,material);m.matrixAutoUpdate=false;scene.add(m);}
  scene.updateMatrixWorld(true);scene.matrixWorldAutoUpdate=false;
  return {scene,material,chunks:chunks.size,kept,skipped};
 }
 // `levels` [[outline [[x, z]...], y0, y1]...]: one closed prism per deck, caps included (a ray can enter the void
 // through the floor of a deck whose outline is wider than the one below).
 function prismScene(levels){
  const positions=[],box=new T.Box3();
  for(const [ring,y0,y1] of levels){
   for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];positions.push(a[0],y0,a[1],b[0],y0,b[1],b[0],y1,b[1],a[0],y0,a[1],b[0],y1,b[1],a[0],y1,a[1]);}
   for(const tri of T.ShapeUtils.triangulateShape(ring.map(([x,z])=>new T.Vector2(x,z)),[]))for(const y of [y0,y1])for(const i of tri)positions.push(ring[i][0],y,ring[i][1]);
   for(const [x,z] of ring){box.expandByPoint(new T.Vector3(x,y0,z));box.expandByPoint(new T.Vector3(x,y1,z));}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeBoundingSphere();
  // Pulled towards the eye: a prism face flush with a wall counts as seen.
  const material=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
  const scene=new T.Scene(),mesh=new T.Mesh(g,material);mesh.frustumCulled=false;scene.add(mesh);scene.updateMatrixWorld(true);
  return {scene,box};
 }
 // span: [low, high] the walk draws while the atrium is seen; local: [below, above] the walker's floor that its own
 // span always covers; bands: {base, height} of the walk's bands, which show whole once a span reaches into them
 // (showBands in src/walk/render-bake.js), so both spans widen to band edges.
 let toBands;
 function setup(levels,span,local,bands){
  const started=performance.now();occluders=chunked();prisms=prismScene(levels);voidBox=prisms.box;localSpan=local;
  const edge=(y,up)=>bands.base+(Math.floor((y-bands.base)/bands.height)+(up?1:0))*bands.height;toBands=([a,b])=>[edge(a,false),edge(b,true)];
  atriumSpan=toBands(span);
  rt=new T.WebGLRenderTarget(ATLAS,ATLAS,{depthBuffer:true,stencilBuffer:false});rt.scissorTest=true;pixels=new Uint8Array(ATLAS*ATLAS*4);
  cameras=FACES.map(([x,y,z,ux,uy,uz])=>{const c=new T.PerspectiveCamera(90,1,.05,1000);c.up.set(ux,uy,uz);c.userData.dir=new T.Vector3(x,y,z);return c;});
  return {chunks:occluders.chunks,kept:occluders.kept,skipped:occluders.skipped,ms:Math.round(performance.now()-started),void:[voidBox.min.toArray(),voidBox.max.toArray()]};
 }
 // Every floor in the column at (x, z): an upward face with at least `headroom` of free space above it, as
 // [floor y, free height] pairs. The ray walks down one surface at a time, so decks, mezzanines and furniture all count.
 function columns(x0,z0,nx,nz,step,top,bottom,headroom){
  const ray=new T.Ray(),out=[];
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
   const x=x0+i*step,z=z0+j*step,floors=[];let y=top,above=Infinity;
   for(let n=0;n<200&&y>bottom;n++){
    ray.origin.set(x,y,z);ray.direction.set(0,-1,0);const hit=col.raycast(ray,y-bottom,0);if(!hit)break;
    const at=y-hit.distance;if(Math.abs(hit.normal.y)>.7&&above-at>=headroom)floors.push(+at.toFixed(3),+Math.min(above-at,99).toFixed(3));
    above=at;y=at-.02;
   }
   if(floors.length)out.push(i,j,floors);
  }
  return out;
 }
 const frustum=new T.Frustum(),matrix=new T.Matrix4();
 // samples: flat [x, y, z, walker floor y, ...]. Returns one 0/1 per sample.
 function run(samples){
  const count=samples.length/4,result=new Uint8Array(count),tiles=[],band=occluders.material.uniforms.band.value;let drawn=0;
  const saved={target:renderer.getRenderTarget(),autoClear:renderer.autoClear,color:renderer.getClearColor(new T.Color()),alpha:renderer.getClearAlpha()};
  const flush=()=>{
   if(!tiles.length)return;
   renderer.readRenderTargetPixels(rt,0,0,ATLAS,ATLAS,pixels);
   for(const [tile,sample] of tiles){if(result[sample])continue;const tx=(tile%PER_ROW)*TILE,ty=Math.floor(tile/PER_ROW)*TILE;
    rows:for(let y=ty;y<ty+TILE;y++){const row=(y*ATLAS+tx)*4;for(let x=0;x<TILE;x++)if(pixels[row+x*4]){result[sample]=1;break rows;}}}
   tiles.length=0;
  };
  renderer.autoClear=false;renderer.setClearColor(0x000000,0);
  try{
   for(let s=0;s<count;s++){
    const eye=new T.Vector3(samples[s*4],samples[s*4+1],samples[s*4+2]),floor=samples[s*4+3];
    const [below,above]=toBands([floor+localSpan[0],floor+localSpan[1]]);band.set(atriumSpan[0],atriumSpan[1],below,above);
    // Far enough for the void and for anything in the atrium span (which the walk draws out to its own far plane).
    let far=0;for(const a of ['x','y','z'])far+=Math.max(Math.abs(eye[a]-voidBox.min[a]),Math.abs(eye[a]-voidBox.max[a]))**2;far=Math.max(Math.sqrt(far)+1,FAR);
    for(const c of cameras){
     c.position.copy(eye);c.far=far;c.updateProjectionMatrix();c.lookAt(eye.clone().add(c.userData.dir));c.updateMatrixWorld(true);
     frustum.setFromProjectionMatrix(matrix.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse));
     if(tiles.length===TILES)flush();
     const tile=tiles.length,tx=(tile%PER_ROW)*TILE,ty=Math.floor(tile/PER_ROW)*TILE;
     rt.viewport.set(tx,ty,TILE,TILE);rt.scissor.set(tx,ty,TILE,TILE);renderer.setRenderTarget(rt);renderer.clear(true,true,false);
     renderer.render(occluders.scene,c);renderer.render(prisms.scene,c);tiles.push([tile,s]);drawn++;
    }
   }
   flush();
  }finally{renderer.setRenderTarget(saved.target);renderer.autoClear=saved.autoClear;renderer.setClearColor(saved.color,saved.alpha);}
  return {visible:Array.from(result),faces:drawn,lost:lost||renderer.getContext().isContextLost()};
 }
 globalThis.__atriumPvs={setup,columns,run};
 return true;
})()
