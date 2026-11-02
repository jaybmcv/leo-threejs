import * as T from 'three';
const records=new WeakMap();
export function prepareViewerFittings(model){model.updateMatrixWorld(true);model.traverse(o=>{records.set(o,{visible:o.visible,box:o.isMesh?new T.Box3().setFromObject(o):null});o.matrixAutoUpdate=false;});return model;}
export function selectViewerFittings(model,room,roomIds){const xs=room.polygon.map(p=>p[0]),zs=room.polygon.map(p=>p[1]),bounds=new T.Box3(new T.Vector3(Math.min(...xs)-.4,room.y-.4,Math.min(...zs)-.4),new T.Vector3(Math.max(...xs)+.4,room.y+room.height+.4,Math.max(...zs)+.4));let meshes=0;
 function select(o){const base=records.get(o);if(!base)throw Error('Tour fittings were not prepared');if(!base.visible||o.userData.id&&roomIds.has(o.userData.id)&&o.userData.id!==room.id){o.visible=false;return false;}if(o.isMesh){o.visible=base.box.intersectsBox(bounds);if(o.visible)meshes++;return o.visible;}let visible=false;for(const child of o.children)visible=select(child)||visible;o.visible=visible;return visible;}
 select(model);return {meshes,planes:[new T.Plane(new T.Vector3(1,0,0),-bounds.min.x),new T.Plane(new T.Vector3(-1,0,0),bounds.max.x),new T.Plane(new T.Vector3(0,1,0),-bounds.min.y),new T.Plane(new T.Vector3(0,-1,0),bounds.max.y),new T.Plane(new T.Vector3(0,0,1),-bounds.min.z),new T.Plane(new T.Vector3(0,0,-1),bounds.max.z)]};
}
