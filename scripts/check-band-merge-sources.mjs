import assert from 'node:assert/strict';
import * as T from 'three';
import {kindTexel, mergePhoneBands} from '../src/v2/phone-bands.js';
import {floorBlocker} from '../src/v2/floor-occlusion.js';
import {cornerShadeSkipsName} from '../src/walk/corner-shade.js';
import {readFileSync} from 'node:fs';

// The band merge's copied sources (src/v2/phone-bands.js), without a GPU: a band's children whose every drawable was
// copied move into one hidden group in that band, in the same place in the world; the band itself stays as it was; a
// part hidden by other code, and a group mixing copied and other parts, stay where they are.
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
const material=new T.MeshStandardMaterial({name:'Walk_finish_check'}),other=new T.MeshStandardMaterial({name:'Walk_other_check',color:0xff0000});
const box=(m,x)=>{const o=new T.Mesh(new T.BoxGeometry(1,1,1),m);o.position.set(x,0,0);o.updateMatrix();return o;};
const scene=new T.Scene(),bands=new Map();
const band=n=>{const g=new T.Group();g.name='Walk_band_'+n;g.userData.band=n;g.position.set(0,n*4,0);bands.set(n,g);scene.add(g);return g;};
const b1=band(1),b2=band(2);
const a=box(material,0),c=box(material,10);b1.add(a);b2.add(c);
// A group of parts the merge copies (a deck's guides), a part hidden for now by other code, and a group with both.
const guides=new T.Group();guides.name='Guides';guides.userData.bandMergeParts=true;const g1=box(material,20),g2=box(material,30);guides.add(g1,g2);b1.add(guides);
const later=box(other,40);later.visible=false;b2.add(later);
const mixed=new T.Group();mixed.name='Mixed';mixed.userData.bandMergeParts=true;const m1=box(material,50),m2=box(other,60);m2.visible=false;mixed.add(m1,m2);b2.add(mixed);
scene.updateMatrixWorld(true);
const world=new Map([a,c,g1,g2,later,m1].map(o=>[o,o.getWorldPosition(new T.Vector3())]));
const merged=await mergePhoneBands({bands},scene,{});
assert.equal(merged.root.children.length,1);assert([a,c,g1,g2,m1].every(o=>o.userData.bandMerged&&!o.visible));pass('the merge copies and hides the material\'s parts');
const kept1=b1.children.find(o=>o.userData.mergedSources),kept2=b2.children.find(o=>o.userData.mergedSources);
assert(kept1&&kept2&&!kept1.visible&&!kept2.visible);assert.equal(kept1.name,'Walk_band_1_merged_sources');
assert(a.parent===kept1&&guides.parent===kept1&&c.parent===kept2);pass('copied parts, and a group of only copied parts, move into a hidden group in their band');
assert(later.parent===b2&&mixed.parent===b2);pass('a part hidden by other code, and a group with any such part, stay where they are');
assert(b1.visible&&b2.visible&&b1.children.length===1&&b2.children.length===3);pass('the bands stay visible, each holding what it did');
scene.updateMatrixWorld(true);for(const [o,p] of world)assert(o.getWorldPosition(new T.Vector3()).distanceTo(p)<1e-9,'moved in the world: '+o.position.x);pass('everything keeps its place in the world');
// A desktop's pieces (piece): every triangle lands in exactly one piece, in band order; a piece shows only the bands
// showBands shows, bounded by them, view-culled, and kept out of the fog cull.
{const scene=new T.Scene(),bands=new Map(),mat=new T.MeshStandardMaterial({name:'Walk_square_check'}),parts=[];
 for(const n of [1,2,3]){const g=new T.Group();g.name='Walk_band_'+n;g.userData.band=n;g.position.set(0,n*4,0);bands.set(n,g);scene.add(g);
  for(const x of [-35,-5,5,25,61]){const o=new T.Mesh(new T.BoxGeometry(2,1,2),mat);o.position.set(x+n,0,n*7-14);g.add(o);parts.push([o,n]);}}
 scene.updateMatrixWorld(true);
 const tri=(a,i)=>[0,1,2].map(j=>[a.getX(i[j]),a.getY(i[j]),a.getZ(i[j])].map(v=>v.toFixed(4)).join(',')).join(' ');
 const before=new Map();for(const [o] of parts){const g=o.geometry.clone().applyMatrix4(o.matrixWorld),ix=g.index.array;for(let k=0;k<ix.length;k+=3){const t=tri(g.attributes.position,[ix[k],ix[k+1],ix[k+2]]);before.set(t,(before.get(t)||0)+1);}}
 const merged=await mergePhoneBands({bands},scene,{piece:24}),meshes=merged.root.children;
 assert(meshes.length>=8&&meshes.every(m=>m.geometry.index.count/3<=24));assert.equal(merged.proof.meshes,1);assert.equal(merged.proof.regions,meshes.length);
 assert(meshes.every(m=>m.frustumCulled&&m.userData.fogBackdrop&&m.name==='V2_low_deck_merged_Walk_square_check'));pass('a desktop merge splits into view-culled pieces of at most the given triangles, kept out of the fog cull');
 const after=new Map(),bandOf=new Map();
 for(const m of meshes){const g=m.geometry,ix=g.index.array;for(let k=0;k<ix.length;k+=3){const t=tri(g.attributes.position,[ix[k],ix[k+1],ix[k+2]]);after.set(t,(after.get(t)||0)+1);}}
 assert.deepEqual([...after].sort(),[...before].sort());pass('every triangle is drawn by exactly one piece, in place');
 bands.get(2).visible=false;merged.update();
 for(const m of meshes){const g=m.geometry,ix=g.index.array,box=new T.Box3(),v=new T.Vector3();let shown=0;
  for(const gr of g.groups)for(let k=gr.start;k<gr.start+gr.count;k++){v.fromBufferAttribute(g.attributes.position,ix[k]);box.expandByPoint(v);shown++;
   assert(Math.abs(v.y-8)>1,'a hidden band drawn');}
  if(!shown){assert(!m.visible);continue;}
  assert(m.visible&&g.boundingBox.equals(box),'piece bounds are its shown bands');{const s=g.boundingSphere;assert(s.center.distanceTo(box.min)<=s.radius+1e-9&&s.center.distanceTo(box.max)<=s.radius+1e-9,"piece sphere holds its box");}
  let last=-1;for(const gr of g.groups){assert(gr.start>last);last=gr.start;}}
 pass('a piece draws only the shown bands, in order, and is bounded by them');
 bands.get(2).visible=true;merged.update();assert.equal(meshes.reduce((n,m)=>n+m.geometry.groups.reduce((c,gr)=>c+gr.count,0),0)/3,[...before.values()].reduce((a,b)=>a+b,0));pass('showing the band again draws every triangle');}
