// node scripts/phone-working-set.mjs [prepared-walk dir] [--seen bands.json] [--radius 40]
// What a phone would have to decode to stand at the arrival spot, measured from the prepared manifest (PHONE_WALK.md
// step 2). For each set: the arrays it needs (with the tuple dictionaries they decode through), their decoded bytes
// and the transport parts they touch. Also the baked triangles within a radius of the arrival spot, the size a phone
// pack with its own buffers would start from. --seen takes a JSON list of band keys the walk showed at arrival.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const args=process.argv.slice(2),flag=n=>{const i=args.indexOf(n);if(i<0)return null;const v=args[i+1];args.splice(i,2);return v;};
const seenFile=flag('--seen'),radius=Number(flag('--radius')||40),dir=args[0]||'output/leo-interior-v02/prepared-walk';
const m=JSON.parse(zlib.zstdDecompressSync(fs.readFileSync(path.join(dir,'world.bin'))));
const layout=JSON.parse(fs.readFileSync(path.join(dir,'../layout.json'),'utf8'));
const PART=8388608,bandOf=y=>Math.floor((y+40.7)/4);

const addArray=(id,out)=>{if(id===null||id===undefined||out.has(id))return;out.add(id);const r=m.arrays[id];if(r.encoding==='meshopt-tuple')addArray(r.dictionary,out);};
const addGeometry=(gi,out)=>{const g=m.geometries[gi];for(const a of Object.values(g.attributes))addArray(a.array,out);addArray(g.index,out);};
const graph=(data,out=new Set())=>{for(const n of data.nodes||[]){if(n.geometry!==undefined)addGeometry(n.geometry,out);addArray(n.instanceMatrix,out);addArray(n.instanceColor,out);}return out;};
const bvh=(r,out)=>{addGeometry(r.geometry,out);for(const id of r.roots)addArray(id,out);for(const k of ['index','indirect','windowFlags'])addArray(r[k],out);};
const union=(...sets)=>new Set(sets.flatMap(s=>[...s]));
const measure=ids=>{let decoded=0;const parts=new Set();for(const id of ids){const r=m.arrays[id];decoded+=r.decodedBytes;if(r.bytes)for(let p=Math.floor(r.start/PART);p<=Math.floor((r.start+r.bytes-1)/PART);p++)parts.add(p);}
 return `${(decoded/1e6).toFixed(1)} MB decoded, ${parts.size}/${m.parts.length} parts (${([...parts].reduce((n,p)=>n+m.parts[p].zipped,0)/1e6).toFixed(1)} MB download)`;};
const triangles=gi=>{const g=m.geometries[gi];if(g.index!==null&&g.index!==undefined)return m.arrays[g.index].count/3;const a=g.attributes.position;return a?m.arrays[a.array].decodedBytes/36:0;};
const keyRange=k=>{const s=String(k),i=s.indexOf('-',1);return i<0?[Number(s),Number(s)]:[Number(s.slice(0,i)),Number(s.slice(i+1))];};
const line=(label,text)=>console.log(label.padEnd(44),text);

const room=layout.rooms.find(r=>r.id==='d02-arrival-1'),at=[room.frame.origin[0]-20,room.frame.origin[1],room.frame.origin[2]],band=bandOf(at[1]+1.6);
line('arrival spot',`${at.map(v=>v.toFixed(1)).join(', ')} (render and collision band ${band})`);
line('whole ship',measure(new Set(m.arrays.map((_,i)=>i))));
// The biggest arrays and how many geometries read them: shared pools make any one band depend on them.
const readers=new Map();for(const g of m.geometries)for(const a of Object.values(g.attributes))readers.set(a.array,(readers.get(a.array)||0)+1);
const shared=m.arrays.map((r,i)=>[i,r]).filter(([i,r])=>r.decodedBytes>=50e6).map(([i])=>i);
line('arrays of 50 MB or more',shared.map(i=>`#${i} ${(m.arrays[i].decodedBytes/1e6).toFixed(0)} MB, ${readers.get(i)||0} geometries`).join('; '));
const bandSets=m.bands.map(([k,d])=>[String(k),graph(d)]);
// The main pool: the arrays read by the most geometries, plus the dictionary its tuple arrays decode through.
const most=Math.max(...readers.values()),pool=new Set();for(const [i,n] of readers)if(n===most)addArray(i,pool);
line('main pool',`${[...pool].map(i=>'#'+i).join(' ')}: ${measure(pool)}`);
line('bands that need the main pool',`${bandSets.filter(([,s])=>[...pool].every(i=>s.has(i))).length} of ${bandSets.length}`);
const own=bandSets.filter(([k])=>{const [a,b]=keyRange(k);return b>=band&&a<=band;});
const col=new Set();for(const [k,b] of m.colliders.bands)if(Number(k)===band)bvh(b,col);
line(`render bands at ${band} (${own.length} groups)`,measure(union(...own.map(([,s])=>s))));
line(`collision band ${band}`,measure(col));
line('  plus facade, haze and signs',measure(union(...own.map(([,s])=>s),col,graph(m.facade),graph(m.haze),graph(m.signs))));
if(seenFile){const seen=new Set(JSON.parse(fs.readFileSync(seenFile,'utf8')).bands??JSON.parse(fs.readFileSync(seenFile,'utf8')));
 const picked=m.bands.filter(([k])=>seen.has(String(k)));let t=0,all=0;for(const [k,d] of m.bands)for(const n of d.nodes)if(n.geometry!==undefined){const x=triangles(n.geometry);all+=x;if(seen.has(String(k)))t+=x;}
 line(`bands shown at arrival (${picked.length} groups)`,`${(t/1e6).toFixed(2)}M of ${(all/1e6).toFixed(2)}M baked triangles; ${measure(union(...picked.map(([,d])=>graph(d))))}`);}
const near=(b,R)=>{const [lo,hi]=b;let s=0;for(let k=0;k<3;k++){const v=Math.max(lo[k]-at[k],0,at[k]-hi[k]);s+=v*v;}return Math.sqrt(s)<=R;};
for(const R of [20,radius,radius*2]){let t=0;for(const [,d] of m.bands)for(const n of d.nodes)if(n.geometry!==undefined&&m.geometries[n.geometry].bounds&&near(m.geometries[n.geometry].bounds,R))t+=triangles(n.geometry);
 line(`baked triangles within ${R} m`,`${(t/1e6).toFixed(2)}M`);}
