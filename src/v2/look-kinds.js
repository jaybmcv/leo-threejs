import * as T from 'three';

// Look kinds: opaque, untextured materials that are equal but for colour, glow, roughness and metalness, drawn by one
// material that reads those values from tiny float textures (the deck kinds' way, phone-bands.js, here for the room
// features, lifts and rare furnishings). Each member material has a texel; each vertex drawn for it carries a uv constant
// at that texel. The kind's material is white, glows white at intensity 1, and has roughness and metalness 1, so three's
// arithmetic is the uniform path's:
// - colour: map_fragment multiplies white by the colour texel before color_fragment;
// - glow: emissivemap_fragment multiplies white by the glow texel, which holds the member's emissive x intensity, as
//   three's emissive uniform does;
// - roughness and metalness: 1 x the G and B of the look texel, as three reads roughness and metalness maps.
// The textures are float32, nearest, with no colour-space conversion, so every value is the uniform's own. A basic
// material's kind reads only its colour.

// What a kind takes from each member's texels, and what is the material's own identity, name or bookkeeping.
const READ=new Set(['color','emissive','emissiveIntensity','roughness','metalness']);
const OWN=new Set(['uuid','id','version','name','userData','_listeners','onBeforeCompile','customProgramCacheKey']);
const plainHook=T.Material.prototype.onBeforeCompile;
const functionIds=new WeakMap();let nextFunction=0;
const identityOf=f=>{let i=functionIds.get(f);if(i===undefined)functionIds.set(f,i=nextFunction++);return i;};
const describe=v=>v===null||v===undefined||typeof v!=='object'&&typeof v!=='function'?String(v):typeof v==='function'?'f'+identityOf(v):v.isColor?'c'+v.getHexString():v.isTexture?'t'+v.uuid:typeof v.toArray==='function'?'['+v.toArray().join(',')+']':'o'+JSON.stringify(v);
// The hook corner-shade.js puts on a material: a kind's material must carry the same as its members.
export const hookFlags=m=>m.onBeforeCompile?.cornerShade?'C':'';
// The shader a material is drawn with, as three tells two apart (its program cache key), with its hooks' flags: two
// materials of one look and one program key are one shader. Each corner-shaded material carries a closure of its own
// (its earlier hook), but they share one source and one set of uniforms (corner-shade.js), so their keys are equal.
// Worked out again only when the material is rebuilt or a hook is replaced.
const programs=new WeakMap();
export function programKey(m){
 let c=programs.get(m);
 if(!c||c.version!==m.version||c.hook!==m.onBeforeCompile||c.key!==m.customProgramCacheKey){
  let k;try{k=hookFlags(m)+'|'+m.customProgramCacheKey();}catch{k=null;}
  c={version:m.version,hook:m.onBeforeCompile,key:m.customProgramCacheKey,value:k};programs.set(m,c);}
 return c.value;
}
// Material ids kinds have taken from their members, for the whole walk: three sorts opaque draws by material id and skips a
// material's uniforms when both program and id repeat, so no two kinds' materials may share one.
const borrowed=new Set();
/** The lowest id of `materials` no kind has taken yet (taken now), or undefined when every one is taken. */
export function borrowId(materials){
 const m=[...materials].sort((a,b)=>a.id-b.id).find(m=>!borrowed.has(m.id));
 if(m)borrowed.add(m.id);return m?.id;
}

/** The look a material shares with the other members of its kind, or null when it cannot join one: a standard (not
 * physical) or basic material, opaque, shown, with no texture, and with no shader hook but corner shading's and the film
 * look's, which change shading alone. */
export function lookOf(m){
 const standard=!!m?.isMeshStandardMaterial&&!m.isMeshPhysicalMaterial;
 if(!standard&&!m?.isMeshBasicMaterial||m.transparent||!m.visible)return null;
 if(Object.values(m).some(v=>v?.isTexture))return null;
 const h=m.onBeforeCompile;if(h!==plainHook&&!(h?.keepsGeometry&&h.cornerShade))return null;
 return m.type+'|'+Object.keys(m).filter(k=>!OWN.has(k)&&!READ.has(k)).sort().map(k=>k+'='+describe(m[k])).join('|');
}
// lookOf, worked out again only when the material is rebuilt (its version) or `fresh` asks.
const looks=new WeakMap();
export function lookNow(m,fresh=false){
 let c=looks.get(m);
 if(!c||fresh||c.version!==m.version){c={version:m.version,key:lookOf(m)};looks.set(m,c);}
 return c.key;
}

// The texel coordinate of member k of n, as Uint16 normalized: nearest sampling picks texel k (the rounding is under
// half a texel for n up to several thousand).
export const kindTexel=(k,n)=>Math.round(65535*(k+.5)/n);
/** A copy of `g` (sharing its attributes and index, never disposed: that would free theirs) without its uv, and with
 * every vertex at member k's texel. */