// Deck kinds (kinds, with pieces): the finishes equal but for roughness and metalness merge as one kind, their pieces
// slices of one set of arrays, each vertex reading its own material's values through its texel; a finish of another side,
// one corner shading leaves alone, and anything else merge per material; the texels follow their materials.
{const scene=new T.Scene(),bands=new Map(),parts=[];
 const finish=(name,roughness,metalness,side=T.FrontSide)=>new T.MeshStandardMaterial({name,vertexColors:true,roughness,metalness,side});
 const A=finish('Walk_finish_3|1|0|0',.3,.1),B=finish('Walk_finish_7|5|0|0',.7,.5),D=finish('Walk_finish_7|5|2|0',.7,.5,T.DoubleSide),E=finish('Walk_finish_5|5|0|0',.5,.5),other=new T.MeshStandardMaterial({name:'Walk_other_kind'});
 const part=(m,x,n,uv=true)=>{const g=new T.BoxGeometry(2,1,2);if(!uv)g.deleteAttribute('uv');g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(.6),3));
  const o=new T.Mesh(g,m);o.position.set(x+n,0,n*7-14);return o;};
 for(const n of [1,2,3]){const g=new T.Group();g.name='Walk_band_'+n;g.userData.band=n;g.position.set(0,n*4,0);bands.set(n,g);scene.add(g);
  // A with a uv and without (two buckets of one material), B, D (another side), E (left alone), another material.
  for(const [m,x,uv] of [[A,-35,true],[A,-20,false],[B,-5,true],[B,25,true],[D,40,true],[E,55,true],[other,61,true]]){const o=part(m,x,n,uv);g.add(o);parts.push([o,m]);}}
 scene.updateMatrixWorld(true);
 const tri=(a,i)=>[0,1,2].map(j=>[a.getX(i[j]),a.getY(i[j]),a.getZ(i[j])].map(v=>v.toFixed(4)).join(',')).join(' ');
 const want=new Map();for(const [o,m] of parts){if(m===D||m===E||m===other)continue;const g=o.geometry.clone().applyMatrix4(o.matrixWorld),ix=g.index.array;for(let k=0;k<ix.length;k+=3)want.set(tri(g.attributes.position,[ix[k],ix[k+1],ix[k+2]]),m);}
 const merged=await mergePhoneBands({bands},scene,{piece:40,kinds:true,alone:m=>m===E}),meshes=merged.root.children;
 assert.equal(merged.proof.kinds,1);assert.equal(merged.kinds.length,1);const K=merged.kinds[0];
 assert.deepEqual(K.materials,[A,A,B]);pass('the finishes equal but for roughness and metalness are one kind (one material with and without a uv is two buckets); another side, one left alone and another material stay apart');
 const pieces=meshes.filter(m=>m.userData.deckKind===0);assert(pieces.length>=2&&pieces.every(m=>m.name==='V2_low_deck_merged_Walk_finish_kind_0'&&m.material.length===1&&m.material[0]===K.material));
 assert(pieces.every(m=>Object.keys(K.geometry.attributes).every(k=>m.geometry.attributes[k]===K.geometry.attributes[k])&&m.geometry.index===K.geometry.index),'pieces share the kind attributes and index');
 assert.deepEqual(Object.keys(K.geometry.attributes).sort(),['color','normal','position','uv']);const uv=K.geometry.attributes.uv;assert(uv.array instanceof Uint16Array&&uv.normalized);
 {const spans=pieces.map(m=>[m.geometry.drawRange.start,m.geometry.drawRange.count]).sort((a,b)=>a[0]-b[0]);let at=0;for(const [s,c] of spans){assert.equal(s,at);assert(c<=40*3&&c%3===0);at+=c;}assert.equal(at,K.geometry.index.count);}
 pass('its pieces are slices of one set of arrays, end to end, each at most the piece size, with a Uint16 texel coordinate');
 assert(pieces.every(m=>m.geometry.boundingBox&&m.geometry.boundingSphere&&Number.isFinite(m.geometry.boundingSphere.radius)&&m.frustumCulled));pass('every piece has its bounds from the start');
 const M=K.material,t=K.texture;assert(M.name==='V2_band_kind_0'&&M.roughness===1&&M.metalness===1&&M.roughnessMap===t&&M.metalnessMap===t&&M.vertexColors&&M.side===T.FrontSide);
 assert(t.type===T.FloatType&&t.magFilter===T.NearestFilter&&t.minFilter===T.NearestFilter&&!t.generateMipmaps&&t.wrapS===T.ClampToEdgeWrapping&&!t.matrixAutoUpdate);
 pass('the kind material reads roughness and metalness from a float texture, nearest, unmipped');
 const texelOf=i=>{const k=Math.floor(uv.getX(i)*t.image.width),d=t.image.data;return [d[k*4+1],d[k*4+2]];};
 const seen=new Map(),p=K.geometry.attributes.position,ix=K.geometry.index;
 const check=()=>{seen.clear();for(const m of pieces){const r=m.geometry.drawRange;for(let i=r.start;i<r.start+r.count;i+=3){const key=tri(p,[ix.getX(i),ix.getX(i+1),ix.getX(i+2)]),src=want.get(key);assert(src,'a kind triangle with no source');seen.set(key,(seen.get(key)||0)+1);
  for(let j=0;j<3;j++){const [r2,m2]=texelOf(ix.getX(i+j));assert(r2===Math.fround(src.roughness)&&m2===Math.fround(src.metalness),'a vertex reads another material');}}}};
 check();assert.equal(seen.size,want.size);assert([...seen.values()].every(c=>c===1));pass('every source triangle is drawn by one piece, in place, reading its own material’s roughness and metalness');
 bands.get(2).visible=false;merged.update();
 for(const m of pieces){const g=m.geometry,r=g.drawRange;for(const gr of g.groups){assert(gr.start>=r.start&&gr.start+gr.count<=r.start+r.count,'a group outside its slice');
  for(let k=gr.start;k<gr.start+gr.count;k++)assert(Math.abs(p.getY(ix.getX(k))-8)>1,'a hidden band drawn');}}
 bands.get(2).visible=true;merged.update();pass('a piece draws only its slice’s shown bands');
 B.roughness=.25;merged.follow();check();const version=t.version;merged.follow();assert.equal(t.version,version,'unchanged texels upload nothing');pass('the texels follow their materials');
 for(let i=0;i<60;i++)merged.follow();assert.equal(merged.proof.drift,0);A.flatShading=true;for(let i=0;i<60;i++)merged.follow();assert(merged.proof.drift>0);A.flatShading=false;
 pass('a source no longer like its kind is counted');
 const again=()=>{const s=new T.Scene(),b=new Map();for(const n of [1,2,3]){const g=new T.Group();g.name='Walk_band_'+n;g.userData.band=n;g.position.set(0,n*4,0);b.set(n,g);s.add(g);
  for(const [m,x] of [[A,-35],[A,-20],[B,-5],[B,25]])g.add(part(m,x,n));}s.updateMatrixWorld(true);return [s,b];};
 {const [s,b]=again(),plain=await mergePhoneBands({bands:b},s,{piece:40,kinds:false});assert.equal(plain.proof.kinds,0);assert(plain.root.children.every(m=>m.userData.deckKind===undefined));}
 {const [s,b]=again(),whole=await mergePhoneBands({bands:b},s,{piece:0,kinds:true});assert.equal(whole.proof.kinds,0);}
 {const [s,b]=again(),one=await mergePhoneBands({bands:b},s,{piece:1e6,kinds:true}),[q]=one.root.children.filter(m=>m.userData.deckKind===0);
  assert(q&&!q.frustumCulled&&q.geometry.drawRange.start===0&&q.geometry.drawRange.count===q.geometry.index.count&&q.geometry.boundingBox.min.x<-30);}
 pass('without kinds, or without pieces, everything merges per material; a kind under the piece size is one piece, unculled as before');}
