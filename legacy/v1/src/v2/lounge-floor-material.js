import*as T from'three';import{swirl}from'v2-lounge-floor-art';import{finishOwnedLoungeFloor}from'./community-finishes.js';
// The bundler extracts swirl verbatim from the original lounge-floor.js; no second artwork recipe.
export function applyLoungeFloorFinish(ship){if(ship.v2LoungeFloorMaterial)return{material:ship.v2LoungeFloorMaterial};const map=swirl(),material=new T.MeshStandardMaterial({name:'Lounge_acrylic_floor',map,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.4,roughness:.1,metalness:0});return finishOwnedLoungeFloor(ship,material);}
