import {applyLoungeFloorFinish} from '../v2/lounge-floor-material.js';

export function glossLoungeFloor(ship){return applyLoungeFloorFinish(ship);}

// Keep a little environment light on the pile without a glossy reflection pool.
export function quietFloorReflections(root,environment){
 if(!environment)return;
 root.traverse(o=>{if(o.isMesh&&o.material?.name==='Lounge_velvet_carpet'){o.material.envMap=environment;o.material.envMapIntensity=.35;o.material.needsUpdate=true;}});
}