// Colour kinds (colours, with kinds and pieces): the decks' other plain materials, equal but for colour, glow, roughness
// and metalness, merge as one kind whose material reads colour through map and glow through emissiveMap (what three's
// uniforms would hold, as float32); its material is made after every source's and before the finish kinds'; another side,
// a textured one, one corner shading skips by name and a floor blocker stay apart; colour and glow follow their materials
// without counting as drift.
{const scene=new T.Scene(),bands=new Map(),parts=[];
 const light=(name,color,emissive,emissiveIntensity,roughness,metalness=0,side=T.FrontSide)=>new T.MeshStandardMaterial({name,color,emissive,emissiveIntensity,roughness,metalness,side});
 const L1=light('Area_light',0xffebc7,0xffe6b6,.8,.8,.08),L2=light('Warm light',0xffd39c,0xffc783,1,.55),L3=light('Special_screen',0x2b718c,0x000000,1,.75,.08);
 const Ls=light('Area_light_double',0xffebc7,0xffe6b6,.8,.8,.08,T.DoubleSide),Lt=light('Area_light_tiled',0xffffff,0x000000,1,.8);Lt.map=new T.DataTexture(new Uint8Array(4),1,1);
 const Lw=light('Window_glow',0xffffff,0xffffff,1,.8),hex=light('V2_public_hex_floor',0xffffff,0x000000,1,.8);
 const F1=new T.MeshStandardMaterial({name:'Walk_finish_3|1|0|0',vertexColors:true,roughness:.3}),F2=new T.MeshStandardMaterial({name:'Walk_finish_7|5|0|0',vertexColors:true,roughness:.7});
 const all=[L1,L2,L3,Ls,Lt,Lw,hex,F1,F2];
 const part=(m,x,n)=>{const g=new T.BoxGeometry(2,1,2);if(m.vertexColors)g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(.6),3));
  const o=new T.Mesh(g,m);o.position.set(x+n,0,n*7-14);return o;};
 for(const n of [1,2,3]){const g=new T.Group();g.name='Walk_band_'+n;g.userData.band=n;g.position.set(0,n*4,0);bands.set(n,g);scene.add(g);
  all.forEach((m,i)=>{const o=part(m,i*9-40,n);g.add(o);parts.push([o,m]);});}
 scene.updateMatrixWorld(true);
 const before=Math.max(...all.map(m=>m.id));
 const merged=await mergePhoneBands({bands},scene,{piece:40,kinds:true,colours:true,alone:m=>cornerShadeSkipsName(m.name)}),meshes=merged.root.children;
 assert.equal(merged.proof.kinds,2);assert.equal(merged.proof.colourKinds,1);
 const C=merged.kinds.find(K=>K.colours),Fk=merged.kinds.find(K=>!K.colours);
 assert.deepEqual(C.materials,[L1,L2,L3]);assert.deepEqual(Fk.materials,[F1,F2]);
 for(const m of [Ls,Lt,Lw,hex])assert(meshes.some(o=>o.name==='V2_low_deck_merged_'+m.name&&o.material[0]===m),m.name+' merges apart');
 pass('the lights equal but for colour, glow, roughness and metalness are one colour kind; another side, a textured one, one skipped by name and a floor blocker stay apart');
 const M=C.material;
 assert(M.name==='V2_band_colour_kind_0'&&M.color.r===1&&M.color.g===1&&M.color.b===1&&M.emissive.r===1&&M.emissive.g===1&&M.emissive.b===1&&M.emissiveIntensity===1);
 assert(M.map===C.colours&&M.emissiveMap===C.glows&&M.roughnessMap===C.texture&&M.metalnessMap===C.texture&&M.roughness===1&&M.metalness===1);
 for(const t of [C.colours,C.glows])assert(t.type===T.FloatType&&t.magFilter===T.NearestFilter&&t.minFilter===T.NearestFilter&&!t.generateMipmaps&&!t.matrixAutoUpdate&&t.colorSpace===T.NoColorSpace);
 pass('the colour kind material is white, glows white at intensity 1, and reads colour and glow from float textures, nearest, unmipped, unconverted');
 assert(M.id>before&&Fk.material.id>M.id);pass('its material is made after every source and before the finish kinds');
 const pieces=meshes.filter(o=>o.material[0]===M);
 assert(pieces.length>=2&&pieces.every(o=>o.name==='V2_low_deck_merged_Walk_colour_kind_0'&&!floorBlocker(o)));
 assert(meshes.filter(o=>o.material[0]===Fk.material).every(o=>floorBlocker(o)));assert(meshes.some(o=>o.name==='V2_low_deck_merged_V2_public_hex_floor'&&floorBlocker(o)));
 pass('colour kind pieces are no floor blockers; finish kind pieces and the floor blocker still are');
 const uv=C.geometry.attributes.uv,p=C.geometry.attributes.position,ix=C.geometry.index;
 const at=(t,i)=>{const k=Math.floor(uv.getX(i)*t.image.width),d=t.image.data;return [d[k*4],d[k*4+1],d[k*4+2],d[k*4+3]];};
 const tri=(i)=>[0,1,2].map(j=>[p.getX(ix.getX(i+j)),p.getY(ix.getX(i+j)),p.getZ(ix.getX(i+j))].map(v=>v.toFixed(4)).join(',')).join(' ');
 const src=new Map();for(const [o,m] of parts){if(!C.materials.includes(m))continue;const g=o.geometry.clone().applyMatrix4(o.matrixWorld),q=g.attributes.position,k=g.index.array;
  for(let i=0;i<k.length;i+=3)src.set([0,1,2].map(j=>[q.getX(k[i+j]),q.getY(k[i+j]),q.getZ(k[i+j])].map(v=>v.toFixed(4)).join(',')).join(' '),m);}
 const check=()=>{let n=0;for(const o of pieces){const r=o.geometry.drawRange;for(let i=r.start;i<r.start+r.count;i+=3){const m=src.get(tri(i));assert(m,'a colour kind triangle with no source');n++;
  for(let j=0;j<3;j++){const v=ix.getX(i+j),c=at(C.colours,v),e=at(C.glows,v),x=m.emissiveIntensity;
   assert.deepEqual(c,[Math.fround(m.color.r),Math.fround(m.color.g),Math.fround(m.color.b),1],'a vertex reads another colour');
   assert.deepEqual(e,[Math.fround(m.emissive.r*x),Math.fround(m.emissive.g*x),Math.fround(m.emissive.b*x),1],'a vertex reads another glow');}}}return n;};
 assert.equal(check(),src.size);pass('every vertex reads its own material’s colour, and its emissive times its intensity, as float32');
 L2.color.setHex(0x123456);L1.emissiveIntensity=1.6;const v1=C.colours.version,v2=C.glows.version;merged.follow();check();
 assert(C.colours.version>v1&&C.glows.version>v2);const w1=C.colours.version,w2=C.glows.version;merged.follow();assert(C.colours.version===w1&&C.glows.version===w2,'unchanged texels upload nothing');
 pass('colour and glow texels follow their materials, uploading only on a change');
 for(let i=0;i<60;i++)merged.follow();assert.equal(merged.proof.drift,0,'a colour change is no drift');
 L3.fog=false;for(let i=0;i<60;i++)merged.follow();assert(merged.proof.drift>0);L3.fog=true;pass('a colour kind source changed otherwise is counted');
 {const was=merged.proof.drift;M.emissiveIntensity=2;for(let i=0;i<60;i++)merged.follow();assert.equal(merged.proof.drift,was+1);M.emissiveIntensity=1;pass('a value written on the kind material itself is counted');}
 {const page=readFileSync(new URL('../src/walk/main.public.js',import.meta.url),'utf8');
  for(const text of ["m=>set.has(m)||cornerShadeSkipsName(m.name)","kinds:deckKinds,colours:colourKinds,singles:colourSingles,alone","colourSingles=colourKinds&&phoneTest.get('coloursingles')!=='0'","colourKinds=deckKinds&&phoneTest.get('colourkinds')!=='0'"])assert(page.includes(text),'main.public.js no longer has '+text);
  pass('the walk page passes corner shading’s name rule and the colour kinds switch to the merge');}
 {const s=new T.Scene(),b=new Map();for(const n of [1,2,3]){const g=new T.Group();g.name='Walk_band_'+n;g.userData.band=n;g.position.set(0,n*4,0);b.set(n,g);s.add(g);for(const [i,m] of [L1,L2,L3,F1,F2].entries())g.add(part(m,i*9-40,n));}s.updateMatrixWorld(true);
  const off=await mergePhoneBands({bands:b},s,{piece:40,kinds:true});assert.equal(off.proof.kinds,1);assert(!off.kinds[0].colours);
  for(const m of [L1,L2,L3])assert(off.root.children.some(o=>o.name==='V2_low_deck_merged_'+m.name&&o.material[0]===m));}
 pass('without colours, the lights merge per material and only the finish kind is made');}
