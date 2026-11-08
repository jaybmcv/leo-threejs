// In-page half of scripts/walk-atrium-pvs.mjs, evaluated in a debug walk (window.__walk). It installs
// globalThis.__atriumPvs with three steps the driver calls in batches:
//  setup(levels)  occluders: every static collider triangle the sight test treats as opaque (window and collision-only
//                 faces excluded), re-cut into world-space chunks so each cube face draws only what it can see. Lift
//                 landing doors count as shut (their leaves where a shut door puts them): a lift lobby otherwise saw up
//                 the shaft into the atrium and drew every deck. The walk asks its rays instead near a landing whose
//                 doors are open (atrium-sight.js `unbaked`). Other movers (gates, lift cars, shutters) are left out,
//                 so they count as open. The atrium void is drawn as the prisms of each deck's atrium outline.
//  columns(...)   walkable floors under a grid of (x, z) points.
//  run(samples)   per eye sample, whether any void prism face survives the occluders' depth in a cube map around it,
//                 or the nearest surface lies in the atrium span but outside the eye's own local span: the walk draws
//                 that only while the atrium counts as seen (another deck through a glass stair, say). With it, the
//                 heights that sight reaches (RANGE_Y0 + RANGE_SPAN * [lo, hi] / 255): the nearest surfaces that mark
//                 the eye, those seen through the void, and the top of the range where the void shows nothing behind
//                 it. The walk then draws only those heights, not every atrium deck (src/v2/atrium-pvs.js).
// Leaving geometry out only ever shows more of the void, so every simplification here errs towards "visible".
(()=>{
 const w=globalThis.__walk,T=w.T,col=w.colliders,renderer=w.renderer;
 // A lost context draws nothing, so its samples would all read hidden: run() reports it (the driver starts again), from
 // then on for the page's life, so a loss and restore between two runs is not missed.
 let lost=false;for(const e of ['webglcontextlost','webglcontextrestored'])renderer.domElement.addEventListener(e,()=>{lost=true;});
 // FAR: the whole ship's length, past the walk's own far camera (src/walk/main.public.js) at any eye.
 const CHUNK=24,MIN_AREA=.004,TILE=128,ATLAS=2048,PER_ROW=ATLAS/TILE,TILES=PER_ROW*PER_ROW,FAR=600;
 // Each chunk's triangles, in their drawing order, fall into runs whose box spans at most RUN_SIZE m a side; a cube face
 // draws only the runs whose bounding sphere, grown by RUN_MARGIN m, reaches its frustum (drawRuns, below).
 const RUN_SIZE=16,RUN_MARGIN=.05;
 // Heights a sight reaches, as bytes: RANGE_Y0 + RANGE_SPAN * byte / 255 (PVS_RANGE in src/v2/atrium-pvs.js; the driver checks).
 const RANGE_Y0=-45,RANGE_SPAN=180;
 const FACES=[[1,0,0,0,-1,0],[-1,0,0,0,-1,0],[0,1,0,0,0,1],[0,-1,0,0,0,-1],[0,0,1,0,-1,0],[0,0,-1,0,-1,0]];
 let occluders,prisms,voidBox,rt,cameras,pixels,atriumSpan,localSpan;
 function chunked(){
  const chunks=new Map(),t=new Float32Array(9),v=new T.Vector3();let kept=0,skipped=0;
  const add=key=>{let c=chunks.get(key);if(!c)chunks.set(key,c={values:new Float32Array(4096),length:0,runs:[]});if(c.length+9>c.values.length){const g=new Float32Array(c.values.length*2);g.set(c.values);c.values=g;}c.values.set(t,c.length);
   // The run this triangle joins: the chunk's last, or a new one when that would grow wider than RUN_SIZE.
   let r=c.runs.at(-1);const lo=[0,1,2].map(a=>Math.min(t[a],t[a+3],t[a+6])),up=[0,1,2].map(a=>Math.max(t[a],t[a+3],t[a+6]));
   if(!r||[0,1,2].some(a=>Math.max(r.max[a],up[a])-Math.min(r.min[a],lo[a])>RUN_SIZE))c.runs.push(r={first:c.length/3,count:0,min:lo,max:up});
   else for(let a=0;a<3;a++){r.min[a]=Math.min(r.min[a],lo[a]);r.max[a]=Math.max(r.max[a],up[a]);}
   r.count+=3;c.length+=9;};
  const triangle=(p,index,face,matrix)=>{
   for(let k=0;k<3;k++){const i=index?index[face*3+k]:face*3+k;v.set(p[i*3],p[i*3+1],p[i*3+2]);if(matrix)v.applyMatrix4(matrix);t[k*3]=v.x;t[k*3+1]=v.y;t[k*3+2]=v.z;}
   const ax=t[3]-t[0],ay=t[4]-t[1],az=t[5]-t[2],bx=t[6]-t[0],by=t[7]-t[1],bz=t[8]-t[2],cx=ay*bz-az*by,cy=az*bx-ax*bz,cz=ax*by-ay*bx;
   if(Math.sqrt(cx*cx+cy*cy+cz*cz)/2<MIN_AREA){skipped++;return;}
   add([0,1,2].map(a=>Math.floor((t[a]+t[a+3]+t[a+6])/3/CHUNK)).join(','));kept++;
  };
  const each=(bvh,matrices)=>{const g=bvh.geometry,p=g.attributes.position.array,index=g.index?.array,flags=bvh.leoWindowFlags,n=(index?index.length:p.length/3)/3;for(const m of matrices)for(let f=0;f<n;f++)if(!flags?.[f])triangle(p,index,f,m);};
  for(const band of col.bands.values())each(band.bvh,[null]);
  for(const group of col.groups)each(group.bvh,group.items.map(item=>item.matrix));
  // Shut landing doors, from the lift data (src/walk/lifts.js shutLandingDoors): a colliders-only page (--prepared) has
  // them on __walk, as does a debug walk.
  for(const b of w.landingDoors||[]){const g=new T.BoxGeometry(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2]);
   g.translate((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);const p=g.attributes.position.array,index=g.index.array;
   for(let f=0;f<index.length/3;f++)triangle(p,index,f,null);g.dispose();}
  // Each surface marks itself in red when it lies in the atrium span (band.xy) but outside the eye's local span (band.zw),
  // and writes its height in green and that it is there in blue; the nearest one wins the depth test, so a marked pixel
  // is such a surface in plain view. Alpha stays 0 for the void's pass.
  const material=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{band:{value:new T.Vector4()}},
   // The walk's renderer keeps a logarithmic depth buffer; without its chunks this depth would not compare with the void's.
   vertexShader:'#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying float wy;\nvoid main(){vec4 w=modelMatrix*vec4(position,1.);wy=w.y;gl_Position=projectionMatrix*viewMatrix*w;\n#include <logdepthbuf_vertex>\n}',
   fragmentShader:'#include <logdepthbuf_pars_fragment>\nuniform vec4 band;varying float wy;\nvoid main(){\n#include <logdepthbuf_fragment>\ngl_FragColor=vec4(wy>=band.x&&wy<=band.y&&(wy<band.z||wy>band.w)?1.:0.,clamp((wy-('+RANGE_Y0.toFixed(1)+'))/'+RANGE_SPAN.toFixed(1)+',0.,1.),1.,0.);}'});
  const scene=new T.Scene();
  // Every run of every chunk, in one list: its first vertex and vertex count in its chunk, and its bounding sphere (the
  // centre and half diagonal of its box). Each chunk's mesh names the span of its runs in the list as it is drawn.
  const total=[...chunks.values()].reduce((n,c)=>n+c.runs.length,0),runs={firsts:new Int32Array(total),counts:new Int32Array(total),spheres:new Float64Array(total*4),faces:new Uint8Array(total)};let at=0;
  for(const c of chunks.values()){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(c.values.slice(0,c.length),3));g.computeBoundingSphere();const m=new T.Mesh(g,material);m.matrixAutoUpdate=false;
   const span={from:at,to:at+c.runs.length,vertices:c.length/3};
   for(const r of c.runs){runs.firsts[at]=r.first;runs.counts[at]=r.count;let d=0;for(let a=0;a<3;a++){runs.spheres[at*4+a]=(r.min[a]+r.max[a])/2;d+=(r.max[a]-r.min[a])**2;}runs.spheres[at*4+3]=Math.sqrt(d)/2;at++;}
   m.onBeforeRender=()=>{drawing=occluding?span:null;};m.onAfterRender=()=>{drawing=null;};scene.add(m);}
  scene.updateMatrixWorld(true);scene.matrixWorldAutoUpdate=false;
  return {scene,material,chunks:chunks.size,runs,kept,skipped};
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
  // Pulled towards the eye: a prism face flush with a wall counts as seen. It adds only to alpha (black, additive), so the
  // height of the surface behind it stays in green.
  const material=new T.MeshBasicMaterial({color:0x000000,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
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
  return {chunks:occluders.chunks,runs:occluders.runs.firsts.length,kept:occluders.kept,skipped:occluders.skipped,ms:Math.round(performance.now()-started),void:[voidBox.min.toArray(),voidBox.max.toArray()]};
 }
 // Three draws each chunk that a cube face's frustum reaches with one drawArrays, its chunks in its usual order. drawRuns
 // stands in for that call (so far a chunk was drawn whole, and an eye drew each triangle about three times): it draws the chunk's runs in their order but leaves out those wholly outside the face's
 // frustum, which would have drawn no pixel. Nothing else changes, so every pixel is as before: a triangle that covers no
 // pixel takes no part in the depth test, and ties between equal depths still go the same way.
 // A face's frustum (FACES: a 90 degree square pyramid along one axis, from the eye) holds a sphere at d from the eye, of
 // radius r, only if d's component along the face's axis is at least minus r root 2 more than each other component's
 // size. faceMasks marks, per run, the faces that may see it (bit f for FACES[f]), once per eye; the near and far planes
 // are not used, which only keeps more. A run left out lies RUN_MARGIN (5 cm) or more outside a side plane, and a pixel
 // centre lies inside it by at least half a pixel (0.3% of its distance), while the GPU's 32-bit view of the ship (within
 // about 300 m of the origin) is out by about a tenth of a millimetre: so a left-out triangle covers no pixel.
 // drawRuns stands in only while run() draws the occluders (`occluding`), and only for a chunk's whole triangle list.
 // Without WEBGL_multi_draw every chunk draws whole, as before.
 const gl=renderer.getContext(),multiDraw=gl.getExtension('WEBGL_multi_draw'),drawArrays=gl.drawArrays.bind(gl);
 let drawing=null,occluding=false,face=0,firstsOut=new Int32Array(4096),countsOut=new Int32Array(4096);
 function faceMasks(eye){
  const {spheres,faces}=occluders.runs,n=faces.length,ex=eye.x,ey=eye.y,ez=eye.z;
  for(let i=0;i<n;i++){
   const dx=spheres[i*4]-ex,dy=spheres[i*4+1]-ey,dz=spheres[i*4+2]-ez,k=(spheres[i*4+3]+RUN_MARGIN)*Math.SQRT2;
   const a=dx-dy,b=dx+dy,c=dx-dz,d=dx+dz,e=dy-dz,f=dy+dz;
   faces[i]=(a>=-k&&b>=-k&&c>=-k&&d>=-k?1:0)|(a<=k&&b<=k&&c<=k&&d<=k?2:0)|(a<=k&&b>=-k&&e>=-k&&f>=-k?4:0)
    |(a>=-k&&b<=k&&e<=k&&f<=k?8:0)|(c<=k&&d>=-k&&e<=k&&f>=-k?16:0)|(c>=-k&&d<=k&&e>=-k&&f<=k?32:0);
  }
 }
 function drawRuns(mode,start,count){
  const span=drawing;drawing=null;
  // Anything else (the void's prisms) draws as asked.
  if(!span||!occluding||!multiDraw||mode!==gl.TRIANGLES||start!==0||count!==span.vertices)return drawArrays(mode,start,count);
  const {firsts,counts,faces}=occluders.runs,bit=1<<face;
  if(firstsOut.length<span.to-span.from){firstsOut=new Int32Array(span.to-span.from);countsOut=new Int32Array(span.to-span.from);}
  let out=0;
  for(let i=span.from;i<span.to;i++){
   if(!(faces[i]&bit))continue;
   // Runs next to each other in the buffer draw as one range.
   if(out&&firstsOut[out-1]+countsOut[out-1]===firsts[i])countsOut[out-1]+=counts[i];else{firstsOut[out]=firsts[i];countsOut[out]=counts[i];out++;}
  }
  if(out)multiDraw.multiDrawArraysWEBGL(mode,firstsOut,0,countsOut,0,out);
 }
 gl.drawArrays=drawRuns;
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
 // samples: flat [x, y, z, walker floor y, ...]. Returns one 0/1 per sample, and the heights each one's sight reaches.
 function run(samples){
  const count=samples.length/4,result=new Uint8Array(count),lo=new Uint8Array(count).fill(255),hi=new Uint8Array(count),tiles=[],band=occluders.material.uniforms.band.value;let drawn=0;
  const saved={target:renderer.getRenderTarget(),autoClear:renderer.autoClear,color:renderer.getClearColor(new T.Color()),alpha:renderer.getClearAlpha()};
  const flush=()=>{
   if(!tiles.length)return;
   renderer.readRenderTargetPixels(rt,0,0,ATLAS,ATLAS,pixels);
   for(const [tile,sample] of tiles){const tx=(tile%PER_ROW)*TILE,ty=Math.floor(tile/PER_ROW)*TILE;let l=lo[sample],h=hi[sample];
    for(let y=ty;y<ty+TILE;y++){const row=(y*ATLAS+tx)*4;for(let x=0;x<TILE;x++){const p=row+x*4,through=pixels[p+3];if(!pixels[p]&&!through)continue;
     // Through the void with nothing behind: the top of the range.
     const at=pixels[p+2]?pixels[p+1]:255;result[sample]=1;if(at<l)l=at;if(at>h)h=at;}}
    lo[sample]=l;hi[sample]=h;}
   tiles.length=0;
  };
  renderer.autoClear=false;renderer.setClearColor(0x000000,0);
  try{
   for(let s=0;s<count;s++){
    const eye=new T.Vector3(samples[s*4],samples[s*4+1],samples[s*4+2]),floor=samples[s*4+3];
    const [below,above]=toBands([floor+localSpan[0],floor+localSpan[1]]);band.set(atriumSpan[0],atriumSpan[1],below,above);
    // Far enough for the void and for anything in the atrium span (which the walk draws out to its own far plane).
    let far=0;for(const a of ['x','y','z'])far+=Math.max(Math.abs(eye[a]-voidBox.min[a]),Math.abs(eye[a]-voidBox.max[a]))**2;far=Math.max(Math.sqrt(far)+1,FAR);
    faceMasks(eye);
    for(const [f,c] of cameras.entries()){face=f;
     c.position.copy(eye);c.far=far;c.updateProjectionMatrix();c.lookAt(eye.clone().add(c.userData.dir));c.updateMatrixWorld(true);
     frustum.setFromProjectionMatrix(matrix.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse));
     if(tiles.length===TILES)flush();
     const tile=tiles.length,tx=(tile%PER_ROW)*TILE,ty=Math.floor(tile/PER_ROW)*TILE;
     rt.viewport.set(tx,ty,TILE,TILE);rt.scissor.set(tx,ty,TILE,TILE);renderer.setRenderTarget(rt);renderer.clear(true,true,false);
     drawing=null;occluding=true;try{renderer.render(occluders.scene,c);}finally{occluding=false;drawing=null;}
     renderer.render(prisms.scene,c);tiles.push([tile,s]);drawn++;
    }
   }
   flush();
  }finally{renderer.setRenderTarget(saved.target);renderer.autoClear=saved.autoClear;renderer.setClearColor(saved.color,saved.alpha);}
  return {visible:Array.from(result),lo:Array.from(lo,(v,i)=>result[i]?v:0),hi:Array.from(hi),faces:drawn,lost:lost||renderer.getContext().isContextLost()};
 }
 globalThis.__atriumPvs={setup,columns,run,range:{y0:RANGE_Y0,span:RANGE_SPAN}};
 return true;
})()
