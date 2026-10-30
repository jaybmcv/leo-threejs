import {saveStreamedMetadata} from './streamed-metadata.js';
import {capturePreparedPrivacy} from './prepared-privacy.js';
import {finishedSkinAuthority} from './skin-authority.js';
import {uploadSkinProof} from './authoring-skin-proof.js';
import {releaseEnvelopeProfiles} from './bounded-samples.js';
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
 const fields=['v2FeaturePlacements','v2RoomAnchors','root','exterior','inside','vertical','shared','decks','cabinGroups','cutaway','serviceDecks','residentialDecks','v2GuardPlatforms'];const state=Object.fromEntries(fields.map(k=>[k,ship[k]]));state.aft=ship.ensureAft();state.transit=ship.ensureTransit();state.observation=ship.ensureObservation();shipState=writer.value(state);
}
export async function savePreparedWalk(ship,{colliders,baked,haze,lounge,restSpots,seats}){
 if(!writer)throw Error('Prepared walk checkpoint was not captured');
 console.log(new Date().toISOString(),'Capturing shared corridor-pane classes');
 const {root:frostRoot,privacy}=capturePreparedPrivacy(placements(),{cabinKey,template,doorSide});
 console.log(new Date().toISOString(),'Shared privacy captured',privacy.length,'cabins',frostRoot.children.length,'classes');
 const released=releaseEnvelopeProfiles(layout);globalThis.gc?.();console.log(new Date().toISOString(),'Prepared authoring profiles released before signature',released);
 console.log(new Date().toISOString(),'Capturing prepared render bands');
 const sourceById=new Map(source.nodes.map(r=>[r.uuid,r]));for(const [id,o]of writer.nodeIds){const r=sourceById.get(id);if(r&&o.isInstancedMesh){r.userData=writer.value(o.userData);r.count=o.count;r.instanceMatrix=writer.array(o.instanceMatrix.array);r.objectBounds=o.boundingBox?[o.boundingBox.min.toArray(),o.boundingBox.max.toArray()]:null;r.objectSphere=o.boundingSphere?[o.boundingSphere.center.toArray(),o.boundingSphere.radius]:null;}}
 const bands=[...baked.bands].filter(([,g])=>g.children.some(o=>o.name.startsWith('Walk_merged_'))).map(([k,g])=>{const children=g.children;g.children=children.filter(o=>o.name.startsWith('Walk_merged_'));const graph=writer.graph(g);g.children=children;return [k,graph];});
 const loungeRoot=new T.Group();loungeRoot.name='Prepared_lounge';for(const o of [...(lounge?.drawn||[]),...(lounge?.mural?[lounge.mural]:[])])loungeRoot.add(o.clone(true));

 const idsByMatrix=new Map(placements().map(c=>[c.matrix.elements.join(','),c.id]));for(const g of colliders.groups)if(/^v2-(core|shell|lounge)-/.test(g.name))for(const item of g.items){item.owner=idsByMatrix.get(item.matrix.elements.join(','));if(!item.owner)throw Error('Missing prepared cabin collision owner '+g.name);}

 const skinAuthority=await uploadSkinProof(finishedSkinAuthority(ship));console.log(new Date().toISOString(),'Prepared finished-skin signature complete');
 const state={roomFeatureSupports:writer.value(ship.v2RoomFeatureSupports||[]),skinAuthority,geometryTemplates:[...geometryRecords()].map(([key,g])=>[key,writer.geometry(g)]),source,ship:shipState,signs:writer.graph(ship.v2PreparedSigns),bands,haze:writer.graph(haze),facade:writer.graph(ship.facade),lounge:writer.graph(loungeRoot),frost:writer.graph(frostRoot),privacy,colliders:writer.colliders(colliders),rest:writer.value(restSpots),seats:seats.map(s=>restSpots.indexOf(s)),bake:{sources:baked.sources,meshes:baked.meshes},retirements:ship.v2Retirements};

 console.log(new Date().toISOString(),'Prepared state captured; serializing transport');
 const post=async(name,bytes)=>{const response=await fetch('/__prepared/'+name,{method:'POST',body:bytes});if(!response.ok)throw Error('Prepared asset write failed: '+name);};await globalThis.__LEOBuildGeometryCache?.flush();const result=await writer.save(post,state,{metadata:saveStreamedMetadata});await post('complete.json',JSON.stringify({status:'PASS',...result}));document.body.dataset.prepared='1';return result;
}