// Singles (with colours): a material of one render-bake merge joins a colour kind that has other materials; one of
// another name, or one whose kind has no other material, stays as it is; without singles, all stay.
{const make=()=>{const s=new T.Scene(),b=new Map();
  const light=(name,color)=>new T.MeshStandardMaterial({name,color,emissive:color,emissiveIntensity:.5,roughness:.6});
  const A=light('Area_light',0xffebc7),B=light('Warm light',0xffd39c),card=light('Arena_card_art_3_polished',0x884422),loose=light('Lounge_door_panel',0x225588);
  const odd=new T.MeshStandardMaterial({name:'Arena_screen',color:0x141205,flatShading:true});
  for(const n of [1,2]){const g=new T.Group();g.name='Walk_band_'+n;g.userData.band=n;g.position.set(0,n*4,0);b.set(n,g);s.add(g);
   for(const [i,m] of [A,B].entries()){const o=new T.Mesh(new T.BoxGeometry(2,1,2),m);o.name='Walk_merged_'+m.name;o.position.set(i*5,0,n*3);g.add(o);}}
  const one=(m,name,x)=>{const o=new T.Mesh(new T.BoxGeometry(1,1,1),m);o.name=name;o.position.set(x,0,9);b.get(1).add(o);return o;};
  const parts={card:one(card,'Walk_merged_'+card.name,20),loose:one(loose,'Walk_lounge_door',24),odd:one(odd,'Walk_merged_'+odd.name,28)};
  s.updateMatrixWorld(true);return {s,b,A,B,card,loose,odd,parts};};
 {const t=make(),merged=await mergePhoneBands({bands:t.b},t.s,{piece:40,kinds:true,colours:true,singles:true}),C=merged.kinds.find(K=>K.colours);
  assert.deepEqual(new Set(C.materials),new Set([t.A,t.B,t.card]),'the single render-bake merge joins the colour kind');
  assert(!t.parts.card.visible||t.parts.card.parent.name.endsWith('_merged_sources'),'its source is hidden or moved with the merged sources');
  for(const k of ['loose','odd'])assert(t.parts[k].visible&&/^Walk_band_/.test(t.parts[k].parent.name),k+' stays as it is');
  assert(!merged.root.children.some(o=>o.material[0]===t.odd||o.material[0]===t.loose),'a single with no kind is not merged alone');
  pass('a single render-bake merge joins a colour kind; one of another name, or one with no kind, stays as it is');}
 {const t=make(),merged=await mergePhoneBands({bands:t.b},t.s,{piece:40,kinds:true,colours:true}),C=merged.kinds.find(K=>K.colours);
  assert.deepEqual(new Set(C.materials),new Set([t.A,t.B]));for(const k of ['card','loose','odd'])assert(t.parts[k].visible);
  pass('without singles, the single merges stay as they are');}}
{for(const n of [1,2,7,25,1000,5000])for(let k=0;k<n;k++){const u=kindTexel(k,n)/65535;assert.equal(Math.min(n-1,Math.floor(u*n)),k);}pass('each texel coordinate picks its own texel');}
console.log(`band merge sources: ${checks} checks passed`);
