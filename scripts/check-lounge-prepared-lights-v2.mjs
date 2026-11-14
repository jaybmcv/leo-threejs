import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {createGardenCommons} from '../src/model.js';
import {bakeForWalking} from '../src/walk/render-bake.js';
import {solid} from '../src/walk/collision.js';
import {retirePreparedLoungeLights,rememberPreparedStatic} from '../src/v2/prepared-static.js';

// Bake real old source fittings, as a warm prepared ship does, with another
// garden and an overlapping differently named light as preservation witnesses.
const root=new T.Group(),names=new Set(['Gallery_end_light','Gallery_warm_light']);
for(const number of [1,2]){
 const garden=createGardenCommons(number).root,lights=[];garden.traverse(o=>{if(names.has(o.name))lights.push(o);});assert.equal(lights.length,4);
 for(const o of lights){assert(!solid(o),'Old light must not contribute collision');garden.attach(o);}
 for(const o of [...garden.children])if(!lights.includes(o))o.removeFromParent();root.add(garden);
 if(number===1){const witness=lights[0].clone();witness.geometry=witness.geometry.clone();witness.name='Lounge_string_light';garden.add(witness);}
}
const ship={root,v2PreparedBake:bakeForWalking(root)},triangles=()=>{
 const rows=[];for(const group of ship.v2PreparedBake.bands.values()){group.updateWorldMatrix(true,true);group.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position;for(const r of g.userData.preparedRanges)for(let i=r.start;i<r.start+r.count;i++){const h=createHash('sha256');h.update(r.source+'|'+r.name);for(let k=0;k<3;k++)h.update(new T.Vector3().fromBufferAttribute(p,g.index.getX(i*3+k)).applyMatrix4(o.matrixWorld).toArray().join(','));rows.push({name:r.name,source:r.source,hash:h.digest('hex')});}});}return rows;
};
const lounge=root.getObjectByName('Fitted_garden_commons_01'),ids=new Set(lounge.children.filter(o=>names.has(o.name)).map(o=>o.uuid)),before=triangles(),expected=before.filter(r=>!ids.has(r.source));
const probes=[[[-134.95,27.99,-40],[1,0,0]],[[-134.95,31.99,-40],[1,0,0]],[[-121,27.99,-58.4],[0,0,1]]];
const hits=([at,direction])=>new T.Raycaster(new T.Vector3(...at),new T.Vector3(...direction),0,.3).intersectObjects([...ship.v2PreparedBake.bands.values()],true).filter(h=>h.object.geometry.userData.preparedRanges.some(r=>names.has(r.name)&&h.faceIndex>=r.start&&h.faceIndex<r.start+r.count)).length;
assert(probes.every(p=>hits(p)>0),'Playback probes must reject the old visible strips');
assert.equal(new Set(before.filter(r=>ids.has(r.source)).map(r=>r.source)).size,4);
rememberPreparedStatic(ship);
assert.equal(ship.v2RetiredLoungeLights,before.length-expected.length,'Every old lounge light triangle removed');
assert.deepEqual(triangles(),expected,'All other triangles and their source identities stay unchanged');
assert(probes.every(p=>hits(p)===0),'Playback probes must see empty air after cleanup');
assert(expected.some(r=>r.name==='Lounge_string_light'),'Overlapping current light retained');
assert.equal(new Set(expected.filter(r=>names.has(r.name)).map(r=>r.source)).size,4,'Other garden lights retained');
assert.equal(retirePreparedLoungeLights(ship),0,'Cleanup is idempotent');
const clean={root,v2PreparedBake:{bands:new Map()}};assert.equal(retirePreparedLoungeLights(clean),0,'Fresh ship without retired batches needs no cleanup');
const probeBoxes=probes.map(([at,dir])=>{const a=new T.Vector3(...at);return new T.Box3().setFromPoints([a,a.clone().addScaledVector(new T.Vector3(...dir),.3)]);});
const inspectBounds=()=>{let checked=0;for(const group of ship.v2PreparedBake.bands.values())group.traverse(o=>{if(!o.isMesh)return;for(const r of o.geometry.userData.preparedRanges||[]){if(!names.has(r.name))continue;assert(r.bounds,'Retained source range needs bounds before its arrays are released');const b=new T.Box3(new T.Vector3(...r.bounds[0]),new T.Vector3(...r.bounds[1])).applyMatrix4(o.matrixWorld);assert(!probeBoxes.some(p=>p.intersectsBox(b)),'Old lounge light source bounds remain at a playback probe');checked++;}});assert(checked>0,'Other gardens still have inspectable source ranges');};
inspectBounds();
for(const group of ship.v2PreparedBake.bands.values())group.traverse(o=>{if(!o.geometry)return;for(const a of Object.values(o.geometry.attributes))a.array=null;if(o.geometry.index)o.geometry.index.array=null;});
inspectBounds();
console.log('PASS warm prepared lounge strips removed; other garden and overlapping lights unchanged; repeat and fresh loads safe');
console.log('PASS retained light source bounds remain verifiable after CPU geometry arrays are released');
