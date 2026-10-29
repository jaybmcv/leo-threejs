import {restoreRoomAnchors} from '../plan/rooms.js';
import {preparedResource} from './prepared-resource.js';
import * as T from 'three';
import layout from 'v2-layout';
import {readPreparedWorld} from './prepared-codec.js';
let prepared=null;const cabinPlanById=new Map(layout.cabins.map(c=>[c.id,c]));
export const preparedDecks=layout.decks;
export const preparedPlacements=()=>prepared?.manifest.privacy.map(c=>({...cabinPlanById.get(c.id),...c,matrix:new T.Matrix4().fromArray(c.matrix)}))||[];
export async function loadPreparedShip(scene,status){const location=new URL(typeof __PREPARED_URL__!=='undefined'?__PREPARED_URL__:'./prepared-walk/',import.meta.url);const loaded=preparedResource;const {ship}=loaded;restoreRoomAnchors(ship.root,ship.v2RoomAnchors);ship.v2PreparedPrivacy=loaded.manifest.privacy;ship.v2PreparedFrost=loaded.frost;ship.layout=layout;prepared={ship,manifest:{privacy:ship.v2PreparedPrivacy}};return ship;}
export function preparedBake(ship){ship.root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;for(let p=o;p;p=p.parent)if(p.userData.keepLive)return;o.visible=false;o.userData.baked=true;});return ship.v2PreparedBake;}
export function preparedFacade(ship,scene){ship.facade=ship.v2PreparedFacade;scene.add(ship.facade);return ship.facade;}
export function preparedHaze(ship){return ship.v2PreparedHaze;}
export function fitPreparedLounge(ship,ignoredLayout,drawn,mural){const cached=ship.v2PreparedLounge,byName=new Map();cached.traverse(o=>{if(o.isMesh){const list=byName.get(o.name)||[];list.push(o);byName.set(o.name,list);}});for(const root of [...drawn,...(mural?[mural.group||mural]:[])])root.traverse(o=>{if(!o.isMesh)return;const stored=byName.get(o.name)?.shift();if(!stored)throw Error('Missing prepared lounge finish: '+o.name);o.geometry=stored.geometry;o.position.copy(stored.position);o.quaternion.copy(stored.quaternion);o.scale.copy(stored.scale);o.visible=stored.visible;o.userData=stored.userData;});}

export function preparedSigns(ship,parent){const group=ship.v2PreparedSigns;if(!group?.children.length)throw Error('Missing prepared wayfinding signs');for(const o of [...group.children])parent.add(o);}