export function texelGeometry(g,k,n){
 const view=new T.BufferGeometry();
 for(const [name,a] of Object.entries(g.attributes))if(name!=='uv')view.setAttribute(name,a);
 if(g.index)view.setIndex(g.index);
 const count=g.attributes.position.count,u=kindTexel(k,n),uv=new Uint16Array(count*2);
 for(let i=0;i<count;i++){uv[i*2]=u;uv[i*2+1]=32768;}
 view.setAttribute('uv',new T.BufferAttribute(uv,2,true));
 return view;
}
export const kindTexture=n=>{const t=new T.DataTexture(new Float32Array(n*4),n,1,T.RGBAFormat,T.FloatType);t.magFilter=t.minFilter=T.NearestFilter;t.generateMipmaps=false;t.matrixAutoUpdate=false;t.needsUpdate=true;return t;};
const texture=kindTexture;
// A texel as three uploads it (float32), written only when it changes.
const put=(d,j,r,g,b)=>{r=Math.fround(r);g=Math.fround(g);b=Math.fround(b);if(d[j]===r&&d[j+1]===g&&d[j+2]===b&&d[j+3]===1)return false;d[j]=r;d[j+1]=g;d[j+2]=b;d[j+3]=1;return true;};
/** Member `material`'s values into texel `i` of a kind's textures (`colours`, and for a lit kind `looks` and `glows`; any may be null), as
 * three's uniforms hold them; each texture is marked for upload only when one of its texels changed. */
export function writeTexel({colours,looks=null,glows=null},i,m){
 if(colours){const col=m.color;if(put(colours.image.data,i*4,col.r,col.g,col.b))colours.needsUpdate=true;}
 if(looks&&put(looks.image.data,i*4,0,m.roughness,m.metalness))looks.needsUpdate=true;
 if(glows){const e=m.emissive,x=m.emissiveIntensity;if(put(glows.image.data,i*4,e.r*x,e.g*x,e.b*x))glows.needsUpdate=true;}
}
// What a kind's material holds in place of what its textures stand in for (colour, glow, roughness, metalness).
export const KIND_VALUES=new Set(['color','map','emissive','emissiveIntensity','emissiveMap','roughness','roughnessMap','metalness','metalnessMap']);
/** Sets `M` to read colour (and for a lit kind glow, roughness and metalness) from `textures`: white, glowing white at
 * intensity 1, roughness and metalness 1. */
export function readTexels(M,{colours,looks=null,glows=null}){
 M.color=new T.Color(1,1,1);M.map=colours;
 if(looks){M.emissive=new T.Color(1,1,1);M.emissiveIntensity=1;M.roughness=1;M.metalness=1;M.roughnessMap=M.metalnessMap=looks;M.emissiveMap=glows;}
}
// A kind's own values that its textures stand in for: any other value here would multiply every texel.
export const unitValues=(M,basic)=>M.color.r===1&&M.color.g===1&&M.color.b===1&&(basic||M.roughness===1&&M.metalness===1&&M.emissive.r===1&&M.emissive.g===1&&M.emissive.b===1&&M.emissiveIntensity===1);
const copied=v=>v===null||typeof v!=='object'||v.isTexture?v:typeof v.clone==='function'?v.clone():Array.isArray(v)?v.slice():Object.getPrototypeOf(v)===Object.prototype?{...v}:v;

/** The kind of `materials` (all of one look, the first the one it copies): its material, named `name`, with material id
 * `id` (by default a new one; three sorts opaque draws by it), and its textures, `width` texels wide (by default one a
 * member; kind.add(m) takes more members while there is room).
 * - The material is a copy of the first member's own values. Its shader hooks are the first member's, whatever corner-
 *   shade.js makes of them: follow() puts the first member's back whenever they differ (it patches any material it finds
 *   in the scene, the kind's too, each with a closure of its own), so the kind's shader is always the first member's.
 * - kind.index: each member's texel. kind.follow() writes the members' values into the texels (only those that changed).
 * - kind.fits(m): the member still has the kind's look and hooks, and the kind's material still holds one for what it reads
 *   from its textures: a member that does not is drawn apart by whoever can (feature-batches.js), or counted as drift. */
export function createKind(materials,{name,id=new T.Material().id,width=materials.length}={}){
 materials=[...materials];
 const first=materials[0],basic=!!first.isMeshBasicMaterial,look=lookOf(first);
 // Made as three's own copies are, but with the id given (a material's id cannot be set once it is made).
 const M=Object.create(Object.getPrototypeOf(first));
 Object.defineProperty(M,'id',{value:id});
 for(const k of Object.keys(first))if(k!=='id'&&k!=='uuid'&&k!=='version'&&k!=='_listeners')M[k]=copied(first[k]);
 M.uuid=T.MathUtils.generateUUID();M.version=0;M.name=name;M.userData={...first.userData,lookKind:true};
 const colours=texture(width),looksTexture=basic?null:texture(width),glows=basic?null:texture(width),tex={colours,looks:looksTexture,glows};
 readTexels(M,tex);
 const index=new Map(materials.map((m,k)=>[m,k]));
 const kind={material:M,materials,index,look,basic,width,
  add(m){if(index.has(m))return index.get(m);if(materials.length>=width)return -1;index.set(m,materials.length);materials.push(m);return materials.length-1;},
  follow(){
   if(M.onBeforeCompile!==first.onBeforeCompile||M.customProgramCacheKey!==first.customProgramCacheKey){M.onBeforeCompile=first.onBeforeCompile;M.customProgramCacheKey=first.customProgramCacheKey;M.needsUpdate=true;}
   for(let i=0;i<materials.length;i++)writeTexel(tex,i,materials[i]);
  },
  usable:()=>unitValues(M,basic),
  fits:(m,fresh=false)=>index.has(m)&&lookNow(m,fresh)===look&&hookFlags(m)===hookFlags(M),
  textures:[colours,looksTexture,glows].filter(Boolean)};
 kind.follow();
 return kind;
}
