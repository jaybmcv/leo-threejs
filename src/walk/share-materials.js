// Equal materials, one object. The prepared walk brings each deck's part of the ship with its own copies of the same
// materials: the cabins on every deck have their own oak, brass, linen and so on (63 objects for 19 looks). Three
// refreshes a material's uniforms whenever the next draw uses another material object, and it sorts opaque draws by
// material object, so each copy cost the frame a refresh and kept equal draws apart. Sharing the cabins' copies cut the
// open atrium's frame by about 0.1 ms (A/B in one page) and its GPU time a little.
//   shareEquivalentMaterials(root,{member,split}) -> {meshes,materials}: each chosen mesh takes the first material equal
// to its own. Equal means the same type and the same values; textures, functions and other live objects count as equal
// only when they are the same object, and a shader material only equals itself. split(o) returns anything else that
// must match (corner shading's choice for the material). Only for meshes whose materials nothing later changes for some
// of them alone, since a change to the shared object reaches them all.
const ids=new WeakMap();let nextId=0;
const idOf=v=>{let id=ids.get(v);if(id===undefined)ids.set(v,id=nextId++);return id;};
function valueKey(v){
 if(v===null||v===undefined)return String(v);
 const type=typeof v;
 if(type==='number'||type==='boolean')return String(v);
 if(type==='string')return JSON.stringify(v);
 if(type==='function')return 'f'+idOf(v);
 if(v.isColor)return 'c'+v.r+','+v.g+','+v.b;
 if(v.isVector2||v.isVector3||v.isVector4||v.isEuler||v.isQuaternion||v.isMatrix3||v.isMatrix4)return 'v'+v.toArray().join(',');
 if(Array.isArray(v))return '['+v.map(valueKey).join(',')+']';
 if(Object.getPrototypeOf(v)===Object.prototype)return '{'+Object.keys(v).sort().map(k=>k+':'+valueKey(v[k])).join(',')+'}';
 return 'o'+idOf(v);
}
const IGNORED=new Set(['uuid','name','id','version','userData','_listeners']);
export function materialKey(m){
 if(m.isShaderMaterial)return 'o'+idOf(m);
 const own=Object.keys(m).filter(k=>!IGNORED.has(k)).sort().map(k=>k+'='+valueKey(m[k])).join(';');
 return m.type+'{'+own+'}'+valueKey(m.onBeforeCompile)+valueKey(m.customProgramCacheKey);
}
export function shareEquivalentMaterials(root,{member=()=>true,split=()=>''}={}){
 const first=new Map();let meshes=0;
 root.traverse(o=>{
  if(!o.isMesh||!o.material||Array.isArray(o.material)||!member(o))return;
  const key=materialKey(o.material)+'#'+split(o),seen=first.get(key);
  if(!seen){first.set(key,o.material);return;}
  if(seen!==o.material){o.material=seen;meshes++;}
 });
 return {meshes,materials:first.size};
}
