import {finishedSkinAuthorityProof} from './skin-authority.js';
import {captureRoomAnchors} from '../plan/rooms.js';
import layout from 'v2-layout';
import {geometryRecords} from './prepared-geometry-record.js';
import * as T from 'three';
import {PreparedWriter} from './prepared-codec.js';
import {placements,cabinKey,template,doorSide} from './cabins.js';
let writer,source,shipState;
export function checkpointPreparedWalk(ship){
 globalThis.__leoPreparedBuild={ship};console.log('Capturing prepared source hierarchy');writer=new PreparedWriter();ship.v2RoomAnchors=captureRoomAnchors(ship.root);source=writer.graph(ship.root,{source:true,required:new Set(ship.v2RoomAnchors.map(r=>r.uuid))});console.log('Source hierarchy captured',source.nodes.length);
 const sourceIds=new Set(source.nodes.map(n=>n.uuid));for(const r of ship.v2RoomAnchors)if(!sourceIds.has(r.uuid))throw Error('Pruned required room anchor '+r.id);
 const fields=['v2RoomAnchors','root','exterior','inside','vertical','shared','decks','cabinGroups','cutaway','serviceDecks','residentialDecks','v2GuardPlatforms'];const state=Object.fromEntries(fields.map(k=>[k,ship[k]]));state.aft=ship.ensureAft();state.transit=ship.ensureTransit();state.observation=ship.ensureObservation();shipState=writer.value(state);
}
export async function savePreparedWalk(ship,{colliders,baked,haze,lounge,restSpots,seats}){
 if(!writer)throw Error('Prepared walk checkpoint was not captured');
 const sourceById=new Map(source.nodes.map(r=>[r.uuid,r]));for(const [id,o]of writer.nodeIds){const r=sourceById.get(id);if(r&&o.isInstancedMesh){r.userData=writer.value(o.userData);r.count=o.count;r.instanceMatrix=writer.array(o.instanceMatrix.array);r.objectBounds=o.boundingBox?[o.boundingBox.min.toArray(),o.boundingBox.max.toArray()]:null;r.objectSphere=o.boundingSphere?[o.boundingSphere.center.toArray(),o.boundingSphere.radius]:null;}}
 const bands=[...baked.bands].filter(([,g])=>g.children.some(o=>o.name.startsWith('Walk_merged_'))).map(([k,g])=>{const children=g.children;g.children=children.filter(o=>o.name.startsWith('Walk_merged_'));const graph=writer.graph(g);g.children=children;return [k,graph];});
 const loungeRoot=new T.Group();loungeRoot.name='Prepared_lounge';for(const o of [...(lounge?.drawn||[]),...(lounge?.mural?[lounge.mural]:[])])loungeRoot.add(o.clone(true));
 const frostRoot=new T.Group();frostRoot.name='Prepared_corridor_glass';const keys=new Set();const privacy=placements().map(c=>{const key=cabinKey(c);if(!keys.has(key)){keys.add(key);const g=new T.Group();g.name=key;for(const o of template(key).children.filter(o=>o.userData.corridorGlass&&!o.name.includes('manifestation')))g.add(o.clone(true));frostRoot.add(g);}return {id:c.id,key,y:c.y,side:doorSide(c),matrix:c.matrix.toArray(),polygon:c.hullPrototype?.polygon||null};});
 const idsByMatrix=new Map(placements().map(c=>[c.matrix.elements.join(','),c.id]));for(const g of colliders.groups)if(/^v2-(core|shell|lounge)-/.test(g.name))for(const item of g.items){item.owner=idsByMatrix.get(item.matrix.elements.join(','));if(!item.owner)throw Error('Missing prepared cabin collision owner '+g.name);}const state={skinAuthority:await finishedSkinAuthorityProof(ship),geometryTemplates:[...geometryRecords()].map(([key,g])=>[key,writer.geometry(g)]),source,ship:shipState,signs:writer.graph(ship.v2PreparedSigns),bands,haze:writer.graph(haze),facade:writer.graph(ship.facade),lounge:writer.graph(loungeRoot),frost:writer.graph(frostRoot),privacy,colliders:writer.colliders(colliders),rest:writer.value(restSpots),seats:seats.map(s=>restSpots.indexOf(s)),bake:{sources:baked.sources,meshes:baked.meshes},retirements:ship.v2Retirements};
 for(const p of layout.hullPrototypes?.prototypes||[])for(const key of Object.keys(p))if(Array.isArray(p[key])&&!['polygon','rect'].includes(key))p[key]=[];layout.hullPrototypes.prototypes=[];for(const c of [...layout.cabins,...layout.rooms])delete c.hullPrototype;layout.windows=[];globalThis.gc?.();console.log('Prepared authoring profiles released before serialization');
 const post=async(name,bytes)=>{const response=await fetch('/__prepared/'+name,{method:'POST',body:bytes});if(!response.ok)throw Error('Prepared asset write failed: '+name);};const result=await writer.save(post,state);await post('complete.json',JSON.stringify({status:'PASS',at:new Date().toISOString(),...result}));document.body.dataset.prepared='1';return result;
}
